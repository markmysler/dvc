# Base image with security hardening
FROM python:3.11-slim

# Security: Create non-root user
RUN groupadd -r challenge && useradd -r -g challenge challenge

# Security: Update packages and install minimal dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy application files
COPY app.py .
COPY static/ static/
COPY templates/ templates/

# Security: Set proper ownership
RUN chown -R challenge:challenge /app

# Security: Switch to non-root user
USER challenge

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run application
CMD ["python", "app.py"]