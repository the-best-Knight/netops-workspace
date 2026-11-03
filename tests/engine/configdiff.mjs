// Config Diff regressions (review findings CD-01 and CD-02). Runs the comparison code that ships in index.html.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('config-diff', ['compare', 'resultsText']);
const o = (x) => Object.assign({ ws: false, blank: false, comments: false, generated: false, icase: false, moved: false }, x || {});
const acl = (n) => Array.from({ length: n }, (_, i) => 'permit ip 10.' + (i >> 8) + '.' + (i & 255) + '.0 0.0.0.255 any');

console.log('CD-01 order changes are never reported as equal');
test('1,300 reversed unique rules are reported as changed', () => {
  const a = acl(1300), r = T.compare(a.join('\n'), [...a].reverse().join('\n'), o());
  ok(r.added > 0 && r.removed > 0, 'order change vanished: +' + r.added + ' -' + r.removed);
  ok(r.approximate, 'the result must say it is approximate');
});
test('the shortest-edit case still has no approximate flag', () => {
  const a = acl(1300), b = [...a]; b.splice(600, 0, 'deny ip any any');
  const r = T.compare(a.join('\n'), b.join('\n'), o()); eq([r.added, r.removed, r.approximate], [1, 0, false]);
});
test('a large block moved across the file is added and removed, not unchanged', () => {
  const a = acl(1200), b = [...a.slice(600), ...a.slice(0, 600)];
  const r = T.compare(a.join('\n'), b.join('\n'), o()); ok(r.added >= 600 && r.removed >= 600, '+' + r.added + ' -' + r.removed);
});
test('identical large files are still equal', () => {
  const a = acl(3000).join('\n'), r = T.compare(a, a, o()); eq([r.added, r.removed, r.changed], [0, 0, 0]);
});
test('Ignore moved lines still hides a move, and says how many', () => {
  const a = acl(1300), r = T.compare(a.join('\n'), [...a].reverse().join('\n'), o({ moved: true }));
  eq([r.added, r.removed], [0, 0]); ok(r.moved > 0, 'moved count');
});
test('the exported text says when the comparison is approximate', () => {
  const a = acl(1300), r = T.compare(a.join('\n'), [...a].reverse().join('\n'), o());
  ok(/Approximate comparison/.test(T.resultsText(r, r.rows.map((row) => ({ row })), false)), 'no disclosure');
});

console.log('CD-02 whitespace');
test('spaces inside quoted values still count with Ignore whitespace on', () => {
  for (const [a, b] of [['password "a  b"', 'password "a b"'], ["banner motd 'x  y'", "banner motd 'x y'"], ['set regex "a  +b"', 'set regex "a +b"']]) {
    const r = T.compare(a, b, o({ ws: true })); ok(r.changed + r.added + r.removed > 0, a + ' vs ' + b + ' compared as equal');
  }
});
test('spaces and indentation outside quotes are still ignored', () => {
  const r = T.compare('interface Gi0/1\n  description  "uplink  to core"\n', 'interface Gi0/1\n    description "uplink  to core"\n', o({ ws: true })); eq([r.added, r.removed, r.changed], [0, 0, 0]);
});
test('with Ignore whitespace off, indentation is a difference', () => {
  const r = T.compare('a:\n  b: 1\n', 'a:\n    b: 1\n', o()); ok(r.changed + r.added + r.removed > 0, 'indent change missed');
});
done();
