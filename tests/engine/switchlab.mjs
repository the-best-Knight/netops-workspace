// Switch Lab guided-lesson regressions (deep review DR-01 to DR-10). Each lesson network is built from LEVELS and driven
// through the real console path, on Cisco and on Dell, so the checks compare what the learner actually sees.
// The platform under test is the one the lab names in "show version": Cisco WS-C2960CX-8TC-L on IOS 15.2(7)E4, and
// Dell SmartFabric OS10 10.5.5.5. Expected strings come from the sources listed in docs/reviews/2026-11-03-remediation.md.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('fault-lab', ['LEVELS', 'runConsoleCommand', 'ensureSession', 'canPing']);
T.__set('XS', null);

function lab(id, vendor) {
  const L = T.LEVELS.find((l) => l.id === id), net = L.build();
  T.__set('vendor', vendor); T.__set('net', net); T.__set('currentLevel', L);
  for (const k of Object.keys(T.__get('consoleSessions'))) delete T.__get('consoleSessions')[k];
  // what startLab does: the saved startup configs are empty and the lab's first state is what an unsaved reload returns to
  T.__set('startupCfg', {}); T.__set('coachInit', JSON.stringify(net.devices));
  return { L, net };
}
function on(dev) { T.__set('selectedDeviceId', dev); T.__set('confMode', false); T.__set('confIface', null); T.__set('confAcl', null); }
function run(line) { const s = T.ensureSession(T.__get('selectedDeviceId')), from = s.lines.length; T.runConsoleCommand(line, false); return s.lines.slice(from).map((l) => l.text).join('\n'); }
const priv = (vendor) => { if (vendor === 'cisco') run('enable'); };
const conf = (vendor) => { priv(vendor); run('configure terminal'); };
const switches = (net) => Object.values(net.devices).filter((d) => d.type === 'switch' || d.type === 'l3switch');
const physical = (d) => Object.entries(d.ifaces).filter(([k, i]) => !i.svi && !/^vlan/i.test(k));
const portNo = (k) => +(/(\d+)$/.exec(k) || [])[1];
const IDS = T.LEVELS.map((l) => l.id);

console.log('DR-01 one chassis: show inventory agrees with show version');
for (const vendor of ['cisco', 'dell']) test('every guided switch, ' + vendor, () => {
  for (const id of IDS) { const { net } = lab(id, vendor); for (const d of switches(net)) {
    on(d.id); priv(vendor); const ver = run('show version'), inv = run('show inventory'), pid = (/PID:\s*(\S+)/.exec(inv) || [])[1];
    ok(pid && ver.includes(pid), 'lab ' + id + ' ' + d.name + ': inventory PID ' + pid + ' is not in show version');
  } }
});

console.log('DR-02 every Cisco switch port exists on a WS-C2960CX-8TC-L (Gi0/1 to Gi0/12)');
test('no guided lab builds a port the declared switch does not have', () => {
  for (const id of IDS) { const { net } = lab(id, 'cisco'); for (const d of switches(net)) for (const [k] of physical(d)) ok(/^Gi0\/\d+$/.test(k) && portNo(k) >= 1 && portNo(k) <= 12, 'lab ' + id + ' ' + d.name + ' has ' + k); }
});
test('ports named in each lab text exist in that lab, for both vendors', () => {
  for (const L of T.LEVELS) {
    const net = L.build(), keys = new Set(Object.values(net.devices).filter((d) => d.type !== 'pc' && d.type !== 'server').flatMap((d) => physical(d).map(([k]) => portNo(k))));
    const cisco = JSON.stringify([L.addressing, L.plan, L.hints, L.scenario, L.teach, L.ticket]), dell = JSON.stringify(L.dell || {});
    for (const m of cisco.matchAll(/\bGi(?:gabitEthernet)?0\/(\d+)\b/g)) ok(keys.has(+m[1]), 'lab ' + L.id + ' text names Gi0/' + m[1]);
    for (const m of dell.matchAll(/\bethernet ?1\/1\/(\d+)\b/gi)) ok(keys.has(+m[1]), 'lab ' + L.id + ' Dell text names ethernet1/1/' + m[1]);
  }
});

console.log('DR-03 show spanning-tree uses the VLAN asked for (Cisco PVST+)');
test('vlan 10 prints VLAN0010 with priority 32768 + 10', () => {
  lab(1, 'cisco'); on('sw1'); priv('cisco'); const t = run('show spanning-tree vlan 10');
  ok(/^VLAN0010$/m.test(t) && /Priority\s+32778/.test(t) && /sys-id-ext 10\)/.test(t) && !/VLAN0001/.test(t), t);
  ok(/^Gi0\/2\s+Desg FWD 4\s+128\.2\s/m.test(t), 'the VLAN 10 port is listed with its own port number\n' + t);
});
test('a VLAN with no active ports lists no ports', () => {
  lab(1, 'cisco'); on('sw1'); priv('cisco'); const t = run('show spanning-tree vlan 1'); ok(!/^Gi0\//m.test(t) && /Spanning tree instance\(s\) for vlan 1 does not exist\./.test(t), t);
});
test('with two switches exactly one is root, and the other has a root port toward it (found during remediation)', () => {
  const { net } = lab(6, 'cisco'), seen = [];
  for (const d of switches(net)) { on(d.id); priv('cisco'); seen.push([d.name, run('show spanning-tree vlan 10')]); }
  const roots = seen.filter(([, t]) => /This bridge is the root/.test(t));
  eq(roots.length, 1, 'switches that call themselves root'); const other = seen.find(([, t]) => !/This bridge is the root/.test(t))[1];
  ok(/^Gi0\/2\s+Root FWD/m.test(other) && /Port\s+2 \(GigabitEthernet0\/2\)/.test(other), other);
  ok(!/^\S+\s+Root /m.test(roots[0][1]), 'the root bridge lists a root port\n' + roots[0][1]);
});

const prio = (t) => +(/Bridge ID  Priority\s+(\d+)/.exec(t) || [])[1], isRoot = (t) => /This bridge is the root/.test(t);
const showAll = (net, v) => Object.fromEntries(switches(net).map((d) => { on(d.id); priv('cisco'); return [d.id, run('show spanning-tree vlan ' + v)]; }));
const cfgOn = (id, lines) => { on(id); conf('cisco'); lines.forEach(run); run('end'); };
console.log('IR-01 root macros store one priority per VLAN');
test('SW1 primary, then SW2 primary: SW2 beats SW1 and the order of the commands decides', () => {
  const { net } = lab(6, 'cisco'); cfgOn('sw1', ['spanning-tree vlan 10 root primary']); let o = showAll(net, 10);
  ok(isRoot(o.sw1) && prio(o.sw1) === 24586, o.sw1); cfgOn('sw2', ['spanning-tree vlan 10 root primary']); o = showAll(net, 10);
  ok(isRoot(o.sw2) && !isRoot(o.sw1) && prio(o.sw2) === 20490 && prio(o.sw1) === 24586, o.sw1 + o.sw2);
  eq([net.devices.sw1.stpPrio[10], net.devices.sw2.stpPrio[10]], [24576, 20480]);
});
test('the stored priority does not move when a peer changes or the link goes down', () => {
  const { net } = lab(6, 'cisco'); cfgOn('sw1', ['spanning-tree vlan 10 root primary']); cfgOn('sw2', ['spanning-tree vlan 10 root primary']);
  cfgOn('sw2', ['spanning-tree vlan 10 root secondary']); const o = showAll(net, 10); ok(isRoot(o.sw1) && prio(o.sw1) === 24586 && prio(o.sw2) === 28682, o.sw1 + o.sw2);
  cfgOn('sw1', ['interface Gi0/2', 'shutdown']); const down = showAll(net, 10); eq(prio(down.sw1), 24586, 'priority changed when the link went down'); ok(isRoot(down.sw1), down.sw1);
  ok(/does not exist/.test(down.sw2), 'SW2 has no VLAN 10 port left, so no instance\n' + down.sw2); eq(net.devices.sw2.stpPrio[10], 28672, 'the stored priority is kept');
  on('sw2'); priv('cisco'); ok(/^spanning-tree vlan 10 priority 28672$/m.test(run('show running-config')), 'running-config lost the priority');
});
test('a command for VLAN 20 leaves the VLAN 10 priority alone, and several VLANs in one command work', () => {
  const { net } = lab(6, 'cisco'); cfgOn('sw1', ['spanning-tree vlan 10 root primary', 'spanning-tree vlan 20 root secondary']);
  eq([net.devices.sw1.stpPrio[10], net.devices.sw1.stpPrio[20]], [24576, 28672]); cfgOn('sw1', ['spanning-tree vlan 10,20 root primary']); eq([net.devices.sw1.stpPrio[10], net.devices.sw1.stpPrio[20]], [24576, 24576]);
});
test('running-config, save and reload, and spanning-tree output agree', () => {
  const { net } = lab(6, 'cisco'); cfgOn('sw1', ['spanning-tree vlan 10 root primary', 'spanning-tree vlan 20 root secondary']); on('sw1'); priv('cisco');
  const cfg = run('show running-config'); ok(/^spanning-tree vlan 10 priority 24576$/m.test(cfg) && /^spanning-tree vlan 20 priority 28672$/m.test(cfg), cfg);
  ok(prio(run('show spanning-tree vlan 10')) === 24586 && prio(run('show spanning-tree vlan 20')) === 28692, 'output disagrees with the stored priority');
  run('write memory'); run('reload'); run('yes'); on('sw1'); priv('cisco');
  ok(/^spanning-tree vlan 10 priority 24576$/m.test(run('show running-config')), 'priority lost across reload'); eq(prio(run('show spanning-tree vlan 10')), 24586);
});
test('an unsaved change is lost on reload, like the rest of the config', () => {
  lab(6, 'cisco'); cfgOn('sw1', ['spanning-tree vlan 10 root primary']); on('sw1'); priv('cisco'); run('reload'); run('no'); run('yes'); on('sw1'); priv('cisco');
  eq(prio(run('show spanning-tree vlan 10')), 32778);
});
test('a VLAN that does not exist on the switch is refused, and root secondary needs no lower root', () => {
  const { net } = lab(6, 'cisco'); on('sw1'); conf('cisco'); const t = run('spanning-tree vlan 99 root primary'); ok(/^%/m.test(t) && !net.devices.sw1.stpPrio, t);
});
test('the macro cannot go below 0: the lab says so and keeps the old priority', () => {
  const { net } = lab(6, 'cisco'); net.devices.sw2.stpPrio = { 10: 0 }; on('sw1'); conf('cisco'); const t = run('spanning-tree vlan 10 root primary'); ok(/^% Lab note:/m.test(t) && !(net.devices.sw1.stpPrio || {})[10], t);
});

console.log('IR-02 extended VLANs have spanning-tree instances; only 1002 to 1005 are left out');
for (const v of [1001, 1006, 2000, 4094]) test('VLAN ' + v + ': detail, root, and summary row', () => {
  lab(1, 'cisco'); on('sw1'); conf('cisco'); ['vlan ' + v, 'exit', 'interface Gi0/2', 'switchport access vlan ' + v, 'end'].forEach(run);
  const t = run('show spanning-tree vlan ' + v), name = 'VLAN' + String(v).padStart(4, '0');
  ok(new RegExp('^' + name + '$', 'm').test(t) && prio(t) === 32768 + v && isRoot(t) && /^Gi0\/2\s+Desg FWD/m.test(t), t);
  const sum = run('show spanning-tree summary'); ok(new RegExp('^' + name + '\\s+0\\s+0\\s+0\\s+1\\s+1$', 'm').test(sum) && /^Root bridge for: .*VLAN/m.test(sum) && new RegExp('Root bridge for:.*' + name).test(sum), sum);
});
test('the reserved VLANs 1002 to 1005 never get an instance', () => {
  lab(1, 'cisco'); on('sw1'); priv('cisco'); for (const v of [1002, 1003, 1004, 1005]) ok(/does not exist/.test(run('show spanning-tree vlan ' + v)), 'VLAN ' + v);
  ok(!/VLAN100[2-5]/.test(run('show spanning-tree summary')), 'reserved VLAN in the summary');
});
test('summary counts add up with extended VLANs present', () => {
  lab(1, 'cisco'); on('sw1'); conf('cisco'); ['vlan 2000', 'exit', 'interface Gi0/1', 'no shutdown', 'switchport access vlan 2000', 'end'].forEach(run);
  const sum = run('show spanning-tree summary'); ok(/^2 vlans\s+0\s+0\s+0\s+2\s+2$/m.test(sum), sum);
});

// A synthetic loop: three switches in a triangle, and two crossed links between a pair. Built here because no guided lesson has a loop.
function loopNet(links, prio) {
  const sw = (id) => ({ id, type: 'switch', name: id.toUpperCase(), vlans: {}, ifaces: {} }), net = { devices: { s1: sw('s1'), s2: sw('s2'), s3: sw('s3') }, links: [] };
  links.forEach(([a, ap, b, bp]) => { for (const [d, p] of [[a, ap], [b, bp]]) net.devices[d].ifaces[p] = { name: p, mode: 'trunk', status: 'up', admin: 'up', speed: '1000' }; net.links.push({ from: a, fromPort: ap, to: b, toPort: bp }); });
  if (prio) net.devices.s1.stpPrio = { 1: 4096 };
  T.__set('vendor', 'cisco'); T.__set('net', net); for (const k of Object.keys(T.__get('consoleSessions'))) delete T.__get('consoleSessions')[k];
  return Object.fromEntries(Object.keys(net.devices).filter((id) => Object.keys(net.devices[id].ifaces).length).map((id) => { on(id); priv('cisco'); return [id, run('show spanning-tree vlan 1')]; }));
}
test('a triangle has one root, one blocked port, and a root port on each other switch', () => {
  const o = loopNet([['s1', 'Gi0/1', 's2', 'Gi0/1'], ['s2', 'Gi0/2', 's3', 'Gi0/2'], ['s3', 'Gi0/1', 's1', 'Gi0/2']], true), all = Object.values(o).join('\n');
  ok(/This bridge is the root/.test(o.s1), o.s1); eq((all.match(/ Altn BLK /g) || []).length, 1, 'blocked ports'); ok(/Root FWD/.test(o.s2) && /Root FWD/.test(o.s3), all);
});
test('crossed parallel links: the root port faces the lower sender port ID', () => {
  const o = loopNet([['s1', 'Gi0/2', 's2', 'Gi0/1'], ['s1', 'Gi0/1', 's2', 'Gi0/2']], true);
  ok(/^Gi0\/2\s+Root FWD/m.test(o.s2) && /^Gi0\/1\s+Altn BLK/m.test(o.s2), o.s2);
});

console.log('DR-04 shut ports and routed ports are not in spanning tree');
test('a shut access port is left out and DWN never appears', () => {
  lab(1, 'cisco'); on('sw1'); priv('cisco'); const t = run('show spanning-tree'); ok(!/^Gi0\/1\s/m.test(t) && !/DWN/.test(t), t);
});
test('the routed port in lab 13 is left out', () => {
  const { net } = lab(13, 'cisco'); ok(net.devices.l3a.ifaces['Gi0/8'] && net.devices.l3a.ifaces['Gi0/8'].ip, 'lab 13 has no routed Gi0/8');
  on('l3a'); priv('cisco'); const t = run('show spanning-tree'); ok(!/^Gi0\/8\s/m.test(t) && /^Gi0\/1\s/m.test(t), t);
});

console.log('DR-05 a Layer 2 port refuses an IP address');
test('Cisco prints the IOS error and keeps the port unchanged', () => {
  const { net } = lab(1, 'cisco'); on('sw1'); conf('cisco'); run('interface Gi0/2'); const t = run('ip address 10.9.9.1 255.255.255.0');
  ok(t.includes('% IP addresses may not be configured on L2 links.'), t); ok(!net.devices.sw1.ifaces['Gi0/2'].ip, 'address stored');
  run('end'); ok(!/ip address 10\.9\.9\.1/.test(run('show running-config interface Gi0/2')), 'address in running config');
});
test('Dell refuses it too, with a lab note instead of an invented device message', () => {
  const { net } = lab(1, 'dell'); on('sw1'); conf('dell'); run('interface ethernet1/1/2'); const t = run('ip address 10.9.9.1/24');
  ok(/^% Lab note:/m.test(t), t); ok(!net.devices.sw1.ifaces['Gi0/2'].ip, 'address stored');
});
test('after no switchport, and on a VLAN interface, an address is still accepted', () => {
  for (const vendor of ['cisco', 'dell']) {
    const { net } = lab(13, vendor); on('l3a'); conf(vendor); run(vendor === 'cisco' ? 'interface Gi0/1' : 'interface ethernet1/1/1'); run('no switchport');
    run(vendor === 'cisco' ? 'ip address 10.9.9.1 255.255.255.0' : 'ip address 10.9.9.1/24'); eq(net.devices.l3a.ifaces['Gi0/1'].ip, '10.9.9.1', vendor + ' routed port');
    run('exit'); run('interface vlan 10'); run(vendor === 'cisco' ? 'ip address 10.1.1.2 255.255.255.0' : 'ip address 10.1.1.2/24'); eq(net.devices.l3a.ifaces.Vlan10.ip, '10.1.1.2', vendor + ' SVI');
  }
});

console.log('DR-06 a routed port reports as routed in every command');
for (const [id, dev] of [[13, 'l3a'], [13, 'l3b'], [14, 'l3sw']]) test('lab ' + id + ' ' + dev, () => {
  lab(id, 'cisco'); on(dev); priv('cisco');
  ok(/^ no switchport$/m.test(run('show running-config interface Gi0/8')), 'no switchport missing');
  const sp = run('show interfaces Gi0/8 switchport'); ok(!/Switchport: Enabled/.test(sp) && /(Switchport: Disabled|is not a switchport)/.test(sp), sp);
  ok(/^Gi0\/8\s.*\brouted\b/m.test(run('show interfaces status')), 'status column');
});

console.log('DR-07 show spanning-tree summary has the summary layout');
test('mode, root list, path cost method and the count table', () => {
  lab(1, 'cisco'); on('sw1'); priv('cisco'); const t = run('show spanning-tree summary');
  ok(/^Switch is in pvst mode$/m.test(t) && /^Root bridge for: VLAN0010$/m.test(t) && /Configured Pathcost method used is short/.test(t), t);
  ok(/^VLAN0010\s+0\s+0\s+0\s+1\s+1$/m.test(t) && /^1 vlan\s+0\s+0\s+0\s+1\s+1$/m.test(t) && !/Prio\.Nbr/.test(t), t);
});

console.log('DR-08 show vtp status counts the VLANs show vlan brief lists');
for (const id of [1, 5, 9]) test('lab ' + id, () => {
  const { net } = lab(id, 'cisco'); for (const d of switches(net)) {
    on(d.id); priv('cisco'); const rows = run('show vlan brief').split('\n').filter((l) => /^\d+\s/.test(l)).length, n = +(/Number of existing VLANs\s*:\s*(\d+)/.exec(run('show vtp status')) || [])[1];
    eq(n, rows, d.name);
  }
});

console.log('DR-09 an unconnected port shows auto speed and duplex');
test('the shut port shows auto auto, the connected port still shows what it negotiated', () => {
  lab(1, 'cisco'); on('sw1'); priv('cisco'); const t = run('show interfaces status');
  ok(/^Gi0\/1\s+disabled\s+10\s+auto\s+auto\s/m.test(t), t); ok(/^Gi0\/2\s+connected\s+10\s+a-full\s+a-1000\s/m.test(t), t);
});
test('lab 7 keeps its negotiated half duplex evidence on the flapping port', () => {
  lab(7, 'cisco'); on('sw1'); priv('cisco'); const t = run('show interfaces status'); ok(/^Gi0\/1\s+flapping\s+10\s+a-half\s+a-100\s/m.test(t), t);
});
test('a speed set by hand on an unconnected port is shown without the a- prefix', () => {
  const { net } = lab(1, 'cisco'); on('sw1'); conf('cisco'); run('interface Gi0/1'); run('speed 100'); run('end');
  ok(/^Gi0\/1\s+disabled\s+10\s+auto\s+100\s/m.test(run('show interfaces status')), run('show interfaces status')); eq(net.devices.sw1.ifaces['Gi0/1'].speed, '100');
});

console.log('DR-10 ip routing can be turned off and on');
test('lab 9: repair, then no ip routing stops inter-VLAN routing and ip routing brings it back', () => {
  const { L, net } = lab(9, 'cisco'); on('l3sw'); conf('cisco'); ['interface vlan 20', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown', 'exit'].forEach(run);
  ok(L.check(net), 'the hint repair should complete lab 9');
  ok(!/Invalid input/.test(run('no ip routing')), 'no ip routing refused'); ok(!L.check(net) && !T.canPing(net, 'pc-a', '192.168.20.20'), 'still routing');
  ok(T.canPing(net, 'pc-a', '192.168.10.1'), 'the local gateway must still answer');
  run('end'); ok(!/^ip routing$/m.test(run('show running-config')), 'ip routing still in the config');
  run('configure terminal'); run('ip routing'); ok(L.check(net), 'ip routing did not restore it'); run('end'); ok(/^ip routing$/m.test(run('show running-config')), 'ip routing missing');
});

console.log('End-to-end: the routed-port labs are solved by their own hints, on both vendors');
for (const [vendor, r13, r14] of [['cisco', 'ip route 10.1.3.0 255.255.255.0 10.1.2.2', 'ip route 0.0.0.0 0.0.0.0 10.2.9.1'], ['dell', 'ip route 10.1.3.0/24 10.1.2.2', 'ip route 0.0.0.0/0 10.2.9.1']]) {
  test('lab 13 and lab 14, ' + vendor, () => {
    let { L, net } = lab(13, vendor); ok(!L.check(net), 'lab 13 starts solved'); on('l3a'); conf(vendor); run(r13); ok(L.check(net), 'lab 13 hint did not solve it');
    ({ L, net } = lab(14, vendor)); ok(!L.check(net), 'lab 14 starts solved'); on('l3sw'); conf(vendor); run(r14); ok(L.check(net), 'lab 14 hint did not solve it');
  });
}
test('vendor switch: the routed port is ethernet1/1/8 on Dell and Gi0/8 on Cisco', () => {
  lab(13, 'dell'); on('l3a'); ok(/Ethernet 1\/1\/8\s+10\.1\.2\.1/.test(run('show ip interface brief')), run('show ip interface brief'));
  lab(13, 'cisco'); on('l3a'); priv('cisco'); ok(/GigabitEthernet0\/8\s+10\.1\.2\.1/.test(run('show ip interface brief')), run('show ip interface brief'));
});
done();
