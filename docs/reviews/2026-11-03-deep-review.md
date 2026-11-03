# IT Skills Kit deep review, 3 November 2026

This review covers commit `9057683` on `main` and checks the existing tools against their intended uses. It adds no new scope. Nothing here has been fixed yet.

## 1. What the first review missed

The first review read the code and judged it against general knowledge. An experienced specialist would also ask the following:

- **Which device is this?** A switch lab is only right or wrong for a named platform and software version. The first review never pinned the Switch Lab to a platform, so it could not catch the lab contradicting its own `show version`.
- **Do the outputs agree with each other?** On a real device, `show version`, `show inventory`, `show running-config`, `show interfaces switchport` and `show spanning-tree` all describe one box. A simulator can be right in each command and still be inconsistent across them.
- **Does the training teach the right lesson?** A simulator that accepts a command the real platform rejects teaches a habit that fails on the job.
- **What happens with real captured text?** Parsers and sanitizers should be fed realistic output, including the awkward cases (Windows Wi-Fi keys, MTU errors, IOS continuation lines), not only clean examples.
- **Is there an independent oracle?** Math and diff tools can be checked against a reference implementation instead of hand-picked examples.

## 2. Primary evidence

| Evidence | Used for |
|---|---|
| Shipped code in `index.html`, run through `tests/engine/tool.mjs` | Every finding below is reproduced against the code that ships |
| The lab's own claimed platform strings | Defines what "correct" means for the Switch Lab |
| Vendor documentation (Cisco 2960-X routing and SDM guides, Dell OS10 KB and InfoHub) | Source-supported concerns |
| Protocol specifications (RFC 5952, RFC 2181, RFC 6890) | IPv6 text form, DNS MX rules, special-purpose IPv4 blocks |
| Realistic device and OS output (IOS, OS10, Junos, Windows, Linux iputils) | Sanitizer and Ping Analyzer inputs |
| Reproducible user workflows (the guided lab command sequences) | Switch Lab defects |

**Missing:** I had no real device captures from a 2960-CX, an S4148T-ON or an ISR4331. Expected outputs below come from vendor documentation or from well-known IOS behavior. Where a string is from memory and not a fetched document, I say so.

## 3. Methods and tools

| Method | Tool | What it establishes |
|---|---|---|
| Scripted CLI sessions | `docs/reviews/2026-11-03-harness.mjs` drives `runConsoleCommand` on any lab, either vendor | Exact output a learner sees, repeatably |
| Cross-command consistency | Same harness | Whether `show` commands agree with each other and with the declared platform |
| Differential testing | Python `ipaddress`, GNU `diff --minimal` | Calculator and Config Diff correctness on thousands of random inputs |
| Brute-force reference | Exhaustive packet enumeration over equivalence classes | Firewall rule-analysis claims (shadowed, redundant, duplicate) |
| Leak corpus | 40 realistic secret-bearing lines | Which secrets survive the Log Sanitizer |
| Rule ablation | Turn each sanitizer rule off in turn | Which rule causes a bad replacement |
| Document checks | Web search of vendor sites | Whether a behavior is source-supported |

## 4. Independent checks

- **Known expected results:** RFC 5952 compression, `summarize_address_range`, IOS STP priority arithmetic (32768 + VLAN ID).
- **Reference implementations:** Python `ipaddress`, GNU `diff`, a brute-force firewall evaluator.
- **Realistic fixtures:** IOS, OS10 and Junos config lines, `netsh wlan show profile key=clear`, iputils `ping -M do`, Windows `ping -f -l`.
- **Regression tests:** Each defect has an acceptance test written for the existing `tests/engine` style.

## 5. The rewritten request

> Review each existing tool against its intended use, not new features. For the Switch Lab, name the exact vendor, platform and software version being evaluated, then drive the lab with scripted sessions and compare the output to that platform's documented behavior and to the lab's own other commands. For parsers, calculators and analyzers, use reference implementations and realistic captured output as the oracle. Sort results into reproduced defects, source-supported concerns, deliberate simulation limits and optional improvements. For every defect, give a minimal reproduction, expected versus actual behavior, evidence and an acceptance test. Do not pad the list. Say clearly what could not be verified.

## 6. Switch Lab: the platforms being evaluated

The lab declares these platforms in its own output (`index.html:37811`, `index.html:37840`):

| Role | Vendor and platform | Software |
|---|---|---|
| Access switch and L3 switch (Cisco) | Cisco Catalyst WS-C2960CX-8TC-L, LAN Base | IOS 15.2(7)E4, image `c2960cx-universalk9-mz.152-7.E4.bin` |
| Router (Cisco) | Cisco ISR4331/K9 | IOS XE 17.9.4a |
| Switches (Dell) | Dell S4148T-ON (`show version`), S5248F-ON (`show inventory`) | SmartFabric OS10 10.5.5.5 |

I judged the Cisco switches against the 2960-CX on IOS 15.2(7)E4 LAN Base, and the Dell switches against OS10 10.5.x. The WS-C2960CX-8TC-L has 8 copper access ports plus 2 copper and 2 SFP uplinks, so its ports are Gi0/1 to Gi0/12.

## 7. Reproduced defects

All reproductions use the saved harness:

```js
import { lab, on, run, script } from './docs/reviews/2026-11-03-harness.mjs';
```

### DR-01 Switch Lab: the Cisco and Dell models contradict themselves

- **Reproduction:** `lab(13); on('l3a'); script(['enable','show version','show inventory'])`
- **Expected:** One chassis, so the same PID in both commands.
- **Actual:** `show version` reports `WS-C2960CX-8TC-L`. `show inventory` reports `DESCR: "Cisco Catalyst 2960"`, `PID: WS-C2960-24TT-L`. On Dell, `show version` reports `S4148T-ON` and `show inventory` reports `S5248F-ON`.
- **Evidence:** `index.html:37811` and `index.html:37840` hard-code different models.
- **Acceptance test:** For each vendor and device type, the PID in `show inventory` appears in `show version`.

### DR-02 Switch Lab: labs 13 and 14 use Gi0/24 on a 12-port switch

- **Reproduction:** In lab 1, `conf t` then `interface Gi0/13` is rejected (correct for a 12-port model). In lab 13, `interface Gi0/24` is accepted and `show interfaces Gi0/24` prints a full interface.
- **Expected:** Gi0/24 does not exist on a WS-C2960CX-8TC-L.
- **Actual:** Labs 13 and 14 build Gi0/24 into the topology (`index.html:33985`, `index.html:33990`).
- **Evidence:** Cisco 2960-CX 8TC-L port layout (8 + 2 + 2). *Correction, 3 November remediation:* the rejection of Gi0/13 in lab 1 is not evidence. The lab rejects any port that lab did not build, so it has no 12-port check of its own.
- **Acceptance test:** Every Cisco switch port in every `LEVELS[i].build()` is accepted by `interface <name>` on that device type.

### DR-03 Switch Lab: guided `show spanning-tree vlan 10` shows VLAN 1

- **Reproduction:** `lab(1); on(sw); script(['enable','show spanning-tree vlan 10'])`
- **Expected:** A `VLAN0010` block with bridge priority 32778 (32768 + sys-id-ext 10), listing the VLAN 10 access ports.
- **Actual:** A `VLAN0001` block with priority 32769 and sys-id-ext 1, listing Gi0/1 and Gi0/2, which are access ports in VLAN 10. `show spanning-tree vlan 1` prints the same block.
- **Evidence:** The guided handler ignores its arguments and always passes `vlan: 1` (`index.html:37721`).
- **Acceptance test:** `show spanning-tree vlan 10` contains `VLAN0010` and `32778`, and does not contain `VLAN0001`.

### DR-04 Switch Lab: shut ports and routed ports appear in spanning tree

- **Reproduction:** Lab 1, `show spanning-tree` lists `Gi0/1 Desg DWN`. Lab 13, `show spanning-tree` lists the routed port `Gi0/24 Desg FWD`.
- **Expected:** IOS leaves administratively down ports and routed ports out of `show spanning-tree`. `DWN` is not an IOS port state.
- **Actual:** Every non-SVI port is listed, and admin-down ports are listed with the role Desg and the state DWN.
- **Evidence:** `index.html:37717` to `index.html:37720` builds the list from all non-SVI interfaces.
- **Acceptance test:** In lab 1 the output has no `Gi0/1` line, and in lab 13 it has no `Gi0/24` line. The text `DWN` never appears in the Cisco output.

### DR-05 Switch Lab: IP addresses are accepted on Layer 2 ports

- **Reproduction (Cisco):** Lab 1, `conf t`, `interface Gi0/2`, `ip address 10.9.9.1 255.255.255.0`, `end`, `show run interface Gi0/2`.
- **Reproduction (Dell):** Lab 1 Dell, `interface ethernet1/1/2`, `ip address 10.9.9.1/24`.
- **Expected:** Rejected on a switchport. IOS prints an error along the lines of `% IP addresses may not be configured on L2 links.` (quoted from memory, not a fetched document). OS10 also requires the port to leave Layer 2 mode first.
- **Actual:** Accepted silently. The running config shows `switchport mode access`, `switchport access vlan 10` and `ip address ...` on the same port.
- **Evidence:** The interface object stores `mode: "access"` and `ip` together.
- **Acceptance test:** After the command, the interface has no `ip` and the output contains `%`.

### DR-06 Switch Lab: the routed port in lab 13 reports as a switchport

- **Reproduction:** Lab 13, `show running-config interface Gi0/24`, then `show interfaces Gi0/24 switchport`.
- **Expected:** If the port holds an IP, the running config shows `no switchport` and `show interfaces switchport` reports `Switchport: Disabled`.
- **Actual:** The running config has the IP with no `no switchport`. The switchport output says `Switchport: Enabled`, `Administrative Mode: static access`, access VLAN 1.
- **Acceptance test:** For any physical port with an IP, the config contains `no switchport` and the switchport output contains `Switchport: Disabled`.
- **Note:** See SC-01. On this platform the port should probably not be routed at all.

### DR-07 Switch Lab: `show spanning-tree summary` prints the detail view

- **Reproduction:** Lab 1, `show spanning-tree summary`.
- **Expected:** The summary format (`Switch is in pvst mode`, `Root bridge for:`, the per-VLAN count table).
- **Actual:** The same per-port block as `show spanning-tree`.
- **Acceptance test:** The output contains `Switch is in pvst mode` and has no `Prio.Nbr` header.

### DR-08 Switch Lab: `show vtp status` counts 1 VLAN

- **Reproduction:** Lab 1, `show vtp status`, then `show vlan brief`.
- **Expected:** `Number of existing VLANs` matches the VLANs shown (here 6: 1, 10, and 1002 to 1005).
- **Actual:** `Number of existing VLANs : 1`.
- **Acceptance test:** The count equals the number of rows in `show vlan brief`.

### DR-09 Switch Lab: a disabled port shows negotiated speed and duplex

- **Reproduction:** Lab 1, `show interfaces status`.
- **Expected:** A `disabled` or `notconnect` port shows `auto auto`, because nothing was negotiated.
- **Actual:** `Gi0/1 disabled 10 a-full a-1000`.
- **Evidence:** `index.html:37552`.
- **Acceptance test:** Any row with `disabled` or `notconnect` shows `auto` in the Duplex and Speed columns, unless they were set by hand.

### DR-10 Switch Lab: `no ip routing` is rejected

- **Reproduction:** Lab 9, `conf t`, `no ip routing`.
- **Expected:** Accepted. Inter-VLAN routing then stops.
- **Actual:** `% Invalid input detected`.
- **Acceptance test:** After `no ip routing`, `canPing(net, 'pc-a', pc-b-ip)` is false and `show run` has no `ip routing` line. After `ip routing`, it is true again.

### DR-11 Log Sanitizer: Windows Wi-Fi keys leak

- **Reproduction:**
  ```
  netsh wlan show profile name=Home key=clear
      Key Content            : HomeWifi2024
  ```
- **Expected:** `HomeWifi2024` is replaced.
- **Actual:** The key survives. The word `Content` is replaced as a Cisco secret instead, because `ciscodevkey` (`index.html:5565`) treats a line starting with `key` as a device key. On its own, the `Key Content : ...` line is not touched at all.
- **Severity:** High. This is the standard Windows command for recovering a Wi-Fi password, and its output is a common thing to paste.
- **Acceptance test:** `noLeak(<the two lines above>, ['HomeWifi2024'])`, and the output still contains `Key Content`.

### DR-12 Log Sanitizer: any `name=` or `name:` value becomes a fake log file path

- **Reproduction:** `name: web`, `name=Home`, `profile name=Office key=clear`.
- **Expected:** A value that is not a path is either kept or replaced with a neutral token.
- **Actual:** Each becomes `/var/log/synth/file_1.log`. YAML, Kubernetes, Docker Compose and netsh output all read as if they referenced a log file.
- **Evidence:** The `auditpath` rule (`index.html:5572`) matches `name` with any value, and the PATH fallback (`index.html:5045`) returns the fake log path.
- **Acceptance test:** `clean('name: web').out` does not contain `/var/log/`, and an auditd line `name="/etc/shadow"` is still replaced with a path.

### DR-13 Ping Analyzer: Windows DF failures are diagnosed as host down

- **Reproduction:**
  ```
  Pinging 10.0.0.1 with 1472 bytes of data:
  Packet needs to be fragmented but DF set.
  Packet needs to be fragmented but DF set.

  Ping statistics for 10.0.0.1:
      Packets: Sent = 2, Received = 0, Lost = 2 (100% loss),
  ```
- **Expected:** An MTU observation saying the path MTU is smaller than the probe, with no claim that the host is down.
- **Actual:** "The target may be down or unreachable, or something along the path may be blocking ICMP."
- **Evidence:** The analyzer's own command reference (`index.html:49407`) teaches that this message means the path MTU is smaller.
- **Acceptance test:** The observations include the text `MTU` and do not include `may be down`.

### DR-14 Ping Analyzer: Linux MTU errors read as "no probes found"

- **Reproduction:**
  ```
  PING 10.0.0.1 (10.0.0.1) 1472(1500) bytes of data.
  ping: local error: message too long, mtu=1400
  ping: local error: message too long, mtu=1400

  --- 10.0.0.1 ping statistics ---
  2 packets transmitted, 0 received, +2 errors, 100% packet loss, time 1002ms
  ```
- **Expected:** 2 sent and 2 lost, plus an MTU observation naming 1400.
- **Actual:** "No probes were found in this output."
- **Acceptance test:** The result reports 2 sent and 100% loss, and the observations mention `1400`.

## 8. Source-supported concerns

These are supported by documentation but not proven on hardware.

- **SC-01 Routed ports on a 2960 LAN Base.** Cisco's 2960-X routing guide says static routing is supported only on SVIs, not on physical interfaces, and that the switch does not support routing protocols. Community reports say the same for the 2960-CX. One forum comment claims 15.2(7) added `no switchport`, which I could not confirm. Labs 13 and 14 depend on a routed Gi0/24, and lab 1 accepts `no switchport` on a plain access switch.
- **SC-02 SDM template.** The same guides say LAN Base routing needs `sdm prefer lanbase-routing` and a reload before `ip routing`. The lab accepts `ip routing` directly and rejects `show sdm prefer`. These guides are for the 2960-X. I did not find a 2960-CX page that confirms the same step.
- **SC-03 OS10 spanning-tree mode.** Dell documents RPVST+ as the OS10 default. The guided Dell labs print `rstp with force-version rstp` (`index.html:37721`), while incident mode prints `rapid-pvst`.
- **SC-04 DNS MX to a CNAME.** RFC 2181 section 10.3 says an MX target must not be an alias. The DNS Lab adds `lab.local MX 10 www.lab.local` (a CNAME) without a warning.
- **SC-05 Routing Lab host bits.** `10.9.1.0/16` is silently stored as `10.9.0.0/16`. IOS rejects `ip route 10.9.1.0 255.255.0.0 ...` with an inconsistent address and mask error (from memory). The learner never sees the mistake.
- **SC-06 Calculator special blocks.** `192.0.0.0/24` (IETF Protocol Assignments, RFC 6890) is labeled "Public / other". This is minor.

## 9. Deliberate simulation limits

These are fine as long as the lab says so.

- **Guided labs:** `show spanning-tree` and `show mac address-table` are templates in the guided labs. Incident mode has the real STP engine. DR-03 and DR-04 are defects because the template prints wrong facts, not because it is simplified.
- **Dynamic routing:** No OSPF or EIGRP. `show ip protocols` says "Dynamic routing not fully simulated".
- **Hosts:** PCs do not run CDP or LLDP.
- **vSphere Sandbox (vCenter 8.0 U2):** vMotion does not check host-to-datastore access or vMotion VMkernel adapters. All datastores are visible to every host, including across clusters. The memory model is fully reserved (VS-01, already declared).

## 10. Optional improvements

- **Pick a Cisco L3 platform that can do what the labs teach.** Keep the 2960-CX for access switches. Model the L3 switch as a Catalyst 3560-CX on 15.2(7)E with IP Base, which supports routed ports, and renumber Gi0/24 to a port that exists. Check the 3560-CX data sheet for the exact port names first.
- **Topology Builder:** It does not read `encapsulation dot1Q` on subinterfaces, so router-on-a-stick VLANs are missing from the VLAN view.

## 11. Checked and found clean

| Tool | Check | Result |
|---|---|---|
| Calculator | 3,000 random IPv6 addresses vs Python `ipaddress` (RFC 5952 form) | 0 mismatches |
| Calculator | 2,003 random ranges vs `summarize_address_range` | 0 mismatches |
| Config Diff | 400 random flat files vs `diff --minimal` | 0 mismatches |
| Config Diff | Nested configs | Differs from `diff` on purpose: it matches lines within their section, which is correct for configs |
| Firewall Lab | 300 random rule sets vs a brute-force evaluator | 0 false "no effect" claims, 0 missed dead rules |
| DNS Lab | NXDOMAIN vs NODATA, case, trailing dot, CNAME coexistence, CNAME at the apex, CNAME loop | All correct |
| Routing Lab | Longest-prefix match, AD order, unreachable next hop, prefix over /32 | All correct (except SC-05) |
| Topology Builder | IOS trunk `add`, `remove`, `except`, `none`, native VLAN, secondary IPs, shutdown | All correct |
| Log Sanitizer | 40 secret-bearing lines across IOS type 5/7/8/9, SNMPv3, TACACS, RADIUS, HSRP, OSPF, IPsec PSK, OS10, Junos `$9$`, SSH keys, WireGuard, AWS, Cloudflare, Proxmox tokens, database URLs | 38 hidden. The 2 leaks were DR-11 and an unverified Junos form. All 40 round-trip |

## 12. Not verified

- **Real device captures:** I had none, so every "expected" output comes from documentation or known IOS behavior. The IOS error strings in DR-05 and SC-05 are from memory.
- **2960-CX routed ports on 15.2(7)E:** The sources conflict. Running `no switchport` on real hardware with that image would settle it.
- **Junos `plain-text-password-value`:** The sanitizer leaves it visible, but I found no Juniper document for that exact statement, so it is not listed as a defect.
- **OS10 output formats:** The exact layout of `show version`, `show inventory` and `show spanning-tree` on 10.5.5.5 was not compared to a capture. The Dell `show inventory` uses a Cisco-style layout, which is probably wrong, but I did not confirm it.
- **Firefox browser suites:** Not run, because Firefox is not installed.
- **Not reviewed in depth:** The Practice Reference and OSI Reference content, the Topology Builder beyond VLAN and IP parsing, and the vSphere Sandbox beyond migration, maintenance and snapshots.
