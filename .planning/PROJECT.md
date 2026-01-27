# Cybersecurity Training Platform

## What This Is

A local web portal for browsing and practicing cybersecurity challenges in containerized environments. Users can discover challenges like a streaming service, spawn vulnerable containers on-demand, exploit vulnerabilities to find flags, and track their progress - all running locally without user management.

## Core Value

Users can safely practice real vulnerability exploitation on isolated, disposable containers with auto-generated flags and clean reset between attempts.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Discovery page with challenge browsing (Netflix-like interface)
- [ ] Challenge filtering by newest, vulnerability type, difficulty, completion status
- [ ] Individual challenge detail pages with description and spawn controls
- [ ] On-demand container spawning via Docker Compose
- [ ] Auto-generated flag injection into containers via environment variables
- [ ] Flag validation by reading flag.txt from running containers
- [ ] Challenge state persistence in local JSON file (was-started, is-running, was-completed)
- [ ] Automatic container cleanup when flags are validated
- [ ] Manual container stop functionality
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

- **Deployment**: Local-only — no cloud hosting requirements
- **Dependencies**: Docker and Docker Compose required on host system
- **Storage**: File-based persistence — no external databases
- **Security**: Containers must be isolated and fully disposable
- **Images**: All container images must be available from Docker Hub

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-generated flags via env vars | Prevents static flag sharing, more realistic | — Pending |
| Docker exec validation via flag.txt | Simple, reliable validation method | — Pending |
| JSON state file | Lightweight persistence without database complexity | — Pending |
| Configuration-based challenge addition | Keeps platform simple, challenges managed in code | — Pending |

---
*Last updated: 2026-01-27 after initialization*