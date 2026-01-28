# Phase 1: Foundation & Security - Research

**Researched:** 2026-01-27
**Domain:** Container Security & Isolation
**Confidence:** HIGH

## Summary

Container security in 2026 centers on layered defense through namespace isolation, capability restriction, and automated resource management. The standard approach combines Docker as the container runtime with Prometheus/Grafana for monitoring and Docker's built-in cleanup mechanisms for resource management.

Docker with proper security hardening provides robust container isolation through security profiles, capability restrictions, and resource limits. The platform uses Docker Compose for orchestration, simplifying deployment and service management.

Key architectural decisions include using Docker for broad compatibility, implementing security hardening through compose configuration, and establishing monitoring through the Prometheus/Grafana stack with cAdvisor for container metrics.

**Primary recommendation:** Use Docker with Docker Compose orchestration, security hardening via compose config, Prometheus/Grafana monitoring with cAdvisor, and Docker's built-in cleanup mechanisms.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Docker | 27.0+ | Container runtime | Industry standard, broad ecosystem, extensive tooling |
| Docker Compose | 2.24+ | Service orchestration | Simplified multi-container deployment and management |
| Python Docker SDK | 7.0+ | Container API | Programmatic container control from Flask backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prometheus | 2.50+ | Metrics collection | System and container monitoring |
| Grafana | 10.4+ | Metrics visualization | Dashboard creation and alerting |
| Node Exporter | 1.7+ | System metrics | Host-level system monitoring |
| cAdvisor | 0.47+ | Container metrics | Container-level resource monitoring |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Docker | Podman | Podman has rootless-by-default but Docker has better tooling ecosystem |
| Docker Compose | Kubernetes | Kubernetes better for production scale but overkill for local development |
| Prometheus | InfluxDB | InfluxDB better for time-series but Prometheus has better container ecosystem |

**Installation:**
```bash
# Docker (most platforms)
curl -fsSL https://get.docker.com | sh

# Docker Compose (included with Docker Desktop, or standalone)
# Already included in modern Docker installations

# Monitoring stack via Docker Compose
docker compose up -d prometheus grafana node-exporter cadvisor
```

## Architecture Patterns

### Recommended Project Structure
```
container-platform/
├── configs/          # Container and security configurations
├── monitoring/       # Prometheus/Grafana configurations
├── scripts/         # Cleanup and automation scripts
├── security/        # Security profiles and policies
└── services/        # systemd service files
```

### Pattern 1: Container Security Hardening
**What:** Run containers with security restrictions and capability limitations
**When to use:** Default for all container deployments
**Example:**
```yaml
# Source: https://docs.docker.com/compose/compose-file/
services:
  api:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - DAC_OVERRIDE
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=100m
```

### Pattern 2: Docker Compose Orchestration
**What:** Multi-service deployment with networking and volumes
**When to use:** Production systems with multiple interconnected services
**Example:**
```yaml
# Source: https://docs.docker.com/compose/
version: '3.8'
services:
  api:
    build: ./api
    networks:
      - backend
    volumes:
      - ./data:/app/data:ro
  
  frontend:
    build: ./frontend
    networks:
      - frontend
    depends_on:
      - api

networks:
  backend:
    internal: false
  frontend:
    internal: false
```

### Pattern 3: Container Monitoring with cAdvisor
**What:** Collect container metrics for Prometheus scraping
**When to use:** Production deployments requiring container observability
**Example:**
```yaml
# Source: https://github.com/google/cadvisor
services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "8080:8080"
```
# Source: Multi-architecture container research
podman build --platform=linux/amd64,linux/arm64 \
  --manifest myapp-manifest \
  -t myapp:latest .
```

### Anti-Patterns to Avoid
- **Running privileged containers:** Breaks isolation, use specific capabilities instead
- **Manual resource cleanup:** Leads to resource exhaustion, automate with scripts
- **Single architecture builds:** Limits deployment flexibility, always build multi-arch

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Container monitoring | Custom metrics scraping | Prometheus + cAdvisor/node_exporter | Handles discovery, retention, alerting automatically |
| Resource cleanup | Manual scripts | `podman system prune` with filters | Built-in safety checks, proper dependency handling |
| Security profiles | Custom seccomp filters | Default runtime profiles + SELinux/AppArmor | Extensively tested, community maintained |
| Multi-arch builds | Manual cross-compilation | Buildx/Buildah with QEMU | Handles emulation, manifest creation automatically |
| Log aggregation | File-based logging | Container runtime logging drivers | Structured output, rotation, centralization |

**Key insight:** Container security and management have well-established solutions that handle edge cases like signal propagation, resource limits, and cleanup ordering that custom solutions frequently miss.

## Common Pitfalls

### Pitfall 1: Insufficient Capability Dropping
**What goes wrong:** Running containers with default capabilities includes dangerous ones like CAP_SYS_ADMIN
**Why it happens:** Default configurations prioritize compatibility over security
**How to avoid:** Always use `--cap-drop ALL` then add only required capabilities
**Warning signs:** Container can modify host networking, access kernel modules

### Pitfall 2: Neglecting Resource Cleanup
**What goes wrong:** Stopped containers and unused volumes accumulate, consuming disk space
**Why it happens:** Container lifecycle management not automated
**How to avoid:** Implement scheduled cleanup with `podman system prune` and monitoring
**Warning signs:** Disk usage growing continuously, `/var/lib/containers` directory size

### Pitfall 3: Monitoring Blind Spots
**What goes wrong:** Container-level metrics missing with Podman due to cAdvisor limitations
**Why it happens:** Tooling designed for Docker daemon doesn't work with daemonless Podman
**How to avoid:** Focus on host-level monitoring with Node Exporter, supplement with application metrics
**Warning signs:** No visibility into individual container resource usage

### Pitfall 4: Multi-Architecture Build Complexity
**What goes wrong:** Builds fail on non-native architectures or produce incorrect binaries
**Why it happens:** QEMU emulation not properly configured or base images lack multi-arch support
**How to avoid:** Use official multi-arch base images, test builds on actual hardware
**Warning signs:** Binary crashes on target architecture, missing QEMU user-static package

## Code Examples

Verified patterns from official sources:

### Secure Container Launch
```bash
# Source: https://docs.podman.io/en/latest/markdown/podman-run.1.html
podman run -d \
  --name secure-app \
  --security-opt no-new-privileges \
  --security-opt label=type:container_runtime_t \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add DAC_OVERRIDE \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --user 1000:1000 \
  myapp:latest
```

### Automated Cleanup Service
```bash
# Source: Docker official pruning documentation
[Unit]
Description=Container Cleanup
Requires=podman.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/container-cleanup.sh

# Cleanup script content
#!/bin/bash
podman system prune -f --filter "until=24h"
podman volume prune -f --filter "until=168h"
echo "Cleanup completed at $(date)" >> /var/log/container-cleanup.log
```

### Multi-Architecture Manifest
```bash
# Source: Multi-architecture container research
podman build --arch amd64 --tag myapp:amd64 --manifest myapp .
podman build --arch arm64 --tag myapp:arm64 --manifest myapp .
podman manifest push myapp docker://registry.example.com/myapp:latest
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Docker daemon + root | Podman rootless | 2021-2022 | Eliminated privileged daemon attack surface |
| Manual capability sets | --cap-drop ALL pattern | 2023-2024 | Principle of least privilege by default |
| Single architecture | Multi-arch manifests | 2022-2023 | ARM adoption in cloud/edge environments |
| Manual cleanup | Automated pruning with filters | 2023-2024 | Prevents resource exhaustion |

**Deprecated/outdated:**
- Docker Swarm: Kubernetes became standard orchestration platform
- Manual multi-stage builds: Buildx/Buildah automate cross-compilation
- Custom monitoring solutions: Prometheus ecosystem standardized

## Open Questions

Things that couldn't be fully resolved:

1. **Container-level monitoring with Podman**
   - What we know: cAdvisor doesn't support Podman, only host-level metrics available
   - What's unclear: Alternative solutions for granular container resource monitoring
   - Recommendation: Use host monitoring + application-level metrics as workaround

2. **SELinux vs AppArmor choice**
   - What we know: RHEL systems default to SELinux, Debian systems use AppArmor
   - What's unclear: Performance implications and configuration complexity differences
   - Recommendation: Use distribution default, both provide equivalent security

## Sources

### Primary (HIGH confidence)
- Docker Security Documentation: https://docs.docker.com/engine/security/
- Podman Documentation: https://docs.podman.io/en/latest/markdown/podman-run.1.html
- Docker Pruning Guide: https://docs.docker.com/engine/manage-resources/pruning/

### Secondary (MEDIUM confidence)
- Container security research articles from 2025-2026
- Multi-architecture container guides verified with official docs
- Prometheus/Grafana container monitoring patterns

### Tertiary (LOW confidence)
- Community discussions on container performance
- Emerging security tools and practices
- Specific version compatibility matrices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation and established ecosystem
- Architecture: HIGH - Proven patterns from official sources
- Pitfalls: MEDIUM - Based on community experience and documentation

**Research date:** 2026-01-27
**Valid until:** 2026-02-26 (30 days - container ecosystem is stable)