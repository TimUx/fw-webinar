# TTS Cache - Visueller Ablauf

## Wie der Cache funktioniert (Schritt für Schritt)

### Szenario: Ein Webinar mit 3 Folien

```
Folie 1: "Willkommen zu unserem Webinar über Cybersecurity"
Folie 2: "Heute lernen Sie wichtige Sicherheitsprinzipien"
Folie 3: "Vielen Dank für Ihre Aufmerksamkeit"
```

---

## 1. Erste Durchführung des Webinars

### Folie 1 - Erste Anfrage

```
┌─────────────────────────────────────────────────────────┐
│ Benutzer startet Webinar                                │
│ Browser fordert Audio an: "Willkommen zu unserem..."    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Backend empfängt Anfrage                                 │
│ POST /api/tts/synthesize                                 │
│ Body: { "text": "Willkommen zu unserem...", "rate": 1.0}│
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ TTS-Service: Cache-Prüfung                              │
│ Cache-Key: md5("Willkommen zu unserem..." + 1.0 + ...)  │
│ Cache-Key = a7f3e2b9c4d1e5f6...                         │
│ Datei: /app/cache/a7f3e2b9c4d1e5f6....wav              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Cache-Status: NICHT GEFUNDEN ❌                          │
│ Datei existiert nicht → Generierung erforderlich        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ TTS-Generierung (Coqui TTS)                             │
│ ⏱️  Dauer: ~8 Sekunden                                   │
│ 🔊 Generiere deutsche Sprachausgabe...                   │
│ 💾 Speichere zu: /app/cache/a7f3e2b9c4d1e5f6....wav     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Audio-Datei zurückgeben                                  │
│ Content-Type: audio/wav                                  │
│ Größe: ~150 KB                                           │
│ ✅ Cache gespeichert                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Browser spielt Audio ab                                  │
│ 🔊 "Willkommen zu unserem Webinar..."                   │
└─────────────────────────────────────────────────────────┘

⏱️  TOTAL: ~8 Sekunden
```

### Folie 2 & 3 - Erste Anfragen

```
Folie 2: ~8 Sekunden (Generierung + Cache)
Folie 3: ~8 Sekunden (Generierung + Cache)

Gesamt für erste Durchführung: ~24 Sekunden
```

---

## 2. Zweite Durchführung des Webinars (gleicher Inhalt)

### Folie 1 - Cache-Treffer!

```
┌─────────────────────────────────────────────────────────┐
│ Benutzer startet Webinar (erneut)                       │
│ Browser fordert Audio an: "Willkommen zu unserem..."    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Backend empfängt Anfrage                                 │
│ POST /api/tts/synthesize                                 │
│ Body: { "text": "Willkommen zu unserem...", "rate": 1.0}│
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ TTS-Service: Cache-Prüfung                              │
│ Cache-Key: md5("Willkommen zu unserem..." + 1.0 + ...)  │
│ Cache-Key = a7f3e2b9c4d1e5f6... (gleich wie vorher!)    │
│ Datei: /app/cache/a7f3e2b9c4d1e5f6....wav              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Cache-Status: GEFUNDEN ✅                                │
│ Datei existiert → Sofortige Rückgabe!                   │
│ ⚡ Keine Generierung nötig!                              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Audio-Datei direkt aus Cache zurückgeben                │
│ Content-Type: audio/wav                                  │
│ Größe: ~150 KB                                           │
│ 💨 Direkt vom Speicher                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Browser spielt Audio ab                                  │
│ 🔊 "Willkommen zu unserem Webinar..."                   │
└─────────────────────────────────────────────────────────┘

⏱️  TOTAL: ~0.05 Sekunden (160x schneller!)
```

### Folie 2 & 3 - Auch gecacht!

```
Folie 2: ~0.05 Sekunden (aus Cache)
Folie 3: ~0.05 Sekunden (aus Cache)

Gesamt für zweite Durchführung: ~0.15 Sekunden
```

---

## Performance-Vergleich

### Grafische Darstellung

```
Erste Durchführung (mit Generierung):
███████████████████████████████████████████████████ 24 Sek.
Folie 1: ████████████████ (8 Sek.)
Folie 2: ████████████████ (8 Sek.)
Folie 3: ████████████████ (8 Sek.)

Zweite Durchführung (aus Cache):
▌ 0.15 Sek.
Folie 1: ▌ (0.05 Sek.)
Folie 2: ▌ (0.05 Sek.)
Folie 3: ▌ (0.05 Sek.)

Verbesserung: 160x schneller! 🚀
```

---

## Cache-Verwaltung

### Cache-Statistiken abrufen

```bash
$ curl http://localhost/api/tts/cache/stats

{
  "cache_dir": "/app/cache",
  "total_files": 3,              # 3 Folien gecacht
  "total_size_bytes": 450000,    # ~450 KB
  "total_size_mb": 0.43,         # 0.43 MB
  "cache_enabled": true
}
```

### Visueller Cache-Status

```
/app/cache/
├── a7f3e2b9c4d1e5f6....wav  [150 KB]  "Willkommen zu unserem..."
├── b8e4f3c5d2g6h7i8....wav  [145 KB]  "Heute lernen Sie..."
└── c9f5g4d3h8i9j0k1....wav  [155 KB]  "Vielen Dank für..."

Gesamt: 3 Dateien, 450 KB
```

---

## Realistische Szenarien

### Szenario 1: Großes Webinar

```
Webinar: "Einführung in Python"
Folien: 20
Durchschnittliche Textlänge: 100 Wörter pro Folie

Erste Durchführung:
- Generierungszeit: 20 Folien × 8 Sek. = 160 Sekunden (2:40 Min.)
- Cache-Größe: ~3 MB

Zweite Durchführung:
- Ladezeit: 20 Folien × 0.05 Sek. = 1 Sekunde
- Verbesserung: 160x schneller

100. Durchführung:
- Immer noch: 1 Sekunde!
- Cache-Größe: Immer noch ~3 MB
```

### Szenario 2: Mehrere Webinare

```
10 verschiedene Webinare:
- Je 10 Folien
- Erste Durchführung jedes Webinars: ~80 Sek.
- Alle weiteren: ~0.5 Sek. pro Webinar

Cache-Größe nach allen ersten Durchführungen:
- 100 gecachte Audiodateien
- ~15 MB Speicherplatz
- Alle weiteren Durchführungen: Sofort verfügbar!
```

---

## Best Practices

### ✅ Empfohlen

1. **Cache nicht leeren**: Lassen Sie den Cache wachsen
2. **Monitoring**: Prüfen Sie monatlich die Cache-Größe
3. **Backup**: Cache kann neu generiert werden, daher kein Backup nötig

### ❌ Nicht empfohlen

1. **Regelmäßiges Leeren**: Verschlechtert Performance
2. **Manuelle Verwaltung**: System verwaltet sich selbst
3. **Cache-Deaktivierung**: Drastischer Performance-Verlust

### ⚠️ Cache leeren nur bei:

- TTS-Modell-Updates
- Änderungen an Webinar-Inhalten (Textkorrekturen)
- Speicherplatz-Problemen (sehr selten)

---

## Zusammenfassung

```
┌────────────────────────────────────────────────────────┐
│                   TTS Cache System                      │
├────────────────────────────────────────────────────────┤
│ Status:          ✅ Vollständig implementiert           │
│ Performance:     🚀 160x schneller (gecacht)            │
│ Speicher:        💾 Persistentes Docker-Volume          │
│ Verwaltung:      🔧 API-Endpunkte verfügbar            │
│ Automatisch:     ⚡ Kein manuelles Eingreifen nötig    │
└────────────────────────────────────────────────────────┘

Der Cache ist produktionsbereit und funktioniert!
```

---

**Erstellt**: 12. Februar 2026
**Typ**: Visuelle Dokumentation
**Zweck**: Verständliche Erklärung des Cache-Systems
