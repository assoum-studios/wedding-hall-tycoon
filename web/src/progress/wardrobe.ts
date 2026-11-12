// Wardrobe: owner outfits and cars unlocked as chapter rewards, plus the Legacy restart after the last chapter.
import type { Game } from '../core/game';
import type { Look, Bi } from '../core/types';

export interface OutfitDef { id: string; ch: number; name: Bi; c?: string; c2?: string; }
export interface CarDef { id: string; ch: number; name: Bi; color: string; limo?: boolean; }
export const OUTFITS_W: OutfitDef[] = [
  { id: 'own', ch: 1, name: ['Your own style', 'أسلوبك الخاص'] },
  { id: 'midnight', ch: 2, name: ['Midnight blue', 'أزرق منتصف الليل'], c: '#101c40', c2: '#d4af37' },
  { id: 'emerald', ch: 4, name: ['Emerald', 'زمردي'], c: '#0d4d34', c2: '#d4af37' },
  { id: 'ivory', ch: 6, name: ['Ivory & wine', 'عاجي وعنابي'], c: '#f3ead8', c2: '#8a1c2b' },
  { id: 'royal', ch: 8, name: ['Royal purple', 'أرجواني ملكي'], c: '#3b1670', c2: '#f2c94c' },
  { id: 'gold', ch: 10, name: ['Golden gala', 'ذهبي فاخر'], c: '#b8902f', c2: '#141418' },
  { id: 'legend', ch: 12, name: ['Legend black', 'الأسود الأسطوري'], c: '#0c0c10', c2: '#d4af37' },
];
export const CARS: CarDef[] = [
  { id: 'hatch', ch: 1, name: ['City hatchback', 'سيارة صغيرة'], color: '#c0392b' },
  { id: 'sedan', ch: 3, name: ['Business sedan', 'سيدان أعمال'], color: '#2c3e50' },
  { id: 'sports', ch: 5, name: ['Sports coupe', 'سيارة رياضية'], color: '#f1c40f' },
  { id: 'silver', ch: 7, name: ['Silver cruiser', 'الفضية'], color: '#bfc5cc' },
  { id: 'limo', ch: 9, name: ['Black limousine', 'ليموزين سوداء'], color: '#141418', limo: true },
  { id: 'goldlimo', ch: 11, name: ['Golden limousine', 'ليموزين ذهبية'], color: '#d4af37', limo: true },
];
export function unlockedAt(g: Game, ch: number) { return (g.s.legacy ?? 0) > 0 || g.s.chapterDone || g.s.chapter >= ch; }
export function wardrobe(g: Game) { if (!g.s.wardrobe) g.s.wardrobe = { outfit: 'own', car: 'hatch' }; return g.s.wardrobe; }
export function currentCar(g: Game) { return CARS.find((c) => c.id === wardrobe(g).car) ?? CARS[0]; }
/** The owner's look with the equipped wardrobe outfit applied. */
export function ownerLook(g: Game): Look {
  const o = OUTFITS_W.find((x) => x.id === wardrobe(g).outfit); const base = g.s.owner;
  if (!o || !o.c) return base;
  return base.gender === 'm' ? { ...base, outfit: 0, c: o.c, c2: o.c2 } : { ...base, outfit: 6, c: o.c, c2: o.c2 };
}
export const LEGACY_BONUS = 0.1;
