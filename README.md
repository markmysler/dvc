# Damn Vulnerable Containers

A local web portal for browsing and practicing security challenges in containerized environments. Users can discover challenges like a streaming service, spawn vulnerable containers on-demand, exploit vulnerabilities to find flags, and track their progress - all running locally without user management.

## Core Value

Users can safely practice real vulnerability exploitation on isolated, disposable containers with auto-generated flags and clean reset between attempts.

## Local-Only Architecture

This platform operates entirely on your local machine without any external dependencies or cloud services:

- **Container Runtime**: Podman for secure, rootless container operations
- **Orchestration**: Local docker-compose.yml files for service coordination
- **Monitoring**: Prometheus + Grafana stack for container and system metrics
- **Storage**: File-based persistence using local JSON and SQLite
- **Security**: Complete isolation between challenges and host system

All challenge containers are ephemeral and automatically cleaned up after use. No data leaves your machine.

## Quick Start

1. **Setup the platform:**
   ```bash
   npm run setup
   ```
   This installs Podman, sets up monitoring infrastructure, and verifies multi-architecture support.

2. **Start the platform:**
   ```bash
   npm start
   ```
   Launches the monitoring stack and core services.

3. **Access monitoring:**
   ```bash
   npm run monitor
   ```
   Displays URLs for Grafana (dashboards) and Prometheus (metrics).

4. **Verify installation:**
   ```bash
   npm run verify
   ```
   Runs comprehensive checks on container isolation, security, and functionality.

## Architecture Overview

```
Local Machine
├── Podman (Container Runtime)
│   ├── Challenge Containers (ephemeral)
│   ├── Monitoring Stack (persistent)
│   └── Network Isolation (rootless)
├── Monitoring
│   ├── Prometheus (metrics collection)
│   └── Grafana (visualization)
├── Storage
│   ├── Challenge State (JSON files)
│   ├── Container Configs (docker-compose)
│   └── Security Profiles (seccomp, capabilities)
└── Scripts
    ├── Automated Setup
    ├── Resource Cleanup
    └── Health Verification
```

## Key Features

- **🔒 Security-First**: Rootless containers with dropped capabilities and read-only filesystems
- **🏗️ Multi-Architecture**: Supports both ARM64 and x64 container architectures
- **📊 Monitoring**: Built-in Prometheus/Grafana stack for operational visibility
- **🧹 Auto-Cleanup**: Automated resource management prevents system bloat
- **⚡ Local-Only**: Zero external dependencies, complete privacy

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **Operating System**: Linux (Ubuntu, Fedora, RHEL, Debian)
- **Architecture**: x64 or ARM64
- **Disk Space**: 2GB minimum for container images and monitoring data

The setup script will automatically install Podman if not present on supported systems.

## Development

For platform development and customization:

```bash
# View container status
npm run status

# View logs from all services
npm run logs

# Clean up unused resources
npm run cleanup

# Stop all services
npm run stop

# Restart services
npm run restart
```

## Challenge Management

The challenge engine provides secure container orchestration for spawning and managing cybersecurity practice environments.

### Setup Challenge Engine

```bash
# Complete setup with dependency installation
./scripts/challenge-setup.sh

# Test orchestrator functionality only
./scripts/challenge-setup.sh test

# Build challenge images only
./scripts/challenge-setup.sh build

# Validate configuration only
./scripts/challenge-setup.sh validate
```

### Challenge Operations

```bash
# List available challenges
python3 -m engine.orchestrator list-challenges

# Spawn a challenge for practice
python3 -m engine.orchestrator spawn <challenge-id> <user-id>

# List currently running challenges
python3 -m engine.orchestrator list-running

# Clean up expired challenge containers
python3 -m engine.orchestrator cleanup
```

### Challenge Development

```bash
# Build all challenge images
npm run challenge:build

# Validate challenge definitions
npm run challenge:validate

# Test challenge container security
npm run challenge:security-test
```

## Security Note

This platform is designed for educational cybersecurity practice. All vulnerabilities are contained within disposable containers that cannot access your host system. However, always review challenge descriptions and ensure you understand what you're running.

---

**Local Development Tool** | **No User Management** | **Complete Privacy**