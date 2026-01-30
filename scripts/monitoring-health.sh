#!/bin/bash

# Monitoring Health Check Script for Cybersecurity Training Platform
# Tests Prometheus scraping, Grafana dashboards, and overall monitoring health

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITORING_DIR="$PROJECT_DIR/monitoring"
DATA_DIR="$MONITORING_DIR/data"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if monitoring stack is running
check_monitoring_enabled() {
    if ! docker compose ps | grep -q "prometheus.*Up"; then
        log_warning "Monitoring stack is not running"
        log_info "Start with monitoring enabled: ./start.sh --monitor"
        exit 0
    fi
}

# Test HTTP endpoint with timeout
test_endpoint() {
    local url="$1"
    local name="$2"
    local timeout="${3:-10}"

    if curl -s --connect-timeout "$timeout" "$url" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Test Prometheus health
test_prometheus() {
    log_info "Testing Prometheus health..."

    # Check if Prometheus is accessible
    if ! test_endpoint "http://${HOST:-localhost}:9090/-/healthy" "Prometheus health"; then
        log_error "Prometheus is not accessible at ${HOST:-localhost}:9090"
        return 1
    fi

    # Check if Prometheus can query metrics
    if ! curl -s "http://${HOST:-localhost}:9090/api/v1/query?query=up" | grep -q '"status":"success"'; then
        log_error "Prometheus query API is not responding correctly"
        return 1
    fi

    # Check scrape targets
    local targets_response
    targets_response=$(curl -s "http://${HOST:-localhost}:9090/api/v1/targets")

    if echo "$targets_response" | grep -q '"health":"up"'; then
        log_success "Prometheus is healthy and scraping targets"
    else
        log_warning "Some Prometheus scrape targets may be down"
        echo "$targets_response" | jq '.data.activeTargets[] | select(.health != "up") | .scrapeUrl' 2>/dev/null || true
    fi

    return 0
}

# Test node_exporter metrics
test_node_exporter() {
    log_info "Testing node_exporter metrics..."

    if ! test_endpoint "http://${HOST:-localhost}:9100/metrics" "Node Exporter"; then
        log_error "Node Exporter is not accessible at ${HOST:-localhost}:9100"
        return 1
    fi

    # Check for key metrics
    local metrics_response
    metrics_response=$(curl -s "http://${HOST:-localhost}:9100/metrics")

    local required_metrics=(
        "node_cpu_seconds_total"
        "node_memory_MemTotal_bytes"
        "node_filesystem_size_bytes"
        "node_network_receive_bytes_total"
        "node_load1"
    )

    local missing_metrics=()
    for metric in "${required_metrics[@]}"; do
        if ! echo "$metrics_response" | grep -q "^$metric"; then
            missing_metrics+=("$metric")
        fi
    done

    if [[ ${#missing_metrics[@]} -eq 0 ]]; then
        log_success "Node Exporter is providing all required metrics"
    else
        log_warning "Missing metrics: ${missing_metrics[*]}"
    fi

    return 0
}

# Test Grafana health
test_grafana() {
    log_info "Testing Grafana health..."

    if ! test_endpoint "http://${HOST:-localhost}:3000/api/health" "Grafana health"; then
        log_error "Grafana is not accessible at ${HOST:-localhost}:3000"
        return 1
    fi

    # Test Grafana API with basic auth
    local grafana_response
    if grafana_response=$(curl -s -u admin:admin "http://${HOST:-localhost}:3000/api/datasources"); then
        if echo "$grafana_response" | grep -q "prometheus"; then
            log_success "Grafana is healthy and Prometheus datasource is configured"
        else
            log_warning "Grafana is running but Prometheus datasource not found"
        fi
    else
        log_warning "Grafana API test failed (may need manual configuration)"
    fi

    return 0
}

# Test data retention and storage
test_storage() {
    log_info "Testing data retention and storage..."

    # Check Prometheus data directory
    if [[ -d "$DATA_DIR/prometheus" ]]; then
        local prom_size
        prom_size=$(du -sh "$DATA_DIR/prometheus" 2>/dev/null | cut -f1)
        log_info "Prometheus data size: $prom_size"

        # Check for data files
        if find "$DATA_DIR/prometheus" -name "*.db" -type f | grep -q .; then
            log_success "Prometheus is storing data correctly"
        else
            log_warning "No Prometheus data files found (may be too early)"
        fi
    else
        log_warning "Prometheus data directory not found"
    fi

    # Check Grafana data directory
    if [[ -d "$DATA_DIR/grafana" ]]; then
        local grafana_size
        grafana_size=$(du -sh "$DATA_DIR/grafana" 2>/dev/null | cut -f1)
        log_info "Grafana data size: $grafana_size"
        log_success "Grafana data directory exists"
    else
        log_warning "Grafana data directory not found"
    fi

    # Check disk space
    local disk_usage
    disk_usage=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 90 ]]; then
        log_error "Disk usage is $disk_usage% - monitoring may fail due to low disk space"
    elif [[ $disk_usage -gt 80 ]]; then
        log_warning "Disk usage is $disk_usage% - consider cleaning up old data"
    else
        log_success "Disk usage is $disk_usage% - sufficient space available"
    fi

    return 0
}

# Test alert rules
test_alerts() {
    log_info "Testing alert rule evaluation..."

    # Check if Prometheus can evaluate rules
    local rules_response
    if rules_response=$(curl -s "http://${HOST:-localhost}:9090/api/v1/rules"); then
        if echo "$rules_response" | grep -q '"status":"success"'; then
            local rule_count
            rule_count=$(echo "$rules_response" | jq '.data.groups[].rules | length' 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
            if [[ $rule_count -gt 0 ]]; then
                log_success "Found $rule_count alert rules loaded"
            else
                log_info "No alert rules loaded (this is normal for basic setup)"
            fi
        else
            log_warning "Could not retrieve alert rules status"
        fi
    else
        log_warning "Could not connect to Prometheus rules API"
    fi

    return 0
}

# Test service resource consumption
test_resource_usage() {
    log_info "Testing service resource consumption..."

    # Check memory usage of monitoring services
    local total_mem
    total_mem=$(free -m | awk 'NR==2{print $2}')

    # Docker containers memory usage
    if command -v docker >/dev/null; then
        local docker_stats
        docker_stats=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep -E "prometheus|grafana" || true)

        if [[ -n "$docker_stats" ]]; then
            log_info "Container resource usage:"
            echo "$docker_stats"
        fi
    fi

    # Node exporter process
    if pgrep -f node_exporter >/dev/null; then
        local node_pid
        node_pid=$(pgrep -f node_exporter)
        local node_mem
        node_mem=$(ps -o pid,pcpu,pmem,comm -p "$node_pid" | tail -1 | awk '{print $3}')
        log_info "Node exporter memory usage: ${node_mem}%"
    fi

    return 0
}

# Generate comprehensive health report
generate_report() {
    log_info "Generating comprehensive monitoring health report..."
    echo
    echo "=== MONITORING HEALTH REPORT ==="
    echo "Generated: $(date)"
    echo "Project: Cybersecurity Training Platform"
    echo

    local overall_status="HEALTHY"

    # Service availability tests
    echo "--- Service Availability ---"
    if test_prometheus; then
        echo "✓ Prometheus: OK"
    else
        echo "✗ Prometheus: FAILED"
        overall_status="UNHEALTHY"
    fi

    if test_node_exporter; then
        echo "✓ Node Exporter: OK"
    else
        echo "✗ Node Exporter: FAILED"
        overall_status="UNHEALTHY"
    fi

    if test_grafana; then
        echo "✓ Grafana: OK"
    else
        echo "✗ Grafana: FAILED"
        overall_status="DEGRADED"
    fi

    echo

    # Data and storage tests
    echo "--- Data & Storage ---"
    test_storage

    echo

    # Alert system test
    echo "--- Alert System ---"
    test_alerts

    echo

    # Resource usage test
    echo "--- Resource Usage ---"
    test_resource_usage

    echo

    # Overall status
    echo "--- Overall Status ---"
    case $overall_status in
        "HEALTHY")
            log_success "Monitoring stack is HEALTHY"
            ;;
        "DEGRADED")
            log_warning "Monitoring stack is DEGRADED (some services down)"
            ;;
        "UNHEALTHY")
            log_error "Monitoring stack is UNHEALTHY (critical services down)"
            ;;
    esac

    return 0
}

# Quick status check
quick_status() {
    local errors=0

    # Quick service checks
    if ! test_endpoint "http://${HOST:-localhost}:9100/metrics" "Node Exporter" 5; then
        log_error "Node Exporter: DOWN"
        ((errors++))
    else
        log_success "Node Exporter: UP"
    fi

    if ! test_endpoint "http://${HOST:-localhost}:9090/-/healthy" "Prometheus" 5; then
        log_error "Prometheus: DOWN"
        ((errors++))
    else
        log_success "Prometheus: UP"
    fi

    if ! test_endpoint "http://${HOST:-localhost}:3000/api/health" "Grafana" 5; then
        log_error "Grafana: DOWN"
        ((errors++))
    else
        log_success "Grafana: UP"
    fi

    return $errors
}

# Show help
show_help() {
    cat << EOF
Monitoring Health Check Script for Cybersecurity Training Platform

Usage: $0 <command>

Commands:
    status          Quick status check of all services
    full            Full health report with detailed tests
    prometheus      Test Prometheus health and metrics
    node            Test node_exporter metrics
    grafana         Test Grafana health and dashboards
    storage         Test data retention and storage
    alerts          Test alert rule evaluation
    resources       Check resource consumption

Examples:
    $0 status       # Quick check if services are up
    $0 full         # Complete health analysis
    $0 prometheus   # Test only Prometheus
    $0 storage      # Check data storage health

EOF
}

# Main command handler
# First check if monitoring is enabled
check_monitoring_enabled

case "${1:-status}" in
    status)
        quick_status
        exit $?
        ;;
    full)
        generate_report
        ;;
    prometheus)
        test_prometheus
        ;;
    node)
        test_node_exporter
        ;;
    grafana)
        test_grafana
        ;;
    storage)
        test_storage
        ;;
    alerts)
        test_alerts
        ;;
    resources)
        test_resource_usage
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        echo
        show_help
        exit 1
        ;;
esac