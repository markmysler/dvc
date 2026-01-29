"""
Challenge management REST API endpoints.

Provides HTTP interface for challenge lifecycle management:
- List available challenges from definitions
- Spawn challenge containers for users
- Stop challenge containers and cleanup sessions

Integrates with:
- ChallengeOrchestrator for container management
- SessionManager for session tracking
- Security profiles for container hardening

Security considerations:
- Input validation on all endpoints
- User session limits
- Container resource limits
- Proper error handling without information leakage
"""

import logging
import time
from typing import Dict, Any, List

from flask import Blueprint, request, jsonify, current_app
from werkzeug.exceptions import BadRequest

from engine.orchestrator import ChallengeOrchestrator, ChallengeError, ChallengeNotFoundError
from engine.session_manager import get_session_manager, UserSessionLimitError, SessionManagerError

# Configure logging
logger = logging.getLogger(__name__)

# Create Blueprint
bp = Blueprint('challenges', __name__)

# Global orchestrator instance
_orchestrator_instance = None


def get_orchestrator() -> ChallengeOrchestrator:
    """Get global orchestrator instance"""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = ChallengeOrchestrator(
            challenges_path="/app/challenges/definitions/challenges.json",
            security_profiles_path="/app/security/container-profiles.json"
        )
    return _orchestrator_instance


@bp.route('/api/challenges', methods=['GET'])
def list_challenges():
    """
    List available challenges from definitions.

    Returns:
        JSON response with challenge list and metadata

    Example Response:
        {
            "status": "success",
            "challenges": [
                {
                    "id": "web-xss-basic",
                    "name": "Basic XSS Challenge",
                    "category": "web",
                    "difficulty": "beginner",
                    "description": "Learn about cross-site scripting vulnerabilities",
                    "tags": ["xss", "web", "javascript"]
                }
            ],
            "count": 1
        }
    """
    try:
        orchestrator = get_orchestrator()
        challenges = orchestrator.load_challenges()

        # Transform challenge data for API response
        challenge_list = []
        for challenge_id, challenge_data in challenges.items():
            metadata = challenge_data.get('metadata', {})
            challenge_info = {
                'id': challenge_id,
                'name': challenge_data.get('name', challenge_id),
                'category': challenge_data.get('category', 'unknown'),
                'difficulty': challenge_data.get('difficulty', 'unknown'),
                'description': challenge_data.get('description', ''),
                'tags': challenge_data.get('tags', []),
                'points': challenge_data.get('points', 0),
                'estimated_time': metadata.get('estimated_time', '30 minutes'),
                'imported': challenge_data.get('imported', False),
                'hints': metadata.get('hints', []),
                'learning_objectives': metadata.get('learning_objectives', []),
                'author': metadata.get('author', 'Unknown'),
                'version': metadata.get('version', '1.0')
            }
            challenge_list.append(challenge_info)

        # Sort by difficulty and category
        difficulty_order = {'beginner': 0, 'intermediate': 1, 'advanced': 2, 'expert': 3}
        challenge_list.sort(key=lambda x: (
            x['category'],
            difficulty_order.get(x['difficulty'], 999),
            x['name']
        ))

        logger.info(f"Listed {len(challenge_list)} available challenges")

        return jsonify({
            'status': 'success',
            'challenges': challenge_list,
            'count': len(challenge_list)
        })

    except ChallengeError as e:
        logger.error(f"Challenge loading error: {e}")
        return jsonify({
            'status': 'error',
            'error': f'Failed to load challenges: {str(e)}',
            'code': 500
        }), 500

    except Exception as e:
        logger.error(f"Unexpected error listing challenges: {e}")
        return jsonify({
            'status': 'error',
            'error': 'Failed to retrieve challenges',
            'code': 500
        }), 500


@bp.route('/api/challenges', methods=['POST'])
def spawn_challenge():
    """
    Spawn a challenge container for a user.

    Request Body:
        {
            "challenge_id": "web-xss-basic",
            "user_id": "user123",
            "session_timeout": 3600  // optional, defaults to 1 hour
        }

    Returns:
        JSON response with container details

    Example Response:
        {
            "status": "success",
            "session_id": "abc12345",
            "container_id": "container123",
            "challenge": {
                "id": "web-xss-basic",
                "name": "Basic XSS Challenge",
                "ports": {
                    "80/tcp": "localhost:32768"
                }
            },
            "expires_at": 1234567890
        }
    """
    try:
        # Validate request
        if not request.is_json:
            raise BadRequest("Request must be JSON")

        data = request.get_json()
        if not data:
            raise BadRequest("Request body is required")

        # Validate required fields
        challenge_id = data.get('challenge_id')
        user_id = data.get('user_id')
        session_timeout = data.get('session_timeout', 3600)

        if not challenge_id or not user_id:
            raise BadRequest("challenge_id and user_id are required")

        if not isinstance(session_timeout, int) or session_timeout < 60 or session_timeout > 7200:
            raise BadRequest("session_timeout must be between 60 and 7200 seconds")

        # Check if user already has an active session for this challenge
        session_manager = get_session_manager()
        existing_session = session_manager.get_session(user_id, challenge_id)
        if existing_session:
            logger.info(f"User {user_id} already has active session for {challenge_id}")
            return jsonify({
                'status': 'success',
                'message': 'Challenge already running',
                'session_id': existing_session['session_id'],
                'container_id': existing_session['container_id'],
                'expires_at': existing_session['expires_at']
            })

        # Spawn challenge container
        orchestrator = get_orchestrator()

        logger.info(f"Spawning challenge {challenge_id} for user {user_id}")
        container_id, instance_data = orchestrator.spawn_challenge(
            challenge_id=challenge_id,
            user_id=user_id,
            session_timeout=session_timeout
        )

        # Get challenge information for response
        challenge_info = orchestrator.get_challenge(challenge_id)

        # Get container port information
        running_challenges = orchestrator.list_running(user_id=user_id)
        container_ports = {}
        for running_challenge in running_challenges:
            if running_challenge['container_id'] == container_id:
                container_ports = running_challenge.get('ports', {})
                break

        # Create session in session manager
        container_info = {
            'container_id': container_id,
            'container_port': container_ports.get('80/tcp', container_ports.get('8080/tcp'))
        }

        session_id = session_manager.create_session(
            user_id=user_id,
            challenge_id=challenge_id,
            container_info=container_info,
            session_timeout=session_timeout,
            instance_data=instance_data
        )

        expires_at = time.time() + session_timeout

        # Construct access URL from ports
        access_url = None
        if container_ports:
            # Try common ports in order of preference
            for port_key in ['80/tcp', '8080/tcp', '3000/tcp', '5000/tcp']:
                if port_key in container_ports:
                    host_port = container_ports[port_key].split(':')[-1]  # Extract port from 'localhost:55522'
                    access_url = f"http://localhost:{host_port}"
                    break
            # If no common port found, use the first available
            if not access_url and container_ports:
                first_port = list(container_ports.values())[0].split(':')[-1]
                access_url = f"http://localhost:{first_port}"

        response_data = {
            'status': 'success',
            'session_id': session_id,
            'container_id': container_id,
            'access_url': access_url,
            'challenge': {
                'id': challenge_id,
                'name': challenge_info.get('name', challenge_id),
                'category': challenge_info.get('category', 'unknown'),
                'description': challenge_info.get('description', ''),
                'ports': container_ports
            },
            'expires_at': expires_at,
            'message': f'Challenge {challenge_id} spawned successfully'
        }

        logger.info(f"Challenge {challenge_id} spawned for user {user_id} (session: {session_id})")
        return jsonify(response_data), 201

    except BadRequest as e:
        logger.warning(f"Bad request for challenge spawn: {e.description}")
        return jsonify({
            'status': 'error',
            'error': e.description,
            'code': 400
        }), 400

    except ChallengeNotFoundError as e:
        logger.warning(f"Challenge not found: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'code': 404
        }), 404

    except UserSessionLimitError as e:
        logger.warning(f"User session limit exceeded: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'code': 429
        }), 429

    except (ChallengeError, SessionManagerError) as e:
        logger.error(f"Challenge spawn error: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'code': 500
        }), 500

    except Exception as e:
        logger.error(f"Unexpected error spawning challenge: {e}")
        return jsonify({
            'status': 'error',
            'error': 'Failed to spawn challenge',
            'code': 500
        }), 500


@bp.route('/api/challenges/<session_id>', methods=['DELETE'])
def stop_challenge(session_id: str):
    """
    Stop a challenge container and cleanup session.

    Args:
        session_id: Session identifier from spawn response

    Returns:
        JSON response with stop confirmation

    Example Response:
        {
            "status": "success",
            "message": "Challenge stopped successfully",
            "session_id": "abc12345"
        }
    """
    try:
        # Validate session ID format
        if not session_id or len(session_id) < 4:
            raise BadRequest("Invalid session ID")

        session_manager = get_session_manager()

        # Get session details before cleanup
        session_data = session_manager.get_session_by_id(session_id)
        if not session_data:
            logger.warning(f"Session not found for stop: {session_id}")
            return jsonify({
                'status': 'error',
                'error': 'Session not found or already expired',
                'code': 404
            }), 404

        container_id = session_data['container_id']
        challenge_id = session_data['challenge_id']
        user_id = session_data['user_id']

        # Stop container via orchestrator
        orchestrator = get_orchestrator()

        logger.info(f"Stopping challenge {challenge_id} container {container_id} (session: {session_id})")
        container_stopped = orchestrator.stop_challenge(container_id)

        # Cleanup session regardless of container stop result
        session_cleaned = session_manager.cleanup_session(session_id)

        if container_stopped and session_cleaned:
            message = f"Challenge {challenge_id} stopped successfully"
            status = 'success'
            status_code = 200
        elif session_cleaned:
            message = f"Session cleaned up (container may have already been removed)"
            status = 'success'
            status_code = 200
        else:
            message = f"Failed to stop challenge"
            status = 'error'
            status_code = 500

        logger.info(f"Stop challenge result: {message}")

        return jsonify({
            'status': status,
            'message': message,
            'session_id': session_id,
            'challenge_id': challenge_id
        }), status_code

    except BadRequest as e:
        logger.warning(f"Bad request for challenge stop: {e.description}")
        return jsonify({
            'status': 'error',
            'error': e.description,
            'code': 400
        }), 400

    except ChallengeError as e:
        logger.error(f"Challenge stop error: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'code': 500
        }), 500

    except Exception as e:
        logger.error(f"Unexpected error stopping challenge: {e}")
        return jsonify({
            'status': 'error',
            'error': 'Failed to stop challenge',
            'code': 500
        }), 500


@bp.route('/api/challenges/running', methods=['GET'])
def list_running_challenges():
    """
    List active challenge containers.

    Query Parameters:
        user_id: Optional filter by user (e.g., ?user_id=user123)

    Returns:
        JSON response with running challenges

    Example Response:
        {
            "status": "success",
            "challenges": [
                {
                    "session_id": "abc12345",
                    "challenge_id": "web-xss-basic",
                    "challenge_name": "Basic XSS Challenge",
                    "container_id": "container123",
                    "user_id": "user123",
                    "started_at": 1234567890,
                    "expires_at": 1234571490,
                    "ports": {
                        "80/tcp": "localhost:32768"
                    }
                }
            ],
            "count": 1
        }
    """
    try:
        user_id = request.args.get('user_id')

        orchestrator = get_orchestrator()
        session_manager = get_session_manager()

        # Get running containers from orchestrator
        running_containers = orchestrator.list_running(user_id=user_id)

        # Enrich with session information
        running_challenges = []
        for container in running_containers:
            # Try to find corresponding session
            # Always try to find session data using the container's user_id
            session_data = session_manager.get_session(
                user_id=container['user_id'],
                challenge_id=container['challenge_id']
            )

            # Construct access URL from ports
            access_url = None
            ports = container.get('ports', {})
            if ports:
                # Try common ports in order of preference
                for port_key in ['80/tcp', '8080/tcp', '3000/tcp', '5000/tcp']:
                    if port_key in ports:
                        host_port = ports[port_key].split(':')[-1]  # Extract port from 'localhost:55522'
                        access_url = f"http://localhost:{host_port}"
                        break
                # If no common port found, use the first available
                if not access_url and ports:
                    first_port = list(ports.values())[0].split(':')[-1]
                    access_url = f"http://localhost:{first_port}"

            challenge_info = {
                'container_id': container['container_id'],
                'container_name': container['container_name'],
                'challenge_id': container['challenge_id'],
                'challenge_name': container['challenge_name'],
                'category': container['category'],
                'user_id': container['user_id'],
                'started_at': int(container['started_at']) if container['started_at'] else None,
                'status': container['status'],
                'ports': container.get('ports', {}),
                'access_url': access_url
            }

            # Add session info if available
            if session_data:
                challenge_info.update({
                    'session_id': session_data['session_id'],
                    'expires_at': session_data['expires_at']
                })

            running_challenges.append(challenge_info)

        logger.info(f"Listed {len(running_challenges)} running challenges")

        return jsonify({
            'status': 'success',
            'challenges': running_challenges,
            'count': len(running_challenges)
        })

    except Exception as e:
        logger.error(f"Unexpected error listing running challenges: {e}")
        return jsonify({
            'status': 'error',
            'error': 'Failed to list running challenges',
            'code': 500
        }), 500