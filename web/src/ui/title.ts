// Title screen with 3 save slots -> difficulty -> 4 story pages -> owner customization (as in the reference).
import * as THREE from 'three';
import type { App } from './app';
import type { Difficulty, Look } from '../core/types';
import { t, L, money, getLang, setLang } from '../core/i18n';
import { listSlots, load, remove } from '../core/save';
import { newGameState, defaultOwner, ACCENTS } from '../core/game';
import { CFG, CONTENT } from '../core/data';
import { h, div, btn, ic, confirmBox, uiRoot } from './dom';
import { logoSVG } from './logo';
import { hallDims } from '../world/layout';
import { STREET_Z } from '../world/hallScene';
import { initAudio, playMusic, sfx } from '../audio/audio';

let screenEl: HTMLElement | null = null;
function setScreen(el: HTMLElement | null) { screenEl?.remove(); screenEl = el; if (el) uiRoot().append(el); }

export function showTitle(app: App) {
  app.world.mode = 'title'; app.world.rig.locked = false; app.world.stage.setDayTime(0.1);
  // slow orbit behind the title
  const orbit = () => { if (app.world.mode === 'title') { app.world.rig.goal.yaw += 0.0008; requestAnimationFrame(orbit); } };
  app.world.rig.flyTo(new THREE.Vector3(0, 3, 10), 48, 0.32, -0.4); orbit();
  const slots = listSlots();
  const langBtn = btn([ic('lang'), getLang() === 'en' ? 'العربية' : 'English'], () => { setLang(getLang() === 'en' ? 'ar' : 'en'); showTitle(app); }, 'gold small');
  const el = div('screen',
    h('div', { class: 'logo', html: logoSVG() }),
    div('slots', ...slots.map((sl) => h('div', { class: 'panel slot' },
      h('div', { class: 'num' }, String(sl.slot + 1)),
      h('div', { class: 'grow' }, sl.exists ? [h('div', { class: 'title' }, sl.hallName ?? ''), h('div', { class: 'sub' }, t('title.slotInfo', { d: (sl.day ?? 0) + 1, c: sl.chapter ?? 1, m: money(sl.money ?? 0), diff: L(CFG.difficulties[sl.difficulty!]) }))] : h('div', { class: 'title' }, t('title.empty'))),
      sl.exists ? btn([ic('play'), t('title.continue')], () => { initAudio(); const s = load(sl.slot); if (s) { setScreen(null); app.startNew(sl.slot, s, false); } }, 'green small', { id: 'slot-continue-' + sl.slot }) : btn(t('title.new'), () => { initAudio(); pickDifficulty(app, sl.slot); }, 'small', { id: 'slot-new-' + sl.slot }),
      sl.exists ? btn('✕', () => confirmBox(t('title.deleteConfirm'), t('title.delete'), () => { remove(sl.slot); showTitle(app); }), 'red small', { 'aria-label': t('title.delete') }) : null))),
    h('div', { class: 'row' }, langBtn), h('div', { class: 'sub', style: { color: '#fff', textShadow: '0 1px 2px #000' } }, t('title.publisher')));
  setScreen(el); playMusic('day');
}

function pickDifficulty(app: App, slot: number) {
  const diffs: Difficulty[] = ['relaxed', 'normal', 'hard', 'legend'];
  const el = div('screen', h('div', { class: 'logo', style: { width: 'min(380px, 70vw)' }, html: logoSVG() }),
    h('div', { class: 'panel', style: { width: 'min(560px, 94vw)' } }, h('div', { class: 'panel-head' }, t('title.difficulty')),
      h('div', { class: 'body', style: { padding: '12px', display: 'grid', gap: '10px' } }, ...diffs.map((d) => h('button', { class: 'card', style: { textAlign: 'start', cursor: 'pointer' }, id: 'diff-' + d, onClick: () => story(app, slot, d, 0) },
        h('div', { class: 'title' }, L(CFG.difficulties[d])), h('div', { class: 'sub' }, t('diff.' + d + '.desc')))),
        btn(t('ui.back'), () => showTitle(app), 'ghost'))));
  setScreen(el);
}

/** Four illustrated story pages, staged with the 3D world. */
function story(app: App, slot: number, diff: Difficulty, page: number) {
  const w = app.world; w.mode = 'story'; w.clearPeople(); const { d } = hallDims(w.g.hall.size);
  const rosa: Look = { gender: 'f', body: 'elderly', skin: 1, hair: 3, hairColor: 5, outfit: 9, color: 4, acc: ['glasses', 'necklace'], c: '#7a2a4a', c2: '#d9b45a' };
  const victor: Look = { gender: 'm', skin: 0, hair: 2, hairColor: 6, outfit: 1, color: 1, acc: ['watch'], beard: 2, c: '#2a2a33', c2: '#7a1f2b' };
  switch (page) {
    case 0: { w.stage.setDayTime(0.42); const r = w.addPerson(rosa, new THREE.Vector3(0, 0, d / 2 + 6), 0); r.anim = 'wave'; w.rig.flyTo(new THREE.Vector3(0, 3, d / 2 + 4), 26, 0.22, 0.35); break; }
    case 1: { w.stage.setDayTime(0.15); const st = app.g.s.staff.length ? app.g.s.staff : null; void st; const n = w.addPerson({ gender: 'f', skin: 1, hair: 0, hairColor: 2, outfit: 0, color: 0, acc: [], uniform: 'host' }, new THREE.Vector3(-1, 0, d / 2 + 5), 0); n.anim = 'cry';
      const k = w.addPerson({ gender: 'm', skin: 3, hair: 1, hairColor: 0, outfit: 0, color: 0, acc: [], beard: 2, uniform: 'cook' }, new THREE.Vector3(1, 0, d / 2 + 5), 0); k.anim = 'idle'; w.rig.flyTo(new THREE.Vector3(0, 1.2, d / 2 + 5), 7, 0.2, 0); break; }
    case 2: { w.stage.setDayTime(0.25); const v = w.addPerson(victor, new THREE.Vector3(-38, 0, STREET_Z + 12), Math.PI); v.anim = 'crossed'; w.rig.flyTo(new THREE.Vector3(-38, 3, STREET_Z + 12), 22, 0.25, Math.PI + 0.3); break; }
    case 3: { w.stage.setDayTime(0.1); w.viewNeighborhood(); break; }
  }
  const text = L(CONTENT.story[page]);
  const el = div('story', h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, t('story.title')), h('div', { class: 'text' + (page === 2 ? ' letter' : '') }, page === 2 ? h('div', { class: 'sub', style: { marginBottom: '6px' } }, t('story.letter')) : null, text),
    div('dots', ...[0, 1, 2, 3].map((i) => h('i', { class: i === page ? 'on' : '' }))),
    h('div', { class: 'row', style: { justifyContent: 'space-between', padding: '0 14px 14px' } }, btn(t('story.skip'), () => customize(app, slot, diff), 'ghost small'), btn([t('ui.next'), ic('next')], () => (page < 3 ? story(app, slot, diff, page + 1) : customize(app, slot, diff)), 'green', { id: 'story-next' }))));
  setScreen(el);
}

/** Owner customization: built to match the reference screen. */
export function customize(app: App, slot: number, diff: Difficulty) {
  const w = app.world; let male = defaultOwner('m'); let female = defaultOwner('f'); let gender: 'm' | 'f' = 'm';
  let people = w.setupCustomization(male, female);
  const cur = () => (gender === 'm' ? male : female);
  const thumbs = new Map<string, string>();
  const thumb = (key: string, look: Look, opts: any) => { if (!thumbs.has(key)) thumbs.set(key, w.renderThumb(look, opts)); return thumbs.get(key)!; };
  const rebuild = () => {
    w.removePerson(people.m); w.removePerson(people.f); const { d } = hallDims(w.g.hall.size); const z = d / 2 + 9;
    people.m = w.addPerson(male, new THREE.Vector3(-0.75, 0, z), 0.15, 'owner'); people.m.anim = 'crossed';
    people.f = w.addPerson(female, new THREE.Vector3(0.75, 0, z), -0.15, 'owner'); people.f.anim = 'pose';
    (gender === 'm' ? people.m : people.f).setEmote('star', 1.2);
    render();
  };
  const set = (patch: Partial<Look>) => { if (gender === 'm') male = { ...male, ...patch }; else female = { ...female, ...patch }; sfx('tap'); rebuild(); };
  const opt = (img: string, on: boolean, onClick: () => void, label: string) => h('button', { class: 'opt' + (on ? ' on' : ''), onClick, 'aria-label': label }, h('img', { src: img, alt: '' }));
  const grp = (title: string, content: Node, full = false) => h('div', { class: 'grp' + (full ? ' full' : '') }, h('span', { class: 'chip-head' }, title), content);
  const ACC = ['sunglasses', 'glasses', 'earrings', 'watch', 'necklace'];
  const ACC_ICON: Record<string, string> = { sunglasses: '🕶️', glasses: '👓', earrings: '💎', watch: '⌚', necklace: '📿' };
  let panel: HTMLElement | null = null; let turn: HTMLElement | null = null;
  const render = () => {
    const L0 = cur();
    const genderOpts = h('div', { class: 'opts two' },
      opt(thumb('g-m-' + JSON.stringify(male), male, { face: true, size: 140 }), gender === 'm', () => { gender = 'm'; render(); people.m.setEmote('star', 1); }, t('custom.male')),
      opt(thumb('g-f-' + JSON.stringify(female), female, { face: true, size: 140 }), gender === 'f', () => { gender = 'f'; render(); people.f.setEmote('star', 1); }, t('custom.female')));
    const skins = h('div', { class: 'opts' }, ...[0, 1, 2, 3, 4, 5].map((i) => { const l = { ...L0, skin: i, beard: gender === 'm' ? ((i % 3) + 1) : 0 }; return opt(thumb('s' + gender + i + L0.hair + L0.hairColor, l, { face: true, size: 96 }), L0.skin === i, () => set({ skin: i, beard: l.beard }), t('custom.skin') + ' ' + (i + 1)); }));
    const hairs = h('div', { class: 'opts' }, ...[0, 1, 2, 3, 4, 5].map((i) => { const l = { ...L0, hair: i }; return opt(thumb('h' + gender + i + L0.skin + L0.hairColor, l, { face: true, size: 96 }), L0.hair === i, () => set({ hair: i }), t('custom.hair') + ' ' + (i + 1)); }));
    const hairCols = h('div', { class: 'swatches' }, ...[0, 1, 2, 3, 4, 6].map((i) => h('button', { class: 'swatch' + (L0.hairColor === i ? ' on' : ''), style: { background: ['#2a1b12', '#4a2c1a', '#6b3f22', '#a0672f', '#d8b26e', '#8a8a8a', '#111111'][i] }, onClick: () => set({ hairColor: i }), 'aria-label': t('custom.hairColor') })));
    const outfits = h('div', { class: 'opts' }, ...[0, 1, 2, 3, 4, 5].map((i) => { const l = { ...L0, outfit: i }; return opt(thumb('o' + gender + i + L0.color, l, { size: 110 }), L0.outfit === i, () => set({ outfit: i }), t('custom.outfit') + ' ' + (i + 1)); }));
    const accs = h('div', { class: 'opts', style: { gridTemplateColumns: 'repeat(5,1fr)' } }, ...ACC.map((a) => h('button', { class: 'opt' + (L0.acc.includes(a) ? ' on' : ''), style: { fontSize: '26px' }, 'aria-label': t('acc.' + a), onClick: () => set({ acc: L0.acc.includes(a) ? L0.acc.filter((x) => x !== a) : [...L0.acc.filter((x) => !(a === 'glasses' && x === 'sunglasses') && !(a === 'sunglasses' && x === 'glasses')), a] }) }, ACC_ICON[a])));
    const colors = h('div', { class: 'swatches' }, ...ACCENTS.map((c, i) => h('button', { class: 'swatch' + (L0.color === i ? ' on' : ''), style: { background: c }, onClick: () => set({ color: i }), 'aria-label': t('custom.color') + ' ' + (i + 1) })));
    const np = h('div', { class: 'panel custom-panel' }, h('div', { class: 'panel-head' }, ic('gear'), t('custom.title')),
      h('div', { class: 'body' }, grp(t('custom.gender'), genderOpts), grp(t('custom.faceSkin'), skins), grp(t('custom.hairstyle'), h('div', {}, hairs, hairCols)), grp(t('custom.outfits'), outfits), grp(t('custom.accessories'), accs), grp(t('custom.colors'), colors)));
    // front / side / back turnaround of the selected owner
    const key = JSON.stringify(L0);
    const nt = h('div', { class: 'turnaround' }, ...[0, Math.PI / 2, Math.PI].map((yaw, i) => h('img', { src: thumb('t' + i + key, L0, { yaw, size: 160 }), alt: [t('custom.front'), t('custom.side'), t('custom.back')][i] })));
    panel?.replaceWith(np); turn?.replaceWith(nt); panel = np; turn = nt;
    return { np, nt };
  };
  const first = render();
  const startBtn = h('div', { class: 'start-btn' }, btn([h('span', { style: { fontSize: '28px' } }, '👑'), t('custom.start')], () => {
    w.rig.locked = false; setScreen(null);
    const owner = gender === 'm' ? male : female; const s = newGameState(slot, diff, owner, '');
    s.halls[0].name = getLang() === 'ar' ? 'قاعة الورد' : 'The Rose Hall'; s.settings.quality = app.g.s.settings.quality;
    app.startNew(slot, s, true);
  }, 'green', { id: 'btn-start-empire' }));
  const el = div('custom', h('div', { class: 'logo-small', html: logoSVG() }), first.np, first.nt, startBtn);
  setScreen(el);
}
export { initAudio };
