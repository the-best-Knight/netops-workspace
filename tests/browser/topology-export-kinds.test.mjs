// Topology Builder: device kinds, interface names and link evidence survive the exports. Imported from CLI text (the
// fictional five-switch network plus a Dell leaf with an ESXi host), then exported as draw.io, SVG, PNG and a JSON project.
import { start, importText, fxd, wait } from './topology-lib.mjs';
const T = await start(1280, 800); const { ok, fr, J } = T;
const five = ['core-01', 'dist-01', 'dist-02', 'access-01', 'access-02'].map((n) => fxd('five-switch/' + n + '.txt')).join('\n');
const dell = 'LEAF-1# show lldp neighbors\nLoc PortID          Rem Host Name          Rem Port Id                    Rem Chassis Id\n---------------------------------------------------------------------------------------\nethernet1/1/1    esx01.lab.example    vmnic0    00:50:56:aa:bb:01\nLEAF-1#\n';
await importText(T, five + '\n' + dell);
// a storage array drawn by hand, linked to a core switch
await fr(`const x = w.__nmx, ns = x.nodes(), c = ns.find(n => n.name === 'CORE-01'); const id = Math.max(...ns.map(n => n.id)) + 1; ns.push({ id, kind: 'device', type: 'storage', name: 'SAN-01', x: c.x + 400, y: c.y, ip: '', vlan: '', mac: '', notes: '' }); x.links().push({ id: 0, from: c.id, to: id, label: '', ifA: 'Te1/1/4', ifB: 'ctrl-a', vlan: '', medium: 'fiber', status: 'up', color: '' }); x.render(); return 1;`);
await fr(`w.__nmx.arrange(); w.__nmx.render(); w.__nmx.fit(); return 1;`);

const grab = (exp) => J(`let blob = null; const oc = w.URL.createObjectURL; w.URL.createObjectURL = (b) => { blob = b; return oc.call(w.URL, b); }; const ac = w.HTMLAnchorElement.prototype.click; w.HTMLAnchorElement.prototype.click = function () {}; d.querySelector('#exportMenu summary').click(); d.querySelector('#exportMenu [data-exp="${exp}"]').click(); for (let i = 0; i < 30 && !blob; i++) await new Promise(r => setTimeout(r, 100)); w.URL.createObjectURL = oc; w.HTMLAnchorElement.prototype.click = ac; if (!blob) return null; const buf = new Uint8Array(await blob.arrayBuffer()); return { type: blob.type, head: [...buf.slice(0, 8)], text: blob.type === 'image/png' ? '' : new TextDecoder().decode(buf) };`);

// draw.io
const dio = (await grab('drawio')).text; if (process.env.DUMP) { (await import('node:fs')).writeFileSync(process.env.DUMP + '.drawio', dio); }
const objOf = (name) => { const m = new RegExp('<object label="&lt;b&gt;' + name.replace(/[.]/g, '\\.') + '&lt;/b&gt;[^"]*"([^>]*)>\\s*<mxCell style="([^"]*)"').exec(dio); return m ? { attrs: m[1], style: m[2], type: (/ type="([^"]*)"/.exec(m[1]) || [])[1], kind: (/ kind="([^"]*)"/.exec(m[1]) || [])[1] } : null; };
const ap = objOf('AP-LOBBY'), ph = objOf('IP-Phone-Conf'), ws = objOf('WS-ENG-014'), core = objOf('CORE-01'), acc = objOf('ACCESS-01'), esx = objOf('esx01.lab.example'), san = objOf('SAN-01');
ok('draw.io: the access point is an Access point, with its own shape and its kind', ap && ap.type === 'Access point' && ap.kind === 'ap' && /shape=process/.test(ap.style), ap);
ok('draw.io: the IP phone is an IP phone, with its own shape', ph && ph.type === 'IP phone' && ph.kind === 'phone' && /shape=card/.test(ph.style), ph);
ok('draw.io: a workstation is an End station', ws && ws.type === 'End station' && ws.kind === 'endpoint', ws);
ok('draw.io: switches, the ESXi host and the storage array keep their types', core && /switch/i.test(core.type) && /core|switch/.test(core.kind) && acc && /switch/i.test(acc.type) && esx && esx.type === 'ESXi host' && esx.kind === 'esxi' && san && san.type === 'Storage' && /cylinder/.test(san.style), { core, acc, esx, san });
const edgesOf = (x) => [...x.matchAll(/<object label="[^"]*"([^>]*)>\s*<mxCell style="([^"]*)" edge="1"/g)].map((m) => ({ status: (/ status="([^"]*)"/.exec(m[1]) || [])[1], a: (/ interface_a="([^"]*)"/.exec(m[1]) || [])[1], b: (/ interface_b="([^"]*)"/.exec(m[1]) || [])[1], dashed: /dashed=1/.test(m[2]) }));
const edges0 = edgesOf(dio);
const view = await J(`const x = w.__nmx, v = x.NM.view(x.model(), {}); return { confirmed: v.links.filter(L => L.status === 'confirmed').length, inferred: v.links.filter(L => L.status === 'inferred').length };`);
ok('draw.io mirrors the canvas: with unconfirmed links hidden, only the confirmed ones (and links drawn by hand) are exported', edges0.filter((e) => e.status === 'confirmed').length === view.confirmed && !edges0.some((e) => e.status === 'inferred'), edges0.map((e) => e.status));
await fr(`w.__nmx.ui.overlay = true; w.__nmx.render(); return 1;`);
const edges = edgesOf((await grab('drawio')).text);
ok('draw.io with unconfirmed links shown: every confirmed link says confirmed, every inferred link says inferred, and only inferred ones are dashed', edges.filter((e) => e.status === 'confirmed').length === view.confirmed && edges.filter((e) => e.status === 'inferred').length === view.inferred && edges.filter((e) => e.status === 'inferred').every((e) => e.dashed) && edges.filter((e) => e.status === 'confirmed').every((e) => !e.dashed), { view, edges: edges.map((e) => e.status + (e.dashed ? '-' : '')) });
ok('draw.io: interface names travel with their links', edges.some((e) => e.a === 'gi1/0/1' || e.b === 'gi1/0/1' || /gi1\/0\/1/i.test((e.a || '') + (e.b || ''))) && edges.some((e) => /vmnic0/.test((e.a || '') + (e.b || ''))) && edges.some((e) => e.a === 'Te1/1/4' && e.b === 'ctrl-a'), edges.slice(0, 8));
// a type picked by hand wins, as on the canvas
await fr(`const n = w.__nmx.nodes().find(n => n.name === 'AP-LOBBY'); n.type = 'server'; w.__nmx.render(); return 1;`);
const dio2 = (await grab('drawio')).text, m2 = /<object label="&lt;b&gt;AP-LOBBY&lt;\/b&gt;[^"]*"([^>]*)>/.exec(dio2);
ok('draw.io: when the type was picked by hand, that type is exported', m2 && / type="Server"/.test(m2[1]), m2 && m2[1]);
await fr(`const n = w.__nmx.nodes().find(n => n.name === 'AP-LOBBY'); n.type = 'custom'; w.__nmx.render(); return 1;`);

// SVG and PNG: the canvas icons are drawn into the picture
const icons = { ap: 'M5 15h14v5H5z', phone: 'M4 10h16v10H4z' }; // the start of each canvas icon path (NMX_KIND_ICON)
const svg = await grab('svg'); if (process.env.DUMP) { (await import('node:fs')).writeFileSync(process.env.DUMP + '.svg', svg.text); }
ok('SVG: the picture has the access point and phone icons and every device name', svg && svg.text.includes(icons.ap) && svg.text.includes(icons.phone) && ['AP-LOBBY', 'IP-Phone-Conf', 'esx01.lab.exam', 'SAN-01', 'CORE-01'].every((n) => svg.text.includes(n)) /* long names are shortened with an ellipsis, as on the canvas */, svg && svg.text.length);
const png = await grab('png-dark');
ok('PNG: a real PNG file comes out', png && png.type === 'image/png' && png.head.join(',') === '137,80,78,71,13,10,26,10', png && { type: png.type, head: png.head });

// JSON project round trip: kinds, types, positions, interface names and link evidence come back
const snapOf = () => J(`const x = w.__nmx, m = x.model(), v = x.NM.view(m, {}); const nm = (id) => m.devices[id].name;
  return { kinds: Object.values(m.devices).map(d => d.name + ':' + d.kind).sort(), nodes: x.nodes().filter(n => n.kind === 'device').map(n => [n.name, n.type, Math.round(n.x), Math.round(n.y)]).sort(), links: v.links.map(L => [nm(L.a.dev), L.a.ifk, nm(L.b.dev), L.b.ifk, L.status].join(' ')).sort(), drawn: x.links().map(l => [l.ifA, l.ifB].join('/')).sort() };`);
const before = await snapOf(), text = await J(`return w.__nmx.project();`);
await fr(`w.confirm = () => true; w.__nmx.load(${JSON.stringify('{"nodes":[],"links":[]}')}); return 1;`); await wait(200);
await fr(`w.confirm = () => true; return w.__nmx.load(${JSON.stringify(text)});`); await wait(300);
const after = await snapOf();
ok('JSON: the saved project comes back with the same kinds, types, positions, interface names and link evidence', JSON.stringify(after) === JSON.stringify(before), { before: before.links.length, after: after.links.length, kinds: after.kinds.slice(0, 6) });
T.finish();
