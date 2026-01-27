#!/bin/bash

# Cybersecurity Training Platform Setup Script
# Sets up Podman, monitoring stack, and verifies multi-architecture support

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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        log_info "Podman supports rootless operation - please run as your normal user"
        exit 1
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

# Check for Podman installation
check_podman() {
    log_info "Checking Podman installation..."

    if command -v podman >/dev/null 2>&1; then
        PODMAN_VERSION=$(podman --version | cut -d' ' -f3)
        log_success "Podman is installed (version: $PODMAN_VERSION)"

        # Check rootless support
        if podman system info --format=json | grep -q '"rootless": true'; then
            log_success "Podman rootless mode is configured"
        else
            log_warning "Podman is not running in rootless mode"
            return 1
        fi
    else
        log_warning "Podman is not installed"
        return 1
    fi
}

# Install Podman
install_podman() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would install Podman for $OS"
        return 0
    fi

    log_info "Installing Podman..."

    case $OS in
        ubuntu|debian)
            log_verbose "Installing via apt..."
            sudo apt update
            sudo apt install -y podman
            ;;
        fedora)
            log_verbose "Installing via dnf..."
            sudo dnf install -y podman
            ;;
        rhel|centos)
            log_verbose "Installing via yum/dnf..."
            if command -v dnf >/dev/null 2>&1; then
                sudo dnf install -y podman
            else
                sudo yum install -y podman
            fi
            ;;
        *)
            log_error "Unsupported operating system for automatic installation: $OS"
            log_info "Please install Podman manually: https://podman.io/getting-started/installation"
            exit 1
            ;;
    esac

    log_success "Podman installation completed"
}

# Check multi-architecture support
check_multiarch() {
    log_info "Checking multi-architecture support..."

    # Check QEMU user emulation
    if [[ -d /proc/sys/fs/binfmt_misc ]]; then
        if ls /proc/sys/fs/binfmt_misc/qemu-* >/dev/null 2>&1; then
            log_success "QEMU user emulation is available"
        else
            log_warning "QEMU user emulation not found"
            if [[ "$DRY_RUN" == "false" ]]; then
                install_qemu
            fi
        fi
    else
        log_warning "binfmt_misc not available"
    fi

    # Test multi-arch manifest creation
    if command -v podman >/dev/null 2>&1; then
        log_verbose "Testing manifest creation..."
        if podman manifest create test-manifest >/dev/null 2>&1; then
            podman manifest rm test-manifest >/dev/null 2>&1
            log_success "Multi-architecture manifest support confirmed"
        else
            log_warning "Multi-architecture manifest creation failed"
        fi
    fi
}

# Install QEMU for multi-arch support
install_qemu() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would install QEMU user emulation"
        return 0
    fi

    log_info "Installing QEMU user emulation..."

    case $OS in
        ubuntu|debian)
            sudo apt install -y qemu-user-static binfmt-support
            ;;
        fedora)
            sudo dnf install -y qemu-user-static
            ;;
        rhel|centos)
            if command -v dnf >/dev/null 2>&1; then
                sudo dnf install -y qemu-user-static
            else
                sudo yum install -y qemu-user-static
            fi
            ;;
        *)
            log_warning "Cannot auto-install QEMU for $OS"
            ;;
    esac
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

    # Check Podman functionality
    if command -v podman >/dev/null 2>&1; then
        if podman version >/dev/null 2>&1; then
            log_success "Podman is functional"
        else
            log_error "Podman version check failed"
            return 1
        fi

        # Test container pull (small image)
        log_verbose "Testing container pull capability..."
        if podman pull hello-world >/dev/null 2>&1; then
            podman rmi hello-world >/dev/null 2>&1
            log_success "Container pull test passed"
        else
            log_warning "Container pull test failed - check network connectivity"
        fi
    else
        log_error "Podman not found after installation"
        return 1
    fi

    # Check docker-compose compatibility
    if command -v podman-compose >/dev/null 2>&1; then
        log_success "podman-compose is available"
    elif command -v docker-compose >/dev/null 2>&1; then
        log_info "docker-compose found - can be used with Podman"
    else
        log_warning "No compose tool found - manual container management required"
    fi
}

# Main execution
main() {
    log_info "Starting Cybersecurity Training Platform setup..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Running in DRY RUN mode - no changes will be made"
    fi

    check_root
    detect_os

    # Check and install Podman if needed
    if ! check_podman; then
        install_podman

        # Verify installation (skip verification in dry-run mode)
        if [[ "$DRY_RUN" == "false" ]]; then
            if ! check_podman; then
                log_error "Podman installation verification failed"
                exit 1
            fi
        else
            log_info "DRY RUN: Skipping installation verification"
        fi
    fi

    check_multiarch
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
        echo "  1. Run 'npm start' to launch the monitoring stack"
        echo "  2. Run 'npm run verify' to validate the installation"
        echo "  3. Access Grafana at http://localhost:3000 (admin/admin)"
        echo "  4. Access Prometheus at http://localhost:9090"
    fi
}

# Run main function
main "$@"