// The Game object: owns the saved state, random numbers, and an event bus the UI listens to.
import type { GameState, Look, Difficulty, HallState, Bi, Message } from './types';
import { Rng } from './rng';
import { CFG, HALLS, PROG, PLOT_BY_ID } from './data';
import { SAVE_VERSION } from './save';

type Handler = (p?: any) => void;

export class Game {
  rng: Rng;
  private handlers = new Map<string, Handler[]>();
  constructor(public s: GameState) { this.rng = new Rng(s.seed); }

  on(name: string, fn: Handler) { const a = this.handlers.get(name) ?? []; a.push(fn); this.handlers.set(name, a); return () => this.off(name, fn); }
  off(name: string, fn: Handler) { const a = this.handlers.get(name); if (a) this.handlers.set(name, a.filter((f) => f !== fn)); }
  emit(name: string, p?: any) { this.handlers.get(name)?.forEach((f) => f(p)); this.handlers.get('*')?.forEach((f) => f({ name, p })); }

  sync() { this.s.seed = this.rng.seed; }
  get diff() { return CFG.difficulties[this.s.difficulty]; }
  get hall(): HallState { return this.s.halls[this.s.activeHall]; }
  uid(p: string) { this.s.idCounter++; return p + this.s.idCounter.toString(36); }

  /** Money in or out. Positive income counts toward "money earned" stats when earned=true. */
  addMoney(n: number, earned = false) {
    if (!isFinite(n)) return;
    if (earned && n > 0 && this.s.legacy) n *= 1 + 0.1 * this.s.legacy;
    this.s.money = Math.round(this.s.money + n);
    if (earned && n > 0) { this.stat('moneyEarned', n); this.weekStat('earn', n); }
    this.emit('money', n);
  }
  addRep(d: number) {
    if (!isFinite(d)) return;
    if (d > 0) d *= this.diff.repGainMult * Math.max(0.15, 1 - this.s.reputation / 115);
    this.s.reputation = Math.max(0, Math.min(100, this.s.reputation + d));
    this.emit('rep', d);
  }
  addFollowers(n: number) {
    n = Math.round(n * this.mod('followerMult') * this.research('followerMult') * this.plotEffect('followerMult'));
    this.s.followers = Math.max(0, this.s.followers + n);
    this.s.stats.followers = Math.max(this.s.stats.followers ?? 0, this.s.followers);
    this.emit('followers', n);
  }
  stat(k: string, n = 1) { this.s.stats[k] = (this.s.stats[k] ?? 0) + n; this.s.chapterStats[k] = (this.s.chapterStats[k] ?? 0) + n; }
  weekStat(k: string, n = 1) { this.s.weekStats[k] = (this.s.weekStats[k] ?? 0) + n; }
  maxStat(k: string, n: number) { this.s.stats[k] = Math.max(this.s.stats[k] ?? 0, n); this.s.chapterStats[k] = Math.max(this.s.chapterStats[k] ?? 0, n); }

  /** Product of active temporary modifiers (from news events etc). */
  mod(key: string) { let v = 1; for (const m of this.s.mods) if (m.key === key && m.until >= this.s.day) v *= m.value; return v; }
  research(key: string) {
    let v = key.endsWith('Add') ? 0 : 1;
    for (const id of this.s.research.done) {
      const r = HALLS.research.find((x: any) => x.id === id); const e = r?.effect?.[key];
      if (e != null) v = key.endsWith('Add') ? v + e : v * e;
    }
    return v;
  }
  plotEffect(key: string, hallIdx = -1) {
    let v = 1;
    const halls = hallIdx >= 0 ? [this.s.halls[hallIdx]] : this.s.halls.filter((h) => h.owned);
    for (const h of halls) for (const id in h.plots) { const e = PLOT_BY_ID[id]?.effect?.[key]; if (e != null && h.plots[id] > 0) v *= e; }
    return v;
  }
  hasPlot(hallIdx: number, id: string) { return (this.s.halls[hallIdx]?.plots[id] ?? 0) > 0; }

  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info') { this.emit('toast', { text, kind }); }
  message(from: Bi, text: Bi, kind = 'info', choices?: Message['choices'], ref?: string) {
    const m: Message = { id: this.uid('m'), day: this.s.day, from, text, read: false, kind, choices, ref };
    this.s.messages.unshift(m);
    if (this.s.messages.length > 120) this.s.messages.length = 120;
    this.emit('message', m);
    return m;
  }
  unlocked(k: string) { return this.s.tutorial.done || this.s.unlocked.includes(k); }
  unlock(k: string) { if (!this.s.unlocked.includes(k)) { this.s.unlocked.push(k); this.emit('unlock', k); } }

  /** Average happiness of the last 10 weddings in a hall (or all halls). Used as your rating. */
  rating(hallIdx = -1) {
    const recs = this.s.history.filter((r) => hallIdx < 0 || r.hall === hallIdx).slice(-10);
    if (!recs.length) return Math.min(70, 40 + this.s.reputation * 0.5);
    return recs.reduce((a, r) => a + r.happiness, 0) / recs.length;
  }
  stars() { return Math.round((this.s.reputation / 20) * 2) / 2; }
  date(day = this.s.day) {
    const dpm = CFG.time.daysPerMonth; const total = day + (CFG.time.startMonth - 1) * dpm;
    return { month: (Math.floor(total / dpm) % 12) + 1, dom: (total % dpm) + 1, year: 1 + Math.floor(total / (dpm * 12)), week: Math.floor(day / 7) };
  }
}

export const SKIN = ['#f9d7c1', '#f1c2a2', '#dca37e', '#c68a62', '#9a6643', '#6e4429'];
export const HAIR_COLORS = ['#2a1b12', '#4a2c1a', '#6b3f22', '#a0672f', '#d8b26e', '#8a8a8a', '#111111', '#b4442a'];
export const ACCENTS = ['#1f2f6b', '#1b1b1f', '#f4efe4', '#d81b7a', '#6a2cb5'];

export function defaultOwner(gender: 'm' | 'f' = 'm'): Look {
  return gender === 'm' ? { gender, skin: 1, hair: 0, hairColor: 1, outfit: 0, color: 0, acc: ['watch'], beard: 1 } : { gender, skin: 1, hair: 0, hairColor: 2, outfit: 2, color: 2, acc: ['earrings', 'watch'] };
}

export function newHall(idx: number): HallState {
  const h = HALLS.halls[idx];
  return { id: h.id, owned: idx === 0, name: h.en, size: 0, upgrades: Object.fromEntries(HALLS.upgrades.map((u: any) => [u.id, 1])),
    layout: [], savedLayouts: {}, managerId: null, plots: {}, cosmetics: {}, ratingHistory: [], weddings: 0, smallBookings: [], nextUid: 1 };
}

export function newGameState(slot: number, difficulty: Difficulty, owner: Look, ownerName: string, seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0): GameState {
  const d = CFG.difficulties[difficulty];
  return {
    version: SAVE_VERSION, slot, created: Date.now(), savedAt: Date.now(), seed,
    difficulty, ownerName, owner,
    day: 0, money: d.startMoney, reputation: CFG.start.reputation, followers: CFG.start.followers, rosaDebt: CFG.start.rosaDebt,
    halls: HALLS.halls.map((_: any, i: number) => newHall(i)), activeHall: 0,
    staff: [], candidates: [], candidatesDay: -99,
    requests: [], bookings: [], history: [],
    loans: [], campaigns: [], mods: [], shopOwned: [],
    messages: [], posts: [], photos: [], pendingCalls: [],
    chapter: 1, chapterStartDay: 0, chapterStats: {}, chapterStars: [], chapterDone: false,
    weekly: { week: -1, goals: [] }, achievements: { claimed: [] },
    research: { done: [], active: null, until: 0 }, victor: { rating: CFG.start.victorRating, offerMade: false, flowersSent: false },
    sabotageSurvived: 0, sabotageScheduled: [],
    stats: { followers: CFG.start.followers }, weekStats: {},
    dailyGift: { lastDate: '', streak: 0, spunDate: '' },
    tutorial: { step: 0, done: false }, unlocked: ['bookings'],
    pendingNews: null, lastNewsDay: 0, newsSeen: [],
    returningPool: [],
    settings: { quality: 'high', shadows: true, glow: true, particles: true, cameraSpeed: 1, invertRotation: false, autoCamera: true, weddingLength: 'normal', music: 0.6, sound: 0.8, bubbles: true, floatingMoney: true, haptics: true },
    idCounter: 0, lastReport: null, removeAds: false,
  };
}
export { PROG };
