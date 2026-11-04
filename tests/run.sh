#!/bin/sh
# Browser tests in headless Firefox, a fresh profile and a fresh debugging port for each test file.
#   sh tests/run.sh            run every tests/browser/*.test.mjs
#   sh tests/run.sh hub-keys   run one (the name without .test.mjs)
# Needs Firefox. Set FIREFOX=/path/to/firefox if it is not found, or KIT=file:///.../index.html to test another build.
# KIT_TEST_TIMEOUT (seconds, default 300) stops one test file that hangs.
# Safe next to other runs: Firefox picks its own free port, every browser has its own profile folder, and the runner
# stops only the Firefox it started itself (by process id), also on failure, timeout, Ctrl+C or kill.
cd "${KIT_TESTS_DIR:-$(dirname "$0")/browser}" || exit 1   # KIT_TESTS_DIR is only for tests/runner-isolation.sh
FIREFOX="${FIREFOX:-}"
if [ -z "$FIREFOX" ]; then
  for c in /Applications/Firefox.app/Contents/MacOS/firefox "$(command -v firefox)"; do
    if [ -n "$c" ] && [ -x "$c" ]; then FIREFOX="$c"; break; fi
  done
fi
[ -x "$FIREFOX" ] || { echo "Firefox not found. Set FIREFOX=/path/to/firefox"; exit 2; }
TIMEOUT="${KIT_TEST_TIMEOUT:-300}"
failed=0; total=0; FFPID=""; NODEPID=""; DOGPID=""; PROF=""

# Stop everything this run started, and nothing else.
stop_tree() {
  [ -n "$1" ] || return 0
  kill -0 "$1" 2>/dev/null || return 0
  pkill -TERM -P "$1" 2>/dev/null   # its own child processes
  kill -TERM "$1" 2>/dev/null
  i=0; while kill -0 "$1" 2>/dev/null && [ "$i" -lt 20 ]; do sleep 0.25; i=$((i + 1)); done
  if kill -0 "$1" 2>/dev/null; then pkill -KILL -P "$1" 2>/dev/null; kill -KILL "$1" 2>/dev/null; fi
  wait "$1" 2>/dev/null
}
cleanup() {
  [ -n "$DOGPID" ] && { kill "$DOGPID" 2>/dev/null; wait "$DOGPID" 2>/dev/null; DOGPID=""; }
  [ -n "$NODEPID" ] && { stop_tree "$NODEPID"; NODEPID=""; }
  [ -n "$FFPID" ] && { stop_tree "$FFPID"; FFPID=""; }
  [ -n "$PROF" ] && { rm -rf "$PROF"; PROF=""; }
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM HUP

for t in ${1:-*}.test.mjs; do
  [ -f "$t" ] || continue
  PROF="$(mktemp -d)"
  # downloads land in $KIT_DL, which the tests read
  mkdir -p "$PROF/dl"; export KIT_DL="$PROF/dl"
  cat > "$PROF/user.js" <<UJS
user_pref("browser.download.folderList", 2);
user_pref("browser.download.dir", "$PROF/dl");
user_pref("browser.download.useDownloadDir", true);
user_pref("browser.helperApps.neverAsk.saveToDisk", "text/plain,application/json,application/xml,image/png,image/svg+xml,application/octet-stream,text/html,text/csv,application/zip");
user_pref("browser.download.alwaysOpenPanel", false);
UJS
  # a test file named *.light.test.mjs runs in a light browser, *.dark.test.mjs in a dark one
  case "$t" in
    *.light.test.mjs) echo 'user_pref("layout.css.prefers-color-scheme.content-override", 1);' >> "$PROF/user.js" ;;
    *.dark.test.mjs) echo 'user_pref("layout.css.prefers-color-scheme.content-override", 0);' >> "$PROF/user.js" ;;
  esac
  echo "== $t"; total=$((total + 1))
  # port 0: Firefox chooses a free port and prints it, so two runs never meet on the same one
  "$FIREFOX" --headless --no-remote --profile "$PROF" --remote-debugging-port 0 about:blank > "$PROF/ff.log" 2>&1 &
  FFPID=$!
  PORT=""
  for i in $(seq 1 60); do
    PORT="$(sed -n 's/.*WebDriver BiDi listening on ws:\/\/127\.0\.0\.1:\([0-9][0-9]*\).*/\1/p' "$PROF/ff.log" 2>/dev/null | head -1)"
    [ -n "$PORT" ] && break
    kill -0 "$FFPID" 2>/dev/null || break
    sleep 0.5
  done
  if [ -z "$PORT" ]; then
    echo "   Firefox did not start (see $PROF/ff.log)"; failed=$((failed + 1)); cleanup; continue
  fi
  export KIT_BIDI_PORT="$PORT"
  node "$t" &
  NODEPID=$!
  ( sleep "$TIMEOUT" & SP=$!; trap 'kill $SP 2>/dev/null; exit 0' TERM; wait $SP && { kill -TERM "$NODEPID" 2>/dev/null; echo "   TIMED OUT after ${TIMEOUT}s: $t"; } ) &
  DOGPID=$!
  if wait "$NODEPID"; then :; else failed=$((failed + 1)); echo "   FAILED: $t"; fi
  NODEPID=""
  cleanup
done
echo; echo "$((total - failed))/$total test files passed"
[ "$failed" -eq 0 ]
