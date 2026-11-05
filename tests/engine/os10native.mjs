// Dell OS10 native VLAN syntax (audit F-03, 2026-11-05). Dell documents the untagged VLAN of an OS10 trunk as
// "switchport access vlan <id>" on the trunk port (KB 000137464); the OS10 User Guide command list has no
// "switchport trunk native vlan". Cisco keeps "switchport trunk native vlan". Runs the Switch Lab code in index.html.
import { readFileSync } from 'node:fs';
import { loadTool, KIT_FILE } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('fault-lab', ['LEVELS', 'XL', 'runConsoleCommand', 'ensureSession', 'xSheetCheck']);
T.__set('XS', null);
function lab(id, vendor) { const L = T.LEVELS.find((l) => l.id === id), net = L.build(); T.__set('vendor', vendor); T.__set('net', net); T.__set('currentLevel', L); for (const k of Object.keys(T.__get('consoleSessions'))) delete T.__get('consoleSessions')[k]; T.__set('startupCfg', {}); T.__set('coachInit', JSON.stringify(net.devices)); T.__set('confMode', false); T.__set('confIface', null); T.__set('confAcl', null); return net; }
const sw1 = (net) => Object.values(net.devices).find((d) => d.type === 'switch' || d.type === 'l3switch');
function run(line) { const s = T.ensureSession(T.__get('selectedDeviceId')), from = s.lines.length; T.runConsoleCommand(line, false); return s.lines.slice(from).map((l) => l.text).slice(1).join('\n'); }
const dellTrunk = (net) => { const d = sw1(net); T.__set('selectedDeviceId', d.id); for (const c of ['configure terminal', 'interface vlan 99', 'exit', 'interface ethernet 1/1/2', 'switchport mode trunk']) run(c); return d.ifaces['Gi0/2']; };

console.log('Dell OS10');
test('switchport trunk native vlan is rejected as invalid input and changes nothing', () => {
  const net = lab(6, 'dell'), i = dellTrunk(net), before = JSON.stringify(i); const o = run('switchport trunk native vlan 99');
  ok(/% Error: Invalid input/.test(o), o); eq(JSON.stringify(i), before);
});
test('on a trunk port, switchport access vlan sets the untagged VLAN and the port stays a trunk', () => {
  const net = lab(6, 'dell'), i = dellTrunk(net); run('switchport access vlan 99');
  eq(i.mode, 'trunk'); eq(Number(i.nativeVlan), 99);
});
test('the running configuration shows the OS10 form under the trunk, never "trunk native"', () => {
  const net = lab(6, 'dell'); dellTrunk(net); run('switchport access vlan 99'); run('end'); const o = run('show running-configuration interface ethernet 1/1/2');
  ok(/switchport mode trunk/.test(o) && /switchport access vlan 99/.test(o) && !/trunk native/.test(o), o);
});
test('on an access port, switchport access vlan still sets the access VLAN', () => {
  const net = lab(6, 'dell'), d = sw1(net); T.__set('selectedDeviceId', d.id); for (const c of ['configure terminal', 'interface vlan 20', 'exit', 'interface ethernet 1/1/1', 'switchport mode access', 'switchport access vlan 20']) run(c);
  eq(d.ifaces['Gi0/1'].mode, 'access'); eq(Number(d.ifaces['Gi0/1'].vlan), 20);
});
test('help: "switchport trunk ?" does not offer native, and "switchport trunk native ?" is invalid', () => {
  const net = lab(6, 'dell'); dellTrunk(net); const a = run('switchport trunk ?'), b = run('switchport trunk native ?');
  ok(/allowed/.test(a) && !/native/.test(a), a); ok(/Invalid input/.test(b) && !/<cr>/.test(b), b);
});
test('every Extreme incident can still meet the native VLAN 99 rule on Dell with the OS10 command', () => {
  let fixed = 0;
  for (const L of T.XL) {
    const net = L.build(); T.__set('vendor', 'dell'); T.__set('net', net); T.__set('XS', { seq: 0 }); T.__set('currentLevel', { extreme: true, extremeId: L.id, check: () => ({ ok: false }) }); T.__set('confMode', false); T.__set('confIface', null);
    const bad = T.xSheetCheck(net, {}).filter((b) => b.why === 'native');
    for (const b of bad) { const d = net.devices[b.dev]; T.__set('selectedDeviceId', d.id); const m = /(\d+)\/(\d+)$/.exec(b.port); run('configure terminal'); run('interface vlan 99'); run('exit'); run('interface ethernet 1/1/' + (m ? m[2] : b.port)); run('switchport access vlan 99'); run('end'); fixed++; }
    eq(T.xSheetCheck(net, {}).filter((b) => b.why === 'native').length, 0, L.title + ': native VLAN rule still failing');
  }
  ok(fixed >= 1, 'at least one incident needed the native VLAN fix: ' + fixed);
});
console.log('Cisco is unchanged');
test('Cisco keeps switchport trunk native vlan, shown in its running configuration', () => {
  const net = lab(6, 'cisco'), d = sw1(net); T.__set('selectedDeviceId', d.id); for (const c of ['enable', 'configure terminal', 'vlan 99', 'exit', 'interface Gi0/2', 'switchport mode trunk', 'switchport trunk native vlan 99', 'end']) run(c);
  eq(Number(d.ifaces['Gi0/2'].nativeVlan), 99); ok(/switchport trunk native vlan 99/.test(run('show running-config interface Gi0/2')));
});
console.log('Cheat Sheet');
const kit = JSON.parse(/<script type="application\/json" id="kit-data">([\s\S]*?)<\/script>/.exec(readFileSync(KIT_FILE, 'utf8'))[1]);
test('no Dell OS10 row uses switchport trunk native vlan; the native VLAN rows use switchport access vlan', () => {
  const rows = kit.switchCheat.flatMap((c) => c.rows); const bad = rows.filter((r) => /trunk native/.test(r.dell || '')).map((r) => r.intent);
  eq(bad, []); const nat = rows.filter((r) => /native vlan/i.test(r.intent) || /native vlan/.test(r.cisco || '')); ok(nat.length >= 3, 'native VLAN rows found: ' + nat.length);
  for (const r of nat) ok(/switchport access vlan/.test(r.dell || '') || /^n\/a|^—/.test(r.dell || ''), r.intent + ': ' + r.dell);
});
done();
