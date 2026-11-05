# Independent deep audit, 2026-11-05

Audit only. No application code, tests or saved data were changed. This report is the only file added, and it is not committed.

## 1. Executive summary

NetOps Workspace is in good shape for daily internal use, with limits that should be written down for users. I found no P0 or P1 problem: no outside network traffic, no HTML injection in the tools I could drive, no secret leak in 37 of 38 common credential formats, and every documented test suite passes.

What I did find, all reproduced:

- Leaving Switch Lab in the middle of a lesson throws the lesson away with no warning (F-01).
- A neighbour table row cut off inside its last column creates a link to a port that does not exist, with no warning (F-02).
- The Cheat Sheet and the Switch Lab simulator both present `switchport trunk native vlan` as Dell OS10 syntax. Dell's own article says OS10 sets the untagged VLAN on a trunk with `switchport access vlan` (F-03, medium confidence).
- The Log Sanitizer misses a password whose value follows a shell line continuation (F-04).
- Several small Windows-diagnostic inaccuracies: a TTL one too low and an extra `tracert` hop when the target is the gateway's other interface (F-05), and `ping` and `tracert` disagreeing about why the gateway cannot be reached (F-06).

Recommendation: **ready with documented limitations.** Fix F-01 to F-04 before wider rollout.

## 2. Audited commit

- `166fd46ddbf2037e0335571da7a170ccfe611c93` on `main`, equal to `origin/main` after `git fetch`. HEAD matched the expected baseline.
- Working tree clean at the start.
- GitHub Actions on `166fd46`: Check scripts, Browser tests, Trigger site deploy, and pages build and deployment all completed with success.

## 3. Testing environment

- macOS (Darwin 25.6), Node v26.12.0, Mozilla Firefox 159.0.1, headless, driven over WebDriver BiDi by the repository's own runner (`tests/run.sh`). Every browser run got a fresh profile, so no real user data was read or changed.
- Audit probes lived outside the repository, in a scratch folder. They used `KIT_TESTS_DIR` so the repository's runner could run them without adding files to the repo. All credentials, hostnames and addresses in probes are synthetic.
- Vendor checks used vendor web pages through a search tool. Where a page was read only as a search summary, the report says so.

## 4. Architecture assessment

- **Shape.** One `index.html` file. Thirteen tools are stored as text blocks and loaded into an `iframe` through `srcdoc` (`mountFrame`, around line 50940). Opening another tool removes the old iframe, so each tool's timers and listeners go with it. I found no leak path from listeners across tool switches.
- **Isolation.** The iframes have no `sandbox` attribute and share the hub's origin. The hub CSP allows `script-src 'unsafe-inline'`. Escaping is therefore the only barrier against injected markup (finding DA-09 from 2026-11-04, still open by design). See R-03.
- **Offline.** Confirmed by measurement: loading the hub and all 13 tools produced no resource request outside `data:`, `blob:`, `about:` or `file:`. CSP blocks `connect-src` in tool documents.
- **Unsaved work.** Only the Log Sanitizer and the Topology Builder define `__kitUnsaved`, which the hub checks before leaving. Switch Lab, Config Compare, Connectivity Analyzer, the Firewall, DNS and Routing labs and the vSphere Sandbox keep their state in memory and lose it when you leave. For Switch Lab this is a reproduced defect (F-01).
- **Duplication.** The Cheat Sheet's Switch rows and the Switch Lab simulator describe the same commands separately, with no shared source of truth. F-03 shows how one wrong assumption lands in both.
- **Tests and production.** The engine tests run tool code against a stub page (`tests/engine/tool.mjs`). That is fast and useful, but it can miss behaviour that only happens in the page. In the previous round, a lesson Verify regression was caught only by a browser test.

## 5. Network engineering accuracy

### Switch Lab

Verified good:
- Configuration commands change state, and `show` commands reflect them.
- Unsupported commands mostly answer with an IOS- or OS10-style error instead of succeeding silently.
- `channel-group` on Dell prints an honest "not simulated" note.
- PC `ipconfig`, `ipconfig /all`, `route print` and `ping` follow each PC's own state.
- PC changes are refused as read-only.
- A lesson cannot be completed without the test ping. The browser test `fault-lab-free` covers this, and I re-ran it.

Problems:
- **F-05:** `ping` from PC-A in lab 6 to the gateway's other SVI, 192.168.20.1, replies with `TTL=254`. A Cisco router answering from its own interface sends TTL 255, and no router sits between it and the PC. The Dell form shows 63 instead of 64. `tracert` to the same address prints two hops (192.168.10.1, then 192.168.20.1), where Windows shows one.
- **F-06:** with the gateway SVI shut in Extreme incident 1, `ping` prints `Reply from 192.168.10.11: Destination host unreachable.` (consistent with ARP failing for the gateway). `tracert` prints `1  192.168.10.11  reports: Destination net unreachable.` Windows generates the host form locally when ARP for the next hop fails, so the two commands should agree. I found no Microsoft page that states this, so confidence is medium.
- **F-08:** valid commands rejected as invalid input: Cisco `ip routing` and `ip dhcp snooping trust`, and Dell OS10 interface `mtu 9216`. This is the remaining part of DA-04.
- **F-09:** after `spanning-tree mode mst` on Cisco, `show spanning-tree summary` says `Switch is in mst mode`, then lists `Root bridge for: VLAN0001, VLAN0010, ...`. MST reports instances (MST0), not per-VLAN roots.
- **Known items 7 and 8:** `traceroute` on a PC prints Linux output; Windows has no `traceroute` command. The PC prompt is `PC-A#`.

### Topology Builder

Verified good:
- Conflicting LLDP from two switches is shown as two `conflict` links, plus a review item ("SW-A Gi1/0/1 has more than one neighbour").
- One-sided reports stay `inferred`.
- Parallel links stay separate and confirmed.
- HTML-like hostnames and descriptions are kept as data.
- `__proto__` and `constructor` as device names do not pollute `Object.prototype`.
- A 20-character Cisco Device ID such as `core-01.corp.examp` merges with `CORE-01` when the configuration gives the domain name.
- The five-switch network reconstructs exactly: 6 confirmed switch links and 6 inferred end-device links.
- After Auto-arrange there are 0 overlaps and 2 crossings, and Fit zoom is 65 percent.
- An exported project re-imports with the same nodes, links and icons.

Problems:
- **F-02:** an LLDP table whose last row is cut inside its last column (`Gi1/0/1` becomes `Gi1/0`) creates `SW-A gi1/0/2 <-> SW-C gi1/0 [inferred]`, a port that does not exist, and no warning. This limit was noted in the reconciliation report and is still present.
- **F-07:** in the draw.io export, the access point and the IP phone are `type="Custom box"` and the workstation is `type="Client / PC"`. The kind decided from LLDP capabilities is lost (known item 2).
- **R-02:** interface labels skip collision placement above 240 labels (`specs.length <= 240 ? placeLabels(...)`). The 150-switch probe drew 600 labels, so placement was skipped there.

### Cheat Sheet and Network Reference

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Dell OS10 `switchport trunk native vlan <id>` (4 rows; Switch Lab marks it "Runs") | Likely wrong (F-03) | Dell KB 000137464: the untagged VLAN on an OS10 trunk is set with `switchport access vlan`. No OS10 page for a `trunk native vlan` command was found. Medium confidence: absence in search results is not proof. |
| Dell OS10 `switchport trunk allowed vlan 40` / `no switchport trunk allowed vlan 40` | Correct | OS10 User Guide 10.5.1 |
| RHEL: `dig` from `bind-utils`, `nc` from `nmap-ncat`, `traceroute` package | Correct | Red Hat RHEL 9 guides (Managing networking infrastructure services; Configuring and managing networking; SELinux containers example), read as search summaries |
| RHEL: `dnf check-update` exit code 100 | Unverified | Not looked up |
| VMware Cloud Foundation 9.1.0, 12 May 2026 | Correct | Broadcom KB 314608 (opened) |
| ESXi "no 8.0.10 release" | Consistent with KB 314608 numbering | Not separately checked |
| Dell OS10 `show ip management-route` | Unverified | No result found |
| Disruptive commands carry a warning | Correct for every match | Script over all sheets: every command matching reload, erase, delete, clear, shutdown, reset and similar either has a badge or is read-only (27 matches, all read-only, such as `show interfaces status err-disabled`) |

## 6. Security findings

- **Outside traffic:** none (section 4).
- **HTML injection:** a harmless payload (`<img data-xss>` and `<b data-xss>`) was put into free-text inputs. Config Compare, DNS Lab, Cheat Sheet search and the Switch Lab console (`description` and `hostname`) showed it as text, with no element created. In the Connectivity Analyzer, Network Reference, Firewall Lab, Routing Lab, vSphere Sandbox, Log Sanitizer and Script Library, my probe did not get the payload rendered at all, so those results are inconclusive (U-05). The repository's `topology-security-and-performance` test covers the Topology Builder and passed.
- **Prototype pollution:** none through the Topology Builder engine; the fuzz run reports `Object.prototype clean: true`.
- **Log Sanitizer:** with default settings (strict, all rules on), 37 of 38 synthetic credential formats were fully hidden and restored exactly. The formats covered Cisco 5, 7 and 9 secrets, SNMP v2 and v3, TACACS and RADIUS keys, OSPF and BGP keys, WPA PSK, Junos and OS10 hashes, URL and FTP credentials, AWS keys, JWT, a PEM block, PowerShell SecureString, `net user`, SQL connection strings, JSON `passwd`, `pass` and `pwd`, the X-API-Key, Cookie and Basic headers, IPv6, MAC, email, a Slack token, `ldapsearch -w`, `mysql -p`, `curl -u`, `sshpass -p`, IKE PSK, Junos PSK and OS9 type 7. Sanitizing twice gives the same output. The one leak is **F-04**.
- **Corrupted saved data:** eight keys were set to damaged values (`nfl_progress2`, `nfl_vendor`, `cheatSheetVendor`, `cheatSheetSwitch`, `log-sanitizer-settings`, `vsphereSandboxDone`, `cdLayout`, `itSkillsKitTheme`). Every tool still opened, with no console error.

## 7. Persistence and recovery

- **F-01 (reproduced):** see section 12.
- **R-01 (source):** the Topology Builder autosave keeps one IndexedDB record (`ntb-autosave`, key `project`) with no coordination between tabs. Two open tabs with autosave on overwrite each other's copy, and turning autosave off in either tab deletes the stored copy. Not reproduced, because it needs the passphrase flow in two tabs.
- **Checked, no problem:** the vSphere Sandbox re-reads its done-list before each write, so it does not repeat the earlier multi-tab lost update. Switch Lab progress has a `storage` listener and tests (`progress.mjs`, 12 tests, passing).
- **Not tested:** quota-exceeded errors.

## 8. Performance

| Workload | Result |
| --- | --- |
| 150 access switches, 2 cores, LLDP from all 152 (300 links) | Imported through the real dialog in about 1.8 s, including the dialog's own waits. 300 links confirmed, 0 overlaps after Auto-arrange, Fit zoom 20 percent, about 3,200 SVG elements. |
| Auto-arrange, three times in a row on that network | No errors. Each finished within the probe's wait. I did not get a reliable per-call timing, because rendering is scheduled (U-06). |
| Fuzz, 800 batches, 126 devices | 4.6 s in total, 0 slow batches |

No memory measurement was possible (Firefox has no `performance.memory`). No regression claim is made.

## 9. UX and accessibility

- **Verified by the test suites:** `ui-standard.light` and `ui-standard.dark` (text size, contrast and control size), hub keyboard tests, and the light, dark and 390 px checks added last round.
- **Keyboard access:** the topology canvas is focusable (`svg.tabIndex = 0`, with `]` to step through devices). Interface rows that hold a link are focusable buttons, so the link evidence panel is reachable from the keyboard.
- **Automation limit, not a defect:** headless Firefox never gives a tool's iframe keyboard focus. Keyboard steps inside tools were checked by hand last round, in a desktop browser.
- **New employee:** F-01 is the most likely real-world frustration. It's easy to click "All tools" mid-lesson and lose the work.
- **Experienced engineer:** F-03 and F-08 matter most, because the tool teaches or rejects real syntax.

## 10. Test coverage assessment

- **All pass:** syntax 20 of 20; 17 engine runners (suite 84, pcdiag 28, switchlab 55, sanitizer 50, uitokens 69, and the rest); fuzz 800 batches with 0 exceptions; browser 34 of 34 files in 8 min 42 s.
- **Gaps that let this audit's findings through:**
  - No test leaves a tool mid-task (F-01).
  - The cut-off-row tests cover rows that fail the row pattern, not rows that still match after being cut (F-02).
  - No test checks Dell syntax in the Cheat Sheet against a documented source (F-03). Only Dell OS9 rows carry sources.
  - No sanitizer case for a shell line continuation (F-04).
  - PC diagnostic tests check TTL only for a same-subnet Cisco gateway and for a Windows target, not the gateway's far interface (F-05). `tracert` failure wording is not compared with `ping` (F-06).
  - No export test reads the device type of the end-device kinds (F-07).
- **Weak spots:**
  - Many browser checks drive tools through test hooks (`w.__nmx`, `w.runConsoleCommand`) instead of clicks.
  - The engine harness uses a stub page.
  - Expected values in `pcdiag` are mostly derived from the lab's own data, which keeps the tests honest about per-PC values but cannot catch a wrong rule applied consistently, such as the TTL rule.

## 11. The eight known open items

| # | Item | Still there? | Impact | Severity | Effort | Regression risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Two crossings, five-switch network | Yes, measured 2 | Diagram still readable; IP-Phone-Conf sits left of its own switch | P3 | Medium | Medium (layout tests) | Defer |
| 2 | Icons not checked in exports | Confirmed: draw.io loses the kind (F-07). PNG not checked. | Exported diagrams show APs and phones as plain boxes | P3 | Small | Low | Fix in Wave 3 |
| 3 | Examples only for switching | Yes | Enhancement | P3 | Medium | Low | Defer |
| 4 | No Dell OS10 show-output examples | Yes | Enhancement; needs real captures to stay honest | P3 | Medium | Low | Defer until captures exist |
| 5 | RHEL package names | Mostly resolved: `bind-utils`, `nmap-ncat` and `traceroute` match Red Hat docs. The `dnf` exit code is unverified. | Low | P3 | Small | None | Close after checking the `dnf` man page |
| 6 | No router "Destination net unreachable" | Yes | Paths that die past the gateway always time out. Real routers usually send unreachables, so learners see less than they would on a real network. | P3 | Small to medium | Low | Fix with F-06 |
| 7 | PC `traceroute` is Linux-style | Yes | Teaches a command Windows does not have | P3 | Small | Low | Fix in Wave 3 (answer as Windows does: not recognised) |
| 8 | PC prompt `PC-A#` | Yes | Suggests a Cisco-like shell on a PC | P3 | Small | Low (tests read output, not prompts) | Fix in Wave 3 |

## 12. Reproduced defects with evidence

### F-01 P2 Switch Lab: leaving mid-lesson silently discards the lesson

- **Where:** hub `mountFrame` (`index.html`, about line 50940) removes the iframe. Switch Lab defines no `window.__kitUnsaved`. Only lines 8306 (Log Sanitizer) and 28499 (Topology Builder) define it.
- **Steps:** open Switch Lab, `startLab(2)`, configure `description AUDIT-MARK` on SW1 ethernet 1/1/2, click "All tools", open Switch Lab again.
- **Expected:** a warning before leaving, or the lesson restored.
- **Actual:** no dialog. On return, the Lab Catalog shows and the lab network is gone (`net is null`).
- **Impact:** a learner loses a half-finished lesson with one click.
- **Fix:** have `__kitUnsaved` return a warning while a lesson or incident has changes, or keep the lab state in `sessionStorage`.
- **Test:** a browser test that changes config, clicks All tools, and expects a confirmation.
- **Confidence:** high.

### F-02 P2 Topology Builder: a row cut inside its last column becomes a link to a non-existent port

- **Where:** the Cisco LLDP table parser. The row pattern still matches when the last field is cut.
- **Steps:** import an LLDP table whose last row ends `Gi1/0` with no "Total entries" line.
- **Expected:** a "last row looks cut off" warning and the section marked partial, as the other cut-off cases already do.
- **Actual:** the link `SW-A gi1/0/2 <-> SW-C gi1/0 [inferred]` is created, and the review list says only "One-sided report".
- **Impact:** a confidently drawn port that does not exist.
- **Fix:** when a table lacks its closing "Total entries" line, treat the last row as suspect. Also reject port names that are not a full interface for the platform.
- **Test:** an engine test with the cut row.
- **Confidence:** high.

### F-03 P2 Cheat Sheet and Switch Lab (Dell OS10): `switchport trunk native vlan`

- **Where:** `kit-data` → `switchCheat`, rows "Native VLAN of a trunk" (marked `lab.dell = "yes"`), "Trunk native VLAN", "Trunk uplink" snippet and "Native VLAN". The Dell simulator accepts the command silently.
- **Expected:** the OS10 method Dell documents, `switchport access vlan <id>` on the trunk port, or a row marked unverified.
- **Evidence:** [Dell KB 000137464](https://www.dell.com/support/kbdoc/en-us/000137464/dell-emc-networking-os10-how-to-configure-native-access-untagged-vlan-on-a-trunk-port).
- **Impact:** technicians copy a command that probably fails on real OS10, and the simulator teaches it as working. Not disruptive: a real switch would answer with an error.
- **Fix:** confirm against the OS10 command reference or a real switch, then correct both the sheet and the simulator.
- **Test:** add OS10 rows to a sourced check like the OS9 one.
- **Confidence:** medium.

### F-04 P2 Log Sanitizer: password after a shell line continuation is not hidden

- **Steps:** sanitize `cmd --password \` followed by a newline and `  ContPw2026` (synthetic).
- **Actual:** `cmd --password [SECRET_1]` with `ContPw2026` still on the next line. The backslash was taken as the value.
- **Expected:** the value on the continuation line is hidden.
- **Impact:** a real secret leaks in shared logs built from wrapped shell commands.
- **Fix:** in the CLI-flag rule, skip a trailing `\` plus newline and indentation before the value.
- **Test:** add this case to `tests/engine/sanitizer.mjs` with a restore round trip.
- **Confidence:** high.

### F-05 P3 Switch Lab: TTL and hop count when the target is the gateway's other interface

- **Root cause:** `buildTraceHops` pushes the gateway and then the target even when both belong to the same router. `winTtl` subtracts `hops.length - 1`.
- **Evidence:** lab 6, PC-A: `ping 192.168.20.1` gives `TTL=254`; `tracert` gives two hops.
- **Expected:** TTL 255 (Cisco) or 64 (OS10), and one hop.
- **Fix:** stop the hop list when the target IP belongs to the current router.
- **Confidence:** high.

### F-06 P3 Switch Lab: `ping` and `tracert` disagree when the gateway does not answer

- **Root cause:** `winTrace` chooses "net" whenever the target is off-subnet.
- **Evidence:** see section 5.
- **Fix:** use "host" when the gateway is configured but unreachable, which `ping` already decides.
- **Confidence:** medium.

### F-07 P3 Topology Builder: draw.io export loses the end-device kind

- **Root cause:** `drawioXml` uses `n.type` (`custom` or `client`), not the kind.
- **Fix:** map the `ap`, `phone` and `endpoint` kinds to a type label and draw.io shape.
- **Confidence:** high.

### F-08 P3 Switch Lab: valid commands rejected as invalid input

- **Commands:** Cisco `ip routing` and `ip dhcp snooping trust`; OS10 interface `mtu 9216`.
- **Fix:** answer "not simulated in this lab", as `channel-group` does.
- **Confidence:** high (command validity is standard IOS and OS10 syntax).

### F-09 P3 Switch Lab: MST summary shows per-VLAN roots

- **Fix:** either refuse `spanning-tree mode mst` as not simulated, or report MST0.
- **Confidence:** high.

## 13. All findings, by severity

| ID | Severity | Tool | Issue | Reproduced? | Priority |
| --- | --- | --- | --- | --- | --- |
| F-01 | P2 | Switch Lab | Leaving mid-lesson discards it without warning | Yes | Wave 2 |
| F-02 | P2 | Topology Builder | Row cut inside its last column makes a phantom port link | Yes | Wave 1 |
| F-03 | P2 | Cheat Sheet, Switch Lab | OS10 `switchport trunk native vlan` likely not valid | Partly (docs, medium confidence) | Wave 1 |
| F-04 | P2 | Log Sanitizer | Password after a shell line continuation leaks | Yes | Wave 1 |
| R-01 | P2 | Topology Builder | Autosave last-writer-wins across tabs; turning it off in one tab deletes the copy | Source only | Wave 2 |
| F-05 | P3 | Switch Lab | TTL one too low and an extra hop to the gateway's far interface | Yes | Wave 3 |
| F-06 | P3 | Switch Lab | `tracert` says "net", `ping` says "host" for the same failure | Yes | Wave 3 |
| F-07 | P3 | Topology Builder | draw.io export loses AP, phone and end-station kinds | Yes | Wave 3 |
| F-08 | P3 | Switch Lab | `ip routing`, `ip dhcp snooping trust`, OS10 `mtu` rejected as invalid | Yes | Wave 3 |
| F-09 | P3 | Switch Lab | MST mode summary lists per-VLAN roots | Yes | Wave 3 |
| R-02 | P3 | Topology Builder | Label placement off above 240 labels | Source only | Wave 4 |
| R-03 | P3 | All tools | Shared origin plus `'unsafe-inline'`; escaping is the only barrier (DA-09) | Design | Wave 4 |
| K-7 | P3 | Switch Lab | PC `traceroute` prints Linux output | Yes | Wave 3 |
| K-8 | P3 | Switch Lab | PC prompt `PC-A#` | Yes | Wave 3 |
| D-01 | P3 | Docs | `tests/README.md` says the suite has 73 tests; it has 84 | Yes | Wave 4 |

## 14. Remediation roadmap

**Wave 1, critical correctness and security**
- F-04, sanitizer line continuation. Small.
- F-02, cut-off last-column rows. Small to medium.
- F-03, verify the OS10 native VLAN syntax on documentation or a switch, then fix the sheet and the simulator together. Small once verified.

**Wave 2, reliability and persistence**
- F-01, unsaved-lesson guard or session restore for Switch Lab. Medium. Consider the same guard for Config Compare and the other labs.
- R-01, coordinate the Topology Builder autosave across tabs (BroadcastChannel or a write lock), and make "turn off" delete only this tab's copy. Medium.

**Wave 3, network realism and usability**
- F-05 and F-06 together with known item 6 (router unreachables). Small to medium.
- Known items 7 and 8, PC `traceroute` and prompt. Small.
- F-07, draw.io export kinds. Small.
- F-08 and F-09, "not simulated" answers. Small.

**Wave 4, optional**
- Known items 1, 3 and 4 (crossings, more examples, OS10 output from real captures). Medium each.
- R-02, label placement at scale. Medium.
- R-03, `sandbox` on tool iframes, or a nonce-based CSP. Large: it touches how every tool loads.
- D-01, README count. Small.

## 15. Areas not verified

- **U-01:** Windows' exact `tracert` wording when ARP for the next hop fails (F-06). No Microsoft source found.
- **U-02:** the `dnf check-update` exit code, and OS10 `show ip management-route`.
- **U-03:** Topology autosave across two tabs (R-01) was not reproduced.
- **U-04:** PNG and SVG export of the new icons.
- **U-05:** HTML injection in seven tools where my probe never got the payload rendered.
- **U-06:** precise per-operation timings and memory growth.
- **Not run:** quota-exceeded storage, long practice sessions, rapid tool switching over a long period, a screen reader. Juniper Junos rows were not checked against Juniper documentation.

## 16. Readiness

**Ready with documented limitations.**

Evidence for that:
- No P0 or P1 issue.
- No outside traffic.
- No injected markup rendered where tested.
- No crash on damaged saved data.
- Every test suite and CI workflow passes.
- The topology engine keeps confirmed and inferred evidence apart under conflicting and one-sided input.

Evidence against "routine use" without notes:
- F-01 loses learner work.
- F-02 can draw a port that does not exist.
- F-03 likely teaches invalid OS10 syntax.
- F-04 can leak a credential.

Fixing Wave 1 and F-01 would move it to ready for routine internal use.
