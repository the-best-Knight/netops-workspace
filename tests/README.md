# Tests

Everything here runs against `index.html` itself, so a test checks the code that ships. Nothing is installed: there is no `package.json` and no dependency.

## Syntax check

```sh
node scripts/check-scripts.mjs
```

Parses every script in `index.html`, including the tools embedded in it. It catches the kind of typo that stops a whole tool from starting.

## Engine tests (Node)

```sh
node tests/engine/suite.mjs      # 73 tests for the Topology Builder's network-data engine
node tests/engine/fuzz.mjs 800   # 800 batches of damaged and mixed-up device output; nothing may throw
```

```sh
for t in sanitizer configdiff calculator routing switching switchlab vsphere dns ping lessons content; do node tests/engine/$t.mjs; done
```

These run the other tools' own code, taken from `index.html` with no browser: `tests/engine/tool.mjs` cuts a tool's script out, runs it against a stub page, and hands back the functions a test asks for (`__set` and `__get` reach its other variables). Each file is named for its tool and its checks carry the finding ID of the technical review they came from.

| File | What it covers |
| --- | --- |
| `sanitizer` | YAML block scalars, Digest headers, hostnames, mask versus address, placeholders that never change, Windows Wi-Fi keys, `name=` values that are not paths, quoted and multiword profile names, linear time on long runs of spaces |
| `configdiff` | Reordered rules are never "unchanged", quote-aware whitespace |
| `calculator` | The generated ACL, iptables and nftables text, checked by running it |
| `routing` | Administrative distance 255 |
| `switching` | Spanning-tree cost and tie-breaks, `root secondary`, rejected commands, the console path, native VLAN, ACL grammar |
| `switchlab` | Every guided lesson on Cisco and Dell: `show inventory` against `show version`, port names against the WS-C2960CX-8TC-L, per-VLAN spanning tree and its summary (including VLANs above 1005), `root primary|secondary` stored per VLAN and kept across running-config and reload, IP addresses on Layer 2 ports, routed ports, `show vtp status`, `show interfaces status`, `ip routing`, and lessons 13 and 14 solved by their own hints |
| `vsphere` | Hot add, snapshot space, host reboot, VMware Tools |
| `dns` | CNAME with `ANY`, SRV with a root target |
| `ping` | mtr wording, loss placement, damaged numbers, Windows and Linux MTU failures, router error replies, no contradictory warnings |
| `lessons` | The access list lesson is fixed by correcting the rule |
| `content` | Wording claims in the README and the reference data |

`tests/engine/load.mjs` cuts the engine out of `index.html` (it is the part of the Topology Builder's script before the drawing code) and runs it with no browser. The inputs are in `tests/fixtures/`: realistic Cisco, Dell, Palo Alto, ESXi, Linux and Windows output written for the tests. The Windows output follows the layout of the real commands but is not captured from a machine.

## Browser tests (headless Firefox)

```sh
sh tests/run.sh                  # every test file
sh tests/run.sh fault-lab        # one file, named without .test.mjs
KIT=file:///path/to/other.html sh tests/run.sh hub-keys   # test a different build
```

Needs Firefox. If it is not in a standard place, set `FIREFOX=/path/to/firefox`. Each file gets a new browser profile, so every test starts like a first-time visitor. Files named `*.light.test.mjs` run with a light browser and `*.dark.test.mjs` with a dark one. A test that checks theme colours must be named for its theme: the GitHub runner opens a light browser, a Mac in dark mode opens a dark one, and an unpinned test passes on one and fails on the other. Downloads land in a temporary folder that the tests read, and screenshots some tests take go to the system temp folder, never into the repository.

| File | What it covers |
| --- | --- |
| `hub-keys` | Arrow keys on the main menu follow the layout of the cards |
| `branding` | The IK logo is at the top of the hub and every tool, and the banned words appear nowhere |
| `fault-lab` | Dell is the default, `?` lists commands per mode in alphabetical order, `show interface` output for Cisco and Dell |
| `fault-lab-free` | Free practice: a working network, no goal, no hints, never touches progress |
| `ping-analyzer` | ping, tracert, traceroute, mtr, WinMTR, pathping, Test-NetConnection, Test-Connection |
| `calculator-ipv6` | IPv6 address parsing and compression, the subnet calculator, split, EUI-64, the hand-over from the IPv4 tab |
| `topology-drawio` | The `.drawio` export: structure, escaping, shapes, links, no configuration data |
| `topology-windows-import` | The import dialog lists Windows and Linux, a pasted Windows session builds one server with its team, the switch joins its NICs by MAC, a PC invents no cable |
| `ui-standard.dark` / `ui-standard.light` | The kit's written UI standard (text of at least 11px, contrast of at least 4.5:1, controls at least 28px) measured on the IPv6 calculator, the analyzer's new cards, and the Fault Lab list and free practice |
| `topology-*` | The Topology Builder: importing files, links and health, manual edits, VLAN and path views, search, projects and snapshots, encrypted copy, layout, contrast in both themes, the written UX standard |

A test counts as a failure when a check fails or when the page logs a console error.

## When a test fails

Run that file on its own and read the first `FAIL` line: it prints what the page returned. The browser tests drive the real page with real key presses and mouse events, so a failure usually means something a person would also see.

## Script Repository

`node tests/engine/scriptrepo.mjs` checks script-byte integrity, show/hide state, clipboard success and fallback, and manual-copy recovery. CI runs it with the other tool tests. `sh tests/run.sh script-repo` covers the real hub/search, Help, show/hide and copy controls. These checks do not execute the PowerShell scanner.
