#!/bin/bash
#
# Challenge Engine Setup Script
#
# Sets up challenge engine dependencies, validates configurations,
# and integrates with existing monitoring infrastructure.

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/challenge-setup.log"

# Ensure log directory exists
mkdir -p "$PROJECT_ROOT/logs"

# Logging functions
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $*" | tee -a "$LOG_FILE"
}

log_error() {
    log "ERROR: $*" >&2
}

log_info() {
    log "INFO: $*"
}

log_warn() {
    log "WARN: $*"
}

# Color output functions
red() { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }
blue() { echo -e "\033[34m$*\033[0m"; }

# Check if running as root (not recommended for containers)
check_privileges() {
    if [[ $EUID -eq 0 ]]; then
        log_warn "Running as root is not recommended for container operations"
        log_warn "Consider using rootless container runtime (Podman preferred)"
    fi
}

# Check container runtime availability
check_container_runtime() {
    log_info "Checking container runtime availability..."

    # Check for Podman (preferred)
    if command -v podman >/dev/null 2>&1; then
        CONTAINER_RUNTIME="podman"
        log_info "Found Podman: $(podman --version)"
    # Check for Docker (fallback)
    elif command -v docker >/dev/null 2>&1; then
        CONTAINER_RUNTIME="docker"
        log_info "Found Docker: $(docker --version)"

        # Check if Docker daemon is running
        if ! docker info >/dev/null 2>&1; then
            log_error "Docker daemon is not running. Please start Docker service."
            exit 1
        fi
    else
        log_error "No container runtime found. Please install Podman or Docker."
        log_info "Recommended: Install Podman for rootless operation"
        exit 1
    fi

    log_info "Using container runtime: $CONTAINER_RUNTIME"
}

# Check Python dependencies
check_python_environment() {
    log_info "Checking Python environment..."

    # Check Python version
    if ! command -v python3 >/dev/null 2>&1; then
        log_error "Python 3 is required but not found"
        exit 1
    fi

    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    log_info "Found Python: $PYTHON_VERSION"

    # Check if pip is available
    if ! python3 -c "import pip" 2>/dev/null; then
        log_warn "pip not found, attempting to install..."
        if command -v wget >/dev/null 2>&1; then
            wget -q https://bootstrap.pypa.io/get-pip.py -O /tmp/get-pip.py
            python3 /tmp/get-pip.py --user --break-system-packages || {
                log_error "Failed to install pip"
                exit 1
            }
        else
            log_error "pip is required but not available, and wget not found to install it"
            exit 1
        fi
    fi

    # Add local bin to PATH if needed
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        export PATH="$HOME/.local/bin:$PATH"
        log_info "Added ~/.local/bin to PATH for this session"
    fi
}

# Install Python dependencies
install_python_dependencies() {
    log_info "Installing Python dependencies..."

    local requirements_file="$PROJECT_ROOT/engine/requirements.txt"
    if [[ ! -f "$requirements_file" ]]; then
        log_error "Requirements file not found: $requirements_file"
        exit 1
    fi

    # Install dependencies
    if pip install --user --break-system-packages -r "$requirements_file"; then
        log_info "Python dependencies installed successfully"
    else
        log_error "Failed to install Python dependencies"
        exit 1
    fi
}

# Validate challenge definitions
validate_challenge_definitions() {
    log_info "Validating challenge definitions..."

    local challenges_file="$PROJECT_ROOT/challenges/definitions/challenges.json"
    if [[ ! -f "$challenges_file" ]]; then
        log_error "Challenge definitions not found: $challenges_file"
        exit 1
    fi

    # Validate JSON syntax
    if python3 -m json.tool "$challenges_file" >/dev/null 2>&1; then
        log_info "Challenge definitions JSON is valid"
    else
        log_error "Invalid JSON in challenge definitions"
        exit 1
    fi

    # Test loading with orchestrator
    if python3 -c "from engine.orchestrator import ChallengeOrchestrator; c = ChallengeOrchestrator(); challenges = c.load_challenges(); print(f'Loaded {len(challenges)} challenges')" 2>/dev/null; then
        log_info "Challenge definitions loaded successfully by orchestrator"
    else
        log_error "Orchestrator failed to load challenge definitions"
        exit 1
    fi
}

# Build challenge images
build_challenge_images() {
    log_info "Building challenge images..."

    local challenges_dir="$PROJECT_ROOT/challenges"
    local built_count=0

    # Find challenge directories with Dockerfiles
    while IFS= read -r -d '' dockerfile; do
        local challenge_dir=$(dirname "$dockerfile")
        local challenge_name=$(basename "$challenge_dir")

        log_info "Building challenge: $challenge_name"

        if $CONTAINER_RUNTIME build "$challenge_dir" -t "sec-prac/$challenge_name:latest"; then
            log_info "Successfully built: sec-prac/$challenge_name:latest"
            ((built_count++))
        else
            log_error "Failed to build challenge: $challenge_name"
        fi
    done < <(find "$challenges_dir" -name "Dockerfile" -print0 2>/dev/null)

    if [[ $built_count -eq 0 ]]; then
        log_warn "No challenge images found to build"
    else
        log_info "Built $built_count challenge images"
    fi
}

# Integrate with monitoring
setup_monitoring_integration() {
    log_info "Setting up monitoring integration..."

    local monitoring_config="$PROJECT_ROOT/monitoring/prometheus.yml"
    if [[ -f "$monitoring_config" ]]; then
        log_info "Monitoring configuration found - challenge metrics will be available"

        # Check if monitoring stack is running
        if $CONTAINER_RUNTIME ps --filter "label=monitoring-stack" --format "table {{.Names}}" | grep -q prometheus; then
            log_info "Monitoring stack is running - ready for challenge metrics"
        else
            log_warn "Monitoring stack not running - start with ./scripts/monitoring-start.sh"
        fi
    else
        log_warn "Monitoring configuration not found - metrics collection unavailable"
    fi
}

# Test orchestrator functionality
test_orchestrator() {
    log_info "Testing orchestrator functionality..."

    # Test basic orchestrator operations
    if python3 -c "
from engine.orchestrator import ChallengeOrchestrator
c = ChallengeOrchestrator()
challenges = c.load_challenges()
print(f'✓ Loaded {len(challenges)} challenge definitions')
running = c.list_running()
print(f'✓ Found {len(running)} running challenges')
print('✓ Orchestrator test completed successfully')
"; then
        log_info "Orchestrator test passed"
    else
        log_error "Orchestrator test failed"
        exit 1
    fi
}

# Generate configuration summary
generate_summary() {
    log_info "Challenge Engine Setup Summary:"
    echo ""
    echo "$(blue "Container Runtime:") $CONTAINER_RUNTIME"
    echo "$(blue "Python Version:") $PYTHON_VERSION"
    echo "$(blue "Challenge Definitions:") $PROJECT_ROOT/challenges/definitions/challenges.json"
    echo "$(blue "Security Profiles:") $PROJECT_ROOT/security/container-profiles.json"
    echo "$(blue "Orchestrator Module:") $PROJECT_ROOT/engine/orchestrator.py"
    echo ""
    echo "$(green "✓ Challenge engine is ready for use")"
    echo ""
    echo "$(blue "Quick Start Commands:")"
    echo "  python3 -m engine.orchestrator list-challenges    # List available challenges"
    echo "  python3 -m engine.orchestrator spawn <id> <user>  # Spawn a challenge"
    echo "  python3 -m engine.orchestrator list-running       # List running challenges"
    echo "  python3 -m engine.orchestrator cleanup            # Clean up expired challenges"
    echo ""
    echo "$(blue "Integration:")"
    echo "  ./scripts/monitoring-start.sh                     # Start monitoring stack"
    echo "  docker/podman ps --filter label=sec-prac.challenge.id  # View challenge containers"
    echo ""
}

# Main setup function
main() {
    log_info "Starting challenge engine setup..."

    check_privileges
    check_container_runtime
    check_python_environment
    install_python_dependencies
    validate_challenge_definitions
    build_challenge_images
    setup_monitoring_integration
    test_orchestrator

    log_info "Challenge engine setup completed successfully"
    generate_summary
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "test")
        log_info "Running orchestrator tests only..."
        check_python_environment
        test_orchestrator
        ;;
    "build")
        log_info "Building challenge images only..."
        check_container_runtime
        build_challenge_images
        ;;
    "validate")
        log_info "Validating configuration only..."
        check_python_environment
        validate_challenge_definitions
        ;;
    *)
        echo "Usage: $0 [setup|test|build|validate]"
        echo ""
        echo "  setup     - Complete setup (default)"
        echo "  test      - Test orchestrator only"
        echo "  build     - Build challenge images only"
        echo "  validate  - Validate configuration only"
        exit 1
        ;;
esac