// Shared helpers for the browser tests: open the kit in headless Firefox, count checks, print a summary.
import { connect, topContext, goto, evalIn, setViewport, press, chord, close, logs, shot } from './bidi.mjs';
export const KIT = process.env.KIT || new URL('../../index.html', import.meta.url).href;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function session({ width = 1500, height = 950 } = {}) {
  await connect();
  const ctx = await topContext();
  await setViewport(ctx, width, height);
  let n = 0, bad = 0;
  const ok = (name, cond, extra) => {
    n++; if (!cond) bad++;
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + JSON.stringify(extra).slice(0, 700)));
  };
  // run JS in the page, or inside the open tool's iframe (d = its document, w = its window)
  const ev = async (code) => JSON.parse(await evalIn(ctx, `(async () => { ${code} })().then(JSON.stringify)`));
  const frame = async (code) => JSON.parse(await evalIn(ctx, `(async () => { const f = document.querySelector('iframe'), d = f.contentDocument, w = f.contentWindow; ${code} })().then(JSON.stringify)`));
  const load = async (hash = '', ms = 1800) => { await goto(ctx, 'about:blank'); await goto(ctx, KIT + hash); await wait(ms); };
  const finish = () => {
    const errs = logs().filter((l) => /\[error\]/i.test(l));
    console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no console errors');
    console.log(n - bad + '/' + n + ' passed');
    close(); process.exit(bad || errs.length ? 1 : 0);
  };
  return { ctx, ok, ev, frame, load, finish, wait, press: (k) => press(ctx, k), chord: (k) => chord(ctx, k), shot: (p) => shot(ctx, p), setViewport: (w, h) => setViewport(ctx, w, h) };
}
