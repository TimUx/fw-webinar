# Webinar Platform - Self-Hosted E-Learning System

Eine vollständig selbst gehostete, automatisierte Webinar- und E-Learning-Plattform mit Präsentationen, automatischer Sprachausgabe und Quiz-System.

## Features

✨ **Vollständig selbst gehostet** - Keine externen Abhängigkeiten  
🐳 **Docker-basiert** - Einfache Bereitstellung mit Docker Compose  
🔒 **Sicher** - JWT-Authentifizierung, bcrypt-Passwort-Hashing, Rate Limiting  
📊 **Admin-Panel** - Vollständige Verwaltung von Webinaren, PPTX/PDF, Quiz und Ergebnissen  
🎯 **Quiz-System** - Multiple-Choice-Tests mit automatischer Bewertung  
📧 **E-Mail-Benachrichtigungen** - Automatischer Versand von Ergebnissen  
🗣️ **Sprachausgabe** - Hochwertige Text-to-Speech mit Piper TTS (Deutsche Thorsten Stimme)  
🎨 **Modernes Design** - Basierend auf fw-fragenkatalog Design  
📱 **Responsive** - Funktioniert auf Desktop, Tablet und Mobile  
🌐 **Deutsch** - Vollständig auf Deutsch lokalisiert  
📄 **PDF & PPTX Support** - Import von PDF- und PowerPoint-Präsentationen mit zwei Modi:
  - Inhalts-Modus: Text und Bilder getrennt extrahieren
  - Screenshot-Modus: Folien als Ganzes als Bild darstellen

## Dokumentation

- **[README.md](README.md)** - Diese Datei: Übersicht, Architektur und Quickstart
- **[ADMINISTRATOR_GUIDE.md](ADMINISTRATOR_GUIDE.md)** - Installation, Konfiguration, Fehlerbehebung und Admin-Panel-Bedienung
- **[USER_GUIDE.md](USER_GUIDE.md)** - Verwendung im Frontend und TipTap-Editor  

## Architektur

### Tech Stack

- **Backend**: Node.js mit Express
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Präsentation**: Reveal.js
- **WYSIWYG Editor**: TipTap (ProseMirror-based)
- **Text-to-Speech**: Piper TTS (Python Flask Service mit deutscher Thorsten Stimme)
- **Authentifizierung**: JWT + bcrypt
- **E-Mail**: Nodemailer (SMTP)
- **PPTX/PDF-Konvertierung**: OnlyOffice DocumentServer (Container), pdftoppm für PDF
- **Speicher**: Dateibasiert (JSON)
- **Container**: Docker & Docker Compose

### Container-Architektur

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

3. **onlyoffice**: OnlyOffice DocumentServer
   - PPTX/PDF zu PDF Konvertierung
   - Hochwertige Dokumentenverarbeitung
   - REST-API für Konvertierung

Der TTS-Service und OnlyOffice laufen unabhängig und werden vom Backend über interne REST-APIs angesprochen.

### Sprachausgabe mit Piper TTS

Die Webinar-Plattform verwendet **Piper TTS** für hochwertige, natürlich klingende deutsche Sprachausgabe.

**Funktionen:**
- Hochwertige deutsche Stimme (Thorsten-Modell)
- Konsistente Qualität in allen Browsern
- Audio-Caching für optimale Performance
- Geschwindigkeitsregelung (0.5x - 1.5x)
- Selbst gehostet und datenschutzfreundlich

**Technische Details:**
- TTS-Engine: Piper TTS mit Thorsten-Modell
- Service: Python Flask-Anwendung in separatem Container
- Caching: MD5-basiertes Caching
- API: REST-API für einfache Integration

### Dokumentenkonvertierung mit OnlyOffice

Die Plattform verwendet **OnlyOffice DocumentServer** für hochwertige PPTX/PDF-Konvertierung.

**Funktionen:**
- Bessere Folien-Darstellung als LibreOffice
- Enterprise-Grade Dokumentenverarbeitung
- Präzise Layout-Beibehaltung
- Unterstützung für komplexe Präsentationen
- Selbst gehostet und datenschutzfreundlich

**Technische Details:**
- Engine: OnlyOffice DocumentServer
- Service: Docker-Container mit eingebautem Webserver
- API: REST-API für Konvertierung
- Formate: PPTX, PDF, DOCX und mehr

## Schnellstart

### Voraussetzungen

- Docker & Docker Compose installiert
- Mindestens 3GB RAM (2GB für OnlyOffice DocumentServer, 1GB für Backend/TTS)
- Port 3000 verfügbar (oder anderer Port nach Wahl)

### Installation

1. **Repository klonen**
```bash
git clone https://github.com/TimUx/fw-webminar.git
cd fw-webminar
```

2. **Umgebungsvariablen konfigurieren**
```bash
cp .env.example .env
# .env bearbeiten und JWT_SECRET ändern
```

3. **Starten**
```bash
docker-compose up -d
```

4. **Zugriff**
- Webinar-Frontend: http://localhost:3000
- Admin-Panel: http://localhost:3000/admin/

**Erstes Login:**
- Benutzername: `admin`
- Passwort: Beliebiges Passwort (wird beim ersten Login gesetzt)

**Hinweis**: Für Produktionsumgebungen siehe [ADMINISTRATOR_GUIDE.md](ADMINISTRATOR_GUIDE.md) für Reverse Proxy Konfiguration und erweiterte Einstellungen.


## Dateistruktur

```
fw-webminar/
├── backend/              # Node.js Backend
│   ├── routes/          # API-Routen
│   ├── services/        # Business-Logik
│   ├── middleware/      # Express-Middleware
│   ├── utils/           # Hilfsfunktionen
│   └── server.js        # Haupt-Server
├── public/              # Frontend
│   ├── admin/           # Admin-Panel
│   ├── webinar/         # Öffentliche Webinar-Seite
│   └── assets/          # CSS, JS, Bilder
├── tts-service/         # Piper TTS Service (Python)
├── data/                # JSON-Dateispeicher
├── uploads/             # Hochgeladene PPTX/PDF und Bilder
├── slides/              # Generierte Präsentationen (HTML)
├── assets/              # Logos, Theme-Bilder
├── docker-compose.yml   # Docker-Konfiguration
└── README.md
```

## Entwicklung

### Lokale Entwicklung ohne Docker

1. Dependencies installieren:
```bash
npm install
```

2. Umgebungsvariablen setzen:
```bash
cp .env.example .env
```

3. Development-Server starten:
```bash
npm run dev
```

4. Zugriff auf http://localhost:3000

### Logs anzeigen
```bash
docker-compose logs -f backend
docker-compose logs -f tts
```

## Lizenz

MIT License

## Support

Bei Fragen oder Problemen:
- GitHub Issues: https://github.com/TimUx/fw-webminar/issues
- [ADMINISTRATOR_GUIDE.md](ADMINISTRATOR_GUIDE.md) - Detaillierte Installations- und Konfigurationsanleitung
- [USER_GUIDE.md](USER_GUIDE.md) - Benutzerhandbuch

## Mitwirken

Pull Requests sind willkommen!

## Credits

Design basiert auf: https://github.com/TimUx/fw-fragenkatalog

## Changelog

### Version 1.5.0 (2026)
- Migration von LibreOffice zu OnlyOffice DocumentServer
- Verbesserte Darstellung von PPTX-Folien
- OnlyOffice läuft als separater Container-Service
- Bessere Handhabung von komplexen Folien-Layouts

### Version 1.4.1 (2026)
- LibreOffice direkt im Backend-Container integriert
- Screenshot-Modus funktioniert out-of-the-box ohne separate Container
- Vereinfachte Architektur und Deployment

### Version 1.4.0 (2026)
- Neuer Screenshot-Import-Modus für Präsentationen
- Wählbarer Import-Modus: Inhalts-Modus (Standard) oder Screenshot-Modus
- Screenshot-Modus: Folien werden als Ganzes als Bild dargestellt
- Extrahierter Text nur für TTS, behält exaktes Layout bei

### Version 1.3.0 (2026)
- Migration zu TipTap WYSIWYG Editor
- Moderner, erweiterbarer Editor basierend auf ProseMirror
- 85% Reduzierung der Code-Komplexität
- JSON-basierte Speicherstruktur

### Version 1.2.0 (2026)
- Intelligente Filterung von wiederkehrenden Inhalten in PPTX/PDF
- Automatische Erkennung von Kopf-/Fußzeilen, Logos, Seitenzahlen

### Version 1.1.0 (2026)
- Verbesserte Sprachausgabe mit Piper TTS
- Geschwindigkeitsregelung und natürlichere Sprachausgabe

### Version 1.0.0 (2024)
- Initiales Release
