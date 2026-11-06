# Opus handoff

## 1. State

- HEAD: the report commit after `a55e33b` on `main`, 10 local commits ahead of `origin/main` (`fc7fea2`). Nothing pushed; CI has not run on any local commit.
- Working tree: clean after the report commit.
- Full results: `docs/reviews/2026-11-06-stabilization.md`. Earlier context: `docs/reviews/2026-11-05-overnight-wave-2.md`.

## 2. Work since `fc7fea2`

| Commit | Change |
| --- | --- |
| `2db2e49` | Windows PC prompt and commands; `winDiag` gives ping and tracert one answer (F-05, F-06) |
| `47677a7` | Lesson resume in sessionStorage |
| `86fbcbf` | Auto Arrange: lone end device beside a dual-homed switch; tighter host lines |
| `f598f5c` | draw.io export keeps AP, phone and end-station kinds (F-07) |
| `9bacea7` | Cheat Sheet example output, verified dnf and Junos tips |
| `8d938ca` | Overnight checkpoint |
| `8ce5536` | Resume follows a vendor switch; rejects copies from a changed lesson (build fingerprint) |
| `d9c6b6b` | F-08 DHCP snooping and OS10 MTU, F-09 MST, recognised as not simulated |
| `a55e33b` | PC console opens as a Command Prompt |

## 3. Tests

Final run on `a55e33b`: syntax 20/20, `suite` 109/109, fuzz 800 with 0 exceptions, all 17 tool runners passed (`switchlab` 58, `pcdiag` 41), browser 40/40 files, runner isolation 14/14. The headless browser cannot show `:focus-visible` rings or deliver Enter to buttons, so focus behaviour is verified by CSS rule only.

## 4. High-risk areas (all in `index.html`)

- **`winDiag`, `winDiagG`, `winDiagX`, `winTrace`, `winPingCmd`** (Switch Lab block, search `function winDiag(`). Guided labs walk `routeCandidates` and `canPing` per router; Extreme uses `xPing` and `xPath`. Tests: `tests/engine/pcdiag.mjs` W2-02 to W2-13.
- **`buildTraceHops`** (search `function buildTraceHops(`): now stops when a router owns the target. It is shared with the Cisco and Linux-style switch `traceroute`.
- **Lesson resume**: `resumeShape`, `resumeBase`, `resumeSave`, `resumeRead`, `resumeStart` (search `RESUME_KEY`). It depends on every state change calling `markChanged()` or `saveStartup()`. Test: `tests/browser/fault-lab-resume.test.mjs`.
- **Auto Arrange**: `nmxLayered` and `nmxLayeredCore` in the Topology Builder block (side and beside placement, refinement rounds, stand-ins for row-skipping links, terminal-line split). Tests: `tests/browser/topology-auto-arrange.test.mjs`, `topology-layout-five-switch.test.mjs`; benchmark `docs/reviews/evidence/2026-11-05-layout/layout-compare.mjs`.

## 5. Unresolved findings

- **Real MST (F-09 follow-up).** `spanning-tree mode mst` is now refused with a note. A real model needs instances, VLAN-to-instance mapping, `spanning-tree mst N priority`, per-instance root election, and MST summary and detail formats (`MST0000`). Code: `guidedStpCisco`, `stpSolve`, `stpPortsOf` (search `function guidedStpCisco(`). Options:
  1. Leave it as not simulated (current).
  2. Model MST0 only: one instance carrying all VLANs.
  3. Model full MST.

  Needs a decision on lab scope.
- **Dell OS10 `ip unreachables` default.** Sources contradict each other (STIG says disabled, YANG model says enabled). The code is in `winSendsUnreach` (Dell returns false). Changing it changes Dell ping output in labs 3, 13 and 14.
- **Inspector versus ipconfig.** In lesson 1 the Inspector shows the PC's `eth0` as `up` while `ipconfig` shows Media disconnected. Changing this could reveal the fault (teaching decision).
- **`tracert` after time-outs.** The lab prints three timeout lines; Windows continues to hop 30. This is a simplification.
- **Large topology access rows.** On the 146-device fixture, distribution-to-access links still cross wrapped access lines (42 to 46 links through a box). Pod-style placement was tried and rejected (long links got worse).

## 6. Deeper reasoning needed

- Whether `winDiagG`'s router walk can be replaced by one path function shared with `canPing`, so the two models cannot drift.
- Whether resume should also cover Extreme incidents (scoring and timer integrity).
- MST scope (above).

## 7. Files and tests

- Code: `index.html` (blocks `src-fault-lab`, `src-topology-builder`, `kit-data`).
- Engine tests: `tests/engine/pcdiag.mjs` (W2-01 to W2-13), `tests/engine/switchlab.mjs` (F-08, F-09), `tests/engine/suite.mjs` (W-01 to W-14).
- Browser tests: `fault-lab-windows-pc`, `fault-lab-resume`, `topology-auto-arrange`, `topology-export-kinds`.

## 8. Suggested priorities

1. Review `winDiagG` against `canPing` (correctness of every PC diagnostic), then push after CI.
2. Decide the Dell unreachables default and the MST scope.
3. Review the resume integrity rules (fingerprint, shape, what is restored).
4. Review the Auto Arrange heuristics for edge cases beyond the 10 fixtures.
