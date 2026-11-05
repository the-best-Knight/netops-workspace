// Switch Lab PC diagnostics: ipconfig, ipconfig /all, route print and tracert on a simulated PC, read-only, in guided and Extreme labs.
// Expected values are written out by hand from each lab's own addressing, not read back from the code under test.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('fault-lab', ['LEVELS', 'XL', 'runConsoleCommand', 'ensureSession', 'xCmd']);
T.__set('XS', null);
function lab(id, vendor) {
  const L = T.LEVELS.find((l) => l.id === id), net = L.build();
  T.__set('vendor', vendor || 'cisco'); T.__set('net', net); T.__set('currentLevel', L);
  for (const k of Object.keys(T.__get('consoleSessions'))) delete T.__get('consoleSessions')[k];
  T.__set('startupCfg', {}); T.__set('coachInit', JSON.stringify(net.devices)); T.__set('confMode', false); T.__set('confIface', null); T.__set('confAcl', null);
  return net;
}
const on = (dev) => { T.__set('selectedDeviceId', dev); T.__set('confMode', false); };
function run(line) { const s = T.ensureSession(T.__get('selectedDeviceId')), from = s.lines.length; T.runConsoleCommand(line, false); return s.lines.slice(from).map((l) => l.text).join('\n'); }
const field = (out, label) => ((new RegExp(label + '[ .]*: *(.*)').exec(out)) || [])[1];

console.log('ipconfig');
test('PC-A and PC-B show their own addresses, not shared values', () => {
  const net = lab(6); const a = net.devices['pc-a'].ifaces.eth0, b = net.devices['pc-b'].ifaces.eth0;
  on('pc-a'); const oa = run('ipconfig'); on('pc-b'); const ob = run('ipconfig');
  eq(field(oa, 'IPv4 Address'), a.ip); eq(field(ob, 'IPv4 Address'), b.ip); ok(a.ip !== b.ip, 'the lab gives the PCs different addresses');
  eq(field(oa, 'Default Gateway'), '192.168.10.1'); eq(field(ob, 'Default Gateway'), '192.168.20.1'); // lab 6 text: PC-A is in VLAN 10, PC-B in VLAN 20
  eq(field(oa, 'Subnet Mask'), a.mask); ok(/^Ethernet adapter Ethernet0:/m.test(oa), oa); ok(/^Windows IP Configuration/m.test(oa));
  eq(field(oa, 'Default Gateway'), a.gw || '');
});
test('ipconfig /all adds host name, MAC, DHCP and DNS', () => {
  const net = lab(6); on('pc-a'); const o = run('ipconfig /all'), d = net.devices['pc-a'];
  eq(field(o, 'Host Name'), 'PC-A'); ok(/^[0-9A-F]{2}(-[0-9A-F]{2}){5}$/.test(field(o, 'Physical Address')), o); eq(field(o, 'DHCP Enabled'), 'No');
  ok(field(o, 'IPv4 Address').startsWith(d.ifaces.eth0.ip + '(Preferred)'));
  on('pc-b'); ok(field(run('ipconfig /all'), 'Physical Address') !== field(o, 'Physical Address'), 'each PC has its own MAC');
  on('pc-a'); const body = (t) => t.split('\n').slice(1).join('\n'); eq(body(run('ipconfig/all')), body(run('ipconfig /all')), 'ipconfig/all (no space) is the same command');
});
test('ipconfig with a bad argument explains the syntax and changes nothing', () => {
  const net = lab(6); on('pc-a'); const before = JSON.stringify(net.devices['pc-a']);
  ok(/syntax of this command is: ipconfig \[\/all\]/.test(run('ipconfig /nonsense')), 'bad flag'); ok(/syntax/.test(run('ipconfig /all extra')), 'extra argument');
  eq(JSON.stringify(net.devices['pc-a']), before);
});

console.log('route print');
test('route print agrees with the PC address, mask and gateway', () => {
  const net = lab(6); const i = net.devices['pc-a'].ifaces.eth0; on('pc-a'); const o = run('route print');
  ok(/IPv4 Route Table/.test(o) && /Persistent Routes:\s*\n\s*None/.test(o), o);
  if (i.gw) ok(new RegExp('0\\.0\\.0\\.0\\s+0\\.0\\.0\\.0\\s+' + i.gw.replace(/\./g, '\\.') + '\\s+' + i.ip.replace(/\./g, '\\.') + '\\s+25').test(o), 'default route'); else ok(!/0\.0\.0\.0\s+0\.0\.0\.0\s+\d/.test(o), 'no default route without a gateway');
  ok(new RegExp('192\\.168\\.10\\.0\\s+' + i.mask.replace(/\./g, '\\.') + '\\s+On-link\\s+' + i.ip.replace(/\./g, '\\.')).test(o), 'connected network'); ok(/192\.168\.10\.255\s+255\.255\.255\.255\s+On-link/.test(o), 'broadcast');
});
test('a bad route command is refused and route add is read-only', () => {
  lab(6); on('pc-a'); ok(/syntax of this command is: route print/.test(run('route')), 'no argument'); ok(/read-only in this lab/.test(run('route add 10.0.0.0 mask 255.0.0.0 192.168.10.1')), 'add');
});

console.log('tracert');
test('tracert follows the gateway to a reachable server in the working lab', () => {
  const net = lab(3); on('pc-a'); const tgt = Object.values(net.devices).find((d) => d.type === 'server');
  const ip = tgt ? Object.values(tgt.ifaces)[0].ip : null; ok(ip, 'lab 3 has a server');
  const o = run('tracert ' + ip); ok(/Tracing route to .* over a maximum of 30 hops/.test(o), o); ok(/Trace complete\./.test(o)); ok(o.includes(ip), 'the destination is the last hop');
});
test('tracert to an unknown address is not made to succeed', () => {
  lab(3); on('pc-a'); const o = run('tracert 203.0.113.99'); ok(!/ 203\.0\.113\.99\s*$/m.test(o.split('\n').filter((l) => /^\s+\d+ /.test(l)).join('\n')), 'no invented hop'); ok(/Request timed out|unreachable/.test(o), o);
});
test('tracert with no target or an unresolvable name gives a Windows message', () => {
  lab(6); on('pc-a'); ok(/Usage: tracert/.test(run('tracert')), 'usage'); ok(/Unable to resolve target system name nohost\.example\./.test(run('tracert nohost.example')), 'name');
});

console.log('read-only');
test('every way of changing a PC is refused, and the PC is unchanged', () => {
  const net = lab(6); on('pc-a'); const before = JSON.stringify(net.devices);
  for (const c of ['netsh interface ip set address "Ethernet0" static 10.1.1.5 255.255.255.0 10.1.1.1', 'New-NetIPAddress -InterfaceAlias Ethernet0 -IPAddress 10.1.1.5 -PrefixLength 24', 'Set-DnsClientServerAddress -InterfaceAlias Ethernet0 -ServerAddresses 1.1.1.1', 'ipconfig /release', 'ipconfig /renew', 'ipconfig/renew', 'route delete 0.0.0.0'])
    ok(/read-only in this lab/.test(run(c)), c);
  eq(JSON.stringify(net.devices), before);
});
test('switches keep working: the PC commands are not available there', () => {
  lab(6); on('sw1'); ok(!/Windows IP Configuration/.test(run('ipconfig')), 'a switch is not a Windows host');
});

console.log('fault-induced changes and reset');
test('a shut-down switch port makes the PC report Media disconnected, and reset restores it', () => {
  const net = lab(6); on('pc-a'); const pa = net.links.find((l) => l.from === 'pc-a' || l.to === 'pc-a'); ok(pa, 'pc-a is cabled');
  const swId = pa.from === 'pc-a' ? pa.to : pa.from, port = pa.from === 'pc-a' ? pa.toPort : pa.fromPort; net.devices[swId].ifaces[port].admin = 'down';
  ok(/Media disconnected/.test(run('ipconfig')), 'down'); ok(!/IPv4 Address/.test(run('ipconfig')));
  net.devices[swId].ifaces[port].admin = 'up'; ok(/IPv4 Address/.test(run('ipconfig')), 'back up');
});
test('the commands work after a vendor switch and a fresh lab build', () => {
  for (const v of ['cisco', 'dell']) { lab(2, v); on('pc-a'); ok(/IPv4 Address/.test(run('ipconfig')), v); ok(/IPv4 Route Table/.test(run('route print')), v); }
});
console.log('Extreme Mode');
function xlab(L, vendor) {
  const net = L.build(); T.__set('vendor', vendor || 'cisco'); T.__set('net', net); T.__set('XS', { seq: 0 }); T.__set('currentLevel', { extreme: true, extremeId: L.id, check: () => ({ ok: false }) });
  for (const k of Object.keys(T.__get('consoleSessions'))) delete T.__get('consoleSessions')[k];
  T.__set('startupCfg', {}); T.__set('confMode', false); T.__set('confIface', null); T.__set('confAcl', null);
  return net;
}
const pcs = (net) => Object.values(net.devices).filter((d) => d.type === 'pc');
test('in every Extreme incident each PC reports its own addressing and routes', () => {
  ok(T.XL.length >= 5, 'the Extreme list loaded');
  for (const L of T.XL) {
    const net = xlab(L); ok(pcs(net).length > 0, L.title + ' has a PC');
    for (const pc of pcs(net)) {
      on(pc.id); const i = pc.ifaces.eth0, o = run('ipconfig'), r = run('route print');
      eq(field(o, 'IPv4 Address'), i.ip, L.title + ' ' + pc.name); eq(field(o, 'Default Gateway'), i.gw, L.title + ' ' + pc.name + ' gateway');
      ok(new RegExp('0\\.0\\.0\\.0\\s+0\\.0\\.0\\.0\\s+' + i.gw.replace(/\./g, '\\.') + '\\s+' + i.ip.replace(/\./g, '\\.')).test(r), L.title + ' ' + pc.name + ' default route');
    }
  }
});
test('Extreme Mode tracert shows addresses only, never device names or a topology', () => {
  for (const L of T.XL) {
    const net = xlab(L), pc = pcs(net)[0]; on(pc.id); const gw = pc.ifaces.eth0.gw, o = run('tracert ' + gw);
    ok(/Tracing route to/.test(o) && /Trace complete\./.test(o), L.title); ok(new RegExp('\\s' + gw.replace(/\./g, '\\.') + '\\s*$', 'm').test(o), L.title + ': the gateway answers as hop 1');
    for (const d of Object.values(net.devices)) ok(!new RegExp('\\b' + d.name.replace(/[-.]/g, '\\$&') + '\\b', 'i').test(o.split('\n').slice(1).join('\n').replace(/Tracing route to.*/, '')), L.title + ': tracert named ' + d.name);
  }
});
test('Extreme Mode: an unreachable destination times out, and PC changes are refused', () => {
  const L = T.XL[0], net = xlab(L), pc = pcs(net)[0]; on(pc.id); const before = JSON.stringify(net.devices);
  const o = run('tracert 203.0.113.77'); ok(/Request timed out|unreachable/.test(o), o); ok(!/203\.0\.113\.77\s*$/m.test(o.split('\n').filter((l) => /^\s+\d+ /.test(l)).join('\n')), 'no invented arrival');
  ok(/read-only in this lab/.test(run('netsh interface ip set address Ethernet0 static 1.1.1.1 255.255.255.0 1.1.1.2')), 'netsh'); eq(JSON.stringify(net.devices), before);
});
test('Extreme Mode keeps the switch console distinct and the topology hidden', () => {
  const L = T.XL[0], net = xlab(L), sw = Object.values(net.devices).find((d) => d.type === 'switch' || d.type === 'l3switch'); on(sw.id);
  ok(!/Windows IP Configuration/.test(run('ipconfig')), 'a switch does not answer ipconfig'); ok(/Unknown command|Invalid|Incomplete|% /.test(run('ipconfig')), 'it is refused like any unknown switch command');
});

done();
