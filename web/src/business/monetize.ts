// Ads and in-app purchases. On Android the native shell exposes window.NativeBridge (AdMob + Google Play Billing)
// and answers through window.__nativeEvent. In a browser (the iPhone test build) none of this exists, so every
// ad/purchase button is simply hidden and the game plays exactly the same.
import type { Game } from '../core/game';

export type ProductId = 'remove_ads' | 'starter_bundle' | 'cash_small' | 'cash_medium' | 'cash_large' | 'luxury_decor_pack' | 'owner_style_pack';
export interface Product { id: ProductId; kind: 'consumable' | 'one_time'; cash?: number; fallbackPrice: string; icon: string; }
export const PRODUCTS: Product[] = [
  { id: 'starter_bundle', kind: 'one_time', cash: 200000, fallbackPrice: '$1.99', icon: '🎁' },
  { id: 'remove_ads', kind: 'one_time', fallbackPrice: '$0.99', icon: '🚫' },
  { id: 'luxury_decor_pack', kind: 'one_time', fallbackPrice: '$0.99', icon: '💎' },
  { id: 'owner_style_pack', kind: 'one_time', fallbackPrice: '$0.99', icon: '👔' },
  { id: 'cash_small', kind: 'consumable', cash: 100000, fallbackPrice: '$0.99', icon: '💵' },
  { id: 'cash_medium', kind: 'consumable', cash: 200000, fallbackPrice: '$1.99', icon: '💰' },
  { id: 'cash_large', kind: 'consumable', cash: 1000000, fallbackPrice: '$4.99', icon: '🏦' },
];
const NB = (): any => (window as any).NativeBridge;
export const isNative = () => { try { return !!NB()?.isNative?.(); } catch { return false; } };

// Owned one-time products live on the device (they belong to the Google account, not to one save slot).
const OWN_KEY = 'whot_owned'; const PENDING_KEY = 'whot_pending_cash';
const read = (k: string, d: any) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let owned = new Set<string>(read(OWN_KEY, []));
const prices: Record<string, string> = {};
let game: Game | null = null; const listeners = new Set<() => void>();
const rewardWaiters = new Map<string, (ok: boolean) => void>();
let onToast: (text: string, kind: 'good' | 'bad' | 'info') => void = () => {};
let tr: (k: string, p?: any) => string = (k) => k;

export function owns(id: ProductId) { return owned.has(id); }
export function adsRemoved() { return owned.has('remove_ads') || owned.has('starter_bundle') || !!game?.s.removeAds; }
export function decorOwned() { return owned.has('luxury_decor_pack') || owned.has('starter_bundle'); }
export function styleOwned() { return owned.has('owner_style_pack'); }
export function priceOf(id: ProductId) { return prices[id] || PRODUCTS.find((p) => p.id === id)!.fallbackPrice; }
export function onStoreChange(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => listeners.forEach((f) => f());

/** Called once at boot with the toast and translate functions (keeps this module free of UI imports). */
export function initMonetize(toast: typeof onToast, translate: typeof tr) {
  onToast = toast; tr = translate;
  (window as any).__nativeEvent = (e: any) => { try { handle(e); } catch (err) { console.warn(err); } };
}
/** The game currently loaded (cash packs go into it; pending cash waits until one is loaded). */
export function bindGame(g: Game | null) {
  game = g; if (!g || g.s.slot < 0) return;
  syncOwnedIntoSave();
  const pending: number = read(PENDING_KEY, 0);
  if (pending > 0) { write(PENDING_KEY, 0); g.addMoney(pending); onToast(tr('store.cashAdded', { m: pending.toLocaleString() }), 'good'); }
}
function syncOwnedIntoSave() {
  const g = game; if (!g || g.s.slot < 0) return;
  if (owned.has('remove_ads') || owned.has('starter_bundle')) g.s.removeAds = true;
  if (decorOwned()) for (const id of PREMIUM_DECOR()) if (!g.s.shopOwned.includes(id)) g.s.shopOwned.push(id);
  g.emit('cosmetics');
}
let PREMIUM_DECOR: () => string[] = () => [];
export function setPremiumDecorList(fn: () => string[]) { PREMIUM_DECOR = fn; }

function grantCash(n: number) {
  if (game && game.s.slot >= 0) { game.addMoney(n); onToast(tr('store.cashAdded', { m: n.toLocaleString() }), 'good'); }
  else { write(PENDING_KEY, read(PENDING_KEY, 0) + n); onToast(tr('store.cashPending'), 'good'); }
}
function handle(e: any) {
  switch (e.type) {
    case 'products': for (const p of e.list ?? []) if (p.price) prices[p.id] = p.price; changed(); break;
    case 'owned': for (const id of e.list ?? []) owned.add(id); write(OWN_KEY, [...owned]); syncOwnedIntoSave(); changed(); break;
    case 'purchase': {
      const p = PRODUCTS.find((x) => x.id === e.id); if (!p) break;
      if (p.kind === 'one_time') {
        const isNew = !owned.has(p.id); owned.add(p.id); write(OWN_KEY, [...owned]);
        if (isNew && p.cash) grantCash(p.cash);
        syncOwnedIntoSave(); if (isNew) onToast(tr('store.thanks'), 'good');
      } else if (p.cash) grantCash(p.cash);
      game?.emit('money', 0); changed(); break;
    }
    case 'purchaseCancelled': break;
    case 'purchasePending': onToast(tr('store.pending'), 'info'); break;
    case 'purchaseFailed': onToast(tr('store.failed'), 'bad'); break;
    case 'reward': { const w = rewardWaiters.get(e.tag); rewardWaiters.delete(e.tag); w?.(!!e.ok); if (!e.ok) onToast(tr('ads.notReady'), 'info'); break; }
    case 'adReady': changed(); break;
  }
}

export function buy(id: ProductId) { if (!isNative()) { onToast(tr('store.androidOnly'), 'info'); return; } try { NB().buy(id); } catch {} }
export function restore() { if (isNative()) try { NB().restorePurchases(); } catch {} }
export function rewardedAvailable() { return isNative(); }
/** Show a rewarded ad; resolves true only if the player watched it to the end. */
export function showRewarded(tag: string): Promise<boolean> {
  if (!isNative()) return Promise.resolve(false);
  return new Promise((res) => { rewardWaiters.set(tag, res); try { NB().showRewarded(tag); } catch { rewardWaiters.delete(tag); res(false); } });
}
// Interstitials: rare, only at a natural break (after the wedding report), never in the first in-game days,
// at most one every 3 in-game days and 4 real minutes, and never for players who removed ads.
let lastInterstitial = Date.now(); let lastDay = -99;
export function maybeInterstitial(day: number) {
  if (!isNative() || adsRemoved() || day < 3) return;
  if (day - lastDay < 3 || Date.now() - lastInterstitial < 4 * 60 * 1000) return;
  lastDay = day; lastInterstitial = Date.now(); try { NB().showInterstitial(); } catch {}
}
export function privacyOptionsRequired() { try { return isNative() && !!NB().privacyOptionsRequired(); } catch { return false; } }
export function showPrivacyOptions() { try { NB().showPrivacyOptions(); } catch {} }
