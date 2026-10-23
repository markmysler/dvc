FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .

# Public files served by the app. The flag is written at runtime to
# /app/runtime/flag.txt (a tmpfs; the root filesystem is read-only).
RUN mkdir -p /app/files /app/runtime && \
    echo 'This is a public document.' > /app/files/document1.txt && \
    echo 'Another safe file.' > /app/files/document2.txt && \
    printf '%s\n' '# File Server' 'Download files from the list below.' > /app/files/README.md

# Create a non-root user
RUN useradd -m -u 1000 challenge && \
    chown -R challenge:challenge /app

USER challenge

EXPOSE 5000

CMD ["python", "app.py"]
