// Auto-arrange on the fictional five-switch network, imported from CLI text only (tests/fixtures/five-switch).
// The layout is judged by numbers: overlaps, hierarchy, distance of end devices from their switch, link crossings, and the zoom Fit needs.
import { start, importText, fxd, shot, SC, wait } from './topology-lib.mjs';
const T = await start(1280, 800); const { ok, fr, J } = T;
const all = ['core-01', 'dist-01', 'dist-02', 'access-01', 'access-02'].map((n) => fxd('five-switch/' + n + '.txt')).join('\n');
await importText(T, all);
const SWITCHES = ['CORE-01', 'DIST-01', 'DIST-02', 'ACCESS-01', 'ACCESS-02'];
const ENDS = { 'Server-01': 'CORE-01', 'Printer-3F': 'DIST-01', 'IP-Phone-Conf': 'DIST-02', 'AP-LOBBY': 'ACCESS-01', 'WS-ENG-014': 'ACCESS-01', 'ENG-WS-027': 'ACCESS-02' };

// what the importer made from the text alone, before any layout
const graph = await J(`const x = w.__nmx, m = x.model(), v = x.NM.view(m, {}); const nm = (id) => m.devices[id].name;
  return { devices: Object.values(m.devices).map(d => [d.name, d.kind]), links: v.links.map(L => [nm(L.a.dev), L.a.ifk, nm(L.b.dev), L.b.ifk, L.status]) };`);
const sw = (a, ai, b, bi) => graph.links.find((l) => (l[0] === a && l[1] === ai && l[2] === b && l[3] === bi) || (l[0] === b && l[1] === bi && l[2] === a && l[3] === ai));
const EXPECT = [['CORE-01', 'gi1/0/1', 'DIST-01', 'gi1/0/1'], ['CORE-01', 'gi1/0/2', 'DIST-02', 'gi1/0/1'], ['CORE-01', 'te1/1/1', 'ACCESS-01', 'te1/1/1'], ['DIST-01', 'gi1/0/2', 'DIST-02', 'gi1/0/2'], ['DIST-01', 'te1/1/1', 'ACCESS-02', 'te1/1/1'], ['DIST-02', 'te1/1/1', 'ACCESS-01', 'te1/1/2']];
ok('the importer builds exactly the six switch links, each confirmed by both ends', EXPECT.every((e) => { const l = sw(...e); return l && l[4] === 'confirmed'; }) && graph.links.filter((l) => l[4] === 'confirmed').length === 6, graph.links);
const epLinks = graph.links.filter((l) => l[4] !== 'confirmed');
ok('the six end devices are inferred (one-sided), never confirmed', epLinks.length === 6 && epLinks.every((l) => l[4] === 'inferred') && Object.entries(ENDS).every(([e, s]) => epLinks.some((l) => (l[0] === e && l[2] === s) || (l[2] === e && l[0] === s))), epLinks);
const kinds = Object.fromEntries(graph.devices);
ok('LLDP capabilities decide the end-device kind, not the name: station is an end device, never a switch', kinds['Server-01'] === 'endpoint' && kinds['WS-ENG-014'] === 'endpoint' && kinds['Printer-3F'] === 'endpoint' && kinds['AP-LOBBY'] === 'ap' && kinds['IP-Phone-Conf'] === 'phone' && SWITCHES.every((s) => /switch|core/.test(kinds[s])), kinds);

async function metrics() {
  return J(`const x = w.__nmx, W = 152, H = 56; const ns = x.nodes().filter(n => n.kind === 'device'); const by = Object.fromEntries(ns.map(n => [n.name, n]));
    const C = (n) => [n.x + W / 2, n.y + H / 2];
    let overlaps = 0; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j]; if (a.x < b.x + W && b.x < a.x + W && a.y < b.y + H && b.y < a.y + H) overlaps++; }
    const segs = x.links().map(l => { const a = x.nodes().find(n => n.id === l.from), b = x.nodes().find(n => n.id === l.to); return a && b ? { a, b, p: C(a), q: C(b), bent: !!l.bend } : null; }).filter(Boolean);
    const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
    let cross = 0; for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) { const s = segs[i], t = segs[j]; if (s.a === t.a || s.a === t.b || s.b === t.a || s.b === t.b) continue; if (ccw(s.p, t.p, t.q) !== ccw(s.q, t.p, t.q) && ccw(s.p, s.q, t.p) !== ccw(s.p, s.q, t.q)) cross++; }
    let through = 0; segs.forEach(s => ns.forEach(n => { if (n === s.a || n === s.b || s.bent) return; for (let t = 0.05; t < 0.96; t += 0.05) { const px = s.p[0] + (s.q[0] - s.p[0]) * t, py = s.p[1] + (s.q[1] - s.p[1]) * t; if (px > n.x && px < n.x + W && py > n.y && py < n.y + H) { through++; break; } } }));
    const len = segs.reduce((a, s) => a + Math.hypot(s.p[0] - s.q[0], s.p[1] - s.q[1]), 0);
    return { overlaps, cross, through, totalLink: Math.round(len), k: +x.state().view.k.toFixed(2), pos: Object.fromEntries(ns.map(n => [n.name, [Math.round(n.x), Math.round(n.y)]])) };`);
}
const arrange = () => fr(`d.getElementById('nm-arrange').click(); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 800)); return 1;`);

// scatter the devices first, as a user's hand-placed diagram might be, then arrange
await fr(`const x = w.__nmx; x.nodes().filter(n => n.kind === 'device').forEach((n, i) => { n.x = (i * 337) % 900; n.y = (i * 211) % 600; }); x.render(); x.fit(); await new Promise(r => setTimeout(r, 300)); return 1;`);
const before = await metrics(); await shot(T.ctx, SC + 'five-before.png');
await arrange(); await wait(300);
const after = await metrics(); await shot(T.ctx, SC + 'five-after.png');
console.log('before', JSON.stringify({ ...before, pos: undefined }), '\nafter ', JSON.stringify({ ...after, pos: undefined })); console.log(JSON.stringify(after.pos));
const P = after.pos;
ok('no two devices overlap', after.overlaps === 0, after);
ok('hierarchy: CORE-01 above both DIST switches, which are above both ACCESS switches', P['CORE-01'][1] < P['DIST-01'][1] && P['CORE-01'][1] < P['DIST-02'][1] && P['DIST-01'][1] < P['ACCESS-02'][1] && P['DIST-02'][1] < P['ACCESS-01'][1] && P['DIST-01'][1] === P['DIST-02'][1], P);
const dist = Object.entries(ENDS).map(([e, s]) => [e, Math.round(Math.hypot(P[e][0] - P[s][0], P[e][1] - P[s][1]))]);
ok('every end device is within 260 px of its own switch and below it', Object.entries(ENDS).every(([e, s]) => P[e][1] > P[s][1] && Math.hypot(P[e][0] - P[s][0], P[e][1] - P[s][1]) <= 260), dist);
ok('no straight link passes through a device it does not connect to (links that would are drawn bent around it)', after.through === 0, after);
ok('link crossings are fewer than before and at most 2', after.cross <= before.cross && after.cross <= 2, { before: before.cross, after: after.cross });
ok('Fit zooms in to at least 60 percent for this network in a 1280x800 window', after.k >= 0.6, after);
ok('the arranged diagram is a good deal shorter in total link length than the scattered one', after.totalLink < before.totalLink, { before: before.totalLink, after: after.totalLink });

// repeatable, and pinned devices stay put
await arrange(); const again = await metrics();
ok('arranging twice gives the same result', JSON.stringify(again.pos) === JSON.stringify(after.pos), { a: after.pos, b: again.pos });
await fr(`const x = w.__nmx; const n = x.nodes().find(n => n.name === 'DIST-02'); n.x = 1000; n.y = 40; n.pin = true; x.render(); return 1;`);
await arrange(); const pinned = await metrics();
ok('a pinned device keeps its place and nothing overlaps it', JSON.stringify(pinned.pos['DIST-02']) === '[1000,40]' && pinned.overlaps === 0, pinned.pos);
ok('arranging does not change the links or the view settings', await J(`const x = w.__nmx; return x.links().length >= 12 && x.ui.overlay === false && x.ui.view === 'physical';`), 0);
T.finish();
