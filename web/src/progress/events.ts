// Morning news, seasonal events, daily gift wheel, login streak and local leaderboards.
import type { Game } from '../core/game';
import type { Effects, NewsEvent } from '../core/data';
import { NEWS, SABOTAGE, PROG } from '../core/data';
import { fire, raise, staffIn } from '../staff/staff';
import { genRequest } from '../weddings/clients';
import { capacity } from '../world/layout';

export function currentSeason(g: Game) {
  const d = g.date();
  for (const s of PROG.seasonal) if (!s.rotating && s.month === d.month && d.dom >= s.from && d.dom <= s.to) return s;
  const rot = PROG.seasonal.filter((s: any) => s.rotating);
  const wk = d.week; if (wk > 0 && wk % PROG.rotatingEveryWeeks === 0) return rot[(wk / PROG.rotatingEveryWeeks) % rot.length];
  return null;
}

export function newsById(id: string): NewsEvent | undefined { return NEWS.find((n) => n.id === id) ?? SABOTAGE.find((n) => n.id === id); }

/** Picks a morning news event (about 55% of days). Chapter 5 forces Victor's three sabotage events. */
export function rollNews(g: Game) {
  if (g.s.pendingNews || !g.s.tutorial.done) return;
  if (g.s.chapter === 5 && g.s.sabotageScheduled.length === 0 && g.s.sabotageSurvived < 3) g.s.sabotageScheduled = [g.s.day + 1, g.s.day + 3, g.s.day + 6];
  const sabIdx = g.s.sabotageScheduled.findIndex((d) => d <= g.s.day);
  if (sabIdx >= 0) { g.s.sabotageScheduled.splice(sabIdx, 1); const done = 3 - g.s.sabotageScheduled.length - 1; g.s.pendingNews = { id: SABOTAGE[Math.max(0, Math.min(2, done))].id, sabotage: true }; g.emit('news'); return; }
  if (g.s.day - g.s.lastNewsDay < 1 || !g.rng.chance(0.55)) return;
  const d = g.date();
  const pool = NEWS.filter((n) => (n.minDay ?? 0) <= g.s.day && (n.minRep ?? 0) <= g.s.reputation && (!n.months || n.months.includes(d.month))
    && (!n.needsBooking || g.s.bookings.length > 0) && (!n.needsDebt || g.s.rosaDebt > 0 || g.s.loans.length > 0) && !g.s.newsSeen.slice(-12).includes(n.id));
  if (!pool.length) return;
  const n = g.rng.pick(pool); g.s.pendingNews = { id: n.id }; g.s.lastNewsDay = g.s.day; g.s.newsSeen.push(n.id); if (g.s.newsSeen.length > 40) g.s.newsSeen.shift();
  g.emit('news');
}

export function chooseNews(g: Game, choice: number) {
  const pn = g.s.pendingNews; if (!pn) return null; const ev = newsById(pn.id); g.s.pendingNews = null;
  if (!ev) return null; const c = ev.choices[choice] ?? ev.choices[0];
  let eff = c.effects; let failed = false;
  if (c.risk && !g.rng.chance(c.risk.p)) { eff = { ...c.effects, ...c.risk.fail }; failed = true; }
  applyEffects(g, eff);
  if (pn.sabotage) { g.s.sabotageSurvived++; g.stat('sabotageSurvived'); }
  g.emit('newsDone', { ev, failed }); return { failed };
}

export function applyEffects(g: Game, e: Effects) {
  if (e.money) g.addMoney(e.money, e.money > 0);
  if (e.rep) g.addRep(e.rep);
  if (e.followers) g.addFollowers(e.followers);
  if (e.morale) for (const s of g.s.staff) s.morale = Math.max(0, Math.min(100, s.morale + e.morale));
  if (e.mods) for (const m of e.mods) g.s.mods.push({ key: m.key, value: m.value, until: g.s.day + m.days - 1 });
  const best = () => [...g.s.staff].filter((s) => !s.named && s.role !== 'manager').sort((a, b) => b.skill - a.skill)[0];
  switch (e.special) {
    case 'loseBestStaff': { const b = best(); if (b) { fire(g, b.id); g.toast(b.name[0], 'bad'); } break; }
    case 'raiseBestStaff': { const b = best(); if (b) raise(g, b); break; }
    case 'cancelBooking': case 'cancelBookingRefund': {
      const bk = g.s.bookings.filter((x) => x.date > g.s.day)[0];
      if (bk) { g.s.bookings = g.s.bookings.filter((x) => x.id !== bk.id); if (e.special === 'cancelBookingRefund') g.addMoney(-bk.paid); }
      break;
    }
    case 'celebrityOffer': case 'vipRequest': {
      const r = genRequest(g, g.s.activeHall, { vip: true, celebrity: e.special === 'celebrityOffer' });
      r.expires = g.s.day + 3; g.s.requests.unshift(r); g.emit('requests'); break;
    }
    case 'staffDinner': g.addMoney(-30 * g.s.staff.length); break;
    case 'staffBonus': g.addMoney(-100 * g.s.staff.length); break;
  }
  g.emit('effects', e);
}

// ---- Calls ----
export function rollCalls(g: Game) {
  if (!g.s.tutorial.done || g.s.pendingCalls.length) return;
  if (!g.rng.chance(0.22)) return;
  const who = g.rng.pick(['client', 'journalist', 'supplier', 'victor', 'victor'] as const);
  g.s.pendingCalls.push({ id: g.uid('call'), who }); g.emit('call');
}
export function answerCall(g: Game, id: string, accept: boolean) {
  const c = g.s.pendingCalls.find((x) => x.id === id); g.s.pendingCalls = g.s.pendingCalls.filter((x) => x.id !== id); if (!c) return null;
  if (!accept) return { who: c.who, declined: true };
  switch (c.who) {
    case 'client': { const r = genRequest(g, g.s.activeHall, { vip: g.rng.chance(0.4) }); r.expires = g.s.day + 2; g.s.requests.unshift(r); g.emit('requests'); break; }
    case 'journalist': g.addRep(1.5); g.addFollowers(250); break;
    case 'supplier': g.s.mods.push({ key: 'foodCostMult', value: 0.9, until: g.s.day + 6 }); break;
    case 'victor': break;
  }
  return { who: c.who, declined: false };
}

// ---- Daily gift and login streak (real calendar days) ----
export function today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function yesterday() { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
export function checkLogin(g: Game) {
  const t = today(); const dg = g.s.dailyGift; if (dg.lastDate === t) return null;
  dg.streak = dg.lastDate === yesterday() ? dg.streak + 1 : 1; dg.lastDate = t;
  const reward = PROG.streakRewards[Math.min(dg.streak, PROG.streakRewards.length) - 1];
  g.addMoney(reward); g.maxStat('streak', dg.streak); return { streak: dg.streak, reward };
}
export function canSpin(g: Game) { return g.s.dailyGift.spunDate !== today(); }
export function spin(g: Game) {
  if (!canSpin(g)) return null; g.s.dailyGift.spunDate = today();
  const idx = (() => { const tot = PROG.dailyWheel.reduce((s: number, x: any) => s + x.weight, 0); let r = g.rng.next() * tot; for (let i = 0; i < PROG.dailyWheel.length; i++) { r -= PROG.dailyWheel[i].weight; if (r <= 0) return i; } return 0; })();
  const w = PROG.dailyWheel[idx];
  if (w.kind === 'money') g.addMoney(w.value); else if (w.kind === 'followers') g.addFollowers(w.value); else if (w.kind === 'rep') g.addRep(w.value); else if (w.kind === 'morale') for (const s of g.s.staff) s.morale = Math.min(100, s.morale + w.value);
  return { idx, w };
}

// ---- Leaderboards (offline: you vs. the city's other halls) ----
export function leaderboards(g: Game) {
  const rivals = PROG.leaderboardRivals.map((r: any, i: number) => {
    const k = 1 + g.s.day * 0.01 + i * 0.07;
    return { name: r, best: Math.min(99, Math.round(70 + i * 3 + g.s.day * 0.02)), size: Math.round(150 * k + i * 40), followers: Math.round(800 * k * k + i * 900) };
  });
  const me = { name: [g.hall.name, g.hall.name], best: g.s.stats.bestHappiness ?? 0, size: Math.max(0, ...g.s.halls.filter((h) => h.owned).map((h) => capacity(h))), followers: g.s.followers, me: true };
  return { rivals, me };
}
export { staffIn };
