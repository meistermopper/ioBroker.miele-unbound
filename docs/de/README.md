![Logo](../../admin/miele-unbound.png)

# ioBroker.miele-unbound

[![NPM version](https://img.shields.io/npm/v/iobroker.miele-unbound.svg)](https://www.npmjs.com/package/iobroker.miele-unbound)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

*Hier geht es zur englischen Version: [English Documentation](../en/README.md).*

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

## Schnelleinrichtung

1. Adapter installieren und eine Instanz anlegen.
2. Im Reiter **Anmeldung & Pairing**:
   - Land auswählen.
   - Auf **Login-Seite öffnen** klicken (im Browser DevTools F12 / Netzwerk-Tab geöffnet halten).
   - Mit den regulären Zugangsdaten der Miele-App anmelden.
   - Die Zieladresse kopieren, die mit `miele://` oder `.../redirect?...` beginnt.
   - Adresse in das Feld einfügen und auf **GroupKey abrufen** klicken.
3. Alternativ bei Migration von einer früheren Installation im Reiter **Zugangsdaten & Sicherung**
   GroupID und den GroupKey direkt einfügen oder ein verschlüsseltes Backup importieren.
4. Speichern. Der Adapter findet die Geräte im LAN und legt die Datenpunkte an.

## Objektstruktur

Jedes Gerät wird durch seine Seriennummer als Device im Objektbaum abgebildet:

- **`<seriennummer>.info`**: Erreichbarkeit, Modellname, Materialnummer, Firmware-Version, IP-Adresse.
- **`<seriennummer>.state`**: Betriebsstatus, Programm-ID und Name, Phase, Restzeiten, Tür, Fehler.
- **`<seriennummer>.sensors`**: Temperaturzonen, Schleuderdrehzahl, Trockenstufe, Akku, Lüfterstufe.
- **`<seriennummer>.eco`**: Gezieltes EcoFeedback für Energie (kWh/Wh), Wasserverbrauch und Heizdauer.
- **`<seriennummer>.control`**: Steuerbefehle (Start, Stopp, Pause, Power, Licht), falls aktiviert.

## Changelog

### **WORK IN PROGRESS**
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
- GitHub Actions CI/CD-Workflows für Multi-OS-Tests und Auto-Übersetzung ergänzt
- Dependabot-Konfiguration und Auto-Merge-Workflow für Updates integriert
- GitHub Issue-Templates für Fehlerberichte und Feature-Wünsche eingerichtet
- iob.bat Entwickler-Shortcut und devServerCli.md Befehlsreferenz ergänzt
- Commitlint-Konfiguration, Husky Git-Hooks und KI-Commit-Helfer ergänzt
- Regeln für asynchrone Robustheit, Hardware-Schutz und Lifecycle in AGENTS.md

## Lizenz

MIT License - Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>
