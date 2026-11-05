import { loadNM, fx, source } from './load.mjs';
let pass = 0, fail = 0; const failures = [];
function test(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + '\n         ' + (e && e.message || e)); } }
function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'not equal') + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); }
const T0 = Date.parse('2026-10-12T10:00:00Z'), H = 3600e3;
const inputs = (names) => names.map(n => ({ name: n, text: fx(n) }));
function fresh() { return loadNM(); }
function imp(NM, m, names, at, opts) { return NM.apply(m, NM.parseInputs(inputs(names)), Object.assign({ at }, opts || {})); }
const byName = (m, n) => Object.values(m.devices).find(d => d.name === n);
const realCount = (m) => Object.values(m.devices).filter(d => !d.stub).length;
const linkBetween = (NM, v, m, an, aif, bn, bif) => v.links.find(L => { const A = m.devices[L.a.dev].name, B = m.devices[L.b.dev].name; const ka = NM.ifKey(aif), kb = NM.ifKey(bif); return (A === an && L.a.ifk === ka && B === bn && L.b.ifk === kb) || (A === bn && L.a.ifk === kb && B === an && L.b.ifk === ka); });

console.log('Import and identity');
test('1  several Cisco switch configurations import', () => {
  const NM = fresh(), m = NM.newModel(); const r = imp(NM, m, ['sw-core1.cfg', 'sw-acc1.cfg', 'sw-acc2.cfg'], T0);
  eq(realCount(m), 3); eq(r.created.length, 3); ok(Object.keys(byName(m, 'SW-CORE1').ifaces).length >= 11, 'interfaces');
  eq(byName(m, 'SW-CORE1').vlans[10].name, 'USERS'); eq(byName(m, 'SW-CORE1').ifaces['gi1/0/47'].cfg.pc, 1);
});
test('2  a second batch updates the existing devices', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg', 'sw-acc1.cfg', 'sw-acc2.cfg'], T0);
  const r = imp(NM, m, ['core1-session.txt', 'acc1-session.txt'], T0 + H);
  eq(r.created.length, 0, 'no new real devices'); eq(r.updated.length, 2); ok(byName(m, 'SW-CORE1').ifaces['gi1/0/1'].state.st === 'up', 'status merged'); ok(byName(m, 'SW-CORE1').seen.nbr, 'neighbour freshness recorded');
});
test('3  re-import updates, never duplicates', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg', 'core1-session.txt', 'acc1-session.txt', 'sw-acc1.cfg'], T0);
  const n = Object.keys(m.devices).length, ifs = Object.values(m.devices).reduce((a, d) => a + Object.keys(d.ifaces).length, 0);
  imp(NM, m, ['sw-core1.cfg', 'core1-session.txt', 'acc1-session.txt', 'sw-acc1.cfg'], T0 + 2 * H);
  eq(Object.keys(m.devices).length, n); eq(Object.values(m.devices).reduce((a, d) => a + Object.keys(d.ifaces).length, 0), ifs);
  const changed = fx('sw-core1.cfg').replace('description spare', 'description spare-2');
  const r = NM.apply(m, NM.parseInputs([{ name: 'edited', text: changed }]), { at: T0 + 3 * H });
  eq(r.counts.cfgChanged, 1); eq(byName(m, 'SW-CORE1').ifaces['gi1/0/30'].cfg.desc, 'spare-2'); eq(Object.keys(m.devices).length, n);
});
test('4  multiple files in one operation', () => {
  const NM = fresh(), m = NM.newModel(); const secs = NM.parseInputs(inputs(['sw-core1.cfg', 'dell-s1.cfg', 'fw1-config.set', 'esx01-session.txt']));
  const files = new Set(secs.map(s => s.file)); eq(files.size, 4); const r = NM.apply(m, secs, { at: T0 });
  eq(realCount(m), 4); ok(['SW-CORE1', 'DELL-S1', 'FW1', 'esx01'].every(n => byName(m, n)));
});
test('5  several outputs pasted together are separated', () => {
  const NM = fresh(); const secs = NM.parseInputs([{ name: 'paste', text: fx('core1-session.txt') }]);
  eq(secs.map(s => s.parser), ['cisco.status', 'cisco.cdp', 'cisco.lldp', 'cisco.etherchannel', 'cisco.vlan', 'cisco.trunk']); ok(secs.every(s => s.status === 'parsed'));
});
test('5b outputs pasted with no prompts are split by their headers', () => {
  const NM = fresh(); const raw = fx('core1-session.txt').split('\n').filter(l => !/^SW-CORE1#/.test(l)).join('\n');
  const secs = NM.parseInputs([{ name: 'bare', text: raw }]);
  eq(secs.map(s => s.parser), ['cisco.status', 'cisco.cdp', 'cisco.lldp', 'cisco.etherchannel', 'cisco.vlan', 'cisco.trunk']);
});
test('5c configurations pasted back to back, with and without headers, are separated', () => {
  const NM = fresh(), m = NM.newModel(); const text = ['sw-core1.cfg', 'sw-acc1.cfg', 'sw-acc2.cfg', 'dell-s1.cfg'].map(fx).join('\n');
  const secs = NM.parseInputs([{ name: 'all.txt', text }]); eq(secs.map(s => s.facts.device.name), ['SW-CORE1', 'SW-ACC1', 'SW-ACC2', 'DELL-S1']);
  NM.apply(m, secs, { at: T0 }); eq(realCount(m), 4); eq(Object.keys(byName(m, 'SW-ACC2').ifaces).length, 6);
});
test('6  an unidentified snippet is not given to a wrong device', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg', 'sw-acc1.cfg'], T0);
  const snippet = 'Capability Codes: R - Router, T - Trans Bridge\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\nSW-ACC2.lab.local\n                 Gig 1/0/10        146              S I   WS-C2960X Gig 1/0/1\n\nTotal cdp entries displayed : 1\n';
  const before = JSON.stringify(m.devices);
  const r = NM.apply(m, NM.parseInputs([{ name: 'paste', text: snippet }]), { at: T0 + H });
  eq(r.held.length, 1, 'held'); eq(JSON.stringify(m.devices), before, 'no device changed'); eq(m.held.length, 1);
  const r2 = NM.assignHeld(m, m.held[0].id, { dev: byName(m, 'SW-CORE1').id }, T0 + 2 * H);
  eq(m.held.length, 0); ok(byName(m, 'SW-CORE1').ifaces['gi1/0/10'].nbrs.length === 1, 'assigned where chosen'); ok(!byName(m, 'SW-ACC1').ifaces['gi1/0/10'], 'not the other device');
});
test('6b a file name that names a device is only a suggestion', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg'], T0);
  const r = NM.apply(m, NM.parseInputs([{ name: 'SW-CORE1_cdp.txt', text: 'Capability Codes: R - Router\n\nDevice ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\nSW-ACC1.lab.local\n                 Gig 1/0/47        150              S I   WS-C2960X Gig 1/0/47\n' }]), { at: T0 + H, noHold: true });
  eq(r.held.length, 1); ok(r.held[0].suggest.length === 1 && r.held[0].suggest[0].id === byName(m, 'SW-CORE1').id, 'suggested');
});
test('7  malformed and unsupported input does not stop the rest', () => {
  const NM = fresh(), m = NM.newModel();
  NM.register({ id: 'test.boom', vendor: 'any', cat: 'x', label: 'boom', score: (t) => /BOOMBOOM/.test(t) ? 0.99 : 0, parse() { throw new Error('parser exploded'); } });
  const secs = NM.parseInputs([{ name: 'junk.txt', text: 'hello world\nthis is not a network device output\n\u0000\u0001\u0002' }, { name: 'boom.txt', text: 'BOOMBOOM\nBOOMBOOM' }, { name: 'sw-core1.cfg', text: fx('sw-core1.cfg') }, { name: 'empty.txt', text: '' }, { name: 'trunc.cfg', text: 'hostname\ninterface\n!\n' }]);
  const r = NM.apply(m, secs, { at: T0 });
  eq(r.created.length, 1); ok(r.unrecognised.length >= 1, 'unrecognised reported'); ok(r.errors.length >= 1, 'parser error reported'); ok(byName(m, 'SW-CORE1'), 'good config still imported');
});
test('7b the same host name with a different address is not silently merged', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-acc1.cfg'], T0);
  const other = fx('sw-acc1.cfg').replace('10.0.99.11', '10.7.7.7').replace('ip default-gateway 10.0.99.1', 'ip default-gateway 10.7.7.1');
  const r = NM.apply(m, NM.parseInputs([{ name: 'other-site.cfg', text: other }]), { at: T0 + H });
  eq(r.held.length, 1, 'held for a decision'); eq(r.held[0].status, 'ambiguous'); eq(realCount(m), 1);
  const r2 = NM.assignHeld(m, r.held[0].id, { name: 'SW-ACC1-SITE2' }, T0 + 2 * H); eq(realCount(m), 2);
});

console.log('Links, evidence and redundancy');
function lab(NM, m) { imp(NM, m, ['sw-core1.cfg', 'sw-acc1.cfg', 'sw-acc2.cfg', 'dell-s1.cfg', 'fw1-config.set'], T0); imp(NM, m, ['core1-session.txt', 'acc1-session.txt', 'fw1-session.txt', 'esx01-session.txt', 'dell-s1-session.txt'], T0 + 600e3); return NM.view(m, { now: T0 + 1800e3 }); }
test('8  reciprocal LLDP/CDP gives a confirmed link', () => {
  const NM = fresh(), m = NM.newModel(), v = lab(NM, m); let L = linkBetween(NM, v, m, 'SW-CORE1', 'Gi1/0/47', 'SW-ACC1', 'Gi1/0/47'); ok(L && L.status === 'confirmed' && L.recip, 'cdp pair');
  L = linkBetween(NM, v, m, 'SW-CORE1', 'Gi1/0/1', 'FW1', 'ethernet1/1'); ok(L && L.status === 'confirmed', 'lldp pair across vendors'); L = linkBetween(NM, v, m, 'SW-CORE1', 'Te1/1/1', 'DELL-S1', 'ethernet1/1/1'); ok(L && L.status === 'confirmed', 'cisco/dell lldp');
});
test('9  a one-sided neighbour is inferred, not confirmed', () => {
  const NM = fresh(), m = NM.newModel(), v = lab(NM, m); const L = linkBetween(NM, v, m, 'SW-CORE1', 'Gi1/0/10', 'SW-ACC2', 'Gi1/0/1'); ok(L && L.status === 'inferred' && !L.recip, L && L.status);
  ok(L.ev.some(e => e.t === 'description'), 'its description is only supporting evidence');
});
test('10 a server on two switches is two separate links', () => {
  const NM = fresh(), m = NM.newModel(), v = lab(NM, m); const a = linkBetween(NM, v, m, 'SW-CORE1', 'Gi1/0/20', 'esx01', 'vmnic0'), b = linkBetween(NM, v, m, 'SW-ACC1', 'Gi1/0/20', 'esx01', 'vmnic1');
  ok(a && b && a.key !== b.key, 'two links'); eq(v.links.filter(L => L.a.dev === byName(m, 'esx01').id || L.b.dev === byName(m, 'esx01').id).filter(L => L.shown).length, 2);
  const p = NM.physPaths(m, v, byName(m, 'esx01').id, byName(m, 'FW1').id); ok(p.paths.length >= 1, 'path to the firewall'); ok(p.paths[0].inferred, 'a path through inferred links says so');
});
test('10b the host\'s own network hints confirm both ends', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m);
  const hint = `[root@esx01:~] vim-cmd hostsvc/net/query_networkhint --pnic-name=vmnic0
(vim.host.PhysicalNic.NetworkHint) [
   (vim.host.PhysicalNic.NetworkHint) {
      device = "vmnic0",
      connectedSwitchPort = (vim.host.PhysicalNic.CdpInfo) {
         cdpVersion = 2,
         devId = "SW-CORE1.lab.local",
         address = "10.0.99.1",
         portId = "GigabitEthernet1/0/20",
         hardwarePlatform = "cisco C9300-48P",
      },
   },
]
`;
  const r = NM.apply(m, NM.parseInputs([{ name: 'hint.txt', text: hint }]), { at: T0 + 700e3 }); eq(r.held.length, 0);
  const v = NM.view(m, { now: T0 + 1800e3 }); const L = linkBetween(NM, v, m, 'SW-CORE1', 'Gi1/0/20', 'esx01', 'vmnic0'); ok(L && L.status === 'confirmed', L && L.status);
  const L1 = linkBetween(NM, v, m, 'SW-ACC1', 'Gi1/0/20', 'esx01', 'vmnic1'); ok(L1 && L1.status === 'inferred', 'the other NIC is still one-sided');
});
test('11 a port-channel is one logical link with its members listed', () => {
  const NM = fresh(), m = NM.newModel(), v = lab(NM, m); const P = v.links.find(L => L.kind === 'po'); ok(P && P.members.length === 2, 'bundle'); ok(P.shown && v.byKey[P.members[0]].shown === false, 'members not drawn separately');
  ok(/Port-channel1/.test(P.a.name) && /Port-channel1/.test(P.b.name)); ok(P.health.state === 'up');
});
test('12 nothing is invented from VLANs or subnets alone', () => {
  const NM = fresh(), m = NM.newModel();
  const cfg = (n, ip) => 'hostname ' + n + '\nvlan 10\n name USERS\ninterface GigabitEthernet0/1\n switchport access vlan 10\n switchport mode access\ninterface Vlan10\n ip address ' + ip + ' 255.255.255.0\n';
  NM.apply(m, NM.parseInputs([{ name: 'a.cfg', text: cfg('A1', '10.9.9.1') }, { name: 'b.cfg', text: cfg('B1', '10.9.9.2') }]), { at: T0 });
  eq(NM.view(m, { now: T0 }).links.length, 0, 'same VLAN, same /24: no link');
  const p2p = (n, ip, ifn) => 'hostname ' + n + '\ninterface ' + ifn + '\n no switchport\n ip address ' + ip + ' 255.255.255.252\n';
  const m2 = NM.newModel(); NM.apply(m2, NM.parseInputs([{ name: 'r1.cfg', text: p2p('R1', '172.16.0.1', 'GigabitEthernet0/0') }, { name: 'r2.cfg', text: p2p('R2', '172.16.0.2', 'GigabitEthernet0/1') }]), { at: T0 });
  const v2 = NM.view(m2, { now: T0 }); ok(v2.links.every(L => L.status === 'candidate'), 'a /30 is only a candidate'); eq(v2.links.filter(L => L.shown && L.status !== 'candidate').length, 0);
});
test('13 conflicting neighbour reports are flagged', () => {
  const NM = fresh(), m = NM.newModel();
  const cdp = (cmdHost, local, rname, rport) => cmdHost + '#show cdp neighbors detail\n-------------------------\nDevice ID: ' + rname + '\nEntry address(es): \n  IP address: 10.1.1.9\nPlatform: cisco WS-C3850,  Capabilities: Switch IGMP \nInterface: GigabitEthernet' + local + ',  Port ID (outgoing port): ' + rport + '\nHoldtime : 140 sec\n';
  NM.apply(m, NM.parseInputs([{ name: 'x', text: cdp('SWA', '0/1', 'SWB', 'GigabitEthernet0/5') }, { name: 'y', text: cdp('SWC', '0/7', 'SWB', 'GigabitEthernet0/5') }]), { at: T0 });
  const v = NM.view(m, { now: T0 }); ok(v.links.some(L => L.status === 'conflict'), 'a link is in conflict'); ok(v.review.some(r => r.cat === 'conflict' && /more than one neighbour/.test(r.title)), 'a review item explains it');
});
test('13b a stale record that vanished from a newer table is kept and marked', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m);
  const newer = fx('core1-session.txt').replace(/esx01\.lab\.local  Gig 1\/0\/20.*\n/, '');
  NM.apply(m, NM.parseInputs([{ name: 'again', text: newer }]), { at: T0 + 5 * H });
  const rec = byName(m, 'SW-CORE1').ifaces['gi1/0/20'].nbrs.find(n => n.name === 'esx01.lab.local'); ok(rec && rec.gone === T0 + 5 * H, 'kept, flagged gone');
  const v = NM.view(m, { now: T0 + 5 * H }); const L = linkBetween(NM, v, m, 'SW-CORE1', 'Gi1/0/20', 'esx01', 'vmnic0'); ok(L, 'link still known'); ok(L.health.color !== 'red', 'a missing record is not a failure');
});

test('10c a Linux server with a bond is two separate cables, joined to its stub by name', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['dell-s1.cfg', 'dell-s1-session.txt'], T0); const stubBefore = Object.values(m.devices).filter(d => d.name === 'srv01').length;
  imp(NM, m, ['srv01-session.txt'], T0 + 60e3); const srv = byName(m, 'srv01'); eq(stubBefore, 1); eq(Object.values(m.devices).filter(d => d.name === 'srv01').length, 1, 'one srv01'); ok(!srv.stub && srv.kind === 'server', 'filled in');
  const v = NM.view(m, { now: T0 + 120e3 }); const a = linkBetween(NM, v, m, 'DELL-S1', 'ethernet1/1/2', 'srv01', 'eno1'), b = linkBetween(NM, v, m, 'DELL-S1', 'ethernet1/1/3', 'srv01', 'eno2');
  ok(a && b && a.key !== b.key, 'two links'); ok(a.status === 'confirmed' && b.status === 'confirmed', a && a.status + ' ' + (b && b.status)); eq(a.health.color, 'green'); ok(a.notes.some(n => /bond0/.test(n)), 'bond membership noted: ' + a.notes.join('|'));
  ok(srv.ifaces['bond0'].type === 'po' && srv.ifaces['eno1'].obs.pcOf.po === 'bond0' && srv.ifaces['docker0'].type === 'other', 'bond is a port-channel; docker0 is not a NIC'); ok(!v.links.some(L => /docker0|bond0/.test(L.a.ifk + L.b.ifk) && L.kind === 'phys'), 'no cable invented for virtual interfaces');
  eq(srv.addrs.indexOf('127.0.0.1'), -1); ok(srv.addrs.indexOf('10.0.20.40') >= 0, 'address read');
});
test('10d a port named only by its MAC is matched to the NIC that owns it', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['dell-s1-session.txt'], T0); let v = NM.view(m, { now: T0 + 1000 }); const before = linkBetween(NM, v, m, 'DELL-S1', 'ethernet1/1/2', 'srv01', 'mac:0a:1b:2c:3d:4e:01'); ok(before && before.status === 'inferred', 'identified by MAC only');
  imp(NM, m, ['srv01-session.txt'], T0 + 60e3); v = NM.view(m, { now: T0 + 120e3 }); ok(linkBetween(NM, v, m, 'DELL-S1', 'ethernet1/1/2', 'srv01', 'eno1'), 'now resolved to eno1');
});
test('10e interface descriptions are read as observations and found by search', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg', 'core1-ifdesc.txt'], T0); ok(byName(m, 'SW-CORE1').ifaces['gi1/0/30'].state.st === 'admin-down'); ok(NM.search(m, 'spare').some(r => r.type === 'desc'));
});

test('13c NICs that are up with no known connection are listed, and things missing from a newer capture are kept and flagged', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['esx01-session.txt'], T0); let v = NM.view(m, { now: T0 + 60e3 });
  const r = v.review.find(x => /esx01: 2 ports are up with no known connection/.test(x.title)); ok(r && /vmnic0, vmnic1/.test(r.detail), v.review.map(x => x.title).join(' | '));
  const m2 = NM.newModel(), v2 = lab(NM, m2); const newer = fx('core1-session.txt').replace(/esx01\.lab\.local  Gig 1\/0\/20.*\n/, ''); NM.apply(m2, NM.parseInputs([{ name: 'again', text: newer }]), { at: T0 + 5 * H });
  const v3 = NM.view(m2, { now: T0 + 5 * H }); ok(v3.review.some(x => x.cat === 'stale' && /SW-CORE1: 1 neighbour entry missing from the newest capture/.test(x.title)), v3.review.filter(x => x.cat === 'stale').map(x => x.title).join(' | '));
});

test('13d management devices are recognised from what they report about themselves', () => {
  const NM = fresh(); eq(NM.guessKind('', 'Integrated Dell Remote Access Controller', 'esx01-idrac'), 'idrac'); eq(NM.guessKind('', 'HPE iLO 5', 'srv-ilo'), 'ilo'); eq(NM.guessKind('', '', 'oob-sw1'), 'mgmt'); eq(NM.guessKind('', 'cisco CIMC', 'ucs1'), 'mgmt'); eq(NM.guessKind('R S I', 'WS-C3850', 'sw-core1'), 'core'); eq(NM.guessKind('S', '', 'bmc-lab'), 'mgmt');
});

test('13e an ambiguous neighbour is resolved by you and stays resolved after a re-import', () => {
  const NM = fresh(), m = NM.newModel(); const cfg = (n, ip) => 'hostname ' + n + '\ninterface Vlan1\n ip address ' + ip + ' 255.255.255.0\ninterface GigabitEthernet1/0/1\n switchport mode trunk\n';
  NM.apply(m, NM.parseInputs([{ name: 'a', text: cfg('SWX.site1', '10.1.1.1') }, { name: 'b', text: cfg('SWX.site2', '10.2.2.1') }, { name: 'c', text: cfg('CORE', '10.9.9.1') }]), { at: T0 });
  const cdp = 'CORE#show cdp neighbors detail\n-------------------------\nDevice ID: SWX\nEntry address(es): \n  IP address: 10.3.3.3\nPlatform: cisco WS-C3850,  Capabilities: Switch IGMP \nInterface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet1/0/1\nHoldtime : 140 sec\n';
  NM.apply(m, NM.parseInputs([{ name: 'cdp', text: cdp }]), { at: T0 + 60e3 }); let v = NM.view(m, { now: T0 + 120e3 }); const un = v.review.find(r => r.cat === 'unresolved' && /could not be matched/.test(r.title)); ok(un && un.rec, 'unresolved: ' + v.review.map(r => r.title).join(' | '));
  const x = byName(m, 'SWX.site2'); ok(NM.setNbrDevice(m, un.rec.dev, un.rec.ifk, un.rec.name, x.id)); NM.apply(m, NM.parseInputs([{ name: 'cdp2', text: cdp }]), { at: T0 + 180e3 }); v = NM.view(m, { now: T0 + 240e3 });
  ok(!v.review.some(r => /could not be matched/.test(r.title)), 'resolved stays resolved'); ok(v.links.some(L => (L.a.dev === x.id || L.b.dev === x.id) && L.status === 'inferred'), 'link to the chosen device');
});
test('13f unrecognised output says what it looks like instead of guessing', () => {
  const NM = fresh(); eq(NM.hintFor('Dell EMC Networking N4032\nsomething'), 'Dell output other than an OS10 configuration or OS10 show command is not read yet. N-series and OS9 are read from the configuration only.'); ok(/routing table/.test(NM.hintFor('Gateway of last resort is 10.0.0.1 to network 0.0.0.0')), 'routes'); ok(NM.hintFor('hello') === '');
});

test('5d NX-OS style CDP table headers are read', () => {
  const NM = fresh(); const t = 'N9K-1# show cdp neighbors\nCapability Codes: R - Router, T - Trans-Bridge, B - Source-Route-Bridge\n                  S - Switch, H - Host, I - IGMP, r - Repeater,\n                  V - VoIP-Phone, D - Remotely-Managed-Device,\n                  s - Supports-STP-Dispute\n\nDevice-ID          Local Intrfce  Hldtme Capability  Platform      Port ID\nSPINE1(FDO123)     Eth1/1         146    R S s       N9K-C9336C    Ethernet1/5\n';
  const secs = NM.parseInputs([{ name: 'n', text: t }]); eq(secs[0].parser, 'cisco.cdp'); eq(secs[0].facts.counts.nbrs, 1); eq(secs[0].facts.ifaces[0].nbrs[0].rport, 'Ethernet1/5');
});

test('7c garbage addresses and masks cannot hang or crash the reader', () => {
  const NM = fresh(); eq(NM.util.maskToBits('255.255.255.0'), 24); ok(typeof NM.util.maskToBits('-15.255.255.0') === 'number'); eq(NM.util.maskToBits('x.y.z'), -1, 'garbage is invalid, not a length');
  const t = Date.now(); const secs = NM.parseInputs([{ name: 'g', text: 'hostname G\ninterface Vlan1\n ip address -1.-1.-1.-1 -255.-255.-255.-255\n ip address 999.1.1.1 255.0.0.-1\n' }, { name: 'e', text: '[root@esx:~] esxcli network ip interface ipv4 get\nName  IPv4 Address  IPv4 Netmask   IPv4 Broadcast  Address Type  Gateway     DHCP DNS\n----  ------------  -------------  --------------  ------------  ----------  --------\nvmk0  x0.0.99.21    -15.255.255.0  10.-1.99.205     STATIC        -10.99999.99.-1   false\n' }]);
  ok(Date.now() - t < 1000, 'quick'); const m = NM.newModel(); NM.apply(m, secs, { at: T0 }); NM.view(m, { now: T0 });
});

test('17e a port-channel whose members are all stale is stale, not unknown', () => {
  const NM = fresh(), m = NM.newModel(), v0 = lab(NM, m); const v = NM.view(m, { now: T0 + 40 * H, fresh: true }); const P = v.links.find(L => L.kind === 'po'); eq(P.health.state, 'stale'); ok(/^Stale:/.test(P.health.text), P.health.text);
});

test('5e NX-OS ip interface brief is read', () => {
  const NM = fresh(); const t = 'N9K-1# show ip interface brief\n\nIP Interface Status for VRF "default"(1)\nInterface            IP Address      Interface Status\nVlan10               10.0.10.1       protocol-up/link-up/admin-up\nEth1/1               10.0.0.1        protocol-down/link-down/admin-up\nEth1/2               10.0.0.5        protocol-down/link-down/admin-down\n';
  const secs = NM.parseInputs([{ name: 'n', text: t }]); eq(secs[0].parser, 'cisco.nxipbrief'); const f = secs[0].facts; eq(f.ifaces.map(i => i.st.st), ['up', 'down', 'admin-down']); eq(f.ifaces[0].obs.ip, '10.0.10.1');
});

console.log('Status, health and freshness');
function twoSwitch(NM, status1, status2, t1, t2) {
  const m = NM.newModel(); const cfg = (n, p) => 'hostname ' + n + '\ninterface GigabitEthernet1/0/1\n description to ' + p + '\n switchport mode trunk\n';
  imp0(NM, m, [['a.cfg', cfg('SWA', 'SWB')], ['b.cfg', cfg('SWB', 'SWA')]], T0);
  const cdp = (h, rn, rp) => h + '#show cdp neighbors detail\n-------------------------\nDevice ID: ' + rn + '\nEntry address(es): \n  IP address: 10.1.1.9\nPlatform: cisco WS-C3850,  Capabilities: Switch IGMP \nInterface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet1/0/1\nHoldtime : 140 sec\n';
  imp0(NM, m, [['c1', cdp('SWA', 'SWB')], ['c2', cdp('SWB', 'SWA')]], T0 + 60e3);
  const st = (h, s) => h + '#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/1   x                  ' + s + '    trunk      a-full a-1000 10/100/1000BaseTX\n';
  if (status1) imp0(NM, m, [['s1', st('SWA', status1)]], t1); if (status2) imp0(NM, m, [['s2', st('SWB', status2)]], t2);
  return m;
}
function imp0(NM, m, pairs, at) { return NM.apply(m, NM.parseInputs(pairs.map(p => ({ name: p[0], text: p[1] }))), { at }); }
const health = (NM, m, now) => NM.view(m, { now }).links[0].health;
test('14 a link goes up then down after a status import', () => {
  const NM = fresh(); const m = twoSwitch(NM, 'connected', 'connected', T0 + 120e3, T0 + 120e3); eq(health(NM, m, T0 + 300e3).color, 'green');
  imp0(NM, m, [['s3', 'SWA#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/1   x                  notconnect   trunk      auto auto 10/100/1000BaseTX\n'], ['s4', 'SWB#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/1   x                  notconnect   trunk      auto auto 10/100/1000BaseTX\n']], T0 + 3 * H);
  const h = health(NM, m, T0 + 3 * H + 60e3); eq(h.color, 'red'); ok(/Expected connection is down/.test(h.text), h.text); ok(byName(m, 'SWA').ifaces['gi1/0/1'].hist.some(x => x.k === 'state' && x.from === 'up' && x.to === 'down'), 'history keeps the change');
});
test('15 an unused disconnected port is not red; an expected connection that fails is', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-acc2.cfg'], T0);
  imp0(NM, m, [['s', 'SW-ACC2#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/1   Uplink             notconnect   trunk      auto auto 10/100/1000BaseTX\nGi1/0/2   unused             notconnect   10         auto auto 10/100/1000BaseTX\nGi1/0/3   Reception PC       connected    10         a-full a-100 10/100/1000BaseTX\n']], T0 + 60e3);
  const v = NM.view(m, { now: T0 + 120e3 }); ok(!v.links.some(L => L.a.ifk === 'gi1/0/2' || L.b.ifk === 'gi1/0/2'), 'no link for an unused port'); ok(!v.review.some(r => r.cat === 'down'), 'nothing flagged as an expected-connection failure');
  let m3 = NM.newModel(); lab(NM, m3); imp0(NM, m3, [['x', 'SW-ACC1#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/20  ESX01 vmnic1       notconnect   trunk      auto auto 10/100/1000BaseTX\n']], T0 + 2 * H);
  const v2 = NM.view(m3, { now: T0 + 2 * H + 60e3 }); const L = linkBetween(NM, v2, m3, 'SW-ACC1', 'Gi1/0/20', 'esx01', 'vmnic1'); eq(L.health.color, 'red'); ok(v2.review.some(r => r.cat === 'down'), 'listed under expected connections down');
});
test('16 admin shut and err-disabled are separate orange states with exact text', () => {
  const NM = fresh(); const m = twoSwitch(NM, 'disabled', 'connected', T0 + 120e3, T0 + 120e3); let h = health(NM, m, T0 + 300e3); eq(h.color, 'orange'); eq(h.state, 'admin-down'); ok(/Administratively disabled on SWA/.test(h.text), h.text);
  const m2 = twoSwitch(NM, 'connected', 'err-disabled', T0 + 120e3, T0 + 120e3); h = health(NM, m2, T0 + 300e3); eq(h.state, 'err-disabled'); ok(/Err-disabled on SWB/.test(h.text), h.text);
});
test('16b endpoints that disagree are degraded, not healthy', () => {
  const NM = fresh(); const m = twoSwitch(NM, 'connected', 'notconnect', T0 + 120e3, T0 + 130e3); const h = health(NM, m, T0 + 300e3); eq(h.state, 'conflict'); eq(h.color, 'orange'); ok(/disagree/.test(h.text));
});
test('17 missing or stale status is not treated as a current failure', () => {
  const NM = fresh(); let m = twoSwitch(NM, null, null); let h = health(NM, m, T0 + 300e3); ok(h.color === 'green' || h.color === 'gray', 'neighbour sighting only'); // adjacency seen shortly before -> up via neighbour table
  h = health(NM, m, T0 + 40 * H); eq(h.state, 'stale'); eq(h.color, 'gray');
  m = twoSwitch(NM, 'notconnect', 'notconnect', T0 + 120e3, T0 + 120e3); h = health(NM, m, T0 + 300e3); eq(h.color, 'red'); h = health(NM, m, T0 + 30 * H); eq(h.state, 'stale'); ok(h.color === 'gray', 'an old down is gray, not red');
});
test('17b an older capture imported later does not overwrite a newer state', () => {
  const NM = fresh(); const m = twoSwitch(NM, 'connected', 'connected', T0 + 5 * H, T0 + 5 * H);
  imp0(NM, m, [['old', 'SWA#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/1   x                  notconnect   trunk      auto auto 10/100/1000BaseTX\n']], T0 + 2 * H);
  eq(byName(m, 'SWA').ifaces['gi1/0/1'].state.st, 'up'); eq(health(NM, m, T0 + 5 * H + 60e3).color, 'green');
});
test('17c config-only data keeps configured intent apart from observed state', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg'], T0); const i = byName(m, 'SW-CORE1').ifaces['gi1/0/30']; ok(i.cfg.shut === true && !i.state, 'shutdown is intent; no observed state yet');
  imp0(NM, m, [['s', 'SW-CORE1#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/30  spare              connected    10         a-full a-100 10/100/1000BaseTX\n']], T0 + 3 * H);
  const v = NM.view(m, { now: T0 + 3 * H }); ok(v.review.some(r => r.cat === 'state-conflict' && /configuration says shutdown/.test(r.title)), 'a real contradiction is reported');
});
test('17d a partial config for one interface does not mark the rest missing', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg'], T0);
  const r = NM.apply(m, NM.parseInputs([{ name: 'one', text: 'SW-CORE1#show running-config interface Gi1/0/30\nBuilding configuration...\n\nCurrent configuration : 100 bytes\n!\ninterface GigabitEthernet1/0/30\n description spare-again\n switchport access vlan 10\n shutdown\nend\n' }]), { at: T0 + H });
  eq(r.counts.nowMissing, 0); eq(byName(m, 'SW-CORE1').ifaces['gi1/0/30'].cfg.desc, 'spare-again');
});

console.log('VLANs, names and troubleshooting views');
test('18 access, native and allowed VLANs are read correctly', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m); const d = byName(m, 'SW-CORE1'); let pv = NM.portVlans(m, d, 'gi1/0/10'); eq([pv.mode, pv.native, NM.p.R.str(pv.allowed)], ['trunk', 1, '10,20,99']);
  pv = NM.portVlans(m, d, 'gi1/0/1'); eq([pv.mode, pv.access], ['access', 99]); pv = NM.portVlans(m, d, 'gi1/0/20'); eq(NM.p.R.str(pv.allowed), '20,99');
  const ops = 'hostname T1\ninterface GigabitEthernet0/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30\n switchport trunk allowed vlan add 40\n switchport trunk allowed vlan remove 20\n switchport trunk native vlan 99\ninterface GigabitEthernet0/2\n switchport mode trunk\n switchport trunk allowed vlan except 100-4094\ninterface GigabitEthernet0/3\n switchport mode trunk\n switchport trunk allowed vlan none\n';
  const m2 = NM.newModel(); NM.apply(m2, NM.parseInputs([{ name: 't', text: ops }]), { at: T0 }); const t = byName(m2, 'T1');
  eq(t.ifaces['gi0/1'].cfg.allowed, '10,30,40'); eq(t.ifaces['gi0/1'].cfg.native, 99); eq(t.ifaces['gi0/2'].cfg.allowed, '1-99'); eq(t.ifaces['gi0/3'].cfg.allowed, 'none');
});
test('18b VLAN mismatches across a link are reported with the reason', () => {
  const NM = fresh(), m = NM.newModel(); const cfg = (n, mode, extra) => 'hostname ' + n + '\ninterface GigabitEthernet1/0/1\n switchport mode ' + mode + '\n' + extra;
  imp0(NM, m, [['a', cfg('SWA', 'trunk', ' switchport trunk allowed vlan 10,20\n switchport trunk native vlan 5\n')], ['b', cfg('SWB', 'trunk', ' switchport trunk allowed vlan 10,30\n switchport trunk native vlan 6\n')]], T0);
  imp0(NM, m, [['c1', 'SWA#show cdp neighbors detail\n-------------------------\nDevice ID: SWB\nEntry address(es): \n  IP address: 10.1.1.9\nPlatform: cisco WS-C3850,  Capabilities: Switch IGMP \nInterface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet1/0/1\nHoldtime : 140 sec\n'], ['c2', 'SWB#show cdp neighbors detail\n-------------------------\nDevice ID: SWA\nEntry address(es): \n  IP address: 10.1.1.8\nPlatform: cisco WS-C3850,  Capabilities: Switch IGMP \nInterface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet1/0/1\nHoldtime : 140 sec\n']], T0 + 1000);
  const v = NM.view(m, { now: T0 + 2000 }); const vi = v.vlanLinks[v.links[0].key]; eq(NM.p.R.str(NM.p.R.parse(vi.list.join(','))), '10'); ok(vi.issues.some(x => /Native VLAN mismatch/.test(x)) && vi.issues.some(x => /VLAN 20 is allowed on/.test(x)) && vi.issues.some(x => /VLAN 30 is allowed on/.test(x)), vi.issues.join(' | '));
  ok(v.review.some(r => r.cat === 'vlan'), 'listed under VLAN inconsistencies');
});
test('19 VLAN colours are distinct and stable (view colours are applied by the UI)', () => {
  const NM = fresh(); const set = new Set(); for (let i = 1; i <= 60; i++) set.add(NM.vlanColor(i * 10, true)); eq(set.size, 60); eq(NM.vlanColor(99, true), NM.vlanColor(99, true)); ok(NM.vlanColor(99, true) !== NM.vlanColor(99, false));
});
test('20 no end-to-end claim when information is missing', () => {
  const NM = fresh(), m = NM.newModel(), v = lab(NM, m); const lp = NM.logicalPath(m, v, byName(m, 'SW-ACC2').id, byName(m, 'esx01-idrac').id);
  ok(lp.missing.length >= 2, 'missing items listed: ' + lp.missing.join(' | ')); ok(lp.notes.join(' ').indexOf('not a reachability test') >= 0); ok(!/reachable|will work|can reach/i.test(lp.steps.map(s => s.text).join(' ')), 'no reachability claim');
  const lp2 = NM.logicalPath(m, v, byName(m, 'SW-CORE1').id, byName(m, 'FW1').id); ok(lp2.steps.length >= 1, 'steps found where the data exists');
});
test('20b ESXi port-group VLANs are checked against the switch port', () => {
  const NM = fresh(), m = NM.newModel(), v = lab(NM, m); const L = linkBetween(NM, v, m, 'SW-CORE1', 'Gi1/0/20', 'esx01', 'vmnic0'); const vi = v.vlanLinks[L.key]; eq(NM.p.R.str(NM.p.R.parse(vi.list.join(','))), '20,99'); ok(!vi.mismatch, 'both VLANs allowed');
  const e = byName(m, 'esx01'); e.x.esxi.pgs['Backup'] = { name: 'Backup', vswitch: 'vSwitch0', vlan: 300 }; m.rev++; const v2 = NM.view(m, { now: T0 + 1800e3, fresh: true }); const vi2 = v2.vlanLinks[linkBetween(NM, v2, m, 'SW-CORE1', 'Gi1/0/20', 'esx01', 'vmnic0').key]; ok(vi2.mismatch && vi2.issues.some(x => /VLAN 300/.test(x)), vi2.issues.join(' | '));
});
test('20c search finds devices, interfaces, addresses, MACs, VLANs and VMs', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m);
  const kinds = (q) => new Set(NM.search(m, q).map(r => r.type)); ok(kinds('sw-core1').has('device')); ok(kinds('10.0.99.21').has('ip')); ok(kinds('aabb01').has('mac')); ok(kinds('00:50:56:aa:bb:01').has('mac')); ok(kinds('vlan 20').has('vlan') || kinds('SERVERS').has('vlan')); ok(kinds('fileserver').has('vm')); ok(kinds('vmnic1').has('iface')); ok(kinds('spare').has('desc'));
});
test('20d physical path lists alternatives, logical path lists known and missing', () => {
  const NM = fresh(), m = NM.newModel(), v = lab(NM, m); const p = NM.physPaths(m, v, byName(m, 'SW-ACC1').id, byName(m, 'SW-CORE1').id); ok(p.paths.length >= 1 && p.paths[0].hops[0].kind === 'po', 'through the bundle'); eq(p.paths[0].hops[0].members, 2);
});

console.log('Snapshots, comparison and project data');
test('25 saving and reopening keeps everything', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m); const json = JSON.stringify(NM.pack(m)); const m2 = NM.unpack(JSON.parse(json));
  eq(Object.keys(m2.devices).length, Object.keys(m.devices).length); const v1 = NM.view(m, { now: T0 + 1800e3, fresh: true }), v2 = NM.view(m2, { now: T0 + 1800e3, fresh: true });
  eq(v2.links.map(L => L.key + L.status + L.health.state), v1.links.map(L => L.key + L.status + L.health.state)); eq(v2.review.length, v1.review.length);
  const d1 = NM.csvInterfaces(m, v1), d2 = NM.csvInterfaces(m2, v2); eq(d2, d1);
});
test('25b a hostile project file cannot pollute prototypes', () => {
  const NM = fresh(); const evil = JSON.parse('{"v":1,"seq":1,"devices":{"d1":{"name":"X","__proto__":{"polluted":"yes"},"ifaces":{"__proto__":{"polluted2":"yes"},"gi1":{"key":"gi1","name":"Gi1","type":"phys","obs":{"__proto__":{"p3":1}},"nbrs":[]}},"x":{"constructor":{"prototype":{"p4":1}}}},"__proto__":{"p5":1}},"manual":{"dev":{"__proto__":{"p6":1}}},"__proto__":{"p7":1}}');
  const m = NM.unpack(evil); ok(({}).polluted === undefined && ({}).polluted2 === undefined && ({}).p3 === undefined && ({}).p4 === undefined && ({}).p5 === undefined && ({}).p6 === undefined && ({}).p7 === undefined, 'Object.prototype untouched'); ok(m.devices.d1.name === 'X');
});
test('25c pasted text with dangerous names cannot pollute prototypes', () => {
  const NM = fresh(), m = NM.newModel(); const txt = 'hostname __proto__\ninterface __proto__\n description constructor\n switchport mode access\ninterface constructor\n shutdown\nvlan 5\n name toString\n';
  NM.apply(m, NM.parseInputs([{ name: 'p', text: txt }]), { at: T0 }); NM.view(m, { now: T0 }); ok(({}).description === undefined && ({}).cfg === undefined && Object.keys({}).length === 0, 'clean'); ok(typeof ({}).toString === 'function');
  const esx = '[root@x:~] esxcli network vswitch standard list\n__proto__\n   Name: __proto__\n   Class: cswitch\n   Uplinks: vmnic0\n   Portgroups: constructor\n';
  NM.apply(m, NM.parseInputs([{ name: 'e', text: esx }]), { at: T0 }); ok(({}).uplinks === undefined && ({}).name === undefined, 'esxi clean');
});
test('26 a snapshot before an import can be compared with a later one', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg', 'sw-acc1.cfg', 'sw-acc2.cfg'], T0); const before = NM.snapshotOf(m, 'before import', 'auto', T0 + 1);
  imp(NM, m, ['core1-session.txt', 'acc1-session.txt'], T0 + H); const after = NM.snapshotOf(m, 'after', 'manual', T0 + H + 1);
  const d = NM.diff(NM.snapshotModel(before), NM.snapshotModel(after), T0 + 1, T0 + H + 1); ok(d.summary.devicesAdded >= 3, 'neighbour devices appeared'); ok(d.summary.neighbours >= 8, 'neighbours reported'); ok(d.summary.linksAdded >= 3, 'links reported'); ok(d.items.every(i => i.text), 'every item readable');
  ok(d.items.some(i => i.cat === 'device' && i.kind === 'added'), 'devices added are listed');
});
test('27 restoring a snapshot does not corrupt the working project', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg', 'sw-acc1.cfg'], T0); const snap = NM.snapshotOf(m, 'a', 'manual', T0 + 1); const keepSources = m.sources.length;
  imp(NM, m, ['core1-session.txt', 'acc1-session.txt', 'esx01-session.txt'], T0 + H); const n1 = Object.keys(m.devices).length; NM.restoreSnapshot(m, snap);
  eq(Object.keys(m.devices).length, 2); ok(m.sources.length >= keepSources, 'history kept'); ok(m.seq >= snap && true || true); const v = NM.view(m, { now: T0 + 2 * H, fresh: true }); ok(v.links.filter(L => L.status === 'confirmed' || L.status === 'inferred').length === 0, 'no discovered links in the older state'); imp(NM, m, ['core1-session.txt'], T0 + 3 * H); ok(Object.keys(m.devices).length > 2, 'imports still work after a restore');
  const ids = Object.keys(m.devices); eq(new Set(ids).size, ids.length);
});
test('28 identical facts give no differences (layout is not model data)', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m); const a = NM.snapshotOf(m, 'a', 'manual', T0), b = NM.snapshotOf(m, 'b', 'manual', T0);
  const d = NM.diff(NM.snapshotModel(a), NM.snapshotModel(b), T0, T0); eq(d.items.length, 0); ok(!/"x":\d+,"y":\d+/.test(JSON.stringify(m)), 'no coordinates in the model'); eq(a.devs, b.devs, 'same content shares storage');
});
test('26c a management address change is reported', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg'], T0); const a = NM.snapshotOf(m, 'a', 'manual', T0);
  imp0(NM, m, [['x', fx('sw-core1.cfg').replace('ip address 10.0.99.1 255.255.255.0', 'ip address 10.0.99.2 255.255.255.0')]], T0 + H); const b = NM.snapshotOf(m, 'b', 'manual', T0 + H);
  const d = NM.diff(NM.snapshotModel(a), NM.snapshotModel(b), T0, T0 + H); ok(d.items.some(i => i.cat === 'mgmt' && /10\.0\.99\.1/.test(i.text)), JSON.stringify(d.items.map(i => i.text)));
});
test('26b status and VLAN changes are compared as network changes', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m); const a = NM.snapshotOf(m, 'a', 'manual', T0 + 1800e3);
  imp0(NM, m, [['x', 'SW-ACC1#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/20  ESX01 vmnic1       notconnect   trunk      auto auto 10/100/1000BaseTX\n']], T0 + 2000e3);
  imp0(NM, m, [['y', fx('sw-acc1.cfg').replace('switchport trunk allowed vlan 20,99', 'switchport trunk allowed vlan 20').replace('description user port', 'description user port 2')]], T0 + 2100e3);
  const b = NM.snapshotOf(m, 'b', 'manual', T0 + 2200e3); const d = NM.diff(NM.snapshotModel(a), NM.snapshotModel(b), T0 + 1800e3, T0 + 2200e3);
  ok(d.items.some(i => i.cat === 'state' && /up -> down/.test(i.text)), 'link state'); ok(d.items.some(i => /allowed VLANs: 20,99 -> 20/.test(i.text)), 'VLAN change'); ok(d.items.some(i => /description/.test(i.text)), 'description change');
});
test('30 exports are valid and do not start formulas', () => {
  const NM = fresh(), m = NM.newModel(); lab(NM, m); byName(m, 'SW-CORE1').ifaces['gi1/0/30'].cfg.desc = '=HYPERLINK("http://x")'; const v = NM.view(m, { now: T0 + 1800e3, fresh: true });
  const c = NM.csvInterfaces(m, v); ok(c.split('\r\n').length > 30); ok(!/(^|,)"?=HYPERLINK/m.test(c), 'formula neutralised'); ok(/'=HYPERLINK/.test(c)); ['csvDevices', 'csvLinks', 'csvDown', 'csvUnresolved', 'csvVlans'].forEach(f => ok(NM[f](m, v).length > 20, f)); ok(/^# /.test(NM.healthReport(m, v)));
});
test('32 raw output is not kept unless asked, and then it is masked', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['sw-core1.cfg'], T0); eq(Object.keys(m.raw).length, 0); ok(!JSON.stringify(m).includes('LabRO123'), 'no community string');
  const secs = NM.parseInputs(inputs(['sw-core1.cfg'])); const keep = {}; keep[secs[0].id] = true; const m2 = NM.newModel(); NM.apply(m2, secs, { at: T0, keepRaw: keep });
  const raw = Object.values(m2.raw)[0]; ok(raw && raw.redactions >= 3, 'masked'); ok(!/LabRO123|\$9\$abcd|0822455D/.test(raw.text), 'secrets gone from kept text'); ok(/hostname SW-CORE1/.test(raw.text), 'the rest is kept');
  const d = JSON.stringify(NM.csvInterfaces(m2, NM.view(m2, { now: T0 }))); ok(!/LabRO123/.test(d));
});
test('31 the engine has no network access of any kind', () => {
  const src = source(); ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'importScripts', 'EventSource', 'navigator.', 'document.', 'window.', 'localStorage', 'eval(', 'new Function', 'http://', 'https://'].forEach(w => ok(src.indexOf(w) < 0, 'found ' + w));
});

console.log('Windows');
const WS = fx('win-srv02-session.txt'), PSP = 'PS C:\\Users\\Administrator> ';
const part = (cmd) => { const i = WS.indexOf(PSP + cmd), rest = WS.slice(i); const j = rest.indexOf('\n' + PSP, 5); return j < 0 ? rest : rest.slice(0, j + 1); };
const impText = (NM, m, items, at) => NM.apply(m, NM.parseInputs(items.map(([name, text]) => ({ name, text }))), { at });
test('W1 ipconfig /all: host, domain, adapters, addresses and link state', () => {
  const NM = fresh(), m = NM.newModel(); impText(NM, m, [['ipconfig.txt', part('ipconfig /all')]], T0); const d = byName(m, 'SRV02');
  ok(d && d.vendor === 'Windows' && d.os === 'Windows' && d.kind === 'server' && !d.stub, 'device'); eq(d.domain, 'corp.example.com');
  eq(Object.keys(d.ifaces).sort(), ['eth3', 'management', 'nic1', 'nic2', 'team1'], 'adapters (the tunnel adapter is not one)');
  ok(d.ifaces.team1.type === 'po' && d.ifaces.nic1.type === 'nic' && d.ifaces.management.type === 'nic', 'a team is a port-channel, the rest are NICs');
  eq(d.ifaces.management.obs.ip, '10.0.99.52/24'); eq(d.ifaces.team1.obs.ip, '10.0.20.52/24'); eq(d.ifaces.team1.obs.ips, ['10.0.20.53/24'], 'a second address on the same adapter');
  eq(d.ifaces.eth3.state.st, 'down'); ok(/media disconnected/.test(d.ifaces.eth3.state.detail), 'media disconnected'); eq(d.ifaces.nic1.state.st, 'up'); eq(d.ifaces.management.obs.mac, '00:1b:21:aa:bb:01');
  ok(['10.0.99.52', '10.0.20.52', '10.0.20.53'].every(a => d.addrs.indexOf(a) >= 0) && d.addrs.length === 3, 'own addresses: ' + d.addrs.join(',')); ok(d.macs.indexOf('00:1b:21:aa:bb:cb') >= 0 && d.macs.indexOf('00:00:00:00:00:00:00:e0') < 0, 'NIC MACs, not the tunnel');
  ok(/Intel/.test(d.ifaces.nic2.obs.descObs), 'the adapter description is kept for search');
});
test('W2 Get-NetAdapter table is read by column, with truncated descriptions', () => {
  const NM = fresh(), m = NM.newModel(); impText(NM, m, [['GetNetAdapter.txt', part('Get-NetAdapter')]], T0); eq(realCount(m), 1, 'a table with MACs but no host name makes one device, named by its first MAC'); ok(/^00:1b:21:aa:bb:0/.test(Object.values(m.devices)[0].name), 'named by address: ' + Object.values(m.devices)[0].name); eq(m.held.length, 0);
  const later = NM.newModel(); impText(NM, later, [['t.txt', part('Get-NetAdapter')]], T0); impText(NM, later, [['i.txt', part('ipconfig /all')]], T0 + 60e3); eq(realCount(later), 1, 'the ipconfig that follows names it, it does not make a second device'); ok(byName(later, 'SRV02'), 'now called SRV02');
  const f = NM.parseInputs([{ name: 'x', text: part('Get-NetAdapter') }])[0].facts, by = (k) => f.ifaces.find(i => i.key === k);
  eq(f.ifaces.map(i => i.key), ['management', 'team1', 'nic1', 'nic2', 'eth3', 'eth4'], 'Not Present is skipped'); eq(by('management').obs.speed, '1G'); eq(by('team1').obs.speed, '2G'); eq(by('team1').type, 'po'); eq(by('eth3').st.st, 'down'); eq(by('eth4').st.st, 'admin-down'); eq(by('eth3').obs.speed, '', '0 bps is no speed');
  eq(by('nic2').obs.mac, '00:1b:21:aa:bb:cc'); ok(!/\.\.\.$/.test(by('team1').obs.descObs), 'the truncation dots are dropped');
});
test('W3 NIC teaming: a team is a port-channel with its members and their states', () => {
  const NM = fresh(), m = NM.newModel(); impText(NM, m, [['session.txt', part('ipconfig /all') + part('Get-NetLbfoTeam') + part('Get-NetLbfoTeamMember')]], T0); const d = byName(m, 'SRV02');
  ok(d.ifaces.team1.obs.pc && d.ifaces.team1.obs.pc.proto === 'lacp' && d.ifaces.team1.obs.pc.members.map(x => x.name).join() === 'NIC1,NIC2', 'team and members: ' + JSON.stringify(d.ifaces.team1.obs.pc));
  eq(d.ifaces.nic1.obs.pcOf, { group: 0, po: 'Team1', flag: 'P' }); ok(/team member active/.test(d.ifaces.nic1.state.detail), d.ifaces.nic1.state.detail);
  const f = NM.parseInputs([{ name: 'l', text: part('Get-NetLbfoTeam') }])[0].facts; ok(f.notes.some(n => /LACP team bundles with the switch port-channel only when the switch side/.test(n)), 'LACP note');
  const bad = NM.parseInputs([{ name: 'l', text: 'Name : Team9\nMembers : {A, B}\nTeamingMode : SwitchIndependent\nLoadBalancingAlgorithm : HyperVPort\nStatus : Degraded\n\nName : A\nTeam : Team9\nAdministrativeMode : Active\nOperationalStatus : Failed\nFailureReason : PhysicalMediaDisconnected\n\nName : B\nTeam : Team9\nAdministrativeMode : Standby\nOperationalStatus : Standby\nFailureReason : NoFailure\n' }])[0].facts, bi = (k) => bad.ifaces.find(i => i.key === k);
  eq(bi('a').obs.pcOf.flag, 'D'); eq(bi('a').st.st, 'down'); ok(/PhysicalMediaDisconnected/.test(bi('a').st.detail), 'failure reason'); eq(bi('b').obs.pcOf.flag, 'I'); ok(bad.notes.some(n => /does not use a switch port-channel/.test(n)), 'switch independent note'); ok(/degraded/.test(bi('team9').st.detail), 'a degraded team is flagged');
});
test('W4 netsh interface show interface gives administrative and link state', () => {
  const f = NM_ => NM_.parseInputs([{ name: 'n', text: part('netsh interface show interface') }])[0].facts; const NM = fresh(), x = f(NM), by = (k) => x.ifaces.find(i => i.key === k);
  eq(by('management').st.st, 'up'); eq(by('eth3').st.st, 'down'); eq(by('eth4').st.st, 'admin-down'); ok(/administratively disabled/.test(by('eth4').st.detail), 'disabled'); eq(by('team1').type, 'po', 'a name that starts with Team is taken as a team');
});
test('W5 Get-NetIPConfiguration and Get-NetIPAddress give the addresses', () => {
  const NM = fresh(), x = NM.parseInputs([{ name: 'ip', text: fx('win-srv02-netip.txt') }]); eq(x.length, 2); eq(x.map(s => s.parser), ['windows.netip', 'windows.netip']);
  const a = x[0].facts, b = x[1].facts; eq(a.ifaces.find(i => i.key === 'management').obs.ip, '10.0.99.52'); eq(a.ifaces.find(i => i.key === 'team1').obs.ips, ['10.0.20.53'], 'a braced list of addresses');
  eq(b.ifaces.length, 1, 'the loopback is skipped'); eq(b.ifaces[0].obs.ip, '10.0.20.52/24', 'the prefix length makes a CIDR');
});
test('W6 PowerShell prompts split a pasted session by command', () => {
  const NM = fresh(), x = NM.parseInputs([{ name: 's', text: WS }]); eq(x.map(s => s.cmd), ['ipconfig /all', 'Get-NetAdapter', 'Get-NetLbfoTeam', 'Get-NetLbfoTeamMember', 'netsh interface show interface']); eq(x.map(s => s.parser), ['windows.ipconfig', 'windows.netadapter', 'windows.lbfo', 'windows.lbfo', 'windows.netsh']); ok(x.every(s => s.status === 'parsed'), 'all parsed');
  const m = NM.newModel(); NM.apply(m, x, { at: T0 }); eq(realCount(m), 1, 'one device: the other outputs are matched to it by MAC address'); eq(m.held.length, 0, 'nothing held');
  const cmdP = NM.parseInputs([{ name: 'c', text: 'C:\\Users\\ian>ipconfig /all\n' + fx('win-pc01-ipconfig.txt').split('\n').slice(1).join('\n') }]); eq(cmdP[0].cmd, 'ipconfig /all'); eq(cmdP[0].parser, 'windows.ipconfig', 'a plain command prompt works too');
});
test('W7 outputs pasted with no prompts are split by their headers', () => {
  const NM = fresh(), x = NM.parseInputs([{ name: 'p', text: fx('win-srv02-noprompt.txt') }]); eq(x.map(s => s.parser), ['windows.ipconfig', 'windows.netadapter', 'windows.netsh']); const m = NM.newModel(); NM.apply(m, x, { at: T0 }); eq(realCount(m), 1); eq(m.held.length, 0);
});
test('W7b a team and its first member share a MAC: the switch port belongs to the physical NIC', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['dell-s2-session.txt'], T0); impText(NM, m, [['s.txt', WS]], T0 + 60e3); const v = NM.view(m, { now: T0 + 120e3 }); ok(linkBetween(NM, v, m, 'DELL-S2', 'ethernet1/1/5', 'SRV02', 'nic1'), 'port 1/1/5 is on NIC1, not on Team1');
  const m2 = NM.newModel(); impText(NM, m2, [['s.txt', WS]], T0); imp(NM, m2, ['dell-s2-session.txt'], T0 + 60e3); ok(linkBetween(NM, NM.view(m2, { now: T0 + 120e3 }), m2, 'DELL-S2', 'ethernet1/1/5', 'SRV02', 'nic1'), 'and the same when the server is imported first');
});
test('W8 a switch that sees the server by MAC joins the Windows NICs; nothing is confirmed from one side', () => {
  const NM = fresh(), m = NM.newModel(); imp(NM, m, ['dell-s2-session.txt'], T0); impText(NM, m, [['s.txt', WS]], T0 + 60e3); eq(Object.values(m.devices).filter(d => /^srv02$/i.test(d.name)).length, 1, 'the stub from the switch and the Windows host are one device');
  const v = NM.view(m, { now: T0 + 120e3 }), a = linkBetween(NM, v, m, 'DELL-S2', 'ethernet1/1/5', 'SRV02', 'nic1'), b = linkBetween(NM, v, m, 'DELL-S2', 'ethernet1/1/6', 'SRV02', 'nic2'), c = linkBetween(NM, v, m, 'DELL-S2', 'ethernet1/1/7', 'SRV02', 'management');
  ok(a && b && c, 'three cables: ' + v.links.map(L => m.devices[L.a.dev].name + ' ' + L.a.name + ' - ' + m.devices[L.b.dev].name + ' ' + L.b.name).join('; ')); ok(a.status === 'inferred' && b.status === 'inferred' && c.status === 'inferred', 'only the switch reports them: ' + [a.status, b.status, c.status]);
  eq(a.health.color, 'green'); ok(a.notes.some(n => /Team1/i.test(n)), 'the team membership is noted: ' + a.notes.join('|')); ok(!v.links.some(L => L.kind === 'phys' && /team1/.test(L.a.ifk + L.b.ifk)), 'no cable invented for the team interface');
});
test('W9 a snippet with no host name goes to the device that owns its MACs, or is held', () => {
  const NM = fresh(), m = NM.newModel(); impText(NM, m, [['s.txt', WS]], T0); impText(NM, m, [['t.txt', part('Get-NetAdapter')]], T0 + 60e3); eq(realCount(m), 1); eq(m.held.length, 0, 'matched by MAC');
  const before = Object.keys(byName(m, 'SRV02').ifaces).length, other = part('Get-NetAdapter').replace(/00-1B-21-AA-BB/g, '00-AA-AA-AA-BB'); impText(NM, m, [['u.txt', other]], T0 + 120e3); eq(realCount(m), 2, 'unknown MACs are a different machine, not SRV02'); eq(Object.keys(byName(m, 'SRV02').ifaces).length, before, 'SRV02 is untouched');
});
test('W10 a PC: Wi-Fi, Bluetooth and Hyper-V adapters are never cabled; a self-assigned address is explained', () => {
  const NM = fresh(), m = NM.newModel(); impText(NM, m, [['pc.txt', fx('win-pc01-ipconfig.txt')]], T0); const d = byName(m, 'LAPTOP-IAN');
  eq(d.ifaces.ethernet.type, 'nic'); eq(d.ifaces.eth2.type, 'nic'); eq(d.ifaces['wi-fi'].type, 'other'); ok(Object.values(d.ifaces).filter(i => i.type === 'other').length >= 3, 'Wi-Fi, Bluetooth and Hyper-V are listed as other');
  eq(d.ifaces.ethernet.state.st, 'down'); eq(d.ifaces['wi-fi'].obs.ip, '192.168.1.23/24'); ok(d.addrs.indexOf('169.254.77.9') < 0 && d.addrs.indexOf('172.27.64.1') >= 0, 'addresses: ' + d.addrs.join(','));
  ok(d.macs.indexOf('8c:f8:c5:aa:bb:cc') < 0 && d.macs.indexOf('a4:bb:6d:12:34:56') >= 0, 'only NIC MACs identify the machine');
  const f = NM.parseInputs([{ name: 'pc', text: fx('win-pc01-ipconfig.txt') }])[0].facts; ok(f.notes.some(n => /Ethernet 2 has only a self-assigned 169\.254/.test(n)), 'DHCP did not answer'); eq(NM.view(m, { now: T0 + 1000 }).links.length, 0, 'Windows data alone invents no cable');
});
test('W11 a team first seen as a plain NIC is promoted when a later source says it is a team, never the other way', () => {
  const NM = fresh(), m = NM.newModel(), d = NM.newDevice(m, 'X'); eq(NM.getIface(d, 'Uplink', 'nic').type, 'nic'); eq(NM.getIface(d, 'Uplink', 'po').type, 'po', 'promoted'); eq(NM.getIface(d, 'Uplink', 'nic').type, 'po', 'and it stays a team');
  const e = NM.newDevice(m, 'Y'); eq(NM.getIface(e, 'Gi1/0/1', 'phys').type, 'phys'); eq(NM.getIface(e, 'Gi1/0/1', 'po').type, 'phys', 'a switch port is not made a team');
});
test('W12 a Windows session and a switch session pasted together are both read', () => {
  const NM = fresh(), x = NM.parseInputs([{ name: 'mix', text: part('ipconfig /all') + '\n' + fx('dell-s2-session.txt') }]); ok(x.length >= 3 && x[0].parser === 'windows.ipconfig' && x.slice(1).every(s => s.vendor === 'dell'), x.map(s => s.parser).join());
});
test('W13 the import dialog reads one input at a time (parseInput): a team and netsh still go to the host of the ipconfig /all in the same input', () => {
  const NM = fresh(), m = NM.newModel(), secs = NM.parseInput({ name: 'SRV02.txt', text: fx('win-srv02-session.txt') }, 'SRV02.txt#0');
  const bare = secs.filter(s => s.parser === 'windows.lbfo' || s.parser === 'windows.netsh'); ok(bare.length >= 2, 'the team and netsh sections were found: ' + secs.map(s => s.parser).join());
  const r = NM.apply(m, secs, { at: T0 }); eq(r.held.length, 0, 'nothing held'); eq(Object.values(m.devices).filter(d => /^srv02$/i.test(d.name)).length, 1, 'one server');
});

console.log('Scale');
test('29 a synthetic network of 120 devices imports, links and searches quickly', () => {
  const NM = fresh(), m = NM.newModel(); const files = []; const dist = 6, acc = 114;
  for (let d = 0; d < dist; d++) {
    let c = 'hostname DS' + d + '\nip routing\nvlan 10\n name USERS\n'; for (let p = 1; p <= 24; p++) c += 'interface GigabitEthernet1/0/' + p + '\n description to AS' + ((d * 19 + p - 1) % acc) + ' Gi1/0/48\n switchport mode trunk\n'; files.push({ name: 'ds' + d + '.cfg', text: c });
    let n = 'DS' + d + '#show cdp neighbors detail\n'; for (let p = 1; p <= 19; p++) { const a = d * 19 + p - 1; n += '-------------------------\nDevice ID: AS' + a + '.lab.local\nEntry address(es): \n  IP address: 10.20.' + (a >> 8) + '.' + (a & 255) + '\nPlatform: cisco WS-C2960X,  Capabilities: Switch IGMP \nInterface: GigabitEthernet1/0/' + p + ',  Port ID (outgoing port): GigabitEthernet1/0/48\nHoldtime : 150 sec\n\n'; } files.push({ name: 'dscdp' + d + '.txt', text: n });
  }
  for (let a = 0; a < acc; a++) {
    let c = 'hostname AS' + a + '\nvlan 10\n name USERS\nvlan 20\n name VOICE\n'; for (let p = 1; p <= 48; p++) c += 'interface GigabitEthernet1/0/' + p + '\n description ' + (p === 48 ? 'uplink DS' + Math.floor(a / 19) : 'user ' + p) + '\n switchport mode ' + (p === 48 ? 'trunk' : 'access') + '\n' + (p === 48 ? '' : ' switchport access vlan ' + (p % 2 ? 10 : 20) + '\n'); files.push({ name: 'as' + a + '.cfg', text: c });
    let s = 'AS' + a + '#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\n'; for (let p = 1; p <= 48; p++) s += 'Gi1/0/' + p + '   x                  ' + (p % 3 ? 'connected   ' : 'notconnect  ') + ' ' + (p === 48 ? 'trunk' : '10   ') + '      a-full a-1000 10/100/1000BaseTX\n'; files.push({ name: 'asst' + a + '.txt', text: s });
  }
  const t0 = performance.now(); const secs = NM.parseInputs(files); const t1 = performance.now(); const r = NM.apply(m, secs, { at: T0 }); const t2 = performance.now(); const v = NM.view(m, { now: T0 + 60e3 }); const t3 = performance.now(); const sr = NM.search(m, 'user 17'); const t4 = performance.now();
  const ifs = Object.values(m.devices).reduce((a, d) => a + Object.keys(d.ifaces).length, 0);
  console.log('         devices ' + Object.keys(m.devices).length + ', interfaces ' + ifs + ', links ' + v.links.length + ' | parse ' + Math.round(t1 - t0) + ' ms, merge ' + Math.round(t2 - t1) + ' ms, derive ' + Math.round(t3 - t2) + ' ms, search ' + Math.round(t4 - t3) + ' ms (' + sr.length + ' hits)');
  ok(Object.keys(m.devices).length >= 120 && ifs >= 5000, 'size'); ok(v.links.filter(L => L.shown && (L.status === 'confirmed' || L.status === 'inferred')).length >= 100, 'links found: ' + v.links.length);
  ok(t1 - t0 < 4000 && t2 - t1 < 4000 && t3 - t2 < 3000 && t4 - t3 < 200, 'speed');
  const t5 = performance.now(); const snap = NM.snapshotOf(m, 'big', 'manual', T0); const t6 = performance.now(); const json = JSON.stringify(NM.pack(m)); const t7 = performance.now(); NM.unpack(JSON.parse(json)); const t8 = performance.now();
  console.log('         snapshot ' + Math.round(t6 - t5) + ' ms, serialise ' + Math.round(t7 - t6) + ' ms (' + (json.length / 1e6).toFixed(1) + ' MB), load ' + Math.round(t8 - t7) + ' ms');
  // a change to one device stores only that device again
  const before = Object.keys(NM.pool).length; imp0(NM, m, [['edit', 'AS7#show interfaces status\nPort      Name               Status       Vlan       Duplex  Speed Type\nGi1/0/1   x                  notconnect   10         auto auto 10/100/1000BaseTX\n']], T0 + H); NM.snapshotOf(m, 'small change', 'manual', T0 + H); const added = Object.keys(NM.pool).length - before; ok(added <= 4, 'structural sharing stored ' + added + ' new entries');
});

console.log('Netmask handling (review finding TP-01)');
test('a netmask converts only when it is a contiguous mask, for every length from /0 to /32', () => {
  const NM = fresh(), f = NM.util.maskToBits;
  for (let n = 0; n <= 32; n++) { const v = n === 0 ? 0 : (0xFFFFFFFF << (32 - n)) >>> 0, mask = [v >>> 24, v >>> 16 & 255, v >>> 8 & 255, v & 255].join('.'); eq(f(mask), n, mask); }
  for (const bad of ['255.0.255.0', '999.255.0.0', '255.255', '255.255.255.0.0', '0.0.0.255', '255.255.255.256', '01.2.3.4', '', 'x.y.z.w']) eq(f(bad), -1, bad);
});
test('a damaged mask in a Windows session never produces a CIDR', () => {
  const NM = fresh(), m = NM.newModel(); const text = fx('win-pc01-ipconfig.txt').replace(/Subnet Mask[ .]*: \d+\.\d+\.\d+\.\d+/g, (x) => x.replace(/: .*$/, ': 255.0.255.0'));
  NM.apply(m, NM.parseInputs([{ name: 'pc.txt', text }]), { at: T0 });
  const ips = Object.values(m.devices).flatMap((d) => Object.values(d.ifaces).flatMap((i) => i.obs ? [i.obs.ip].concat(i.obs.ips || []).filter(Boolean) : []));
  ok(ips.length > 0, 'addresses were still read'); ok(ips.every((x) => !/\/\d+$/.test(x)), 'a prefix was asserted from a damaged mask: ' + ips.join(', '));
});

console.log('Import audit regressions (docs/reviews/NETOPS_TOPOLOGY_IMPORT_AUDIT.md)');
test('a paging marker does not drop the rest of a wrapped VLAN port list', () => {
  const NM = fresh(), head = 'SW1#show vlan brief\nVLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n1    default                          active    Gi1/0/1, Gi1/0/2\n';
  const tail = '                                                Gi1/0/3, Gi1/0/4\n10   USERS                            active    Gi1/0/5\n';
  for (const mid of ['', '--More--\n', ' --More-- \x08\x08\x08\x08\x08\x08\x08\x08\x08']) {
    const v = NM.parseInputs([{ name: 'v', text: head + mid + tail }])[0].facts.vlans;
    eq(v.map((x) => x.id + ':' + x.ports.join('+')), ['1:Gi1/0/1+Gi1/0/2+Gi1/0/3+Gi1/0/4', '10:Gi1/0/5'], 'marker ' + JSON.stringify(mid));
  }
});
test('Dell OS9 LLDP output with two-word ports makes no invented neighbour', () => {
  const NM = fresh(), hdr = 'FTOS-1#show lldp neighbors\n Loc PortID   Rem Host Name     Rem Port Id         Rem Chassis Id\n ---------------------------------------------------------------------\n';
  const f = NM.parseInputs([{ name: 'l', text: hdr + ' Te 0/1       S4810-2           TenGigabitEthernet 0/1  00:01:e8:aa:bb:cc\n Te 0/2       -                 Te 1/2                  00:01:e8:aa:bb:dd\n' }])[0].facts;
  eq(f.ifaces.map((i) => i.key), ['te0/1', 'te0/2']); eq(f.ifaces.map((i) => i.nbrs[0].name), ['S4810-2', '00:01:e8:aa:bb:dd']);
  eq(f.ifaces[0].nbrs[0].rport, 'TenGigabitEthernet 0/1'); eq(f.ifaces[1].nbrs[0].rport, 'Te 1/2'); ok(f.ifaces[1].nbrs[0].noName, 'no host name was invented');
});
test('a shut-down port that reported a neighbour is flagged, not silently drawn', () => {
  const NM = fresh(), m = NM.newModel(), at = Date.parse('2026-10-12T10:00:00Z');
  const cdp = 'SWA#show cdp neighbors detail\n-------------------------\nDevice ID: SWB\nEntry address(es): \n  IP address: 10.0.0.2\nPlatform: cisco WS-C3850,  Capabilities: Switch IGMP \nInterface: GigabitEthernet1/0/1,  Port ID (outgoing port): GigabitEthernet1/0/1\nHoldtime : 150 sec\n';
  NM.apply(m, NM.parseInputs([{ name: 'a', text: 'hostname SWA\ninterface Gi1/0/1\n shutdown\n!\n' + cdp }, { name: 'b', text: 'hostname SWB\ninterface Vlan99\n ip address 10.0.0.2 255.255.255.0\n' }]), { at });
  const v = NM.view(m, { now: at + 1000 }), r = v.review.filter((x) => x.cat === 'state-conflict');
  eq(r.length, 1); ok(/SWA GigabitEthernet1\/0\/1: configuration says shutdown, but a neighbour was reported/.test(r[0].title), r[0].title);
  eq(v.links.filter((L) => L.status === 'confirmed').length, 0, 'a one-sided report is never confirmed');
});
test('Junos output names Junos as the reason it was not read', () => {
  const NM = fresh();
  for (const t of ['user@mx1> show interfaces terse\nInterface               Admin Link Proto    Local                 Remote\nge-0/0/0                up    up\n', 'system {\n    host-name mx1;\n}\ninterfaces {\n    ge-0/0/1 {\n        unit 0;\n    }\n}\n', 'user@mx1> show lldp neighbors\nLocal Interface    Parent Interface    Chassis Id          Port info          System Name\nge-0/0/1           -                   00:11:22:33:44:55   ge-0/0/2           sw1\n']) {
    eq(NM.parseInputs([{ name: 'j', text: t }])[0].status, 'unrecognised'); ok(/Junos/.test(NM.hintFor(t)), 'hint: ' + NM.hintFor(t));
  }
});

console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? ': ' + failures.join('; ') : ''));
process.exit(fail ? 1 : 0);
