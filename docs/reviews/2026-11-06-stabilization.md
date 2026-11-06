# Switch Lab stabilization, 2026-11-06

A verification and fix pass over the six Wave 2 commits (`2db2e49` to `8d938ca`). Starting point: `8d938ca`, clean, 6 commits ahead of `origin/main` (`fc7fea2`), nothing pushed. Read with `docs/reviews/2026-11-05-overnight-wave-2.md`.

## Commands

The repository has no package manager, linter, type checker or build step. Verification is the same as CI (`.github/workflows/check.yml`, `browser-tests.yml`):

```sh
node scripts/check-scripts.mjs
node tests/engine/suite.mjs
node tests/engine/fuzz.mjs 800
for t in sanitizer configdiff calculator routing switching switchlab pcdiag vsphere dns ping lessons content scriptrepo os9cheat os10native uitokens progress; do node tests/engine/$t.mjs; done
sh tests/run.sh
sh tests/runner-isolation.sh
```

CI has only run on the pushed `fc7fea2` (all four workflows passed). None of the local commits has CI results.

## Baseline (`8d938ca`)

- Syntax 20/20, `suite` 109/109, fuzz 800 batches with 0 exceptions, all 17 tool runners passed (`pcdiag` 40, `switchlab` 55).
- Browser 39/40 files. The one failure, `fault-lab-resume`, is not a baseline defect: its two new checks (added during this session while the run was in progress) ran against the old code. The other 13 checks in that file passed.
- `tests/runner-isolation.sh` 14/14.

## Final (`a55e33b`)

- Syntax 20/20, `suite` 109/109, fuzz 800 batches with 0 exceptions, all 17 tool runners passed (`switchlab` 58, `pcdiag` 41).
- Browser 40/40 files, no console errors.
- `tests/runner-isolation.sh` 14/14.

## Confirmed bugs fixed

| Bug | Fix | Test (fails on `8d938ca`) | Commit |
| --- | --- | --- | --- |
| Switching vendor mid-lesson left the kept lesson copy on the old vendor, so a reload brought it back | `resumeSave()` on vendor change | `fault-lab-resume`: "switching vendor mid-lesson updates the kept copy" | `8ce5536` |
| A kept copy from before a lesson changed was still offered when devices and cables matched (a changed fault, address or VLAN slipped through) | The copy stores a fingerprint (FNV-1a) of the lesson's fresh build; lesson builds were checked to be deterministic | `fault-lab-resume`: "a copy from an older version of the lesson ..." | `8ce5536` |
| F-08: Cisco `ip dhcp snooping` (global, `vlan`, interface `trust`) and OS10 interface `mtu 1312-9216` answered "invalid input" | Recognised with a "not simulated, nothing configured" note; misspellings and out-of-range MTU stay invalid | `switchlab`: two F-08 tests | `d9c6b6b` |
| F-09: after `spanning-tree mode mst`, the summary said mst mode and listed per-VLAN roots | `mode mst` is recognised with a note and the switch keeps PVST/Rapid-PVST, so the summary stays consistent; real MST is an Opus candidate | `switchlab`: F-09 test | `d9c6b6b` |
| A Windows PC console opened with "Connected to PC-A console (9600 8N1)" | "Command Prompt on PC-A"; switches keep the serial line | `pcdiag` W2-01 | `a55e33b` |

## New regression coverage

- `fault-lab-resume` 14 to 18 checks: vendor switch, changed-lesson fingerprint, a newly opened tab has nothing to resume, a second tab does not replace the first tab's copy.
- `pcdiag` W2-13: every guided lab, both vendors, with faults alone and combined (wrong access VLAN, VLAN 10 pruned from trunks, routes lost, gateway SVI shut plus a switch link cut): ping and tracert agree on every PC/server and target, and ping matches `canPing`. Over 2,000 pairs. Passed on first run: no disagreement found.
- `pcdiag` W2-01: first console line for a PC and a switch.
- `switchlab`: F-08 Cisco DHCP snooping, F-08 OS10 MTU, F-09 MST.

## Persistence

Covered by `fault-lab-resume` (18 checks, real browser):

| Case | Result |
| --- | --- |
| Reload during an active lesson; offered back on the lab list | Pass |
| Resume restores the switch changes; console starts empty | Pass |
| Completion after recovery: Check Goal still asks for the test, no quiz | Pass |
| Corrupted JSON | Ignored and removed |
| Altered copy (renamed device, missing cables) | Ignored and removed |
| Unknown lesson id | Ignored and removed |
| Stale copy from a changed lesson definition | Ignored and removed (new) |
| Vendor switch mid-lesson | Copy follows (new) |
| New tab (closing and reopening a tab gives a new sessionStorage) | Nothing to resume (new) |
| Two tabs | Each keeps its own copy (new) |
| Console output not kept | Pass |
| Leave warning | Still asks; mentions resuming from the tab |
| Reset Lab and Discard | Remove the copy |

Separation from project autosave: lesson copies use `sessionStorage` key `nfl_resume_v1` in the Switch Lab; the Topology Builder autosave uses IndexedDB `ntb-autosave`. No shared keys or code. `topology-autosave-tabs` (R-01) passes in the final run.

Not covered: storage quota failure (writes are wrapped in try/catch and fail silently, so the lesson continues without a kept copy; untested), "duplicate tab" in a browser (copies sessionStorage, so both tabs start with the same copy; not automatable with the current runner).

## Adversarial networking

- Guided labs with combined faults (W2-13) and Extreme incidents with faults (W2-10): ping and tracert agree everywhere, and ping matches the model (`canPing`, `xPing`).
- Unsupported commands on a PC: not recognized (W2-07). PowerShell setters, netsh, route and DHCP changes refused, state unchanged (W2-12).
- Intentional simplifications, not bugs:
  - `tracert` stops after three time-outs instead of 30.
  - Times are fixed (`<1 ms`, `1 ms`).
  - ACL denies show time-outs, not "administratively prohibited".
  - Dell routers never send unreachables (default unconfirmed, below).

## Accessibility and visual QA

Measured in headless Firefox at 1440x900, 820x1100 and 390x844, light and dark, on the PC console, the resume strip and Cheat Sheet example details (PowerShell and Junos):

| Check | Result |
| --- | --- |
| Console prompt and output contrast | Prompt 9.8:1, lines at least 7.5:1 (console is dark in both themes) |
| Resume text contrast | 14.2:1 light, 12.2:1 dark |
| Example output contrast | 12.9:1 light, 13.5:1 dark |
| Horizontal page overflow | None at any width |
| Example output | Scrolls inside its box (`overflow-x: auto`); the table does not widen; copy button stays visible (42 to 58 px tall) |
| Details summary | Focusable, opens on activation |
| Resume buttons | 35 px tall, wrap cleanly at 390 px |
| Focus ring | A global `:focus-visible` 2px outline applies. A headless window never has focus, so `:focus-visible` cannot match under automation (the repo's `ui-design` test documents this); Enter on a button was not delivered for the same reason. Verified by rule, not by sight. |

Findings:
- Fixed: the serial-console line on Windows PCs.
- Not fixed, for review: in lesson 1 (PC port shut on the switch) the Inspector lists the PC's `eth0` as `up` while `ipconfig` says Media disconnected. Showing `down` could reveal the fault, so this is a teaching decision.

Screenshots were taken but not committed (scratch folder); they show no layout defect.

## Vendor documentation

| Question | Finding | Status |
| --- | --- | --- |
| Dell OS10 default for `ip unreachables` | Sources disagree. The DISA STIG for Dell OS10 says the default is disabled ([STIG viewer V-269889](https://www.stigviewer.com/stigs/dell_os10_switch_router/2024-12-11/finding/V-269889), read through a search summary; the page returns 403). An OS10 YANG model says unreachables are enabled by default ([NETCONF Central os-icmp-config](https://netconfcentral.org/modules/os-icmp-config/2018-08-17/source/raw), search summary). The fix example `no ip unreachables` on an interface ([ato-pathways mirror](https://ato-pathways.com/catalogs/xccdf/items/158537), read) states no default. | Unresolved. The lab keeps Dell silent. |
| Windows `tracert` with the adapter disconnected | "Unable to contact IP driver. General failure." appears only in forum reports ([GTPlanet thread](https://www.gtplanet.net/forum/threads/tracert.84981)). No Microsoft source found. | Medium confidence, unchanged |
| OS10 `show port-channel summary`, `show vlan`, `show ip route` output | Dell InfoHub and manual mirrors redirect or return 403 to automated reads. | No output added |
| OS10 `show lldp neighbors` with `Not Advertised` | Dell guides show "Not Advertised" in the host name column (search summary of Dell's S3048-ON VxRail and MX guides). | Supports the W-07 parser rule |

## F-05 to F-09

| ID | Status |
| --- | --- |
| F-05 TTL and hop count to the gateway's far interface | Fixed in `2db2e49` (W2-02) |
| F-06 ping and tracert disagree when the gateway does not answer | Fixed in `2db2e49` (W2-03, W2-09, W2-10, W2-13) |
| F-07 draw.io export kinds | Fixed in `f598f5c` (`topology-export-kinds`) |
| F-08 valid commands rejected | `ip routing` already worked; DHCP snooping and OS10 MTU now recognised as not simulated (`d9c6b6b`). Cisco interface `mtu` stays invalid: the lab's WS-C2960CX uses `system mtu`. |
| F-09 MST summary | Contained in `d9c6b6b`: MST is not entered. Real MST is an Opus candidate. |

## Remaining risks

- Lesson resume relies on `markChanged()` and `saveStartup()` being called for every state change. A change path that skips them would not be kept.
- The ping/tracert decision for guided labs walks `routeCandidates` separately from `canPing`; the sweeps found no disagreement, but the two models could drift if routing code changes.
- Vendor behaviours above remain unverified on hardware.

## Final git state

- `main` at the report commit, 10 commits ahead of `origin/main` (`fc7fea2`), clean working tree.
- Not pushed: earlier sessions pushed only with explicit approval. CI therefore has no results for any local commit.
