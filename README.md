# IT Skills Kit

[![Check scripts](https://github.com/the-best-Knight/network-skills-kit/actions/workflows/check.yml/badge.svg)](https://github.com/the-best-Knight/network-skills-kit/actions/workflows/check.yml)

Offline networking and IT tools in a single HTML file. Thirteen tools: eight for everyday work and five for practice. No server, no install, and no external requests. Everything runs in your browser.

**[Open it live](https://ianknight.org/tools/network-skills-kit.html)** · **[Download `index.html`](https://raw.githubusercontent.com/the-best-Knight/network-skills-kit/main/index.html)** · [How it was built](https://ianknight.org/projects/it-skills-kit/)

![The IT Skills Kit home screen, listing the work tools and practice labs](docs/screenshots/hub.png)

## What's inside

**Work tools**

| Tool | What it does |
| --- | --- |
| Script Repository | Copy PowerShell scripts, starting with Free IP Finder (Invoke-LabScan), to run in your own console |
| Log Sanitizer | Hides IPs, passwords, usernames and other secrets in a log before you share it |
| OSI & Network Reference | Layers, protocols and ports, plus a symptom-based guide to the likely cause of an outage |
| Network Calculator | Subnet, IPv6, VLSM, supernet, split and ACL wildcard math, bandwidth and hash calculators, converters |
| Cheat Sheet | Copy-ready switch and router commands (Cisco IOS, Dell OS10, Dell OS9, Junos), ports, terms and error messages. The Dell OS9 sheet is reference only: the Network Fault Lab simulates OS10, not OS9 |
| Config Diff | Compare two configs and see exactly what changed |
| Ping / Traceroute Analyzer | Paste ping, traceroute, mtr or pathping output and spot loss and slow hops. Also reads WinMTR, Test-NetConnection and Test-Connection |
| Network Topology Builder | Draw a network diagram, or build one from device configs, and export it as PNG, SVG, draw.io, JSON or CSV |

**Practice labs**

| Lab | What it does |
| --- | --- |
| DNS Lab | Offline DNS simulator: dig-style queries, a zone database, broken-record scenarios |
| Routing Lab | Longest-prefix match, live routing tables, packet path visualization |
| Firewall Rules Lab | ACL simulator: ordered rules, a packet tester, implicit deny, policy scenarios |
| Network Fault Lab | Diagnose-and-fix scenarios with a live topology and a practice switch or router console (Dell OS10 or Cisco IOS), plus a free practice network with no goal |
| vSphere Sandbox | Practice common vSphere tasks in a safe offline copy |

The Script Repository displays and copies scripts; it does not run them in the browser. Free IP Finder sends network probes when you run the copied script in PowerShell. Nonresponding addresses are candidates to check against DHCP and address records before use.

## Private by design

- **No network requests.** Each tool carries a strict Content Security Policy that blocks outbound connections, so what you paste has nowhere to go.
- **Nothing uploads.** Settings are kept in your browser's local storage and nowhere else.
- **Encrypted exports.** The Log Sanitizer's session map and other saved state that holds secrets or network details are encrypted with AES-GCM or OpenSSL-compatible encryption. The sanitized text itself is plain text when you copy it or use Download Text, and detection can miss things, so read it before you share it.

## Log Sanitizer

Paste a log, config dump, or command output and it redacts sensitive values as you type: internal IPs, hostnames, usernames, API keys, tokens, passwords, and anything matching a pattern you add. Use it before a log goes into a support ticket, a vendor case, a chat, or an AI tool.

![The Log Sanitizer with an example config on the left and the redacted version on the right](docs/screenshots/log-sanitizer.png)

- **Checks its own work.** A leak scan and an independent double-check run after every redaction, and a self-test runs when the page loads.
- **Reversible.** A dictionary keeps what each placeholder replaced, so a reply that still has the placeholders can be restored in the same session.
- **Configurable.** Sensitivity presets (Strict, Standard, Technical, Audit-only), detection profiles for Cisco, Dell OS10, VMware/ESXi, Windows/AD and Kubernetes, and your own rules.

## Network Topology Builder

Draw a diagram by hand, or import configs and show output from Cisco, Dell, Palo Alto and VMware ESXi, plus the network commands of Linux and Windows servers, and let it build the diagram. Links are only drawn when the data supports them.

![The Network Topology Builder showing a sample network with a DMZ and a datacenter zone](docs/screenshots/topology-builder.png)

## Using it

Open `index.html` in a current desktop browser (Chrome, Edge, Firefox or Safari). It is built for a mouse and keyboard. Each tool is embedded in the file and loads on demand, so there is nothing to install or configure.

## Checking the file

`index.html` is one large file, and a single syntax error in a script stops that whole script from running. Before pushing a change, run:

```bash
node scripts/check-scripts.mjs
```

It syntax-checks every script in the page and in each embedded tool, and exits with an error naming the tool if anything fails to parse. It needs Node 18 or newer, and the same check runs on every push.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Use it, change it, and share it, and keep the copyright notice.

---

Built by [Ian Knight](https://ianknight.org).

## Tests

`sh tests/run.sh` runs the browser tests in headless Firefox, and `node tests/engine/suite.mjs` runs the engine tests. Both test `index.html` itself, and neither needs anything installed. See [`tests/README.md`](tests/README.md).
