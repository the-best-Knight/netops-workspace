// Switch Lab: Free practice, a working network with no goal, no hints and no quiz, that never touches lab progress.
import { session } from './lib.mjs';
const S = await session();
await S.load('#fault-lab', 2500);
const run = (cmd) => S.frame(`d.getElementById('consoleOut').innerHTML = ''; w.runConsoleCommand(${JSON.stringify(cmd)}); return d.getElementById('consoleOut').innerText.split('\\n').slice(1).join('\\n');`);
// switches answer in Cisco or Linux (OS10) format, PCs in Windows format; a Windows 'Destination host/net unreachable' counts as received, so it is a failure here
const ping = async (from, ip) => { await run('select ' + from); const o = await run('ping ' + ip); return /Success rate is 100 percent|, 0% packet loss|Lost = 0 \(0% loss\)/.test(o) && !/Destination (host|net) unreachable|Request timed out/.test(o) ? 'ok' : /Success rate is 0 percent|100% packet loss|100% loss|unreachable|General failure/i.test(o) ? 'fail' : o; };

const m = await S.frame(`const cards = [...d.querySelectorAll('#labGrid .lab-card')]; const free = d.querySelector('#labGrid .lab-card.free'); return { cards: cards.length, total: d.getElementById('statTotal').textContent, free: !!free, last: cards[cards.length - 1] === free, text: free ? free.textContent.replace(/\\s+/g, ' ') : '', role: free && free.getAttribute('role'), tab: free && free.tabIndex, locked: free && free.classList.contains('locked'), completed: d.getElementById('statCompleted').textContent };`);
S.ok('the lab list has the numbered labs plus a Free practice card at the end', m.cards > Number(m.total) && m.total === '18' && m.free && m.last, m);
S.ok('the card is always open, and works from the keyboard', !m.locked && m.role === 'button' && m.tab === 0 && /Always open/.test(m.text), m);
S.ok('the card says nothing is broken and there is no goal', /Nothing is broken and there is no goal/.test(m.text), m.text);

const top = await S.frame(`const b = d.getElementById('freeTop'), r = b ? b.getBoundingClientRect() : null; return { text: b && b.textContent, shown: !!r && r.height > 0, h: r && Math.round(r.height), above: !!r && r.top < 400 };`);
S.ok('the catalog header has an Open free practice button, near the top and at least 28px tall', top.text === 'Open free practice' && top.shown && top.h >= 28 && top.above, top);
await S.frame(`d.getElementById('freeTop').click(); await new Promise(r => setTimeout(r, 700)); return 1;`);
const viaTop = await S.frame(`return { open: d.getElementById('labWorkspace').classList.contains('active'), level: d.getElementById('sbLevel').textContent };`);
S.ok('that button opens free practice', viaTop.open && viaTop.level === 'Free practice', viaTop);
await S.frame(`d.getElementById('btnBackToManager').click(); await new Promise(r => setTimeout(r, 400)); d.querySelector('#labGrid .lab-card.free').click(); await new Promise(r => setTimeout(r, 700)); return 1;`);
const ws = await S.frame(`const vis = (id) => { const e = d.getElementById(id); return !!e && e.getClientRects().length > 0 && w.getComputedStyle(e).display !== 'none' && w.getComputedStyle(e).visibility !== 'hidden'; }; return { open: d.getElementById('labWorkspace').classList.contains('active'), issue: d.getElementById('problemIssue').textContent, goal: d.getElementById('problemGoal').textContent, check: vis('btnCheckGoal'), hint: vis('btnHint'), reset: vis('btnResetLab'), level: d.getElementById('sbLevel').textContent, devices: [...d.querySelectorAll('.node')].length, goalStatusHidden: !d.getElementById('goalStatus') || d.getElementById('goalStatus').hidden, vendor: d.getElementById('sbVendor').textContent };`);
S.ok('it opens a workspace titled Free practice with no goal text', ws.open && ws.level === 'Free practice' && /nothing is broken/i.test(ws.issue) && /no goal/i.test(ws.goal) && !/^Goal:/.test(ws.goal), ws);
S.ok('Check Goal and Hint are hidden, Reset Lab is there', !ws.check && !ws.hint && ws.reset, { check: ws.check, hint: ws.hint, reset: ws.reset });
S.ok('the topology has 7 devices', ws.devices === 7, { devices: ws.devices });
S.ok('no goal status is shown', ws.goalStatusHidden, ws.goalStatusHidden);
S.ok('it starts on the default vendor (Dell)', ws.vendor === 'Dell', ws.vendor);

// it really is a working network
const flows = [['PC-A', '192.168.10.20'], ['PC-A', '192.168.20.50'], ['PC-A', '192.168.10.30'], ['PC-C', '192.168.10.10'], ['Server-1', '192.168.10.20'], ['PC-B', '192.168.20.50'], ['PC-A', '192.168.10.1'], ['PC-C', '192.168.20.1']];
for (const [from, ip] of flows) S.ok(`${from} can ping ${ip}`, (await ping(from, ip)) === 'ok', await ping(from, ip));
S.ok('a ping to an address nobody has fails', (await ping('PC-A', '192.168.99.9')) === 'fail', 1);
await run('select SW1'); await run('enable');
const vl = await run('show vlan brief');
S.ok('the switches show their VLANs and ports', /10\s+Active\s+USERS/.test(vl) && /20\s+Active\s+SERVERS/.test(vl), vl);
const tr = await run('show interface status');
S.ok('show interface status lists the trunk and the access ports', /Eth 1\/1\/3/.test(tr) && /Eth 1\/1\/1/.test(tr), tr);

// break it, see it fail, reset
await run('select SW1'); await run('enable'); await run('conf t'); await run('interface ethernet 1/1/1'); await run('shutdown'); await run('end');
S.ok('shutting PC-A\'s switch port stops its traffic', (await ping('PC-A', '192.168.10.20')) === 'fail' && (await ping('PC-B', '192.168.20.50')) === 'ok', 1);
await run('select SW1'); await run('enable'); await run('conf t'); await run('interface ethernet 1/1/3'); await run('no switchport trunk allowed vlan 10'); await run('end');
S.ok('taking VLAN 10 off the uplink trunk breaks the VLAN 10 traffic that crosses it, but not VLAN 20', (await ping('PC-B', '192.168.20.50')) === 'fail' && (await ping('PC-C', '192.168.20.50')) === 'ok', [await ping('PC-B', '192.168.20.50'), await ping('PC-C', '192.168.20.50')]);
const afterBreak = await S.frame(`return { success: d.getElementById('successModal').classList.contains('show'), quiz: d.getElementById('quizModal').classList.contains('show'), met: d.getElementById('problemBanner').classList.contains('met') || d.getElementById('problemBanner').classList.contains('solved') };`);
S.ok('changes never produce a "goal met", a quiz or a success screen', !afterBreak.success && !afterBreak.quiz && !afterBreak.met, afterBreak);
await S.frame(`w.confirm = () => true; d.getElementById('btnResetLab').click(); await new Promise(r => setTimeout(r, 500)); return 1;`);
S.ok('Reset Lab puts everything back (PC-A reaches PC-B and Server-1 again)', (await ping('PC-A', '192.168.10.20')) === 'ok' && (await ping('PC-A', '192.168.20.50')) === 'ok', 1);
S.ok('Reset Lab is worded for free practice', await S.frame(`let msg = ''; w.confirm = (m) => { msg = m; return false; }; d.getElementById('btnResetLab').click(); return /working state/.test(msg);`), 1);

// progress is untouched, and the numbered labs still behave
const prog = await S.frame(`return { stored: w.localStorage.getItem('nfl_progress'), completed: d.getElementById('statCompleted').textContent };`);
S.ok('free practice never records progress', (prog.stored === null || !/free/.test(prog.stored)) && prog.completed === '0', prog);
await S.frame(`d.getElementById('btnBackToManager').click(); await new Promise(r => setTimeout(r, 400)); w.startLab(1); await new Promise(r => setTimeout(r, 600)); return 1;`);
const lab1 = await S.frame(`const vis = (id) => { const e = d.getElementById(id); return !!e && e.getClientRects().length > 0 && w.getComputedStyle(e).display !== 'none' && w.getComputedStyle(e).visibility !== 'hidden'; }; return { check: vis('btnCheckGoal'), hint: vis('btnHint'), level: d.getElementById('sbLevel').textContent, goal: d.getElementById('problemGoal').textContent, issue: d.getElementById('problemIssue').textContent };`);
S.ok('Lab 1 still shows Check Goal, Hint, its goal text and "Ticket 1 of 6"', lab1.check && lab1.hint && lab1.level === 'Ticket 1 of 6' && /^Goal: /.test(lab1.goal), lab1);
const solved = await S.frame(`w.runConsoleCommand('select SW1'); w.runConsoleCommand('enable'); w.runConsoleCommand('conf t'); w.runConsoleCommand('interface ethernet 1/1/1'); w.runConsoleCommand('no shutdown'); w.runConsoleCommand('end'); w.runConsoleCommand('select PC-A'); w.runConsoleCommand('ping 192.168.10.20'); await new Promise(r => setTimeout(r, 2500)); d.getElementById('btnCheckGoal').click(); await new Promise(r => setTimeout(r, 1200)); return { quiz: d.getElementById('quizModal').classList.contains('show'), met: d.getElementById('problemBanner').classList.contains('met') };`);
S.ok('Lab 1 is still solved the normal way (goal met, run the test, Verify, then the quiz appears)', solved.met && solved.quiz, solved);
S.finish();
