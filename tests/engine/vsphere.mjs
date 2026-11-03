// vSphere Sandbox regressions (review findings VS-01 to VS-05), run from the code in index.html.
import { loadTool, makeDom, fakeTimers } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const fields = {}, timers = fakeTimers(), toasts = [];
const T = loadTool('vsphere-sandbox', ['baseState', 'powerOnVm', 'applyVmHardware', 'takeSnapshot', 'deleteVm', 'rebootHost', 'restartGuestOs', 'shutdownGuestOs', 'startTask'],
  { document: makeDom(fields), confirm: () => true, prompt: (m, d) => d, setTimeout: timers.setTimeout, setInterval: timers.setInterval, clearInterval: timers.clearInterval, clearTimeout: timers.clearTimeout });
T.__set('showToast', (m, k) => toasts.push((k || '') + ': ' + m));
const fresh = () => { T.__set('state', T.baseState()); toasts.length = 0; return T.__get('state'); };
const vmOn = (s, host) => Object.values(s.vms).find((v) => v.power === 'on' && (!host || v.host === host));
const lastToast = () => toasts[toasts.length - 1] || '';

console.log('VS-01 memory admission is declared as a fully-reserved model');
test('power-on refusal names the simplification and the real-vSphere difference', () => {
  const s = fresh(), v = Object.values(s.vms).find((x) => x.power === 'off'), h = s.hosts[v.host]; h.memUsedGB = h.memGB;
  T.powerOnVm(v.id); eq(v.power, 'off'); ok(/fully memory-reserved/.test(lastToast()) && /overcommit/.test(lastToast()), lastToast());
});

console.log('VS-02 hot add prerequisites');
function edit(v, cpu, mem, hotCpu, hotMem) { fields.vmEditCpu = { value: String(cpu) }; fields.vmEditMem = { value: String(mem) }; fields.vmPortGroup = { value: v.portGroup }; fields.vmHotCpu = { checked: !!hotCpu }; fields.vmHotMem = { checked: !!hotMem }; T.applyVmHardware(v.id); }
test('adding CPU or memory to a running VM is refused without hot add', () => {
  const s = fresh(), v = vmOn(s), cpu = v.vCpu, mem = v.memGB;
  edit(v, cpu + 1, mem); ok(/CPU hot add is not enabled/.test(lastToast()), lastToast()); eq(v.vCpu, cpu);
  edit(v, cpu, mem + 1); ok(/memory hot add is not enabled/.test(lastToast()), lastToast()); eq(v.memGB, mem);
});
test('hot add turned on while powered off allows later increases', () => {
  const s = fresh(), v = Object.values(s.vms).find((x) => x.power === 'off' && state_ok(s, x)); const cpu = v.vCpu, mem = v.memGB;
  edit(v, cpu, mem, true, true); eq([v.cpuHotAdd, v.memHotAdd], [true, true]);
  v.power = 'on'; const host = s.hosts[v.host]; host.memUsedGB = 0;
  edit(v, cpu + 1, mem + 1, false, false); eq([v.vCpu, v.memGB], [cpu + 1, mem + 1]); eq([v.cpuHotAdd, v.memHotAdd], [true, true], 'flags are not changed while powered on');
});
function state_ok(s, v) { return !!s.hosts[v.host]; }

console.log('VS-03 snapshot storage is released');
test('deleting a VM with snapshots returns the datastore to its starting use', () => {
  const s = fresh(), v = Object.values(s.vms).find((x) => x.power === 'off' && s.datastores[x.datastore].accessible !== false), ds = s.datastores[v.datastore], start = ds.usedGB;
  for (let i = 0; i < 3; i++) T.takeSnapshot(v.id);
  eq(ds.usedGB, start + 3, 'three snapshots charged'); const disk = v.diskGB || (v.memGB || 4) * 8;
  T.deleteVm(v.id); eq(ds.usedGB, start - disk, 'disk and snapshots released');
});

console.log('VS-04 host reboot');
test('a host with powered-on VMs is not rebooted, and nothing changes', () => {
  const s = fresh(), v = vmOn(s), h = s.hosts[v.host]; T.rebootHost(h.id); eq(h.connection, 'connected'); ok(/Maintenance Mode/.test(lastToast()), lastToast());
});
test('an empty host goes Not Responding, then reconnects, as a task', () => {
  const s = fresh(), h = Object.values(s.hosts).find((x) => x.connection === 'connected' && !x.vms.some((id) => s.vms[id] && s.vms[id].power === 'on'));
  ok(h, 'a host without running VMs exists'); T.rebootHost(h.id); eq(h.connection, 'notResponding');
  ok(s.tasks.some((t) => /Reboot host/.test(t.msg)), 'task listed'); T.rebootHost(h.id); ok(/not responding/.test(lastToast()), 'second reboot while restarting must be refused: ' + lastToast());
  timers.tick(); eq(h.connection, 'connected'); ok(s.events.some((e) => /reboot completed/.test(e.msg)), 'completion logged: ' + JSON.stringify(s.events.slice(0, 4).map((e) => e.msg)));
});

console.log('VS-05 guest restart needs VMware Tools');
test('restart and shut down guest are both refused when Tools is not running', () => {
  const s = fresh(), v = vmOn(s); v.tools = 'notRunning'; const ev = s.events.length;
  T.restartGuestOs(v.id); ok(/VMware Tools/.test(lastToast()), lastToast()); eq(v.power, 'on');
  T.shutdownGuestOs(v.id); eq(v.power, 'on'); ok(!s.events.some((e) => /guest OS restart initiated/.test(e.msg)), 'restart was logged as started');
});
test('with Tools running both work', () => {
  const s = fresh(), v = vmOn(s); T.restartGuestOs(v.id); ok(s.events.some((e) => /guest OS restart initiated/.test(e.msg)), 'restart');
  T.shutdownGuestOs(v.id); eq(v.power, 'off');
});
done();
