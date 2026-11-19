<p align="center">
  <img src="admin/miele-unbound.png" alt="Logo" width="200" />
</p>

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

Miele-Geräte stellen ihre Uhr **nicht über einen normalen NTP-Server (UDP Port 123)**, sondern fragen die Uhrzeit per unverschlüsseltem HTTP-GET auf **TCP Port 80** bei einem fest einprogrammierten Miele-Server ab:

```http
GET http://ntp.mcs2.miele.com/V2/NTP/ HTTP/1.1
Host: ntp.mcs2.miele.com
Accept: application/vnd.miele.v1+json
```

und erwarten als Antwort ein JSON-Objekt mit dem aktuellen Unix-Zeitstempel in Sekunden (`{"time":1795100000}`).

Geräte ohne Internetzugang (z. B. durch Kindersicherung/Firewall im Router gesperrt oder in einem isolierten IoT-VLAN) laufen mit der Zeit ungenau, verlieren nach einem Stromausfall die Uhrzeit und stellen nicht mehr automatisch zwischen Sommer- und Winterzeit um. Der Adapter bringt genau diesen HTTP-Zeitdienst lokal mit und beantwortet `/V2/NTP/` im eigenen Heimnetz.

> **⚠️ WICHTIGER HINWEIS: Warum ein DNS-Eintrag allein NICHT ausreicht!**
> Ein DNS-Server (wie Pi-hole, AdGuard Home oder der Router) kann den Namen `ntp.mcs2.miele.com` **nur auf eine IP-Adresse** (die deines ioBroker-Hosts) umbiegen – **DNS kennt keine Portnummern!**
> Weil die Miele-Firmware zwingend auf **TCP Port 80** anfragt, der ioBroker-Adapter unter Linux ohne `root`-Rechte aber auf einem unprivilegierten Port (Standard: **TCP 8780**) lauscht, musst du **sowohl** die Domain per DNS auf die ioBroker-IP zeigen lassen **als auch** eingehende Anfragen auf **Port 80** des ioBroker-Hosts auf **Port 8780** weiterleiten.

### Variante 1: Lokales DNS (Pi-hole / AdGuard Home) + Port-80-Umleitung

#### Schritt 1: Zeitdienst im ioBroker-Adapter einschalten
1. Öffne die Instanz-Einstellungen von `miele-unbound` und wechsle auf den Reiter **Einstellungen**.
2. Setze den Haken bei **Zeitabfrage der Geräte beantworten (Miele-Zeitdienst)**.
3. Lass den **Zeitdienst-Port (TCP)** auf **`8780`** stehen *(wähle nicht denselben Port wie für den SuperVision-Push-Empfänger)* und lass das Feld **Bind-Adresse** leer (`0.0.0.0`, alle Schnittstellen).
4. Klicke auf **Speichern und Schließen**.

#### Schritt 2: DNS-Record in Pi-hole / AdGuard Home anlegen
Leite `ntp.mcs2.miele.com` auf die IP-Adresse des ioBroker-Hosts um, auf dem die `miele-unbound`-Instanz läuft (z. B. `192.168.1.50`):
- **Pi-hole:** Im Menü links auf **Local DNS** ➔ **DNS Records** (bzw. ab Pi-hole v6 unter **Settings** ➔ **Local DNS Records**) klicken ➔ unter **Domain:** `ntp.mcs2.miele.com` (ohne `http://` und ohne Port) und unter **IP Address:** `<ioBroker-Host-IP>` eintragen ➔ auf **Add** klicken. *(Falls du zwei redundante Pi-holes im Netz betreibst, trage den Record auf beiden ein.)*
- **AdGuard Home:** Unter **Filter** ➔ **DNS-Umschreibungen** ➔ **DNS-Umschreibung hinzufügen** ➔ Domain `ntp.mcs2.miele.com` auf `<ioBroker-Host-IP>` setzen.

#### Schritt 3: Port 80 auf dem ioBroker-Host auf Port 8780 umleiten
Wähle die zu deiner ioBroker-Installation passende Methode:

- **Option A — Klassischer Linux-Host / Raspberry Pi / Debian / Ubuntu / LXC (wenn Port 80 frei ist):**
  Prüfe per SSH kurz, ob Port 80 auf dem Host noch frei ist (`sudo ss -tulpn | grep ':80 '`). Wenn keine Ausgabe erfolgt, ist Port 80 frei und du leitest Port 80 direkt im Linux-Kernel dauerhaft (reboot-fest) auf Port 8780 um:
  ```bash
  sudo apt update && sudo apt install -y iptables-persistent
  sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8780
  sudo netfilter-persistent save
  ```
- **Option B — Docker-Container (Bridge-Netzwerk):**
  Mappe am Container einfach den Außen-Port `80` auf den Innen-Port `8780`:
  ```yaml
  ports:
    - "80:8780"
  ```
- **Option C — Reverse Proxy (`nginx`), falls Port 80 auf dem Host bereits belegt ist:**
  Läuft auf dem ioBroker-Host auf Port 80 bereits ein Webserver, fügst du dort einen kleinen Virtual-Host hinzu, der gezielt Anfragen für `ntp.mcs2.miele.com` an `127.0.0.1:8780` durchreicht:
  ```nginx
  server {
      listen 80;
      server_name ntp.mcs2.miele.com;

      location /V2/NTP {
          proxy_pass http://127.0.0.1:8780;
          proxy_set_header Host $host;
      }
  }
  ```

#### Schritt 4: Funktionstest vom PC aus
Prüfe von deinem Windows-PC (PowerShell) oder einem anderen Rechner im Heimnetz aus, ob DNS-Auflösung und Port-Umleitung zusammenarbeiten:
```powershell
curl.exe http://ntp.mcs2.miele.com/V2/NTP/
```
Erscheint als Antwort z. B. `{"time":1795100299}`, steht die gesamte Kette – deine Miele-Geräte beziehen ihre Uhrzeit ab sofort zu 100 % lokal.

> **Hinweis für Multi-Host-Systeme (ioBroker Master / Slave):** Wenn die `miele-unbound`-Instanz auf einem **ioBroker-Slave** läuft, müssen der DNS-Eintrag in Pi-hole und die `iptables`-Portumleitung auf die IP-Adresse dieses **Slaves** eingerichtet sein. Verschiebst du die Adapter-Instanz später auf den **Master**, wandert der Zeitdienst automatisch mit auf den Master: Ändere dann einfach in Pi-hole die IP von `ntp.mcs2.miele.com` auf die Master-IP und richte die Port-80-auf-8780-Umleitung auf dem Master ein.

### Variante 2: Router Ziel-NAT (DNAT)
Verfügst du über eine Firewall bzw. einen Router mit vollwertigem Destination-NAT (z. B. OPNsense, pfSense, UniFi, MikroTik), kannst du IP und Port auch direkt am Router in einem Schritt umbiegen (ohne DNS-Eintrag und ohne `iptables` auf dem ioBroker-Host):
- **Quelle:** Miele-Geräte (bzw. IoT-VLAN)
- **Ziel:** `ntp.mcs2.miele.com` (oder beliebig), **TCP Port 80**
- **Umleitungsziel (NAT):** `<ioBroker-Host-IP>`, **TCP Port 8780**
- *(Befindet sich ioBroker im selben Subnetz wie die Miele-Geräte, muss auf der Regel zusätzlich Quell-NAT / Hairpin-NAT / Masquerade aktiviert werden.)*

### Aktive Synchronisation der Geräteuhr (`keepDeviceClock`)
Manche Geräte (z. B. Backöfen) führen zusätzlich eine eigene Wanduhrzeit unter `Settings/TimeSync`. Die Option **Geräteuhr auf Ortszeit halten** prüft Geräte beim Start und stündlich und korrigiert Abweichungen über 2 Minuten automatisch per signiertem PUT.

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
- Ausführliche Anleitung für Zeitdienst (Pi-hole/Port 80) und README-Link im Admin ergänzt

### 1.7.1 (2026-11-16)
- Befehls- und Lichtknöpfe auf Gerätekarten bei nicht erreichbarem Gerät ausblenden
- control.canLightOn und control.canLightOff ergänzt und control.can* beim Stopp leeren
- Deutsche (Heißluft plus, Automatik, Trockenstufen) und französische Texte berichtigt

### 1.7.0 (2026-11-15)
- Programmwahl über control.programId (DOP2-Leaf 2/1577) und Auswahlmenü im Konfig-Manager ergänzt

### 1.6.2 (2026-11-15)
- Erkennung von MobileStart aus RemoteEnable-Array korrigiert, um Fernstart zu erlauben

### 1.6.1 (2026-11-12)
- Überflüssigen Datenpunkt state.estimatedEndtime zugunsten von estimatedEndTimeText entfernt
- Gerätekarten im Geräte-Manager zeigen Status, Programm, Phase, Programmart in Systemsprache
- Rohwerte (state.status, programId etc.) nutzen Wertetabellen in der ioBroker-Systemsprache
- Home-Assistant-Übersetzungen und Korrekturen für fehlende Sprachen integriert
- Mehrsprachige Beschreibungen (common.desc) in allen 11 Sprachen für control.can* und progress

### 1.6.0 (2026-11-12)
- Integration des ioBroker Geräte-Managers mit Live-Karten, Statusanzeigen und Aktionen
- Neuer Datenpunkt state.progress für den Programmfortschritt in Prozent (0..99 %)
- Neue Datenpunkte control.canPowerOn, canPowerOff, canStart, canPause, canStop

[Ältere Einträge](../../CHANGELOG_OLD.md)

[Ältere Einträge](../../CHANGELOG_OLD.md)

[Ältere Einträge](../../CHANGELOG_OLD.md)

## Lizenz

MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>

Weitere Details siehe [LICENSE](../../LICENSE).
