# Coqui TTS Service

This service provides high-quality text-to-speech synthesis using [Coqui AI TTS](https://github.com/coqui-ai/TTS) (Open Source).

## Features

- German language support using the Thorsten-DDC model
- Audio caching to avoid regenerating the same text
- REST API for easy integration
- Docker containerized for easy deployment

## API Endpoints

### Health Check
```
GET /health
```

Returns the health status of the TTS service.

**Response:**
```json
{
  "status": "ok",
  "model": "tts_models/de/thorsten/tacotron2-DDC",
  "tts_loaded": true
}
```

### Synthesize Speech
```
POST /synthesize
```

Converts text to speech and returns a WAV audio file.

**Request Body:**
```json
{
  "text": "Text to synthesize",
  "rate": 1.0
}
```

- `text` (required): The text to convert to speech
- `rate` (optional): Speech rate multiplier (default: 1.0)

**Response:**
- Content-Type: `audio/wav`
- Body: WAV audio file

### List Models
```
GET /list-models
```

Lists all available TTS models (for informational purposes).

## Environment Variables

- `PORT`: Port to run the service on (default: 5000)
- `TTS_CACHE_DIR`: Directory to store cached audio files (default: /app/cache)
- `TTS_MODEL`: TTS model to use (default: tts_models/de/thorsten/tacotron2-DDC)

## Docker Usage

The service is automatically started with docker-compose. To start it manually:

```bash
docker build -t tts-service ./tts-service
docker run -p 5000:5000 -v tts-cache:/app/cache tts-service
```

## Caching

The service caches generated audio files based on a hash of the text and parameters. This significantly improves performance and reduces computation for repeated requests.

## Model Information

The default model is **Thorsten-DDC**, a high-quality German TTS model trained on the Thorsten dataset. It provides natural-sounding German speech synthesis.

## Performance Notes

- First request may be slow as the model needs to load
- Subsequent requests are faster thanks to caching
- GPU support is automatic if CUDA is available
- CPU-only mode works but is slower

## Security

This service uses secure, up-to-date dependencies:
- **PyTorch**: Version ≥2.6.0 to address known security vulnerabilities
  - CVE fixes: heap buffer overflow, use-after-free, RCE via torch.load
- **Flask**: Latest stable version
- Regular security updates are recommended

**Important**: Never load untrusted model files or pickle data. The TTS service only uses official Coqui TTS models.

## License

This service uses Coqui TTS which is licensed under MPL 2.0.
