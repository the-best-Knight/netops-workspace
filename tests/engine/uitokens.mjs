// Design tokens (visual refinement): WCAG 2.2 AA contrast of the shared colours in both themes, the font files, and nothing fetched from outside.
import { readFileSync } from 'node:fs';
import { KIT_FILE } from './tool.mjs';
import { test, ok, done } from './lib.mjs';
const html = readFileSync(KIT_FILE, 'utf8');
const base = /<script type="text\/plain" id="kit-base-css">([\s\S]*?)<\/script>/.exec(html)[1];
const fonts = /<script type="text\/plain" id="kit-fonts">([\s\S]*?)<\/script>/.exec(html)[1];
const block = (re) => { const o = {}; for (const m of re.exec(base)[1].matchAll(/--kit-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) o[m[1]] = m[2]; return o; };
const dark = block(/:root\{([^}]*)\}/), light = { ...dark, ...block(/:root\[data-theme=light\]\{([^}]*)\}/) };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

console.log('Contrast of the shared tokens (4.5:1 for text, 3:1 for the accent as a control edge)');
for (const [name, t] of [['dark', dark], ['light', light]]) {
  for (const surf of ['page', 's1', 's2', 's3']) {
    for (const fg of ['text', 'text2', 'muted', 'accent', 'ok', 'warn', 'bad']) {
      test(`${name}: ${fg} on ${surf}`, () => { const r = ratio(t[fg], t[surf]); ok(r >= 4.5, `${t[fg]} on ${t[surf]} is ${r.toFixed(2)}:1`); });
    }
  }
  test(`${name}: on-accent text on the accent`, () => { const r = ratio(t['on-accent'], t.accent); ok(r >= 4.5, r.toFixed(2)); });
  test(`${name}: text on the input well`, () => { const r = ratio(t.text, t.well); ok(r >= 4.5, r.toFixed(2)); });
}

console.log('Radius tokens');
test('the radius scale is 8 small, 10 code, 12 controls, 16 cards', () => ok(/--kit-r-sm: 8px;--kit-r: 12px;--kit-r-lg: 16px;--kit-r-code: 10px/.test(base), 'scale'));
test('the Topology Builder row radius comes from the token', () => ok(/e\.style\.borderRadius = "var\(--kit-r, 12px\)"/.test(html), 'js rule'));

console.log('Fonts');
test('one UI font and one monospace font are embedded, four faces in all, as woff2', () => {
  ok((fonts.match(/@font-face/g) || []).length === 4, 'face count');
  ok((fonts.match(/data:font\/woff2;base64,/g) || []).length === 4, 'not all woff2 data');
  ok(/"IBM Plex Sans"/.test(fonts) && /"IBM Plex Mono"/.test(fonts), 'families');
});
test('every font file is a real woff2 (wOF2 header)', () => {
  for (const m of fonts.matchAll(/base64,([A-Za-z0-9+/=]+)\)/g)) ok(Buffer.from(m[1], 'base64').subarray(0, 4).toString('latin1') === 'wOF2', 'header');
});
test('the stacks keep real system fallbacks', () => {
  ok(/--kit-sans:\s*"IBM Plex Sans", ui-sans-serif, system-ui/.test(base) && /sans-serif;/.test(base), 'sans fallback');
  ok(/--kit-mono:\s*"IBM Plex Mono", ui-monospace[^;]*monospace;/.test(base), 'mono fallback');
});
test('the font size is paid for once: the font data is not inside the shared CSS or any tool', () => ok(!/data:font\//.test(base) && (html.match(/data:font\/woff2/g) || []).length === 4, 'duplicated'));
test('the licence note ships next to the code', () => ok(/SIL Open Font License/.test(fonts), 'no licence line'));

console.log('Offline');
test('no font, style or script comes from outside the file', () => {
  ok(!/fonts\.googleapis|fonts\.gstatic|https?:\/\/[^\s"']*(cdn|cdnjs|unpkg|jsdelivr)|@import/i.test(html.replace(/<script type="application\/json" id="kit-data">[\s\S]*?<\/script>/, '')), 'external reference');
  ok(!/<link[^>]+rel=["']stylesheet/i.test(html) && !/<script[^>]+src=/i.test(html), 'linked asset');
});
test('the page and tool content-security policies allow only data: fonts', () => {
  const policies = [...html.matchAll(/font-src ([^;"']+)/g)].map((m) => m[1].trim());
  ok(policies.length >= 2 && policies.every((p) => p === 'data:'), JSON.stringify(policies));
});
done();
