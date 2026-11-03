# Changelog

## Unreleased

- Network Fault Lab: switches start in user EXEC mode, so `enable` comes before `configure terminal`, and `?` lists only the commands for the current mode. Dell switches take Dell port names (`interface ethernet 1/1/1`), and the PCs answer `ping` in the Linux format.
- Network Fault Lab: when a ticket's goal is met, run the test shown under the goal, then press Verify your repair to reach the quiz.
- Main menu: each card has a pin button after its title. Left and Right visit the title, the pin, then the next card.
- Network Topology Builder: everything saved with network details is encrypted and asks for a passphrase first, including the project file, the CSV lists and the health report. The PNG and SVG pictures are not encrypted.
- Main menu: the arrow keys now follow the layout. Down and Up move between rows in the same column, Left and Right move along the row, and Up from the top row goes back to the search box. Before, Down and Right both stepped to the next card in list order, so Down jumped sideways first.
- Network Fault Lab: Dell is now the default vendor for new visitors (anyone who already chose one keeps it).
- Network Fault Lab: `?` now works like a real switch. It lists the commands for the current mode (EXEC, configuration, interface, access list) in alphabetical order with a short description, and `show ?` and `do show ?` list what can follow. The list follows the chosen vendor: Cisco shows `show interfaces`, `cdp` and `etherchannel`, Dell shows `show interface` and `port-channel`. `help` still prints the full guide.
- Network Fault Lab: `show interfaces` now prints each vendor's own format. Cisco uses the full interface name and the state word (`GigabitEthernet0/1 is up, line protocol is up (connected)`) and the IOS body, with no invented switchport section. Dell prints the OS10 layout, and `show interface status` has the OS10 columns (Port, Description, Status, Speed, Duplex, Mode, Vlan, Tagged-Vlans). On Dell, `show interfaces` (with an s) still works but says OS10 spells it `show interface`.
- Network Fault Lab: fixed `show interfaces trunk`, `show interfaces switchport` and `show interfaces status err-disabled`, which printed a full dump of every port instead of their own output.
- Network Fault Lab: a Free practice card at the end of the lab list opens a working office network (two access switches and a Layer 3 switch) with no fault, goal, hints or quiz. Reset Lab restores it, and it never changes lab progress.
- Network Calculator: a new IPv6 Calc tab with a subnet calculator (compressed and expanded forms, network and range, address type and scope, interface ID and EUI-64 detection, solicited-node and reverse DNS names), a prefix splitter (for example a /48 into /64s, with a jump-to-number field) and a MAC to EUI-64 builder. The IPv4 Subnet Calc hands an IPv6 address over to it.
- Ping / Traceroute Analyzer: reads `mtr` reports, WinMTR, `pathping`, PowerShell `Test-NetConnection` (with `-Port` and `-TraceRoute`) and `Test-Connection` (PowerShell 5.1 and 7), with plain-English notes on where loss really starts and what is only a router rate-limiting its replies. A "More examples" menu has a sample of each.
- Network Topology Builder: Export now has a draw.io file (`.drawio`), with zones, device shapes, link styles and interface names, and the device details kept as draw.io data. Device configurations are never written to it.
- Network Topology Builder: reads Windows servers and PCs. `ipconfig /all`, `Get-NetAdapter` (table or list), `Get-NetIPConfiguration`, `Get-NetIPAddress`, `Get-NetLbfoTeam`, `Get-NetLbfoTeamMember` and `netsh interface show interface` can be pasted in any order, with or without a PowerShell or command prompt in front of each. NIC teams become port-channels, and a team that shares a MAC with its first NIC does not take the switch port away from that NIC. Output that names no host (a team, netsh) goes to the host whose `ipconfig /all` came in the same input. Windows prints no neighbour discovery, so the cables come from the switch side, matched to the NICs by MAC and drawn as inferred. Hyper-V, VPN, Bluetooth, Wi-Fi and tunnel adapters are listed but never cabled, and a self-assigned 169.254 address is explained. English output only. The import dialog now lists Linux servers too, which were already read. An output that names a host now reaches a device first recorded under only a MAC or IP, instead of being held as ambiguous.
- Tests: the engine tests (71) and the browser tests are in the repository under `tests/` and run in CI.

## 1.0.0 (2026-10-17)

First tagged release.

- Twelve tools in one offline file: seven work tools (Log Sanitizer, OSI & Network Reference, Network Calculator, Cheat Sheet, Config Diff, Ping / Traceroute Analyzer, Network Topology Builder) and five practice labs (DNS, Routing, Firewall Rules, Network Fault, vSphere Sandbox).
- Network Topology Builder opens with a sample network so there is something to explore on first load.
- `scripts/check-scripts.mjs` syntax-checks every script in `index.html`, including the embedded tools. It runs on every push.
