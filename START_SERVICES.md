# DVC Platform - Service Management Guide

This guide explains how to start, stop, and manage the DVC platform services.

## Quick Start

The recommended way to start DVC is using the startup script:

```bash
# Start in LITE mode (API + Frontend only)
./start.sh

# Start in FULL mode (includes monitoring)
./start.sh --monitor
# or
./start.sh -m
```

The startup script automatically:
- ✅ Validates dependencies (Docker, Docker Compose)
- ✅ Performs first-time setup (builds images, creates directories)
- ✅ Starts containers with proper configuration
- ✅ Runs health checks

## Service Modes

### LITE Mode (Default)

Starts only core services for a lightweight development experience:

```bash
./start.sh
```

**Services Started:**
- 🔹 API (Flask) - Port 5000
- 🔹 Frontend (Next.js) - Port 3000

**Access Points:**
- Challenge Browser: http://localhost:3000
- API Health: http://localhost:5000/health

**Use When:**
- Developing challenges
- Testing the platform
- Limited system resources
- Don't need observability

### FULL Mode (With Monitoring)

Starts all services including monitoring stack:

```bash
./start.sh --monitor
```

**Services Started:**
- 🔹 API (Flask) - Port 5000
- 🔹 Frontend (Next.js) - Port 3000
- 📊 Prometheus - Port 9090
- 📈 Grafana - Port 3001
- 📉 Node Exporter - Port 9100

**Access Points:**
- Challenge Browser: http://localhost:3000
- API Health: http://localhost:5000/health
- Grafana Dashboards: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090

**Use When:**
- Monitoring container metrics
- Analyzing resource usage
- Debugging performance issues
- Production-like environment

## Manual Control with Docker Compose

### Start Services

```bash
# Start only core services (LITE mode)
docker compose up -d api frontend

# Start everything (FULL mode)
docker compose up -d

# Start in foreground (see logs)
docker compose up api frontend
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (CAUTION: deletes data)
docker compose down -v

# Stop specific service
docker compose stop api
docker compose stop prometheus
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart api
docker compose restart frontend
```

## Service Status and Logs

### Check Running Services

```bash
# View all running containers
docker compose ps

# View with resource usage
docker stats

# Check specific service health
curl http://localhost:5000/health        # API
curl http://localhost:3000               # Frontend
curl http://localhost:9090/-/healthy     # Prometheus (if running)
```

### View Logs

```bash
# View all logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# View specific service logs
docker compose logs api
docker compose logs frontend
docker compose logs prometheus
docker compose logs grafana

# Follow specific service
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api
```

## Troubleshooting

### Services Won't Start

```bash
# Check if ports are already in use
sudo netstat -tulpn | grep -E '3000|5000|9090|3001'

# Kill processes using those ports
sudo kill -9 $(sudo lsof -t -i:5000)
sudo kill -9 $(sudo lsof -t -i:3000)

# Check Docker daemon is running
docker info

# Verify Docker Compose version
docker compose version
```

### Monitoring Stack Not Available

If you started in LITE mode but want monitoring:

```bash
# Stop current services
docker compose down

# Restart with monitoring
./start.sh --monitor
```

### Permission Issues

```bash
# Fix monitoring data directory permissions
sudo chown -R $USER:$USER monitoring/data

# Fix logs directory
sudo chown -R $USER:$USER logs
```

### Container Build Failures

```bash
# Rebuild images
docker compose build --no-cache

# Rebuild specific service
docker compose build --no-cache api

# Check for build errors
docker compose build api 2>&1 | tee build.log
```

## Manual Start (Alternative)

### Start API Server
```bash
cd /home/mark/sec-prac
python api/app.py
```

### Start Frontend Development Server
```bash
cd /home/mark/sec-prac/frontend
npm run dev
```

## Access URLs
- **Frontend Dashboard**: http://localhost:3001
- **API**: http://localhost:5000
- **API Health**: http://localhost:5000/api/health
- **Grafana Monitoring**: http://localhost:3000
- **Prometheus**: http://localhost:9090

## Service Ports Reference

| Service | Port | Mode | Description |
|---------|------|------|-------------|
| Frontend | 3000 | All | Next.js web interface |
| API | 5000 | All | Flask REST API |
| Grafana | 3001 | FULL | Monitoring dashboards |
| Prometheus | 9090 | FULL | Metrics collection |
| Node Exporter | 9100 | FULL | System metrics |
| Challenges | Random | All | Docker assigns automatically |

## Health Check Commands

```bash
# Check monitoring stack health (requires FULL mode)
./scripts/monitoring-health.sh

# Quick status check
./scripts/monitoring-health.sh status

# Comprehensive report
./scripts/monitoring-health.sh full
```

**Note:** The monitoring health script will gracefully exit if monitoring services aren't running.

## First-Time Setup

The startup script handles first-time setup automatically:

```bash
# Validate environment
./scripts/verify.sh

# Create required directories
mkdir -p logs monitoring/data/{prometheus,grafana} tmp/imported
```

**Challenge Images:** Challenge Docker images are built automatically on-demand when a user first attempts to spawn them. This keeps startup fast and scales to hundreds of challenges without requiring all images to be pre-built.

**Pre-building Challenges (Optional):**
```bash
# If you want to pre-build specific challenges:
cd challenges/my-challenge
docker build -t dvc/my-challenge:latest .

# Or build all challenges at once:
./scripts/challenge-setup.sh
```

## Environment Variables

Create a `.env` file to customize configuration:

```bash
# API Configuration
API_PORT=5000
SECRET_KEY=your-secret-key-here

# Frontend Configuration
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:5000

# Monitoring (FULL mode only)
GRAFANA_ADMIN_PASSWORD=admin
PROMETHEUS_RETENTION_TIME=15d
```

## Resource Management

### Container Cleanup

```bash
# Remove stopped challenge containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove all unused resources
docker system prune -a -f --volumes
```

### Monitor Resource Usage

```bash
# Real-time container stats
docker stats

# Check disk usage
docker system df

# View challenge container resources
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Additional Resources

- **Challenge Development**: See [CHALLENGE_DEVELOPMENT.md](CHALLENGE_DEVELOPMENT.md)
- **Import Wizard Guide**: Visit http://localhost:3000/import and click "Guide" tab
- **Project README**: See [README.md](README.md) for architecture details
- **Verification**: Run `./scripts/verify.sh` to validate setup

## Quick Reference

```bash
# Start platform
./start.sh                    # LITE mode (core services)
./start.sh --monitor         # FULL mode (with monitoring)

# Stop platform
docker compose down

# View status
docker compose ps

# View logs
docker compose logs -f

# Restart service
docker compose restart api

# Health checks
curl http://localhost:5000/health
curl http://localhost:3000

# Monitoring health (FULL mode)
./scripts/monitoring-health.sh
```
