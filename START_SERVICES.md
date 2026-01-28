# Start Services Commands

## Start Entire Stack with Docker Compose (Recommended)
```bash
cd /home/mark/sec-prac
docker-compose up -d
```

## Stop All Services
```bash
docker-compose down
```

## View Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs api
docker-compose logs frontend
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

## Service Ports
- Frontend: 3001 (avoids conflict with Grafana on 3000)
- API: 5000
- Grafana: 3000
- Prometheus: 9090
- Challenge Containers: Random ports (Docker assigns automatically)

## To Submit Flags
1. Go to http://localhost:3001
2. Click on a challenge to open the detail modal
3. Click "Start Challenge" to spawn the container
4. Once running, use the "Flag Submission" section in the modal
5. For the test challenge: `FLAG{xss_vulnerabilities_are_dangerous_83f2a1}`

## Build Images
If you make changes to the API or frontend code, rebuild:
```bash
docker-compose build
docker-compose up -d
```