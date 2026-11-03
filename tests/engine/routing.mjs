// Routing Lab regressions (review finding RT-01).
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('routing-lab', ['addRoute', 'bestRoute', 'tables']);
console.log('RT-01 administrative distance 255');
test('addRoute refuses AD 255 and leaves the table unchanged', () => {
  const before = JSON.stringify(T.tables.R1), msg = T.addRoute('R1', '198.51.100.0/24', '10.0.0.2', '255');
  ok(/255/.test(msg) && /never/i.test(msg), 'message: ' + msg); eq(JSON.stringify(T.tables.R1), before);
});
test('AD 254 is still accepted and used', () => {
  ok(!/Administrative distance/.test(T.addRoute('R1', '198.51.100.0/24', '10.0.0.2', '254') || ''), 'AD 254 refused');
  eq(T.bestRoute('R1', '198.51.100.7').best.net, '198.51.100.0/24');
  T.tables.R1 = T.tables.R1.filter((r) => r.net !== '198.51.100.0/24');
});
test('a more-specific AD 255 route is never used for forwarding', () => {
  T.tables.R1.push({ net: '198.51.100.0/24', via: '10.0.0.2', ad: 255, metric: 0, iface: 'Gi0/1', note: 'S' });
  const r = T.bestRoute('R1', '198.51.100.7'); eq(r.best.net, '0.0.0.0/0'); ok(r.matches.every((m) => m.ad < 255), 'AD 255 listed as a candidate');
});
test('ordinary longest-prefix and AD ordering is unchanged', () => {
  eq(T.bestRoute('R1', '10.3.1.1').best.net, '10.3.0.0/16'); eq(T.bestRoute('R1', '8.8.8.8').best.net, '0.0.0.0/0');
});
done();
