// Helpers for the Topology Builder browser tests (import dialog, contrast audit, fixtures).
// shared helpers for the topology builder tests
import { connect, topContext, goto, evalIn, setViewport, press, shot, close, logs } from './bidi.mjs';
import { readFileSync } from 'node:fs';
import { KIT } from './lib.mjs';
export { KIT };
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
// screenshots some tests take go to the system temp folder, never into the repo
export const SC = tmpdir() + '/kit-test-shots/';
mkdirSync(SC, { recursive: true });
export const fxd = (n) => readFileSync(new URL('../fixtures/' + n, import.meta.url), 'utf8');
import { wait } from './lib.mjs';
export { wait };
export { shot, press, close, logs };
// the builder opens with a sample network; these tests start from an empty diagram
export async function clearSample(ctx) { await evalIn(ctx, `(async () => { const w = document.querySelector('iframe').contentWindow; w.confirm = () => true; w.document.getElementById('b-clear').click(); await new Promise(r => setTimeout(r, 300)); const ok = w.document.getElementById('nmc-ok'); if (w.document.getElementById('nmcfm').open) ok.click(); await new Promise(r => setTimeout(r, 400)); return 1; })()`); }
export async function start(w = 1500, h = 950) {
  await connect(); const ctx = await topContext(); await setViewport(ctx, w, h);
  let n = 0, bad = 0;
  const ok = (name, cond, extra) => { n++; if (!cond) bad++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(extra).slice(0, 600))); };
  const fr = (expr) => evalIn(ctx, `(() => { const w = document.querySelector('iframe').contentWindow, d = w.document; return (async function(){ ${expr} })().then(JSON.stringify); })()`);
  const J = async (expr) => JSON.parse(await fr(expr));
  await goto(ctx, 'about:blank'); await goto(ctx, KIT + '#topology-builder'); await wait(2800); await clearSample(ctx);
  const finish = () => { const errs = logs().filter(l => /\[error\]/i.test(l)); console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no console errors'); console.log((n - bad) + '/' + n + ' passed'); close(); process.exit(bad || errs.length ? 1 : 0); };
  return { ctx, ok, fr, J, finish, count: () => ({ n, bad }) };
}
// paste a text through the real import dialog and apply it
export async function importText(T, text, opts = {}) {
  await T.fr(`const x = w.__nmx; d.getElementById('nm-import').click(); await new Promise(r => setTimeout(r, 200)); const ta = d.getElementById('nmi-text'); ta.value = ${JSON.stringify(text)}; ta.dispatchEvent(new w.Event('input', { bubbles: true })); ${opts.at ? `d.getElementById('nmi-at').value = ${JSON.stringify(opts.at)};` : ''} d.getElementById('nmi-read').click(); for (let i = 0; i < 80 && !d.querySelector('#nmi-rows .nmi-row'); i++) await new Promise(r => setTimeout(r, 150)); await new Promise(r => setTimeout(r, 300)); return 1;`);
  if (opts.beforeApply) await opts.beforeApply();
  await T.fr(`d.getElementById('nmi-apply').click(); await new Promise(r => setTimeout(r, 700)); d.getElementById('nmi-close').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
}
export const LAB_CFGS = () => ['sw-core1.cfg', 'sw-acc1.cfg', 'sw-acc2.cfg', 'dell-s1.cfg', 'fw1-config.set'].map(fxd).join('\n');
export const LAB_SESS = () => ['core1-session.txt', 'acc1-session.txt', 'fw1-session.txt', 'esx01-session.txt', 'dell-s1-session.txt'].map(fxd).join('\n');
// contrast of every visible text leaf under a root, against the colour actually behind it
export async function auditContrast(T, rootSel) {
  return T.J(`
    const root = d.querySelector(${JSON.stringify(rootSel)}); if (!root) return { error: 'no root' };
    const parse = (c) => { const m = String(c).match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const over = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const bg = parse(w.getComputedStyle(e).backgroundColor); if (bg.a > 0) layers.push(bg); if (bg.a === 1) break; } let base = parse(w.getComputedStyle(d.body).backgroundColor); if (base.a < 1) base = over(base, { r: 255, g: 255, b: 255, a: 1 }); for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return base; };
    const bad = [], seen = new Set(); let n = 0;
    for (const e of root.querySelectorAll('*')) {
      if (e.closest('svg') || e.closest('.hidden') || e.closest(':disabled') || e.closest('[aria-disabled=true]') || !e.offsetParent && w.getComputedStyle(e).position !== 'fixed') continue;
      const own = [...e.childNodes].filter(c => c.nodeType === 3 && c.textContent.trim()).length; if (!own) continue;
      const cs = w.getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fg = parse(cs.color), bg = bgOf(e), size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold);
      const eff = over({ ...fg, a: fg.a * (+cs.opacity || 1) }, bg); const r = ratio(eff, bg); n++;
      if (r < (large ? 3 : 4.5)) { const key = e.tagName + '.' + e.className + '|' + e.textContent.trim().slice(0, 24); if (!seen.has(key)) { seen.add(key); bad.push({ el: e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''), text: e.textContent.trim().slice(0, 30), ratio: Math.round(r * 100) / 100, fg: cs.color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round) + ')' }); } }
    }
    return { checked: n, bad: bad.slice(0, 14) };`);
}
