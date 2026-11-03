// DNS Lab regressions (review findings DNS-01 and DNS-02), run from the code in index.html.
import { loadTool, makeDom } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const noop = () => {}, fields = { zType: { value: 'A', addEventListener: noop }, zName: { value: '', addEventListener: noop }, zData: { value: '', addEventListener: noop } }, addButton = {};
// The tool builds its add-record form at load, only when #zAdd is missing, so the first lookup of it answers null and later ones answer the test button.
let looked = 0; Object.defineProperty(fields, 'zAdd', { get: () => (looked++ ? addButton : null), enumerable: true });
const T = loadTool('dns-lab', ['query', 'findRecords', 'zone', 'BASE_ZONE'], { document: makeDom(fields) });
const msgs = []; T.__set('zMsg', (m, bad) => msgs.push((bad ? 'bad: ' : 'ok: ') + m));
const types = (r) => r.answers.map((a) => a.type);
const reset = () => { T.__set('zone', JSON.parse(JSON.stringify(T.BASE_ZONE))); msgs.length = 0; };
const add = (type, name, data) => { fields.zType.value = type; fields.zName.value = name; fields.zData.value = data; msgs.length = 0; addButton.onclick(); return msgs[msgs.length - 1] || ''; };

console.log('DNS-01 CNAME handling by query type');
for (const mode of ['auth', 'recurse']) {
  test('A follows the alias to the address (' + mode + ')', () => { reset(); eq(types(T.query('www.lab.local', 'A', mode, true)), ['CNAME', 'A']); });
  test('CNAME returns only the alias (' + mode + ')', () => { reset(); eq(types(T.query('www.lab.local', 'CNAME', mode, true)), ['CNAME']); });
  test('ANY returns the alias record and does not chase it (' + mode + ')', () => { reset(); eq(types(T.query('www.lab.local', 'ANY', mode, true)), ['CNAME']); });
}
test('with follow off, A returns only the alias', () => { reset(); eq(types(T.query('www.lab.local', 'A', 'auth', false)), ['CNAME']); });
test('ANY on a name with several records still returns all of them', () => { reset(); const t = types(T.query('app.lab.local', 'ANY', 'auth', true)).sort(); eq(t, ['A', 'AAAA']); });

console.log('DNS-02 SRV with the root target');
test('0 0 0 . is accepted and can be queried', () => {
  reset(); const m = add('SRV', '_xmpp._tcp.lab.local', '0 0 0 .'); ok(/^ok:|added/i.test(m) || !/^bad/.test(m), m);
  const r = T.query('_xmpp._tcp.lab.local', 'SRV', 'auth', true); eq(r.answers.map((a) => a.data), ['0 0 0 .']);
});
test('empty, malformed and over-long targets are still rejected', () => {
  reset(); for (const d of ['0 0 0', '0 0 0 a..b', '0 0 0 ' + 'a'.repeat(64) + '.lab.local', '70000 0 0 .']) { const m = add('SRV', '_x._tcp.lab.local', d); ok(/^bad/.test(m), d + ' -> ' + m); }
});
test('MX null target still works', () => { reset(); ok(!/^bad/.test(add('MX', 'lab.local', '0 .')), 'null MX refused'); });
done();
