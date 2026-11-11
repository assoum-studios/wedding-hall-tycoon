// Cosmetic shop: buy once, switch any time per hall. In-game money only.
import type { Game } from '../core/game';
import { BIZ } from '../core/data';
export function item(id: string) { return BIZ.shop.find((x: any) => x.id === id); }
export function buy(g: Game, id: string) {
  const it = item(id); if (!it || g.s.shopOwned.includes(id) || g.s.money < it.cost) return false;
  g.addMoney(-it.cost); g.s.shopOwned.push(id); g.stat('cosmetics'); equip(g, id); return true;
}
export function equip(g: Game, id: string | null, cat?: string) {
  const h = g.hall;
  if (id === null) { if (cat) delete h.cosmetics[cat]; }
  else { const it = item(id); if (!it || !g.s.shopOwned.includes(id)) return; h.cosmetics[it.cat] = id; }
  g.emit('cosmetics');
}
export function cosmeticColor(g: Game, hallIdx: number, cat: string): string | null { const id = g.s.halls[hallIdx].cosmetics[cat]; return id ? item(id)?.color ?? null : null; }
