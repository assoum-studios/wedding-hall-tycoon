// Nadia, Rosa's old assistant, guides the first wedding step by step and unlocks menus one at a time.
import type { App } from './app';
import { t } from '../core/i18n';
import { h, btn, uiRoot } from './dom';
import { weddingToday } from '../core/day';

const STEPS = ['welcome', 'meet', 'plan', 'nextDay', 'bigDay', 'problems', 'moments', 'report', 'office', 'goals'];
export class Tutorial {
  el: HTMLElement | null = null; face = '';
  constructor(public app: App) {}
  get step() { return this.app.g.s.tutorial.step; }
  set step(n: number) { this.app.g.s.tutorial.step = n; }
  start() { this.show(); }
  stop() { this.el?.remove(); this.el = null; }
  private target(): string | null {
    switch (STEPS[this.step]) { case 'welcome': return '#btn-bookings'; case 'plan': return '#btn-bookings'; case 'nextDay': case 'bigDay': return '#btn-main'; case 'office': return '#btn-office'; case 'goals': return '#btn-goals'; }
    return null;
  }
  decorate() {
    document.querySelectorAll('.pulse-target').forEach((e) => e.classList.remove('pulse-target'));
    if (this.app.g.s.tutorial.done) return; const sel = this.target(); if (sel) document.querySelector(sel)?.classList.add('pulse-target');
  }
  show() {
    const g = this.app.g; if (g.s.tutorial.done) { this.stop(); return; }
    if (!this.face) { const nadia = g.s.staff.find((e) => e.named === 'nadia'); if (nadia) this.face = this.app.world.renderThumb(nadia.look, { face: true, size: 128 }); }
    let key = STEPS[this.step]; if (key === 'nextDay' && weddingToday(g)) { this.step = STEPS.indexOf('bigDay'); key = 'bigDay'; }
    this.el?.remove();
    this.el = h('div', { class: 'guide' }, h('div', { class: 'face' }, this.face ? h('img', { src: this.face }) : '👩'),
      h('div', { class: 'say' }, h('div', { class: 'who' }, t('tut.nadia')), h('div', {}, t('tut.' + key)), h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '6px' } }, btn(t('tut.skip'), () => this.finish(), 'ghost small'))));
    uiRoot().append(this.el); this.decorate();
  }
  event(e: string) {
    const g = this.app.g; if (g.s.tutorial.done) return; const key = STEPS[this.step];
    const go = (k: string) => { this.step = STEPS.indexOf(k); this.show(); };
    if (key === 'welcome' && e === 'meeting') go('meet');
    else if ((key === 'meet' || key === 'welcome') && e === 'booked') go('plan');
    else if (key === 'plan' && e === 'planned') go('nextDay');
    else if (key === 'nextDay' && e === 'day') { if (weddingToday(g)) go('bigDay'); }
    else if ((key === 'bigDay' || key === 'nextDay') && e === 'nightStart') go('problems');
    else if (key === 'problems' && e === 'fixed') go('moments');
    else if ((key === 'problems' || key === 'moments') && e === 'report') { g.unlock('office'); g.unlock('goals'); go('report'); setTimeout(() => { if (STEPS[this.step] === 'report') go('office'); }, 6000); }
    else if (key === 'office' && e === 'office') { g.unlock('build'); go('goals'); }
    else if (key === 'goals' && e === 'goals') this.finish();
    else if (key === 'plan' && e === 'day' && weddingToday(g)) go('bigDay');
  }
  finish() { const g = this.app.g; g.s.tutorial.done = true; for (const k of ['office', 'goals', 'build']) g.unlock(k); this.stop(); this.app.refresh(); }
}
