// Tiny test runner shared by the tool tests in this folder (same output style as suite.mjs).
let pass = 0, fail = 0; const failures = [];
export function test(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + '\n         ' + (e && e.message || e)); } }
export function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
export function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'not equal') + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); }
export function done() { console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? ': ' + failures.join('; ') : '')); process.exit(fail ? 1 : 0); }
