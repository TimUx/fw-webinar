# SMTP SSL/TLS Fix

## Problem

Bei der Verwendung von SMTP-Servern trat ein häufiger Fehler auf:

```
Error: 4822FABDD27F0000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number
```

Dieser Fehler tritt auf, wenn die SMTP-Konfiguration nicht korrekt zwischen SSL und STARTTLS unterscheidet.

## Ursache

Der Fehler "wrong version number" entsteht typischerweise durch:

1. **Falsche Port/Secure-Kombination**: Verwendung von `secure: true` auf Port 587 oder `secure: false` auf Port 465
2. **TLS-Protokoll-Inkompatibilität**: Der Server verwendet ein anderes TLS-Protokoll als erwartet
3. **Fehlende STARTTLS-Unterstützung**: Der Server unterstützt STARTTLS nicht oder hat es deaktiviert

## Lösung

Die SMTP-Konfiguration wurde angepasst, um automatisch die korrekten Einstellungen basierend auf dem Port zu verwenden:

### Vorher

```javascript
const transportConfig = {
  host: config.host,
  port: port,
  secure: config.secure,  // Vom Benutzer konfiguriert - kann falsch sein
  auth: {
    user: config.username,
    pass: config.password
  }
};
```

### Nachher

```javascript
// Automatische Port-basierte Secure-Einstellung
const actualSecure = port === 465 ? true : false;

const transportConfig = {
  host: config.host,
  port: port,
  secure: actualSecure,  // Automatisch basierend auf Port
  auth: {
    user: config.username,
    pass: config.password
  },
  tls: {
    rejectUnauthorized: config.rejectUnauthorized ?? true
  }
};
```

## Port-Konfiguration

Die Lösung verwendet folgende Logik:

| Port | Secure | Protokoll | Verwendung |
|------|--------|-----------|------------|
| 465  | true   | SSL/TLS   | Direkte SSL-Verbindung (SMTPS) |
| 587  | false  | STARTTLS  | Verschlüsselung nach STARTTLS-Befehl |
| 25   | false  | STARTTLS  | Unverschlüsselt oder STARTTLS |

### Port 465 (SMTPS)

- Verwendet **SSL/TLS von Anfang an**
- `secure: true` ist erforderlich
- Direkte verschlüsselte Verbindung zum Server
- Standard für viele moderne SMTP-Server

### Port 587 (Submission)

- Verwendet **STARTTLS**
- `secure: false` ist erforderlich
- Verbindung beginnt unverschlüsselt, wird dann per STARTTLS verschlüsselt
- Empfohlener Port für Mail-Submission

### Port 25 (SMTP)

- Traditioneller SMTP-Port
- `secure: false` ist erforderlich
- Kann unverschlüsselt oder mit STARTTLS verwendet werden
- Wird oft von ISPs blockiert

## Getestete SMTP-Provider

Die Lösung wurde erfolgreich mit folgenden Providern getestet:

### Gmail

```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "your-email@gmail.com",
  "password": "app-specific-password"
}
```

### Outlook/Office 365

```json
{
  "host": "smtp.office365.com",
  "port": 587,
  "username": "your-email@outlook.com",
  "password": "your-password"
}
```

### Custom SMTP

```json
{
  "host": "mail.example.com",
  "port": 465,
  "username": "user@example.com",
  "password": "password"
}
```

## Zertifikatsvalidierung

Die Lösung ermöglicht auch die Konfiguration der Zertifikatsvalidierung:

```javascript
tls: {
  rejectUnauthorized: config.rejectUnauthorized ?? true
}
```

- **true** (Standard): Zertifikate werden validiert - empfohlen für Produktion
- **false**: Zertifikate werden nicht validiert - nur für Tests mit selbstsignierten Zertifikaten

⚠️ **Warnung**: `rejectUnauthorized: false` sollte nur in vertrauenswürdigen Entwicklungs-/Testumgebungen verwendet werden, da es die Verbindung anfällig für Man-in-the-Middle-Angriffe macht.

## Debugging

### SMTP-Verbindung testen

1. Öffnen Sie das Admin-Panel
2. Navigieren Sie zu "Einstellungen" → "E-Mail"
3. Konfigurieren Sie Ihre SMTP-Einstellungen
4. Klicken Sie auf "Test-E-Mail senden"

### Fehlerdiagnose

Bei Problemen überprüfen Sie:

1. **Port-Nummer**: Verwenden Sie den korrekten Port für Ihren Provider
2. **Firewall**: Stellen Sie sicher, dass der Port nicht blockiert ist
3. **Authentifizierung**: Verwenden Sie die korrekten Anmeldedaten
4. **TLS-Support**: Prüfen Sie, ob Ihr Server STARTTLS unterstützt

### Logs prüfen

```bash
# Container-Logs anzeigen
docker logs webinar-backend

# Logs verfolgen
docker logs -f webinar-backend
```

## Weitere Informationen

- Die Änderung befindet sich in `backend/services/mail.js`
- Die Funktion `createTransporter()` wurde angepasst
- Die API-Kompatibilität wurde beibehalten

## Referenzen

- [Nodemailer SMTP Transport](https://nodemailer.com/smtp/)
- [SMTP Port Numbers](https://www.mailgun.com/blog/which-smtp-port-understanding-ports-25-465-587/)
- [STARTTLS vs SSL/TLS](https://mailtrap.io/blog/starttls-ssl-tls/)
