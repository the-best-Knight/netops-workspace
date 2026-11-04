// Dell OS9 Cheat Sheet data. These checks read the shipped data and the shipped page, not a copy.
// They cannot prove a command is right for a real switch. They catch the mistakes this sheet is prone to:
// OS10 or Cisco syntax pasted into an OS9 row, a config line in the wrong mode, a risky command with no warning,
// a row with no source, and removed Cisco, Dell OS10 or Junos commands.
import { readFileSync } from 'node:fs';
import { KIT_FILE } from './tool.mjs';
import { test, ok, done } from './lib.mjs';
const html = readFileSync(KIT_FILE, 'utf8');
const kit = JSON.parse(/<script type="application\/json" id="kit-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const sourcesDoc = readFileSync(new URL('../../docs/reviews/2026-11-03-os9-sources.md', import.meta.url), 'utf8');
const baseline = JSON.parse(readFileSync(new URL('./cheatsheet-baseline.json', import.meta.url), 'utf8'));
const rows = kit.os9Cheat.flatMap((b) => b.rows.map((r) => ({ ...r, cat: b.cat })));
const lines = (r) => r.os9.split('\n').map((l) => l.trim());
const first = (l) => l.split(/\s+/)[0];
const sourceIds = new Set([...sourcesDoc.matchAll(/^\|\s*`([A-Z0-9-]+)`\s*\|/gm)].map((m) => m[1]));

console.log('Structure');
test('every row has a command, a mode, a source, a verification level and tags', () => {
  ok(rows.length >= 100, 'rows: ' + rows.length);
  rows.forEach((r) => {
    ok(typeof r.intent === 'string' && r.intent.length > 3, 'intent: ' + JSON.stringify(r.intent));
    ok(typeof r.os9 === 'string' && r.os9.trim() && r.os9 === r.os9.trim() && !/[​ \r\t]|<[a-z/]|`/i.test(r.os9.replace(/<[a-z-]+>/g, '')), 'bad command text: ' + r.intent);
    ok(r.mode && typeof r.mode.os9 === 'string' && r.mode.os9, 'mode: ' + r.intent);
    ok(['doc', 'index', 'review'].includes(r.ver), 'ver: ' + r.intent);
    ok(typeof r.tags === 'string' && r.tags.trim(), 'tags: ' + r.intent);
    ok(r.risk === undefined || r.risk === 'disrupt', 'risk: ' + r.intent);
  });
  kit.os9Cheat.forEach((b) => ok(b.cat && Array.isArray(b.rows) && b.rows.length, 'category: ' + b.cat));
});
test('intents and commands are unique', () => {
  const i = new Set(), c = new Set();
  rows.forEach((r) => { ok(!i.has(r.intent), 'duplicate intent: ' + r.intent); i.add(r.intent); ok(!c.has(r.os9), 'duplicate command: ' + r.os9); c.add(r.os9); });
});
test('every source id is listed in the sources record, and doc rows cite a specific page', () => {
  ok(sourceIds.size >= 10, 'sources found: ' + sourceIds.size);
  rows.forEach((r) => { ok(sourceIds.has(r.src), 'unknown source ' + r.src + ' in ' + r.intent); if (r.ver === 'doc') ok(r.src !== 'CLI', 'doc row cites only the index: ' + r.intent); if (r.ver === 'index') ok(r.src.startsWith('CLI'), 'index row cites a non-CLI source: ' + r.intent); });
});
test('all fourteen groups are present and the VLAN, LAG and interface groups are substantial', () => {
  const by = (c) => rows.filter((r) => r.cat === c).length;
  ok(kit.os9Cheat.length >= 14, 'groups: ' + kit.os9Cheat.length); ok(by('VLANs') >= 15 && by('Port-channels and LACP') >= 12 && by('Interfaces') >= 15, 'VLANs ' + by('VLANs') + ', LAG ' + by('Port-channels and LACP') + ', interfaces ' + by('Interfaces'));
});

console.log('OS9 syntax, not OS10 or Cisco');
test('no OS10, Cisco IOS or Junos syntax in an OS9 row', () => {
  const bad = [
    [/\bethernet\s*\d+\/\d+\/\d+/i, 'OS10 interface name'], [/\bswitchport\s+(mode|access|trunk)\b/, 'Cisco or OS10 switchport form'], [/^show interface\s/, 'OS10 singular show interface'],
    [/show running-configuration\b/, 'OS10 spelling'], [/^commit\b/, 'Junos'], [/\bchannel-group\b/, 'Cisco port-channel'], [/\bshow (etherchannel|cdp|interfaces trunk|spanning-tree vlan|ip interface brief \|)\b/, 'Cisco show'],
    [/^spanning-tree mode\b/, 'Cisco STP mode'], [/\bshow (mac address-table|vlan-id)\b/, 'Cisco or OS10 MAC or VLAN show'], [/^lacp mode\b|^channel-group\b/, 'OS10 or Cisco LACP form'], [/^vlt-domain\b|^discovery-interface\b/, 'OS10 VLT'], [/^interface (ethernet|breakout)\b/, 'OS10 interface']
  ];
  rows.forEach((r) => lines(r).forEach((l) => bad.forEach(([re, why]) => ok(!re.test(l), why + ': "' + l + '" in ' + r.intent))));
});
test('every interface name is an OS9 type with slot/port', () => {
  rows.forEach((r) => lines(r).forEach((l) => { const m = /^(?:interface|interface range|default interface|show interfaces|show hardware counters interface|clear counters|show lldp neighbors interface|untagged|tagged|channel-member|no channel-member|source)\s+(?:vlan|port-channel|managementethernet|te|tengigabitethernet|fortygige|hundredgige)\b/i.exec(l); if (/^(interface|default interface|untagged|tagged|channel-member|no channel-member)\s+\S*ethernet|\bgige\b/i.test(l)) ok(m, 'interface type: "' + l + '" in ' + r.intent); }));
});
test('VLAN membership is set from the VLAN, never from the port', () => {
  rows.forEach((r) => { const ls = lines(r); ls.forEach((l, i) => { if (/^(no )?(un)?tagged\s/.test(l)) ok(ls.slice(0, i).some((p) => /^interface (range )?vlan\s/.test(p)) && !ls.slice(0, i).some((p, j) => /^interface (?!(range )?vlan)/.test(p) && j > ls.slice(0, i).map((q) => /^interface (range )?vlan\s/.test(q)).lastIndexOf(true)), 'tagged/untagged outside interface vlan: ' + r.intent); }); });
});
test('LACP, port-channel and hybrid commands appear in a valid order', () => {
  rows.forEach((r) => {
    const ls = lines(r), at = (re) => ls.findIndex((l) => re.test(l));
    ls.forEach((l, i) => {
      if (/^port-channel \d+ mode (active|passive)$/.test(l)) ok(ls.slice(0, i).some((p) => /^port-channel-protocol lacp$/.test(p)), 'mode before port-channel-protocol lacp: ' + r.intent);
      if (/^no shutdown$/.test(l) && ls.slice(0, i).some((p) => /^port-channel-protocol lacp$/.test(p)) && !ls.slice(0, i).some((p, j) => /^interface/.test(p) && j > ls.findIndex((q) => /^port-channel-protocol lacp$/.test(q)))) ok(false, 'no shutdown typed inside the LACP sub-mode: ' + r.intent);
      if (/^(no )?channel-member\s/.test(l)) ok(ls.slice(0, i).some((p) => /^interface port-channel \d+$/.test(p)), 'channel-member outside interface port-channel: ' + r.intent);
      if (/^portmode hybrid$/.test(l)) { const s = ls.findIndex((q, j) => j > i && q === 'switchport'); ok(s === -1 || s > i, 'switchport before portmode hybrid: ' + r.intent); ok(ls.slice(0, i).some((p) => /^interface (port-channel \d+|te|tengigabitethernet|fortygige|hundredgige)/i.test(p)), 'portmode hybrid outside an interface: ' + r.intent); }
    });
    if (at(/^portmode hybrid$/) >= 0 && at(/^switchport$/) >= 0) ok(at(/^portmode hybrid$/) < at(/^switchport$/), 'hybrid must come before switchport: ' + r.intent);
  });
});
test('commands match the mode the row names', () => {
  const exec = new Set(['show', 'ping', 'traceroute', 'dir', 'terminal', 'clear', 'copy', 'write', 'reload', 'enable', 'disable', 'configure']);
  rows.forEach((r) => {
    if (r.mode.os9 === 'EXEC' || r.mode.os9 === 'EXEC Privilege') lines(r).forEach((l) => ok(exec.has(first(l)), 'config command in an EXEC row: "' + l + '" in ' + r.intent));
    else lines(r).forEach((l) => ok(!/^(show|ping|traceroute|dir|clear|copy|write|reload|enable|disable)\b/.test(l), 'EXEC command in a config row: "' + l + '" in ' + r.intent));
  });
});

console.log('Safety labels');
test('commands that can drop traffic or lock you out carry the disrupts flag', () => {
  const risky = [/^shutdown$/, /^interface range vlan\b/, /^default interface\b/, /^no interface\b/, /^no (un)?tagged\b/, /^no channel-member\b/, /^clear mac-address-table\b/, /^clear arp-cache\b/, /^clear ip bgp\b/, /^clear ipv6 neighbors\b/, /^reload$/, /^no ip route\b/, /^ip route 0\.0\.0\.0\/0\b/, /^ipv6 route ::\/0\b/, /^management route\b/, /^no ip access-/, /^no ip access-list\b/, /^ip access-group\b/, /^ip access-list\b/, /^username\b/, /^protocol spanning-tree\b/, /^bridge-priority\b/, /^portmode hybrid$/, /^vlt domain\b/, /^router (ospf|bgp)\b/, /^interface managementethernet\b/, /^spanning-tree rstp edge-port bpduguard shutdown-on-violation/];
  rows.forEach((r) => lines(r).forEach((l) => risky.forEach((re) => { if (re.test(l) && !(/^portmode hybrid$/.test(l) && /^interface port-channel \d+$/.test(lines(r)[0]))) ok(r.risk === 'disrupt', 'missing disrupts flag: "' + l + '" in ' + r.intent); })));
});
test('read-only rows never carry a disrupts flag', () => {
  rows.filter((r) => r.risk).forEach((r) => ok(!lines(r).every((l) => /^(show|ping|traceroute|dir|terminal)\b/.test(l)), 'a show-only row is flagged: ' + r.intent));
});
test('placeholders are visible and no credential or default is shipped', () => {
  rows.forEach((r) => {
    lines(r).forEach((l) => { if (/^username\b/.test(l)) ok(/<user>/.test(l) && /<password>/.test(l), 'real-looking credential: ' + l); if (/snmp-server community/.test(l)) ok(/<community>/.test(l) && !/\bpublic\b|\bprivate\b/.test(l), 'community string: ' + l); });
    ok(!/\bpassword\s+(?!<)\S+/.test(r.os9.replace(/password-authentication/g, '')) && !/secret\s+(?!<)\S+/.test(r.os9), 'literal password in ' + r.intent);
  });
});
test('example addresses are documentation addresses only', () => {
  const okV4 = (a) => /^(0\.0\.0\.0|255\.255\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(a);
  rows.forEach((r) => { (r.os9.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || []).forEach((a) => ok(okV4(a), 'non-documentation address ' + a + ' in ' + r.intent)); (r.os9.match(/\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,}\b/gi) || []).forEach((a) => ok(/^2001:db8:|^::|^00:11:22:33:44:55$/i.test(a) || a.length < 3, 'non-documentation IPv6 ' + a + ' in ' + r.intent)); });
});

console.log('Nothing else changed');
test('no Cisco IOS, Dell OS10 or Junos command was removed or changed', () => {
  const now = new Set();
  [['switchCheat', ['cisco', 'dell']], ['junosCheat', ['junos']]].forEach(([k, vs]) => kit[k].forEach((b) => b.rows.forEach((r) => vs.forEach((v) => { if (typeof r[v] === 'string' && r[v]) now.add(v + '|' + r.intent + '|' + r[v]); }))));
  Object.entries(baseline).forEach(([k, list]) => { const missing = list.filter((x) => !now.has(x)); ok(!missing.length, k + ' lost ' + missing.length + ': ' + missing.slice(0, 3).join(' ;; ')); });
});
test('no OS9 key leaked into the OS10 or Cisco rows', () => {
  kit.switchCheat.forEach((b) => b.rows.forEach((r) => { ok(!('os9' in r), 'os9 key in OS10 row ' + r.intent); ['cisco', 'dell'].forEach((v) => ok(!/\b(portmode hybrid|channel-member|port-channel-protocol)\b/.test(r[v] || ''), 'OS9 command in the ' + v + ' column: ' + r.intent)); }));
});
test('the Network Fault Lab still simulates OS10 and has no OS9 syntax', () => {
  const lab = /<script type="text\/plain" id="src-fault-lab">([\s\S]*?)<\/script>/.exec(html)[1];
  ['portmode hybrid', 'channel-member', 'port-channel-protocol', 'bridge-priority', 'show lacp', 'show vlt', 'OS9', 'FTOS', 'fortygige', 'hundredgige'].forEach((t) => ok(!new RegExp(t, 'i').test(lab), 'OS9 token in the lab: ' + t));
  ok(/Dell SmartFabric OS10/.test(lab) && /ethernet1\/1\/1/.test(lab), 'lab no longer OS10');
});
test('the Cheat Sheet adds no outside request', () => {
  const sheet = /<script type="text\/plain" id="src-practice-ref">([\s\S]*?)<\/script>/.exec(html)[1];
  ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts)\s*\(/.test(sheet), 'network call');
  ok(!/<(script|link|img|iframe)\b[^>]*(src|href)=["']?https?:/i.test(sheet), 'external resource'); ok(!/@import|url\(\s*["']?https?:/i.test(sheet), 'external css');
  ok(/default-src 'none'/.test(sheet) && !/connect-src/.test(sheet), 'content security policy changed');
});
test('the page keeps the OS9 pill beside OS10, Cisco and Junos', () => {
  ['ps', 'cmd', 'dell', 'os9', 'cisco', 'junos', 'linux', 'proxmox', 'esxi', 'nsx', 'vxrail'].forEach((v) => ok(new RegExp('data-v="' + v + '" data-modes=').test(html), 'pill ' + v));
  ok(/data-v="dell" data-modes="switch">Dell OS10</.test(html) && /data-v="os9" data-modes="switch">Dell OS9</.test(html), 'labels');
});
done();
