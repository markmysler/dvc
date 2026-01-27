# Domain Pitfalls

**Domain:** Cybersecurity Training Platforms
**Researched:** 2026-01-27
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Container Escape Vulnerabilities

**What goes wrong:**
Docker containers intended for training challenges become pathways to compromise the host system, allowing participants to break out of intended sandboxes and potentially access sensitive host resources or other containers.

**Why it happens:**
Training platforms often prioritize ease of deployment over security hardening. Containers are run with excessive privileges (--privileged flag), dangerous capabilities (CAP_SYS_ADMIN), or with the Docker socket mounted (/var/run/docker.sock), effectively granting host-level access. Recent vulnerabilities like CVE-2025-31133, CVE-2025-52565, and CVE-2025-52881 in runC affect nearly all versions.

**How to avoid:**
- Never run containers with --privileged flag in production training environments
- Remove dangerous Linux capabilities (CAP_SYS_ADMIN, CAP_NET_ADMIN, CAP_SYS_PTRACE)
- Never mount Docker socket into containers
- Use non-root users inside containers (USER instruction)
- Implement proper container runtime security with tools like Falco for monitoring
- Regularly update runC and container runtime to latest patched versions

**Warning signs:**
- Containers running as root user
- Use of --privileged flag in docker-compose.yml
- Docker socket mounts in volume configurations
- Participants reporting ability to access host filesystem or other containers

**Phase to address:**
Foundation/Security Phase - container hardening must be implemented from day one

---

### Pitfall 2: Insecure Flag Generation and Validation

**What goes wrong:**
Auto-generated flags become predictable, allowing participants to bypass intended learning objectives through pattern recognition, seed prediction, or brute force attacks rather than solving challenges properly.

**Why it happens:**
Developers implement weak random number generation or use predictable patterns for flag creation. Common mistakes include using system time as seed, weak entropy sources, or exposing the random generation logic. Flag validation through simple file reads (docker exec cat flag.txt) can also be manipulated.

**How to avoid:**
- Use cryptographically secure random number generators with proper entropy
- Implement unique flag generation per user/session to prevent sharing
- Validate flags through secure APIs rather than direct file access
- Use unpredictable flag formats and avoid sequential or time-based patterns
- Implement proper isolation between challenge instances

**Warning signs:**
- Flags following predictable patterns (timestamps, incremental numbers)
- Multiple users submitting identical flags
- Flag validation relying solely on file system access
- Participants solving challenges faster than expected difficulty suggests

**Phase to address:**
Core Challenge Engine Phase - flag system architecture is foundational

---

### Pitfall 3: Docker Compose Security Vulnerabilities

**What goes wrong:**
Docker Compose configurations create security holes through path traversal attacks, exposed services, or malicious OCI artifacts, allowing attackers to overwrite arbitrary files on the host system or gain unauthorized access.

**Why it happens:**
Recent vulnerability CVE-2025-62725 (CVSS 8.9) allows path traversal through Docker Compose's OCI support. Developers trust remote artifacts without validation and use default configurations that expose services unnecessarily. The vulnerability triggers even from seemingly harmless commands like "docker compose ps".

**How to avoid:**
- Update to Docker Compose version 2.40.2 or later immediately
- Never run untrusted docker-compose.yaml files
- Validate and audit all remote OCI artifacts before use
- Disable unnecessary service exposure in compose files
- Implement proper network segmentation between training containers
- Use least-privilege principles in service configurations

**Warning signs:**
- Use of older Docker Compose versions (pre-2.40.2)
- Remote OCI artifact references in compose files
- Services exposed on 0.0.0.0 interfaces unnecessarily
- Unvalidated third-party compose configurations

**Phase to address:**
Infrastructure Setup Phase - compose security must be established during initial deployment

---

### Pitfall 4: JSON State Persistence Injection Attacks

**What goes wrong:**
JSON-based state persistence becomes vulnerable to injection attacks, allowing attackers to manipulate application state, execute arbitrary code, or access sensitive data through malicious JSON payloads.

**Why it happens:**
Applications accept and parse unsanitized JSON data directly, use eval() functions for JSON parsing, or fail to validate JSON schemas. Insecure deserialization of JSON state can lead to remote code execution. Local storage without encryption exposes sensitive training progress and user data.

**How to avoid:**
- Use JSON.parse() instead of eval() for client-side JSON parsing
- Implement strict JSON schema validation before processing
- Sanitize all JSON data on both client and server sides
- Encrypt sensitive data before storing in JSON format
- Use proper access controls for JSON state files
- Validate JSON structure and content against expected schemas

**Warning signs:**
- Use of eval() functions for JSON processing
- JSON data accepted without schema validation
- Sensitive information stored in plain-text JSON files
- Client-side JSON manipulation without server validation

**Phase to address:**
Data Management Phase - JSON handling security must be implemented when building state persistence

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using --privileged containers | Easy challenge setup | Container escape vulnerabilities | Never acceptable |
| Simple flag.txt file reads | Quick validation | Flag sharing, no uniqueness | Only in development |
| Default Docker Compose configs | Faster deployment | Security vulnerabilities | Only for isolated dev environments |
| Unencrypted JSON state storage | Simpler implementation | Data exposure, injection attacks | Never for production |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Docker Registry | Trusting public images without scanning | Scan all images with tools like Trivy before use |
| Container Orchestration | Direct socket mounting for management | Use proper API authentication and RBAC |
| Challenge Validation | Direct file system access via docker exec | Implement secure API-based validation |
| User Progress Tracking | Client-side only state management | Server-side validation with encrypted storage |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Container per user | Works for 1-5 users | Resource limits, proper orchestration | 10+ concurrent users |
| File-based state | Simple for single user | Database or distributed storage | Multiple users or sessions |
| Synchronous challenge spawning | Immediate container startup | Async operations with queuing | 5+ containers spawning simultaneously |
| Direct docker exec for validation | Fast flag checking | API-based validation service | 50+ challenge attempts per minute |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Shared container instances | Cross-contamination between users | Unique containers per user/session |
| Predictable flag generation | Flag sharing, bypassing learning | Cryptographically secure randomization |
| Exposed Docker daemon | Host system compromise | Never expose Docker socket |
| Unvalidated challenge content | Code injection in challenges | Sandbox validation environments |
| Persistent container state | Information leakage between sessions | Stateless containers with fresh spawns |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Long container startup times | User frustration, abandoned sessions | Pre-warmed container pools |
| Cryptic error messages | Users can't debug issues | Clear, educational error messages |
| No progress indication | Users unsure if system is working | Progress bars for container operations |
| Challenge state loss | Lost work on browser refresh | Automatic state persistence |
| No offline capability | Unusable without internet | Local-only design with cached content |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Container Security:** Often missing capability restrictions — verify no --privileged flags
- [ ] **Flag Generation:** Often missing uniqueness — verify per-user randomization
- [ ] **State Persistence:** Often missing encryption — verify sensitive data protection
- [ ] **Error Handling:** Often missing user-friendly messages — verify educational error text
- [ ] **Resource Cleanup:** Often missing container termination — verify orphaned container detection
- [ ] **Network Isolation:** Often missing proper segmentation — verify container-to-container restrictions
- [ ] **Input Validation:** Often missing JSON schema checks — verify all user input sanitization

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Container Escape | HIGH | Rebuild host, audit all containers, implement hardening |
| Flag Sharing | MEDIUM | Regenerate all flags, reset user progress, add uniqueness |
| Compose Vulnerability | HIGH | Update immediately, audit all compose files, rescan images |
| JSON Injection | MEDIUM | Sanitize data, patch parsers, audit stored state |
| Resource Exhaustion | LOW | Implement limits, add monitoring, restart services |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Container Escape | Foundation/Security Setup | Security scanning, privilege auditing |
| Insecure Flag Generation | Core Challenge Engine | Randomness testing, uniqueness validation |
| Docker Compose Vulnerabilities | Infrastructure Setup | Version checking, compose file auditing |
| JSON Injection | Data Management | Schema validation testing, injection testing |
| Resource Exhaustion | Orchestration/Management | Load testing, resource monitoring |
| UX/Performance Issues | User Interface | User testing, performance benchmarking |

## Sources

- Docker Compose CVE-2025-62725 Security Advisory (MEDIUM confidence - recent CVE reports)
- RunC vulnerabilities CVE-2025-31133, CVE-2025-52565, CVE-2025-52881 (MEDIUM confidence - vulnerability databases)
- OWASP Docker Security Cheat Sheet (HIGH confidence - official documentation)
- Container escape techniques research (MEDIUM confidence - security research papers)
- CTF platform development best practices (MEDIUM confidence - community knowledge)
- JSON injection vulnerability patterns (MEDIUM confidence - security research)

---
*Pitfalls research for: Cybersecurity Training Platforms*
*Researched: 2026-01-27*