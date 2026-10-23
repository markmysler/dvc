# Challenge Development Guide

This guide explains how to create and add new challenges to the Damn Vulnerable Containers (DVC) platform.

## Table of Contents

- [Quick Start](#quick-start)
- [Challenge Structure](#challenge-structure)
- [Adding Challenges via Import Wizard](#adding-challenges-via-import-wizard)
- [Adding Challenges via Code](#adding-challenges-via-code)
- [Challenge Specification](#challenge-specification)
- [Testing Your Challenge](#testing-your-challenge)
- [Best Practices](#best-practices)

## Quick Start

There are two ways to add challenges to DVC:

1. **Import Wizard (Easiest)**: Use the web interface to upload pre-built challenges
2. **Manual Development**: Create challenges from scratch and add them to the codebase

## Challenge Structure

Every challenge requires:

```
challenge-name/
├── Dockerfile          # Container definition
├── app.py (or app.js)  # Challenge application
├── requirements.txt    # Dependencies (Python)
├── package.json        # Dependencies (Node.js)
├── static/             # Static assets (optional)
├── templates/          # HTML templates (optional)
└── config.json         # Challenge metadata
```

## Adding Challenges via Import Wizard

### Step 1: Prepare Your Challenge

Create a `config.json` file with your challenge metadata:

```json
{
  "name": "My Challenge",
  "id": "my-unique-challenge-id",
  "category": "web",
  "difficulty": "beginner",
  "description": "A brief description of what the challenge teaches",
  "points": 100,
  "tags": ["web", "xss", "injection"],
  "estimated_time": "20-30 minutes",
  "container_spec": {
    "image": "your-org/challenge-name:latest",
    "ports": {
      "5000": null
    },
    "environment": {},
    "resource_limits": {
      "cpus": "0.5",
      "memory": "256m",
      "pids_limit": 128
    },
    "security_profile": "challenge"
  },
  "metadata": {
    "author": "Your Name",
    "version": "1.0",
    "hints": [
      "Hint 1 to help users",
      "Hint 2 for additional guidance"
    ],
    "learning_objectives": [
      "Objective 1",
      "Objective 2"
    ]
  }
}
```

### Step 2: Build Your Docker Image

```bash
# Build the challenge container
docker build -t your-org/challenge-name:latest .

# Test it locally
docker run --rm -p 127.0.0.1:8000:5000 --read-only --tmpfs /tmp --tmpfs /app/runtime:uid=1000,gid=1000 -e CHALLENGE_FLAG="flag{0123456789abcdef}" your-org/challenge-name:latest
```

### Step 2: Build and Test Locally (Optional)

```bash
# Build the challenge container (optional - will be built on-demand if not)
docker build -t your-org/challenge-name:latest .

# Test it locally
docker run --rm -p 127.0.0.1:8000:5000 --read-only --tmpfs /tmp --tmpfs /app/runtime:uid=1000,gid=1000 -e CHALLENGE_FLAG="flag{0123456789abcdef}" your-org/challenge-name:latest
```

### Step 3: Create Challenge Archive

```bash
# Create a zip file with your challenge
cd /path/to/your/challenge
zip -r my-challenge.zip *
```

### Step 4: Import via Web Interface

1. Navigate to the **Import** page in the DVC frontend
2. Click **"Choose File"** and select your `.zip` file
3. Review the validation results
4. Click **"Import Challenge"** to add it to the platform

The import wizard will:
- ✅ Validate your `config.json` structure
- ✅ Check for required fields
- ✅ Verify Docker image availability
- ✅ Test container spawning
- ✅ Add the challenge to the platform

## Adding Challenges via Code

### Step 1: Create Challenge Directory

```bash
cd /path/to/dvc/challenges
mkdir my-challenge
cd my-challenge
```

### Step 2: Create Challenge Application

**Example Flask Application (Python):**

```python
from flask import Flask, render_template, request
import os

app = Flask(__name__)

# Unique per-instance flag, injected by the orchestrator
CHALLENGE_FLAG = os.environ['CHALLENGE_FLAG']

# The root filesystem is read-only; /app/runtime is a writable tmpfs owned by
# the challenge user. Write runtime files (like a flag file) there.
FLAG_PATH = '/app/runtime/flag.txt'
with open(FLAG_PATH, 'w') as f:
    f.write(CHALLENGE_FLAG + '\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/vulnerable')
def vulnerable():
    # Your vulnerable code here
    user_input = request.args.get('input', '')
    return f"<h1>Echo: {user_input}</h1>"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
```

### Step 3: Create Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .
COPY templates/ templates/
COPY static/ static/

# Create challenge user (non-root)
RUN useradd -m -u 1000 challenge && \
    mkdir -p /app/files && \
    chown -R challenge:challenge /app

USER challenge

EXPOSE 5000

CMD ["python", "app.py"]
```

### Step 4: Add to Challenge Definitions

Edit `/path/to/dvc/challenges/definitions/challenges.json`:

```json
{
  "challenges": [
    {
      "id": "my-challenge-id",
      "name": "My Challenge Name",
      "category": "web",
      "difficulty": "beginner",
      "description": "A detailed description of the challenge",
      "points": 150,
      "tags": ["web", "vulnerability-type"],
      "container_spec": {
        "image": "dvc/my-challenge:latest",
        "ports": {
          "5000": null
        },
        "environment": {},
        "resource_limits": {
          "cpus": "0.5",
          "memory": "256m",
          "pids_limit": 128
        },
        "security_profile": "challenge"
      },
      "metadata": {
        "author": "Your Name",
        "created": "2026-01-29",
        "estimated_time": "20-30 minutes",
        "hints": [
          "First hint to guide users",
          "Second hint with more specifics",
          "Final hint pointing to the solution"
        ],
        "learning_objectives": [
          "Understand the vulnerability type",
          "Learn exploitation techniques",
          "Practice secure coding principles"
        ],
        "version": "1.0"
      }
    }
  ],
  "schema_version": "1.0"
}
```

### Step 5: Deploy

```bash
# Restart the API to reload challenge definitions
docker compose restart api

# Verify the challenge appears
curl http://localhost:5000/api/challenges | jq '.challenges[] | select(.id=="my-challenge-id")'

# Note: The Docker image will be built automatically when someone first spawns the challenge
# If you want to pre-build it:
docker build -t dvc/my-challenge:latest .
```

## Challenge Specification

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (lowercase, hyphens only) |
| `name` | string | Display name for the challenge |
| `category` | string | Category: web, crypto, binary, forensics, etc. |
| `difficulty` | string | One of: beginner, intermediate, advanced, expert |
| `description` | string | Clear description of what the challenge teaches |
| `points` | integer | Points awarded for completion (50-500) |
| `tags` | array | Searchable tags for the challenge |
| `container_spec` | object | Container configuration |

### Container Specification

```json
{
  "image": "your-org/challenge:tag",
  "ports": {
    "5000": null  // null = random host port
  },
  "environment": {
    // Environment variables (avoid hardcoded flags!)
  },
  "resource_limits": {
    "cpus": "0.5",
    "memory": "256m",
    "pids_limit": 128
  },
  "security_profile": "challenge"
}
```

### Metadata Fields

```json
{
  "author": "Your Name or Organization",
  "created": "2026-01-29",
  "version": "1.0",
  "estimated_time": "20-30 minutes",
  "hints": [
    "Progressive hints that guide without spoiling"
  ],
  "learning_objectives": [
    "Clear educational goals"
  ],
  "solution_url": "/path/to/solution.md"  // Optional
}
```

## Testing Your Challenge

### Local Testing

```bash
# Start your challenge container
docker run --rm -p 127.0.0.1:8000:5000 \
  --read-only --tmpfs /tmp --tmpfs /app/runtime:uid=1000,gid=1000 \
  -e CHALLENGE_FLAG="flag{$(openssl rand -hex 8)}" \
  dvc/my-challenge:latest

# Test the application (port 8000, since the platform API uses 5000)
curl http://localhost:8000

# End to end through the platform: start it, then submit the flag
curl -X POST http://localhost:5000/api/challenges \
  -H "Content-Type: application/json" \
  -d '{"challenge_id": "my-challenge", "user_id": "test"}'
curl -X POST http://localhost:5000/api/flags \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<session_id from the response above>", "flag": "flag{...}"}'
```

### Validation Checklist

- [ ] Challenge builds without errors
- [ ] Container starts and responds on expected port
- [ ] Flag is dynamically generated (not hardcoded)
- [ ] Resource limits are appropriate
- [ ] Non-root user is configured
- [ ] All dependencies are in requirements.txt/package.json
- [ ] Hints provide progressive guidance
- [ ] Learning objectives are clear
- [ ] Challenge difficulty is appropriate

### Using the Validation Script

```bash
# Validate your challenge configuration
python scripts/validate-challenge.py config.json

# Verbose output
python scripts/validate-challenge.py config.json --verbose

# JSON output for automation
python scripts/validate-challenge.py config.json --json
```

## Best Practices

### Security

1. **Never hardcode flags**: Use environment variables
   ```python
   FLAG = os.environ['CHALLENGE_FLAG']
   ```

2. **Run as non-root user**: Always create and use a non-privileged user
   ```dockerfile
   RUN useradd -m -u 1000 challenge
   USER challenge
   ```

3. **Set resource limits**: Prevent resource exhaustion
   ```json
   "resource_limits": {
     "cpus": "0.5",
     "memory": "256m",
     "pids_limit": 128
   }
   ```

4. **Use security profiles**: Apply appropriate container hardening
   ```json
   "security_profile": "challenge"
   ```

### Flag Management

**Dynamic Flags (Recommended):**
```python
# Flag is passed as environment variable
CHALLENGE_FLAG = os.environ.get('CHALLENGE_FLAG')

# Write to the writable runtime tmpfs for file-based challenges
with open('/app/runtime/flag.txt', 'w') as f:
    f.write(CHALLENGE_FLAG + '\n')
```

**Flag Format:**
- Flags are generated by the platform, never chosen by the challenge
- Format: `flag{16 hex characters}`, e.g. `flag{3f9a1c0b7d2e4a68}`
- The validator rejects anything else

### Educational Value

1. **Progressive Hints**: Start broad, get more specific
   - Hint 1: Point to the vulnerability area
   - Hint 2: Explain the vulnerability type
   - Hint 3: Provide exploitation technique

2. **Clear Learning Objectives**: Define what users will learn
   - Specific vulnerability understanding
   - Exploitation techniques
   - Secure coding practices

3. **Appropriate Difficulty**: 
   - **Beginner**: Obvious vulnerabilities, clear hints
   - **Intermediate**: Require some research, multiple steps
   - **Advanced**: Complex vulnerabilities, minimal hints
   - **Expert**: Realistic scenarios, CTF-level complexity

### Performance

1. **Keep images small**: Use slim base images
   ```dockerfile
   FROM python:3.11-slim
   ```

2. **Minimize dependencies**: Only include what's needed
   ```txt
   # requirements.txt
   flask==3.0.0
   # Don't install unnecessary packages
   ```

3. **Fast startup**: Challenges should start in < 5 seconds

## Examples

### Path Traversal Challenge

See `challenges/path-traversal-challenge/` for:
- File inclusion vulnerability
- Dynamic flag in writable location
- Multi-step exploitation

## Troubleshooting

### Challenge Won't Start

```bash
# Check Docker logs
docker logs <container_id>

# Test image locally
docker run -it your-org/challenge:latest /bin/sh

# Verify port mapping
docker ps
```

### Flag Not Validating

```bash
# Check session manager
docker exec dvc-api python -c "
from engine.session_manager import get_session_manager
sm = get_session_manager()
print(sm._sessions)
"

# Verify flag environment variable
docker exec <container_id> env | grep FLAG
```

### Import Validation Fails

```bash
# Run validation script
python scripts/validate-challenge.py /path/to/config.json --verbose

# Check JSON syntax
cat config.json | jq .

# Verify all required fields
python scripts/validate-challenge.py config.json --json | jq .errors
```

## Resources

- **Challenge Template**: `challenges/path-traversal-challenge/`
- **Validation Script**: `/scripts/validate-challenge.py`
- **Import API**: `POST /api/import/challenge`
- **Security Profiles**: `/security/container-profiles.json`

## Support

For questions or issues:
1. Check existing challenges for examples
2. Review validation script output
3. Test locally before importing
4. Consult the API documentation

Happy challenge building! 🚀
