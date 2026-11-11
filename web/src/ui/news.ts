// Morning news events with choices.
import type { App } from './app';
import { t, L } from '../core/i18n';
import { chooseNews, newsById } from '../progress/events';
import { h, btn, modal, toast } from './dom';
import { sfx } from '../audio/audio';
import { showIncomingCall } from './phoneUI';

export function showNews(app: App) {
  const g = app.g; const pn = g.s.pendingNews; if (!pn) return; const ev = newsById(pn.id); if (!ev) { g.s.pendingNews = null; return; }
  const [title, text] = L({ en: ev.en, ar: ev.ar }) as any;
  const m = modal(h('span', {}, (pn.sabotage ? '⚠ ' : '📰 ') + t('news.morning')), [
    h('div', { class: 'title', style: { fontSize: '22px' } }, title), h('p', { style: { fontWeight: '700', fontSize: '17px' } }, text),
    h('div', { class: 'col' }, ...ev.choices.map((c, i) => btn(L(c), () => { const r = chooseNews(g, i); m.close(); sfx(r?.failed ? 'fail' : 'success'); toast(r?.failed ? t('news.failed') : t('news.done'), r?.failed ? 'bad' : 'good'); app.refresh(); app.persist(); if (g.s.pendingCalls.length) setTimeout(() => showIncomingCall(app), 800); }, i === 0 ? 'green' : 'ghost', { 'data-choice': String(i) }))),
  ], { cls: 'narrow', noClose: true });
  sfx('alert');
}
