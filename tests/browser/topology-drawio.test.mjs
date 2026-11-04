// Topology Builder: Export > draw.io file. Feeds the tool a small crafted diagram (special characters, parallel links,
// a curved link, a down link, every kind of shape) and checks the .drawio XML it writes.
// Set DIO_DUMP=/path/file.drawio to also save the file that was produced.
import { writeFileSync } from 'node:fs';
import { session } from './lib.mjs';
const S = await session();
await S.load('#topology-builder', 2600);

const diagram = {
  format: 'network-topology-builder', version: 1,
  nodes: [
    { id: 1, kind: 'zone', name: 'Data <center> & lab', x: 20, y: 200, w: 420, h: 200 },
    { id: 2, kind: 'device', type: 'cloud', name: 'Internet', x: 200, y: 20, ip: '', vlan: '', mac: '', notes: '' },
    { id: 3, kind: 'device', type: 'firewall', name: 'FW-01', x: 200, y: 130, ip: '10.0.0.1', vlan: '', mac: '', notes: 'uses "quotes" & <tags>', config: 'hostname FW-01\nenable secret 9 $9$abcdefGHIJ\nsnmp-server community Sup3rS3cret RO' },
    { id: 4, kind: 'device', type: 'core', name: 'CORE <1>', x: 60, y: 260, ip: '10.0.1.1', vlan: '10', mac: 'aa:bb:cc:dd:ee:ff', notes: '' },
    { id: 5, kind: 'device', type: 'storage', name: 'SAN-01', x: 280, y: 260, ip: '', vlan: '', mac: '', notes: '' },
    { id: 6, kind: 'device', type: 'lb', name: 'LB-01', x: 200, y: 440, ip: '', vlan: '', mac: '', notes: '' },
    { id: 7, kind: 'text', content: 'Rev 1 & <draft>\nline two', x: 480, y: 40, size: 18 },
  ],
  links: [
    { id: 8, from: 2, to: 3, label: 'ISP · 1G', ifA: '', ifB: 'Eth0', vlan: '', medium: 'wan', status: 'up', color: '' },
    { id: 9, from: 3, to: 4, label: '10G & <LAG>', ifA: 'Eth1', ifB: 'Te1/1', vlan: '10', medium: 'fiber', status: 'up', color: '' },
    { id: 10, from: 3, to: 4, label: '10G b', ifA: 'Eth<2>', ifB: 'Te1/2', vlan: '', medium: 'fiber', status: 'down', color: '' },
    { id: 11, from: 4, to: 5, label: '', ifA: '', ifB: '', vlan: '', medium: 'copper', status: 'up', color: '#ff8800', bend: 40 },
    { id: 12, from: 5, to: 6, label: '', ifA: '', ifB: '', vlan: '', medium: 'copper', status: 'up', color: '' },
  ],
};
const exportDio = () => S.frame(`let blob = null, name = ''; const oc = w.URL.createObjectURL; w.URL.createObjectURL = (b) => { blob = b; return oc.call(w.URL, b); }; const ac = w.HTMLAnchorElement.prototype.click; w.HTMLAnchorElement.prototype.click = function () { name = this.download; }; d.querySelector('#exportMenu summary').click(); d.querySelector('#exportMenu [data-exp="drawio"]').click(); await new Promise(r => setTimeout(r, 500)); w.URL.createObjectURL = oc; w.HTMLAnchorElement.prototype.click = ac; const toast = [...d.querySelectorAll('.toast, #toast')].map(e => e.textContent).join(' | '); return { name, type: blob && blob.type, text: blob ? await blob.text() : null, toast, menuText: d.querySelector('#exportMenu [data-exp="drawio"]').textContent };`);

// the menu entry
const sample = await exportDio();
S.ok('the Export menu has a draw.io entry', /draw\.io file \(\.drawio\)/.test(sample.menuText), sample.menuText);
S.ok('exporting the built-in sample gives a .drawio file named with the date', /^topology-\d{8}\.drawio$/.test(sample.name) && !!sample.text, sample.name);
S.ok('the toast says configurations are not included', /Device configurations are not included/.test(sample.toast), sample.toast);

// load the crafted diagram through the real file picker
await S.frame(`const dt = new w.DataTransfer(); dt.items.add(new w.File([${JSON.stringify(JSON.stringify(diagram))}], 'crafted.json', { type: 'application/json' })); const inp = d.getElementById('file'); inp.files = dt.files; inp.dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 900)); return 1;`);
const out = await exportDio();
if (process.env.DIO_DUMP) writeFileSync(process.env.DIO_DUMP, out.text);
const x = await S.frame(`const doc = new w.DOMParser().parseFromString(${JSON.stringify(out.text)}, 'application/xml'); if (doc.querySelector('parsererror')) return { parseError: doc.querySelector('parsererror').textContent.slice(0, 300) }; const cells = [...doc.querySelectorAll('root > mxCell, root > object')].map(e => { const c = e.tagName === 'object' ? e.querySelector(':scope > mxCell') : e; return { id: e.getAttribute('id'), obj: e.tagName === 'object', label: e.tagName === 'object' ? e.getAttribute('label') : c.getAttribute('value'), attrs: Object.fromEntries([...e.attributes].map(a => [a.name, a.value])), style: c.getAttribute('style') || '', vertex: c.getAttribute('vertex') === '1', edge: c.getAttribute('edge') === '1', source: c.getAttribute('source'), target: c.getAttribute('target'), parent: c.getAttribute('parent'), off: (c.querySelector('mxGeometry > mxPoint[as="offset"]') || { getAttribute: () => null }).getAttribute('y'), geo: (() => { const g = c.querySelector('mxGeometry'); return g ? { x: g.getAttribute('x'), y: g.getAttribute('y'), w: g.getAttribute('width'), h: g.getAttribute('height'), pts: [...g.querySelectorAll('mxPoint[x]')].map(p => [p.getAttribute('x'), p.getAttribute('y')]) } : null; })() }; }); const mx = doc.documentElement; return { root: mx.tagName, diagram: !!mx.querySelector('diagram > mxGraphModel > root'), cells };`);
S.ok('the file is well-formed XML with the mxfile > diagram > mxGraphModel > root structure', !x.parseError && x.root === 'mxfile' && x.diagram, x.parseError || x.root);
const cells = x.cells || [];
const byId = Object.fromEntries(cells.map((c) => [c.id, c]));
const ids = cells.map((c) => c.id);
S.ok('every cell id is unique, and the two root cells are first', new Set(ids).size === ids.length && ids[0] === '0' && ids[1] === '1', ids);
const verts = cells.filter((c) => c.vertex && c.parent === '1'), edges = cells.filter((c) => c.edge), eLabels = cells.filter((c) => c.vertex && c.parent !== '1');
S.ok('5 links become 5 edges, and the 5 interface names become edge labels', edges.length === 5 && eLabels.length === 5 && eLabels.every((l) => byId[l.parent] && byId[l.parent].edge && /edgeLabel/.test(l.style)), { edges: edges.length, labels: eLabels.length });
S.ok('1 zone, 5 devices and 1 text note become 7 shapes', verts.length === 7, verts.map((v) => v.id));
S.ok('every edge joins two real shapes', edges.every((e) => byId[e.source] && byId[e.source].vertex && byId[e.target] && byId[e.target].vertex), edges.map((e) => [e.source, e.target]));
const order = (id) => ids.indexOf(id);
S.ok('zones are drawn first, then links, then devices, then notes (so nothing hides anything)', order('n1') < order('e8') && Math.max(...edges.map((e) => order(e.id))) < Math.min(...[2, 3, 4, 5, 6].map((n) => order('n' + n))) && Math.max(...[2, 3, 4, 5, 6].map((n) => order('n' + n))) < order('n7'), ids);
// text and escaping
S.ok('a zone name with < > & is HTML-escaped so draw.io shows it as typed', byId.n1.label === 'Data &lt;center&gt; &amp; lab' && byId.n1.attrs.type === 'zone', byId.n1);
S.ok('a device name with < > is HTML-escaped inside the label, and the IP is on a second line', byId.n4.label === '<b>CORE &lt;1&gt;</b><br>10.0.1.1', byId.n4.label);
S.ok('device details travel as draw.io data (ip, vlan, mac, type)', byId.n4.attrs.ip === '10.0.1.1' && byId.n4.attrs.vlan === '10' && byId.n4.attrs.mac === 'aa:bb:cc:dd:ee:ff' && byId.n4.attrs.type === 'Core switch', byId.n4.attrs);
S.ok('notes with quotes, & and tags come through exactly', byId.n3.attrs.notes === 'uses "quotes" & <tags>', byId.n3.attrs.notes);
S.ok('a text note keeps its line break and is escaped', byId.n7.label === 'Rev 1 &amp; &lt;draft&gt;<br>line two', byId.n7.label);
S.ok('empty properties are left out instead of written as empty strings', !('ip' in byId.n2.attrs) && !('vlan' in byId.n2.attrs) && !('notes' in byId.n2.attrs), byId.n2.attrs);
// shapes
S.ok('cloud, firewall, storage and load balancer use draw.io shapes that exist', /shape=cloud/.test(byId.n2.style) && /shape=hexagon/.test(byId.n3.style) && /shape=cylinder3/.test(byId.n5.style) && /rhombus/.test(byId.n6.style), [byId.n2.style, byId.n3.style, byId.n5.style, byId.n6.style]);
S.ok('devices keep the canvas size (152 x 56) and whole-number positions', [2, 3, 4, 5, 6].every((n) => byId['n' + n].geo.w === '152' && byId['n' + n].geo.h === '56' && /^\d+$/.test(byId['n' + n].geo.x) && /^\d+$/.test(byId['n' + n].geo.y)), [2, 3, 4].map((n) => byId['n' + n].geo));
S.ok('relative positions are kept exactly (SAN-01 is 220 right of CORE <1>, CORE <1> is 130 below FW-01, FW-01 is 110 below Internet)', +byId.n5.geo.x - +byId.n4.geo.x === 220 && +byId.n4.geo.y - +byId.n3.geo.y === 130 && +byId.n3.geo.y - +byId.n2.geo.y === 110 && +byId.n3.geo.x - +byId.n2.geo.x === 0, [byId.n2.geo, byId.n3.geo, byId.n4.geo, byId.n5.geo]);
S.ok('every coordinate is positive (the diagram starts near the top left)', cells.filter((c) => c.geo && c.vertex && c.parent === '1').every((c) => +c.geo.x >= 0 && +c.geo.y >= 0), 1);
// links
const st = (id) => byId[id].style;
S.ok('a WAN link is dashed with the canvas dash pattern', /dashed=1;dashPattern=10 6;/.test(st('e8')) && /strokeWidth=2\.5/.test(st('e8')), st('e8'));
S.ok('a fibre link is thicker than copper', /strokeWidth=3\.5/.test(st('e9')) && /strokeWidth=2;/.test(st('e12')), [st('e9'), st('e12')]);
S.ok('a down link is red and dashed', /strokeColor=#cf3c46/.test(st('e10')) && /dashed=1/.test(st('e10')), st('e10'));
S.ok('a custom link colour is carried over as a hex colour', /strokeColor=#[0-9a-f]{6}/i.test(st('e11')) && !/strokeColor=#6b7a8a/.test(st('e11')), st('e11'));
S.ok('a link with a bend is a curve with one waypoint', /curved=1/.test(st('e11')) && byId.e11.geo.pts.length === 1, byId.e11.geo);
S.ok('two links between the same devices are separated by waypoints at different places', byId.e9.geo.pts.length === 1 && byId.e10.geo.pts.length === 1 && (byId.e9.geo.pts[0][0] !== byId.e10.geo.pts[0][0] || byId.e9.geo.pts[0][1] !== byId.e10.geo.pts[0][1]), [byId.e9.geo.pts, byId.e10.geo.pts]);
S.ok('a plain single link has no waypoint', byId.e12.geo.pts.length === 0 && !/curved=1/.test(st('e12')), byId.e12.geo);
S.ok('link details travel as data (medium, status, VLAN, interfaces)', byId.e9.attrs.medium === 'Fiber' && byId.e9.attrs.status === 'up' && byId.e9.attrs.vlan === '10' && byId.e9.attrs.interface_a === 'Eth1' && byId.e9.attrs.interface_b === 'Te1/1' && byId.e10.attrs.status === 'down', [byId.e9.attrs, byId.e10.attrs]);
S.ok('the link label is the edge text, HTML-escaped', byId.e8.label === 'ISP · 1G' && byId.e9.label === '10G &amp; &lt;LAG&gt;', [byId.e8.label, byId.e9.label]);
S.ok('an interface name with < > is escaped in its edge label', byId.e10a.label === 'Eth&lt;2&gt;' && byId.e9a.label === 'Eth1', [byId.e10a.label, byId.e9a.label]);
S.ok('interface labels sit at the two ends of the link and are lifted 9 px off the line', eLabels.length === 5 && eLabels.every((l) => l.off === '-9') && byId.e9a.geo.x === '-0.7' && byId.e9b.geo.x === '0.7', eLabels.map((l) => [l.id, l.off, l.geo && l.geo.x]));
// privacy
S.ok('the diagram really holds a configuration, and none of it is written to the file', !/Sup3rS3cret|enable secret|hostname FW-01|\$9\$/.test(out.text) && !/ config=/.test(out.text), 1);
S.finish();
