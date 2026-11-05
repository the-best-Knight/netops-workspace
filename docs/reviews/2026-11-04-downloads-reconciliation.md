# Downloads copy versus the repository

Date: 2026-11-04. Compared: `~/Downloads/Premium_IT_Skills_Kit.html` (header "1.14") against `index.html` on `main`. Nothing from the Downloads copy has been merged. The Downloads copy is not treated as newer or authoritative.

## How the comparison was done

1. A plain diff against the repo at `330c7e5`, the commit the Downloads copy appears to start from, to list the Downloads-only changes.
2. A three-way merge (`330c7e5` as the base) in a scratch folder, to find real conflicts. There is exactly one: the Dell LLDP parser.
3. A scratch build with all Downloads changes plus the repo's fixes, run through the engine tests and the full browser suite, to find regressions. The scratch build passed the engine suite and 24 of 28 browser files. It failed 4 files and 7 checks (listed below).

Interface normalization (`ifKey`) is identical in both copies. The Downloads copy changes nothing about it.

## Comparison table

Classes: **Implemented** (already in the repo), **Integrate** (worth merging), **Skip** (unnecessary), **Harmful** (breaks a test or a stated rule), **Investigate** (not enough evidence).

### Topology Builder

| # | Downloads-only change | Class | Why |
| --- | --- | --- | --- |
| 1 | "Show inferred" on by default (checkbox and `nmUi.overlay`) | Harmful | The repo's rule and tests say confirmed topology is the default. Browser checks "Confirmed topology is the default" and "inferred links are dashed" fail, and "only the switch reports the cables, so they are drawn dashed" fails. Uncertain links should not be on screen by default. |
| 2 | After an import: turn on inferred links and labels, then auto-arrange when there are 3 or more devices; the "Done" button also arranges | Harmful | Moves devices after every import. Browser checks "a routine import keeps positions, pins, your own name and colour" and "Auto-arrange asks first, keeps pinned devices" fail. Breaks the rule that manual edits are not overwritten. |
| 3 | Import summary button reads "Done — show diagram"; the issues button appears only when there are issues, with a count | Integrate | Clearer. Take it without the arrange call from #2. Not tested on its own yet. |
| 4 | Collapse two or more parallel physical links between the same pair of devices into one thick "multi" link | Investigate | Changes the link model that health, exports, VLAN views and paths read. Two browser checks about bundles and rejecting a confirmed link fail in the scratch build (`topology-manual-edits`). I did not separate this change from the others, so I cannot say how much of that is its fault. It also hides individual cables, which cuts against showing each physical link with its own evidence. |
| 5 | Layout: busy devices rank higher; wider spacing for groups over 16 | Investigate | Probably harmless, but "Auto-arrange asks first" fails in the scratch build and I did not isolate the cause. |
| 6 | Shorten long interface names in the interface list (`nmxShort`) | Integrate | Cosmetic. The hover title still has the full name. Untested. |
| 7 | ESXi detected from host names like `vmh1` or `esx-` | Investigate | Name-only guessing, and the pattern looks specific to one site. The importer's rule is evidence first. Needs a reason and a test. |
| 8 | Prompt fallback for hostnames with brackets, for example `[SITE_1]-sw2-601# show ...` | Integrate | Useful for odd prompts, but needs a test. Also the comment contains a hostname that looks like it comes from work, so reword the comment to a neutral example before merging. |
| 9 | Hard-coded `vendor = "Dell", os = "Dell OS10"` on `dell.lldp` | Harmful | Verified: with this change an LLDP table sent to a switch recorded as "Dell OS9 (FTOS)" changes its OS to "Dell OS10". The merge overwrites the OS field, so a version string such as "Dell OS10 10.5.2" would also be cut down to "Dell OS10". The repo's test "an LLDP table does not overwrite the OS recorded from the configuration" fails on the scratch build. |
| 10 | Same hard-coded OS10 on `dell.status`, `dell.vlan`, `dell.pc` | Investigate | Their headers look OS10-specific, but the overwrite problem in #9 applies. Set the vendor only, or set the OS only when it adds information. |
| 11 | Dell LLDP row parsing: host, MAC and vmnic rows; "not advertised"; trimming a trailing ellipsis | Integrate | Plausible for Dell with ESXi. This is the one textual conflict. It must be merged by hand with the OS9 two-word-port logic and tested with a fixture. I have no captured output, only the Downloads author's code as evidence. |
| 12 | Trunk handling: treat ports with observed tagged VLANs as trunks for any vendor, not only Dell | Investigate | Could change VLAN views for non-Dell devices. Needs a test. |

### Switch Lab and other tools

| # | Downloads-only change | Class | Why |
| --- | --- | --- | --- |
| 13 | `ipconfig` and `ipconfig /all` on PCs and servers, with help text and refusal of `/release` and `/renew` | Integrate | All Switch Lab and Fault Lab browser checks passed on the scratch build. Read the new code once more for the MAC and DNS lines before merging. |
| 14 | Traceroute note when the target is on the same subnet | Integrate | Teaches a real point and touches only the message. |
| 15 | PCs renamed `PC-U1/U2/U3` to `PC-A/B/C`, `PC-H1/H2` to `PC-A/B`, `U1` and `MGMT-PC` to `PC-A` and `PC-M`; goal checks follow | Investigate | Your choice. Lesson text elsewhere may still use the old names. Tests passed on the scratch build, but they may not read lesson prose. |
| 16 | Any name with "guest" counts as a guest computer | Integrate | Trivial. |
| 17 | Cheat Sheet rows for Cisco `configure terminal revert timer` and Dell `commit` | Investigate | Needs a documentation source before it goes in. The Dell row says OS10 has no revert timer. I have not verified that. |
| 18 | Header "1.14" and a missing final newline | Skip | Version numbers are your call. |

### In the repo but not in the Downloads copy

The Downloads copy lacks all of these, so copying it over `index.html` would undo them: the Manual Redaction bar change; the `--More--` handling and wrapped VLAN ports; the two-word Dell OS9 LLDP ports; the shutdown-with-neighbour flag; the Junos hint; the OS9/OS10 LLDP label; the cut-off table handling; and the new regression tests and fixtures.

## The two importer defects investigated in this round

### Dell OS9 versus OS10 LLDP

- **Ambiguity:** OS9 and OS10 print the same table header (`Loc PortID  Rem Host Name  Rem Port Id  Rem Chassis Id`), so the one parser took both and always called the result "Dell OS10".
- **What tells them apart:** the port names. OS9 writes `Te 0/1`; OS10 writes `ethernet1/1/1` or `mgmt1/1/1`. The other Dell tables did not show this problem in my probe: an OS9-style `show interfaces status` table (my own sample, not a capture) is not recognised, because the OS10 status header needs a `Mode` column.
- **Fix (b43651b):** the label says OS9 or OS10 when every row agrees, and "OS9 or OS10 not identified" when no row or mixed rows do. The table sets the vendor to Dell and never sets the OS version. Fixtures: `os9-lldp.txt`, `os10-lldp.txt`, `dell-lldp-unknown.txt`. They are written from Dell's documented layout, not captured from a device.
- **Not done:** the device's OS is not inferred from LLDP. Only the label changes.

### Truncated status tables

- **Correction to the earlier audit:** `show interfaces status`, Dell status and the CDP table already warned "Row not understood". The audit's claim that rows were dropped silently was wrong for them, and the audit report is corrected (7663d8a).
- **Real gaps found:** `show ip interface brief` and the Dell LLDP parser warned about nothing. No parser marked a cut-off table as partial, so interfaces after the cut were marked gone and the review list said they were missing.
- **Fix (e7f1660):** if the last line of a table cannot be read, the warning says the paste looks cut off, the valid rows are kept, nothing is invented, and the section is marked partial. Partial sections no longer mark anything gone. A bad row in the middle still gets the old warning and does not mark the table partial.
- **Limit:** a row cut off inside its last column still matches the row pattern and looks complete. Only the Cisco status, `ip interface brief`, Dell status, Dell LLDP and CDP tables were checked. The Cisco LLDP table, VLAN, trunk, EtherChannel and MAC tables were not.

## Tests

| Check | Result |
| --- | --- |
| `node scripts/check-scripts.mjs` | 20 scripts, 0 failed |
| `node tests/engine/suite.mjs` | 82 passed, 0 failed (77 before this round) |
| `node tests/engine/fuzz.mjs 800` | 0 exceptions, 0 slow batches |
| `sh tests/run.sh` on the repo | 28 of 28 files passed |
| The earlier four importer fixes | Still pass (their tests are in the suite) |
| Manual Redaction bar | Change still present; the Log Sanitizer browser tests pass |
| Scratch build with all Downloads changes | Engine suite: 5 of the new tests fail. Browser: 24 of 28 files; failed `topology-links-and-health.dark`, `topology-manual-edits`, `topology-projects-and-snapshots`, `topology-windows-import` |

Five of the new engine tests fail on the scratch build: the OS9/OS10 label, the OS not being overwritten, and the three cut-off table tests. They fail there because the Downloads copy does not have those fixes, not because of a regression.

## Recommendation

- The prepared commits are ready to push. They are independent of the Downloads copy, the tests pass, and the branch is a straight line on `main`.
- Do not merge the Downloads copy wholesale. Items 1, 2 and 9 break tests or stated rules.
- If you approve, integrate items 3, 6, 8, 11, 13, 14 and 16 first, each in its own commit with a test, and investigate 4, 5, 7, 10, 12, 15 and 17 afterwards.
