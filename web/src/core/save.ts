// Three save slots stored on the device (localStorage, which Android WebView keeps in app storage).
import type { GameState } from './types';
const KEY = (slot: number) => `whot_save_${slot}`;
export const SAVE_VERSION = 1;

export interface SlotInfo { slot: number; exists: boolean; day?: number; money?: number; hallName?: string; difficulty?: string; chapter?: number; savedAt?: number; }

export function listSlots(): SlotInfo[] {
  return [0, 1, 2].map((slot) => {
    const s = load(slot);
    if (!s) return { slot, exists: false };
    return { slot, exists: true, day: s.day, money: s.money, hallName: s.halls[0]?.name, difficulty: s.difficulty, chapter: s.chapter, savedAt: s.savedAt };
  });
}
export function save(state: GameState) {
  state.savedAt = Date.now();
  try { localStorage.setItem(KEY(state.slot), JSON.stringify(state)); return true; }
  catch (e) {
    // Storage full: drop the oldest photos and retry once.
    state.photos = state.photos.slice(-10);
    state.posts.forEach((p) => { if (!state.photos.find((ph) => ph.data === p.photo)) p.photo = undefined; });
    try { localStorage.setItem(KEY(state.slot), JSON.stringify(state)); return true; } catch { return false; }
  }
}
export function load(slot: number): GameState | null {
  try { const raw = localStorage.getItem(KEY(slot)); if (!raw) return null; const s = JSON.parse(raw); return migrate(s); } catch { return null; }
}
export function remove(slot: number) { try { localStorage.removeItem(KEY(slot)); } catch {} }
function migrate(s: any): GameState { if (!s.version) s.version = SAVE_VERSION; return s as GameState; }
