// Auto Arrange and the workplace v1.10 import changes, in the real page: Dell LLDP with ESXi hosts and Log Sanitizer prompts,
// a large network (146 devices), a ring, pinned devices, link labels and saved data. All names and addresses are fictional.
import { start, importText, shot, SC, wait } from './topology-lib.mjs';
const T = await start(1280, 800); const { ok, fr, J } = T;
const W = 152, H = 56;
const metrics = (names) => J(`const x = w.__nmx, W = ${W}, H = ${H}; const ns = x.nodes().filter(n => n.kind === 'device'); const C = (n) => [n.x + W / 2, n.y + H / 2];
  let overlaps = 0; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j]; if (a.x < b.x + W && b.x < a.x + W && a.y < b.y + H && b.y < a.y + H) overlaps++; }
  const segs = x.links().map(l => { const a = ns.find(n => n.id === l.from), b = ns.find(n => n.id === l.to); return a && b ? { a, b, p: C(a), q: C(b), bent: !!l.bend } : null; }).filter(Boolean);
  let through = 0; segs.forEach(s => { if (s.bent) return; for (const n of ns) { if (n === s.a || n === s.b) continue; let hit = false; for (let t = 0.05; t < 0.96; t += 0.025) { const px = s.p[0] + (s.q[0] - s.p[0]) * t, py = s.p[1] + (s.q[1] - s.p[1]) * t; if (px > n.x && px < n.x + W && py > n.y && py < n.y + H) { hit = true; break; } } if (hit) { through++; break; } } });
  const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
  return { n: ns.length, overlaps, through, width: Math.max(...xs) - Math.min(...xs) + W, height: Math.max(...ys) - Math.min(...ys) + H, pos: Object.fromEntries(ns.map(n => [n.name, [Math.round(n.x), Math.round(n.y)]])) };`);
const arrange = () => fr(`d.getElementById('nm-arrange').click(); await new Promise(r => setTimeout(r, 300)); const ok = d.getElementById('nmc-ok'); ok && d.getElementById('nmcfm').open && ok.click(); await new Promise(r => setTimeout(r, 900)); return 1;`);

// 1. Dell leaves with ESXi hosts, pasted with Log Sanitizer placeholders in the prompts
const dell = (host, rows) => host + '# show lldp neighbors\nLoc PortID          Rem Host Name          Rem Port Id                    Rem Chassis Id\n---------------------------------------------------------------------------------------\n' + rows.map((r) => r.join('    ')).join('\n') + '\n' + host + '#\n';
const paste = dell('[SITE_1]-leaf-1', [['ethernet1/1/49', '[SITE_1]-leaf-2', 'ethernet1/1/49', '90:b1:1c:f4:a9:02'], ['ethernet1/1/1', 'esx01.lab.example', 'vmnic0', '00:50:56:aa:bb:01'], ['ethernet1/1/2', 'esx02', '00:50:56:aa:bb:02', 'vmnic0'], ['ethernet1/1/3', 'Not Advertised', 'vmnic4', '00:50:56:aa:bb:03']])
  + dell('[SITE_1]-leaf-2', [['ethernet1/1/49', '[SITE_1]-leaf-1', 'ethernet1/1/49', '90:b1:1c:f4:a9:01'], ['ethernet1/1/1', 'esx01.lab.example', 'vmnic1', '00:50:56:aa:bb:01'], ['ethernet1/1/2', 'esx02', 'vmnic1', '00:50:56:aa:bb:02']]);
await importText(T, paste);
const g = await J(`const x = w.__nmx, m = x.model(), v = x.NM.view(m, {}); const nm = (id) => m.devices[id].name;
  return { devs: Object.values(m.devices).map(d => [d.name, d.kind, !!d.stub]), links: v.links.map(L => [nm(L.a.dev), L.a.ifk, nm(L.b.dev), L.b.ifk, L.status]), nodes: x.nodes().filter(n => n.kind === 'device').map(n => n.name) };`);
const dv = Object.fromEntries(g.devs.map((d) => [d[0], d]));
ok('the sanitized prompts name the two leaves', !!dv['[SITE_1]-leaf-1'] && !!dv['[SITE_1]-leaf-2'] && !dv['[SITE_1]-leaf-1'][2], g.devs);
ok('the leaf-to-leaf cable is confirmed by both ends', g.links.some((l) => l[0].includes('leaf') && l[2].includes('leaf') && l[1] === 'eth1/1/49' && l[3] === 'eth1/1/49' && l[4] === 'confirmed'), g.links);
ok('ESXi hosts are recognised from their vmnic ports, and vmnic is the remote port whichever column held it', dv['esx01.lab.example'][1] === 'esxi' && dv.esx02[1] === 'esxi' && g.links.some((l) => (l[0] === 'esx02' && l[1] === 'vmnic0') || (l[2] === 'esx02' && l[3] === 'vmnic0')), { devs: g.devs, links: g.links });
ok('no device is named "Not" or after a MAC unless nothing else is known, and no MAC is used as a port', !g.devs.some((d) => /^Not/.test(d[0])) && !g.links.some((l) => /:/.test(l[1]) || /:/.test(l[3])) && g.devs.filter((d) => /^00:50:56/.test(d[0])).every((d) => d[2]), g);
ok('one device per ESXi host and one link per vmnic, nothing doubled', g.devs.filter((d) => d[0] === 'esx01.lab.example').length === 1 && g.links.filter((l) => l.includes('esx01.lab.example')).length === 2, g.links);

// 2. importing more data does not move what is already drawn; only Auto Arrange does
await fr(`const x = w.__nmx; x.nodes().filter(n => n.kind === 'device').forEach((n, i) => { n.x = 40 + i * 200; n.y = 40; }); x.render(); return 1;`);
const before = await metrics();
await importText(T, dell('[SITE_1]-leaf-1', [['ethernet1/1/5', 'esx03', 'vmnic0', '00:50:56:aa:bb:05']]));
const after = await metrics();
ok('a later import leaves the devices already drawn where they were', Object.keys(before.pos).every((k) => JSON.stringify(before.pos[k]) === JSON.stringify(after.pos[k])) && after.n === before.n + 1, { before: before.pos, after: after.pos });
const ifs = await J(`return w.__nmx.links().map(l => [l.from, l.to, l.ifA || '', l.ifB || '', l.nm || '']).sort();`);
await arrange();
const arr = await metrics();
ok('Auto Arrange: nothing overlaps and no straight link runs through a device', arr.overlaps === 0 && arr.through === 0, arr);
ok('Auto Arrange keeps every link and its interface names', JSON.stringify(await J(`return w.__nmx.links().map(l => [l.from, l.to, l.ifA || '', l.ifB || '', l.nm || '']).sort();`)) === JSON.stringify(ifs), 0);
const P = arr.pos;
ok('the two leaves share a row and the ESXi hosts are below them', P['[SITE_1]-leaf-1'][1] === P['[SITE_1]-leaf-2'][1] && ['esx01.lab.example', 'esx02'].every((h) => P[h][1] > P['[SITE_1]-leaf-1'][1]), P);
await shot(T.ctx, SC + 'arrange-dell-esxi.png');

// 3. a large network: 2 firewalls, 2 cores, 6 distribution, 24 access, 96 end devices, 12 ESXi hosts, 4 storage arrays
const big = (() => {
  const nodes = [], links = []; let id = 0; const add = (name, type) => { nodes.push({ id: ++id, kind: 'device', name, type, x: (id * 97) % 1900, y: (id * 61) % 1300 }); return id; };
  const ln = (a, b) => links.push({ from: a, to: b, medium: 'copper' });
  const fa = add('FW-A', 'firewall'), fb = add('FW-B', 'firewall'), ca = add('CORE-A', 'core'), cb = add('CORE-B', 'core'); ln(fa, fb); ln(fa, ca); ln(fb, cb); ln(ca, cb); ln(ca, cb);
  const ends = {};
  for (let d = 1; d <= 6; d++) { const D = add('DIST-0' + d, 'switch'); ln(D, ca); ln(D, cb);
    for (let a = 1; a <= 4; a++) { const A = add(`ACC-${d}${a}`, 'switch'); ln(A, D); for (let e = 1; e <= 4; e++) { const E = add(`WS-${d}${a}${e}`, 'client'); ln(E, A); ends[`WS-${d}${a}${e}`] = `ACC-${d}${a}`; } } }
  for (let h = 1; h <= 12; h++) { const X = add('ESX-' + String(h).padStart(2, '0'), 'esxi'); ln(X, ca); ln(X, cb); }
  for (let s = 1; s <= 4; s++) { const X = add('SAN-0' + s, 'storage'); ln(X, ca); ln(X, cb); }
  return { data: { nodes, links }, ends };
})();
await fr(`w.confirm = () => true; return w.__nmx.load(${JSON.stringify(JSON.stringify(big.data))});`); await wait(400);
const t0 = await J(`const t = performance.now(); w.__nmx.arrange(); w.__nmx.render(); return performance.now() - t;`);
const L = await metrics(); console.log('146 devices: Auto Arrange took ' + Math.round(t0) + ' ms, drawing ' + L.width + ' x ' + L.height + ' px');
const far = Object.entries(big.ends).map(([e, s]) => Math.hypot(L.pos[e][0] - L.pos[s][0], L.pos[e][1] - L.pos[s][1])), farMax = Math.round(Math.max(...far));
ok('146 devices: nothing overlaps', L.n === 146 && L.overlaps === 0, { n: L.n, overlaps: L.overlaps });
ok('146 devices: every workstation is within 320 px of its own access switch, and below it', farMax <= 320 && Object.entries(big.ends).every(([e, s]) => L.pos[e][1] > L.pos[s][1]), farMax);
ok('146 devices: the drawing stays under 5000 px wide', L.width <= 5000, { width: L.width, height: L.height });
ok('146 devices: the firewalls are on top and the cores right under them', L.pos['FW-A'][1] < L.pos['CORE-A'][1] && L.pos['CORE-A'][1] === L.pos['CORE-B'][1] && L.pos['CORE-A'][1] < L.pos['DIST-01'][1], { fw: L.pos['FW-A'], core: L.pos['CORE-A'], dist: L.pos['DIST-01'] });
ok('146 devices: Auto Arrange takes under 1.5 s', t0 < 1500, t0);
await J(`w.__nmx.arrange(); return 1;`); const L2 = await metrics();
ok('146 devices: arranging again gives the same result', JSON.stringify(L2.pos) === JSON.stringify(L.pos), 0);
await fr(`w.__nmx.fit(); await new Promise(r => setTimeout(r, 300)); return 1;`); await shot(T.ctx, SC + 'arrange-large.png');

// 4. pinned devices stay, and saved JSON keeps the arranged positions
await fr(`const x = w.__nmx; const n = x.nodes().find(n => n.name === 'DIST-03'); n.x = 3000; n.y = -400; n.pin = true; return 1;`);
await J(`w.__nmx.arrange(); return 1;`); const L3 = await metrics();
ok('a pinned device keeps its place and nothing overlaps it', JSON.stringify(L3.pos['DIST-03']) === '[3000,-400]' && L3.overlaps === 0, { pin: L3.pos['DIST-03'], overlaps: L3.overlaps, pairs: await J(`const W = 152, H = 56, ns = w.__nmx.nodes().filter(n => n.kind === 'device'), out = []; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j]; if (a.x < b.x + W && b.x < a.x + W && a.y < b.y + H && b.y < a.y + H) out.push([a.name, a.x, a.y, b.name, b.x, b.y]); } return out.slice(0, 6);`) });
const saved = await J(`return w.__nmx.project();`);
await fr(`w.confirm = () => true; return w.__nmx.load(${JSON.stringify(saved)});`); await wait(300);
const L4 = await metrics();
ok('the saved project loads back with every arranged position and the pin', JSON.stringify(L4.pos) === JSON.stringify(L3.pos) && (await J(`return !!w.__nmx.nodes().find(n => n.name === 'DIST-03').pin;`)), 0);

// 5. a ring of six switches is drawn as a loop, so the closing link does not run through the ring
const ring = (() => { const nodes = [], links = []; for (let i = 1; i <= 6; i++) nodes.push({ id: i, kind: 'device', name: 'RING-SW' + i, type: 'switch', x: i * 30, y: 0 }); for (let i = 1; i <= 6; i++) links.push({ from: i, to: i % 6 + 1 }); for (let i = 1; i <= 6; i++) { nodes.push({ id: 6 + i, kind: 'device', name: 'CAM-' + i, type: 'client', x: 0, y: 0 }); links.push({ from: 6 + i, to: i }); } return { nodes, links }; })();
await fr(`w.confirm = () => true; return w.__nmx.load(${JSON.stringify(JSON.stringify(ring))});`); await wait(300);
await J(`w.__nmx.arrange(); w.__nmx.render(); return 1;`); const R = await metrics();
const rows = new Set(Object.entries(R.pos).filter(([k]) => /RING/.test(k)).map(([, p]) => p[1]));
ok('ring: the six switches are on two lines, nothing overlaps and no straight link runs through a device', rows.size === 2 && R.overlaps === 0 && R.through === 0, R);
// 6. dual-homed servers on two access switches, a PC on each switch, and an ESXi host on the core over an LACP pair: every physical link stays its own link,
// the servers sit under both switches, and each PC stays next to its own switch instead of at the far end of the server row
const dual = (() => { const nodes = [], links = []; let id = 0; const add = (name, type) => (nodes.push({ id: ++id, kind: 'device', name, type, x: 0, y: 0 }), id), ln = (a, b, ifA, ifB) => links.push({ from: a, to: b, ifA: ifA || '', ifB: ifB || '' });
  const c = add('CORE-01', 'core'), a = add('SW-A', 'switch'), b = add('SW-B', 'switch'); ln(c, a, 'Gi1/0/1', 'Gi1/0/49'); ln(c, b, 'Gi1/0/2', 'Gi1/0/49'); ln(a, b, 'Gi1/0/50', 'Gi1/0/50');
  for (let i = 1; i <= 6; i++) { const sv = add('SRV-0' + i, 'server'); ln(sv, a, 'NIC1', 'Gi1/0/' + i); ln(sv, b, 'NIC2', 'Gi1/0/' + i); }
  const esx = add('ESX-LACP', 'esxi'); ln(esx, c, 'vmnic0', 'Te1/1/1'); ln(esx, c, 'vmnic1', 'Te1/1/2');
  ln(add('PC-01', 'client'), a, '', 'Gi1/0/40'); ln(add('PC-02', 'client'), b, '', 'Gi1/0/40'); return { nodes, links }; })();
await fr(`w.confirm = () => true; return w.__nmx.load(${JSON.stringify(JSON.stringify(dual))});`); await wait(300);
const before6 = await J(`return w.__nmx.links().map(l => [l.from, l.to, l.ifA, l.ifB]).sort();`);
await J(`w.__nmx.arrange(); w.__nmx.render(); return 1;`); const D = await metrics(), P6 = D.pos;
ok('dual-homed: every physical link is still its own link, the LACP pair included', JSON.stringify(await J(`return w.__nmx.links().map(l => [l.from, l.to, l.ifA, l.ifB]).sort();`)) === JSON.stringify(before6) && before6.length === 19, before6.length);
ok('dual-homed: nothing overlaps and no straight link runs through a device', D.overlaps === 0 && D.through === 0, D);
ok('dual-homed: the servers are below both switches', [1, 2, 3, 4, 5, 6].every((i) => P6['SRV-0' + i][1] > P6['SW-A'][1] && P6['SRV-0' + i][1] > P6['SW-B'][1]), P6);
const pcd = [['PC-01', 'SW-A'], ['PC-02', 'SW-B']].map(([p, s]) => Math.round(Math.hypot(P6[p][0] - P6[s][0], P6[p][1] - P6[s][1])));
ok('dual-homed: each PC stays within 260 px of its own switch, and the LACP host near the core', pcd.every((x) => x <= 260) && Math.hypot(P6['ESX-LACP'][0] - P6['CORE-01'][0], P6['ESX-LACP'][1] - P6['CORE-01'][1]) <= 260, { pcd, esx: P6['ESX-LACP'], core: P6['CORE-01'] });
T.finish();
