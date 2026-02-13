# Piper TTS Models

This document explains how the TTS service handles voice models and how to manually provide them if needed.

## Automatic Model Download

The TTS service will automatically attempt to download the required German voice models on first startup:
- **de_DE-thorsten-medium** (required)
- **de_DE-thorsten-high** (optional, for better quality)

Models are downloaded from the official Piper voices repository and stored in `/app/models` (which is persisted in a Docker volume).

## Manual Model Download

If automatic download fails (e.g., due to firewall restrictions or no internet access), you can manually download and provide the models.

### Option 1: Download using piper command line

```bash
# Enter the TTS container
docker exec -it webinar-tts bash

# Download medium quality model (required)
python3 -c "from piper.download import ensure_voice_exists, get_voices; voices=get_voices('/app/models'); ensure_voice_exists('de_DE-thorsten-medium', ['/app/models'], '/app/models', voices)"

# Download high quality model (optional)
python3 -c "from piper.download import ensure_voice_exists, get_voices; voices=get_voices('/app/models'); ensure_voice_exists('de_DE-thorsten-high', ['/app/models'], '/app/models', voices)"
```

### Option 2: Download from HuggingFace directly

If you have access to HuggingFace from your host machine, you can download the models and place them in the volume:

```bash
# Find the volume location
docker volume inspect fw-webinar_tts-models

# Download models to that location
cd <volume-mountpoint>

# Medium quality model (required)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json

# High quality model (optional)
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json
```

### Option 3: Use a local directory mount

Instead of using a Docker volume, you can mount a local directory with pre-downloaded models:

1. Download models to a local directory (e.g., `./tts-models`)
2. Update `docker-compose.yml`:

```yaml
services:
  tts:
    volumes:
      - tts-cache:/app/cache
      - ./tts-models:/app/models  # Use local directory instead of volume
```

## Verifying Models

After providing models, restart the TTS service:

```bash
docker restart webinar-tts
```

Check the logs to verify models are loaded:

```bash
docker logs webinar-tts
```

You should see: `✓ Piper TTS models are available`

## Available German Voices

The following German voices are available from Piper:

- **thorsten** (recommended) - Natural-sounding German male voice
  - medium quality: ~63 MB
  - high quality: ~103 MB

- Other available voices: eva_k, karlsson, kerstin, mls, pavoque, ramona, thorsten_emotional

To use a different voice, update the model names in the download commands above.

## Troubleshooting

### Service returns 503 errors

This means models are not available. Check:
1. Container logs: `docker logs webinar-tts`
2. Models directory: `docker exec webinar-tts ls -la /app/models`
3. Try manual download as described above

### Models fail to download automatically

Common causes:
- No internet access from container
- HuggingFace is blocked by firewall
- Network connectivity issues

Solution: Use manual download options described above.

### Audio synthesis fails

Check that both .onnx and .onnx.json files are present for the model.

Required files for medium quality:
- `/app/models/de_DE-thorsten-medium.onnx`
- `/app/models/de_DE-thorsten-medium.onnx.json`
