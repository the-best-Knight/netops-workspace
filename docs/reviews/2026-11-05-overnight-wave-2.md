# Overnight Wave 2, 2026-11-05: checkpoint

The session stopped early on a usage limit. This is a checkpoint, not the full report. Nothing is pushed.

Baseline: `fc7fea2`, clean, equal to `origin/main`.

## Done and committed (local only)

| Commit | What | Tests |
| --- | --- | --- |
| `2db2e49` | Switch Lab PCs as Windows hosts: `C:\>` prompt, one reachability answer for ping and tracert (F-05, F-06), Cisco router "Destination net unreachable", `traceroute` and switch commands not recognized on PCs | pcdiag W2-01 to W2-11 (10 fail on `fc7fea2`), browser `fault-lab-windows-pc` |
| `47677a7` | Resume an unfinished lesson after a reload in the same tab (sessionStorage, network state only, validated against a fresh build); PowerShell setters read-only | browser `fault-lab-resume` (14 checks), pcdiag W2-12 |
| `86fbcbf` | Auto Arrange: a lone end device beside a dual-homed switch (636 to 240 px); tighter host lines in large networks (long links 48 to 40, links through a box 42 to 46) | `topology-auto-arrange` dual-homed checks (fail on `fc7fea2`) |
| `f598f5c` | draw.io export keeps access point, phone and end-station kinds (F-07) | browser `topology-export-kinds` (11 checks, fail on `fc7fea2`) |
| (last commit) | Cheat Sheet example output and verified RHEL/Junos tips | content, os9cheat, os10native, cheatsheet browser tests |

Focused suites passed after each step. Engine runners and the Switch Lab and Topology browser files touched were rerun.

## Not done

- Full test run (all engine runners, fuzz 800, all browser files) on the final commit.
- Persistence tests beyond R-01 (quota failure, corrupted autosave), adversarial pass, light/dark screenshots, accessibility check of the new example details.
- Dell OS10 output for port-channel, VLAN and route: no readable Dell source this session.
- F-08 and F-09 Switch Lab items.

## Unverified

- Dell OS10 default for ICMP unreachables: not confirmed, so Dell routers stay silent in the lab.
- Windows `tracert` wording "Unable to contact IP driver. General failure." for a disconnected adapter: medium confidence.
- OS10 example output: column headers from Dell documentation quoted in search results; rows synthetic.

## Readiness

Hold. Run the full suite on the last commit before deciding to push.
