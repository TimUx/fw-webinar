# Piper TTS Integration

Diese Webinar-Plattform verwendet **Piper TTS** für hochwertige deutsche Sprachausgabe.

## Was ist Piper TTS?

Piper ist ein schnelles, lokales neuronales Text-to-Speech-System, das ONNX-Modelle verwendet. Es bietet:

- ✅ **Schnell** - Optimiert für schnelle Sprachsynthese
- ✅ **Lokal** - Keine externen API-Aufrufe erforderlich
- ✅ **Hochwertig** - Natürlich klingende Stimmen
- ✅ **Offline** - Funktioniert ohne Internetverbindung
- ✅ **Open Source** - Vollständig quelloffen

## Deutsche Stimme: Thorsten

Die Plattform verwendet die deutsche **Thorsten-Stimme**, die in zwei Qualitätsstufen verfügbar ist:

1. **Medium** (Standard) - Gute Balance zwischen Qualität und Geschwindigkeit
2. **High** - Höchste Qualität, etwas langsamer

Die Stimme wird beim Build des Docker-Containers automatisch heruntergeladen.

## Architektur

```
┌─────────────────┐
│  Frontend       │
│  (Browser)      │
└────────┬────────┘
         │ HTTP/JSON
         ▼
┌─────────────────┐
│  Node.js        │
│  Backend        │
└────────┬────────┘
         │ HTTP/JSON
         ▼
┌─────────────────┐
│  Piper TTS      │
│  Service        │
│  (Python/Flask) │
└─────────────────┘
```

## Technische Details

### TTS Service

Der TTS-Service läuft als separater Container und bietet folgende Endpunkte:

- `POST /synthesize` - Synthetisiert Text zu Sprache
- `GET /health` - Health Check
- `GET /cache/stats` - Cache-Statistiken
- `POST /cache/clear` - Cache leeren

### Caching

Alle generierten Audio-Dateien werden gecacht, um:

- Die Performance zu verbessern
- Die Serverlast zu reduzieren
- Schnellere Wiederholungen zu ermöglichen

### Konfiguration

Die TTS-Konfiguration erfolgt über Umgebungsvariablen in `docker-compose.yml`:

```yaml
environment:
  - PORT=5000
  - TTS_CACHE_DIR=/app/cache
  - MODELS_DIR=/app/models
  - TTS_QUALITY=medium  # 'medium' oder 'high'
```

## API-Nutzung

### Text synthetisieren

```javascript
// Request
POST /api/tts/synthesize
Content-Type: application/json

{
  "text": "Hallo, willkommen zum Webinar",
  "quality": "medium"  // Optional: 'medium' oder 'high'
}

// Response
audio/wav (Binary Audio Data)
```

### Health Check

```javascript
// Request
GET /api/tts/health

// Response
{
  "status": "ok",
  "engine": "piper",
  "quality": "medium",
  "piper_installed": true,
  "sprache": "de",
  "voice": "thorsten"
}
```

## Frontend-Integration

Die Frontend-Integration erfolgt über die `PiperTTSService` Klasse:

```javascript
// Initialisierung
const ttsService = new PiperTTSService('/api');

// Text synthetisieren
const audioBlob = await ttsService.synthesize('Hallo Welt', 'medium');

// Chunks nacheinander abspielen
await ttsService.speakChunks(
  ['Erster Satz.', 'Zweiter Satz.'],
  'medium',
  onComplete,
  onError
);
```

## Modelle

Die folgenden Modelle werden beim Build heruntergeladen:

| Modell | Qualität | Geschwindigkeit | Größe |
|--------|----------|-----------------|-------|
| de_DE-thorsten-medium.onnx | Gut | Schnell | ~60 MB |
| de_DE-thorsten-high.onnx | Sehr gut | Moderat | ~80 MB |

## Vorteile gegenüber Coqui TTS

Piper TTS bietet mehrere Vorteile:

1. **Schnellere Synthese** - Optimiert für Geschwindigkeit
2. **Kleinere Modelle** - Weniger Speicherplatz erforderlich
3. **Geringerer RAM-Bedarf** - Keine GPU erforderlich
4. **Einfachere Installation** - Keine PyTorch-Abhängigkeit
5. **Bessere Wartbarkeit** - Aktiv gepflegtes Projekt

## Migration von Coqui TTS

Die Migration von Coqui TTS zu Piper TTS umfasste:

1. **TTS Service**: Vollständige Neuimplementierung mit Piper
2. **Dockerfile**: Angepasst für Piper-Installation und Modell-Download
3. **API**: Kompatible API-Schnittstelle beibehalten
4. **Frontend**: Umbenennung von `CoquiTTSService` zu `PiperTTSService`
5. **Qualitätsparameter**: `rate` (Geschwindigkeit) ersetzt durch `quality` (Qualitätsstufe)

## Troubleshooting

### TTS Service startet nicht

- Prüfen Sie die Container-Logs: `docker logs webinar-tts`
- Stellen Sie sicher, dass ausreichend Speicherplatz verfügbar ist
- Überprüfen Sie, ob die Modelle korrekt heruntergeladen wurden

### Schlechte Audioqualität

- Verwenden Sie `quality: "high"` für bessere Qualität
- Prüfen Sie, ob die richtigen Modelle installiert sind

### Cache-Probleme

- Leeren Sie den Cache über die Admin-Oberfläche
- Oder manuell: `docker exec webinar-tts rm -rf /app/cache/*`

## Links

- [Piper TTS Repository](https://github.com/rhasspy/piper)
- [Piper Voices](https://huggingface.co/rhasspy/piper-voices)
- [Thorsten Voice Info](https://www.thorsten-voice.de/)
