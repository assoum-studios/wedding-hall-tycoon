// Balance report over many random games: SEEDS=40 DAYS=60 npx tsx tests/balance.ts
// Prints medians per difficulty, plus a long run to watch late-game wealth.
import { newBotGame, botDay } from './bot';
const env = (globalThis as any).process.env;
const SEEDS = Number(env.SEEDS ?? 40), DAYS = Number(env.DAYS ?? 60), LONG = Number(env.LONG ?? 200);
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };
for (const diff of ['relaxed', 'normal', 'hard', 'legend'] as const) {
  const money: number[] = [], ch: number[] = [], hap: number[] = [], debt: number[] = [], wed: number[] = [];
  for (let k = 0; k < SEEDS; k++) {
    const g = newBotGame(diff, 1000 + k * 7919); for (let d = 0; d < DAYS; d++) botDay(g);
    money.push(g.s.money); ch.push(g.s.chapter); debt.push(g.s.rosaDebt); wed.push(g.s.history.length);
    const h = g.s.history; hap.push(h.reduce((a, r) => a + r.happiness, 0) / Math.max(1, h.length));
  }
  console.log(`${diff.padEnd(8)} day ${DAYS}: money p10 ${pct(money, 0.1)} median ${med(money)} p90 ${pct(money, 0.9)} | chapter median ${med(ch)} | happiness ${med(hap).toFixed(0)}% | weddings ${med(wed)} | still in debt ${debt.filter((x) => x > 0).length}/${SEEDS} | broke ${money.filter((x) => x < 0).length}/${SEEDS}`);
}
const long: number[] = [], lch: number[] = [];
for (let k = 0; k < 10; k++) { const g = newBotGame('normal', 50 + k * 31); for (let d = 0; d < LONG; d++) botDay(g); long.push(g.s.money); lch.push(g.s.chapter); }
console.log(`normal day ${LONG}: money median ${med(long)} max ${Math.max(...long)} | chapter median ${med(lch)}`);
