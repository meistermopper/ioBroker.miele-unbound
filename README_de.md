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
* **Exportieren:** Sicherstellen, dass die Instanz läuft ➔ Eigene Passphrase vergeben ➔ Klick auf **Backup exportieren** ➔ Den generierten Backup-Text kopieren und sicher aufbewahren.
* **Wiederherstellen:** Auf der neuen oder zurückgesetzten Instanz sicherstellen, dass die Instanz gestartet ist (grüner Status) ➔ Backup-Text und Passphrase eingeben ➔ Klick auf **Importieren / Wiederherstellen** ➔ Alle Zugangsdaten und manuellen IPs sind sofort wieder aktiv.

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

<a id="time-server"></a>
## Zeitdienst für Geräte & Geräteuhr (optional)

Miele-Geräte stellen ihre Uhr **nicht per Standard-NTP**, sondern per HTTP-Anfrage (`GET http://ntp.mcs2.miele.com/V2/NTP/` auf **TCP Port 80**). Geräte ohne Internetzugang driften mit der Zeit ab und wechseln nicht automatisch zwischen Sommer- und Winterzeit. Der Adapter kann diese Abfragen im lokalen Netz beantworten:

1. **Zeitdienst aktivieren:** Unter **Einstellungen** den **Miele-Zeitdienst** aktivieren und Port wählen (Vorgabe: `8780`).
2. **Umleitung einrichten (DNS + Port 80):** Da Zieladresse und Port `80` fest in der Geräte-Firmware hinterlegt sind, reicht ein DNS-Eintrag allein (z. B. in Pi-hole oder AdGuard Home) nicht aus, weil DNS nur die IP-Adresse umbiegt – zusätzlich muss **TCP Port 80** auf dem ioBroker-Host auf **Port 8780** weitergeleitet werden (per `iptables`, Docker `-p 80:8780`, Reverse Proxy oder Router-DNAT).

➡️ **[Ausführliche Schritt-für-Schritt-Anleitung für den Zeitdienst (Pi-hole, AdGuard, iptables, Docker, nginx)](docs/de/time-server.md)**

**Geräteuhr auf Ortszeit halten (`keepDeviceClock`):**
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
- **`<seriennummer>.control`**: Steuerbefehle (Start, Stopp, Pause, Power, Licht sowie Programmwahl über `control.programId`), falls aktiviert.

## Rechtliche Hinweise / Disclaimer

Dies ist ein **inoffizielles, privat entwickeltes Community-Projekt** und steht in **keiner Verbindung zu der [Miele & Cie. KG](https://www.miele.com/)**. „Miele“, „Miele@home“ und zugehörige Markennamen sind eingetragene Warenzeichen der Miele & Cie. KG und werden hier ausschließlich beschreibend zur Kennzeichnung der Kompatibilität verwendet.

Der Adapter nutzt ein durch Reverse Engineering offengelegtes lokales Protokoll. Die Nutzung erfolgt auf eigene Verantwortung. Die Software wird unter der MIT-Lizenz ohne jede Mängelgewähr bereitgestellt.

## Changelog

### **WORK IN PROGRESS**
- DOP2-Antworten mit AES-CBC via X-Signature in readDop2 entschlüsselt
- Kontext-Fehlerzähler bei Programmstart zurückgesetzt (Lockout-Schutz)

### 1.7.3 (2026-11-20)
- DOP2-Typ 33 (AStruct) für Listen von Strukturen unterstützt
- Gerätekontext 2/1585 ausgewertet (Lebenszähler, letzter Spülgang, Dosierbehälter)
- Zyklus-Verbrauchsberechnung für Geschirrspüler via Zähler-Delta
- Antriebsenergie ergänzt und Vorgaben für Leaf 2/6195 präzisiert
- Alle 11 ioBroker-Sprachen für Text-Datenpunkte samt offiziellen polnischen Namen

### 1.7.2 (2026-11-20)
- Ausführliche Anleitung für Zeitdienst (Pi-hole/Port 80) und README-Link im Admin ergänzt

### 1.7.1 (2026-11-16)
- Befehls- und Lichtknöpfe auf Gerätekarten bei nicht erreichbarem Gerät ausblenden
- control.canLightOn und control.canLightOff ergänzt und control.can* beim Stopp leeren
- Deutsche (Heißluft plus, Automatik, Trockenstufen) und französische Texte berichtigt

### 1.7.0 (2026-11-15)
- Programmwahl über control.programId (DOP2-Leaf 2/1577) und Auswahlmenü im Konfig-Manager ergänzt

### 1.6.2 (2026-11-15)
- Erkennung von MobileStart aus RemoteEnable-Array korrigiert, um Fernstart zu erlauben

[Ältere Einträge](CHANGELOG_OLD.md)

[Ältere Einträge](CHANGELOG_OLD.md)

[Ältere Einträge](CHANGELOG_OLD.md)

[Ältere Einträge](CHANGELOG_OLD.md)

[Ältere Einträge](CHANGELOG_OLD.md)

## Lizenz

MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>

Weitere Details siehe [LICENSE](LICENSE).
