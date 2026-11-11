// Build mode: pick an item, see green (fits) / red (doesn't) spots on the floor, tap green to place.
// Tap a placed item to select it, then tap a green spot to move it, or rotate / remove it. Undo, saved layouts.
import type { App } from './app';
import { t, L, money } from '../core/i18n';
import { HALLS, ITEM_BY_ID, CFG } from '../core/data';
import { placeItem, moveItem, removeItem, restoreItem, saveLayout, loadLayout, resetLayout } from '../world/hallOps';
import { capacity, layoutScore, hallDims, canPlace } from '../world/layout';
import { h, div, btn, ic, uiRoot, toast, modal } from './dom';
import { sfx, haptic } from '../audio/audio';

export function openBuild(app: App) {
  const g = app.g; const w = app.world; w.startBuild(); app.hud.replaceChildren(); const bm = w.build!;
  const undo: (() => void)[] = [];
  const root = h('div', { class: 'build-root' }); uiRoot().append(root);
  const after = () => { w.rebuildInterior(); bm.refreshSpots(); updateTop(); updateSel(); };
  bm.onPlace = (it) => {
    if (!canPlace(g.hall, { uid: -1, ...it })) { sfx('fail'); haptic(30); toast(t('build.noRoom'), 'bad'); return; }
    const placed = placeItem(g, g.s.activeHall, it.id, it.x, it.z, it.rot);
    if (!placed) { toast(t('ui.noMoney'), 'bad'); return; }
    sfx('tap'); haptic(12); undo.push(() => removeItem(g, g.s.activeHall, placed.uid, 1)); after();
  };
  bm.onMove = (uid, x, z) => {
    const cur = g.hall.layout.find((i) => i.uid === uid); if (!cur) return; const before = { ...cur };
    if (moveItem(g, g.s.activeHall, uid, x, z, cur.rot)) { sfx('tap'); haptic(12); undo.push(() => moveItem(g, g.s.activeHall, before.uid, before.x, before.z, before.rot)); after(); }
    else { sfx('fail'); haptic(30); toast(t('build.noRoom'), 'bad'); }
  };
  bm.onChange = () => { updateItems(); updateSel(); };
  const close = () => { (window as any).__buildClose = null; root.remove(); w.endBuild(); app.refresh(); app.persist(); };
  (window as any).__buildClose = close;

  // --- top bar (built once, numbers updated in place) ---
  const info = h('div', { class: 'stat' }); const undoBtn = btn([ic('undo'), t('build.undo')], () => { const u = undo.pop(); if (u) { u(); bm.selectedUid = null; after(); } }, 'small ghost');
  const updateTop = () => { const hall = g.hall; info.textContent = t('build.info', { s: capacity(hall), c: hallDims(hall.size).cap, l: layoutScore(hall, capacity(hall)).toFixed(1) }); (undoBtn as HTMLButtonElement).disabled = !undo.length; };
  const top = div('hud-top build-top', h('div', { class: 'build-row' }, info, btn([ic('check'), t('build.done')], close, 'green build-done', { id: 'btn-build-done', 'aria-label': t('build.done') })), h('div', { class: 'build-row' }, undoBtn, btn(t('build.layouts'), () => layouts(), 'small gold')));

  // --- item bar: built once so its scroll position never jumps ---
  const itemBtns = new Map<string, HTMLElement>();
  const items = div('build-items', ...HALLS.items.map((it: any) => {
    const b = h('button', { class: 'choice', 'data-item': it.id, onClick: () => { bm.selectedItem = bm.selectedItem === it.id ? null : it.id; bm.selectedUid = null; bm.rot = 0; bm.refreshSpots(); updateItems(); updateSel(); if (bm.selectedItem && !bm.freeSpots) toast(t('build.noSpace'), 'bad'); } },
      h('span', { style: { fontSize: '22px' } }, EMOJI[it.kind] ?? '▪'), L(it), h('span', { class: 'sub' }, money(it.cost)));
    itemBtns.set(it.id, b); return b;
  }));
  const updateItems = () => { for (const [id, b] of itemBtns) b.classList.toggle('on', bm.selectedItem === id); };

  // --- selection strip ---
  const selBar = h('div', { class: 'build-sel' });
  const updateSel = () => {
    const hall = g.hall; const sel = bm.selectedUid != null ? hall.layout.find((i) => i.uid === bm.selectedUid) : null;
    if (sel) selBar.replaceChildren(h('div', { class: 'row wrap' }, h('b', { class: 'grow' }, t('build.selected', { n: L(ITEM_BY_ID[sel.id]) })),
      btn([ic('rotR'), t('build.rotate')], () => { const before = { ...sel }; if (moveItem(g, g.s.activeHall, sel.uid, sel.x, sel.z, (sel.rot + 1) % 4)) { undo.push(() => moveItem(g, g.s.activeHall, before.uid, before.x, before.z, before.rot)); after(); } else { sfx('fail'); toast(t('build.noRoom'), 'bad'); } }, 'small'),
      btn(t('build.remove'), () => { const it = removeItem(g, g.s.activeHall, sel.uid); if (it) undo.push(() => restoreItem(g, g.s.activeHall, it)); bm.selectedUid = null; after(); }, 'small red'),
      btn(t('ui.cancel'), () => { bm.selectedUid = null; bm.refreshSpots(); updateSel(); }, 'small ghost')), h('div', { class: 'sub' }, t('build.moveHint')));
    else if (bm.selectedItem) selBar.replaceChildren(h('div', { class: 'row wrap' }, h('span', { class: 'sub grow' }, t('build.placeHint')),
      btn([ic('rotR'), t('build.rotate')], () => { bm.rot = (bm.rot + 1) % 4; bm.refreshSpots(); }, 'small')));
    else selBar.replaceChildren(h('div', { class: 'sub' }, t('build.pickHint')));
  };

  const layouts = () => {
    const m = modal(t('build.layouts'), [h('div', { class: 'sub' }, t('build.layoutsHelp')), div('grid3', ...Object.keys(CFG.themes).map((th) => h('div', { class: 'card' }, h('b', {}, L(CFG.themes[th])),
      h('div', { class: 'row', style: { marginTop: '6px' } }, btn(t('build.save'), () => { saveLayout(g, g.s.activeHall, th); toast(t('build.saved'), 'good'); m.close(); }, 'small'), g.hall.savedLayouts[th] ? btn(t('build.load'), () => { loadLayout(g, g.s.activeHall, th); bm.selectedUid = null; after(); m.close(); }, 'small green') : null)))),
      btn(t('build.reset'), () => { resetLayout(g, g.s.activeHall); bm.selectedUid = null; after(); m.close(); }, 'red small', { style: { marginTop: '10px' } })], { cls: 'narrow' });
  };
  root.append(top, h('div', { class: 'panel build-bar' }, selBar, items));
  updateTop(); updateItems(); updateSel();
}
const EMOJI: Record<string, string> = { table: '🍽️', head: '💑', stage: '🎤', dance: '💃', bar: '🍹', buffet: '🥘', cake: '🎂', dj: '🎧', decor: '🌸' };
