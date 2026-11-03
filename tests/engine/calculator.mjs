// Network Calculator regressions (review findings NC-01 and NC-02): the generated ACL and firewall text, run through small evaluators.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('toolkit', ['aclSnippets']);
const out = T.aclSnippets('10.20.0.0', '0.0.255.255', 16);
const flows = [['tcp', 443], ['udp', 53], ['tcp', 22], ['tcp', 445], ['udp', 123], ['icmp', 0]];

// First matching line of one named Cisco ACL decides; no match means the implicit deny.
function ciscoAllows(acl, proto, port) {
  const body = out.cisco.split(/\n(?=ip access-list )/).find((b) => b.includes('ip access-list extended ' + acl));
  for (const l of body.split('\n').filter((x) => x.startsWith(' permit '))) {
    const m = /^ permit (\w+) \S+ \S+ any(?: eq (\d+))?$/.exec(l);
    if (m[1] === 'ip' || (m[1] === proto && (!m[2] || Number(m[2]) === port))) return true;
  }
  return false;
}
function iptablesAllows(proto, port) { return out.firewall.split('\n').some((l) => { const m = /^iptables -A FORWARD .* -p (\w+) --dport (\d+) -j ACCEPT$/.exec(l); return m && m[1] === proto && Number(m[2]) === port; }); }
function nftAllows(proto, port) { return out.firewall.split('\n').some((l) => { const m = /^nft add rule inet filter forward .* (\w+) dport \{ ([\d, ]+) \} accept$/.exec(l); return m && m[1] === proto && m[2].split(',').map(Number).includes(port); }); }

console.log('NC-01 generated extended ACL');
test('the service-restricted ACL permits HTTPS, DNS and SSH only', () => {
  eq(flows.map(([p, n]) => ciscoAllows('ALLOW_SUBNET_SERVICES', p, n)), [true, true, true, false, false, false]);
});
test('the allow-everything ACL is a separate, labelled example', () => {
  ok(flows.every(([p, n]) => ciscoAllows('ALLOW_SUBNET_ALL', p, n)), 'permit ip must allow every flow');
  ok(!/permit ip/.test(out.cisco.split('ALLOW_SUBNET_SERVICES')[1].split('Classic numbered')[0]), 'a permit ip rule is mixed into the service list');
});
test('the restricted example says what the implicit deny does', () => ok(/implicit deny/i.test(out.cisco), 'no explanation'));

console.log('NC-02 iptables and nftables agree');
test('UDP/53 is in both forms and the allowed-flow matrices match', () => {
  const ip = flows.map(([p, n]) => iptablesAllows(p, n)), nft = flows.map(([p, n]) => nftAllows(p, n));
  eq(ip, [true, true, true, false, false, false]); eq(nft, ip);
});
test('the text states the drop-policy prerequisite', () => ok(/policy drop|-P FORWARD DROP/i.test(out.firewall), 'no prerequisite'));
done();
