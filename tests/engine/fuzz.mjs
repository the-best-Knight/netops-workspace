import { loadNM, fx } from './load.mjs';
import { readdirSync } from 'node:fs';
const NM = loadNM();
const files = readdirSync(new URL('../fixtures/', import.meta.url), { recursive: true }).filter(f => !f.startsWith('.') && /\.(txt|cfg|set)$/.test(f));
const texts = files.map(f => [f, fx(f)]);
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; const pick = (a) => a[Math.floor(rnd() * a.length)];
function mutate(t) {
  const k = Math.floor(rnd() * 8);
  const lines = t.split('\n');
  switch (k) {
    case 0: return t.slice(0, Math.floor(rnd() * t.length));                              // truncated
    case 1: return lines.filter(() => rnd() > 0.2).join('\n');                           // lines dropped
    case 2: return lines.map(l => rnd() > 0.9 ? l + l : l).join('\n');                   // lines doubled
    case 3: return lines.sort(() => rnd() - 0.5).join('\n');                             // shuffled
    case 4: return t.replace(/\d/g, (d) => rnd() > 0.85 ? pick(['x', '', '99999', '-1', '0']) : d);
    case 5: return t.split('').map(c => rnd() > 0.995 ? String.fromCharCode(Math.floor(rnd() * 31)) : c).join('');
    case 6: return t.replace(/ +/g, (s) => rnd() > 0.7 ? ' ' : s);                       // collapsed spacing
    default: return t.replace(/\n/g, rnd() > 0.5 ? '\r\n' : '\n\n');
  }
}
let n = 0, bad = 0, t0 = performance.now(), slow = 0;
const m = NM.newModel();
const N = +process.argv[2] || 150;
for (let i = 0; i < N; i++) {
  const batch = []; for (let j = 0; j < 1 + Math.floor(rnd() * 4); j++) { const [f, t] = pick(texts); batch.push({ name: f + '.' + j, text: mutate(t) }); }
  const s0 = performance.now(); if (process.env.TRACE) console.log('batch', i, batch.map(b => b.name + ':' + b.text.length).join(' '));
  try {
    const T = (x) => { if (process.env.TRACE) console.log('  stage', x); }; T('parse'); const secs = NM.parseInputs(batch); T('apply'); const rep = NM.apply(m, secs, { at: 1.8e12 + i * 1000 });
    T('view'); const v = NM.view(m, { now: 1.8e12 + i * 1000 + 5000, fresh: true }); T('search');
    NM.search(m, ['sw', '10.', 'vlan', 'aa:bb', 'x'][i % 5]); NM.csvInterfaces(m, v); NM.csvLinks(m, v); NM.healthReport(m, v);
    T('paths'); const ids = Object.keys(m.devices); if (ids.length > 1) { NM.physPaths(m, v, ids[0], ids[ids.length - 1]); NM.logicalPath(m, v, ids[0], ids[ids.length - 1]); }
    if (i % 50 === 0) { const a = NM.snapshotOf(m, 'a', 'manual', i), b = NM.snapshotOf(m, 'b', 'manual', i + 1); NM.diff(NM.snapshotModel(a), NM.snapshotModel(b), i, i + 1); NM.unpack(NM.pack(m)); }
    if (i % 97 === 0 && ids.length > 2) NM.mergeDevices(m, ids[0], ids[1]);
    if (i % 131 === 0 && ids.length > 3) NM.removeDevice(m, ids[2]);
  } catch (e) { bad++; console.log('THREW on batch', i, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); if (bad > 5) break; }
  const dt = performance.now() - s0; if (dt > 400) { slow++; console.log('slow batch', i, Math.round(dt), 'ms,', Object.keys(m.devices).length, 'devices,', batch.map(b => b.name + ':' + b.text.length).join(' ')); } n++;
}
console.log('fuzz', n, 'batches,', Object.keys(m.devices).length, 'devices,', bad, 'exceptions,', slow, 'slow batches,', Math.round(performance.now() - t0), 'ms total; Object.prototype clean:', Object.keys({}).length === 0 && ({}).cfg === undefined);
process.exit(bad ? 1 : 0);
