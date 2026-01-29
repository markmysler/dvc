# Roadmap: Damn Vulnerable Containers

**Created:** 2026-01-27
**Phases:** 5
**Depth:** Quick (3-5 phases, critical path focus)

## Overview

Transform security learning through a local platform that provides safe, hands-on practice with real vulnerabilities. Each phase delivers a complete, verifiable capability building toward a Netflix-like discovery interface for containerized security challenges.

## Phase Structure

### Phase 1: Foundation & Security
**Goal:** Platform operates securely with isolated, disposable container environments

**Dependencies:** None (foundation phase)

**Requirements:** CHAL-08, CHAL-09, INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06 (8 requirements)

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Project setup and Docker container runtime deployment
- [x] 01-02-PLAN.md — Security hardening and automated resource cleanup system
- [x] 01-03-PLAN.md — Monitoring infrastructure with Prometheus, Grafana, Node Exporter, and cAdvisor

**Success Criteria:**
1. User can run platform entirely via Docker Compose without external dependencies
2. System spawns containers with complete security isolation (hardened profiles)
3. System automatically cleans up containers and resources after use
4. Platform includes monitoring with Prometheus, Grafana, Node Exporter, and cAdvisor
5. System provides monitoring and logging for container operations

### Phase 2: Challenge Engine
**Goal:** Users can spawn challenges, exploit vulnerabilities, and validate flags

**Dependencies:** Phase 1 (requires secure container foundation)

**Requirements:** CHAL-02, CHAL-03, CHAL-04, CHAL-07 (4 requirements)

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Challenge definitions and container orchestration engine
- [x] 02-02-PLAN.md — Cryptographic flag generation and validation system (TDD)
- [x] 02-03-PLAN.md — Session management and REST API integration

**Success Criteria:**
1. User can spawn challenge containers on-demand from the interface
2. User can manually stop running challenge containers
3. System generates unique flags for each container spawn attempt
4. User can submit flags and receive immediate validation feedback

### Phase 3: Discovery Interface
**Goal:** Users can discover, filter, and track progress through challenges

**Dependencies:** Phase 2 (requires working challenge engine)

**Requirements:** CHAL-01, CHAL-05, CHAL-06, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05 (8 requirements)

**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Next.js application setup with shadcn/ui and TanStack Query API integration
- [x] 03-02-PLAN.md — Netflix-style discovery interface with advanced filtering and challenge spawning
- [x] 03-03-PLAN.md — Progress tracking analytics and URL state management for shareable discovery
- [x] 03-04-PLAN.md — End-to-end discovery interface integration testing and verification

**Success Criteria:**
1. User can browse challenges through Netflix-style discovery interface
2. User can filter challenges by difficulty, type, and completion status
3. User can search challenges by multiple criteria (name, description, tags)
4. User can view detailed challenge descriptions with spawn controls
5. System tracks and displays user progress and completion analytics

### Phase 4: Polish & Enhancement
**Goal:** Platform provides professional UX and extensible challenge management

**Dependencies:** Phase 3 (requires complete core functionality)

**Requirements:** DISC-06, UI-01, UI-02 (3 requirements)

**Plans:** 3 plans

Plans:
- [ ] 04-01-PLAN.md — Professional UI polish with shadcn/ui components and challenge validation system
- [ ] 04-02-PLAN.md — Challenge import workflow with wizard UI and validation feedback
- [ ] 04-03-PLAN.md — End-to-end platform polish and challenge import verification

**Success Criteria:**
1. All UI components use shadcn/ui design system for consistent appearance
2. User can import custom challenges via configuration files
3. System provides smooth, responsive interactions throughout the interface

### Phase 5: Container Lifecycle & Hints
**Goal:** Improved challenge container lifecycle management with hints system and simplified configuration

**Dependencies:** Phase 4 (requires complete platform functionality)

**Plans:** 3 plans

Plans:
- [ ] 05-01-PLAN.md — Container health monitoring with automated recovery and background processing
- [ ] 05-02-PLAN.md — Progressive hint system with time-based disclosure and UI integration
- [ ] 05-03-PLAN.md — Configuration simplification with unified challenge management and migration

**Details:**
Phase 5 enhances the platform with three key improvements: automated container health monitoring for reliable challenge operations, a progressive hint system to improve learning experience, and unified configuration management to eliminate duplicate config files. These enhancements provide a more robust and maintainable platform while improving user experience through better reliability and adaptive learning support.

## Progress Tracking

| Phase | Status | Requirements | Success Criteria | Dependencies Met |
|-------|--------|--------------|------------------|------------------|
| 1 - Foundation & Security | ✓ Complete | 8/8 mapped | 5/5 met | N/A |
| 2 - Challenge Engine | ✓ Complete | 4/4 mapped | 4/4 met | ✓ Phase 1 |
| 3 - Discovery Interface | ✓ Complete | 8/8 mapped | 5/5 met | ✓ Phase 2 |
| 4 - Polish & Enhancement | Pending | 3/3 mapped | 3 defined | ✓ Phase 3 |
| 5 - Container Lifecycle & Hints | Not planned | TBD | TBD | ✓ Phase 4 |

**Total Coverage:** 23/23 requirements mapped (includes v1 requirements only)

## Phase Dependencies

```
Phase 1: Foundation & Security
    ↓
Phase 2: Challenge Engine
    ↓
Phase 3: Discovery Interface
    ↓
Phase 4: Polish & Enhancement
    ↓
Phase 5: Container Lifecycle & Hints
```

**Critical Path:** Each phase depends on the previous phase's completion. No parallel execution possible due to architectural dependencies.

## Success Metrics

**Phase 1 Complete:** Platform runs locally with secure container isolation
**Phase 2 Complete:** Users can exploit vulnerabilities and validate flags
**Phase 3 Complete:** Users can discover and track progress through challenges
**Phase 4 Complete:** Platform provides professional UX with extensible challenge system
**Phase 5 Complete:** Enhanced container lifecycle management with challenge hints and simplified configuration

**Project Complete:** Users can safely practice real vulnerability exploitation on isolated, disposable containers with auto-generated flags and clean reset between attempts.

---
*Roadmap created: 2026-01-27*
*Ready for planning: Phase 1*