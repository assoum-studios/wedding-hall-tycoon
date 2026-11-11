// Tiny DOM helpers, icons, modal manager (menus never close from the tap that opened them), toasts.
import { t } from '../core/i18n';
import { sfx, haptic } from '../audio/audio';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined | false | (Node | string | null | undefined | false)[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), k === 'onClick' ? (e: Event) => { sfx('tap'); haptic(8); v(e); } : v);
    else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
export const div = (cls: string, ...kids: any[]) => h('div', { class: cls }, ...kids);
export const btn = (label: any, onClick: () => void, cls = '', attrs: Record<string, any> = {}) => h('button', { class: 'btn ' + cls, onClick, ...attrs }, ...(Array.isArray(label) ? label : [label]));
export function toggle(on: boolean, onChange: (v: boolean) => void) { const el = h('button', { class: 'toggle' + (on ? ' on' : ''), 'aria-pressed': String(on) }); el.addEventListener('click', () => { on = !on; el.classList.toggle('on', on); sfx('tap'); onChange(on); }); return el; }
export function bar(frac: number, cls = '') { return h('div', { class: 'bar ' + cls }, h('i', { style: { width: Math.max(0, Math.min(100, frac * 100)) + '%' } })); }
export function stars(n: number) { const el = h('span', { class: 'stars' }); for (let i = 0; i < 5; i++) { const f = Math.max(0, Math.min(1, n - i)); el.append(h('span', { class: 'star' }, h('span', { class: 'star-bg' }, '★'), h('span', { class: 'star-fg', style: { width: Math.round(f * 100) + '%' } }, '★'))); } return el; }

const P = (d: string) => `<svg class="ic" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
export const ICON = {
  coin: P('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15.9V19h-2v-1.1c-1.7-.3-3-1.4-3.1-3h2c.1.8.8 1.4 2.1 1.4 1.4 0 1.8-.7 1.8-1.2 0-.6-.3-1.2-2.1-1.6-2-.5-3.4-1.3-3.4-3 0-1.4 1.1-2.4 2.7-2.7V5h2v1.1c1.6.4 2.5 1.6 2.5 2.9h-2c0-.8-.5-1.4-1.6-1.4s-1.7.5-1.7 1.2c0 .6.5 1 2.1 1.4 1.6.4 3.4 1.1 3.4 3.1 0 1.5-1.1 2.4-2.7 2.6z'),
  star: P('M12 2l3 6.6 7 .7-5.3 4.8 1.6 7L12 17.5 5.7 21l1.6-7L2 9.3l7-.7z'),
  cal: P('M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v10H5zm2 2v3h3v-3z'),
  phone: P('M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 3v15h10V4zm5 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'),
  book: P('M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zm16 0h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5z'),
  office: P('M3 21V8l9-5 9 5v13h-6v-6H9v6zm6-9h2V9H9zm4 0h2V9h-2z'),
  trophy: P('M7 2h10v2h4v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 12 5 5 0 0 1 3 7V4h4zm-2 4v1a3 3 0 0 0 2 2.8V6zm14 0h-2v3.8A3 3 0 0 0 19 7z'),
  play: P('M8 5v14l11-7z'), next: P('M4 5l8 7-8 7zm8 0l8 7-8 7z'), gear: P('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4l-2.2.6-.6 1.5 1.1 2-2 2-2-1.1-1.5.6L13 21h-2l-.6-2.2-1.5-.6-2 1.1-2-2 1.1-2-.6-1.5L3 13v-2l2.2-.6.6-1.5-1.1-2 2-2 2 1.1 1.5-.6L11 3h2l.6 2.2 1.5.6 2-1.1 2 2-1.1 2 .6 1.5L21 11z'),
  plus: P('M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z'), minus: P('M5 11h14v2H5z'), rotL: P('M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z'), rotR: P('M12 5V2l5 4-5 4V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z'),
  home: P('M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z'), hammer: P('M2 19.6L13.6 8l2.4 2.4L4.4 22zM14 3l7 7-2 2-2-2-1 1-3-3 1-1-2-2z'), heart: P('M12 21s-8-5.3-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 5.7-8 11-8 11z'),
  msg: P('M3 4h18v13H7l-4 4z'), camera: P('M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'),
  bank: P('M12 2l10 5v2H2V7zM4 10h3v8H4zm6 0h4v8h-4zm7 0h3v8h-3zM2 20h20v2H2z'), call: P('M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z'),
  people: P('M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6zm16.5-5.9c2.9.4 5.5 2.2 5.5 5.9h-4.5c0-2.3-.4-4.3-1-5.9z'),
  lang: P('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15 15 0 0 0-1.3-3.9A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15 15 0 0 0 1.3 3.9A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.3-3.9A15 15 0 0 0 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.3 5.9c.6-1.2 1-2.5 1.3-3.9h3a8 8 0 0 1-4.3 3.9zM16.3 14a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4z'),
  gift: P('M20 7h-2.2A3 3 0 0 0 12 4a3 3 0 0 0-5.8 3H4a1 1 0 0 0-1 1v3h8V7h2v4h8V8a1 1 0 0 0-1-1zM9 7a1 1 0 1 1 1-1v1zm5 0V6a1 1 0 1 1 1 1zM4 13v8h7v-8zm9 0v8h7v-8z'),
  center: P('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-1-7h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4z'), close: P('M6 5l6 6 6-6 1 1-6 6 6 6-1 1-6-6-6 6-1-1 6-6-6-6z'),
  undo: P('M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20 16l2.3-.8A10.5 10.5 0 0 0 12.5 8z'), eye: P('M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z'),
  skip: P('M5 5l9 7-9 7zm10 0h3v14h-3z'), speed: P('M4 5l8 7-8 7zm9 0l8 7-8 7z'), check: P('M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'),
};
export const ic = (name: keyof typeof ICON) => { const s = document.createElement('span'); s.style.display = 'inline-flex'; s.innerHTML = ICON[name]; return s; };

// ---------------- Modals ----------------
const stack: { el: HTMLElement; onClose?: () => void; opened: number }[] = [];
export function uiRoot() { return document.getElementById('ui')!; }
/** Opens a modal. The backdrop only closes it from a fresh tap that both starts and ends on the backdrop,
 *  and never within 400 ms of opening, so the opening tap can't close it. */
type Kid = Node | null | undefined | false;
export function modal(title: string | Node, body: Kid | Kid[], opts: { cls?: string; onClose?: () => void; noClose?: boolean; tabs?: Node; headExtra?: Node } = {}) {
  const head = h('div', { class: 'panel-head' }, h('span', { class: 'grow' }, title), opts.headExtra ?? null, opts.noClose ? null : h('button', { class: 'close', 'aria-label': t('ui.close'), onClick: () => close() }, '✕'));
  const bodyEl = h('div', { class: 'body' }, ...((Array.isArray(body) ? body : [body]).filter(Boolean) as Node[]));
  const panel = h('div', { class: 'panel modal ' + (opts.cls ?? '') }, head, opts.tabs ?? null, bodyEl);
  const bd = h('div', { class: 'backdrop' }, panel);
  const entry = { el: bd, onClose: opts.onClose, opened: performance.now() };
  let downOnBackdrop = false;
  bd.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === bd && performance.now() - entry.opened > 400; });
  bd.addEventListener('pointerup', (e) => { if (!opts.noClose && downOnBackdrop && e.target === bd && performance.now() - entry.opened > 400) close(); downOnBackdrop = false; });
  // stop the 3D camera from receiving these touches
  for (const ev of ['pointerdown', 'pointermove', 'wheel']) bd.addEventListener(ev, (e) => e.stopPropagation());
  uiRoot().append(bd); stack.push(entry); sfx('open');
  function close() { const i = stack.indexOf(entry); if (i < 0) return; stack.splice(i, 1); bd.remove(); entry.onClose?.(); }
  return { close, body: bodyEl, panel, setBody(n: Kid | Kid[]) { const st = bodyEl.scrollTop; bodyEl.replaceChildren(...((Array.isArray(n) ? n : [n]).filter(Boolean) as Node[])); bodyEl.scrollTop = st; }, el: bd };
}
export function closeAll() { while (stack.length) { const e = stack.pop()!; e.el.remove(); e.onClose?.(); } }
export function modalOpen() { return stack.length > 0; }
export function tabs(names: { id: string; label: string; badge?: number }[], active: string, onPick: (id: string) => void) {
  const row = h('div', { class: 'tabs' });
  for (const n of names) row.append(h('button', { class: 'tab' + (n.id === active ? ' on' : ''), onClick: () => onPick(n.id) }, n.label, n.badge ? h('span', { class: 'badge', style: { position: 'relative', top: '-2px', marginInlineStart: '6px', display: 'inline-flex' } }, String(n.badge)) : null));
  return row;
}
export function confirmBox(text: string, yes: string, onYes: () => void, no = t('ui.cancel')) {
  const m = modal(t('ui.confirm'), [h('p', { style: { fontWeight: '700', fontSize: '17px' } }, text), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn(no, () => m.close(), 'ghost'), btn(yes, () => { m.close(); onYes(); }, 'red'))], { cls: 'narrow' });
}

// ---------------- Toasts and floating money ----------------
let toastWrap: HTMLElement | null = null;
export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info') {
  if (!text) return; if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap' }); uiRoot().append(toastWrap); }
  const el = h('div', { class: 'toast ' + kind }, text); toastWrap.append(el); setTimeout(() => el.remove(), 2600);
  if (toastWrap.children.length > 3) toastWrap.firstChild?.remove();
}
export function floatMoney(text: string, x: number, y: number, neg = false) { const el = h('div', { class: 'float-money' + (neg ? ' neg' : ''), style: { left: x + 'px', top: y + 'px' } }, text); uiRoot().append(el); setTimeout(() => el.remove(), 1400); }
export function confetti(slow = false) {
  const cv = h('canvas', { class: 'confetti' }) as HTMLCanvasElement; cv.width = innerWidth; cv.height = innerHeight; uiRoot().append(cv); const c = cv.getContext('2d')!;
  const parts = Array.from({ length: 160 }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 3, r: Math.random() * 6, col: ['#ff5d8f', '#f7d97a', '#5b8ff0', '#6ddc56', '#ffffff'][Math.floor(Math.random() * 5)], a: Math.random() * 6 }));
  const k = slow ? 0.45 : 1; let frames = 0;
  const step = () => { c.clearRect(0, 0, cv.width, cv.height); for (const p of parts) { p.x += p.vx * k; p.y += p.vy * k * 2; p.a += 0.1 * k; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-4, -2, 8, 4 + p.r); c.restore(); } if (frames++ < (slow ? 400 : 220)) requestAnimationFrame(step); else cv.remove(); };
  step();
}
/** Closes the top-most modal (used by the Android back button). */
export function closeTop(): boolean {
  const e = stack.pop(); if (e) { e.el.remove(); e.onClose?.(); return true; }
  const bd = document.querySelector('.backdrop'); if (bd) { bd.remove(); return true; }
  return false;
}
