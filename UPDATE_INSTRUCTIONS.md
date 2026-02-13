# Update-Anleitung - Behebung von Cache-Problemen

## Problem
Nach einem `git pull` werden Änderungen nicht angezeigt, weil:
1. Docker-Container verwenden alten Code aus dem Image
2. Browser cached JavaScript- und CSS-Dateien
3. Alte hochgeladene Dateien behalten ihre timestamp-basierten Namen

## Lösung

### 1. Docker-Container neu bauen

```bash
# Container stoppen
docker compose down

# Code aktualisieren (falls noch nicht geschehen)
git pull

# Container mit neuem Code bauen und starten
docker compose up -d --build
```

Falls Probleme auftreten, verwenden Sie einen vollständigen Neustart:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 2. Browser-Cache leeren

**Variante A - Harter Reload:**
- **Chrome/Firefox (Windows/Linux)**: `Strg + Shift + R` oder `Strg + F5`
- **Chrome/Firefox (Mac)**: `Cmd + Shift + R`
- **Safari**: `Cmd + Option + R`

**Variante B - Cache komplett leeren:**
- Chrome: Einstellungen → Datenschutz → Browserdaten löschen → "Bilder und Dateien im Cache"
- Firefox: Einstellungen → Datenschutz → Cookies und Website-Daten → Daten entfernen → "Zwischengespeicherte Webinhalte/Cache"

**Variante C - Inkognito-/Privater Modus:**
- Öffnen Sie die Admin-Seite im Inkognito-/Privaten Modus

### 3. Alte Dateien neu hochladen (Optional)

Dateien, die VOR diesem Update hochgeladen wurden, haben automatisch generierte Namen wie:
- `1768651899616-826312205.pptx`

Diese Dateien funktionieren weiterhin, zeigen aber den generierten Namen an.

**Um den Original-Dateinamen anzuzeigen:**
1. Öffnen Sie das Admin-Panel
2. Gehen Sie zu "📤 Import (PPTX/PDF)"
3. Löschen Sie die alte Datei
4. Laden Sie die Datei erneut hoch
5. Die neue Datei wird mit ihrem Original-Namen gespeichert

## Was wurde geändert?

### Backend-Änderungen
1. **Trust Proxy aktiviert** (`backend/server.js`)
   - Behebt den `X-Forwarded-For` Fehler bei express-rate-limit
   - Ermöglicht korrekte Client-IP-Erkennung hinter einem Reverse Proxy

2. **Original-Dateinamen beibehalten** (`backend/routes/admin.js`)
   - Neue Uploads behalten ihren Original-Dateinamen
   - Falls Name existiert, wird automatisch eine Nummer angehängt: `datei (1).pptx`

### Frontend-Änderungen
1. **Cache-Busting** (alle HTML-Dateien)
   - CSS und JS Dateien haben jetzt Versions-Parameter: `?v=1768652225`
   - Browser laden automatisch neue Versionen nach Updates

2. **Empfänger-E-Mail-Feld**
   - Feld ist im HTML vorhanden (Zeile 80-83 in `admin/index.html`)
   - Wird korrekt vom Backend geladen und gespeichert
   - Falls nicht sichtbar: Browser-Cache leeren!

### Auto-Folien-Generierung
- Code ist bereits implementiert (`backend/routes/admin.js`, Zeile 401-420)
- Wird automatisch ausgeführt beim Erstellen eines Webinars mit PPTX/PDF
- Falls nicht funktioniert: Container neu bauen und Browser-Cache leeren

## Überprüfung

Nach den Updates sollten folgende Funktionen funktionieren:

✅ **E-Mail-Konfiguration:**
- Empfänger-E-Mail-Feld ist sichtbar im Admin-Panel unter "E-Mail (SMTP)"
- Wert wird gespeichert und beim nächsten Laden angezeigt

✅ **Datei-Import:**
- Neu hochgeladene Dateien zeigen ihren Original-Dateinamen
- Format: `meine-praesentation.pptx` statt `1768651899616-826312205.pptx`

✅ **Auto-Folien-Generierung:**
- Beim Erstellen eines Webinars mit PPTX/PDF werden automatisch Folien generiert
- Folien-Anzahl wird korrekt in der Webinar-Liste angezeigt

✅ **Keine express-rate-limit Fehler:**
- Keine `X-Forwarded-For` Warnungen mehr in den Container-Logs

## Troubleshooting

### Container-Logs überprüfen
```bash
docker compose logs -f backend
```

### Häufige Fehler

**"Empfänger-E-Mail-Feld nicht sichtbar"**
- Lösung: Browser-Cache leeren (siehe oben)
- Überprüfung: Im Browser DevTools → Network → "Disable cache" aktivieren und Seite neu laden

**"Datei-Namen sind immer noch generiert"**
- Alte Dateien behalten ihre Namen
- Lösung: Dateien löschen und neu hochladen
- Neue Uploads sollten Original-Namen haben

**"Folien werden nicht generiert"**
- Container-Logs prüfen: `docker compose logs -f backend`
- Mögliche Ursache: PPTX/PDF-Analyse fehlgeschlagen
- Lösung: Überprüfen Sie die Datei-Qualität und Größe

**"express-rate-limit Fehler"**
- Falls der Fehler weiterhin auftritt:
  - Container vollständig neu bauen: `docker compose build --no-cache`
  - Überprüfen Sie die `backend/server.js` Zeile 17: `app.set('trust proxy', true);`

## Hilfe

Falls Probleme weiterhin bestehen:
1. Überprüfen Sie die Container-Logs: `docker compose logs -f`
2. Starten Sie alle Container neu: `docker compose restart`
3. Erstellen Sie ein GitHub Issue mit:
   - Beschreibung des Problems
   - Relevante Log-Ausgaben
   - Browser und Version
   - Docker-Version: `docker --version` und `docker compose version`
