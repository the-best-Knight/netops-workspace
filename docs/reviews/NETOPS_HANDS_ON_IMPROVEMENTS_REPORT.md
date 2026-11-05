# Hands-on improvements: report

Date: 2026-11-04. Nothing in this report is pushed. All commits are local on `main`.

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
| (this commit) | This report and the screenshots |

## 3. Checklist

Status: **Complete**, **Partial**, **Not implemented**, **Not verified**.

### Part 1, Switch Lab PC diagnostics

| Item | Status | Notes |
| --- | --- | --- |
| `ipconfig` | Complete | Adapter, IPv4 address, mask, gateway. Shows "Media disconnected" when the cable or the switch port is down. |
| `ipconfig /all` | Complete | Host name, adapter, MAC, DHCP (always "No": the lab has no DHCP), IPv4 with "(Preferred)", mask, gateway, DNS servers where the scenario defines them. |
| `route print` | Complete (IPv4 only) | Built from the PC's own address, mask and gateway. The lab has no IPv6, so no IPv6 table is printed. |
| `tracert <target>` | Complete, with one shortcut | Uses the lab's reachability and the real hop list. If the path breaks it prints three "Request timed out" lines, not 30 hops. Prints only addresses, never device names. |
| PC configuration read-only | Complete | `netsh`, the NetIPAddress, DNS and route setters, `ipconfig /release`, `/renew`, `route add/delete` are refused with a read-only message; a test proves the device data is unchanged. |
| Extreme Mode | Complete (engine-level) | Tested for every Extreme incident through the Extreme command path. I did not click through Extreme Mode in a browser. |
| Names PC-A and PC-B | Partial | Guided labs have PC-A and PC-B. Extreme incidents use other host names (PC-U1, U1, G1 and so on). I did not rename them; the commands work on every PC-type host. |
| PC `ping` and `traceroute` | Not changed | They still print Linux-style output on PCs. Only the new Windows commands are Windows-style. |
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
| Names on hover or when a link is selected | Not verified | I did not test it. |
| Interface labels not overlapping | Not implemented | The screenshot with names on still has overlapping labels near CORE-01. |
| Confirmed, inferred, conflict styling; Show inferred off by default | Complete | Already the case, kept. Tested: six confirmed links, six inferred, nothing confirmed from one side. |
| Link evidence panel | Not verified | The evidence is in the model and the CSV export. I did not re-test the on-screen panel. |
| Icons for AP, phone, workstation, printer | Partial | Devices are now classified from LLDP capabilities: access point, IP phone, end device. They reuse the existing Custom and Client icons; there are no new icons. A printer and a server both come in as "end device", because LLDP does not say which. Nothing is guessed from names. |

### Part 3, test network

| Item | Status | Notes |
| --- | --- | --- |
| Fictional five-switch fixture built from CLI text only | Complete | `tests/fixtures/five-switch/`, one file per switch (configuration plus `show lldp neighbors detail`). |
| Graph checked separately from layout | Complete | Engine test and browser test: six confirmed switch links, six inferred end-device links. |
| Layout metrics | Partial | Overlaps, hierarchy, end-device distance, crossings, links through devices, Fit zoom, pinning. Label overlap was not measured. |
| Before and after screenshots at the same size | Complete | `docs/screenshots/hands-on/`, 1280 by 800. |

### Part 4 and 5, Cheat Sheet

| Item | Status | Notes |
| --- | --- | --- |
| Switching: Vendor, then OS for Dell | Complete | Dell shows OS10 and OS9 only for Dell. Cisco and Juniper have one choice, so no second row. OS9 warnings and verification status untouched. |
| Windows: CMD removed, commands kept | Complete | The seven missing classic commands were added to PowerShell; every old CMD command is findable (tested). `cmdCheat` is now empty. |
| Commands that need cmd.exe | Not applicable | Every command on the old CMD sheet is a program that runs in PowerShell. None needed `cmd.exe` syntax. |
| RHEL | Partial | 31 rows (nmcli, ip, ss, firewalld, systemctl, journalctl, hostnamectl, dnf), change badges on commands that change the system. Written from my knowledge of RHEL 8 and 9, not checked against Red Hat documentation. |
| VMware 8.x wording | Partial | The ESXi version row now says there is no "8.0.10" release (8.0 is numbered by update, for example 8.0 Update 3) and notes the 8.0 U1a gateway display change. |
| VCF 9.1 | Partial | A web search found VCF 9.1 listed with ESX 9.1.0.0 (Broadcom's version table, released May 2026, with 9.1.1 in September 2026). The pages were not opened. **No 9.1 commands were added.** The sheet says its esxcli rows are not checked on 9.1. |
| Execution context per VMware command | Not changed | Rows are already grouped as ESXi shell or PowerCLI. |
| Compact intro | Partial | The generic switch intro is shorter, the rest under More. The OS9 and Junos intros are unchanged. |
| Collapsed detail under each row | Partial | The Switch Lab "where it runs" lines are collapsed. Tips stay inline. |
| Short example and expected output per command | Not implemented | No examples were added. I did not invent output. |
| Consistent row design across all platforms | Not implemented | |
| Risk warnings visible, copy buttons visible | Complete | Tested. |

### Part 7, quality assurance

| Item | Status |
| --- | --- |
| Desktop and narrow layouts, both themes | Not done. Screenshots are 1280 by 800, dark theme only. |
| Switch Lab Extreme Mode walk-through in a browser | Not done. |

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
| Fit zoom | 55 percent | 75 percent |

CORE-01 is above both DIST switches, which are above both ACCESS switches. Every end device is below its own switch and within 260 px. Arranging twice gives the same result.

Layout uses core, distribution and access names only to break ties between rows when switches of one kind carry such names. It never changes what a device is called or what kind it is.

## 6. Files changed

`index.html` (Switch Lab, Topology Builder, Cheat Sheet and kit data), `tests/engine/pcdiag.mjs`, `tests/engine/suite.mjs`, `tests/engine/fuzz.mjs`, `tests/engine/os9cheat.mjs`, `tests/browser/topology-canvas-controls.test.mjs`, `tests/browser/topology-layout-five-switch.test.mjs`, `tests/browser/cheatsheet-navigation.test.mjs`, `tests/browser/topology-lib.mjs`, `tests/browser/topology-security-and-performance.test.mjs`, `tests/fixtures/five-switch/*`, `tests/README.md`, `.github/workflows/check.yml`, `docs/screenshots/hands-on/*`, and this report.

Two existing tests were changed on purpose. The test helper and one security test now click through the new clear confirmation. The OS9 engine test now expects the Command Prompt pill to be gone, as requested. No assertion was weakened.

## 7. Tests added

- `tests/engine/pcdiag.mjs`: 16 tests (PC-A against PC-B, ipconfig, ipconfig /all, route print, tracert, bad arguments, unknown destinations, read-only, shut port, vendor switch, every Extreme incident, hidden topology).
- `tests/engine/suite.mjs`: two tests for the five-switch network and the end-device kinds.
- `tests/browser/topology-canvas-controls.test.mjs`: 16 checks (trash button, confirm, cancel, empty, no sample reload, undo, grid at low zoom, grid switched off).
- `tests/browser/topology-layout-five-switch.test.mjs`: 13 checks (graph, kinds, overlaps, hierarchy, distance, crossings, Fit zoom, repeatability, pinning).
- `tests/browser/cheatsheet-navigation.test.mjs`: 30 checks (vendor and OS rows, Windows commands still found, RHEL, compact intro, copy buttons, risk badge, ESXi wording).

## 8. Test results

See the last section of this file.

## 9. References used

- Broadcom ESXCLI command reference (`developer.broadcom.com/xapis/esxcli-command-reference`), for `esxcli network ip interface list`.
- Broadcom knowledge base article 412519 (gateway shown as 0.0.0.0 after 8.0 U1a).
- Search results listing VCF 9.1 (Broadcom's version table and secondary articles). Not opened in full. Recheck before relying on the 9.1 dates or build numbers.

## 10. Saved-data compatibility

- Project files and snapshots: no format change.
- New device kinds (`ap`, `phone`, `endpoint`) appear only on devices imported after this change. Older saved models still load; an unknown kind falls back to the Custom icon. A saved model that already holds an LLDP station as a "switch" keeps that kind until re-imported.
- Cheat Sheet: the remembered Command Prompt choice falls back to PowerShell.

## 11. Performance

The engine performance test (120 devices, 5,616 interfaces) is unchanged: parse about 150 to 170 ms. The new layout pass is linear in devices. It was not benchmarked at 150 or more devices in a browser.

## 12. Remaining limitations and work that needs your approval

- Interface label overlap, label reveal on hover, and the link evidence panel need a pass of their own.
- New icons for access point, phone and workstation need artwork in the palette and exports.
- RHEL rows need checking against Red Hat documentation. VCF 9.1 content needs a read of the official release notes.
- Example output per Cheat Sheet command is not started.
- Decide whether PC `ping` and `traceroute` should also become Windows-style.
- Not pushed.

## Test results (run on the final tree, before this report commit)

| Check | Result |
| --- | --- |
| `node scripts/check-scripts.mjs` | 20 scripts, 0 failed |
| `node tests/engine/suite.mjs` | 84 passed, 0 failed |
| `node tests/engine/fuzz.mjs 800` | 0 exceptions, 0 slow batches |
| Other engine tests (sanitizer, configdiff, calculator, routing, switching, switchlab, pcdiag, vsphere, dns, ping, lessons, content, scriptrepo, os9cheat, uitokens, progress) | All pass; none skipped |
| `sh tests/run.sh` | 31 of 31 browser test files passed |

Each new test was written against the old behaviour first where that was possible. The canvas-controls test fails on the previous build (no trash button). The grid check failed in a manual run before the fix (grid count 0 at 35 percent zoom). The layout test measured the old layout (8 overlaps, 5 crossings).
