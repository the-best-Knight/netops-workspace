// Reference and documentation claims (review findings CS-01, OR-01, LS-06, DNS-03, RT-02). These are wording checks on text that ships.
import { readFileSync } from 'node:fs';
import { KIT_FILE } from './tool.mjs';
import { test, ok, done } from './lib.mjs';
const html = readFileSync(KIT_FILE, 'utf8'), readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const kit = JSON.parse(/<script type="application\/json" id="kit-data">([\s\S]*?)<\/script>/.exec(html)[1]);
const flat = (o, out = []) => { if (Array.isArray(o)) o.forEach((x) => flat(x, out)); else if (o && typeof o === 'object') { out.push(o); Object.values(o).forEach((x) => flat(x, out)); } return out; };
const objs = flat(kit);

console.log('CS-01 Junos commit confirmed');
test('commit confirmed and commit check both say that either one confirms a pending commit', () => {
  const cc = objs.find((o) => o.junos === 'commit confirmed 5'), ck = objs.find((o) => o.junos === 'commit check');
  ok(/commit check confirm/i.test(cc.tip) || /Both commit and commit check confirm/.test(cc.tip), cc.tip); ok(/confirms it/.test(ck.tip), ck.tip);
});

console.log('OR-01 IPv6 reference entry');
test('IPv6 separates neighbor discovery from address configuration and keeps DHCPv6', () => {
  const v6 = objs.find((o) => o.s === 'IPv6'); ok(/NDP/.test(v6.u) && /DHCPv6/.test(v6.u) && /SLAAC/.test(v6.u) && !/instead of ARP and DHCP/.test(v6.u), v6.u);
});

console.log('LS-06 privacy claims');
test('the README does not say every Log Sanitizer save is encrypted', () => {
  ok(!/Anything the Log Sanitizer saves is encrypted/.test(readme), 'old claim is back'); ok(/plain text/.test(readme) && /Download Text/.test(readme), 'plain-text outputs not named');
});
test('Download Text says it is plain text where the button is', () => ok((html.match(/title="Saves the sanitized text as a plain \.txt file\. It is not encrypted\."/g) || []).length >= 1, 'no tooltip'));

console.log('DNS-03 and RT-02 teaching notes');
test('the DNS Lab explains the .local simplification', () => ok(/id="localNote"/.test(html) && /RFC 6762/.test(html) && /lab\.test/.test(html), 'note missing'));
test('the Routing Lab explains installed routes versus the forwarding lookup', () => ok(/Two separate steps happen on a real router/.test(html), 'note missing'));
console.log('Dell OS9 cheat sheet');
const os9 = kit.os9Cheat.flatMap((b) => b.rows);
test('every OS9 row has a command and a unique intent', () => {
  ok(os9.length >= 50, 'rows: ' + os9.length); ok(os9.every((r) => typeof r.os9 === 'string' && r.os9.trim()), 'row without a command');
  const seen = new Set(); os9.forEach((r) => { ok(!seen.has(r.intent), 'duplicate intent ' + r.intent); seen.add(r.intent); });
});
test('OS9 rows use OS9 spelling, not OS10', () => {
  const cmds = os9.flatMap((r) => r.os9.split('\n'));
  ok(!cmds.some((c) => /^show interface\s/.test(c)), 'OS10 spelling: show interface'); ok(!cmds.some((c) => /ethernet\s*1\/1\/1|^switchport mode|^switchport access/.test(c)), 'OS10 syntax found');
  ok(!cmds.some((c) => /^commit\b|^show running-configuration\b/.test(c)), 'Junos or OS10 command found');
});
test('every Quick answer line for OS9 points at a real OS9 row', () => {
  const refs = [...html.matchAll(/\["os9", ("(?:[^"\\]|\\.)*")\]/g)].map((m) => JSON.parse(m[1])), intents = new Set(os9.map((r) => r.intent));
  ok(refs.length >= 20, 'refs: ' + refs.length); refs.forEach((i) => ok(intents.has(i), 'no OS9 row for task line: ' + i));
});
test('the OS9 sheet is wired into the picker, the platform list and hub search', () => {
  ok(/data-v="os9" data-modes="switch">Dell OS9</.test(html) && /<option value="os9">Dell OS9</.test(html), 'picker'); ok(/switch: \["dell", "os9", "cisco", "junos"\]/.test(html), 'platform list'); ok(/\["os9", "Dell OS9", d\.os9Cheat\]/.test(html), 'hub search');
});
done();
