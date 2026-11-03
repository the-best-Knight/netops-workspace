// existing behaviour, security and storage
import { start, importText, LAB_CFGS, LAB_SESS, shot, SC, wait, press, fxd } from './topology-lib.mjs';
import { readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
const DL = (process.env.KIT_DL || SC + 'ff/dl').replace(/\/?$/, '/');
const T = await start(); const { ok, fr, J, ctx } = T;
// Every file with network details is saved encrypted: pick a method, type a passphrase, press Encrypt and save.
const PASS = 'correct horse battery staple';
const chooseMethod = `await new Promise(r => setTimeout(r, 400)); const m = d.querySelector('input[name=encm][value="600000"]'); m.click(); await new Promise(r => setTimeout(r, 150)); d.getElementById('encm-next').click(); await new Promise(r => setTimeout(r, 300));`;
const typePass = `const p = d.getElementById('enc-pass'), p2 = d.getElementById('enc-pass2'); p.value = ${JSON.stringify(PASS)}; p2.value = ${JSON.stringify(PASS)}; p.dispatchEvent(new w.Event('input', { bubbles: true })); p2.dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); d.getElementById('enc-ok').click(); await new Promise(r => setTimeout(r, 1500));`;
const exportEnc = (k) => fr(`d.querySelector('#exportMenu summary').click(); await new Promise(r => setTimeout(r, 150)); d.querySelector('[data-exp=${k}]').click(); ${chooseMethod} ${typePass} return 1;`);
const decryptFile = async (path) => {
  const env = JSON.parse(readFileSync(path, 'utf8')), b = (x) => Buffer.from(x, 'base64');
  const km = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(PASS), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(env.salt), iterations: env.iterations, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: b(env.iv) }, key, b(env.data)));
};
const SECRETS = ['LabRO123', '$9$abcdEFGHijklMNOP', '0822455D0A16', '$9$zzzzzzzz', 'Dell-Lab-RO', '$6$abcdefgh', 'n4032-ro', '$5$abcdefgh'];

// ---- hand drawing still works exactly as before ----
const boot = await J(`return { nodes: w.__nmx.counts().nodes, empty: !d.getElementById('empty').classList.contains('hidden') };`);
ok('an empty builder shows its empty state with Import data on it', boot.nodes === 0 && boot.empty, boot);
await fr(`d.querySelector('#palette [data-add=switch]').click(); await new Promise(r => setTimeout(r, 200)); d.querySelector('#palette [data-add=router]').click(); await new Promise(r => setTimeout(r, 200)); d.querySelector('#palette [data-add=firewall]').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
const added = await J(`return w.__nmx.nodes().map(n => n.type + ':' + n.name);`);
ok('clicking a palette item adds that device', added.length === 3 && added[0].startsWith('switch') && added[1].startsWith('router'), added);
await fr(`const n = w.__nmx.nodes()[0]; const x = w.__nmx; const sel = (id) => d.querySelector('#svg g[data-kind=device][data-id="' + id + '"] rect'); const r = sel(n.id).getBoundingClientRect(); const o = { clientX: r.left + 20, clientY: r.top + 20, bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1 }; d.elementFromPoint(r.left + 20, r.top + 20).dispatchEvent(new w.PointerEvent('pointerdown', o)); d.elementFromPoint(r.left + 20, r.top + 20).dispatchEvent(new w.PointerEvent('pointerup', o)); await new Promise(r => setTimeout(r, 300)); const nm = d.getElementById('d-name'); nm.value = 'Edge-SW'; nm.dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); return 1;`);
const ren = await J(`return w.__nmx.nodes()[0].name;`);
ok('the properties panel still renames a device', ren === 'Edge-SW', ren);
// connect two devices
await fr(`d.getElementById('toast').classList.remove('show'); const ns = w.__nmx.nodes(); d.getElementById('m-connect').click(); const pt = (n) => { const r = d.querySelector('#svg g[data-kind=device][data-id="' + n.id + '"] rect').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }; const [ax, ay] = pt(ns[0]), [bx, by] = pt(ns[1]); const svg = d.getElementById('svg'); const o = (X, Y) => ({ clientX: X, clientY: Y, bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1 }); d.elementFromPoint(ax, ay).dispatchEvent(new w.PointerEvent('pointerdown', o(ax, ay))); for (let i = 1; i <= 6; i++) svg.dispatchEvent(new w.PointerEvent('pointermove', o(ax + (bx - ax) * i / 6, ay + (by - ay) * i / 6))); svg.dispatchEvent(new w.PointerEvent('pointerup', o(bx, by))); await new Promise(r => setTimeout(r, 400)); d.getElementById('m-select').click(); return 1;`);
const lk = await J(`const l = w.__nmx.links()[0]; return { count: w.__nmx.links().length, nm: l && l.nm, label: d.getElementById('l-label') && d.getElementById('pn-link').classList.contains('hidden') ? 'hidden' : 'shown', bound: d.getElementById('pn-link').classList.contains('nm-bound'), nmBox: d.getElementById('nm-link').classList.contains('hidden') };`);
ok('Connect still draws a plain cable, with the classic link fields and no network panel', lk.count === 1 && !lk.nm && !lk.bound && lk.nmBox, lk);
await fr(`const l = d.getElementById('l-label'); l.value = '10G trunk'; l.dispatchEvent(new w.Event('input', { bubbles: true })); const m = d.getElementById('l-medium'); m.value = 'fiber'; m.dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); return 1;`);
const lk2 = await J(`const l = w.__nmx.links()[0]; return { label: l.label, medium: l.medium };`);
ok('cable label and medium still work', lk2.label === '10G trunk' && lk2.medium === 'fiber', lk2);
await fr(`d.getElementById('b-undo').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
const ur0 = await J(`return w.__nmx.links().length;`);
await fr(`d.getElementById('b-redo').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
const ur = await J(`return w.__nmx.links().length;`);
ok('Undo and Redo still step through edits', ur0 === 0 && ur === 1, { ur0, ur });
// zoom, pan
const z0 = await J(`return w.__nmx.state().view.k;`);
await fr(`d.getElementById('z-in').click(); d.getElementById('z-in').click(); await new Promise(r => setTimeout(r, 200)); return 1;`);
const z1 = await J(`return w.__nmx.state().view.k;`);
await fr(`const svg = d.getElementById('svg'); svg.dispatchEvent(new w.WheelEvent('wheel', { deltaX: 0, deltaY: 100, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 200)); return 1;`);
const pan = await J(`return w.__nmx.state().view.ty;`);
ok('zoom and pan still work', z1 > z0 && typeof pan === 'number', { z0, z1, pan });
// export the classic file: no network section when there is no network data
rmSync(DL, { recursive: true, force: true }); 
await exportEnc('json');
const files = existsSync(DL) ? readdirSync(DL) : [];
const jf = files.find(f => /topology-.*\.enc$/.test(f)); const jt = jf ? JSON.parse(await decryptFile(DL + jf)) : null;
ok('a hand-drawn diagram still exports the classic file (version 1, no network section)', jt && jt.version === 1 && jt.format === 'network-topology-builder' && !jt.network && jt.nodes.length === 3, { files, version: jt && jt.version });
// legacy file opens
const legacy = { format: 'network-topology-builder', version: 1, nodes: [{ id: 1, kind: 'device', type: 'router', name: 'R-OLD', x: 100, y: 100, ip: '10.0.0.1' }, { id: 2, kind: 'device', type: 'switch', name: 'SW-OLD', x: 400, y: 100 }], links: [{ from: 1, to: 2, label: 'Gi0/1', medium: 'copper', status: 'down' }] };
await fr(`w.__nmx.load(${JSON.stringify(JSON.stringify(legacy))}); await new Promise(r => setTimeout(r, 400)); return 1;`);
const lg = await J(`const x = w.__nmx; return { nodes: x.nodes().map(n => n.name), links: x.links().length, status: x.links()[0].status, model: Object.keys(x.model().devices).length };`);
ok('a version 1 file opens as before, with no network data', lg.nodes.join() === 'R-OLD,SW-OLD' && lg.links === 1 && lg.status === 'down' && lg.model === 0, lg);
await fr(`d.getElementById('b-sample').click(); await new Promise(r => setTimeout(r, 200)); d.querySelector('#importMenu summary').click(); d.getElementById('b-sample').click(); await new Promise(r => setTimeout(r, 500)); return 1;`);
const sm = await J(`return w.__nmx.counts();`);
ok('the sample network still loads', sm.nodes >= 10 && sm.links >= 10, sm);
// classic importer still reads a neighbour table
await fr(`d.querySelector('#importMenu summary').click(); d.getElementById('b-paste').click(); await new Promise(r => setTimeout(r, 300)); const ta = d.getElementById('imp-text'); ta.value = 'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\\nSW9.lab.local    Gig 1/0/1         150          R S I     WS-C3850  Gig 1/0/24\\n'; ta.dispatchEvent(new w.Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 600)); return 1;`);
const cl = await J(`return { status: d.getElementById('imp-status').textContent, ok: !d.getElementById('imp-ok').disabled, label: d.getElementById('imp-ok').textContent };`);
ok('the classic importer still reads pasted neighbour output', /CDP/.test(cl.status) && cl.ok, cl);
await fr(`d.getElementById('imp-ok').click(); await new Promise(r => setTimeout(r, 500)); return 1;`);
const cl2 = await J(`return w.__nmx.nodes().some(n => /SW9/.test(n.name));`);
ok('...and adds the device', cl2, cl2);

// ---- security: nothing secret anywhere, nothing stored by default ----
await fr(`d.getElementById('b-clear').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
await importText(T, LAB_CFGS() + '\n' + LAB_SESS());
await fr(`w.__nmx.fit(); d.getElementById('nm-tab-health').click(); await new Promise(r => setTimeout(r, 200)); d.getElementById('nm-tab-hist').click(); await new Promise(r => setTimeout(r, 200)); d.getElementById('nm-tab-props').click(); return 1;`);
const leak = await J(`const secrets = ${JSON.stringify(SECRETS)}; const body = d.documentElement.innerText + d.documentElement.innerHTML; const x = w.__nmx; const proj = x.project(); const csv = ['csvDevices', 'csvInterfaces', 'csvVlans', 'csvLinks', 'csvDown', 'csvUnresolved'].map(f => x.NM[f](x.model(), x.view())).join('\\n') + x.NM.healthReport(x.model(), x.view()); let store = ''; try { for (const k of Object.keys(w.localStorage)) store += k + '=' + w.localStorage.getItem(k) + '\\n'; for (const k of Object.keys(w.sessionStorage)) store += k + '=' + w.sessionStorage.getItem(k) + '\\n'; } catch (e) {} return { page: secrets.filter(s => body.indexOf(s) >= 0), project: secrets.filter(s => proj.indexOf(s) >= 0), csv: secrets.filter(s => csv.indexOf(s) >= 0), storeHasNetwork: /SW-CORE1|10\\.0\\.99|esx01/.test(store), storeKeys: Object.keys(w.localStorage).length, raw: Object.keys(x.model().raw).length };`);
ok('no password, community string or hash appears on the page, in the project file or in any export', leak.page.length === 0 && leak.project.length === 0 && leak.csv.length === 0, leak);
ok('nothing about the network is written to browser storage by default', !leak.storeHasNetwork, leak);
ok('no raw text is kept by default', leak.raw === 0, leak);
const idb = await J(`return await new Promise(res => { try { const r = w.indexedDB.open('ntb-autosave'); r.onsuccess = () => { const db = r.result; const has = db.objectStoreNames.contains('p'); if (!has) { res({ exists: false }); return; } const q = db.transaction('p').objectStore('p').count(); q.onsuccess = () => res({ exists: true, count: q.result }); }; r.onerror = () => res({ error: true }); } catch (e) { res({ error: String(e) }); } });`);
ok('the encrypted browser copy is off, and nothing is stored in IndexedDB', !idb.exists || idb.count === 0, idb);
// keep one output's text: secrets are masked
await fr(`d.getElementById('nm-import').click(); await new Promise(r => setTimeout(r, 300)); const ta = d.getElementById('nmi-text'); ta.value = ${JSON.stringify(fxd('sw-core1.cfg'))}; ta.dispatchEvent(new w.Event('input', { bubbles: true })); d.getElementById('nmi-read').click(); for (let i = 0; i < 60 && !d.querySelector('#nmi-rows .nmi-row'); i++) await new Promise(r => setTimeout(r, 150)); await new Promise(r => setTimeout(r, 300)); const cb = d.querySelector('#nmi-rows .nmi-keep input'); cb.click(); d.getElementById('nmi-apply').click(); await new Promise(r => setTimeout(r, 600)); d.getElementById('nmi-close').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
const kept = await J(`const x = w.__nmx; const raws = Object.values(x.model().raw); const secrets = ${JSON.stringify(SECRETS)}; return { n: raws.length, redactions: raws[0] && raws[0].redactions, secrets: secrets.filter(s => raws.some(r => r.text.indexOf(s) >= 0)), has: raws[0] && /hostname SW-CORE1/.test(raws[0].text), masked: raws[0] && /<redacted>/.test(raws[0].text) };`);
ok('a copy is kept only when asked for, and its secrets are masked', kept.n === 1 && kept.redactions >= 3 && kept.secrets.length === 0 && kept.has && kept.masked, kept);
// saving a project that holds a kept copy asks about encryption
await fr(`d.querySelector('#exportMenu summary').click(); await new Promise(r => setTimeout(r, 200)); d.querySelector('[data-exp=json]').click(); await new Promise(r => setTimeout(r, 600)); return 1;`);
const encAsk = await J(`const e = d.getElementById('enc-method'); return { open: e.open, text: e.textContent.slice(0, 200) };`);
ok('saving a project with a kept copy asks how to protect it first', encAsk.open && /encrypted/i.test(encAsk.text), encAsk);
await shot(ctx, SC + 'nm10-enc.png');
rmSync(DL, { recursive: true, force: true });
await fr(`${chooseMethod} ${typePass} return 1;`);
const files2 = existsSync(DL) ? readdirSync(DL) : [];
const jf2 = files2.find(f => /topology-.*\.enc$/.test(f)); const txt2 = jf2 ? await decryptFile(DL + jf2) : '';
ok('the saved project holds the model but none of the secrets', jf2 && /"version": ?2/.test(txt2.slice(0, 200)) && !SECRETS.some(s => txt2.indexOf(s) >= 0), { files2, len: txt2.length });

// ---- exports ----
rmSync(DL, { recursive: true, force: true });
for (const k of ['net-devices', 'net-ifaces', 'net-vlans', 'net-links', 'net-down', 'net-unres', 'net-health', 'csv', 'svg', 'png-light']) { if (k === 'svg' || k === 'png-light') await fr(`d.querySelector('#exportMenu summary').click(); await new Promise(r => setTimeout(r, 150)); d.querySelector('[data-exp=${k}]').click(); await new Promise(r => setTimeout(r, 700)); return 1;`); else await exportEnc(k); }
await wait(1500);
const exps = existsSync(DL) ? readdirSync(DL) : [];
const has = (re) => exps.some(f => re.test(f));
ok('every export is saved, encrypted except the pictures (devices, interfaces, VLANs, links, down links, unresolved, health, classic list, SVG, PNG)', has(/network-devices/) && has(/network-interfaces/) && has(/network-vlan-membership/) && has(/network-links/) && has(/network-down-and-disabled-links/) && has(/network-unresolved/) && has(/network-health/) && has(/topology-.*\.csv\.enc$/) && has(/\.svg$/) && has(/\.png$/), exps);
const dev = exps.find(f => /network-devices/.test(f)); const dtxt = dev ? await decryptFile(DL + dev) : '';
ok('the device CSV has a header and one row per device', /^\uFEFF?Device,Type,Vendor/.test(dtxt) && dtxt.trim().split(/\r?\n/).length >= 9, dtxt.slice(0, 200));
const svgf = exps.find(f => /\.svg$/.test(f)); const svgt = svgf ? readFileSync(DL + svgf, 'utf8') : '';
ok('the SVG picture shows no hover or search highlight and no interface names unless asked', /<svg/.test(svgt) && !/stroke-opacity="0.28"/.test(svgt), svgt.length);

// ---- stale data is grey and says so, never red ----
await fr(`const x = w.__nmx, m = x.model(); const past = Date.now() - 3 * 864e5; Object.values(m.devices).forEach(d => { Object.keys(d.seen).forEach(c => d.seen[c].at = past); Object.values(d.ifaces).forEach(i => { if (i.state) i.state.at = past; i.nbrs.forEach(n => { n.at = past; }); }); }); m.rev++; x.sync(); await new Promise(r => setTimeout(r, 400)); return 1;`);
const st = await J(`const x = w.__nmx, v = x.view(); const links = v.links.filter(L => L.shown && (L.status === 'confirmed' || L.status === 'inferred')); return { n: links.length, stale: links.filter(L => L.health.state === 'stale').length, red: links.filter(L => L.health.color === 'red').length, text: (links[0].health.text), staleItems: v.review.filter(r => r.cat === 'stale').length };`);
ok('data three days old turns every link grey and says it is stale, never red', st.n >= 5 && st.stale === st.n && st.red === 0 && /Stale/.test(st.text) && st.staleItems >= 3, st);
T.finish();
