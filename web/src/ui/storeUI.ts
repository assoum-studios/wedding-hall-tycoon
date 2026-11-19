// The Premium store (Google Play purchases) and the one-time Starter Bundle offer.
import type { App } from './app';
import { t } from '../core/i18n';
import { h, div, btn, modal } from './dom';
import { PRODUCTS, buy, owns, priceOf, isNative, restore, onStoreChange, adsRemoved, type ProductId } from '../business/monetize';

function productCard(id: ProductId, big = false): HTMLElement {
  const p = PRODUCTS.find((x) => x.id === id)!; const one = p.kind === 'one_time'; const have = one && owns(id) || (id === 'remove_ads' && adsRemoved());
  return h('div', { class: 'card store-card' + (big ? ' hl big' : '') },
    h('div', { class: 'row' }, h('div', { class: 'store-icon' }, p.icon), h('div', { class: 'grow' }, h('div', { class: 'title' }, t('store.' + id + '.t')), h('div', { class: 'sub' }, t('store.' + id + '.d')))),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, have ? h('span', { class: 'pill green' }, '✓ ' + t('store.owned')) : btn(priceOf(id), () => buy(id), 'gold', { 'data-product': id })));
}
export function premiumView(app: App, _rerender: () => void): (Node | null)[] {
  void app;
  if (!isNative()) return [h('div', { class: 'card hl' }, h('div', { class: 'title' }, '💎 ' + t('store.title')), h('div', { class: 'sub' }, t('store.androidOnly')))];
  const starter = owns('starter_bundle') ? null : productCard('starter_bundle', true);
  return [starter,
    h('div', { class: 'title', style: { margin: '10px 0 6px' } }, t('store.packs')), div('grid2', productCard('remove_ads'), productCard('luxury_decor_pack'), productCard('owner_style_pack')),
    h('div', { class: 'title', style: { margin: '10px 0 6px' } }, t('store.cash')), div('grid3', productCard('cash_small'), productCard('cash_medium'), productCard('cash_large')),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, btn(t('store.restore'), () => restore(), 'small ghost')),
    h('div', { class: 'sub', style: { textAlign: 'center' } }, t('store.note'))];
}
export function openStore(app: App) {
  const m = modal('💎 ' + t('store.title'), [], { cls: 'wide' });
  const render = () => m.setBody(premiumView(app, render)); render();
  const off = onStoreChange(() => { if (document.body.contains(m.el)) render(); });
  const oc = m.close; m.close = () => { off(); oc(); };
}
/** Shown once, after the player's first wedding report (Android only, if they don't own it yet). */
export function maybeStarterOffer(app: App) {
  const g = app.g; if (!isNative() || owns('starter_bundle') || g.s.history.length !== 1) return;
  try { if (localStorage.getItem('whot_starter_offer')) return; localStorage.setItem('whot_starter_offer', '1'); } catch {}
  const m = modal('🎁 ' + t('store.offerTitle'), [h('div', { class: 'sub', style: { marginBottom: '8px' } }, t('store.offerText')), productCard('starter_bundle', true),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, btn(t('store.later'), () => m.close(), 'ghost'))], { cls: 'narrow' });
  const off = onStoreChange(() => { if (owns('starter_bundle')) { off(); m.close(); } });
}
