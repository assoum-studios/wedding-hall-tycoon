// The owner's office: Staff, Managers, Marketing, Shop, Money, Halls, Settings.
import type { App } from './app';
import type { Employee, Candidate } from '../core/types';
import { t, L, money, num, setLang, getLang } from '../core/i18n';
import { STAFF, ROLE_BY_ID, BIZ, HALLS, PLOT_BY_ID, CFG } from '../core/data';
import { interview, hire, fire, train, trainCost, raise, assign, skillRange, setManager, staffIn, wageFor, staffNeeds, resting, giveDayOff } from '../staff/staff';
import { SUPPLIER_COST, SUPPLIER_HAPPY, SUPPLIER_KINDS } from '../weddings/quality';
import { launch, active as campaignActive, marketingBoost } from '../business/marketing';
import { buy, equip, item as shopItem } from '../business/shop';
import { take, canTake, payOff, payoffAmount, owed, loanDef, loanRate, payRosaDebt } from '../business/loans';
import { buildPlot, plotCost, plotIncome } from '../business/plots';
import { buyUpgrade, upgradeCost, expand, expandCost, buyHall, hallUnlockable, switchHall, startResearch, researchAvailable, dailyUpkeep as _u } from '../world/hallOps';
import { capacity, hallDims } from '../world/layout';
import { runCheat, CHEATS_ENABLED } from '../core/cheats';
import { h, div, btn, ic, modal, tabs, toast, bar, toggle, confirmBox, stars } from './dom';
import { sfx } from '../audio/audio';

export function openOffice(app: App, tab = 'staff', focus?: string) {
  const g = app.g; let cur = tab;
  const m = modal(t('office.title'), [], { cls: 'wide' });
  const render = () => {
    const names = [{ id: 'staff', label: t('office.staff') }, { id: 'managers', label: t('office.managers') }, { id: 'marketing', label: t('office.marketing') }, { id: 'shop', label: t('office.shop') }, { id: 'suppliers', label: t('office.suppliers') }, { id: 'money', label: t('office.money') }, { id: 'halls', label: t('office.halls') }, { id: 'settings', label: t('office.settings') }];
    m.panel.querySelector('.tabs')?.remove(); m.panel.insertBefore(tabs(names, cur, (id) => { cur = id; focus = undefined; render(); }), m.body);
    const views: Record<string, () => (Node | null)[]> = { staff: () => staffView(app, render, focus), managers: () => managersView(app, render), marketing: () => marketingView(app, render), shop: () => shopView(app, render), suppliers: () => suppliersView(app, render), money: () => moneyView(app, render), halls: () => hallsView(app, render, focus), settings: () => settingsView(app, m.close) };
    m.setBody(views[cur]());
  };
  const offs = ['staff', 'money', 'loans', 'plots', 'research', 'upgrade', 'candidates'].map((e) => g.on(e, () => { if (document.body.contains(m.el)) render(); }));
  const oc = m.close; m.close = () => { offs.forEach((f) => f()); oc(); app.refresh(); };
  render(); app.tutorial?.event('office');
  return m;
}

const skillStars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
function moraleBar(e: Employee) { return h('div', { style: { minWidth: '90px' } }, h('div', { class: 'sub' }, t('staff.morale', { n: Math.round(e.morale) })), bar(e.morale / 100, e.morale < 35 ? 'red' : '')); }
function hallName(app: App, i: number) { return app.g.s.halls[i].name; }

const ROLE_ICON: Record<string, string> = { waiter: '🍽️', cook: '👨‍🍳', cleaner: '🧹', security: '🛡️', bartender: '🍹', decorator: '💐', sound_tech: '🎛️', valet: '🚗', host: '🤝', social: '📱', manager: '📋' };
let openRole: string | null = null;
/** Staff: one card per category; each category opens its own page with your team and its candidates. */
function staffView(app: App, rerender: () => void, focus?: string) {
  const g = app.g;
  if (focus) { const e = g.s.staff.find((x) => x.id === focus); if (e) openRole = e.role === 'manager' ? null : e.role; }
  const roles = STAFF.roles.filter((r: any) => r.id !== 'manager');
  if (!openRole || !roles.some((r: any) => r.id === openRole)) {
    const need = staffNeeds(g, g.s.activeHall, Math.max(80, capacity(g.hall)));
    return [h('div', { class: 'row wrap', style: { marginBottom: '8px' } }, h('span', { class: 'pill blue' }, t('staff.count', { n: g.s.staff.length })), h('span', { class: 'pill' }, t('staff.payroll', { m: money(g.s.staff.reduce((a, e) => a + e.wage, 0) * 7) }))),
      h('div', { class: 'sub', style: { marginBottom: '8px' } }, t('staff.pickRole')),
      div('grid3', ...roles.map((r: any) => {
        const team = g.s.staff.filter((e) => e.role === r.id); const here = team.filter((e) => e.hall === g.s.activeHall).length; const cands = g.s.candidates.filter((c) => c.role === r.id).length; const n = need[r.id] ?? 0;
        const low = n > here; const asking = team.some((e) => e.askedRaise || e.morale < 35);
        return h('button', { class: 'card role-card' + (low ? ' hl' : ''), 'data-role': r.id, onClick: () => { openRole = r.id; rerender(); } },
          h('div', { style: { fontSize: '30px' } }, ROLE_ICON[r.id] ?? '👤'), h('div', { class: 'title' }, L(r)),
          h('div', { class: 'sub' }, t('staff.roleCount', { n: here, need: n })), cands ? h('span', { class: 'pill green' }, t('staff.candidatesN', { n: cands })) : null, asking ? h('span', { class: 'pill red' }, '!') : null);
      }))];
  }
  const r = STAFF.roles.find((x: any) => x.id === openRole); const team = g.s.staff.filter((e) => e.role === openRole).sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : b.skill - a.skill));
  const cands = g.s.candidates.filter((c) => c.role === openRole);
  return [h('div', { class: 'row', style: { marginBottom: '8px' } }, btn('‹ ' + t('ui.back'), () => { openRole = null; rerender(); }, 'small ghost', { id: 'role-back' }), h('div', { class: 'title grow' }, (ROLE_ICON[openRole!] ?? '') + ' ' + L(r)), h('span', { class: 'sub' }, t('staff.perGuests', { n: r.perGuests || '-' }))),
    h('div', { class: 'title', style: { margin: '6px 0' } }, t('staff.yourTeam')), team.length ? div('grid2', ...team.map((e) => empCard(app, e, rerender, e.id === focus))) : h('div', { class: 'empty' }, t('staff.noneYet')),
    h('div', { class: 'panel-head', style: { borderRadius: '14px', margin: '14px 0 8px' } }, t('staff.candidates'), h('span', { class: 'grow' }), h('span', { style: { fontSize: '14px' } }, t('staff.refreshIn', { n: Math.max(0, CFG.time.candidateRefreshDays - (g.s.day - g.s.candidatesDay)) }))),
    cands.length ? div('grid2', ...cands.map((c) => candCard(app, c, rerender))) : h('div', { class: 'empty' }, t('staff.noCandidates'))];
}
function empCard(app: App, e: Employee, rerender: () => void, hl = false) {
  const g = app.g; const role = ROLE_BY_ID[e.role]; const fair = wageFor(e.role, e.skill);
  return h('div', { class: 'card' + (hl ? ' hl' : '') },
    h('div', { class: 'row' }, h('div', { class: 'avatar' }, L(e.name).slice(0, 1)), h('div', { class: 'grow' }, h('div', { class: 'title' }, L(e.name)), h('div', { class: 'sub' }, L(role) + ' · ' + L(STAFF.traits[e.trait]))), h('span', { class: 'stars' }, skillStars(e.skill))),
    h('div', { class: 'row', style: { margin: '8px 0' } }, moraleBar(e), h('div', { style: { minWidth: '80px' } }, h('div', { class: 'sub' }, t('staff.fatigue', { n: Math.round(e.fatigue ?? 0) })), bar((e.fatigue ?? 0) / 100, (e.fatigue ?? 0) > 60 ? 'red' : 'gold')), h('div', { class: 'grow sub' }, t('staff.wage', { m: money(e.wage) }) + (e.wage < fair * 0.95 ? ' ⚠' : ''), h('br'), t('staff.week', { n: e.weekWeddings }) + (g.s.halls.filter((x) => x.owned).length > 1 ? ' · ' + hallName(app, e.hall) : ''))),
    h('div', { class: 'row wrap' },
      e.skill < 5 ? btn(t('staff.train', { m: money(trainCost(e)) }), () => { if (train(g, e)) { sfx('success'); toast(t('staff.trained', { n: L(e.name) }), 'good'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small') : null,
      btn(t('staff.raise'), () => { raise(g, e); toast(t('staff.raised', { n: L(e.name), m: money(e.wage) }), 'good'); rerender(); }, 'small gold'),
      resting(g, e) ? h('span', { class: 'pill blue' }, t('staff.resting')) : btn(t('staff.dayOff'), () => { giveDayOff(g, e); toast(t('staff.dayOffGiven', { n: L(e.name) }), 'good'); rerender(); }, 'small ghost'),
      g.s.halls.filter((x) => x.owned).length > 1 ? btn(t('staff.assign'), () => { const owned = g.s.halls.map((x, i) => ({ x, i })).filter((o) => o.x.owned); const nxt = owned[(owned.findIndex((o) => o.i === e.hall) + 1) % owned.length].i; assign(g, e, nxt); rerender(); }, 'small ghost') : null,
      !e.named ? btn(t('staff.fire'), () => confirmBox(t('staff.fireConfirm', { n: L(e.name) }), t('staff.fire'), () => { fire(g, e.id); toast(t('staff.fired', { n: L(e.name) }), 'info'); rerender(); }), 'small red', { 'data-fire': e.id }) : null));
}
function candCard(app: App, c: Candidate, rerender: () => void) {
  const g = app.g; const [lo, hi] = skillRange(c);
  return h('div', { class: 'card' },
    h('div', { class: 'row' }, h('div', { class: 'avatar' }, c.interviewed ? h('img', { src: app.world.renderThumb(c.look, { face: true, size: 96 }) }) : '?'), h('div', { class: 'grow' }, h('div', { class: 'title' }, L(c.name)), h('div', { class: 'sub' }, L(ROLE_BY_ID[c.role]))),
      h('span', { class: 'stars' }, c.interviewed ? skillStars(c.skill) : t('staff.range', { a: lo, b: hi }))),
    c.interviewed ? h('div', { class: 'quote', style: { margin: '8px 0' } }, '“' + L(quoteFor(c)) + '” — ' + L(STAFF.traits[c.trait])) : h('div', { class: 'sub', style: { margin: '8px 0' } }, t('staff.interviewHint')),
    h('div', { class: 'row wrap' }, h('span', { class: 'pill' }, t('staff.wage', { m: money(c.wage) })), h('span', { class: 'grow' }),
      !c.interviewed ? btn(t('staff.interview', { m: money(STAFF.interviewCost) }), () => { if (interview(g, c)) { sfx('tap'); rerender(); } else toast(t('ui.noMoney'), 'bad'); }, 'small') : null,
      btn(t('staff.hire'), () => { hire(g, c); sfx('success'); toast(t('staff.hired', { n: L(c.name) }), 'good'); app.tutorial?.event('hired'); rerender(); }, 'small green', { 'data-hire': c.id })));
}
import { CONTENT } from '../core/data';
function quoteFor(c: Candidate) { const q = CONTENT.candidateQuotes[c.trait]; return q ? q[0] : ['', '']; }

/** Managers have their own section: your managers (toggles, hall, train, raise, let go) and manager candidates to interview and hire. */
function managersView(app: App, rerender: () => void) {
  const g = app.g; const mgrs = g.s.staff.filter((e) => e.role === 'manager'); const cands = g.s.candidates.filter((c) => c.role === 'manager');
  return [h('div', { class: 'sub', style: { marginBottom: '8px' } }, t('mgr.help')), h('div', { class: 'title', style: { margin: '6px 0' } }, t('mgr.yours')),
    mgrs.length ? div('grid2', ...mgrs.map((e) => {
    const hallIdx = g.s.halls.findIndex((x) => x.managerId === e.id); const tg = e.toggles!;
    const tline = (k: keyof typeof tg, label: string) => h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: 'grow' }, label), toggle(tg[k], (v) => { tg[k] = v; }));
    return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'avatar' }, h('img', { src: app.world.renderThumb(e.look, { face: true, size: 96 }) })), h('div', { class: 'grow' }, h('div', { class: 'title' }, L(e.name)), h('div', { class: 'sub' }, hallIdx >= 0 ? t('mgr.runs', { h: hallName(app, hallIdx) }) : t('mgr.spare'))), h('span', { class: 'stars' }, skillStars(e.skill))),
      h('div', { class: 'row', style: { margin: '6px 0' } }, moraleBar(e), h('div', { class: 'grow sub' }, t('staff.wage', { m: money(e.wage) }))),
      h('div', { class: 'sub' }, t('mgr.fixChance', { p: Math.round(Math.min(0.95, CFG.night.managerChanceSkill1 + (e.skill - 1) * CFG.night.managerChancePerSkill) * 100) })),
      tline('run', t('mgr.run')), tline('fix', t('mgr.fix')), tline('plan', t('mgr.plan')), tline('accept', t('mgr.accept')),
      h('div', { class: 'row wrap' }, hallIdx !== g.s.activeHall ? btn(t('mgr.makeManager', { h: hallName(app, g.s.activeHall) }), () => { setManager(g, g.s.activeHall, e.id); rerender(); }, 'small') : null,
        e.skill < 5 ? btn(t('staff.train', { m: money(trainCost(e)) }), () => { if (train(g, e)) sfx('success'); else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small') : null,
        btn(t('staff.raise'), () => { raise(g, e); rerender(); }, 'small gold'),
        btn(t('staff.fire'), () => confirmBox(t('staff.fireConfirm', { n: L(e.name) }), t('staff.fire'), () => { fire(g, e.id); toast(t('staff.fired', { n: L(e.name) }), 'info'); rerender(); }), 'small red', { 'data-fire': e.id })));
  })) : h('div', { class: 'empty' }, t('mgr.none')),
    h('div', { class: 'panel-head', style: { borderRadius: '14px', margin: '14px 0 8px' } }, t('mgr.hire'), h('span', { class: 'grow' }), h('span', { style: { fontSize: '14px' } }, t('staff.refreshIn', { n: Math.max(0, CFG.time.candidateRefreshDays - (g.s.day - g.s.candidatesDay)) }))),
    cands.length ? div('grid2', ...cands.map((c) => candCard(app, c, rerender))) : h('div', { class: 'empty' }, t('staff.noCandidates'))];
}

/** Suppliers: choose budget, standard or premium partners for flowers, cakes and photography. */
function suppliersView(app: App, rerender: () => void) {
  const g = app.g; const sup = (g.s.suppliers ??= { flowers: 1, cake: 1, photo: 1 });
  return [h('div', { class: 'sub', style: { marginBottom: '8px' } }, t('sup.help')), ...SUPPLIER_KINDS.map((k) => h('div', { class: 'card' }, h('div', { class: 'title' }, t('sup.' + k)),
    div('grid3', ...[0, 1, 2].map((tier) => h('button', { class: 'card choice' + ((sup[k] ?? 1) === tier ? ' on' : ''), style: { flexDirection: 'column', alignItems: 'flex-start' }, onClick: () => { sup[k] = tier; app.persist(); rerender(); } },
      h('b', {}, t('sup.tier' + tier) + ' · ' + t('sup.name.' + k + tier)), h('span', { class: 'sub' }, t('sup.effect', { c: Math.round((SUPPLIER_COST[tier] - 1) * 100), h: SUPPLIER_HAPPY[tier] })))))))];
}

function marketingView(app: App, rerender: () => void) {
  const g = app.g;
  return [h('div', { class: 'card' }, h('div', { class: 'title' }, t('mkt.boost', { p: Math.round(marketingBoost(g) * 100) })), bar(marketingBoost(g) / BIZ.marketingCap, 'gold'), h('div', { class: 'sub' }, t('mkt.cap', { p: Math.round(BIZ.marketingCap * 100) }))),
    div('grid2', ...BIZ.marketing.map((c: any) => { const on = campaignActive(g, c.id); const left = on ? g.s.campaigns.filter((x) => x.id === c.id).reduce((a, x) => Math.max(a, x.until - g.s.day + 1), 0) : 0;
      return h('div', { class: 'card' + (on ? ' hl' : '') }, h('div', { class: 'title' }, L(c)), h('div', { class: 'sub' }, t('mkt.effect', { p: Math.round(c.boost * 100), d: c.days }) + (c.vip ? ' · ' + t('mkt.vip') : '') + (c.billboard ? ' · ' + t('mkt.billboard') : '')),
        h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', { class: 'pill green' }, money(c.cost)), on ? h('span', { class: 'pill gold' }, t('mkt.daysLeft', { n: left })) : null, h('span', { class: 'grow' }),
          btn(t('mkt.launch'), () => { if (launch(g, c.id)) { sfx('success'); toast(t('mkt.launched', { n: L(c) }), 'good'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small green'))); }))];
}

function shopView(app: App, rerender: () => void) {
  const g = app.g; const cats = [...new Set(BIZ.shop.map((x: any) => x.cat))] as string[];
  return cats.map((cat) => h('div', {}, h('div', { class: 'title', style: { margin: '8px 0' } }, t('shop.cat.' + cat)), div('grid3', ...BIZ.shop.filter((x: any) => x.cat === cat).map((it: any) => {
    const owned = g.s.shopOwned.includes(it.id); const equipped = g.hall.cosmetics[cat] === it.id; const locked = (it.minChapter ?? 0) > g.s.chapter;
    return h('div', { class: 'card' + (equipped ? ' hl' : '') }, h('div', { style: { height: '46px', borderRadius: '10px', background: it.color, marginBottom: '6px', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.12)' } }), h('div', { style: { fontWeight: '800' } }, L(it)),
      locked ? h('div', { class: 'sub' }, t('shop.chapter', { n: it.minChapter })) : owned ? btn(equipped ? t('shop.remove') : t('shop.equip'), () => { equipped ? equip(g, null, cat) : equip(g, it.id); rerender(); }, 'small ' + (equipped ? 'ghost' : 'green')) : btn(money(it.cost), () => { if (buy(g, it.id)) { sfx('success'); toast(t('shop.bought', { n: L(it) }), 'good'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small gold'));
  }))));
}

function moneyView(app: App, rerender: () => void) {
  const g = app.g; const s = g.s;
  const upkeep = s.halls.filter((x) => x.owned).reduce((a, hh) => a + CFG.upkeep.baseDaily + CFG.upkeep.perSizeLevel * hh.size + CFG.upkeep.perUpgradeLevel * Object.values(hh.upgrades).reduce((x, y) => x + y - 1, 0), 0);
  const biz = s.halls.reduce((a, hh, i) => a + Object.keys(hh.plots).reduce((x, id) => x + plotIncome(g, i, id), 0), 0);
  const recent = s.history.slice(-7).reverse();
  return [
    h('div', { class: 'card' }, h('div', { class: 'list-line' }, h('span', {}, t('money.balance')), h('b', { class: s.money < 0 ? 'neg' : 'money' }, money(s.money))), h('div', { class: 'list-line' }, h('span', {}, t('money.upkeep')), h('b', {}, '-' + money(upkeep))), h('div', { class: 'list-line' }, h('span', {}, t('money.payroll')), h('b', {}, '-' + money(s.staff.reduce((a, e) => a + e.wage, 0) * 7))), h('div', { class: 'list-line' }, h('span', {}, t('money.business')), h('b', { class: 'money' }, '+' + money(biz)))),
    s.rosaDebt > 0 ? h('div', { class: 'card hl' }, h('div', { class: 'title' }, t('money.rosaDebt', { m: money(s.rosaDebt) })), h('div', { class: 'sub' }, t('money.rosaHelp', { m: money(CFG.start.rosaDebtMinWeekly) })), h('div', { class: 'row wrap', style: { marginTop: '8px' } }, ...[1000, 5000, 10000].map((a) => btn(t('money.pay', { m: money(a) }), () => { if (payRosaDebt(g, a)) sfx('coin'); else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small')), btn(t('money.payAll'), () => { if (payRosaDebt(g, s.rosaDebt)) sfx('success'); else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small green'))) : h('div', { class: 'card' }, '✓ ' + t('money.rosaPaid')),
    (() => { const inv = s.investor; const offer = 20000 * g.s.chapter + 10000; const active = inv && inv.until >= s.day;
      return h('div', { class: 'card' + (active ? ' hl' : '') }, h('div', { class: 'title' }, t('inv2.title')),
        active ? h('div', { class: 'sub' }, t('inv2.active', { p: Math.round(inv!.share * 100), d: inv!.until - s.day + 1 })) : [h('div', { class: 'sub' }, t('inv2.offer', { m: money(offer), p: 12, w: 6 })),
          btn(t('inv2.accept'), () => { s.investor = { until: s.day + 42, share: 0.12, amount: offer }; g.addMoney(offer); sfx('coin'); app.persist(); rerender(); }, 'small green', { style: { marginTop: '6px' } })]); })(),
    h('div', { class: 'title', style: { margin: '10px 0 6px' } }, t('money.loans')), h('div', { class: 'sub', style: { marginBottom: '6px' } }, t('money.loanRule')),
    div('grid2', ...BIZ.loans.map((ld: any) => { const l = s.loans.find((x) => x.cat === ld.id); const rate = loanRate(g, ld.id);
      return h('div', { class: 'card' + (l ? ' hl' : '') }, h('div', { class: 'title' }, L(ld) + ' · ' + money(ld.amount)), h('div', { class: 'sub' }, t('money.loanTerms', { w: ld.weeks, r: Math.round(rate * 100) })),
        l ? [h('div', { class: 'list-line' }, h('span', {}, t('money.owed')), h('b', {}, money(owed(l)))), h('div', { class: 'list-line' }, h('span', {}, t('money.weekly')), h('b', {}, money(l.weekly))), l.missed ? h('div', { class: 'sub neg' }, t('money.missed', { n: l.missed })) : null, bar(l.paid / (l.principal + l.interestTotal)),
          btn(t('money.payoff', { m: money(payoffAmount(l)) }), () => { if (payOff(g, l.id)) { sfx('success'); toast(t('money.paidOff'), 'good'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small green', { style: { marginTop: '8px' }, 'data-payoff': ld.id })]
          : btn(t('money.take'), () => { if (take(g, ld.id)) { sfx('coin'); toast(t('money.taken', { m: money(ld.amount) }), 'good'); } rerender(); }, 'small', { disabled: !canTake(g, ld.id), 'data-take': ld.id, style: { marginTop: '8px' } }));
    })),
    recent.length ? h('div', { class: 'card', style: { marginTop: '10px' } }, h('div', { class: 'title' }, t('money.recent')), ...recent.map((r) => h('div', { class: 'list-line' }, h('span', {}, L(r.names[0]) + ' & ' + L(r.names[1]) + ' · ' + r.happiness + '%'), h('b', { class: r.profit < 0 ? 'neg' : 'money' }, money(r.profit))))) : null,
  ];
}

function hallsView(app: App, rerender: () => void, focusPlot?: string) {
  const g = app.g; const s = g.s; const hall = g.hall; const hi = s.activeHall; const dims = hallDims(hall.size); const ec = expandCost(g, hi);
  const out: Node[] = [];
  out.push(div('grid2', ...HALLS.halls.map((def: any, i: number) => { const hs = s.halls[i]; const can = hallUnlockable(g, i);
    return h('div', { class: 'card' + (i === hi ? ' hl' : '') }, h('div', { class: 'title' }, hs.owned ? hs.name : L(def)), h('div', { class: 'sub' }, t('atmo.' + def.atmosphere)),
      hs.owned ? h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'pill blue' }, t('halls.capacity', { n: capacity(hs) })), h('span', { class: 'pill' }, t('halls.weddings', { n: hs.weddings })), h('span', { class: 'grow' }), i !== hi ? btn(t('halls.switch'), () => { switchHall(g, i); rerender(); }, 'small green') : h('span', { class: 'pill green' }, t('halls.here')))
        : h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'pill gold' }, money(def.cost)), h('span', { class: 'grow' }), can ? btn(t('halls.buy'), () => { if (buyHall(g, i)) { sfx('success'); toast(t('halls.bought', { n: L(def) }), 'good'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small green') : h('span', { class: 'sub' }, t('halls.locked'))));
  })));
  out.push(h('div', { class: 'card hl', style: { marginTop: '10px' } }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, t('halls.size', { n: hall.size + 1, m: HALLS.sizes.length })), h('div', { class: 'sub' }, t('halls.sizeInfo', { c: dims.cap, w: dims.w, d: dims.d, s: capacity(hall) }))),
    ec != null ? btn(t('halls.expand', { m: money(ec) }), () => { if (expand(g, hi)) { sfx('success'); toast(t('halls.expanded'), 'good'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'gold', { id: 'btn-expand' }) : h('span', { class: 'pill green' }, t('halls.maxSize')))));
  out.push(h('div', { class: 'title', style: { margin: '12px 0 6px' } }, t('halls.upgrades')));
  out.push(div('grid3', ...HALLS.upgrades.map((u: any) => { const lvl = hall.upgrades[u.id] ?? 1; const c = lvl < 5 ? upgradeCost(u.id, lvl) : 0;
    return h('div', { class: 'card' }, h('div', { style: { fontWeight: '900' } }, L(u)), h('div', { class: 'stars', style: { fontSize: '14px' } }, skillStars(lvl)), lvl < 5 ? btn(money(c), () => { if (buyUpgrade(g, hi, u.id)) { sfx('success'); toast(t('halls.upgraded', { n: L(u), l: lvl + 1 }), 'good'); app.world.loadHall(); app.world.setupDay(); app.tutorial?.event('upgrade'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small gold', { 'data-up': u.id }) : h('span', { class: 'pill green' }, t('halls.max')));
  })));
  out.push(h('div', { class: 'title', style: { margin: '12px 0 6px' } }, t('halls.plots')));
  out.push(div('grid2', ...BIZ.plots.map((p: any) => { const lvl = hall.plots[p.id] ?? 0; const c = lvl < BIZ.plotMaxLevel ? plotCost(p.id, lvl) : 0;
    return h('div', { class: 'card' + (p.id === focusPlot ? ' hl' : '') }, h('div', { class: 'title' }, L(p)), h('div', { class: 'sub' }, lvl ? t('plots.level', { l: lvl, m: money(plotIncome(g, hi, p.id)) }) : t('plots.desc.' + p.id)),
      lvl < BIZ.plotMaxLevel ? btn(lvl ? t('plots.upgrade', { m: money(c) }) : t('plots.build', { m: money(c) }), () => { if (buildPlot(g, hi, p.id)) { sfx('success'); toast(t('plots.built', { n: L(p) }), 'good'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small green', { style: { marginTop: '6px' } }) : h('span', { class: 'pill green' }, t('halls.max')));
  })));
  out.push(h('div', { class: 'title', style: { margin: '12px 0 6px' } }, t('halls.research')));
  const R = s.research;
  if (R.active) { const r = HALLS.research.find((x: any) => x.id === R.active); out.push(h('div', { class: 'card hl' }, t('research.active', { n: L(r), d: Math.max(0, R.until - s.day) }))); }
  out.push(div('grid3', ...HALLS.research.map((r: any) => { const done = R.done.includes(r.id); const avail = researchAvailable(g, r.id);
    return h('div', { class: 'card' + (done ? ' hl' : '') }, h('div', { style: { fontWeight: '900' } }, L(r)), h('div', { class: 'sub' }, t('research.desc.' + r.id)), done ? h('span', { class: 'pill green' }, '✓') : avail && !R.active ? btn(t('research.start', { m: money(r.cost), d: r.days }), () => { if (startResearch(g, r.id)) { sfx('success'); } else toast(t('ui.noMoney'), 'bad'); rerender(); }, 'small') : h('span', { class: 'sub' }, r.requires.length && !avail ? t('research.needs') : ''));
  })));
  return out;
}

function settingsView(app: App, closeOffice: () => void) {
  const g = app.g; const st = g.s.settings; const apply = () => { app.applySettings(); app.persist(); };
  const row = (label: string, ctl: Node) => h('div', { class: 'list-line', style: { alignItems: 'center' } }, h('span', { style: { fontWeight: '800' } }, label), ctl);
  const seg = <T extends string>(opts: T[], cur: T, label: (o: T) => string, pick: (o: T) => void) => { const wrap = h('div', { class: 'choice-grid' }); const draw = (c: T) => wrap.replaceChildren(...opts.map((o) => h('button', { class: 'choice' + (o === c ? ' on' : ''), onClick: () => { pick(o); draw(o); } }, label(o)))); draw(cur); return wrap; };
  const slider = (v: number, min: number, max: number, step: number, on: (n: number) => void) => { const s = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(v), style: { maxWidth: '200px' } }) as HTMLInputElement; s.addEventListener('change', () => on(Number(s.value))); return s; };
  const nameIn = h('input', { type: 'text', value: g.hall.name, maxlength: '28' }) as HTMLInputElement; nameIn.addEventListener('change', () => { g.hall.name = nameIn.value.trim() || g.hall.name; app.world.loadHall(); app.world.setupDay(); app.persist(); });
  const cheatIn = h('input', { type: 'text', placeholder: 'ROSE-…' }) as HTMLInputElement;
  return [h('div', { class: 'card' },
    row(t('settings.hallName'), h('div', { style: { width: '220px' } }, nameIn)),
    row(t('settings.quality'), seg(['smooth', 'high', 'ultra'] as const, st.quality, (o) => t('quality.' + o), (o) => { st.quality = o; apply(); })),
    row(t('settings.shadows'), toggle(st.shadows, (v) => { st.shadows = v; apply(); })), row(t('settings.glow'), toggle(st.glow, (v) => { st.glow = v; apply(); })), row(t('settings.particles'), toggle(st.particles, (v) => { st.particles = v; apply(); })),
    row(t('settings.cameraSpeed'), slider(st.cameraSpeed, 0.5, 2, 0.1, (n) => { st.cameraSpeed = n; apply(); })), row(t('settings.invert'), toggle(st.invertRotation, (v) => { st.invertRotation = v; apply(); })), row(t('settings.autoCamera'), toggle(st.autoCamera, (v) => { st.autoCamera = v; apply(); })),
    row(t('settings.length'), seg(['short', 'normal', 'long'] as const, st.weddingLength, (o) => t('length.' + o), (o) => { st.weddingLength = o; apply(); })),
    row(t('settings.music'), slider(st.music, 0, 1, 0.05, (n) => { st.music = n; apply(); })), row(t('settings.sound'), slider(st.sound, 0, 1, 0.05, (n) => { st.sound = n; apply(); })), row(t('settings.haptics'), toggle(st.haptics, (v) => { st.haptics = v; apply(); })),
    row(t('settings.bubbles'), toggle(st.bubbles, (v) => { st.bubbles = v; apply(); })), row(t('settings.floating'), toggle(st.floatingMoney, (v) => { st.floatingMoney = v; apply(); })),
    row(t('settings.language'), seg(['en', 'ar'] as const, getLang(), (o) => (o === 'en' ? 'English' : 'العربية'), (o) => { setLang(o); closeOffice(); })),
    CHEATS_ENABLED ? row(t('settings.cheat'), h('div', { class: 'row', style: { width: '260px' } }, cheatIn, btn(t('settings.apply'), () => { const ok = runCheat(g, cheatIn.value); toast(ok ? t('settings.cheatOk') : t('settings.cheatBad'), ok ? 'good' : 'bad'); if (ok) { app.world.loadHall(); app.world.setupDay(); app.refresh(); } }, 'small'))) : null,
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn(t('settings.backToTitle'), () => { closeOffice(); app.backToTitle(); }, 'red'))),
    h('div', { class: 'sub', style: { textAlign: 'center' } }, t('settings.version', { v: '1.0.0' }))];
}
export { num, staffIn, PLOT_BY_ID, loanDef, shopItem, stars, ic, _u };
