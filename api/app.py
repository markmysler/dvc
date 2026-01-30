"""
Flask REST API application factory.

Provides HTTP interface for Damn Vulnerable Containers platform with proper
error handling, CORS support, and security considerations.

Endpoints:
- Challenge management via /api/challenges
- Flag validation via /api/flags
- Health check via /api/health

Features:
- CORS support for frontend integration
- Structured error responses
- Request logging and monitoring
- Rate limiting considerations
- Security headers
"""

import os
import logging
from typing import Dict, Any, Optional

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base API error with HTTP status code"""
    def __init__(self, message: str, status_code: int = 500, payload: Optional[Dict] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload


def create_app(config: Optional[Dict[str, Any]] = None) -> Flask:
    """
    Application factory for Flask REST API.

    Args:
        config: Optional configuration dictionary

    Returns:
        Configured Flask application instance
    """
    app = Flask(__name__)

    # Default configuration
    app.config.update({
        'SECRET_KEY': os.getenv('SECRET_KEY', 'dev-secret-change-in-production'),
        'DEBUG': os.getenv('FLASK_ENV') == 'development',
        'TESTING': False,
        'JSON_SORT_KEYS': False,
        'JSONIFY_PRETTYPRINT_REGULAR': True if os.getenv('FLASK_ENV') == 'development' else False,
    })

    # Apply custom config if provided
    if config:
        app.config.update(config)

    # Configure CORS for frontend integration
    host = os.getenv('HOST', 'localhost')
    CORS(app, origins=[
        f"http://{host}:3000",  # Next.js dev server
	f"http://{host}:3001",  # Next.js dev server
        f"http://{host}:8080",  # Alternative frontend ports
    ], supports_credentials=True)

    # Security headers middleware
    @app.after_request
    def add_security_headers(response):
        """Add security headers to all responses"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Only add CSP in production to avoid development issues
        if not app.debug:
            response.headers['Content-Security-Policy'] = "default-src 'self'"

        return response

    # Request logging middleware
    @app.before_request
    def log_request():
        """Log incoming requests for monitoring"""
        g.request_start_time = time.time()

        # Skip logging for health checks to reduce noise
        if request.endpoint != 'health_check':
            logger.info(f"Request: {request.method} {request.path} from {request.remote_addr}")

    @app.after_request
    def log_response(response):
        """Log response details for monitoring"""
        if hasattr(g, 'request_start_time') and request.endpoint != 'health_check':
            duration = (time.time() - g.request_start_time) * 1000
            logger.info(f"Response: {response.status_code} in {duration:.2f}ms")
        return response

    # Error handling
    @app.errorhandler(APIError)
    def handle_api_error(error: APIError):
        """Handle custom API errors"""
        logger.error(f"API Error: {error.message} (status: {error.status_code})")

        response_data = {
            'error': error.message,
            'status': 'error',
            'code': error.status_code
        }

        if error.payload:
            response_data.update(error.payload)

        return jsonify(response_data), error.status_code

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        """Handle standard HTTP errors"""
        logger.warning(f"HTTP Error: {error.description} (status: {error.code})")

        return jsonify({
            'error': error.description,
            'status': 'error',
            'code': error.code
        }), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        """Handle unexpected errors"""
        logger.error(f"Unexpected error: {str(error)}", exc_info=True)

        # Don't leak internal error details in production
        if app.debug:
            message = str(error)
        else:
            message = "An unexpected error occurred"

        return jsonify({
            'error': message,
            'status': 'error',
            'code': 500
        }), 500

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """
        Health check endpoint for monitoring.

        Returns:
            JSON response with service status
        """
        try:
            # Basic health indicators
            from engine.session_manager import get_session_manager
            session_manager = get_session_manager()
            session_stats = session_manager.get_session_stats()

            health_data = {
                'status': 'healthy',
                'timestamp': time.time(),
                'version': '1.0.0',
                'sessions': session_stats,
                'uptime': time.time() - app.config.get('START_TIME', time.time())
            }

            return jsonify(health_data)

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return jsonify({
                'status': 'unhealthy',
                'error': str(e)
            }), 503

    # API info endpoint
    @app.route('/api', methods=['GET'])
    def api_info():
        """
        API information endpoint.

        Returns:
            JSON response with API metadata
        """
        return jsonify({
            'name': 'Damn Vulnerable Containers API',
            'version': '1.0.0',
            'description': 'REST API for challenge lifecycle management and flag validation',
            'endpoints': {
                'challenges': '/api/challenges',
                'flags': '/api/flags',
                'health': '/api/health'
            },
            'documentation': 'https://github.com/your-org/dvc'
        })

    # Register blueprints
    import challenges
    import flags
    import import_handler

    app.register_blueprint(challenges.bp)
    app.register_blueprint(flags.flags_bp)
    app.register_blueprint(import_handler.bp)

    # Validate sessions against running containers on startup
    try:
        from engine.session_manager import get_session_manager
        session_manager = get_session_manager()
        orchestrator = challenges.get_orchestrator()
        cleaned = session_manager.validate_sessions_against_containers(orchestrator)
        if cleaned > 0:
            logger.info(f"Startup health check: cleaned {cleaned} stale session(s)")
        else:
            logger.info("Startup health check: all sessions valid")
    except Exception as e:
        logger.warning(f"Startup session validation failed: {e}")

    # Record start time for uptime calculation
    if 'START_TIME' not in app.config:
        app.config['START_TIME'] = time.time()

    logger.info("Flask application created successfully")
    return app


# Import time module for timing functionality
import time

# Create default app instance for development
app = create_app()

if __name__ == '__main__':
    # Development server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
