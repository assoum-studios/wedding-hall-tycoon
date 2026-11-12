// Bookings: client requests, the 3D meeting, the invoice and negotiation, referrals, planning, calendar and the small hall.
import type { App } from './app';
import type { ClientRequest, Booking, Plan } from '../core/types';
import { t, L, money, num } from '../core/i18n';
import { CFG, CONTENT, BIZ, HALLS } from '../core/data';
import { invoiceLines, invoiceTotals, evaluateOffer, book, rejectRequest, dateTaken, referralOptions, refer, referChance, meetMiddle, type InvoiceLine } from '../weddings/clients';
import { planMatches, managerPlan } from '../weddings/night';
import { FOOD, type FoodTier } from '../weddings/quality';
import { managerOf, effSkill, staffIn } from '../staff/staff';
import { acceptSmall, declineSmall } from '../business/plots';
import { h, div, btn, ic, modal, tabs, toast, bar } from './dom';
import { sfx } from '../audio/audio';

export function openBookings(app: App, tab = 'requests', focus?: string) {
  const g = app.g; let cur = tab;
  const m = modal(t('book.title'), [], { cls: 'wide' });
  const render = () => {
    const smallBuilt = g.hasPlot(g.s.activeHall, 'small_hall');
    const tabsEl = tabs([{ id: 'requests', label: t('book.requests'), badge: g.s.requests.filter((r) => r.hall === g.s.activeHall).length }, { id: 'calendar', label: t('book.calendar') }, ...(smallBuilt ? [{ id: 'small', label: t('book.smallHall') }] : [])], cur, (id) => { cur = id; render(); });
    m.panel.querySelector('.tabs')?.remove(); m.panel.insertBefore(tabsEl, m.body);
    if (cur === 'requests') m.setBody(requestsView(app, m.close, render));
    else if (cur === 'calendar') m.setBody(calendarView(app, render, focus));
    else m.setBody(smallView(app, render));
  };
  const off = [g.on('requests', render), g.on('booking', render)];
  const oldClose = m.close; m.close = () => { off.forEach((f) => f()); oldClose(); app.refresh(); };
  render(); return m;
}

function daysLabel(app: App, day: number) { const d = day - app.g.s.day; return d <= 0 ? t('book.today') : d === 1 ? t('book.tomorrow') : t('book.inDays', { n: d }); }
function dateLabel(app: App, day: number) { const d = app.g.date(day); return t('hud.dateShort', { d: d.dom, m: t('month.' + d.month) }); }

function requestsView(app: App, closeAll: () => void, rerender: () => void) {
  const g = app.g; const list = g.s.requests.filter((r) => r.hall === g.s.activeHall);
  if (!list.length) return [h('div', { class: 'empty' }, t('book.noRequests'))];
  return [div('grid2', ...list.map((r) => {
    const taken = dateTaken(g, r.hall, r.date); const refs = taken ? referralOptions(g, r) : [];
    return h('div', { class: 'card' + (r.vip || r.celebrity ? ' hl' : '') },
      h('div', { class: 'row' }, h('div', { class: 'avatar' }, '💍'), h('div', { class: 'grow' }, h('div', { class: 'title' }, L(r.groom) + ' & ' + L(r.bride)), h('div', { class: 'sub' }, L(CFG.personalities[r.personality])))),
      h('div', { class: 'row wrap', style: { margin: '8px 0' } }, h('span', { class: 'pill blue' }, '👥 ' + num(r.guests)), h('span', { class: 'pill' }, '📅 ' + dateLabel(app, r.date) + ' · ' + daysLabel(app, r.date)), r.celebrity ? h('span', { class: 'pill gold' }, '⭐ ' + t('book.celebrity')) : r.vip ? h('span', { class: 'pill gold' }, t('book.vip')) : null, r.returning ? h('span', { class: 'pill green' }, t('book.referred')) : null,
        h('span', { class: 'pill red' }, t('book.expires', { d: daysLabel(app, r.expires) }))),
      taken ? h('div', { class: 'sub', style: { marginBottom: '6px' } }, '⚠ ' + t('book.dateTaken')) : null,
      h('div', { class: 'row wrap' },
        !taken ? btn([ic('people'), t('book.meet')], () => { closeAll(); meeting(app, r); }, 'green small', { 'data-req': r.id }) : null,
        ...refs.map(({ i }) => btn(t('book.referTo', { h: g.s.halls[i].name, p: Math.round(referChance(g, r, i) * 100) }), () => { const ok = refer(g, r, i); toast(ok ? t('book.referOk') : t('book.referNo'), ok ? 'good' : 'bad'); rerender(); }, 'small')),
        btn(t('book.decline'), () => { rejectRequest(g, r); rerender(); }, 'ghost small')));
  }))];
}

// ---------------- The meeting at the reception desk ----------------
export function meeting(app: App, r: ClientRequest) {
  const g = app.g; const w = app.world; const prevMode = w.mode;
  const actors = w.setupMeeting(r.look.g, r.look.b); app.hud.replaceChildren();
  const voice = CONTENT.themeVoice[r.theme][r.story % CONTENT.themeVoice[r.theme].length];
  const pLine = CONTENT.personalityLines[r.personality][r.story % 2];
  const wishes = [t('wish.flower.' + r.flower), t('wish.light.' + r.light), t('wish.music.' + r.music), r.venue !== 'main' ? t('wish.venue.' + r.venue) : null].filter(Boolean).join(' ');
  const lines = [L(CONTENT.loveStories[r.story]), L(pLine), L(voice) + ' ' + wishes, t('meet.guests', { n: r.guests, m: L(CFG.menus[r.menu]) })];
  let i = 0; actors.groom.anim = 'sitTalk';
  const text = h('div', { class: 'quote', style: { fontSize: '17px', minHeight: '64px' } }, lines[0]);
  const next = btn([t('ui.next'), ic('next')], () => {
    i++; if (i < lines.length) { text.textContent = lines[i]; actors.groom.anim = i % 2 ? 'sit' : 'sitTalk'; actors.bride.anim = i % 2 ? 'sitTalk' : 'sit'; if (r.personality === 'emotional' && i === 2) actors.bride.anim = 'cry'; sfx('tap'); }
    if (i >= lines.length - 1) { next.replaceWith(invoiceBtn); }
  }, 'green', { id: 'meet-next' });
  const invoiceBtn = btn([ic('book'), t('meet.writeInvoice')], () => { m.close(); invoice(app, r, () => { w.endMeeting(); app.refresh(); }); }, 'green', { id: 'meet-invoice' });
  const m = modal(L(r.groom) + ' & ' + L(r.bride), [h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'pill' }, L(CFG.personalities[r.personality])), h('span', { class: 'pill blue' }, '👥 ' + r.guests), h('span', { class: 'pill' }, dateLabel(app, r.date))), text,
    h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '10px' } }, btn(t('meet.leave'), () => { m.close(); w.endMeeting(); app.refresh(); }, 'ghost small'), next)], { cls: 'narrow', noClose: true });
  // place the dialog at the bottom so the 3D couple stays visible
  (m.el as HTMLElement).style.alignItems = 'flex-end'; (m.el as HTMLElement).style.background = 'rgba(20,16,50,.12)';
  app.tutorial?.event('meeting'); void prevMode; void g;
}

// ---------------- Invoice and negotiation ----------------
export function invoice(app: App, r: ClientRequest, done: () => void) {
  const g = app.g; let lines = invoiceLines(g, r); let level = 1.2;
  const m = modal(t('inv.title'), [], { cls: 'narrow', onClose: () => done() });
  // The slider only updates numbers in place (re-drawing the window would interrupt the finger drag).
  const priceCells: { el: HTMLElement; l: InvoiceLine }[] = []; const lvlEl = h('b', {}); const totEl = h('b', { class: 'money' }); const costEl = h('b', {}); const profEl = h('b', {}); const depEl = h('b', {});
  const update = () => {
    const tt = invoiceTotals(lines, level); const profit = tt.total - tt.cost;
    for (const c of priceCells) c.el.textContent = money(c.l.price * level);
    lvlEl.textContent = Math.round(level * 100) + '%'; totEl.textContent = money(tt.total); costEl.textContent = money(tt.cost);
    profEl.textContent = money(profit); profEl.className = profit < 0 ? 'neg' : 'money'; depEl.textContent = money(tt.total * CFG.pricing.depositShare);
  };
  const slider = h('input', { type: 'range', class: 'price-slider', min: String(CFG.pricing.priceLevelMin * 100), max: String(CFG.pricing.priceLevelMax * 100), step: '1', value: String(Math.round(level * 100)), id: 'price-level' }) as HTMLInputElement;
  slider.addEventListener('input', () => { level = Number(slider.value) / 100; update(); });
  for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove']) slider.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const render = () => {
    priceCells.length = 0;
    m.setBody([
      h('div', { class: 'sub', style: { marginBottom: '6px' } }, t('inv.help')),
      h('div', { class: 'inv-line', style: { fontWeight: '900' } }, h('span', { style: { width: '28px' } }), h('span', { class: 'grow' }, t('inv.item')), h('span', { style: { width: '80px', textAlign: 'end' } }, t('inv.cost')), h('span', { style: { width: '84px', textAlign: 'end' } }, t('inv.price'))),
      ...lines.map((l) => { const pe = h('b', { style: { width: '84px', textAlign: 'end' } }); priceCells.push({ el: pe, l }); return h('div', { class: 'inv-line' + (l.on ? '' : ' off') },
        l.fixed ? h('span', { style: { width: '28px' } }, '🔒') : h('button', { class: 'chk' + (l.on ? ' on' : ''), disabled: !l.available, onClick: () => { l.on = !l.on; render(); }, 'aria-label': L(l.label) }),
        h('span', { class: 'grow' }, L(l.label), !l.available ? h('div', { class: 'sub' }, t('inv.needs')) : null), h('span', { class: 'sub', style: { width: '80px', textAlign: 'end' } }, money(l.cost)), pe); }),
      h('div', { class: 'card', style: { marginTop: '10px' } },
        h('div', { class: 'row' }, h('b', {}, t('inv.priceLevel')), h('span', { class: 'grow' }), lvlEl), slider,
        h('div', { class: 'list-line' }, h('span', {}, t('inv.total')), totEl),
        h('div', { class: 'list-line' }, h('span', {}, t('inv.yourCost')), costEl),
        h('div', { class: 'list-line' }, h('span', {}, t('inv.profit')), profEl),
        h('div', { class: 'list-line' }, h('span', {}, t('inv.deposit')), depEl)),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn(t('ui.cancel'), () => m.close(), 'ghost'), btn([ic('check'), t('inv.send')], () => { const tt = invoiceTotals(lines, level); send(tt.total, tt.removed); }, 'green', { id: 'inv-send' })),
    ]);
    update();
  };
  const send = (total: number, removed: number) => {
    const res = evaluateOffer(g, r, total, removed);
    if (res.kind === 'accept') { const b = book(g, r, lines, level); sfx('success'); toast(t('inv.accepted', { m: money(b.deposit) }), 'good'); m.close(); app.tutorial?.event('booked'); }
    else if (res.kind === 'counter') {
      r.status = 'countered'; const middle = Math.round((total + res.amount) / 2 / 10) * 10;
      const cm = modal(t('inv.counterTitle'), [h('div', { class: 'quote' }, t('inv.counterText', { m: money(res.amount) })),
        h('div', { class: 'row wrap', style: { justifyContent: 'flex-end', marginTop: '12px' } },
          btn(t('inv.walkAway'), () => { cm.close(); rejectRequest(g, r); m.close(); }, 'ghost'),
          btn(t('inv.meetMiddle', { m: money(middle) }), () => { cm.close(); if (meetMiddle(g, r, middle, removed)) { const b = book(g, r, lines, level, middle); toast(t('inv.accepted', { m: money(b.deposit) }), 'good'); sfx('success'); } else { toast(t('inv.middleNo'), 'bad'); rejectRequest(g, r); } m.close(); }),
          btn(t('inv.acceptCounter'), () => { cm.close(); const b = book(g, r, lines, level, res.amount); toast(t('inv.accepted', { m: money(b.deposit) }), 'good'); sfx('success'); m.close(); app.tutorial?.event('booked'); }, 'green', { id: 'inv-accept-counter' }))], { cls: 'narrow', noClose: true });
    } else { sfx('fail'); toast(L(res.reason), 'bad'); rejectRequest(g, r); m.close(); }
  };
  render();
}

// ---------------- Calendar and planning ----------------
function calendarView(app: App, rerender: () => void, focus?: string) {
  const g = app.g; const list = g.s.bookings.filter((b) => b.hall === g.s.activeHall).sort((a, b) => a.date - b.date);
  const others = g.s.bookings.filter((b) => b.hall !== g.s.activeHall);
  // Month view: the next 28 days, booked days in gold. Tap a booked day to plan that wedding.
  const days = Array.from({ length: 28 }, (_, i) => g.s.day + i);
  const month = h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, t('cal.title')), h('span', { class: 'sub' }, t('cal.legend'))),
    div('cal-grid', ...days.map((d) => { const b = list.find((x) => x.date === d); const dd = g.date(d); const small = g.s.halls[g.s.activeHall].smallBookings.some((x) => x.date === d && x.accepted);
      return h('button', { class: 'cal-day' + (b ? ' booked' : '') + (d === g.s.day ? ' today' : ''), onClick: () => { if (b) planning(app, b, rerender); else toast(t('cal.free'), 'info'); } },
        h('span', { class: 'cal-n' }, String(dd.dom)), h('span', { class: 'cal-m' }, t('month.' + dd.month).slice(0, 3)), b ? h('span', { class: 'cal-dot' }, '💍') : small ? h('span', { class: 'cal-dot' }, '🎈') : null); })));
  if (!list.length && !others.length) return [month, h('div', { class: 'empty' }, t('book.noBookings'))];
  return [month, div('grid2', ...list.map((b) => h('div', { class: 'card' + (b.id === focus || b.date === g.s.day ? ' hl' : '') },
    h('div', { class: 'title' }, L(b.req.groom) + ' & ' + L(b.req.bride)),
    h('div', { class: 'row wrap', style: { margin: '6px 0' } }, h('span', { class: 'pill' }, dateLabel(app, b.date) + ' · ' + daysLabel(app, b.date)), h('span', { class: 'pill blue' }, '👥 ' + b.req.guests), h('span', { class: 'pill green' }, money(b.total))),
    h('div', { class: 'sub' }, b.plan.planned ? t('plan.done', { p: Math.round(Object.values(planMatches(b, b.plan)).filter(Boolean).length / 5 * 100) }) : t('plan.notYet')),
    h('div', { class: 'row', style: { marginTop: '8px' } }, btn([ic('gear'), t('plan.plan')], () => planning(app, b, rerender), b.plan.planned ? 'ghost small' : 'gold small', { 'data-plan': b.id }))))),
    others.length ? h('div', { class: 'sub', style: { marginTop: '10px' } }, t('book.otherHalls', { n: others.length })) : null];
}

export function planning(app: App, b: Booking, onDone?: () => void) {
  const g = app.g; const r = b.req; let plan: Plan = b.plan.planned ? { ...b.plan } : { theme: 'classic', flower: 'white', light: 'chandeliers', music: 'dj', venue: 'main', planned: false };
  // Seating plan puzzle: put each guest group in a zone. Rules come from the couple (feuding families, VIPs, kids).
  const feud = r.story % 3 === 0; const groups = ['brideFam', 'groomFam', 'friends', 'vip', 'kids'] as const; const zones = ['front', 'middle', 'back'] as const;
  const seat: Record<string, string> = (b as any).seatPlan ? { ...(b as any).seatPlan } : { brideFam: 'middle', groomFam: 'middle', friends: 'middle', vip: 'middle', kids: 'middle' };
  const seatScore = () => { let sc = 0; sc += seat.vip === 'front' ? 0.3 : seat.vip === 'back' ? -0.3 : 0; sc += seat.kids === 'back' ? 0.2 : seat.kids === 'front' ? -0.25 : 0;
    sc += seat.brideFam !== 'back' ? 0.15 : -0.15; sc += seat.groomFam !== 'back' ? 0.15 : -0.15; sc += seat.friends === 'middle' || seat.friends === 'back' ? 0.1 : 0;
    if (feud) sc += seat.brideFam === seat.groomFam ? -0.5 : 0.2; return Math.max(-1, Math.min(1, sc)); };
  if (!plan.food) plan.food = 'standard';
  const venues = Object.keys(CFG.venues).filter((v) => v === 'main' || g.hasPlot(b.hall, CFG.venues[v].plot));
  const preview = () => { if (app.world.mode === 'day' && b.hall === g.s.activeHall) app.world.view.applyPlan(plan); };
  const m = modal(t('plan.title', { n: L(r.groom) + ' & ' + L(r.bride) }), [], { onClose: () => { if (app.world.mode === 'day') app.world.view.applyPlan(null); onDone?.(); } });
  const chips = <T extends string>(ids: T[], cur: T, label: (id: T) => string, color: (id: T) => string | null, pick: (id: T) => void) =>
    div('choice-grid', ...ids.map((id) => h('button', { class: 'choice' + (id === cur ? ' on' : ''), onClick: () => { pick(id); preview(); render(); } }, color(id) ? h('span', { class: 'dot', style: { background: color(id)! } }) : null, label(id))));
  const render = () => {
    const voice = CONTENT.themeVoice[r.theme][r.story % CONTENT.themeVoice[r.theme].length];
    const mgr = managerOf(g, b.hall);
    m.setBody([
      h('div', { class: 'quote' }, '“' + L(voice) + ' ' + [t('wish.flower.' + r.flower), t('wish.light.' + r.light), t('wish.music.' + r.music)].join(' ') + (r.venue !== 'main' ? ' ' + t('wish.venue.' + r.venue) : '') + '”'),
      h('div', { class: 'title', style: { marginTop: '10px' } }, t('plan.theme')), chips(Object.keys(CFG.themes) as any[], plan.theme, (id) => L(CFG.themes[id]), (id) => CFG.themes[id].colors[0], (id) => (plan.theme = id)),
      h('div', { class: 'title', style: { marginTop: '10px' } }, t('plan.flowers')), chips(Object.keys(CFG.flowers), plan.flower, (id) => L(CFG.flowers[id]), (id) => CFG.flowers[id].color, (id) => (plan.flower = id)),
      h('div', { class: 'title', style: { marginTop: '10px' } }, t('plan.lighting')), chips(Object.keys(CFG.lighting), plan.light, (id) => L(CFG.lighting[id]), (id) => CFG.lighting[id].color, (id) => (plan.light = id)),
      h('div', { class: 'title', style: { marginTop: '10px' } }, t('plan.music')), chips(Object.keys(CFG.music), plan.music, (id) => L(CFG.music[id]), () => null, (id) => (plan.music = id)),
      h('div', { class: 'title', style: { marginTop: '10px' } }, t('plan.venue')), chips(venues, plan.venue, (id) => L(CFG.venues[id]), () => null, (id) => (plan.venue = id)),
      h('div', { class: 'title', style: { marginTop: '10px' } }, t('plan.food')), chips(['standard', 'premium', 'luxury'] as any[], plan.food!, (id) => t('food.' + id) + ' · +' + money(Math.round(r.guests * (CFG.menus[r.menu]?.cost ?? 20) * (FOOD[id as FoodTier].costMult - 1))), () => null, (id) => (plan.food = id)),
      h('div', { class: 'title', style: { marginTop: '10px' } }, t('plan.zones')), h('div', { class: 'sub' }, t('plan.zonesHelp', { n: staffIn(g, b.hall, 'waiter').length })),
      chips(['off', 'on'] as any[], plan.zones ? 'on' : 'off', (id) => t('plan.zones.' + id), () => null, (id) => (plan.zones = id === 'on')),
      h('div', { class: 'title', style: { marginTop: '12px' } }, t('seat.title')), h('div', { class: 'sub' }, feud ? '⚠ ' + t('seat.feud') : t('seat.help')),
      ...groups.map((gr) => h('div', { class: 'row wrap', style: { margin: '4px 0' } }, h('span', { style: { width: '120px', fontWeight: '800' } }, t('seat.' + gr)),
        ...zones.map((z) => h('button', { class: 'choice' + (seat[gr] === z ? ' on' : ''), onClick: () => { seat[gr] = z; render(); } }, t('zone.' + z))))),
      h('div', { class: 'sub', style: { marginTop: '4px' } }, t('seat.score', { s: Math.round(seatScore() * 100) })),
      h('div', { class: 'row wrap', style: { justifyContent: 'flex-end', marginTop: '14px' } },
        mgr ? btn(t('plan.byManager', { n: L(mgr.name) }), () => { b.plan = managerPlan(g, b, effSkill(mgr)); toast(t('plan.managerDone'), 'good'); m.close(); }, 'ghost') : null,
        btn([ic('check'), t('plan.confirm')], () => { b.plan = { ...plan, planned: true, seating: seatScore() }; (b as any).seatPlan = { ...seat }; sfx('success'); toast(t('plan.saved'), 'good'); m.close(); app.tutorial?.event('planned'); }, 'green', { id: 'plan-confirm' })),
    ]);
  };
  render(); preview();
}

// ---------------- Small hall bookings ----------------
function smallView(app: App, rerender: () => void) {
  const g = app.g; const h0 = g.hall; const list = [...h0.smallBookings].sort((a, b) => a.date - b.date);
  if (!list.length) return [h('div', { class: 'empty' }, t('small.none'))];
  return [div('grid2', ...list.map((b) => { const type = BIZ.smallHallTypes.find((x: any) => x.id === b.type);
    return h('div', { class: 'card' }, h('div', { class: 'title' }, L(type)), h('div', { class: 'row wrap', style: { margin: '6px 0' } }, h('span', { class: 'pill' }, dateLabel(app, b.date)), h('span', { class: 'pill blue' }, '👥 ' + b.guests), h('span', { class: 'pill green' }, money(b.price))),
      b.done ? h('div', {}, t('small.result', { p: b.result ?? 0 }), bar((b.result ?? 0) / 100)) : b.accepted ? h('span', { class: 'pill green' }, '✓ ' + t('small.accepted')) :
        h('div', { class: 'row' }, btn(t('small.accept'), () => { acceptSmall(g, g.s.activeHall, b.id); rerender(); }, 'green small'), btn(t('book.decline'), () => { declineSmall(g, g.s.activeHall, b.id); rerender(); }, 'ghost small')));
  }))];
}
export { HALLS, type InvoiceLine };
