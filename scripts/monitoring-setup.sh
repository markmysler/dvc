#!/bin/bash

# Monitoring Setup Script for Cybersecurity Training Platform
# Manages Prometheus, Grafana, and node_exporter services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITORING_DIR="$PROJECT_DIR/monitoring"
DATA_DIR="$MONITORING_DIR/data"

# Color output for better UX
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if port is available
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# Initialize monitoring directories
init_directories() {
    log_info "Initializing monitoring directories..."

    # Create data directories with proper permissions
    mkdir -p "$DATA_DIR/prometheus" \
             "$DATA_DIR/grafana" \
             "$MONITORING_DIR/rules" \
             "$MONITORING_DIR/grafana/provisioning/dashboards"

    # Set permissions
    chmod 755 "$DATA_DIR" "$DATA_DIR/prometheus" "$DATA_DIR/grafana"
    chmod 755 "$MONITORING_DIR/rules"

    log_success "Monitoring directories initialized"
}

# Start node_exporter
start_node_exporter() {
    log_info "Starting node_exporter..."

    if ! check_port 9100; then
        log_warning "Port 9100 already in use, checking if it's node_exporter..."
        if pgrep -f node_exporter >/dev/null; then
            log_success "Node exporter already running"
            return 0
        else
            log_error "Port 9100 is occupied by another service"
            return 1
        fi
    fi

    # Check if binary exists
    if [[ ! -f "$MONITORING_DIR/node_exporter" ]]; then
        log_error "Node exporter binary not found at $MONITORING_DIR/node_exporter"
        return 1
    fi

    # Start node_exporter in background
    nohup "$MONITORING_DIR/node_exporter" \
        --web.listen-address="127.0.0.1:9100" \
        --collector.filesystem.mount-points-exclude="^/(sys|proc|dev|host|etc)($$|/)" \
        --collector.textfile.directory="$DATA_DIR/textfile_collector" \
        --no-collector.infiniband \
        --no-collector.wifi \
        --no-collector.hwmon \
        --collector.systemd \
        --collector.processes \
        > "$DATA_DIR/node_exporter.log" 2>&1 &

    # Save PID
    echo $! > "$DATA_DIR/node_exporter.pid"

    # Wait a bit and verify it's running
    sleep 2
    if pgrep -f node_exporter >/dev/null; then
        log_success "Node exporter started on localhost:9100"
    else
        log_error "Failed to start node_exporter"
        return 1
    fi
}

# Stop node_exporter
stop_node_exporter() {
    log_info "Stopping node_exporter..."

    if [[ -f "$DATA_DIR/node_exporter.pid" ]]; then
        local pid=$(cat "$DATA_DIR/node_exporter.pid")
        if kill "$pid" 2>/dev/null; then
            log_success "Node exporter stopped"
        else
            log_warning "Node exporter PID file exists but process not found"
        fi
        rm -f "$DATA_DIR/node_exporter.pid"
    else
        # Try to kill by process name
        if pkill -f node_exporter; then
            log_success "Node exporter stopped"
        else
            log_info "Node exporter was not running"
        fi
    fi
}

# Start Prometheus via Docker
start_prometheus() {
    log_info "Starting Prometheus..."

    if ! check_port 9090; then
        log_warning "Port 9090 already in use"
        if docker ps | grep -q prometheus; then
            log_success "Prometheus container already running"
            return 0
        fi
    fi

    # Pull latest Prometheus image
    docker pull prom/prometheus:latest

    # Start Prometheus container
    docker run -d \
        --name prometheus \
        --restart unless-stopped \
        -p 127.0.0.1:9090:9090 \
        -v "$MONITORING_DIR/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
        -v "$MONITORING_DIR/rules:/etc/prometheus/rules:ro" \
        -v "$DATA_DIR/prometheus:/prometheus" \
        -u "$(id -u):$(id -g)" \
        prom/prometheus:latest \
        --config.file=/etc/prometheus/prometheus.yml \
        --storage.tsdb.path=/prometheus \
        --storage.tsdb.retention.time=30d \
        --storage.tsdb.retention.size=5GB \
        --web.console.libraries=/etc/prometheus/console_libraries \
        --web.console.templates=/etc/prometheus/consoles \
        --web.enable-lifecycle \
        --web.listen-address=0.0.0.0:9090

    # Wait and verify
    sleep 5
    if curl -s http://localhost:9090/-/healthy >/dev/null; then
        log_success "Prometheus started on localhost:9090"
    else
        log_error "Failed to start Prometheus"
        return 1
    fi
}

# Stop Prometheus
stop_prometheus() {
    log_info "Stopping Prometheus..."

    if docker ps | grep -q prometheus; then
        docker stop prometheus >/dev/null
        docker rm prometheus >/dev/null
        log_success "Prometheus stopped"
    else
        log_info "Prometheus was not running"
    fi
}

# Start Grafana via Docker
start_grafana() {
    log_info "Starting Grafana..."

    if ! check_port 3000; then
        log_warning "Port 3000 already in use"
        if docker ps | grep -q grafana; then
            log_success "Grafana container already running"
            return 0
        fi
    fi

    # Pull latest Grafana image
    docker pull grafana/grafana:latest

    # Start Grafana container
    docker run -d \
        --name grafana \
        --restart unless-stopped \
        -p 127.0.0.1:3000:3000 \
        -v "$DATA_DIR/grafana:/var/lib/grafana" \
        -v "$MONITORING_DIR/grafana/provisioning:/etc/grafana/provisioning:ro" \
        -v "$MONITORING_DIR/grafana/dashboards:/var/lib/grafana/dashboards:ro" \
        -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
        -e "GF_SECURITY_ADMIN_USER=admin" \
        -e "GF_INSTALL_PLUGINS=" \
        -e "GF_SERVER_ROOT_URL=http://localhost:3000/" \
        -u "$(id -u):$(id -g)" \
        grafana/grafana:latest

    # Wait and verify
    sleep 10
    if curl -s http://localhost:3000/api/health >/dev/null; then
        log_success "Grafana started on localhost:3000 (admin/admin)"
    else
        log_error "Failed to start Grafana"
        return 1
    fi
}

# Stop Grafana
stop_grafana() {
    log_info "Stopping Grafana..."

    if docker ps | grep -q grafana; then
        docker stop grafana >/dev/null
        docker rm grafana >/dev/null
        log_success "Grafana stopped"
    else
        log_info "Grafana was not running"
    fi
}

# Show status of all monitoring services
show_status() {
    log_info "Monitoring Stack Status:"
    echo

    # Node Exporter
    if pgrep -f node_exporter >/dev/null; then
        echo -e "${GREEN}✓${NC} Node Exporter: Running (localhost:9100)"
    else
        echo -e "${RED}✗${NC} Node Exporter: Stopped"
    fi

    # Prometheus
    if docker ps | grep -q prometheus; then
        echo -e "${GREEN}✓${NC} Prometheus: Running (localhost:9090)"
    else
        echo -e "${RED}✗${NC} Prometheus: Stopped"
    fi

    # Grafana
    if docker ps | grep -q grafana; then
        echo -e "${GREEN}✓${NC} Grafana: Running (localhost:3000)"
    else
        echo -e "${RED}✗${NC} Grafana: Stopped"
    fi

    echo
}

# Start all monitoring services
start_all() {
    log_info "Starting monitoring stack..."
    init_directories
    start_node_exporter
    start_prometheus
    start_grafana
    echo
    show_status
    echo
    log_success "Monitoring stack startup complete!"
    log_info "Access Grafana at: http://localhost:3000 (admin/admin)"
    log_info "Access Prometheus at: http://localhost:9090"
}

# Stop all monitoring services
stop_all() {
    log_info "Stopping monitoring stack..."
    stop_grafana
    stop_prometheus
    stop_node_exporter
    echo
    show_status
    log_success "Monitoring stack stopped"
}

# Restart all monitoring services
restart_all() {
    log_info "Restarting monitoring stack..."
    stop_all
    sleep 2
    start_all
}

# Cleanup old containers and data
cleanup() {
    log_warning "This will remove all monitoring containers and data. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "Cleaning up monitoring stack..."
        stop_all

        # Remove containers
        docker rm -f prometheus grafana 2>/dev/null || true

        # Remove data
        rm -rf "$DATA_DIR"

        log_success "Monitoring stack cleaned up"
    else
        log_info "Cleanup cancelled"
    fi
}

# Show help
show_help() {
    cat << EOF
Monitoring Setup Script for Cybersecurity Training Platform

Usage: $0 <command>

Commands:
    start       Start all monitoring services (node_exporter, Prometheus, Grafana)
    stop        Stop all monitoring services
    restart     Restart all monitoring services
    status      Show status of monitoring services
    cleanup     Remove all monitoring containers and data

Component commands:
    start-node      Start node_exporter only
    stop-node       Stop node_exporter only
    start-prom      Start Prometheus only
    stop-prom       Stop Prometheus only
    start-grafana   Start Grafana only
    stop-grafana    Stop Grafana only

Examples:
    $0 start        # Start the full monitoring stack
    $0 status       # Check which services are running
    $0 restart      # Restart everything
    $0 cleanup      # Remove all data (destructive!)

EOF
}

# Main command handler
case "${1:-}" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        restart_all
        ;;
    status)
        show_status
        ;;
    cleanup)
        cleanup
        ;;
    start-node)
        start_node_exporter
        ;;
    stop-node)
        stop_node_exporter
        ;;
    start-prom)
        start_prometheus
        ;;
    stop-prom)
        stop_prometheus
        ;;
    start-grafana)
        start_grafana
        ;;
    stop-grafana)
        stop_grafana
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: ${1:-}"
        echo
        show_help
        exit 1
        ;;
esac