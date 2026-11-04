# Deep audit remediation, 4 November 2026

This records the fixes for DA-01 to DA-05 and DA-10 from the deep audit ([2026-11-04-deep-audit.md](2026-11-04-deep-audit.md), copied here unchanged). The audit examined commit `8217c57`. `main` had not moved when this work started, and no other session had fixed any of these findings.

Only these six findings were worked on. DA-06 to DA-09, DA-11 and the unverified DA-12 are untouched and still open.

## Status

| ID | Finding | Status |
| --- | --- | --- |
| DA-01 | Switch Lab progress lost between tabs | Resolved for sequential saves, with a stated limit for saves in the same instant |
| DA-02 | Log Sanitizer slows down with many different values | Resolved |
| DA-03 | Positional password left in clear text | Resolved for `net use` and `sqlcmd`, `osql`, `bcp`; limits below |
| DA-04 | Real commands rejected as "Invalid input" | Partially resolved: one part of the finding was an audit error |
| DA-05 | `channel-group` accepted silently | Resolved |
| DA-10 | Test runner kills other sessions' browsers | Resolved |
| DA-06, DA-07, DA-08, DA-09, DA-11 | Low findings | Still open (not in scope) |
| DA-12 | Four Dell OS10 cheat sheet rows | Unable to verify (not in scope) |

The original audit is not fully resolved by this pass.

## DA-03 Log Sanitizer: password after other options

**Reproduction.** `net use Z: \\fs01\share /user:corp\bob Secr3t99` came out as `net use Z: \\NAS-1\share /user:operator1 Secr3t99`.

**Root cause.** The Windows command rule (`winsecret`) expected the password straight after the share name. A `/user:` switch in between meant the password was never reached. No rule covered `sqlcmd -P`.

**Change** (`index.html`, the `winsecret` and `clisecret` rules).
- `net use` now allows any number of `/switch` or `/switch:value` items (quoted values included) between the share and the password.
- `sqlcmd`, `osql` and `bcp` with `-P <password>` are hidden. This sits in the case-sensitive rule on purpose: `sqlcmd -p` (lower case) is the statistics flag and is left alone.
- Checked and left alone: `runas` has no password argument (it always prompts), so there is nothing to hide there. `psexec -p` was already covered and now has a test. `*` (prompt for password) and a missing password are not treated as passwords.

**Tests** (`tests/engine/sanitizer.mjs`, 7 new). Password after `/user:`, quoted password with spaces and punctuation, password before the switches, `*` and no-password forms, `sqlcmd`/`osql`/`bcp`/`-p`, `runas` and `psexec`, and one placeholder for the same password everywhere. Each hides the secret and restores the original text exactly. On the audited code 5 of the 7 fail.

**Limits.** A password that starts with `-` or `/`, or an unquoted one that contains a space, `&`, `|`, `<` or `>`, cannot be told apart from the next option or shell syntax. Export and import through the encrypted file is not exercised by the engine tests (it needs the page); the existing browser tests cover that screen.

## DA-02 Log Sanitizer: speed

**Reproduction.** Same input as the audit: each line has a different IP, hostname and MAC. Node, same machine, before and after:

| Lines | Size | Before | After | Faster |
| --- | --- | --- | --- | --- |
| 2,000 | 130 KB | 430 ms | 137 ms | 3.1x |
| 4,000 | 263 KB | 1,414 ms | 242 ms | 5.8x |
| 8,000 | 531 KB | 5,185 ms | 483 ms | 10.7x |
| 16,000 | 1,078 KB | 19,825 ms | 1,003 ms | 19.8x |
| Ratio 16,000 / 8,000 | | 3.82 | 2.08 | goal was below 3 |

Ordinary logs (sshd lines, repeated values): 25 KB 23 ms to 26 ms, 100 KB 141 ms to 84 ms, 400 KB 975 ms to 271 ms. No slowdown on small input.

**Profile.** One function, `replacementFor`, took nearly all the time. Switching off its checks one at a time showed which: the check that a new fake value does not already appear in the input (`sourceText.indexOf(candidate)`). It scanned the whole input for every new value, so the cost grew with values times input size. Removing that scan took 8,000 lines from 5.1 s to 0.45 s. The other two suspects (the typing-reuse check and the placeholder-number check) made no difference on this input.

**Change.** A new `textHas` function gives the same answer as `indexOf(...) !== -1`. For inputs over 20,000 characters it builds, once per run, a set of every 5-character piece of the input. A value with a piece that is not in the set cannot be in the input, so most checks are answered without a scan. Only a possible hit gets the real search. The numbered-placeholder check uses the same function. Memory: one set of the distinct 5-character pieces of the input.

**Behaviour is identical.** The output text was compared before and after on the audit inputs (same hash at 2,000, 4,000, 8,000 and 16,000 lines) and on large inputs seeded with text that looks like placeholders (`node-1.example.net`, `192.0.2.1`, `[SECRET_1]`, `operator1`). Detection, numbering and restore are unchanged.

**Tests** (`tests/engine/sanitizer.mjs`, 3 new). A speed and scaling test (8,000 lines under 4 s and doubling the input under 3.2 times the time), exact restore of a large input, and a check that a value already in the input is never handed out again. The speed test fails on the audited code and on a copy with the old `indexOf`.

**Remaining.** Time is now linear in practice. The typing-reuse check (`reuseIfStillTyping`) can still split the whole input once per value when two values start with the same text and arrive within 10 s. It did not show up in any measured input and was left alone.

## DA-05 Switch Lab: silent `channel-group`

**Reproduction.** On both vendors `channel-group 1 mode active` printed nothing, and the summary then said no port channels existed.

**Root cause.** The handler that prints "LAG not fully simulated" does run. The console function drops every line that is not an error while in configuration mode (it copies a real switch's silence on success), and that included the warning. So the message was written and thrown away. The same thing hid the lab's note about `duplex` and about Dell `spanning-tree vlan N root`.

**Change.** Limitation notes (class `warn`) now pass through in configuration mode, and the ordinary "Entered interface ..." chatter stays hidden. `channel-group` now checks its syntax, says "port channels are not simulated in this lab, ... nothing was configured", and no longer stores a value or counts as a change. `show etherchannel summary` and `show port-channel summary` now say why the list is empty.

**Tests** (`tests/engine/switchlab.mjs`, 20 new for DA-04 and DA-05 together). On both vendors: the note appears, the port's configuration is unchanged, and the summary explains itself; wrong group number, wrong mode word and incomplete forms stay errors and never show the note; Cisco-only modes (`desirable`, `auto non-silent`) and the group limits (48 on Cisco, 128 on OS10); outside an interface the command stays an error; the chatter stays hidden. 11 of the new tests fail on the audited code.

## DA-04 Switch Lab: real commands answered "Invalid input"

**Retest of each audit example.**

| Example | Result |
| --- | --- |
| `spanning-tree vlan 10 priority 4096` (Cisco) | Was rejected. Now simulated: sets the bridge priority, and `show spanning-tree vlan 10` shows 4106 (4096 + VLAN 10). `4097` gets the IOS message "must be in increments of 4096" with the allowed values; values above 61440 and non-numbers are caret errors. On OS10 the value is checked and the lab says its spanning-tree view does not change. |
| `interface port-channel 1` | Was rejected. Now recognised, says it is not simulated, and returns to global configuration so the next commands do not land on the port you were configuring. |
| `access-list 101 permit tcp any any eq www` (Cisco) | Was rejected. Now recognised with a note pointing to `ip access-list extended <name>`. Numbers outside 1 to 199 and 1300 to 2699 and unknown actions stay errors. OS10 has no such command and still rejects it. |
| `ip route 10.1.0.0 255.255.0.0` (Cisco) | Was a caret error. Now "% Incomplete command." (OS10: "% Error: Incomplete command."). A bad address or mask is still a caret error. |
| `interface range ethernet 1/1/1-1/1/3` (OS10) | **Not a defect.** It works. The audit's test device only has ports 1/1/1 and 1/1/2, so port 3 correctly failed. `interface range ethernet 1/1/1-1/1/2` and Cisco `interface range gi0/1 - 2` work. The audit was wrong on this item. |

I did not check the syntax against Dell or Cisco documents this time. The Cisco messages follow IOS behaviour I know well (increments of 4096, allowed values, incomplete command). The OS10 wording of the priority message is my best reading, not verified.

**Tests.** Covered by the same 20 tests as DA-05, plus a test that keeps `interface range` working on both vendors and still rejecting a port the device lacks. All 55 Switch Lab tests, the lesson tests and the content tests pass, so no lesson or saved-configuration behaviour changed.

**Remaining.** Many other valid commands are still not simulated and still answer "Invalid input". Only the ones from the audit, plus `channel-group` and `interface port-channel`, now say so.

## DA-01 Switch Lab: progress lost between tabs

**Reproduction.** Two real Firefox tabs on Switch Lab. Lesson 1 finished in tab A, lesson 2 in tab B: storage held only lesson 2. Choosing Cisco in A and then saving a lesson in B put the vendor back to Dell. After a reload, "2 of 18 done" where three lessons had been finished.

**Root cause.** Each tab read the saved progress once at start and wrote its whole in-memory copy on every save, together with the vendor.

**Change.**
- `saveProgress` now re-reads storage, joins the other tab's lessons with this tab's (for one lesson the higher lesson revision wins, then this tab's record), and writes the result. If the stored text is unreadable, a copy is kept in `nfl_progress2_unreadable` as before.
- The Cisco/Dell choice is written only when the learner changes it (`saveVendor`), no longer on every lesson save.
- A `storage` listener updates "x of 18 done" and the lesson list in a tab that is already open.
- Related store, fixed: Extreme-level progress (`nfl_extreme_progress1`) had the same pattern. `xpSave` now joins other tabs' completed levels. The 30 second cooldown timers are still per tab.
- Checked, not affected: vSphere Sandbox (`vsphereSandboxDone`) reads the list fresh before every write.

**Tests.** `tests/engine/progress.mjs` (12 tests, two tabs as two copies of the code on one shared fake storage): different lessons, same lesson, newer revision kept, vendor untouched, reload, old-format records, unreadable and odd-shaped stored data, 50 rapid saves from alternating tabs, storage that refuses writes, and the Extreme store. `tests/browser/fault-lab-tabs.test.mjs` (7 checks, two real tabs): both lessons saved, the open tab updates by itself, the vendor survives, a reload keeps all three, damaged saved progress still opens the lab. On the audited code 5 of the 7 browser checks fail, including the original lost lesson.

**Limits.** `localStorage` has no locking. Two saves at the very same instant can still lose one record. The next save, or a `storage` event, repairs it because every tab re-reads before it writes, but this is not atomic. Switch Lab has no "reset progress" button, so there was no reset path to test.

## DA-10 Browser test runner

**Problem.** `tests/run.sh` used port 9333 and ended with `pkill -f "remote-debugging-port 9333"`, so a second run (or another Claude session) lost its browser. This caused a 6 of 26 failure earlier in this project.

**Change** (`tests/run.sh`, `tests/browser/bidi.mjs`). Firefox is started with `--remote-debugging-port 0` and picks a free port, which the runner reads from Firefox's own log and passes to the test as `KIT_BIDI_PORT` (`bidi.mjs` falls back to 9333 when it is not set, so single files still run by hand). Each file keeps its own profile folder. The runner remembers the process ids it started and, on exit, failure, timeout (`KIT_TEST_TIMEOUT`, default 300 s), Ctrl+C or kill, stops only those (its children first), then removes the profile folder. There is no `pkill` by pattern. The commands `sh tests/run.sh` and `sh tests/run.sh <name>`, `FIREFOX` and `KIT` work as before, and the CI workflow is unchanged apart from one added step.

**Tests** (`tests/runner-isolation.sh`, 14 checks, run in CI). With stand-in test files and an unrelated Firefox started first: two runs at once use different ports and both pass; a run that ends while the other continues does not hurt it; a failing test leaves no browser or profile folder behind; a hung test is stopped by the timeout; Ctrl+C stops the runner, its Firefox and its test process; the unrelated Firefox is still running at the end.

**Not done.** I did not re-run the old runner to show the failure again, and I did not mutate the new runner to a broad `pkill` to prove the test would catch it. Either could have killed another session's browser.

## Interactions

- Config mode now shows limitation notes. The `duplex` note on OS10 and the Dell `spanning-tree vlan N root` note appear where they were silently dropped before. No test expected their absence.
- Switch Lab tests, lesson tests and browser tests for Switch Lab and Free practice all pass with the changed command handling.
- The sanitizer speed change is covered by an identical-output comparison, not only by the new tests.

## Test results on the final combined state

- Syntax check: 20 scripts, 0 failed.
- Engine: suite 73, sanitizer 50, configdiff 9, calculator 5, routing 4, switching 23, switchlab 55, vsphere 8, dns 11, ping 23, lessons 6, content 11, scriptrepo 9, os9cheat 18, uitokens 69, progress 12. All pass.
- Fuzz, 800 batches: 0 exceptions, `Object.prototype` clean.
- Browser suite with the new runner: 28 of 28 files passed, 686 of 686 checks (27 existing files plus the new two-tab file).
- Runner isolation: 14 of 14.
- `git diff --check`: clean.

## Not covered

- Windows, Edge and Chrome: everything above was run in Firefox on macOS.
- The Log Sanitizer screen was checked only by a short script: in the real page both example passwords were hidden and an 8,000-line paste was processed. Its export and import screens were not exercised for these changes.
- No vendor documents or hardware were used to check the new Cisco and OS10 command behaviour.

## Follow-up

- Still open: DA-06, DA-07, DA-08 (Low), DA-09 and DA-11 (Low).
- Unverified: the four OS10 cheat sheet rows in DA-12.
- The 26 Dell OS9 rows marked `verify` still need checking on a real switch.
- More valid commands that Switch Lab does not simulate could get the same "recognised, not simulated" message.
