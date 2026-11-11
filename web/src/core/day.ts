// The daily turn: everything that happens when you press "Next day".
import type { Game } from './game';
import type { Employee } from './types';
import { CFG, CONTENT, PROG, BIZ } from './data';
import { runHeadless, managerPlan } from '../weddings/night';
import { dailyRequests, genRequest, invoiceLines, invoiceTotals, evaluateOffer, book, dateTaken } from '../weddings/clients';
import { dailyMorale, refreshCandidates, managerOf, effSkill, wageFor, assignSpareManager } from '../staff/staff';
import { dailyBusiness, dailySmallHall, runSmallEvents, acceptSmall } from '../business/plots';
import { weeklyLoans } from '../business/loans';
import { dailyUpkeep, dailyResearch } from '../world/hallOps';
import { ensureLayout } from '../world/layout';
import { rollNews, rollCalls } from '../progress/events';
import { ensureWeekly, chapterReady } from '../progress/goals';
import { socialManager } from '../phone/phone';
import { randomLook } from '../characters/looks';

/** Sets up a brand new game: Rosa's loyal staff, the hall layout, first candidates and requests. */
export function startGame(g: Game) {
  const s = g.s; ensureLayout(s.halls[0]);
  const mk = (role: string, name: [string, string], skill: number, gender: 'm' | 'f', named?: string, trait = 'loyal'): Employee => ({
    id: g.uid('e'), name, role, skill, trait, wage: wageFor(role, skill), morale: 85, weekWeddings: 0, hall: 0,
    look: randomLook(g.rng, { gender, uniform: role === 'host' ? 'host' : role === 'cook' ? 'cook' : role }), hiredDay: 0, named });
  s.staff.push(mk('host', ['Nadia', 'نادية'], 3, 'f', 'nadia'));
  s.staff.push(mk('cook', ['Chef Karim', 'الشيف كريم'], 3, 'm', 'karim', 'grumpy'));
  s.staff.push(mk('waiter', ['Sami', 'سامي'], 2, 'm', undefined, 'reliable'));
  s.staff.push(mk('waiter', ['Lina', 'لينا'], 2, 'f', undefined, 'friendly'));
  s.staff.push(mk('cleaner', ['Omar', 'عمر'], 1, 'm', undefined, 'loyal'));
  s.staff[0].look.hair = 0; s.staff[1].look.beard = 2;
  refreshCandidates(g);
  // The tutorial couple and one more request.
  const r = genRequest(g, 0, {}); r.personality = 'easygoing'; r.guests = 80; r.date = 2; r.expires = 3; r.theme = 'boho'; r.demands = r.demands.slice(0, 3);
  r.budget = Math.round(r.budget * 1.35); s.requests.push(r); // the tutorial couple is forgiving on price
  s.requests.push(genRequest(g, 0, {}));
  ensureWeekly(g);
  g.message(['Nadia', 'نادية'], ["Welcome! I'm Nadia, I worked with Rosa for twenty years. I'll show you everything.", 'أهلاً بك! أنا نادية، عملت مع روزا عشرين عاماً. سأريك كل شيء.'], 'story');
}

export interface DayReport { day: number; upkeep: number; business: number; salaries: number; autoWeddings: number; }

/** True when the active hall has a wedding today that the player still has to run. */
export function weddingToday(g: Game, hallIdx = g.s.activeHall) { return g.s.bookings.find((b) => b.hall === hallIdx && b.date === g.s.day) ?? null; }

export function advanceDay(g: Game): DayReport {
  const s = g.s; const rep: DayReport = { day: s.day + 1, upkeep: 0, business: 0, salaries: 0, autoWeddings: 0 };
  // 1. Anything still booked for today runs on its own (other halls, or skipped by the player).
  for (const b of s.bookings.filter((x) => x.date <= s.day)) { runHeadless(g, b, { attended: false }); rep.autoWeddings++; }
  runSmallEvents(g);
  // 2. New day.
  s.day++;
  rep.upkeep = dailyUpkeep(g);
  rep.business = dailyBusiness(g);
  dailyResearch(g);
  weeklyLoans(g);
  if (s.day % CFG.time.salaryEveryDays === 0) {
    rep.salaries = s.staff.reduce((a, e) => a + e.wage, 0) * CFG.time.salaryEveryDays; g.addMoney(-rep.salaries);
    for (const e of s.staff) e.weekWeddings = 0;
  }
  s.mods = s.mods.filter((m) => m.until >= s.day); s.campaigns = s.campaigns.filter((c) => c.until >= s.day);
  dailyMorale(g);
  if (s.day - s.candidatesDay >= CFG.time.candidateRefreshDays) refreshCandidates(g);
  dailyRequests(g);
  returningCouples(g);
  dailySmallHall(g);
  managersWork(g);
  socialManager(g);
  victorDrift(g);
  // Negative balance creates pressure (reputation, morale, bank letters) without ending the game.
  if (s.money < 0) {
    g.addRep(-CFG.reputation.negativeBalancePenaltyPerDay);
    if (s.day % 3 === 0) g.message(['City Bank', 'بنك المدينة'], ['Your account is overdrawn. Please bring it back above zero.', 'حسابك مكشوف. يرجى إعادته فوق الصفر.'], 'bank');
  }
  for (const h of s.halls) if (h.owned && !h.managerId) assignSpareManager(g, s.halls.indexOf(h));
  rollNews(g); rollCalls(g);
  ensureWeekly(g);
  if (s.day % 9 === 4 && s.tutorial.done) g.message(['Victor Crane', 'فيكتور كرين'], g.rng.pick(CONTENT.victorTaunts), 'victor',
    [{ label: ['Reply politely', 'الرد بلطف'], action: 'victorReply' }, { label: ['Ignore', 'تجاهل'], action: 'ignore' }]);
  if (s.day % 11 === 6 && s.tutorial.done) g.message(['Bloom Suppliers', 'موردو الزهور'], ['Bulk flower deal: pay $800 now, 20% off flowers for 10 days.', 'عرض زهور بالجملة: ادفع 800$ الآن واحصل على خصم 20% على الزهور لمدة 10 أيام.'], 'supplier',
    [{ label: ['Take the deal', 'قبول العرض'], action: 'supplier', arg: 800 }, { label: ['No thanks', 'لا شكراً'], action: 'ignore' }]);
  if (chapterReady(g)) g.emit('chapterReady');
  g.emit('day', rep);
  return rep;
}

function returningCouples(g: Game) {
  const s = g.s; const pool = s.returningPool.filter((c) => s.day - c.day >= 20);
  if (!pool.length || !g.rng.chance(Math.min(0.35, 0.05 + pool.length * 0.02))) return;
  const c = g.rng.pick(pool); s.returningPool = s.returningPool.filter((x) => x.id !== c.id);
  const h = s.halls[c.hall];
  if (g.hasPlot(c.hall, 'small_hall') && g.rng.chance(0.6)) {
    const t = g.rng.pick(BIZ.smallHallTypes.filter((x: any) => ['anniversary', 'baby_shower', 'engagement'].includes(x.id))) as any;
    const guests = g.rng.int(t.guests[0], t.guests[1]);
    h.smallBookings.push({ id: g.uid('s'), type: t.id, guests, date: s.day + g.rng.int(2, 5), price: Math.round(t.price * guests * 1.2), hall: c.hall, accepted: true });
    g.stat('returningCouples');
    g.message(c.names[1], ['We are back! We booked your small hall to celebrate with family.', 'لقد عدنا! حجزنا قاعتكم الصغيرة للاحتفال مع العائلة.'], 'returning');
  } else {
    const r = genRequest(g, c.hall, {}); r.returning = c.id; r.budget = Math.round(r.budget * 1.15); r.personality = 'easygoing';
    s.requests.unshift(r);
    g.message(c.names[0], ['Our friends are getting married. We told them only your hall will do!', 'أصدقاؤنا سيتزوجون. أخبرناهم أن قاعتكم هي الخيار الوحيد!'], 'referral');
  }
}

/** Managers accept good bookings, plan upcoming weddings and accept small hall events, per their toggles. */
function managersWork(g: Game) {
  const s = g.s;
  s.halls.forEach((h, i) => {
    if (!h.owned) return; const m = managerOf(g, i); if (!m) return; const skill = effSkill(m);
    if (m.toggles?.accept) {
      for (const r of s.requests.filter((x) => x.hall === i && x.status !== 'rejected')) {
        if (dateTaken(g, i, r.date)) continue;
        const lines = invoiceLines(g, r); const level = 1.05 + skill * 0.05; const tot = invoiceTotals(lines, level);
        const res = evaluateOffer(g, r, tot.total, tot.removed);
        if (res.kind === 'accept') book(g, r, lines, level);
        else if (res.kind === 'counter') { r.status = 'countered'; book(g, r, lines, level, res.amount); }
      }
      for (const b of h.smallBookings) if (!b.accepted && !b.done) acceptSmall(g, i, b.id);
    }
    if (m.toggles?.plan) for (const b of s.bookings) if (b.hall === i && !b.plan.planned && b.date - s.day <= 2) b.plan = managerPlan(g, b, skill);
  });
}

function victorDrift(g: Game) {
  const v = g.s.victor; const target = Math.min(CFG.victor.maxRating, (CFG.victor.base + g.s.chapter * CFG.victor.growthPerChapter) * g.diff.victorStrength * g.mod('victorMult'));
  v.rating += (target - v.rating) * 0.05 + g.rng.range(-0.4, 0.4);
  v.rating = Math.max(50, Math.min(97, v.rating));
}
export { PROG };
