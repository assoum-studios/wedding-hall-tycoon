// The phone: Vowly (social app), Messages, Calls, Gallery, Bank.
import type { App } from './app';
import { t, L, money, num } from '../core/i18n';
import { CONTENT, CFG } from '../core/data';
import { postWedding, boostPost, answerMessage, unreadCount } from '../phone/phone';
import { answerCall } from '../progress/events';
import { owed } from '../business/loans';
import { h, div, btn, ic, uiRoot, toast } from './dom';
import { sfx, haptic } from '../audio/audio';
import { openOffice } from './office';

export function openPhone(app: App, appId: string | null = null) {
  const g = app.g; let cur = appId;
  const bd = h('div', { class: 'backdrop' }); const opened = performance.now(); let downOn = false;
  bd.addEventListener('pointerdown', (e) => { downOn = e.target === bd && performance.now() - opened > 400; e.stopPropagation(); });
  bd.addEventListener('pointerup', (e) => { if (downOn && e.target === bd) close(); downOn = false; });
  const phone = div('phone'); const scr = div('screen-in'); phone.append(scr); bd.append(phone); uiRoot().append(bd); sfx('open');
  function close() { bd.remove(); app.refresh(); }
  const head = (title: string) => div('apphead', btn('‹', () => { cur = null; render(); }, 'small ghost', { 'aria-label': t('ui.back') }), h('span', { class: 'grow' }, title), btn('✕', close, 'small red', { 'aria-label': t('ui.close') }));
  const render = () => {
    scr.replaceChildren();
    if (!cur) {
      const appBtn = (id: string, icon: any, color: string, label: string, badge = 0) => h('button', { class: 'app', onClick: () => { cur = id; render(); } }, h('span', { class: 'ai', style: { background: color } }, ic(icon)), label, badge ? h('span', { class: 'badge', style: { position: 'absolute', top: '-4px', right: '6px' } }, String(badge)) : null);
      scr.append(div('apphead', h('span', { class: 'grow' }, t('phone.title')), btn('✕', close, 'small red')), div('apps',
        appBtn('vowly', 'heart', 'linear-gradient(135deg,#ff5d8f,#ffb347)', t('phone.vowly')), appBtn('messages', 'msg', 'linear-gradient(#6ddc56,#36b44a)', t('phone.messages'), unreadCount(g)),
        appBtn('calls', 'call', 'linear-gradient(#5b8ff0,#1f4fb8)', t('phone.calls'), g.s.pendingCalls.length), appBtn('gallery', 'camera', 'linear-gradient(#ffd27a,#e2a13a)', t('phone.gallery')),
        appBtn('bank', 'bank', 'linear-gradient(#9aa3b0,#4b5563)', t('phone.bank'))));
      return;
    }
    if (cur === 'vowly') {
      const unposted = [...g.s.history].reverse().filter((r) => !g.s.posts.some((p) => p.id === 'post_' + r.id)).slice(0, 3);
      scr.append(head(t('phone.vowly')), div('appbody',
        h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'avatar' }, '🌹'), h('div', { class: 'grow' }, h('div', { class: 'title' }, '@' + g.hall.name.replace(/\s+/g, '').toLowerCase()), h('div', { class: 'sub' }, t('vowly.followers', { n: num(g.s.followers) }) + ' · ' + t('vowly.posts', { n: g.s.posts.length }))))),
        g.s.staff.some((e) => e.role === 'social') ? h('div', { class: 'sub', style: { margin: '4px 0 8px' } }, t('vowly.smm')) : h('div', { class: 'sub', style: { margin: '4px 0 8px' } }, t('vowly.hireSmm')),
        ...unposted.map((r) => h('div', { class: 'card hl' }, r.photo ? h('img', { src: r.photo, style: { width: '100%', borderRadius: '10px' } }) : null, h('div', { style: { fontWeight: '800' } }, L(r.names[0]) + ' & ' + L(r.names[1]) + ' · ' + r.happiness + '%'), btn(t('vowly.post'), () => { const gain = postWedding(g, r); if (gain) { sfx('success'); toast(t('vowly.posted', { n: num(gain) }), 'good'); } render(); }, 'green small'))),
        ...g.s.posts.map((p) => h('div', { class: 'card post' }, p.photo ? h('img', { src: p.photo }) : h('div', { style: { height: '120px', borderRadius: '12px', background: 'linear-gradient(135deg,#ffd6e0,#dbe7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' } }, '💍'),
          h('div', { class: 'row', style: { marginTop: '6px' } }, h('b', { class: 'grow' }, L(p.caption)), h('span', {}, '♥ ' + num(p.likes))),
          ...p.comments.map((c) => h('div', { class: 'sub' }, '💬 ' + L(CONTENT.vowlyComments[c]))),
          !p.boosted ? btn(t('vowly.boost', { m: money(CFG.followers.boostCost) }), () => { if (boostPost(g, p.id)) { sfx('coin'); toast(t('vowly.boosted'), 'good'); } else toast(t('ui.noMoney'), 'bad'); render(); }, 'small gold') : h('span', { class: 'pill gold' }, t('vowly.boostedTag'))))));
    }
    if (cur === 'messages') {
      for (const m of g.s.messages) m.read = true;
      scr.append(head(t('phone.messages')), div('appbody', ...(g.s.messages.length ? g.s.messages.map((m) => h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, L(m.from)), h('span', { class: 'sub' }, t('phone.day', { n: m.day + 1 }))), h('div', { style: { margin: '6px 0' } }, L(m.text)),
        m.choices && m.answered == null ? div('row wrap', ...m.choices.map((c, i) => btn(L(c.label), () => { answerMessage(g, m, i); sfx('tap'); render(); }, 'small ' + (i === 0 ? 'green' : 'ghost')))) : m.choices ? h('span', { class: 'pill' }, '✓ ' + L(m.choices[m.answered!].label)) : null,
        m.kind === 'raise' || m.kind === 'quit' ? null : null)) : [h('div', { class: 'empty' }, t('phone.noMessages'))])));
    }
    if (cur === 'calls') {
      scr.append(head(t('phone.calls')), div('appbody', ...(g.s.pendingCalls.length ? g.s.pendingCalls.map((c) => h('div', { class: 'card' }, h('div', { class: 'title' }, t('call.' + c.who)), div('row', btn(t('call.answer'), () => { const r = answerCall(g, c.id, true); if (r) toast(t('call.result.' + r.who), 'good'); render(); }, 'green small'), btn(t('call.decline'), () => { answerCall(g, c.id, false); render(); }, 'red small')))) : [h('div', { class: 'empty' }, t('phone.noCalls'))])));
    }
    if (cur === 'gallery') {
      scr.append(head(t('phone.gallery')), div('appbody', ...(g.s.photos.length ? [div('grid3', ...[...g.s.photos].reverse().map((p) => h('div', { class: 'card', style: { padding: '4px' } }, h('img', { src: p.data, style: { width: '100%', borderRadius: '8px' } }), h('div', { class: 'sub' }, L(p.names[0]) + ' & ' + L(p.names[1])))))] : [h('div', { class: 'empty' }, t('phone.noPhotos'))])));
    }
    if (cur === 'bank') {
      scr.append(head(t('phone.bank')), div('appbody', h('div', { class: 'card' }, h('div', { class: 'sub' }, t('money.balance')), h('div', { class: 'big-score', style: { fontSize: '34px' } }, money(g.s.money))),
        g.s.rosaDebt > 0 ? h('div', { class: 'card' }, t('money.rosaDebt', { m: money(g.s.rosaDebt) })) : null,
        ...g.s.loans.map((l) => h('div', { class: 'card' }, h('div', { class: 'title' }, t('loan.cat.' + l.cat)), h('div', { class: 'sub' }, t('money.owed') + ': ' + money(owed(l)) + ' · ' + t('money.weekly') + ': ' + money(l.weekly)))),
        btn(t('phone.openMoney'), () => { close(); openOffice(app, 'money'); }, 'small')));
    }
  };
  render(); return { close };
}

/** Incoming call pops up on screen with a ringtone. Answer or decline. */
export function showIncomingCall(app: App) {
  const g = app.g; const c = g.s.pendingCalls[0]; if (!c || document.querySelector('.call')) return;
  sfx('ring'); haptic(300);
  const el = h('div', { class: 'call' }, h('div', { class: 'avatar' }, c.who === 'victor' ? 'V' : c.who === 'client' ? '💍' : c.who === 'journalist' ? '📰' : '🌸'), h('div', { class: 'grow' }, h('div', { style: { fontWeight: '900' } }, t('call.' + c.who)), h('div', { class: 'sub', style: { color: '#ccc' } }, t('call.incoming'))),
    btn('✕', () => { answerCall(g, c.id, false); el.remove(); app.refresh(); }, 'red small', { 'aria-label': t('call.decline') }),
    btn('✓', () => { const r = answerCall(g, c.id, true); el.remove(); if (r) toast(c.who === 'victor' ? L(CONTENT.victorTaunts[Math.floor(Math.random() * CONTENT.victorTaunts.length)]) : t('call.result.' + r.who), c.who === 'victor' ? 'bad' : 'good'); app.refresh(); }, 'green small', { 'aria-label': t('call.answer') }));
  uiRoot().append(el); setTimeout(() => { if (el.isConnected) { el.remove(); } }, 15000);
}
