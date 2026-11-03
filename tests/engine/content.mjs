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
done();
