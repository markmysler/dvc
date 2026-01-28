#!/bin/bash

# API Server Management Script for CTF Challenge Engine
# Provides start/stop/restart/status operations for the Flask API server

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
API_DIR="$PROJECT_DIR/api"
PID_FILE="$PROJECT_DIR/.api-server.pid"
LOG_FILE="$PROJECT_DIR/logs/api-server.log"
HOST="127.0.0.1"
PORT="5000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if server is running
is_running() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # PID file exists but process is dead
            rm -f "$PID_FILE"
            return 1
        fi
    else
        return 1
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "python3 is not installed"
        exit 1
    fi

    # Check if in project directory
    if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
        log_error "Must be run from project root (package.json not found)"
        exit 1
    fi

    # Check if API directory exists
    if [[ ! -d "$API_DIR" ]]; then
        log_error "API directory not found at $API_DIR"
        exit 1
    fi

    # Create logs directory if it doesn't exist
    mkdir -p "$PROJECT_DIR/logs"

    # Check Flask installation
    if ! python3 -c "import flask" 2>/dev/null; then
        log_warn "Flask not installed, installing from requirements..."
        python3 -m pip install -r "$API_DIR/requirements.txt"
    fi

    # Check Docker/Podman availability (for container orchestration)
    if ! command -v docker &> /dev/null && ! command -v podman &> /dev/null; then
        log_warn "Neither Docker nor Podman found - container operations may fail"
    fi

    log_info "Dependencies OK"
}

# Start the API server
start_server() {
    if is_running; then
        log_warn "API server is already running (PID: $(cat "$PID_FILE"))"
        return 0
    fi

    log_info "Starting API server..."
    check_dependencies

    # Set environment variables
    export FLASK_APP="$API_DIR/app.py"
    export FLASK_ENV="${FLASK_ENV:-production}"
    export API_HOST="$HOST"
    export API_PORT="$PORT"

    # Set flag secret key (in production, use a secure random key)
    export FLAG_SECRET_KEY="${FLAG_SECRET_KEY:-$(openssl rand -hex 32)}"

    # Set Python path to include project root for engine module imports
    export PYTHONPATH="$PROJECT_DIR:${PYTHONPATH:-}"

    # Change to API directory
    cd "$API_DIR"

    # Start server in background
    if [[ "$FLASK_ENV" == "development" ]]; then
        # Development mode with auto-reload
        python3 -m flask run --host="$HOST" --port="$PORT" --debug > "$LOG_FILE" 2>&1 &
    else
        # Production mode with Gunicorn if available
        if command -v gunicorn &> /dev/null; then
            gunicorn --bind "$HOST:$PORT" --workers 2 --timeout 120 app:app > "$LOG_FILE" 2>&1 &
        else
            python3 -m flask run --host="$HOST" --port="$PORT" > "$LOG_FILE" 2>&1 &
        fi
    fi

    local pid=$!
    echo "$pid" > "$PID_FILE"

    # Wait a moment and check if it started successfully
    sleep 2
    if is_running; then
        log_info "API server started successfully (PID: $pid)"
        log_info "Server available at: http://$HOST:$PORT"
        log_info "Logs: $LOG_FILE"

        # Test basic connectivity
        if command -v curl &> /dev/null; then
            sleep 1
            if curl -s "http://$HOST:$PORT/api/challenges" > /dev/null; then
                log_info "API health check: ✓ Responding"
            else
                log_warn "API health check: ✗ Not responding (may still be starting up)"
            fi
        fi
    else
        log_error "Failed to start API server"
        if [[ -f "$LOG_FILE" ]]; then
            echo "Last few lines from log:"
            tail -10 "$LOG_FILE"
        fi
        exit 1
    fi
}

# Stop the API server
stop_server() {
    if ! is_running; then
        log_warn "API server is not running"
        return 0
    fi

    local pid=$(cat "$PID_FILE")
    log_info "Stopping API server (PID: $pid)..."

    # Try graceful shutdown first
    kill "$pid" 2>/dev/null || true

    # Wait up to 10 seconds for graceful shutdown
    local count=0
    while [[ $count -lt 10 ]] && ps -p "$pid" > /dev/null 2>&1; do
        sleep 1
        ((count++))
    done

    # Force kill if still running
    if ps -p "$pid" > /dev/null 2>&1; then
        log_warn "Graceful shutdown failed, force killing..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    rm -f "$PID_FILE"
    log_info "API server stopped"
}

# Restart the API server
restart_server() {
    log_info "Restarting API server..."
    stop_server
    sleep 2
    start_server
}

# Show server status
show_status() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        log_info "API server is running (PID: $pid)"

        # Show process info
        echo "Process info:"
        ps -f -p "$pid" 2>/dev/null || echo "  Process info not available"

        # Test connectivity
        if command -v curl &> /dev/null; then
            echo "Connectivity test:"
            if curl -s -m 5 "http://$HOST:$PORT/api/challenges" > /dev/null; then
                echo "  ✓ API responding at http://$HOST:$PORT"
            else
                echo "  ✗ API not responding at http://$HOST:$PORT"
            fi
        fi

        # Show recent logs
        if [[ -f "$LOG_FILE" ]]; then
            echo "Recent logs:"
            tail -5 "$LOG_FILE" | sed 's/^/  /'
        fi
    else
        log_info "API server is not running"
    fi
}

# Show logs
show_logs() {
    if [[ -f "$LOG_FILE" ]]; then
        tail -f "$LOG_FILE"
    else
        log_error "Log file not found: $LOG_FILE"
        exit 1
    fi
}

# Install/check dependencies
install_deps() {
    log_info "Installing API dependencies..."
    check_dependencies

    # Install Python dependencies
    if [[ -f "$API_DIR/requirements.txt" ]]; then
        python3 -m pip install -r "$API_DIR/requirements.txt"
        log_info "Python dependencies installed"
    fi

    log_info "Dependencies installation complete"
}

# Show help
show_help() {
    echo "CTF Challenge Engine - API Server Management"
    echo
    echo "Usage: $0 {start|stop|restart|status|logs|install|help}"
    echo
    echo "Commands:"
    echo "  start     - Start the API server"
    echo "  stop      - Stop the API server"
    echo "  restart   - Restart the API server"
    echo "  status    - Show server status and connectivity"
    echo "  logs      - Follow server logs (tail -f)"
    echo "  install   - Install/check dependencies"
    echo "  help      - Show this help message"
    echo
    echo "Environment variables:"
    echo "  FLASK_ENV=development     - Enable development mode"
    echo "  FLAG_SECRET_KEY=...       - Set custom flag encryption key"
    echo "  API_HOST=127.0.0.1        - Set API host (default: 127.0.0.1)"
    echo "  API_PORT=5000            - Set API port (default: 5000)"
    echo
    echo "Examples:"
    echo "  $0 start                  # Start in production mode"
    echo "  FLASK_ENV=development $0 start  # Start in development mode"
    echo "  $0 status                 # Check if running"
    echo "  $0 logs                   # Monitor logs"
}

# Main command handler
case "${1:-}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    install)
        install_deps
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Error: Invalid command '${1:-}'"
        echo
        show_help
        exit 1
        ;;
esac