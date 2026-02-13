FROM python:3.10-slim

WORKDIR /app

# Install system dependencies and Piper TTS
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download and install Piper TTS binary
RUN wget -O piper.tar.gz https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz \
    && tar -xzf piper.tar.gz \
    && mv piper/piper /usr/local/bin/ \
    && chmod +x /usr/local/bin/piper \
    && rm -rf piper.tar.gz piper

# Create directories for models and cache
RUN mkdir -p /app/models /app/cache

# Download German Thorsten voice models (medium and high quality)
# Medium quality model
RUN wget -O /app/models/de_DE-thorsten-medium.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx \
    && wget -O /app/models/de_DE-thorsten-medium.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json

# High quality model
RUN wget -O /app/models/de_DE-thorsten-high.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx \
    && wget -O /app/models/de_DE-thorsten-high.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]