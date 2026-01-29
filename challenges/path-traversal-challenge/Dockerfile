FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .

# Note: Flag is written by the app at startup from CHALLENGE_FLAG env var
# This ensures each instance gets a unique, verifiable flag
# Flag will be written to /app/flag.txt (owned by challenge user)

# Create files directory
RUN mkdir -p /app/files

# Create a non-root user
RUN useradd -m -u 1000 challenge && \
    chown -R challenge:challenge /app

USER challenge

EXPOSE 5000

CMD ["python", "app.py"]
