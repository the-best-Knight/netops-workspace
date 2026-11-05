// Topology Builder autosave with two tabs in one browser (audit R-01, 2026-11-05). One tab must never silently
// overwrite or delete the copy another tab keeps. Synthetic diagrams and passphrases only; fresh browser profile.
import { connect, topContext, goto, evalIn, setViewport, send, close, logs } from './bidi.mjs';
import { KIT } from './lib.mjs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0, bad = 0;
const ok = (name, cond, extra) => { n++; if (!cond) bad++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(extra).slice(0, 500))); };
await connect(); const A = await topContext(); await setViewport(A, 1300, 900);
const B = (await send('browsingContext.create', { type: 'tab' })).context; await setViewport(B, 1300, 900);
const fr = async (ctx, expr) => JSON.parse(await evalIn(ctx, `(() => { const w = document.querySelector('iframe').contentWindow, d = w.document; return (async function(){ ${expr} })().then(JSON.stringify); })()`));
const open = async (ctx) => { await goto(ctx, 'about:blank'); await goto(ctx, KIT + '#topology-builder'); await wait(2800); };
const diagram = (ctx, name) => fr(ctx, `w.__nmx.load(JSON.stringify({ format: 'network-topology-builder', version: 2, nodes: [{ id: 1, kind: 'device', type: 'switch', name: ${JSON.stringify(name)}, x: 100, y: 100 }], links: [] })); w.__nmx.render(); return 1;`);
const histButton = (ctx, re) => fr(ctx, `w.__nmx.tab('hist'); await new Promise(r => setTimeout(r, 300)); const b = [...d.querySelectorAll('#nm-pane-hist button')].find(x => ${re}.test(x.textContent)); if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 400)); return true;`);
const cfm = (ctx) => fr(ctx, `const m = d.getElementById('nmcfm'); return m.open ? d.getElementById('nmc-title').textContent : '';`);
const cfmAnswer = (ctx, yes) => fr(ctx, `d.getElementById(${yes} ? 'nmc-ok' : 'nmc-no').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
const pass = (ctx, p) => fr(ctx, `if (!d.getElementById('enc').open) return 'no passphrase dialog'; d.getElementById('enc-pass').value = ${JSON.stringify(p)}; d.getElementById('enc-pass2').value = ${JSON.stringify(p)}; ['enc-pass', 'enc-pass2'].forEach(id => d.getElementById(id).dispatchEvent(new w.Event('input', { bubbles: true }))); d.getElementById('enc-ok').click(); await new Promise(r => setTimeout(r, 1600)); return 'ok';`);
const isOn = (ctx) => fr(ctx, `w.__nmx.tab('hist'); await new Promise(r => setTimeout(r, 200)); return [...d.querySelectorAll('#nm-pane-hist button')].some(x => /Turn off/.test(x.textContent));`);
// which passphrase opens the stored copy, and so whose diagram it is (same AES-GCM/PBKDF2 envelope the tool writes)
const whose = (ctx, p) => fr(ctx, `const rec = await new Promise((res) => { const r = w.indexedDB.open('ntb-autosave', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => { const q = r.result.transaction('p').objectStore('p').get('project'); q.onsuccess = () => res(q.result); }; }); if (!rec) return 'none';
  const env = JSON.parse(rec.env), un = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  try { const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(${JSON.stringify(p)}), 'PBKDF2', false, ['deriveKey']); const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: un(env.salt), iterations: env.iterations, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const t = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un(env.iv) }, key, un(env.data))); return /TAB-A-WORK/.test(t) ? 'A' : /TAB-B-WORK/.test(t) ? 'B' : 'other'; } catch (e) { return 'not with this passphrase'; }`);
const PA = 'synthetic-pass-A', PB = 'synthetic-pass-B';

await open(A); await open(B);
await diagram(A, 'TAB-A-WORK'); await histButton(A, /Turn on \(encrypted\)/); await pass(A, PA); await wait(500);
ok('tab A keeps its copy', (await whose(A, PA)) === 'A' && (await isOn(A)), await whose(A, PA));

await diagram(B, 'TAB-B-WORK'); await histButton(B, /Turn on \(encrypted\)/);
ok('tab B turning autosave on asks before replacing the copy tab A keeps', /Replace the copy kept in this browser/.test(await cfm(B)), await cfm(B));
await cfmAnswer(B, false);
ok('Cancel leaves tab A copy untouched and tab B off', (await whose(A, PA)) === 'A' && !(await isOn(B)), { a: await whose(A, PA), bOn: await isOn(B) });

await histButton(B, /Turn on \(encrypted\)/); await cfmAnswer(B, true); await pass(B, PB); await wait(500);
ok('after "Replace it" tab B keeps its copy', (await whose(B, PB)) === 'B' && (await isOn(B)), await whose(B, PB));

// tab A edits: its next save must not overwrite tab B's copy
await fr(A, `d.dispatchEvent(new w.Event('change')); return 1;`); await wait(5200);
ok('tab A does not overwrite the copy tab B now keeps', (await whose(B, PB)) === 'B', await whose(B, PB));
const aState = await fr(A, `return (d.getElementById('nm-auto-state') || {}).textContent || '';`);
ok('tab A stops keeping a copy and says why', !(await isOn(A)) && (/another tab/i.test(aState) || /another tab/i.test(await fr(A, `return d.body.innerText;`))), aState);

// tab A takes the copy back (asked), then tab B turns off: B must not delete A's copy
await histButton(A, /Turn on \(encrypted\)/); ok('tab A turning on again asks too', /Replace the copy/.test(await cfm(A)), await cfm(A)); await cfmAnswer(A, true); await pass(A, PA); await wait(500);
ok('tab A keeps the copy again', (await whose(A, PA)) === 'A', await whose(A, PA));
await histButton(B, /Turn off/); await wait(500);
ok('tab B turning off does not delete the copy tab A keeps', (await whose(A, PA)) === 'A', await whose(A, PA));

// reload: the copy is still offered for restore
await open(A);
ok('after a reload tab A is offered its copy', await fr(A, `const b = d.getElementById('nm-found'); return !!b && !b.classList.contains('hidden') && /kept in this browser/.test(b.innerText);`), 0);
// the owner of the copy turning off still deletes it
await fr(A, `[...d.querySelectorAll('#nm-found button')].find(x => /Restore/.test(x.textContent)).click(); await new Promise(r => setTimeout(r, 300)); return 1;`); await pass(A, PA); await wait(400);
await histButton(A, /Turn on \(encrypted\)/); ok('turning on after restoring its own copy does not ask', !(await cfm(A)), await cfm(A)); await pass(A, PA); await wait(500);
await histButton(A, /Turn off/); await wait(500);
ok('the tab that owns the copy deletes it when turning off', (await whose(A, PA)) === 'none', await whose(A, PA));

const errs = logs().filter((l) => /\[error\]/i.test(l)); console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.slice(0, 6).join('\n') : 'no console errors');
console.log((n - bad) + '/' + n + ' passed'); close(); process.exit(bad || errs.length ? 1 : 0);
