// Staff: candidates, interviews, hiring, morale, wages, training, managers.
import type { Game } from '../core/game';
import type { Candidate, Employee, Bi } from '../core/types';
import { STAFF, ROLE_BY_ID, CONTENT, CFG } from '../core/data';
import { randomLook } from '../characters/looks';
import { has } from '../world/layout';

const TRAITS = Object.keys(STAFF.traits);

export function wageFor(role: string, skill: number) { const r = ROLE_BY_ID[role]; return Math.round(r.wage + r.wagePerSkill * (skill - 1)); }
function randName(g: Game, gender: 'm' | 'f'): Bi { return g.rng.pick(gender === 'm' ? CONTENT.maleNames : CONTENT.femaleNames) as Bi; }

export function genCandidate(g: Game, role?: string): Candidate {
  const roles = STAFF.roles.map((r: any) => r.id);
  role = role ?? g.rng.pick(roles.filter((r: string) => r !== 'manager' || g.s.chapter >= 3 || g.rng.chance(0.3)));
  const progress = Math.min(1, g.s.reputation / 100);
  let skill = Math.max(1, Math.min(5, Math.round(g.rng.range(0.6, 2.6) + progress * 2.4)));
  if (role === 'manager' && g.s.chapter <= 4 && !g.s.staff.some((e) => e.role === 'manager')) skill = Math.max(skill, 2);
  const gender = g.rng.chance(0.5) ? 'm' : 'f';
  const trait = g.rng.pick(TRAITS) as string;
  return { id: g.uid('c'), name: randName(g, gender), role: role!, skill, trait, wage: wageFor(role!, skill), interviewed: false, look: randomLook(g.rng, { gender, uniform: ROLE_BY_ID[role!].uniform }), quote: 0 };
}
export function refreshCandidates(g: Game) {
  g.s.candidates = [];
  for (let i = 0; i < STAFF.candidatesPerRefresh; i++) g.s.candidates.push(genCandidate(g));
  // Always offer at least one waiter and, from chapter 3, a manager.
  if (!g.s.candidates.some((c) => c.role === 'waiter')) g.s.candidates[0] = genCandidate(g, 'waiter');
  if (g.s.chapter >= 3 && !g.s.candidates.some((c) => c.role === 'manager')) g.s.candidates[1] = genCandidate(g, 'manager');
  g.s.candidatesDay = g.s.day;
  g.emit('candidates');
}
export function skillRange(c: Candidate) { return [Math.max(1, c.skill - 1), Math.min(5, c.skill + 1)]; }
export function interview(g: Game, c: Candidate) {
  if (c.interviewed) return true;
  if (g.s.money < STAFF.interviewCost) return false;
  g.addMoney(-STAFF.interviewCost); c.interviewed = true; g.emit('staff'); return true;
}
export function hire(g: Game, c: Candidate, hall = g.s.activeHall): Employee {
  const e: Employee = { id: g.uid('e'), name: c.name, role: c.role, skill: c.skill, trait: c.trait, wage: c.wage, morale: STAFF.morale.start + (c.trait === 'loyal' ? 10 : 0),
    weekWeddings: 0, hall, look: c.look, hiredDay: g.s.day };
  if (c.role === 'manager') { e.toggles = { run: true, fix: true, plan: true, accept: hall !== g.s.activeHall || g.s.halls.filter((x) => x.owned).length > 1 }; if (!g.s.halls[hall].managerId) g.s.halls[hall].managerId = e.id; }
  g.s.staff.push(e); g.s.candidates = g.s.candidates.filter((x) => x.id !== c.id);
  g.stat('staffHired'); g.weekStat('hire');
  g.emit('staff'); return e;
}
/** Firing works from every screen. If the fired employee was a hall's manager, a spare manager takes over. */
export function fire(g: Game, id: string) {
  const e = g.s.staff.find((x) => x.id === id); if (!e) return;
  g.s.staff = g.s.staff.filter((x) => x.id !== id);
  for (const h of g.s.halls) if (h.managerId === id) { h.managerId = null; assignSpareManager(g, g.s.halls.indexOf(h)); }
  g.emit('staff');
}
export function assignSpareManager(g: Game, hallIdx: number) {
  const used = new Set(g.s.halls.map((h) => h.managerId).filter(Boolean));
  const spare = g.s.staff.filter((e) => e.role === 'manager' && !used.has(e.id)).sort((a, b) => b.skill - a.skill)[0];
  if (spare) { spare.hall = hallIdx; g.s.halls[hallIdx].managerId = spare.id; if (spare.toggles && hallIdx !== g.s.activeHall) spare.toggles.accept = true; }
  return spare ?? null;
}
export function setManager(g: Game, hallIdx: number, id: string) {
  for (const h of g.s.halls) if (h.managerId === id) h.managerId = null;
  const e = g.s.staff.find((x) => x.id === id); if (!e) return;
  e.hall = hallIdx; g.s.halls[hallIdx].managerId = id; g.emit('staff');
}
export function managerOf(g: Game, hallIdx: number) { const id = g.s.halls[hallIdx].managerId; return id ? g.s.staff.find((e) => e.id === id) ?? null : null; }
export function trainCost(e: Employee) { return STAFF.trainCostPerLevel * e.skill * (e.role === 'manager' ? 2 : 1); }
export function train(g: Game, e: Employee) {
  if (e.skill >= 5) return false; const c = trainCost(e); if (g.s.money < c) return false;
  g.addMoney(-c); e.skill++; e.morale = Math.min(100, e.morale + 5); g.emit('staff'); return true;
}
export function raise(g: Game, e: Employee) {
  e.wage = Math.round(e.wage * (1 + STAFF.raisePercent)); e.morale = Math.min(100, e.morale + 18); e.askedRaise = false; g.emit('staff');
}
export function assign(g: Game, e: Employee, hallIdx: number) {
  if (e.role === 'manager') { setManager(g, hallIdx, e.id); return; }
  e.hall = hallIdx; g.emit('staff');
}
export function effSkill(e: Employee) { return Math.max(1, Math.min(5.5, e.skill + (STAFF.traits[e.trait]?.skill ?? 0) - (e.morale < 30 ? 0.7 : 0))); }

/** How many of each role a wedding of this size needs in a hall. */
export function staffNeeds(g: Game, hallIdx: number, guests: number) {
  const need: Record<string, number> = {}; const mult = g.research('staffNeedMult');
  for (const r of STAFF.roles) {
    if (!r.perGuests) continue;
    if (r.onlyIf === 'bar' && !has(g.s.halls[hallIdx].layout, 'bar')) continue;
    if (r.id === 'valet' && guests < 60) continue;
    need[r.id] = Math.max(1, Math.ceil((guests / r.perGuests) * mult));
  }
  return need;
}
export function staffIn(g: Game, hallIdx: number, role?: string) { return g.s.staff.filter((e) => e.hall === hallIdx && (!role || e.role === role)); }
/** Missing count per role for a wedding. */
export function shortages(g: Game, hallIdx: number, guests: number) {
  const need = staffNeeds(g, hallIdx, guests); const out: Record<string, number> = {};
  for (const r in need) { const have = staffIn(g, hallIdx, r).filter((e) => e.morale > 5).length; if (have < need[r]) out[r] = need[r] - have; }
  return out;
}
export function avgSkill(g: Game, hallIdx: number, role: string) { const a = staffIn(g, hallIdx, role); return a.length ? a.reduce((s, e) => s + effSkill(e), 0) / a.length : 1; }

/** Called after each wedding: everyone in that hall worked it. */
export function workedWedding(g: Game, hallIdx: number) { for (const e of staffIn(g, hallIdx)) { e.weekWeddings++; if (STAFF.traits[e.trait]?.growth && g.rng.chance(0.08) && e.skill < 5) e.skill++; } }

/** Daily morale: underpaid or overworked staff lose morale, ask for raises and finally quit. */
export function dailyMorale(g: Game) {
  const M = STAFF.morale; const decay = g.research('moraleDecayMult');
  for (const e of [...g.s.staff]) {
    if (e.named === 'karim' || e.named === 'nadia') { e.morale = Math.max(e.morale, 40); }
    const fair = wageFor(e.role, e.skill);
    let d = M.dailyRecovery;
    if (e.wage < fair * 0.95) d -= M.underpaidPenalty * decay;
    if (e.weekWeddings > M.maxWeddingsPerWeek) d -= M.overworkPenalty * decay * 0.3;
    if (g.s.money < 0) d -= 1.5 * decay;
    d += (STAFF.traits[e.trait]?.morale ?? 0) * 2;
    e.morale = Math.max(0, Math.min(100, e.morale + d));
    if (e.morale < M.askRaiseBelow && !e.askedRaise) {
      e.askedRaise = true;
      g.message(e.name, [`Boss, I'm working hard for ${'$'}${e.wage}/day. Could I get a raise?`, `يا مدير، أعمل بجد مقابل ${e.wage}$ يومياً. هل يمكنني الحصول على زيادة؟`], 'raise',
        [{ label: ['Give a raise', 'امنحه زيادة'], action: 'raise', arg: e.id }, { label: ['Not now', 'ليس الآن'], action: 'noraise', arg: e.id }]);
    }
    if (e.morale < M.quitBelow && !e.named) {
      g.message(e.name, ["I'm sorry. I quit.", 'أنا آسف. أستقيل.'], 'quit');
      fire(g, e.id);
    }
  }
}
export function payroll(g: Game) { return g.s.staff.reduce((s, e) => s + e.wage, 0) * CFG.time.salaryEveryDays; }
