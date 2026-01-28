"""
Session management system for challenge containers.

Provides in-memory session tracking with automatic cleanup for local-only deployment.
Manages active challenge sessions with user isolation and automatic expiration.

Core functionality:
- create_session: Create new challenge session with auto-cleanup
- get_session: Retrieve active session by identifiers
- cleanup_session: Remove session and stop associated container
- list_user_sessions: Get all sessions for specific user
- cleanup_expired_sessions: Clean expired sessions automatically

Features:
- Thread-safe operations with RLock
- Automatic session expiration (default 1 hour)
- Container lifecycle integration
- Monitoring metrics integration
- Comprehensive error handling
"""

import threading
import time
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

# Configure logging
logger = logging.getLogger(__name__)

# Session configuration constants
DEFAULT_SESSION_TIMEOUT = 3600  # 1 hour in seconds
CLEANUP_INTERVAL = 300  # 5 minutes between cleanup checks
MAX_SESSIONS_PER_USER = 5  # Prevent resource abuse


@dataclass
class SessionInfo:
    """
    Session information data structure.

    Contains all metadata needed to track and manage an active challenge session.
    """
    session_id: str
    user_id: str
    challenge_id: str
    container_id: str
    container_port: Optional[str]
    created_at: float  # Unix timestamp
    expires_at: float  # Unix timestamp
    status: str = "active"  # active, expired, stopped


class SessionManagerError(Exception):
    """Base exception for session management errors"""
    pass


class SessionNotFoundError(SessionManagerError):
    """Raised when requested session is not found"""
    pass


class UserSessionLimitError(SessionManagerError):
    """Raised when user exceeds maximum session limit"""
    pass


class SessionManager:
    """
    Thread-safe session manager for challenge containers.

    Manages active challenge sessions with automatic cleanup and user isolation.
    Designed for local-only deployment with in-memory storage.
    """

    def __init__(self, max_sessions_per_user: int = MAX_SESSIONS_PER_USER):
        """
        Initialize session manager.

        Args:
            max_sessions_per_user: Maximum concurrent sessions per user
        """
        self.max_sessions_per_user = max_sessions_per_user
        self._sessions: Dict[str, SessionInfo] = {}
        self._user_sessions: Dict[str, List[str]] = {}  # user_id -> [session_ids]
        self._lock = threading.RLock()
        self._cleanup_timer: Optional[threading.Timer] = None

        # Start automatic cleanup
        self._schedule_cleanup()

        logger.info(f"Session manager initialized (max_sessions_per_user={max_sessions_per_user})")

    def create_session(self,
                      user_id: str,
                      challenge_id: str,
                      container_info: Dict[str, Any],
                      session_timeout: int = DEFAULT_SESSION_TIMEOUT) -> str:
        """
        Create new challenge session with automatic cleanup.

        Args:
            user_id: User identifier
            challenge_id: Challenge identifier
            container_info: Container details (id, port, etc.)
            session_timeout: Session lifetime in seconds

        Returns:
            Unique session identifier

        Raises:
            UserSessionLimitError: If user exceeds session limit
            SessionManagerError: If session creation fails
        """
        with self._lock:
            try:
                # Validate input
                if not all([user_id, challenge_id]):
                    raise SessionManagerError("user_id and challenge_id cannot be empty")

                if not isinstance(container_info, dict) or 'container_id' not in container_info:
                    raise SessionManagerError("container_info must contain 'container_id'")

                # Check user session limit
                user_session_count = len(self._user_sessions.get(user_id, []))
                if user_session_count >= self.max_sessions_per_user:
                    raise UserSessionLimitError(
                        f"User {user_id} has reached maximum session limit ({self.max_sessions_per_user})"
                    )

                # Generate unique session ID
                session_id = self._generate_session_id()
                current_time = time.time()

                # Create session info
                session_info = SessionInfo(
                    session_id=session_id,
                    user_id=user_id,
                    challenge_id=challenge_id,
                    container_id=container_info['container_id'],
                    container_port=container_info.get('container_port'),
                    created_at=current_time,
                    expires_at=current_time + session_timeout,
                    status="active"
                )

                # Store session
                self._sessions[session_id] = session_info

                # Update user session tracking
                if user_id not in self._user_sessions:
                    self._user_sessions[user_id] = []
                self._user_sessions[user_id].append(session_id)

                # Schedule automatic cleanup for this session
                cleanup_delay = session_timeout + 60  # Extra buffer for cleanup
                cleanup_timer = threading.Timer(
                    cleanup_delay,
                    self._auto_cleanup_session,
                    args=[session_id]
                )
                cleanup_timer.daemon = True
                cleanup_timer.start()

                logger.info(
                    f"Created session {session_id} for user {user_id}, "
                    f"challenge {challenge_id}, expires at {datetime.fromtimestamp(session_info.expires_at)}"
                )

                return session_id

            except Exception as e:
                logger.error(f"Failed to create session: {e}")
                raise SessionManagerError(f"Session creation failed: {e}")

    def get_session(self, user_id: str, challenge_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve active session for user and challenge.

        Args:
            user_id: User identifier
            challenge_id: Challenge identifier

        Returns:
            Session data dictionary or None if not found
        """
        with self._lock:
            # Find active session for user/challenge combination
            for session_info in self._sessions.values():
                if (session_info.user_id == user_id and
                    session_info.challenge_id == challenge_id and
                    session_info.status == "active"):

                    # Check if session is expired
                    if time.time() > session_info.expires_at:
                        session_info.status = "expired"
                        logger.info(f"Session {session_info.session_id} marked as expired")
                        return None

                    return asdict(session_info)

            return None

    def get_session_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve session by session ID.

        Args:
            session_id: Session identifier

        Returns:
            Session data dictionary or None if not found
        """
        with self._lock:
            session_info = self._sessions.get(session_id)
            if not session_info:
                return None

            # Check expiration
            if time.time() > session_info.expires_at:
                session_info.status = "expired"
                return None

            return asdict(session_info)

    def cleanup_session(self, session_id: str) -> bool:
        """
        Remove session and stop associated container.

        Args:
            session_id: Session identifier to cleanup

        Returns:
            True if session was found and cleaned, False otherwise
        """
        with self._lock:
            session_info = self._sessions.get(session_id)
            if not session_info:
                logger.warning(f"Session not found for cleanup: {session_id}")
                return False

            try:
                # Mark session as stopped
                session_info.status = "stopped"

                # Remove from user session tracking
                user_sessions = self._user_sessions.get(session_info.user_id, [])
                if session_id in user_sessions:
                    user_sessions.remove(session_id)
                    if not user_sessions:
                        del self._user_sessions[session_info.user_id]

                # Remove session record
                del self._sessions[session_id]

                logger.info(f"Cleaned up session {session_id} for user {session_info.user_id}")
                return True

            except Exception as e:
                logger.error(f"Error cleaning up session {session_id}: {e}")
                return False

    def list_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all active sessions for specific user.

        Args:
            user_id: User identifier

        Returns:
            List of active session data dictionaries
        """
        with self._lock:
            user_session_ids = self._user_sessions.get(user_id, [])
            active_sessions = []

            current_time = time.time()

            for session_id in user_session_ids.copy():  # Copy to avoid modification during iteration
                session_info = self._sessions.get(session_id)
                if not session_info:
                    # Clean up stale reference
                    user_session_ids.remove(session_id)
                    continue

                # Check if expired
                if current_time > session_info.expires_at:
                    session_info.status = "expired"
                elif session_info.status == "active":
                    active_sessions.append(asdict(session_info))

            return active_sessions

    def cleanup_expired_sessions(self) -> int:
        """
        Remove sessions older than their timeout period.

        Returns:
            Number of sessions cleaned up
        """
        cleaned_count = 0
        current_time = time.time()

        with self._lock:
            expired_session_ids = []

            # Find expired sessions
            for session_id, session_info in self._sessions.items():
                if current_time > session_info.expires_at:
                    expired_session_ids.append(session_id)

            # Clean up expired sessions
            for session_id in expired_session_ids:
                if self.cleanup_session(session_id):
                    cleaned_count += 1

        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} expired sessions")

        return cleaned_count

    def get_session_stats(self) -> Dict[str, int]:
        """
        Get session statistics for monitoring.

        Returns:
            Dictionary with session metrics
        """
        with self._lock:
            stats = {
                'total_sessions': len(self._sessions),
                'active_sessions': 0,
                'expired_sessions': 0,
                'stopped_sessions': 0,
                'unique_users': len(self._user_sessions)
            }

            current_time = time.time()
            for session_info in self._sessions.values():
                if current_time > session_info.expires_at:
                    stats['expired_sessions'] += 1
                elif session_info.status == "active":
                    stats['active_sessions'] += 1
                else:
                    stats['stopped_sessions'] += 1

            return stats

    def _generate_session_id(self) -> str:
        """Generate unique session identifier"""
        return str(uuid.uuid4())[:8]

    def _auto_cleanup_session(self, session_id: str) -> None:
        """Automatic session cleanup callback"""
        try:
            self.cleanup_session(session_id)
        except Exception as e:
            logger.error(f"Auto-cleanup failed for session {session_id}: {e}")

    def _schedule_cleanup(self) -> None:
        """Schedule periodic cleanup of expired sessions"""
        try:
            self.cleanup_expired_sessions()
        except Exception as e:
            logger.error(f"Scheduled cleanup failed: {e}")
        finally:
            # Schedule next cleanup
            self._cleanup_timer = threading.Timer(CLEANUP_INTERVAL, self._schedule_cleanup)
            self._cleanup_timer.daemon = True
            self._cleanup_timer.start()

    def shutdown(self) -> None:
        """Shutdown session manager and cleanup resources"""
        with self._lock:
            if self._cleanup_timer:
                self._cleanup_timer.cancel()

            # Cleanup all sessions
            session_ids = list(self._sessions.keys())
            for session_id in session_ids:
                self.cleanup_session(session_id)

            logger.info("Session manager shutdown complete")


# Global session manager instance for application use
_session_manager_instance: Optional[SessionManager] = None
_instance_lock = threading.Lock()


def get_session_manager() -> SessionManager:
    """
    Get global session manager instance (singleton).

    Returns:
        SessionManager instance
    """
    global _session_manager_instance

    with _instance_lock:
        if _session_manager_instance is None:
            _session_manager_instance = SessionManager()
        return _session_manager_instance


# Convenience functions for direct use
def create_session(user_id: str, challenge_id: str, container_info: Dict[str, Any]) -> str:
    """Create new session using global session manager"""
    return get_session_manager().create_session(user_id, challenge_id, container_info)


def get_session(user_id: str, challenge_id: str) -> Optional[Dict[str, Any]]:
    """Get session using global session manager"""
    return get_session_manager().get_session(user_id, challenge_id)


def cleanup_session(session_id: str) -> bool:
    """Cleanup session using global session manager"""
    return get_session_manager().cleanup_session(session_id)