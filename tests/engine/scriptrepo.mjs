// The repository displays/copies the supplied PowerShell verbatim, without running it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadTool, toolHtml, fakeTimers } from './tool.mjs';
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('  ok   ' + name); }
function boot({ clipboard = 'ok', fallback = false, hash = '' } = {}) {
  const fields = {}, copies = [], removed = [], focused = [], timers = fakeTimers();
  for (const id of ['scriptBody', 'codeWrap', 'toast', 'btnCopy', 'btnToggle']) fields[id] = {
    hidden: id === 'codeWrap', textContent: '', attrs: {}, handlers: {}, classes: new Set(),
    setAttribute(k, v) { this.attrs[k] = v; }, focus() { focused.push(id); },
    addEventListener(k, fn) { this.handlers[k] = fn; },
    classList: { add(k) { fields[id].classes.add(k); }, remove(k) { fields[id].classes.delete(k); } },
  };
  let ta;
  const document = {
    getElementById: (id) => fields[id],
    createElement() { return ta = { value: '', style: {}, setAttribute() {}, select() {} }; },
    body: { appendChild() {}, removeChild(el) { removed.push(el); } },
    execCommand(cmd) { assert.equal(cmd, 'copy'); if (fallback) copies.push(ta.value); return fallback; },
  };
  const navigator = clipboard === 'missing' ? {} : { clipboard: { writeText(text) {
    if (clipboard === 'reject') return Promise.reject(new Error('Clipboard denied'));
    copies.push(text); return Promise.resolve();
  } } };
  loadTool('script-repo', [], { document, navigator, location: { hash }, ...timers });
  return { fields, copies, removed, focused, timers, click: async (id) => { fields[id].handlers.click(); await Promise.resolve(); await Promise.resolve(); } };
}
const expectedHash = '92030a67b560501c556f542f8cb913b8fda7284a002858de3d528f557e2af0d3';
await test('displayed script matches the supplied PowerShell payload exactly', () => {
  const { fields } = boot();
  assert.equal(createHash('sha256').update(fields.scriptBody.textContent).digest('hex'), expectedHash);
  assert.match(fields.scriptBody.textContent, /function Invoke-LabScan/);
});
await test('opening the repository never copies or executes a script', () => {
  const b = boot(); assert.deepEqual(b.copies, []); assert.equal(b.fields.codeWrap.hidden, true);
});
await test('show and hide controls expose the correct accessible state', async () => {
  const b = boot(); await b.click('btnToggle'); assert.equal(b.fields.codeWrap.hidden, false);
  assert.equal(b.fields.btnToggle.attrs['aria-expanded'], 'true'); assert.equal(b.fields.btnToggle.textContent, 'Hide code');
  await b.click('btnToggle'); assert.equal(b.fields.codeWrap.hidden, true); assert.equal(b.fields.btnToggle.attrs['aria-expanded'], 'false');
});
await test('successful clipboard copy uses the complete displayed script', async () => {
  const b = boot(); await b.click('btnCopy'); assert.deepEqual(b.copies, [b.fields.scriptBody.textContent]);
  assert.equal(b.fields.btnCopy.textContent, 'Copied'); b.timers.tick(); assert.equal(b.fields.btnCopy.textContent, 'Copy script');
});
await test('denied modern clipboard falls back to legacy copying', async () => {
  const b = boot({ clipboard: 'reject', fallback: true }); await b.click('btnCopy');
  assert.deepEqual(b.copies, [b.fields.scriptBody.textContent]); assert.equal(b.removed.length, 1);
});
await test('file-browser clipboard fallback copies the complete script', async () => {
  const b = boot({ clipboard: 'missing', fallback: true }); await b.click('btnCopy');
  assert.deepEqual(b.copies, [b.fields.scriptBody.textContent]);
});
await test('failed copy reveals and focuses code for manual Windows copying', async () => {
  const b = boot({ clipboard: 'reject' }); await b.click('btnCopy'); assert.deepEqual(b.copies, []);
  assert.equal(b.fields.codeWrap.hidden, false); assert.equal(b.fields.btnToggle.attrs['aria-expanded'], 'true');
  assert.deepEqual(b.focused, ['scriptBody']); assert.match(b.fields.toast.textContent, /Ctrl\+C/);
});
await test('standalone show hash uses the same expanded state', () => {
  const b = boot({ hash: '#show' }); assert.equal(b.fields.codeWrap.hidden, false); assert.equal(b.fields.btnToggle.attrs['aria-expanded'], 'true');
});
await test('embedded page retains the outbound-blocking CSP and contains no external dependencies', () => {
  const html = toolHtml('script-repo'); assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/i); assert.match(html, /id="btnToggle" aria-controls="codeWrap" aria-expanded="false"/);
});
console.log('\n' + passed + ' passed, 0 failed');
