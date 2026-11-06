// Switch Lab: an unfinished lesson survives a reload of the same tab and is offered back on the lab list. A resumed lesson
// is not finished until its test passes; Reset and Discard throw the copy away; damaged or altered copies are ignored;
// console text is never kept.
import { session } from './lib.mjs';
const S = await session();
const KEY = 'nfl_resume_v1';
const open = async () => { await S.load('#fault-lab', 2500); await S.frame(`w.confirm = () => true; return 1;`); };
const bar = () => S.frame(`const b = d.getElementById('resumeBar'); return { shown: !!b && !b.hidden && b.getClientRects().length > 0, text: b && b.textContent, stored: w.sessionStorage.getItem('${KEY}') };`);
const lesson1 = async () => S.frame(`d.querySelector('#labGrid .lab-card[data-lesson="1"]').click(); await new Promise(r => setTimeout(r, 700)); w.confirm = () => true; return 1;`);

await open();
let b = await bar();
S.ok('a first visit offers nothing to resume', !b.shown && !b.stored, b);
await lesson1();
await S.frame(`w.runConsoleCommand('select SW1'); w.runConsoleCommand('show version'); w.runConsoleCommand('configure terminal'); w.runConsoleCommand('interface ethernet1/1/1'); w.runConsoleCommand('no shutdown'); w.runConsoleCommand('end'); return 1;`);
const kept = await S.frame(`return w.sessionStorage.getItem('${KEY}');`);
S.ok('the change is kept in this tab', !!kept && JSON.parse(kept).changeCount > 0 && JSON.parse(kept).level === 1, kept && kept.slice(0, 200));
S.ok('no console text is kept, only the network and its counts', !/show version|configure terminal|no shutdown/.test(kept), 'console text found');

await open();
b = await bar();
S.ok('after a reload the lab list offers the unfinished lesson, with its vendor and changes', b.shown && /Ticket 1, /.test(b.text) && /Dell/.test(b.text) && /change/.test(b.text), b);
await S.frame(`d.getElementById('resumeGo').click(); await new Promise(r => setTimeout(r, 700)); return 1;`);
const r = await S.frame(`return { open: d.getElementById('labWorkspace').classList.contains('active'), issue: d.getElementById('problemIssue').textContent, port: w.eval("JSON.stringify(net.devices.sw1.ifaces['ethernet1/1/1'] || net.devices.sw1.ifaces['Gi0/1'] || {})"), console: d.getElementById('consoleOut').innerText, solved: d.getElementById('problemBanner').classList.contains('solved'), changes: w.eval('changeCount') };`);
S.ok('Resume opens the same lesson with the switch change back', r.open && /PC-A/.test(r.issue) && !/"admin":"down"/.test(r.port) && r.changes > 0, r);
S.ok('the console starts empty apart from a note, so no old commands come back', /Resumed where you left off/.test(r.console) && !/show version/.test(r.console), r.console);
S.ok('a resumed lesson is not finished', !r.solved && !(JSON.parse((await S.frame(`return w.localStorage.getItem('nfl_progress2') || '{}';`)))[1] || {}).completed, r);
await S.frame(`d.getElementById('btnCheckGoal').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
const q = await S.frame(`return { quiz: d.getElementById('quizModal').classList.contains('show'), toast: (d.getElementById('toast') || {}).textContent || d.body.innerText.match(/Run the test[^.]*\\./)?.[0] || '' };`);
S.ok('Check Goal on the resumed fix still asks for the test first, no question yet', !q.quiz, q);

await S.frame(`d.getElementById('btnResetLab').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
S.ok('Reset Lab throws the kept copy away', !(await bar()).stored, await bar());

// Discard
await S.frame(`w.runConsoleCommand('select SW1'); w.runConsoleCommand('configure terminal'); w.runConsoleCommand('interface ethernet1/1/1'); w.runConsoleCommand('no shutdown'); w.runConsoleCommand('end'); return 1;`);
await open();
await S.frame(`d.getElementById('resumeDrop').click(); await new Promise(r => setTimeout(r, 200)); return 1;`);
b = await bar();
S.ok('Discard hides the offer and throws the copy away, and the focus moves on', !b.shown && !b.stored && (await S.frame(`return d.activeElement && d.activeElement.id;`)) === 'freeTop', b);

// damaged and altered copies
await S.frame(`w.sessionStorage.setItem('${KEY}', '{not json'); return 1;`); await open(); b = await bar();
S.ok('a damaged copy is ignored and removed', !b.shown && !b.stored, b);
const fake = JSON.stringify({ v: 1, level: 1, vendor: 'dell', changeCount: 2, startupCfg: {}, net: { devices: { 'pc-a': { id: 'pc-a', name: '<img src=x onerror=alert(1)>', type: 'pc', ifaces: {} } }, links: [] } });
await S.frame(`w.sessionStorage.setItem('${KEY}', ${JSON.stringify(fake)}); return 1;`); await open(); b = await bar();
S.ok('a copy that does not match the lesson (renamed device, missing cables) is ignored and removed', !b.shown && !b.stored, b);
await S.frame(`w.sessionStorage.setItem('${KEY}', JSON.stringify({ v: 1, level: 999, vendor: 'dell', changeCount: 1, net: { devices: {}, links: [] } })); return 1;`); await open(); b = await bar();
S.ok('a copy for a lesson that does not exist is ignored and removed', !b.shown && !b.stored, b);

// the leave warning still asks, and now says how to come back
await lesson1();
await S.frame(`w.runConsoleCommand('select SW1'); w.runConsoleCommand('configure terminal'); w.runConsoleCommand('interface ethernet1/1/1'); w.runConsoleCommand('description lab-note'); w.runConsoleCommand('end'); return 1;`);
const warn = await S.frame(`return w.__kitUnsaved();`);
S.ok('leaving still asks first, and says the lesson can be resumed from this tab', /Leave this lesson\? It is not finished/.test(warn) && /resume/.test(warn) && /tab/.test(warn), warn);
S.finish();
