# NetOps Workspace deep audit

Audit date: 4 November 2026. Auditor: Claude (Sonnet 5.5). Read-only: no application code, branch, setting or workflow was changed, and nothing was pushed.

## 1. Executive summary

NetOps Workspace is in good shape. Every automated check passes, the calculator and the Topology Builder engine matched independent calculations with zero mismatches, and nothing I tried produced script injection, prototype pollution or a broken tool from corrupted saved data. I found **no Critical and no High issues**.

I confirmed **11 findings (5 Medium, 6 Low)** and have **1 unverified finding** about four Dell OS10 cheat sheet rows.

The five Medium findings:

1. **DA-01 Switch Lab progress is lost between tabs.** The second tab to save overwrites the first tab's completed lessons and the Cisco/Dell choice. Reproduced.
2. **DA-02 Log Sanitizer slows down quadratically.** 531 KB of log lines with many different IPs and hosts takes 5.1 s. 1.08 MB takes 20 s.
3. **DA-03 Log Sanitizer leaks a positional password.** `net use Z: \\fs01\share /user:corp\bob Secr3t99` has the user and server replaced and the password left in clear text.
4. **DA-04 Switch Lab answers "Invalid input" to real commands.** Examples: `spanning-tree vlan 10 priority 4096` and `interface port-channel 1` on Cisco, `interface range ethernet 1/1/1-1/1/3` on OS10. A learner is told their correct syntax is wrong.
5. **DA-05 `channel-group` is accepted and does nothing.** No message, and `show etherchannel summary` says no port-channels exist.

What I did **not** do (details in section 15): no real Dell or Cisco hardware, no Chrome or Edge (Firefox on macOS only, and your users are on Windows), no screen reader, and I did not re-research the 26 OS9 `verify` rows. I reviewed the OS10 cheat sheet column in full but not the Cisco or Junos columns.

## 2. Repository baseline and audit scope

| Item | Value |
| --- | --- |
| Commit examined | `8217c57a75bd27846cd646a840462df69a4f3b36` (origin/main, "Hub: alphabetical tools, arrow keys skip stars, Ctrl+S pins the selected card") |
| How | Fresh clone of the local repo into a scratch folder, checked out at that SHA. The shared working copy and the other session were not touched. |
| Not included | Local commit `effb0a8` (the earlier audit report, unpushed). Not application code. |
| Remote name | The GitHub repo is now `the-best-Knight/netops-workspace`. The local checkout's `origin` still says `network-skills-kit` (GitHub redirects). |
| File | `index.html`, 2,949,361 bytes, 13 embedded tools, 20 scripts |
| Browser | Firefox headless, macOS, own port (9611), own profile per run, processes stopped by PID only |

The 13 tools match the application: Work tools Script Library, Log Sanitizer, Network Reference, Network Calculator, Cheat Sheet, Config Compare, Connectivity Analyzer, Topology Builder. Practice labs DNS Lab, Routing Lab, Firewall Rules Lab, Switch Lab, vSphere Sandbox. Block ids: `script-repo`, `log-sanitizer`, `osi-ref`, `toolkit`, `practice-ref`, `config-diff`, `ping-analyzer`, `topology-builder`, `dns-lab`, `routing-lab`, `firewall-lab`, `fault-lab`, `vsphere-sandbox`.

The earlier audit file (`docs/reviews/2026-11-03-independent-audit.md`, AU-01 to AU-06) was not re-verified, except the Log Sanitizer speed claim (see DA-02).

## 3. Test execution results

| Suite | Result |
| --- | --- |
| Syntax check (`scripts/check-scripts.mjs`) | 20 scripts, 0 failed |
| Engine: suite 73, sanitizer 40, configdiff 9, calculator 5, routing 4, switching 23, switchlab 41, vsphere 8, dns 11, ping 23, lessons 6, content 11, scriptrepo 9, os9cheat 18, uitokens 69 | All pass |
| Fuzz (400 batches, 56 devices) | 0 exceptions, Object.prototype clean |
| Browser (27 files, run serially with my own runner) | 27/27 files, 679/679 checks |

Evidence: `evidence/engine-run.txt`, `evidence/browser-run.txt`.

I ran the browser files with my own copy of the runner (different port, stops only its own Firefox). The repo's `tests/run.sh` does `pkill -f "remote-debugging-port 9333"`, which is why it collides with other sessions (DA-10).

## 4. Scorecard

| Area | Score | Evidence |
| --- | --- | --- |
| Technical correctness | 8 | 20,000+ randomised IPv4/IPv6/range/split cases matched independent references with 0 mismatches. Routing lookup order is right. Config Compare is correct on 16 targeted cases. The Switch Labs reject most bad input correctly (VLAN 5000, bad masks, overlap, bad next hop). Held back by DA-04, DA-05, DA-08 and the unverified OS10 rows. |
| Functional completeness | 7 | Everything advertised that I touched exists. LAG and STP are only partly simulated, and the lab does not say so clearly (DA-04, DA-05). |
| Reliability | 8 | 21 storage keys × 6 corrupt values × 13 tools: every tool still opened. 30 open/close cycles: no leaked frames, DOM node count constant. Lowered by DA-01. |
| Security | 8 | No injection found in 12 tools plus Topology Builder. Encryption is sound (AES-GCM-256, PBKDF2 600k, random salt and IV, iteration bounds). No network code. CSP gives little protection because tools share an origin and allow inline script (DA-09). |
| Privacy | 7 | 51 of 55 synthetic secret shapes were redacted and restored exactly. Leak classes in DA-03 and DA-07. |
| Offline operation | 9 | `connect-src 'none'` and `default-src 'none'` in every tool, no external requests found, loads in about 105 ms from disk. |
| Usability | 7 | Not measured with real users. Mixed: the focus ring and keyboard order look sound, the lab error wording is a problem (DA-04). |
| Accessibility | 6 | Limited by what I could check: one real-Tab walk of the hub, heading, label and name scan of every tool. No screen reader, no Windows high contrast. |
| Performance | 8 | Topology engine: 400 devices applied in 347 ms. Config Compare: 60,000 lines in 140 ms. Sanitizer: see DA-02. |
| Maintainability | 6 | One 2.9 MB file with minified long lines is by design. Tests are good. Single-file edits stay risky. |
| Test quality | 8 | Many tests run the shipped code and use independent expected values. Gaps in section 11. |
| Documentation | 8 | README, tests README and live site agree on names and counts. Small items in DA-11. |

## 5. Findings summary

| ID | Tool | Severity | Status | Title |
| --- | --- | --- | --- | --- |
| DA-01 | Switch Lab | Medium | CONFIRMED | Two tabs overwrite each other's lesson progress and vendor choice |
| DA-02 | Log Sanitizer | Medium | CONFIRMED | Processing time grows with the square of the number of different values |
| DA-03 | Log Sanitizer | Medium | CONFIRMED | Password given as a bare argument is not redacted (`net use`) |
| DA-04 | Switch Lab | Medium | CONFIRMED | Real commands are rejected with "Invalid input" instead of "not simulated" |
| DA-05 | Switch Lab | Medium | CONFIRMED | `channel-group` accepted with no effect and no message |
| DA-06 | Log Sanitizer | Low | CONFIRMED | Four-part version numbers are turned into IP addresses; one URL form loses its query |
| DA-07 | Log Sanitizer | Low | CONFIRMED | Bare short hostname, hex or decimal IPs, and full-width keywords are not redacted |
| DA-08 | Switch Lab | Low | CONFIRMED | Small IOS fidelity differences (missing VLAN message, duplicate VLAN 1002 row, uncompressed trunk list) |
| DA-09 | Hub, all tools | Low | CONFIRMED (design) | Tools share one origin and the CSP allows inline script, so escaping is the only barrier |
| DA-10 | Test runner | Low | CONFIRMED | `tests/run.sh` kills Firefox by port pattern and uses a fixed port |
| DA-11 | Docs, repo | Low | CONFIRMED | Remote still named `network-skills-kit`; live file is not byte-identical to main |
| DA-12 | Cheat Sheet (OS10) | Low to Medium | UNVERIFIED | Four OS10 rows may not be valid OS10 syntax |

Top 10 to fix first, in order: DA-03, DA-04, DA-05, DA-01, DA-02, DA-12 (verify), DA-06, DA-07, DA-08, DA-09.

## 6. Tool-by-tool findings

### DA-01 Switch Lab: lost update across tabs (Medium, CONFIRMED)
- **Steps:** Open Switch Lab in tab A and tab B (both load progress once at start). In A complete lesson 1. In B complete lesson 2. Read `localStorage.nfl_progress2`.
- **Expected:** both lessons recorded.
- **Actual:** `{"2":{"completed":true,...}}` only. Lesson 1 is gone. Setting the vendor to Cisco in A and then saving progress in B put the vendor back to `dell`.
- **Location:** `index.html:33868-33895` (progress read once into memory, `saveProgress()` writes the whole object and `nfl_vendor`), `index.html:38366` (lesson completion).
- **Evidence:** `evidence/multitab.txt`.
- **Cause:** the save writes in-memory state, not a merge with what is stored.
- **Fix:** in `saveProgress`, re-read storage, merge in this tab's changes (union of completed lessons), then write. Only write `nfl_vendor` when the user changes it.
- **Test:** engine test with two simulated storages: complete 1 in one, 2 in the other, expect both.
- Hub pins were checked the same way and are safe: they are re-read on every toggle. The other tab's display does not update until reload (Low, expected without a `storage` listener).

### DA-04 Switch Lab: real commands rejected as invalid (Medium, CONFIRMED)
- **Cisco (L3-SW, lesson 9), in `configure terminal`:** `spanning-tree vlan 10 priority 4096` and `...4097` rejected at "priority"; `interface port-channel 1` rejected; `access-list 101 permit tcp any any eq www` rejected (numbered ACLs); `ip route 10.1.0.0 255.255.0.0` gives a caret instead of "% Incomplete command."
- **OS10, in `configure terminal`:** `interface range ethernet 1/1/1-1/1/3` rejected.
- **Expected:** a real switch accepts these. A lab that does not simulate them should say so, as it already does for ICMP types, DHCP and PoE (`index.html:34601`, `38129`, `38219`).
- **Actual:** the same message a real switch gives for a typo, so learners doubt correct syntax.
- **Evidence:** `evidence/sl-cisco2.txt`, `evidence/sl-dell1.txt`.
- **Fix:** list the commands a Cisco or Dell engineer is likely to type that are not simulated, and print "not simulated in this lab" for them.
- **Test:** table of such commands asserting the output contains "not simulated" and does not contain "Invalid input".

### DA-05 Switch Lab: `channel-group` silently does nothing (Medium, CONFIRMED)
- **Steps:** `interface gi0/1`, `channel-group 1 mode active`, then `show etherchannel summary`. On OS10 `channel-group 1 mode active`, then `show port-channel summary`.
- **Actual:** no output after the command, and the summary says "(No port-channels configured in this lab topology)".
- **Location:** handler at `index.html:37442-37448` prints "(LAG not fully simulated)" but that text never appeared in the console. LIKELY an earlier generic config branch accepts the line first.
- **Fix:** make that message reach the console. Also `channel-group 99 mode desirable` and `mode on` after `active` are accepted with no complaint.
- **Test:** run the command and assert the output contains "not fully simulated".

### DA-08 Switch Lab: small IOS differences (Low, CONFIRMED)
- `switchport access vlan 77` for a missing VLAN: no "% Access VLAN does not exist. Creating vlan 77", and VLAN 77 is created.
- `vlan 1002` is accepted, and `show vlan brief` then lists VLAN 1002 twice (once as "VLAN1002", once as "fddi-default").
- `show interfaces gi0/1 switchport` prints "Trunking VLANs Enabled: 10,20,21,22,23,24,25,30"; IOS prints `10,20-25,30`.
- Correct as tested: VLAN 0/4095/5000 rejected, bad masks, network and broadcast address rejected, overlap message, `no switchport` then `ip address`, default route in `show ip route`, OS10 rejects dotted masks.

### Log Sanitizer
**DA-02 Speed (Medium, CONFIRMED).** Engine run in Node on synthetic lines, each with a different IP, hostname and MAC:

| Lines | Size | Time |
| --- | --- | --- |
| 2,000 | 130 KB | 0.4 s |
| 4,000 | 263 KB | 1.4 s |
| 8,000 | 531 KB | 5.1 s |
| 16,000 | 1,078 KB | 20.0 s |

Doubling the input roughly quadruples the time. Logs with repeated values are fast (400 KB of sshd lines: 1.0 s). I could not reproduce the earlier audit's "not finished after 90 s" with this input, so that figure probably came from a different input shape. Whether the page freezes while this runs in the browser was not measured (LIKELY, since the call is synchronous). `sanitizeText` is at `index.html:5803`. Test: 8,000 distinct-value lines must finish within a set time, and time ratio of 16,000 to 8,000 lines below 3.

**DA-03 Positional password (Medium, CONFIRMED).** Input `net use Z: \\fs01\share /user:corp\bob Secr3t99` becomes `net use Z: \\NAS-1\share /user:operator1 Secr3t99`. Restore is exact. Evidence: `evidence/san1.txt`. Fix: a rule for `net use ... /user:<name> <word>`; also check `runas`, `psexec -p`, `sqlcmd -P`. Test: that input must not contain `Secr3t99` in the output.

**DA-06 Over-redaction (Low).** `Version 12.4.5.6` becomes `Version 192.0.2.6` and `Dell OS10 4.2.1.0` becomes `Dell OS10 192.0.2.0`. Versions are what support asks for first, though restore gives the original back. With a known secret, `http://h/?x=abc123XYZ` becomes `http://example.net/resource-1[SECRET_1]` (the `/?x=` is lost). Evidence: `evidence/san2.txt`.

**DA-07 Not redacted (Low).** Bare `ssh pve01 -l root` (no domain; custom terms exist for this), `host 0x0A010203` and `167838211` (hex and decimal IPs), and `ｐａｓｓｗｏｒｄ=Hunter2x` (full-width letters).

**Passed (51 of 55 shapes):** AWS keys and secrets, GitHub token, JWT, URL credentials, query tokens, cookies, Basic/Bearer, Cisco type 5/7/9, SNMP v1/v3, TACACS, RADIUS, OSPF/BGP keys, Junos hashes, OS10 passwords, IPsec keys, Windows SID, AD DN, UPN, MAC (two styles), IPv6, zero-padded IPs, email, SSH and PEM private keys, JSON (also escaped quotes), XML, connection strings, PowerShell SecureString, env passwords, Unicode passwords, URL-encoded passwords, MongoDB URIs, `-pPassword`, `--password=`. Repeated IPs get stable placeholders (25 IPs round trip), user text such as `IP-1` survives restore, and Unicode with CRLF round trips.

Encryption export, checked in code (`index.html:6204-6224`): AES-GCM-256, PBKDF2-SHA-256 at 600k or 1.2M, random 16-byte salt and 12-byte IV, iteration limits 10k to 5M on import, payload cap 32 MB. I did not run the export/import UI end to end myself (the repo has tests for it).

### Network Calculator (no findings)
Against independent references: 20,000 random range-to-CIDR conversions (contiguous, exact cover, same greedy result), `neededPrefix` for 1 to 70,000 hosts plus large values, `hostCount` for /0 to /32, 20,000 random IPv6 addresses against an RFC 5952 compressor and re-parse, IPv4 and IPv6 parsing against Node's `net.isIPv4/isIPv6` on 40+ tricky strings, split planning including /30, /31, /32, `0.0.0.0/0`, and non-network input addresses. 0 mismatches. See `evidence/calc1.txt`. Not covered: VLSM table, ACL wildcard output beyond the existing 5 tests, bandwidth calculator, conflict checker UI.

### Routing Lab, Config Compare
- Routing Lab `bestRoute` sorts by longest prefix, then administrative distance, then metric, ignores AD 255, and `addRoute` validates address, prefix, next hop, own-address and reachability. Read in code only; behaviour tested by the existing 4 tests.
- Config Compare: identical, single change, insert, CRLF vs LF, trailing whitespace on and off, case on and off, duplicate lines, moved blocks (reported as 2 added and 2 removed, or as 2 moved when "moved" is on), empty input, NBSP. 60,000 lines in 140 ms, 200,000 identical lines in 332 ms, 30,000 fully reversed lines in 82 ms (flagged approximate). All correct. See `evidence/cd2.txt`.

### Topology Builder
Engine: 30, 150 and 400 chained switches (CDP plus interface status) gave 29, 149 and 399 confirmed links, with apply times of 9, 67 and 347 ms and view times under 25 ms. Hostnames `__proto__`, `constructor`, `toString`, `hasOwnProperty`, HTML, 5,000 characters, and names with spaces caused no exception and no prototype pollution. `__proto__`, HTML and spaced names produce no device at all, silently (Low, unrealistic names).
Browser: HTML payloads in VLAN names, descriptions, SNMP location, banner and domain name produced no injected elements and no script. Sensible behaviour seen: when neighbours report the same management IP for different names, links stay unresolved and appear in the review list, not as invented links.
Not tested: drawing performance with 100+ nodes in the browser, PNG/SVG/draw.io/CSV exports, zoom and pan, snapshots, IndexedDB autosave with two tabs (LIKELY last writer wins, not tried). Existing browser tests cover several of these.

### Cheat Sheet
- **DA-12 (UNVERIFIED, Low to Medium).** Four OS10 rows look wrong for OS10 and need checking against the OS10 Command Reference:
  1. `ip access-list standard ACL10` (looks like OS9 syntax; the sheet's other row uses `ip access-list <acl-name>`).
  2. `service password-encryption` (OS10 documentation I found refers to `service obscure-password`).
  3. `errdisable recovery cause all` (Dell's OS10 guide lists `errdisable recovery cause bpduguard`).
  4. `show udld neighbors` (no OS10 source found).
  My searches did not reach the OS10 command reference pages, so this is a lead, not a finding. Also unchecked: `show interface description`, `show storm-control`, `show line`, `clear line vty 2`, `lldp med network-policy 1 app voice ...`.
- Categories requested in your brief: **verified** = none by me (no hardware, no vendor page read to the command level); **corrected-in-recommendation** = none yet; **unverified** = the four above, the OS9 `verify` rows and all Cisco and Junos rows I did not read; **unsupported** = none found. The 26 OS9 rows marked `verify` were not re-researched; the sources record is `docs/reviews/2026-11-03-os9-sources.md`.

### Not audited in depth
Script Library, DNS Lab, Firewall Rules Lab, Connectivity Analyzer, vSphere Sandbox, Network Reference content. They were opened, clicked through and fed injection text (no problems, no console errors), and their existing tests pass. No functional depth testing was done beyond that.

## 7. Technical correctness
See section 6. Summary: calculation code is strong; simulator fidelity gaps are in what the labs do not say they skip (DA-04, DA-05, DA-08).

## 8. Security and privacy
- **No injection:** a generic probe put `<img src=x onerror=...>` and `<svg onload>` in every text field of 12 tools, loaded examples and clicked every non-destructive control; nothing executed and no element was created. Caveat: payloads were not found as visible text afterwards either, so the probe shows no execution but does not prove each field is displayed escaped.
- **DA-09 (Low, design):** tools load as `srcdoc` iframes with no `sandbox` attribute (`index.html:50303`), sharing one origin and one localStorage with the hub. The page CSP and each tool's CSP allow `'unsafe-inline'` script. A single missed escape in any tool would reach everything stored. Fix: leave as is and keep the escaping tests, or sandbox frames with `allow-scripts` and move storage into the hub.
- Network: `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'` in tools. Hub CSP allows `frame-src blob:`.
- Storage holds settings and progress; the architecture note says never to store typed data. Topology's encrypted copy is the exception and is opt-in.
- Privacy leaks: DA-03, DA-06, DA-07.

## 9. Persistence and data integrity
- DA-01 confirmed. Hub pins/recent merge correctly; tab display is stale until reload.
- Corrupt values (`{`, `null`, `[]`, `"x"`, `{"__proto__":...}`, 5,000 digits) in 21 keys: all 13 tools opened, no prototype pollution.
- Not tested: storage quota exhaustion, schema version mismatch beyond the above, importing older project files, Topology IndexedDB with two tabs, closing and reopening the browser.

## 10. Accessibility and usability
- Hub: one visible `h1` plus one empty hidden `h1` (`.ws-title`) in the page (Low, tidy-up). Each tool has one `h1`.
- No buttons without a name, no unlabeled inputs, no images without `alt` found by the scan, no positive `tabindex`. Tools use `lang="en"`.
- Real Tab walk of the hub: 12 stops in a sensible order (card link, then its pin button). The card shows an outline through `.card:focus-within`.
- Small text: Topology Builder 12 and vSphere Sandbox 10 elements under 11 px; vSphere has 9 controls under 24 px (Low, CONFIRMED by measurement, not individually listed).
- Hub tool-card links measure about 23 px tall but a full-card overlay (`.card-title:after`) is the real click target, so I do not count this as a defect.
- Not checked: screen readers, Windows high contrast, mobile layouts, text zoom, light/dark visual comparison beyond the existing contrast tests.

## 11. Performance
| Item | Result |
| --- | --- |
| Page load from disk (Firefox, 2.9 MB) | about 105 ms |
| Open and close two tools 30 times | frames stay 1, DOM nodes constant at 275 |
| Topology engine, 400 devices | apply 347 ms, view 24 ms, saved model 7.7 MB |
| Config Compare | 60,000 lines in 140 ms |
| Log Sanitizer | see DA-02 |
Tool-open timing per tool was inconclusive (my probe may have read the previous frame) and is not reported. Memory use was not measured (Firefox does not expose heap size to the page).

## 12. Test coverage gaps
The suite is strong: engine tests run the shipped code, many use independent expected values, and mutation checks were done on the OS9 and rename tests. Gaps:
1. No test of two tabs saving the same store (DA-01).
2. No timing-ratio test for the sanitizer (DA-02).
3. Sanitizer tests cover listed shapes only; no list of "command with a positional password" shapes (DA-03).
4. Switch Lab tests drive lessons; there is no table of "valid commands the lab does not simulate" (DA-04, DA-05).
5. No Chrome or Edge run (CI and local use Firefox only; users are on Windows, usually Edge).
6. Cheat Sheet rows are checked for structure and a few facts, not against vendor syntax.
7. The generic injection probe I used is not in the repo.

## 13. Documentation consistency
- README says thirteen tools (eight and five): correct. Names match the app. No old product name in README, ARCHITECTURE or tests README. Old tool names are present only as search keywords.
- Live site `https://ianknight.org/tools/network-skills-kit` returns the page titled "NetOps Workspace", and the project page headline and description use the new name. The live file is 2,951,024 bytes against 2,949,361 in the commit I examined, so it is a different revision (DA-11).
- `https://ianknight.org/tools/netops-workspace.html` returns 404. The README link uses the old file name and works.
- `tests/README.md` documents `sh tests/run.sh`, which uses a fixed port and `pkill` (DA-10).

## 14. Remediation roadmap
Order by risk and dependency:
1. DA-03 add the `net use` rule (and check `runas`, `psexec -p`, `sqlcmd -P`). Independent, quick.
2. DA-04 and DA-05 together: one list of "recognised but not simulated" commands, one message. Do DA-05 first because it may be a dead branch.
3. DA-01 merge-on-save for Switch Lab progress; check vSphere (`vsphereSandboxDone`) and the "extreme" progress keys (`nfl_extreme_*`) for the same pattern (LIKELY the same).
4. DA-02 index tokens in a Map instead of scanning (needs a profile first to find the quadratic step).
5. DA-12 verify four OS10 rows against the OS10 Command Reference; then review the 26 OS9 `verify` rows on real hardware.
6. DA-06, DA-07, DA-08 as time allows.
7. DA-09 decide whether to sandbox frames; DA-10 and DA-11 housekeeping.

## 15. Recommended regression tests
- `switchlab-tabs`: two storages, two lessons, both survive; vendor unchanged unless changed.
- `sanitizer-speed`: 8,000 distinct-value lines under a time limit and 16k/8k ratio under 3.
- `sanitizer-positional`: `net use`, `runas /user:`, `psexec -p`, `sqlcmd -P` cases.
- `switchlab-not-simulated`: table of valid but unsimulated commands, output must say "not simulated".
- `switchlab-channel-group`: warning text appears and the summary is not silent.
- `cheatsheet-os10-syntax`: after checking the four rows, a check that no row uses the OS9 `ip access-list standard` form in the OS10 column.
- Run the Firefox suite in Chromium or Edge as an extra CI job.

## 16. Remaining uncertainties
- No real hardware; no command was validated on a switch.
- Firefox on macOS only. Windows, Edge and Chrome behaviour is untested (file:// storage, fonts, key handling).
- Cisco and Junos cheat sheet columns, the OS9 `verify` rows, and the other tools listed under "Not audited in depth" were not examined.
- Whether DA-02 freezes the browser tab was inferred from the synchronous call, not measured.
- Topology Builder drawing speed and exports with 100+ nodes were not measured in the browser.
- The injection probe shows no execution but does not prove escaping in every field.

## Appendix: evidence files
All in `evidence/`: `engine-run.txt`, `browser-run.txt`, `multitab.txt`, `san1.txt` to `san4.txt`, `calc1.txt`, `cd2.txt`, `topo1.txt`, `topo3.txt`, `sl-cisco1.txt`, `sl-cisco2.txt`, `sl-dell1.txt`, `xss1.txt`, `xss2.txt`, `a11y1.txt`, `a11y2.txt`, `perf1.txt`, `cheat-switch.json`, `cheat-junos.json`. Probe scripts are in `probes/`. The audit clone is `repo/` (its `tests/browser/bidi.mjs` port was changed from 9333 to 9611 for the audit only).
