#!/bin/sh
# Checks that tests/run.sh is safe to use next to other browser runs (audit finding DA-10).
#   sh tests/runner-isolation.sh
# It starts the real runner on tiny stand-in test files (not the real suites), plus one unrelated Firefox that must survive.
# Needs Firefox, node and lsof.
HERE="$(cd "$(dirname "$0")" && pwd)"
FIREFOX="${FIREFOX:-/Applications/Firefox.app/Contents/MacOS/firefox}"
[ -x "$FIREFOX" ] || FIREFOX="$(command -v firefox)"
[ -x "$FIREFOX" ] || { echo "Firefox not found. Set FIREFOX=/path/to/firefox"; exit 2; }
command -v lsof >/dev/null || { echo "lsof not found"; exit 2; }
W="$(mktemp -d)"; pass=0; fail=0; FOREIGN=""; FPROF=""
finish() { [ -n "$FOREIGN" ] && kill "$FOREIGN" 2>/dev/null; [ -n "$FPROF" ] && rm -rf "$FPROF"; rm -rf "$W"; }
trap finish EXIT
check() { if [ "$2" = "ok" ]; then pass=$((pass + 1)); echo "  ok   $1"; else fail=$((fail + 1)); echo "  FAIL $1 ($2)"; fi; }
port_closed() { [ -z "$(lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null)" ]; }
mk() { # mk <dir> <name> <body>: a stand-in test that records its Firefox port in <dir>/<name>.port, then runs <body>
  mkdir -p "$1"; cat > "$1/$2.test.mjs" <<JS
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('./$2.port', import.meta.url), process.env.KIT_BIDI_PORT);
const alive = async () => { try { const ws = new WebSocket('ws://127.0.0.1:' + process.env.KIT_BIDI_PORT + '/session'); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); ws.close(); return true; } catch { return false; } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
$3
JS
}
run() { KIT_TESTS_DIR="$1" sh "$HERE/run.sh" "${2:-*}"; }

echo "an unrelated Firefox that must never be touched"
FPROF="$(mktemp -d)"
"$FIREFOX" --headless --no-remote --profile "$FPROF" --remote-debugging-port 0 about:blank > "$FPROF/ff.log" 2>&1 &
FOREIGN=$!
FPORT=""; for i in $(seq 1 60); do FPORT="$(sed -n 's/.*listening on ws:\/\/127\.0\.0\.1:\([0-9]*\).*/\1/p' "$FPROF/ff.log" | head -1)"; [ -n "$FPORT" ] && break; sleep 0.5; done
[ -n "$FPORT" ] || { echo "could not start the unrelated Firefox"; exit 2; }

echo "two runs at the same time use different ports and both pass"
mk "$W/a" slow 'await wait(6000); process.exit(await alive() ? 0 : 1);'
mk "$W/b" quick 'await wait(1500); process.exit(await alive() ? 0 : 1);'
run "$W/a" > "$W/a.log" 2>&1 & APID=$!
run "$W/b" > "$W/b.log" 2>&1 & BPID=$!
wait $BPID; B=$?; wait $APID; A=$?
check "run A passed while run B started and finished" "$([ $A -eq 0 ] && echo ok || echo "exit $A")"
check "run B passed" "$([ $B -eq 0 ] && echo ok || echo "exit $B")"
check "the two runs used different ports" "$([ "$(cat "$W/a/slow.port")" != "$(cat "$W/b/quick.port")" ] && echo ok || echo same)"
check "both browsers are gone afterwards" "$(port_closed "$(cat "$W/a/slow.port")" && port_closed "$(cat "$W/b/quick.port")" && echo ok || echo "still listening")"

echo "a failing test still cleans up and reports failure"
mk "$W/f" bad 'await wait(300); console.log("boom"); process.exit(1);'
run "$W/f" > "$W/f.log" 2>&1; F=$?
check "exit code is non-zero" "$([ $F -ne 0 ] && echo ok || echo "exit $F")"
check "browser is gone" "$(port_closed "$(cat "$W/f/bad.port")" && echo ok || echo "still listening")"
check "profile folder is gone" "$([ -z "$(ls -d "${TMPDIR:-/tmp}"/tmp.* 2>/dev/null | while read d; do [ -f "$d/ff.log" ] && grep -q "$(cat "$W/f/bad.port")" "$d/ff.log" 2>/dev/null && echo "$d"; done)" ] && echo ok || echo "left behind")"

echo "a test that hangs is stopped by the timeout"
mk "$W/t" hang 'await wait(600000);'
KIT_TEST_TIMEOUT=4 run "$W/t" > "$W/t.log" 2>&1; T=$?
check "exit code is non-zero" "$([ $T -ne 0 ] && echo ok || echo "exit $T")"
check "the log says it timed out" "$(grep -q 'TIMED OUT' "$W/t.log" && echo ok || echo "no message")"
check "browser is gone" "$(port_closed "$(cat "$W/t/hang.port")" && echo ok || echo "still listening")"

echo "Ctrl+C (an interrupt) stops the runner and its browser"
mk "$W/i" hang 'await wait(600000);'
run "$W/i" > "$W/i.log" 2>&1 & RPID=$!
for i in $(seq 1 40); do [ -f "$W/i/hang.port" ] && break; sleep 0.5; done
sleep 1; IPORT="$(cat "$W/i/hang.port" 2>/dev/null)"
check "the browser was running before the interrupt" "$([ -n "$IPORT" ] && ! port_closed "$IPORT" && echo ok || echo "not running")"
kill -INT $RPID; wait $RPID 2>/dev/null
sleep 1
check "browser is gone after the interrupt" "$([ -n "$IPORT" ] && port_closed "$IPORT" && echo ok || echo "still listening")"
check "no node test process is left" "$(pgrep -f "$W/i/hang.test.mjs" >/dev/null && echo "left over" || echo ok)"

echo "the unrelated Firefox was never touched"
check "still running" "$(kill -0 "$FOREIGN" 2>/dev/null && ! port_closed "$FPORT" && echo ok || echo "it was stopped")"

echo; echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
