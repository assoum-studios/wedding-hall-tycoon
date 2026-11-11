// Deterministic random numbers. The seed lives in the save, so reloading reproduces the same future.
export class Rng {
  constructor(public seed: number) {}
  next(): number {
    let t = (this.seed = (this.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return Math.floor(this.range(a, b + 1)); }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p: number) { return this.next() < p; }
  shuffle<T>(arr: T[]): T[] { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  weighted<T extends { weight: number }>(arr: T[]): T { const tot = arr.reduce((s, x) => s + x.weight, 0); let r = this.next() * tot; for (const x of arr) { r -= x.weight; if (r <= 0) return x; } return arr[arr.length - 1]; }
}
// Non-deterministic randomness for visuals only (never affects the simulation).
export const vrand = Math.random;
