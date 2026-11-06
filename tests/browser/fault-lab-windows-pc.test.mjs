// Switch Lab: a PC console is a Windows Command Prompt. Real key presses in free practice: the prompt, the header that names
// the device, typed commands, history recall, focus, tracert, traceroute not being a Windows command, and switches unchanged.
import { session } from './lib.mjs';
import { tmpdir } from 'node:os';
const S = await session();
await S.load('#fault-lab', 2500);
const type = async (text) => { for (const ch of text) await S.press(ch); };
const enter = async (cmd) => { await S.frame(`d.getElementById('consoleOut').innerHTML = ''; const i = d.getElementById('consoleInput'); i.value = ''; i.focus(); return 1;`); await type(cmd); await S.press('Enter'); await S.wait(250); return S.frame(`return d.getElementById('consoleOut').innerText;`); };
const state = () => S.frame(`return { prompt: d.getElementById('consolePrompt').textContent, ctx: d.getElementById('consoleContext').textContent, focus: d.activeElement && d.activeElement.id, value: d.getElementById('consoleInput').value };`);

await S.frame(`d.querySelector('#labGrid .lab-card.free').click(); await new Promise(r => setTimeout(r, 800)); w.runConsoleCommand('select PC-A'); await new Promise(r => setTimeout(r, 200)); return 1;`);
let st = await state();
S.ok('PC-A shows a Windows prompt, C:\\>', st.prompt === 'C:\\>', st);
S.ok('the header above the console still says which PC this is', /^PC-A\b/.test(st.ctx) && /Command Prompt/.test(st.ctx) && !/user EXEC/.test(st.ctx), st.ctx);

let o = await enter('ipconfig');
S.ok('a typed command is echoed after the Windows prompt, with no space, and answers', /^C:\\>ipconfig$/m.test(o) && /Windows IP Configuration/.test(o) && /IPv4 Address[ .]*: 192\.168\.10\.10/.test(o), o);
o = await enter('tracert 192.168.20.50');
S.ok('tracert runs in Windows format and completes', /Tracing route to 192\.168\.20\.50 over a maximum of 30 hops/.test(o) && /^\s+2 .*192\.168\.20\.50$/m.test(o) && /Trace complete\./.test(o), o);
S.ok('nothing in the PC console looks like a Cisco prompt', !/PC-A[#>]/.test(o), o);
await S.press('ArrowUp'); st = await state();
S.ok('Arrow Up brings the last command back, and the input keeps the focus', st.value === 'tracert 192.168.20.50' && st.focus === 'consoleInput', st);
o = await enter('traceroute 192.168.20.50');
S.ok('traceroute is not a Windows command: cmd.exe wording and a pointer to tracert', /'traceroute' is not recognized as an internal or external command/.test(o) && /tracert/.test(o.split('\n').slice(-1)[0] + o) && !/traceroute to /.test(o), o);
o = await enter('show vlan brief');
S.ok('a switch command on the PC is not recognized and points to the switches', /'show' is not recognized/.test(o) && /select SW1|Fixes are made on switches/.test(o), o);
o = await enter('ping 192.168.99.9');
S.ok('a ping to an unused address in another subnet reads like Windows', /Pinging 192\.168\.99\.9 with 32 bytes of data:/.test(o) && /Ping statistics for 192\.168\.99\.9:/.test(o), o);
await S.shot(tmpdir() + '/kit-test-shots/fault-lab-windows-pc.png');

await S.frame(`w.runConsoleCommand('select SW1'); await new Promise(r => setTimeout(r, 200)); return 1;`);
st = await state();
S.ok('a switch keeps its own prompt and header', /^SW1[>#]$/.test(st.prompt) && !/Command Prompt/.test(st.ctx), st);
o = await enter('show vlan brief');
S.ok('the switch still answers show commands', /VLAN|Vlan/.test(o) && !/not recognized/.test(o), o.slice(0, 300));
await S.frame(`w.runConsoleCommand('select PC-A'); await new Promise(r => setTimeout(r, 200)); return 1;`);
st = await state();
S.ok('going back to PC-A gives the Windows prompt again', st.prompt === 'C:\\>' && /^PC-A/.test(st.ctx), st);
S.finish();
