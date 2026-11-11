// Hall floor layout on a 1-metre grid: placement rules, capacity and layout quality. Pure logic, no 3D.
import type { HallState, PlacedItem } from '../core/types';
import { HALLS, ITEM_BY_ID, CFG } from '../core/data';

export function hallDims(size: number) { const s = HALLS.sizes[Math.min(size, HALLS.sizes.length - 1)]; return { w: s.w as number, d: s.d as number, cap: s.capacity as number }; }
export function footprint(it: PlacedItem) { const def = ITEM_BY_ID[it.id]; const rot = ((it.rot % 4) + 4) % 4; return rot % 2 === 0 ? { w: def.w, d: def.d } : { w: def.d, d: def.w }; }

/** Cells that must stay free: the entrance aisle at the front, and the kitchen door at the back-left. */
export function reserved(w: number, d: number) {
  const cells = new Set<string>();
  const cx = Math.floor(w / 2);
  for (let z = d - 3; z < d; z++) for (let x = cx - 2; x < cx + 2; x++) cells.add(x + ',' + z);
  for (let z = 0; z < 2; z++) for (let x = 0; x < 2; x++) cells.add(x + ',' + z);
  for (let z = d - 2; z < d; z++) for (let x = w - 3; x < w; x++) cells.add(x + ',' + z); // gift table by the entrance
  return cells;
}

export function occupancy(layout: PlacedItem[], skipUid = -1) {
  const occ = new Map<string, number>();
  for (const it of layout) {
    if (it.uid === skipUid) continue;
    const f = footprint(it);
    for (let x = it.x; x < it.x + f.w; x++) for (let z = it.z; z < it.z + f.d; z++) occ.set(x + ',' + z, it.uid);
  }
  return occ;
}

export function canPlace(hall: HallState, it: PlacedItem, skipUid = -1) {
  const { w, d } = hallDims(hall.size);
  const f = footprint(it);
  if (it.x < 0 || it.z < 0 || it.x + f.w > w || it.z + f.d > d) return false;
  const occ = occupancy(hall.layout, skipUid); const res = reserved(w, d);
  for (let x = it.x; x < it.x + f.w; x++) for (let z = it.z; z < it.z + f.d; z++) { const k = x + ',' + z; if (occ.has(k) || res.has(k)) return false; }
  return true;
}

export function seats(layout: PlacedItem[]) { return layout.reduce((s, it) => s + (ITEM_BY_ID[it.id]?.seats ?? 0), 0); }
export function capacity(hall: HallState) { return Math.min(hallDims(hall.size).cap, seats(hall.layout)); }
export function has(layout: PlacedItem[], kind: string) { return layout.some((it) => ITEM_BY_ID[it.id]?.kind === kind); }

/** 0..layoutMax: rewards a stage, dance floor, bar, buffet, decor, and short walks from the kitchen. */
export function layoutScore(hall: HallState, guests: number) {
  const L = hall.layout; let s = 0;
  if (has(L, 'stage')) s += 1; if (has(L, 'dance')) s += 1.5; if (has(L, 'head')) s += 0.5; if (has(L, 'cake')) s += 0.3; if (has(L, 'dj')) s += 0.3;
  const decor = L.reduce((a, it) => a + (ITEM_BY_ID[it.id]?.decor ?? 0), 0); s += Math.min(1.5, decor * 0.12);
  const { w, d } = hallDims(hall.size);
  const tables = L.filter((it) => ITEM_BY_ID[it.id]?.kind === 'table');
  if (tables.length) {
    const avg = tables.reduce((a, it) => a + Math.hypot(it.x, it.z), 0) / tables.length; // kitchen door is at 0,0
    s += Math.max(0, 1 - avg / (w + d)) * 1.0;
  }
  const seatsN = seats(L); if (seatsN < guests) s -= Math.min(3, (guests - seatsN) / 20);
  const used = L.reduce((a, it) => { const f = footprint(it); return a + f.w * f.d; }, 0);
  if (used / (w * d) > 0.85) s -= 1; // too crowded, guests and staff bump into things
  return Math.max(-3, Math.min(CFG.happiness.layoutMax, s));
}
/** Extra walking makes service slower: >1 means staff are slower. */
export function walkFactor(hall: HallState) {
  const { w, d } = hallDims(hall.size);
  const tables = hall.layout.filter((it) => ITEM_BY_ID[it.id]?.kind === 'table');
  if (!tables.length) return 1;
  const avg = tables.reduce((a, it) => a + Math.hypot(it.x, it.z), 0) / tables.length;
  return 0.85 + avg / (w + d);
}

/** Builds a sensible default layout for the hall size: stage, dance floor, bar, buffet, then tables. */
export function autoLayout(hall: HallState, fill = 0.8): PlacedItem[] {
  const { w, d } = hallDims(hall.size); const cap = Math.round(hallDims(hall.size).cap * fill);
  const tmp: HallState = { ...hall, layout: [] };
  let uid = 1;
  const put = (id: string, x: number, z: number, rot = 0) => { const it = { uid: uid++, id, x, z, rot }; if (canPlace(tmp, it)) { tmp.layout.push(it); return true; } return false; };
  const cx = Math.floor(w / 2);
  put('stage', cx - 3, 0); put('dance_floor', cx - 3, 4); put('sweetheart', cx - 1, 10 < d - 4 ? 10 : 3) || put('sweetheart', cx + 4, 1);
  put('dj', cx + 4, 0); put('cake', cx - 6, 0);
  put('bar', w - 4, 3, 0) || put('bar', w - 3, 3, 1);
  put('buffet', 0, 3, 1) || put('buffet', 2, 3);
  put('flower_arch', cx - 1, d - 4);
  put('plant', 0, d - 1); put('plant', w - 1, d - 1); put('plant', w - 1, 0); put('rose_bush', cx - 3, d - 1); put('rose_bush', cx + 2, d - 1);
  // Tables, nearest to the stage first, until we have the capacity.
  const spots: { x: number; z: number; dist: number }[] = [];
  for (let z = 1; z + 3 <= d; z += 3) for (let x = 0; x + 3 <= w; x += 3) spots.push({ x, z, dist: Math.hypot(x + 1.5 - cx, z - 4) });
  spots.sort((a, b) => a.dist - b.dist);
  for (const sp of spots) { if (seats(tmp.layout) >= cap) break; put('round_table', sp.x, sp.z); }
  for (let z = 0; z + 4 <= d && seats(tmp.layout) < cap; z += 2) for (let x = 0; x + 2 <= w && seats(tmp.layout) < cap; x += 2) put('long_table', x, z);
  return tmp.layout;
}
export function ensureLayout(hall: HallState) {
  const { w } = hallDims(hall.size); const hx = hall as any;
  // Saves from before the roomier hall sizes get a fresh layout once; later layouts are always kept.
  if (!hall.layout.length || (hx.lw !== undefined && hx.lw !== w && !hx.expanding) || hx.lw === undefined) { if (hx.lw !== w || !hall.layout.length) { hall.layout = autoLayout(hall); hall.nextUid = hall.layout.length + 1; } }
  hx.lw = w; delete hx.expanding;
  // Drop anything that no longer fits (e.g. after loading an older save).
  const keep: PlacedItem[] = []; const tmp: HallState = { ...hall, layout: keep };
  for (const it of hall.layout) if (canPlace(tmp, it)) keep.push(it);
  hall.layout = keep; hall.nextUid = Math.max(hall.nextUid, ...keep.map((k) => k.uid + 1), 1);
}
