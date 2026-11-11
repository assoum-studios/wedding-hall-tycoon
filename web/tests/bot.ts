// A simple player bot used by the automated playthrough tests and balance checks.
import { Game, newGameState, defaultOwner } from '../src/core/game';
import type { Difficulty } from '../src/core/types';
import { startGame, advanceDay, weddingToday } from '../src/core/day';
import { invoiceLines, invoiceTotals, evaluateOffer, book, dateTaken, referralOptions, refer, rejectRequest } from '../src/weddings/clients';
import { runHeadless } from '../src/weddings/night';
import { shortages, hire, interview, genCandidate } from '../src/staff/staff';
import { buyUpgrade, upgradeCost, expand, expandCost, buyHall, startResearch, researchAvailable } from '../src/world/hallOps';
import { payRosaDebt, take, canTake } from '../src/business/loans';
import { launch } from '../src/business/marketing';
import { buildPlot, plotCost, acceptSmall } from '../src/business/plots';
import { chooseNews, answerCall } from '../src/progress/events';
import { completeChapter, chapterReady, claimWeekly, ACHIEVEMENTS, achReady, claimAch } from '../src/progress/goals';
import { postWedding, answerMessage } from '../src/phone/phone';
import { HALLS } from '../src/core/data';

export function newBotGame(diff: Difficulty, seed = 12345) {
  const g = new Game(newGameState(0, diff, defaultOwner('m'), 'Bot', seed));
  startGame(g); g.s.tutorial.done = true; return g;
}

export function botDay(g: Game) {
  const s = g.s; const r = g.rng;
  if (s.pendingNews) chooseNews(g, r.int(0, 1));
  for (const c of [...s.pendingCalls]) answerCall(g, c.id, r.chance(0.7));
  for (const m of s.messages) { m.read = true; if (m.choices && m.answered == null) answerMessage(g, m, 0); }
  // Requests: send invoices.
  for (const req of [...s.requests]) {
    if (dateTaken(g, req.hall, req.date)) { const opts = referralOptions(g, req); if (opts.length) refer(g, req, opts[0].i); else rejectRequest(g, req); continue; }
    const lines = invoiceLines(g, req);
    for (const level of [1.35, 1.15, 1.0]) {
      const tt = invoiceTotals(lines, level); const res = evaluateOffer(g, req, tt.total, tt.removed);
      if (res.kind === 'accept') { book(g, req, lines, level); break; }
      if (res.kind === 'counter') { req.status = 'countered'; book(g, req, lines, level, res.amount); break; }
    }
  }
  // Plan bookings (mostly right).
  for (const b of s.bookings) if (!b.plan.planned) b.plan = { theme: r.chance(0.8) ? b.req.theme : 'classic', flower: b.req.flower, light: b.req.light, music: b.req.music, venue: 'main', planned: true };
  // Hire for upcoming shortages.
  const next = s.bookings.filter((b) => b.hall === s.activeHall).sort((a, b) => a.date - b.date)[0];
  if (next) {
    const short = shortages(g, s.activeHall, next.req.guests);
    for (const role in short) {
      let c = s.candidates.find((x) => x.role === role);
      if (!c && s.money > 20000) { c = genCandidate(g, role); s.candidates.push(c); }
      if (c && s.money > c.wage * 14) { interview(g, c); hire(g, c); }
    }
  }
  if (s.chapter >= 4 && !s.staff.some((e) => e.role === 'manager') && s.money > 8000) { const c = genCandidate(g, 'manager'); hire(g, c); }
  // Spend money: debt first, then upgrades, size, businesses, research.
  if (s.rosaDebt > 0 && s.money > 20000) payRosaDebt(g, s.money - 15000);
  for (const h of s.halls.map((h, i) => ({ h, i })).filter((x) => x.h.owned)) {
    const ids = Object.keys(h.h.upgrades).sort((a, b) => h.h.upgrades[a] - h.h.upgrades[b]);
    for (const id of ids.slice(0, 2)) if (h.h.upgrades[id] < 5 && s.money > upgradeCost(id, h.h.upgrades[id]) * 2.2 + 8000) buyUpgrade(g, h.i, id);
    const ec = expandCost(g, h.i); if (ec != null && s.money > ec * 1.4 + 20000 && s.rosaDebt <= 0) expand(g, h.i);
    for (const pid of ['small_hall', 'flower_shop', 'restaurant', 'parking_lot', 'garden_venue']) if (!h.h.plots[pid] && s.money > plotCost(pid, 0) * 2.5 + 30000) buildPlot(g, h.i, pid);
    for (const sb of h.h.smallBookings) if (!sb.accepted) acceptSmall(g, h.i, sb.id);
  }
  for (let i = 1; i < s.halls.length; i++) if (!s.halls[i].owned && s.money > HALLS.halls[i].cost * 1.3) buyHall(g, i);
  for (const rr of HALLS.research) if (researchAvailable(g, rr.id) && s.money > rr.cost * 3) startResearch(g, rr.id);
  if (s.money < -5000 && canTake(g, 'small')) take(g, 'small');
  if (s.money > 15000 && r.chance(0.2)) launch(g, 'flyers');
  // Run today's wedding in the active hall.
  const w = weddingToday(g);
  if (w) { const rec = runHeadless(g, w, { attended: true }); if (r.chance(0.6)) postWedding(g, rec); }
  // Claim things.
  if (chapterReady(g)) completeChapter(g);
  s.weekly.goals.forEach((_, i) => claimWeekly(g, i));
  for (const a of ACHIEVEMENTS) if (achReady(g, a)) claimAch(g, a.id);
  advanceDay(g);
}
