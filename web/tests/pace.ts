// Balance helper: prints how fast a bot progresses. Run: DAYS=150 DIFF=normal npx tsx tests/pace.ts
import { newBotGame, botDay } from './bot';
const env = (globalThis as any).process.env;
const g = newBotGame((env.DIFF ?? 'normal') as any, 5);
let ch = g.s.chapter; const days = Number(env.DAYS ?? 150);
for (let d = 0; d < days; d++) {
  botDay(g);
  if (g.s.chapter !== ch) { ch = g.s.chapter; console.log('day', g.s.day, '-> chapter', ch); }
  if (g.s.day % 15 === 0) {
    const h = g.s.history.slice(-15); const avg = h.reduce((a, r) => a + r.happiness, 0) / (h.length || 1); const prof = h.reduce((a, r) => a + r.profit, 0) / (h.length || 1);
    console.log(`d${g.s.day} money ${g.s.money} rep ${g.s.reputation.toFixed(0)} wed ${g.s.history.length} avgH ${avg.toFixed(0)} avgProfit ${prof.toFixed(0)} guests ${h.length ? h[h.length - 1].guests : 0} size ${g.s.halls.map((x) => (x.owned ? x.size + 1 : 0)).join(',')} staff ${g.s.staff.length} victor ${g.s.victor.rating.toFixed(0)} me ${g.rating().toFixed(0)} fol ${g.s.followers}`);
  }
}
