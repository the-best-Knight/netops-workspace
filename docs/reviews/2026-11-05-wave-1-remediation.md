# Wave 1 remediation, 2026-11-05

This pass works on the four P2 findings and the P2 risk R-01 from `docs/reviews/2026-11-05-independent-deep-audit.md`. Nothing is pushed.

## Summary

| Finding | Status | Commit |
| --- | --- | --- |
| F-04 Log Sanitizer: password after a line continuation | Fixed | `430597e` |
| F-02 Topology Builder: neighbour row cut inside its last column | Fixed, with a limit (see below) | `0973b5e` |
| F-01 Switch Lab: leaving mid-lesson loses it | Fixed by asking first; lesson state is not restored after a reload | `084c0da` |
| F-03 Dell OS10 `switchport trunk native vlan` | Fixed (documentation-backed, not checked on a real switch) | `6ef568a` |
| R-01 Topology Builder autosave across two tabs | Reproduced, then fixed | `31085e0` |

Baseline: `166fd46`. The audit report itself was committed first, unchanged, as `75e2ee6`.

## F-04 Log Sanitizer: password after a line continuation

**Reproduction.** Sanitize `cmd --password \`, then a newline and `  ContPw2026` (synthetic). The output was `cmd --password [SECRET_1]` followed by `ContPw2026` still in clear text.

**Root cause.** The always-on rule `clisecret` matched a flag followed by spaces, then took the next token as the value. That token was the `\`. The rule also required the command and its flag to be on one line.

**Change.** In `clisecret`, a continuation is now allowed in two places:
- between a flag and its value;
- between a command and its flag.

A continuation is Unix `\`, PowerShell backtick or cmd `^`, followed by LF or CRLF and any indentation. This covers `--password`, `--token`, `--api-key`, `--client-secret`, `--community` and the rule's other flags: `sshpass -p`, `docker login -p`, `psexec -p`, `sqlcmd -P`, `ldap* -w`, `plink -pw`, `mysql -p`, `curl -u` and `esxcli -p`/`-c`. A lone continuation character is never taken as a value. Other rules are unchanged.

**Tests.** 11 new cases in `tests/engine/sanitizer.mjs` (61 in total):
- the value on the next line, LF and CRLF;
- `--token`, `--api-key`, `--client-secret` and `--community` after a continuation;
- `mysql -u root \` with `-p...` on the next line, plus `sshpass`, `ldapsearch` and `curl`;
- PowerShell backtick and cmd caret;
- five false-positive inputs that must stay byte-identical (`make install \`, `docker run --rm \`, `echo ... \`, `--password-file \` with a path, `Get-Process` with a backtick);
- a lone trailing continuation;
- sanitizing twice gives the same text, and restore is exact.

9 of the new cases fail on the previous build.

**Limits.**
- A value made of several words after a continuation is cut at the first space, as it already was on one line.
- A secret flag followed by a continuation and then another flag (`--password \` then `--verbose`) takes `--verbose` as the value. That over-redacts, but leaks nothing, and matches the one-line behaviour.

## F-02 Topology Builder: neighbour row cut inside its last column

**Reproduction.** Import a Cisco `show lldp neighbors` table whose last row ends `Gi1/0` (cut from `Gi1/0/1`) and has no closing line. The result was the link `SW-A gi1/0/2 <-> SW-C gi1/0`, a port that does not exist, with no warning.

**Root cause.** A cut port still matches the row pattern, because `Gi1/0` is a valid-looking interface name. Only rows that failed the pattern were flagged as cut off.

**Change, Cisco `show lldp neighbors` and `show cdp neighbors`.**
- IOS ends both tables with "Total entries displayed" (CDP: "Total cdp entries displayed"), and NX-OS uses "Total entries displayed" for CDP too. Both forms are read.
- When that line is missing and the table ends on a row, the row's neighbour is kept, but its remote port is not used. The table is marked partial, so nothing missing from it is treated as gone. The warning quotes the row, for example: `The table ends without its "Total entries displayed" line, so the last row may be cut off: SW-C Gi1/0/2 120 B,R Gi1/0. Its remote port "Gi1/0" is not used; the neighbour is kept with an unknown port.`
- When the footer count differs from the rows read, the import warns.

**Change, Dell `show lldp neighbors` (OS9 and OS10).**
- The last column is the chassis MAC. A partial MAC is dropped with a warning instead of being glued onto the port name.
- A last row with no chassis ID, while the other rows have one, keeps its neighbour without its port.

**No confirmed link from malformed evidence.** The cut row is one-sided, so its link stays inferred, with an unknown remote port. If the far switch reports the cable itself, the link is built from that report, with the right ports.

**Tests.** 11 new engine tests (F-02a to F-02k, 95 in total):
- Cisco LLDP: cut, complete, footer count mismatch, a cut middle row, a wrapped long name;
- legitimate short names `Gi0/1`, `Fa0/24`, `Te1/1/1`, `Eth1/5` and `mgmt0`;
- a later cut paste not marking lost rows gone;
- far-side confirmation;
- CDP, cut and complete;
- Dell: a cut MAC, a missing chassis on the last row, a full OS10 table, OS9 two-word ports.

7 fail on the previous build. Test 5d's NX-OS sample gained the real "Total entries displayed: 1" line. Its assertions are unchanged.

**Limits.**
- A table pasted without its footer loses the remote port of its last row, even when that port was complete. The import says so in a warning. This trades a missing port for never inventing one.
- A row cut inside its last column that still has the footer cannot occur in real output: the footer comes after the last row.
- Detail formats (`show lldp neighbors detail`, `show cdp neighbors detail`) and the Cisco MAC, VLAN and trunk tables were not changed.

## F-01 Switch Lab: leaving a lesson with changes

**Reproduction.** Start lesson 2, configure `description` on SW1, then click "All tools". Nothing asked. On return the lesson was gone. The in-tool "← Labs" button behaved the same way.

**Root cause.** Switch Lab did not implement `window.__kitUnsaved`, the hub's check for unsaved work. The Log Sanitizer and the Topology Builder already did. "← Labs" called `exitLab` directly.

**Change.**
- New `labUnsaved()`, exposed as `window.__kitUnsaved`. It returns a warning only when there is something to lose: a lesson, free practice or Extreme incident with changes, that is not solved or closed.
- The hub already asks on "All tools", other tool links and a reload or tab close.
- "← Labs" now asks the same question through `exitLabAsk`.
- Reset Lab, Solved, Next lesson and "Incident closed" are unchanged.

**Preserving state instead.** Not done. The lab network, consoles, coach logs, verify log and timers live in memory across many variables. Restoring them reliably after a reload would be a larger change, with its own risk of restoring a solved or failed state by mistake. Asking first fits the existing architecture.

**Tests.** New browser test `fault-lab-leave` (9 checks):
- no changes: no question;
- All tools with changes: asks, and Cancel keeps the lesson and its change;
- "← Labs": Cancel keeps the lesson, OK leaves;
- reload: held by the browser's own prompt;
- after Reset Lab: no question;
- a solved lesson: no question;
- Extreme Mode: nothing at start, a warning after a change, none once closed.

It fails on the previous build. `fault-lab-free` (29 checks) still passes.

**Limits.** A reload or closed tab still loses the lesson after you confirm. Nothing is restored.

## F-03 Dell OS10 native VLAN

**Evidence.**
- [Dell KB 000137464](https://www.dell.com/support/kbdoc/en-us/000137464/dell-emc-networking-os10-how-to-configure-native-access-untagged-vlan-on-a-trunk-port), opened. It sets the untagged VLAN on an OS10 trunk with `switchport mode trunk` plus `switchport access vlan <id>`, with this example:

  ```
  OS10(conf-if-eth1/1/1)# switchport mode trunk
  OS10(conf-if-eth1/1/1)# switchport access vlan 20
  OS10(conf-if-eth1/1/1)# switchport trunk allowed vlan 10
  ```

  It does not mention `switchport trunk native vlan`.
- The SmartFabric OS10 User Guide 10.5.3 (opened; only its navigation could be read) lists `switchport access vlan` and `switchport trunk allowed vlan` among the interface commands, and no `switchport trunk native vlan`.
- The [10.5.1 `switchport trunk allowed vlan` page](https://www.dell.com/support/manuals/en-us/dell-emc-smartfabric-os10/smartfabric-os-user-guide-10-5-1/switchport-trunk-allowed-vlan?guid=guid-12846a2d-1b7d-40cb-9aa5-b7d126b89de8&lang=en-us) is consistent with this.
- No OS10 release, platform or interface type was found that documents `switchport trunk native vlan`. The KB says not every product version is listed.

**Conclusion.** The correction is justified by Dell's documentation. It was not tested on a real OS10 switch.

**Changes.**
- **Cheat Sheet:** the four Dell rows (Native VLAN of a trunk, Trunk native VLAN, the Trunk uplink snippet, Native VLAN) use `switchport access vlan`. The Switch Lab row explains why and how to check it. Cisco rows are unchanged.
- **Simulator, Dell:**
  - `switchport trunk native vlan` is invalid input.
  - On a trunk port, `switchport access vlan` sets the native VLAN and keeps the port a trunk. Before, it silently turned the port into an access port, which real OS10 does not do.
  - `show running-configuration` prints the OS10 form.
  - `switchport trunk ?` no longer offers `native`. Help under a command the vendor does not have answers with invalid input instead of `<cr>`.
- **Cisco:** `switchport trunk native vlan` works as before.
- **Extreme Mode:** every incident can still meet its "native VLAN 99" rule on Dell, using the OS10 command.

**Tests.** New runner `tests/engine/os10native.mjs` (8 tests), added to `tests/README.md` and CI. 5 fail on the previous build. The Cheat Sheet baseline changed only for these four Dell rows.

**Limits.**
- An OS10 access port with access VLAN 20 that is then changed to trunk keeps native VLAN 1 in the simulator. Real OS10 would keep 20 as the untagged VLAN. Not changed in this pass.
- Not verified on hardware.

## R-01 Topology Builder autosave with two tabs

**Reproduction.** Two tabs, one browser profile, synthetic diagrams and passphrases. To tell whose copy was stored, the probe decrypted it with the same envelope the tool writes.
- Tab B turning autosave on silently replaced tab A's copy, while tab A still showed autosave as on.
- Tab A's next save replaced tab B's copy.
- Tab B turning autosave off deleted the only copy.
- After a reload, tab A had nothing to restore.

**Root cause.** One record (`ntb-autosave`, key `project`), with no record of which tab wrote it. Writes and deletes did not check.

**Change.**
- Each tab gets an owner id, and every stored copy records it.
- A tab writes or deletes the copy only when it is its own, one it restored, or the specific copy it agreed to replace (owner plus time). The check and the write happen in one IndexedDB transaction.
- Turning on over another copy asks "Replace the copy kept in this browser?".
- A tab whose copy was taken over stops keeping one and says so on screen.
- Turning off and Clear delete only the tab's own copy. Turning off says when another tab's copy was left alone.
- The "Delete it" button on a found copy still deletes it on purpose.

**Tests.** New browser test `topology-autosave-tabs` (12 checks, two real tabs). 6 fail on the previous build.

**Limits.**
- Still one copy per browser. Two tabs cannot both keep copies at the same time; the second asks to replace the first.
- Copies saved before this change have no owner. They are treated like another tab's copy, so the first "Turn on" after updating asks once.
- No live notice in the other tab at the moment of takeover. The notice appears on that tab's next save, at most 4 seconds after its next edit.

## Test results

Run on `31085e0`, the last code commit, with the same tools as the audit (Node v26.12.0, Firefox 159.0.1 headless, macOS).

| Check | Result |
| --- | --- |
| `node scripts/check-scripts.mjs` | 20 scripts, 0 failed |
| `node tests/engine/suite.mjs` | 95 passed (84 before) |
| `node tests/engine/sanitizer.mjs` | 61 passed (50 before) |
| `node tests/engine/os10native.mjs` (new) | 8 passed |
| Other engine runners (calculator, configdiff, content, dns, lessons, os9cheat, pcdiag, ping, progress, routing, scriptrepo, switching, switchlab, uitokens, vsphere) | All pass, none skipped |
| `node tests/engine/fuzz.mjs 800` | 800 batches, 0 exceptions, 0 slow batches, `Object.prototype` clean |
| `sh tests/run.sh` | 36 of 36 browser files passed in 9 min 46 s (34 before; new: `fault-lab-leave`, `topology-autosave-tabs`) |

Each new test was also run against the build before its fix. Failures there:

| Test | Failures on the previous build |
| --- | --- |
| Sanitizer | 9 of 11 |
| F-02 | 7 of 11 |
| `os10native` | 5 of 8 |
| `fault-lab-leave` | fails |
| `topology-autosave-tabs` | 6 of 12 |

No existing assertion was removed or loosened. Test 5d gained a footer line in its input.

## Not verified

- F-03 on a real Dell OS10 switch.
- F-01 on a real Windows browser. The hub's prompt uses `window.confirm`, which the tests replace to read the question.
- R-01 in Chrome or Edge. Only Firefox was run.

## Deferred

Everything in Waves 2 to 4 of the audit, apart from F-01 and R-01. That includes F-05 to F-09, the eight known open items, R-02, R-03 and D-01.

## Local Git state

`main` is 7 commits ahead of `origin/main` (`166fd46`), not pushed:

| Commit | What |
| --- | --- |
| `75e2ee6` | The independent audit report, unchanged |
| `430597e` | F-04 |
| `0973b5e` | F-02 |
| `084c0da` | F-01 |
| `6ef568a` | F-03 |
| `31085e0` | R-01 |
| (next) | This report |
