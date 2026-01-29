#!/usr/bin/env python3
"""
Challenge Orchestrator

Container lifecycle management for security challenge deployment.
Implements secure container spawning with isolation and resource limits.
"""

import json
import os
import uuid
import time
import logging
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
from datetime import datetime

import docker
from docker.client import DockerClient
from docker.models.containers import Container
from docker.errors import DockerException, APIError, ImageNotFound

from .flag_system import generate_unique_flag

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ChallengeError(Exception):
    """Base exception for challenge orchestration errors"""
    pass

class ChallengeNotFoundError(ChallengeError):
    """Raised when challenge definition is not found"""
    pass

class SecurityProfileError(ChallengeError):
    """Raised when security profile configuration fails"""
    pass

class ChallengeOrchestrator:
    """
    Container orchestration engine for security challenges

    Provides secure container lifecycle management with proper isolation,
    resource limits, and security hardening based on established profiles.
    """

    def __init__(self,
                 challenges_path: str = "challenges/definitions/challenges.json",
                 security_profiles_path: str = "security/container-profiles.json"):
        """
        Initialize the challenge orchestrator

        Args:
            challenges_path: Path to challenges definition file
            security_profiles_path: Path to security profiles configuration
        """
        self.challenges_path = Path(challenges_path)
        self.security_profiles_path = Path(security_profiles_path)
        self.challenges: Dict[str, Dict] = {}
        self.security_profiles: Dict[str, Dict] = {}
        self.active_containers: Dict[str, Dict] = {}

        # Initialize Docker client with error handling
        try:
            # Try to connect via Docker socket (for containerized deployment)
            import os
            import traceback
            if os.path.exists('/var/run/docker.sock'):
                logger.info("Found Docker socket, initializing client...")
                # Use APIClient for better compatibility with urllib3 < 2.0
                from docker import APIClient
                api_client = APIClient(base_url='unix:///var/run/docker.sock')
                api_client.ping()
                # Now create the high-level client
                self.docker_client = docker.DockerClient(base_url='unix:///var/run/docker.sock')
            else:
                logger.info("Docker socket not found, using environment...")
                # Fallback to environment-based connection
                self.docker_client = docker.from_env()

            self.docker_client.ping()
            logger.info("Docker client initialized successfully")
        except DockerException as e:
            logger.error(f"Failed to initialize Docker client: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise ChallengeError(f"Docker connection failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error initializing Docker client: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise ChallengeError(f"Docker connection failed: {e}")

        # Load configurations
        self._load_challenges()
        self._load_security_profiles()

    def _load_challenges(self) -> None:
        """Load challenge definitions from JSON file and imported challenges"""
        try:
            # Load built-in challenges
            if not self.challenges_path.exists():
                raise ChallengeError(f"Challenges file not found: {self.challenges_path}")

            with open(self.challenges_path, 'r') as f:
                data = json.load(f)

            # Validate schema
            if 'challenges' not in data:
                raise ChallengeError("Invalid challenges file: missing 'challenges' key")

            # Index challenges by ID
            self.challenges = {
                challenge['id']: challenge
                for challenge in data['challenges']
            }

            # Load imported challenges
            imported_path = Path('/app/data/imported/imported_challenges.json')
            if imported_path.exists():
                try:
                    with open(imported_path, 'r') as f:
                        imported_data = json.load(f)
                    
                    if 'challenges' in imported_data:
                        for challenge in imported_data['challenges']:
                            self.challenges[challenge['id']] = challenge
                        logger.info(f"Loaded {len(imported_data['challenges'])} imported challenges")
                except Exception as e:
                    logger.warning(f"Failed to load imported challenges: {e}")

            logger.info(f"Loaded {len(self.challenges)} challenge definitions")

        except (json.JSONDecodeError, FileNotFoundError, KeyError) as e:
            logger.error(f"Failed to load challenges: {e}")
            raise ChallengeError(f"Challenge loading failed: {e}")
    
    def reload_challenges(self) -> None:
        """Reload challenge definitions (useful after importing new challenges)"""
        logger.info("Reloading challenge definitions...")
        self._load_challenges()

    def _load_security_profiles(self) -> None:
        """Load security profiles from JSON file"""
        try:
            if not self.security_profiles_path.exists():
                logger.warning(f"Security profiles not found: {self.security_profiles_path}")
                # Use default minimal security profile
                self.security_profiles = {
                    "default": {
                        "capDrop": ["ALL"],
                        "capAdd": [],
                        "user": "1000:1000",
                        "readOnlyRootfs": True,
                        "securityOpts": ["no-new-privileges:true"]
                    }
                }
                return

            with open(self.security_profiles_path, 'r') as f:
                self.security_profiles = json.load(f)

            logger.info(f"Loaded {len(self.security_profiles)} security profiles")

        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Failed to load security profiles: {e}")
            raise SecurityProfileError(f"Security profile loading failed: {e}")

    def load_challenges(self) -> Dict[str, Dict]:
        """
        Return loaded challenge definitions

        Returns:
            Dict mapping challenge IDs to challenge specifications
        """
        return self.challenges.copy()

    def get_challenge(self, challenge_id: str) -> Dict:
        """
        Get specific challenge definition

        Args:
            challenge_id: ID of the challenge to retrieve

        Returns:
            Challenge specification dictionary

        Raises:
            ChallengeNotFoundError: If challenge ID not found
        """
        if challenge_id not in self.challenges:
            raise ChallengeNotFoundError(f"Challenge not found: {challenge_id}")
        return self.challenges[challenge_id].copy()

    def _apply_security_profile(self,
                              container_spec: Dict,
                              profile_name: str = "challenge") -> Dict:
        """
        Apply security profile to container specification

        Args:
            container_spec: Base container specification from challenge
            profile_name: Name of security profile to apply

        Returns:
            Container specification with security settings applied
        """
        if profile_name not in self.security_profiles:
            logger.warning(f"Security profile not found: {profile_name}, using default")
            profile_name = "default"

        profile = self.security_profiles[profile_name]

        # Start with container spec, override with security profile
        security_config = {
            # Basic security options
            'cap_drop': profile.get('capDrop', ['ALL']),
            'cap_add': profile.get('capAdd', []),
            'user': profile.get('user', '1000:1000'),
            'read_only': profile.get('readOnlyRootfs', False),  # Allow write for challenge apps
            'security_opt': profile.get('securityOpts', ['no-new-privileges:true']),

            # Resource limits from profile and challenge
            'mem_limit': container_spec.get('resource_limits', {}).get('memory', '512m'),
            'nano_cpus': self._parse_cpu_limit(
                container_spec.get('resource_limits', {}).get('cpus', '1.0')
            ),
            'pids_limit': container_spec.get('resource_limits', {}).get('pids_limit', 256),

            # Network isolation
            'network_mode': 'bridge',
            'ipc_mode': 'none',

            # Tmpfs mounts from profile
            'tmpfs': profile.get('tmpfs', {
                '/tmp': 'rw,noexec,nosuid,size=100m'
            }),

            # Environment variables from challenge
            'environment': container_spec.get('environment', {}),

            # Port mappings from challenge (map to random host ports)
            'ports': {
                f"{container_port}/tcp": None  # None means Docker will assign random port
                for container_port in container_spec.get('ports', {}).keys()
            },
        }

        # Additional ulimits if specified (with higher defaults for challenges)
        if 'ulimits' in profile:
            security_config['ulimits'] = [
                docker.types.Ulimit(name=name, soft=max(limits['soft'], 1024), hard=max(limits['hard'], 2048))
                for name, limits in profile['ulimits'].items()
            ]

        return security_config

    def _parse_cpu_limit(self, cpu_str: str) -> int:
        """Convert CPU limit string to nano CPUs for Docker API"""
        try:
            cpu_float = float(cpu_str)
            return int(cpu_float * 1_000_000_000)  # Convert to nano CPUs
        except ValueError:
            logger.warning(f"Invalid CPU limit: {cpu_str}, using default 0.5")
            return 500_000_000  # 0.5 CPU

    def _generate_session_id(self) -> str:
        """Generate unique session ID for container tracking"""
        return str(uuid.uuid4())[:8]

    def _get_flag_secret_key(self) -> str:
        """Get secret key for flag generation from environment or default"""
        return os.getenv('FLAG_SECRET_KEY', 'default-secret-key-change-in-production')

    def spawn_challenge(self,
                       challenge_id: str,
                       user_id: str,
                       session_timeout: int = 3600) -> str:
        """
        Spawn a challenge container with security isolation

        Args:
            challenge_id: ID of challenge to spawn
            user_id: ID of user requesting the challenge
            session_timeout: Container lifetime in seconds (default 1 hour)

        Returns:
            Container ID of spawned challenge

        Raises:
            ChallengeNotFoundError: If challenge ID not found
            ChallengeError: If container spawn fails
        """
        try:
            # Get challenge definition
            challenge = self.get_challenge(challenge_id)
            container_spec = challenge['container_spec']
            image_name = container_spec['image']

            # Check if image exists, build if needed (for imported challenges)
            try:
                self.docker_client.images.get(image_name)
                logger.info(f"Image {image_name} already exists")
            except docker.errors.ImageNotFound:
                logger.info(f"Image {image_name} not found, building...")
                
                # Check if challenge has build context (imported challenges)
                build_context = challenge.get('build_context')
                if build_context and os.path.exists(build_context):
                    logger.info(f"Building image from {build_context}")
                    try:
                        image, build_logs = self.docker_client.images.build(
                            path=build_context,
                            tag=image_name,
                            rm=True,
                            forcerm=True
                        )
                        logger.info(f"Successfully built image {image_name}")
                        # Log build output for debugging
                        for log in build_logs:
                            if 'stream' in log:
                                logger.debug(f"Build: {log['stream'].strip()}")
                    except Exception as build_error:
                        logger.error(f"Failed to build image: {build_error}")
                        raise ChallengeError(f"Failed to build challenge image: {build_error}")
                else:
                    raise ChallengeError(f"Challenge image not available: {image_name}")

            # Generate unique session
            session_id = self._generate_session_id()
            container_name = f"challenge-{challenge_id}-{session_id}"

            # Generate unique flag for this challenge instance
            instance_data = f"timestamp:{int(time.time())},nonce:{session_id}"
            challenge_flag = generate_unique_flag(
                challenge_id=challenge_id,
                user_id=user_id,
                instance_data=instance_data,
                secret_key=self._get_flag_secret_key()
            )
            logger.info(f"Generated unique flag for challenge {challenge_id} session {session_id}")

            # Apply security profile
            security_config = self._apply_security_profile(
                container_spec,
                container_spec.get('security_profile', 'challenge')
            )

            # Add session-specific environment
            security_config['environment'].update({
                'CHALLENGE_ID': challenge_id,
                'USER_ID': user_id,
                'SESSION_ID': session_id,
                'SESSION_START': str(int(time.time())),
                'SESSION_TIMEOUT': str(session_timeout),
                'CHALLENGE_FLAG': challenge_flag
            })

            # Add challenge-specific labels for tracking
            labels = {
                'dvc.challenge.id': challenge_id,
                'dvc.challenge.user': user_id,
                'dvc.challenge.session': session_id,
                'dvc.challenge.started': str(int(time.time())),
                'dvc.challenge.timeout': str(session_timeout),
                'dvc.challenge.name': challenge['name'],
                'dvc.challenge.category': challenge['category']
            }

            logger.info(f"Spawning challenge {challenge_id} for user {user_id}")
            logger.debug(f"Container security config: {security_config}")

            # Create and start container
            container = self.docker_client.containers.run(
                image=container_spec['image'],
                name=container_name,
                labels=labels,
                detach=True,
                remove=False,  # Keep container for inspection after stop
                **security_config
            )

            # Track active container
            self.active_containers[container.id] = {
                'challenge_id': challenge_id,
                'user_id': user_id,
                'session_id': session_id,
                'container_name': container_name,
                'started_at': datetime.now().isoformat(),
                'timeout_at': datetime.fromtimestamp(time.time() + session_timeout).isoformat(),
                'status': 'running'
            }

            logger.info(f"Challenge {challenge_id} spawned successfully: {container.id}")
            return container.id, instance_data

        except ImageNotFound:
            logger.error(f"Challenge image not found: {container_spec['image']}")
            raise ChallengeError(f"Challenge image not available: {container_spec['image']}")
        except APIError as e:
            logger.error(f"Docker API error spawning challenge: {e}")
            raise ChallengeError(f"Container spawn failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error spawning challenge: {e}")
            raise ChallengeError(f"Challenge spawn failed: {e}")

    def stop_challenge(self, container_id: str, force: bool = False) -> bool:
        """
        Stop and remove a challenge container

        Args:
            container_id: ID of container to stop
            force: Whether to force stop (SIGKILL vs SIGTERM)

        Returns:
            True if container was stopped successfully

        Raises:
            ChallengeError: If stop operation fails
        """
        try:
            container = self.docker_client.containers.get(container_id)

            # Verify this is a challenge container
            labels = container.attrs.get('Config', {}).get('Labels', {})
            if not labels.get('dvc.challenge.id'):
                raise ChallengeError(f"Container {container_id} is not a challenge container")

            challenge_id = labels['dvc.challenge.id']
            user_id = labels.get('dvc.challenge.user', 'unknown')

            logger.info(f"Stopping challenge {challenge_id} container {container_id}")

            # Stop container
            if force:
                container.kill()
            else:
                container.stop(timeout=10)

            # Remove container after stop
            container.remove()

            # Update tracking
            if container_id in self.active_containers:
                self.active_containers[container_id]['status'] = 'stopped'
                self.active_containers[container_id]['stopped_at'] = datetime.now().isoformat()

            logger.info(f"Challenge {challenge_id} stopped successfully")
            return True

        except docker.errors.NotFound:
            logger.warning(f"Container not found: {container_id}")
            # Remove from tracking if it was there
            if container_id in self.active_containers:
                del self.active_containers[container_id]
            return False
        except Exception as e:
            logger.error(f"Error stopping challenge container: {e}")
            raise ChallengeError(f"Container stop failed: {e}")

    def list_running(self, user_id: Optional[str] = None) -> List[Dict]:
        """
        List active challenge containers

        Args:
            user_id: Optional filter by specific user

        Returns:
            List of running challenge container information
        """
        try:
            # Get all containers with challenge labels
            filters = {'label': 'dvc.challenge.id'}
            if user_id:
                filters['label'] = f'dvc.challenge.user={user_id}'

            containers = self.docker_client.containers.list(
                filters=filters,
                all=False  # Only running containers
            )

            running_challenges = []
            for container in containers:
                labels = container.attrs.get('Config', {}).get('Labels', {})

                challenge_info = {
                    'container_id': container.id,
                    'container_name': container.name,
                    'challenge_id': labels.get('dvc.challenge.id'),
                    'challenge_name': labels.get('dvc.challenge.name'),
                    'category': labels.get('dvc.challenge.category'),
                    'user_id': labels.get('dvc.challenge.user'),
                    'session_id': labels.get('dvc.challenge.session'),
                    'started_at': labels.get('dvc.challenge.started'),
                    'status': container.status,
                    'ports': self._extract_port_info(container)
                }

                running_challenges.append(challenge_info)

            logger.info(f"Found {len(running_challenges)} running challenges")
            return running_challenges

        except Exception as e:
            logger.error(f"Error listing running challenges: {e}")
            raise ChallengeError(f"Failed to list challenges: {e}")

    def _extract_port_info(self, container: Container) -> Dict[str, str]:
        """Extract port mapping information from container"""
        port_info = {}
        try:
            ports = container.attrs.get('NetworkSettings', {}).get('Ports', {})
            for container_port, host_bindings in ports.items():
                if host_bindings:
                    host_port = host_bindings[0]['HostPort']
                    port_info[container_port] = f"localhost:{host_port}"
        except Exception as e:
            logger.warning(f"Failed to extract port info: {e}")
        return port_info

    def cleanup_expired(self) -> int:
        """
        Clean up expired challenge containers

        Returns:
            Number of containers cleaned up
        """
        cleaned_count = 0
        current_time = time.time()

        try:
            # Find containers with expired timeouts
            filters = {'label': 'dvc.challenge.id'}
            containers = self.docker_client.containers.list(filters=filters, all=True)

            for container in containers:
                labels = container.attrs.get('Config', {}).get('Labels', {})

                try:
                    started_time = int(labels.get('dvc.challenge.started', '0'))
                    timeout_duration = int(labels.get('dvc.challenge.timeout', '3600'))

                    if current_time > (started_time + timeout_duration):
                        logger.info(f"Cleaning up expired container: {container.id}")
                        self.stop_challenge(container.id, force=True)
                        cleaned_count += 1

                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid timeout labels on container {container.id}: {e}")

        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

        return cleaned_count

    def validate_flag(self, challenge_id: str, user_id: str, submitted_flag: str) -> bool:
        """
        Validate a submitted flag for a challenge session.

        Args:
            challenge_id: Challenge identifier
            user_id: User identifier
            submitted_flag: Flag submitted by user

        Returns:
            True if flag is valid, False otherwise
        """
        from .flag_system import validate_flag

        try:
            # Get running challenge container for this user/challenge
            filters = {
                'label': [
                    f'dvc.challenge.id={challenge_id}',
                    f'dvc.challenge.user={user_id}'
                ]
            }

            containers = self.docker_client.containers.list(filters=filters, all=False)

            if not containers:
                logger.warning(f"No running challenge container found for {challenge_id}/{user_id}")
                return False

            # Use the most recent container if multiple exist
            container = containers[0]
            labels = container.attrs.get('Config', {}).get('Labels', {})

            # Reconstruct instance data from container labels
            session_id = labels.get('dvc.challenge.session')
            started_time = labels.get('dvc.challenge.started')

            if not session_id or not started_time:
                logger.error(f"Missing session data in container labels")
                return False

            instance_data = f"timestamp:{started_time},nonce:{session_id}"

            # Validate flag using same secret key
            is_valid = validate_flag(
                flag=submitted_flag,
                challenge_id=challenge_id,
                user_id=user_id,
                instance_data=instance_data,
                secret_key=self._get_flag_secret_key()
            )

            if is_valid:
                logger.info(f"Valid flag submitted for {challenge_id} by {user_id}")
            else:
                logger.info(f"Invalid flag submitted for {challenge_id} by {user_id}")

            return is_valid

        except Exception as e:
            logger.error(f"Error validating flag: {e}")
            return False

def main():
    """CLI interface for testing orchestrator"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m engine.orchestrator <command>")
        print("Commands: list-challenges, spawn <challenge_id> <user_id>, list-running, cleanup")
        return

    try:
        orchestrator = ChallengeOrchestrator()
        command = sys.argv[1]

        if command == "list-challenges":
            challenges = orchestrator.load_challenges()
            print(f"Available challenges: {len(challenges)}")
            for cid, challenge in challenges.items():
                print(f"  {cid}: {challenge['name']} ({challenge['category']})")

        elif command == "spawn" and len(sys.argv) >= 4:
            challenge_id = sys.argv[2]
            user_id = sys.argv[3]
            container_id = orchestrator.spawn_challenge(challenge_id, user_id)
            print(f"Spawned challenge: {container_id}")

        elif command == "list-running":
            running = orchestrator.list_running()
            print(f"Running challenges: {len(running)}")
            for challenge in running:
                print(f"  {challenge['container_id']}: {challenge['challenge_name']} (user: {challenge['user_id']})")

        elif command == "cleanup":
            cleaned = orchestrator.cleanup_expired()
            print(f"Cleaned up {cleaned} expired containers")

        else:
            print("Unknown command or missing arguments")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()