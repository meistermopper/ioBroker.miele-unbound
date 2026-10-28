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
- **Echtzeit-Push (SuperVision, Opt-in):** Integrierter lokaler Push-Empfänger für sofortige Statusaktualisierungen in Millisekunden direkt von den Miele-Geräten.

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

## Zeitdienst für Geräte & Geräteuhr (optional)

Miele-Geräte stellen ihre Uhr **per HTTP-Anfrage und nicht per NTP**:

```
GET http://ntp.mcs2.miele.com/V2/NTP/ HTTP/1.1
Host: ntp.mcs2.miele.com
Accept: application/vnd.miele.v1+json
```

Geräte in isolierten IoT-Netzen ohne Internetzugang driften mit der Zeit ab und schalten nicht zuverlässig zwischen Sommer- und Winterzeit um. Der Adapter kann diese Abfragen im lokalen Netz beantworten:

1. **Zeitdienst aktivieren:** Unter **Einstellungen** den **Miele-Zeitdienst** aktivieren und Port wählen (Vorgabe: 8780).
2. **Umleitung einrichten:** Da das Ziel fest im Kommunikationsmodul hinterlegt ist, muss der Datenverkehr umgeleitet werden:
   - **Router: Ziel-NAT / Portweiterleitung:** Quelle = Miele-Geräte, Ziel = `ntp.mcs2.miele.com` TCP 80, umgesetzt auf die ioBroker-IP und den gewählten Port. Liegt ioBroker im selben Subnetz wie die Geräte, zusätzlich Quell-NAT (Masquerade) aktivieren.
   - **DNS-Umschreibung:** `ntp.mcs2.miele.com` auf die ioBroker-IP auflösen (benötigt Port 80 oder Docker-Portweiterleitung `-p 80:8780`).

**Geräteuhr auf Ortszeit halten (keepDeviceClock):**
Manche Geräte (z. B. Backöfen) führen eine eigene Wanduhrzeit unter `Settings/TimeSync`. Die Option **Geräteuhr auf Ortszeit halten** prüft Geräte beim Start und stündlich und korrigiert Abweichungen über 2 Minuten automatisch per signiertem PUT.

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
- Abhängigkeits-Overrides zur Behebung von Dependabot-Warnungen aktualisiert

### 1.4.0 (2026-10-26)
- Neuer optionaler Miele-Zeitdienst für HTTP-Zeitabfragen (/V2/NTP/) im lokalen Netz
- Optionale Synchronisation der Geräteuhr (keepDeviceClock) via Settings/TimeSync
- Einstellungen für timeServer und keepDeviceClock im Admin-JSONConfig mit 11 Sprachen
- Unbehandelte Promise-Rejection im stündlichen Geräteuhr-Abgleich behoben
- Absturz bei mDNS-Socket-Fehlern in Discovery und Push-Listener behoben
- Dauerhaft hängende Geräte-Anfragewarteschlange bei abgebrochenen HTTP-Antworten behoben
- Überlappende Polling-Zyklen durch Push, Befehle oder Discovery verhindert
- Veralteten Geräteeintrag nach IP-Wechsel entfernen (kein Flackern von info.connected)
- Veraltete Poll-Antworten verwerfen, wenn bereits ein neueres Push-Update vorliegt
- Steuer-States beim Start abonnieren, bevor ausstehende Befehle verworfen werden
- Fehler in ready- und stateChange-Handlern abfangen statt Promise-Rejection
- Laufende Geräteanfragen und mDNS-Discovery beim Beenden des Adapters abbrechen
- Subnetz-Fallback-Scan entkoppelt ausführen und bekannte Geräte-IPs überspringen
- Erster Geräteuhr-Abgleich jetzt 2 Minuten nach Start statt erst nach 1 Stunde
- Body-Größe von Push-Anfragen und Zeitdienst-Abrufer-Kanäle (max. 50) begrenzt
- Instanzspezifischer Dateiname für die Pairing-Challenge

### 1.3.1 (2026-10-18)
- Automatischer Subnetz-Fallback-Scan bei geänderten DHCP-IP-Adressen
- Automatischer Wiederholungsversuch bei kurzzeitigen XKM-Socket-Abbrüchen
- Ausstehende Steuerbefehle beim Adapterstart verwerfen und quittieren
- Restlaufzeit im ausgeschalteten oder beendeten Gerätestatus auf 0 bereinigen
- Skript update:dev ergänzt und dev-server Profilsynchronisation verbessert

### 1.3.0 (2026-10-11)
- Neuer geräteindividueller Abfragetakt (Aktiv-/Ruhe-Intervall zum Schutz der XKM-Module)

### 1.2.0 (2026-09-27)
- Optionalen SuperVision-Echtzeit-Push-Listener mit mDNS-Service-Announce ergänzen
- Programm- und Phasendefinitionen für Saugroboter und Kaffeevollautomaten hinzufügen
- Lokale DOP2-Rohphasen-IDs für Waschmaschinen, Trockner, Spüler und Öfen mappen
- SolarSave-Spülprogramm (ID 5) für Geschirrspüler ergänzen
- actions/checkout & setup-node im Auto-Translate-Workflow auf v7 aktualisieren
- Auto-Translate-Workflow um Biome-Formatierung für io-package.json ergänzen
- Aufschlussreiches Logging für Geräteregistrierung, Verbindungsstatus und Polling-Fehler

### 1.1.2 (2026-09-23)
- EcoFeedback für Geschirrspüler zurücknehmen, da DOP2 Leaf 2/6195 nicht existiert

[Ältere Einträge](CHANGELOG_OLD.md)

[Ältere Einträge](CHANGELOG_OLD.md)

## Lizenz

MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>

Weitere Details siehe [LICENSE](LICENSE).
