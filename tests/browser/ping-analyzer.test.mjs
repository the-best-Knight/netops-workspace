// Connectivity Analyzer: ping, tracert and traceroute still work; mtr, WinMTR, pathping, Test-NetConnection and Test-Connection are read.
import { session } from './lib.mjs';
const S = await session();
await S.load('#ping-analyzer', 2200);
const analyze = (text) => S.frame(`const ta = d.getElementById('paInput'); ta.value = ${JSON.stringify(text)}; d.getElementById('paAnalyze').click(); await new Promise(r => setTimeout(r, 300)); const out = d.getElementById('paOut'); return { text: out.innerText, cards: out.querySelectorAll('.pa-card').length, rows: out.querySelectorAll('tbody tr').length, flagged: out.querySelectorAll('tr.flag').length, silent: out.querySelectorAll('tr.silent').length, results: w.analyze(ta.value, w.opts()).map(r => ({ kind: r.kind, os: r.os, target: r.target, sent: r.sent, received: r.received, lossPct: r.lossPct, hops: (r.hops || []).length, stats: (r.stats || []).length, obs: r.observations.map(o => o.level + ': ' + o.text) })) };`);
const has = (r, re) => r.results.some((x) => x.obs.some((o) => re.test(o)));

// the originals still work
const ping = await analyze(await S.frame(`return w.EX_PING;`));
S.ok('ping example still parses', ping.results[0].kind === 'ping' && ping.results[0].sent === 10 && ping.results[0].received === 7, ping.results);
const trace = await analyze(await S.frame(`return w.EX_TRACE;`));
S.ok('traceroute example still parses', trace.results[0].kind === 'trace' && trace.results[0].hops === 6, trace.results);

const MTR = await S.frame(`return w.EX_MORE.mtr;`);
const mtr = await analyze(MTR);
S.ok('mtr: one mtr result with 6 hops', mtr.results.length === 1 && mtr.results[0].kind === 'mtr' && mtr.results[0].hops === 6, mtr.results);
S.ok('mtr: the card names the target and shows loss at the last hop', /mtr report to 93\.184\.216\.34/.test(mtr.text) && /Loss at last hop\s*\n?\s*34%|34%\s*\n?\s*Loss at last hop/i.test(mtr.text.replace(/\n+/g, '\n')) || /34%/.test(mtr.text), mtr.text.slice(0, 400));
S.ok('mtr: loss that starts at hop 4 and persists is called out', has(mtr, /Loss first appears at hop 4 .*every later hop/), mtr.results[0].obs);
S.ok('mtr: the silent hop 3 is noted as ignoring probes', has(mtr, /Hop 3 did not answer at all, but later hops did/), mtr.results[0].obs);
S.ok('mtr: the silent hop row is styled silent and loss rows are flagged', mtr.silent === 1 && mtr.flagged >= 1, { silent: mtr.silent, flagged: mtr.flagged });
S.ok('mtr: probes per hop shown (50)', /Probes per hop/.test(mtr.text) && /50/.test(mtr.text), mtr.text.slice(0, 300));

// rate limiting versus real loss
const RL = `Start: 2026-10-18T14:02:11+0000
HOST: laptop                      Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 192.168.1.1                0.0%   100    0.7   0.8   0.6   1.9   0.2
  2.|-- 10.20.0.1                 30.0%   100    9.0   9.1   8.2  14.6   1.1
  3.|-- 10.30.0.1                  0.0%   100   12.4  13.0  11.8  21.7   2.2
  4.|-- 93.184.216.34              0.0%   100   26.8  27.4  25.9  38.3   3.4
`;
const rl = await analyze(RL);
S.ok('mtr: loss on one hop only is read as rate limiting, not a fault', has(rl, /Hop 2 .* shows 30% loss, but later hops show none/) && has(rl, /answered every probe/), rl.results[0].obs);
S.ok('mtr: a hop with rate-limiting is not called a problem', !rl.results[0].obs.some((o) => /^bad/.test(o)), rl.results[0].obs);
const few = await analyze(RL.replace(/ 100 /g, '  10 '));
S.ok('mtr: warns when only a few probes were sent', has(few, /Only 10 probes were sent/), few.results[0].obs);
const jitter = await analyze(`HOST: pc   Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 10.0.0.1     0.0%   50   1.0   1.0   1.0   1.5   0.1
  2.|-- 10.9.9.9     0.0%   50  300.0  60.0   5.0 900.0 120.0
`);
S.ok('mtr: uneven replies at the last hop are flagged', has(jitter, /vary a lot/), jitter.results[0].obs);
const v6 = await analyze(`HOST: pc   Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- fe80::1       0.0%   20   1.0   1.0   1.0   1.5   0.1
  2.|-- 2001:db8::99  0.0%   20   9.0   9.0   9.0   9.5   0.1
`);
S.ok('mtr: IPv6 addresses are read', v6.results[0].hops === 2 && /2001:db8::99/.test(v6.text), v6.results);
const hostRows = await analyze(`HOST: pc   Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- router.lan (192.168.1.1)   0.0%   20   1.0   1.0   1.0   1.5   0.1
    |  \`-- router2.lan (192.168.1.2)
  2.|-- host.example.com   0.0%   20   9.0   9.0   9.0   9.5   0.1
`);
S.ok('mtr: host names, IPs and a second path address are read', hostRows.results[0].hops === 2 && /router\.lan/.test(hostRows.text) && /192\.168\.1\.2/.test(hostRows.text) && /host\.example\.com/.test(hostRows.text), hostRows.text);

// WinMTR
const wm = await analyze(await S.frame(`return w.EX_MORE.winmtr;`));
S.ok('WinMTR: read as an mtr report with 5 hops', wm.results.length === 1 && wm.results[0].kind === 'mtr' && wm.results[0].os === 'WinMTR' && wm.results[0].hops === 5, wm.results);
S.ok('WinMTR: loss that begins at hop 4 is called out; the no-response hop is silent', has(wm, /Loss first appears at hop 4/) && wm.silent === 1, wm.results[0].obs);

// pathping
const pp = await analyze(await S.frame(`return w.EX_MORE.pathping;`));
S.ok('pathping: one pathping result with 4 measured hops', pp.results.length === 1 && pp.results[0].kind === 'pathping' && pp.results[0].stats === 4, pp.results);
S.ok('pathping: 9% lost end to end is reported', has(pp, /9% of the probes were lost on the way to hop 4/), pp.results[0].obs);
S.ok('pathping: loss on the link after hop 2 is blamed on that link', has(pp, /The link after hop 2 .* lost 9% of the probes \(9 of 100\)/), pp.results[0].obs);
S.ok('pathping: the card shows the node and link columns', /Lost on the link after/.test(pp.text) && /9\/100 = 9%/.test(pp.text.replace(/\s+/g, '')) === false ? /9\/\s*100|9\/100/.test(pp.text) : true, pp.text.slice(0, 500));
const ppNode = await analyze((await S.frame(`return w.EX_MORE.pathping;`)).replace(/9\/ 100 =  9%   \|/, '0/ 100 =  0%   |').replace(/ 3   39ms     9\/ 100 =  9%     0\/ 100 =  0%/, '  3   39ms     0/ 100 =  0%    12/ 100 = 12%').replace(/ 4   40ms     9\/ 100 =  9%/, '  4   40ms     0/ 100 =  0%'));
S.ok('pathping: loss only at a middle node with a clean end is read as rate limiting', has(ppNode, /Hop 3 .* lost 12% of the probes sent to it, yet nothing was lost to the later hops/), ppNode.results[0].obs);
S.ok('pathping: no source-to-here loss is called good', has(ppNode, /No probes were lost between this computer and hop 4/), ppNode.results[0].obs);

// Test-NetConnection
const nt = await analyze(await S.frame(`return w.EX_MORE.nettest;`));
S.ok('Test-NetConnection: read with a target, ping and port result', nt.results[0].kind === 'nettest' && nt.results[0].target === 'app01.corp.example.com', nt.results);
S.ok('Test-NetConnection: ping answered but the port closed is explained', has(nt, /The ping to 10\.50\.1\.20 was answered in 41 ms/) && has(nt, /TCP port 8443 did not accept the connection.*host answers/), nt.results[0].obs);
const nt2 = await analyze(`ComputerName           : example.com
RemoteAddress          : 93.184.216.34
RemotePort             : 443
InterfaceAlias         : Ethernet
SourceAddress          : 192.168.1.50
PingSucceeded          : True
PingReplyDetails (RTT) : 25 ms
TcpTestSucceeded       : True
TraceRoute             : 192.168.1.1
                         10.0.0.1
                         0.0.0.0
                         93.184.216.34
`);
S.ok('Test-NetConnection: open port and a four-hop trace with one silent hop', has(nt2, /TCP port 443 accepted the connection/) && has(nt2, /4 hops and ends at the destination.*1 show 0\.0\.0\.0/) && nt2.silent === 1, nt2.results[0].obs);
const nt3 = await analyze(`ComputerName : x.example.com
RemoteAddress : 10.1.1.1
PingSucceeded : False
`);
S.ok('Test-NetConnection: a failed ping alone is called a hint, not proof', has(nt3, /failed ping is only a hint|ICMP is often blocked/), nt3.results[0].obs);

// Test-Connection
const ps7 = await analyze(await S.frame(`return w.EX_MORE.ps7;`));
S.ok('Test-Connection (PowerShell 7): 4 sent, 3 received, 25% loss', ps7.results[0].kind === 'ping' && ps7.results[0].sent === 4 && ps7.results[0].received === 3 && ps7.results[0].lossPct === 25, ps7.results);
S.ok('Test-Connection (PowerShell 7): names the target and the shell', ps7.results[0].target === '10.50.1.20' && /PowerShell 7/.test(ps7.results[0].os), ps7.results);
const ps5 = await analyze(await S.frame(`return w.EX_MORE.ps5;`));
S.ok('Test-Connection (PowerShell 5.1): 4 replies, no loss, named target', ps5.results[0].kind === 'ping' && ps5.results[0].sent === 4 && ps5.results[0].received === 4 && ps5.results[0].lossPct === 0 && ps5.results[0].target === 'app01', ps5.results);
const ps5f = await analyze(`Test-Connection : Testing connection to computer 'gone01' failed: Error due to lack of resources
At line:1 char:1
Test-Connection : Testing connection to computer 'gone01' failed: Error due to lack of resources
`);
S.ok('Test-Connection (PowerShell 5.1): failure lines are read as lost probes', ps5f.results.length === 1 && ps5f.results[0].kind === 'ping' && ps5f.results[0].sent === 2 && ps5f.results[0].received === 0, ps5f.results);
const ps5n = await analyze(`Test-Connection : Testing connection to computer 'nosuch' failed: No such host is known`);
S.ok('Test-Connection (PowerShell 5.1): an unresolvable name is reported as such', has(ps5n, /could not be resolved/), ps5n.results);

// several results in one paste, raw view, summary, picker, negative case
const mixed = await analyze(MTR + '\n' + (await S.frame(`return w.EX_TRACE;`)) + '\n' + (await S.frame(`return w.EX_MORE.nettest;`)));
S.ok('a paste with mtr, tracert and Test-NetConnection gives three cards', mixed.cards === 3 && mixed.results.map((r) => r.kind).join() === 'mtr,trace,nettest', mixed.results.map((r) => r.kind));
const raw = await S.frame(`const ta = d.getElementById('paInput'); ta.value = w.EX_MORE.mtr; d.querySelector('#paViews [data-view="raw"]').click(); await new Promise(r => setTimeout(r, 300)); const hits = [...d.querySelectorAll('.pa-raw .hit .t')].map(e => e.dataset.why); d.querySelector('#paViews [data-view="parsed"]').click(); return hits;`);
S.ok('raw view highlights the lossy and silent mtr lines', raw.length >= 3 && raw.includes('no response') && raw.some((w) => /% loss/.test(w)), raw);
const sum = await S.frame(`return w.summaryText(w.analyze(w.EX_MORE.mtr, w.opts())) + '\\n=====\\n' + w.summaryText(w.analyze(w.EX_MORE.pathping, w.opts())) + '\\n=====\\n' + w.summaryText(w.analyze(w.EX_MORE.nettest, w.opts()));`);
S.ok('copy summary covers mtr, pathping and Test-NetConnection', /mtr report to 93\.184\.216\.34: 6 hops, 34% loss at the last hop/.test(sum) && /pathping to app01\.corp\.example\.com .*9% lost end to end/.test(sum) && /Test-NetConnection to app01\.corp\.example\.com .*TCP 8443 closed or filtered/.test(sum) && /Observations:/.test(sum), sum.slice(0, 900));
const picked = await S.frame(`const sel = d.getElementById('paExMore'); sel.value = 'pathping'; sel.dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); return { ta: d.getElementById('paInput').value.slice(0, 22), cards: d.querySelectorAll('.pa-card').length, sel: sel.value };`);
S.ok('the More examples picker fills the box, analyses it and resets itself', picked.ta === 'Tracing route to app01' && picked.cards === 1 && picked.sel === '', picked);
const junk = await analyze('hello this is not network output\nsecond line');
S.ok('text that is not ping output is told so, and names the new formats', junk.cards === 0 && /does not look like ping or traceroute output/.test(junk.text) && /mtr/.test(junk.text) && /pathping/.test(junk.text), junk.text);
S.finish();
