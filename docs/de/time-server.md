# Anleitung: Lokaler Miele-Zeitdienst & Uhrensynchronisation

*In einer anderen Sprache lesen: [English Guide](../en/time-server.md) | Zurück zur [Haupt-README](../../README_de.md)*

Miele-Geräte stellen ihre Uhr **nicht über einen normalen NTP-Server (UDP Port 123)**, sondern fragen die Uhrzeit per unverschlüsseltem HTTP-GET auf **TCP Port 80** bei einem fest einprogrammierten Miele-Server ab:

```http
GET http://ntp.mcs2.miele.com/V2/NTP/ HTTP/1.1
Host: ntp.mcs2.miele.com
Accept: application/vnd.miele.v1+json
```

und erwarten als Antwort ein JSON-Objekt mit dem aktuellen Unix-Zeitstempel in Sekunden (`{"time":1795100000}`).

Geräte ohne Internetzugang (z. B. durch Kindersicherung/Firewall im Router gesperrt oder in einem isolierten IoT-VLAN) laufen mit der Zeit ungenau, verlieren nach einem Stromausfall die Uhrzeit und stellen nicht mehr automatisch zwischen Sommer- und Winterzeit um. `ioBroker.miele-unbound` bringt genau diesen HTTP-Zeitdienst lokal mit und beantwortet `/V2/NTP/` im eigenen Heimnetz.

> **⚠️ WICHTIGER HINWEIS: Warum ein DNS-Eintrag allein NICHT ausreicht!**
> Ein DNS-Server (wie Pi-hole, AdGuard Home oder der Router) kann den Namen `ntp.mcs2.miele.com` **nur auf eine IP-Adresse** (die deines ioBroker-Hosts) umbiegen – **DNS kennt keine Portnummern!**
> Weil die Miele-Firmware zwingend auf **TCP Port 80** anfragt, der ioBroker-Adapter unter Linux ohne `root`-Rechte aber auf einem unprivilegierten Port (Standard: **TCP 8780**) lauscht, musst du **sowohl** die Domain per DNS auf die ioBroker-IP zeigen lassen **als auch** eingehende Anfragen auf **Port 80** des ioBroker-Hosts auf **Port 8780** weiterleiten.

---

## Variante 1: Lokales DNS (Pi-hole / AdGuard Home) + Port-80-Umleitung

### Schritt 1: Zeitdienst im ioBroker-Adapter einschalten
1. Öffne die Instanz-Einstellungen von `miele-unbound` und wechsle auf den Reiter **Einstellungen**.
2. Setze den Haken bei **Zeitabfrage der Geräte beantworten (Miele-Zeitdienst)**.
3. Lass den **Zeitdienst-Port (TCP)** auf **`8780`** stehen *(wähle nicht denselben Port wie für den SuperVision-Push-Empfänger)* und lass das Feld **Bind-Adresse** leer (`0.0.0.0`, alle Schnittstellen).
4. Klicke auf **Speichern und Schließen**.

### Schritt 2: DNS-Record in Pi-hole / AdGuard Home anlegen
Leite `ntp.mcs2.miele.com` auf die IP-Adresse des ioBroker-Hosts um, auf dem die `miele-unbound`-Instanz läuft (z. B. `192.168.1.50`):
- **Pi-hole:** Im Menü links auf **Local DNS** ➔ **DNS Records** (bzw. ab Pi-hole v6 unter **Settings** ➔ **Local DNS Records**) klicken ➔ unter **Domain:** `ntp.mcs2.miele.com` (ohne `http://` und ohne Port) und unter **IP Address:** `<ioBroker-Host-IP>` eintragen ➔ auf **Add** klicken. *(Falls du zwei redundante Pi-holes im Netz betreibst, trage den Record auf beiden ein.)*
- **AdGuard Home:** Unter **Filter** ➔ **DNS-Umschreibungen** ➔ **DNS-Umschreibung hinzufügen** ➔ Domain `ntp.mcs2.miele.com` auf `<ioBroker-Host-IP>` setzen.

### Schritt 3: Port 80 auf dem ioBroker-Host auf Port 8780 umleiten
Wähle die zu deiner ioBroker-Installation passende Methode:

#### Option A — Klassischer Linux-Host / Raspberry Pi / Debian / Ubuntu / LXC (wenn Port 80 frei ist)
Prüfe per SSH kurz, ob Port 80 auf dem Host noch frei ist (`sudo ss -tulpn | grep ':80 '`). Wenn keine Ausgabe erfolgt, ist Port 80 frei und du leitest Port 80 direkt im Linux-Kernel dauerhaft (reboot-fest) auf Port 8780 um:

```bash
sudo apt update && sudo apt install -y iptables-persistent
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8780
sudo netfilter-persistent save
```

#### Option B — Docker-Container (Bridge-Netzwerk)
Mappe am Container einfach den Außen-Port `80` auf den Innen-Port `8780`:

```yaml
ports:
  - "80:8780"
```

#### Option C — Reverse Proxy (`nginx`), falls Port 80 auf dem Host bereits belegt ist
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

### Schritt 4: Funktionstest vom PC aus
Prüfe von deinem Windows-PC (PowerShell) oder einem anderen Rechner im Heimnetz aus, ob DNS-Auflösung und Port-Umleitung zusammenarbeiten:

```powershell
curl.exe http://ntp.mcs2.miele.com/V2/NTP/
```

Erscheint als Antwort z. B. `{"time":1795100299}`, steht die gesamte Kette – deine Miele-Geräte beziehen ihre Uhrzeit ab sofort zu 100 % lokal.

> **Hinweis für Multi-Host-Systeme (ioBroker Master / Slave):** Wenn die `miele-unbound`-Instanz auf einem **ioBroker-Slave** läuft, müssen der DNS-Eintrag in Pi-hole und die `iptables`-Portumleitung auf die IP-Adresse dieses **Slaves** eingerichtet sein. Verschiebst du die Adapter-Instanz später auf den **Master**, wandert der Zeitdienst automatisch mit auf den Master: Ändere dann einfach in Pi-hole die IP von `ntp.mcs2.miele.com` auf die Master-IP und richte die Port-80-auf-8780-Umleitung auf dem Master ein.

---

## Variante 2: Router Ziel-NAT (DNAT)

Verfügst du über eine Firewall bzw. einen Router mit vollwertigem Destination-NAT (z. B. OPNsense, pfSense, UniFi, MikroTik), kannst du IP und Port auch direkt am Router in einem Schritt umbiegen (ohne DNS-Eintrag und ohne `iptables` auf dem ioBroker-Host):

- **Quelle:** Miele-Geräte (bzw. IoT-VLAN)
- **Ziel:** `ntp.mcs2.miele.com` (oder beliebig), **TCP Port 80**
- **Umleitungsziel (NAT):** `<ioBroker-Host-IP>`, **TCP Port 8780**
- *(Befindet sich ioBroker im selben Subnetz wie die Miele-Geräte, muss auf der Regel zusätzlich Quell-NAT / Hairpin-NAT / Masquerade aktiviert werden.)*

---

## Aktive Synchronisation der Geräteuhr (`keepDeviceClock`)

Manche Geräte (z. B. Backöfen) führen zusätzlich eine eigene Wanduhrzeit unter `Settings/TimeSync`. Die Option **Geräteuhr auf Ortszeit halten** prüft Geräte beim Start und stündlich und korrigiert Abweichungen über 2 Minuten automatisch per signiertem PUT.
