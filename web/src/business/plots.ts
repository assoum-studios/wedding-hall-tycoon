// Buildable plots around each hall, plus the small hall's own bookings.
import type { Game } from '../core/game';
import { BIZ, PLOT_BY_ID } from '../core/data';
import { staffIn, avgSkill } from '../staff/staff';

export function plotCost(id: string, level: number) { return Math.round(PLOT_BY_ID[id].cost * Math.pow(BIZ.plotLevelCostGrowth, level)); }
export function buildPlot(g: Game, hallIdx: number, id: string) {
  const h = g.s.halls[hallIdx]; const lvl = h.plots[id] ?? 0; if (lvl >= BIZ.plotMaxLevel) return false;
  const c = plotCost(id, lvl); if (g.s.money < c) return false;
  g.addMoney(-c); h.plots[id] = lvl + 1; if (lvl === 0) g.stat('plotsBuilt'); g.emit('plots'); return true;
}
export function plotIncome(g: Game, hallIdx: number, id: string) {
  const lvl = g.s.halls[hallIdx].plots[id] ?? 0; if (!lvl) return 0;
  const p = PLOT_BY_ID[id]; return Math.round(p.income * Math.pow(BIZ.plotLevelIncomeGrowth, lvl - 1) * (0.6 + (g.s.reputation / 100) * 0.8));
}
export function dailyBusiness(g: Game) {
  let total = 0;
  g.s.halls.forEach((h, i) => { if (!h.owned) return; for (const id in h.plots) total += plotIncome(g, i, id); });
  if (total) g.addMoney(total, true);
  return total;
}

// ---- Small hall bookings (engagements, birthdays, ...) ----
export function dailySmallHall(g: Game) {
  g.s.halls.forEach((h, i) => {
    if (!h.owned || !g.hasPlot(i, 'small_hall')) return;
    h.smallBookings = h.smallBookings.filter((b) => !(b.done || b.date < g.s.day) || b.date > g.s.day - 7);
    const open = h.smallBookings.filter((b) => !b.done && b.date >= g.s.day).length;
    if (open < 4 && g.rng.chance(0.55 + g.s.reputation / 300)) {
      const t = g.rng.pick(BIZ.smallHallTypes) as any; const lvl = h.plots.small_hall;
      const guests = g.rng.int(t.guests[0], t.guests[1]);
      h.smallBookings.push({ id: g.uid('s'), type: t.id, guests, date: g.s.day + g.rng.int(1, 6), price: Math.round(t.price * guests * (1 + (lvl - 1) * 0.15)), hall: i });
    }
  });
}
export function acceptSmall(g: Game, hallIdx: number, id: string) { const b = g.s.halls[hallIdx].smallBookings.find((x) => x.id === id); if (b) { b.accepted = true; g.emit('plots'); } }
export function declineSmall(g: Game, hallIdx: number, id: string) { const h = g.s.halls[hallIdx]; h.smallBookings = h.smallBookings.filter((x) => x.id !== id); g.emit('plots'); }
/** Small hall events run the same day as main weddings; hosts and the small hall's level decide the result. */
export function runSmallEvents(g: Game) {
  g.s.halls.forEach((h, i) => {
    for (const b of h.smallBookings) {
      if (b.done || b.date !== g.s.day || !b.accepted) continue;
      const hosts = staffIn(g, i, 'host').length; const lvl = h.plots.small_hall ?? 1;
      const result = Math.max(30, Math.min(100, 50 + lvl * 6 + Math.min(2, hosts) * 6 + avgSkill(g, i, 'host') * 3 + g.rng.range(-10, 10)));
      b.done = true; b.result = Math.round(result);
      const pay = Math.round(b.price * (result < 45 ? 0.85 : 1)); const cost = Math.round(b.price * BIZ.smallHallCostShare);
      g.addMoney(pay - cost, true); g.stat('smallEvents'); g.addRep((result - 65) / 40);
    }
  });
}
