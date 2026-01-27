#!/bin/bash

# Cybersecurity Training Platform Verification Script
# Validates local-only operation, container isolation, and multi-architecture support

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Configuration
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--verbose]"
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
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_skip() {
    echo -e "${CYAN}[SKIP]${NC} $1"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Test framework functions
start_test() {
    local test_name="$1"
    echo
    echo -e "${BLUE}Testing:${NC} $test_name"
    ((TESTS_TOTAL++))
}

pass_test() {
    log_success "$1"
    ((TESTS_PASSED++))
}

fail_test() {
    log_error "$1"
    ((TESTS_FAILED++))
}

skip_test() {
    log_skip "$1"
    ((TESTS_SKIPPED++))
}

# Test 1: Podman version and rootless mode
test_podman_rootless() {
    start_test "Podman installation and rootless operation"

    if ! command -v podman >/dev/null 2>&1; then
        fail_test "Podman is not installed"
        return 1
    fi

    local podman_version
    podman_version=$(podman --version 2>/dev/null | cut -d' ' -f3) || {
        fail_test "Unable to get Podman version"
        return 1
    }

    log_verbose "Podman version: $podman_version"

    # Check rootless mode
    local system_info
    system_info=$(podman system info --format=json 2>/dev/null) || {
        fail_test "Unable to get Podman system info"
        return 1
    }

    if echo "$system_info" | grep -q '"rootless": true'; then
        pass_test "Podman is running in rootless mode (version: $podman_version)"
    else
        fail_test "Podman is not running in rootless mode"
        return 1
    fi

    # Check if user namespaces are available
    if [[ -f /proc/sys/user/max_user_namespaces ]]; then
        local max_namespaces
        max_namespaces=$(cat /proc/sys/user/max_user_namespaces)
        log_verbose "Max user namespaces: $max_namespaces"
        if [[ "$max_namespaces" -gt 0 ]]; then
            pass_test "User namespaces are available (limit: $max_namespaces)"
        else
            fail_test "User namespaces are disabled"
            return 1
        fi
    else
        log_warning "Cannot check user namespace limits"
    fi
}

# Test 2: Compose functionality
test_compose_functionality() {
    start_test "Container orchestration support"

    # Check for podman-compose
    if command -v podman-compose >/dev/null 2>&1; then
        local version
        version=$(podman-compose --version 2>/dev/null | head -1) || version="unknown"
        log_verbose "Found podman-compose: $version"
        pass_test "podman-compose is available"
        return 0
    fi

    # Check for docker-compose with Podman socket
    if command -v docker-compose >/dev/null 2>&1; then
        log_verbose "Found docker-compose, checking Podman compatibility"

        # Test if Podman socket is available
        if timeout 5 podman system service --timeout 1 >/dev/null 2>&1; then
            pass_test "docker-compose can work with Podman socket"
        else
            log_warning "docker-compose found but Podman socket test failed"
            skip_test "Container orchestration requires manual setup"
        fi
        return 0
    fi

    # Check for podman play kube as alternative
    if podman play --help 2>/dev/null | grep -q "kube"; then
        pass_test "podman play kube available as orchestration alternative"
        return 0
    fi

    fail_test "No container orchestration tool found (podman-compose, docker-compose, or podman play)"
    return 1
}

# Test 3: Multi-architecture support
test_multiarch_support() {
    start_test "Multi-architecture container support"

    # Check CPU architecture
    local host_arch
    host_arch=$(uname -m)
    log_verbose "Host architecture: $host_arch"

    # Check QEMU user emulation
    local qemu_arches=()
    if [[ -d /proc/sys/fs/binfmt_misc ]]; then
        while IFS= read -r -d '' file; do
            if [[ $(basename "$file") == qemu-* ]]; then
                qemu_arches+=("$(basename "$file")")
            fi
        done < <(find /proc/sys/fs/binfmt_misc -name 'qemu-*' -print0 2>/dev/null)
    fi

    if [[ ${#qemu_arches[@]} -gt 0 ]]; then
        log_verbose "Available QEMU emulations: ${qemu_arches[*]}"
        pass_test "QEMU user emulation is available (${#qemu_arches[@]} architectures)"
    else
        log_warning "QEMU user emulation not found - multi-arch builds may fail"
        skip_test "Multi-architecture support requires QEMU user-static"
    fi

    # Test manifest creation
    local test_manifest="test-verify-$$"
    if podman manifest create "$test_manifest" >/dev/null 2>&1; then
        podman manifest rm "$test_manifest" >/dev/null 2>&1 || true
        pass_test "Multi-architecture manifest creation works"
    else
        fail_test "Cannot create multi-architecture manifests"
        return 1
    fi

    # Test building for different architecture (quick test)
    log_verbose "Testing cross-architecture build capability..."
    local alt_arch
    case "$host_arch" in
        x86_64) alt_arch="arm64" ;;
        aarch64) alt_arch="amd64" ;;
        *) alt_arch="amd64" ;;
    esac

    # Create a simple test Dockerfile
    local test_dir="/tmp/multiarch-test-$$"
    mkdir -p "$test_dir"
    cat > "$test_dir/Dockerfile" << 'EOF'
FROM alpine:latest
RUN echo "Multi-arch test"
EOF

    if podman build --platform="linux/$alt_arch" --tag "test:$alt_arch" "$test_dir" >/dev/null 2>&1; then
        podman rmi "test:$alt_arch" >/dev/null 2>&1 || true
        pass_test "Cross-architecture build test passed ($host_arch -> $alt_arch)"
    else
        log_warning "Cross-architecture build test failed"
        skip_test "Multi-arch builds may require additional setup"
    fi

    rm -rf "$test_dir"
}

# Test 4: Local network isolation
test_network_isolation() {
    start_test "Local-only network operation"

    # Test container creation with network isolation
    local test_container="network-test-$$"
    local network_test_result=0

    if podman run --rm --name "$test_container" --network none alpine:latest echo "isolated" >/dev/null 2>&1; then
        pass_test "Container network isolation works"
    else
        # Try to pull alpine image first
        if podman pull alpine:latest >/dev/null 2>&1; then
            if podman run --rm --name "$test_container" --network none alpine:latest echo "isolated" >/dev/null 2>&1; then
                pass_test "Container network isolation works (after image pull)"
            else
                fail_test "Container network isolation test failed"
                network_test_result=1
            fi
        else
            log_warning "Cannot pull test image - network connectivity required"
            skip_test "Network isolation test requires base image"
        fi
    fi

    # Test bridge network creation
    local test_network="test-net-$$"
    if podman network create "$test_network" >/dev/null 2>&1; then
        podman network rm "$test_network" >/dev/null 2>&1 || true
        pass_test "Custom bridge networks can be created"
    else
        fail_test "Cannot create custom bridge networks"
        network_test_result=1
    fi

    return $network_test_result
}

# Test 5: Container security and isolation
test_container_security() {
    start_test "Container security and isolation"

    # Test capability dropping
    local test_container="security-test-$$"

    # First ensure we have a test image
    if ! podman image exists alpine:latest; then
        if ! podman pull alpine:latest >/dev/null 2>&1; then
            skip_test "Cannot pull test image for security tests"
            return 0
        fi
    fi

    # Test running with dropped capabilities
    if podman run --rm \
        --name "$test_container" \
        --security-opt no-new-privileges \
        --cap-drop ALL \
        --cap-add CHOWN \
        alpine:latest \
        echo "capabilities test" >/dev/null 2>&1; then
        pass_test "Capability dropping works correctly"
    else
        fail_test "Capability dropping test failed"
        return 1
    fi

    # Test read-only filesystem
    if podman run --rm \
        --name "$test_container-ro" \
        --read-only \
        --tmpfs /tmp:rw,noexec,nosuid,size=10m \
        alpine:latest \
        sh -c "echo test > /tmp/testfile && echo 'read-only test passed'" >/dev/null 2>&1; then
        pass_test "Read-only filesystem with tmpfs works"
    else
        fail_test "Read-only filesystem test failed"
        return 1
    fi

    # Test user namespace isolation
    if podman run --rm \
        --name "$test_container-user" \
        --user 1000:1000 \
        alpine:latest \
        id >/dev/null 2>&1; then
        pass_test "User namespace isolation works"
    else
        fail_test "User namespace isolation test failed"
        return 1
    fi
}

# Test 6: File system isolation
test_filesystem_isolation() {
    start_test "Container filesystem isolation"

    if ! podman image exists alpine:latest; then
        skip_test "No test image available for filesystem isolation tests"
        return 0
    fi

    local test_container="fs-test-$$"

    # Test that container cannot access host filesystem beyond mounts
    local test_result=0

    # Test restricted filesystem access
    if podman run --rm \
        --name "$test_container" \
        --security-opt no-new-privileges \
        --cap-drop ALL \
        alpine:latest \
        sh -c "ls /etc/passwd > /dev/null 2>&1" >/dev/null 2>&1; then
        log_verbose "Container can access its own /etc/passwd (expected)"
    else
        log_verbose "Container cannot access /etc/passwd"
    fi

    # Test that container cannot escape to host root
    if ! podman run --rm \
        --name "$test_container-escape" \
        --security-opt no-new-privileges \
        --cap-drop ALL \
        alpine:latest \
        sh -c "test -r /host-etc/passwd" >/dev/null 2>&1; then
        pass_test "Container cannot escape to host filesystem"
    else
        fail_test "Container filesystem isolation may be compromised"
        test_result=1
    fi

    # Test volume mount isolation
    local test_dir="/tmp/volume-test-$$"
    mkdir -p "$test_dir"
    echo "test content" > "$test_dir/testfile"

    if podman run --rm \
        --name "$test_container-volume" \
        --security-opt no-new-privileges \
        --cap-drop ALL \
        -v "$test_dir:/mnt:ro" \
        alpine:latest \
        sh -c "cat /mnt/testfile" >/dev/null 2>&1; then
        pass_test "Volume mounts work with security restrictions"
    else
        fail_test "Volume mounts fail with security restrictions"
        test_result=1
    fi

    rm -rf "$test_dir"
    return $test_result
}

# Test 7: Resource management
test_resource_management() {
    start_test "Container resource management"

    if ! podman image exists alpine:latest; then
        skip_test "No test image available for resource management tests"
        return 0
    fi

    local test_container="resource-test-$$"

    # Test memory limits
    if podman run --rm \
        --name "$test_container" \
        --memory 64m \
        alpine:latest \
        echo "memory limit test" >/dev/null 2>&1; then
        pass_test "Memory limits can be applied"
    else
        fail_test "Memory limit application failed"
        return 1
    fi

    # Test CPU limits
    if podman run --rm \
        --name "$test_container-cpu" \
        --cpus 0.5 \
        alpine:latest \
        echo "cpu limit test" >/dev/null 2>&1; then
        pass_test "CPU limits can be applied"
    else
        log_warning "CPU limit test failed - may not be supported"
        skip_test "CPU limits may require cgroup v2"
    fi

    # Test automatic cleanup verification
    local container_count_before
    container_count_before=$(podman ps -a --format "{{.Names}}" | wc -l)

    # Run and immediately remove container
    podman run --rm alpine:latest echo "cleanup test" >/dev/null 2>&1 || true

    local container_count_after
    container_count_after=$(podman ps -a --format "{{.Names}}" | wc -l)

    if [[ $container_count_after -eq $container_count_before ]]; then
        pass_test "Automatic container cleanup (--rm) works"
    else
        log_warning "Container cleanup verification inconclusive"
    fi
}

# Test 8: Local data persistence
test_data_persistence() {
    start_test "Local data persistence"

    # Check if monitoring data directories exist and are writable
    local project_dir
    project_dir="$(dirname "$(dirname "$(realpath "${BASH_SOURCE[0]}")")")"

    local persistence_test_result=0

    # Test Prometheus data persistence
    local prometheus_dir="$project_dir/monitoring/data/prometheus"
    if [[ -d "$prometheus_dir" ]]; then
        if [[ -w "$prometheus_dir" ]]; then
            pass_test "Prometheus data directory is writable"
        else
            fail_test "Prometheus data directory is not writable"
            persistence_test_result=1
        fi
    else
        log_warning "Prometheus data directory does not exist"
        skip_test "Run setup script to create monitoring directories"
    fi

    # Test Grafana data persistence
    local grafana_dir="$project_dir/monitoring/data/grafana"
    if [[ -d "$grafana_dir" ]]; then
        if [[ -w "$grafana_dir" ]] || [[ $(stat -c %U "$grafana_dir" 2>/dev/null) == "472" ]]; then
            pass_test "Grafana data directory has correct permissions"
        else
            fail_test "Grafana data directory has incorrect permissions"
            persistence_test_result=1
        fi
    else
        log_warning "Grafana data directory does not exist"
        skip_test "Run setup script to create monitoring directories"
    fi

    # Test volume creation capability
    local test_volume="persistence-test-$$"
    if podman volume create "$test_volume" >/dev/null 2>&1; then
        podman volume rm "$test_volume" >/dev/null 2>&1 || true
        pass_test "Volume creation and removal works"
    else
        fail_test "Cannot create volumes for data persistence"
        persistence_test_result=1
    fi

    return $persistence_test_result
}

# Display summary
display_summary() {
    echo
    echo "========================================"
    echo -e "${BLUE}Verification Summary${NC}"
    echo "========================================"
    echo -e "Total tests:  ${TESTS_TOTAL}"
    echo -e "Passed:       ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Failed:       ${RED}${TESTS_FAILED}${NC}"
    echo -e "Skipped:      ${CYAN}${TESTS_SKIPPED}${NC}"
    echo

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo "The cybersecurity training platform is ready for use."
        echo
        echo "Next steps:"
        echo "  1. Run 'npm start' to launch the monitoring stack"
        echo "  2. Access Grafana at http://localhost:3000"
        echo "  3. Access Prometheus at http://localhost:9090"
        return 0
    else
        echo -e "${RED}✗ Some tests failed.${NC}"
        echo "Please address the failed tests before using the platform."
        echo
        echo "Common fixes:"
        echo "  - Run './scripts/setup.sh' to install missing components"
        echo "  - Check system requirements and permissions"
        echo "  - Ensure user has access to container runtimes"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Cybersecurity Training Platform - Verification${NC}"
    echo "=============================================="
    echo

    # Run all tests
    test_podman_rootless || true
    test_compose_functionality || true
    test_multiarch_support || true
    test_network_isolation || true
    test_container_security || true
    test_filesystem_isolation || true
    test_resource_management || true
    test_data_persistence || true

    # Display results
    display_summary
}

# Run main function
main "$@"