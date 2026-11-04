// Saved lesson progress with two tabs open (audit finding DA-01). Each "tab" is its own copy of the Switch Lab code, sharing one fake localStorage,
// so a tab that loaded early saves after another tab saved something newer, exactly the case that used to lose lessons.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';

function makeStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m };
}
const NAMES = ['saveProgress', 'saveVendor', 'mergeProgress', 'readStoredProgress', 'cleanProgress'];
const tab = (storage) => { const T = loadTool('fault-lab', NAMES, { localStorage: storage }); return T; };
const done1 = (id, extra) => Object.assign({ completed: true, changes: 4, hints: 1, rev: 1 }, extra || {});
const finish = (T, id, rec) => { T.__get('progress')[id] = rec || done1(id); T.saveProgress(); };
const stored = (st) => JSON.parse(st.getItem('nfl_progress2') || '{}');

console.log('DA-01 Switch Lab progress with two tabs');
test('two tabs finishing different lessons keep both', () => {
  const st = makeStorage(), a = tab(st), b = tab(st);
  finish(a, '1'); finish(b, '2');
  eq(Object.keys(stored(st)).sort(), ['1', '2']);
  eq(Object.keys(b.__get('progress')).sort(), ['1', '2'], 'the tab that saved last also holds the merged list');
});
test('two tabs finishing the same lesson leave one record', () => {
  const st = makeStorage(), a = tab(st), b = tab(st);
  finish(a, '3', done1('3', { changes: 9 })); finish(b, '3', done1('3', { changes: 2 }));
  eq(Object.keys(stored(st)), ['3']); eq(stored(st)['3'].changes, 2, 'the later save of the same lesson wins');
});
test('a newer lesson revision is never replaced by an older record from a stale tab', () => {
  const st = makeStorage({ nfl_progress2: JSON.stringify({ 5: done1('5', { rev: 2 }) }) }), a = tab(st);
  a.__set('progress', { 5: done1('5', { rev: 1 }) }); a.saveProgress();
  eq(stored(st)['5'].rev, 2);
});
test('saving a lesson never touches the Cisco/Dell choice', () => {
  const st = makeStorage(), a = tab(st), b = tab(st);
  a.__set('vendor', 'cisco'); a.saveVendor(); eq(st.getItem('nfl_vendor'), 'cisco');
  finish(b, '1'); eq(st.getItem('nfl_vendor'), 'cisco', 'tab B still thinks Dell; saving a lesson must not write that back');
  b.__set('vendor', 'dell'); b.saveVendor(); eq(st.getItem('nfl_vendor'), 'dell', 'an explicit change is written');
});
test('a lesson saved in one tab is there after the other tab reloads', () => {
  const st = makeStorage(), a = tab(st), b = tab(st); finish(a, '1'); finish(b, '2');
  eq(Object.keys(tab(st).__get('progress')).sort(), ['1', '2']);
});
test('legacy records (no rev, extra fields) survive another tab\'s save and are cleaned', () => {
  const st = makeStorage({ nfl_progress2: JSON.stringify({ 1: { completed: true, changes: '3' }, 2: { completed: false }, x: { completed: true }, 4: 'junk' }) }), a = tab(st);
  finish(a, '6'); const s = stored(st); eq(Object.keys(s).sort(), ['1', '6']); eq(s['1'], { completed: true, changes: 3, hints: 0, rev: 1 });
});
test('unreadable stored progress: the tab still saves, and the damaged text is kept aside', () => {
  const st = makeStorage({ nfl_progress2: '{"1": {broken' }), a = tab(st);
  eq(a.__get('progress'), {}); eq(st.getItem('nfl_progress2'), '{"1": {broken', 'loading alone must not overwrite it');
  finish(a, '2'); eq(Object.keys(stored(st)), ['2']); eq(st.getItem('nfl_progress2_unreadable'), '{"1": {broken');
});
test('other shapes of damaged storage are treated as empty, not as a crash', () => {
  for (const bad of ['null', '[]', '"x"', '7', '{"__proto__":{"completed":true}}']) { const st = makeStorage({ nfl_progress2: bad }), a = tab(st); finish(a, '1'); eq(Object.keys(stored(st)), ['1'], bad); eq(({}).completed, undefined, 'prototype polluted by ' + bad); }
});
test('fifty rapid saves from alternating tabs lose nothing', () => {
  const st = makeStorage(), a = tab(st), b = tab(st);
  for (let i = 1; i <= 50; i++) finish(i % 2 ? a : b, String(i));
  eq(Object.keys(stored(st)).length, 50);
});
test('storage that refuses writes does not throw', () => {
  const st = makeStorage(); st.setItem = () => { throw new Error('quota'); }; const a = tab(st); finish(a, '1'); a.saveVendor();
});

console.log('DA-01 related: Extreme-level progress (nfl_extreme_progress1)');
const xtab = (storage) => { const T = loadTool('fault-lab', ['xpSave', 'XP'], { localStorage: storage }); T.XP.persistent = true; T.XP.p = {}; T.XP.cd = {}; return T; };
const xs = (st) => JSON.parse(st.getItem('nfl_extreme_progress1') || '{}');
test('two tabs finishing different extreme levels keep both', () => {
  const st = makeStorage(), a = xtab(st), b = xtab(st);
  a.XP.p['101'] = { completed: true, hints: 0, rev: 1, changes: 3, secs: 40 }; a.xpSave();
  b.XP.p['102'] = { completed: true, hints: 1, rev: 1, changes: 5, secs: 70 }; b.xpSave();
  eq(Object.keys(xs(st)).sort(), ['101', '102']); eq(xs(st)['101'].secs, 40);
});
test('extreme progress: damaged stored text is replaced, not fatal', () => {
  const st = makeStorage({ nfl_extreme_progress1: '{oops' }), a = xtab(st); a.XP.p['103'] = { completed: true, hints: 0, rev: 1, changes: 1, secs: 1 }; a.xpSave(); eq(Object.keys(xs(st)), ['103']);
});
done();
