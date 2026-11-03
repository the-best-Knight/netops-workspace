// Loads one embedded tool from index.html and returns the functions you ask for, so a test runs the code that ships.
// The tool's script expects a page, so document, window and the other browser objects are replaced by a stub that
// accepts any call and returns itself (a querySelector with :not() finds nothing, so optional-element code takes its empty branch). Only the pure parts of a tool (parsers, simulators, formatters) are meant to be tested this way.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const dir = dirname(fileURLToPath(import.meta.url));
export const KIT_FILE = process.env.KIT_FILE || join(dir, '../../index.html');

export function toolHtml(id) {
  const html = readFileSync(KIT_FILE, 'utf8'), open = '<script type="text/plain" id="src-' + id + '">';
  const s = html.indexOf(open);
  if (s < 0) throw new Error('tool block not found: ' + id);
  return html.slice(s + open.length, html.indexOf('</script>', s)).replaceAll('<\\/', '</');
}

export function toolScript(id) {
  const t = toolHtml(id), out = [], re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(t))) out.push(m[1]);
  return out.join('\n;\n');
}

function stub() {
  const f = function () {};
  const p = new Proxy(f, {
    get(_, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'length') return 0;
      if (k === 'then') return undefined;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'querySelector') return (sel) => (/:not\(/.test(String(sel)) ? null : p);
      return p;
    },
    set() { return true; },
    apply() { return p; },
    construct() { return p; },
  });
  return p;
}

export function loadTool(id, names, extra = {}) {
  const dom = stub();
  const globals = Object.assign({
    document: dom, window: dom, navigator: dom, localStorage: dom, sessionStorage: dom, location: dom,
    requestAnimationFrame: () => 0, setInterval: () => 0, addEventListener() {}, matchMedia: () => dom,
  }, extra);
  const keys = Object.keys(globals);
  // __set and __get reach the tool's own variables and functions (declared in its script), so a test can replace a function or read state.
  const body = toolScript(id) + '\n;function __set(n, v) { eval(n + " = v"); }\nfunction __get(n) { return eval(n); }\nreturn {' + names.concat(['__set', '__get']).join(',') + '};';
  return new Function(...keys, body)(...keys.map((k) => globals[k]));
}

// A document stub whose getElementById returns the objects in "fields" (for example { vmEditCpu: { value: "4" } }) and the generic stub for everything else.
export function makeDom(fields) {
  const base = stub();
  return new Proxy(base, { get(t, k) { return k === 'getElementById' ? (id) => (id in fields ? fields[id] : base) : t[k]; } });
}

// Timers that only run when told to: tick(rounds) runs everything that is due, repeating intervals for a few rounds or until the tool clears them.
export function fakeTimers() {
  const q = [];
  return {
    setTimeout: (fn) => { const t = { fn, once: true, off: false }; q.push(t); return t; },
    setInterval: (fn) => { const t = { fn, once: false, off: false }; q.push(t); return t; },
    clearInterval: (t) => { if (t) t.off = true; }, clearTimeout: (t) => { if (t) t.off = true; },
    tick(rounds = 8) { for (let guard = 0; guard < rounds && q.some((t) => !t.off); guard++) q.filter((t) => !t.off).forEach((t) => { if (t.once) t.off = true; t.fn(); }); },
  };
}
