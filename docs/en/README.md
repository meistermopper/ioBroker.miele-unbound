![Logo](../../admin/miele-unbound.png)

# ioBroker.miele-unbound

[![NPM version](https://img.shields.io/npm/v/iobroker.miele-unbound.svg)](https://www.npmjs.com/package/iobroker.miele-unbound)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

*Read this in another language: [Deutsche Dokumentation](../de/README.md).*

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

## Setup Guide

1. Install the adapter and create an instance.
2. In the **Login & Pairing** tab:
   - Select your country.
   - Click **Open Login Page** (keep browser DevTools F12 open on the Network tab).
   - Sign in with your regular Miele app account.
   - Copy the destination address starting with `miele://` or `.../redirect?...`.
   - Paste the address into the redirect URL field and click **Fetch GroupKey**.
3. Alternatively, if migrating from a previous installation, use the **Credentials & Backup** tab to
   paste your saved GroupID and GroupKey directly, or import an encrypted backup.
4. Save settings. The adapter discovers your appliances and creates their states.

## Object Hierarchy

Each appliance is represented by its serial number as the device object:

- **`<serial>.info`**: Reachability, technical model name, material number, firmware version, IP.
- **`<serial>.state`**: Operating status, program ID and name, phase, remaining time, door, errors.
- **`<serial>.sensors`**: Temperature zones, spin speeds, drying steps, battery, ventilation.
- **`<serial>.eco`**: Targeted EcoFeedback energy (kWh/Wh), water consumption, and heating metrics.
- **`<serial>.control`**: Remote actions (start, stop, pause, power, lighting) when enabled.

## Changelog

### **WORK IN PROGRESS**
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
- Add release config, check-wip and manage-changelogs scripts for release automation
- Add GitHub Actions CI/CD workflows for multi-OS testing and auto-translation
- Add Dependabot configuration and auto-merge workflow for dependency updates
- Add GitHub issue templates for bug reports and feature requests
- Add iob.bat developer shortcut and devServerCli.md command reference
- Add commitlint configuration, husky Git hooks and AI commit message helper
- Document async robustness, hardware protection and lifecycle rules in AGENTS.md

## License

MIT License - Copyright (c) 2026 meistermopper <meister.mopper@gmail.com>

