# Older changes
## 1.6.2 (2026-11-15)
- Correct MobileStart detection from RemoteEnable array to enable remote start

## 1.6.1 (2026-11-12)
- Remove redundant state.estimatedEndtime in favor of state.estimatedEndTimeText
- Device Manager cards render status, programme, phase, type and drying step in system language
- Raw states (status, programId, etc.) use localized option tables in ioBroker system language
- Import Home Assistant translations with corrections for missing languages
- Add descriptions (common.desc) in all 11 languages for control.can* and state.progress

## 1.6.0 (2026-11-12)
- Add ioBroker Device-Manager integration with live cards, status indicators, and actions
- Add state.progress (programme progress in percent 0..99%)
- Add control.canPowerOn, canPowerOff, canStart, canPause, canStop indicators

## 1.5.1 (2026-11-11)
- Add notice in admin backup settings that instance must be running for restore
- Auto-disable mDNS auto-discovery when manual device IPs are configured
- Ensure manual devices are active by default even when enabled is undefined
- Add state.estimatedEndtime state in hh:mm format for appliances

## 1.5.0 (2026-11-11)
- Implement powerOn/powerOff like official Miele app using DOP2 leaf 2/1586
- Add wake-up retry on HTTP 500, Dop1 support for coffee machines and status verification
- Remove uuid override breaking browser-sync in dev-server
- Update dependency overrides to resolve Dependabot security alerts
- Update Biome to 2.6.4 and exclude Markdown/YAML files from Biome formatting

## 1.4.0 (2026-10-26)
- Add optional Miele HTTP time server answering /V2/NTP/ requests for offline appliances
- Add optional appliance clock synchronization (keepDeviceClock) for Settings/TimeSync
- Add timeServer and keepDeviceClock settings to admin JSONConfig with full i18n
- Fix unhandled rejection in hourly appliance clock check
- Fix crash on mDNS socket errors in discovery and push listener
- Fix device request queue hanging forever on aborted HTTP responses
- Prevent overlapping polling cycles triggered by push, commands or discovery
- Remove stale device entry after IP change to stop info.connected flapping
- Discard outdated poll snapshots that arrive after a newer push update
- Subscribe to control states before discarding pending commands on startup
- Capture errors in ready and stateChange handlers instead of rejecting
- Abort pending appliance requests and mDNS discovery on adapter unload
- Run subnet fallback scan detached and skip known appliance IPs
- First appliance clock check now runs 2 minutes after start instead of after 1 hour
- Limit push request body size and time server client channels (max. 50)
- Use per-instance file name for the pairing challenge

## 1.3.1 (2026-10-18)
- Add subnet fallback scan to re-discover appliances after DHCP IP changes
- Add automatic retry for transient XKM socket drops during polling
- Discard and acknowledge pending control commands on adapter startup
- Sanitize remaining time to 0 for appliances in off or ended status
- Add update:dev script and enhance dev-server profile synchronization

## 1.3.0 (2026-10-11)
- Add per-device polling scheduler protecting XKM modules with active/idle intervals

## 1.2.0 (2026-09-27)
- Add optional SuperVision real-time push HTTP listener with mDNS service announce
- Add program and phase definitions for robotic vacuum cleaners and coffee systems
- Map local DOP2 raw phase IDs for washers, dryers, dishwashers, and ovens
- Add SolarSave program (ID 5) for dishwashers
- Upgrade actions/checkout & setup-node to v7 in auto-translate workflow
- Format translated files with Biome in auto-translate workflow
- Add informative logging for device registration, connection transitions and polling errors

## 1.1.2 (2026-09-23)
- Revert dishwasher EcoFeedback as dishwashers do not expose DOP2 leaf 2/6195

## 1.1.1 (2026-09-23)
- Enable EcoFeedback query and states for dishwashers (device types 7 and 8)

## 1.1.0 (2026-09-23)
- Parallelize setState calls in processState, add programPhase states map, and unify type aliases
- Restrict EcoFeedback states to washing machines until dryer/dishwasher DOP2 is supported
- Fix inUse state calculation to only report true while cycle is actively running
- Update hood light sensor state from live appliance telemetry
- Keep backup export and restore buttons active to prevent UI locking in jsonConfig
- Map raw Miele API dishwasher phase IDs (1793-1800) to human-readable labels

## 1.0.1 (2026-09-23)
- Only update sensor states supported by appliance profile to prevent missing object warnings

## 1.0.0 (2026-09-23)
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
