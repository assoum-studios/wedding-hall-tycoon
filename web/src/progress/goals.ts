// Story chapters (with 3-star bonus goals), weekly goals and achievements.
import type { Game } from '../core/game';
import type { Goal, WeeklyGoal, Bi } from '../core/types';
import { PROG, HALLS } from '../core/data';
import { capacity, hallDims } from '../world/layout';
import { t, L, num, money } from '../core/i18n';

// ---------------- Goal evaluation ----------------
/** Returns [current, target] for a goal so the UI can show progress bars. */
export function goalProgress(g: Game, goal: Goal): [number, number] {
  const s = g.s; const cs = s.chapterStats; const n = goal.n ?? 1;
  switch (goal.type) {
    case 'weddings': return [cs.weddings ?? 0, n];
    case 'upgrades': return [cs.upgradesBought ?? 0, n];
    case 'rosaDebtPaid': return [s.rosaDebt <= 0 ? 1 : 0, 1];
    case 'teamSize': return [s.staff.length, n];
    case 'beatVictor': return [g.rating() > s.victor.rating ? 1 : 0, 1];
    case 'happyWedding': return [cs.bestHappiness ?? 0, n];
    case 'hallSize': return [Math.max(...s.halls.filter((h) => h.owned).map((h) => h.size + 1)), n];
    case 'guestsWedding': return [cs.bestGuests ?? 0, n];
    case 'hireManager': return [s.staff.some((e) => e.role === 'manager') ? 1 : 0, 1];
    case 'sabotage': return [s.sabotageSurvived, n];
    case 'celebrity': return [cs.celebrity ?? 0, n];
    case 'followers': return [s.followers, n];
    case 'capacity': return [Math.max(...s.halls.filter((h) => h.owned).map((h) => Math.max(capacity(h), hallDims(h.size).cap * (h.size === HALLS.sizes.length - 1 ? 1 : 0)))), n];
    case 'hallsOwned': return [s.halls.filter((h) => h.owned).length, n];
    case 'weddingsInHall': return [cs['weddingsInHall' + (goal.hall ?? 1)] ?? 0, n];
    case 'ratingLead': return [Math.max(0, Math.round(g.rating() - s.victor.rating)), n];
    case 'hallsManaged': { const owned = s.halls.filter((h) => h.owned); return [owned.filter((h) => h.managerId).length >= owned.length ? owned.length : owned.filter((h) => h.managerId).length, n]; }
    case 'allHallsRating': { const owned = s.halls.map((h, i) => ({ h, i })).filter((x) => x.h.owned); return [Math.round(Math.min(...owned.map((x) => g.rating(x.i)))), n]; }
    case 'totalWeddings': return [s.stats.weddings ?? 0, n];
    case 'withinDays': return [s.day - s.chapterStartDay <= n ? 1 : 0, 1];
    case 'avgHappiness': { const w = cs.weddings ?? 0; return [w ? Math.round((cs.happySum ?? 0) / w) : 0, n]; }
    case 'noLoans': return [(cs.loansTaken ?? 0) === 0 ? 1 : 0, 1];
  }
  return [0, 1];
}
export function goalDone(g: Game, goal: Goal) { const [c, n] = goalProgress(g, goal); return c >= n; }
export function goalText(goal: Goal) {
  const n = goal.n ?? 0;
  const fmt = goal.type === 'followers' ? num(n) : goal.type === 'earn' ? money(n) : String(n);
  return t('goal.' + goal.type, { n: fmt, hall: goal.hall != null ? L(HALLS.halls[goal.hall]) : '' });
}

// ---------------- Chapters ----------------
export function chapterDef(n: number) { return PROG.chapters.find((c: any) => c.id === n); }
export function chapterReady(g: Game) { const c = chapterDef(g.s.chapter); return !!c && !g.s.chapterDone && c.goals.every((x: Goal) => goalDone(g, x)); }
/** Claims the chapter: reward, stars from bonus goals, and moves to the next chapter. */
export function completeChapter(g: Game) {
  const c = chapterDef(g.s.chapter); if (!c || !chapterReady(g)) return null;
  const stars = 1 + c.bonus.filter((x: Goal) => goalDone(g, x)).length;
  g.s.chapterStars[c.id - 1] = stars; g.addMoney(c.reward * (stars === 3 ? 1.5 : 1)); g.stat('chapters');
  const ending: Bi = [c.endEn, c.endAr];
  if (g.s.chapter >= PROG.chapters.length) { g.s.chapterDone = true; g.s.victor.flowersSent = true; }
  else { g.s.chapter++; g.s.chapterStartDay = g.s.day; g.s.chapterStats = {}; g.s.sabotageScheduled = []; }
  // Chapter starts that need something to happen in the world.
  if (g.s.chapter === 6) g.s.pendingNews = g.s.pendingNews ?? { id: 'celebrity_offer' };
  if (g.s.chapter === 10 && !g.s.victor.offerMade) { g.s.victor.offerMade = true; g.message(['Victor Crane', 'فيكتور كرين'], ["I'll buy your hall. Name your price. You can't beat me forever.", 'سأشتري قاعتك. حدد سعرك. لا يمكنك التفوق علي إلى الأبد.'], 'victor'); g.s.victor.rating = Math.min(95, g.s.victor.rating + 4); }
  g.emit('chapter', { def: c, stars, ending }); return { def: c, stars, ending };
}

// ---------------- Weekly goals ----------------
export function ensureWeekly(g: Game) {
  const week = g.date().week; if (g.s.weekly.week === week) return;
  const pool = g.rng.shuffle([...PROG.weeklyTemplates]); const goals: WeeklyGoal[] = []; const lvl = g.s.chapter;
  for (const tpl of pool) {
    if (goals.length >= 3) break;
    if (tpl.type === 'hire' && g.s.staff.length > 40) continue;
    const n = tpl.fixed ? tpl.base : Math.max(1, Math.round(tpl.base + tpl.scale * (lvl - 1) * (tpl.type === 'earn' ? lvl : 1)));
    goals.push({ type: tpl.type, n, progress: 0, reward: Math.round(tpl.reward * (1 + (lvl - 1) * 0.6)), claimed: false });
  }
  g.s.weekly = { week, goals }; g.s.weekStats = {};
}
export function weeklyProgress(g: Game, w: WeeklyGoal) {
  const ws = g.s.weekStats;
  switch (w.type) {
    case 'happyWedding': return Math.min(w.n, ws.bestHappiness ?? 0) >= w.n ? w.n : ws.bestHappiness ?? 0;
    case 'perfectTheme': return ws.perfectTheme ?? 0;
    default: return ws[w.type] ?? 0;
  }
}
export function weeklyReady(g: Game, w: WeeklyGoal) { return !w.claimed && weeklyProgress(g, w) >= w.n; }
export function claimWeekly(g: Game, i: number) { const w = g.s.weekly.goals[i]; if (!w || !weeklyReady(g, w)) return false; w.claimed = true; g.addMoney(w.reward); g.emit('claim'); return true; }
export function weeklyText(w: WeeklyGoal) { const tpl = PROG.weeklyTemplates.find((x: any) => x.type === w.type); return L(tpl, { n: w.type === 'earn' ? num(w.n) : w.n }); }

// ---------------- Achievements ----------------
export interface Achievement { id: string; stat: string; n: number; reward: number; text: Bi; cosmetic?: boolean; }
export const ACHIEVEMENTS: Achievement[] = PROG.achievementGroups.flatMap((grp: any) => grp.tiers.map((n: number, i: number) => ({
  id: grp.stat + '_' + n, stat: grp.stat, n, reward: Math.round(grp.reward * Math.pow(1.8, i)),
  text: [grp.en.replace('{n}', n.toLocaleString('en-US')), grp.ar.replace('{n}', n.toLocaleString('en-US'))] as Bi,
})));
export function achValue(g: Game, a: Achievement) { return g.s.stats[a.stat] ?? 0; }
export function achReady(g: Game, a: Achievement) { return !g.s.achievements.claimed.includes(a.id) && achValue(g, a) >= a.n; }
export function claimAch(g: Game, id: string) { const a = ACHIEVEMENTS.find((x) => x.id === id); if (!a || !achReady(g, a)) return false; g.s.achievements.claimed.push(id); g.addMoney(a.reward); g.emit('claim'); return true; }
/** Number of things ready to claim, for the badge on the Goals button. */
export function claimableCount(g: Game) {
  return (chapterReady(g) ? 1 : 0) + g.s.weekly.goals.filter((w) => weeklyReady(g, w)).length + ACHIEVEMENTS.filter((a) => achReady(g, a)).length;
}
