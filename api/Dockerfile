FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API source code
COPY . .

# Expose port
EXPOSE 5000

# Run the API under gunicorn (no Werkzeug debugger).
# One worker: sessions live in process memory. Threads handle concurrency, and
# the long timeout covers on-demand challenge image builds on first spawn.
CMD ["gunicorn", "--workers", "1", "--threads", "8", "--timeout", "300", \
     "--bind", "0.0.0.0:5000", "--access-logfile", "-", "app:app"]