# Damn Vulnerable Containers (DVC)

A self-hosted cybersecurity training platform where you practice offensive security techniques against intentionally vulnerable applications running in isolated Docker containers. Browse challenges Netflix-style, spawn containers on-demand, capture flags through exploitation, and track your progress—all running locally with zero cloud dependencies.

## What This Is

DVC is a complete CTF (Capture The Flag) platform that runs entirely on your local machine:

- **Discovery UI**: Next.js frontend with Netflix-style browsing, filtering by difficulty/category/tags
- **Challenge Engine**: Python Flask API that spawns isolated vulnerable containers with cryptographic flag generation
- **Monitoring Stack**: Prometheus + Grafana for real-time observability of containers and system metrics
- **Zero Infrastructure**: No databases, no authentication, no cloud services—just Docker and local files

Each challenge is a self-contained Docker container with a vulnerability to exploit. Flags are unique per instance using HMAC-SHA256, preventing sharing between users while enabling local-first architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Machine                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (Next.js 16)                                       │
│  ├─ Port 3001                                               │
│  ├─ TanStack Query for state management                     │
│  ├─ shadcn/ui components + Tailwind CSS                     │
│  └─ localStorage for progress tracking                      │
│                           │                                  │
│                           ↓ HTTP API calls                   │
│                                                              │
│  Backend API (Flask/Python)                                  │
│  ├─ Port 5000                                               │
│  ├─ Challenge definitions (JSON)                            │
│  ├─ Container orchestrator (Docker SDK)                     │
│  ├─ Session manager (in-memory)                             │
│  └─ Flag system (HMAC-SHA256)                               │
│                           │                                  │
│                           ↓ Docker API                       │
│                                                              │
│  Docker Engine                                               │
│  ├─ Challenge containers (ephemeral)                        │
│  ├─ Security profiles applied (seccomp, capabilities)       │
│  ├─ Network isolation per container                         │
│  └─ Automatic cleanup on timeout                            │
│                                                              │
│  Monitoring Stack                                            │
│  ├─ Prometheus (port 9090) - metrics collection             │
│  └─ Grafana (port 3000) - visualization dashboards          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

You need these installed on your Linux machine:

- **Docker Engine** (20.10+) with daemon running
- **Docker Compose** (v2.0+)
- **Python** (3.9+)
- **Node.js** (18.0+) with npm

### Setup and Run

```bash
# Clone the repository
git clone <repo-url>
cd dvc

# Start everything with Docker Compose (recommended)
docker-compose up -d

# OR manually start components
python -m api.app  # Start Flask API on port 5000
cd frontend && npm run dev  # Start Next.js on port 3001
```

### Access the Platform

Once running, open these URLs:

- **Challenge Browser**: http://localhost:3001
- **API Documentation**: http://localhost:5000/api/health
- **Grafana Dashboards**: http://localhost:3000 (admin/admin)
- **Prometheus Metrics**: http://localhost:9090

### Using the Platform

1. **Browse Challenges**: Open http://localhost:3001 and filter by difficulty/category
2. **Spawn Container**: Click "Start Challenge" to launch an isolated vulnerable container
3. **Access Challenge**: The UI shows the container's access URL (random port)
4. **Exploit Vulnerability**: Use your browser, Burp Suite, or CLI tools to find the flag
5. **Submit Flag**: Paste the captured flag into the submission form
6. **Auto-Cleanup**: Containers automatically stop after 30 minutes (configurable)

## How It Works

### Challenge Lifecycle

```
User clicks "Start Challenge"
  ↓
API receives spawn request with challenge_id + user_id
  ↓
Orchestrator reads challenge definition from challenges.json
  ↓
Docker builds/pulls challenge image
  ↓
Container spawned with:
  - Unique flag generated via HMAC
  - Security profile applied (dropped capabilities, read-only fs)
  - Network isolation enabled
  - Resource limits set (memory, CPU, PIDs)
  ↓
API returns session_id + container URL
  ↓
User exploits vulnerability to find flag
  ↓
User submits flag via UI
  ↓
API validates flag cryptographically
  ↓
Progress saved to localStorage
  ↓
Container auto-stops after timeout (30min default)
```

### Flag Generation System

Flags are generated using HMAC-SHA256 for cryptographic security:

```python
flag = HMAC-SHA256(secret_key, "challenge_id:user_id:timestamp")
format: flag{16-hex-characters}
```

This ensures:
- **Uniqueness**: Each user gets a different flag per challenge instance
- **Tamper-proof**: Flags cannot be forged without the secret key
- **Timing-safe**: Validation uses constant-time comparison against timing attacks
- **No database needed**: Flags are deterministically regenerated during validation

### Security Profiles

Every challenge container runs with hardened security:

```yaml
Security Profile: "challenge"
- Capabilities: DROP ALL, ADD only [CHOWN, DAC_OVERRIDE]
- User: Non-root (uid 1000)
- Filesystem: Read-only root + writable tmpfs volumes
- Network: Isolated bridge network (no internet by default)
- Resources: Memory limit (256MB), CPU limit (0.5 cores), PID limit (128)
- Seccomp: Custom profile blocking dangerous syscalls
- No new privileges: Prevents privilege escalation
```

## Project Structure

```
dvc/
├── api/                          # Flask REST API
│   ├── app.py                   # Application factory + CORS
│   ├── challenges.py            # Challenge spawn/stop endpoints
│   └── flags.py                 # Flag validation endpoints
│
├── engine/                       # Core orchestration logic
│   ├── orchestrator.py          # Docker container lifecycle manager
│   ├── session_manager.py       # In-memory session tracking
│   └── flag_system.py           # HMAC flag generation/validation
│
├── challenges/
│   ├── definitions/
│   │   └── challenges.json      # Challenge metadata + container specs
│   └── test-challenge/          # Example vulnerable app
│       ├── Dockerfile
│       ├── app.py               # Vulnerable Flask app
│       └── templates/
│
├── frontend/                     # Next.js 16 application
│   ├── app/
│   │   ├── page.tsx            # Main discovery page
│   │   └── layout.tsx          # Root layout with providers
│   ├── components/
│   │   ├── discovery/          # Challenge browsing + filtering
│   │   ├── analytics/          # Progress charts + stats
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── api.ts              # Typed API client
│   │   └── types.ts            # TypeScript interfaces
│   └── hooks/                   # React hooks for state
│
├── security/
│   ├── container-profiles.json  # Seccomp + capability configs
│   └── hardening.yml            # Security policy definitions
│
├── monitoring/
│   ├── prometheus.yml           # Metrics scraping config
│   └── grafana/
│       ├── dashboards/          # Pre-built monitoring dashboards
│       └── provisioning/        # Auto-provisioning configs
│
├── scripts/
│   ├── setup.sh                 # One-time setup script
│   ├── verify.sh                # Verify Docker + dependencies
│   ├── cleanup.sh               # Remove stopped containers
│   └── challenge-setup.sh       # Build challenge images
│
└── docker-compose.yml           # Multi-container orchestration
```

## Development

### Adding New Challenges

1. **Create challenge directory**:
```bash
mkdir -p challenges/my-challenge
```

2. **Write Dockerfile + vulnerable app**:
```dockerfile
FROM python:3.11-slim
COPY app.py /app/
CMD ["python", "/app/app.py"]
```

3. **Define in challenges.json**:
```json
{
  "id": "my-challenge",
  "name": "My Vulnerable App",
  "description": "Description of vulnerability",
  "difficulty": "beginner",
  "category": "web",
  "points": 100,
  "tags": ["sqli", "web"],
  "container_spec": {
    "image": "dvc/my-challenge:latest",
    "ports": {"5000": null},
    "environment": {"FLAG": "placeholder"},
    "resource_limits": {
      "memory": "256m",
      "cpus": "0.5"
    },
    "security_profile": "challenge"
  }
}
```

4. **Build image**:
```bash
docker build -t dvc/my-challenge:latest challenges/my-challenge/
```

5. **Test locally**:
```bash
# API will auto-generate flag
curl -X POST http://localhost:5000/api/challenges/spawn \
  -H "Content-Type: application/json" \
  -d '{"challenge_id": "my-challenge", "user_id": "test"}'
```

### Running Tests

```bash
# Python API tests
cd api/
pytest tests/

# Frontend tests
cd frontend/
npm test

# Docker security validation
./scripts/verify.sh
```

### Monitoring and Debugging

```bash
# View all container logs
docker-compose logs -f

# View specific service
docker-compose logs -f api
docker-compose logs -f frontend

# Check running challenges
curl http://localhost:5000/api/challenges/running

# View container resource usage
docker stats

# Check Prometheus metrics
curl http://localhost:9090/api/v1/query?query=container_memory_usage_bytes
```

## Configuration

### Environment Variables

Set these in `docker-compose.yml` or `.env`:

```bash
# API Configuration
FLASK_ENV=development            # development or production
SECRET_KEY=your-secret-key       # For HMAC flag generation
DOCKER_HOST=unix:///var/run/docker.sock

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000
NODE_ENV=development

# Session Timeouts
SESSION_TIMEOUT=1800             # 30 minutes in seconds
MAX_CONCURRENT_SESSIONS=5        # Per user

# Monitoring
PROMETHEUS_RETENTION_TIME=15d
GF_SECURITY_ADMIN_PASSWORD=admin
```

### Security Profile Customization

Edit `security/container-profiles.json`:

```json
{
  "challenge": {
    "capDrop": ["ALL"],
    "capAdd": ["CHOWN", "DAC_OVERRIDE"],
    "readOnlyRootfs": true,
    "securityOpts": ["no-new-privileges:true"],
    "user": "1000:1000"
  }
}
```

## Troubleshooting

### Container Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check Docker socket permissions
ls -l /var/run/docker.sock

# View API logs
docker logs dvc-api
```

### API Connection Failed

```bash
# Verify API is running
curl http://localhost:5000/api/health

# Check API container status
docker ps | grep dvc-api

# Check CORS configuration in api/app.py
```

### Challenge Image Not Found

```bash
# Build challenge images
docker build -t dvc/challenge-name:latest challenges/challenge-name/

# OR build all challenges
for dir in challenges/*/; do
  name=$(basename "$dir")
  docker build -t "dvc/$name:latest" "$dir"
done
```

### Frontend Not Loading

```bash
# Check if frontend container is running
docker ps | grep dvc-frontend

# Check frontend logs
docker logs dvc-frontend

# Verify API_URL environment variable
docker exec dvc-frontend env | grep API_URL
```

## Security Considerations

### For Challenge Developers

- **Never expose host filesystem**: Don't mount sensitive directories into challenge containers
- **Network isolation**: Challenges run in isolated bridge networks by default
- **Flag placement**: Embed flags in application code, not environment variables (users can inspect)
- **Resource limits**: Always define memory/CPU limits to prevent resource exhaustion
- **Minimal images**: Use slim base images to reduce attack surface

### For Users

- **Run locally only**: Never expose ports 3000, 3001, 5000, 9090 to the internet
- **Understand vulnerabilities**: Read challenge descriptions before spawning
- **Isolated network**: Challenge containers can't access your host filesystem
- **Auto-cleanup**: Containers auto-stop after timeout, but manually clean up with `docker-compose down`

## Contributing

This is a learning platform. Contributions welcome:

- Add new challenge scenarios
- Improve security profiles
- Enhance monitoring dashboards
- Write documentation
- Report bugs

## License

Educational use only. Not for production security training.

---

**Local-First** • **Privacy-Preserving** • **Production-Ready**
