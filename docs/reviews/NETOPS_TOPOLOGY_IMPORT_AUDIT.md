# Topology Builder import audit

Date: 2026-11-04. Scope: the Topology Builder's importer and link inference (the `NM` engine in `index.html`).

> **Status: partial audit.** Importer parsing, vendor detection, interface names, basic link inference and device identity were probed. These areas were NOT investigated and are still open:
> - LACP, port-channel misconfiguration, NIC teaming and dual-homed servers
> - Duplicate MAC addresses and multiple management addresses on one device
> - VRFs, subinterfaces, static and connected routes, routed adjacencies
> - Import rollback, undo, and manual edits surviving a re-import
> - Malformed inputs: XML, CSV, corrupted JSON project files, special characters in filenames
> - Large-topology browser performance (5, 20, 50, 100, 150+ devices): canvas, zoom, pan, group moves, export time and memory
>
> Sections 6 to 13 say exactly what was and was not tested.

## 1. Executive summary

The importer is in good shape on the points that matter most. It does not invent links: a one-sided neighbour report is "inferred", a description alone is "candidate", VLANs and subnets never create a cable, and conflicting reports are flagged. Re-imports update instead of duplicating. A name that matches but has a different management address is held for a decision instead of being merged.

I found four real defects and fixed all four, each with a regression test that fails on the old code and passes on the new:

1. A `--More--` pagination marker silently dropped the rest of a wrapped VLAN port list, so VLAN membership came out wrong with no warning (Medium).
2. Dell OS9 `show lldp neighbors` (ports written as "Te 0/1") was read by the OS10 parser, which made an interface called "Te" and a neighbour called "0/1" (Medium).
3. A port that is shut down in the configuration but reported a CDP or LLDP neighbour produced a normal inferred link with nothing pointing out the contradiction (Medium).
4. Junos output was only called "Junos, not supported" if it contained the word Junos or `set interfaces`. The three most common forms (curly-brace config, `show interfaces terse`, `show lldp neighbors`) got a generic "does not read this kind of output yet" (Low).

This was not the full 17-part programme. Sections 13 and 16 list what I measured and what I did not.

## 2. Baseline

- Repository: `the-best-Knight/network-skills-kit` (the task text said `netops-workspace`; the remote and folder are `network-skills-kit`).
- Commit: `330c7e561ec89960f2a6cdad29a6d25b7df8c67a` on `main`, level with `origin/main` after `git fetch`.
- Working tree at the start: one uncommitted change, the Log Sanitizer's Manual Redaction bar now showing by default (one CSS line). It is still there and untouched by this audit.
- Not in the repo: your work copy `~/Downloads/Premium_IT_Skills_Kit.html` (header "1.14") has Topology Builder changes that are not in `main` (parallel-link collapsing, Dell LLDP row parsing for host/MAC/vmnic rows, bracketed prompt fallback, ESXi name detection, layout changes). This audit is of the repo's `main`. Some of those changes touch the same code as findings below, so merge order matters.

## 3. What is actually supported

The new importer has 55 registered parsers (`NM.parsers`). Support was judged from the parser list and the fixtures in `tests/fixtures/`, not from the README.

| Vendor | Command or file | Status | Tested | Basis |
| --- | --- | --- | --- | --- |
| Cisco IOS / IOS-XE | running-config | Supported | Yes (`sw-*.cfg`) | Fixture written for the tests |
| Cisco | show interfaces status | Supported | Yes | Fixture; plus my CRLF, tab and ANSI probes |
| Cisco | show cdp neighbors detail | Supported | Yes | Fixture |
| Cisco | show lldp neighbors detail | Supported | Yes | Fixture and my probes |
| Cisco | show etherchannel summary | Supported | Yes | Fixture |
| Cisco | show vlan brief | Supported | Yes | Fixture; wrapped lines fixed here |
| Cisco | show interfaces trunk | Supported | Yes | Fixture |
| Cisco | show version, show ip interface brief, show interfaces, show spanning-tree, show mac address-table | Parser exists | Not verified by me | I did not find a test that checks each one's output |
| Cisco | show ip route | Not read by this importer | n/a | Hint sends the user to the classic importer |
| Dell OS10 | running-config, show interfaces status, vlan, lldp, port-channel, version | Supported | Yes | Fixtures (`dell-s1.cfg`, `dell-s*-session.txt`) |
| Dell OS9 | running-config | Supported (config only) | Yes (`os9.cfg`) | Fixture |
| Dell OS9 | show lldp neighbors | Now read without bad data, not advertised as supported | Yes (new test) | Layout from Dell's S5048F-ON 9.14 page listed in `2026-11-03-os9-sources.md`; no captured output |
| Dell OS9 | other show commands | Unsupported | Yes (probe) | Reported as not read |
| Dell N-series (DNOS6) | running-config | Supported (config only) | Yes (`dnos6.cfg`) | Fixture |
| Juniper Junos | anything | Unsupported by this importer | Yes (new test) | Named as Junos in the "not read" message. The classic importer has some Junos LLDP table reading; I did not test it |
| Palo Alto | config set, system info, interfaces, LLDP, routes | Supported | Yes (`fw1-*`) | Fixture |
| VMware ESXi | hostname, NICs, vSwitch, DVS, port groups, vmk, failover, VM list | Supported | Yes (`esx01-session.txt`) | Fixture |
| Linux | ip link, ip addr, lldpctl, bonding | Supported | Yes (`srv01-session.txt`) | Fixture |
| Windows | ipconfig, Get-NetAdapter, Get-NetIPAddress, LBFO, netsh | Supported | Yes | Fixtures follow the real layout but are not captured from a machine |

I did not mark anything supported only because the importer accepts the text.

## 4. Import pipeline

Input text, then `clean` (line endings, ANSI codes, pagination markers), then `splitSections` (by prompt, or by command header when prompts are missing), then `detect` (each parser scores the section; the best score above a threshold wins, otherwise the section is "unrecognised"), then `parse` (facts: device, interfaces, VLANs, neighbours), then `apply` (identify the device, merge into the model, record the import), then `derive` and `view` (links, status, review items), then the drawing code and exports.

Where errors travel:

- `clean` runs first, so a bad rule there damages every parser. The pagination bug lived here.
- `detect` picks by header text. Two vendors that share a header share a parser. The OS9 problem came from this.
- `apply` is the safe point. An unidentifiable section is "held", not given to a guess, and a name match with a different address is held.
- `derive` makes the evidence-based decisions (confirmed, inferred, candidate, conflict). I found no case where it drew a link without a report.

## 5. Confirmed defects

| ID | Severity | Where | Expected | Actual before | Status |
| --- | --- | --- | --- | --- | --- |
| TI-01 | Medium | `NM.clean` and the `cisco.vlan` parser | Ports on the line after `--More--` still join their VLAN | Continuation lost; VLAN 1 showed 2 of 4 ports, no warning | Fixed |
| TI-02 | Medium | `dell.lldp` parser | A two-word OS9 port ("Te 0/1") is one port; no host name means no neighbour name | Interface "Te", neighbour "0/1", an invented stub device | Fixed |
| TI-03 | Medium | `NM.addAnalysisReview` | Shutdown in config plus a neighbour report is flagged | Plain inferred link, nothing flagged | Fixed |
| TI-04 | Low | `NM.hintFor` | Junos output is named as unsupported | Generic "does not read this kind of output yet" | Fixed |

Reproductions are the four tests added in `tests/engine/suite.mjs`.

Not defects, but worth knowing:

- The Dell parser's label still says "Dell OS10 show lldp neighbors" when it read OS9 output. Cosmetic.
- The hint for unreadable Windows output says Windows output "is not read yet", but Windows parsers exist. It shows only when a Windows output was not recognised, so the wording is misleading.
- A truncated last row of a status table is dropped silently (the earlier rows are kept). Nothing is invented, but there is no warning.

## 6. Device identity

Checked with probes: same hostname with a different management address, a different hostname with the same address, and a hostname change with the same address. All three were held for a decision and nothing was merged or duplicated (one device, one held item). Prompts that change mid-paste split into separate devices. An unidentified snippet is not given to any device (existing test 6).

Not tested: duplicate MAC addresses across devices, multiple management addresses, old versus new snapshots of one device.

## 7. Interface normalization

I ran about 45 names through `ifKey`. Abbreviations and full names agree (Gi/GigabitEthernet, Te/TenGigabitEthernet, Eth/ethernet, Po/port-channel, Management1, ma0/0, "Te 0/1", fortyGigE). Junos (`ae0`, `ge-0/0/1`), Linux (`ens192`, `eth0`, `bond0`) and ESXi (`vmnic0`, `vmk0`) names pass through unchanged. `Tw1/1/1` and `TwentyFiveGigE1/1/1` stay different, which is right (Cisco's "Tw" is TwoGigabit, "Twe" is TwentyFive). No finding.

## 8. Link inference

Checked with two-switch fixtures:

- Reciprocal reports with matching ports: confirmed.
- Two parallel cables with no LAG: two confirmed links, each with its own ports.
- One-sided report: inferred, medium confidence.
- Reciprocal reports whose ports do not match: both links marked conflict, a review item names it.
- Interface descriptions only: candidate, low confidence, not drawn as a real link.
- A MAC table alone: no link and no device.
- A neighbour whose management IP does not match the known device with that name: not matched, listed as unresolved (this is correct; my first fixture tripped it by accident).
- Shutdown port with a neighbour: see TI-03.

Not tested: CDP versus LLDP disagreement on the same port, link speed mismatch, changed links between snapshots.

## 9. LACP and redundancy

Existing tests (11 and related) cover a port-channel shown as one logical link with its members. I did not write new LACP, teaming or dual-homing scenarios, so this section is based on the existing suite only.

## 10. VLAN and Layer 3

The pagination fix (TI-01) was a VLAN accuracy bug. Existing tests check that VLANs and subnets alone invent nothing (test 12). I did not test VRFs, subinterfaces, static routes or routed adjacencies.

## 11. Import history and stale data

Existing tests cover re-import without duplicates (3), a stale record that vanished from a newer table being kept and marked (13b), and edited configuration updating the right field. I did not add new history, rollback or manual-edit scenarios.

## 12. Security

Imported text with HTML in a hostname and a description (`<img onerror>`, `<script>`) is stored as plain text by the engine. Rendering and export escaping are covered by the existing `topology-security-and-performance` and `topology-drawio` browser tests. A 1 MB description imported without error. Not tested: malformed XML or CSV, corrupted JSON project files, special characters in filenames.

## 13. Performance

From the existing engine test "a synthetic network of 120 devices": 120 devices, 5,616 interfaces, 144 links; parse 150 ms, merge 45 ms, derive 13 ms, search 3 ms; snapshot 13 ms, serialise 21 ms (2.6 MB), load 31 ms. The 2026-11-04 deep audit measured 400 devices applied in 347 ms.

Not measured: the 5, 20, 50, 100 and 150-device ladder, memory, canvas rendering, zoom and pan, group moves and export time in a browser. I found no bottleneck, so I optimised nothing.

## 14. Improvements implemented

All in `index.html`, in the Topology Builder block:

- `NM.clean`: the `--More--` rule no longer swallows the newline and indent of the next line.
- `cisco.vlan`: a line holding only port names continues the previous VLAN even without the long indent.
- `dell.lldp`: joins two-word ports, and does not read a two-word remote port as a host name.
- `NM.addAnalysisReview`: new "state-conflict" item for a shut-down port with a neighbour (medium if the neighbour report is newer than the config, info if older).
- `NM.hintFor`: Junos recognised by its terse, curly-brace and LLDP table forms.

## 15. Regression tests added

Four tests in `tests/engine/suite.mjs` under "Import audit regressions". Run against the original `index.html` they fail (4 failed); against the fixed file the suite is 77 passed, 0 failed.

## 16. Remaining limitations

- Junos is not read by the new importer. OS9 is read from the configuration only (plus the LLDP table, not advertised).
- The Dell parser label says OS10 for OS9 LLDP.
- Truncated final table rows are dropped without a warning.
- Not covered by me: LACP and teaming scenarios, duplicate MACs, VRFs and routes, import rollback, malformed XML/CSV/JSON, large-network browser performance.
- Test fixtures are written, not captured from real devices. Real firmware differences remain a risk.

## 17. Suggested next steps

1. Decide how to merge your work copy's Topology Builder changes, then re-run this audit's four tests.
2. Capture real OS9 and Junos output (lab device, nothing from work) before claiming support.
3. Add a warning when a table's last row looks cut off.
4. Run the 5 to 150 device ladder in the browser and record numbers.
5. Add LAG, teaming and dual-homing scenarios to the suite.

## Test results

- `node scripts/check-scripts.mjs`: 20 scripts, 0 failed.
- `node tests/engine/suite.mjs`: 77 passed, 0 failed (73 before).
- `node tests/engine/fuzz.mjs 800`: 0 exceptions, 0 slow batches.
- `sh tests/run.sh`: 28 of 28 test files passed.
