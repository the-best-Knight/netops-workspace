// Main menu: the arrow keys follow the layout of the cards (Down and Up change row in the same column, Left and Right move along a row).
import { session } from './lib.mjs';
const S = await session();
const where = () => S.ev(`const a = document.activeElement; const c = a && a.closest && a.closest('.card'); if (!c) return a ? (a.id || a.tagName) : null; const r = c.getBoundingClientRect(); return { id: c.dataset.id, col: Math.round(r.left), row: Math.round(r.top), orphan: c.classList.contains('orphan') };`);
const key = async (k) => { await S.press(k); await S.wait(130); return where(); };
// Each card has a pin button after its title, so Left and Right visit title, pin, next title. This presses until focus lands on another card.
const across = async (k) => { const from = await where(); let at = from; for (let i = 0; i < 2; i++) { at = await key(k); if (!at || at.id !== from.id) break; } return at; };
const focusCard = (id) => S.ev(`document.querySelector('.card[data-id="${id}"] .card-title').focus(); return 1;`);

for (const [w, h] of [[1500, 950], [900, 800], [420, 800]]) {
  await S.setViewport(w, h); await S.load('', 1500);
  const layout = await S.ev(`return [...document.querySelectorAll('#cardGrid .card')].map(c => { const r = c.getBoundingClientRect(); return { id: c.dataset.id, left: Math.round(r.left), top: Math.round(r.top + scrollY), orphan: c.classList.contains('orphan') }; });`);
  const cols = [...new Set(layout.filter((c) => !c.orphan).map((c) => c.left))].sort((a, b) => a - b);
  const byRow = [...new Set(layout.map((c) => c.top))].sort((a, b) => a - b).map((t) => layout.filter((c) => c.top === t));
  const first = byRow[0][0], last = layout[layout.length - 1];
  console.log(`--- ${w}px: ${layout.length} cards, columns at ${JSON.stringify(cols)}`);
  await focusCard(first.id);
  let at = await where();
  S.ok(`${w}: focus starts on the first card`, at.id === first.id, at);
  if (cols.length >= 2) {
    at = await key('ArrowDown'); const below = layout.find((c) => c.id === at.id);
    S.ok(`${w}: Down from the first card goes to the row below, same column`, below && below.top > first.top && below.left === first.left, { at, first, below });
    at = await across('ArrowRight'); const right = layout.find((c) => c.id === at.id);
    S.ok(`${w}: Right moves along the row`, right && right.top === below.top && right.left > below.left, { at, right });
    at = await across('ArrowLeft'); S.ok(`${w}: Left comes back`, at.id === below.id, at);
    at = await key('ArrowUp'); S.ok(`${w}: Up returns to the first card`, at.id === first.id, at);
    at = await across('ArrowLeft'); S.ok(`${w}: Left at the left edge stays put`, at.id === first.id, at);
    const lastInRow = byRow[0][byRow[0].length - 1];
    await focusCard(lastInRow.id); at = await across('ArrowRight'); S.ok(`${w}: Right at the right edge stays put`, at.id === lastInRow.id, at);
    for (const col of cols) {
      const colCards = layout.filter((c) => c.left === col && !c.orphan);
      await focusCard(colCards[0].id); let prev = colCards[0], steps = 0, sideways = 0; const seen = [prev.id];
      for (let i = 0; i < layout.length + 2; i++) {
        const nx = await key('ArrowDown'); if (!nx || !nx.id || nx.id === prev.id) break;
        const c = layout.find((x) => x.id === nx.id); steps++; if (!(c.top > prev.top)) sideways++; prev = c; seen.push(c.id);
      }
      S.ok(`${w}: Down through the column at x=${col} only ever moves to a lower row (${steps} steps)`, sideways === 0 && steps >= 3, { sideways, steps, seen });
      const expected = colCards.map((c) => c.id);
      S.ok(`${w}: Down through the column at x=${col} visits every card in it, in order`, expected.every((id) => seen.includes(id)) && expected.map((id) => seen.indexOf(id)).every((v, i, a) => i === 0 || v > a[i - 1]), { expected, seen });
    }
    const orph = layout.find((c) => c.orphan);
    const above = orph && byRow[byRow.findIndex((r) => r.some((c) => c.id === orph.id)) - 1];
    if (above && above.length === 2 && !above.some((c) => c.orphan)) {
      for (const start of above) {
        await focusCard(start.id); const d1 = await key('ArrowDown'); const u1 = await key('ArrowUp');
        S.ok(`${w}: Down onto a lone card then Up returns to the same card (${start.id})`, d1.id === orph.id && u1.id === start.id, { d1, u1, start });
      }
    }
  } else {
    at = await key('ArrowDown'); S.ok(`${w}: single column, Down goes to the next card`, at.id === layout[1].id, { at });
    at = await key('ArrowUp'); S.ok(`${w}: single column, Up goes back`, at.id === first.id, at);
    at = await across('ArrowRight'); S.ok(`${w}: single column, Right does nothing`, at.id === first.id, at);
  }
  await focusCard(first.id); at = await key('ArrowUp'); S.ok(`${w}: Up from the top row goes to the search box`, at === 'homeSearch', at);
  at = await key('ArrowDown'); S.ok(`${w}: Down from the empty search box goes to the first card`, at.id === first.id, at);
  await focusCard(first.id); at = await key('End'); S.ok(`${w}: End goes to the last card`, at.id === last.id, at);
  at = await key('Home'); S.ok(`${w}: Home goes to the first card`, at.id === first.id, at);
  await focusCard(last.id); at = await key('ArrowDown'); S.ok(`${w}: Down on the last card stays put`, at.id === last.id, at);
  await focusCard(first.id); await S.press('Enter'); await S.wait(900);
  const opened = await S.ev(`return { hash: location.hash, ws: !document.getElementById('workspace').hidden };`);
  S.ok(`${w}: Enter on a card opens that tool`, opened.ws && opened.hash.slice(1) === first.id, opened);
}
S.finish();
