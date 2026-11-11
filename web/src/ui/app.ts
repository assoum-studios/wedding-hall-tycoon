// App shell: HUD, dock, the daily flow, the live wedding night UI and the report.
import * as THREE from 'three';
import { Game, newGameState, defaultOwner } from '../core/game';
import type { GameState, WeddingRecord } from '../core/types';
import { t, L, money, num, setLang, getLang, onLang, shortMoney } from '../core/i18n';
import { save } from '../core/save';
import { CFG, PROBLEM_BY_ID, HALLS } from '../core/data';
import { advanceDay, weddingToday, startGame } from '../core/day';
import { NightSim, matchPercent } from '../weddings/night';
import { shortages } from '../staff/staff';
import { claimableCount, chapterReady } from '../progress/goals';
import { checkLogin } from '../progress/events';
import { addPhoto } from '../phone/phone';
import { unreadCount } from '../phone/phone';
import { World } from '../world/world';
import { autoQuality } from '../world/scene';
import { h, div, btn, ic, modal, toast, floatMoney, confetti, bar, stars, uiRoot, closeAll, modalOpen } from './dom';
import { sfx, haptic, playMusic, setVolumes, initAudio } from '../audio/audio';
import { showTitle } from './title';
import { openBookings } from './bookings';
import { openOffice } from './office';
import { openGoals } from './goalsUI';
import { openPhone, showIncomingCall } from './phoneUI';
import { showNews } from './news';
import { Tutorial } from './tutorial';
import { openBuild } from './buildUI';

export class App {
  g: Game; world: World; hud = h('div', { class: 'hud-root' }); overlay = div('overlay-layer'); nightUI: HTMLElement | null = null; tutorial: Tutorial | null = null;
  night: { sim: NightSim; speed: number; bubbles: Map<number, HTMLElement>; moment: HTMLElement | null; ended: boolean } | null = null;
  private saveTimer = 0;
  constructor(canvas: HTMLCanvasElement) {
    // A demo state renders the hall behind the title screen until a save is chosen.
    this.g = new Game(newGameState(-1, 'normal', defaultOwner('m'), '', 42));
    this.g.s.settings.quality = (() => { try { return (localStorage.getItem('whot_quality') as any) || autoQuality(); } catch { return autoQuality(); } })();
    this.world = new World(this.g, canvas);
    this.world.loadHall(); this.world.viewEntrance(true);
    uiRoot().append(this.overlay, this.hud);
    this.world.stage.updaters.add((dt) => this.tick(dt));
    this.world.onPick = (p, x, y) => this.onPick(p, x, y);
    onLang(() => { if (this.inGame && this.world.mode === 'day') { this.world.view.buildPlots(this.g.hall); } this.refresh(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(); });
    window.addEventListener('pointerdown', () => initAudio(), { once: false });
    this.world.stage.start();
  }
  get inGame() { return this.g.s.slot >= 0; }

  // ---------------- Game lifecycle ----------------
  startNew(slot: number, s: GameState, fresh: boolean) {
    this.g = new Game(s); this.world.g = this.g; this.world.view.g = this.g;
    if (fresh) startGame(this.g);
    this.applySettings(); this.bindGame();
    this.world.loadHall(); this.world.setupDay(); this.world.viewHall(true);
    this.tutorial = new Tutorial(this); if (!this.g.s.tutorial.done) this.tutorial.start();
    const login = checkLogin(this.g); if (login) setTimeout(() => toast(t('gift.streak', { n: login.streak, m: money(login.reward) }), 'good'), 1200);
    this.refresh(); this.persist(); playMusic('day');
    if (this.g.s.pendingNews && this.g.s.tutorial.done) setTimeout(() => showNews(this), 600);
  }
  /** Used by automated tests: start a fresh game without going through the menus. */
  quickStart(diff: 'relaxed' | 'normal' | 'hard' | 'legend' = 'normal', skipTutorial = true) {
    document.querySelectorAll('.screen, .custom, .story').forEach((e) => e.remove());
    const s = newGameState(0, diff, defaultOwner('m'), ''); s.halls[0].name = getLang() === 'ar' ? 'قاعة الورد' : 'The Rose Hall'; s.settings.quality = this.g.s.settings.quality;
    this.startNew(0, s, true); if (skipTutorial) this.tutorial?.finish();
  }
  bindGame() {
    const g = this.g;
    g.on('toast', (p: any) => toast(p.text, p.kind));
    g.on('money', (n: number) => { this.refreshHud(); if (n && Math.abs(n) >= 1 && g.s.settings.floatingMoney && !this.night) { const el = this.hud.querySelector('.stat.money-stat'); const r = el?.getBoundingClientRect(); if (r) floatMoney((n > 0 ? '+' : '') + shortMoney(n), r.left + 20, r.bottom + 4, n < 0); if (n > 0) sfx('coin'); } });
    for (const ev of ['rep', 'followers', 'message', 'requests', 'booking', 'staff', 'claim', 'unlock', 'loans', 'plots']) g.on(ev, () => this.refreshHud());
    g.on('call', () => showIncomingCall(this));
    g.on('chapterReady', () => { toast(t('goals.chapterReady'), 'good'); sfx('success'); });
    g.on('expand', () => { this.world.loadHall(); this.world.setupDay(); this.world.viewHall(); });
    g.on('plots', () => this.world.view.buildPlots(this.g.hall));
    g.on('marketing', () => this.world.view.updateBillboard());
    g.on('cosmetics', () => this.world.view.applyCosmetics());
    g.on('switchHall', () => { this.world.loadHall(); this.world.setupDay(); this.world.viewHall(true); this.refresh(); });
  }
  applySettings() {
    const s = this.g.s.settings; setVolumes(s.music, s.sound, s.haptics); this.world.stage.setQuality(s.quality, s); this.world.rig.speed = s.cameraSpeed; this.world.rig.invert = s.invertRotation;
    try { localStorage.setItem('whot_quality', s.quality); } catch {}
  }
  persist() { if (this.inGame && !this.night) { this.g.sync(); save(this.g.s); } }
  backToTitle() { this.persist(); closeAll(); this.night = null; this.nightUI?.remove(); this.nightUI = null; this.tutorial?.stop(); this.g = new Game(newGameState(-1, 'normal', defaultOwner('m'), '', 42)); this.world.g = this.g; this.world.view.g = this.g; this.world.loadHall(); this.world.mode = 'title'; this.world.clearPeople(); this.world.viewEntrance(true); this.hud.replaceChildren(); playMusic('day'); showTitle(this); }

  // ---------------- HUD ----------------
  refresh() { if (this.inGame && !this.night && this.world.mode !== 'build') this.renderHud(); }
  refreshHud() { if (this.inGame && !this.night && this.world.mode === 'day') this.renderHud(); }
  renderHud() {
    const g = this.g; const s = g.s; const d = g.date();
    const monthName = t('month.' + d.month);
    const top = div('hud-top',
      h('div', { class: 'stat money-stat' }, h('span', { class: 'ico money' }, ic('coin')), h('span', { class: s.money < 0 ? 'neg' : '' }, money(s.money))),
      h('div', { class: 'stat rep-stat', onClick: () => openGoals(this, 'chapter') }, stars(g.stars())),
      h('div', { class: 'stat hide-sm' }, h('span', { class: 'ico fol' }, ic('heart')), num(s.followers)),
      h('div', { class: 'stat date-stat' }, h('span', { class: 'ico day' }, ic('cal')), t('hud.dateShort', { d: d.dom, m: monthName })),
      h('div', { class: 'hud-right' },
        btn([ic('phone'), unreadCount(g) ? h('span', { class: 'badge' }, String(unreadCount(g))) : null], () => openPhone(this), 'icon-btn', { 'aria-label': t('phone.title'), id: 'btn-phone' })));
    const wed = weddingToday(g); const claim = claimableCount(g);
    const mainLabel = wed ? t('dock.startWedding') : t('dock.nextDay');
    const dock = div('dock',
      this.dockBtn('book', t('dock.bookings'), () => openBookings(this), s.requests.filter((r) => r.hall === s.activeHall).length, 'btn-bookings'),
      g.unlocked('office') ? this.dockBtn('office', t('dock.office'), () => openOffice(this), 0, 'btn-office') : null,
      g.unlocked('goals') ? this.dockBtn('trophy', t('dock.goals'), () => openGoals(this), claim, 'btn-goals') : null,
      g.unlocked('build') ? this.dockBtn('hammer', t('dock.build'), () => openBuild(this), 0, 'btn-build') : null,
      h('div', { class: 'main-action' }, btn([ic(wed ? 'play' : 'next'), mainLabel], () => this.mainAction(), (wed ? 'green' : 'gold') + ' big', { id: 'btn-main' })));
    this.hud.replaceChildren(top, dock);
    this.tutorial?.decorate();
  }
  dockBtn(icon: any, label: string, onClick: () => void, badge = 0, id = '') { return h('button', { class: 'dock-btn', onClick, id }, ic(icon), label, badge ? h('span', { class: 'badge' }, String(badge)) : null); }

  // ---------------- Day flow ----------------
  mainAction() {
    if (modalOpen()) return;
    const w = weddingToday(this.g); if (w) return this.preNight(w);
    const before = this.g.s.money;
    const rep = advanceDay(this.g); haptic(15);
    const parts: string[] = []; if (rep.salaries) parts.push(t('day.salaries', { m: money(rep.salaries) })); if (rep.business) parts.push(t('day.business', { m: money(rep.business) })); parts.push(t('day.upkeep', { m: money(rep.upkeep) }));
    toast(t('day.newDay', { d: this.g.date().dom, m: t('month.' + this.g.date().month) }) + ' · ' + parts.join(' · '), this.g.s.money >= before ? 'good' : 'info');
    if (rep.autoWeddings) toast(t('day.autoWeddings', { n: rep.autoWeddings }), 'info');
    this.world.setupDay(); this.refresh(); this.persist();
    this.tutorial?.event('day');
    if (this.g.s.pendingNews) setTimeout(() => showNews(this), 500);
    else if (this.g.s.pendingCalls.length) setTimeout(() => showIncomingCall(this), 900);
  }
  preNight(b: any) {
    const g = this.g; const short = shortages(g, b.hall, b.req.guests); const keys = Object.keys(short);
    const planned = b.plan.planned;
    const m = modal(t('night.ready'), [
      h('div', { class: 'card' }, h('div', { class: 'title' }, L(b.req.groom) + ' & ' + L(b.req.bride)), h('div', { class: 'sub' }, t('book.guests', { n: b.req.guests }) + ' · ' + L(CFG.themes[b.req.theme]))),
      h('div', { class: 'card' + (planned ? '' : ' hl') }, planned ? t('night.planned', { p: matchPercent(b, b.plan) }) : t('night.notPlanned')),
      keys.length ? h('div', { class: 'card hl' }, h('div', { class: 'title' }, t('night.shortStaff')), ...keys.map((k) => h('div', { class: 'sub' }, '• ' + t('role.' + k) + ' × ' + short[k]))) : h('div', { class: 'card' }, '✓ ' + t('night.staffOk')),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } },
        !planned ? btn(t('night.planFirst'), () => { m.close(); openBookings(this, 'calendar', b.id); }, 'ghost') : null,
        btn([ic('play'), t('night.begin')], () => { m.close(); this.startNight(b); }, 'green big', { id: 'btn-begin' })),
    ], { cls: 'narrow' });
  }

  // ---------------- The wedding night ----------------
  startNight(b: any) {
    closeAll(); const sim = new NightSim(this.g, b, true);
    this.night = { sim, speed: 1, bubbles: new Map(), moment: null, ended: false };
    this.world.startNight(sim); this.world.autoCam = true; this.world.viewHall(); playMusic('day');
    this.hud.replaceChildren(); this.renderNightUI(); this.tutorial?.event('nightStart');
  }
  renderNightUI() {
    this.nightUI?.remove(); const n = this.night!; const sim = n.sim;
    const phases = CFG.night.phases.map(([id]: [string]) => id);
    const progress = h('div', { class: 'bar gold' }, h('i', { style: { width: '0%' } }));
    const steps = div('steps', ...phases.map((p: string) => h('span', { 'data-p': p }, t('phase.' + p))));
    const happy = h('span', {}, '');
    const speedBtn = btn([ic('speed'), '1×'], () => { n.speed = n.speed === 1 ? 2 : n.speed === 2 ? 3 : 1; speedBtn.lastChild!.textContent = n.speed + '×'; }, 'small ghost');
    const skipBtn = btn([ic('skip'), t('night.skip')], () => this.skipNight(), 'small red', { id: 'btn-skip' });
    const ui = div('hud-root', div('phasebar', progress, steps),
      h('div', { class: 'hud-top' }, h('div', { class: 'stat money-stat' }, h('span', { class: 'ico money' }, ic('coin')), h('span', { class: 'm' }, money(this.g.s.money))), h('div', { class: 'stat happy-stat' }, h('span', { class: 'ico rep' }, ic('heart')), happy), h('div', { class: 'hud-right' }, speedBtn, skipBtn)),
    );
    (ui as any).refs = { progress: progress.firstChild, steps, happy, money: ui.querySelector('.m') };
    uiRoot().append(ui); this.nightUI = ui; void sim;
  }
  private tick(dt: number) {
    if (this.night && !this.night.ended) this.nightTick(dt);
    this.updateSpeech();
    if (this.inGame && !this.night) { this.saveTimer += dt; if (this.saveTimer > 30) { this.saveTimer = 0; this.persist(); } }
  }
  private nightTick(dt: number) {
    const n = this.night!; const sim = n.sim; const refs = (this.nightUI as any)?.refs; if (!refs) return;
    if (!modalOpen()) sim.step(dt * n.speed);
    for (const ev of sim.drain()) this.nightEvent(ev);
    refs.progress.style.width = (sim.t / sim.duration) * 100 + '%';
    for (const s of refs.steps.children) s.classList.toggle('on', s.getAttribute('data-p') === sim.phase);
    refs.happy.textContent = Math.round(this.world.night?.mood() ?? 70) + '%'; refs.money.textContent = money(this.g.s.money);
    // Problem bubbles follow their spot in the hall.
    for (const p of sim.problems) {
      let el = n.bubbles.get(p.uid);
      if (p.state === 'active') {
        if (!el) {
          const def = PROBLEM_BY_ID[p.id];
          el = h('div', { class: 'problem', onClick: () => { if (sim.fix(p.uid)) { sfx('fix'); haptic(20); toast(t('night.fixed', { p: L(def) }), 'good'); this.tutorial?.event('fixed'); } else { sfx('fail'); toast(t('night.cantAfford'), 'bad'); } } },
            h('div', { class: 'pt' }, L(def)), h('div', { class: 'sub' }, p.cost ? t('night.fixCost', { m: money(p.cost) }) : t('night.fixFree')), h('div', { class: 'ring' }, h('i')));
          this.overlay.append(el); n.bubbles.set(p.uid, el); sfx('alert');
        }
        const wp = this.world.night?.problemWorldPos(p.uid); if (wp) { const sp = this.world.screenPos(wp.clone().setY(2.6)); const half = Math.min(110, el.offsetWidth / 2 + 6); el.style.left = Math.max(half, Math.min(innerWidth - half, sp.x)) + 'px'; el.style.top = Math.max(110, sp.y) + 'px'; el.style.display = sp.visible ? '' : 'none'; }
        (el.querySelector('.ring i') as HTMLElement).style.width = (p.timeLeft / p.total) * 100 + '%';
        el.classList.toggle('mgr', !!p.manager && p.manager.eta > 0);
      } else if (el) { el.remove(); n.bubbles.delete(p.uid); }
    }
    this.updateTableFaces();
    if (sim.done && !n.ended) this.endNight();
  }
  /** Live happiness faces over every table: each table drifts a little around the night's overall mood. */
  private tableFaces: { el: HTMLElement; pos: THREE.Vector3; bias: number }[] = []; private faceT = 0;
  private updateTableFaces() {
    const night = this.world.night; if (!night) return;
    if (!this.tableFaces.length) {
      const spots = (this.world.nav.spots.table ?? []).slice(0, 40);
      this.tableFaces = spots.map((p, i) => { const el = h('div', { class: 'table-face' }, '🙂'); this.overlay.append(el); return { el, pos: p.clone().setY(1.9), bias: ((i * 37) % 11) - 5 }; });
    }
    const phase = night.sim.phase; const show = phase === 'dinner' || phase === 'dancing';
    this.faceT += 1;
    for (const f of this.tableFaces) {
      if (!show) { f.el.style.display = 'none'; continue; }
      const sp = this.world.screenPos(f.pos); f.el.style.display = sp.visible ? '' : 'none'; f.el.style.left = sp.x + 'px'; f.el.style.top = sp.y + 'px';
      if (this.faceT % 20 === 0) { const m = night.mood() + f.bias + (night.sim.problems.some((p) => p.state === 'active') ? -6 : 0); f.el.textContent = m > 85 ? '😍' : m > 70 ? '😀' : m > 55 ? '🙂' : m > 40 ? '😐' : m > 25 ? '😟' : '😠'; }
    }
  }
  private clearTableFaces() { for (const f of this.tableFaces) f.el.remove(); this.tableFaces = []; }
  private nightEvent(ev: { kind: string; data?: any }) {
    const n = this.night!; const sim = n.sim;
    switch (ev.kind) {
      case 'phase': if (ev.data === 'dancing') { playMusic('party'); sfx('cheer'); } if (ev.data === 'farewell') { playMusic('day'); setTimeout(() => sfx('firework'), 2600); setTimeout(() => sfx('firework'), 3200); } if (ev.data === 'entrance') sfx('cheer'); break;
      case 'moment': {
        n.moment?.remove(); const m = ev.data;
        n.moment = h('div', { class: 'moment' }, h('button', { class: 'ringbtn', onClick: () => { if (sim.tapMoment(m.id)) { sfx('moment'); confetti(); this.world.night?.momentFx(); toast(t('moment.hit', { m: t('moment.' + m.id) }), 'good'); } n.moment?.remove(); n.moment = null; } }, t('moment.' + m.id), h('span', { style: { fontSize: '13px' } }, t('moment.tap'))));
        uiRoot().append(n.moment); sfx('alert'); break;
      }
      case 'momentMiss': n.moment?.remove(); n.moment = null; break;
      case 'missed': toast(t('night.missed', { p: L(PROBLEM_BY_ID[ev.data.id]) }), 'bad'); break;
      case 'fixed': if (ev.data.byManager) toast(t('night.managerFixed', { p: L(PROBLEM_BY_ID[ev.data.p.id]) }), 'good'); break;
      case 'managerFail': toast(t('night.managerFailed'), 'bad'); break;
    }
  }
  skipNight() { const n = this.night; if (!n) return; n.sim.skip(); }
  endNight() {
    const n = this.night!; n.ended = true; n.moment?.remove(); for (const el of n.bubbles.values()) el.remove(); this.clearTableFaces();
    const rec = n.sim.finish(); if (n.sim.photo) addPhoto(this.g, rec, n.sim.photo);
    if (rec.happiness >= CFG.happiness.perfect) { confetti(true); this.world.night?.celebrate(); sfx('success'); }
    setTimeout(() => this.showReport(rec), rec.happiness >= CFG.happiness.perfect ? 2200 : 400);
  }
  showReport(rec: WeddingRecord) {
    const g = this.g;
    const close = () => { this.nightUI?.remove(); this.nightUI = null; this.night = null; this.world.endNight(); this.world.viewHall(); playMusic('day'); this.refresh(); this.persist(); this.tutorial?.event('report'); if (chapterReady(g)) setTimeout(() => openGoals(this, 'chapter'), 300); };
    const line = (k: string, v: string, cls = '') => h('div', { class: 'list-line' }, h('span', {}, k), h('b', { class: cls }, v));
    const label = (k: string) => t('plan.' + k);
    const m = modal(t('report.title'), [
      rec.photo ? h('img', { src: rec.photo, style: { width: '100%', borderRadius: '14px', marginBottom: '10px' } }) : null,
      h('div', { class: 'big-score' }, rec.happiness + '%'), h('div', { style: { textAlign: 'center' } }, stars(rec.stars)),
      h('div', { class: 'quote', style: { margin: '10px 0' } }, '“' + L(rec.review) + '” — ' + L(rec.names[1])),
      h('div', { class: 'card' },
        line(t('report.themeMatch'), rec.themeMatch + '%'), line(t('report.problems'), t('report.fixedMissed', { f: rec.fixed, m: rec.missed })),
        line(t('report.payment'), money(rec.payment)), line(t('report.tips'), money(rec.tips)), line(t('report.shop'), money(rec.shopSales)),
        line(t('report.costs'), '-' + money(rec.costs), 'neg'), line(t('report.profit'), money(rec.profit), rec.profit < 0 ? 'neg' : 'money'),
        line(t('report.rep'), (rec.repChange >= 0 ? '+' : '') + rec.repChange.toFixed(1))),
      h('div', { class: 'card' }, h('div', { class: 'title' }, t('report.loved')), h('div', { class: 'sub' }, rec.loved.map(label).join(', ') || '—'), h('div', { class: 'title', style: { marginTop: '6px' } }, t('report.wanted')), h('div', { class: 'sub' }, rec.wanted.map(label).join(', ') || '—')),
      rec.skipped ? h('div', { class: 'card hl' }, t('report.skipped')) : null,
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn(t('ui.continue'), () => m.close(), 'green big', { id: 'btn-report-ok' })),
    ], { onClose: close });
  }

  // ---------------- World taps ----------------
  onPick(p: any, x: number, y: number) {
    if (!this.inGame || this.night || this.world.mode !== 'day') return;
    if (p.kind === 'office') openOffice(this);
    else if (p.kind === 'plot') openOffice(this, 'halls', p.id);
    else if (p.kind === 'person' && p.person?.data?.emp) openOffice(this, 'staff', p.person.data.emp);
    else if (p.kind === 'item' && this.g.unlocked('build')) toast(t('build.tapHint'), 'info');
    void x; void y;
  }
  // Speech bubbles over guests during the night.
  private speechEls = new Map<any, HTMLElement>();
  private updateSpeech() {
    const seen = new Set<any>();
    for (const p of this.world.people) {
      if (!p.bubble) continue; seen.add(p);
      let el = this.speechEls.get(p); if (!el) { const pair = JSON.parse(p.bubble.text); el = h('div', { class: 'speech' }, L(pair)); this.overlay.append(el); this.speechEls.set(p, el); }
      const sp = this.world.screenPos(p.pos.clone().setY(p.c.dims.H + 0.55)); el.style.left = sp.x + 'px'; el.style.top = sp.y + 'px'; el.style.display = sp.visible ? '' : 'none';
    }
    for (const [p, el] of this.speechEls) if (!seen.has(p)) { el.remove(); this.speechEls.delete(p); }
  }
}
export { THREE, HALLS };
