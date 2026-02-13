FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create directories for models and cache
RUN mkdir -p /app/models /app/cache

# Copy requirements and install Python dependencies (including piper-tts)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]