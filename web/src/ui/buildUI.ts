// Build mode UI: pick an item, place/move/rotate/remove on the grid, undo, saved layouts per theme, top-down view.
import type { App } from './app';
import { t, L, money } from '../core/i18n';
import { HALLS, ITEM_BY_ID, CFG } from '../core/data';
import { placeItem, moveItem, removeItem, restoreItem, saveLayout, loadLayout, resetLayout } from '../world/hallOps';
import { capacity, layoutScore, hallDims } from '../world/layout';
import { h, div, btn, ic, uiRoot, toast, modal } from './dom';
import { sfx } from '../audio/audio';

export function openBuild(app: App) {
  const g = app.g; const w = app.world; w.startBuild(); app.hud.replaceChildren(); const bm = w.build!;
  const undo: (() => void)[] = [];
  const root = h('div'); uiRoot().append(root);
  const offs = [
    g.on('buildPlace', (it: any) => { const ok = bm.valid(it); bm.showGhost(ok, it); if (!ok) { sfx('fail'); return; } const placed = placeItem(g, g.s.activeHall, it.id, it.x, it.z, it.rot); if (placed) { sfx('tap'); undo.push(() => removeItem(g, g.s.activeHall, placed.uid, 1)); w.rebuildInterior(); render(); } else toast(t('ui.noMoney'), 'bad'); }),
    g.on('buildMove', (mv: any) => { const cur = g.hall.layout.find((i) => i.uid === mv.uid); if (!cur) return; const before = { ...cur }; const ok = bm.valid({ id: cur.id, x: mv.x, z: mv.z, rot: mv.rot }, cur.uid); bm.showGhost(ok, { id: cur.id, x: mv.x, z: mv.z, rot: mv.rot }); if (ok && moveItem(g, g.s.activeHall, mv.uid, mv.x, mv.z, mv.rot)) { undo.push(() => moveItem(g, g.s.activeHall, before.uid, before.x, before.z, before.rot)); w.rebuildInterior(); sfx('tap'); render(); } else sfx('fail'); }),
  ];
  bm.onChange = () => render();
  const close = () => { offs.forEach((f) => f()); root.remove(); w.endBuild(); app.refresh(); app.persist(); };
  const render = () => {
    const hall = g.hall; const sel = bm.selectedUid != null ? hall.layout.find((i) => i.uid === bm.selectedUid) : null; const dims = hallDims(hall.size);
    const info = h('div', { class: 'stat' }, t('build.info', { s: capacity(hall), c: dims.cap, l: layoutScore(hall, capacity(hall)).toFixed(1) }));
    const top = div('hud-top', info, h('div', { class: 'hud-right' }, btn([ic('undo'), t('build.undo')], () => { const u = undo.pop(); if (u) { u(); w.rebuildInterior(); render(); } }, 'small ghost', { disabled: !undo.length }),
      btn(t('build.layouts'), () => layouts(), 'small gold'), btn([ic('check'), t('build.done')], close, 'small green', { id: 'btn-build-done' })));
    const items = div('build-items', ...HALLS.items.map((it: any) => h('button', { class: 'choice' + (bm.selectedItem === it.id ? ' on' : ''), onClick: () => { bm.selectedItem = bm.selectedItem === it.id ? null : it.id; bm.selectedUid = null; render(); } }, h('span', { style: { fontSize: '22px' } }, EMOJI[it.kind] ?? '▪'), L(it), h('span', { class: 'sub' }, money(it.cost)))));
    const selBar = sel ? h('div', { class: 'card', style: { margin: '0 8px 8px' } }, h('div', { class: 'row wrap' }, h('b', { class: 'grow' }, t('build.selected', { n: L(ITEM_BY_ID[sel.id]) })),
      btn([ic('rotR'), t('build.rotate')], () => { const before = { ...sel }; if (moveItem(g, g.s.activeHall, sel.uid, sel.x, sel.z, (sel.rot + 1) % 4)) { undo.push(() => moveItem(g, g.s.activeHall, before.uid, before.x, before.z, before.rot)); w.rebuildInterior(); render(); } else { sfx('fail'); toast(t('build.noRoom'), 'bad'); } }, 'small'),
      btn(t('build.remove'), () => { const it = removeItem(g, g.s.activeHall, sel.uid); if (it) undo.push(() => restoreItem(g, g.s.activeHall, it)); bm.selectedUid = null; w.rebuildInterior(); render(); }, 'small red'),
      btn(t('ui.cancel'), () => { bm.selectedUid = null; render(); }, 'small ghost')), h('div', { class: 'sub' }, t('build.moveHint'))) : h('div', { class: 'sub', style: { padding: '0 12px 6px' } }, bm.selectedItem ? t('build.placeHint') : t('build.pickHint'));
    root.replaceChildren(top, h('div', { class: 'panel build-bar' }, selBar, items),
      div('cam-btns', btn(ic('plus'), () => w.rig.zoom(0.8)), btn(ic('minus'), () => w.rig.zoom(1.25)), btn(ic('rotL'), () => w.rig.rotate(Math.PI / 2)), btn(ic('eye'), () => { w.rig.topDown = !w.rig.topDown; })));
  };
  const layouts = () => {
    const m = modal(t('build.layouts'), [h('div', { class: 'sub' }, t('build.layoutsHelp')), div('grid3', ...Object.keys(CFG.themes).map((th) => h('div', { class: 'card' }, h('b', {}, L(CFG.themes[th])),
      h('div', { class: 'row', style: { marginTop: '6px' } }, btn(t('build.save'), () => { saveLayout(g, g.s.activeHall, th); toast(t('build.saved'), 'good'); m.close(); }, 'small'), g.hall.savedLayouts[th] ? btn(t('build.load'), () => { loadLayout(g, g.s.activeHall, th); w.rebuildInterior(); m.close(); render(); }, 'small green') : null)))),
      btn(t('build.reset'), () => { resetLayout(g, g.s.activeHall); w.rebuildInterior(); m.close(); render(); }, 'red small', { style: { marginTop: '10px' } })], { cls: 'narrow' });
  };
  render();
}
const EMOJI: Record<string, string> = { table: '🍽️', head: '💑', stage: '🎤', dance: '💃', bar: '🍹', buffet: '🥘', cake: '🎂', dj: '🎧', decor: '🌸' };
