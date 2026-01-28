#!/bin/bash

# Cybersecurity Training Platform Setup Script
# Sets up Docker, monitoring stack, and verifies deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
DRY_RUN=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--verbose]"
            echo "  --dry-run: Check system requirements without making changes"
            echo "  --verbose: Enable verbose output"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Detect operating system
detect_os() {
    log_verbose "Detecting operating system..."

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        log_verbose "Detected OS: $OS $OS_VERSION"
    else
        log_error "Cannot detect operating system"
        exit 1
    fi
}

# Check for Docker installation
check_docker() {
    log_info "Checking Docker installation..."

    if command -v docker >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        log_success "Docker is installed (version: $DOCKER_VERSION)"

        # Check if Docker daemon is running
        if docker info >/dev/null 2>&1; then
            log_success "Docker daemon is running"
        else
            log_error "Docker daemon is not running"
            log_info "Start Docker with: sudo systemctl start docker"
            return 1
        fi
    else
        log_warning "Docker is not installed"
        return 1
    fi
}

# Check for Docker Compose
check_docker_compose() {
    log_info "Checking Docker Compose..."

    if docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version | cut -d' ' -f4 | tr -d 'v')
        log_success "Docker Compose is available (version: $COMPOSE_VERSION)"
    else
        log_error "Docker Compose not available"
        log_info "Docker Compose comes with Docker Desktop or can be installed separately"
        return 1
    fi
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."

    local directories=(
        "logs"
        "monitoring/data/prometheus"
        "monitoring/data/grafana"
        "monitoring/grafana/provisioning/dashboards"
        "monitoring/grafana/provisioning/datasources"
        "security"
        "tmp"
    )

    for dir in "${directories[@]}"; do
        local full_path="$PROJECT_DIR/$dir"
        if [[ "$DRY_RUN" == "false" ]]; then
            mkdir -p "$full_path"
            log_verbose "Created directory: $dir"
        else
            log_verbose "Would create directory: $dir"
        fi
    done

    log_success "Directory structure created"
}

# Set proper permissions
set_permissions() {
    log_info "Setting proper permissions..."

    if [[ "$DRY_RUN" == "false" ]]; then
        # Grafana data directory needs specific user (472:472)
        if [[ -d "$PROJECT_DIR/monitoring/data/grafana" ]]; then
            sudo chown -R 472:472 "$PROJECT_DIR/monitoring/data/grafana"
            log_verbose "Set Grafana permissions"
        fi

        # Prometheus data directory needs user 65534:65534
        if [[ -d "$PROJECT_DIR/monitoring/data/prometheus" ]]; then
            sudo chown -R 65534:65534 "$PROJECT_DIR/monitoring/data/prometheus"
            log_verbose "Set Prometheus permissions"
        fi

        # Security directory should be restricted
        if [[ -d "$PROJECT_DIR/security" ]]; then
            chmod 700 "$PROJECT_DIR/security"
            log_verbose "Set security directory permissions"
        fi

        log_success "Permissions configured"
    else
        log_info "DRY RUN: Would set container user permissions"
    fi
}

# Create monitoring configurations
create_monitoring_configs() {
    log_info "Creating monitoring configurations..."

    # Prometheus configuration
    local prometheus_config="$PROJECT_DIR/monitoring/prometheus.yml"
    if [[ "$DRY_RUN" == "false" ]]; then
        cat > "$prometheus_config" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'containers'
    static_configs:
      - targets: ['localhost:8080']  # Future: cAdvisor or equivalent
EOF
        log_verbose "Created Prometheus configuration"
    else
        log_info "DRY RUN: Would create Prometheus configuration"
    fi

    # Grafana datasource configuration
    local grafana_datasource="$PROJECT_DIR/monitoring/grafana/provisioning/datasources/prometheus.yml"
    if [[ "$DRY_RUN" == "false" ]]; then
        cat > "$grafana_datasource" << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF
        log_verbose "Created Grafana datasource configuration"
    else
        log_info "DRY RUN: Would create Grafana datasource configuration"
    fi
}

# Health checks
run_health_checks() {
    log_info "Running health checks..."

    # Check Docker functionality
    if command -v docker >/dev/null 2>&1; then
        if docker version >/dev/null 2>&1; then
            log_success "Docker is functional"
        else
            log_error "Docker version check failed"
            return 1
        fi

        # Test container pull (small image)
        log_verbose "Testing container pull capability..."
        if docker pull hello-world >/dev/null 2>&1; then
            docker rmi hello-world >/dev/null 2>&1
            log_success "Container pull test passed"
        else
            log_warning "Container pull test failed - check network connectivity"
        fi
    else
        log_error "Docker not found"
        return 1
    fi

    # Check Docker Compose
    if docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose is available"
    else
        log_warning "Docker Compose not found"
    fi
}

# Main execution
main() {
    log_info "Starting Damn Vulnerable Containers setup..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Running in DRY RUN mode - no changes will be made"
    fi

    detect_os

    # Check Docker and Docker Compose
    if ! check_docker; then
        log_error "Docker is not installed. Please install Docker first:"
        log_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! check_docker_compose; then
        log_error "Docker Compose is not available"
        exit 1
    fi

    create_directories
    set_permissions
    create_monitoring_configs

    if [[ "$DRY_RUN" == "false" ]]; then
        run_health_checks
    fi

    log_success "Setup completed successfully!"

    if [[ "$DRY_RUN" == "false" ]]; then
        echo
        log_info "Next steps:"
        echo "  1. Run 'docker compose up -d' to start all services"
        echo "  2. Run './scripts/verify.sh' to validate the deployment"
        echo "  3. Access Frontend at http://localhost:3001"
        echo "  4. Access Grafana at http://localhost:3000 (admin/admin)"
        echo "  5. Access Prometheus at http://localhost:9090"
    fi
}

# Run main function
main "$@"