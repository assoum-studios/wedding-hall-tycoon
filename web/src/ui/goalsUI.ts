// Goals: story chapters with 3-star bonus goals, weekly goals, achievements (claimable ones jump to the top),
// events, daily gift wheel with login streak, and leaderboards.
import type { App } from './app';
import { t, L, money, num } from '../core/i18n';
import { PROG } from '../core/data';
import { chapterDef, goalProgress, goalText, chapterReady, completeChapter, weeklyProgress, weeklyReady, claimWeekly, weeklyText, ACHIEVEMENTS, achReady, achValue, claimAch } from '../progress/goals';
import { canSpin, spin, currentSeason, leaderboards } from '../progress/events';
import { h, div, btn, modal, tabs, toast, bar, confetti } from './dom';
import { sfx } from '../audio/audio';
import { VICTOR, NADIA } from '../characters/cast';

export function openGoals(app: App, tab = 'chapter') {
  const g = app.g; let cur = tab;
  const m = modal(t('goals.title'), [], { cls: 'wide' });
  const render = () => {
    const wk = g.s.weekly.goals.filter((w) => weeklyReady(g, w)).length; const ach = ACHIEVEMENTS.filter((a) => achReady(g, a)).length;
    m.panel.querySelector('.tabs')?.remove();
    m.panel.insertBefore(tabs([{ id: 'chapter', label: t('goals.story'), badge: chapterReady(g) ? 1 : 0 }, { id: 'weekly', label: t('goals.weekly'), badge: wk }, { id: 'ach', label: t('goals.achievements'), badge: ach }, { id: 'events', label: t('goals.events'), badge: canSpin(g) ? 1 : 0 }, { id: 'board', label: t('goals.leaderboards') }], cur, (id) => { cur = id; render(); }), m.body);
    m.setBody(cur === 'chapter' ? chapterView(app, render) : cur === 'weekly' ? weeklyView(app, render) : cur === 'ach' ? achView(app, render) : cur === 'events' ? eventsView(app, render) : boardView(app));
  };
  const oc = m.close; m.close = () => { oc(); app.refresh(); };
  render(); app.tutorial?.event('goals');
}

function chapterView(app: App, rerender: () => void) {
  const g = app.g; const c = chapterDef(g.s.chapter); const out: Node[] = [];
  if (g.s.chapterDone) out.push(h('div', { class: 'card hl' }, h('div', { class: 'title' }, t('goals.allDone')), h('div', { class: 'quote' }, t('goals.victorFlowers'))));
  else if (c) {
    const ready = chapterReady(g);
    out.push(h('div', { class: 'card' + (ready ? ' hl' : '') },
      h('div', { class: 'row' }, h('span', { class: 'chip-head' }, t('goals.chapterN', { n: c.id })), h('div', { class: 'title grow' }, L(c)), h('span', { class: 'pill green' }, money(c.reward))),
      ...c.goals.map((gl: any) => { const [cur, n] = goalProgress(g, gl); return h('div', { style: { margin: '8px 0' } }, h('div', { class: 'row' }, h('span', { class: 'grow', style: { fontWeight: '800' } }, (cur >= n ? '✅ ' : '⬜ ') + goalText(gl)), h('span', { class: 'sub' }, num(Math.min(cur, n)) + ' / ' + num(n))), bar(Math.min(1, cur / n))); }),
      h('div', { class: 'title', style: { marginTop: '8px' } }, t('goals.bonus')),
      ...c.bonus.map((gl: any) => { const [cur, n] = goalProgress(g, gl); return h('div', { class: 'sub' }, (cur >= n ? '⭐ ' : '☆ ') + goalText(gl)); }),
      ready ? btn(t('goals.claimChapter'), () => { const r = completeChapter(g); if (r) { sfx('success'); confetti(); const who = [3, 5, 10, 12].includes(r.def.id) ? VICTOR : NADIA; const mm = modal(t('goals.chapterDone', { n: r.def.id }), [h('div', { class: 'row', style: { justifyContent: 'center' } }, h('div', { class: 'avatar', style: { width: '96px', height: '96px' } }, h('img', { src: app.world.renderThumb(who, { face: true, size: 160 }) }))), h('div', { class: 'big-score' }, '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars)), h('div', { class: 'quote', style: { marginTop: '10px' } }, L(r.ending)), h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn(t('ui.continue'), () => mm.close(), 'green'))], { cls: 'narrow' }); } rerender(); }, 'green big', { style: { marginTop: '10px', width: '100%' }, id: 'btn-claim-chapter' }) : null));
  }
  out.push(h('div', { class: 'title', style: { margin: '10px 0 6px' } }, t('goals.chapters')));
  out.push(div('grid3', ...PROG.chapters.map((ch: any) => h('div', { class: 'card' + (ch.id === g.s.chapter ? ' hl' : '') }, h('div', { class: 'sub' }, t('goals.chapterN', { n: ch.id })), h('div', { style: { fontWeight: '900' } }, ch.id <= g.s.chapter || g.s.chapterDone ? L(ch) : '???'), h('div', { class: 'stars' }, g.s.chapterStars[ch.id - 1] ? '★'.repeat(g.s.chapterStars[ch.id - 1]) + '☆'.repeat(3 - g.s.chapterStars[ch.id - 1]) : '')))));
  return out;
}
function weeklyView(app: App, rerender: () => void) {
  const g = app.g; const list = [...g.s.weekly.goals.map((w, i) => ({ w, i }))].sort((a, b) => Number(weeklyReady(g, b.w)) - Number(weeklyReady(g, a.w)));
  return [h('div', { class: 'sub', style: { marginBottom: '8px' } }, t('goals.weeklyHelp')), ...list.map(({ w, i }) => { const p = weeklyProgress(g, w); const ready = weeklyReady(g, w);
    return h('div', { class: 'card' + (ready ? ' hl' : '') }, h('div', { class: 'row' }, h('div', { class: 'grow', style: { fontWeight: '900' } }, weeklyText(w)), h('span', { class: 'pill green' }, money(w.reward))), bar(Math.min(1, p / w.n)),
      w.claimed ? h('span', { class: 'pill green' }, '✓ ' + t('goals.claimed')) : ready ? btn(t('goals.claim'), () => { claimWeekly(g, i); sfx('coin'); confetti(); rerender(); }, 'green small', { style: { marginTop: '6px' } }) : null); })];
}
function achView(app: App, rerender: () => void) {
  const g = app.g;
  const list = [...ACHIEVEMENTS].sort((a, b) => { const ra = achReady(g, a) ? 0 : g.s.achievements.claimed.includes(a.id) ? 2 : 1; const rb = achReady(g, b) ? 0 : g.s.achievements.claimed.includes(b.id) ? 2 : 1; return ra - rb; });
  return [h('div', { class: 'sub', style: { marginBottom: '8px' } }, t('goals.achCount', { a: g.s.achievements.claimed.length, b: ACHIEVEMENTS.length })), div('grid2', ...list.map((a) => { const ready = achReady(g, a); const done = g.s.achievements.claimed.includes(a.id);
    return h('div', { class: 'card' + (ready ? ' hl' : '') }, h('div', { class: 'row' }, h('span', { style: { fontSize: '24px' } }, done ? '🏆' : ready ? '🎁' : '🔒'), h('div', { class: 'grow', style: { fontWeight: '800' } }, L(a.text)), h('span', { class: 'pill green' }, money(a.reward))), done ? null : bar(Math.min(1, achValue(g, a) / a.n), 'gold'),
      ready ? btn(t('goals.claim'), () => { claimAch(g, a.id); sfx('coin'); confetti(); rerender(); }, 'green small', { style: { marginTop: '6px' } }) : null); }))];
}
function eventsView(app: App, rerender: () => void) {
  const g = app.g; const season = currentSeason(g); const wheel = PROG.dailyWheel;
  const colors = ['#ff8fb6', '#f7d97a', '#8fd6ff', '#b9f39b', '#d6b8ff', '#ffc38a', '#a0f0e0'];
  const seg = 360 / wheel.length;
  const wheelEl = h('div', { class: 'wheel', style: { background: `conic-gradient(${wheel.map((_: any, i: number) => `${colors[i % colors.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')})` } },
    ...wheel.map((w: any, i: number) => h('div', { style: { position: 'absolute', left: '50%', top: '50%', transform: `rotate(${i * seg + seg / 2}deg) translate(0,-92px) rotate(${-(i * seg + seg / 2)}deg) translate(-50%,-50%)`, fontWeight: '900', fontSize: '13px', textAlign: 'center', width: '70px' } }, w.kind === 'money' ? money(w.value) : w.kind === 'followers' ? '+' + w.value + ' ♥' : w.kind === 'rep' ? '+' + w.value + ' ★' : '+' + w.value + ' 😊')));
  return [
    h('div', { class: 'card' + (season ? ' hl' : '') }, h('div', { class: 'title' }, season ? L(season) : t('events.none')), h('div', { class: 'sub' }, season ? t('events.active', { r: Math.round((season.requestMult - 1) * 100), b: Math.round((season.budgetMult - 1) * 100) }) : t('events.upcoming'))),
    h('div', { class: 'card', style: { textAlign: 'center' } }, h('div', { class: 'title' }, t('gift.title')), h('div', { class: 'sub' }, t('gift.streakNow', { n: g.s.dailyGift.streak })), h('div', { class: 'wheel-pointer' }), wheelEl,
      canSpin(g) ? btn(t('gift.spin'), () => { const r = spin(g); if (!r) return; const turns = 5 * 360 + (360 - (r.idx * seg + seg / 2)); wheelEl.style.transform = `rotate(${turns}deg)`; sfx('tap'); setTimeout(() => { sfx('success'); confetti(); toast(t('gift.won'), 'good'); rerender(); }, 3300); }, 'green big', { id: 'btn-spin' }) : h('div', { class: 'sub' }, t('gift.comeBack'))),
  ];
}
function boardView(app: App) {
  const g = app.g; const lb = leaderboards(g);
  const table = (title: string, key: 'best' | 'size' | 'followers', fmt: (n: number) => string) => {
    const rows = [...lb.rivals.map((r: any) => ({ name: L(r.name), v: r[key], me: false })), { name: g.hall.name, v: (lb.me as any)[key], me: true }].sort((a, b) => b.v - a.v);
    return h('div', { class: 'card' }, h('div', { class: 'title' }, title), ...rows.map((r, i) => h('div', { class: 'list-line', style: r.me ? { background: '#fff3c4', borderRadius: '8px', padding: '6px' } : {} }, h('span', {}, (i + 1) + '. ' + r.name), h('b', {}, fmt(r.v)))));
  };
  return [h('div', { class: 'sub', style: { marginBottom: '8px' } }, t('board.offline')), div('grid2', table(t('board.best'), 'best', (n) => n + '%'), table(t('board.size'), 'size', (n) => num(n)), table(t('board.followers'), 'followers', (n) => num(n)))];
}
