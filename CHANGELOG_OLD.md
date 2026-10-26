# Older changes
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
