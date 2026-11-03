// Pulls the network-data engine (NM) out of index.html, so the tests run against the code that actually ships.
// In the Topology Builder's script the engine comes first ("var NM = ..." and the modules that extend it) and uses no
// browser APIs. The drawing code starts at "var NS = ...", so the engine is everything before that.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const dir = dirname(fileURLToPath(import.meta.url));
export const KIT_FILE = process.env.KIT_FILE || join(dir, '../../index.html');

let cached = null;
export function source() {
  if (cached) return cached;
  const html = readFileSync(KIT_FILE, 'utf8'), open = '<script type="text/plain" id="src-topology-builder">';
  const s = html.indexOf(open);
  if (s < 0) throw new Error('Topology Builder block not found in ' + KIT_FILE);
  const block = html.slice(s + open.length, html.indexOf('</script>', s)).replaceAll('<\\/', '</');
  const start = /var NM\s*=\s*\(?function\s*\(\)\s*\{/.exec(block), at = start ? start.index : -1;
  if (at < 0) throw new Error('engine start not found');
  const end = /var NS\s*=\s*"http:\/\/www\.w3\.org\/2000\/svg"/.exec(block.slice(at)), to = end ? at + end.index : -1;
  if (to < 0) throw new Error('could not find where the engine ends');
  return cached = block.slice(at, to);
}
export function loadNM() { return new Function('"use strict";' + source() + '\n;return NM;')(); }
export const fx = (n) => readFileSync(join(dir, '../fixtures', n), 'utf8');
