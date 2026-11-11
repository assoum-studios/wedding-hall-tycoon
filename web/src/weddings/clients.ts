// Client requests, invoices, negotiation, deposits and referrals.
import type { Game } from '../core/game';
import type { ClientRequest, Booking, DemandLine, Personality, ThemeId, MenuId, Bi } from '../core/types';
import { CFG, DEMANDS, DEMAND_BY_ID, HALLS, CONTENT, PROG } from '../core/data';
import { randomLook } from '../characters/looks';
import { capacity, hallDims } from '../world/layout';
import { staffIn } from '../staff/staff';
import { marketingBoost } from '../business/marketing';
import { currentSeason } from '../progress/events';

const PERSONALITIES = Object.keys(CFG.personalities) as Personality[];
const THEMES = Object.keys(CFG.themes) as ThemeId[];
export const THEME_FLOWER: Record<ThemeId, string> = { classic: 'white', royal: 'yellow', boho: 'wild', beach: 'peach', glam: 'white', romantic: 'red', rustic: 'wild', fairytale: 'lavender' };

export function demandAvailable(g: Game, hallIdx: number, id: string) {
  const d = DEMAND_BY_ID[id]; if (!d?.req) return true;
  if (d.req.staff && !staffIn(g, hallIdx, d.req.staff).length) return false;
  if (d.req.plot && !g.hasPlot(hallIdx, d.req.plot)) return false;
  if (d.req.rep && g.s.reputation < d.req.rep) return false;
  if (d.req.upgrade && (g.s.halls[hallIdx].upgrades[d.req.upgrade.id] ?? 0) < d.req.upgrade.level) return false;
  return true;
}

/** Requests per day for a hall, from reputation, followers, hall size, marketing, season and Victor. */
export function requestRate(g: Game, hallIdx: number) {
  const R = CFG.requests; const h = g.s.halls[hallIdx];
  let r = R.basePerDay * (1 + g.s.reputation * R.repFactor) * (1 + Math.log10(1 + g.s.followers / 1000) * R.followerFactor * 4) * (1 + h.size * R.sizeFactor);
  r *= 1 + marketingBoost(g); r *= g.mod('requestMult');
  const season = currentSeason(g); if (season) r *= season.requestMult;
  if (g.s.victor.rating > g.rating(hallIdx)) r *= R.victorAheadMult;
  if (hallIdx !== g.s.activeHall) r *= 0.8;
  return r;
}

export function genRequest(g: Game, hallIdx: number, opts: { vip?: boolean; celebrity?: boolean; returning?: any; theme?: ThemeId } = {}): ClientRequest {
  const rng = g.rng; const h = g.s.halls[hallIdx]; const hallDef = HALLS.halls[hallIdx];
  const cap = Math.max(CFG.guests.min, capacity(h) || hallDims(h.size).cap);
  let personality: Personality = opts.celebrity ? 'wealthy' : opts.vip ? rng.pick(['wealthy', 'picky'] as Personality[]) : rng.pick(PERSONALITIES);
  const P = CFG.personalities[personality];
  let guests = Math.round(rng.range(CFG.guests.capacityShareMin, CFG.guests.capacityShareMax) * cap / 10) * 10;
  guests = Math.max(CFG.guests.min, Math.min(cap, guests));
  if (opts.celebrity) guests = cap;
  const season = currentSeason(g);
  const theme: ThemeId = opts.theme ?? (season && rng.chance(0.5) ? season.theme : rng.chance(0.4) ? rng.pick(hallDef.clientTags.filter((t: string) => THEMES.includes(t as ThemeId))) : rng.pick(THEMES));
  const menu: MenuId = personality === 'budget' ? 'buffet' : personality === 'wealthy' || opts.vip ? 'luxury' : rng.pick(['buffet', 'three_course', 'three_course', 'luxury'] as MenuId[]);
  const lightIds = Object.keys(CFG.lighting); const musicIds = Object.keys(CFG.music); const flowerIds = Object.keys(CFG.flowers);
  const pickTagged = (ids: string[], table: any) => { const m = ids.filter((id) => table[id].tags?.includes(theme)); return m.length && rng.chance(0.75) ? rng.pick(m) : rng.pick(ids); };
  const venues = ['main', ...Object.keys(CFG.venues).filter((v) => v !== 'main' && g.hasPlot(hallIdx, CFG.venues[v].plot))];
  const venueTag = venues.filter((v) => CFG.venues[v].tags?.includes(theme));
  const venue = venueTag.length && rng.chance(0.6) ? rng.pick(venueTag) : 'main';
  // Extra demands (2..8) from the pool; some need things you own.
  const nDem = Math.min(8, rng.int(2, personality === 'picky' || personality === 'wealthy' ? 8 : 5) + (opts.vip ? 1 : 0));
  const pool = rng.shuffle(DEMANDS.map((d) => d.id));
  const themed = pool.filter((id) => DEMAND_BY_ID[id].tags.includes(theme) || (personality === 'party' && DEMAND_BY_ID[id].tags.includes('party')));
  const demands: string[] = [];
  for (const id of [...themed, ...pool]) { if (demands.length >= nDem) break; if (!demands.includes(id)) demands.push(id); }
  const date = g.s.day + rng.int(CFG.time.bookAheadMin, CFG.time.bookAheadMax);
  // Hidden budget: what they'd pay at a "fair" price level ~1.25.
  const base = estimateTotal(g, hallIdx, guests, menu, demands);
  const repF = 0.82 + g.s.reputation / 220;
  let budget = base * (CFG.pricing.budgetFactor ?? 1.1) * P.budgetMult * repF * g.diff.budgetMult * hallDef.budgetMult * g.mod('budgetMult') * g.research('budgetMult') * rng.range(0.85, 1.2);
  if (season) budget *= season.budgetMult;
  if (opts.vip) budget *= 1.25; if (opts.celebrity) budget *= 1.8;
  const groom = opts.returning?.names?.[0] ?? (rng.pick(CONTENT.maleNames) as Bi);
  const bride = opts.returning?.names?.[1] ?? (rng.pick(CONTENT.femaleNames) as Bi);
  const look = opts.returning?.looks ?? { g: randomLook(rng, { gender: 'm', body: 'adult' }), b: randomLook(rng, { gender: 'f', body: 'adult' }) };
  return {
    id: g.uid('r'), groom, bride, story: rng.int(0, CONTENT.loveStories.length - 1), personality, guests, menu, theme,
    flower: rng.chance(0.65) ? THEME_FLOWER[theme] : rng.pick(flowerIds),
    light: pickTagged(lightIds, CFG.lighting), music: pickTagged(musicIds, CFG.music), venue,
    date, hall: hallIdx, expires: g.s.day + CFG.time.requestExpireDays, budget: Math.round(budget), demands,
    vip: opts.vip, celebrity: opts.celebrity, returning: opts.returning?.id, look, status: 'new',
  };
}

function estimateTotal(g: Game, hallIdx: number, guests: number, menu: MenuId, demands: string[]) {
  const P = CFG.pricing; const h = g.s.halls[hallIdx];
  let t = P.hallRentalBase + P.hallRentalPerSize * h.size + CFG.menus[menu].price * guests + P.decorBase + P.decorPerGuest * guests + 1100;
  for (const id of demands) { const d = DEMAND_BY_ID[id]; t += d.perGuest ? d.price * guests : d.price; }
  return t;
}

export interface InvoiceLine { key: string; label: Bi | string; cost: number; price: number; fixed: boolean; on: boolean; available: boolean; }
/** All invoice lines for a request: fixed lines plus each extra demand. */
export function invoiceLines(g: Game, req: ClientRequest, lines?: DemandLine[]): InvoiceLine[] {
  const P = CFG.pricing; const h = g.s.halls[req.hall]; const G = req.guests; const costMult = g.diff.costMult;
  const food = g.mod('foodCostMult') * g.research('foodCostMult'); const flowers = g.mod('flowerCostMult') * g.research('decorCostMult') * g.plotEffect('decorCostMult', req.hall);
  const music = CFG.music[req.music]; const menu = CFG.menus[req.menu];
  const out: InvoiceLine[] = [
    { key: 'rental', label: ['Hall rental', 'إيجار القاعة'], cost: 0, price: P.hallRentalBase + P.hallRentalPerSize * h.size, fixed: true, on: true, available: true },
    { key: 'menu', label: [`${menu.en} x ${G}`, `${menu.ar} × ${G}`], cost: Math.round(menu.cost * G * food * costMult), price: menu.price * G, fixed: true, on: true, available: true },
    { key: 'decor', label: ['Theme decor & flowers', 'ديكور الثيم والزهور'], cost: Math.round((P.decorBase + P.decorPerGuest * G) * P.decorCostShare * flowers * costMult), price: P.decorBase + P.decorPerGuest * G, fixed: true, on: true, available: true },
    { key: 'music', label: [music.en, music.ar], cost: Math.round(music.cost * costMult), price: music.price, fixed: true, on: true, available: true },
  ];
  const cakeDisc = g.hasPlot(req.hall, 'cake_shop') ? 0.8 : 1;
  for (const id of req.demands) {
    const d = DEMAND_BY_ID[id]; if (!d) continue;
    const mult = d.perGuest ? G : 1; const isCake = id.includes('cake');
    const on = lines ? (lines.find((l) => l.id === id)?.on ?? true) : true;
    const available = demandAvailable(g, req.hall, id);
    out.push({ key: id, label: [d.en, d.ar], cost: Math.round(d.cost * mult * costMult * (isCake ? cakeDisc : 1)), price: d.price * mult, fixed: false, on: on && available, available });
  }
  return out;
}
export function invoiceTotals(lines: InvoiceLine[], priceLevel: number) {
  let total = 0, cost = 0, removed = 0;
  for (const l of lines) { if (!l.on) { if (!l.fixed) removed++; continue; } total += Math.round(l.price * priceLevel); cost += l.cost; }
  return { total, cost, removed };
}

export type OfferResult = { kind: 'accept' } | { kind: 'counter'; amount: number } | { kind: 'reject'; reason: Bi };
/** How the couple reacts to an invoice: accept, counter once, or walk away. */
export function evaluateOffer(g: Game, req: ClientRequest, total: number, removed: number): OfferResult {
  const P = CFG.personalities[req.personality];
  const tol = P.tolerance * g.research('toleranceMult');
  // Removing what they asked for lowers what they're willing to pay for the rest.
  const willing = req.budget * (1 - removed * 0.05 * P.demandWeight);
  if (req.personality === 'picky' && removed >= 2) return { kind: 'reject', reason: ['We asked for those things for a reason. Goodbye.', 'طلبنا هذه الأشياء لسبب. وداعاً.'] };
  if (total <= willing) return { kind: 'accept' };
  if (total <= willing * (1 + 0.18 * tol) && req.status !== 'countered') {
    const amount = Math.round((willing + (total - willing) * 0.25) / 10) * 10;
    return { kind: 'counter', amount };
  }
  return { kind: 'reject', reason: removed ? ['Too expensive, even without the extras.', 'السعر مرتفع جداً، حتى من دون الإضافات.'] : ['That is far beyond our budget. Sorry.', 'هذا أعلى بكثير من ميزانيتنا. آسفون.'] };
}

/** "Meet in the middle" once after a counter-offer. */
export function meetMiddle(g: Game, req: ClientRequest, amount: number, removed: number) {
  const P = CFG.personalities[req.personality]; const willing = req.budget * (1 - removed * 0.05 * P.demandWeight);
  const ok = amount <= willing * (1 + 0.07 * P.tolerance * g.research('toleranceMult'));
  return ok;
}
export function dateTaken(g: Game, hallIdx: number, date: number) { return g.s.bookings.some((b) => b.hall === hallIdx && b.date === date); }

export function book(g: Game, req: ClientRequest, lines: InvoiceLine[], priceLevel: number, totalOverride?: number): Booking {
  const tt = invoiceTotals(lines, priceLevel); const total = totalOverride ?? tt.total;
  const deposit = Math.round(total * CFG.pricing.depositShare);
  const b: Booking = { id: g.uid('b'), req, hall: req.hall, date: req.date, lines: lines.filter((l) => !l.fixed).map((l) => ({ id: l.key, on: l.on })),
    priceLevel, total, cost: tt.cost, deposit, paid: deposit, removed: tt.removed,
    plan: { theme: 'classic', flower: 'white', light: 'chandeliers', music: 'dj', venue: 'main', planned: false } };
  g.addMoney(deposit, true);
  g.s.bookings.push(b); g.s.requests = g.s.requests.filter((r) => r.id !== req.id);
  g.emit('booking', b); return b;
}
export function rejectRequest(g: Game, req: ClientRequest) { g.s.requests = g.s.requests.filter((r) => r.id !== req.id); g.emit('requests'); }

/** Other owned halls that are free on the requested date and can fit the guests. */
export function referralOptions(g: Game, req: ClientRequest) {
  return g.s.halls.map((h, i) => ({ h, i })).filter(({ h, i }) => h.owned && i !== req.hall && !dateTaken(g, i, req.date) && capacity(h) >= req.guests * 0.9);
}
export function referChance(g: Game, req: ClientRequest, hallIdx: number) {
  const dist = Math.abs(hallIdx - req.hall) * 0.06; const rating = g.rating(hallIdx) / 100;
  const pers = req.personality === 'easygoing' ? 0.15 : req.personality === 'picky' ? -0.2 : req.personality === 'traditional' ? -0.1 : 0;
  return Math.max(0.05, Math.min(0.95, 0.45 + (rating - 0.6) + pers - dist));
}
export function refer(g: Game, req: ClientRequest, hallIdx: number) {
  if (!g.rng.chance(referChance(g, req, hallIdx))) { rejectRequest(g, req); return false; }
  req.hall = hallIdx; req.budget = Math.round(req.budget * HALLS.halls[hallIdx].budgetMult / HALLS.halls[0].budgetMult);
  const cap = capacity(g.s.halls[hallIdx]); req.guests = Math.min(req.guests, cap);
  g.stat('referrals'); g.emit('requests'); return true;
}

/** Daily: expire old requests, then roll new ones for every owned hall. */
export function dailyRequests(g: Game) {
  g.s.requests = g.s.requests.filter((r) => r.expires >= g.s.day);
  for (let i = 0; i < g.s.halls.length; i++) {
    const h = g.s.halls[i]; if (!h.owned) continue;
    const open = g.s.requests.filter((r) => r.hall === i).length; if (open >= CFG.requests.maxOpen) continue;
    let n = requestRate(g, i); let count = Math.floor(n); if (g.rng.chance(n - count)) count++;
    count = Math.min(count, CFG.requests.maxOpen - open);
    for (let k = 0; k < count; k++) {
      const vipChance = CFG.requests.vipChance + g.research('vipChanceAdd') - 0 + (marketingVip(g));
      const r = genRequest(g, i, { vip: g.rng.chance(vipChance) });
      if (!dateTaken(g, i, r.date) || referralOptions(g, r).length) g.s.requests.push(r);
    }
  }
  g.emit('requests');
}
function marketingVip(g: Game) { let v = 0; for (const c of g.s.campaigns) if (c.until >= g.s.day && c.id === 'expo') v += 0.25; return v; }
export { PROG };
