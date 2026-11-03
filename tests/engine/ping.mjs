// Ping / Traceroute Analyzer regressions (review findings PA-01 to PA-03), run from the code in index.html.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('ping-analyzer', ['analyze', 'EX_MORE']);

// An mtr report with one row per hop: [address, Loss%, Snt]. The other columns are fixed.
const mtr = (rows, opt) => 'Start: 2026-10-18T14:02:11+0000\nHOST: lab                         Loss%   Snt   Last   Avg  Best  Wrst StDev\n' +
  rows.map((r, i) => '  ' + (i + 1) + '.|-- ' + r[0].padEnd(24) + ' ' + String(r[1]).padStart(6) + (opt && opt.pct === false ? '' : '%') + String(r[2] === undefined ? 100 : r[2]).padStart(6) + '  10.0  10.0   9.0  12.0   1.0').join('\n') + '\n';
const rows = (...loss) => loss.map((l, i) => ['10.0.0.' + (i + 1), l]);
const run = (text) => T.analyze(text)[0];
const said = (r) => r.observations.map((o) => o.text).join('\n');

console.log('PA-01 probe results are not application results');
test('zero final-hop loss does not certify the path for other traffic', () => {
  const t = said(run(mtr(rows(0, 0, 0)))); ok(!/nothing is being lost|traffic is passing through it fine/i.test(t), t);
});
test('loss only at a middle hop is described as slow replies, with the caveat', () => {
  const t = said(run(mtr(rows(0, 60, 0, 0)))); ok(/probably just slow to answer probes/.test(t) && /does not prove every kind of traffic/.test(t), t);
});
test('the bundled pathping and mtr examples never say a real connection sees the same', () => {
  const all = Object.values(T.EX_MORE).map((x) => said(run(x))).join('\n'); ok(!/real connection sees/i.test(all), all.slice(0, 300));
});
test('final-hop loss mentions ICMP rate limiting as a possibility', () => {
  const t = said(run(mtr(rows(0, 0, 40)))); ok(/limiting|limit/.test(t) && /test the real service|another test|application/i.test(t), t);
});

console.log('PA-02 loss origin is a suspect area, judged by size');
test('90% at hop 2 with 1% after it is not called the drop point', () => {
  const t = said(run(mtr(rows(0, 90, 1, 1)))); ok(!/Loss begins at hop 2/.test(t) && /do not treat hop 2 as the drop point/.test(t), t);
});
test('1%, 20%, 20% still points at the persistent loss and says it is a suspect area', () => {
  const r = run(mtr(rows(0, 1, 20, 20))), t = said(r); ok(/suspect area/.test(t) && /higher further along|look there too/.test(t), t);
});
test('loss that continues at a similar level is reported as starting at that hop', () => {
  const t = said(run(mtr(rows(0, 30, 30, 30)))); ok(/Loss first appears at hop 2/.test(t) && /suspect area/.test(t), t);
});
test('silent hops after the first lossy hop are not treated as proof', () => {
  const text = mtr([['10.0.0.1', 0], ['10.0.0.2', 40], ['???', 100], ['???', 100]]); const t = said(run(text)); ok(!/dropped at or just after/.test(t), t);
});
test('unequal probe counts are called out', () => {
  const text = mtr([['10.0.0.1', 0, 100], ['10.0.0.2', 30, 100], ['10.0.0.3', 30, 12]]); ok(/different numbers of probes/.test(said(run(text))), said(run(text)));
});

console.log('PA-03 malformed metrics');
test('negative loss, latency and probe counts are not accepted as hops', () => {
  const good = mtr(rows(0, 0)), bad = good + '  3.|-- 10.0.0.9                   -1.0%   100  10.0  10.0   9.0  12.0   1.0\n' + '  4.|-- 10.0.0.8                    0.0%   100 -10.0 -10.0   9.0  12.0   1.0\n' + '  5.|-- 10.0.0.7                    0.0%    -5  10.0  10.0   9.0  12.0   1.0\n' + '  6.|-- 10.0.0.6                    0.0%   2.5  10.0  10.0   9.0  12.0   1.0\n';
  const r = run(bad); eq(r.hops.length, 2); ok(/numbers that cannot be real/.test(said(r)), 'rows were dropped without a word: ' + said(r));
});
test('numbers with junk suffixes are rejected', () => {
  const text = mtr(rows(0, 0)) + '  3.|-- 10.0.0.9                    5x%   100  10.0  10.0   9.0  12.0   1.0\n'; eq(run(text).hops.length, 2);
});
test('valid rows including 100% loss and zero latency still parse', () => {
  const r = run(mtr([['10.0.0.1', 0], ['10.0.0.2', 100]])); eq(r.hops.length, 2);
});
done();
