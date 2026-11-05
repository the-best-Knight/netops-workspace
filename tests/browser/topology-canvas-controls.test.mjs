// Topology Builder canvas controls: the Clear topology trash button (confirm, cancel, undo, no sample reload) and the grid staying on at every zoom.
import { start, wait } from './topology-lib.mjs';
const T = await start(1280, 720); const { ok, fr, J } = T;
const nodesLinks = () => J(`const c = w.__nmx.counts(); return { n: c.nodes, l: c.links, snaps: w.__nmx.snaps().length };`);
const gridRects = () => J(`return d.querySelectorAll('#svg rect[fill="url(#grid)"]').length;`);

await fr(`d.getElementById('b-sample').click(); await new Promise(r => setTimeout(r, 600)); return 1;`);
const full = await nodesLinks(); ok('the sample is loaded to start with', full.n > 5 && full.l > 5, full);

const btn = await J(`const b = d.getElementById('b-trash'), r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), title: b.title, w: Math.round(r.width), h: Math.round(r.height), svg: !!b.querySelector('svg'), text: b.textContent.trim() };`);
ok('a trash button labelled Clear topology is in the toolbar, an icon of at least 28px', btn.label === 'Clear topology' && btn.title === 'Clear topology' && btn.svg && btn.w >= 28 && btn.h >= 28 && btn.text === '', btn);

await fr(`d.getElementById('b-trash').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
const dlg = await J(`return { open: d.getElementById('nmcfm').open, title: d.getElementById('nmc-title').textContent, text: d.getElementById('nmc-text').textContent, ok: d.getElementById('nmc-ok').textContent };`);
ok('it asks first, says how many devices and links go, and what is not touched', dlg.open && /Clear the whole topology/.test(dlg.title) && new RegExp(full.l + ' link').test(dlg.text) && /devices/.test(dlg.text) && /Saved projects, snapshots and exported files are not touched/.test(dlg.text) && dlg.ok === 'Clear topology', dlg);
ok('nothing has changed before the answer', JSON.stringify(await nodesLinks()) === JSON.stringify(full), await nodesLinks());
await fr(`d.getElementById('nmc-no').click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
ok('cancelling changes nothing', JSON.stringify(await nodesLinks()) === JSON.stringify(full), await nodesLinks());

await fr(`d.getElementById('b-trash').click(); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 600)); return 1;`);
const empty = await nodesLinks();
ok('confirming empties the canvas: no devices and no links, projects and snapshots untouched', empty.n === 0 && empty.l === 0 && empty.snaps === full.snaps, empty);
await wait(2500);
ok('the sample does not come back by itself', (await nodesLinks()).n === 0, await nodesLinks());
ok('the empty-canvas message is shown and a second click says it is already empty', await J(`d.getElementById('b-trash').click(); await new Promise(r => setTimeout(r, 300)); return !d.getElementById('nmcfm').open && /already empty/.test(d.getElementById('toast-msg').textContent);`), 0);

await fr(`d.getElementById('b-undo').click(); await new Promise(r => setTimeout(r, 500)); return 1;`);
const back = await nodesLinks();
ok('Undo brings the whole diagram back, devices and links', back.n === full.n && back.l === full.l, back);
await fr(`d.getElementById('b-trash').click(); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 500)); d.getElementById('b-sample').click(); await new Promise(r => setTimeout(r, 600)); return 1;`);
ok('the sample can still be loaded on purpose', (await nodesLinks()).n === full.n, await nodesLinks());

// the grid
await fr(`w.__nmx.fit(); await new Promise(r => setTimeout(r, 400)); return 1;`);
ok('the grid is drawn after Fit', (await gridRects()) === 1, await gridRects());
await fr(`d.getElementById('nm-arrange').click(); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 700)); return 1;`);
const k = await J(`return +w.__nmx.state().view.k.toFixed(2);`);
ok('Auto-arrange keeps the grid, even when Fit has to zoom out below 45 percent', (await gridRects()) === 1, { k });
await fr(`const m = [...d.querySelectorAll('button')].find(b => b.textContent.trim() === '\u2212'); for (let i = 0; i < 6; i++) { m.click(); await new Promise(r => setTimeout(r, 80)); } await new Promise(r => setTimeout(r, 300)); return 1;`);
const kz = await J(`return +w.__nmx.state().view.k.toFixed(2);`);
ok('the grid is still there at a very low zoom', kz < 0.3 && (await gridRects()) === 1, { kz });
await fr(`[...d.querySelectorAll('button')].find(b => /^Grid/.test(b.textContent.trim())).click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
ok('turning the grid off removes it', (await gridRects()) === 0, await gridRects());
await fr(`d.getElementById('nm-arrange').click(); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 700)); w.__nmx.fit(); await new Promise(r => setTimeout(r, 400)); return 1;`);
ok('Auto-arrange and Fit leave a grid the user turned off alone', (await gridRects()) === 0, await gridRects());
await fr(`[...d.querySelectorAll('button')].find(b => /^Grid/.test(b.textContent.trim())).click(); await new Promise(r => setTimeout(r, 300)); return 1;`);
ok('turning it back on shows it again', (await gridRects()) === 1, await gridRects());
T.finish();
