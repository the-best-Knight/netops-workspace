import { session } from './lib.mjs';
const S = await session();
await S.load('#practice-ref');
const pick = (v) => S.frame(`d.getElementById('sheetVendor').value='${v}'; d.getElementById('sheetVendor').dispatchEvent(new Event('change')); const s=d.getElementById('sheetSearch'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,250)); return d.getElementById('sheetBody').innerText;`);
const search = (q) => S.frame(`const s=d.getElementById('sheetSearch'); s.value=${JSON.stringify(q)}; s.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,250)); return d.getElementById('sheetBody').innerText;`);

// 1. Pills: OS9 is its own choice and the others stay
const pills = await S.frame(`return [...d.querySelectorAll('#subVendors [data-v]')].map(b=>b.getAttribute('data-v')+':'+b.textContent.trim()).join('|');`);
S.ok('Dell OS9 sits beside Dell OS10, Cisco IOS and Juniper Junos', ['dell:Dell OS10', 'os9:Dell OS9', 'cisco:Cisco IOS', 'junos:Juniper Junos'].every((x) => pills.includes(x)), pills);
await S.frame(`d.querySelector('#subVendors [data-v="os9"]').click(); await new Promise(r=>setTimeout(r,250)); return 1;`);
const sel = await S.frame(`const b=d.querySelector('#subVendors [data-v="os9"]'); return { v:d.getElementById('sheetVendor').value, on:b.classList.contains('on')||b.classList.contains('active')||b.getAttribute('aria-pressed')==='true', hint:d.getElementById('sheetSearch').placeholder, ctx:(d.querySelector('.ctx')||{}).innerText||'', intro:d.querySelector('.sheet-results').innerText.slice(0,2500) };`);
S.ok('clicking the OS9 pill selects it and says which system it is', sel.v === 'os9' && sel.on && /OS9/.test(sel.ctx), sel);
S.ok('the OS9 intro says the Fault Lab is OS10 and explains the badges', /Switch Lab simulates OS10, not OS9/.test(sel.intro) && /disrupts/i.test(sel.intro) && /verify/i.test(sel.intro), sel.intro.slice(0, 300));

// 2. Natural searches find the right OS9 commands
const cases = [['vlan', 'show vlan'], ['lacp', 'show lacp 1'], ['crc', 'show interfaces tengigabitethernet 1/1'], ['interface errors', 'show interfaces tengigabitethernet 1/1'], ['arp', 'show arp'], ['show version', 'show version'], ['spanning tree', 'show spanning-tree rstp brief'], ['lldp', 'show lldp neighbors'], ['port channel', 'show interfaces port-channel brief'], ['routing', 'show ip route'], ['tagged', 'tagged tengigabitethernet 1/2'], ['hybrid', 'portmode hybrid'], ['bpdu guard', 'bpduguard'], ['mac address', 'show mac-address-table'], ['save', 'write memory']];
for (const [q, want] of cases) { const t = await search(q); S.ok(`search "${q}" finds ${want}`, t.includes(want), t.slice(0, 160)); }
const catHit = await search('Port-channels and LACP');
S.ok('a category name finds that category', /show lacp 1/.test(catHit) && !/show vlan id 10/.test(catHit), catHit.slice(0, 160));

// 3. Topic chips filter
const chips = await S.frame(`const s=d.getElementById('sheetSearch'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,200)); return [...d.querySelectorAll('#topicChips .chip')].map(c=>c.textContent).join('|');`);
S.ok('OS9 has its own topic chips', ['VLANs', 'LACP / LAG', 'Spanning tree', 'Security', 'VLT'].every((x) => chips.includes(x)), chips);
for (const [name, must, mustNot] of [['LACP / LAG', 'show lacp 1', 'show vlan id 10'], ['VLANs', 'show vlan id 10', 'show lacp 1'], ['Spanning tree', 'show spanning-tree rstp brief', 'show lacp 1']]) {
  const t = await S.frame(`const c=[...d.querySelectorAll('#topicChips .chip')].find(x=>x.textContent==${JSON.stringify(name)}); c.click(); await new Promise(r=>setTimeout(r,250)); return d.getElementById('sheetBody').innerText;`);
  S.ok(`chip "${name}" shows its commands and not the others`, t.includes(must) && !t.includes(mustNot), t.slice(0, 160));
}

// 4. Safety labels and verify badges are drawn
await pick('os9');
const badges = await S.frame(`const data=w.KIT_DATA.os9Cheat.flatMap(b=>b.rows); return { disruptsShown:[...d.querySelectorAll('.sheet-row .cmd-risk')].filter(x=>x.textContent==='disrupts').length, verifyShown:d.querySelectorAll('.sheet-row .cmd-verify').length, disruptsData:data.filter(r=>r.risk==='disrupt').length, verifyData:data.filter(r=>r.ver==='review').length, writeShown:[...d.querySelectorAll('.sheet-row .cmd-risk')].filter(x=>x.textContent==='write').length, rows:d.querySelectorAll('.sheet-row').length, total:data.length };`);
S.ok('every disrupts and verify flag in the data is drawn on its row', badges.disruptsShown === badges.disruptsData && badges.verifyShown === badges.verifyData && badges.rows === badges.total && badges.writeShown > 50, badges);
const showOnly = await S.frame(`return [...d.querySelectorAll('.sheet-row')].filter(tr=>/^show /.test(tr.querySelector('.cmd-text').innerText)&&!/\\n/.test(tr.querySelector('.cmd-text').innerText)).every(tr=>!tr.querySelector('.cmd-risk'));`);
S.ok('a single show command is never marked write or disrupts', showOnly);

// 5. Copy gives the exact command text
const copied = await S.frame(`
  let text=''; const old=d.execCommand; d.execCommand=function(cmd){ if(cmd==='copy'){ text=d.querySelector('textarea').value; return true; } return false; };
  Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:undefined});
  const want=w.KIT_DATA.os9Cheat.flatMap(b=>b.rows).find(r=>r.intent.startsWith('Tagged and untagged on the same port')).os9;
  const btn=[...d.querySelectorAll('.cmd-btn')].find(b=>decodeURIComponent(b.getAttribute('data-cmd'))===want); btn.click(); await new Promise(r=>setTimeout(r,200)); d.execCommand=old;
  return { same:text===want, lines:text.split('\\n').length, html:/<|&[a-z]+;|\`/.test(text), hidden:/[\\u200b\\u00a0\\r\\t]/.test(text), text };`);
S.ok('copying a multi-line command gives the exact lines, with no HTML, backticks or hidden characters', copied.same && copied.lines === 7 && !copied.html && !copied.hidden, copied);

// 6. The other sheets still work and stay separate
const os10 = await pick('dell');
S.ok('Dell OS10 still shows OS10 commands and none of the OS9 ones', /show interface status/.test(os10) && !/show interfaces status/.test(os10) && !/channel-member/.test(os10), os10.slice(0, 120));
const cisco = await pick('cisco'); S.ok('Cisco IOS still shows its commands', /show ip interface brief/.test(cisco) && !/portmode hybrid/.test(cisco));
const junos = await pick('junos'); S.ok('Juniper Junos still shows its commands', /show interfaces terse/.test(junos));
await pick('all');
const all = await search('default gateway');
S.ok('All platforms lists Dell OS9 and Dell OS10 as separate answers', /Dell OS9/.test(all) && /Dell OS10/.test(all) && /show ip management-route/.test(all), all.slice(0, 200));

// 7. Offline: nothing was fetched from outside
const net = await S.frame(`return performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/^https?:/.test(n)&&!n.startsWith(location.origin)).slice(0,5);`);
S.ok('the Cheat Sheet requested nothing from outside', net.length === 0, net);

// 8. Hub search finds an OS9 command
await S.load();
await S.ev(`const e = document.getElementById('homeSearch'); e.value='show vlt mismatch'; e.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('hub search finds an OS9 command', await S.ev(`return /show vlt mismatch/.test(document.body.innerText);`));
S.finish();
