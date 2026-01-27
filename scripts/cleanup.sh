#!/bin/bash
#
# Container Resource Cleanup Script
# Automatically manages container lifecycle and resource usage
# Part of the cybersecurity training platform security infrastructure
#

set -euo pipefail

# Configuration
CONTAINER_AGE_HOURS=1
VOLUME_AGE_HOURS=24
LOG_FILE="${LOG_FILE:-/var/log/container-cleanup.log}"
DRY_RUN="${1:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}" 2>/dev/null || echo -e "${timestamp} [${level}] ${message}"
}

log_info() {
    log "INFO" "$@"
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_warn() {
    log "WARN" "$@"
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    log "ERROR" "$@"
    echo -e "${RED}[ERROR]${NC} $*"
}

log_success() {
    log "SUCCESS" "$@"
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

# Check if container runtime is available
check_runtime() {
    if command -v podman >/dev/null 2>&1; then
        CONTAINER_CMD="podman"
    elif command -v docker >/dev/null 2>&1; then
        CONTAINER_CMD="docker"
    else
        log_error "Neither podman nor docker found. Cannot perform cleanup."
        exit 1
    fi

    log_info "Using container runtime: $CONTAINER_CMD"
}

# Safety check to prevent deletion of active resources
safety_check() {
    local running_containers
    running_containers=$($CONTAINER_CMD ps -q | wc -l)

    log_info "Found $running_containers running containers"

    if [[ $running_containers -gt 10 ]]; then
        log_warn "Large number of running containers detected ($running_containers)"
        log_warn "This might indicate active workload. Proceeding with caution..."
    fi
}

# Clean up stopped containers
cleanup_containers() {
    log_info "Cleaning up stopped containers older than ${CONTAINER_AGE_HOURS} hours..."

    local stopped_containers
    local cutoff_time=$(date -d "${CONTAINER_AGE_HOURS} hours ago" '+%Y-%m-%dT%H:%M:%S')

    if [[ "$CONTAINER_CMD" == "podman" ]]; then
        # Podman syntax with until filter
        stopped_containers=$($CONTAINER_CMD ps -a --filter "status=exited" --filter "until=${CONTAINER_AGE_HOURS}h" -q 2>/dev/null || true)
    else
        # Docker syntax - use manual filtering since until filter varies by version
        stopped_containers=$($CONTAINER_CMD ps -a --filter "status=exited" -q --format "table {{.ID}}\t{{.CreatedAt}}" | awk -v cutoff="$cutoff_time" 'NR>1 && $2" "$3 < cutoff {print $1}' 2>/dev/null || true)
    fi

    if [[ -n "$stopped_containers" ]]; then
        local count=$(echo "$stopped_containers" | wc -l)
        log_info "Found $count stopped containers to remove"

        if [[ "$DRY_RUN" == "--dry-run" ]]; then
            log_info "DRY RUN: Would remove containers: $(echo $stopped_containers | tr '\n' ' ')"
        else
            echo "$stopped_containers" | xargs -r $CONTAINER_CMD rm
            log_success "Removed $count stopped containers"
        fi
    else
        log_info "No stopped containers found for cleanup"
    fi
}

# Clean up unused images
cleanup_images() {
    log_info "Cleaning up unused images..."

    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log_info "DRY RUN: Would remove dangling images"
        $CONTAINER_CMD image prune --dry-run 2>/dev/null || log_warn "Could not check dangling images"
    else
        local removed_images
        removed_images=$($CONTAINER_CMD image prune -f 2>/dev/null | grep "^deleted:" | wc -l || echo "0")

        if [[ "$removed_images" -gt 0 ]]; then
            log_success "Removed $removed_images dangling images"
        else
            log_info "No dangling images found for cleanup"
        fi
    fi
}

# Clean up unused volumes
cleanup_volumes() {
    log_info "Cleaning up unused volumes older than ${VOLUME_AGE_HOURS} hours..."

    if [[ "$CONTAINER_CMD" == "podman" ]]; then
        # Podman volume cleanup
        if [[ "$DRY_RUN" == "--dry-run" ]]; then
            log_info "DRY RUN: Would remove unused volumes"
            $CONTAINER_CMD volume prune --dry-run 2>/dev/null || log_warn "Could not check unused volumes"
        else
            local removed_volumes
            removed_volumes=$($CONTAINER_CMD volume prune -f 2>/dev/null | grep "^deleted:" | wc -l || echo "0")

            if [[ "$removed_volumes" -gt 0 ]]; then
                log_success "Removed $removed_volumes unused volumes"
            else
                log_info "No unused volumes found for cleanup"
            fi
        fi
    else
        # Docker volume cleanup
        if [[ "$DRY_RUN" == "--dry-run" ]]; then
            log_info "DRY RUN: Would remove unused volumes"
            $CONTAINER_CMD volume prune --dry-run 2>/dev/null || log_warn "Could not check unused volumes"
        else
            local removed_volumes
            removed_volumes=$($CONTAINER_CMD volume prune -f 2>/dev/null | grep -c "^deleted:" || echo "0")

            if [[ "$removed_volumes" -gt 0 ]]; then
                log_success "Removed $removed_volumes unused volumes"
            else
                log_info "No unused volumes found for cleanup"
            fi
        fi
    fi
}

# Clean up build cache
cleanup_build_cache() {
    log_info "Cleaning up build cache..."

    if [[ "$CONTAINER_CMD" == "podman" ]]; then
        if [[ "$DRY_RUN" == "--dry-run" ]]; then
            log_info "DRY RUN: Would clean build cache"
        else
            # Podman doesn't have buildx cache, but we can clean system cache
            $CONTAINER_CMD system reset --force 2>/dev/null || log_warn "Could not reset system cache"
            log_info "Cleaned system cache"
        fi
    else
        if [[ "$DRY_RUN" == "--dry-run" ]]; then
            log_info "DRY RUN: Would clean build cache"
            docker builder prune --dry-run 2>/dev/null || log_warn "Could not check build cache"
        else
            local cache_cleaned
            cache_cleaned=$(docker builder prune -f 2>/dev/null | grep -c "^deleted:" || echo "0")

            if [[ "$cache_cleaned" -gt 0 ]]; then
                log_success "Cleaned $cache_cleaned build cache items"
            else
                log_info "No build cache to clean"
            fi
        fi
    fi
}

# Clean up temporary files
cleanup_temp_files() {
    log_info "Cleaning up temporary files..."

    local temp_dirs=(
        "/tmp/containers-*"
        "/tmp/podman-*"
        "/tmp/docker-*"
        "$HOME/.local/share/containers/tmp/*"
    )

    for pattern in "${temp_dirs[@]}"; do
        if [[ "$DRY_RUN" == "--dry-run" ]]; then
            log_info "DRY RUN: Would clean $pattern"
        else
            # Use find to safely remove old temp files
            find ${pattern%/*} -name "${pattern##*/}" -type f -mtime +1 -delete 2>/dev/null || true
        fi
    done

    log_info "Temporary file cleanup completed"
}

# System resource cleanup using container runtime
system_prune() {
    log_info "Performing system-wide resource cleanup..."

    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log_info "DRY RUN: Would perform system prune"
        if [[ "$CONTAINER_CMD" == "podman" ]]; then
            $CONTAINER_CMD system prune --dry-run 2>/dev/null || log_warn "Could not check system resources"
        else
            $CONTAINER_CMD system prune --dry-run 2>/dev/null || log_warn "Could not check system resources"
        fi
    else
        # Use system prune for comprehensive cleanup
        if [[ "$CONTAINER_CMD" == "podman" ]]; then
            $CONTAINER_CMD system prune -f --volumes 2>/dev/null || log_warn "System prune encountered issues"
        else
            $CONTAINER_CMD system prune -f 2>/dev/null || log_warn "System prune encountered issues"
        fi
        log_success "System prune completed"
    fi
}

# Display cleanup summary
cleanup_summary() {
    log_info "Cleanup operation completed"
    log_info "Container age threshold: ${CONTAINER_AGE_HOURS} hours"
    log_info "Volume age threshold: ${VOLUME_AGE_HOURS} hours"

    # Display current resource usage
    log_info "Current resource usage:"
    echo "  Running containers: $($CONTAINER_CMD ps -q | wc -l)"
    echo "  Total containers: $($CONTAINER_CMD ps -a -q | wc -l)"
    echo "  Total images: $($CONTAINER_CMD images -q | wc -l)"
    echo "  Total volumes: $($CONTAINER_CMD volume ls -q | wc -l 2>/dev/null || echo "0")"
}

# Main cleanup function
main() {
    local start_time=$(date +%s)

    log_info "Starting container cleanup process"

    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log_info "Running in DRY RUN mode - no resources will be deleted"
    fi

    # Perform cleanup steps
    check_runtime
    safety_check
    cleanup_containers
    cleanup_images
    cleanup_volumes
    cleanup_build_cache
    cleanup_temp_files
    system_prune

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    cleanup_summary
    log_info "Cleanup completed in ${duration} seconds"
}

# Handle script arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
        echo "Container Resource Cleanup Script"
        echo ""
        echo "Usage: $0 [--dry-run]"
        echo ""
        echo "Options:"
        echo "  --dry-run    Show what would be cleaned without actually removing anything"
        echo "  --help, -h   Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  LOG_FILE     Path to log file (default: /var/log/container-cleanup.log)"
        echo ""
        echo "Configuration:"
        echo "  Container age threshold: $CONTAINER_AGE_HOURS hours"
        echo "  Volume age threshold: $VOLUME_AGE_HOURS hours"
        exit 0
    fi

    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

    # Run main function
    main "$@"
fi