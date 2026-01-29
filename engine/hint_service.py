"""
Progressive hint service for challenge containers.

Provides time-based and request-based hint disclosure to enhance learning experience
while maintaining challenge difficulty balance.

Core functionality:
- get_available_hints: Get hints available for a specific challenge session
- request_hint: Allow early access to next hint
- get_hint_status: Get timing and availability information

Features:
- Time-based progressive disclosure (5-minute intervals)
- Request-based early access
- Session-specific hint state tracking
- Challenge metadata integration
- Comprehensive error handling
"""

import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass

# Configure logging
logger = logging.getLogger(__name__)

# Hint configuration constants
HINT_UNLOCK_INTERVAL = 300  # 5 minutes in seconds
MAX_HINTS_PER_CHALLENGE = 10  # Reasonable limit to prevent abuse


@dataclass
class HintInfo:
    """
    Hint information data structure.

    Contains metadata for individual hints including unlock status and timing.
    """
    index: int
    text: str
    unlocked_by: str  # 'time' or 'request'
    unlocked_at: float  # Unix timestamp


class HintServiceError(Exception):
    """Base exception for hint service errors"""
    pass


class ChallengeNotFoundError(HintServiceError):
    """Raised when requested challenge is not found"""
    pass


class InvalidSessionError(HintServiceError):
    """Raised when session data is invalid or missing"""
    pass


class HintService:
    """
    Progressive hint disclosure service for challenge containers.

    Manages hint unlocking based on time elapsed and user requests,
    providing adaptive learning assistance while preserving challenge difficulty.
    """

    def __init__(self, challenges_config_path: str = "/home/mark/dvc/challenges/definitions/challenges.json"):
        """
        Initialize hint service.

        Args:
            challenges_config_path: Path to challenges configuration file
        """
        self.challenges_config_path = challenges_config_path
        self._challenge_cache: Dict[str, Dict] = {}
        self._last_cache_update = 0
        self.cache_ttl = 300  # 5 minutes cache TTL

        logger.info(f"Hint service initialized with config: {challenges_config_path}")

    def _load_challenges_config(self) -> Dict[str, Any]:
        """
        Load challenges configuration from JSON file.

        Returns:
            Challenges configuration dictionary

        Raises:
            HintServiceError: If config cannot be loaded
        """
        try:
            current_time = time.time()

            # Check if cache is still valid
            if (current_time - self._last_cache_update) < self.cache_ttl and self._challenge_cache:
                return self._challenge_cache

            with open(self.challenges_config_path, 'r') as f:
                config = json.load(f)

            # Index challenges by ID for fast lookup
            indexed_challenges = {}
            for challenge in config.get('challenges', []):
                challenge_id = challenge.get('id')
                if challenge_id:
                    indexed_challenges[challenge_id] = challenge

            self._challenge_cache = indexed_challenges
            self._last_cache_update = current_time

            logger.debug(f"Loaded {len(indexed_challenges)} challenges from config")
            return indexed_challenges

        except FileNotFoundError:
            raise HintServiceError(f"Challenges config file not found: {self.challenges_config_path}")
        except json.JSONDecodeError as e:
            raise HintServiceError(f"Invalid JSON in challenges config: {e}")
        except Exception as e:
            raise HintServiceError(f"Failed to load challenges config: {e}")

    def _get_challenge_config(self, challenge_id: str) -> Dict[str, Any]:
        """
        Get configuration for specific challenge.

        Args:
            challenge_id: Challenge identifier

        Returns:
            Challenge configuration dictionary

        Raises:
            ChallengeNotFoundError: If challenge is not found
        """
        challenges = self._load_challenges_config()

        challenge_config = challenges.get(challenge_id)
        if not challenge_config:
            raise ChallengeNotFoundError(f"Challenge not found: {challenge_id}")

        return challenge_config

    def _validate_session_data(self, session_data: Dict[str, Any]) -> None:
        """
        Validate session data structure.

        Args:
            session_data: Session information dictionary

        Raises:
            InvalidSessionError: If session data is invalid
        """
        if not isinstance(session_data, dict):
            raise InvalidSessionError("Session data must be a dictionary")

        required_fields = ['created_at', 'session_id']
        for field in required_fields:
            if field not in session_data:
                raise InvalidSessionError(f"Missing required session field: {field}")

        # Validate created_at is a valid timestamp
        try:
            float(session_data['created_at'])
        except (ValueError, TypeError):
            raise InvalidSessionError("Invalid created_at timestamp in session data")

    def get_available_hints(self, challenge_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get hints available for challenge session.

        Args:
            challenge_id: Challenge identifier
            session_data: Session information including creation time and hint state

        Returns:
            Dictionary with available hints and status information:
            {
                'available_hints': [HintInfo objects as dicts],
                'total_hints': int,
                'next_unlock': timestamp_or_null,
                'hints_requested': int
            }

        Raises:
            ChallengeNotFoundError: If challenge is not found
            InvalidSessionError: If session data is invalid
        """
        try:
            self._validate_session_data(session_data)
            challenge_config = self._get_challenge_config(challenge_id)

            # Get hints from challenge metadata
            hints = challenge_config.get('metadata', {}).get('hints', [])
            if not hints:
                return {
                    'available_hints': [],
                    'total_hints': 0,
                    'next_unlock': None,
                    'hints_requested': 0
                }

            # Calculate time-based and request-based availability
            session_start = float(session_data['created_at'])
            current_time = time.time()
            time_elapsed = current_time - session_start
            hints_requested = session_data.get('hints_requested', 0)

            # Time-based unlocking (one hint every HINT_UNLOCK_INTERVAL seconds)
            time_unlocked_count = min(len(hints), int(time_elapsed / HINT_UNLOCK_INTERVAL))

            # Total available is max of time-unlocked and manually requested
            available_count = max(time_unlocked_count, hints_requested)
            available_count = min(available_count, len(hints))  # Cap at total hints

            # Build available hints list
            available_hints = []
            for i in range(available_count):
                hint_unlock_time = session_start + (i * HINT_UNLOCK_INTERVAL)
                unlocked_by = 'time' if i < time_unlocked_count else 'request'

                hint_info = HintInfo(
                    index=i,
                    text=hints[i],
                    unlocked_by=unlocked_by,
                    unlocked_at=hint_unlock_time
                )
                available_hints.append({
                    'index': hint_info.index,
                    'text': hint_info.text,
                    'unlocked_by': hint_info.unlocked_by,
                    'unlocked_at': hint_info.unlocked_at
                })

            # Calculate next unlock time
            next_unlock = None
            if available_count < len(hints):
                next_unlock = session_start + (available_count * HINT_UNLOCK_INTERVAL)

            result = {
                'available_hints': available_hints,
                'total_hints': len(hints),
                'next_unlock': next_unlock,
                'hints_requested': hints_requested
            }

            logger.debug(f"Retrieved hints for {challenge_id}: {available_count}/{len(hints)} available")
            return result

        except (ChallengeNotFoundError, InvalidSessionError):
            raise
        except Exception as e:
            logger.error(f"Error getting hints for {challenge_id}: {e}")
            raise HintServiceError(f"Failed to get available hints: {e}")

    def request_hint(self, challenge_id: str, session_id: str) -> Dict[str, Any]:
        """
        Request early access to next hint.

        Args:
            challenge_id: Challenge identifier
            session_id: Session identifier (for validation)

        Returns:
            Dictionary with updated hint status after request

        Raises:
            ChallengeNotFoundError: If challenge is not found
            HintServiceError: If hint request fails
        """
        try:
            challenge_config = self._get_challenge_config(challenge_id)

            # Get hints from challenge metadata
            hints = challenge_config.get('metadata', {}).get('hints', [])
            if not hints:
                raise HintServiceError(f"No hints available for challenge: {challenge_id}")

            # Note: In a real implementation, this would update the session data
            # For this implementation, we return the structure indicating a hint was requested
            # The actual session update would be handled by the caller (API endpoint)

            logger.info(f"Hint requested for challenge {challenge_id}, session {session_id}")

            return {
                'success': True,
                'message': 'Hint request processed',
                'challenge_id': challenge_id,
                'session_id': session_id,
                'action_required': 'update_session_hints_requested'  # Instruction for caller
            }

        except ChallengeNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error requesting hint for {challenge_id}: {e}")
            raise HintServiceError(f"Failed to request hint: {e}")

    def get_hint_status(self, challenge_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get hint timing and availability status.

        Args:
            challenge_id: Challenge identifier
            session_data: Session information

        Returns:
            Dictionary with hint status and timing information:
            {
                'challenge_id': str,
                'session_id': str,
                'total_hints': int,
                'available_count': int,
                'time_unlocked_count': int,
                'request_unlocked_count': int,
                'next_unlock_in_seconds': int_or_null,
                'session_duration_seconds': int,
                'hints_requested': int
            }

        Raises:
            ChallengeNotFoundError: If challenge is not found
            InvalidSessionError: If session data is invalid
        """
        try:
            self._validate_session_data(session_data)
            challenge_config = self._get_challenge_config(challenge_id)

            # Get hints from challenge metadata
            hints = challenge_config.get('metadata', {}).get('hints', [])

            # Calculate timing information
            session_start = float(session_data['created_at'])
            current_time = time.time()
            time_elapsed = current_time - session_start
            hints_requested = session_data.get('hints_requested', 0)

            # Calculate unlock counts
            time_unlocked_count = min(len(hints), int(time_elapsed / HINT_UNLOCK_INTERVAL))
            available_count = max(time_unlocked_count, hints_requested)
            available_count = min(available_count, len(hints))

            # Calculate next unlock timing
            next_unlock_in_seconds = None
            if available_count < len(hints):
                next_hint_unlock_time = session_start + (available_count * HINT_UNLOCK_INTERVAL)
                next_unlock_in_seconds = max(0, int(next_hint_unlock_time - current_time))

            status = {
                'challenge_id': challenge_id,
                'session_id': session_data.get('session_id'),
                'total_hints': len(hints),
                'available_count': available_count,
                'time_unlocked_count': time_unlocked_count,
                'request_unlocked_count': max(0, hints_requested - time_unlocked_count),
                'next_unlock_in_seconds': next_unlock_in_seconds,
                'session_duration_seconds': int(time_elapsed),
                'hints_requested': hints_requested
            }

            logger.debug(f"Retrieved hint status for {challenge_id}: {available_count}/{len(hints)}")
            return status

        except (ChallengeNotFoundError, InvalidSessionError):
            raise
        except Exception as e:
            logger.error(f"Error getting hint status for {challenge_id}: {e}")
            raise HintServiceError(f"Failed to get hint status: {e}")


# Global hint service instance for application use
_hint_service_instance: Optional[HintService] = None


def get_hint_service() -> HintService:
    """
    Get global hint service instance (singleton).

    Returns:
        HintService instance
    """
    global _hint_service_instance

    if _hint_service_instance is None:
        _hint_service_instance = HintService()

    return _hint_service_instance


# Convenience functions for direct use
def get_available_hints(challenge_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Get available hints using global hint service"""
    return get_hint_service().get_available_hints(challenge_id, session_data)


def request_hint(challenge_id: str, session_id: str) -> Dict[str, Any]:
    """Request hint using global hint service"""
    return get_hint_service().request_hint(challenge_id, session_id)


def get_hint_status(challenge_id: str, session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Get hint status using global hint service"""
    return get_hint_service().get_hint_status(challenge_id, session_data)