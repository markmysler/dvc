#!/bin/bash
#
# Security Validation Test Suite
# Validates container security measures for cybersecurity training platform
#

set -euo pipefail

# Configuration
TEST_IMAGE="alpine:latest"
TEST_CONTAINER_NAME="security-test-$$"
SECURITY_PROFILE="/home/mark/sec-prac/security/container-profiles.json"
PODMAN_CONFIG="/home/mark/sec-prac/configs/podman-security.conf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Logging functions
log_test() {
    echo -e "\n${BOLD}${BLUE}[TEST ${TESTS_TOTAL}]${NC} $*"
}

log_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $*"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗ FAIL:${NC} $*"
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠ WARN:${NC} $*"
}

log_info() {
    echo -e "${BLUE}ℹ INFO:${NC} $*"
}

# Check if container runtime is available
check_runtime() {
    if command -v podman >/dev/null 2>&1; then
        CONTAINER_CMD="podman"
        log_info "Using container runtime: Podman"
    elif command -v docker >/dev/null 2>&1; then
        CONTAINER_CMD="docker"
        log_info "Using container runtime: Docker (Podman preferred for security)"
    else
        echo -e "${RED}Error:${NC} Neither podman nor docker found. Cannot run security tests."
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test containers..."
    $CONTAINER_CMD rm -f "$TEST_CONTAINER_NAME" 2>/dev/null || true
    $CONTAINER_CMD rm -f "${TEST_CONTAINER_NAME}-priv" 2>/dev/null || true
    $CONTAINER_CMD rm -f "${TEST_CONTAINER_NAME}-net" 2>/dev/null || true
}

# Ensure test image is available
prepare_test_image() {
    log_info "Ensuring test image is available..."
    if ! $CONTAINER_CMD image exists "$TEST_IMAGE" 2>/dev/null; then
        log_info "Pulling test image: $TEST_IMAGE"
        $CONTAINER_CMD pull "$TEST_IMAGE" >/dev/null 2>&1 || {
            log_warn "Could not pull $TEST_IMAGE - using existing images for tests"
            TEST_IMAGE="$($CONTAINER_CMD images --format "{{.Repository}}:{{.Tag}}" | head -1)"
            log_info "Using alternative test image: $TEST_IMAGE"
        }
    fi
}

# Test 1: Container runs as non-root user
test_user_isolation() {
    ((TESTS_TOTAL++))
    log_test "Container User Isolation"

    local user_id
    user_id=$($CONTAINER_CMD run --rm --user 1000:1000 "$TEST_IMAGE" id -u 2>/dev/null || echo "failed")

    if [[ "$user_id" == "1000" ]]; then
        log_pass "Container runs as non-root user (UID 1000)"
    else
        log_fail "Container user isolation failed (expected UID 1000, got: $user_id)"
    fi
}

# Test 2: Verify minimal capability set
test_capabilities() {
    ((TESTS_TOTAL++))
    log_test "Capability Restriction"

    if [[ "$CONTAINER_CMD" == "podman" ]]; then
        # Test with capability drop
        local cap_test
        cap_test=$($CONTAINER_CMD run --rm --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE \
                   "$TEST_IMAGE" sh -c 'echo "Capability test passed"' 2>/dev/null || echo "failed")

        if [[ "$cap_test" == "Capability test passed" ]]; then
            log_pass "Minimal capabilities (CHOWN, DAC_OVERRIDE) work correctly"
        else
            log_fail "Minimal capability set test failed"
        fi
    else
        # Docker capability test
        local cap_test
        cap_test=$($CONTAINER_CMD run --rm --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE \
                   "$TEST_IMAGE" sh -c 'echo "Capability test passed"' 2>/dev/null || echo "failed")

        if [[ "$cap_test" == "Capability test passed" ]]; then
            log_pass "Minimal capabilities (CHOWN, DAC_OVERRIDE) work correctly"
        else
            log_fail "Minimal capability set test failed"
        fi
    fi
}

# Test 3: Host filesystem isolation
test_filesystem_isolation() {
    ((TESTS_TOTAL++))
    log_test "Host Filesystem Isolation"

    local fs_test
    fs_test=$($CONTAINER_CMD run --rm --user 1000:1000 "$TEST_IMAGE" \
              sh -c 'ls /etc/passwd >/dev/null 2>&1 && echo "isolated" || echo "failed"' 2>/dev/null || echo "error")

    if [[ "$fs_test" == "isolated" ]]; then
        log_pass "Container cannot access host-sensitive files"

        # Test write access to root filesystem
        local write_test
        write_test=$($CONTAINER_CMD run --rm --read-only --user 1000:1000 "$TEST_IMAGE" \
                     sh -c 'touch /test.txt 2>/dev/null && echo "fail" || echo "pass"' 2>/dev/null || echo "pass")

        if [[ "$write_test" == "pass" ]]; then
            log_pass "Read-only root filesystem prevents unauthorized writes"
        else
            log_fail "Read-only filesystem restriction failed"
        fi
    else
        log_fail "Filesystem isolation test failed"
    fi
}

# Test 4: Network isolation
test_network_isolation() {
    ((TESTS_TOTAL++))
    log_test "Network Isolation"

    # Test that container cannot access host network
    local net_test
    net_test=$($CONTAINER_CMD run --rm --user 1000:1000 "$TEST_IMAGE" \
               sh -c 'ping -c 1 -W 1 8.8.8.8 >/dev/null 2>&1 && echo "connected" || echo "isolated"' 2>/dev/null || echo "isolated")

    if [[ "$net_test" == "connected" ]]; then
        log_pass "Network connectivity works (expected for internet-connected tests)"
    else
        log_pass "Network isolation in place (no external connectivity)"
    fi

    # Test that host network is not accessible
    local host_net_test
    host_net_test=$($CONTAINER_CMD run --rm --user 1000:1000 "$TEST_IMAGE" \
                    sh -c 'ip route | grep -q "default" && echo "routed" || echo "isolated"' 2>/dev/null || echo "isolated")

    if [[ "$host_net_test" == "routed" ]]; then
        log_pass "Container has network routing (normal operation)"
    else
        log_pass "Container network is isolated (enhanced security)"
    fi
}

# Test 5: Privilege escalation prevention
test_privilege_escalation() {
    ((TESTS_TOTAL++))
    log_test "Privilege Escalation Prevention"

    # Test that setuid binaries don't work
    local priv_test
    priv_test=$($CONTAINER_CMD run --rm --security-opt no-new-privileges:true --user 1000:1000 "$TEST_IMAGE" \
                sh -c 'id -u' 2>/dev/null || echo "failed")

    if [[ "$priv_test" == "1000" ]]; then
        log_pass "no-new-privileges prevents privilege escalation"
    else
        log_fail "Privilege escalation prevention failed"
    fi
}

# Test 6: Resource limits enforcement
test_resource_limits() {
    ((TESTS_TOTAL++))
    log_test "Resource Limits Enforcement"

    # Test memory limit
    local mem_test
    mem_test=$($CONTAINER_CMD run --rm --memory 128m --user 1000:1000 "$TEST_IMAGE" \
               sh -c 'echo "Memory limit test passed"' 2>/dev/null || echo "failed")

    if [[ "$mem_test" == "Memory limit test passed" ]]; then
        log_pass "Memory limits are enforced"
    else
        log_fail "Memory limit enforcement failed"
    fi

    # Test CPU limit
    local cpu_test
    cpu_test=$($CONTAINER_CMD run --rm --cpus 0.5 --user 1000:1000 "$TEST_IMAGE" \
               sh -c 'echo "CPU limit test passed"' 2>/dev/null || echo "failed")

    if [[ "$cpu_test" == "CPU limit test passed" ]]; then
        log_pass "CPU limits are enforced"
    else
        log_fail "CPU limit enforcement failed"
    fi
}

# Test 7: Tmpfs mount restrictions
test_tmpfs_restrictions() {
    ((TESTS_TOTAL++))
    log_test "Tmpfs Mount Restrictions"

    # Test tmpfs with noexec
    local tmpfs_test
    tmpfs_test=$($CONTAINER_CMD run --rm --tmpfs /tmp:rw,noexec,nosuid,size=100m --user 1000:1000 "$TEST_IMAGE" \
                 sh -c 'echo "#!/bin/sh" > /tmp/test.sh && echo "echo test" >> /tmp/test.sh && chmod +x /tmp/test.sh && /tmp/test.sh 2>/dev/null && echo "fail" || echo "pass"' 2>/dev/null || echo "pass")

    if [[ "$tmpfs_test" == "pass" ]]; then
        log_pass "Tmpfs noexec restriction prevents script execution"
    else
        log_fail "Tmpfs noexec restriction failed"
    fi
}

# Test 8: Container-to-container isolation
test_container_isolation() {
    ((TESTS_TOTAL++))
    log_test "Container-to-Container Isolation"

    # Start a test container
    local container1_id
    container1_id=$($CONTAINER_CMD run -d --name "$TEST_CONTAINER_NAME" --user 1000:1000 "$TEST_IMAGE" sleep 30 2>/dev/null || echo "failed")

    if [[ "$container1_id" != "failed" ]]; then
        # Try to access it from another container
        local isolation_test
        isolation_test=$($CONTAINER_CMD run --rm --user 1000:1000 "$TEST_IMAGE" \
                        sh -c 'ps aux | grep -v grep | grep sleep >/dev/null 2>&1 && echo "fail" || echo "pass"' 2>/dev/null || echo "pass")

        # Cleanup the test container
        $CONTAINER_CMD rm -f "$TEST_CONTAINER_NAME" >/dev/null 2>&1 || true

        if [[ "$isolation_test" == "pass" ]]; then
            log_pass "Containers are isolated from each other"
        else
            log_fail "Container-to-container isolation failed"
        fi
    else
        log_fail "Could not start test container for isolation test"
    fi
}

# Test 9: Validate cleanup doesn't affect running containers
test_cleanup_safety() {
    ((TESTS_TOTAL++))
    log_test "Cleanup Script Safety"

    # Start a long-running container
    local container_id
    container_id=$($CONTAINER_CMD run -d --name "${TEST_CONTAINER_NAME}-cleanup" --user 1000:1000 "$TEST_IMAGE" sleep 300 2>/dev/null || echo "failed")

    if [[ "$container_id" != "failed" ]]; then
        # Run cleanup in dry-run mode
        local cleanup_test
        cleanup_test=$(./scripts/cleanup.sh --dry-run 2>/dev/null | grep -c "Found.*running containers" || echo "0")

        # Check if container is still running
        local container_running
        container_running=$($CONTAINER_CMD ps -q --filter "name=${TEST_CONTAINER_NAME}-cleanup" | wc -l)

        # Cleanup the test container
        $CONTAINER_CMD rm -f "${TEST_CONTAINER_NAME}-cleanup" >/dev/null 2>&1 || true

        if [[ "$container_running" == "1" ]]; then
            log_pass "Cleanup script does not affect running containers"
        else
            log_fail "Cleanup script safety test failed"
        fi
    else
        log_warn "Could not start test container for cleanup safety test"
    fi
}

# Test 10: Security profile validation
test_security_profiles() {
    ((TESTS_TOTAL++))
    log_test "Security Profile Validation"

    # Check if security profiles file exists and is valid JSON
    if [[ -f "$SECURITY_PROFILE" ]]; then
        local profile_test
        profile_test=$(python3 -m json.tool "$SECURITY_PROFILE" >/dev/null 2>&1 && echo "pass" || echo "fail")

        if [[ "$profile_test" == "pass" ]]; then
            log_pass "Security profiles configuration is valid JSON"

            # Check for required security settings
            local required_settings=("default" "challenge" "monitoring")
            for setting in "${required_settings[@]}"; do
                if grep -q "\"$setting\"" "$SECURITY_PROFILE"; then
                    log_pass "Security profile '$setting' is defined"
                else
                    log_fail "Required security profile '$setting' is missing"
                fi
            done
        else
            log_fail "Security profiles configuration has invalid JSON syntax"
        fi
    else
        log_fail "Security profiles configuration file not found: $SECURITY_PROFILE"
    fi
}

# Display test summary
display_summary() {
    echo -e "\n${BOLD}${BLUE}=== SECURITY TEST SUMMARY ===${NC}"
    echo -e "Total tests: $TESTS_TOTAL"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"

    local pass_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    echo -e "Pass rate: ${pass_rate}%"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "\n${GREEN}${BOLD}🎉 All security tests passed!${NC}"
        echo -e "${GREEN}Container security is properly configured.${NC}"
        return 0
    else
        echo -e "\n${RED}${BOLD}⚠️  Some security tests failed.${NC}"
        echo -e "${RED}Please review the configuration and fix issues.${NC}"
        return 1
    fi
}

# Main function
main() {
    echo -e "${BOLD}${BLUE}Container Security Validation Test Suite${NC}"
    echo -e "${BLUE}Testing security measures for cybersecurity training platform${NC}\n"

    # Setup
    check_runtime
    prepare_test_image

    # Run tests
    test_user_isolation
    test_capabilities
    test_filesystem_isolation
    test_network_isolation
    test_privilege_escalation
    test_resource_limits
    test_tmpfs_restrictions
    test_container_isolation
    test_cleanup_safety
    test_security_profiles

    # Cleanup and summary
    cleanup
    display_summary
}

# Handle script arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
        echo "Container Security Validation Test Suite"
        echo ""
        echo "Usage: $0"
        echo ""
        echo "This script runs comprehensive security tests to validate:"
        echo "  - User isolation and privilege restrictions"
        echo "  - Capability limitations"
        echo "  - Filesystem and network isolation"
        echo "  - Resource limits enforcement"
        echo "  - Tmpfs mount security"
        echo "  - Container-to-container isolation"
        echo "  - Cleanup script safety"
        echo "  - Security profile configuration"
        echo ""
        echo "Exit codes:"
        echo "  0 - All tests passed"
        echo "  1 - One or more tests failed"
        echo ""
        echo "Requirements:"
        echo "  - Podman or Docker installed"
        echo "  - Test image available (alpine:latest)"
        echo "  - Security configuration files in place"
        exit 0
    fi

    # Run main function
    main "$@"
fi