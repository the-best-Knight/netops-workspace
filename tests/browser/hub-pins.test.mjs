// Main menu: tools are alphabetical inside their two groups, arrow keys move between cards and never stop on a star,
// Ctrl + S pins and unpins the selected card (and nothing else), and the star stays reachable with Tab and the mouse.
import { session } from './lib.mjs';
const S = await session();
const active = () => S.ev(`const a = document.activeElement; const c = a && a.closest && a.closest('.card'); return { id: c ? c.dataset.id : null, cls: a ? a.className : '', tag: a ? a.tagName : '', hs: a ? a.id : '' };`);
const focusCard = (id, part = '.card-title') => S.ev(`document.querySelector('.card[data-id="${id}"] ${part}').focus(); return 1;`);
const pinned = () => S.ev(`return JSON.parse(localStorage.getItem('itSkillsKitPins') || '[]');`);
const pressed = (id) => S.ev(`const b = document.querySelector('.card[data-id="${id}"] .pin'); return { on: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label') };`);

// --- order: all 13 tools, alphabetical inside Work Tools and Practice
await S.setViewport(1500, 950); await S.load('', 1500);
const groups = await S.ev(`const out = []; let cur = null; for (const el of document.getElementById('cardGrid').children) { if (el.classList.contains('group-label')) { cur = { label: el.textContent, titles: [], ids: [] }; out.push(cur); } else if (el.classList.contains('card')) { cur.titles.push(el.querySelector('.card-title').textContent); cur.ids.push(el.dataset.id); } } return out;`);
const WORK = ['Cheat Sheet', 'Config Compare', 'Connectivity Analyzer', 'Log Sanitizer', 'Network Calculator', 'Network Reference', 'Script Library', 'Topology Builder'];
const PRACTICE = ['DNS Lab (Domain Name System)', 'Firewall Rules Lab', 'Routing Lab', 'Switch Lab', 'vSphere Sandbox'];
S.ok('two groups: Work Tools and Practice & Training', groups.length === 2 && groups[0].label === 'Work Tools' && /^Practice/.test(groups[1].label), groups.map((g) => g.label));
S.ok('Work Tools are the eight tools in alphabetical order', JSON.stringify(groups[0].titles) === JSON.stringify(WORK), groups[0].titles);
S.ok('Practice has the five labs in alphabetical order', JSON.stringify(groups[1].titles) === JSON.stringify(PRACTICE), groups[1].titles);
S.ok('all 13 tools appear exactly once', new Set([...groups[0].ids, ...groups[1].ids]).size === 13 && groups[0].ids.length + groups[1].ids.length === 13, groups);
S.ok('tool ids are unchanged', JSON.stringify(groups[0].ids) === JSON.stringify(['practice-ref', 'config-diff', 'ping-analyzer', 'log-sanitizer', 'toolkit', 'osi-ref', 'script-repo', 'topology-builder']) && JSON.stringify(groups[1].ids) === JSON.stringify(['dns-lab', 'firewall-lab', 'routing-lab', 'fault-lab', 'vsphere-sandbox']), groups.map((g) => g.ids));

// --- the stars stay in the Tab order
await focusCard('config-diff'); await S.press('Tab');
let at = await active();
S.ok('Tab from a card title reaches that card\'s star button', at.id === 'config-diff' && /\bpin\b/.test(at.cls), at);
await S.press('Tab'); at = await active();
S.ok('Tab from the star goes on to the next card\'s title', at.id === 'ping-analyzer' && /card-title/.test(at.cls), at);

// --- arrow keys visit cards only, never a star, across three widths and in all four directions
for (const [w, h] of [[1500, 950], [900, 800], [420, 800]]) {
  await S.setViewport(w, h); await S.load('', 1500);
  await focusCard('practice-ref');
  let onPin = 0, steps = 0; const seen = new Set();
  for (const k of ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'End', 'ArrowUp', 'ArrowLeft', 'Home']) {
    await S.press(k); await S.wait(120); const a = await active(); steps++; if (/\bpin\b/.test(a.cls)) onPin++; if (a.id) seen.add(a.id);
  }
  S.ok(`${w}: ${steps} arrow presses never stop on a star button`, onPin === 0 && seen.size >= 4, { onPin, seen: [...seen] });
  const v = await S.ev(`return [...document.querySelectorAll('.pin')].every((b) => b.tabIndex === 0 && b.offsetParent !== null);`);
  S.ok(`${w}: every star is still a visible, tabbable button`, v === true, v);
  // a star reached with Tab hands the arrows back to the cards
  await focusCard('practice-ref', '.pin'); await S.press('ArrowDown'); await S.wait(130); at = await active();
  S.ok(`${w}: Down from a star lands on a card title`, /card-title/.test(at.cls) && at.id && at.id !== 'practice-ref', at);
}

// --- Enter opens the focused tool
await S.setViewport(1500, 950); await S.load('', 1500);
await focusCard('log-sanitizer'); await S.press('ArrowDown'); await S.wait(130); await S.press('ArrowDown'); await S.wait(130);
at = await active(); await S.press('Enter'); await S.wait(900);
const opened = await S.ev(`return { hash: location.hash.slice(1), ws: !document.getElementById('workspace').hidden };`);
S.ok('Enter opens the tool that has focus after arrow navigation', opened.ws && opened.hash === at.id, { at, opened });

// --- Ctrl + S pins and unpins the selected card, keeps focus, announces it, leaves the other cards alone
await S.ev(`localStorage.removeItem('itSkillsKitPins'); return 1;`); await S.load('', 1500);
await focusCard('dns-lab'); await S.chord('s'); await S.wait(250);
S.ok('Ctrl+S on a selected card pins it', JSON.stringify(await pinned()) === '["dns-lab"]', await pinned());
let st = await pressed('dns-lab');
S.ok('the star shows it at once (aria-pressed and label)', st.on === 'true' && /^Unpin /.test(st.label), st);
at = await active();
S.ok('focus stays on the same card title', at.id === 'dns-lab' && /card-title/.test(at.cls), at);
const msg = await S.ev(`return document.getElementById('uxStatus').textContent;`);
S.ok('the change is announced', /Pinned DNS Lab/.test(msg), msg);
const quick = await S.ev(`return document.getElementById('quick').textContent;`);
S.ok('the Pinned row shows it', /Pinned/.test(quick) && /DNS Lab/.test(quick), quick);
const orderAfter = await S.ev(`return [...document.querySelectorAll('#cardGrid .card')].map((c) => c.dataset.id);`);
S.ok('pinning does not move any card', JSON.stringify(orderAfter) === JSON.stringify([...groups[0].ids, ...groups[1].ids]), orderAfter);
await S.chord('s'); await S.wait(250);
S.ok('Ctrl+S again unpins it', JSON.stringify(await pinned()) === '[]', await pinned());
st = await pressed('dns-lab'); S.ok('and the star shows it', st.on === 'false' && /^Pin /.test(st.label), st);
await focusCard('routing-lab', '.pin'); await S.chord('s'); await S.wait(250);
at = await active();
S.ok('Ctrl+S with a star focused pins that card and keeps focus on the star', JSON.stringify(await pinned()) === '["routing-lab"]' && /\bpin\b/.test(at.cls) && at.id === 'routing-lab', { p: await pinned(), at });

// --- favourites survive a reload, and a click on a star still works
await S.load('', 1500);
st = await pressed('routing-lab'); S.ok('the pin survives a reload', st.on === 'true', st);
await S.ev(`document.querySelector('.card[data-id="toolkit"] .pin').click(); return 1;`); await S.wait(250);
S.ok('clicking a star still toggles it', JSON.stringify((await pinned()).sort()) === '["routing-lab","toolkit"]', await pinned());

// --- Ctrl + S is left alone while typing, in a dialog, and inside a tool
const prevented = (target) => S.ev(`const t = ${target}; if (!t) return 'missing'; t.focus(); const e = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }); t.dispatchEvent(e); return e.defaultPrevented;`);
await S.load('', 1500); const before = await pinned();
S.ok('Ctrl+S in the search box is not intercepted', await prevented(`document.getElementById('homeSearch')`) === false, 1);
S.ok('Ctrl+S on the page body (no card selected) is not intercepted', await prevented(`document.body`) === false, 1);
S.ok('Ctrl+S on a card is intercepted', await prevented(`document.querySelector('.card[data-id="dns-lab"] .card-title')`) === true, 1);
await S.ev(`document.querySelector('.card[data-id="dns-lab"] .card-title').focus(); return 1;`);
await S.ev(`localStorage.setItem('itSkillsKitPins', JSON.stringify(${JSON.stringify(before)})); return 1;`);
await S.load('#log-sanitizer', 2200);
const inTool = await S.frame(`const t = d.getElementById('rawInput') || d.querySelector('textarea'); t.focus(); const e = new w.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }); t.dispatchEvent(e); return e.defaultPrevented;`);
S.ok('Ctrl+S inside an embedded tool is not intercepted', inTool === false, inTool);
const inToolBody = await S.frame(`d.body.focus(); const e = new w.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }); d.body.dispatchEvent(e); return e.defaultPrevented;`);
S.ok('Ctrl+S on a tool page outside a text field is not intercepted either', inToolBody === false, inToolBody);
S.ok('no pin changed while checking those', JSON.stringify(await pinned()) === JSON.stringify(before), { before, now: await pinned() });
await S.load('', 1500); await S.ev(`document.getElementById('helpBtnHub').click(); return 1;`); await S.wait(300);
const help = await S.ev(`return document.getElementById('helpTool').innerText;`);
S.ok('hub Help documents the arrow keys, Enter and Ctrl + S', /arrow keys/i.test(help) && /Enter opens/.test(help) && /Ctrl \+ S/.test(help), help.slice(0, 400));
const tip = await S.ev(`return document.getElementById('searchHint').textContent;`);
S.ok('the hub tip mentions Ctrl S', /Ctrl\s*S/.test(tip), tip);

// --- search: only the visible cards take part, the cards come back in order afterwards
await S.load('', 1500);
await S.ev(`const h = document.getElementById('homeSearch'); h.focus(); h.value = 'dns'; h.dispatchEvent(new Event('input', { bubbles: true })); return 1;`); await S.wait(300);
const hidden = await S.ev(`return document.getElementById('homeBody').hidden;`);
S.ok('while searching, the card grid is hidden and not part of the arrow navigation', hidden === true, hidden);
await S.press('ArrowDown'); await S.wait(100);
at = await active(); S.ok('Down in the search box moves within the results, not onto a hidden card', at.id !== 'dns-lab' || at.hs === 'homeSearch', at);
await S.ev(`const h = document.getElementById('homeSearch'); h.value = ''; h.dispatchEvent(new Event('input', { bubbles: true })); return 1;`); await S.wait(300);
const back = await S.ev(`return [...document.querySelectorAll('#cardGrid .card-title')].map((a) => a.textContent);`);
S.ok('clearing the search shows the same alphabetical order again', JSON.stringify(back) === JSON.stringify([...WORK, ...PRACTICE]), back);
S.finish();
