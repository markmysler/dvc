"""
Progressive hint endpoints.

Hints unlock one at a time as a session runs (every HINT_UNLOCK_INTERVAL
seconds), and a player can unlock the next one early. Hints are only served
for a running session of that challenge, so the challenge list never reveals
them.

Endpoints (used by frontend/hooks/useHints.ts):
- GET  /api/hints?challenge_id=...&session_id=...         available hints + status
- POST /api/hints {challenge_id, session_id, action}       unlock the next hint early
- GET  /api/hints/status?challenge_id=...&session_id=...   status only
"""

import logging
from typing import Any, Dict, Tuple

from flask import Blueprint, jsonify, request

from engine.hint_service import ChallengeNotFoundError, HintService
from engine.session_manager import get_session_manager

logger = logging.getLogger(__name__)

bp = Blueprint('hints', __name__)

_hint_service = None


def get_hint_service() -> HintService:
    """Hint service reading definitions through the orchestrator"""
    global _hint_service
    if _hint_service is None:
        from challenges import get_orchestrator
        _hint_service = HintService(
            challenge_lookup=lambda challenge_id: get_orchestrator().get_challenge(challenge_id)
        )
    return _hint_service


class HintRequestError(Exception):
    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.message = message
        self.status = status


def _session_for(challenge_id: str, session_id: str) -> Dict[str, Any]:
    """Return the session if it exists and belongs to this challenge"""
    if not challenge_id or not session_id:
        raise HintRequestError('challenge_id and session_id are required', 400)
    session = get_session_manager().get_session_by_id(session_id)
    if not session or session['challenge_id'] != challenge_id:
        raise HintRequestError('No running session for this challenge', 404)
    return session


def _hints_payload(challenge_id: str, session: Dict[str, Any]) -> Dict[str, Any]:
    service = get_hint_service()
    data = service.get_available_hints(challenge_id, session)
    data['status'] = service.get_hint_status(challenge_id, session)
    return data


def _error(error: Exception) -> Tuple[Any, int]:
    if isinstance(error, HintRequestError):
        return jsonify({'success': False, 'message': error.message}), error.status
    if isinstance(error, ChallengeNotFoundError):
        return jsonify({'success': False, 'message': str(error)}), 404
    logger.error(f"Hint request failed: {error}", exc_info=True)
    return jsonify({'success': False, 'message': 'Failed to load hints'}), 500


@bp.route('/api/hints', methods=['GET'])
def get_hints():
    try:
        challenge_id = request.args.get('challenge_id', '')
        session = _session_for(challenge_id, request.args.get('session_id', ''))
        return jsonify({'success': True, 'data': _hints_payload(challenge_id, session)})
    except Exception as e:
        return _error(e)


@bp.route('/api/hints', methods=['POST'])
def request_next_hint():
    try:
        data = request.get_json(silent=True) or {}
        if data.get('action') != 'request':
            raise HintRequestError("action must be 'request'", 400)
        challenge_id = data.get('challenge_id', '')
        session_id = data.get('session_id', '')
        session = _session_for(challenge_id, session_id)

        service = get_hint_service()
        status = service.get_hint_status(challenge_id, session)
        if status['available_count'] >= status['total_hints']:
            raise HintRequestError('All hints are already unlocked', 409)

        # Unlock exactly one more hint than is currently available
        request_result = service.request_hint(challenge_id, session_id)
        get_session_manager().set_hints_requested(session_id, status['available_count'] + 1)
        session = get_session_manager().get_session_by_id(session_id)

        payload = _hints_payload(challenge_id, session)
        payload['request_result'] = {**request_result, 'message': 'Next hint unlocked'}
        logger.info(f"Hint {status['available_count'] + 1} unlocked early for session {session_id}")
        return jsonify({'success': True, 'message': 'Next hint unlocked', 'data': payload})
    except Exception as e:
        return _error(e)


@bp.route('/api/hints/status', methods=['GET'])
def get_hints_status():
    try:
        challenge_id = request.args.get('challenge_id', '')
        session = _session_for(challenge_id, request.args.get('session_id', ''))
        return jsonify({'success': True, 'data': get_hint_service().get_hint_status(challenge_id, session)})
    except Exception as e:
        return _error(e)
