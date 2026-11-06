// Layout comparison fixtures. Every name and address is fictional.
// tier = the network tier a reader expects (0 internet, 1 router/firewall, 2 core, 2.5 distribution, 3 access,
// 4 servers/hosts/storage, 5 end devices). Used only to score the result, never fed to a layout.
const T = { cloud: 0, firewall: 1, router: 1, core: 2, switch: 3, esxi: 4, server: 4, storage: 4, ap: 5, phone: 5, endpoint: 5, unknown: 3.5 };
function G(name) {
  const nodes = [], links = [];
  const by = {};
  const g = {
    name, nodes, links,
    n(nm, kind, tier) { if (by[nm]) return g; const o = { name: nm, kind, tier: tier ?? T[kind] }; by[nm] = o; nodes.push(o); return g; },
    l(a, b, times = 1, status = 'confirmed') { for (let i = 0; i < times; i++) links.push({ a, b, status }); return g; },
  };
  return g;
}

export function fixtures() {
  const F = [];
  // 1. the existing fictional five-switch network (tests/fixtures/five-switch), kinds as the importer gives them
  F.push(G('five-switch')
    .n('CORE-01', 'core').n('DIST-01', 'switch', 2.5).n('DIST-02', 'switch', 2.5).n('ACCESS-01', 'switch').n('ACCESS-02', 'switch')
    .n('Server-01', 'endpoint').n('Printer-3F', 'endpoint').n('IP-Phone-Conf', 'phone').n('AP-LOBBY', 'ap').n('WS-ENG-014', 'endpoint').n('ENG-WS-027', 'endpoint')
    .l('CORE-01', 'DIST-01').l('CORE-01', 'DIST-02').l('CORE-01', 'ACCESS-01').l('DIST-01', 'DIST-02').l('DIST-01', 'ACCESS-02').l('DIST-02', 'ACCESS-01')
    .l('Server-01', 'CORE-01', 1, 'inferred').l('Printer-3F', 'DIST-01', 1, 'inferred').l('IP-Phone-Conf', 'DIST-02', 1, 'inferred')
    .l('AP-LOBBY', 'ACCESS-01', 1, 'inferred').l('WS-ENG-014', 'ACCESS-01', 1, 'inferred').l('ENG-WS-027', 'ACCESS-02', 1, 'inferred'));

  // 2. redundant core pair under a firewall pair, four dual-homed access switches
  { const g = G('redundant-core').n('ISP-A', 'cloud').n('FW-01', 'firewall').n('FW-02', 'firewall').n('CORE-A', 'core').n('CORE-B', 'core');
    g.l('ISP-A', 'FW-01').l('ISP-A', 'FW-02').l('FW-01', 'FW-02').l('FW-01', 'CORE-A').l('FW-02', 'CORE-B').l('CORE-A', 'CORE-B', 2);
    for (let i = 1; i <= 4; i++) { const a = 'ACC-0' + i; g.n(a, 'switch').l(a, 'CORE-A').l(a, 'CORE-B');
      for (let k = 1; k <= 3; k++) { const e = `PC-${i}${k}`; g.n(e, 'endpoint').l(e, a, 1, 'inferred'); } }
    g.n('SRV-DB1', 'server').l('SRV-DB1', 'CORE-A').l('SRV-DB1', 'CORE-B');
    F.push(g); }

  // 3. collapsed core/distribution: a router and two collapsed-core switches that also act as distribution, no separate tier
  { const g = G('collapsed-core').n('RTR-WAN', 'router').n('CSW-1', 'core').n('CSW-2', 'core');
    g.l('RTR-WAN', 'CSW-1').l('RTR-WAN', 'CSW-2').l('CSW-1', 'CSW-2', 2);
    for (let i = 1; i <= 5; i++) { const a = 'FLOOR' + i + '-SW'; g.n(a, 'switch').l(a, i % 2 ? 'CSW-1' : 'CSW-2');
      g.n('AP-F' + i, 'ap').l('AP-F' + i, a, 1, 'inferred').n('PH-F' + i, 'phone').l('PH-F' + i, a, 1, 'inferred'); }
    g.n('PRN-F1', 'endpoint').l('PRN-F1', 'FLOOR1-SW', 1, 'inferred');
    F.push(g); }

  // 4. Dell leaf pair with VLTi, four ESXi hosts with two vmnics to each leaf, a NAS, uplinks to a core
  { const g = G('dell-vmware').n('CORE-01', 'core').n('LEAF-1', 'switch').n('LEAF-2', 'switch').n('NAS-01', 'server', 4);
    g.l('CORE-01', 'LEAF-1').l('CORE-01', 'LEAF-2').l('LEAF-1', 'LEAF-2', 2).l('NAS-01', 'LEAF-1').l('NAS-01', 'LEAF-2');
    for (let i = 1; i <= 4; i++) { const h = 'esx0' + i + '.lab.example'; g.n(h, 'esxi').l(h, 'LEAF-1', 2).l(h, 'LEAF-2', 2); }
    g.n('idrac-esx01', 'server', 4).l('idrac-esx01', 'CORE-01', 1, 'inferred');
    F.push(g); }

  // 5. dual-homed servers on an access pair
  { const g = G('dual-homed').n('CORE-01', 'core').n('SW-A', 'switch').n('SW-B', 'switch');
    g.l('CORE-01', 'SW-A').l('CORE-01', 'SW-B').l('SW-A', 'SW-B');
    for (let i = 1; i <= 6; i++) { const s = 'SRV-0' + i; g.n(s, 'server').l(s, 'SW-A').l(s, 'SW-B'); }
    g.n('PC-01', 'endpoint').l('PC-01', 'SW-A', 1, 'inferred').n('PC-02', 'endpoint').l('PC-02', 'SW-B', 1, 'inferred');
    F.push(g); }

  // 6. LACP and parallel links
  { const g = G('lacp-parallel').n('CORE-01', 'core').n('DIST-01', 'switch', 2.5).n('ACC-01', 'switch').n('ACC-02', 'switch');
    g.l('CORE-01', 'DIST-01', 4).l('DIST-01', 'ACC-01', 2).l('DIST-01', 'ACC-02', 2).l('ACC-01', 'ACC-02');
    for (let i = 1; i <= 3; i++) g.n('WS-0' + i, 'endpoint').l('WS-0' + i, i < 3 ? 'ACC-01' : 'ACC-02', 1, 'inferred');
    g.n('ESX-01', 'esxi').l('ESX-01', 'ACC-01', 2).l('ESX-01', 'ACC-02', 2);
    F.push(g); }

  // 7. ring of six switches, two end devices each
  { const g = G('ring');
    for (let i = 1; i <= 6; i++) g.n('RING-SW' + i, 'switch');
    for (let i = 1; i <= 6; i++) g.l('RING-SW' + i, 'RING-SW' + (i % 6 + 1));
    for (let i = 1; i <= 6; i++) for (let k = 1; k <= 2; k++) g.n(`CAM-${i}${k}`, 'endpoint').l(`CAM-${i}${k}`, 'RING-SW' + i, 1, 'inferred');
    F.push(g); }

  // 8. conflicting LLDP observations: one server port seen on two switches, a MAC-only neighbour, an unknown device
  { const g = G('conflicting-lldp').n('CORE-01', 'core').n('ACC-01', 'switch').n('ACC-02', 'switch');
    g.l('CORE-01', 'ACC-01').l('CORE-01', 'ACC-02');
    g.n('srv-app1', 'server').l('srv-app1', 'ACC-01', 1, 'inferred').l('srv-app1', 'ACC-02', 1, 'inferred');
    g.n('00:50:56:aa:bb:01', 'unknown').l('00:50:56:aa:bb:01', 'ACC-01', 1, 'inferred');
    g.n('mystery-box', 'unknown').l('mystery-box', 'ACC-02', 1, 'inferred').l('mystery-box', 'CORE-01', 1, 'inferred');
    g.n('PC-11', 'endpoint').l('PC-11', 'ACC-01', 1, 'inferred').n('PC-12', 'endpoint').l('PC-12', 'ACC-02', 1, 'inferred');
    F.push(g); }

  // 9. misleading hostnames: kinds come from evidence, names point the wrong way
  { const g = G('misleading-names').n('BB-01', 'core').n('edge-sw-01', 'switch').n('srv-switch-01', 'switch').n('host-sw-02', 'switch');
    g.l('BB-01', 'edge-sw-01').l('BB-01', 'srv-switch-01').l('BB-01', 'host-sw-02');
    g.n('CORE-TEST-PC', 'endpoint').l('CORE-TEST-PC', 'edge-sw-01', 1, 'inferred');
    g.n('AP-CORE-LAB', 'ap').l('AP-CORE-LAB', 'srv-switch-01', 1, 'inferred');
    g.n('DIST-PRINTER', 'endpoint').l('DIST-PRINTER', 'host-sw-02', 1, 'inferred');
    g.n('fw-mgmt-pc', 'endpoint').l('fw-mgmt-pc', 'host-sw-02', 1, 'inferred');
    g.n('vmhost-pc-07', 'endpoint').l('vmhost-pc-07', 'edge-sw-01', 1, 'inferred');
    F.push(g); }

  // 10. large: 2 firewalls, 2 cores, 6 distribution, 24 access, 96 end devices, 12 dual-homed ESXi, 4 storage = 146
  { const g = G('large-146').n('FW-A', 'firewall').n('FW-B', 'firewall').n('CORE-A', 'core').n('CORE-B', 'core');
    g.l('FW-A', 'FW-B').l('FW-A', 'CORE-A').l('FW-B', 'CORE-B').l('CORE-A', 'CORE-B', 2);
    for (let d = 1; d <= 6; d++) { const D = 'DIST-0' + d; g.n(D, 'switch', 2.5).l(D, 'CORE-A').l(D, 'CORE-B');
      for (let a = 1; a <= 4; a++) { const A = `ACC-${d}${a}`; g.n(A, 'switch').l(A, D);
        for (let e = 1; e <= 4; e++) { const E = `WS-${d}${a}${e}`; g.n(E, e === 4 ? 'phone' : 'endpoint').l(E, A, 1, 'inferred'); } } }
    for (let h = 1; h <= 12; h++) { const H = 'ESX-' + String(h).padStart(2, '0'); g.n(H, 'esxi').l(H, 'CORE-A').l(H, 'CORE-B'); }
    for (let s = 1; s <= 4; s++) { const S = 'SAN-0' + s; g.n(S, 'server', 4).l(S, 'CORE-A').l(S, 'CORE-B'); }
    F.push(g); }
  return F;
}
