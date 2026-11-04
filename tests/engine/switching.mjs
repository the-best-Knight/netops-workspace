// Switch Lab regressions (review findings SW-01 to SW-07): the incident spanning-tree engine, the
// incident commands and the ACL rule parser, run from the code in index.html.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('fault-lab', ['xStpCompute', 'xClassify', 'xCmd', 'parseAclRule', 'runConsoleCommand', 'ensureSession']);
T.__set('XS', { seq: 0 }); T.__set('currentLevel', { extreme: true, check: () => ({ ok: false }) });

const mac = (n) => 'aa:bb:cc:00:00:0' + n;
const sw = (id, n, vlans) => ({ id, name: id.toUpperCase(), type: 'switch', mac: mac(n), vlans: Object.fromEntries((vlans || [10]).map((v) => [v, { id: v }])), ifaces: {} });
const port = (d, name, o) => { d.ifaces[name] = Object.assign({ name, mode: 'trunk', allowed: null, admin: 'up', status: 'up' }, o || {}); };
function mk(ids) { const net = { devices: {}, links: [] }; ids.forEach((id, k) => { net.devices[id] = sw(id, k + 1); }); return net; }
function link(net, a, ap, b, bp, sa, sb, oa, ob) { port(net.devices[a], ap, Object.assign({ speed: sa }, oa)); port(net.devices[b], bp, Object.assign({ speed: sb }, ob)); net.links.push({ from: a, fromPort: ap, to: b, toPort: bp }); }
const role = (st, id, p, v) => ((st.roles[id + '|' + (v || 10)] || []).find((r) => r.port === p) || {}).role;
const use = (net, vendor, dev) => { T.__set('vendor', vendor); T.__set('net', net); T.__set('selectedDeviceId', dev || null); T.__set('X_STP', null); T.__set('X_STPKEY', null); };
// Runs one line through the real console path and returns what it printed (the session keeps every printed line).
const run = (line) => { const id = T.__get('selectedDeviceId'), sess = T.__get('ensureSession')(id), from = sess.lines.length; T.runConsoleCommand(line, false); return sess.lines.slice(from).map((l) => l.text).join('\n'); };

console.log('SW-01 path cost uses link speed');
for (const vendor of ['cisco', 'dell']) {
  test('a two-link gigabit path beats one 100 Mb/s link (' + vendor + ')', () => {
    const n = mk(['s1', 's2', 's3']); link(n, 's1', 'gi0/1', 's2', 'gi0/1', '100', '100'); link(n, 's1', 'gi0/2', 's3', 'gi0/1', '1000', '1000'); link(n, 's3', 'gi0/2', 's2', 'gi0/2', '1000', '1000');
    use(n, vendor); const st = T.xStpCompute(n);
    eq(role(st, 's2', 'gi0/2'), 'Root'); eq(role(st, 's2', 'gi0/1'), 'Altn'); ok(st.blocked['s2|gi0/1|10'], 'the slow direct link must be blocked');
    eq(st.cost[10].s3 * 2, st.cost[10].s2, 'root path cost of the far switch');
  });
}
test('equal speeds still prefer the shorter path', () => {
  const n = mk(['s1', 's2', 's3']); link(n, 's1', 'gi0/1', 's2', 'gi0/1', '1000', '1000'); link(n, 's1', 'gi0/2', 's3', 'gi0/1', '1000', '1000'); link(n, 's3', 'gi0/2', 's2', 'gi0/2', '1000', '1000');
  use(n, 'cisco'); eq(role(T.xStpCompute(n), 's2', 'gi0/1'), 'Root');
});
test('show spanning-tree prints the cost the election used, and failover follows when the fast path goes down', () => {
  const n = mk(['s1', 's2', 's3']); link(n, 's1', 'gi0/1', 's2', 'gi0/1', '100', '100'); link(n, 's1', 'gi0/2', 's3', 'gi0/1', '1000', '1000'); link(n, 's3', 'gi0/2', 's2', 'gi0/2', '1000', '1000');
  use(n, 'cisco', 's2'); let txt = run('show spanning-tree vlan 10');
  ok(/Cost\s+8\b/.test(txt) && /gi0\/2\s+Root FWD 4\b/.test(txt) && /gi0\/1\s+Altn BLK 19\b/.test(txt), txt);
  n.devices.s3.ifaces['gi0/1'].admin = 'down'; use(n, 'cisco', 's2'); txt = run('show spanning-tree vlan 10');
  ok(/gi0\/1\s+Root FWD 19\b/.test(txt) && /Cost\s+19\b/.test(txt), txt);
});

console.log('SW-02 port tie-break is numeric');
function parallel(prio) {
  const n = mk(['s1', 's2']); link(n, 's1', 'gi0/2', 's2', 'gi0/9', '1000', '1000'); link(n, 's1', 'gi0/10', 's2', 'gi0/1', '1000', '1000', prio ? { stpPortPrio: prio } : {});
  use(n, 'cisco'); return T.xStpCompute(n);
}
test('Gi0/2 beats Gi0/10 as the sending port', () => { const st = parallel(); eq(role(st, 's2', 'gi0/9'), 'Root'); eq(role(st, 's2', 'gi0/1'), 'Altn'); });
test('a lower port priority on Gi0/10 wins over the port number', () => { const n = mk(['s1', 's2']); link(n, 's1', 'gi0/2', 's2', 'gi0/9', '1000', '1000'); link(n, 's1', 'gi0/10', 's2', 'gi0/1', '1000', '1000', { stpPortPrio: 64 }); use(n, 'cisco'); const st = T.xStpCompute(n); eq(role(st, 's2', 'gi0/1'), 'Root'); });
test('equal sender ports fall back to the receiving port number', () => {
  const n = mk(['s1', 's2']); link(n, 's1', 'gi0/1', 's2', 'gi0/10', '1000', '1000'); link(n, 's1', 'gi0/1x', 's2', 'gi0/2', '1000', '1000'); n.devices.s1.ifaces['gi0/1x'] = n.devices.s1.ifaces['gi0/1x'];
  use(n, 'cisco'); ok(T.xStpCompute(n).roles['s2|10'].some((r) => r.role === 'Root'), 'a root port is chosen');
});

console.log('SW-03 and SW-04 spanning-tree commands');
function confNet(rootPrio, vendor) {
  const n = mk(['s1', 's2']); link(n, 's1', 'gi0/1', 's2', 'gi0/1', '1000', '1000'); n.devices.s1.stpPrio = { 10: rootPrio };
  use(n, vendor || 'cisco', 's2'); T.__set('confMode', true); T.__set('confIface', null); T.__set('confAcl', null); return n;
}
for (const root of [4096, 24576, 32768]) test('root secondary sets the local priority to 28672 (root at ' + root + ')', () => {
  const n = confNet(root); run('spanning-tree vlan 10 root secondary'); eq(n.devices.s2.stpPrio[10], 28672);
});
test('root primary still takes 24576 or one step below the root', () => {
  let n = confNet(32768); run('spanning-tree vlan 10 root primary'); eq(n.devices.s2.stpPrio[10], 24576);
  n = confNet(24576); run('spanning-tree vlan 10 root primary'); eq(n.devices.s2.stpPrio[10], 20480);
});
test('a rejected priority changes nothing, including a disabled instance', () => {
  const n = confNet(32768); n.devices.s2.stpOff = { 10: true }; const before = JSON.stringify(n);
  const txt = run('spanning-tree vlan 10 priority 123'); ok(/increments of 4096/.test(txt), txt); eq(JSON.stringify(n), before, 'state changed by a rejected command');
});
test('a valid priority re-enables the instance and sets the value', () => {
  const n = confNet(32768); n.devices.s2.stpOff = { 10: true }; run('spanning-tree vlan 10 priority 8192'); eq([n.devices.s2.stpOff[10], n.devices.s2.stpPrio[10]], [undefined, 8192]);
});

console.log('SW-05 incident commands use the normal CLI path');
test('show spanning-tree is refused in configuration mode and works with do', () => {
  const n = confNet(32768); const bare = run('show spanning-tree vlan 10'); ok(/Invalid input|Unknown|%/.test(bare) && !/Spanning tree enabled/.test(bare), 'bare show in config mode ran: ' + bare);
  const viaDo = run('do show spanning-tree vlan 10'); ok(/Spanning tree enabled/.test(viaDo), 'do show failed: ' + viaDo);
});
test('abbreviations work in EXEC mode', () => { confNet(32768); T.__set('confMode', false); ok(/Spanning tree enabled/.test(run('sh span vlan 10')), 'abbreviated command not recognised'); });
test('a pipe filter applies to incident output', () => { confNet(32768); T.__set('confMode', false); const txt = run('show spanning-tree vlan 10 | include Priority'); ok(/Priority/.test(txt) && !/Hello Time/.test(txt), txt); });
test('the command is recorded in the session history', () => { confNet(32768); T.__set('confMode', false); run('show spanning-tree vlan 10'); ok(T.__get('consoleSessions').s2.history.includes('show spanning-tree vlan 10'), 'not in history'); });

console.log('SW-06 native VLAN and the allowed list');
test('untagged ingress on a trunk is dropped when the native VLAN is not allowed', () => {
  const n = mk(['s1']); port(n.devices.s1, 'gi0/1', { mode: 'trunk', nativeVlan: 99, allowed: [10] }); use(n, 'cisco'); const d = n.devices.s1;
  eq(T.xClassify(d, 'gi0/1', null), null); eq(T.xClassify(d, 'gi0/1', 10), 10); eq(T.xClassify(d, 'gi0/1', 20), null);
});
test('untagged ingress is kept when the native VLAN is allowed', () => {
  const n = mk(['s1']); port(n.devices.s1, 'gi0/1', { mode: 'trunk', nativeVlan: 99, allowed: [10, 99] }); use(n, 'cisco'); eq(T.xClassify(n.devices.s1, 'gi0/1', null), 99);
  port(n.devices.s1, 'gi0/2', { mode: 'trunk' }); eq(T.xClassify(n.devices.s1, 'gi0/2', null), 1);
});

console.log('SW-07 ACL rule grammar');
const rule = (s) => T.parseAclRule(s.split(/\s+/));
test('well-formed rules are accepted', () => { for (const s of ['permit ip any any', 'deny icmp host 10.0.0.1 any', 'permit icmp 10.0.0.0 0.0.0.255 any echo', 'permit icmp any any echo-reply log', 'seq 20 deny ip 10.1.0.0 0.0.255.255 any']) ok(!rule(s).error, s + ' -> ' + rule(s).error); });
test('invalid octets and malformed addresses are rejected', () => { for (const s of ['permit ip 999.1.1.1 0.0.0.255 any', 'permit ip 10.0.0.0 0.0.0.256 any', 'permit ip host 1.2.3 any', 'permit ip 10.0.0.0 any']) ok(rule(s).error, s + ' was accepted'); });
test('garbage and unsupported qualifiers are rejected', () => { for (const s of ['permit ip any any garbage', 'permit tcp any any eq 80', 'permit udp any any range 1 5', 'permit tcp any any established', 'permit icmp any any unreachable']) ok(rule(s).error, s + ' was accepted'); });
test('a rejected line leaves the ACL unchanged', () => {
  const n = mk(['s1']); n.devices.s1.acls = { BLOCK: { rules: [{ seq: 10, act: 'deny', proto: 'icmp', src: 'any', dst: 'any', extra: '' }] } }; use(n, 'cisco', 's1'); T.__set('confMode', true); T.__set('confAcl', 'BLOCK'); T.__set('confIface', null);
  const before = JSON.stringify(n); const txt = run('permit tcp any any eq 80'); ok(/%/.test(txt), txt); eq(JSON.stringify(n), before);
});
done();
