# DVC Platform - Quick Reference Guide

## 🚀 Getting Started

### First Time Setup
```bash
git clone https://github.com/markmysler/dvc.git
cd dvc
./start.sh
```

This will:
1. Validate dependencies
2. Create required directories
3. Start the platform
4. Run health checks

**Note:** Challenge images are built automatically when you first spawn them.

### Access Points
- **Platform**: http://localhost:3000
- **API**: http://localhost:5000
- **Monitoring** (with --monitor): http://localhost:3001

## 📋 Common Commands

### Starting the Platform

```bash
# Basic mode (API + Frontend only)
./start.sh

# Full mode (includes Grafana + Prometheus)
./start.sh --monitor
```

### Managing Services

```bash
# Stop all services
docker compose down

# View running services
docker compose ps

# View logs
docker compose logs -f

# Restart a service
docker compose restart api
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Platform architecture and overview |
| [START_SERVICES.md](START_SERVICES.md) | Detailed service management guide |
| [CHALLENGE_DEVELOPMENT.md](CHALLENGE_DEVELOPMENT.md) | How to create challenges |
| Import Guide | Web-based guide at http://localhost:3000/import |

## 🎯 Adding Challenges

### Via Web Interface (Easiest)
1. Go to http://localhost:3000/import
2. Click "Guide" tab for instructions
3. Upload ZIP file with challenge

### Via Code
1. Read [CHALLENGE_DEVELOPMENT.md](CHALLENGE_DEVELOPMENT.md)
2. Create challenge in `challenges/` directory
3. Add to `challenges/definitions/challenges.json`
4. Build Docker image
5. Restart API

## 🔧 Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker info

# Check ports aren't in use
sudo netstat -tulpn | grep -E '3000|5000'

# View detailed errors
docker compose up
```

### Monitoring not available
```bash
# Make sure you started with monitoring
./start.sh --monitor

# Check monitoring health
./scripts/monitoring-health.sh
```

### Challenge won't spawn
```bash
# Check API logs
docker compose logs api

# Verify challenge image exists
docker images | grep challenge

# Test challenge locally
docker run -p 5000:5000 -e CHALLENGE_FLAG="test" <image>
```

## 🛠️ Development Workflow

### Making Changes

```bash
# Edit code
# ...

# Rebuild and restart
docker compose build <service>
docker compose restart <service>

# View logs
docker compose logs -f <service>
```

### Testing Changes

```bash
# Validate challenge
python scripts/validate-challenge.py config.json

# Run verification
./scripts/verify.sh

# Check for errors
docker compose logs api | grep ERROR
```

## 📊 Monitoring

### Resource Usage
```bash
# View container stats
docker stats

# Check disk usage
docker system df
```

### Health Checks
```bash
# API health
curl http://localhost:5000/health

# Monitoring health (requires --monitor)
./scripts/monitoring-health.sh status
```

## 🧹 Cleanup

```bash
# Stop and remove containers
docker compose down

# Remove volumes (CAUTION: deletes data)
docker compose down -v

# Clean up stopped containers
docker container prune -f

# Full cleanup
docker system prune -a -f --volumes
```

## 🎓 Learning Resources

### For Users
1. Browse challenges at http://localhost:3000
2. Filter by difficulty: beginner → intermediate → advanced → expert
3. Read hints in challenge details
4. Submit flags after exploitation

### For Developers
1. Read [CHALLENGE_DEVELOPMENT.md](CHALLENGE_DEVELOPMENT.md)
2. Check built-in challenges for examples:
   - `challenges/web-basic-xss/` - Simple XSS challenge
   - `challenges/path-traversal-challenge/` - Path traversal
3. Use validation script: `python scripts/validate-challenge.py`
4. Test locally before importing

## ⚡ Performance Tips

### Lite Mode (Default)
- Uses minimal resources
- Perfect for development
- Faster startup time

### Full Mode (--monitor)
- Uses more resources
- Provides observability
- Better for production-like testing

## 🔐 Security Notes

- Platform runs locally only
- Challenges are isolated
- Don't expose ports to internet
- Review security profiles in `security/`

## 📞 Support

### Check Logs
```bash
# All services
docker compose logs

# Specific service
docker compose logs <service>

# Follow in real-time
docker compose logs -f
```

### Common Issues
1. Port conflicts → Check with `netstat`
2. Docker not running → Start Docker daemon
3. Permission errors → Check file ownership
4. Build failures → Try `docker compose build --no-cache`

## 🎯 Quick Tips

- Use `./start.sh` for easy startup
- Check `docker compose ps` for service status
- View logs with `docker compose logs -f`
- Stop with `docker compose down`
- Monitoring is optional (use --monitor when needed)
- Import challenges via web at /import
- Read guides before developing challenges

---

**Need more details?** Check the full documentation in README.md and other guide files.
