#!/usr/bin/env python3
"""
Container Health Monitor

Background health monitoring service for challenge containers with automated recovery.
Provides proactive detection and recovery from container failures to ensure consistent
user experience.

Features:
- Background monitoring thread with configurable intervals
- Docker SDK health check integration
- Auto-restart unhealthy containers
- Container cleanup for permanently failed containers
- Thread-safe operations with comprehensive logging
"""

import threading
import time
import logging
from typing import Dict, Optional, Set, Any
from enum import Enum
from datetime import datetime
import docker
from docker.errors import DockerException, NotFound, APIError

# Configure logging
logger = logging.getLogger(__name__)

# Health monitoring constants
DEFAULT_CHECK_INTERVAL = 30  # seconds
FAILURE_THRESHOLD = 3  # failures before restart
RECOVERY_TIMEOUT = 300  # 5 minutes max for recovery
EXPONENTIAL_BACKOFF_MAX = 300  # 5 minutes max backoff


class ContainerHealthStatus(Enum):
    """Container health status enumeration"""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    STARTING = "starting"
    NONE = "none"  # No health check configured
    UNKNOWN = "unknown"  # Unable to determine


class HealthMonitor:
    """
    Background container health monitoring with automated recovery.

    Monitors challenge containers using Docker SDK health checks and automatically
    recovers from failures through restart and cleanup operations.
    """

    def __init__(self, docker_client: Optional[docker.DockerClient] = None):
        """
        Initialize health monitor.

        Args:
            docker_client: Docker client instance (will create if None)
        """
        if docker_client:
            self.docker_client = docker_client
        else:
            try:
                self.docker_client = docker.from_env()
                self.docker_client.ping()
            except DockerException as e:
                logger.error(f"Failed to initialize Docker client: {e}")
                raise

        # Monitoring state
        self._monitored_containers: Dict[str, Dict[str, Any]] = {}
        self._monitor_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.RLock()
        self._running = False

        # Health status tracking
        self._health_status: Dict[str, ContainerHealthStatus] = {}
        self._failure_counts: Dict[str, int] = {}
        self._last_check_time: Dict[str, float] = {}
        self._recovery_attempts: Dict[str, int] = {}

        logger.info("HealthMonitor initialized")

    def start_monitoring(self, container_id: str, check_interval: int = DEFAULT_CHECK_INTERVAL) -> None:
        """
        Begin monitoring specific container.

        Args:
            container_id: ID of container to monitor
            check_interval: Health check interval in seconds
        """
        with self._lock:
            try:
                # Verify container exists and is a challenge container
                container = self.docker_client.containers.get(container_id)
                labels = container.attrs.get('Config', {}).get('Labels', {})

                if not labels.get('dvc.challenge.id'):
                    logger.warning(f"Container {container_id} is not a challenge container")
                    return

                # Add to monitoring
                self._monitored_containers[container_id] = {
                    'check_interval': check_interval,
                    'challenge_id': labels.get('dvc.challenge.id'),
                    'user_id': labels.get('dvc.challenge.user'),
                    'session_id': labels.get('dvc.challenge.session'),
                    'added_at': time.time()
                }

                # Initialize status tracking
                self._health_status[container_id] = ContainerHealthStatus.UNKNOWN
                self._failure_counts[container_id] = 0
                self._last_check_time[container_id] = 0
                self._recovery_attempts[container_id] = 0

                logger.info(f"Started monitoring container {container_id} (interval: {check_interval}s)")

                # Start monitor thread if not running
                if not self._running:
                    self._start_monitor_thread()

            except NotFound:
                logger.error(f"Container not found: {container_id}")
            except Exception as e:
                logger.error(f"Error starting monitoring for {container_id}: {e}")

    def stop_monitoring(self, container_id: str) -> None:
        """
        Stop monitoring and cleanup container tracking.

        Args:
            container_id: ID of container to stop monitoring
        """
        with self._lock:
            if container_id in self._monitored_containers:
                # Remove from monitoring
                del self._monitored_containers[container_id]

                # Cleanup tracking data
                self._health_status.pop(container_id, None)
                self._failure_counts.pop(container_id, None)
                self._last_check_time.pop(container_id, None)
                self._recovery_attempts.pop(container_id, None)

                logger.info(f"Stopped monitoring container {container_id}")

                # Stop monitor thread if no containers left
                if not self._monitored_containers and self._running:
                    self._stop_monitor_thread()

    def get_health_status(self, container_id: str) -> ContainerHealthStatus:
        """
        Get current health status for container.

        Args:
            container_id: Container to check

        Returns:
            Current health status
        """
        with self._lock:
            return self._health_status.get(container_id, ContainerHealthStatus.UNKNOWN)

    def get_monitored_containers(self) -> Dict[str, Dict[str, Any]]:
        """
        Get list of currently monitored containers.

        Returns:
            Dictionary of monitored containers with metadata
        """
        with self._lock:
            return self._monitored_containers.copy()

    def get_health_summary(self) -> Dict[str, Any]:
        """
        Get health monitoring summary statistics.

        Returns:
            Summary statistics dictionary
        """
        with self._lock:
            summary = {
                'monitored_count': len(self._monitored_containers),
                'healthy_count': 0,
                'unhealthy_count': 0,
                'starting_count': 0,
                'unknown_count': 0,
                'total_recovery_attempts': sum(self._recovery_attempts.values()),
                'is_monitoring': self._running
            }

            for status in self._health_status.values():
                if status == ContainerHealthStatus.HEALTHY:
                    summary['healthy_count'] += 1
                elif status == ContainerHealthStatus.UNHEALTHY:
                    summary['unhealthy_count'] += 1
                elif status == ContainerHealthStatus.STARTING:
                    summary['starting_count'] += 1
                else:
                    summary['unknown_count'] += 1

            return summary

    def shutdown(self) -> None:
        """Shutdown health monitor and cleanup resources"""
        logger.info("Shutting down health monitor...")
        self._stop_monitor_thread()

        with self._lock:
            self._monitored_containers.clear()
            self._health_status.clear()
            self._failure_counts.clear()
            self._last_check_time.clear()
            self._recovery_attempts.clear()

        logger.info("Health monitor shutdown complete")

    def _start_monitor_thread(self) -> None:
        """Start background monitoring thread"""
        if self._running:
            return

        self._stop_event.clear()
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            name="HealthMonitor",
            daemon=True
        )
        self._monitor_thread.start()
        self._running = True
        logger.info("Health monitoring thread started")

    def _stop_monitor_thread(self) -> None:
        """Stop background monitoring thread"""
        if not self._running:
            return

        self._stop_event.set()
        self._running = False

        if self._monitor_thread and self._monitor_thread.is_alive():
            self._monitor_thread.join(timeout=5)

        logger.info("Health monitoring thread stopped")

    def _monitor_loop(self) -> None:
        """Main monitoring loop - runs in background thread"""
        logger.info("Health monitoring loop started")

        while not self._stop_event.is_set():
            try:
                current_time = time.time()
                containers_to_check = []

                # Determine which containers need checking (thread-safe copy)
                with self._lock:
                    for container_id, config in self._monitored_containers.items():
                        last_check = self._last_check_time.get(container_id, 0)
                        check_interval = config['check_interval']

                        if current_time - last_check >= check_interval:
                            containers_to_check.append(container_id)

                # Check containers (outside lock to avoid blocking)
                for container_id in containers_to_check:
                    try:
                        self._check_container_health(container_id)
                    except Exception as e:
                        logger.error(f"Error checking container {container_id}: {e}")

                # Wait before next cycle (interruptible)
                self._stop_event.wait(timeout=5)

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                # Continue monitoring despite errors
                self._stop_event.wait(timeout=10)

        logger.info("Health monitoring loop stopped")

    def _check_container_health(self, container_id: str) -> None:
        """
        Check health of specific container and handle failures.

        Args:
            container_id: Container to check
        """
        try:
            # Get container
            container = self.docker_client.containers.get(container_id)

            # Update last check time
            with self._lock:
                self._last_check_time[container_id] = time.time()

            # Check container status
            container.reload()
            container_state = container.attrs.get('State', {})

            # Determine health status
            health_status = self._extract_health_status(container_state)

            # Update health status
            with self._lock:
                previous_status = self._health_status.get(container_id, ContainerHealthStatus.UNKNOWN)
                self._health_status[container_id] = health_status

                # Log status changes
                if previous_status != health_status:
                    challenge_id = self._monitored_containers.get(container_id, {}).get('challenge_id', 'unknown')
                    logger.info(f"Container {container_id} ({challenge_id}): {previous_status.value} -> {health_status.value}")

            # Handle unhealthy containers
            if health_status == ContainerHealthStatus.UNHEALTHY:
                self._handle_unhealthy_container(container_id, container)
            elif health_status == ContainerHealthStatus.HEALTHY:
                # Reset failure count on recovery
                with self._lock:
                    self._failure_counts[container_id] = 0

        except NotFound:
            logger.warning(f"Container {container_id} no longer exists, removing from monitoring")
            self.stop_monitoring(container_id)
        except Exception as e:
            logger.error(f"Error checking health for container {container_id}: {e}")

            # Mark as unknown on check failure
            with self._lock:
                self._health_status[container_id] = ContainerHealthStatus.UNKNOWN

    def _extract_health_status(self, container_state: Dict[str, Any]) -> ContainerHealthStatus:
        """
        Extract health status from container state.

        Args:
            container_state: Container state dictionary from Docker API

        Returns:
            Extracted health status
        """
        # Check if container is running
        if not container_state.get('Running', False):
            return ContainerHealthStatus.UNHEALTHY

        # Check health check status if available
        health_info = container_state.get('Health', {})
        if health_info:
            health_status = health_info.get('Status', '').lower()

            if health_status == 'healthy':
                return ContainerHealthStatus.HEALTHY
            elif health_status == 'unhealthy':
                return ContainerHealthStatus.UNHEALTHY
            elif health_status == 'starting':
                return ContainerHealthStatus.STARTING

        # Check exit code for stopped containers
        if container_state.get('ExitCode', 0) != 0:
            return ContainerHealthStatus.UNHEALTHY

        # If running but no health check, consider healthy
        if container_state.get('Running', False):
            return ContainerHealthStatus.HEALTHY

        return ContainerHealthStatus.NONE

    def _handle_unhealthy_container(self, container_id: str, container: Any) -> None:
        """
        Handle unhealthy container with recovery actions.

        Args:
            container_id: ID of unhealthy container
            container: Docker container object
        """
        with self._lock:
            # Increment failure count
            self._failure_counts[container_id] = self._failure_counts.get(container_id, 0) + 1
            failure_count = self._failure_counts[container_id]

            config = self._monitored_containers.get(container_id, {})
            challenge_id = config.get('challenge_id', 'unknown')
            user_id = config.get('user_id', 'unknown')

            logger.warning(
                f"Unhealthy container detected: {container_id} ({challenge_id}) "
                f"- failure count: {failure_count}"
            )

            # Attempt recovery if under threshold
            if failure_count <= FAILURE_THRESHOLD:
                recovery_attempts = self._recovery_attempts.get(container_id, 0)

                if recovery_attempts < FAILURE_THRESHOLD:
                    self._recovery_attempts[container_id] = recovery_attempts + 1

                    # Attempt restart (outside lock)
                    threading.Thread(
                        target=self._attempt_container_restart,
                        args=[container_id, container],
                        daemon=True
                    ).start()
                else:
                    # Too many recovery attempts - mark for cleanup
                    logger.error(
                        f"Container {container_id} ({challenge_id}) exceeded recovery attempts, "
                        f"marking for cleanup"
                    )
                    self._mark_for_cleanup(container_id)
            else:
                # Exceeded failure threshold - cleanup
                logger.error(
                    f"Container {container_id} ({challenge_id}) exceeded failure threshold, "
                    f"performing cleanup"
                )
                self._mark_for_cleanup(container_id)

    def _attempt_container_restart(self, container_id: str, container: Any) -> None:
        """
        Attempt to restart unhealthy container.

        Args:
            container_id: Container to restart
            container: Docker container object
        """
        try:
            config = self._monitored_containers.get(container_id, {})
            challenge_id = config.get('challenge_id', 'unknown')

            logger.info(f"Attempting to restart container {container_id} ({challenge_id})")

            # Try restart
            container.restart(timeout=30)

            # Wait for restart to complete
            time.sleep(10)

            # Verify restart success
            container.reload()
            if container.status == 'running':
                logger.info(f"Successfully restarted container {container_id} ({challenge_id})")

                # Reset failure tracking
                with self._lock:
                    self._failure_counts[container_id] = 0

            else:
                logger.warning(f"Container restart failed: {container_id} status: {container.status}")

        except Exception as e:
            logger.error(f"Error restarting container {container_id}: {e}")

    def _mark_for_cleanup(self, container_id: str) -> None:
        """
        Mark container for cleanup due to permanent failure.

        Args:
            container_id: Container to cleanup
        """
        try:
            config = self._monitored_containers.get(container_id, {})
            challenge_id = config.get('challenge_id', 'unknown')
            user_id = config.get('user_id', 'unknown')

            logger.info(f"Cleaning up failed container {container_id} ({challenge_id})")

            # Stop monitoring first
            self.stop_monitoring(container_id)

            # Cleanup in background thread to avoid blocking
            threading.Thread(
                target=self._cleanup_failed_container,
                args=[container_id, challenge_id, user_id],
                daemon=True
            ).start()

        except Exception as e:
            logger.error(f"Error marking container for cleanup {container_id}: {e}")

    def _cleanup_failed_container(self, container_id: str, challenge_id: str, user_id: str) -> None:
        """
        Cleanup permanently failed container.

        Args:
            container_id: Container to cleanup
            challenge_id: Challenge ID for logging
            user_id: User ID for logging
        """
        try:
            container = self.docker_client.containers.get(container_id)

            # Force stop if still running
            if container.status == 'running':
                container.kill()

            # Remove container
            container.remove(force=True)

            logger.info(f"Cleaned up failed container {container_id} ({challenge_id}) for user {user_id}")

        except NotFound:
            logger.info(f"Container {container_id} already removed")
        except Exception as e:
            logger.error(f"Error cleaning up container {container_id}: {e}")