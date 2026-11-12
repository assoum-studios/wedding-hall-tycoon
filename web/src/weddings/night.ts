// Planning, the wedding-night simulation (shared by the 3D view and the automated tests) and the report.
import type { Game } from '../core/game';
import type { Booking, Plan, WeddingRecord, Phase, Bi } from '../core/types';
import { CFG, PROBLEMS, PROBLEM_BY_ID, HALLS, CONTENT, DEMAND_BY_ID, STAFF } from '../core/data';
import { THEME_FLOWER } from './clients';
import { FOOD, SUPPLIER_HAPPY } from './quality';
import { managerOf, shortages, avgSkill, staffIn, effSkill, workedWedding } from '../staff/staff';
import { upgradeProblemMult } from '../world/hallOps';
import { layoutScore, walkFactor } from '../world/layout';

// ---------------- Planning ----------------

export function planMatches(b: Booking, p: Plan) {
  const r = b.req;
  const lightOk = p.light === r.light || (CFG.lighting[p.light]?.tags?.includes(r.theme) && CFG.lighting[r.light]?.tags?.includes(r.theme));
  const musicOk = p.music === r.music;
  return { theme: p.theme === r.theme, flower: p.flower === r.flower, light: !!lightOk, music: musicOk, venue: p.venue === r.venue };
}
export function matchPercent(b: Booking, p: Plan) { const m = planMatches(b, p); const w = { theme: 35, flower: 20, light: 15, music: 15, venue: 15 }; let s = 0; for (const k in m) if ((m as any)[k]) s += (w as any)[k]; return s; }
/** A manager plans with accuracy based on skill: each choice is right with chance 45% + 11% per skill. */
export function managerPlan(g: Game, b: Booking, skill: number): Plan {
  const r = b.req; const acc = Math.min(0.98, 0.45 + skill * 0.11);
  const pick = <T>(right: T, all: T[]) => (g.rng.chance(acc) ? right : g.rng.pick(all));
  const venues = ['main', ...Object.keys(CFG.venues).filter((v) => v !== 'main' && g.hasPlot(b.hall, CFG.venues[v].plot))];
  return { theme: pick(r.theme, Object.keys(CFG.themes) as any), flower: pick(r.flower, Object.keys(CFG.flowers)), light: pick(r.light, Object.keys(CFG.lighting)),
    music: pick(r.music, Object.keys(CFG.music)), venue: venues.includes(r.venue) ? pick(r.venue, venues) : 'main', planned: true, byManager: true };
}
export function defaultPlan(b: Booking): Plan { return { theme: b.req.theme === 'classic' ? 'classic' : 'classic', flower: THEME_FLOWER.classic, light: 'chandeliers', music: 'dj', venue: 'main', planned: false }; }

// ---------------- Night ----------------
export type MomentId = 'speeches' | 'cake' | 'first_dance' | 'bouquet' | 'sparkler';
export interface ActiveProblem { uid: number; id: string; at: number; timeLeft: number; total: number; cost: number; state: 'pending' | 'active' | 'fixed' | 'missed'; manager: null | { eta: number; ok: boolean }; staff?: null | { eta: number; ok: boolean }; spot: number; }
export interface TableNeed { uid: number; table: number; kind: 'food' | 'drink' | 'music'; timeLeft: number; }
export interface Moment { id: MomentId; at: number; window: number; state: 'pending' | 'open' | 'hit' | 'miss'; }
const MOMENT_AT: [MomentId, Phase, number][] = [['speeches', 'dinner', 0.3], ['cake', 'dinner', 0.8], ['first_dance', 'dancing', 0.05], ['bouquet', 'dancing', 0.6], ['sparkler', 'farewell', 0.45]];

export class NightSim {
  t = 0; duration: number; phase: Phase = 'arrive'; problems: ActiveProblem[] = []; moments: Moment[] = [];
  delta = 0; fixed = 0; missed = 0; fixCosts = 0; momentsHit = 0; needs: TableNeed[] = []; needsServed = 0; needsMissed = 0; tables = 1; private needUid = 1; done = false; skipped = false; photo?: string;
  phaseTimes: { id: Phase; start: number; end: number }[] = [];
  hallIdx: number; events: { kind: string; data?: any }[] = [];
  private uidN = 1;
  constructor(public g: Game, public b: Booking, public attended: boolean) {
    this.hallIdx = b.hall;
    this.duration = CFG.night.lengthSeconds[g.s.settings.weddingLength] ?? 140;
    let acc = 0; for (const [id, f] of CFG.night.phases) { this.phaseTimes.push({ id, start: acc * this.duration, end: (acc + f) * this.duration }); acc += f; }
    if (!b.plan.planned) {
      const m = managerOf(g, b.hall);
      b.plan = m && m.toggles?.plan ? managerPlan(g, b, effSkill(m)) : defaultPlan(b);
    }
    this.schedule(); this.tables = Math.max(1, Math.ceil(b.req.guests / 10));
    for (const [id, ph, f] of MOMENT_AT) { const p = this.phaseTimes.find((x) => x.id === ph)!; this.moments.push({ id, at: p.start + (p.end - p.start) * f, window: CFG.night.miniMomentWindow, state: 'pending' }); }
  }
  get manager() { return managerOf(this.g, this.hallIdx); }

  /** Rolls tonight's problems up front, weighted by upgrades, staff shortages, venue and difficulty. */
  private schedule() {
    const g = this.g; const N = CFG.night; const short = shortages(g, this.hallIdx, this.b.req.guests);
    const venue = CFG.venues[this.b.plan.venue] ?? CFG.venues.main;
    const clumsy = staffIn(g, this.hallIdx).filter((e) => e.trait === 'clumsy').length * 0.04 - staffIn(g, this.hallIdx).filter((e) => e.trait === 'reliable').length * 0.03;
    const expected = (N.problemsPerNight + this.b.req.guests * N.problemsPerExtraGuests) * g.diff.problemMult * g.mod('problemMult') * g.research('problemMult') * (1 + Math.max(-0.3, clumsy)) * (this.b.req.celebrity ? 1.3 : 1);
    const weights = PROBLEMS.map((p) => {
      if (p.outdoorOnly && !venue.outdoor) return 0;
      if (p.needsPool && !g.hasPlot(this.hallIdx, 'pool_terrace')) return 0;
      let w = upgradeProblemMult(g, this.hallIdx, p.upgrade);
      if (short[p.role]) w *= 1 + 0.5 * short[p.role];
      w *= 1.25 - 0.1 * avgSkill(g, this.hallIdx, p.role);
      if (p.id === 'power_cut') w *= g.research('powerProblemMult');
      if (p.id === 'families_arguing') w *= Math.max(0.2, 1 - (this.b.plan.seating ?? 0) * 0.7);
      if (p.id === 'parking_chaos') w *= g.plotEffect('parkingProblemMult', this.hallIdx);
      if (p.outdoorOnly && HALLS.halls[this.hallIdx].weather === 'cold') w *= 1.5;
      return Math.max(0, w);
    });
    const avgW = weights.reduce((a, b) => a + b, 0) / weights.filter((w) => w > 0).length;
    let count = 0; const lam = expected * Math.min(1.6, avgW); let L = Math.exp(-lam), p = 1;
    do { count++; p *= g.rng.next(); } while (p > L && count < 30); count--;
    const tot = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < count; i++) {
      let r = g.rng.next() * tot; let idx = 0; for (; idx < weights.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
      const prob = PROBLEMS[Math.min(idx, PROBLEMS.length - 1)];
      const ph = this.phaseTimes.filter((x) => prob.phases.includes(x.id)); if (!ph.length) continue;
      const pt = g.rng.pick(ph); const at = g.rng.range(pt.start + 2, Math.max(pt.start + 3, pt.end - 3));
      const time = prob.time * (this.g.s.settings.weddingLength === 'short' ? 0.85 : 1);
      const cost = Math.round(prob.fixCost * (short[prob.role] ? 1.5 : 1) * g.diff.costMult);
      this.problems.push({ uid: this.uidN++, id: prob.id, at, timeLeft: time, total: time, cost, state: 'pending', manager: null, spot: g.rng.int(0, 999) });
    }
    this.problems.sort((a, b) => a.at - b.at);
  }

  phaseAt(t: number): Phase { for (const p of this.phaseTimes) if (t < p.end) return p.id; return 'farewell'; }
  phaseProgress() { const p = this.phaseTimes.find((x) => x.id === this.phase)!; return (this.t - p.start) / (p.end - p.start); }

  step(dt: number) {
    if (this.done) return;
    const g = this.g; this.t += dt;
    const ph = this.phaseAt(this.t); if (ph !== this.phase) { this.phase = ph; this.events.push({ kind: 'phase', data: ph }); }
    const mgr = this.manager; const mgrFixes = !!mgr && (mgr.toggles?.fix ?? true);
    for (const p of this.problems) {
      if (p.state === 'pending' && this.t >= p.at) { p.state = 'active'; this.events.push({ kind: 'problem', data: p }); }
      if (p.state !== 'active') continue;
      p.timeLeft -= dt;
      // The manager walks to the problem and tries to fix it.
      if (mgrFixes && !p.manager && !this.problems.some((q) => q.state === 'active' && q.manager && q.uid !== p.uid && q.manager.eta > 0)) {
        const skill = effSkill(mgr!); const chance = Math.min(0.95, CFG.night.managerChanceSkill1 + (skill - 1) * CFG.night.managerChancePerSkill);
        p.manager = { eta: CFG.night.managerWalkSeconds * walkFactor(g.s.halls[this.hallIdx]), ok: g.rng.chance(chance) };
        this.events.push({ kind: 'managerGo', data: p });
      }
      if (p.manager && p.manager.eta > 0) {
        p.manager.eta -= dt;
        if (p.manager.eta <= 0) {
          if (p.manager.ok && g.s.money >= p.cost) { this.resolve(p, true, true); }
          else { this.events.push({ kind: 'managerFail', data: p }); }
        }
      }
      if (p.staff && p.staff.eta > 0) {
        p.staff.eta -= dt;
        if (p.staff.eta <= 0) { if (p.staff.ok) this.resolve(p, true, false, 0); else { p.staff = null; this.events.push({ kind: 'staffFail', data: p }); } }
      }
      if (p.state === 'active' && p.timeLeft <= 0) {
        // Unattended nights: staff may still handle it a bit.
        if (!this.attended && !mgr && g.rng.chance(0.25)) this.resolve(p, true, false);
        else { p.state = 'missed'; this.missed++; this.delta -= PROBLEM_BY_ID[p.id].miss; this.events.push({ kind: 'missed', data: p }); }
      }
    }
    // Tables ask for service during dinner and dancing; fewer waiters means more tables waiting.
    if (this.phase === 'dinner' || this.phase === 'dancing') {
      const short = shortages(g, this.hallIdx, this.b.req.guests); const rate = 0.05 * Math.min(4, this.tables) / 4 * (1 + (short.waiter ?? 0) * 0.6 + (short.bartender ?? 0) * 0.4) * (this.phase === 'dancing' ? 0.7 : 1) * (this.b.plan.zones && staffIn(g, this.hallIdx, 'waiter').length >= 2 ? 0.6 : 1);
      if (g.rng.chance(rate * dt * 4) && this.needs.length < 4) this.needs.push({ uid: this.needUid++, table: g.rng.int(0, this.tables - 1), kind: this.phase === 'dancing' ? (g.rng.chance(0.5) ? 'drink' : 'music') : g.rng.chance(0.7) ? 'food' : 'drink', timeLeft: 14 });
    }
    for (const n of [...this.needs]) { n.timeLeft -= dt; if (n.timeLeft <= 0) { this.needs = this.needs.filter((x) => x !== n); this.needsMissed++; this.delta -= 0.6; this.events.push({ kind: 'needMissed', data: n }); } }
    for (const m of this.moments) {
      if (m.state === 'pending' && this.t >= m.at) { m.state = 'open'; this.events.push({ kind: 'moment', data: m }); }
      if (m.state === 'open' && this.t >= m.at + m.window) {
        if (!this.attended && mgr && g.rng.chance(0.35 + effSkill(mgr) * 0.08)) this.hitMoment(m);
        else { m.state = 'miss'; this.events.push({ kind: 'momentMiss', data: m }); }
      }
    }
    if (this.t >= this.duration) { this.done = true; this.events.push({ kind: 'end' }); }
  }
  private resolve(p: ActiveProblem, ok: boolean, byManager: boolean, costOverride?: number) {
    if (!ok) return; const cost = costOverride ?? p.cost;
    if (cost) { this.g.addMoney(-cost); this.fixCosts += cost; }
    p.state = 'fixed'; this.fixed++; this.delta += PROBLEM_BY_ID[p.id].gain * (CFG.night.fixGainMult ?? 1); this.g.stat('problemsFixed'); this.g.weekStat('problemsFixed');
    this.events.push({ kind: 'fixed', data: { p, byManager } });
  }
  /** Player taps a problem bubble. Returns false if they can't afford the fix. */
  fix(uid: number) {
    const p = this.problems.find((x) => x.uid === uid); if (!p || p.state !== 'active') return false;
    if (this.g.s.money < p.cost) return false;
    this.resolve(p, true, false); return true;
  }
  /** The owner walked over in person: fixes it at half price. */
  ownerFix(uid: number) {
    const p = this.problems.find((x) => x.uid === uid); if (!p || p.state !== 'active') return false;
    const c = Math.round(p.cost * 0.5); if (this.g.s.money < c) return false; this.resolve(p, true, false, c); return true;
  }
  /** Send a staff member of the right role instead of paying: free, but takes time and can fail. */
  delegate(uid: number) {
    const p = this.problems.find((x) => x.uid === uid); if (!p || p.state !== 'active' || p.staff) return false;
    const role = PROBLEM_BY_ID[p.id].role; const team = staffIn(this.g, this.hallIdx, role); if (!team.length) return false;
    const skill = avgSkill(this.g, this.hallIdx, role); p.staff = { eta: 3 + 1.5 * walkFactor(this.g.s.halls[this.hallIdx]), ok: this.g.rng.chance(Math.min(0.92, 0.5 + skill * 0.08)) };
    this.events.push({ kind: 'staffGo', data: p }); return true;
  }
  canDelegate(uid: number) { const p = this.problems.find((x) => x.uid === uid); return !!p && staffIn(this.g, this.hallIdx, PROBLEM_BY_ID[p.id].role).length > 0; }
  /** Ignore it on purpose: a smaller hit than letting the timer run out. */
  ignore(uid: number) { const p = this.problems.find((x) => x.uid === uid); if (!p || p.state !== 'active') return false; p.state = 'missed'; this.missed++; this.delta -= PROBLEM_BY_ID[p.id].miss * 0.5; this.events.push({ kind: 'ignored', data: p }); return true; }
  /** Serve a table that is asking for food, drinks or a song. */
  serve(uid: number) { const n = this.needs.find((x) => x.uid === uid); if (!n) return false; this.needs = this.needs.filter((x) => x !== n); this.needsServed++; this.delta += 0.35; this.events.push({ kind: 'served', data: n }); return true; }
  /** quality 0..1 from the timing mini-game (1 = perfect). */
  tapMoment(id: MomentId, quality = 1) { const m = this.moments.find((x) => x.id === id); if (!m || m.state !== 'open') return false; this.hitMoment(m, quality); return true; }
  private hitMoment(m: Moment, quality = 1) { m.state = 'hit'; this.momentsHit++; this.delta += CFG.happiness.miniMoment * (0.4 + 0.8 * quality); this.g.stat('miniMoments'); this.g.weekStat('miniMoments'); this.events.push({ kind: 'momentHit', data: m }); }
  /** Skip: the rest of the night runs automatically; costs happiness, a good manager cuts the penalty. */
  skip() {
    if (this.done) return;
    this.skipped = true; this.attended = false;
    while (!this.done) this.step(0.5);
  }
  drain() { const e = this.events; this.events = []; return e; }

  /** Final happiness and everything that goes in the report. Applies money, reputation and stats. */
  finish(): WeddingRecord {
    const g = this.g; const b = this.b; const r = b.req; const H = CFG.happiness; const P = CFG.personalities[r.personality];
    const m = planMatches(b, b.plan);
    let h = H.base + P.happyBase;
    h += m.theme ? H.themeMatch : -3; h += m.flower ? H.flowerMatch : -1; h += m.light ? H.lightMatch : -1; h += m.music ? H.musicMatch : -1; h += m.venue ? H.venueMatch : -1;
    const hall = g.s.halls[b.hall];
    for (const u of HALLS.upgrades) h += ((hall.upgrades[u.id] ?? 1) - 1) * u.happiness * H.perUpgradeLevel;
    const kept = b.lines.filter((l) => l.on).length; h += kept * H.perDemand * 0.5; h += b.removed * H.removedDemand * P.demandWeight;
    const short = shortages(g, b.hall, r.guests); let sp = 0; for (const k in short) sp += H.staffShortPerRole * Math.min(3, short[k]); h += Math.max(H.staffShortCap ?? -12, sp);
    h += H.menuBonus[r.menu] ?? 0; h += layoutScore(hall, r.guests); h += g.research('happinessAdd');
    let traitH = 0; for (const e of staffIn(g, b.hall)) traitH += STAFF.traits[e.trait]?.happiness ?? 0; h += Math.max(-3, Math.min(3, traitH));
    if (b.priceLevel > 1.4) h -= (b.priceLevel - 1.4) * (r.personality === 'picky' || r.personality === 'budget' ? 14 : 8);
    if (r.celebrity) h -= 4;
    // Seating plan (-1..1), food quality and supplier tiers.
    h += (b.plan.seating ?? 0) * 4;
    const food = FOOD[b.plan.food ?? 'standard']; h += food.happy;
    const sup = g.s.suppliers ?? {}; for (const k of ['flowers', 'cake', 'photo']) h += SUPPLIER_HAPPY[sup[k] ?? 1];
    h += this.delta;
    const mgr = this.manager;
    if (this.skipped) h -= Math.max(2, H.skipPenalty - (mgr ? effSkill(mgr) * H.managerSkipReduction : 0));
    else if (!this.attended) h -= Math.max(1, H.unattendedPenalty - (mgr ? effSkill(mgr) * 1.2 : -4));
    h = Math.max(5, Math.min(100, Math.round(h)));

    const Pr = CFG.pricing; const remaining = b.total - b.paid;
    const payRest = Math.round(remaining * (h < Pr.unhappyThreshold ? 1 - Pr.unhappyPayCut : 1));
    const tips = h >= Pr.tipThreshold ? Math.round(b.total * Pr.tipShare * (h - Pr.tipThreshold) / (100 - Pr.tipThreshold)) : 0;
    let shop = 0; for (const id of ['flower_shop', 'cake_shop', 'photo_studio']) if (g.hasPlot(b.hall, id)) shop += Math.round(r.guests * g.rng.range(1.5, 3.5) * hall.plots[id]);
    const foodExtra = Math.round(r.guests * (CFG.menus[r.menu]?.cost ?? 20) * (food.costMult - 1));
    g.addMoney(payRest + tips + shop, true); g.addMoney(-b.cost - foodExtra);
    const payment = b.paid + payRest; const costs = b.cost + this.fixCosts + foodExtra; let profit = payment + tips + shop - costs;
    // An investor takes a share of each wedding's profit while the deal lasts.
    const inv = g.s.investor; if (inv && inv.until >= g.s.day && profit > 0) { const cut = Math.round(profit * inv.share); g.addMoney(-cut); profit -= cut; }

    const R = CFG.reputation; let rep = (h - R.neutral) * R.perHappinessPoint; rep = Math.max(-R.maxGainPerWedding, Math.min(R.maxGainPerWedding, rep)); if (r.celebrity) rep *= 2;
    g.addRep(rep);
    g.addFollowers(r.guests * CFG.followers.perWeddingPost * 0.3 * (h / 100));
    const tier = h >= 90 ? 'great' : h >= 75 ? 'good' : h >= 55 ? 'ok' : 'bad';
    const review = g.rng.pick(CONTENT.reviews[tier]) as Bi;
    const loved: string[] = []; const wanted: string[] = [];
    for (const k of ['theme', 'flower', 'light', 'music', 'venue'] as const) (m[k] ? loved : wanted).push(k);
    if (this.fixed > this.missed && this.fixed) loved.push('service'); if (this.missed >= 2) wanted.push('service');
    const rec: WeddingRecord = {
      id: g.uid('w'), day: g.s.day, hall: b.hall, names: [r.groom, r.bride], guests: r.guests, happiness: h, themeMatch: matchPercent(b, b.plan),
      fixed: this.fixed, missed: this.missed, payment, tips, costs, profit, repChange: Math.round(rep * 10) / 10, review, stars: Math.round(h / 10) / 2,
      photo: this.photo, celebrity: r.celebrity, skipped: this.skipped, unattended: !this.attended && !this.skipped, returned: !!r.returning,
      personality: r.personality, theme: r.theme, loved, wanted, shopSales: shop,
    };
    // Bookkeeping and stats.
    g.s.history.push(rec); if (g.s.history.length > 400) g.s.history.splice(0, g.s.history.length - 400);
    g.s.bookings = g.s.bookings.filter((x) => x.id !== b.id);
    hall.weddings++; hall.ratingHistory.push(h); if (hall.ratingHistory.length > 30) hall.ratingHistory.shift();
    g.stat('weddings'); g.weekStat('weddings'); g.stat('guestsServed', r.guests); g.stat('weddingsInHall' + b.hall);
    if (h >= H.perfect) g.stat('perfectWeddings');
    g.maxStat('bestHappiness', h); g.maxStat('bestGuests', r.guests); g.s.weekStats.bestHappiness = Math.max(g.s.weekStats.bestHappiness ?? 0, h);
    if (m.theme && m.flower && m.light && m.music && m.venue) g.weekStat('perfectTheme');
    if (r.celebrity) g.maxStat('celebrity', h);
    if (r.returning) g.stat('returningCouples');
    g.s.chapterStats.happySum = (g.s.chapterStats.happySum ?? 0) + h;
    workedWedding(g, b.hall);
    if (h >= 75 && !r.returning) g.s.returningPool.push({ id: rec.id, names: rec.names, hall: b.hall, day: g.s.day, looks: r.look });
    if (g.s.returningPool.length > 60) g.s.returningPool.shift();
    // The couple writes afterwards.
    if (h >= 85) g.message(r.bride, ['Thank you for the most beautiful night of our lives!', 'شكراً لكم على أجمل ليلة في حياتنا!'], 'thanks');
    else if (h < 40) g.message(r.groom, ['We are very disappointed. We want part of our money back.', 'نحن محبطون جداً. نريد استرداد جزء من أموالنا.'], 'refund',
      [{ label: ['Refund 10%', 'إعادة 10%'], action: 'refund', arg: Math.round(payment * 0.1) }, { label: ['Apologize only', 'الاعتذار فقط'], action: 'norefund' }]);
    g.s.lastReport = rec;
    g.emit('weddingDone', rec);
    return rec;
  }
}

/** Runs a whole night without graphics. The bot fixes some problems and taps some moments. */
export function runHeadless(g: Game, b: Booking, opts: { attended: boolean; fixRate?: number; momentRate?: number; skip?: boolean }) {
  const sim = new NightSim(g, b, opts.attended);
  if (opts.skip) sim.skip();
  while (!sim.done) {
    sim.step(0.5);
    if (opts.attended) {
      for (const p of sim.problems) if (p.state === 'active' && !p.manager && p.total - p.timeLeft > 2 && g.rng.chance((opts.fixRate ?? 0.85) * 0.25)) sim.fix(p.uid);
      for (const m of sim.moments) if (m.state === 'open' && g.rng.chance((opts.momentRate ?? 0.8) * 0.25)) sim.tapMoment(m.id, g.rng.range(0.4, 1));
      for (const n of sim.needs) if (g.rng.chance(0.15)) sim.serve(n.uid);
    }
  }
  return sim.finish();
}
export { DEMAND_BY_ID };
