# IT Skills Kit remediation, 3 November 2026

This pass fixes the 14 defects in [2026-11-03-deep-review.md](2026-11-03-deep-review.md), starting from commit `9057683`. It adds no features and changes no UI layout. Sections 1 to 9 describe the first commit on this branch (`a4cd402`). Section 10 covers the follow-up after an independent review of that commit (IR-01 to IR-04), and its numbers replace the test counts in section 8.

## Summary

| Status | Items |
|---|---|
| Fixed and verified | DR-01 to DR-14, plus N-01 (found during this pass), R-01 to R-05 (found by the first independent review), and IR-01 to IR-04 and R-06 (found by the second review and by its tests) |
| Fixed only for Cisco, Dell left as it was | DR-03, DR-04, DR-07 (the Dell spanning-tree view) |
| Unresolved, kept separate | SC-01 to SC-06 |
| Found during this pass, not fixed | N-02, N-03 (N-04 is fixed as IR-04) |
| Intentionally unsupported | Dynamic routing, OS10 RPVST+ output, real vMotion checks, CDP on hosts |

## 1. Findings, resolutions, evidence and tests

"Old" means the acceptance test was run against the original `index.html` from `9057683` (`KIT_FILE=<old copy> node tests/engine/<file>.mjs`). "New" means it was run against the fixed file. The full output is in `evidence/old-code-*.txt` and `evidence/new-code-*.txt`.

| ID | Defect | Resolution | Evidence | Acceptance test | Old | New |
|---|---|---|---|---|---|---|
| DR-11 | Wi-Fi key from `netsh wlan show profile key=clear` leaked | New `wlankey` rule hides the value after `Key Content :`. `ciscodevkey` no longer treats the word `Content` as a device key | Windows `netsh` output format; leak corpus now catches it | `sanitizer.mjs`: "Key Content is hidden...", "a key with spaces...", "a lone Key Content line..." | FAIL | ok |
| DR-12 | Any `name=` or `name:` value became `/var/log/synth/file_N.log` | `auditpath` takes a `name` value only when it looks like a path. A new `namefield` rule replaces other `name` values with `[ID_n]`, so they stay hidden | 13 lines in the repo's own fixtures had this (ESXi `Host Name`, LLDP `System Name`, Windows `Name`). All 13 now read `[ID_n]` | "name values are not turned into log file paths"; guards: "name values that are not paths stay hidden" (added after the review showed the first test passed with the new rule switched off), "auditd path values are still replaced with a path" | FAIL | ok |
| DR-13 | Windows DF failures reported as "target may be down" | `Packet needs to be fragmented but DF set.` (with or without `Reply from`) is an MTU probe, and an MTU note replaces the "may be down" text when every lost probe was an MTU failure | The analyzer's own reference (`index.html`, ping-analyzer tips) says this message means the path MTU is smaller | `ping.mjs`: "Windows DF failure...", "a mix of DF errors and replies..."; guard: "an ordinary total loss still says..." | FAIL | ok |
| DR-14 | Linux `local error: message too long, mtu=N` read as "no probes found" | `ping: local error:` no longer starts a new ping block, and the line is an MTU probe carrying N | iputils output; summary line `+2 errors` | "Linux local MTU error: probes counted, MTU 1400 named" | FAIL | ok |
| DR-01 | `show inventory` named a different chassis from `show version` | Inventory uses the same PID as `show version`: WS-C2960CX-8TC-L, ISR4331/K9, S4148T-ON or S5248F-ON | The lab's own `show version` | `switchlab.mjs`: "every guided switch, cisco" and "dell" (all 18 labs) | FAIL | ok |
| DR-02 | Labs 13 and 14 used Gi0/24 on an 8 + 4 port switch | Renamed to Gi0/8 in the lab data, links, Cisco text and Dell text (`ethernet1/1/8`) | Data sheets list 8 copper access ports. Gi0/1 to Gi0/8 are the only numbers certain to be copper | "no guided lab builds a port the declared switch does not have"; consistency guard: "ports named in each lab text exist in that lab" (passes on old code too, by design) | FAIL | ok |
| DR-03 | `show spanning-tree vlan 10` printed VLAN 1 | Cisco guided view is per VLAN: priority 32768 + VLAN, ports by access VLAN or trunk allowed list, port ID 128.<port number> | IOS extended system ID (priority = configured + VLAN) | "vlan 10 prints VLAN0010...", "a VLAN with no active ports lists no ports" (now also checks the message) | FAIL | ok |
| N-01 | Every switch called itself root, and a trunk was "Root" on a root bridge | One root per VLAN across the lab's switches (lowest priority, then MAC). Others get a root port, cost and `Port N (GigabitEthernet0/N)` | 802.1D election | "with two switches exactly one is root..." | FAIL | ok |
| DR-04 | Shut and routed ports listed, with state `DWN` | Only connected switchports in that VLAN are listed | IOS lists forwarding-capable ports only; `DWN` is not an IOS state | "a shut access port is left out...", "the routed port in lab 13 is left out" | FAIL | ok |
| DR-05 | IP address accepted on a Layer 2 port | Refused. Cisco prints `% IP addresses may not be configured on L2 links.` Dell prints a `% Lab note:` because no source gives the OS10 text | Cisco Community threads quoting that exact message | "Cisco prints the IOS error...", "Dell refuses it too..."; guard: "after no switchport, and on a VLAN interface, an address is still accepted" | FAIL | ok |
| DR-06 | Routed port reported as a switchport | Lab ports flagged `routed`. Incident networks: a switch port built with an IP and no switchport mode is flagged routed when the network is built | `show run` now has `no switchport`; status column says `routed` | "lab 13 l3a", "lab 13 l3b", "lab 14 l3sw" | FAIL | ok |
| DR-07 | `show spanning-tree summary` printed the detail view | Summary layout: mode, `Root bridge for:`, defaults, path cost method, per-VLAN count table | Course and community examples of the IOS summary (see section 3) | "mode, root list, path cost method and the count table" | FAIL | ok |
| DR-08 | `show vtp status` counted 1 VLAN | Counts VLAN 1, 1002 to 1005 and the configured VLANs, the same set `show vlan brief` lists | The lab's own `show vlan brief` | "lab 1", "lab 5", "lab 9" | FAIL | ok |
| DR-09 | Disabled port showed `a-full a-1000` | Disabled, notconnect and err-disabled ports show `auto auto`, or the value set by hand without `a-` | IOS `a-` means negotiated | "the shut port shows auto auto...", "a speed set by hand..."; guard: "lab 7 keeps its negotiated half duplex evidence" | FAIL | ok |
| DR-10 | `ip routing` and `no ip routing` rejected | Accepted in config mode on Cisco L3 switches. With routing off the switch still answers on its own addresses but does not route between subnets. `show running-config` drops `ip routing` | Standard IOS command | "lab 9: repair, then no ip routing stops inter-VLAN routing and ip routing brings it back" | FAIL | ok |
| R-01 | My DR-14 change counted a Linux local MTU error twice when replies came after it | The local error advances the expected `icmp_seq` | Reviewer repro: replies 1 and 3 with one error between gave 4 sent | `ping.mjs`: "a local MTU error between replies is counted once" | FAIL | ok |
| R-02 | Linux `From X icmp_seq=N Frag needed and DF set (mtu = N)` still said "may be down" | Parsed as an MTU probe that names the router and the MTU | iputils output | "Linux remote Frag needed names the router and the MTU"; "Windows DF reported by a router names that router" | FAIL | ok |
| R-03 | `spanning-tree vlan N root primary` had no visible effect in the guided labs. The old view hid this by calling every switch root | The per-VLAN view applies it: primary takes 24576, or 4096 below a lower root; secondary takes 28672. This is the same rule the incident engine already used | IOS root macro | "root primary on the other switch moves the root there" | FAIL | ok |
| R-04 | STP tie-breaks: root port chosen by own port number, and path cost added on the sending side | Ties go to sender bridge ID, then sender port ID, then own port. Cost is added on the receiving port | 802.1D | "a triangle has one root, one blocked port...", "crossed parallel links: the root port faces the lower sender port ID" | FAIL | ok |
| R-05 | MTU note said "2 probes were lost because it", and gave 28 bytes for IPv6 | Plural wording; 48 bytes (IPv6 + ICMPv6) when the target is IPv6 | | "MTU loss mixed with timeouts uses plural wording...", "IPv6 MTU advice uses 48 bytes of headers" | FAIL | ok |
| (all) | Vendor switch and end-to-end workflows | Labs 13 and 14 solved by their own hints on Cisco and Dell; the routed port shows as Gi0/8 and Ethernet 1/1/8 | | "lab 13 and lab 14, cisco/dell" (guard), "vendor switch..." | mixed | ok |

**Mutation check result:** 24 of 29 Switch Lab tests, 4 of the new sanitizer tests and 8 of the new ping tests fail on the old code. Every test that passes on the old code is a pre-existing test or a non-regression guard: a check that working behavior was kept. No defect is covered only by a test that passes on the old code.

## 2. Regression checks on behavior that already worked

| Check | Method | Result |
|---|---|---|
| Lesson outcomes | All 18 guided labs × 2 vendors × every non-host device: each lab's own `check()` at the start, old vs new | 0 differences |
| Guided reachability | Full matrix of `canPing` from every PC to every address, old vs new | 0 differences |
| Incident mode | 6 incident networks, 562 host-to-address `xPing` pairs, old vs new | 0 differences |
| Command output scope | 13 Cisco and 8 Dell show commands in every lab, old vs new | Changes only in the fixed commands, plus labs 13 and 14 because of the port rename |
| Sanitizer on real fixtures | All 19 files in `tests/fixtures`, old vs new | 13 lines changed, all DR-12 cases now `[ID_n]`; no other change |
| Sanitizer leak corpus | 40 secret-bearing lines | 39 hidden (was 38). The remaining one is the unverified Junos form |
| Calculator | 3,000 IPv6 addresses vs Python `ipaddress`; 2,003 ranges vs `summarize_address_range` | 0 mismatches |
| Config Diff | 400 random flat files vs `diff --minimal` | 0 mismatches |
| Firewall Lab | 300 random rule sets vs brute force | 0 false claims, 0 missed |
| DNS and Routing Labs | Same probes as the deep review | Unchanged |
| Browser | Real page served on localhost, all 12 tools opened, sanitizer, Ping Analyzer and Switch Lab (both vendors) driven through their UI | No console errors; outputs as in the tests |

**Regression caught and fixed during this pass:** my first DR-09 change made lab 7's flapping port show `half 100` instead of `a-half a-100`. That would have removed the evidence the duplex lesson relies on. Only disabled, notconnect and err-disabled ports now drop the `a-` prefix, and a guard test covers lab 7.

## 3. Platform behavior that is still unverified

| Item | What was used | Why it is unverified |
|---|---|---|
| Uplink port numbers on the WS-C2960CX-8TC-L | Retailer data sheets (8 + 2 SFP + 2 copper); one Cisco Community post shows Gi0/11 and Gi0/12 as SFP | No Cisco hardware guide was found. That is why the lab port moved to Gi0/8, which is certainly copper |
| `% IP addresses may not be configured on L2 links.` | Several Cisco Community threads use the exact text | Not a Cisco document or a capture from 15.2(7)E4 |
| OS10 response to an IP address on a Layer 2 port | Legacy Dell FTOS guide and the OS10 Ansible role show Layer 3 needs `no switchport` | No source gives the OS10 error text, so the lab prints a labeled lab note instead |
| Feature lines in `show spanning-tree summary` (Portfast Default, Loopguard, and so on) | Community and course examples | Not a 2960-CX 15.2(7)E4 capture. The tests check only the documented lines: mode, root list, path cost method and count table |
| `Spanning tree instance(s) for vlan N does not exist.` | Cisco Community thread title | Not a Cisco document |
| `show inventory` DESCR text | Built from the PID | The real 2960-CX DESCR layout was not checked |
| Routing with `no ip routing` | Switch still answers on its own addresses (weak host model) | Behavior of `show ip route` with routing off is not modeled |
| Root bridge MAC addresses | Made up per device (`syntheticMac`) | A lab simplification, not a platform claim |

## 4. Source-supported concerns, investigated and not implemented

| ID | Concern | What I found | Decision |
|---|---|---|---|
| SC-01 | A 2960 LAN Base may not support routed physical ports, which labs 13 and 14 use | Cisco 2960-X guides: static routing on SVIs only. One forum claim says 15.2(7) added `no switchport`. Nothing official for 2960-CX on 15.2(7)E | Unresolved. Changing the lab topology or the hardware is your call. A hardware test (`no switchport` on that image) would settle it |
| SC-02 | LAN Base routing needs `sdm prefer lanbase-routing` and a reload | Documented for the 2960-X only | Unresolved. Plain `switch` devices still reject `ip routing`, as before |
| SC-03 | OS10 default spanning tree is RPVST+, but the guided Dell view prints RSTP | Dell KB and InfoHub state RPVST+ is the default | Not implemented. I have no OS10 10.5 RPVST+ output sample to model the display on |
| SC-04 | DNS Lab accepts an MX that points to a CNAME | RFC 2181 section 10.3 | Not implemented. It would be new warning behavior |
| SC-05 | Routing Lab silently fixes host bits | IOS rejects them; the exact message is from memory | Not implemented |
| SC-06 | 192.0.0.0/24 labeled "Public / other" | RFC 6890 | Not implemented. It is a label change outside the 14 defects |

## 5. Found during this pass, not fixed

- **N-02:** On a routed port, `switchport mode access` sets the mode but leaves the port flagged routed. IOS needs a bare `switchport` first, and the lab does not accept a bare `switchport`. This already existed before this pass. I left it because the right IOS response needs a source.
- **N-04 (fixed later as IR-04, section 10):** A quoted name with spaces (`name="My Home WiFi"`) is not hidden, before or after this pass. It shows up in `netsh` output, so it is worth a follow-up.
- **N-03:** On a connected port with a speed set by hand, `show interfaces status` still prints `a-100`. IOS prints `100` without the prefix when the speed is fixed. I left connected rows unchanged to protect lab 7.

## 6. Intentionally unsupported (simulation limits)

- The guided Dell spanning-tree view is still a single-instance template. It lists the routed port in labs 13 and 14 (SC-03).
- No OSPF or EIGRP.
- The vSphere Sandbox does not check host-to-datastore access or vMotion VMkernel adapters.
- PCs and servers do not run CDP.
- The Junos `plain-text-password-value` form is not hidden. I found no Juniper document for it.
- macOS `ping: sendto: Message too long` is still reported as a send failure, not as an MTU failure.
- A port in the lab's own `flapping` state is left out of spanning tree. IOS has no such state, so there is nothing to match.

## 7. Compatibility

- **Offline and local files:** No network calls or external files were added, and the page still opens from a local server or a file.
- **Windows:** The kit is still one HTML file. The new regexes use lookbehind, which the sanitizer already relied on, so it needs no newer browser than before. The tests run with plain `node`; nothing in them depends on bash.
- **Saved progress:** The `nfl_progress2` and `nfl_vendor` keys and their formats are unchanged. The port rename changes only lab data built fresh each time, never stored state.
- **UI:** No layout, button or style changes. The sanitizer's rule list gains two entries, under Secrets and under Network.

## 8. Commands and results

Node v26.12.0 locally; CI uses Node 22. Run from the repository root:

```
$ node scripts/check-scripts.mjs
18 scripts checked, 0 failed.
$ node tests/engine/suite.mjs
73 passed, 0 failed
$ node tests/engine/sanitizer.mjs
24 passed, 0 failed
$ node tests/engine/configdiff.mjs
9 passed, 0 failed
$ node tests/engine/calculator.mjs
5 passed, 0 failed
$ node tests/engine/routing.mjs
4 passed, 0 failed
$ node tests/engine/switching.mjs
23 passed, 0 failed
$ node tests/engine/switchlab.mjs
29 passed, 0 failed
$ node tests/engine/vsphere.mjs
8 passed, 0 failed
$ node tests/engine/dns.mjs
11 passed, 0 failed
$ node tests/engine/ping.mjs
21 passed, 0 failed
$ node tests/engine/lessons.mjs
6 passed, 0 failed
$ node tests/engine/content.mjs
6 passed, 0 failed
$ node tests/engine/fuzz.mjs 400
fuzz 400 batches, 56 devices, 0 exceptions, 0 slow batches, 1338 ms total; Object.prototype clean: true
```

Mutation check (acceptance tests against the original code):

```
$ KIT_FILE=<copy of index.html at 9057683> node tests/engine/switchlab.mjs   -> 5 passed, 24 failed
$ KIT_FILE=<copy of index.html at 9057683> node tests/engine/sanitizer.mjs   -> 20 passed, 4 failed
$ KIT_FILE=<copy of index.html at 9057683> node tests/engine/ping.mjs        -> 13 passed, 8 failed
```

**Correction:** I first wrote that Firefox was not installed. It is (`/Applications/Firefox.app`); I had not tried it. The browser suites were run in the follow-up, see section 10.

## 9. Independent review

A separate reviewer with no access to this session's reasoning read the diff and ran its own scripts against the old and new code.

- **What it confirmed:**
  - The new sanitizer regexes do not backtrack badly (50,000-character inputs take 5 to 20 ms).
  - Empty `name=""` values are untouched.
  - `ip routing` is refused in exec mode, on Dell, on a plain switch and with extra words.
  - An address after `no switchport`, and on an SVI, still works.
  - Trunk allowed lists and missing VLANs are handled.
  - Incident reachability is unchanged.
  - The routed flag lands only on real Layer 3 links.
  - Loops elect one root.
  - Labs 13 and 14 still complete, and no UI text changed beyond the defects.
- **What it found:** R-01 to R-05 (all fixed above), N-04 (pre-existing, left), and weak tests:
  - **DR-12:** The test passed with the new rule switched off. Fixed with a `noLeak` guard.
  - **STP loops:** No test covered them. Added a triangle and a crossed-pair test.
  - **Empty VLAN:** The test accepted any message. Now it checks the text.
  - **DF and Frag needed:** The `Reply from` DF form and the mixed Linux case had no tests. Added.
- **Device claims it flagged:** The L2 error text comes from community threads, and routed ports and `ip routing` without the SDM step on a LAN Base 2960-CX are not backed by any cited source. Both are disclosed in sections 3 and 4 and stay open as SC-01 and SC-02.

After the review fixes, the old-versus-new lab, incident, fixture and leak comparisons in section 2 were rerun with the same results.

## 10. Follow-up: review of `a4cd402` (IR-01 to IR-04)

An independent reviewer reproduced four problems on the first commit. Each is reproduced below, covered by a test that fails on `a4cd402`, and fixed at the cause. I also found one defect in my own earlier fix (R-06) while writing the tests.

### Incomplete fixes from the first commit

| ID | What was wrong | Cause | Fix | Test that fails on `a4cd402` |
|---|---|---|---|---|
| IR-01 | After SW1 `root primary`, SW2 `root primary` did nothing, and a switch's priority changed when a peer changed | The command saved a marker (`d.stpRoot`) and `stpBridge` worked the priority out later from the peers' *base* priorities | The command works out the priority when it runs and stores it in `d.stpPrio[vlan]`, the same field the incident engine and the election already read. `stpRoot` is gone. Both modes call one function, `rootMacroPrio`. `show running-config` prints `spanning-tree vlan N priority P`, so save and reload carry it. A list of VLANs works, a VLAN that does not exist is refused, and a root already at 0 gives a lab note and changes nothing | 6 tests: SW2 beats SW1; priority stable when a peer changes or the link goes down; VLAN 20 leaves VLAN 10 alone; running-config, output and reload agree; nonexistent VLAN; priority 0 |
| IR-02 | `show spanning-tree vlan 2000` said the instance does not exist | The VLAN list was filtered with `v < 1002`, which dropped every extended VLAN | Only 1002 to 1005 are left out | VLANs 1006, 2000, 4094 (detail, root, summary row), 1002 to 1005 stay out, summary counts add up. VLAN 1001 passed before and is kept as a guard |
| IR-03 | A Windows router reply `Packet needs to be fragmented but DF set.` raised "summary and probes do not agree" and "got no reply" | `finishPing` counted router error replies as received only for unreachable and TTL expired, not for the new MTU category | The router MTU reply joins that reconciliation, with the explanation naming it. The loss line says "got no echo reply from the target" when the only loss is MTU errors | The fixture test now inspects every observation and rejects six kinds of contradictory text, and requires the router, "no echo reply from the target" and the explanation. Two more tests: a mix with one good reply, and a summary that really disagrees is still flagged |
| IR-04 | `name="My Home WiFi"` and `Name : My Home WiFi` leaked (disclosed earlier as N-04) | The name rule took one word and refused quotes | `namefield` takes quoted values with spaces. A new rule, `namefree`, takes the rest of a `name:` line, and an unquoted netsh profile name up to `key=`, `interface=` or `folder=`. Real paths still go to `auditpath` | 5 tests: double and single quotes, CRLF, two names on a line, unquoted netsh, `Name :` lines, `{name: web, port: 80}` keeps `port: 80`, empty values, real paths, round trips |

**Not changed on purpose:** for `name=` without quotes outside a netsh command (for example `name=My Home`), only the first word is taken, because without quotes the end of the value is not known. Dell's guided `root` command is accepted with a lab note and changes nothing, because the Dell guided view shows one instance (SC-03).

### Found while testing

| ID | Defect | Cause | Fix | Test |
|---|---|---|---|---|
| R-06 | My `auditpath` change in `a4cd402` was quadratic. A line of `name:` followed by 50,000 spaces took 738 ms (original code: a few ms) | Variable-length lookbehinds rescanned the spaces at every position | Replaced with a forward-only check. The new rules use no variable-length lookbehind and match word by word. The same input now takes 10 ms | "long lines of spaces after name: do not stall" fails on `a4cd402` (2.4 s) and passes now |

### Mutation check

| Test file | Original `9057683` | Previous head `a4cd402` | Now |
|---|---|---|---|
| `switchlab.mjs` (41 tests) | 5 pass, 36 fail | 31 pass, 10 fail | 41 pass |
| `sanitizer.mjs` (31 tests) | 23 pass, 8 fail | 26 pass, 5 fail | 31 pass |
| `ping.mjs` (23 tests) | 14 pass, 9 fail | 21 pass, 2 fail | 23 pass |

The 17 failures on `a4cd402` are the IR-01 to IR-04 and R-06 tests above, so each finding is detected by a test. Raw output is in `evidence/prev-head-*.txt`, `evidence/old-code-*.txt` and `evidence/new-code-*.txt`.

### Regression checks after the follow-up

| Check | Result |
|---|---|
| All 18 lessons × 2 vendors × every switch, router and L3 switch: start-state `check()` and the full reachability matrix, against the original and against `a4cd402` | 0 differences |
| 6 incident networks, 562 host-to-address pairs, against the original | 0 differences |
| 19 real sanitizer fixtures, `a4cd402` against now | 0 changed lines |
| Sanitizer leak corpus (40 secret-bearing lines) | 39 hidden, 0 round-trip failures. The one visible line is the unverified Junos form |
| Real page, sanitizer: `name="My Home WiFi"`, `name=Cafe Guest key=clear`, `Name : My Home WiFi`, an auditd path | Nothing leaked, the path is still a path, and the residual scan said "Verification passed" on each |
| Real page, Switch Lab (Cisco, lesson 6): SW1 then SW2 `root primary` | SW2 root at 20490, SW1 root port Gi0/2, running-config shows `spanning-tree vlan 10 priority 20480`. No console errors |

### Exact commands and results (Node v26.12.0)

```
$ node scripts/check-scripts.mjs        18 scripts checked, 0 failed.
$ node tests/engine/suite.mjs           73 passed, 0 failed
$ node tests/engine/sanitizer.mjs       31 passed, 0 failed
$ node tests/engine/configdiff.mjs       9 passed, 0 failed
$ node tests/engine/calculator.mjs       5 passed, 0 failed
$ node tests/engine/routing.mjs          4 passed, 0 failed
$ node tests/engine/switching.mjs       23 passed, 0 failed
$ node tests/engine/switchlab.mjs       41 passed, 0 failed
$ node tests/engine/vsphere.mjs          8 passed, 0 failed
$ node tests/engine/dns.mjs             11 passed, 0 failed
$ node tests/engine/ping.mjs            23 passed, 0 failed
$ node tests/engine/lessons.mjs          6 passed, 0 failed
$ node tests/engine/content.mjs          6 passed, 0 failed
$ node tests/engine/fuzz.mjs 400        400 batches, 56 devices, 0 exceptions, 0 slow batches; Object.prototype clean: true
$ node tests/engine/fuzz.mjs 800        800 batches, 78 devices, 0 exceptions, 0 slow batches; Object.prototype clean: true
$ git diff --check                      no output
```

**Runner total:** the twelve runners above (suite plus the eleven tool runners) report **240 passed, 0 failed**. That is the sum of their own "passed" lines. It does not count the fuzz batches or the browser tests.

**Browser suites (Firefox, headless):** `sh tests/run.sh` ran all 23 files in `tests/browser` against this branch: **23/23 files passed, 510/510 checks passed**, and the run exited 0. This covers the hub, branding, light and dark UI standards, the Switch Lab (`fault-lab`, `fault-lab-free`), the Ping Analyzer, the calculator and every Topology Builder suite. The output is in `evidence/browser-run.txt`. I did not run them against `a4cd402` or the original, so there is no before and after for them. The Ping Analyzer suite's two expected phrases that I changed in the earlier pass ("Loss first appears at hop 4") pass.

### Still open

- **Hardware questions stay unresolved.** SC-01 (routed ports on the WS-C2960CX-8TC-L) and SC-02 (the SDM template step) are not settled. The reviewer pointed to Cisco's 15.2(7)Ex routing and SDM chapters for the 2960-CX and 3560-CX family. I have not read them in this pass, and those chapters mix models, so nothing here is claimed about that image.
- **Not modeled:** a limit on spanning-tree instances. Real switches cap the count. The lab accepts any VLAN it accepts elsewhere, and the summary lists them all.
- **Still open from section 5:** N-02, N-03. N-04 is now fixed (IR-04).
- **Dell guided `root` command:** accepted with a lab note, no state (SC-03).
