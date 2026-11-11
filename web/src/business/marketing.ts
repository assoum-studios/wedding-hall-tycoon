// Marketing campaigns: raise request volume for some days, stacking up to a cap.
import type { Game } from '../core/game';
import { BIZ } from '../core/data';
export function marketingBoost(g: Game) {
  let b = 0; for (const c of g.s.campaigns) if (c.until >= g.s.day) b += BIZ.marketing.find((m: any) => m.id === c.id)?.boost ?? 0;
  return Math.min(BIZ.marketingCap, b);
}
export function launch(g: Game, id: string) {
  const m = BIZ.marketing.find((x: any) => x.id === id); if (!m || g.s.money < m.cost) return false;
  g.addMoney(-m.cost); g.s.campaigns.push({ id, until: g.s.day + m.days - 1 });
  if (m.followers) g.addFollowers(m.followers * m.days);
  g.stat('campaigns'); g.emit('marketing'); return true;
}
export function active(g: Game, id: string) { return g.s.campaigns.some((c) => c.id === id && c.until >= g.s.day); }
export function billboardActive(g: Game) { return active(g, 'billboard'); }
