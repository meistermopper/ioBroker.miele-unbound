# Appliance Time Server & Clock Synchronization Guide

*Read this in another language: [Deutsche Anleitung](../de/time-server.md) | Back to [Main README](../../README.md)*

Miele appliances do **not** use standard NTP (UDP port 123) to synchronize their internal clock. Instead, they send an unencrypted HTTP GET request to a hardcoded Miele endpoint on **TCP port 80**:

```http
GET http://ntp.mcs2.miele.com/V2/NTP/ HTTP/1.1
Host: ntp.mcs2.miele.com
Accept: application/vnd.miele.v1+json
```

and expect a JSON response with the current Unix timestamp in seconds (`{"time":1795100000}`).

Appliances without internet connectivity (e.g. blocked via router parental controls/firewall or placed in an isolated IoT VLAN) drift over time, fail to recover their clock after a power outage, and do not switch Daylight Saving Time automatically. `ioBroker.miele-unbound` includes a built-in HTTP time server that answers `/V2/NTP/` locally.

> **⚠️ IMPORTANT: Why a DNS entry alone is NOT sufficient!**
> A DNS server (such as Pi-hole, AdGuard Home, or your router) can only resolve the domain name `ntp.mcs2.miele.com` to an **IP address** (your ioBroker host IP) — **DNS cannot change the port number!**
> Because the Miele firmware strictly connects to **TCP port 80**, while the ioBroker adapter runs without `root` privileges on an unprivileged port (default: **TCP 8780**), you must **both** redirect the domain via DNS **and** forward incoming traffic on **port 80** of the ioBroker host to **port 8780**.

---

## Variant 1: Local DNS (Pi-hole / AdGuard Home) + Port 80 Forwarding

### Step 1: Enable the Time Server in ioBroker
1. Open the instance settings of `miele-unbound` and switch to the **Settings** tab.
2. Enable **Answer appliances time request (Miele time server)**.
3. Keep **Time Server Port (TCP)** at **`8780`** (do not use the same port as the SuperVision Push listener) and leave **Bind Address** empty (`0.0.0.0`, all interfaces).
4. Click **Save and Close**.

### Step 2: Create a Local DNS Record
Point `ntp.mcs2.miele.com` to the IP address of the ioBroker host running the `miele-unbound` instance (e.g. `192.168.1.50`):
- **Pi-hole:** Go to **Local DNS** ➔ **DNS Records** (or **Settings** ➔ **Local DNS Records** in Pi-hole v6) ➔ enter **Domain:** `ntp.mcs2.miele.com` (without `http://` or port) and **IP Address:** `<ioBroker-Host-IP>` ➔ click **Add**. *(If you run two redundant Pi-hole servers, add the record on both.)*
- **AdGuard Home:** Go to **Filters** ➔ **DNS rewrites** ➔ click **Add DNS rewrite** ➔ enter `ntp.mcs2.miele.com` and `<ioBroker-Host-IP>`.

### Step 3: Forward Port 80 to Port 8780 on the ioBroker Host
Choose the option matching your ioBroker installation:

#### Option A — Linux Host / Raspberry Pi / Debian / Ubuntu / LXC (when Port 80 is free)
Check via SSH that nothing else is listening on port 80 (`sudo ss -tulpn | grep ':80 '`). If no output is returned, port 80 is free. Install `iptables-persistent` and add a persistent kernel-level port redirect from `80` to `8780`:

```bash
sudo apt update && sudo apt install -y iptables-persistent
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8780
sudo netfilter-persistent save
```

#### Option B — Docker Container (Bridge Networking)
Map port `80` on the Docker host to port `8780` inside the container:

```yaml
ports:
  - "80:8780"
```

#### Option C — Reverse Proxy (`nginx`) when Port 80 is already in use on the host
If another web server already occupies port 80 on the ioBroker host, add a virtual host that proxies requests for `Host: ntp.mcs2.miele.com` to `127.0.0.1:8780`:

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

### Step 4: Verify the Setup
From any computer on your local network (e.g. Windows PowerShell, macOS, or Linux terminal), run:

```bash
curl http://ntp.mcs2.miele.com/V2/NTP/
```

If the response looks like `{"time":1795100299}`, both the DNS resolution and the port 80 ➔ 8780 redirect are working properly.

> **Multi-Host / Slave Note:** In an ioBroker multi-host environment (Master/Slave), the DNS record and the port 80 ➔ 8780 forwarding must always be configured on the host IP where the `miele-unbound` instance actually runs. If you later move the instance from a Slave to the Master host, update the DNS record in Pi-hole/AdGuard to the Master IP and configure the port 80 ➔ 8780 redirect on the Master.

---

## Variant 2: Router Destination-NAT (DNAT)

If your router/firewall supports full Destination-NAT (e.g. OPNsense, pfSense, UniFi, MikroTik), you can redirect both the IP and the port directly at the router without changing DNS or host `iptables`:

- **Source:** Miele appliances (or IoT VLAN)
- **Destination:** `ntp.mcs2.miele.com` (or any destination) on **TCP Port 80**
- **Redirect Target:** `<ioBroker-Host-IP>`, **TCP Port 8780**
- *(If ioBroker resides in the same subnet as the appliances, also enable Source-NAT / Hairpin-NAT / Masquerade.)*

---

## Active Appliance Clock Synchronization (`keepDeviceClock`)

Some appliances (e.g. ovens) also expose their local wall clock time via `Settings/TimeSync`. Enabling **Keep appliance clock on local time** checks appliances on startup and every hour, automatically correcting deviations larger than 2 minutes via a signed PUT request.
