#!/bin/bash
# start.sh - DVC Platform Startup Script
# 
# This script validates dependencies, performs first-time setup, and starts the platform.
#
# Usage:
#   ./start.sh              Start API and frontend only
#   ./start.sh --monitor    Start with monitoring stack (Grafana, Prometheus)
#   ./start.sh -m           Short form for --monitor
#   ./start.sh --help       Show this help message

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
SETUP_MARKER=".setup_complete"
MONITOR_MODE=false

# Print colored message
print_msg() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

print_success() { print_msg "$GREEN" "✓ $@"; }
print_error() { print_msg "$RED" "✗ $@"; }
print_warning() { print_msg "$YELLOW" "⚠ $@"; }
print_info() { print_msg "$BLUE" "ℹ $@"; }

# Print section header
print_header() {
    echo ""
    print_msg "$BLUE" "═══════════════════════════════════════════════════════════════"
    print_msg "$BLUE" "  $@"
    print_msg "$BLUE" "═══════════════════════════════════════════════════════════════"
}

# Show usage
show_help() {
    cat << EOF
DVC Platform Startup Script

Usage: ./start.sh [OPTIONS]

Options:
    --monitor, -m    Start with monitoring stack (Grafana, Prometheus)
    --help, -h       Show this help message

Examples:
    ./start.sh              # Start API and frontend only
    ./start.sh --monitor    # Start with monitoring enabled
    ./start.sh -m           # Same as --monitor

Description:
    This script will:
    1. Validate Docker and Docker Compose are installed
    2. Perform first-time setup (if needed)
    3. Start the platform containers

    By default, only the API and frontend containers are started for a 
    lightweight development experience. Use --monitor to enable the full 
    monitoring stack with Grafana and Prometheus.

Environment Setup:
    On first run, the script will:
    - Validate all dependencies are installed
    - Create required directories
    - Build challenge Docker images
    - Initialize the database
    - Set up monitoring (if --monitor is used)

EOF
    exit 0
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --monitor|-m)
                MONITOR_MODE=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate dependencies
validate_dependencies() {
    print_header "Validating Dependencies"
    
    local missing_deps=()
    
    # Check Docker
    if command_exists docker; then
        print_success "Docker is installed"
        docker --version
    else
        print_error "Docker is not installed"
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if docker compose version >/dev/null 2>&1; then
        print_success "Docker Compose is installed"
        docker compose version
    elif command_exists docker-compose; then
        print_warning "Using legacy docker-compose"
        docker-compose --version
    else
        print_error "Docker Compose is not installed"
        missing_deps+=("docker-compose")
    fi
    
    # Check Docker daemon
    if docker info >/dev/null 2>&1; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        print_info "Please start Docker and try again"
        exit 1
    fi
    
    # Check Python (optional but recommended)
    if command_exists python3; then
        print_success "Python 3 is installed"
    else
        print_warning "Python 3 not found (optional for validation scripts)"
    fi
    
    # If any critical dependencies are missing, exit
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_info "Please install missing dependencies and try again"
        exit 1
    fi
    
    print_success "All required dependencies are installed"
}

# First-time setup
first_time_setup() {
    print_header "First-Time Setup"
    
    print_info "Setting up DVC platform for the first time..."
    print_info "Note: Challenge images will be built automatically when you first spawn them"
    
    # Create required directories
    print_info "Creating required directories..."
    mkdir -p logs monitoring/data/prometheus monitoring/data/grafana tmp/imported
    
    # Create .gitkeep files to preserve directory structure
    touch logs/.gitkeep tmp/.gitkeep tmp/imported/.gitkeep
    
    print_success "Directories created"
    
    print_info "Challenge images will be built on-demand when first spawned"
    
    # Run any additional setup scripts
    if [ -f "scripts/setup.sh" ]; then
        print_info "Running setup script..."
        bash scripts/setup.sh || print_warning "Setup script encountered issues"
    fi
    
    # Mark setup as complete
    touch "$SETUP_MARKER"
    print_success "First-time setup complete!"
}

# Start the platform
start_platform() {
    print_header "Starting DVC Platform"
    
    if [ "$MONITOR_MODE" = true ]; then
        print_info "Starting in FULL mode (API + Frontend + Monitoring)..."
        
        # Start all services
        docker compose up --build -d
        
        print_success "All services started!"
        print_info "Access points:"
        print_info "  - Frontend:   http://${HOST:-localhost}:3000"
        print_info "  - API:        http://${HOST:-localhost}:5000"
        print_info "  - Grafana:    http://${HOST:-localhost}:3001"
        print_info "  - Prometheus: http://${HOST:-localhost}:9090"
    else
        print_info "Starting in LITE mode (API + Frontend only)..."
        
        # Start only API and frontend
        docker compose up --build -d api frontend
        
        print_success "Core services started!"
        print_info "Access points:"
        print_info "  - Frontend: http://${HOST:-localhost}:3000"
        print_info "  - API:      http://${HOST:-localhost}:5000"
        print_info ""
        print_info "💡 Tip: Use './start.sh --monitor' to enable Grafana and Prometheus"
    fi
}

# Check service health
check_health() {
    print_header "Health Check"
    
    print_info "Waiting for services to become healthy (timeout: 30s)..."
    
    local timeout=30
    local elapsed=0
    local check_interval=2
    
    # Function to check container health status
    check_container_health() {
        local container=$1
        local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null)
        echo "$status"
    }
    
    # Wait for API to be healthy
    print_info "Checking API health..."
    while [ $elapsed -lt $timeout ]; do
        local api_health=$(check_container_health "dvc-api")
        
        if [ "$api_health" = "healthy" ]; then
            print_success "API is healthy"
            break
        elif [ "$api_health" = "starting" ] || [ "$api_health" = "" ]; then
            printf "."
            sleep $check_interval
            elapsed=$((elapsed + check_interval))
        else
            print_error "API health check failed with status: $api_health"
            print_info "Check logs with: docker compose logs api"
            return 1
        fi
    done
    echo ""
    
    if [ $elapsed -ge $timeout ] && [ "$api_health" != "healthy" ]; then
        print_error "API failed to become healthy within ${timeout}s"
        print_info "Current status: $api_health"
        print_info "Check logs with: docker compose logs api"
        return 1
    fi
    
    # Wait for Frontend to be healthy
    elapsed=0
    print_info "Checking Frontend health..."
    while [ $elapsed -lt $timeout ]; do
        local frontend_health=$(check_container_health "dvc-frontend")
        
        if [ "$frontend_health" = "healthy" ]; then
            print_success "Frontend is healthy"
            break
        elif [ "$frontend_health" = "starting" ] || [ "$frontend_health" = "" ]; then
            printf "."
            sleep $check_interval
            elapsed=$((elapsed + check_interval))
        else
            print_error "Frontend health check failed with status: $frontend_health"
            print_info "Check logs with: docker compose logs frontend"
            return 1
        fi
    done
    echo ""
    
    if [ $elapsed -ge $timeout ] && [ "$frontend_health" != "healthy" ]; then
        print_error "Frontend failed to become healthy within ${timeout}s"
        print_info "Current status: $frontend_health"
        print_info "Check logs with: docker compose logs frontend"
        return 1
    fi
    
    # Check monitoring stack if in FULL mode
    if [ "$MONITOR_MODE" = true ]; then
        print_info "Checking monitoring stack..."
        
        # Prometheus and Grafana don't have healthchecks, so just test endpoints
        if curl -s -f http://${HOST:-localhost}:9090/-/healthy >/dev/null 2>&1; then
            print_success "Prometheus is healthy"
        else
            print_warning "Prometheus health check failed (may still be starting up)"
        fi
        
        if curl -s -f http://${HOST:-localhost}:3001/api/health >/dev/null 2>&1; then
            print_success "Grafana is healthy"
        else
            print_warning "Grafana health check failed (may still be starting up)"
        fi
    fi
    
    return 0
}

# Show running containers
show_containers() {
    print_header "Running Containers"
    docker compose ps
}

# Main execution
main() {
    # Parse arguments
    parse_args "$@"
    
    # Print banner
    clear
    cat << "EOF"
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        ██████╗ ██╗   ██╗ ██████╗                              ║
║        ██╔══██╗██║   ██║██╔════╝                              ║
║        ██║  ██║██║   ██║██║                                   ║
║        ██║  ██║╚██╗ ██╔╝██║                                   ║
║        ██████╔╝ ╚████╔╝ ╚██████╗                              ║
║        ╚═════╝   ╚═══╝   ╚═════╝                              ║
║                                                                ║
║           Damn Vulnerable Containers Platform                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
EOF
    
    print_info "Starting DVC Platform..."
    print_info "Mode: $([ "$MONITOR_MODE" = true ] && echo "FULL (with monitoring)" || echo "LITE (core services only)")"
    
    # Step 1: Validate dependencies
    validate_dependencies
    
    # Step 2: First-time setup (if needed)
    if [ ! -f "$SETUP_MARKER" ]; then
        first_time_setup
    else
        print_info "Skipping first-time setup (already completed)"
        print_info "Delete '$SETUP_MARKER' to re-run setup"
    fi
    
    # Step 3: Start the platform
    start_platform
    
    # Step 4: Health check
    if ! check_health; then
        print_error "Health check failed!"
        print_info "Platform started but some services are not healthy"
        print_info "Check logs with: docker compose logs"
        exit 1
    fi
    
    # Step 5: Show running containers
    show_containers
    
    # Final message
    print_header "Platform Ready!"
    print_success "DVC Platform is running!"
    echo ""
    print_info "Quick Commands:"
    print_info "  View logs:       docker compose logs -f"
    print_info "  Stop platform:   docker compose down"
    print_info "  Restart:         docker compose restart"
    print_info "  View status:     docker compose ps"
    echo ""
    
    if [ "$MONITOR_MODE" = false ]; then
        print_info "💡 To enable monitoring, restart with: ./start.sh --monitor"
    fi
}

# Run main function
main "$@"
