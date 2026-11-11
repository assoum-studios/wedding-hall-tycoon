// Hall upgrades (5 levels each), research tree, expansion through 6 sizes, buying new halls, build mode edits.
import type { Game } from '../core/game';
import type { PlacedItem } from '../core/types';
import { HALLS, ITEM_BY_ID, CFG } from '../core/data';
import { canPlace, ensureLayout, autoLayout, hallDims } from './layout';
import { assignSpareManager } from '../staff/staff';
import { L } from '../core/i18n';

export function upgradeCost(id: string, level: number) { const u = HALLS.upgrades.find((x: any) => x.id === id); return Math.round(u.baseCost * Math.pow(HALLS.upgradeCostGrowth, level - 1)); }
export function buyUpgrade(g: Game, hallIdx: number, id: string) {
  const h = g.s.halls[hallIdx]; const lvl = h.upgrades[id] ?? 1; if (lvl >= HALLS.upgradeMaxLevel) return false;
  const c = upgradeCost(id, lvl); if (g.s.money < c) return false;
  g.addMoney(-c); h.upgrades[id] = lvl + 1; g.stat('upgradesBought'); g.weekStat('upgrades'); g.emit('upgrade', { hall: hallIdx, id }); return true;
}
export function upgradeLevelAvg(g: Game, hallIdx: number) { const u = g.s.halls[hallIdx].upgrades; const v = Object.values(u); return v.reduce((a, b) => a + b, 0) / v.length; }
/** Problem chance multiplier from a hall upgrade: each level above 1 makes the related problem rarer. */
export function upgradeProblemMult(g: Game, hallIdx: number, id: string | null) { if (!id) return 1; const lvl = g.s.halls[hallIdx].upgrades[id] ?? 1; return Math.max(0.25, 1 - (lvl - 1) * HALLS.upgradeProblemReductionPerLevel); }

export function expandCost(g: Game, hallIdx: number) { const h = g.s.halls[hallIdx]; const next = HALLS.sizes[h.size + 1]; return next ? Math.round(next.cost * (1 + hallIdx * 0.5)) : null; }
export function expand(g: Game, hallIdx: number) {
  const h = g.s.halls[hallIdx]; const c = expandCost(g, hallIdx); if (c == null || g.s.money < c) return false;
  g.addMoney(-c); h.size++;
  // Keep the player's layout, then add tables to fill the new space.
  const before = h.layout.length; ensureLayout(h);
  const fresh = autoLayout(h); const { cap } = hallDims(h.size);
  let seatsNow = h.layout.reduce((s, it) => s + (ITEM_BY_ID[it.id]?.seats ?? 0), 0);
  for (const it of fresh) { if (seatsNow >= cap) break; if (ITEM_BY_ID[it.id].kind !== 'table') continue; const n = { ...it, uid: h.nextUid++ }; if (canPlace(h, n)) { h.layout.push(n); seatsNow += ITEM_BY_ID[it.id].seats; } }
  void before;
  g.maxStat('capacity', cap); g.emit('expand', hallIdx); return true;
}
export function hallUnlockable(g: Game, idx: number) {
  // Reaching 1,000 guests in any hall unlocks opening the next hall (story chapter 9 also opens hall 2).
  const prev = g.s.halls[idx - 1]; if (!prev?.owned) return false;
  return g.s.halls.some((h) => h.owned && h.size >= HALLS.sizes.length - 1) || (idx === 1 && g.s.chapter >= 9);
}
export function buyHall(g: Game, idx: number) {
  const h = g.s.halls[idx]; const def = HALLS.halls[idx];
  if (h.owned || !hallUnlockable(g, idx) || g.s.money < def.cost) return false;
  g.addMoney(-def.cost); h.owned = true; h.name = L(def); ensureLayout(h); assignSpareManager(g, idx);
  g.maxStat('hallsOwned', g.s.halls.filter((x) => x.owned).length); g.emit('halls'); return true;
}
export function switchHall(g: Game, idx: number) { if (!g.s.halls[idx].owned) return; g.s.activeHall = idx; ensureLayout(g.s.halls[idx]); g.emit('switchHall', idx); }

// ---- Research ----
export function researchAvailable(g: Game, id: string) { const r = HALLS.research.find((x: any) => x.id === id); return r && !g.s.research.done.includes(id) && r.requires.every((q: string) => g.s.research.done.includes(q)); }
export function startResearch(g: Game, id: string) {
  const r = HALLS.research.find((x: any) => x.id === id);
  if (!r || g.s.research.active || !researchAvailable(g, id) || g.s.money < r.cost) return false;
  g.addMoney(-r.cost); g.s.research.active = id; g.s.research.until = g.s.day + r.days; g.emit('research'); return true;
}
export function dailyResearch(g: Game) {
  const R = g.s.research; if (R.active && g.s.day >= R.until) {
    R.done.push(R.active); const r = HALLS.research.find((x: any) => x.id === R.active); R.active = null;
    g.message(['Research team', 'فريق البحث'], ['Finished: ' + r.en, 'اكتمل: ' + r.ar], 'research'); g.emit('research');
  }
}

// ---- Build mode ----
export interface BuildOp { kind: 'add' | 'move' | 'remove'; before?: PlacedItem; after?: PlacedItem; }
export function placeItem(g: Game, hallIdx: number, id: string, x: number, z: number, rot: number): PlacedItem | null {
  const h = g.s.halls[hallIdx]; const def = ITEM_BY_ID[id]; if (!def || g.s.money < def.cost) return null;
  const it: PlacedItem = { uid: h.nextUid, id, x, z, rot }; if (!canPlace(h, it)) return null;
  h.nextUid++; h.layout.push(it); g.addMoney(-def.cost); g.emit('layout'); return it;
}
export function moveItem(g: Game, hallIdx: number, uid: number, x: number, z: number, rot: number) {
  const h = g.s.halls[hallIdx]; const it = h.layout.find((i) => i.uid === uid); if (!it) return false;
  const n = { ...it, x, z, rot }; if (!canPlace(h, n, uid)) return false;
  Object.assign(it, n); g.emit('layout'); return true;
}
export function removeItem(g: Game, hallIdx: number, uid: number, refund = 0.5) {
  const h = g.s.halls[hallIdx]; const it = h.layout.find((i) => i.uid === uid); if (!it) return null;
  h.layout = h.layout.filter((i) => i.uid !== uid); g.addMoney(Math.round(ITEM_BY_ID[it.id].cost * refund)); g.emit('layout'); return it;
}
export function restoreItem(g: Game, hallIdx: number, it: PlacedItem, refund = 0.5) {
  const h = g.s.halls[hallIdx]; if (!canPlace(h, it)) return false; h.layout.push({ ...it }); g.addMoney(-Math.round(ITEM_BY_ID[it.id].cost * refund)); g.emit('layout'); return true;
}
export function saveLayout(g: Game, hallIdx: number, theme: string) { const h = g.s.halls[hallIdx]; h.savedLayouts[theme] = h.layout.map((i) => ({ ...i })); g.emit('layout'); }
export function loadLayout(g: Game, hallIdx: number, theme: string) {
  const h = g.s.halls[hallIdx]; const l = h.savedLayouts[theme]; if (!l) return false;
  h.layout = l.map((i) => ({ ...i })); ensureLayout(h); g.emit('layout'); return true;
}
export function resetLayout(g: Game, hallIdx: number) { const h = g.s.halls[hallIdx]; h.layout = autoLayout(h); h.nextUid = h.layout.length + 1; g.emit('layout'); }

/** Daily running costs grow with upgrades, size and businesses. */
export function dailyUpkeep(g: Game) {
  const U = CFG.upkeep; let total = 0;
  g.s.halls.forEach((h) => {
    if (!h.owned) return;
    const lv = Object.values(h.upgrades).reduce((a, b) => a + (b - 1), 0);
    const plots = Object.values(h.plots).reduce((a, b) => a + b, 0);
    total += U.baseDaily + U.perUpgradeLevel * lv + U.perSizeLevel * h.size + U.perPlotLevel * plots;
  });
  total = Math.round(total * g.research('upkeepMult') * g.diff.costMult);
  g.addMoney(-total); return total;
}
