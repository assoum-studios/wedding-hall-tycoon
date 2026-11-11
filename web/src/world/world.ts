// The 3D world controller: hall + neighborhood, camera, people, day life, the live wedding night and build mode.
import * as THREE from 'three';
import type { Game } from '../core/game';
import type { Look, Plan } from '../core/types';
import { Stage, QUALITY } from './scene';
import { CameraRig } from './camera';
import { HallView, OFFICE_POS, STREET_Z, PLOT_SLOTS, cellToWorld } from './hallScene';
import { NavGrid } from './nav';
import { Person, separate } from '../characters/crowd';
import type { Anim } from '../characters/animator';
import { hallDims, footprint, canPlace, ensureLayout } from './layout';
import { ITEM_BY_ID, CFG, CONTENT } from '../core/data';
import { staffIn, managerOf, staffNeeds } from '../staff/staff';
import { randomLook } from '../characters/looks';
import { Rng, vrand } from '../core/rng';
import type { NightSim, ActiveProblem } from '../weddings/night';
import * as Props from './props';
import { MAT } from './textures';

const DANCES: Anim[] = ['dance1', 'dance2', 'dance3', 'dance4', 'dance5'];
export interface Pick { kind: string; uid?: number; id?: string; person?: Person; }

export class World {
  stage: Stage; rig: CameraRig; view: HallView; nav!: NavGrid; people: Person[] = []; owner: Person | null = null;
  mode: 'title' | 'custom' | 'day' | 'night' | 'build' | 'meeting' | 'story' = 'title';
  onPick: (p: Pick, x: number, y: number) => void = () => {};
  night: NightDirector | null = null; build: BuildMode | null = null; extra = new THREE.Group(); autoCam = true;
  private rng = new Rng(Math.floor(Math.random() * 1e9));
  constructor(public g: Game, canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas); this.stage.setQuality(g.s.settings.quality, g.s.settings);
    this.rig = new CameraRig(this.stage.camera, canvas);
    this.view = new HallView(g, this.stage.scene); this.stage.scene.add(this.extra);
    this.rig.onTap = (x, y) => this.tap(x, y);
    this.rig.onUserMove = () => { this.autoCam = false; };
    this.stage.updaters.add((dt, t) => this.update(dt, t));
  }
  get hallIdx() { return this.g.s.activeHall; }
  loadHall() {
    const h = this.g.hall; ensureLayout(h); this.view.build(this.hallIdx); this.nav = new NavGrid(h);
    this.clearPeople(); this.stage.focusShadow(new THREE.Vector3(0, 0, 0), Math.max(40, hallDims(h.size).w));
  }
  rebuildInterior() { this.view.buildInterior(this.g.hall); this.nav = new NavGrid(this.g.hall); }
  clearPeople() { for (const p of this.people) p.dispose(); this.people = []; this.owner = null; this.extra.clear(); }
  addPerson(look: Look, pos: THREE.Vector3, face = 0, role = 'guest') {
    const far = this.people.length > 60; const p = new Person(look, far ? 0.7 : 1); p.role = role; p.place(pos, face); this.stage.scene.add(p.obj); this.people.push(p); return p;
  }
  removePerson(p: Person) { p.dispose(); this.people = this.people.filter((x) => x !== p); }

  // ---------------- Day life: staff working, owner greeting ----------------
  setupDay() {
    this.mode = 'day'; this.clearPeople(); this.view.applyPlan(null); this.view.setMood(0, 0); this.stage.setDayTime(0.15); this.view.doorTarget = 0;
    const h = this.g.hall; const { d, w } = hallDims(h.size); const nav = this.nav;
    this.owner = this.addPerson(this.g.s.owner, new THREE.Vector3(1.5, 0, d / 2 - 2), Math.PI, 'owner'); this.owner.anim = 'pose';
    const staff = staffIn(this.g, this.hallIdx).slice(0, Math.min(24, QUALITY[this.stage.quality].guests / 3));
    staff.forEach((e, i) => {
      const spot = this.randomFree(); const p = this.addPerson(e.look, spot, this.rng.range(0, 6), e.role); p.data.emp = e.id;
      this.dayChore(p, i);
    });
    // a few visitors walking on the plaza
    for (let i = 0; i < 4; i++) { const p = this.addPerson(randomLook(this.rng), new THREE.Vector3(-20 + i * 12, 0, STREET_Z - 8), 0, 'visitor'); this.wander(p); }
    void w;
  }
  private dayChore(p: Person, i: number) {
    const role = p.role; const nav = this.nav; const go = () => this.dayChore(p, i + 1);
    const at = (k: string) => this.nav.spots[k]?.[0];
    switch (role) {
      case 'cleaner': p.setProp('mop'); p.walkTo(nav, this.randomFree(), 'clean', null, () => setTimeout(go, 4000 + vrand() * 3000)); break;
      case 'cook': { const k = cellToWorld(this.g.hall, 2, 0); p.place(new THREE.Vector3(k.x + 1 + (i % 3), 0, k.z - 6.5), Math.PI); p.anim = 'cook'; break; }
      case 'waiter': p.setProp(i % 2 ? 'tray' : null); p.walkTo(nav, at('table') ? this.near(this.pickArr(this.nav.spots.table), 1.6) : this.randomFree(), 'idle', null, () => setTimeout(go, 2500 + vrand() * 3000)); break;
      case 'bartender': { const b = at('bar'); if (b) p.place(b.clone().add(new THREE.Vector3(0, 0, -1.6)), 0); p.anim = 'clean'; break; }
      case 'decorator': p.walkTo(nav, this.randomFree(), 'fix', null, () => setTimeout(go, 5000)); break;
      case 'sound_tech': { const dj = at('dj'); if (dj) p.walkTo(nav, dj, 'fix', Math.PI); break; }
      case 'security': { const { d } = hallDims(this.g.hall.size); p.place(new THREE.Vector3(i % 2 ? 2.4 : -2.4, 0, d / 2 - 1.2), Math.PI); p.anim = 'crossed'; break; }
      case 'host': p.walkTo(nav, this.randomFree(), 'tablet', null, () => setTimeout(go, 5000)); p.setProp('tablet'); break;
      case 'manager': p.setProp('tablet'); p.walkTo(nav, this.randomFree(), 'tablet', null, () => setTimeout(go, 6000)); break;
      case 'valet': p.place(new THREE.Vector3(4 + (i % 3) * 1.2, 0, STREET_Z - 6.5), Math.PI); p.anim = 'idle'; break;
      default: p.walkTo(nav, this.randomFree(), 'phone', null, () => setTimeout(go, 6000));
    }
  }
  private wander(p: Person) { const tgt = new THREE.Vector3(-60 + vrand() * 120, 0, STREET_Z - 7 + vrand() * 2); p.walkTo(null, tgt, 'idle', null, () => setTimeout(() => { if (this.people.includes(p)) this.wander(p); }, 1500)); }
  randomFree() { for (let k = 0; k < 40; k++) { const x = Math.floor(vrand() * this.nav.w), z = Math.floor(vrand() * this.nav.d); if (this.nav.free(x, z)) return this.nav.center(x, z); } return new THREE.Vector3(0, 0, 0); }
  private pickArr<T>(a: T[]) { return a[Math.floor(vrand() * a.length)]; }
  private near(p: THREE.Vector3, r: number) { const a = vrand() * Math.PI * 2; return new THREE.Vector3(p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r); }

  // ---------------- Camera presets ----------------
  viewHall(snap = false) { const { d } = hallDims(this.g.hall.size); this.rig.flyTo(new THREE.Vector3(0, 0, d * 0.1), Math.max(26, d * 1.35), 0.95, 0); if (snap) this.rig.snap(); }
  viewNeighborhood() { this.rig.flyTo(new THREE.Vector3(0, 0, 0), 190, 1.05, 0.3); }
  viewEntrance(snap = false) { const { d } = hallDims(this.g.hall.size); this.rig.flyTo(new THREE.Vector3(0, 2, d / 2 + 14), 16, 0.18, 0); if (snap) this.rig.snap(); }

  // ---------------- Picking ----------------
  private ray = new THREE.Raycaster();
  tap(x: number, y: number) {
    const r = this.stage.canvas.getBoundingClientRect(); const v = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.stage.camera);
    if (this.build) { this.build.tap(this.ray); return; }
    // people first
    let best: Person | null = null; let bestD = Infinity;
    for (const p of this.people) { const c = p.pos.clone().setY(1); const d = this.ray.ray.distanceToPoint(c); if (d < 0.6 && d < bestD) { bestD = d; best = p; } }
    if (best && this.rig.dist < 70) { this.rig.flyTo(best.pos.clone(), Math.min(this.rig.dist, 14)); this.onPick({ kind: 'person', person: best }, x, y); return; }
    const hits = this.ray.intersectObjects(this.view.pickables, false).filter((h) => h.object.visible !== false || true);
    const interiorFirst = this.rig.interior ? hits.find((h) => (h.object as any).pick?.kind === 'item') : null;
    const hit = interiorFirst ?? hits.find((h) => (h.object as any).pick?.kind !== 'item' || this.rig.interior);
    if (!hit) return;
    const pk = (hit.object as any).pick as Pick; const wp = new THREE.Vector3(); hit.object.getWorldPosition(wp);
    if (pk.kind === 'plot' || pk.kind === 'office') this.rig.flyTo(wp.setY(0), 40);
    else if (pk.kind === 'hall' && !this.rig.interior) this.viewHall();
    else if (pk.kind === 'item') this.rig.flyTo(wp.setY(0), Math.min(this.rig.dist, 22));
    this.onPick(pk, x, y);
  }
  screenPos(p: THREE.Vector3) { const v = p.clone().project(this.stage.camera); const r = this.stage.canvas.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z < 1 && v.z > -1 }; }

  update(dt: number, t: number) {
    this.rig.update(dt);
    const interior = this.mode === 'night' || this.mode === 'build' || this.rig.interior;
    this.view.update(dt, t, this.stage.camera, interior && this.mode !== 'title' && this.mode !== 'custom' && this.mode !== 'story');
    this.night?.update(dt, t);
    const cam = this.stage.camera.position; const lodBase = this.stage.quality === 'smooth' ? 2 : 1;
    for (const p of this.people) { const d = p.pos.distanceTo(cam); p.update(dt, t, d > 45 ? 3 * lodBase : d > 25 ? 2 * lodBase : lodBase); }
    if (this.mode === 'night' || this.mode === 'day') separate(this.people, this.nav, dt);
  }

  // ---------------- Owner customization stage (matches the reference image) ----------------
  setupCustomization(male: Look, female: Look) {
    this.mode = 'custom'; this.clearPeople(); this.stage.setDayTime(0.12); this.view.setMood(0, 0);
    const { d } = hallDims(this.g.hall.size); const z = d / 2 + 9;
    const m = this.addPerson(male, new THREE.Vector3(-0.75, 0, z), 0.15, 'owner'); m.anim = 'crossed';
    const f = this.addPerson(female, new THREE.Vector3(0.75, 0, z), -0.15, 'owner'); f.anim = 'pose';
    const portrait = window.innerHeight > window.innerWidth;
    this.rig.flyTo(new THREE.Vector3(portrait ? 0 : 1.7, 0.95, z), portrait ? 6.2 : 5.2, 0.1, 0); this.rig.snap(); this.rig.locked = true;
    return { m, f };
  }
  /** Small turnaround renders (front/side/back) and face portraits for the customization screen. */
  renderThumb(look: Look, opts: { yaw?: number; face?: boolean; size?: number; anim?: Anim }): string {
    const size = opts.size ?? 128; const r = this.stage.renderer; const sc = new THREE.Scene(); sc.background = null;
    sc.add(new THREE.HemisphereLight('#ffffff', '#c8b8a0', 1.6)); const dl = new THREE.DirectionalLight('#ffffff', 2.2); dl.position.set(2, 3, 4); sc.add(dl);
    const p = new Person(look); p.place(new THREE.Vector3(), opts.yaw ?? 0); p.anim = opts.anim ?? 'idle'; p.update(0, 0.8); sc.add(p.obj);
    const H = p.c.dims.H; const cam = new THREE.PerspectiveCamera(opts.face ? 22 : 24, 1, 0.1, 50);
    if (opts.face) { cam.position.set(0, p.c.dims.headY, 1.6); cam.lookAt(0, p.c.dims.headY - 0.02, 0); } else { cam.position.set(0, H * 0.55, H * 2.35); cam.lookAt(0, H * 0.5, 0); }
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const prevTarget = r.getRenderTarget(); const prevClear = r.getClearAlpha(); r.setClearColor(0x000000, 0); r.setRenderTarget(rt); r.clear(); r.render(sc, cam);
    const buf = new Uint8Array(size * size * 4); r.readRenderTargetPixels(rt, 0, 0, size, size, buf); r.setRenderTarget(prevTarget); r.setClearAlpha(prevClear);
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d')!; const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    ctx.putImageData(img, 0, 0); rt.dispose(); p.dispose();
    return cv.toDataURL('image/png');
  }
  capturePhoto(): string {
    this.stage.frame(); const src = this.stage.renderer.domElement; const cv = document.createElement('canvas'); const W = 360; cv.width = W; cv.height = Math.round(W * (src.height / src.width));
    try { cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', 0.72); } catch { return ''; }
  }

  // ---------------- Meeting scene at the reception desk ----------------
  setupMeeting(groom: Look, bride: Look) {
    this.mode = 'meeting'; this.clearPeople(); this.stage.setDayTime(0.15);
    const base = OFFICE_POS.clone().add(new THREE.Vector3(0, 0, 9));
    const desk = new THREE.Group(); desk.position.copy(base);
    desk.add(Props.mesh(new THREE.BoxGeometry(2.6, 0.9, 1.0), MAT.wood, 0, 0.45, 0)); desk.add(Props.mesh(new THREE.BoxGeometry(2.8, 0.06, 1.2), MAT.marble, 0, 0.93, 0)); desk.add(Props.mesh(new THREE.BoxGeometry(2.62, 0.08, 1.02), MAT.gold, 0, 0.1, 0));
    const vase = Props.plant(); vase.scale.setScalar(0.5); vase.position.set(-1.0, 0.95, 0); desk.add(vase);
    const rose = Props.roseBush(); rose.scale.setScalar(0.35); rose.position.set(1.0, 0.95, 0); desk.add(rose);
    const lap = Props.mesh(new THREE.BoxGeometry(0.35, 0.02, 0.25), MAT.dark, 0, 0.97, -0.25); desk.add(lap);
    for (const x of [-0.55, 0.55]) { const c = Props.chair(false); c.position.set(x, 0, 1.15); c.rotation.y = Math.PI; desk.add(c); }
    const oc = Props.chair(false); oc.position.set(0, 0, -1.0); desk.add(oc);
    const bg = Props.mesh(new THREE.BoxGeometry(6, 3.5, 0.2), MAT.creamLight, 0, 1.75, -2.2); desk.add(bg);
    desk.add(Props.mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 20), MAT.gold, -0.22, 2.5, -2.05)); desk.add(Props.mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 20), MAT.gold, 0.22, 2.5, -2.05));
    this.extra.add(desk);
    const o = this.addPerson(this.g.s.owner, base.clone().add(new THREE.Vector3(0, 0, -1.0)), 0, 'owner'); o.anim = 'sitTalk';
    const gp = this.addPerson(groom, base.clone().add(new THREE.Vector3(-0.55, 0, 1.15)), Math.PI, 'guest'); gp.anim = 'sitTalk';
    const bp = this.addPerson(bride, base.clone().add(new THREE.Vector3(0.55, 0, 1.15)), Math.PI, 'guest'); bp.anim = 'sit';
    this.rig.flyTo(base.clone().add(new THREE.Vector3(0.0, 0.6, 0.2)), 4.6, 0.32, 0.55); this.rig.snap(); this.rig.locked = true;
    return { groom: gp, bride: bp, owner: o };
  }
  endMeeting() { this.extra.clear(); this.rig.locked = false; this.setupDay(); this.viewHall(true); }

  startNight(sim: NightSim) { this.clearPeople(); this.mode = 'night'; this.night = new NightDirector(this, sim); }
  endNight() { this.night?.dispose(); this.night = null; this.setupDay(); }
  startBuild() { this.mode = 'build'; this.clearPeople(); this.build = new BuildMode(this); this.rig.topDown = true; const { w, d } = hallDims(this.g.hall.size); this.rig.flyTo(new THREE.Vector3(0, 0, 0), Math.max(w, d) * 1.25, 1.5, 0); }
  endBuild() { this.build?.dispose(); this.build = null; this.rig.topDown = false; this.rebuildInterior(); this.setupDay(); this.viewHall(); }
}

// ======================================================================================
// The live wedding night: guests arrive, grand entrance, dinner, dancing, farewell.
// ======================================================================================
export class NightDirector {
  guests: Person[] = []; staff: Person[] = []; bride!: Person; groom!: Person; manager: Person | null = null;
  phase = ''; t = 0; problemsShown = new Map<number, THREE.Vector3>(); photoTaken = false; seatsFor = new Map<Person, { pos: THREE.Vector3; face: number }>();
  dayT = 0.15; private rng = new Rng(7);
  constructor(public w: World, public sim: NightSim) {
    const g = w.g; const h = g.hall; const b = sim.b; const r = b.req; const nav = w.nav; const { d } = hallDims(h.size);
    w.view.applyPlan(b.plan); w.view.doorTarget = 1; w.stage.setDayTime(0.2);
    // The couple, dressed for the wedding theme.
    const groomLook: Look = { ...r.look.g, dress: 'groom', acc: [] }; const brideLook: Look = { ...r.look.b, dress: 'bride', hair: 0, acc: ['earrings', 'necklace'] };
    this.groom = w.addPerson(groomLook, new THREE.Vector3(-0.6, 0, STREET_Z - 8), Math.PI, 'groom'); this.bride = w.addPerson(brideLook, new THREE.Vector3(0.6, 0, STREET_Z - 8), Math.PI, 'bride');
    this.bride.setProp('bouquet'); this.groom.anim = 'idle'; this.bride.anim = 'idle';
    // Owner greets at the door.
    w.owner = w.addPerson(g.s.owner, new THREE.Vector3(3, 0, d / 2 - 1.5), Math.PI, 'owner'); w.owner.anim = 'pose';
    // Staff
    const cap = QUALITY[w.stage.quality].guests;
    for (const e of staffIn(g, h === g.s.halls[b.hall] ? b.hall : g.s.activeHall).slice(0, Math.max(6, Math.round(cap / 4)))) {
      const p = w.addPerson(e.look, w.randomFree(), 0, e.role); p.data.emp = e.id; this.staff.push(p);
      if (e.role === 'manager' && managerOf(g, b.hall)?.id === e.id) { this.manager = p; p.setProp('tablet'); }
    }
    this.placeStaff();
    // Guests (a visible sample if the wedding is huge).
    const n = Math.min(r.guests, cap, nav.seats.length); const seats = w['rng'].shuffle([...nav.seats]);
    for (let i = 0; i < n; i++) {
      const look = randomLook(this.rng); const s = seats[i];
      const start = new THREE.Vector3(-3 + vrand() * 6, 0, STREET_Z - 6 - vrand() * 4);
      const p = w.addPerson(look, start, Math.PI, 'guest'); p.anim = 'idle'; this.guests.push(p); this.seatsFor.set(p, { pos: s.pos, face: s.face }); p.data.delay = (i / n) * sim.phaseTimes[0].end * 0.7;
    }
  }
  private placeStaff() {
    const w = this.w; const nav = w.nav;
    for (const p of this.staff) {
      switch (p.role) {
        case 'cook': { const k = cellToWorld(w.g.hall, 2, 0); p.place(new THREE.Vector3(k.x + 1 + vrand() * 3, 0, k.z - 6.5), Math.PI); p.anim = 'cook'; break; }
        case 'bartender': { const b = nav.spots.bar?.[0]; if (b) p.place(b.clone().add(new THREE.Vector3(0, 0, -1.6)), 0); p.anim = 'idle'; break; }
        case 'security': { const { d } = hallDims(w.g.hall.size); p.place(new THREE.Vector3(vrand() < 0.5 ? 2.6 : -2.6, 0, d / 2 - 1), Math.PI); p.anim = 'crossed'; break; }
        case 'sound_tech': { const dj = nav.spots.dj?.[0]; if (dj) p.place(dj, Math.PI); p.anim = 'fix'; break; }
        case 'valet': p.place(new THREE.Vector3(5 + vrand() * 4, 0, STREET_Z - 6.5), Math.PI); p.anim = 'idle'; break;
        case 'host': { const { d } = hallDims(w.g.hall.size); p.place(new THREE.Vector3(-3, 0, d / 2 - 2), Math.PI); p.anim = 'wave'; break; }
        default: p.place(w.randomFree(), 0);
      }
    }
  }
  private waiterLoop(p: Person) {
    const w = this.w; if (!w.people.includes(p) || this.phase === 'farewell') return;
    const kitchen = cellToWorld(w.g.hall, 1, 1).add(new THREE.Vector3(0.5, 0, 0.5)); const tables = w.nav.spots.table ?? [];
    const tgt = tables.length ? tables[Math.floor(vrand() * tables.length)] : w.randomFree();
    p.setProp('tray'); p.walkTo(w.nav, tgt.clone().add(new THREE.Vector3(1.6 * (vrand() < 0.5 ? 1 : -1), 0, 0)), 'idle', null, () => { p.setProp(null); setTimeout(() => p.walkTo(w.nav, kitchen, 'idle', null, () => setTimeout(() => this.waiterLoop(p), 600)), 900); });
  }
  update(dt: number, t: number) {
    const sim = this.sim; const w = this.w; this.t = sim.t;
    const ph = sim.phase;
    if (ph !== this.phase) { this.phase = ph; this.enterPhase(ph); }
    // Arrivals are staggered.
    if (ph === 'arrive') for (const p of this.guests) if (p.data.delay != null && sim.t >= p.data.delay) { const s = this.seatsFor.get(p)!; delete p.data.delay; this.walkInto(p, s.pos, 'sit', s.face); }
    // Day turns to sunset then night.
    const prog = sim.t / sim.duration; this.dayT = Math.min(1, 0.2 + prog * 1.3); w.stage.setDayTime(this.dayT);
    w.view.setMood(Math.max(0, (this.dayT - 0.45) / 0.55), ph === 'dancing' ? 1 : ph === 'farewell' ? 0.4 : 0);
    const act = sim.problems.filter((p) => p.state === 'active').map((p) => p.id);
    w.view.flicker = act.includes('power_cut') ? 2 : act.includes('flickering_lights') ? 1 : 0;
    // Problems: the manager walks over and fixes them.
    for (const p of sim.problems) {
      if (p.state === 'active' && !this.problemsShown.has(p.uid)) { this.problemsShown.set(p.uid, this.problemSpot(p)); }
      if (p.manager && this.manager && !this.manager.data.busy && p.state === 'active') {
        const spot = this.problemsShown.get(p.uid)!; this.manager.data.busy = p.uid; this.manager.setProp(null);
        this.manager.walkTo(w.nav, spot, 'fix', null, () => { setTimeout(() => { if (this.manager) { this.manager.data.busy = 0; this.manager.anim = 'tablet'; this.manager.setProp('tablet'); } }, 1600); }, true);
      }
    }
    // Reactions: emotes and speech bubbles that match happiness.
    if (vrand() < dt * 0.9 && this.guests.length) {
      const p = this.guests[Math.floor(vrand() * this.guests.length)]; const mood = this.mood();
      p.setEmote(mood > 70 ? (vrand() < 0.5 ? 'heart' : 'star') : mood > 45 ? 'happy' : vrand() < 0.5 ? 'angry' : 'sad');
      if (w.g.s.settings.bubbles && vrand() < 0.4) { const pool = CONTENT.bubbles[mood > 70 ? 'happy' : mood > 45 ? 'neutral' : 'sad']; p.bubble = { text: JSON.stringify(pool[Math.floor(vrand() * pool.length)]), t: 2.6 }; }
      p.expr = mood > 70 ? 'excited' : mood > 45 ? 'happy' : mood > 30 ? 'worried' : 'angry';
    }
    // The wedding photo, taken during the dancing.
    if (ph === 'dancing' && !this.photoTaken && sim.phaseProgress() > 0.35) { this.photoTaken = true; const pos = this.groom.pos.clone(); w.rig.flyTo(pos, 9, 0.35); setTimeout(() => { sim.photo = w.capturePhoto(); }, 900); }
    if (w.autoCam && w.g.s.settings.autoCamera) this.autoCamera(t);
  }
  mood() { return Math.max(0, Math.min(100, 70 + this.sim.delta * 2)); }
  private problemSpot(p: ActiveProblem) {
    const nav = this.w.nav; const list = nav.spots.table ?? []; const base = list.length ? list[p.spot % list.length] : this.w.randomFree();
    return base.clone().add(new THREE.Vector3(1.6, 0, 0));
  }
  problemWorldPos(uid: number) { return this.problemsShown.get(uid) ?? null; }
  private walkInto(p: Person, to: THREE.Vector3, then: Anim, face: number | null) {
    const { d } = hallDims(this.w.g.hall.size);
    const outside = [new THREE.Vector3(p.pos.x * 0.3, 0, STREET_Z - 12), new THREE.Vector3((vrand() - 0.5) * 2, 0, d / 2 + 4), new THREE.Vector3((vrand() - 0.5) * 1.5, 0, d / 2 + 0.6)];
    p.walkPath(outside, 'walk', null, () => p.walkTo(this.w.nav, to, then, face));
  }
  private enterPhase(ph: string) {
    const w = this.w; const nav = w.nav; const { d } = hallDims(w.g.hall.size);
    const head = nav.spots.head?.[0]; const dance = nav.spots.dance?.[0] ?? new THREE.Vector3(0, 0, 0);
    switch (ph) {
      case 'entrance': {
        // Guests stand and clap while the couple walks the aisle.
        for (const p of this.guests) if (!p.moving) { p.anim = 'clap'; p.expr = 'excited'; }
        const aisleEnd = dance.clone();
        for (const [p, off] of [[this.groom, -0.35], [this.bride, 0.35]] as const) { p.walkPath([new THREE.Vector3(off, 0, STREET_Z - 12), new THREE.Vector3(off, 0, d / 2 + 2), new THREE.Vector3(off, 0, d / 2 - 1)], 'walk', null, () => p.walkTo(nav, aisleEnd.clone().add(new THREE.Vector3(off, 0, 0)), 'wave', Math.PI)); p.speed = 0.9; }
        if (w.g.s.settings.autoCamera) w.rig.flyTo(new THREE.Vector3(0, 0, d / 2 - 3), 12, 0.35, 0);
        break;
      }
      case 'dinner': {
        for (const p of this.guests) { const s = this.seatsFor.get(p); if (s && !p.moving) { p.place(s.pos, s.face); p.anim = vrand() < 0.6 ? 'eat' : 'sitTalk'; } else if (s) { p.walkTo(nav, s.pos, 'eat', s.face); } }
        const ht = head ?? dance; for (const [p, off] of [[this.groom, -0.45], [this.bride, 0.45]] as const) p.walkTo(nav, ht.clone().add(new THREE.Vector3(off, 0, -1.4)), 'sitTalk', 0);
        for (const s of this.staff.filter((x) => x.role === 'waiter')) setTimeout(() => this.waiterLoop(s), vrand() * 3000);
        break;
      }
      case 'dancing': {
        const cells = nav.danceCells.length ? nav.danceCells : [dance];
        this.groom.walkTo(nav, dance.clone().add(new THREE.Vector3(-0.28, 0, 0)), 'slowdance', Math.PI / 2); this.bride.walkTo(nav, dance.clone().add(new THREE.Vector3(0.28, 0, 0)), 'slowdance', -Math.PI / 2);
        this.guests.forEach((p, i) => { if (i % 3 === 2) return; const c = cells[Math.floor(vrand() * cells.length)]; const tgt = c.clone().add(new THREE.Vector3((vrand() - 0.5) * 0.6, 0, (vrand() - 0.5) * 0.6)); if (tgt.distanceTo(dance) < 1.2) tgt.add(new THREE.Vector3(1.5, 0, 1.5)); p.walkTo(nav, tgt, DANCES[i % 5], vrand() * 6); });
        for (const s of this.staff.filter((x) => x.role === 'sound_tech')) s.anim = 'dance4';
        break;
      }
      case 'farewell': {
        w.view.doorTarget = 1;
        // Guests line the exit for the sparkler send-off, then leave.
        this.guests.forEach((p, i) => { const side = i % 2 ? 1 : -1; const row = Math.floor(i / 2); const z = d / 2 + 3 + (row % 12) * 1.1; p.walkTo(nav, new THREE.Vector3(side * 0.3, 0, d / 2 - 0.5), 'walk', null, () => p.walkPath([new THREE.Vector3(side * 2.6, 0, z)], 'cheer', side > 0 ? -Math.PI / 2 : Math.PI / 2)); });
        for (const p of [this.groom, this.bride]) p.walkTo(nav, new THREE.Vector3(p === this.groom ? -0.3 : 0.3, 0, d / 2 - 0.4), 'walk', null, () => p.walkPath([new THREE.Vector3(p === this.groom ? -0.3 : 0.3, 0, STREET_Z - 8)], 'wave', 0));
        setTimeout(() => w.view.launchFireworks(), 2500);
        if (w.g.s.settings.autoCamera) w.rig.flyTo(new THREE.Vector3(0, 2, d / 2 + 10), 22, 0.35, 0);
        break;
      }
    }
  }
  private camT = 0;
  private autoCamera(t: number) {
    // Gentle orbit around the action; never fights the player (disabled once they touch the camera).
    this.camT += 0.016; const { d } = hallDims(this.w.g.hall.size);
    if (this.phase === 'dinner' || this.phase === 'dancing') this.w.rig.goal.yaw = Math.sin(t * 0.05) * 0.5;
    void d;
  }
  /** Perfect night: slow-motion confetti and a close-up of the couple. */
  celebrate() { const p = this.groom.pos.clone().add(this.bride.pos).multiplyScalar(0.5); this.w.rig.flyTo(p.setY(1), 4.5, 0.2); }
  dispose() { this.w.view.doorTarget = 0; this.w.view.flicker = 0; }
}

// ======================================================================================
// Build mode: place, move, rotate and remove items on the grid, with undo and a top-down view.
// ======================================================================================
export class BuildMode {
  selectedItem: string | null = null; selectedUid: number | null = null; rot = 0; ghost: THREE.Mesh | null = null; grid: THREE.LineSegments;
  history: { kind: 'add' | 'remove' | 'move'; item: any; before?: any }[] = []; onChange: () => void = () => {};
  constructor(public w: World) {
    const h = w.g.hall; const { w: W, d: D } = hallDims(h.size);
    const pts: number[] = []; for (let x = 0; x <= W; x++) pts.push(x - W / 2, 0.05, -D / 2, x - W / 2, 0.05, D / 2); for (let z = 0; z <= D; z++) pts.push(-W / 2, 0.05, z - D / 2, W / 2, 0.05, z - D / 2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#3b6fd8', transparent: true, opacity: 0.35 })); w.extra.add(this.grid);
  }
  cellAt(ray: THREE.Raycaster) { const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p); const { w, d } = hallDims(this.w.g.hall.size); return { x: Math.floor(p.x + w / 2), z: Math.floor(p.z + d / 2), p }; }
  tap(ray: THREE.Raycaster) {
    const c = this.cellAt(ray); const h = this.w.g.hall;
    if (this.selectedItem) {
      const def = ITEM_BY_ID[this.selectedItem]; const it = { uid: -1, id: this.selectedItem, x: c.x - Math.floor((this.rot % 2 ? def.d : def.w) / 2), z: c.z - Math.floor((this.rot % 2 ? def.w : def.d) / 2), rot: this.rot };
      this.w.g.emit('buildPlace', it); return;
    }
    if (this.selectedUid != null) { const cur = h.layout.find((i) => i.uid === this.selectedUid); if (cur) { const f = footprint(cur); this.w.g.emit('buildMove', { uid: cur.uid, x: c.x - Math.floor(f.w / 2), z: c.z - Math.floor(f.d / 2), rot: cur.rot }); } return; }
    const hits = ray.intersectObjects(this.w.view.pickables, false).find((x) => (x.object as any).pick?.kind === 'item');
    if (hits) { this.selectedUid = (hits.object as any).pick.uid; this.onChange(); }
  }
  showGhost(valid: boolean, it: { id: string; x: number; z: number; rot: number } | null) {
    if (this.ghost) { this.w.extra.remove(this.ghost); this.ghost = null; } if (!it) return;
    const f = footprint({ uid: 0, ...it }); const c = cellToWorld(this.w.g.hall, it.x, it.z).add(new THREE.Vector3(f.w / 2, 0, f.d / 2));
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(f.w, 0.3, f.d), new THREE.MeshBasicMaterial({ color: valid ? '#3ccf6e' : '#e53935', transparent: true, opacity: 0.45 })); this.ghost.position.set(c.x, 0.15, c.z); this.w.extra.add(this.ghost);
  }
  valid(it: { id: string; x: number; z: number; rot: number }, skip = -1) { return canPlace(this.w.g.hall, { uid: -1, ...it }, skip); }
  dispose() { this.w.extra.remove(this.grid); if (this.ghost) this.w.extra.remove(this.ghost); }
}
export { PLOT_SLOTS, CFG, staffNeeds };
