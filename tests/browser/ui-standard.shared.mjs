// The kit's written UI standard, measured on the screens added or changed in this release:
// text at least 11px, controls at least 28px tall, contrast of at least 4.5:1 against what is actually behind the text.
// Used by ui-standard.dark.test.mjs and ui-standard.light.test.mjs (run.sh gives each a dark or a light browser).
import { session } from './lib.mjs';

const AUDIT = String.raw`
  const root = ROOT_EXPR; if (!root) return { error: 'no root' };
  const view = (root.ownerDocument.defaultView);
  const parse = (c) => { const m = String(c).match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const over = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const bg = parse(view.getComputedStyle(e).backgroundColor); if (bg.a > 0) layers.push(bg); if (bg.a === 1) break; } let base = parse(view.getComputedStyle(root.ownerDocument.body).backgroundColor); if (base.a < 1) base = over(base, { r: 255, g: 255, b: 255, a: 1 }); for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return base; };
  const shown = (e) => { const cs = view.getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0 && e.getClientRects().length > 0; };
  const bad = [], small = [], short = [], seen = new Set(); let n = 0, controls = 0;
  for (const e of root.querySelectorAll('*')) {
    if (e.closest('svg') || e.closest('[hidden]') || !shown(e)) continue;
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && e.type !== 'hidden' && e.type !== 'checkbox' && e.type !== 'radio' && !e.disabled) { controls++; const h = e.getBoundingClientRect().height; if (h < 28 - 0.5) short.push(e.tagName.toLowerCase() + '#' + (e.id || e.className) + ' ' + Math.round(h) + 'px'); }
    const own = [...e.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim()).length; if (!own) continue;
    const cs = view.getComputedStyle(e), size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold);
    if (size < 11 - 0.01) small.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' ' + size + 'px "' + e.textContent.trim().slice(0, 20) + '"');
    const fg = parse(cs.color), bg = bgOf(e), eff = over({ ...fg, a: fg.a * (+cs.opacity || 1) }, bg), r = ratio(eff, bg); n++;
    if (r < (large ? 3 : 4.5)) { const key = e.tagName + '.' + e.className + '|' + e.textContent.trim().slice(0, 24); if (!seen.has(key)) { seen.add(key); bad.push({ el: e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''), text: e.textContent.trim().slice(0, 30), ratio: Math.round(r * 100) / 100 }); } }
  }
  return { checked: n, controls, bad: bad.slice(0, 10), small: small.slice(0, 8), short: short.slice(0, 8) };`;

export async function run(scheme) {
  const S = await session();
  const audit = (rootExpr) => S.frame(AUDIT.replace('ROOT_EXPR', rootExpr));
  const check = (name, r, needControls = true) => {
    S.ok(`${name}: text is at least 11px (${r.checked} text items)`, !r.error && r.small.length === 0 && r.checked > 5, r);
    S.ok(`${name}: contrast is at least 4.5:1 for normal text`, !r.error && r.bad.length === 0, r.bad);
    S.ok(`${name}: controls are at least 28px tall (${r.controls} controls)`, !r.error && r.short.length === 0 && (!needControls || r.controls > 0), r.short);
  };
  const isLight = await S.ev(`return matchMedia('(prefers-color-scheme: light)').matches;`);
  S.ok(`the browser is in ${scheme} mode`, isLight === (scheme === 'light'), isLight);

  // IPv6 calculator, with every panel showing results
  await S.load('#toolkit', 2200);
  await S.frame(`d.querySelector('.tab[data-tab="v6"]').click(); w.runV6(); w.loadV6SplitExample(); d.getElementById('v6Mac').value = '00:1A:2B:3C:4D:5E'; w.runV6Eui(); await new Promise(r => setTimeout(r, 300)); return 1;`);
  check('IPv6 calculator', await audit(`d.getElementById('pane-v6')`));
  // Connectivity Analyzer with every new kind of card
  await S.load('#ping-analyzer', 2200);
  await S.frame(`d.getElementById('paInput').value = [w.EX_MORE.mtr, w.EX_MORE.pathping, w.EX_MORE.nettest, w.EX_MORE.ps7].join('\\n'); d.getElementById('paAnalyze').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
  check('Ping Analyzer results', await audit(`d.querySelector('main')`));
  // Switch Lab: the lab list with the Free practice card, then inside free practice, then the new console help
  await S.load('#fault-lab', 2500);
  check('Fault Lab lab list', await audit(`d.getElementById('labManager')`));
  await S.frame(`d.querySelector('#labGrid .lab-card.free').click(); await new Promise(r => setTimeout(r, 600)); w.runConsoleCommand('select SW1'); w.runConsoleCommand('?'); w.runConsoleCommand('show interface ethernet 1/1/2'); await new Promise(r => setTimeout(r, 200)); return 1;`);
  check('Fault Lab free practice workspace', await audit(`d.getElementById('labWorkspace')`));
  S.finish();
}
