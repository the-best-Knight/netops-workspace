// Switch Lab: leaving a lesson with changes asks first (audit F-01, 2026-11-05). "All tools" and a reload go through the
// hub's unsaved-work check, "← Labs" asks inside the tool. No changes, a solved lesson or a reset lesson leave quietly.
import { session } from './lib.mjs';
const S = await session();
// count every confirm() in the hub and in the tool, and answer it with the given value
const answer = (yes) => S.ev(`window.__asked = []; window.confirm = (m) => { window.__asked.push(String(m)); return ${yes}; }; const w = document.querySelector('iframe').contentWindow; w.__asked = window.__asked; w.confirm = (m) => { window.__asked.push(String(m)); return ${yes}; }; return 1;`);
const asked = () => S.ev(`return window.__asked || [];`);
const allTools = () => S.ev(`const f = document.querySelector('iframe'); const b = [...f.contentDocument.querySelectorAll('button, a')].find(x => /all tools/i.test(x.textContent)); b.click(); await new Promise(r => setTimeout(r, 700)); return location.hash;`);
const state = () => S.frame(`let mark = false; try { w.runConsoleCommand('select SW1'); w.runConsoleCommand('show running-configuration'); mark = /LEAVE-MARK/.test(d.getElementById('consoleOut').innerText); } catch (e) {} return { inLab: d.getElementById('labWorkspace').classList.contains('active'), mark };`);
const change = () => S.frame(`for (const c of ['select SW1', 'configure terminal', 'interface ethernet 1/1/2', 'description LEAVE-MARK', 'end']) w.runConsoleCommand(c); return 1;`);
const lesson = async (n) => { await S.load('#fault-lab', 2500); await S.frame(`w.startLab(${n}); await new Promise(r => setTimeout(r, 500)); return 1;`); };

await lesson(2); await answer(true);
await allTools();
S.ok('no changes yet: All tools leaves without asking', (await asked()).length === 0, await asked());

await lesson(2); await change(); await answer(false);
const h = await allTools();
const a1 = await asked();
S.ok('with changes, All tools asks first, saying the lesson is not finished', a1.length === 1 && /Leave this lesson\? It is not finished/.test(a1[0]), a1);
S.ok('answering Cancel keeps the lesson and its change', /fault-lab/.test(h) && JSON.stringify(await state()) === '{"inLab":true,"mark":true}', { h, st: await state() });

await answer(false);
await S.frame(`d.getElementById('btnBackToManager').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
S.ok('"← Labs" asks too, and Cancel keeps the lesson', (await asked()).length === 1 && (await state()).inLab, await asked());
await answer(true);
await S.frame(`d.getElementById('btnBackToManager').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
S.ok('answering OK on "← Labs" goes back to the lab list', !(await S.frame(`return d.getElementById('labWorkspace').classList.contains('active');`)), 0);

await lesson(2); await change();
const reload = await S.ev(`const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented;`);
S.ok('a reload or closing the tab is held by the browser warning while the lesson has changes', reload === true, reload);

await answer(true);
await S.frame(`w.confirm = () => true; d.getElementById('btnResetLab').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
await answer(true); await allTools();
S.ok('after Reset Lab nothing is left to lose, so leaving does not ask', (await asked()).length === 0, await asked());

await lesson(1);
await S.frame(`for (const c of ['select SW1', 'configure terminal', 'interface ethernet 1/1/1', 'no shutdown', 'end']) w.runConsoleCommand(c); await new Promise(r => setTimeout(r, 300)); w.finishLevel(); await new Promise(r => setTimeout(r, 300)); return 1;`);
const solved = await S.frame(`return d.getElementById('problemBanner').classList.contains('solved');`);
await answer(true); await allTools();
S.ok('a solved lesson leaves without asking', solved && (await asked()).length === 0, { solved, asked: await asked() });

await S.load('#fault-lab', 2500);
await S.frame(`w.xStart(w.XL[0].id, true); await new Promise(r => setTimeout(r, 500)); return 1;`);
const x0 = await S.frame(`return w.__kitUnsaved();`);
await S.frame(`w.runConsoleCommand('jump DS1'); w.runConsoleCommand('enable'); w.runConsoleCommand('configure terminal'); w.runConsoleCommand('vlan 77'); w.runConsoleCommand('end'); return 1;`);
const x1 = await S.frame(`return w.__kitUnsaved();`);
const x2 = await S.frame(`w.XS.quizOk = true; const t = w.__kitUnsaved(); w.XS.quizOk = false; return t;`);
S.ok('Extreme Mode: nothing to lose at the start, a warning after a change, none once the incident is closed', x0 === '' && /Leave this Extreme incident\?/.test(x1) && x2 === '', { x0, x1, x2 });
S.finish();
