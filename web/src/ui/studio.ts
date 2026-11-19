// Wedding Design Studio: a clean, illustrated floor plan of the hall (like a wedding planner app).
// Pick an item from the palette and tap the plan to place it. Drag items to move them, or tap one to
// rotate or remove it. "3D view" opens the full 3D build mode on the same layout.
import type { App } from './app';
import type { PlacedItem } from '../core/types';
import { t, L, money } from '../core/i18n';
import { HALLS, ITEM_BY_ID, CFG } from '../core/data';
import { placeItem, moveItem, removeItem, restoreItem } from '../world/hallOps';
import { capacity, layoutScore, hallDims, canPlace, footprint, reserved } from '../world/layout';
import { cosmeticColor } from '../business/shop';
import { h, div, btn, uiRoot, toast } from './dom';
import { sfx, haptic } from '../audio/audio';
import { openBuild } from './buildUI';

const EMOJI: Record<string, string> = { round_table: '⚪', long_table: '▭', sweetheart: '💑', stage: '🎤', dance_floor: '💃', bar: '🍹', buffet: '🥘', cake: '🎂', dj: '🎧', plant: '🪴', flower_arch: '🌸', lamp: '💡', rose_bush: '🌹', photo_wall: '📸', fountain: '⛲' };
const GROUPS: [string, string[]][] = [['studio.tables', ['round_table', 'long_table', 'sweetheart']], ['studio.party', ['dance_floor', 'stage', 'dj', 'bar', 'buffet', 'cake']], ['studio.decor', ['flower_arch', 'rose_bush', 'plant', 'lamp', 'photo_wall', 'fountain']]];

export function openStudio(app: App) {
  const g = app.g; const w = app.world; app.hud.replaceChildren(); w.mode = 'build';
  const hall = () => g.hall; const hi = () => g.s.activeHall;
  let tool: string | null = null; let rot = 0; let selUid: number | null = null; const undo: (() => void)[] = [];
  let hover: { x: number; z: number } | null = null; let drag: { uid: number; dx: number; dz: number; moved: boolean; x: number; z: number } | null = null;

  const root = div('studio');
  const canvas = h('canvas', { class: 'studio-plan' }) as HTMLCanvasElement; const ctx = canvas.getContext('2d')!;
  const stats = div('studio-stats'); const selPanel = div('studio-sel');
  const undoBtn = btn('↶ ' + t('build.undo'), () => { const u = undo.pop(); if (u) { u(); selUid = null; after(); } }, 'small ghost');
  const close = () => { (window as any).__buildClose = null; root.remove(); w.rebuildInterior(); w.mode = 'day'; w.setupDay(); w.viewHall(); app.refresh(); app.persist(); };
  (window as any).__buildClose = close;
  const head = div('studio-head', h('div', { class: 'studio-title' }, h('b', {}, '✏️ ' + t('studio.title')), h('span', { class: 'sub' }, t('studio.sub'))),
    div('row', undoBtn, btn('👁 ' + t('studio.view3d'), () => { root.remove(); (window as any).__buildClose = null; openBuild(app); }, 'small', { id: 'studio-3d' }), btn('✓ ' + t('build.done'), close, 'green small', { id: 'btn-build-done' })));
  const palette = div('studio-palette', ...GROUPS.map(([label, ids]) => div('studio-group', h('div', { class: 'studio-glabel' }, t(label)), div('studio-items', ...ids.map((id) => {
    const def = ITEM_BY_ID[id]; const b = h('button', { class: 'studio-item', 'data-item': id, onClick: () => { tool = tool === id ? null : id; rot = 0; selUid = null; after(); } },
      h('span', { class: 'si-ico' }, EMOJI[id] ?? '▪'), h('span', { class: 'si-name' }, L(def)), h('span', { class: 'si-sub' }, (def.seats ? t('studio.seats', { n: def.seats }) + ' · ' : '') + money(def.cost)));
    return b;
  })))));
  root.append(head, div('studio-body', h('div', { class: 'studio-canvas-wrap' }, canvas, stats), div('studio-side', selPanel, palette)));
  uiRoot().append(root);

  // ---- plan geometry: world cells -> screen, rotated to fit portrait phones ----
  let M = new DOMMatrix(); let scale = 10;
  const layoutPlan = () => {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    const { w: W, d: D } = hallDims(hall().size); const pad = 18; const rotate = r.height > r.width * 1.15 && W > D;
    const pw = rotate ? D : W, pd = rotate ? W : D; scale = Math.min((r.width - pad * 2) / pw, (r.height - pad * 2 - 30) / pd);
    const ox = (r.width - pw * scale) / 2, oy = (r.height - 30 - pd * scale) / 2;
    M = rotate ? new DOMMatrix([0, -scale, scale, 0, ox, oy + W * scale]) : new DOMMatrix([scale, 0, 0, scale, ox, oy]);
    draw();
  };
  const toCell = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); const p = M.inverse().transformPoint(new DOMPoint(e.clientX - r.left, e.clientY - r.top)); return { x: p.x, z: p.y }; };
  const itemAtCell = (x: number, z: number) => hall().layout.find((it) => { const f = footprint(it); return x >= it.x && x < it.x + f.w && z >= it.z && z < it.z + f.d; }) ?? null;

  // ---- drawing ----
  const draw = () => {
    const { w: W, d: D } = hall() ? hallDims(hall().size) : { w: 1, d: 1 }; const dpr = canvas.width / canvas.getBoundingClientRect().width || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    const m = new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).multiply(M); ctx.setTransform(m);
    // walls + wooden floor
    ctx.fillStyle = '#5b4a44'; ctx.fillRect(-0.45, -0.45, W + 0.9, D + 0.9);
    const fl = ctx.createLinearGradient(0, 0, W, D); fl.addColorStop(0, '#e9c9a0'); fl.addColorStop(1, '#d9b183'); ctx.fillStyle = fl; ctx.fillRect(0, 0, W, D);
    ctx.strokeStyle = 'rgba(140,95,55,.18)'; ctx.lineWidth = 0.04; for (let z = 0.5; z < D; z += 0.5) { ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(W, z); ctx.stroke(); }
    for (let z = 0; z < D; z += 0.5) for (let x = ((z * 2) % 2) * 1.2; x < W; x += 2.4) { ctx.beginPath(); ctx.moveTo(x, z); ctx.lineTo(x, z + 0.5); ctx.stroke(); }
    // entrance gap + reserved cells (soft)
    ctx.fillStyle = '#efe3d0'; ctx.fillRect(W / 2 - 1.5, D - 0.05, 3, 0.55);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; for (const k of reserved(W, D)) { const [x, z] = k.split(',').map(Number); ctx.fillRect(x, z, 1, 1); }
    // corner plants + wall sconces for the illustrated look
    for (const [x, z] of [[0.6, 0.6], [W - 0.6, 0.6], [0.6, D - 0.6]]) { ctx.fillStyle = '#4f8a4a'; circle(x, z, 0.5); ctx.fillStyle = '#6fae5f'; circle(x - 0.12, z - 0.1, 0.3); }
    ctx.fillStyle = '#ffd77a'; for (let x = 2; x < W - 1; x += 4) { circle(x, 0.18, 0.13); circle(x, D - 0.18, 0.13); }
    // items
    const accent = cosmeticColor(g, hi(), 'tables') ?? '#ffffff';
    for (const it of hall().layout) drawItem(it, it.uid === selUid ? 'sel' : drag?.uid === it.uid ? 'drag' : '', accent);
    // ghost for the tool / drag
    if (tool && hover) { const it: PlacedItem = { uid: -1, id: tool, x: Math.floor(hover.x - ITEMW(tool, rot) / 2 + 0.5), z: Math.floor(hover.z - ITEMD(tool, rot) / 2 + 0.5), rot }; ghost(it, canPlace(hall(), it)); }
    if (drag && drag.moved) { const cur = hall().layout.find((i) => i.uid === drag!.uid)!; const it = { ...cur, x: drag.x, z: drag.z }; ghost(it, canPlace(hall(), it, cur.uid)); }
  };
  const ITEMW = (id: string, r: number) => (r % 2 ? ITEM_BY_ID[id].d : ITEM_BY_ID[id].w);
  const ITEMD = (id: string, r: number) => (r % 2 ? ITEM_BY_ID[id].w : ITEM_BY_ID[id].d);
  function circle(x: number, z: number, r: number) { ctx.beginPath(); ctx.arc(x, z, r, 0, Math.PI * 2); ctx.fill(); }
  function rrect(x: number, z: number, w: number, d: number, r: number) { ctx.beginPath(); ctx.roundRect(x, z, w, d, r); ctx.fill(); }
  function chairsRound(cx: number, cz: number, R: number, n: number) { ctx.fillStyle = '#f3e7d3'; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; circle(cx + Math.cos(a) * R, cz + Math.sin(a) * R, 0.2); } }
  function drawItem(it: PlacedItem, state: string, accent: string) {
    const f = footprint(it); const x = it.x, z = it.z, cx = x + f.w / 2, cz = z + f.d / 2;
    ctx.save(); if (state === 'drag') ctx.globalAlpha = 0.35;
    ctx.shadowColor = 'rgba(60,30,10,.25)'; ctx.shadowBlur = 0.25 * 6; ctx.shadowOffsetY = 0;
    switch (it.id) {
      case 'round_table': chairsRound(cx, cz, 1.15, 10); ctx.fillStyle = accent; circle(cx, cz, 0.85); ctx.fillStyle = '#5c9a55'; circle(cx, cz, 0.22); ctx.fillStyle = '#ffffff'; circle(cx, cz, 0.1); break;
      case 'long_table': { ctx.fillStyle = '#f3e7d3'; const vert = f.d > f.w; for (let k = 0; k < 4; k++) { if (vert) { circle(x + 0.25, z + 0.6 + k * 0.95, 0.2); circle(x + f.w - 0.25, z + 0.6 + k * 0.95, 0.2); } else { circle(x + 0.6 + k * 0.95, z + 0.25, 0.2); circle(x + 0.6 + k * 0.95, z + f.d - 0.25, 0.2); } }
        ctx.fillStyle = accent; rrect(x + (vert ? 0.5 : 0.2), z + (vert ? 0.2 : 0.5), f.w - (vert ? 1 : 0.4), f.d - (vert ? 0.4 : 1), 0.15); break; }
      case 'sweetheart': ctx.fillStyle = '#fff'; rrect(x + 0.3, z + 0.3, f.w - 0.6, f.d - 0.9, 0.12); ctx.fillStyle = '#f2b8cc'; circle(cx - 0.4, z + f.d - 0.35, 0.22); circle(cx + 0.4, z + f.d - 0.35, 0.22); ctx.fillStyle = '#e05a7a'; circle(cx, z + 0.6, 0.15); break;
      case 'stage': ctx.fillStyle = '#8a5a3b'; rrect(x, z, f.w, f.d, 0.2); ctx.fillStyle = '#a36d48'; rrect(x + 0.3, z + 0.3, f.w - 0.6, f.d - 0.6, 0.15); ctx.fillStyle = '#ffffff'; rrect(cx - 1, cz - 0.3, 2, 0.6, 0.1); break;
      case 'dance_floor': { ctx.fillStyle = '#fbf3e6'; ctx.fillRect(x, z, f.w, f.d); ctx.fillStyle = '#ffd77a'; for (let k = 0; k <= 8; k++) { circle(x + (k / 8) * f.w, z, 0.09); circle(x + (k / 8) * f.w, z + f.d, 0.09); circle(x, z + (k / 8) * f.d, 0.09); circle(x + f.w, z + (k / 8) * f.d, 0.09); }
        const b = app.g.s.bookings.filter((bb) => bb.hall === hi() && bb.date >= g.s.day).sort((a, c) => a.date - c.date)[0];
        if (b) { const ini = L(b.req.groom).slice(0, 1) + ' & ' + L(b.req.bride).slice(0, 1); ctx.save(); const p = M.transformPoint(new DOMPoint(cx, cz)); const dpr = canvas.width / canvas.getBoundingClientRect().width || 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#c9a24a'; ctx.font = `italic 700 ${Math.max(12, scale * 1.4)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowBlur = 0; ctx.fillText(ini, p.x, p.y); ctx.restore(); }
        break; }
      case 'bar': ctx.fillStyle = '#3d3a40'; rrect(x + 0.1, z + 0.2, f.w - 0.2, f.d - 0.4, 0.15); ctx.fillStyle = '#e8d2a4'; for (let k = 0; k < 5; k++) circle(x + 0.6 + k * (f.w - 1.2) / 4, cz, 0.12); break;
      case 'buffet': ctx.fillStyle = '#ffffff'; rrect(x + 0.1, z + 0.3, f.w - 0.2, f.d - 0.6, 0.12); ctx.fillStyle = '#c8a46a'; for (let k = 0; k < 4; k++) circle(x + 0.6 + k * (f.w - 1.2) / 3, cz, 0.22); break;
      case 'cake': ctx.fillStyle = '#ffffff'; circle(cx, cz, 0.8); ctx.fillStyle = '#ffe9f0'; circle(cx, cz, 0.55); ctx.fillStyle = '#f2b8cc'; circle(cx, cz, 0.3); break;
      case 'dj': ctx.fillStyle = '#2b2b33'; rrect(x + 0.2, z + 0.3, f.w - 0.4, f.d - 0.6, 0.15); ctx.fillStyle = '#7ad0ff'; circle(cx - 0.6, cz, 0.2); circle(cx + 0.6, cz, 0.2); break;
      case 'plant': ctx.fillStyle = '#4f8a4a'; circle(cx, cz, 0.42); ctx.fillStyle = '#7dbb68'; circle(cx - 0.1, cz - 0.1, 0.25); break;
      case 'rose_bush': ctx.fillStyle = '#3f7a3f'; circle(cx, cz, 0.42); ctx.fillStyle = '#e05a7a'; for (let k = 0; k < 5; k++) circle(cx + Math.cos(k * 1.25) * 0.22, cz + Math.sin(k * 1.25) * 0.22, 0.1); break;
      case 'lamp': ctx.fillStyle = 'rgba(255,215,120,.35)'; circle(cx, cz, 0.48); ctx.fillStyle = '#ffd77a'; circle(cx, cz, 0.18); break;
      case 'flower_arch': ctx.fillStyle = '#6fae5f'; rrect(x + 0.1, z + 0.25, f.w - 0.2, f.d - 0.5, 0.25); ctx.fillStyle = '#f7c6d6'; for (let k = 0; k < 6; k++) circle(x + 0.35 + k * (f.w - 0.7) / 5, cz, 0.16); break;
      case 'photo_wall': ctx.fillStyle = '#4f8a4a'; rrect(x + 0.1, z + 0.3, f.w - 0.2, f.d - 0.6, 0.1); ctx.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) circle(x + 0.45 + k * (f.w - 0.9) / 3, cz, 0.1); break;
      case 'fountain': ctx.fillStyle = '#ece4d6'; circle(cx, cz, 0.95); ctx.fillStyle = '#8fd3f5'; circle(cx, cz, 0.7); ctx.fillStyle = '#ffffff'; circle(cx, cz, 0.15); break;
      default: ctx.fillStyle = '#ccc'; ctx.fillRect(x, z, f.w, f.d);
    }
    ctx.restore();
    if (state === 'sel') { ctx.strokeStyle = '#1aa3a3'; ctx.lineWidth = 0.12; ctx.setLineDash([0.3, 0.2]); ctx.strokeRect(x - 0.1, z - 0.1, f.w + 0.2, f.d + 0.2); ctx.setLineDash([]); }
  }
  function ghost(it: PlacedItem, ok: boolean) {
    const f = footprint(it); ctx.save(); ctx.globalAlpha = 0.85; drawItem(it, '', '#ffffff'); ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? 'rgba(46,190,120,.28)' : 'rgba(230,60,80,.32)'; ctx.fillRect(it.x, it.z, f.w, f.d); ctx.strokeStyle = ok ? '#22a866' : '#e0384f'; ctx.lineWidth = 0.1; ctx.strokeRect(it.x, it.z, f.w, f.d); ctx.restore();
  }

  // ---- input ----
  canvas.addEventListener('pointermove', (e) => {
    const c = toCell(e); hover = c;
    if (drag) { const cur = hall().layout.find((i) => i.uid === drag!.uid); if (cur) { const nx = Math.round(c.x - drag.dx), nz = Math.round(c.z - drag.dz); if (nx !== cur.x || nz !== cur.z) drag.moved = true; drag.x = nx; drag.z = nz; } }
    draw();
  });
  canvas.addEventListener('pointerleave', () => { hover = null; draw(); });
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const c = toCell(e); hover = c; if (tool) { draw(); return; }
    const it = itemAtCell(c.x, c.z);
    if (it) { selUid = it.uid; drag = { uid: it.uid, dx: c.x - it.x, dz: c.z - it.z, moved: false, x: it.x, z: it.z }; } else { selUid = null; }
    after();
  });
  canvas.addEventListener('pointerup', (e) => {
    const c = toCell(e);
    if (tool) {
      const it = { id: tool, x: Math.floor(c.x - ITEMW(tool, rot) / 2 + 0.5), z: Math.floor(c.z - ITEMD(tool, rot) / 2 + 0.5), rot };
      if (!canPlace(hall(), { uid: -1, ...it })) { sfx('fail'); haptic(30); toast(t('build.noRoom'), 'bad'); return; }
      const placed = placeItem(g, hi(), it.id, it.x, it.z, it.rot); if (!placed) { toast(t('ui.noMoney'), 'bad'); return; }
      sfx('tap'); haptic(12); undo.push(() => removeItem(g, hi(), placed.uid, 1)); after(); return;
    }
    if (drag && drag.moved) {
      const cur = hall().layout.find((i) => i.uid === drag!.uid); const before = cur ? { ...cur } : null;
      if (cur && moveItem(g, hi(), cur.uid, drag.x, drag.z, cur.rot)) { sfx('tap'); haptic(12); undo.push(() => moveItem(g, hi(), before!.uid, before!.x, before!.z, before!.rot)); }
      else { sfx('fail'); toast(t('build.noRoom'), 'bad'); }
    }
    drag = null; after();
  });

  // ---- side panels ----
  const after = () => {
    const H = hall(); const { w: W, d: D, cap } = hallDims(H.size); const seatsNow = capacity(H);
    stats.replaceChildren(h('span', {}, '🏛️ ' + t('studio.area', { n: W * D })), h('span', {}, '🪑 ' + t('studio.seatsOf', { n: seatsNow, c: cap })), h('span', {}, '🍽️ ' + t('studio.tablesN', { n: H.layout.filter((i) => ITEM_BY_ID[i.id]?.kind === 'table').length })), h('span', {}, '⭐ ' + layoutScore(H, seatsNow).toFixed(1)));
    for (const b of palette.querySelectorAll('.studio-item')) b.classList.toggle('on', (b as HTMLElement).dataset.item === tool);
    (undoBtn as HTMLButtonElement).disabled = !undo.length;
    const sel = selUid != null ? H.layout.find((i) => i.uid === selUid) : null;
    if (sel) {
      const def = ITEM_BY_ID[sel.id];
      selPanel.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'si-ico' }, EMOJI[sel.id] ?? '▪'), h('div', { class: 'grow' }, h('b', {}, L(def)), h('div', { class: 'sub' }, def.seats ? t('studio.seats', { n: def.seats }) : t('studio.dragHint')))),
        div('row wrap', btn('⟳ ' + t('build.rotate'), () => { const before = { ...sel }; if (moveItem(g, hi(), sel.uid, sel.x, sel.z, (sel.rot + 1) % 4)) { undo.push(() => moveItem(g, hi(), before.uid, before.x, before.z, before.rot)); after(); } else { sfx('fail'); toast(t('build.noRoom'), 'bad'); } }, 'small'),
          btn('🗑 ' + t('build.remove'), () => { const it = removeItem(g, hi(), sel.uid); if (it) undo.push(() => restoreItem(g, hi(), it)); selUid = null; after(); }, 'small red'),
          btn('✕', () => { selUid = null; after(); }, 'small ghost')));
    } else if (tool) selPanel.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'si-ico' }, EMOJI[tool]), h('div', { class: 'grow' }, h('b', {}, L(ITEM_BY_ID[tool])), h('div', { class: 'sub' }, t('studio.placeHint')))), div('row wrap', btn('⟳ ' + t('build.rotate'), () => { rot = (rot + 1) % 4; draw(); }, 'small'), btn('✕', () => { tool = null; after(); }, 'small ghost')));
    else selPanel.replaceChildren(h('div', { class: 'sub' }, t('studio.pickHint')));
    draw();
  };
  const ro = new ResizeObserver(() => layoutPlan()); ro.observe(canvas);
  layoutPlan(); after();
  void CFG; void HALLS;
}
