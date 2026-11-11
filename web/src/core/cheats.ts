// ===================================================================================
//  DEVELOPER CHEATS — REMOVE BEFORE RELEASE.
//  Set CHEATS_ENABLED = false (or delete this file's use in Settings) for the store build.
// ===================================================================================
import type { Game } from './game';
import { HALLS } from './data';
import { genCandidate, hire } from '../staff/staff';
import { ensureLayout, autoLayout } from '../world/layout';

export const CHEATS_ENABLED = false; // switched off for release builds; tests pass force=true

export function runCheat(g: Game, code: string, force = false): boolean {
  if (!CHEATS_ENABLED && !force) return false;
  const s = g.s;
  switch (code.trim().toUpperCase()) {
    case 'ROSE-MONEY': g.addMoney(1_000_000); break;
    case 'ROSE-RICH': g.addMoney(10_000_000); break;
    case 'ROSE-REP': s.reputation = 100; g.emit('rep', 0); break;
    case 'ROSE-STAFF': for (const role of ['waiter', 'waiter', 'cook', 'cleaner', 'security', 'bartender', 'decorator', 'sound_tech', 'valet', 'host', 'manager']) { const c = genCandidate(g, role); c.skill = 5; hire(g, c); } break;
    case 'ROSE-MAX':
      for (const h of s.halls) { if (!h.owned) continue; for (const k in h.upgrades) h.upgrades[k] = HALLS.upgradeMaxLevel; h.size = HALLS.sizes.length - 1; h.layout = autoLayout(h); ensureLayout(h); }
      s.reputation = 100; g.addMoney(5_000_000); break;
    case 'ROSE-DEBT': s.rosaDebt = 0; s.loans = []; break;
    case 'ROSE-DAYS': s.day += 30; s.bookings = s.bookings.filter((b) => b.date > s.day); break;
    case 'ROSE-FANS': g.addFollowers(50_000); break;
    default: return false;
  }
  g.emit('cheat', code); g.emit('money', 0); return true;
}
