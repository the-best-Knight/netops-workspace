// Visual refinement: the fonts really load, nothing is fetched from outside, ordinary cards and panels have no gradient or shadow,
// controls use the small radius, the focus ring shows, and code stays monospace. Works in a light or a dark browser.
import { session } from './lib.mjs';
const S = await session();
const GRADIENT_OK = /code-line|code-fill|sanitizedOutput|rawInput|textarea-clone|raw-highlight|canvas|stage|\bsb\b|hatch|topo/i;
const audit = String.raw`
  const win = ROOT_WIN, doc = win.document;
  const faces = [...doc.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '') + ' ' + f.weight);
  const grad = [], shadow = [], pill = [];
  for (const e of doc.body.querySelectorAll('*')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = win.getComputedStyle(e), tag = e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '#' + e.id;
    if (/gradient/.test(cs.backgroundImage)) grad.push(tag);
    if (cs.boxShadow !== 'none' && /(^|\s)(card|panel|side|sidebar|masthead|statusbar|lab-card|verify)(\s|$)/.test(String(e.className)) && !/inset/.test(cs.boxShadow) && !/0px 0px 0px 1px/.test(cs.boxShadow)) shadow.push(tag + ' ' + cs.boxShadow.slice(0, 40));
    if (/^(BUTTON|SELECT|INPUT|TEXTAREA)$/.test(e.tagName) && e.type !== 'checkbox' && e.type !== 'radio' && e.type !== 'range' && parseFloat(cs.borderTopLeftRadius) > 16.5 && Math.abs(r.width - r.height) > 2) pill.push(tag + ' ' + cs.borderTopLeftRadius);
  }
  const mono = [...doc.querySelectorAll('textarea, pre, code')].filter((e) => e.getBoundingClientRect().width).map((e) => win.getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g, ''));
  const R = (sel) => [...new Set([...doc.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width).map((e) => Math.round(parseFloat(win.getComputedStyle(e).borderTopLeftRadius))))];
  const radii = { btn: R('button.btn, .tab, .chip').filter((v) => v < 100), area: R('textarea, pre'), panel: R('.panel, .card, .lab-card, .hol-card, .sidebar') };
  return { radii, faces, grad: [...new Set(grad)], shadow: [...new Set(shadow)], pill: [...new Set(pill)], mono: [...new Set(mono)] };`;

// the home screen
await S.load('', 1500);
const hub = await S.ev(`await Promise.all([document.fonts.load('400 14px "IBM Plex Sans"'), document.fonts.load('600 14px "IBM Plex Sans"')]); ${audit.replace('ROOT_WIN', 'window')}`);
S.ok('home: IBM Plex Sans 400 and 600 are loaded from the file', ['IBM Plex Sans 400', 'IBM Plex Sans 600'].every((f) => hub.faces.includes(f)), hub.faces);
S.ok('home: the page text uses IBM Plex Sans', await S.ev(`return /^"?IBM Plex Sans/.test(getComputedStyle(document.querySelector('.card-title')).fontFamily);`), 0);
S.ok('home: no gradients', hub.grad.length === 0, hub.grad);
S.ok('home: cards and panels have no shadow', hub.shadow.length === 0, hub.shadow);
S.ok('home: buttons and fields are not pills', hub.pill.length === 0, hub.pill);
const rad = await S.ev(`const r = (s) => parseFloat(getComputedStyle(document.querySelector(s)).borderTopLeftRadius); return { card: r('.card'), chip: r('.chip, .ws-btn, .help-btn'), search: r('.tool-search') };`);
S.ok('home: cards 12 to 20 px, controls 10 to 14 px (soft, not pills)', rad.card >= 12 && rad.card <= 20 && rad.chip >= 10 && rad.chip <= 14 && rad.search >= 10 && rad.search <= 14, rad);
S.ok('home: nothing was requested from outside the file', await S.ev(`return performance.getEntriesByType('resource').every((r) => !/^https?:/.test(r.name));`), 0);
// A headless window never has focus, so :focus-visible cannot match here. Check that the focus-ring rules exist and are at least 2px instead.
const RINGS = (root) => `let n = 0; for (const ss of ${root}.styleSheets) { try { for (const r of ss.cssRules) { if (r.selectorText && /:focus(-visible|-within)?/.test(r.selectorText) && (/outline:\\s*([\\d.]+)px/.exec(r.cssText) || [0, 0])[1] >= 2) n++; } } catch (e) {} } return n;`;
S.ok('home: focus-ring rules of 2px or more exist', (await S.ev(RINGS('document'))) >= 2, 0);

// each tool: fonts loaded inside the frame, no gradient or shadow on ordinary surfaces, small radii, code is monospace
const TOOLS = ['toolkit', 'log-sanitizer', 'config-diff', 'ping-analyzer', 'fault-lab', 'topology-builder', 'dns-lab', 'routing-lab', 'firewall-lab', 'vsphere-sandbox', 'osi-ref', 'practice-ref', 'script-repo'];
for (const id of TOOLS) {
  await S.load('#' + id, 2300);
  const r = await S.frame(`await Promise.all([d.fonts.load('400 14px "IBM Plex Sans"'), d.fonts.load('400 13px "IBM Plex Mono"')]); ${audit.replace('ROOT_WIN', 'w')}`);
  S.ok(`${id}: both Plex fonts are loaded inside the tool`, r.faces.some((f) => /Sans/.test(f)) && r.faces.some((f) => /Mono/.test(f)), r.faces);
  S.ok(`${id}: gradients only where they carry meaning (stripes, grids, hatching)`, r.grad.every((g) => GRADIENT_OK.test(g)), r.grad);
  S.ok(`${id}: cards and panels have no shadow`, r.shadow.length === 0, r.shadow);
  S.ok(`${id}: buttons and fields are not pills`, r.pill.length === 0, r.pill);
  S.ok(`${id}: radii stay on the scale (controls 8 to 14 px, text areas tighter than panels)`, r.radii.btn.every((v) => v >= 8 && v <= 14) && r.radii.area.every((v) => v <= 12) && r.radii.panel.every((v) => v >= 8 && v <= 20), r.radii);
  S.ok(`${id}: code and text areas are monospace`, r.mono.every((m) => /Mono|monospace|Menlo|Consolas|SF Mono/.test(m)), r.mono);
}

// keyboard focus inside a tool
await S.load('#log-sanitizer', 2300);
S.ok('log-sanitizer: focus-ring rules of 2px or more exist inside the tool', (await S.frame(RINGS('d'))) >= 1, 0);
S.finish();
