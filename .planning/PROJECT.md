# Cybersecurity Training Platform

## What This Is

A local web portal for browsing and practicing cybersecurity challenges in containerized environments. Users can discover challenges like a streaming service, spawn vulnerable containers on-demand, exploit vulnerabilities to find flags, and track their progress - all running locally without user management.

## Core Value

Users can safely practice real vulnerability exploitation on isolated, disposable containers with auto-generated flags and clean reset between attempts.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [x] Discovery page with challenge browsing (Netflix-like interface)
- [x] Challenge filtering by newest, vulnerability type, difficulty, completion status
- [x] Individual challenge detail pages with description and spawn controls
- [x] On-demand container spawning via Docker API
- [x] Auto-generated flag injection into containers via environment variables
- [x] Flag validation via HMAC-based cryptographic system
- [x] Challenge state persistence in memory with session tracking
- [ ] Automatic container cleanup when flags are validated
- [x] Manual container stop functionality
- [ ] Support for multi-container challenges (main + support containers)
- [ ] Challenge configuration system for adding new vulnerabilities

### Out of Scope

- User management/authentication — local-only tool
- Real-time multi-user collaboration — single-user focused
- Container building/creation — uses pre-built images from Docker Hub
- Cloud deployment — local development environment only
- Challenge editor UI — challenges added via config files

## Context

This is a personal DVWA alternative with modern UX for vulnerability practice. All challenges run as Docker containers with auto-generated flags for realistic exploitation scenarios. The platform is vulnerability-agnostic - any exploit that can run in containers is supported.

Target vulnerabilities include SQLi, XSS, path traversal, and any OWASP category that can be containerized. Each challenge includes docker-compose configuration specifying main and support containers.

## Constraints

- **Deployment**: Docker Compose — all services containerized
- **Dependencies**: Docker and Docker Compose required on host system
- **Storage**: In-memory session management, localStorage for progress tracking
- **Security**: Containers must be isolated and fully disposable
- **Architecture**: Flask REST API + Next.js frontend + Prometheus/Grafana monitoring

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| HMAC-based flag generation | Cryptographically secure, prevents tampering | ✓ Implemented |
| Docker API orchestration | Direct container control, no CLI needed | ✓ Implemented |
| In-memory session management | Fast, no database required for local use | ✓ Implemented |
| Docker Compose deployment | All services containerized, easy startup | ✓ Implemented |
| Configuration-based challenges | Keeps platform simple, challenges managed in JSON | ✓ Implemented |

---
*Last updated: 2026-01-27 after initialization*