// Switch Lab: Dell is the default vendor, "?" works like a real switch, "show interface" prints each vendor's real format.
import { session } from './lib.mjs';
const S = await session();
await S.load('#fault-lab', 2500);
const run = (cmd) => S.frame(`d.getElementById('consoleOut').innerHTML = ''; w.runConsoleCommand(${JSON.stringify(cmd)}); return d.getElementById('consoleOut').innerText.split('\\n').slice(1).join('\\n');`);
const setVendor = (v) => S.frame(`d.querySelector('#vendorToggle .vendor-btn[data-vendor="${v}"]').click(); return 1;`);
const tokens = (text) => text.split('\n').map((l) => /^ {2}(\S+)/.exec(l)).filter(Boolean).map((m) => m[1]).filter((t) => t !== '<cr>');
const sorted = (a) => a.every((t, i) => i === 0 || a[i - 1] <= t);

// default vendor for a brand-new visitor
const first = await S.frame(`return { vendor: w.eval('vendor'), active: d.querySelector('#vendorToggle .active').dataset.vendor, stat: d.getElementById('statVendor').textContent, bar: d.getElementById('sbVendor').textContent };`);
S.ok('a new visitor starts on Dell', first.vendor === 'dell' && first.active === 'dell' && first.stat === 'Dell' && first.bar === 'Dell', first);

for (const v of ['dell', 'cisco']) {
  await setVendor(v);
  await S.frame(`w.startLab(1); await new Promise(r => setTimeout(r, 500)); w.runConsoleCommand('select SW1'); w.runConsoleCommand('enable'); return 1;`);
  const isDell = v === 'dell';
  // "?" at the prompt: alphabetical, only exec commands
  const top = await run('?'), t = tokens(top);
  S.ok(`${v}: ? lists commands alphabetically`, t.length > 8 && sorted(t), t);
  S.ok(`${v}: ? at the prompt lists exec commands only`, t.includes('show') && t.includes('configure') && !t.includes('hostname') && !t.includes('switchport'), t);
  S.ok(`${v}: ? ${isDell ? 'has no header (OS10 style)' : 'starts with "Exec commands:"'}`, isDell ? !/commands:/.test(top) : top.startsWith('Exec commands:'), top.split('\n')[0]);
  S.ok(`${v}: ? gives every command a description`, top.split('\n').filter((l) => /^ {2}\S/.test(l)).every((l) => /^ {2}\S+ +\S/.test(l)), top);
  const sh = await run('show ?'), st = tokens(sh);
  S.ok(`${v}: show ? is alphabetical`, st.length > 15 && sorted(st), st);
  S.ok(`${v}: show ? offers ${isDell ? '"interface" (OS10), not "interfaces"' : '"interfaces" (IOS)'}`, isDell ? st.includes('interface') && !st.includes('interfaces') : st.includes('interfaces') && !st.includes('interface'), st);
  S.ok(`${v}: show ? offers the vendor's own commands`, isDell ? st.includes('port-channel') && !st.includes('cdp') && !st.includes('etherchannel') : st.includes('cdp') && st.includes('etherchannel') && !st.includes('port-channel'), st);
  S.ok(`${v}: sh? completes to show`, (await run('sh?')).trim() === 'show', await run('sh?'));
  S.ok(`${v}: s? lists matches alphabetically`, (await run('s?')).trim() === 'select  show', await run('s?'));
  S.ok(`${v}: show ip ? is alphabetical`, sorted(tokens(await run('show ip ?'))), 1);
  S.ok(`${v}: ping ? shows the address argument`, /A\.B\.C\.D/.test(await run('ping ?')), await run('ping ?'));
  S.ok(`${v}: an unknown word says so`, /Unrecognized command/.test(await run('zz?')), await run('zz?'));
  // modes
  await run('conf t');
  const cfg = tokens(await run('?'));
  S.ok(`${v}: ? in config mode lists config commands only`, cfg.includes('hostname') && cfg.includes('interface') && !cfg.includes('show') && !cfg.includes('ping') && sorted(cfg), cfg);
  S.ok(`${v}: ? in config mode ${isDell ? 'offers management, not vtp' : 'offers vtp, not management'}`, isDell ? cfg.includes('management') && !cfg.includes('vtp') : cfg.includes('vtp') && !cfg.includes('management'), cfg);
  S.ok(`${v}: do ? lists exec commands`, tokens(await run('do ?')).includes('show'), 1);
  S.ok(`${v}: do show ? lists the show subcommands`, tokens(await run('do show ?')).length > 15, 1);
  await run(isDell ? 'interface ethernet 1/1/1' : 'interface gi0/1');
  const ifc = tokens(await run('?'));
  S.ok(`${v}: ? in interface mode lists interface commands only`, ifc.includes('switchport') && ifc.includes('shutdown') && !ifc.includes('hostname') && !ifc.includes('show') && sorted(ifc), ifc);
  S.ok(`${v}: switchport ? is alphabetical`, sorted(tokens(await run('switchport ?'))), 1);
  await run('end');

  // show interface
  const one = await run(isDell ? 'show interface ethernet 1/1/2' : 'show interfaces gi0/2');
  if (isDell) {
    S.ok('dell: show interface ethernet 1/1/2 starts like OS10', /^Ethernet 1\/1\/2 is up, line protocol is up\nHardware is Eth, address is [0-9a-f:]{17}/.test(one), one.split('\n').slice(0, 3));
    S.ok('dell: show interface has MTU, LineSpeed, Input and Output statistics', /MTU 9216 bytes, IP MTU 1500 bytes/.test(one) && /LineSpeed 1G, Auto-Negotiation on/.test(one) && /Input statistics:/.test(one) && /Output statistics:/.test(one) && /Time since last interface status change/.test(one), one);
    S.ok('dell: show interface has no Cisco-only lines', !/Encapsulation ARPA|BW 1000000 Kbit|Switchport attributes|media type is/.test(one), one);
    const stat = await run('show interface status');
    S.ok('dell: show interface status uses the OS10 columns', /Port +Description +Status +Speed +Duplex +Mode +Vlan +Tagged-Vlans/.test(stat) && /Eth 1\/1\/2 +(\S+ +)?up +1G +full +A +10 +-/.test(stat), stat);
    S.ok('dell: typing show interface (no s) gives no spelling note', !/spells it/.test(stat), stat);
    S.ok('dell: show interfaces (with s) still works but is corrected', /spells it "show interface"/.test(await run('show interfaces status')), 1);
    const desc = await run('show interface description');
    S.ok('dell: show interface description points to show interface status', /show interface status/.test(desc) && /Tagged-Vlans/.test(desc), desc);
    const sw = await run('show interface switchport');
    S.ok('dell: show interface switchport points to show interface status', /Mode column/.test(sw) && /Tagged-Vlans/.test(sw), sw);
  } else {
    S.ok('cisco: show interfaces gi0/2 uses the full interface name and the state word', /^GigabitEthernet0\/2 is up, line protocol is up \(connected\)/.test(one), one.split('\n')[0]);
    S.ok('cisco: show interfaces has the IOS body', /Hardware is Gigabit Ethernet, address is [0-9a-f.]+ \(bia/.test(one) && /BW 1000000 Kbit\/sec, DLY 10 usec/.test(one) && /reliability 255\/255, txload 1\/255, rxload 1\/255/.test(one) && /Full-duplex, 1000Mb\/s, media type is 10\/100\/1000BaseTX/.test(one) && /Queueing strategy: fifo/.test(one), one);
    S.ok('cisco: show interfaces no longer invents a switchport section', !/Switchport attributes/.test(one), one);
    const down = await run('show interfaces gi0/1');
    S.ok('cisco: a shut port says administratively down (disabled)', /^GigabitEthernet0\/1 is administratively down, line protocol is down \(disabled\)/.test(down), down.split('\n')[0]);
    const stat = await run('show interfaces status');
    S.ok('cisco: show interfaces status columns are separated', /Gi0\/2 +(\S+ +)?connected +10 +a-full +a-1000 10\/100\/1000BaseTX/.test(stat), stat);
  }
  // the shadowing bug: these used to print a full per-port dump
  const trunk = await run(isDell ? 'show interface trunk' : 'show interfaces trunk');
  S.ok(`${v}: show ... trunk is not a full interface dump`, !/line protocol/.test(trunk), trunk.slice(0, 200));
  S.ok(`${v}: unknown interface is rejected`, /Invalid input/.test(await run(isDell ? 'show interface nosuch' : 'show interfaces nosuch')), 1);
  if (!isDell) {
    S.ok('cisco: show interfaces switchport prints switchport info', /Switchport: Enabled/.test(await run('show interfaces switchport')), 1);
    S.ok('cisco: show interfaces status err-disabled reaches its own handler', /Err-disabled/.test(await run('show interfaces status err-disabled')), 1);
  }
}
S.finish();
