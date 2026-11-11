// Automated playthrough: 30 in-game days on every difficulty, checking for errors and broken numbers,
// plus a save/reload test that proves a reloaded game continues exactly like the original.
import { newBotGame, botDay } from './bot';
import { Game } from '../src/core/game';
import type { Difficulty } from '../src/core/types';

let failures = 0;
function check(cond: boolean, msg: string) { if (!cond) { failures++; console.error('FAIL:', msg); } }
function scanNumbers(o: any, path = ''): string | null {
  if (typeof o === 'number') return isFinite(o) ? null : path;
  if (o && typeof o === 'object') for (const k in o) { const r = scanNumbers(o[k], path + '.' + k); if (r) return r; }
  return null;
}

const days = Number((globalThis as any).process?.env?.DAYS ?? 30);
for (const diff of ['relaxed', 'normal', 'hard', 'legend'] as Difficulty[]) {
  for (const seed of [1, 777, 4242]) {
    const g = newBotGame(diff, seed);
    try {
      for (let d = 0; d < days; d++) {
        botDay(g);
        const bad = scanNumbers(g.s); check(!bad, `${diff}/${seed} day ${g.s.day}: non-finite number at ${bad}`);
        check(g.s.reputation >= 0 && g.s.reputation <= 100, `${diff} reputation out of range`);
        check(g.s.loans.map((l) => l.cat).length === new Set(g.s.loans.map((l) => l.cat)).size, `${diff} two loans in one category`);
        check(g.s.halls.every((h) => !h.managerId || g.s.staff.some((e) => e.id === h.managerId)), `${diff} hall points at a fired manager`);
        if (bad) break;
      }
    } catch (e) { failures++; console.error(`CRASH ${diff}/${seed} on day ${g.s.day}:`, e); }
    const h = g.s.history; const avg = h.length ? Math.round(h.reduce((a, r) => a + r.happiness, 0) / h.length) : 0;
    console.log(`${diff.padEnd(8)} seed ${String(seed).padEnd(5)} day ${g.s.day}  money $${g.s.money.toLocaleString()}  rep ${g.s.reputation.toFixed(1)}  chapter ${g.s.chapter}  weddings ${h.length}  avg happiness ${avg}%  staff ${g.s.staff.length}  debt $${g.s.rosaDebt}  followers ${g.s.followers}  size ${g.s.halls[0].size + 1}  halls ${g.s.halls.filter((x) => x.owned).length}`);
  }
}

// Save / reload: a JSON round trip must continue identically.
{
  const a = newBotGame('normal', 99);
  for (let d = 0; d < 15; d++) botDay(a);
  a.sync();
  const saved = JSON.stringify(a.s);
  const b = new Game(JSON.parse(saved));
  check(JSON.stringify(b.s) === saved, 'reloaded state differs from saved state');
  for (let d = 0; d < 10; d++) { botDay(a); botDay(b); }
  a.sync(); b.sync();
  check(JSON.stringify(a.s) === JSON.stringify(b.s), 'reloaded game diverged from the original after 10 more days');
  console.log('save/reload determinism:', JSON.stringify(a.s) === JSON.stringify(b.s) ? 'OK' : 'DIFFERENT');
}

if (failures) { console.error(`${failures} failure(s)`); throw new Error('simulation tests failed'); }
console.log('All simulation tests passed.');
