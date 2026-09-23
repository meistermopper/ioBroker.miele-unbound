<p align="center">
  <img src="admin/miele-unbound.png" alt="Logo" width="200" />
</p>

# ioBroker.miele-unbound

[![NPM version](https://img.shields.io/npm/v/iobroker.miele-unbound.svg)](https://www.npmjs.com/package/iobroker.miele-unbound)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*Read this in another language: [Deutsche Dokumentation](README_de.md).*

A high-performance, local-first ioBroker adapter connecting modern **Miele@Home** appliances
directly over your local area network (LAN) without continuous cloud reliance.

By leveraging the local `MieleH256` / DOP2 protocol on port 80, `ioBroker.miele-unbound` provides
sub-second state updates, maximum privacy, and complete independence from internet outages or Miele
cloud rate limits. At the same time, it incorporates comprehensive device-type profiles and data point
definitions for over 30 appliance classes.

## Key Features

- **100% Local Operation:** Speaks directly to appliance communication modules (e.g. EK037, EK057).
- **Sub-second Response Times:** Instant state updates without third-party cloud polling delays.
- **Rich Device Profiles:** Over 30 appliance types with dedicated states, roles, and units.
- **Human-Readable & Raw Values:** Enriched plain-text statuses, program names, and phases.
- **Hardware-Safe Polling:** Strict sequential request queue per appliance to prevent XKM crashes.
- **Painless Credential Migration:** Encrypted export/import and manual entry for scratch installs.
- **Remote Control (Opt-in):** Start, stop, pause, power, and lighting controls via DOP2 opcodes.

## Quick Start & Setup Guide

1. Install the adapter and create an instance.
2. In the **Login & Pairing** tab, select your country and follow the step-by-step login below.
3. Paste the captured `miele://...` address into the **miele:// Redirect URL** field and click **Fetch GroupKey**.
4. Save settings. The adapter discovers your appliances and creates their states.

If running in Docker with bridge networking, auto-discovery cannot receive multicast packets — enter appliance IP addresses manually on the **Appliances** tab. See [Network & Docker](#network-ports--docker).

### The Login, Step by Step

The final redirect address uses the `miele://` mobile app scheme. Desktop web browsers cannot handle this custom scheme, causing the browser to halt on a spinning wheel or a loading error. **This interruption is expected and indicates success.**

1. **Prepare Browser DevTools:**
   - Click **Open Login Page** (a new browser tab opens).
   - Press **F12** (or right-click and select *Inspect*) to open Developer Tools.
   - Switch to the **Network** tab.
   - Ensure network requests are retained:
     - **Chrome / Edge / Brave:** Check **Preserve log**.
     - **Firefox:** Click the gear icon ⚙️ and check **Persist Logs**.
2. **Sign In:**
   - Enter your standard Miele app account email and password.
   - Complete the sign-in. The browser will halt on a spinning circle or display a navigation error.
3. **Copy Redirect URL:**
   - In the DevTools **Network** tab, scroll to the last recorded request (often highlighted in red).
   - Look for an entry starting with `redirect?redirect_uri=miele...` or `miele://oauth2-code/...`.
   - Right-click the request ➔ **Copy** ➔ **Copy URL**.
   - Paste the copied address into the adapter's **miele:// Redirect URL** field and click **Fetch GroupKey**.

The household GroupID and GroupKey are stored in the instance configuration (with the GroupKey safely encrypted). This pairing process is only required once.

### Alternative: Encrypted Backup & Manual Credentials

In the **Credentials & Backup** tab, the adapter provides two flexible options for server migrations, fresh installs, or disaster recovery:

#### What does "Encrypted Backup" do?
The local `GroupKey` is the master cryptographic key granting local LAN access to all Miele appliances in your household. With the encrypted backup feature, you can safely export your credentials and migrate them to another system **without ever needing to repeat the Miele cloud login or DevTools token capture**:
* **What is included in the backup?**
  * The household **GroupID** and the secret **GroupKey**.
  * All manually configured appliances and IP addresses (**Appliances table**).
  * Creation timestamp.
* **How is it encrypted?**
  * Strong industry-standard **AES-256-GCM** (authenticated encryption with built-in tampering protection).
  * Key derivation from your chosen **Passphrase** via **PBKDF2** with 100,000 rounds (SHA-256) and a cryptographically random 16-byte salt.
  * This guarantees that your sensitive local LAN key is never exported or stored in plain text and can safely be stored in external notes or backups.
* **Exporting:** Enter a strong passphrase ➔ click **Export Backup** ➔ copy and store the generated backup string safely.
* **Restoring:** On a new or reinstalled instance, simply paste the backup string and enter your passphrase ➔ click **Import Backup** ➔ your credentials and manual appliance IPs are immediately restored.

#### Manual Entry
Alternatively, if you already have your household GroupID and 64-character hexadecimal GroupKey saved from a previous installation, you can paste them directly into the respective fields.

## Network: Ports & Docker

| Direction | Port | Purpose | Required |
|---|---|---|---|
| In/Out | UDP 5353 (mDNS) | Automatic LAN device discovery | For auto-discovery |
| Outbound | TCP 80 ➔ appliances | Local DOP2/H256 polling and controls | Yes |
| Outbound | TCP 443 ➔ miele-iot.com | Fetch initial GroupKey pairing token | One-time login only |

**Docker & Bridge Networking:**
Containers with bridge networking do not forward multicast UDP traffic. In this configuration, automatic mDNS discovery will not find appliances. You can either:
1. Run the container with `network_mode: host` to enable multicast auto-discovery.
2. Or enter the IP addresses of your Miele appliances manually in the **Appliances** tab.

## Privacy & Local Operation

The adapter operates **strictly local-first**. The one-time Miele account login only serves to retrieve the household encryption key (`GroupKey`). During normal day-to-day operation:
- The adapter does not communicate with any cloud service.
- No user passwords or access tokens are stored or sent anywhere.
- Device state changes, energy metrics, and telemetry remain entirely inside your local network.

## Object Hierarchy

Each appliance is represented by its serial number as the device object:

- **`<serial>.info`**: Reachability, technical model name, material number, firmware version, IP.
- **`<serial>.state`**: Operating status, program ID and name, phase, remaining time, door, errors.
- **`<serial>.sensors`**: Temperature zones, spin speeds, drying steps, battery, ventilation.
- **`<serial>.eco`**: Targeted EcoFeedback energy (kWh/Wh), water consumption, and heating metrics.
- **`<serial>.control`**: Remote actions (start, stop, pause, power, lighting) when enabled.

## Legal Disclaimer

This is an **unofficial, community-developed** project and is **not affiliated with or endorsed by [Miele & Cie. KG](https://www.miele.com/)**. "Miele", "Miele@home", and related trademarks belong to Miele & Cie. KG and are used solely for identification and compatibility purposes.

The adapter utilizes local communication protocols reverse-engineered by the open-source community. Usage is at your own risk. The software is distributed under the MIT license without warranty of any kind.

## Changelog
### **WORK IN PROGRESS**
- Revert dishwasher EcoFeedback as dishwashers do not expose DOP2 leaf 2/6195

### 1.1.1 (2026-09-23)
- Enable EcoFeedback query and states for dishwashers (device types 7 and 8)

### 1.1.0 (2026-09-23)
- Parallelize setState calls in processState, add programPhase states map, and unify type aliases
- Restrict EcoFeedback states to washing machines until dryer/dishwasher DOP2 is supported
- Fix inUse state calculation to only report true while cycle is actively running
- Update hood light sensor state from live appliance telemetry
- Keep backup export and restore buttons active to prevent UI locking in jsonConfig
- Map raw Miele API dishwasher phase IDs (1793-1800) to human-readable labels

### 1.0.1 (2026-09-23)
- Only update sensor states supported by appliance profile to prevent missing object warnings

### 1.0.0 (2026-09-23)
- Fix auto-translate GitHub workflow by granting contents write permission
- Add dedicated read-only backup export field with copy to clipboard button
- Do not persist transient backup credentials on save and restore clear button adornment
- Fix backup import by using jsonData parameter injection in jsonConfig sendTo buttons
- Auto-populate encrypted backup to UI field with one-click copy to clipboard
- Require password confirmation for backupPassphrase with repeat and visibility toggle
- Remove rounded corners from adapter logo to provide seamless solid background
- Expand setup guide with detailed step-by-step browser DevTools and Docker instructions
- Initial development combining local MieleH256 LAN engine with device profiles
- Added AES-256-GCM encrypted backup and restore for migrations and scratch installs
- Implemented device profile engine covering washers, dryers, dishwashers, and ovens
- Integrated targeted EcoFeedback readings without destructive leaf scanning
- Fixed OAuth authorization popup and enabled messagebox communication for sendTo
- Enhanced GroupKey pairing response with UI form sync and clean adapter unload
- Fix mDNS discovery resolving IP addresses across multiple network interfaces
- Persist OAuth PKCE challenge to disk to prevent CSRF state mismatch on reload
- Display active Household GroupID directly in pairing setup tab
- Add dynamic device route discovery and fix X-Signature response header parsing
- Add clear button styling (contained/outlined) for all JSONConfig sendTo actions
- Add detailed step-by-step pairing guide with browser DevTools instructions
- Add comprehensive program mappings for all Miele appliances and modern 200-series
- Add automated i18n translation script and full 11-language admin dictionaries
- Add automated documentation sync script mirroring READMEs into docs/ directory
- Redesign adapter logo featuring Miele red background and unchained emblem
- Adjust logo display size and centering in README files
- Expand .gitignore with IDE, OS, and package manager log exclusions
- Clean redundant test devDependencies and update io-package dependencies
- Add responsive breakpoint sizes in jsonConfig and deduplicate dependencies
- Add standard integration test and re-enable integration testing in CI
- Add release config, check-wip and manage-changelogs scripts for release automation
- Add GitHub Actions CI/CD workflows for multi-OS testing and auto-translation
- Add Dependabot configuration and auto-merge workflow for dependency updates
- Add GitHub issue templates for bug reports and feature requests
- Add iob.bat developer shortcut and devServerCli.md command reference
- Add commitlint configuration, husky Git hooks and AI commit message helper
- Document async robustness, hardware protection and lifecycle rules in AGENTS.md

Older changelog entries can be found in [CHANGELOG_OLD.md](CHANGELOG_OLD.md).

## License

MIT License

Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>

See [LICENSE](LICENSE) for more details.
