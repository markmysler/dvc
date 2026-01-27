# Architecture Research

**Domain:** Cybersecurity Training Platform (Local CTF)
**Researched:** 2025-01-27
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Portal Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Challenge│  │Progress │  │Container│  │   Flag  │        │
│  │Browser  │  │Tracker  │  │Manager  │  │Validator│        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Docker Container Orchestration             │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │Challenge │  │Progress  │  │Container │                   │
│  │Metadata  │  │ Store    │  │ Images   │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Challenge Browser | Present available challenges like streaming service catalog | React/Vue frontend with card-based grid layout |
| Progress Tracker | Track completion status, flags found, scores | Local JSON/SQLite with progress persistence |
| Container Manager | Spawn/destroy vulnerable containers on-demand | Docker Compose orchestration with health checks |
| Flag Validator | Verify submitted flags by reading from containers | Docker exec commands to read flag.txt files |
| Web Portal | Unified interface for discovery and practice | Express/Flask API backend serving frontend |
| Challenge Metadata | Store challenge descriptions, categories, difficulty | JSON files or SQLite with challenge definitions |
| Container Images | Pre-built vulnerable environments from Docker Hub | Public Docker images with known vulnerabilities |

## Recommended Project Structure

```
src/
├── web/                    # Web portal frontend
│   ├── components/         # React/Vue components
│   │   ├── ChallengeGrid.js
│   │   ├── ProgressTracker.js
│   │   └── ContainerStatus.js
│   ├── pages/              # Route pages
│   └── styles/             # CSS/styling
├── api/                    # Backend API
│   ├── routes/             # API endpoints
│   │   ├── challenges.js   # Challenge CRUD operations
│   │   ├── containers.js   # Container management
│   │   └── flags.js        # Flag validation
│   ├── services/           # Business logic
│   │   ├── docker.js       # Docker management service
│   │   ├── progress.js     # Progress tracking service
│   │   └── validator.js    # Flag validation service
│   └── middleware/         # Express middleware
├── data/                   # Local persistence
│   ├── challenges/         # Challenge metadata
│   ├── progress.json       # User progress tracking
│   └── docker-compose/     # Container definitions
├── containers/             # Docker configurations
│   ├── vulnerable-web/     # Web app challenges
│   ├── network-security/   # Network challenges
│   └── forensics/          # Forensics challenges
└── scripts/                # Utility scripts
    ├── setup.sh           # Environment setup
    ├── cleanup.sh         # Container cleanup
    └── flag-generator.js  # Auto-generate flags
```

### Structure Rationale

- **web/:** Frontend separation allows for independent UI development and potential future mobile/desktop clients
- **api/:** Backend API provides clear contract between frontend and container management layer
- **data/:** Local file-based storage aligns with no-database constraint while maintaining data organization
- **containers/:** Organized by challenge category for easy discovery and maintenance
- **scripts/:** Automation scripts for common operations reduce manual overhead

## Architectural Patterns

### Pattern 1: On-Demand Container Spawning

**What:** Containers are created only when user starts a challenge, destroyed when complete or expired
**When to use:** For resource efficiency and isolation in local environments
**Trade-offs:** Higher latency on challenge start vs better resource utilization

**Example:**
```typescript
// Container lifecycle management
class ContainerManager {
  async spawnChallenge(challengeId: string): Promise<ContainerInfo> {
    const config = this.loadChallengeConfig(challengeId);
    const container = await docker.compose.up(config);
    await this.waitForHealthy(container);
    return { containerId: container.id, ports: container.ports };
  }

  async cleanup(containerId: string): Promise<void> {
    await docker.compose.down(containerId, { removeVolumes: true });
  }
}
```

### Pattern 2: Flag Validation via Container Exec

**What:** Flags are validated by executing commands inside running containers to read flag files
**When to use:** When flags are dynamically generated and stored within container environments
**Trade-offs:** Requires container access vs more secure than exposing flag APIs

**Example:**
```typescript
// Flag validation through container execution
class FlagValidator {
  async validateFlag(containerId: string, submission: string): Promise<boolean> {
    const flagContent = await docker.exec(containerId, 'cat /flag.txt');
    return flagContent.trim() === submission.trim();
  }
}
```

### Pattern 3: Challenge Catalog with Metadata

**What:** Challenge definitions stored as structured metadata with Docker Compose references
**When to use:** For easy challenge discovery and consistent presentation
**Trade-offs:** Requires metadata maintenance vs provides rich UX for challenge browsing

**Example:**
```typescript
// Challenge metadata structure
interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  dockerCompose: string;
  estimatedTime: number;
  tags: string[];
}
```

## Data Flow

### Request Flow

```
[User Browses Challenges]
    ↓
[Challenge Grid] → [Metadata API] → [Challenge Files] → [JSON Response]
    ↓                    ↓               ↓                   ↓
[User Starts Challenge] ← [Container API] ← [Docker Compose] ← [Container Started]
    ↓
[User Exploits] → [Flag Submission] → [Flag Validator] → [Docker Exec]
    ↓                     ↓                   ↓               ↓
[Progress Updated] ← [Progress API] ← [Validation Result] ← [Flag Verified]
```

### State Management

```
[Progress Store]
    ↓ (read/write)
[Challenge Status] ←→ [Container State] → [Docker Engine] → [Running Containers]
    ↓
[UI Updates] ←→ [Real-time Status] → [Health Checks] → [Container Monitor]
```

### Key Data Flows

1. **Challenge Discovery:** User browses → Frontend fetches metadata → Displays as browsable catalog
2. **Container Lifecycle:** User starts challenge → Backend spawns container → Returns connection details
3. **Flag Validation:** User submits flag → Backend executes docker command → Returns validation result
4. **Progress Tracking:** Flag validated → Backend updates local progress file → Frontend refreshes status

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 concurrent challenges | Single Docker host, file-based storage sufficient |
| 5-20 concurrent challenges | Add container resource limits, implement cleanup automation |
| 20+ concurrent challenges | Consider container orchestration, external storage for progress |

### Scaling Priorities

1. **First bottleneck:** Docker resource exhaustion - implement automatic cleanup and resource limits
2. **Second bottleneck:** File I/O contention - move to embedded database (SQLite) for progress tracking

## Anti-Patterns

### Anti-Pattern 1: Persistent Container Infrastructure

**What people do:** Keep all challenge containers running constantly
**Why it's wrong:** Wastes resources, creates security risks, complicates environment management
**Do this instead:** Implement on-demand spawning with automatic cleanup after completion/timeout

### Anti-Pattern 2: Hardcoded Flag Storage

**What people do:** Store flags in configuration files or database
**Why it's wrong:** Creates single point of failure, reduces challenge realism
**Do this instead:** Generate flags dynamically within containers and validate via container execution

### Anti-Pattern 3: Complex User Management

**What people do:** Implement full authentication and authorization systems
**Why it's wrong:** Adds unnecessary complexity for local-only deployment
**Do this instead:** Use simple session-based tracking or local storage for progress persistence

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Docker Hub | Direct image pulls | Use official vulnerable images when available |
| Local Docker Engine | Docker API/CLI | Primary interface for container management |
| File System | Direct file I/O | Store challenge metadata and progress locally |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Backend API | REST/HTTP | Standard web API patterns |
| Backend ↔ Docker Engine | Docker API/CLI | Async operations for container lifecycle |
| Backend ↔ File Storage | Direct file access | Synchronous for metadata, async for progress |

## Sources

- [Architecture of an Efficient Environment Management Platform for Experiential Cybersecurity Education](https://www.mdpi.com/2078-2489/16/7/604) - HIGH confidence
- [CTFd Documentation - Deploying Challenge Services](https://docs.ctfd.io/tutorials/challenges/deploying-challenges/) - HIGH confidence
- [Scalable and lightweight CTF infrastructures using application containers](https://www.usenix.org/system/files/conference/ase16/ase16-paper-raj.pdf) - HIGH confidence
- [Docker Security - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) - HIGH confidence
- [CTF challenges: Dockerizing and Repository structure](https://medium.com/techloop/ctf-challenges-dockerizing-and-repository-structure-bd3aed9314de) - MEDIUM confidence

---
*Architecture research for: Cybersecurity Training Platform (Local CTF)*
*Researched: 2025-01-27*