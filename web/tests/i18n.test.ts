// Localization check: every UI key used in code exists in English and Arabic, and every data entry has Arabic text.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../src/data/i18n/en.json';
import ar from '../src/data/i18n/ar.json';
import { CFG, STAFF, BIZ, HALLS, PROG, DEMANDS, PROBLEMS, NEWS, SABOTAGE, CONTENT } from '../src/core/data';

const EN = en as Record<string, string>, AR = ar as Record<string, string>;
let fails = 0; const fail = (m: string) => { fails++; console.error('FAIL:', m); };
function files(dir: string): string[] { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; }); }
const keys = new Set<string>();
for (const f of files('src')) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'\s*[,)]/g)) keys.add(m[1]);
// Keys built from data ids
const fam = (prefix: string, ids: (string | number)[], suffix = '') => ids.forEach((i) => keys.add(prefix + i + suffix));
fam('role.', STAFF.roles.map((r: any) => r.id)); fam('month.', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); fam('phase.', CFG.night.phases.map((p: any) => p[0]));
fam('moment.', ['speeches', 'cake', 'first_dance', 'bouquet', 'sparkler']); fam('plan.', ['theme', 'flower', 'light', 'music', 'venue', 'service']);
fam('diff.', Object.keys(CFG.difficulties), '.desc'); fam('acc.', ['sunglasses', 'glasses', 'earrings', 'watch', 'necklace']);
fam('goal.', [...new Set(PROG.chapters.flatMap((c: any) => [...c.goals, ...c.bonus].map((g: any) => g.type)))] as string[]);
fam('quality.', ['smooth', 'high', 'ultra']); fam('length.', ['short', 'normal', 'long']); fam('shop.cat.', [...new Set(BIZ.shop.map((s: any) => s.cat))] as string[]);
fam('atmo.', HALLS.halls.map((h: any) => h.atmosphere)); fam('plots.desc.', BIZ.plots.map((p: any) => p.id)); fam('research.desc.', HALLS.research.map((r: any) => r.id));
fam('wish.flower.', Object.keys(CFG.flowers)); fam('wish.light.', Object.keys(CFG.lighting)); fam('wish.music.', Object.keys(CFG.music)); fam('wish.venue.', Object.keys(CFG.venues).filter((v) => v !== 'main'));
fam('call.', ['client', 'journalist', 'supplier', 'victor']); fam('call.result.', ['client', 'journalist', 'supplier', 'victor']); fam('loan.cat.', BIZ.loans.map((l: any) => l.id));
fam('tut.', ['welcome', 'meet', 'plan', 'nextDay', 'bigDay', 'problems', 'moments', 'report', 'office', 'goals']);
for (const k of keys) { if (!(k in EN)) fail('missing English key ' + k); if (!(k in AR)) fail('missing Arabic key ' + k); }
for (const k in EN) if (!(k in AR)) fail('Arabic table lacks ' + k);
// No English words left in Arabic UI strings (placeholders like {n} are fine).
for (const [k, v] of Object.entries(AR)) if (/[A-Za-z]/.test(v.replace(/\{[a-z]+\}/g, ''))) fail(`Arabic string ${k} contains Latin letters: ${v}`);
// Data entries carry Arabic text.
const hasAr = (o: any, what: string) => { if (!o?.ar || /[A-Za-z]/.test((Array.isArray(o.ar) ? o.ar.join('') : o.ar).replace(/\{[a-z]+\}/g, ''))) fail('data without proper Arabic: ' + what); };
for (const d of DEMANDS) hasAr(d, 'demand ' + d.id); for (const p of PROBLEMS) hasAr(p, 'problem ' + p.id);
for (const n of [...NEWS, ...SABOTAGE]) { hasAr(n, 'news ' + n.id); n.choices.forEach((c, i) => hasAr(c, 'news ' + n.id + ' choice ' + i)); }
for (const grp of [CFG.difficulties, CFG.menus, CFG.music, CFG.themes, CFG.flowers, CFG.lighting, CFG.venues, CFG.personalities]) for (const k in grp) hasAr(grp[k], k);
for (const x of [...STAFF.roles, ...HALLS.upgrades, ...HALLS.research, ...HALLS.items, ...HALLS.halls, ...BIZ.plots, ...BIZ.loans, ...BIZ.marketing, ...BIZ.shop, ...BIZ.smallHallTypes, ...PROG.chapters, ...PROG.weeklyTemplates, ...PROG.achievementGroups, ...PROG.seasonal]) hasAr(x, x.id ?? x.stat ?? x.type);
for (const k of ['maleNames', 'femaleNames', 'loveStories', 'victorTaunts', 'vowlyComments']) for (const pair of CONTENT[k]) if (!pair[1] || /[A-Za-z]/.test(pair[1])) fail(`content ${k}: ${pair[0]}`);
// Counts the prompt asks for.
if (DEMANDS.length < 80) fail('fewer than 80 demands'); if (PROBLEMS.length < 30) fail('fewer than 30 problems'); if (NEWS.length < 40) fail('fewer than 40 news events');
const ach = PROG.achievementGroups.reduce((a: number, g: any) => a + g.tiers.length, 0); if (ach < 60) fail('fewer than 60 achievements');
console.log(`${keys.size} keys checked, ${DEMANDS.length} demands, ${PROBLEMS.length} problems, ${NEWS.length} news events, ${ach} achievements.`);
if (fails) throw new Error(fails + ' localization failures'); else console.log('All localization tests passed.');
