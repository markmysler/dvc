"""
Flag validation endpoint for CTF challenge engine.
Provides secure flag submission and validation against active sessions.
"""

from flask import Blueprint, request, jsonify, current_app
from werkzeug.exceptions import BadRequest, NotFound
from typing import Dict, Any
import logging

# Import our custom modules
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from engine.session_manager import get_session_manager
from engine.flag_system import validate_flag

# Create blueprint
flags_bp = Blueprint('flags', __name__)

logger = logging.getLogger(__name__)

@flags_bp.route('/api/flags', methods=['POST'])
def validate_submitted_flag():
    """
    Validate a submitted flag against an active challenge session.

    Expected JSON payload:
    {
        "flag": "flag{...}",
        "session_id": "session-uuid-here"
    }

    Returns:
        200: Flag validation result with scoring info
        400: Invalid request format or missing fields
        404: Session not found or expired
        500: Internal server error
    """
    try:
        # Validate request content type
        if not request.is_json:
            raise BadRequest("Content-Type must be application/json")

        data = request.get_json()

        # Validate required fields
        if not data:
            raise BadRequest("Request body is required")

        required_fields = ['flag', 'session_id']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise BadRequest(f"Missing required fields: {missing_fields}")

        submitted_flag = data['flag'].strip()
        session_id = data['session_id'].strip()

        # Validate field formats
        if not submitted_flag:
            raise BadRequest("Flag cannot be empty")

        if not session_id:
            raise BadRequest("Session ID cannot be empty")

        # Get session data using singleton session manager
        session_manager = get_session_manager()
        session = session_manager.get_session_by_id(session_id)
        if not session:
            raise NotFound("Session not found or expired")

        # Extract session details
        challenge_id = session['challenge_id']
        user_id = session['user_id']
        instance_data = session['instance_data']

        # Get secret key from config (in production, use environment variable)
        secret_key = current_app.config.get('FLAG_SECRET_KEY', 'default-secret-key-change-in-production')

        # Validate the flag
        is_valid = validate_flag(
            submitted_flag,
            challenge_id,
            user_id,
            instance_data,
            secret_key
        )

        # Prepare response
        response_data = {
            "valid": is_valid,
            "challenge_id": challenge_id,
            "session_id": session_id,
            "timestamp": session['created_at']
        }

        if is_valid:
            response_data.update({
                "message": "Correct flag! Challenge solved.",
                "points": session.get('points', 100),  # Default 100 points
                "solved_at": data.get('solved_at', session['created_at'])
            })
            logger.info(f"Valid flag submission for challenge {challenge_id} by user {user_id}")
        else:
            response_data.update({
                "message": "Incorrect flag. Try again!",
                "attempts_remaining": session.get('attempts_remaining', 'unlimited')
            })
            logger.info(f"Invalid flag submission for challenge {challenge_id} by user {user_id}")

        # Return result
        status_code = 200
        return jsonify(response_data), status_code

    except BadRequest as e:
        logger.warning(f"Bad request for flag validation: {e}")
        return jsonify({
            "error": "bad_request",
            "message": str(e),
            "valid": False
        }), 400

    except NotFound as e:
        logger.warning(f"Session not found for flag validation: {e}")
        return jsonify({
            "error": "session_not_found",
            "message": str(e),
            "valid": False
        }), 404

    except Exception as e:
        logger.error(f"Unexpected error during flag validation: {e}")
        return jsonify({
            "error": "internal_error",
            "message": "Internal server error during flag validation",
            "valid": False
        }), 500


@flags_bp.route('/api/flags/batch', methods=['POST'])
def validate_multiple_flags():
    """
    Validate multiple flags at once (optional advanced endpoint).

    Expected JSON payload:
    {
        "submissions": [
            {"flag": "flag{...}", "session_id": "session-uuid-1"},
            {"flag": "flag{...}", "session_id": "session-uuid-2"}
        ]
    }

    Returns:
        200: Batch validation results
        400: Invalid request format
        500: Internal server error
    """
    try:
        if not request.is_json:
            raise BadRequest("Content-Type must be application/json")

        data = request.get_json()
        if not data or 'submissions' not in data:
            raise BadRequest("Missing 'submissions' array in request body")

        submissions = data['submissions']
        if not isinstance(submissions, list):
            raise BadRequest("'submissions' must be an array")

        results = []

        for i, submission in enumerate(submissions):
            try:
                # Validate individual submission
                if not isinstance(submission, dict):
                    results.append({
                        "index": i,
                        "valid": False,
                        "error": f"Submission {i} must be an object"
                    })
                    continue

                flag = submission.get('flag', '').strip()
                session_id = submission.get('session_id', '').strip()

                if not flag or not session_id:
                    results.append({
                        "index": i,
                        "valid": False,
                        "error": "Missing flag or session_id"
                    })
                    continue

                # Get session
                session = session_manager.get_session(session_id)
                if not session:
                    results.append({
                        "index": i,
                        "valid": False,
                        "error": "Session not found or expired",
                        "session_id": session_id
                    })
                    continue

                # Validate flag
                challenge_id = session['challenge_id']
                user_id = session['user_id']
                instance_data = session['instance_data']
                secret_key = current_app.config.get('FLAG_SECRET_KEY', 'default-secret-key')

                is_valid = validate_flag(flag, challenge_id, user_id, instance_data, secret_key)

                results.append({
                    "index": i,
                    "valid": is_valid,
                    "challenge_id": challenge_id,
                    "session_id": session_id,
                    "message": "Correct flag!" if is_valid else "Incorrect flag"
                })

            except Exception as e:
                results.append({
                    "index": i,
                    "valid": False,
                    "error": str(e)
                })

        return jsonify({
            "results": results,
            "total_submitted": len(submissions),
            "valid_count": sum(1 for r in results if r.get('valid', False))
        }), 200

    except BadRequest as e:
        return jsonify({
            "error": "bad_request",
            "message": str(e)
        }), 400

    except Exception as e:
        logger.error(f"Unexpected error during batch flag validation: {e}")
        return jsonify({
            "error": "internal_error",
            "message": "Internal server error during batch validation"
        }), 500


# Health check endpoint for flags service
@flags_bp.route('/api/flags/health', methods=['GET'])
def flags_health_check():
    """
    Health check endpoint for flag validation service.

    Returns:
        200: Service is healthy
    """
    return jsonify({
        "service": "flag_validation",
        "status": "healthy",
        "session_manager": "active",
        "endpoints": [
            "/api/flags (POST)",
            "/api/flags/batch (POST)",
            "/api/flags/health (GET)"
        ]
    }), 200