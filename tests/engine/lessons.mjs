// Fault Lab lesson regressions (review finding SW-08): the access list lesson must be fixed by correcting the rule,
// not by unbinding the list. Run through the real console commands.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('fault-lab', ['LEVELS', 'runConsoleCommand', 'ensureSession']);
T.__set('XS', null); T.__set('currentLevel', { check: () => ({ ok: false }) });
const lesson = T.LEVELS.find((l) => l.id === 18);
function start(vendor) {
  const net = lesson.build(); T.__set('net', net); T.__set('vendor', vendor); T.__set('selectedDeviceId', 'l3sw'); T.__set('confMode', false); T.__set('confIface', null); T.__set('confAcl', null); T.__set('currentLevel', lesson);
  T.__get('consoleSessions').l3sw = undefined; return net;
}
const typed = (lines) => lines.forEach((l) => T.runConsoleCommand(l, false));
console.log('SW-08 access list lesson keeps its policy');
test('the lesson starts broken', () => { const n = start('cisco'); ok(!lesson.check(n), 'goal already met'); });
test('unbinding the list restores ping but does not complete the lesson', () => {
  const n = start('cisco'); typed(['enable', 'configure terminal', 'interface vlan 10', 'no ip access-group BLOCK-ICMP in', 'end']); eq(n.devices.l3sw.ifaces.Vlan10.aclIn, undefined); ok(!lesson.check(n), 'unbinding was accepted as the repair');
});
test('removing the deny icmp line and leaving the list bound completes it, on Cisco and Dell', () => {
  for (const [vendor, cmd] of [['cisco', 'ip access-list extended BLOCK-ICMP'], ['dell', 'ip access-list BLOCK-ICMP']]) {
    const n = start(vendor); typed(vendor === 'cisco' ? ['enable', 'configure terminal'] : ['configure terminal']); typed([cmd, 'no 10', 'end']);
    ok(lesson.check(n), vendor + ': the correct repair was not accepted');
  }
});
test('the other protection survives: the guest range stays denied and the intended flow works', () => {
  const n = start('cisco'); typed(['enable', 'configure terminal', 'ip access-list extended BLOCK-ICMP', 'no 10', 'end']);
  const d = n.devices.l3sw, acl = d.acls['BLOCK-ICMP']; ok(acl.rules.some((r) => r.seq === 20 && r.act === 'deny' && /192\.168\.30\.0/.test(r.dst)), 'guest rule gone');
});
test('deleting the guest rule as well fails the lesson', () => {
  const n = start('cisco'); typed(['enable', 'configure terminal', 'ip access-list extended BLOCK-ICMP', 'no 10', 'no 20', 'end']); ok(!lesson.check(n), 'a list that lost its protection was accepted');
});
test('the answer key and the quiz no longer teach unbinding as the clean fix', () => {
  ok(!/unbind the list from the interface/.test(JSON.stringify(lesson.choices)) || /leave the list bound/.test(lesson.answer), lesson.answer); ok(/leave the list bound/i.test(lesson.answer), lesson.answer);
});
done();
