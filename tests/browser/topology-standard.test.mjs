// the kit's written standard, measured: text size, control size, corner scale
import { start, importText, LAB_CFGS, LAB_SESS, shot, SC, wait, fxd } from './topology-lib.mjs';
const T = await start(1500, 950); const { ok, fr, J, ctx } = T;
await importText(T, LAB_CFGS() + '\n' + LAB_SESS());
const audit = (sel) => J(`
  const root = d.querySelector(${JSON.stringify(sel)}); const out = { small: [], tiny: [], radius: [], n: 0 };
  const px = (v) => parseFloat(v) || 0;
  const step = (h) => h < 28 ? [8] : h < 60 ? (h > 48 ? [14, 20] : [14]) : h < 160 ? (h > 148 ? [20, 26] : h < 72 ? [14, 20] : [20]) : [26];
  for (const e of root.querySelectorAll('*')) {
    if (e.closest('svg') || e.closest('.hidden') || (!e.offsetParent && w.getComputedStyle(e).position !== 'fixed')) continue;
    const cs = w.getComputedStyle(e), r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const own = [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()); out.n++;
    if (own && px(cs.fontSize) < 11) out.small.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' ' + cs.fontSize + ' "' + e.textContent.trim().slice(0, 16) + '"');
    const isCtl = /^(BUTTON|SELECT)$/.test(e.tagName) || (e.tagName === 'INPUT' && /^(text|search|number|password|datetime-local)$/.test(e.type));
    if (isCtl && r.height < 27.5 && !e.disabled) out.tiny.push(e.tagName.toLowerCase() + '#' + e.id + '.' + String(e.className).split(' ')[0] + ' ' + Math.round(r.height) + 'px "' + (e.textContent || e.placeholder || '').trim().slice(0, 16) + '"');
    const bg = cs.backgroundColor, hasBg = bg && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg), hasBorder = px(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
    if ((hasBg || hasBorder) && r.height >= 14 && r.width >= 14 && !/^(INPUT|SELECT|OPTION|PROGRESS|TEXTAREA)$/.test(e.tagName)) {
      const rad = px(cs.borderTopLeftRadius); if (rad >= r.height / 2 - 1) continue;
      if (px(cs.borderTopLeftRadius) === 0 && px(cs.borderTopRightRadius) === 0 && !(px(cs.borderBottomLeftRadius))) { if (!cs.borderLeftWidth || px(cs.borderLeftWidth) >= 3) continue; }
      const ok = [8, 10, 12, 16].some(s => Math.abs(s - rad) <= 1); // the kit's radius scale: 8 small, 10 code, 12 controls, 16 cards
      if (!ok && !(e.closest('.menu') && rad >= 14)) out.radius.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' ' + Math.round(r.height) + 'px r=' + rad);
    }
  }
  out.radius = [...new Set(out.radius)].slice(0, 12); out.small = [...new Set(out.small)].slice(0, 10); out.tiny = [...new Set(out.tiny)].slice(0, 10);
  return out;`);
await fr(`w.__nmx.fit(); const n = w.__nmx.nodes().find(n => n.name === 'SW-CORE1'); const g = d.querySelector('#svg g[data-kind=device][data-id="' + n.id + '"] rect'); const r = g.getBoundingClientRect(); const t = d.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1 }; t.dispatchEvent(new w.PointerEvent('pointerdown', o)); t.dispatchEvent(new w.PointerEvent('pointerup', o)); await new Promise(r => setTimeout(r, 400)); return 1;`);
const roots = [['device panel', '#nm-dev'], ['view bar', '#nm-bar'], ['toolbar search', '.nm-search'], ['tabs', '#nm-tabs']];
for (const [name, sel] of roots) { const a = await audit(sel); ok('standard: ' + name + ' (' + a.n + ' elements)', !a.small.length && !a.tiny.length && !a.radius.length, a); }
for (const tab of ['health', 'vlan', 'path', 'hist']) {
  await fr(`d.getElementById('nm-tab-${tab}').click(); await new Promise(r => setTimeout(r, 300)); ${tab === 'path' ? "const x = w.__nmx, m = x.model(); const id = (n) => Object.values(m.devices).find(d => d.name === n).id; const p = d.getElementById('nm-pane-path'); const sels = p.querySelectorAll('select'); sels[0].value = id('esx01'); sels[0].dispatchEvent(new w.Event('change')); sels[1].value = id('FW1'); sels[1].dispatchEvent(new w.Event('change')); [...p.querySelectorAll('button')].find(b => b.textContent === 'Trace').click(); await new Promise(r => setTimeout(r, 300));" : ''} ${tab === 'hist' ? "[...d.querySelectorAll('#nm-pane-hist button')].find(b => b.textContent === 'Save snapshot').click(); await new Promise(r => setTimeout(r, 200)); [...d.querySelectorAll('#nm-pane-hist .nm-snap button')].find(b => /Compare/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 300));" : ''} return 1;`);
  const a = await audit('#nm-pane-' + tab); ok('standard: ' + tab + ' tab (' + a.n + ' elements)', !a.small.length && !a.tiny.length && !a.radius.length, a);
}
await fr(`d.getElementById('nm-import').click(); await new Promise(r => setTimeout(r, 300)); const ta = d.getElementById('nmi-text'); ta.value = ${JSON.stringify(fxd('core1-session.txt') + '\nhello this is junk\n')}; ta.dispatchEvent(new w.Event('input', { bubbles: true })); d.getElementById('nmi-read').click(); for (let i = 0; i < 60 && !d.querySelector('#nmi-rows .nmi-row'); i++) await new Promise(r => setTimeout(r, 150)); await new Promise(r => setTimeout(r, 400)); return 1;`);
const da = await audit('#nmimp'); ok('standard: import dialog (' + da.n + ' elements)', !da.small.length && !da.tiny.length && !da.radius.length, da);
const prim = await J(`return { read: d.getElementById('nmi-read').classList.contains('on'), apply: d.getElementById('nmi-apply').classList.contains('on') };`);
ok('one primary button at a time in the import dialog (Apply once something is read)', prim.apply && !prim.read, prim);
T.finish();
