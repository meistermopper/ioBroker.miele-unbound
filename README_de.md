<p align="center">
  <img src="admin/miele-unbound.png" alt="Logo" width="200" />
</p>

# ioBroker.miele-unbound

[![NPM version](https://img.shields.io/npm/v/iobroker.miele-unbound.svg)](https://www.npmjs.com/package/iobroker.miele-unbound)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*Hier geht es zur englischen Version: [English Documentation](README.md).*

Ein leistungsfähiger, lokaler ioBroker-Adapter zur direkten Einbindung moderner **Miele@Home**-Geräte
über das lokale Netzwerk (LAN) – komplett ohne dauerhafte Cloud-Verbindung.

Durch die Nutzung des lokalen `MieleH256` / DOP2-Protokolls auf Port 80 bietet `ioBroker.miele-unbound`
Reaktionszeiten im Millisekundenbereich, maximale Privatsphäre und Unabhängigkeit von
Internetausfällen oder Miele-Cloud-Limits. Gleichzeitig vereint er umfassende Geräteprofile und
exakte Datenpunkte für über 30 Geräteklassen.

## Hauptmerkmale

- **100 % Lokaler Betrieb:** Spricht direkt mit den WLAN-Modulen der Geräte (z. B. EK037, EK057).
- **Schnelle Reaktionszeiten:** Sofortige Statusaktualisierungen ohne Cloud-Latenzen.
- **Umfassende Geräteprofile:** Über 30 Gerätetypen mit spezifischen Datenpunkten, Rollen und Einheiten.
- **Klartexte & Rohwerte:** Selbsterklärende Statustexte, Programmnamen und Phasen für VIS und Skripte.
- **Schonendes Polling:** Strenge serielle Warteschlange je Gerät zur Vermeidung von XKM-Abstürzen.
- **Einfache Migration:** Verschlüsselter Export/Import und Direkteingabe für Neuinstallationen.
- **Gerätesteuerung (Opt-in):** Start, Stopp, Pause, Ein-/Ausschalten und Lichtsteuerung via DOP2.

## Schnellstart & Einrichtung

1. Adapter installieren und eine Instanz anlegen.
2. Im Reiter **Anmeldung & Pairing** das Land wählen und der folgenden Schritt-für-Schritt-Anleitung folgen.
3. Die abgefangene `miele://...`-Adresse in das Feld **miele://-Redirect-URL** einfügen und auf **GroupKey abrufen** klicken.
4. Speichern. Der Adapter findet die Geräte im LAN und legt die Datenpunkte an.

Läuft ioBroker in einem Docker-Container mit Bridge-Netzwerk, werden Multicast-Pakete nicht durchgeleitet — in diesem Fall die IP-Adressen der Geräte im Reiter **Geräte** manuell eintragen. Siehe [Netzwerk & Docker](#netzwerk--docker).

### Die Anmeldung, Schritt für Schritt

Die letzte Zieladresse nutzt das `miele://`-Schema der offiziellen Miele-App. Desktop-Browser können dieses Schema nicht öffnen, weshalb der Vorgang bei einem drehenden Ladekreis oder einer Fehlermeldung stehen bleibt. **Genau das ist das erwartete Zeichen für einen erfolgreichen Login.**

1. **Entwicklertools vorbereiten:**
   - Auf **Login-Seite öffnen** klicken (ein neuer Browser-Tab öffnet sich).
   - **F12** drücken (oder Rechtsklick ➔ *Untersuchen*), um die Entwicklertools zu öffnen.
   - Auf den Tab **Netzwerk** (Network) wechseln.
   - Sicherstellen, dass das Netzwerkprotokoll erhalten bleibt:
     - **Chrome / Edge / Brave:** Haken bei **Log beibehalten** (*Preserve log*) setzen.
     - **Firefox:** Zahnrad-Symbol ⚙️ ➔ **Protokolle dauerhaft anzeigen** (*Persist Logs*) aktivieren.
2. **Anmelden:**
   - E-Mail-Adresse und Passwort des gewohnten Miele-App-Kontos eingeben und anmelden.
   - Nach dem Absenden bleibt die Seite bei einem Ladekreis stehen oder meldet einen Ladefehler.
3. **Redirect-URL kopieren:**
   - Im Netzwerk-Tab ganz nach unten zur letzten erfassten Zeile scrollen (oft rot markiert).
   - Nach einem Eintrag suchen, der mit `redirect?redirect_uri=miele...` oder `miele://oauth2-code/...` beginnt.
   - Zeile mit der rechten Maustaste anklicken ➔ **Adresse kopieren** (*Copy* ➔ *Copy URL*).
   - Die kopierte Adresse im ioBroker-Admin in das Feld **miele://-Redirect-URL** einfügen und auf **GroupKey abrufen** klicken.

GroupID und GroupKey werden anschließend in der Konfiguration gespeichert (der GroupKey sicher verschlüsselt). Dieser Vorgang ist nur ein einziges Mal notwendig.

### Alternative: Verschlüsseltes Backup & Manuelle Zugangsdaten

Im Reiter **Zugangsdaten & Sicherung** bietet der Adapter zwei flexible Wege für Server-Umzüge, Neuinstallationen oder Sicherheitskopien:

#### Was bewirkt das „Verschlüsselte Backup“?
Der lokale `GroupKey` ist der kryptografische Generalschlüssel für die Steuerung und Statusabfrage aller Miele-Geräte in deinem Haushalt. Mit der Backup-Funktion kannst du deine Konfiguration sichern und auf ein anderes System übertragen, **ohne den Miele-Login jemals wiederholen zu müssen**:
* **Was wird gesichert?** 
  * Die Haushalts-**GroupID** und der geheime **GroupKey**.
  * Alle manuell eingepflegten Geräte und IP-Adressen (**Geräte-Tabelle**).
  * Zeitstempel der Sicherung.
* **Wie wird verschlüsselt?** 
  * Sicherer Industriestandard **AES-256-GCM** (authentifizierte Verschlüsselung mit Manipulationsschutz).
  * Schlüsselableitung aus deiner gewählten **Passphrase** via **PBKDF2** mit 100.000 Runden (SHA-256) und zufälligem 16-Byte Salt.
  * Dadurch kann der erzeugte Backup-String bedenkenlos extern abgespeichert werden, ohne dass der geheime LAN-Schlüssel im Klartext vorliegt.
* **Exportieren:** Eigene Passphrase vergeben ➔ Klick auf **Backup exportieren** ➔ Den generierten Backup-Text kopieren und sicher aufbewahren.
* **Wiederherstellen:** Auf der neuen oder zurückgesetzten Instanz einfach den Backup-Text und die Passphrase eingeben ➔ Klick auf **Backup importieren** ➔ Alle Zugangsdaten und manuellen IPs sind sofort wieder aktiv.

#### Manuelle Eingabe
Alternativ kannst du die Haushalts-GroupID und den 64-stelligen hexadezimalen GroupKey auch direkt aus einer Textnotiz oder einer früheren Instanz von Hand in die entsprechenden Felder eintragen.

## Netzwerk & Docker

| Richtung | Port | Zweck | Erforderlich |
|---|---|---|---|
| Ein-/Ausgehend | UDP 5353 (mDNS) | Automatische Geräteerkennung im LAN | Für Auto-Discovery |
| Ausgehend | TCP 80 ➔ Geräte | Lokale DOP2/H256-Abfragen und Steuerbefehle | Ja |
| Ausgehend | TCP 443 ➔ miele-iot.com | Einmaliger Abruf des GroupKeys | Nur beim Login |

**Docker & Container:**
In Containern mit Bridge-Netzwerk werden Multicast-Pakete (mDNS) nicht durchgeleitet. Die automatische Gerätesuche findet dort keine Geräte. Es gibt zwei Lösungen:
1. Den Container mit `network_mode: host` betreiben, damit mDNS direkt funktioniert.
2. Oder die IP-Adressen der Miele-Geräte im Reiter **Geräte** manuell eintragen.

## Datenschutz & Lokaler Betrieb

Der Adapter arbeitet **vollständig lokal** (*local-first*). Die einmalige Anmeldung dient ausschließlich dazu, den haushaltsweiten Verschlüsselungsschlüssel (`GroupKey`) abzurufen. Im laufenden Normalbetrieb:
- Kommuniziert der Adapter mit keinem externen Cloud-Dienst.
- Werden weder Passwörter noch Tokens gespeichert oder übertragen.
- Bleiben alle Gerätezustände, Energiedaten und Steuerbefehle ausschließlich in deinem Heimnetzwerk.

## Objektstruktur

Jedes Gerät wird durch seine Seriennummer als Device im Objektbaum abgebildet:

- **`<seriennummer>.info`**: Erreichbarkeit, Modellname, Materialnummer, Firmware-Version, IP-Adresse.
- **`<seriennummer>.state`**: Betriebsstatus, Programm-ID und Name, Phase, Restzeiten, Tür, Fehler.
- **`<seriennummer>.sensors`**: Temperaturzonen, Schleuderdrehzahl, Trockenstufe, Akku, Lüfterstufe.
- **`<seriennummer>.eco`**: Gezieltes EcoFeedback für Energie (kWh/Wh), Wasserverbrauch und Heizdauer.
- **`<seriennummer>.control`**: Steuerbefehle (Start, Stopp, Pause, Power, Licht), falls aktiviert.

## Rechtliche Hinweise / Disclaimer

Dies ist ein **inoffizielles, privat entwickeltes Community-Projekt** und steht in **keiner Verbindung zu der [Miele & Cie. KG](https://www.miele.com/)**. „Miele“, „Miele@home“ und zugehörige Markennamen sind eingetragene Warenzeichen der Miele & Cie. KG und werden hier ausschließlich beschreibend zur Kennzeichnung der Kompatibilität verwendet.

Der Adapter nutzt ein durch Reverse Engineering offengelegtes lokales Protokoll. Die Nutzung erfolgt auf eigene Verantwortung. Die Software wird unter der MIT-Lizenz ohne jede Mängelgewähr bereitgestellt.

## Changelog

### **WORK IN PROGRESS**
- Backup-Buttons in jsonConfig immer aktiv halten gegen UI-Sperren bei Eingabefeldern
- Rohe Miele-API-Phasennummern des Geschirrspülers (1793-1800) auf lesbare Bezeichnungen mappen

### 1.0.1 (2026-09-23)
- Nur vom Geräteprofil unterstützte Sensor-States schreiben gegen ungültige Objektwarnungen

### 1.0.0 (2026-09-23)
- Auto-Translate GitHub Workflow durch Schreibberechtigung (contents write) behoben
- Eigenes schreibgeschütztes Export-Feld mit Kopier-Button für Zwischenablage ergänzt
- Flüchtige Backup-Felder beim Speichern verwerfen und Leeren-Button (X) wiederherstellen
- Backup-Import durch jsonData-Parameterübergabe in jsonConfig sendTo-Buttons behoben
- Verschlüsseltes Backup wird direkt ins UI-Feld befüllt mit 1-Klick-Zwischenablage
- Passwort-Bestätigung (repeat) und Sichtbarkeits-Toggle für backupPassphrase ergänzt
- Runde Ecken aus Adapter-Logo entfernt für vollflächigen Miele-Rot-Hintergrund
- Ausführliche Schritt-für-Schritt-Anleitung mit DevTools und Docker-Hinweisen ergänzt
- Erstentwicklung des Crossover-Adapters mit MieleH256-Engine und Profilen
- Verschlüsselte Sicherung und Wiederherstellung via AES-256-GCM
- Geräteprofile für Waschmaschinen, Trockner, Spülmaschinen und Backöfen
- Gezielte EcoFeedback-Auswertung ohne Brute-Force-Registerabfragen
- OAuth-Autorisierungs-Popup und Messagebox-Kommunikation für Admin behoben
- GroupKey-Pairing mit Formularübernahme und sauberem Unload optimiert
- mDNS-Erkennung über mehrere Netzwerkschnittstellen und direkte A-Record-Abfrage
- OAuth PKCE Challenge zwischengespeichert gegen State-Mismatch bei Neustart
- Aktive Haushalts-GroupID wird direkt im Pairing-Tab angezeigt
- Dynamische Geräte-Routenerkennung und X-Signature-Header-Parsing korrigiert
- Klare Button-Gestaltung (contained/outlined) für alle JSONConfig-Aktionen
- Detaillierte Schritt-für-Schritt-Anleitung mit Entwicklertools im Pairing-Tab
- Vollständige Programmkataloge für alle Miele-Geräte und moderne 200er-IDs
- Automatischer Übersetzungs-Workflow und 11 ioBroker-Sprachdateien ergänzt
- Automatischer sync-docs Workflow spiegelt README-Dateien in docs/ Verzeichnis
- Release-Konfiguration, check-wip und manage-changelogs Skripte ergänzt
- Adapter-Logo mit Miele-Roten Hintergrund und Kettenglied-Emblem überarbeitet
- Anzeigegröße und Zentrierung des Logos in den README-Dateien angepasst
- .gitignore um Verzeichnisse, IDE- und Logdateien erweitert
- Redundante Test-Dependencies bereinigt und Abhängigkeiten aktualisiert
- Responsive Breakpoint-Größen in jsonConfig ergänzt und Abhängigkeiten dedupliziert
- Standard-Integrationstest hinzugefügt und in CI reaktiviert
- GitHub Actions CI/CD-Workflows für Multi-OS-Tests und Auto-Übersetzung ergänzt
- Dependabot-Konfiguration und Auto-Merge-Workflow für Updates integriert
- GitHub Issue-Templates für Fehlerberichte und Feature-Wünsche eingerichtet
- iob.bat Entwickler-Shortcut und devServerCli.md Befehlsreferenz ergänzt
- Commitlint-Konfiguration, Husky Git-Hooks und KI-Commit-Helfer ergänzt
- Regeln für asynchrone Robustheit, Hardware-Schutz und Lifecycle in AGENTS.md

Ältere Changelog-Einträge sind in [CHANGELOG_OLD.md](CHANGELOG_OLD.md) zu finden.

## Lizenz

MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>

Weitere Details siehe [LICENSE](LICENSE).
