// Switch Lab with two tabs open (audit finding DA-01): lessons finished in different tabs are all kept, the Cisco/Dell
// choice is not overwritten by a tab that never changed it, and an open tab learns of the other tab's progress.
import { session, KIT, wait } from './lib.mjs';
import { send, goto, evalIn } from './bidi.mjs';
const S = await session();
await S.load('#fault-lab', 2500);
await S.ev(`localStorage.clear(); return 1;`);
await S.load('#fault-lab', 2500);
const B = (await send('browsingContext.create', { type: 'tab' })).context;
await goto(B, KIT + '#fault-lab'); await wait(2500);
const inB = async (code) => JSON.parse(await evalIn(B, `(async () => { const f = document.querySelector('iframe'), d = f.contentDocument, w = f.contentWindow; ${code} })().then(JSON.stringify)`));
const done = (id) => `w.eval('progress["${id}"] = { completed: true, changes: 2, hints: 0, rev: (LEVELS.find(function(l) { return String(l.id) === "${id}"; }) || {}).rev || 1 }; saveProgress(); updateOverall();'); return d.getElementById('sbOverall').textContent;`;
const stored = () => S.ev(`return { p: JSON.parse(localStorage.getItem('nfl_progress2') || '{}'), v: localStorage.getItem('nfl_vendor') };`);

const a1 = await S.frame(done(1)); const b2 = await inB(done(2));
const st = await stored();
S.ok('tab A finished lesson 1 and tab B (opened earlier, unaware) finished lesson 2: both are saved', Object.keys(st.p).sort().join() === '1,2', st);
S.ok('tab B shows both lessons as done', /^2 of/.test(b2), b2);
await wait(600);
const aNow = await S.frame(`return d.getElementById('sbOverall').textContent;`);
S.ok('tab A, still open, now shows 2 done without a reload', /^2 of/.test(aNow), aNow);

// vendor choice
await S.frame(`d.querySelector('#vendorToggle .vendor-btn[data-vendor="cisco"]').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
S.ok('choosing Cisco in tab A is saved', (await stored()).v === 'cisco', await stored());
await inB(done(3));
const st2 = await stored();
S.ok('tab B, which never changed the vendor, saves lesson 3 and leaves the choice at Cisco', st2.v === 'cisco' && Object.keys(st2.p).sort().join() === '1,2,3', st2);

// reload
await S.load('#fault-lab', 2500);
const after = await S.frame(`return { overall: d.getElementById('sbOverall').textContent, vendor: d.getElementById('statVendor') && d.getElementById('statVendor').textContent };`);
S.ok('after a reload all three lessons are still done and the vendor is Cisco', /^3 of/.test(after.overall) && /cisco/i.test(after.vendor || ''), after);

// damaged storage must not stop the lab opening
await S.ev(`localStorage.setItem('nfl_progress2', '{broken'); return 1;`);
await S.load('#fault-lab', 2500);
const dam = await S.frame(`return { overall: d.getElementById('sbOverall').textContent, cards: d.querySelectorAll('#labGrid .lab-card').length };`);
S.ok('with unreadable saved progress the lab still opens, with nothing marked done', /^0 of/.test(dam.overall) && dam.cards > 10, dam);
S.finish();
