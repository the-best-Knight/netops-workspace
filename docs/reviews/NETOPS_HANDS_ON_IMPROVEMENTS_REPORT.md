# Hands-on improvements: report

Date: 2026-11-04, second pass 2026-11-05. All 10 commits listed in section 2, up to `848a1d5`, were pushed to `origin/main` on 2026-11-05 as a fast-forward. This line and the last bullet of section 12 were corrected in a later documentation commit.

The second pass finished the items the first pass left open. Rows changed in that pass say so.

## 1. Baseline

- Repository: `the-best-Knight/network-skills-kit` (the task text says `netops-workspace`; GitHub redirects the old name).
- Baseline commit: `a10d3d45a17cd073d6e4733aed490cabdfeda6e7`, equal to `origin/main` after `git fetch`. The working tree was clean.
- The Downloads copy was used only as a reference. Nothing was copied from it; the `ipconfig` code here was written fresh against the current Switch Lab model.

## 2. Local commits

| Commit | What |
| --- | --- |
| `86313c3` | Switch Lab: ipconfig, route print, Windows-style tracert on PCs, read-only |
| `abd32f0` | Topology Builder: Clear topology button, grid stays on after Auto-arrange (also adds the five-switch fixture and `pcdiag` to the CI test list) |
| `10cf77c` | Topology Builder: tidier Auto-arrange, LLDP stations no longer called switches |
| `017d79f` | Cheat Sheet: Dell vendor then OS, one Windows section, RHEL, compact intro and rows |
| `60b8863` | First version of this report and the screenshots |
| `0b6520a` | Second pass. Topology Builder: interface names stay on their own link, evidence shows its source, end-device icons |
| `9e83e08` | Second pass. Switch Lab: Windows ping on PCs, Extreme Mode uses its own packet model |
| `444907d` | Second pass. Cheat Sheet: examples behind row details, Dell OS10 trunk syntax, VCF 9.1.0 note |
| `a7cb568` | Second pass. Cheat Sheet example width on a phone; hands-on checks in light and dark |
| (this commit) | This report, updated, and the new screenshots |

## 3. Checklist

Status: **Complete**, **Partial**, **Not implemented**, **Not verified**.

### Part 1, Switch Lab PC diagnostics

| Item | Status | Notes |
| --- | --- | --- |
| `ipconfig` | Complete | Adapter, IPv4 address, mask, gateway. Shows "Media disconnected" when the cable or the switch port is down. |
| `ipconfig /all` | Complete | Host name, adapter, MAC, DHCP (always "No": the lab has no DHCP), IPv4 with "(Preferred)", mask, gateway, DNS servers where the scenario defines them. |
| `route print` | Complete (IPv4 only) | Built from the PC's own address, mask and gateway. The lab has no IPv6, so no IPv6 table is printed. |
| `tracert <target>` | Complete, with one shortcut | Uses the lab's reachability and the real hop list. If the path breaks it prints three "Request timed out" lines, not 30 hops. Prints only addresses, never device names. Second pass: Windows column widths, and `tracert <name>` shows the name and the address. |
| PC configuration read-only | Complete | `netsh`, the NetIPAddress, DNS and route setters, `ipconfig /release`, `/renew`, `route add/delete` are refused with a read-only message; a test proves the device data is unchanged. |
| Extreme Mode | Complete | Second pass: typed into the real console in a browser, light and dark (`jump`, `ipconfig`, `route print`, `ping`, `tracert`, `netsh`). The topology panel is hidden and no output names another device. Defect found and fixed: PC `ping` in Extreme Mode used the guided-lab reachability check, while `tracert` and the incident checks use the Extreme packet model (`xPing`). Both now use `xPing`, and a test proves ping agrees with it for every PC in every incident. |
| Names PC-A and PC-B | Partial | Guided labs have PC-A and PC-B. Extreme incidents use other host names (PC-U1, U1, G1 and so on). I did not rename them; the commands work on every PC-type host. |
| PC `ping` | Complete (second pass) | Windows output from the PC's own state. Replies carry a TTL from the target's OS (Windows 128, Cisco 255, Dell OS10 64) less one per router, with `time<1ms` on the subnet and `time=1ms` across a router. Failures: `Destination host unreachable` from the PC's own address when nothing on its subnet answers or the gateway does not answer (counted as received, as Windows does); `Request timed out` past a working gateway; `PING: transmit failed. General failure.` when the link is down or there is no usable gateway. `-n` and `-l` work; `-t`, unknown options and Cisco `repeat` get Windows messages. Name lookup failures print the Windows message. |
| PC `traceroute` | Not changed | `tracert` is the Windows command and is done. `traceroute` typed on a PC still gives the Linux form. |
| Lesson tracking with the new ping | Complete | Regression found and fixed before commit: the first version printed directly and skipped `pingOut`, so the lesson Verify step never saw the test ping and Lab 1 could not be finished. Windows output now goes through `pingOut`. The Fault Lab browser test that solves Lab 1 end to end passes. |
| Existing lessons | Complete | All Switch Lab and Fault Lab engine and browser tests pass. |

### Part 2, Topology Builder

| Item | Status | Notes |
| --- | --- | --- |
| Sample still loads first | Complete | Unchanged. |
| Trash button, confirmation, cancel | Complete | Toolbar icon, label "Clear topology", says how many devices and links go and what is untouched. The More-menu item uses the same confirmation. |
| Undo after clearing | Complete | Tested: Undo restores all devices and links. |
| Sample does not return by itself; can be loaded again | Complete | Tested. |
| Autosave | Complete | If the encrypted autosave is on, clearing empties that copy too (the dialog says so). Otherwise the cleared canvas would have come back next time. Not browser-tested, because the autosave needs a passphrase and IndexedDB. |
| Grid disappearing | Complete | Root cause below. Tested at 35 percent and lower; a grid the user turned off stays off. |
| Auto-arrange quality | Partial | Large gains on the test network (section 5). Not perfect: two links still cross. |
| Pinned nodes, link visibility, selected view | Complete | Tested. |
| No automatic arrange after routine imports | Not changed | Still arranges only the first import into an empty canvas, as before. |
| Interface names hidden by default | Complete | Already the case ("Interface names" off). |
| Names on hover or when a link is selected | Complete (second pass) | Tested in a browser: hovering a link shows only its two names and a tip with both devices, both ports and "Confirmed"; moving off hides them; selecting a link shows its names with "Interface names" off. |
| Interface labels readable with names on | Complete (second pass) | Measured from the drawn SVG, see section 5. The old build already kept labels from overlapping each other; the real problem was labels drifting away from their link, up to 96 px, and landing nearer another cable. Labels now only use spots along their own link, and a short leader line where a link is too short. |
| Confirmed, inferred, conflict styling; Show inferred off by default | Complete | Already the case, kept. Tested: six confirmed links, six inferred, nothing confirmed from one side. |
| Link evidence panel | Complete (second pass) | Tested for a confirmed switch link (Confirmed, both devices and ports, one LLDP entry from each side) and an inferred end-device link (Inferred, one LLDP entry from ACCESS-01 only, the warning that matching names, VLANs or subnets never prove a cable). Added: each entry now says which command and file it came from, or "unknown". The panel shows the port as the config names it (GigabitEthernet1/0/1) while the label uses the LLDP short form (Gi1/0/1); both are the same port. |
| Icons for AP, phone, workstation, printer | Complete, with a limit (second pass) | Access point, IP phone and end station have their own icons, chosen from LLDP/CDP capabilities, never from the name. A type picked by hand replaces the icon. The legend lists them. Printers, servers and workstations share one "end station" icon, because LLDP's Station capability does not say which, and the legend says so. Exports (draw.io, PNG) were not checked for the new icons. |

### Part 3, test network

| Item | Status | Notes |
| --- | --- | --- |
| Fictional five-switch fixture built from CLI text only | Complete | `tests/fixtures/five-switch/`, one file per switch (configuration plus `show lldp neighbors detail`). |
| Graph checked separately from layout | Complete | Engine test and browser test: six confirmed switch links, six inferred end-device links. |
| Layout metrics | Complete (second pass) | Overlaps, hierarchy, end-device distance, crossings, links through devices, Fit zoom, pinning, and now label placement (section 5). |
| Before and after screenshots at the same size | Complete | `docs/screenshots/hands-on/`, 1280 by 800. |

### Part 4 and 5, Cheat Sheet

| Item | Status | Notes |
| --- | --- | --- |
| Switching: Vendor, then OS for Dell | Complete | Dell shows OS10 and OS9 only for Dell. Cisco and Juniper have one choice, so no second row. OS9 warnings and verification status untouched. |
| Windows: CMD removed, commands kept | Complete | The seven missing classic commands were added to PowerShell; every old CMD command is findable (tested). `cmdCheat` is now empty. |
| Commands that need cmd.exe | Not applicable | Every command on the old CMD sheet is a program that runs in PowerShell. None needed `cmd.exe` syntax. |
| RHEL | Partial (second pass) | 31 rows. Checked against Red Hat documentation: the firewalld rows (`--permanent`, then `--reload`) match the RHEL 9 firewall guide; NetworkManager and `nmcli` as the way to configure networking match the RHEL 9 networking chapter. One claim was wrong: the row said RHEL no longer installs `ifconfig`. I could not confirm that; it now says Red Hat deprecated `ifconfig` (Red Hat article 1179833). Not checked row by row: package names (`bind-utils`, `nmap-ncat`, `iputils`) and the `dnf check-update` exit code 100. |
| VMware 8.x wording | Partial | The ESXi version row now says there is no "8.0.10" release (8.0 is numbered by update, for example 8.0 Update 3) and notes the 8.0 U1a gateway display change. |
| VCF 9.1 | Complete for status and naming (second pass) | Broadcom KB 314608 (opened) lists "VMware Cloud Foundation 9.1.0", 12 May 2026, and 9.1.1 on 3 September 2026. The ESXi version row now says so and that the rows are only checked for ESXi 8.0. **No 9.1 commands were added**, because I could not verify any against 9.1 documentation. |
| Execution context per VMware command | Not changed | Rows are already grouped as ESXi shell or PowerCLI. |
| Compact intro | Partial | The generic switch intro is shorter, the rest under More. The OS9 and Junos intros are unchanged. |
| Collapsed detail under each row | Complete for switch rows (second pass) | One "Details" fold per row holds where it runs and the example. Copy buttons and risk badges stay outside it. Tips stay inline. Other platforms have no details fold. |
| Short example and expected output per command | Partial (second pass) | 58 examples on switch rows: Cisco sample output for `show interfaces status`, `show ip interface brief`, `show vlan brief`, `show interfaces trunk`, `show mac address-table`, `show ip route`, `ping`; the prompt change for `enable`, `configure terminal` and `interface` (Cisco and Dell OS10); the save messages for `write memory` and `copy running-config startup-config`; and for config commands what changes and the command that checks it. All output is labelled illustrative and version-dependent. No Dell OS10 show output was added, because I could not verify its format. No examples on Windows, Linux, VMware or OS9 rows. |
| Consistent row design across all platforms | Not implemented | |
| Risk warnings visible, copy buttons visible | Complete | Tested, also with a row's details open at 390 px. |
| Dell OS10 trunk rows | Fixed (second pass) | Two rows used `switchport trunk allowed vlan add 40` and `remove 40`. Dell's OS10 User Guide 10.5.1 adds with `switchport trunk allowed vlan 40` and removes with `no switchport trunk allowed vlan 40`, as the sheet's own Switch Lab rows already did. Not checked: whether OS10 accepts `switchport trunk native vlan`; Dell's documented way to set the untagged VLAN on a trunk is `switchport access vlan`. |

### Part 7, quality assurance

| Item | Status |
| --- | --- |
| Desktop and narrow layouts, both themes | Done (second pass). `handson.light` and `handson.dark` run at 1280 by 800 and 390 by 844. Defect found and fixed: at 390 px an opened example widened the Cheat Sheet table and pushed the copy button off screen. |
| Switch Lab Extreme Mode walk-through in a browser | Done (second pass), see Part 1. |
| Keyboard on the new controls | Done by hand (second pass). In a desktop browser: Tab from Auto-arrange reaches the trash button, with a 2 px focus ring; Enter opens the dialog with focus on Cancel; Escape closes it, removes nothing and returns focus to the button. Row Details opens and closes with Enter and shows a focus ring. Headless Firefox never gives the tool frame keyboard focus, so these steps are not in the automated suite; the automated test checks names, sizes and the focus rule. |

## 4. Root causes

- **Grid disappearing.** The grid was drawn only at zoom 45 percent or higher. Auto-arrange spreads the layout and then runs Fit, which zoomed the sample out to 35 percent, so the grid vanished while the Grid switch still said On. Reproduced: zoom 52 percent with grid, 35 percent without. Fixed by drawing the grid at every zoom, doubling the spacing so dots stay at least 10 px apart.
- **Endpoints scattered.** Two causes. (1) The importer passed the LLDP capability "station" on as the letter S, which means Switch, so servers, printers and workstations were classified as switches and laid out among the switches. (2) The layout treated two switches linked to each other as parent and child, which added a layer.
- **Empty canvas coming back.** The autosave skipped saving an empty canvas, so a cleared diagram would reappear from the old autosave.

## 5. Layout results (five-switch network, 1280 by 800)

Starting from a scattered arrangement:

| Measure | Before Auto-arrange | After |
| --- | --- | --- |
| Overlapping devices | 8 | 0 |
| Link crossings | 5 | 2 |
| Straight links through a device | 22 | 0 (links that would are drawn bent) |
| Total link length | 4590 px | 2657 px |
| Fit zoom | 55 percent | 75 percent (65 percent after the second pass, see below) |

CORE-01 is above both DIST switches, which are above both ACCESS switches. Every end device is below its own switch and within 260 px. Arranging twice gives the same result.

Second pass: end devices now sit 76 px under their switch instead of 48, so both port names fit on the short link, and Fit keeps the diagram clear of the floating view bar (CORE-01 used to sit under it). Total link length went from 2657 to 2971 px and Fit zoom from 75 to 65 percent; overlaps, crossings and hierarchy are unchanged.

Interface names on, same network after Auto-arrange, measured from the drawn SVG (24 labels with Show inferred on):

| Measure | Before (`60b8863`) | After |
| --- | --- | --- |
| Labels overlapping another label | 0 | 0 |
| Labels covering a device | 0 | 0 |
| Labels away from their link with nothing tying them to it | 4 | 0 |
| Labels nearer another link than their own | 5 | 0 |
| Labels on the wrong end of their link | 2 | 0 |
| Leader lines | 0 | 2 (both on the 30 px DIST-01 to DIST-02 link) |

The old build already avoided overlaps at 1280 by 800, so the clutter in the review screenshot did not reproduce as overlap here. What did reproduce was labels that read as belonging to the wrong cable.

Layout uses core, distribution and access names only to break ties between rows when switches of one kind carry such names. It never changes what a device is called or what kind it is.

## 6. Files changed

`index.html` (Switch Lab, Topology Builder, Cheat Sheet and kit data), second pass also `tests/browser/topology-interface-labels.test.mjs`, `tests/browser/handson.shared.mjs`, `handson.light.test.mjs`, `handson.dark.test.mjs`, `tests/browser/fault-lab-free.test.mjs`, `tests/engine/cheatsheet-baseline.json`, `tests/engine/pcdiag.mjs`, `tests/engine/suite.mjs`, `tests/engine/fuzz.mjs`, `tests/engine/os9cheat.mjs`, `tests/browser/topology-canvas-controls.test.mjs`, `tests/browser/topology-layout-five-switch.test.mjs`, `tests/browser/cheatsheet-navigation.test.mjs`, `tests/browser/topology-lib.mjs`, `tests/browser/topology-security-and-performance.test.mjs`, `tests/fixtures/five-switch/*`, `tests/README.md`, `.github/workflows/check.yml`, `docs/screenshots/hands-on/*`, and this report.

Second pass: `fault-lab-free` now also reads Windows ping output, and a Windows "Destination host unreachable" still counts as a failure there. The Cheat Sheet baseline changed only for the two corrected Dell trunk rows. The weak `pcdiag` tracert check (it passed because the address appeared in the header) now reads the last hop line.

Two existing tests were changed on purpose. The test helper and one security test now click through the new clear confirmation. The OS9 engine test now expects the Command Prompt pill to be gone, as requested. No assertion was weakened.

## 7. Tests added

- `tests/engine/pcdiag.mjs`: 16 tests (PC-A against PC-B, ipconfig, ipconfig /all, route print, tracert, bad arguments, unknown destinations, read-only, shut port, vendor switch, every Extreme incident, hidden topology).
- `tests/engine/suite.mjs`: two tests for the five-switch network and the end-device kinds.
- `tests/browser/topology-canvas-controls.test.mjs`: 16 checks (trash button, confirm, cancel, empty, no sample reload, undo, grid at low zoom, grid switched off).
- `tests/browser/topology-layout-five-switch.test.mjs`: 13 checks (graph, kinds, overlaps, hierarchy, distance, crossings, Fit zoom, repeatability, pinning).
- `tests/browser/cheatsheet-navigation.test.mjs`: 30 checks (vendor and OS rows, Windows commands still found, RHEL, compact intro, copy buttons, risk badge, ESXi wording). Second pass: 36 checks (examples hidden until opened, labelled illustrative, prompt changes, config effects, OS10 trunk syntax, VCF 9.1.0 wording).
- Second pass, `tests/browser/topology-interface-labels.test.mjs`: 30 checks (names off by default, label overlap, labels on devices, distance from their own link, nearer another link, wrong end, zoomed out, hover, selection, evidence panel and its source, solid versus dashed).
- Second pass, `tests/browser/topology-layout-five-switch.test.mjs`: 16 checks (adds the end-device icons, a hand-picked type winning, the legend).
- Second pass, `tests/engine/pcdiag.mjs`: 28 tests (adds Windows ping: replies and TTL, routed TTL, same-subnet unreachable, timeout, general failure, gateway down, options and errors, name lookup in lab 8 before and after its fix, tracert widths, Extreme ping against `xPing` for every PC, no names in Extreme ping output).
- Second pass, `tests/browser/handson.light` and `handson.dark`: 15 checks each (label contrast, trash and Interface names controls, 390 px Topology Builder and Cheat Sheet, Extreme Mode in the real console).

## 8. Test results

See the last section of this file.

## 9. References used

- Broadcom ESXCLI command reference (`developer.broadcom.com/xapis/esxcli-command-reference`), for `esxcli network ip interface list`.
- Broadcom knowledge base article 412519 (gateway shown as 0.0.0.0 after 8.0 U1a).
- Broadcom KB 314608, "Correlating VMware Cloud Foundation version with the versions of its constituent products" (opened): VCF 9.1.0, 12 May 2026; 9.1.1, 3 September 2026. It lists no ESX build numbers for 9.x.
- Dell SmartFabric OS10 User Guide 10.5.1, `switchport trunk allowed vlan` (via Dell's site search): add with the VLAN list, remove with the `no` form.
- Red Hat: RHEL 9 "Configuring firewalls and packet filters" (firewalld), RHEL 9 "Considerations in adopting RHEL 9", networking chapter (NetworkManager, `nmcli`), Red Hat article 1179833 (`ifconfig` deprecated). Read through search summaries, not opened page by page.
- Windows `ping` and `tracert` formats are written from how Windows prints them. No Microsoft page was opened.

## 10. Saved-data compatibility

- Project files and snapshots: no format change.
- New device kinds (`ap`, `phone`, `endpoint`) appear only on devices imported after this change. Older saved models still load; an unknown kind falls back to the Custom icon. Second pass: the new icons are drawn, not saved, so project files are unchanged; a saved node keeps its type. A saved model that already holds an LLDP station as a "switch" keeps that kind until re-imported.
- Cheat Sheet: the remembered Command Prompt choice falls back to PowerShell.

## 11. Performance

The engine performance test (120 devices, 5,616 interfaces) is unchanged: parse about 150 to 170 ms. The new layout pass is linear in devices. It was not benchmarked at 150 or more devices in a browser.

## 12. Remaining limitations and work that needs your approval

Still open after the second pass:

- Two links still cross on the five-switch network.
- The end-device icons are not in the device palette or checked in draw.io and PNG exports.
- Cheat Sheet examples cover switch rows only. No Dell OS10 show output, no Windows, Linux, VMware or OS9 examples.
- RHEL package names and the `dnf check-update` exit code are not checked against Red Hat documentation. No VCF 9.1 commands were added.
- Not checked: whether Dell OS10 accepts `switchport trunk native vlan`.
- Windows `ping` does not model a router that answers "Destination net unreachable"; a path that dies past the gateway always times out. IPv6 is not modelled.
- `traceroute` typed on a PC still gives the Linux form.
- The PC prompt in the console is `PC-A#`, not `C:\>`.
- Keyboard checks are by hand, not automated (headless Firefox limit).
- Pushed: all 10 commits, final commit `848a1d5`. GitHub Actions on that commit (Check scripts, Browser tests, Trigger site deploy, pages build and deployment) all finished with success.

## Test results, first pass (on `60b8863`)

| Check | Result |
| --- | --- |
| `node scripts/check-scripts.mjs` | 20 scripts, 0 failed |
| `node tests/engine/suite.mjs` | 84 passed, 0 failed |
| `node tests/engine/fuzz.mjs 800` | 0 exceptions, 0 slow batches |
| Other engine tests (sanitizer, configdiff, calculator, routing, switching, switchlab, pcdiag, vsphere, dns, ping, lessons, content, scriptrepo, os9cheat, uitokens, progress) | All pass; none skipped |
| `sh tests/run.sh` | 31 of 31 browser test files passed |

Each new test was written against the old behaviour first where that was possible. The canvas-controls test fails on the previous build (no trash button). The grid check failed in a manual run before the fix (grid count 0 at 35 percent zoom). The layout test measured the old layout (8 overlaps, 5 crossings).

## Test results, second pass (on `a7cb568`, before this report commit)

| Check | Result |
| --- | --- |
| `node scripts/check-scripts.mjs` | 20 scripts, 0 failed |
| `node tests/engine/suite.mjs` | 84 passed, 0 failed |
| `node tests/engine/pcdiag.mjs` | 28 passed, 0 failed (16 before) |
| `node tests/engine/fuzz.mjs 800` | 800 batches, 0 exceptions, 0 slow batches |
| Other engine runners (calculator, configdiff, content, dns, lessons, os9cheat, ping, progress, routing, sanitizer, scriptrepo, switching, switchlab, uitokens, vsphere) | All pass; none skipped |
| `sh tests/run.sh` | 34 of 34 browser test files passed (31 before; new: `topology-interface-labels`, `handson.light`, `handson.dark`) |
| Keyboard, by hand in a desktop browser | Trash button, clear dialog, Escape, row Details: as described in Part 7 |

The label test was also run against the previous build (`60b8863`): it failed 5 of 29 checks there, which gave the "before" numbers in section 5.

## Screenshots, second pass

All in `docs/screenshots/hands-on/`, 1280 by 800 unless noted.

| File | Shows |
| --- | --- |
| `labels-on-before.png` | Interface names and Show inferred on, previous build |
| `labels-on-after.png` | The same, this build |
| `labels-hover.png` | Names off, hovering CORE-01 to DIST-01: only that link's names and the tip |
| `link-evidence-inferred.png` | ACCESS-01 to WS-ENG-014 selected: Inferred, one LLDP entry, its source, dashed link |
| `topology-labels-light.png` | Names on, light theme, end-device icons |
| `topology-narrow-dark.png` | Topology Builder at 390 by 844 |
| `cheatsheet-example-narrow-dark.png` | Cheat Sheet at 390 by 844 with an example open; it scrolls inside its box |
| `switch-lab-extreme-pc.png` | Extreme Mode, PC console, read-only refusal, no topology |
