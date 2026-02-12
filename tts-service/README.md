# Coqui TTS Service

This service provides high-quality text-to-speech synthesis using [Coqui AI TTS](https://github.com/coqui-ai/TTS) (Open Source).

## Features

- **German language support** using the Thorsten-DDC model (primary language)
- Audio caching to avoid regenerating the same text
- REST API for easy integration
- Docker containerized for easy deployment
- German API responses and error messages

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
  "modell": "tts_models/de/thorsten/tacotron2-DDC",
  "tts_geladen": true,
  "sprache": "de"
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

**Error Responses:**
```json
{
  "error": "TTS-Modell nicht geladen"
}
```
```json
{
  "error": "Erforderliches Feld fehlt: text"
}
```
```json
{
  "error": "Text darf nicht leer sein"
}
```
```json
{
  "error": "Sprachsynthese fehlgeschlagen: {details}"
}
```

### List Models
```
GET /list-models
```

Lists all available TTS models (for informational purposes).

### Cache Statistics
```
GET /cache/stats
```

Returns information about the TTS cache.

**Response:**
```json
{
  "cache_verzeichnis": "/app/cache",
  "anzahl_dateien": 42,
  "groesse_bytes": 12582912,
  "groesse_mb": 12.0,
  "cache_aktiviert": true
}
```

### Clear Cache
```
POST /cache/clear
```

Clears all cached audio files.

**Response:**
```json
{
  "status": "erfolg",
  "geloeschte_dateien": 42,
  "nachricht": "42 gecachte Audiodateien gelöscht"
}
```

## Environment Variables

- `PORT`: Port to run the service on (default: 5000)
- `TTS_CACHE_DIR`: Directory to store cached audio files (default: /app/cache)
- `TTS_MODEL`: TTS model to use (default: tts_models/de/thorsten/tacotron2-DDC)

## Language Configuration

**Primary Language**: German (de)

The TTS service is configured for German language by default:
- **Model**: Thorsten-DDC (German TTS model)
- **Language Code**: `de`
- **Locale**: `de-DE`
- **API Responses**: German field names and error messages
- **Voice Quality**: Optimized for German pronunciation

### Supported German Text Features:
- Standard German characters (ä, ö, ü, ß)
- German punctuation and sentence structure
- Numbers spoken in German
- Common German abbreviations

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
