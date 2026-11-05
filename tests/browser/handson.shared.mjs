// Hands-on checks run in a light and in a dark browser: Topology Builder labels and new controls (keyboard, focus,
// narrow window), Cheat Sheet examples on a narrow window, and Switch Lab Extreme Mode PC diagnostics typed into the console.
import { session } from './lib.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const fx = (n) => readFileSync(new URL('../fixtures/' + n, import.meta.url), 'utf8');
const SC = tmpdir() + '/kit-test-shots/'; mkdirSync(SC, { recursive: true });

export async function run(theme) {
  const S = await session({ width: 1280, height: 800 });
  const lum = (c) => { const m = String(c).match(/[\d.]+/g).map(Number), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  // Topology Builder: import the five-switch network, arrange, names on
  await S.load('#topology-builder', 2800);
  await S.frame(`w.confirm = () => true; d.getElementById('b-clear').click(); await new Promise(r => setTimeout(r, 300)); if (d.getElementById('nmcfm').open) d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 300));
    d.getElementById('nm-import').click(); await new Promise(r => setTimeout(r, 200)); const ta = d.getElementById('nmi-text'); ta.value = ${JSON.stringify(['core-01', 'dist-01', 'dist-02', 'access-01', 'access-02'].map((n) => fx('five-switch/' + n + '.txt')).join('\n'))}; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
    d.getElementById('nmi-read').click(); for (let i = 0; i < 80 && !d.querySelector('#nmi-rows .nmi-row'); i++) await new Promise(r => setTimeout(r, 150)); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmi-apply').click(); await new Promise(r => setTimeout(r, 700)); d.getElementById('nmi-close').click(); await new Promise(r => setTimeout(r, 300));
    d.getElementById('nm-arrange').click(); await new Promise(r => setTimeout(r, 300)); d.getElementById('nmc-ok').click(); await new Promise(r => setTimeout(r, 900)); return 1;`);
  const scheme = await S.frame(`return w.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';`);
  S.ok('the browser really is in ' + theme + ' mode', scheme === theme, scheme);
  // keyboard: Tab from Auto-arrange reaches the trash button, it shows a focus ring, Enter asks, Escape cancels
  // keyboard: headless Firefox never gives the tool frame keyboard focus (document.hasFocus() stays false even after a
  // real click), so Tab, Enter and Escape are checked by hand in a desktop browser. Here: names, sizes and the focus rule.
  const ctl = await S.frame(`const b = d.getElementById('b-trash'), r = b.getBoundingClientRect(), rules = [...d.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } }).map(r => r.selectorText || '').join(' | ');
    return { tag: b.tagName, type: b.type, label: b.getAttribute('aria-label'), w: r.width, h: r.height, ring: /\.btn:focus-visible/.test(rules), lbl: d.getElementById('nm-lbl').type, lblName: d.getElementById('nm-lbl').closest('label').textContent.trim() };`);
  S.ok('the trash button is a real button named "Clear topology", at least 24 px, covered by the .btn focus-visible rule', ctl.tag === 'BUTTON' && ctl.type === 'button' && ctl.label === 'Clear topology' && ctl.w >= 24 && ctl.h >= 24 && ctl.ring, ctl);
  S.ok('Interface names is a labelled checkbox', ctl.lbl === 'checkbox' && ctl.lblName === 'Interface names', ctl);
  await S.frame(`d.getElementById('nm-lbl').click(); await new Promise(r => setTimeout(r, 400)); return 1;`);
  const lbl = await S.frame(`return { on: d.getElementById('nm-lbl').checked, n: d.querySelectorAll('#svg g[data-labels] rect').length };`);
  S.ok('Interface names turns the labels on', lbl.on && lbl.n === 12, lbl);
  // labels readable in this theme: text against its own label background
  const lc = await S.frame(`const out = []; d.querySelectorAll('#svg g[data-labels]').forEach(g => g.querySelectorAll('text').forEach(t => { const r = t.previousElementSibling; out.push([w.getComputedStyle(t).fill, r.getAttribute('fill')]); })); return out;`);
  const worst = Math.min(...lc.map(([f, b]) => ratio(f, b.startsWith('#') ? 'rgb(' + [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)).join(',') + ')' : b)));
  S.ok('interface label text has at least 4.5:1 contrast against its label box (' + worst.toFixed(1) + ':1)', worst >= 4.5, lc.slice(0, 3));
  await S.shot(SC + 'handson-topology-labels-' + theme + '.png');

  // narrow window
  await S.setViewport(390, 844); await S.wait(600);
  const narrow = await S.frame(`const b = d.getElementById('b-trash').getBoundingClientRect(); return { pageW: d.documentElement.scrollWidth, winW: w.innerWidth, trash: b.width >= 24 && b.height >= 24 && b.right <= w.innerWidth + 1, lbl: !!d.getElementById('nm-lbl') };`);
  S.ok('at 390 px the Topology Builder page does not scroll sideways and the trash button stays reachable', narrow.pageW <= narrow.winW + 1 && narrow.trash, narrow);
  await S.shot(SC + 'handson-topology-narrow-' + theme + '.png');

  // Cheat Sheet on a narrow window: an opened example scrolls inside its box, not the page
  await S.load('#practice-ref', 1800);
  await S.frame(`d.getElementById('sheetVendor').value = 'cisco'; d.getElementById('sheetVendor').dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 300)); const r = [...d.querySelectorAll('.sheet-row')].find(r => decodeURIComponent(r.querySelector('.cmd-btn').dataset.cmd) === 'show ip interface brief'); const det = r.querySelector('details.row-more'); det.open = true; det.scrollIntoView(); await new Promise(r => setTimeout(r, 200)); return 1;`);
  const cs = await S.frame(`const pre = d.querySelector('details.row-more[open] pre'); pre.scrollIntoView(); return { pageW: d.documentElement.scrollWidth, winW: w.innerWidth, preScrolls: pre.scrollWidth > pre.clientWidth, preRight: pre.getBoundingClientRect().right, copy: (() => { const q = d.querySelector('details.row-more[open]').closest('tr').querySelector('.cmd-btn').getBoundingClientRect(); return q.width > 40 && q.right <= w.innerWidth + 1; })() };`);
  S.ok('at 390 px an open example scrolls inside its own box, the page does not scroll sideways, and the copy button stays on screen', cs.pageW <= cs.winW + 1 && cs.preRight <= cs.winW + 1 && cs.preScrolls && cs.copy, cs);
  await S.shot(SC + 'handson-cheatsheet-narrow-' + theme + '.png');
  // Switch Lab Extreme Mode, typed into the console
  await S.setViewport(1280, 800);
  await S.load('#fault-lab', 2500);
  const x = await S.frame(`w.xStart(w.XL[0].id, true); await new Promise(r => setTimeout(r, 600)); const net = w.XL[0].build(); /* same scenario, built fresh: the live one is not on window */ const pc = Object.values(net.devices).find(d => d.type === 'pc');
    const topo = d.querySelector('.topo-panel'); return { pc: pc.name, ip: pc.ifaces.eth0.ip, gw: pc.ifaces.eth0.gw, names: Object.values(net.devices).map(d => d.name), topoHidden: !topo || w.getComputedStyle(topo).display === 'none' };`);
  S.ok('Extreme Mode hides the topology panel', x.topoHidden, x);
  const type = (cmd) => S.frame(`const i = d.getElementById('consoleInput'); d.getElementById('consoleOut').innerHTML = ''; i.value = ${JSON.stringify(cmd)}; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise(r => setTimeout(r, 400)); return d.getElementById('consoleOut').innerText;`);
  const j = await type('jump ' + x.pc);
  const ip = await type('ipconfig'), rp = await type('route print'), pg = await type('ping ' + x.gw), tr = await type('tracert ' + x.gw), rw = await type('netsh interface ip set address Ethernet0 static 1.1.1.1 255.255.255.0 1.1.1.2');
  S.ok('jump opens the PC console', /Out-of-band session opened to/.test(j), j);
  S.ok('ipconfig shows this PC address and gateway', ip.includes('IPv4 Address. . . . . . . . . . . : ' + x.ip) && ip.includes('Default Gateway . . . . . . . . . : ' + x.gw), ip.slice(0, 400));
  S.ok('route print shows the default route through the gateway', new RegExp('0\\.0\\.0\\.0\\s+0\\.0\\.0\\.0\\s+' + x.gw.replace(/\./g, '\\.')).test(rp), rp.slice(0, 300));
  S.ok('ping prints Windows output', /Pinging .* with 32 bytes of data:/.test(pg) && /Ping statistics for/.test(pg), pg);
  S.ok('tracert prints Windows output', /Tracing route to/.test(tr) && /Trace complete\./.test(tr), tr);
  S.ok('changing the PC is refused as read-only', /read-only in this lab/.test(rw), rw);
  const leak = x.names.filter((n) => n !== x.pc && [ip, rp, pg, tr].some((o) => new RegExp('\\b' + n.replace(/[-.]/g, '\\$&') + '\\b', 'i').test(o)));
  S.ok('none of the four diagnostics names another device', leak.length === 0, leak);
  await S.shot(SC + 'handson-extreme-pc-' + theme + '.png');
  S.finish();
}
