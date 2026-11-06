// Switch Lab PC diagnostics: ipconfig, ipconfig /all, route print and tracert on a simulated PC, read-only, in guided and Extreme labs.
// Expected values are written out by hand from each lab's own addressing, not read back from the code under test.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('fault-lab', ['LEVELS', 'XL', 'runConsoleCommand', 'ensureSession', 'xCmd', 'xPing', 'consolePromptPrefix', 'canPing']);
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
  const o = run('tracert ' + ip); ok(/Tracing route to .* over a maximum of 30 hops/.test(o), o); ok(/Trace complete\./.test(o)); const last = o.split('\n').filter((l) => /^\s+\d+ /.test(l)).pop() || ''; ok(last.endsWith(ip) || /Request timed out|unreachable/.test(last), 'the last line is the destination, or a timeout, never an invented arrival: ' + last);
});
test('tracert to an unknown address is not made to succeed', () => {
  lab(3); on('pc-a'); const o = run('tracert 203.0.113.99'); ok(!/ 203\.0\.113\.99\s*$/m.test(o.split('\n').filter((l) => /^\s+\d+ /.test(l)).join('\n')), 'no invented hop'); ok(/Request timed out|unreachable/.test(o), o);
});
test('tracert with no target or an unresolvable name gives a Windows message', () => {
  lab(6); on('pc-a'); ok(/Usage: tracert/.test(run('tracert')), 'usage'); ok(/Unable to resolve target system name nohost\.example\./.test(run('tracert nohost.example')), 'name');
});

console.log('ping');
const pingStats = (o) => { const m = /Sent = (\d+), Received = (\d+), Lost = (\d+) \((\d+)% loss\)/.exec(o); return m ? m.slice(1).map(Number) : null; };
test('ping to the PC gateway: Windows header, four replies with a router TTL, and statistics', () => {
  const net = lab(6); on('pc-a'); const gw = net.devices['pc-a'].ifaces.eth0.gw, o = run('ping ' + gw);
  ok(new RegExp('^Pinging ' + gw.replace(/\./g, '\\.') + ' with 32 bytes of data:$', 'm').test(o), o);
  eq((o.match(new RegExp('^Reply from ' + gw.replace(/\./g, '\\.') + ': bytes=32 time<1ms TTL=255$', 'gm')) || []).length, 4, 'four replies from the Cisco gateway, TTL 255');
  eq(JSON.stringify(pingStats(o)), JSON.stringify([4, 4, 0, 0])); ok(/Minimum = 0ms, Maximum = 0ms, Average = 0ms/.test(o), o); ok(!/icmp_seq|bytes of data\.$|Success rate/m.test(o), 'no Linux or Cisco ping text');
});
test('ping -n and -l change the count and size; a Dell gateway answers with TTL 64', () => {
  const net = lab(6, 'dell'); on('pc-a'); const gw = net.devices['pc-a'].ifaces.eth0.gw, o = run('ping -n 2 -l 100 ' + gw);
  eq((o.match(/^Reply from .*bytes=100 time<1ms TTL=64$/gm) || []).length, 2, o); eq(JSON.stringify(pingStats(o)), JSON.stringify([2, 2, 0, 0]));
});
test('ping across the router to the other PC: time=1ms and the TTL drops by one per router', () => {
  const net = lab(6); on('pc-a'); const ip = net.devices['pc-b'].ifaces.eth0.ip, o = run('ping ' + ip); // lab 6 routes PC-A to PC-B through SW1
  const hops = run('tracert ' + ip).split('\n').filter((l) => /^\s+\d+ /.test(l)); ok(new RegExp(ip.replace(/\./g, '\\.') + '$').test(hops[hops.length - 1]), 'tracert arrives');
  eq((o.match(new RegExp('^Reply from ' + ip.replace(/\./g, '\\.') + ': bytes=32 time=1ms TTL=' + (128 - (hops.length - 1)) + '$', 'gm')) || []).length, 4, o);
});
test('an address in the PC subnet that nobody owns: Destination host unreachable from the PC itself, counted as received', () => {
  const net = lab(6); on('pc-a'); const me = net.devices['pc-a'].ifaces.eth0.ip, o = run('ping 192.168.10.250');
  eq((o.match(new RegExp('^Reply from ' + me.replace(/\./g, '\\.') + ': Destination host unreachable\.$', 'gm')) || []).length, 4, o);
  eq(JSON.stringify(pingStats(o)), JSON.stringify([4, 4, 0, 0]), 'Windows counts these as received'); ok(!/Approximate round trip/.test(o), 'no round-trip times without echo replies');
});
test('an address the gateway has no route to: a Cisco gateway answers Destination net unreachable, counted as received; Dell times out', () => {
  // lab 3: the gateway SW1 has no route at all to 203.0.113.0/24. IOS answers with ICMP net unreachable (ip unreachables is on
  // by default); the OS10 default is not confirmed, so the Dell lab stays silent.
  lab(3); on('pc-a'); let o = run('ping 203.0.113.99');
  eq((o.match(/^Reply from 192\.168\.10\.1: Destination net unreachable\.$/gm) || []).length, 4, o); eq(JSON.stringify(pingStats(o)), JSON.stringify([4, 4, 0, 0])); ok(!/Approximate round trip/.test(o), 'no times without echo replies');
  lab(3, 'dell'); on('pc-a'); o = run('ping 203.0.113.99');
  eq((o.match(/^Request timed out\.$/gm) || []).length, 4, o); eq(JSON.stringify(pingStats(o)), JSON.stringify([4, 0, 4, 100])); ok(!/unreachable/.test(o), o);
});
test('a shut-down switch port: PING: transmit failed. General failure.', () => {
  const net = lab(6); on('pc-a'); const pa = net.links.find((l) => l.from === 'pc-a' || l.to === 'pc-a'), sw = pa.from === 'pc-a' ? pa.to : pa.from, port = pa.from === 'pc-a' ? pa.toPort : pa.fromPort;
  net.devices[sw].ifaces[port].admin = 'down'; const o = run('ping ' + net.devices['pc-a'].ifaces.eth0.gw);
  eq((o.match(/^PING: transmit failed\. General failure\.$/gm) || []).length, 4, o); eq(JSON.stringify(pingStats(o)), JSON.stringify([4, 0, 4, 100]));
});
test('a gateway that does not answer: Destination host unreachable from the PC', () => {
  const net = lab(6); on('pc-a'); const i = net.devices['pc-a'].ifaces.eth0, g = Object.values(net.devices).find((d) => Object.values(d.ifaces || {}).some((x) => x.ip === i.gw));
  const gi = Object.values(g.ifaces).find((x) => x.ip === i.gw); gi.admin = 'down'; const o = run('ping 192.168.20.10');
  ok(new RegExp('^Reply from ' + i.ip.replace(/\./g, '\\.') + ': Destination host unreachable\.$', 'm').test(o) || /General failure|Request timed out/.test(o), o); ok(!/^Reply from 192\.168\.20\.10/m.test(o), 'no reply invented');
});
test('ping options and errors read like Windows and change nothing', () => {
  const net = lab(6); on('pc-a'); const before = JSON.stringify(net.devices);
  ok(/Usage: ping/.test(run('ping')), 'no target'); ok(/ping -t .* not available/.test(run('ping -t 192.168.10.1')), '-t'); ok(/Bad option -z\./.test(run('ping -z 192.168.10.1')), 'bad option');
  ok(/Value must be supplied for option -n\./.test(run('ping -n 192.168.10.1')), '-n without a number'); ok(/Bad parameter repeat\./.test(run('ping 192.168.10.1 repeat 5')), 'Cisco syntax');
  ok(/Ping request could not find host nohost\.example\. Please check the name and try again\./.test(run('ping nohost.example')), 'unknown name'); eq(JSON.stringify(net.devices), before);
});
test('ping by name: lab 8 fails to resolve until the DNS server port is fixed, then resolves first', () => {
  const net = lab(8); on('pc-a'); ok(/could not find host app\.lab\.local/.test(run('ping app.lab.local')), 'the broken lab cannot resolve');
  // apply the lab's own fix: the DNS server's switch port back into the server VLAN, like the app server's port
  const port = (dev) => { const l = net.links.find((x) => x.from === dev || x.to === dev); return l.from === dev ? net.devices[l.to].ifaces[l.toPort] : net.devices[l.from].ifaces[l.fromPort]; };
  const dns = Object.values(net.devices).find((d) => d.records), good = port('srv1'), bad = port(dns.id); for (const k of ['vlan', 'accessVlan', 'mode']) if (k in good) bad[k] = good[k];
  const ip = dns.records['app.lab.local'], o = run('ping app.lab.local');
  ok(new RegExp('^Pinging app\\.lab\\.local \\[' + ip.replace(/\./g, '\\.') + '\\] with 32 bytes of data:$', 'm').test(o), o);
});
test('tracert by name shows the name and the address, with Windows column widths', () => {
  const net = lab(3); on('pc-a'); const gw = net.devices['pc-a'].ifaces.eth0.gw, o = run('tracert ' + gw);
  ok(new RegExp('^  1    <1 ms    <1 ms    <1 ms  ' + gw.replace(/\./g, '\\.') + '$', 'm').test(o), o);
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
test('Extreme Mode ping agrees with the Extreme packet model for every PC and its gateway', () => {
  for (const L of T.XL) {
    const net = xlab(L);
    for (const pc of pcs(net)) {
      on(pc.id); const gw = pc.ifaces.eth0.gw, o = run('ping ' + gw), want = T.__get('xPing')(net, pc.id, gw).ok;
      ok(/^Pinging /m.test(o) && /Ping statistics for/.test(o), L.title + ': Windows ping text');
      eq(/^Reply from [\d.]+: bytes=32/m.test(o), want, L.title + ' ' + pc.name + ' -> gateway');
    }
  }
});
test('Extreme Mode ping shows addresses only, never device names', () => {
  for (const L of T.XL) {
    const net = xlab(L), pc = pcs(net)[0]; on(pc.id); const o = run('ping ' + pc.ifaces.eth0.gw).split('\n').slice(1).join('\n'); // line 1 is the prompt
    for (const d of Object.values(net.devices)) ok(!new RegExp('\\b' + d.name.replace(/[-.]/g, '\\$&') + '\\b', 'i').test(o), L.title + ': ping named ' + d.name);
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

console.log('Wave 2: Windows terminal and one reachability answer for ping and tracert (W2-xx)');
const prompt = () => T.__get('consolePromptPrefix')();
const hopLines = (o) => o.split('\n').filter((l) => /^\s+\d+ /.test(l));
const ipRe = (ip) => ip.replace(/\./g, '\\.');
test('W2-01 a PC or server shows a Windows prompt; switch prompts are unchanged; Windows echoes no space even in the Dell lab', () => {
  lab(6); on('pc-a'); eq(prompt(), 'C:\\>'); ok(run('ipconfig').split('\n')[0] === 'C:\\>ipconfig', 'echo');
  on('sw1'); ok(/^SW1[>#]$/.test(prompt()), prompt());
  lab(6, 'dell'); on('pc-b'); eq(prompt(), 'C:\\>'); eq(run('ipconfig').split('\n')[0], 'C:\\>ipconfig');
  on('sw1'); ok(/^SW1[>#] ipconfig$/.test(run('ipconfig').split('\n')[0]), 'OS10 keeps its space');
  lab(3); on('srv1'); eq(prompt(), 'C:\\>', 'a server is a Windows host too');
});
test('W2-02 the gateway\'s other interface answers at hop 1 with a router TTL: 255 on Cisco, 64 on Dell (F-05)', () => {
  for (const [v, ttl] of [['cisco', 255], ['dell', 64]]) {
    lab(6, v); on('pc-a'); const o = run('ping 192.168.20.1'), h = hopLines(run('tracert 192.168.20.1'));
    eq((o.match(new RegExp('^Reply from 192\\.168\\.20\\.1: bytes=32 time<1ms TTL=' + ttl + '$', 'gm')) || []).length, 4, v + ' ' + o);
    eq(h.length, 1, v + ' ' + h.join('|')); ok(/192\.168\.20\.1$/.test(h[0]), h[0]);
  }
});
test('W2-03 a gateway that does not answer: ping and tracert both report Destination host unreachable from the PC itself (F-06)', () => {
  const net = lab(6); on('pc-a'); const i = net.devices['pc-a'].ifaces.eth0, svi = Object.values(net.devices).flatMap((d) => Object.values(d.ifaces || {})).find((x) => x.ip === i.gw); svi.admin = 'down';
  const o = run('ping 192.168.20.20'), t = run('tracert 192.168.20.20');
  eq((o.match(new RegExp('^Reply from ' + ipRe(i.ip) + ': Destination host unreachable\\.$', 'gm')) || []).length, 4, o);
  ok(new RegExp('^  1  ' + ipRe(i.ip) + '  reports: Destination host unreachable\\.$', 'm').test(t), t); ok(!/net unreachable/.test(t), 'tracert agrees with ping');
});
test('W2-04 a router with no route answers Destination net unreachable from its own address; ping counts it received, tracert reports it', () => {
  // lab 14, broken: L3-SW (10.2.1.1) has no default route toward R1
  lab(14); on('pc-a'); const o = run('ping 172.16.5.50'), t = run('tracert 172.16.5.50');
  eq((o.match(/^Reply from 10\.2\.1\.1: Destination net unreachable\.$/gm) || []).length, 4, o); eq(JSON.stringify(pingStats(o)), JSON.stringify([4, 4, 0, 0]));
  ok(/^  1  10\.2\.1\.1  reports: Destination net unreachable\.$/m.test(t), t); eq(hopLines(t).length, 1, t);
  lab(14, 'dell'); on('pc-a'); const od = run('ping 172.16.5.50'), td = run('tracert 172.16.5.50');
  eq((od.match(/^Request timed out\.$/gm) || []).length, 4, od); ok(!/unreachable/.test(od + td), 'Dell: silent'); ok(/Request timed out/.test(td), td);
});
test('W2-05 after the lab 14 fix: the server answers with TTL 126 over two routers; an unknown network gets net unreachable from R1 at hop 2; a missing host times out', () => {
  const net = lab(14); net.devices.l3sw.routes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.2.9.1' }]; on('pc-a');
  const o = run('ping 172.16.5.50'), h = hopLines(run('tracert 172.16.5.50'));
  eq((o.match(/^Reply from 172\.16\.5\.50: bytes=32 time=1ms TTL=126$/gm) || []).length, 4, o); eq(h.map((l) => l.trim().split(/\s+/).pop()), ['10.2.1.1', '10.2.9.1', '172.16.5.50']);
  const u = run('ping 203.0.113.99'), ut = run('tracert 203.0.113.99');
  eq((u.match(/^Reply from 10\.2\.9\.1: Destination net unreachable\.$/gm) || []).length, 4, u);
  ok(/^  1 .* 10\.2\.1\.1$/m.test(ut) && /^  2  10\.2\.9\.1  reports: Destination net unreachable\.$/m.test(ut), ut);
  const m = run('ping 172.16.5.99'), mt = run('tracert 172.16.5.99');
  eq(JSON.stringify(pingStats(m)), JSON.stringify([4, 0, 4, 100]), m); eq(hopLines(mt).filter((l) => /Request timed out/.test(l)).length, 3, mt);
  ok(/10\.2\.1\.1$/m.test(mt) && /10\.2\.9\.1$/m.test(mt) && !/172\.16\.5\.99\s*$/m.test(hopLines(mt).join('\n')), 'routers answer, the missing host does not');
});
test('W2-06 traceroute on a Windows host is not a command: a cmd.exe message and a pointer to tracert, guided and Extreme', () => {
  const net = lab(6); on('pc-a'); const before = JSON.stringify(net.devices), o = run('traceroute 192.168.20.20');
  ok(/'traceroute' is not recognized as an internal or external command,\noperable program or batch file\./.test(o), o); ok(/command is tracert/.test(o), o); ok(!/traceroute to |hops max/.test(o), 'no Linux output'); eq(JSON.stringify(net.devices), before);
  const xn = xlab(T.XL[0]), pc = pcs(xn)[0]; on(pc.id); const x = run('traceroute ' + pc.ifaces.eth0.gw);
  ok(/'traceroute' is not recognized/.test(x) && /tracert/.test(x) && !/traceroute to /.test(x), x);
});
test('W2-07 switch commands on a Windows host are not recognized and change nothing; a router still answers show', () => {
  const net = lab(6); on('pc-a'); const before = JSON.stringify(net.devices);
  for (const c of ['show ip interface brief', 'enable', 'configure terminal', 'conf t', 'write memory']) { const o = run(c); ok(new RegExp("'" + c.split(' ')[0] + "' is not recognized").test(o), c + ': ' + o); ok(!/Interface\s+IP-Address/.test(o), c); }
  eq(JSON.stringify(net.devices), before);
  lab(14); on('r1'); ok(/Gi0\/0|GigabitEthernet0\/0|Interface/.test(run('show ip interface brief')), 'R1 is not a Windows host');
});
test('W2-08 a PC with its link down: ping cannot send and tracert says so the Windows way', () => {
  const net = lab(6); on('pc-a'); const pa = net.links.find((l) => l.from === 'pc-a' || l.to === 'pc-a'), sw = pa.from === 'pc-a' ? pa.to : pa.from, port = pa.from === 'pc-a' ? pa.toPort : pa.fromPort;
  net.devices[sw].ifaces[port].admin = 'down';
  ok(/^PING: transmit failed\. General failure\.$/m.test(run('ping 192.168.20.20')), 'ping'); ok(/^Unable to contact IP driver\. General failure\.$/m.test(run('tracert 192.168.20.20')), 'tracert');
});
// the same answer from ping and tracert, for every PC and server, every target, in the given state
function agree(net, label, model) {
  const hosts = Object.values(net.devices).filter((d) => d.type === 'pc' || d.type === 'server'), targets = new Set(['203.0.113.99']);
  Object.values(net.devices).forEach((d) => Object.values(d.ifaces || {}).forEach((i) => i.ip && targets.add(i.ip)));
  let n = 0;
  for (const h of hosts) for (const ip of targets) {
    on(h.id); const p = run('ping ' + ip), t = run('tracert ' + ip), hl = hopLines(t), why = label + ' ' + h.name + ' -> ' + ip + '\n' + p + '\n' + t; n++;
    const echo = new RegExp('^Reply from ' + ipRe(ip) + ': bytes=', 'm').test(p), hostU = /Destination host unreachable/.test(p), netU = /Destination net unreachable/.test(p), fail = /General failure/.test(p);
    // a host's own address is left out of the model check: with the link down Windows removes the address, the model does not
    if (model && !Object.values(h.ifaces || {}).some((i) => i.ip === ip)) eq(echo, model(h, ip), 'ping agrees with the packet model: ' + why);
    if (echo && !/Request timed out/.test(p)) ok(new RegExp(ipRe(ip) + '$').test(hl[hl.length - 1] || ''), 'tracert arrives too: ' + why);
    if (!echo) ok(!new RegExp('\\s' + ipRe(ip) + '$').test(hl.join('\n')) || hl.length === 0, 'tracert does not arrive either: ' + why);
    if (hostU) ok(/reports: Destination host unreachable\./.test(t), 'host unreachable in both: ' + why);
    if (netU) { const f = /Reply from ([\d.]+): Destination net unreachable/.exec(p)[1]; ok(new RegExp('  ' + ipRe(f) + '  reports: Destination net unreachable\\.').test(t), 'net unreachable from the same router in both: ' + why); }
    if (fail) ok(/Unable to contact IP driver/.test(t), 'general failure in both: ' + why);
    if (!echo && !hostU && !netU && !fail) ok(/Request timed out/.test(p) && /Request timed out/.test(t), 'time-outs in both: ' + why);
  }
  return n;
}
test('W2-09 every guided lab, both vendors: ping and tracert give the same answer, and ping agrees with canPing', () => {
  let n = 0; const canPing = T.__get('canPing');
  for (const L of T.LEVELS) for (const v of ['cisco', 'dell']) { const net = lab(L.id, v); n += agree(net, 'lab ' + L.id + ' ' + v, (h, ip) => canPing(net, h.id, ip) || canPing(net, h.id, ip, { ignoreDup: true })); }
  ok(n >= 400, 'checked ' + n + ' pairs');
});
test('W2-10 Extreme Mode, as given and with faults added (a shut port, a shut gateway, a lost route, a trunk cut): ping and tracert agree and match xPing', () => {
  let n = 0;
  for (const L of T.XL) for (const v of ['cisco', 'dell']) {
    const faults = [null, 'port', 'svi', 'route', 'trunk'];
    for (const fault of faults) {
      const net = xlab(L, v), sws = Object.values(net.devices).filter((d) => d.type === 'switch' || d.type === 'l3switch'), pc = pcs(net)[0];
      if (fault === 'port') { const l = net.links.find((x) => x.from === pc.id || x.to === pc.id); const s = l.from === pc.id ? l.to : l.from, pt = l.from === pc.id ? l.toPort : l.fromPort; net.devices[s].ifaces[pt].admin = 'down'; }
      if (fault === 'svi') { const g = Object.values(net.devices).flatMap((d) => Object.values(d.ifaces || {})).find((i) => i.ip === pc.ifaces.eth0.gw); g && (g.admin = 'down'); }
      if (fault === 'route') Object.values(net.devices).forEach((d) => { if (d.routes) d.routes = []; });
      if (fault === 'trunk') { const l = net.links.find((x) => sws.some((s) => s.id === x.from) && sws.some((s) => s.id === x.to)); l && (net.devices[l.from].ifaces[l.fromPort].admin = 'down'); }
      n += agree(net, L.title + ' ' + v + ' ' + (fault || 'as given'), (h, ip) => T.__get('xPing')(net, h.id, ip).ok);
    }
  }
  ok(n > 300, 'checked ' + n + ' pairs');
});
test('W2-11 two PCs on different networks each reach their own gateway at TTL 255 and each other at TTL 127', () => {
  lab(6); for (const [me, gw, peer] of [['pc-a', '192.168.10.1', '192.168.20.20'], ['pc-b', '192.168.20.1', '192.168.10.10']]) {
    on(me); ok(new RegExp('Reply from ' + ipRe(gw) + ': bytes=32 time<1ms TTL=255').test(run('ping ' + gw)), me + ' gateway'); ok(new RegExp('Reply from ' + ipRe(peer) + ': bytes=32 time=1ms TTL=127').test(run('ping ' + peer)), me + ' peer');
  }
});

test('W2-12 PC addressing stays read-only through cmd, PowerShell, route and DHCP commands, guided and Extreme, and nothing changes', () => {
  const tries = ['netsh interface ipv4 set dnsservers Ethernet0 static 9.9.9.9', 'netsh int ip set address Ethernet0 dhcp', 'route change 0.0.0.0 mask 0.0.0.0 10.9.9.1', 'route delete 0.0.0.0', 'route -f', 'ipconfig /renew', 'ipconfig /release',
    'Set-NetIPAddress -InterfaceAlias Ethernet0 -IPAddress 10.9.9.9', 'Set-NetIPInterface -InterfaceAlias Ethernet0 -Dhcp Enabled', 'Remove-NetRoute -DestinationPrefix 0.0.0.0/0',
    'powershell -Command "Set-NetIPAddress -InterfaceAlias Ethernet0 -IPAddress 10.9.9.9 -PrefixLength 24"', 'pwsh -c New-NetRoute -DestinationPrefix 0.0.0.0/0 -NextHop 10.9.9.1', 'powershell Set-DnsClientServerAddress -InterfaceAlias Ethernet0 -ServerAddresses 9.9.9.9'];
  for (const mode of ['guided', 'extreme']) {
    const net = mode === 'guided' ? lab(6) : xlab(T.XL[0]), pc = mode === 'guided' ? net.devices['pc-a'] : pcs(net)[0]; on(pc.id); const before = JSON.stringify(net.devices);
    for (const c of tries) ok(/read-only in this lab/.test(run(c)), mode + ': ' + c);
    eq(JSON.stringify(net.devices), before, mode + ': nothing changed'); ok(/PowerShell is not simulated/.test(run('powershell')), mode + ': plain PowerShell');
  }
});

test('W2-13 guided labs with faults added, alone and combined (wrong access VLAN, VLAN pruned from trunks, routes lost, gateway shut plus a trunk cut): ping and tracert agree and match canPing', () => {
  let n = 0; const canPing = T.__get('canPing');
  const faults = {
    vlan: (net, pc) => { const l = net.links.find((x) => x.from === pc.id || x.to === pc.id); const s = l.from === pc.id ? l.to : l.from, pt = l.from === pc.id ? l.toPort : l.fromPort, i = net.devices[s].ifaces[pt]; if (i) { i.vlan = 999; i.accessVlan = 999; } },
    prune: (net) => Object.values(net.devices).forEach((d) => Object.values(d.ifaces || {}).forEach((i) => { if (i.mode === 'trunk' && Array.isArray(i.allowed)) i.allowed = i.allowed.filter((v) => v !== 10); })),
    routes: (net) => Object.values(net.devices).forEach((d) => { if (d.routes) d.routes = []; }),
    gwTrunk: (net, pc) => { const g = Object.values(net.devices).flatMap((d) => Object.values(d.ifaces || {})).find((i) => i.ip === pc.ifaces.eth0.gw); g && (g.admin = 'down'); const sw = Object.values(net.devices).filter((d) => d.type === 'switch' || d.type === 'l3switch').map((d) => d.id), l = net.links.find((x) => sw.includes(x.from) && sw.includes(x.to)); l && (net.devices[l.from].ifaces[l.fromPort].admin = 'down'); },
  };
  for (const L of T.LEVELS) for (const v of ['cisco', 'dell']) for (const combo of [['vlan'], ['prune'], ['routes'], ['gwTrunk'], ['vlan', 'routes'], ['prune', 'gwTrunk']]) {
    const net = lab(L.id, v), pc = net.devices['pc-a']; if (!pc) continue; combo.forEach((f) => faults[f](net, pc));
    n += agree(net, 'lab ' + L.id + ' ' + v + ' ' + combo.join('+'), (h, ip) => canPing(net, h.id, ip) || canPing(net, h.id, ip, { ignoreDup: true }));
  }
  ok(n >= 2000, 'checked ' + n + ' pairs');
});

done();
