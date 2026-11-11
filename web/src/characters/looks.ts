// Pure look generation (no 3D). Used by the simulation to give every person a stable look.
import type { Look } from '../core/types';
import type { Rng } from '../core/rng';

export const GUEST_COLORS = ['#c0392b', '#2e86de', '#16a085', '#8e44ad', '#f39c12', '#d35400', '#1abc9c', '#e84393', '#6c5ce7', '#00b894', '#fdcb6e', '#2d3436', '#636e72', '#b33939', '#218c74', '#ff7675', '#74b9ff', '#a29bfe', '#fab1a0', '#55efc4', '#ffeaa7', '#273c75', '#c23616', '#e1b12c'];
export const SUIT_COLORS = ['#1f2f6b', '#1b1b1f', '#4a4f5a', '#2f3e46', '#5b3a29', '#6b6f7d', '#243b55', '#3d2b56', '#7a1f2b', '#e9e2d0'];

export function randomLook(rng: Rng, opts: { gender?: 'm' | 'f'; body?: Look['body']; uniform?: string } = {}): Look {
  const gender = opts.gender ?? (rng.chance(0.5) ? 'm' : 'f');
  const body = opts.body ?? (rng.chance(0.1) ? 'child' : rng.chance(0.12) ? 'elderly' : 'adult');
  const look: Look = {
    gender, body, skin: rng.int(0, 5), hair: rng.int(0, 5), hairColor: body === 'elderly' ? 5 : rng.int(0, 7),
    outfit: gender === 'm' ? rng.int(0, 5) : 6 + rng.int(0, 3), color: rng.int(0, 4), acc: [],
    beard: gender === 'm' && body === 'adult' ? (rng.chance(0.55) ? rng.int(1, 3) : 0) : 0,
    c: gender === 'f' ? rng.pick(GUEST_COLORS) : rng.pick(SUIT_COLORS), c2: rng.pick(GUEST_COLORS),
    height: body === 'adult' ? rng.range(0.94, 1.06) : 1,
  };
  if (body === 'elderly' && gender === 'm' && rng.chance(0.4)) look.hair = 6;
  if (rng.chance(0.15)) look.acc.push('glasses');
  if (gender === 'f' && rng.chance(0.5)) look.acc.push('earrings');
  if (gender === 'f' && rng.chance(0.3)) look.acc.push('necklace');
  if (opts.uniform) { look.uniform = opts.uniform; look.body = 'adult'; }
  return look;
}
