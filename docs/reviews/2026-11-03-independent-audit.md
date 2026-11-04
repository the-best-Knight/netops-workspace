# IT Skills Kit independent audit, 3 November 2026

Baseline: `main` at `b6f5f825f4542dd85dc7edabce2b4c9323e6734f` (Dell OS9 sheet and the UI redesign both merged).
Baseline note: during the audit `main` moved to `e1f9add` (commit `0806585`, "Rebrand to NetOps Workspace", 16 files, 62 lines of `index.html`, mostly names and test strings). Probes and the browser runs were made against the working tree as it stood at the time, so some ran before and some after that change. The syntax check and all 15 engine runners were re-run on `e1f9add` and pass. None of the findings below touch the renamed text, but they were not each re-confirmed after the rename. The product is called IT Skills Kit throughout this report because that was its name at the baseline.
Scope: audit only. No application code, test or branch was changed. This file is the only addition and is uncommitted.

## 1. Executive summary

The kit is in good shape for a 2.9 MB single-file offline tool. Everything that was run on this commit passes, there is no external network code, and nothing the audit tried crashed a tool or took out saved settings. No Critical finding was made.

The weak spots are these:

1. **The Log Sanitizer, the tool whose whole job is not leaking, has real redaction gaps** (AU-01, AU-03, AU-04) and a size cliff: a 266 KB paste finishes in 1.5 s, a 532 KB paste had not finished after 90 s (AU-02).
2. **The Network Fault Lab's Cisco console accepts Dell OS10 syntax** (AU-05), so vendor separation is looser than the README implies.
3. **Half of the Dell OS9 sheet looks more certain than it is.** 92 of 188 rows were only confirmed to exist in Dell's command index, and they carry no badge (AU-06). 26 more carry a `verify` badge. Nothing was run on a real switch.
4. **The tests do not cover everything the README suggests.** CI runs neither the browser suite nor the UI token test, and the Firewall Lab and OSI Reference have no dedicated tests (AU-07, AU-08).

What was not done, so that nothing here is read as more than it is: no test on Windows, Chrome, Edge or Safari (only Firefox 159.0.1 headless on macOS), no run of the PowerShell in the Script Repository (no PowerShell here), no hand-driven keyboard walk through every tool, and no real-hardware check of any command.

## 2. What was actually run

| Check | Result |
| --- | --- |
| `node scripts/check-scripts.mjs` | 20 scripts, 0 failed |
| Engine runners: suite 73, sanitizer 40, configdiff 9, calculator 5, routing 4, switching 23, switchlab 41, vsphere 8, dns 11, ping 23, lessons 6, content 8, scriptrepo 9, os9cheat 18, uitokens 69 | all pass, 0 failed |
| `node tests/engine/fuzz.mjs 400` and `3000` | 0 exceptions, 0 slow batches, prototype clean |
| Browser suite (`tests/run.sh`, headless Firefox) | 26 of 26 files pass (run from a copy of `tests/` on a private debug port against this commit's `index.html`; an earlier run that was not pointed at the file failed 24 files because no tool opened, which was a launch error and not an app result) |
| New probes written for this audit (not added to the repo) | sanitizer redaction (about 55 inputs), sanitizer timing in Node and in the page, Config Diff (11 cases), Calculator (60 calls), Fault Lab console (about 60 commands, both vendors), script injection into 9 inputs, storage corruption (7 variants over 12 keys, 14 screens each), accessibility scan of 13 tools in both themes at 1440 and 320 px, sanitizer storage dump |

Probe sources are not committed. The findings below give the input and output so each can be repeated by hand.

## 3. Tool-by-tool assessment

| Tool | Intended capability | Assessment |
| --- | --- | --- |
| Log Sanitizer | Hide IPs, hostnames, secrets; restore from a dictionary | Strong on credentials in standard config forms (Cisco type 5/7/9, SNMP, TACACS/RADIUS, OSPF, BGP, ISAKMP, NTP, JWT, AWS keys, PEM, Digest, crypt hashes all hidden, and every round trip restored). Gaps: AU-01, AU-03, AU-04, AU-02, AU-11. No secret reached browser storage. |
| Config Diff | Compare two configs | Correct on every case tried: CRLF versus LF, blank lines, case, indent changes (reported as changed), quoted inner spaces, duplicates, swaps. 160,000 lines compared in 0.3 s. Clean. |
| Network Calculator | Subnet, IPv6, VLSM, ACL, converters | Sampled results correct (/31 and /32 host counts, mask validation, range to CIDR, address types). One small mislabel (AU-14). Few tests for its size (AU-08). |
| Ping / Traceroute Analyzer | Read ping, traceroute, mtr output | No problem found in the sampled inputs; covered by 23 engine and a browser file. Not independently fuzzed beyond that. |
| Network Topology Builder | Draw or import a diagram | Existing suite is the strongest in the repo (many browser files, security and encryption tests). Not independently probed in this audit beyond layout and labels. |
| Cheat Sheet | Copy-ready commands | OS10, Cisco, Junos rows protected by a baseline test. OS9 data: see section 4. |
| OSI & Network Reference | Look-up and symptom guide | Renders in both themes and at 320 px. No dedicated test (AU-08). |
| Script Repository | Show and copy PowerShell | Not executed: no PowerShell available. Static read only. It limits the scan to /8 to /30 and 8192 hosts by default. Unverified. |
| Network Fault Lab | Switch and router console, 18 labs | Parser and per-mode errors behave like the real CLI in the cases tried. Vendor leaks: AU-05, AU-12. Progression is covered by `switchlab` and `lessons`. |
| DNS Lab, Routing Lab, Firewall Lab, vSphere Sandbox | Practice simulators | DNS and Routing have engine tests. Firewall Lab has none (AU-08). vSphere Sandbox has the weakest contrast and smallest text of any tool (AU-10). Not otherwise audited. |

## 4. Dell OS9 Cheat Sheet (188 rows)

| Level | Rows | Meaning | Badge on the sheet |
| --- | --- | --- | --- |
| `doc` | 70 | Syntax and mode read on a Dell page (per `2026-11-03-os9-sources.md`) | none |
| `index` | 92 | The command name is in Dell's command index. Options were not read. | **none** |
| `review` (`verify`) | 26 | Not confirmed for every release | `verify` |

Real-hardware validation: none, for any row.

What this audit added, from Dell pages found by web search (search summaries, not full page reads):

- `mtu 9252` was wrong for the S4048-ON, whose documented range is 592 to 9216. Other platforms differ (S3048-ON 594 to 12000, S5048F-ON 594 to 9416). Fixed before this audit in `d1c7152`.
- `mac-address-table static MAC output INTERFACE vlan N` matches the documented CONFIGURATION form. `neighbor X remote-as N` plus `neighbor X no shutdown` in ROUTER BGP matches Dell's configuration guides. Both were promoted to `doc` before this audit.
- Still `verify`, assessed now:
  - `show interfaces transceiver`: Dell pages exist for several platforms. The S4048-ON page was not seen and the exact form (port first or not) is unconfirmed.
  - `show hardware counters interface tengigabitethernet 1/1`: an S4048-ON 9.14.2.4 page exists. The mode was not confirmed.
  - `show environment`: listed in the S4048-ON command list. Syntax and mode not confirmed.
  - `ping ipv6 ADDR` and `traceroute ipv6 ADDR`: Dell's ping and traceroute pages show a plain `ipv6-address` parameter. The `ipv6` keyword is how Cisco IOS writes it. **Possible IOS syntax; unconfirmed either way (AU-13).**
  - OSPF `network a.b.c.d/len area N`: `network ... area` is listed in the 9.14 command reference. The argument form was not seen.
  - The other `verify` rows (ACL create, apply and remove, VLT domain, VRRP, port mirroring, DHCP relay, `management route`, `ip name-server`, `copy running-config` backups, `clear counters` with a port, `show running-config | grep`, `show mac-address-table address`, `show spanning-tree pvst vlan`, `clear ip bgp ADDR`): not researched in this audit. They read as normal OS9 forms to a reader who knows FTOS, which is an opinion, not documentation.
- The platform limits are real and are stated in the sources record: port names differ by platform, `default interface` needs 9.9 or newer, port-channel limits differ.
- The OS10 simulator is not affected: the `os9cheat` test checks that OS10, Cisco and Junos rows and the Fault Lab are unchanged, and it passes.

## 5. Findings

Legend: **Confirmed** means it was reproduced on this commit. **Code-evident** means it follows from reading the code but was not run. **Potential** means a risk. **Unverified** means an assumption that was not checked against a source.

### Critical

None found.

### High

**AU-01 (Confirmed) Log Sanitizer leaves device hostnames in CLI prompts.**
Steps: sanitize `core-sw01#show run`, `core-sw01(config)#hostname core-sw01` and `hostname core-sw01` together in Strict mode.
Result: only the last line changes (`hostname node-1`); the prompt lines keep `core-sw01`. `admin@fw-edge-01:~$` and `[root@db-prod-07 ~]#` also pass through. A prompt-only paste (`edge-rtr-nyc#show ip int brief`) is untouched.
Why it matters: pasted device sessions almost always start with the prompt. The name the tool hides in one place is shown in another.
Location: hostname rules in `SANITIZATION_RULES`, `sanitizeText` (`src-log-sanitizer`).

### Medium

**AU-02 (Confirmed) Log Sanitizer has a size cliff in the page.**
Steps: paste generated interface blocks into the input box (`interface Gi0/N`, `ip address 10.x.y.1 255.255.255.0`, `description host-N.corp.local`).
Result: 88 KB ready in 0.7 s, 266 KB in 1.5 s, 532 KB not finished after 90 s. The input box stayed responsive (main thread blocked 55 to 230 ms). The same text through `sanitizeText` alone in Node: 193 KB 0.4 s, 774 KB 3.4 s, 2.3 MB 26 s. So the engine is slow but the page is far slower. The step that explodes was not identified (leak scan, double-check, highlighting or restore are candidates; this is a guess).
Why it matters: real device dumps reach several hundred KB, and the output simply does not appear.

**AU-03 (Confirmed) Some Wi-Fi keys are not redacted.**
Input and output: `set key PanKey!77`, `wpa-passphrase WpaPass1234` and `ssid "CorpGuest-Wifi" key Hunter2!` pass through unchanged. `wpa-psk ascii 0 ...`, `pre-shared-key`, `key-string`, `set-key ascii 0 ...` are hidden.

**AU-04 (Confirmed) A password written in a `description` line is not redacted.**
Input: `description uplink password 0 pw1`. Output: unchanged. The same text on its own line is hidden.

**AU-05 (Confirmed) The Cisco console accepts Dell OS10 syntax.**
Steps: Fault Lab, Cisco, `enable`, then `show interface ethernet 1/1/1`. Result: full `GigabitEthernet0/1` output. `show running-configuration` (not an IOS form) is also accepted.
Why it matters: a learner can practise a command that fails on real IOS.
Location: `runConsoleCommand` and the interface-name resolver in `src-fault-lab`.

**AU-06 (Confirmed) 92 OS9 rows look as certain as the 70 documented ones.**
Only the 26 `review` rows show a badge. The `index` rows (for example `show ip bgp summary`, `show ip ospf neighbor`, `show vlt brief`) show none, although their options were never read on a Dell page. The sources file says so; the sheet does not.

**AU-07 (Confirmed) CI runs less than the repo's own tests.**
`.github/workflows/check.yml` runs the syntax check, `suite`, thirteen engine runners and `fuzz 400`. It does not run `tests/run.sh` (26 browser files) or `tests/engine/uitokens.mjs`. A UI or Cheat Sheet browser regression would not fail a pull request.

**AU-08 (Confirmed) Test gaps.**
- No dedicated test for Firewall Lab or OSI & Network Reference.
- Log Sanitizer: no test of the UI, copy, restore flow, dictionary import, or its AES-GCM export. (Encryption is tested only for the Topology Builder.)
- Network Calculator: 6 engine checks plus one IPv6 browser file. IPv4 subnetting, VLSM, supernet, conflict checker, bandwidth and hash verifier have no tests.
- No test for two tabs, storage corruption, or focus order.
- The focus ring is only tested as "a 2 px rule exists" (headless Firefox never has focus).

**AU-09 (Code-evident, not run) Two tabs overwrite each other's Fault Lab progress.**
`saveProgress()` writes the whole in-memory `progress` object to `nfl_progress2`; it is read once at start and nothing re-reads or merges, and the code has no `storage` event listener. A lab finished in tab A is lost when tab B saves. Unreadable saved progress is handled well: it is copied to `nfl_progress2_unreadable` first.

**AU-10 (Confirmed) vSphere Sandbox fails contrast and text-size checks in both themes.**
13 text items below 4.5:1 (ratios 2.2 to 3.4), including status badge, "Built by" credit, live clock and "Select an object". Text sizes of 10.5 and 7 px (the status badge). Every other tool had 0 text-size failures.

### Low

**AU-11 (Confirmed) Replacement addresses keep the real last octet and prefix length.**
`10.20.30.40` becomes `192.0.2.40`; `10.10.0.0/16` becomes `192.0.2.0/16`. Serial numbers and service tags (`FOC1234X5YZ`, `7XK3R93`), phone numbers, names and a spaced-out address (`192 . 168 . 1 . 11`) are not redacted. The UUID is.

**AU-12 (Confirmed observation, assumption attached) Dell console edges.**
The Dell console accepts `show mac-address-table` (an OS9 and IOS form) without the lab note it gives for `show interfaces status`. Separately, `show` commands typed in configuration mode are rejected (`Invalid input`). Whether real OS10 accepts them there is **Unverified**; the audit did not check Dell's OS10 documentation.

**AU-13 (Potential) OS9 `ping ipv6` and `traceroute ipv6`.** See section 4.

**AU-14 (Confirmed) Calculator labels 192.0.0.1 "Public / other".** 192.0.0.0/24 is reserved for IETF protocol assignments. Trivial.

**AU-15 (Confirmed) Small contrast misses.** Firewall Lab `x` buttons 3.85:1 (light), Script Repository `PowerShell` tag 4.37:1 (light). Disabled Undo and Redo in the Topology Builder measure 1.95 to 2.47 (disabled controls are exempt).

**AU-16 (Potential) Tool frames are not sandboxed.**
The `iframe` has no `sandbox` attribute. Opened as a local file the origin is `null`, so tools cannot read each other's storage. If the file is served over HTTP (the README links a live copy), tools share the site's origin and storage. Script injection was tried in 9 inputs (hub search, Ping Analyzer, Config Diff, Log Sanitizer, Cheat Sheet and OSI search, Calculator, DNS Lab, Fault Lab console) and none executed. This is defence in depth, not a found bug. The Topology Builder import path was not probed.

**AU-17 (Confirmed) README screenshots are out of date.** `docs/screenshots/` dates from 2 November and shows the old design.

## 6. Checked and found sound

- **Offline:** no `fetch`, XHR, WebSocket, worker or beacon calls; no stylesheet, script or font from outside; every font is a `data:` URI; CSP in each frame blocks connections. This was verified on macOS with Firefox from a `file://` URL. Windows was not tested.
- **Storage corruption:** truncated JSON, `null`, `[]`, a number, a `__proto__` object, a 4 MB string and a lone surrogate, written over all 12 saved keys, left all 14 screens rendering with no console error. Keys a tool creates only after deeper use (for example topology projects) were not covered.
- **Storage leakage:** after sanitizing a secret, a hostname and an address, none of the three was in localStorage or sessionStorage.
- **Layout:** no tool scrolls sideways at 320 px in either theme. No tool has a positive `tabindex`, an unlabeled control or a clickable non-button element.
- **Config Diff and Calculator** (see section 3).
- **Fuzz:** 3000 batches, 0 exceptions.

## 7. Documentation accuracy

- README: tool counts (13: 8 and 5), the private-by-design claims and the OS9 note match the code. The sheet list under Cheat Sheet names four systems; the sheet also has Linux, ESXi, NSX, VxRail, PowerShell, cmd and Proxmox.
- `tests/README.md` and `docs/ARCHITECTURE.md` match the file layout. ARCHITECTURE says every script is readable; about 100 KB of the file is now base64 font data.
- `docs/reviews/2026-11-03-os9-sources.md` is accurate and is the honest record of OS9 certainty (see AU-06 for what the sheet shows).
- Screenshots: AU-17.

## 8. Prioritised remediation plan

1. **AU-01, AU-03, AU-04** Add prompt hostnames, the missing Wi-Fi key forms and description-line secrets to the Sanitizer rules, with tests. Small, high value.
2. **AU-02** Find which stage makes the page slow past about 300 KB, and either fix it or show a clear "large input" message. Measure first.
3. **AU-06** Show a quiet badge on `index` rows, or mark the OS9 sheet with its verification mix. Cheap.
4. **AU-07** Add `uitokens` and a browser job (headless Firefox is available on GitHub runners) to CI.
5. **AU-05, AU-12** Make the Cisco console refuse Dell syntax and decide on a lab-note policy for the Dell console. After checking Dell's OS10 documentation for `show` in configuration mode.
6. **AU-08** Add tests in this order: Log Sanitizer restore and export, Firewall Lab, OSI Reference, IPv4 Calculator tabs.
7. **AU-10, AU-15** Contrast and size pass over vSphere Sandbox, and the two small misses.
8. **AU-09** Re-read saved progress before writing, or listen for `storage` events.
9. **AU-13** Check `ping` and `traceroute` against Dell's OS9 pages before keeping the `ipv6` keyword.
10. **AU-16, AU-17, AU-11, AU-14** As time allows.

## 9. Scorecard (1 to 10, from the evidence above)

| Area | Score | Basis |
| --- | --- | --- |
| Correctness | 7 | Every engine and fuzz check passes; no wrong output found in Config Diff or the Calculator; Sanitizer and console gaps are real. |
| Reliability | 8 | Survives corrupt storage, deep fuzzing, 320 px layouts; one large-input cliff; multi-tab overwrite not run. |
| Security | 6 | No network code and no script injection found, no secret in storage. Redaction gaps in a tool whose purpose is redaction, unsandboxed frames. |
| Usability | 7 | Clean, consistent after the redesign; hang on large pastes. |
| Accessibility | 7 | Labels, tab order basics and 320 px pass; vSphere and a few buttons miss contrast; focus ring only rule-checked; no hand walk through each tool. |
| Performance | 6 | Fast on normal sizes; Sanitizer degrades sharply past a few hundred KB. |
| Maintainability | 6 | Good tests for the engines; a 2.9 MB single file; CI runs a subset; test gaps in four tools. |

These scores are judgments from what was run. They would change with Windows, Chrome and Edge testing and with real hardware checks.

## 10. Not verified

Windows and non-Firefox browsers; the PowerShell script; real Dell or Cisco hardware; Dell OS10 documentation for configuration-mode `show`; most of the 26 OS9 `verify` rows; Topology Builder import and export paths beyond the existing suite; DNS, Routing and Firewall lab logic beyond existing tests; a manual keyboard walk through every tool.
