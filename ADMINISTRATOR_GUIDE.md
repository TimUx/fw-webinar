# Administrator Handbuch

Dieses Handbuch richtet sich an Administratoren, die die Webinar-Plattform installieren, konfigurieren und verwalten.

## Inhaltsverzeichnis

1. [Installation](#installation)
2. [Konfiguration](#konfiguration)
3. [Updates](#updates)
4. [Admin-Panel](#admin-panel)
5. [Webinar-Verwaltung](#webinar-verwaltung)
6. [Datensicherung](#datensicherung)
7. [Fehlerbehebung](#fehlerbehebung)
8. [Sicherheit](#sicherheit)

---

## Installation

### Voraussetzungen

- Docker & Docker Compose installiert
- Mindestens 1GB RAM
- Port 3000 verfügbar (oder anderer Port nach Wahl)

### Schritt-für-Schritt Installation

1. **Repository klonen**
```bash
git clone https://github.com/TimUx/fw-webminar.git
cd fw-webminar
```

2. **Umgebungsvariablen konfigurieren**
```bash
cp .env.example .env
# .env bearbeiten und JWT_SECRET ändern
# Optional: PUID und PGID anpassen (Standard: 1000)
```

3. **Verzeichnisse erstellen und Berechtigungen setzen**
```bash
mkdir -p data uploads slides assets
# Optional: Berechtigungen für den konfigurierten Benutzer setzen
# sudo chown -R $PUID:$PGID data uploads slides assets
```

4. **Starten**
```bash
docker-compose up -d
```

5. **Zugriff**
- Webinar-Frontend: http://localhost:3000
- Admin-Panel: http://localhost:3000/admin/

**Hinweis**: In einer Produktionsumgebung sollte ein externer Reverse Proxy (z.B. Caddy, Traefik, Nginx) vor die Anwendung geschaltet werden.

### Erstes Login

1. Öffnen Sie http://localhost:3000/admin/login.html
2. Benutzername: `admin`
3. Passwort: Beliebiges Passwort (wird beim ersten Login gesetzt)

Das erste eingegebene Passwort wird zum Admin-Passwort.

---

## Konfiguration

### Benutzer- und Gruppen-IDs (UID/GID)

Alle Container können mit spezifischen Benutzer- und Gruppen-IDs ausgeführt werden. Dies ist besonders wichtig für korrekte Dateiberechtigungen auf dem Host-System.

1. `.env` Datei bearbeiten:
```bash
# User/Group IDs für Container-Prozesse
PUID=1000
PGID=1000
```

2. UID/GID des aktuellen Benutzers ermitteln (optional):
```bash
id -u  # Zeigt UID
id -g  # Zeigt GID
```

3. Container neu starten, damit Änderungen wirksam werden:
```bash
docker-compose down
docker-compose up -d
```

**Hinweis:** Die Standardwerte sind PUID=1000 und PGID=1000. Dies funktioniert für die meisten Benutzer. Wenn Sie Probleme mit Dateiberechtigungen haben, passen Sie diese Werte entsprechend Ihrem System an.

### SMTP E-Mail-Konfiguration

1. Im Admin-Panel zu "E-Mail (SMTP)" navigieren
2. SMTP-Server-Details eingeben:
   - Host: z.B. `smtp.gmail.com`
   - Port: `587` (TLS) oder `465` (SSL)
   - Benutzername: Ihre E-Mail-Adresse
   - Passwort: Ihr E-Mail-Passwort oder App-Passwort
   - Absender E-Mail: E-Mail-Adresse für ausgehende Nachrichten
   - Empfänger E-Mail: Standard-Empfänger für Benachrichtigungen

3. Test-E-Mail senden zur Überprüfung

**SMTP SSL/TLS-Probleme:**
- Stellen Sie sicher, dass der richtige Port verwendet wird (587 für TLS, 465 für SSL)
- Bei Gmail: Verwenden Sie ein App-Passwort statt des normalen Passworts
- Überprüfen Sie Firewall-Regeln

### Reverse Proxy Konfiguration (Empfohlen für Produktion)

Für den Produktionseinsatz wird empfohlen, einen externen Reverse Proxy wie Caddy, Traefik oder Nginx zu verwenden. Dieser sollte:
- HTTPS/TLS-Terminierung übernehmen
- Den Backend-Container auf Port 3000 weiterleiten
- Security-Header setzen
- Kompression aktivieren (gzip/zstd)

Beispiel-Konfiguration für verschiedene Reverse Proxies finden Sie in deren jeweiliger Dokumentation.

### Header und Logo anpassen

1. Im Admin-Panel zu "Einstellungen" navigieren
2. Header-Titel eingeben
3. Logo hochladen (PNG, JPG, SVG)
4. Speichern

### TTS-Service Konfiguration

Die TTS-Konfiguration kann in der `docker-compose.yml` angepasst werden:

```yaml
tts:
  environment:
    - TTS_MODEL=tts_models/de/thorsten/tacotron2-DDC  # TTS-Modell
    - TTS_CACHE_DIR=/app/cache                        # Cache-Verzeichnis
```

**Performance-Hinweise:**
- Erster Start: Der TTS-Service benötigt beim ersten Start etwas Zeit zum Laden des Modells
- Erste Audio-Generierung: Die erste Generierung eines Textes kann 5-10 Sekunden dauern
- Caching: Bereits generierte Audiodateien werden wiederverwendet und spielen sofort ab
- GPU-Unterstützung: Falls verfügbar, wird automatisch CUDA für schnellere Generierung verwendet

---

## Updates

### Updates durchführen

Nach einem `git pull` müssen die Docker-Container neu gebaut werden, um Code-Änderungen zu laden:

```bash
# Container stoppen
docker compose down

# Code aktualisieren
git pull

# Container mit neuem Code bauen und starten
docker compose up -d --build

# Oder falls Probleme auftreten, zuerst die Images löschen:
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Browser-Cache leeren

**Wichtig**: Der Browser cached JavaScript- und CSS-Dateien. Nach einem Update:

1. Browser-Cache leeren (Strg+Shift+R oder Strg+F5)
2. Oder im Browser-DevTools "Disable cache" aktivieren
3. Die Anwendung nutzt automatisches Cache-Busting mit Versions-Parametern

**Hinweis für Entwickler**: Die Cache-Busting-Version ist aktuell manuell in HTML-Dateien gesetzt. Bei Änderungen an JS/CSS-Dateien sollte die Version aktualisiert werden, um Browser-Cache-Probleme zu vermeiden.

---

## Admin-Panel

Das Admin-Panel ist unter `/admin/` erreichbar und bietet folgende Funktionen:

### Webinare verwalten

1. **Webinar-Liste**: Übersicht aller erstellten Webinare
2. **Neues Webinar erstellen**: Button zum Anlegen neuer Webinare
3. **Webinar bearbeiten**: Klick auf Bearbeiten-Symbol
4. **Webinar löschen**: Klick auf Löschen-Symbol
5. **Webinar anzeigen**: Klick auf Anzeigen-Symbol öffnet das Webinar

### Präsentationen importieren

1. Zu "📤 Import (PPTX/PDF)" navigieren
2. PPTX- oder PDF-Datei hochladen
3. Datei wird automatisch verarbeitet:
   - **PDF**: Seiten werden als Bilder extrahiert (mit pdftoppm) und in `uploads/` gespeichert
   - **PPTX**: Bilder und Grafiken werden extrahiert und in `uploads/` gespeichert
   - Alle extrahierten Bilder werden automatisch den entsprechenden Folien zugeordnet

#### Automatische Filterung von wiederkehrenden Inhalten

Das System erkennt und entfernt automatisch:
- **Kopf- und Fußzeilen**: Text, der auf mehreren Folien/Seiten wiederholt wird
- **Logos und Hintergrundbilder**: Bilder, die auf den meisten Folien erscheinen
- **Seitenzahlen**: Muster wie "Seite 1", "Page 2", "1/10", reine Zahlen
- **Datumsangaben**: Verschiedene Datumsformate (01.01.2024, 12/31/2024)
- **Copyright-Hinweise**: z.B. "© 2024"
- **Firmen-/Organisationsnamen**: Die auf allen Folien erscheinen

Die Filterung erfolgt intelligent:
- Nur Inhalte, die auf mindestens 60% der Folien vorkommen, werden als repetitiv erkannt
- Für bekannte Muster (Seitenzahlen, Datum) gilt eine niedrigere Schwelle von 30%
- Themenspezifische Inhalte (Titel, Texte, Listen, Tabellen, Grafiken) bleiben erhalten

### Ergebnisse einsehen

1. Zu "Ergebnisse" navigieren
2. Alle eingereichten Quiz-Ergebnisse werden angezeigt
3. CSV-Export verfügbar für Auswertungen

### Audit-Logs

Alle administrativen Aktionen werden in `data/audit.log` protokolliert:
- Login-Versuche
- Webinar-Erstellungen/-Änderungen/-Löschungen
- SMTP-Konfigurationsänderungen
- Einstellungsänderungen

---

## Webinar-Verwaltung

### Methode 1: Manuelle Slides

1. Im Admin-Panel zu "Webinare" navigieren
2. "Neues Webinar erstellen" klicken
3. Titel eingeben
4. Folien hinzufügen:
   - Titel
   - Inhalt (HTML erlaubt)
   - Sprechernotiz (für automatische Sprachausgabe)
5. Quiz-Fragen hinzufügen:
   - Frage
   - 4 Antwortmöglichkeiten
   - Richtige Antwort markieren
6. Speichern

### Methode 2: PPTX/PDF-Upload

1. Präsentationsdatei (PPTX oder PDF) im Bereich "Präsentationen" hochladen
2. Bei Webinar-Erstellung Präsentationsdatei auswählen
3. **Import-Modus wählen:**
   - **Inhalts-Modus** (Standard): Text und Bilder werden getrennt extrahiert und als formatierter Markdown-Inhalt in den Folien dargestellt
   - **Screenshot-Modus**: Jede Folie wird als Ganzes als Bild/Screenshot in den Folien dargestellt, der extrahierte Text wird nur im TTS-Feld (Sprechernotiz) gespeichert
4. System konvertiert automatisch und erstellt Folien
5. Bei fehlenden Tools (pdftoppm, LibreOffice): Fallback auf Textextraktion

#### Import-Modi im Detail

**Inhalts-Modus** (Standard):
- Extrahiert Text und Bilder getrennt
- Text wird als formatierte Paragraphen dargestellt
- Bilder werden als separate Elemente in die Folien eingefügt
- Ermöglicht nachträgliche Bearbeitung einzelner Elemente
- Ideal für textlastige Präsentationen

**Screenshot-Modus**:
- Konvertiert jede Folie in ein vollständiges Bild
- Behält das exakte Aussehen der Original-Folie bei
- Text wird nur für TTS (Text-to-Speech) extrahiert
- Ideal für Design-intensive Präsentationen oder wenn Layout wichtig ist
- Keine nachträgliche Textbearbeitung möglich

### Sprechernotizen für TTS

**Tipps für beste Sprachqualität:**
- Schreiben Sie klare, vollständige deutsche Sätze
- Verwenden Sie Punkte, Kommas und Semikolons für natürliche Pausen
- Halten Sie Notizen übersichtlich (empfohlen: 2-4 Sätze pro Folie)
- Geschwindigkeit: Beginnen Sie mit 1.0x für optimales Verständnis

---

## Datensicherung

### Wichtige Daten

Wichtige Daten liegen in:
- `./data/` - Alle JSON-Dateien (users, settings, smtp, webinars, results, audit.log)
- `./uploads/` - Hochgeladene PPTX/PDF und extrahierte Bilder
- `./slides/` - Generierte Präsentationen
- `./assets/` - Logos und Assets

### Backup erstellen

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz data/ uploads/ slides/ assets/
```

### Backup wiederherstellen

```bash
tar -xzf backup-20260213.tar.gz
docker-compose restart
```

### Automatische Backups

Empfehlung: Richten Sie einen Cron-Job ein für tägliche Backups:

```bash
# Crontab bearbeiten
crontab -e

# Fügen Sie folgende Zeile hinzu (täglich um 2 Uhr nachts)
0 2 * * * cd /pfad/zu/fw-webminar && tar -czf /pfad/zu/backups/backup-$(date +\%Y\%m\%d).tar.gz data/ uploads/ slides/ assets/
```

---

## Fehlerbehebung

### Container starten nicht

```bash
# Container-Logs überprüfen
docker-compose logs -f

# Spezifischen Container-Logs anzeigen
docker-compose logs -f backend
docker-compose logs -f tts
```

### Admin-Passwort zurücksetzen

```bash
# users.json bearbeiten und passwordHash löschen
# Beim nächsten Login wird neues Passwort gesetzt
```

### SMTP funktioniert nicht

- SMTP-Zugangsdaten überprüfen
- Firewall-Regeln überprüfen (Port 587/465)
- Test-E-Mail im Admin-Panel senden
- Bei Gmail: App-Passwort verwenden (nicht das normale Passwort)
- SSL/TLS-Einstellungen überprüfen

### TTS-Service funktioniert nicht

**Symptome:**
- Keine Sprachausgabe im Webinar
- Fehler in den Container-Logs

**Lösungsschritte:**
1. TTS-Container-Logs überprüfen: `docker-compose logs -f tts`
2. TTS-Service neu starten: `docker-compose restart tts`
3. Cache-Verzeichnis überprüfen: `ls -la tts-service/cache/`
4. Modell neu laden lassen: `docker-compose down && docker-compose up -d`

### LibreOffice-Warnungen

**Hinweis:** Ab Version 1.4.1 ist LibreOffice direkt im Backend-Container enthalten (läuft im Headless-Modus).

LibreOffice läuft im Headless-Modus ohne grafische Oberfläche. Eventuelle Warnungen in den Logs sind harmlos und beeinträchtigen die PPTX-Konvertierung nicht:
- GUI-bezogene Warnungen können ignoriert werden
- Die Konvertierung erfolgt vollständig im Hintergrund
- Bei Problemen: Backend-Container-Logs überprüfen mit `docker-compose logs backend`

### LibreOffice-Konvertierung fehlschlägt

**Hinweis:** Ab Version 1.4.1 ist LibreOffice direkt im Backend-Container enthalten und muss nicht mehr separat aktiviert werden.

- Container-Logs überprüfen: `docker-compose logs backend`
- Sicherstellen, dass der Backend-Container neu gebaut wurde: `docker-compose build backend`
- Alternative: Manuelle Slides verwenden oder Inhalts-Modus statt Screenshot-Modus nutzen

### Berechtigungsprobleme

**Symptom:** Container kann nicht auf `data/`, `uploads/`, `slides/` oder `assets/` zugreifen

**Lösung:**
1. PUID und PGID in `.env` überprüfen
2. Berechtigungen setzen: `sudo chown -R $PUID:$PGID data/ uploads/ slides/ assets/`
3. Container neu starten: `docker-compose restart`

### Container-Logs zeigen "express-rate-limit" Fehler

**Symptom:** `X-Forwarded-For` Warnungen in den Logs

**Lösung:**
- Trust Proxy ist bereits aktiviert in `backend/server.js`
- Falls Fehler weiterhin auftritt: Container neu bauen mit `docker compose build --no-cache`

### Webinar-Import schlägt fehl

**Mögliche Ursachen:**
- Datei zu groß (max. 50MB)
- Ungültiges Format
- Korrupte PPTX/PDF-Datei

**Lösung:**
1. Dateigröße überprüfen
2. Datei in einer Office-Anwendung öffnen und neu speichern
3. Alternative: Manuell Slides erstellen

---

## Sicherheit

### Implementierte Sicherheitsmaßnahmen

- ✅ JWT-Token-Authentifizierung
- ✅ bcrypt-Passwort-Hashing (10 Runden)
- ✅ Rate Limiting (100 Anfragen/15 Min)
- ✅ Helmet.js Security Headers
- ✅ Input-Validierung
- ✅ Datei-Upload-Validierung
- ✅ CSRF-Schutz durch SameSite-Cookies
- ✅ Audit-Logging
- ✅ PyTorch-Sicherheitsupdates (Version ≥2.6.0)

### Best Practices

1. **JWT Secret ändern**: Ändern Sie `JWT_SECRET` in der `.env` Datei
2. **Starkes Admin-Passwort**: Verwenden Sie ein sicheres Passwort
3. **HTTPS verwenden**: Nutzen Sie einen Reverse Proxy mit TLS
4. **Regelmäßige Updates**: Halten Sie Docker-Images und Abhängigkeiten aktuell
5. **Backups**: Erstellen Sie regelmäßige Backups
6. **Audit-Logs überwachen**: Überprüfen Sie `data/audit.log` regelmäßig
7. **Firewall**: Beschränken Sie Zugriff auf Port 3000 auf vertrauenswürdige Quellen

### Bekannte Sicherheitslücken

**PyTorch-Versionen < 2.6.0:**
- Das TTS-Service verwendet PyTorch ≥2.6.0, um bekannte Sicherheitslücken zu vermeiden
- Regelmäßige Sicherheitsupdates werden empfohlen

---

## Container-Architektur

Die Plattform besteht aus zwei Hauptcontainern:

1. **backend**: Node.js-Anwendung (Express)
   - Haupt-Webserver
   - API-Endpunkte
   - Authentifizierung
   - Datei-Verwaltung

2. **tts**: Python-basierter Piper TTS Service
   - Sprachsynthese
   - Audio-Caching
   - REST-API

Der TTS-Service läuft unabhängig und wird vom Backend über eine interne REST-API angesprochen.

---

## API-Endpunkte

### Authentifizierung
- `POST /api/auth/login` - Admin-Login
- `POST /api/auth/setup` - Initiales Passwort setzen

### Admin (authentifiziert)
- `GET/PUT /api/admin/settings` - Einstellungen
- `POST /api/admin/settings/logo` - Logo hochladen
- `GET/PUT /api/admin/smtp` - SMTP-Konfiguration
- `POST /api/admin/smtp/test` - Test-E-Mail
- `GET /api/admin/pptx` - PPTX-Liste
- `POST /api/admin/pptx/upload` - PPTX hochladen
- `DELETE /api/admin/pptx/:filename` - PPTX löschen
- `GET/POST/PUT/DELETE /api/admin/webinars` - Webinar-Verwaltung
- `GET /api/admin/results` - Ergebnisse abrufen
- `GET /api/admin/results/export` - CSV-Export

### Öffentlich
- `GET /api/webinar/settings` - Öffentliche Einstellungen
- `GET /api/webinar/list` - Webinar-Liste
- `GET /api/webinar/:id` - Webinar-Details
- `POST /api/webinar/:id/submit` - Quiz-Ergebnis einreichen

---

## Support

Bei Fragen oder Problemen:
- GitHub Issues: https://github.com/TimUx/fw-webminar/issues
- Audit-Logs überprüfen: `data/audit.log`
- Container-Logs anzeigen: `docker-compose logs -f`
