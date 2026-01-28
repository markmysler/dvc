# Technology Stack

**Project:** Cybersecurity Training Platform
**Researched:** 2025-01-27
**Confidence:** MEDIUM

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 22.13.0+ | Runtime environment | Native SQLite support (experimental), LTS version, proven for containerized web apps |
| Next.js | 16.x | Frontend/backend framework | Latest version (Oct 2025), excellent Docker support, SSR for performance, proven in CTF platforms |
| React | 19.3.x | UI components | Latest stable after CVE-2025-55182 patches, component-based architecture for challenge UIs |

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite | Built-in (Node 22+) | Primary persistence | Native Node.js support, file-based, perfect for local deployment, zero configuration |
| Level | 8.0+ | Secondary storage | Fast key-value store for session data, proven in Node.js ecosystem |

### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker | 25.x+ | Containerization | Industry standard for CTF platforms, excellent security isolation, proven scaling |
| Docker Compose | 2.24+ | Multi-container orchestration | Standard for local deployment, handles vulnerable container lifecycle |
| Traefik | 3.0+ | Reverse proxy | Automatic service discovery, HTTPS termination, container-native routing |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Express.js | 4.19+ | API server | If need standalone API server (Next.js API routes may suffice) |
| dockerode | 4.0+ | Docker API client | For dynamic container management from Node.js |
| helmet | 8.0+ | Security headers | Always use for production security |
| bcrypt | 5.1+ | Password hashing | User authentication system |
| jsonwebtoken | 9.0+ | JWT handling | Session management |
| zod | 3.22+ | Schema validation | Input validation for security |
| winston | 3.11+ | Logging | Structured logging for audit trails |

## Installation

```bash
# Core
npm install next@16 react@19 sqlite3

# Docker management
npm install dockerode

# Security
npm install helmet bcrypt jsonwebtoken zod

# Utilities
npm install winston level

# Dev dependencies
npm install -D @types/node typescript eslint prettier
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Database | SQLite | PostgreSQL | Requires server setup, violates local-only constraint |
| Database | SQLite | MongoDB | Document DB unnecessary, requires server |
| Frontend | Next.js | Express + React SPA | More complex setup, worse SEO, separate build processes |
| Reverse Proxy | Traefik | Nginx | Requires manual configuration, less container-native |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React 19.0.x-19.2.x | CVE-2025-55182 vulnerability (CVSS 10.0) | React 19.3+ with patches |
| Express.js 5.x | Still in beta, unstable for production | Express.js 4.19+ or Next.js API routes |
| MySQL/MariaDB | Requires database server, violates local-only | SQLite native |
| Redis | Requires server process | Level.js for key-value needs |
| Legacy Docker Compose | version: field deprecated | Modern Compose without version field |

## Stack Patterns by Variant

**If building simple CTF platform:**
- Use Next.js App Router
- SQLite for challenges/users
- Docker Compose for vulnerable containers
- Because: Minimal setup, fast development

**If building advanced platform with real-time features:**
- Add WebSocket support via Socket.io
- Use Level.js for real-time session data
- Add Redis-compatible API via Level
- Because: Real-time scoring, live collaboration

**If targeting enterprise deployment:**
- Add Kubernetes manifests
- Use external PostgreSQL option
- Add monitoring with Prometheus
- Because: Scalability and observability

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Node.js 22+ | SQLite native | Requires experimental flag until Node 23+ |
| Next.js 16 | React 19.3+ | Version pinning required for security |
| dockerode 4.0+ | Docker API 1.40+ | Check Docker version compatibility |
| Level 8.0+ | Node.js 16+ | Async/await native support |

## Security Considerations

### Critical Security Measures
- **Container Isolation**: Use Docker user namespaces to prevent privilege escalation
- **React CVE Mitigation**: Pin React to 19.3+ to avoid CVE-2025-55182
- **Input Validation**: Use Zod for all user inputs before database operations
- **Container Lifecycle**: Implement proper cleanup of vulnerable containers
- **File Permissions**: SQLite database files must have restricted access (600)

### Container Security Best Practices
- Run all containers as non-root users
- Use multi-stage Docker builds to minimize attack surface
- Implement health checks for container monitoring
- Use Docker secrets for sensitive configuration
- Enable Docker Content Trust for image verification

## Sources

- Node.js SQLite Documentation (https://nodejs.org/api/sqlite.html) — Native SQLite capabilities
- Next.js 16 Release (https://nextjs.org/blog/next-16) — Latest framework features
- Docker Best Practices 2025 (https://docs.docker.com/build/building/best-practices/) — Container optimization
- CVE-2025-55182 Analysis (https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components) — React vulnerability details
- CTF Platform Research (GitHub: ctf-platform topics) — Community patterns and implementations

---
*Stack research for: Cybersecurity Training Platform*
*Researched: 2025-01-27*