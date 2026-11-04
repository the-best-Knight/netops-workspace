// Minimal WebDriver BiDi client for headless Firefox (real file:// testing).
import { writeFileSync } from 'node:fs';
let ws, nextId = 1; const pending = new Map(); const events = [];
export async function connect(port = Number(process.env.KIT_BIDI_PORT) || 9333) {
  ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.type === 'error' ? rej(new Error(d.error + ': ' + d.message)) : res(d.result); }
    else if (d.type === 'event') events.push(d);
  };
  await send('session.new', { capabilities: {} });
  await send('session.subscribe', { events: ['log.entryAdded'] });
}
export function send(method, params = {}) {
  const id = nextId++;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
}
export async function topContext() { const t = await send('browsingContext.getTree', {}); return t.contexts[0].context; }
export async function goto(context, url) { return send('browsingContext.navigate', { context, url, wait: 'complete' }); }
export async function evalIn(context, expression) {
  const r = await send('script.evaluate', { expression, target: { context }, awaitPromise: true, resultOwnership: 'none' });
  if (r.type === 'exception') throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && JSON.stringify(r.exceptionDetails.exception.value)));
  const v = r.result;
  return v.type === 'string' ? v.value : v.type === 'undefined' ? undefined : v.value;
}
export async function shot(context, path, opts = {}) {
  const r = await send('browsingContext.captureScreenshot', { context, ...opts });
  writeFileSync(path, Buffer.from(r.data, 'base64')); return path;
}
export const logs = () => events.filter(e => e.method === 'log.entryAdded').map(e => `[${e.params.level}] ${e.params.text}`);
export async function setViewport(context, width, height) { return send('browsingContext.setViewport', { context, viewport: { width, height } }); }
export function close() { try { ws.close(); } catch (e) {} }
const KEYS = { Enter: '\uE007', Tab: '\uE004', Backspace: '\uE003', Escape: '\uE00C', ArrowUp: '\uE013', ArrowDown: '\uE015', ArrowLeft: '\uE012', ArrowRight: '\uE014', Delete: '\uE017', Home: '\uE011', End: '\uE010', F10: '\uE03A' };
export async function press(context, key) {
  const v = KEYS[key] !== undefined ? KEYS[key] : key;
  await send('input.performActions', { context, actions: [{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: v }, { type: 'keyUp', value: v }] }] });
}
// Ctrl + a key, held the way a keyboard does it. Returns nothing; the page sees a ctrlKey keydown.
export async function chord(context, key) {
  const C = '\uE009';
  await send('input.performActions', { context, actions: [{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: C }, { type: 'keyDown', value: key }, { type: 'keyUp', value: key }, { type: 'keyUp', value: C }] }] });
}
