// Late-game stress run: 200 days with money injected so every system (6 halls, plots, research, loans) gets exercised.
import { newBotGame, botDay } from './bot';
import { runCheat } from '../src/core/cheats';
const g = newBotGame('normal', 31337);
let crash = null as any;
try {
  for (let d = 0; d < 200; d++) {
    if (d === 20) runCheat(g, 'ROSE-RICH'); if (d === 60) runCheat(g, 'ROSE-RICH'); if (d === 90) { runCheat(g, 'ROSE-RICH'); runCheat(g, 'ROSE-FANS'); }
    botDay(g);
    const bad = JSON.stringify(g.s).includes('null,') && false; void bad;
  }
} catch (e) { crash = e; }
const owned = g.s.halls.filter((h) => h.owned).length;
console.log(`day ${g.s.day} chapter ${g.s.chapter} halls ${owned} weddings ${g.s.history.length} staff ${g.s.staff.length} research ${g.s.research.done.length} plots ${g.s.halls.reduce((a, h) => a + Object.keys(h.plots).length, 0)} money ${g.s.money}`);
console.log('per-hall weddings:', g.s.halls.map((h) => (h.owned ? h.weddings : '-')).join(' '));
if (crash) { console.error(crash); throw crash; }
