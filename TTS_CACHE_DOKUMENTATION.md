# TTS Cache Dokumentation

## Übersicht

Der TTS-Service verfügt über ein vollständig implementiertes Cache-System, das die Leistung erheblich verbessert und Ressourcen spart.

## Wie funktioniert der Cache?

### 1. Cache-Schlüssel Generierung

Wenn ein Text zur Sprachsynthese angefordert wird:
- Der Text wird mit den Parametern (Geschwindigkeit, Modell) kombiniert
- Ein MD5-Hash wird erstellt: `md5(text + rate + model_name)`
- Der Hash wird als Dateiname verwendet: `{hash}.wav`

**Beispiel:**
```
Text: "Willkommen zum Webinar"
Rate: 1.0
Model: tts_models/de/thorsten/tacotron2-DDC

Hash: a7f3e2b9c4d1...
Datei: /app/cache/a7f3e2b9c4d1....wav
```

### 2. Cache-Lookup

Vor jeder Audio-Generierung:
1. System prüft, ob Datei bereits im Cache existiert
2. **Wenn JA**: Datei wird sofort zurückgegeben (< 50ms)
3. **Wenn NEIN**: Audio wird generiert, gespeichert und zurückgegeben

### 3. Cache-Speicherung

- **Location**: Docker Volume `tts-cache` → `/app/cache` im Container
- **Persistenz**: Bleibt auch nach Container-Neustarts erhalten
- **Format**: WAV-Audiodateien
- **Größe**: ~50-200 KB pro Audiodatei (abhängig von Textlänge)

## Performance-Vorteile

### Ohne Cache
```
Anfrage 1: Text "Hallo" → 8 Sekunden (Generierung)
Anfrage 2: Text "Hallo" → 8 Sekunden (Generierung)
Anfrage 3: Text "Hallo" → 8 Sekunden (Generierung)
```

### Mit Cache
```
Anfrage 1: Text "Hallo" → 8 Sekunden (Generierung + Cache)
Anfrage 2: Text "Hallo" → 0.05 Sekunden (aus Cache)
Anfrage 3: Text "Hallo" → 0.05 Sekunden (aus Cache)
```

**Verbesserung**: ~160x schneller bei gecachten Inhalten!

## Praktische Anwendung

### Webinar-Szenario

Ein Webinar mit 5 Folien:
1. **Erste Durchführung**: Alle Texte werden generiert und gecacht (40 Sekunden)
2. **Zweite Durchführung**: Alle Texte kommen aus dem Cache (< 1 Sekunde)
3. **Weitere Durchführungen**: Sofortige Wiedergabe

### Vorteile für Ihr Webinar

- ✅ **Konsistente Qualität**: Gleiche Audio-Datei bei jedem Aufruf
- ✅ **Schnelle Ladezeiten**: Sofortige Wiedergabe für wiederholte Inhalte
- ✅ **Ressourcenschonung**: Keine CPU/GPU-Last bei gecachten Inhalten
- ✅ **Kosteneffizienz**: Weniger Serverressourcen benötigt
- ✅ **Zuverlässigkeit**: Keine Generierungsfehler bei gecachten Inhalten

## Cache-Verwaltung

### Cache-Statistiken abrufen

**API-Endpunkt:**
```bash
GET /api/tts/cache/stats
```

**Beispiel-Antwort:**
```json
{
  "cache_dir": "/app/cache",
  "total_files": 42,
  "total_size_bytes": 12582912,
  "total_size_mb": 12.0,
  "cache_enabled": true
}
```

**Verwendung:**
```bash
curl http://localhost/api/tts/cache/stats
```

### Cache leeren

**API-Endpunkt:**
```bash
POST /api/tts/cache/clear
```

**Beispiel-Antwort:**
```json
{
  "status": "success",
  "deleted_files": 42,
  "message": "Cleared 42 cached audio files"
}
```

**Verwendung:**
```bash
curl -X POST http://localhost/api/tts/cache/clear
```

**Wann Cache leeren?**
- Nach Updates des TTS-Modells
- Bei Speicherplatzproblemen
- Zum Testen neuer Sprachausgabe-Qualität
- Nach Änderungen an der TTS-Konfiguration

## Technische Details

### Konfiguration

**Docker Compose** (`docker-compose.yml`):
```yaml
tts:
  environment:
    - TTS_CACHE_DIR=/app/cache  # Cache-Verzeichnis
  volumes:
    - tts-cache:/app/cache      # Persistentes Volume
```

### Cache-Verzeichnis prüfen

Im Docker-Container:
```bash
# Container betreten
docker exec -it webinar-tts /bin/sh

# Cache-Verzeichnis anzeigen
ls -lh /app/cache

# Cache-Größe prüfen
du -sh /app/cache
```

### Cache-Dateien

Format: `{MD5-Hash}.wav`

Beispiele:
```
/app/cache/a7f3e2b9c4d1e5f6g7h8i9j0k1l2m3n4.wav
/app/cache/b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7.wav
/app/cache/c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8.wav
```

## Überwachung und Wartung

### Empfohlene Praktiken

1. **Regelmäßige Überwachung**
   - Cache-Statistiken wöchentlich prüfen
   - Speicherplatz überwachen
   - Bei > 1 GB Cache-Größe: Überprüfung durchführen

2. **Backup-Strategie**
   - Cache ist wiederherstellbar (kann neu generiert werden)
   - Backup des Cache-Volumes optional
   - Priorität liegt auf Daten- und Konfigurationsbackups

3. **Performance-Optimierung**
   - Cache sollte NICHT regelmäßig geleert werden
   - Größerer Cache = bessere Performance
   - Nur bei Problemen oder Updates leeren

### Häufige Fragen

**Q: Wie groß wird der Cache?**
A: Abhängig von Ihren Webinaren. Typisch: 10-50 MB pro Webinar mit 10 Folien.

**Q: Wird der Cache zu groß?**
A: Bei normalem Gebrauch nein. Ein Webinar mit 100 Folien benötigt ca. 100-500 MB.

**Q: Muss ich den Cache manuell verwalten?**
A: Normalerweise nicht. Das System verwaltet sich selbst.

**Q: Was passiert wenn der Speicher voll ist?**
A: Die TTS-Generierung schlägt fehl. Lösung: Cache leeren oder Speicher erweitern.

**Q: Kann ich den Cache deaktivieren?**
A: Technisch ja, aber **nicht empfohlen**. Performance wäre deutlich schlechter.

## Sicherheit

### Cache-Sicherheit

- ✅ Cache-Dateien enthalten nur Audio, keine sensiblen Daten
- ✅ MD5-Hashes verhindern Dateinamen-Kollisionen
- ✅ Nur TTS-Service hat Schreibzugriff
- ✅ Cache-Volume ist vom Host-System isoliert

### Datenschutz

- ✅ Texte werden nur als Hash gespeichert (Dateiname)
- ✅ Audio-Inhalt entspricht öffentlichem Webinar-Inhalt
- ✅ Keine personenbezogenen Daten im Cache
- ✅ DSGVO-konform bei öffentlichen Webinar-Inhalten

## Zusammenfassung

Der TTS-Cache ist:
- ✅ **Bereits vollständig implementiert**
- ✅ **Automatisch aktiviert**
- ✅ **Hochperformant** (bis zu 160x schneller)
- ✅ **Zuverlässig** (persistentes Docker-Volume)
- ✅ **Einfach zu verwalten** (API-Endpunkte)
- ✅ **Produktionsbereit**

**Keine weitere Aktion erforderlich** - der Cache funktioniert automatisch!

---

**Erstellt**: 12. Februar 2026
**Version**: 1.0
**Status**: Produktiv im Einsatz
