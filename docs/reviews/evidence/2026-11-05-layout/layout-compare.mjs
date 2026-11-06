// Runs the Auto Arrange layout code of several builds on the same graphs and scores the result.
// usage: node layout-compare.mjs A=/path/a.html B=/path/b.html C=/path/c.html [--svg outdir] [--json out.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fixtures } from './fixtures.mjs';
const W = 152, H = 56, GRID = 20;
const NMX_TYPE = { firewall: 'firewall', router: 'router', core: 'core', switch: 'switch', esxi: 'esxi', idrac: 'bmc', ilo: 'bmc', server: 'server', vm: 'vm', mgmt: 'mgmt', ap: 'custom', phone: 'custom', endpoint: 'client' };
const args = process.argv.slice(2), builds = [], opt = {};
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) opt[a.slice(2)] = args[++i]; else { const [k, v] = a.split('='); builds.push([k, v]); } }

function layoutCode(file) {
  const html = readFileSync(file, 'utf8'), open = '<script type="text/plain" id="src-topology-builder">', s = html.indexOf(open);
  const block = html.slice(s + open.length, html.indexOf('</script>', s)).replaceAll('<\\/', '</');
  const a = block.indexOf('  var NMX_RANK'), b = block.indexOf('  function nmxArrange(');
  if (a < 0 || b < 0) throw new Error('layout code not found in ' + file);
  return block.slice(a, b);
}
function makeRunner(file) {
  const code = layoutCode(file);
  const f = new Function('ctx', `var links = ctx.links, nmUi = { overlay: false }, DEV_W = ${W}, DEV_H = ${H}, GRID = ${GRID}, stage = { clientWidth: 1280, clientHeight: 800 };
    var nmModel = { devices: ctx.devices }, NMX_TYPE = { firewall: "firewall", router: "router", core: "core", switch: "switch", esxi: "esxi", idrac: "bmc", ilo: "bmc", server: "server", vm: "vm", mgmt: "mgmt", ap: "custom", phone: "custom", endpoint: "client" }; function nmxView() { return { byKey: {} }; } function nmxDevOf(n) { return n && n.nm ? nmModel.devices[n.nm] : null; }
    ${code}\n; return nmxLayered(ctx.list);`);
  return (list, links, devices) => f({ list, links, devices });
}

let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function build(fx, shuffle) {
  const devices = {}, list = fx.nodes.map((n, i) => { devices['d' + i] = { kind: n.kind, name: n.name }; return { id: i + 1, nm: 'd' + i, name: n.name, type: n.kind === 'cloud' ? 'cloud' : NMX_TYPE[n.kind] || 'custom', kind: 'device', x: 0, y: 0, _t: n.tier }; });
  const id = Object.fromEntries(list.map((n) => [n.name, n.id]));
  let links = fx.links.map((l, i) => ({ id: 'l' + i, from: id[l.a], to: id[l.b] }));
  let order = list.slice();
  if (shuffle) { seed = shuffle; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } links = links.slice().sort(() => rnd() - 0.5); }
  return { list: order, links, devices, all: list };
}
const snap = (v) => Math.round(v / GRID) * GRID;

function score(fx, res, links) {
  const P = {}; res.forEach((o) => { P[o.n.id] = { x: snap(o.x), y: snap(o.y), n: o.n }; });
  const ns = Object.values(P), C = (p) => [p.x + W / 2, p.y + H / 2];
  let overlaps = 0; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j]; if (a.x < b.x + W && b.x < a.x + W && a.y < b.y + H && b.y < a.y + H) overlaps++; }
  // one straight segment per connected pair (parallel links share a path)
  const pairs = {}; links.forEach((l) => { const k = Math.min(l.from, l.to) + '_' + Math.max(l.from, l.to); pairs[k] = pairs[k] || { a: P[l.from], b: P[l.to] }; });
  const segs = Object.values(pairs).map((s) => ({ ...s, p: C(s.a), q: C(s.b) }));
  const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
  let cross = 0; for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) { const s = segs[i], t = segs[j]; if (s.a === t.a || s.a === t.b || s.b === t.a || s.b === t.b) continue; if (ccw(s.p, t.p, t.q) !== ccw(s.q, t.p, t.q) && ccw(s.p, s.q, t.p) !== ccw(s.p, s.q, t.q)) cross++; }
  let through = 0; segs.forEach((s) => { for (const n of ns) { if (n === s.a || n === s.b) continue; let hit = false; for (let t = 0.05; t < 0.96; t += 0.025) { const px = s.p[0] + (s.q[0] - s.p[0]) * t, py = s.p[1] + (s.q[1] - s.p[1]) * t; if (px > n.x - 6 && px < n.x + W + 6 && py > n.y - 6 && py < n.y + H + 6) { hit = true; break; } } if (hit) { through++; break; } } });
  const lens = segs.map((s) => Math.hypot(s.p[0] - s.q[0], s.p[1] - s.q[1])).sort((a, b) => a - b), med = lens[Math.floor(lens.length / 2)] || 0;
  // visible length between the two boxes: interface labels sit near each end and need room
  const vis = segs.map((s) => { const dx = Math.abs(s.p[0] - s.q[0]), dy = Math.abs(s.p[1] - s.q[1]), L = Math.hypot(dx, dy) || 1; const cut = Math.min(dx ? (W / 2) / (dx / L) : 1e9, dy ? (H / 2) / (dy / L) : 1e9); return L - 2 * cut; });
  const shortLbl = vis.filter((v) => v < 78).length;
  // hierarchy: a link whose upper-tier end is drawn lower than its lower-tier end
  let hv = 0, hn = 0; segs.forEach((s) => { const ta = s.a.n._t, tb = s.b.n._t; if (ta === tb) return; hn++; const up = ta < tb ? s.a : s.b, dn = ta < tb ? s.b : s.a; if (up.y > dn.y) hv++; });
  // tier rows: devices of the same tier whose rows differ (lower is better when the graph allows it)
  // end devices: distance to their nearest neighbour
  const adj = {}; segs.forEach((s) => { (adj[s.a.n.id] = adj[s.a.n.id] || []).push(s.b); (adj[s.b.n.id] = adj[s.b.n.id] || []).push(s.a); });
  const ep = ns.filter((n) => n.n._t >= 5 && adj[n.n.id]).map((n) => Math.min(...adj[n.n.id].map((m) => Math.hypot(m.x - n.x, m.y - n.y))));
  const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y), cw = Math.max(...xs) - Math.min(...xs) + W, ch = Math.max(...ys) - Math.min(...ys) + H;
  return { overlaps, cross, through, totalLen: Math.round(lens.reduce((a, b) => a + b, 0)), maxLen: Math.round(lens[lens.length - 1] || 0), longLinks: lens.filter((l) => l > 2.5 * med).length,
    shortLbl, hierViol: hv, hierLinks: hn, epMean: ep.length ? Math.round(ep.reduce((a, b) => a + b, 0) / ep.length) : 0, epMax: ep.length ? Math.round(Math.max(...ep)) : 0,
    width: cw, height: ch, fitK: +Math.min(1, (1280 - 80) / cw, (800 - 80) / ch).toFixed(2), pos: Object.fromEntries(ns.map((n) => [n.n.name, [n.x, n.y]])) };
}
function svg(fx, r, links, title) {
  const ns = Object.entries(r.pos), byName = Object.fromEntries(ns), x0 = Math.min(...ns.map(([, p]) => p[0])) - 40, y0 = Math.min(...ns.map(([, p]) => p[1])) - 60;
  const kindOf = Object.fromEntries(fx.nodes.map((n) => [n.name, n.kind])), col = { cloud: '#888', firewall: '#cf3c46', router: '#1d6fd6', core: '#1d6fd6', switch: '#178a58', esxi: '#6a4bd6', server: '#6a4bd6', ap: '#b8860b', phone: '#b8860b', endpoint: '#5b6b7a', unknown: '#999' };
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width + 80}" height="${r.height + 100}" viewBox="${x0} ${y0} ${r.width + 80} ${r.height + 100}" font-family="sans-serif"><rect x="${x0}" y="${y0}" width="100%" height="100%" fill="#fff"/>`;
  s += `<text x="${x0 + 10}" y="${y0 + 22}" font-size="14">${title}: overlaps ${r.overlaps}, crossings ${r.cross}, through ${r.through}, ${r.width}x${r.height}</text>`;
  const seen = {}; fx.links.forEach((l) => { const k = [l.a, l.b].sort().join('|'); if (seen[k]) return; seen[k] = 1; const a = byName[l.a], b = byName[l.b]; s += `<line x1="${a[0] + W / 2}" y1="${a[1] + H / 2}" x2="${b[0] + W / 2}" y2="${b[1] + H / 2}" stroke="#777" stroke-width="1.5" ${l.status === 'inferred' ? 'stroke-dasharray="5 4"' : ''}/>`; });
  ns.forEach(([n, p]) => { s += `<rect x="${p[0]}" y="${p[1]}" width="${W}" height="${H}" rx="4" fill="#f4f7fa" stroke="${col[kindOf[n]] || '#999'}" stroke-width="2"/><text x="${p[0] + 8}" y="${p[1] + 22}" font-size="12">${n.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text><text x="${p[0] + 8}" y="${p[1] + 40}" font-size="10" fill="#555">${kindOf[n]}</text>`; });
  return s + '</svg>';
}

const out = {}, F = fixtures();
for (const [name, file] of builds) {
  const run = makeRunner(file); out[name] = {};
  for (const fx of F) {
    const b = build(fx), t0 = performance.now(); let res; const reps = fx.nodes.length > 100 ? 5 : 20;
    for (let i = 0; i < reps; i++) res = run(b.list.map((n) => ({ ...n })), b.links, b.devices);
    const ms = (performance.now() - t0) / reps, r = score(fx, res, b.links);
    // same graph, devices and links given in a different order: how many devices move
    let moved = 0; for (const sh of [7, 99, 12345]) { const b2 = build(fx, sh), r2 = score(fx, run(b2.list.map((n) => ({ ...n })), b2.links, b2.devices), b2.links); moved = Math.max(moved, Object.keys(r.pos).filter((k) => r.pos[k][0] !== r2.pos[k][0] || r.pos[k][1] !== r2.pos[k][1]).length); }
    const again = score(fx, run(b.list.map((n) => ({ ...n })), b.links, b.devices), b.links);
    r.repeatable = JSON.stringify(again.pos) === JSON.stringify(r.pos); r.orderMoved = moved; r.ms = +ms.toFixed(2);
    out[name][fx.name] = r;
    if (opt.svg) { mkdirSync(opt.svg, { recursive: true }); writeFileSync(`${opt.svg}/${fx.name}-${name}.svg`, svg(fx, r, b.links, `${name} ${fx.name}`)); }
  }
}
const cols = ['overlaps', 'cross', 'through', 'hierViol', 'epMean', 'epMax', 'totalLen', 'longLinks', 'shortLbl', 'width', 'height', 'fitK', 'orderMoved', 'ms'];
for (const fx of F) {
  console.log('\n' + fx.name + ` (${fx.nodes.length} devices, ${fx.links.length} links)`);
  console.log('     ' + cols.map((c) => c.padStart(9)).join(''));
  for (const [name] of builds) { const r = out[name][fx.name]; console.log(name.padEnd(5) + cols.map((c) => String(c === 'hierViol' ? r[c] + '/' + r.hierLinks : r[c]).padStart(9)).join('') + (r.repeatable ? '' : '  NOT REPEATABLE')); }
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(out, (k, v) => (k === 'pos' ? undefined : v), 1));
