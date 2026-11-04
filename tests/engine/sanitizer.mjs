// Log Sanitizer regressions (review findings LS-01 to LS-05). Runs the sanitizer code that ships in index.html.
import { loadTool } from './tool.mjs';
import { test, ok, eq, done } from './lib.mjs';
const T = loadTool('log-sanitizer', ['sanitizeText', 'createSession', 'rehydrateText', 'renumberAfterDelete', 'tokenNameOf', 'SANITIZATION_RULES', 'DEFAULT_SAFE_WHITELIST']);
const opts = (wl) => { const o = { customTerms: [], whitelist: new Set(wl || []), customRules: [], knownSecrets: [], keepNasPaths: false, sensitivity: 'strict' }; T.SANITIZATION_RULES.forEach((r) => { o[r.id] = true; }); return o; };
const clean = (text, wl) => { const s = T.createSession(), r = T.sanitizeText(text, opts(wl), s); return { out: r.text, s, back: T.rehydrateText(r.text, s).text }; };
const noLeak = (text, secrets, wl) => { const r = clean(text, wl); for (const v of secrets) ok(!r.out.includes(v), 'still visible: ' + v + ' in ' + JSON.stringify(r.out)); eq(r.back, text, 'restore round trip'); return r; };

console.log('LS-01 YAML block scalars');
test('literal block under password is hidden', () => noLeak('password: |\n  hunter2\n  SuperSecret\nname: web\n', ['hunter2', 'SuperSecret']));
test('folded block with chomping and indent indicators', () => { noLeak('db_password: >-\n  hunter2\n  SuperSecret\nother: 1\n', ['hunter2', 'SuperSecret']); noLeak('secret: |2+\n   hunter2\nok: yes\n', ['hunter2']); });
test('CRLF line endings', () => noLeak('password: |\r\n  hunter2\r\n  SuperSecret\r\nname: web\r\n', ['hunter2', 'SuperSecret']));
test('nested mapping and a following sibling field stay readable', () => { const r = noLeak('app:\n  auth:\n    api_token: |\n      abc123tokenvalue\n    user_note: keepme\n  port: 8080\n', ['abc123tokenvalue']); ok(r.out.includes('port: 8080') && r.out.includes('keepme'), r.out); });
test('a lone block scalar with no other YAML lines is still hidden', () => noLeak('password: |\n  hunter2\n', ['hunter2']));
test('the block indicator itself is kept', () => ok(clean('password: |\n  hunter2\n').out.startsWith('password: |\n'), 'indicator replaced'));

console.log('LS-02 Digest authorization');
test('plain Digest header hides every parameter', () => noLeak('Authorization: Digest username="Alice", realm="corp", nonce="abc123nonce", uri="/x", cnonce="cn0nce99", response="0123456789abcdef"', ['Alice', 'abc123nonce', 'cn0nce99', '0123456789abcdef', 'corp']));
test('Proxy-Authorization with CRLF stops at the line end', () => { const r = noLeak('Proxy-Authorization: Digest username="bob", realm="r1", response="aabbccdd"\r\nHost: example.org', ['bob', 'aabbccdd']); ok(r.out.includes('Host:'), r.out); });
test('Digest header inside a JSON string', () => { const r = noLeak('{"Authorization": "Digest username=\\"Alice\\", nonce=\\"abc123nonce\\", response=\\"0123456789abcdef\\"", "x": 1}', ['Alice', 'abc123nonce', '0123456789abcdef']); ok(r.out.includes('"x": 1'), r.out); });
test('Bearer tokens still work', () => noLeak('Authorization: Bearer abcdef0123456789token', ['abcdef0123456789token']));

console.log('LS-03 hostnames outside the fixed suffix list');
test('host= fields with unusual suffixes', () => noLeak('host=core.company.tech\nserver: router.company.solutions\nendpoint="vpn.acme-corp.zzz"', ['core.company', 'router.company', 'vpn.acme-corp']));
test('plain text names under added suffixes', () => noLeak('connect to switch1.branch.systems and edge.example.solutions now', ['switch1.branch', 'edge.example']));
test('versions and file names are not treated as hosts', () => { const t = 'version=1.2.3\ntarget=build.sh\nhost=localhost\nserver: nginx/1.18.0\nconfig=app.yaml'; eq(clean(t).out, t); });

console.log('LS-04 mask allowlist');
test('masks are kept where they are masks', () => { for (const t of ['ip address 10.1.1.1 255.255.255.0', 'netmask 128.0.0.0', 'mask=255.255.0.0', 'access-list 1 permit 10.1.1.0 0.0.0.255', 'wildcard=0.0.0.255', '   Subnet Mask . . . . . . . . . . . : 255.255.0.0']) ok(clean(t, T.DEFAULT_SAFE_WHITELIST).out.includes(t.split(' ').slice(-1)[0]), t + ' -> ' + clean(t, T.DEFAULT_SAFE_WHITELIST).out); });
test('the same numbers as addresses are redacted', () => { for (const [t, v] of [['ip=128.0.0.0', '128.0.0.0'], ['dst 128.0.0.0 via 10.1.1.1', '128.0.0.0'], ['http://128.0.0.0/x', '128.0.0.0'], ['src=0.0.0.255', '0.0.0.255']]) ok(!clean(t, T.DEFAULT_SAFE_WHITELIST).out.includes(v), t + ' -> ' + clean(t, T.DEFAULT_SAFE_WHITELIST).out); });
test('the shipped default allow-list holds no mask-looking address', () => ok(!T.DEFAULT_SAFE_WHITELIST.includes('128.0.0.0') && !T.DEFAULT_SAFE_WHITELIST.includes('255.255.255.0'), 'masks are back in the list'));

console.log('LS-05 issued placeholders never change');
test('deleting a mapping does not renumber later placeholders', () => {
  const s = T.createSession(), text = 'password=AAAAAAAA1x\npassword=BBBBBBBB2y\n', r = T.sanitizeText(text, opts(), s);
  const names = [...s.map.entries()].map(([orig, m]) => [orig, m.replacement]);
  const a = names.find(([o]) => o.includes('AAAAAAAA1x')), b = names.find(([o]) => o.includes('BBBBBBBB2y'));
  ok(a && b && a[1] !== b[1], 'two placeholders issued');
  const meta = s.map.get(a[0]), name = T.tokenNameOf(meta.replacement);
  s.map.delete(a[0]); s.tokRev.delete(name); T.renumberAfterDelete(s, name);
  eq(s.map.get(b[0]).replacement, b[1], 'later placeholder changed');
  const back = T.rehydrateText(a[1] + ' ' + b[1], s).text;
  ok(back.includes(b[0]) && !back.includes('BBBBBBBB2y'.replace('BBBBBBBB2y', '') + 'AAAAAAAA1x'), back);
  ok(!back.includes('AAAAAAAA1x'), 'the deleted label must stay unresolved: ' + back);
  ok(back.includes(a[1]), 'deleted placeholder stays as text');
});
test('a new secret after a delete gets a new number', () => {
  const s = T.createSession(); T.sanitizeText('password=AAAAAAAA1x\n', opts(), s);
  const [orig, meta] = [...s.map.entries()][0], name = T.tokenNameOf(meta.replacement), old = meta.replacement;
  s.map.delete(orig); s.tokRev.delete(name); T.renumberAfterDelete(s, name);
  T.sanitizeText('password=CCCCCCCC3z\n', opts(), s);
  const fresh = [...s.map.values()].map((m) => m.replacement);
  ok(!fresh.includes(old), 'deleted placeholder number was reused: ' + fresh);
});
console.log('DR-11 Windows Wi-Fi keys');
const wlan = 'netsh wlan show profile name=Home key=clear\r\nSecurity settings\r\n-----------------\r\n    Authentication         : WPA2-Personal\r\n    Security key           : Present\r\n    Key Content            : HomeWifi2024\r\n';
test('Key Content is hidden and the label is kept', () => { const r = noLeak(wlan, ['HomeWifi2024']); ok(/Key Content {12}: \[SECRET_\d+\]\r\n/.test(r.out), r.out); });
test('a key with spaces and symbols is hidden whole', () => noLeak('    Key Content            : my home wifi! 2024\n', ['my home wifi! 2024', 'home wifi']));
test('a lone Key Content line is hidden', () => noLeak('Key Content : Sup3rS3cret\n', ['Sup3rS3cret']));

console.log('DR-12 name= values that are not paths');
test('name values are not turned into log file paths', () => {
  for (const t of ['name: web', 'name=Home', 'profile name=Office key=clear', '  - name: nginx']) ok(!clean(t).out.includes('/var/log/'), t + ' -> ' + clean(t).out);
});
test('name values that are not paths stay hidden', () => { noLeak('netsh wlan show profile name=Office key=clear', ['Office']); noLeak('name=Home\n', ['Home']); });
test('auditd path values are still replaced with a path', () => {
  const r = noLeak('type=PATH msg=audit(1700000000.123:42): item=0 name="/home/alice/secret.txt" inode=1', ['alice']); ok(/name="\/home\//.test(r.out), r.out);
});
console.log('IR-04 profile names with spaces and quotes');
test('a double-quoted name with spaces is hidden whole, and the restore round-trips', () => {
  const r = noLeak('netsh wlan show profile name="My Home WiFi" key=clear', ['My Home WiFi', 'Home WiFi']); ok(/name="\[ID_\d+\]"/.test(r.out), r.out);
});
test('single quotes, CRLF and a second quoted value on the line', () => {
  noLeak("netsh wlan show profile name='Guest Net 5G' key=clear\r\n", ['Guest Net 5G']);
  noLeak('name="Office Floor 2" and name="Lab Wifi"', ['Office Floor 2', 'Lab Wifi']);
});
test('an unquoted netsh profile name with spaces stops before key= and interface=', () => {
  const r = noLeak('netsh wlan show profile name=My Home WiFi key=clear', ['My Home WiFi', 'Home WiFi']); ok(/ key=/.test(r.out), r.out);
  noLeak('netsh wlan delete profile name=Cafe Guest interface=Wi-Fi', ['Cafe Guest']);
});
test('a name: line keeps only the rest of that line, up to a comma', () => {
  noLeak('    Name                   : My Home WiFi\r\n', ['My Home WiFi', 'Home WiFi']);
  const r = clean('{name: web, port: 80}'); ok(/port: 80/.test(r.out) && !r.out.includes('name: web'), r.out);
});
test('empty values are left alone', () => { for (const t of ['name=""', "name=''", 'name=']) eq(clean(t).out, t); });
test('real paths in quotes are still paths', () => {
  const r = noLeak('type=PATH msg=audit(1700000000.123:42): item=0 name="/home/alice/secret.txt" inode=1', ['alice']); ok(/name="\/home\//.test(r.out) && !/\[ID_/.test(r.out), r.out);
});
test('long lines of spaces after name: do not stall', () => { const t0 = Date.now(); clean('name:' + ' '.repeat(50000) + 'x\nname=' + 'a '.repeat(20000)); ok(Date.now() - t0 < 2000, 'slow: ' + (Date.now() - t0) + ' ms'); });
console.log('Hostname rule: runs of whitespace cost linear time, and detection is unchanged');
// Slowest of a few runs, so one slow scheduling hiccup does not fail the check.
const timeIt = (t) => { let best = Infinity; for (let i = 0; i < 3; i++) { const t0 = performance.now(); clean(t); best = Math.min(best, performance.now() - t0); } return best; };
const shapes = { spaces: (n) => ' '.repeat(n) + 'x', tabs: (n) => '\t'.repeat(n) + 'x', 'host: then spaces': (n) => 'host:' + ' '.repeat(n) + 'x', 'Digest then spaces': (n) => 'Authorization: Digest' + ' '.repeat(n) + 'x' };
for (const [name, mk] of Object.entries(shapes)) test('doubling the whitespace does not quadruple the time (' + name + ')', () => {
  // Quadratic work measured about 65 ms at 12,500 and 1,600 ms at 50,000. Linear work stays in single digits.
  const t = [10000, 20000, 40000, 80000].map((n) => timeIt(mk(n)));
  ok(t[3] < 500, '80,000 characters took ' + Math.round(t[3]) + ' ms (' + t.map(Math.round).join(', ') + ')');
  ok(t[3] / Math.max(t[0], 5) < 24, 'time grew ' + (t[3] / Math.max(t[0], 5)).toFixed(1) + 'x for 8x the input (' + t.map(Math.round).join(', ') + ' ms)');
});
test('a whitespace run before a real hostname still finds the hostname', () => {
  const r = noLeak('x' + ' '.repeat(30000) + 'host=core.company.tech\n', ['core.company']); ok(/host=\[?\S/.test(r.out), r.out);
});
test('hostnames named by a keyword are hidden, whatever the spacing, quotes or case', () => {
  for (const [t, secret] of [
    ['host=core.company.tech', 'core.company'], ['hostname: "edge1.branch.systems"', 'edge1.branch'], ["server = 'vpn.acme-corp.zzz'", 'vpn.acme-corp'],
    ['HOST :   srv-01.lab.cloudy', 'srv-01.lab'], ['{"endpoint": "api.partner.solutions"}', 'api.partner'], ['remote\t=\tgw1.site.systems', 'gw1.site'],
    ['fqdn:\n  core.company.tech', 'core.company'], ['proxy=\r\n  p1.edge.zzz', 'p1.edge'], ['Target: DB-MAIN.CORP.XYZ', 'DB-MAIN.CORP'], ['upstream: "a.b.c.d.example"', 'a.b.c'],
  ]) noLeak(t, [secret]);
});
test('hostnames with a known suffix are hidden without any keyword', () => { for (const t of ['connect to web01.corp.local now', 'mail.example.com', 'ping db-main.internal.lan', 'see https://git.company.io/x']) noLeak(t, [t.match(/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/)[0].split('.').slice(0, 2).join('.')]); });
test('the same hostname gets the same placeholder in both forms, and restores', () => {
  const t = 'host=core.company.tech and later core.company.tech again', r = clean(t); ok(!r.out.includes('core.company'), r.out); eq(r.back, t); eq(new Set(r.out.match(/\[HOST_\d+\]|node-\d+\.example\.net|node-\d+/g)).size, 1, r.out);
});
test('words that only look like keywords, and plain versions, are left alone', () => { for (const t of ['version=1.2.3', 'ghost: 1.2.3', 'server: nginx/1.18.0', 'hostname: localhost', 'target=build.sh']) eq(clean(t).out, t); });

console.log('DA-03 passwords typed after other options in Windows and SQL commands');
test('net use: password after /user: is hidden, user and server too', () => { const r = noLeak('net use Z: \\\\fs01\\share /user:corp\\bob Secr3t99', ['Secr3t99', 'bob', 'fs01']); ok(r.out.startsWith('net use Z: '), r.out); });
test('net use: quoted password with spaces and punctuation', () => noLeak('net use \\\\fs01\\share /user:corp\\bob "my p@ss;word! 9" /persistent:no', ['my p@ss', 'word! 9']));
test('net use: password before /user: and options in any order', () => { noLeak('net use Z: \\\\fs01\\share P@ss#1 /user:corp\\bob', ['P@ss#1']); noLeak('net use \\\\fs01\\share /persistent:yes /user:bob Xyz!7q', ['Xyz!7q']); noLeak('net1 use \\\\fs01\\share /user:"corp\\bob" Qw3rty!9 /persistent:no', ['Qw3rty!9']); });
test('net use: the * prompt, no password and other switches leave the command readable', () => { for (const t of ['net use \\\\fs01\\share /user:bob *', 'net use \\\\fs01\\share /user:bob', 'net use Z: /delete', 'net use Z: \\\\fs01\\share /persistent:yes', 'net use']) { const r = clean(t); ok(!r.out.includes('[SECRET_'), 'false positive: ' + r.out); eq(r.back, t); } });
test('sqlcmd, osql and bcp -P hide the password; sqlcmd -p (statistics) does not', () => { noLeak('sqlcmd -S db1 -U sa -P Sq1Pass9 -Q "select 1"', ['Sq1Pass9']); noLeak('osql -S db1 -U sa -P "Pa ss;9" -q "x"', ['Pa ss;9']); noLeak('bcp db.dbo.t out t.dat -c -U sa -P Bcp#Pw1', ['Bcp#Pw1']); const t = 'sqlcmd -S db1 -E -p -Q "select 1"'; eq(clean(t).out, t); });
test('runas has no password argument, psexec -p still works, user names are still replaced', () => { const r = clean('runas /user:corp\\bob cmd'); ok(!r.out.includes('bob') && !r.out.includes('[SECRET_'), r.out); noLeak('psexec \\\\h1 -u corp\\bob -p Ps3xecPw cmd', ['Ps3xecPw', 'bob']); });
test('the same password gets one placeholder wherever it appears, and restores', () => { const t = 'net use Z: \\\\fs01\\share /user:corp\\bob Secr3t99\nsqlcmd -S db -U sa -P Secr3t99 -Q "x"'; const r = noLeak(t, ['Secr3t99']); eq(new Set(r.out.match(/\[SECRET_\d+\]/g)).size, 1, r.out); });
done();
