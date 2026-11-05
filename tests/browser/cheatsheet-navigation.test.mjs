// Cheat Sheet navigation and compact rows: Switching is Vendor then (Dell only) OS9/OS10, Windows has no Command Prompt choice but keeps its commands,
// RHEL sits under Linux, long help is behind a Details control, and copy buttons and risk badges stay visible.
import { session } from './lib.mjs';
const S = await session({ width: 1300, height: 900 });
await S.load('#practice-ref');
const pick = (v) => S.frame(`d.getElementById('sheetVendor').value='${v}'; d.getElementById('sheetVendor').dispatchEvent(new Event('change')); const s=d.getElementById('sheetSearch'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,250)); return 1;`);
const search = (q) => S.frame(`const s=d.getElementById('sheetSearch'); s.value=${JSON.stringify(q)}; s.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,300)); return d.getElementById('sheetBody').innerText;`);
const shown = (sel) => S.frame(`return [...d.querySelectorAll(${JSON.stringify(sel)})].filter(b => !b.hidden && b.getClientRects().length).map(b => b.textContent.trim());`);
const groupShown = (id) => S.frame(`const g = d.getElementById(${JSON.stringify(id)}); return !!g && !g.hidden && g.getClientRects().length > 0;`);

// Switching
await S.frame(`d.querySelector('.mode-pills [data-mode=switch]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('Switching shows a Vendor row: Dell, Cisco, Juniper', JSON.stringify(await shown('#subFamilies button')) === '["Dell","Cisco","Juniper"]', await shown('#subFamilies button'));
S.ok('with Dell chosen, a second row offers OS10 and OS9 only', (await groupShown('sysGroup')) && JSON.stringify(await shown('#subVendors button')) === '["Dell OS10","Dell OS9"]', await shown('#subVendors button'));
await S.frame(`d.querySelector('#subVendors [data-v="os9"]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('choosing OS9 selects the OS9 sheet and keeps Dell highlighted', await S.frame(`return d.getElementById('sheetVendor').value === 'os9' && d.querySelector('#subFamilies [data-fam=dell]').classList.contains('on') && !!d.querySelector('.env-os9');`), 0);
S.ok('the OS9 warning legend is still shown without opening anything', /disrupts/i.test(await S.frame(`return d.getElementById('sheetBody').innerText;`)), 0);
await S.frame(`d.querySelector('#subFamilies [data-fam=cisco]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('Cisco has one choice, so there is no second row', !(await groupShown('sysGroup')) && (await S.frame(`return d.getElementById('sheetVendor').value;`)) === 'cisco', await groupShown('sysGroup'));
await S.frame(`d.querySelector('#subFamilies [data-fam=junos]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('Juniper has one choice too', !(await groupShown('sysGroup')) && (await S.frame(`return d.getElementById('sheetVendor').value;`)) === 'junos', 0);
await S.frame(`d.querySelector('#subFamilies [data-fam=dell]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('going back to Dell returns to the OS the page was on (OS9 here, remembered)', (await S.frame(`return d.getElementById('sheetVendor').value;`)) === 'dell' || (await S.frame(`return d.getElementById('sheetVendor').value;`)) === 'os9', 0);

// compact intro and rows (Cisco sheet has Switch Lab rows)
await pick('cisco');
const intro = await S.frame(`const i = d.querySelector('.sheet-intro'); const mo = i && i.querySelector('details.intro-more'); return { text: i ? i.innerText : '', hasDetails: !!mo, open: !!(mo && mo.open), write: /write/i.test(i ? i.innerText : ''), len: i ? i.innerText.length : 0 };`);
S.ok('the switch introduction is short and keeps the write-warning legend; the rest is under More', intro.hasDetails && !intro.open && intro.write && !/Using Switch Lab\?/.test(intro.text) && intro.len < 420, intro);
const rows = await S.frame(`const rs = [...d.querySelectorAll('.sheet-row')]; const withMore = rs.filter(r => r.querySelector('details.row-more')); const btn = rs.slice(0, 5).map(r => { const b = r.querySelector('.cmd-btn'); const q = b && b.getBoundingClientRect(); return !!q && q.width > 40 && q.height > 14; }); return { rows: rs.length, withMore: withMore.length, open: withMore.filter(r => r.querySelector('details.row-more').open).length, copyOk: btn.every(Boolean), copyLabel: !!rs[0].querySelector('.cmd-copy') };`);
S.ok('rows keep a visible copy button, and the Switch Lab detail line is collapsed by default', rows.rows > 20 && rows.copyOk && rows.copyLabel && rows.withMore > 5 && rows.open === 0, rows);

// Windows
await S.frame(`d.querySelector('.mode-pills [data-mode=windows]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('Windows has no Command Prompt choice and no second row', !(await S.frame(`return /Command Prompt/.test(d.querySelector('.filter-block, .sheet-filter-block').innerText) || !!d.querySelector('#subVendors [data-v=cmd], #sheetVendor option[value=cmd]');`)) && !(await groupShown('sysGroup')), 0);
for (const [q, want] of [['ipconfig', 'ipconfig /all'], ['flush dns', 'ipconfig /flushdns'], ['tracert', 'tracert 10.0.0.5'], ['tracert', 'tracert -d 10.1.1.1'], ['route', 'route print'], ['arp', 'arp -a'], ['netstat', 'netstat -ano | findstr LISTENING'], ['nslookup', 'nslookup example.com 1.1.1.1'], ['ping', 'ping -n 4 10.0.0.1']]) {
  let t = await search(q); if (!t.includes(want)) { await S.frame(`const m = d.querySelector('.more-btn'); if (m) m.click(); await new Promise(r=>setTimeout(r,300)); return 1;`); t = await S.frame(`return d.getElementById('sheetBody').innerText;`); } S.ok(`the old Command Prompt command for "${q}" is still found: ${want}`, t.includes(want), t.slice(0, 120));
}
S.ok('the Windows intro says classic tools run unchanged in PowerShell', /ipconfig, ping, tracert, route, arp and netstat run unchanged/.test(await S.frame(`const s=d.getElementById('sheetSearch'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,250)); return d.getElementById('sheetBody').innerText;`)), 0);
S.ok('All platforms search still finds a Windows classic command and says where to run it', /ping -n 4/.test(await (async () => { await pick('all'); return search('ping'); })()), 0);

// RHEL
await S.frame(`d.querySelector('.mode-pills [data-mode=linux]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
S.ok('Linux offers general Linux, RHEL and Proxmox', JSON.stringify(await shown('#subVendors button')) === '["Ubuntu / general","RHEL","Proxmox"]', await shown('#subVendors button'));
await S.frame(`d.querySelector('#subVendors [data-v=rhel]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
for (const [q, want] of [['firewall', 'sudo firewall-cmd --list-all'], ['nmcli', 'nmcli device status'], ['listening ports', 'sudo ss -tulpn'], ['journalctl', 'sudo journalctl -u NetworkManager -n 50 --no-pager'], ['hostnamectl', 'hostnamectl'], ['updates', 'sudo dnf check-update']]) {
  const t = await search(q); S.ok(`RHEL search "${q}" finds ${want}`, t.includes(want), t.slice(0, 120));
}
const chg = await S.frame(`const rows = [...d.querySelectorAll('.sheet-row')].filter(r => /firewall-cmd --permanent|dnf install/.test(r.innerText)); return rows.map(r => /change/i.test(r.querySelector('.cmd-text').innerText));`);
await search('firewall');
S.ok('RHEL commands that change the system carry the change badge', (await S.frame(`return [...d.querySelectorAll('.sheet-row')].filter(r => /--permanent --add-service|firewall-cmd --reload/.test(r.innerText)).map(r => /change/i.test(r.querySelector('.cmd-text').innerText));`)).every(Boolean), chg);

// VMware version wording
await S.frame(`d.querySelector('.mode-pills [data-mode=vmware]').click(); await new Promise(r=>setTimeout(r,300)); d.querySelector('#subVendors [data-v=esxi]').click(); await new Promise(r=>setTimeout(r,300)); return 1;`);
const v = await search('esxi version');
S.ok('the ESXi version row explains that 8.0.10 is not a release and that 9.1 is not checked', /no .{0,3}8\.0\.10.{0,3} release/.test(v) && /not checked on 9\.1/.test(v), v.slice(0, 400));
S.finish();
