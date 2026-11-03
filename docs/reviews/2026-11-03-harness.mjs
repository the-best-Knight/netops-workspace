import { loadTool } from '../../tests/engine/tool.mjs';
export const T = loadTool('fault-lab', ['runConsoleCommand', 'ensureSession', 'LEVELS', 'canPing']);
export function lab(id, vendor = 'cisco') {
  const L = T.LEVELS.find((l) => l.id === id);
  T.__set('vendor', vendor);
  const net = L.build ? L.build() : L.net();
  T.__set('net', net); T.__set('currentLevel', L);
  return { L, net };
}
export function on(dev) { T.__set('selectedDeviceId', dev); T.__set('confMode', false); T.__set('confIface', null); }
export function run(line) { const id = T.__get('selectedDeviceId'), s = T.ensureSession(id), f = s.lines.length; T.runConsoleCommand(line, false); return s.lines.slice(f).map((l) => l.text).join('\n'); }
export function script(lines) { return lines.map((l) => '>> ' + l + '\n' + run(l)).join('\n'); }
