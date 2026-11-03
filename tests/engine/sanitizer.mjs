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
done();
