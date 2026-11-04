# How the kit is put together

The whole kit is one file, `index.html`. It has no server, no build step and no outside requests, so you can open it from a USB stick.

## The shape of the file

```
index.html
├── the main menu: HTML and CSS for the list of tools and the workspace around them
├── thirteen blocks, one per tool:   <script type="text/plain" id="src-log-sanitizer"> ... </script>
│     each block holds that tool's complete page (HTML, CSS and JavaScript)
└── one script at the bottom: the menu logic (search, pins, switching tools)
```

A tool is stored as plain text, not as running code. When you open it, the menu loads that text into an iframe inside the page. That keeps each tool's code, styles and saved settings apart from the others.

Inside a block, `</script>` is written `<\/script>` so the block does not end early. Every script is formatted and commented so you can read it.

## The thirteen tools

| Block id | Tool | Where to start reading |
| --- | --- | --- |
| `src-script-repo` | Script Library | `SCRIPTS`, then `copyText` and `setCodeVisible` |
| `src-log-sanitizer` | Log Sanitizer | `SANITIZATION_RULES`, then `sanitizeText` |
| `src-toolkit` | Network Calculator | `runCalc`, `runVlsm` |
| `src-practice-ref` | Cheat Sheet | `scoreRow`, `findRows` |
| `src-osi-ref` | Network Reference | `buildIndex`, `lookup` |
| `src-config-diff` | Config Compare | `compare`, `myers` |
| `src-ping-analyzer` | Connectivity Analyzer | `parsePing`, `parseTrace`, `parseMtr` |
| `src-topology-builder` | Topology Builder | `var NM` (the engine), then `var NS` (the drawing) |
| `src-dns-lab` | DNS Lab | `query` |
| `src-routing-lab` | Routing Lab | `bestRoute`, `tracePath` |
| `src-firewall-lab` | Firewall Rules Lab | `evaluate` |
| `src-fault-lab` | Switch Lab | `runConsoleCommand`, `goalMetNow` |
| `src-vsphere-sandbox` | vSphere Sandbox | `baseState` |

Cheat Sheet data lives in the `kit-data` JSON block. `switchCheat` holds the Cisco and Dell OS10 rows side by side, `junosCheat` and the others hold one vendor each, and `os9Cheat` holds Dell OS9. An OS9 row has `os9` (the command), `mode` (CLI mode), `src` (an id in `docs/reviews/2026-11-03-os9-sources.md`), `ver` (`doc`, `index` or `review`), `tags`, and optionally `tip` and `risk: "disrupt"`. To add a row, add its source to that file first. `tests/engine/os9cheat.mjs` checks the rows.

The first line of each tool's script is a short comment saying what the tool does, with an example.

## Rules the code follows

- **Offline.** No network calls of any kind. A test checks the Topology Builder engine for this.
- **Nothing readable is stored.** Saved state with network details or secrets, such as the Log Sanitizer's session map and the Topology Builder's exports, is encrypted (AES-GCM, with a key from your passphrase using PBKDF2). The Log Sanitizer's sanitized text is the one plain-text output: copy and Download Text leave it readable on purpose.
- **The simulated labs are simulations.** The DNS, routing, firewall, fault and vSphere labs never touch a real device or network.

## Checking a change

```sh
node scripts/check-scripts.mjs   # every script parses (each tool's script is checked too)
node tests/engine/suite.mjs      # engine tests: the Topology Builder's reader, in Node
node tests/engine/fuzz.mjs 800   # throws random input at the reader; nothing may crash
sh tests/run.sh                  # browser tests in headless Firefox, one file at a time
```

The browser tests open `index.html`, click through the tools and check what is on screen. A test that depends on colours is named `*.dark.test.mjs` or `*.light.test.mjs`, so it runs in the right browser theme.

The Script Library embeds its PowerShell script as text. Its JavaScript only displays and copies that text; executing it is a separate PowerShell action.
