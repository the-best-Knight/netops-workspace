// Interface names on the fictional five-switch network: where the labels land, hover and selection, and the link evidence panel.
// Label placement is judged by geometry read from the drawn SVG, not by looking at a picture.
import { start, importText, fxd, shot, SC, wait } from './topology-lib.mjs';
const T = await start(1280, 800); const { ok, fr, J } = T;
const all = ['core-01', 'dist-01', 'dist-02', 'access-01', 'access-02'].map((n) => fxd('five-switch/' + n + '.txt')).join('\n');
await importText(T, all);
await fr(`d.getElementById('nm-arrange').click(); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 800)); return 1;`);

// every drawn label: its box, its text, its link, and how it sits against links, devices and other labels
async function labels() {
  return J(`const x = w.__nmx, svg = d.getElementById('svg');
    const pts = (id) => { const g = svg.querySelector('g[data-kind=link][data-id="' + id + '"]'); if (!g) return null; const v = [...g.querySelectorAll('line, path')].filter(e => e.getAttribute('stroke') !== 'transparent' && e.getAttribute('pointer-events') === 'none' && !e.getAttribute('stroke-opacity')).pop(); if (!v) return null; const out = [];
      for (let i = 0; i <= 40; i++) { if (v.tagName === 'line') { const t = i / 40; out.push([+v.getAttribute('x1') + (v.getAttribute('x2') - v.getAttribute('x1')) * t, +v.getAttribute('y1') + (v.getAttribute('y2') - v.getAttribute('y1')) * t]); } else { const p = v.getPointAtLength(v.getTotalLength() * i / 40); out.push([p.x, p.y]); } } return out; };
    const lines = {}; x.links().forEach(l => { const p = pts(l.id); if (p) lines[l.id] = p; });
    const near = (p, c) => Math.min(...p.map(q => Math.hypot(q[0] - c[0], q[1] - c[1])));
    const where = (p, c) => { let bi = 0, bd = 1e9; p.forEach((q, i) => { const dd = Math.hypot(q[0] - c[0], q[1] - c[1]); if (dd < bd) { bd = dd; bi = i; } }); return bi / (p.length - 1); };
    const devs = x.nodes().filter(n => n.kind === 'device').map(n => ({ x: n.x, y: n.y, w: 152 * (n.scale || 1), h: 56 * (n.scale || 1) }));
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const out = [];
    svg.querySelectorAll('g[data-labels]').forEach(g => { const id = +g.getAttribute('data-labels'); g.querySelectorAll('rect').forEach(r => { const box = { x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height') }, ld = r.previousElementSibling && r.previousElementSibling.getAttribute('data-leader') ? r.previousElementSibling : null, c = ld ? [+ld.getAttribute('x2'), +ld.getAttribute('y2')] : [box.x + box.w / 2, box.y + box.h / 2], lead = ld ? Math.round(Math.hypot(ld.getAttribute('x2') - ld.getAttribute('x1'), ld.getAttribute('y2') - ld.getAttribute('y1'))) : 0;
      const own = lines[id] ? near(lines[id], c) : 1e9; let other = 1e9; Object.keys(lines).forEach(k => { if (+k !== id) other = Math.min(other, near(lines[k], c)); });
      out.push({ id, text: r.nextSibling.textContent, box, own: Math.round(own), other: Math.round(other), t: lines[id] ? where(lines[id], c) : -1, onDev: devs.some(dv => hit(box, dv)), lead }); }); });
    let overlap = 0; for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (hit(out[i].box, out[j].box)) overlap++;
    return { list: out, leaders: out.filter(l => l.lead).map(l => [l.text, l.lead]), overlap, onDev: out.filter(l => l.onDev).length, far: out.filter(l => l.lead ? l.own > 2 : l.own > l.box.h / 2 + Math.max(l.box.w, l.box.h) / 2 + 8).length, closerToOther: out.filter(l => l.other < l.own).length };`);
}
const set = (on) => fr(`const c = d.getElementById('nm-lbl'); if (c.checked !== ${on}) { c.checked = ${on}; c.dispatchEvent(new w.Event('change', { bubbles: true })); } await new Promise(r => setTimeout(r, 400)); return 1;`);

ok('interface names are off by default', await J(`return d.getElementById('nm-lbl').checked === false && w.__nmx.ui.labels === false;`), 0);
const none = await labels();
ok('with names off and nothing hovered or selected, no interface label is drawn', none.list.length === 0, none.list.length);

await set(true); await wait(300);
const ov = (on) => fr(`const c = d.getElementById('nm-ov'); if (c.checked !== ${on}) { c.checked = ${on}; c.dispatchEvent(new w.Event('change', { bubbles: true })); } await new Promise(r => setTimeout(r, 400)); return 1;`);
const ends = await J(`return w.__nmx.links().map(l => ({ id: l.id, ifA: l.ifA, ifB: l.ifB, lo: l.from < l.to }));`);
async function judge(tag, want) {
  const L = await labels();
  console.log(tag, JSON.stringify({ leaders: L.leaders, n: L.list.length, overlap: L.overlap, onDev: L.onDev, far: L.far, closerToOther: L.closerToOther }));
  ok(tag + ': both ends of every shown link are labelled (' + want + ' labels)', L.list.length === want, L.list.length);
  ok(tag + ': no two interface labels overlap', L.overlap === 0, L.list.filter((a) => L.list.some((b) => a !== b && a.box.x < b.box.x + b.box.w && b.box.x < a.box.x + a.box.w && a.box.y < b.box.y + b.box.h && b.box.y < a.box.y + a.box.h)).map((l) => l.text));
  ok(tag + ': no interface label covers a device', L.onDev === 0, L.list.filter((l) => l.onDev).map((l) => l.text));
  ok(tag + ': every label touches or sits right beside its own link, or has a short leader line to it', L.far === 0, L.list.filter((l) => l.lead ? l.own > 2 : l.own > l.box.h / 2 + Math.max(l.box.w, l.box.h) / 2 + 8).map((l) => [l.text, l.own]));
  ok(tag + ': leader lines are rare and short (at most 4, each under 90 px)', L.leaders.length <= 4 && L.leaders.every((x) => x[1] < 90), L.leaders);
  ok(tag + ': no label sits closer to another link than to its own', L.closerToOther === 0, L.list.filter((l) => l.other < l.own).map((l) => [l.text, l.own, l.other]));
  // the drawn path always starts at the link's from-device, so t < 0.5 is the from side
  const wrongEnd = [];
  ends.forEach((e) => L.list.filter((l) => l.id === e.id).forEach((l) => { const isA = l.text === e.ifA, fromSide = l.t < 0.5; if (isA !== fromSide && e.ifA !== e.ifB) wrongEnd.push([l.text, l.t]); }));
  ok(tag + ': each interface name sits on its own end of the link', wrongEnd.length === 0, wrongEnd);
  return L;
}
await judge('names on, confirmed only', 12);
await shot(T.ctx, SC + 'labels-on.png');
await ov(true);
await judge('names on, inferred shown', 24);
await shot(T.ctx, SC + 'labels-on-inferred.png');
await ov(false);

// zoomed out the labels grow to stay readable; they must still not overlap
await fr(`for (let i = 0; i < 2; i++) { d.querySelector('[aria-label="Zoom out"]').click(); await new Promise(r => setTimeout(r, 200)); } return 1;`);
const Z = await labels();
ok('zoomed out, labels still do not overlap each other or devices', Z.overlap === 0 && Z.onDev === 0, { overlap: Z.overlap, onDev: Z.onDev });
await fr(`w.__nmx.fit(); await new Promise(r => setTimeout(r, 300)); return 1;`);

// hover and select with names off
await set(false);
const linkPoint = (a, b) => `const x = w.__nmx, ns = x.nodes(); const A = ns.find(n => n.name === ${JSON.stringify(a)}), B = ns.find(n => n.name === ${JSON.stringify(b)}); const l = x.links().find(l => (l.from === A.id && l.to === B.id) || (l.from === B.id && l.to === A.id)); const el = d.querySelector('#svg g[data-kind=link][data-id="' + l.id + '"]'); const hit = el.querySelector('line, path'); const sr = d.getElementById('svg').getBoundingClientRect(), v = x.state().view; let at = null; for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) { let wx, wy; if (hit.tagName === 'line') { const x1 = +hit.getAttribute('x1'), y1 = +hit.getAttribute('y1'), x2 = +hit.getAttribute('x2'), y2 = +hit.getAttribute('y2'); wx = x1 + (x2 - x1) * t; wy = y1 + (y2 - y1) * t; } else { const p = hit.getPointAtLength(hit.getTotalLength() * t); wx = p.x; wy = p.y; } const px = sr.left + v.tx + wx * v.k, py = sr.top + v.ty + wy * v.k; const tg = d.elementFromPoint(px, py); const g = tg && tg.closest('[data-kind]'); if (g && g.getAttribute('data-kind') === 'link' && +g.getAttribute('data-id') === l.id) { at = { tg, px, py }; break; } }`;
const hover = await J(`${linkPoint('CORE-01', 'DIST-01')} if (!at) return null; at.tg.dispatchEvent(new w.PointerEvent('pointermove', { clientX: at.px, clientY: at.py, bubbles: true, pointerType: 'mouse' })); await new Promise(r => setTimeout(r, 400));
  const shown = [...d.querySelectorAll('#svg g[data-labels="' + l.id + '"] text')].map(t => t.textContent), others = d.querySelectorAll('#svg g[data-labels]:not([data-labels="' + l.id + '"])').length, tip = d.getElementById('nm-tip'); return { shown, others, tip: tip.classList.contains('hidden') ? '' : tip.textContent };`);
ok('hovering a link shows its two interface names and no others', hover && hover.shown.length === 2 && hover.shown.includes('Gi1/0/1') && hover.others === 0, hover);
ok('the hover tip names both devices and both ports, and says Confirmed', hover && /CORE-01/.test(hover.tip) && /DIST-01/.test(hover.tip) && /Gi1\/0\/1/.test(hover.tip) && /Confirmed/.test(hover.tip), hover);
await shot(T.ctx, SC + 'labels-hover.png');
const gone = await J(`d.getElementById('svg').dispatchEvent(new w.PointerEvent('pointerleave', { bubbles: false })); d.getElementById('svg').dispatchEvent(new w.PointerEvent('pointerout', { bubbles: true })); const bg = d.getElementById('svg'); const r = bg.getBoundingClientRect(); const t = d.elementFromPoint(r.left + 5, r.bottom - 5); t && t.dispatchEvent(new w.PointerEvent('pointermove', { clientX: r.left + 5, clientY: r.bottom - 5, bubbles: true, pointerType: 'mouse' })); await new Promise(r => setTimeout(r, 400)); return d.querySelectorAll('#svg g[data-labels]').length;`);
ok('moving off the link hides the names again', gone === 0, gone);

// select a confirmed switch link and an inferred end-device link; read the evidence panel
async function selectAndRead(a, b) {
  return J(`${linkPoint(a, b)} if (!at) return null; const o = { clientX: at.px, clientY: at.py, bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1 }; at.tg.dispatchEvent(new w.PointerEvent('pointerdown', o)); at.tg.dispatchEvent(new w.PointerEvent('pointerup', o)); await new Promise(r => setTimeout(r, 500));
    const box = d.querySelector('.nm-link, #pn-link'); const panel = d.getElementById('pn-link'); const t = (s) => [...panel.querySelectorAll(s)].map(e => e.textContent.trim());
    const vis = d.querySelector('#svg g[data-kind=link][data-id="' + l.id + '"]'); const line = [...vis.querySelectorAll('line, path')].filter(e => e.getAttribute('stroke') !== 'transparent' && e.getAttribute('pointer-events') === 'none' && !e.getAttribute('stroke-opacity')).pop();
    return { chip: t('.nm-chip')[0], ends: t('.nm-end b'), ports: t('.nm-end .mono'), ev: t('.nm-ev li'), src: t('.nm-ev li .nm-src'), evHead: t('.nm-ev h4')[0], note: t('.nm-note'), labels: [...d.querySelectorAll('#svg g[data-labels="' + l.id + '"] text')].map(e => e.textContent), dash: line.getAttribute('stroke-dasharray') || '' };`);
}
const sw = await selectAndRead('CORE-01', 'DIST-01');
console.log('switch link panel', JSON.stringify(sw));
ok('selecting a link shows both its interface names even with names off', sw && sw.labels.length === 2, sw);
ok('evidence panel: Confirmed, both devices and both ports', sw && sw.chip === 'Confirmed' && sw.ends.join() === 'CORE-01,DIST-01' && sw.ports.every((p) => /^(Gi|GigabitEthernet)1\/0\/1$/.test(p)), sw);
ok('evidence panel: one LLDP entry from each switch, each naming the switch that reported it', sw && sw.ev.length === 2 && sw.ev.every((e) => /^LLDP/.test(e)) && sw.ev.some((e) => /CORE-01/.test(e)) && sw.ev.some((e) => /DIST-01/.test(e)), sw && sw.ev);
ok('each evidence entry names the command it came from and where (here, pasted text)', sw && sw.src.length === 2 && sw.src.every((x) => /^Source: show lldp neighbors detail · Pasted text$/i.test(x)), sw && sw.src);
ok('a confirmed link is drawn solid', sw && sw.dash === '', sw && sw.dash);
await shot(T.ctx, SC + 'labels-select-confirmed.png');

await ov(true);
const ep = await selectAndRead('ACCESS-01', 'WS-ENG-014');
console.log('end-device link panel', JSON.stringify(ep));
ok('an end-device link reported by one side only is Inferred, and says so', ep && ep.chip === 'Inferred', ep);
ok('its evidence is a single LLDP entry from ACCESS-01, and the panel does not claim the workstation reported it', ep && ep.ev.length === 1 && /^LLDP/.test(ep.ev[0]) && /ACCESS-01/.test(ep.ev[0]), ep && ep.ev);
ok('the panel shows ACCESS-01 Gi1/0/12 at one end', ep && ep.ends.includes('ACCESS-01') && ep.ends.includes('WS-ENG-014') && ep.ports.includes('Gi1/0/12'), ep);
ok('the panel warns that matching names, VLANs or subnets never prove a cable', ep && ep.note.some((n) => /never prove a cable/.test(n)), ep && ep.note);
ok('an inferred link is drawn dashed, unlike the confirmed one', ep && ep.dash !== '' && ep.dash !== sw.dash, ep && ep.dash);
await shot(T.ctx, SC + 'labels-select-inferred.png');
T.finish();
