// Builds a hall (palace exterior + detailed interior with cut-away walls) and its neighborhood.
import * as THREE from 'three';
import type { Game } from '../core/game';
import type { HallState, PlacedItem, Plan } from '../core/types';
import { HALLS, CFG, ITEM_BY_ID, PLOT_BY_ID } from '../core/data';
import { L, t } from '../core/i18n';
import { hallDims, footprint } from './layout';
import { MAT, TEX, applyTextures, worldUV } from './textures';
import * as P from './props';
import { cosmeticColor } from '../business/shop';
import { billboardActive } from '../business/marketing';
import { Traffic } from './traffic';
import { Particles } from './particles';

export const WALL_H = 7;
const _q = new THREE.Quaternion(); const _Y = new THREE.Vector3(0, 1, 0);
export const PLOT_SLOTS: Record<string, [number, number, number]> = { // x, z, rotationY
  restaurant: [-60, -35, Math.PI / 2], garden_venue: [-60, -8, Math.PI / 2], flower_shop: [-60, 20, Math.PI / 2],
  small_hall: [60, -35, -Math.PI / 2], pool_terrace: [60, -8, -Math.PI / 2], parking_lot: [60, 20, -Math.PI / 2],
  hotel: [-30, -46, 0], photo_studio: [0, -46, 0], cake_shop: [30, -46, 0],
};
export const OFFICE_POS = new THREE.Vector3(-30, 0, 26);
export const STREET_Z = 46;

export function cellToWorld(h: HallState, x: number, z: number) { const { w, d } = hallDims(h.size); return new THREE.Vector3(x - w / 2, 0, z - d / 2); }
export function itemCenter(h: HallState, it: PlacedItem) { const f = footprint(it); const p = cellToWorld(h, it.x, it.z); return p.add(new THREE.Vector3(f.w / 2, 0, f.d / 2)); }

export class HallView {
  root = new THREE.Group(); interior = new THREE.Group(); exterior = new THREE.Group(); hood = new THREE.Group(); itemsGroup = new THREE.Group(); plotsGroup = new THREE.Group();
  walls: { obj: THREE.Object3D; n: THREE.Vector3 }[] = []; roof = new THREE.Group(); frontUpper = new THREE.Group();
  dance: THREE.Mesh | null = null; doors: THREE.Object3D[] = []; doorOpen = 0; doorTarget = 0;
  chandeliers: THREE.Object3D[] = []; lights: THREE.PointLight[] = []; spot: THREE.SpotLight[] = []; water: THREE.Mesh[] = []; glowWindows: THREE.MeshStandardMaterial[] = [];
  pickables: THREE.Object3D[] = []; traffic: Traffic | null = null; interiorMode = true; billboard: THREE.Object3D | null = null; officeObj: THREE.Object3D | null = null;
  fx!: Particles; hallIdx = -1; night = 0; party = 0; flicker = 0; fireworks: THREE.Points | null = null; fwT = -1;
  constructor(public g: Game, public scene: THREE.Scene) { applyTextures(); scene.add(this.root); }

  build(hallIdx: number) {
    this.hallIdx = hallIdx; this.dispose();
    this.root.add(this.hood, this.exterior, this.interior, this.plotsGroup);
    this.fx = new Particles(this.root); this.fx.density = this.g.s.settings.particles ? 1 : 0.35;
    const h = this.g.s.halls[hallIdx]; const def = HALLS.halls[hallIdx];
    this.buildHood(def.atmosphere, def);
    this.buildShell(h, def);
    this.buildInterior(h);
    this.buildPlots(h);
    this.applyCosmetics();
    if (this.fountainAt) this.fx.fountain(this.fountainAt, 1);
  }
  fountainAt: THREE.Vector3 | null = null;
  dispose() {
    this.root.clear(); this.interior = new THREE.Group(); this.exterior = new THREE.Group(); this.hood = new THREE.Group(); this.itemsGroup = new THREE.Group(); this.plotsGroup = new THREE.Group();
    this.walls = []; this.roof = new THREE.Group(); this.frontUpper = new THREE.Group(); this.doors = []; this.chandeliers = []; this.lights = []; this.spot = []; this.water = []; this.pickables = []; this.glowWindows = [];
    this.traffic?.dispose(); this.traffic = null; this.dance = null; this.billboard = null;
  }

  // ---------- Building shell: walls, windows, columns, roof, entrance ----------
  private buildShell(h: HallState, def: any) {
    const { w, d } = hallDims(h.size); const pal = def.palette; const T = 0.5;
    const wallMat = new THREE.MeshStandardMaterial({ color: pal.wall, roughness: 0.8 }); const trim = def.atmosphere === 'castle' || def.atmosphere === 'mountain' ? new THREE.MeshStandardMaterial({ color: pal.trim, roughness: 0.6 }) : MAT.gold;
    const inner = MAT.wallTint; const isStone = def.atmosphere === 'castle'; const outerMat = isStone ? MAT.stone : wallMat;
    const glow = new THREE.MeshStandardMaterial({ color: '#cfe6ff', emissive: '#ffcf80', emissiveIntensity: 0, roughness: 0.1, metalness: 0.2 }); this.glowWindows.push(glow);
    // Floor foundation + marble
    const base = P.mesh(new THREE.BoxGeometry(w + 2 * T + 2, 0.4, d + 2 * T + 2), MAT.creamLight, 0, -0.2, 0); base.castShadow = false; this.exterior.add(base);
    const fl = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(w, d), 4), MAT.marble); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; fl.receiveShadow = true; this.interior.add(fl);
    // Walls (each a group so the camera-facing ones can be cut away)
    const mkWall = (len: number, normal: THREE.Vector3, pos: THREE.Vector3, rotY: number, front = false) => {
      const grp = new THREE.Group(); grp.position.copy(pos); grp.rotation.y = rotY;
      let nWin = Math.max(2, Math.floor(len / 4.2)); if (front && nWin % 2 === 0) nWin += 1; const segW = len / nWin;
      for (let i = 0; i < nWin; i++) {
        const x = -len / 2 + segW * (i + 0.5); const door = front && i === (nWin - 1) / 2;
        // lower wall
        grp.add(P.mesh(new THREE.BoxGeometry(segW, door ? 0.01 : 1.2, T), outerMat, x, door ? 0 : 0.6, 0));
        // pillars between windows
        grp.add(P.mesh(new THREE.BoxGeometry(0.7, WALL_H, T + 0.25), outerMat, x - segW / 2, WALL_H / 2, 0));
        if (!door) {
          grp.add(P.mesh(new THREE.BoxGeometry(segW - 0.7, WALL_H - 5.2, T), outerMat, x, WALL_H - (WALL_H - 5.2) / 2, 0));
          const win = P.mesh(new THREE.BoxGeometry(segW - 1.6, 3.6, 0.08), glow, x, 3.0, 0); grp.add(win);
          grp.add(P.mesh(new THREE.TorusGeometry((segW - 1.6) / 2, 0.12, 6, 16, Math.PI), trim, x, 4.8, T / 2));
          grp.add(P.mesh(new THREE.CylinderGeometry((segW - 1.6) / 2, (segW - 1.6) / 2, 0.08, 16, 1, false, -Math.PI / 2, Math.PI), glow, x, 4.8, 0, Math.PI / 2, 0, 0));
          for (const s of [-1, 1]) grp.add(P.mesh(new THREE.BoxGeometry((segW - 0.7 - (segW - 1.6)) / 2, 3.6, T), outerMat, x + s * ((segW - 1.6) / 2 + (segW - 0.7 - (segW - 1.6)) / 4), 3.0, 0));
          // interior drapes
          for (const s of [-1, 1]) grp.add(P.mesh(new THREE.BoxGeometry(0.5, 4.2, 0.06), MAT.themeDrape, x + s * ((segW - 1.6) / 2 + 0.05), 3.2, -T / 2 - 0.1));
          grp.add(P.mesh(new THREE.BoxGeometry(segW - 1.4, 0.14, 0.12), trim, x, 1.2, T / 2 + 0.05));
        } else {
          grp.add(P.mesh(new THREE.BoxGeometry(segW - 0.7, WALL_H - 4.2, T), outerMat, x, WALL_H - (WALL_H - 4.2) / 2, 0));
          // double doors that open for guests
          for (const s of [-1, 1]) {
            const pivot = new THREE.Group(); pivot.position.set(x + s * 1.4, 0, 0.0); (pivot as any).side = s;
            const leaf = P.mesh(new THREE.BoxGeometry(1.38, 4.0, 0.12), MAT.wood, -s * 0.69, 2.0, 0); pivot.add(leaf);
            pivot.add(P.mesh(new THREE.BoxGeometry(0.06, 0.5, 0.18), MAT.gold, -s * 1.2, 2.0, 0.05));
            grp.add(pivot); this.doors.push(pivot); (pivot as any).noBake = true;
          }
          grp.add(P.mesh(new THREE.TorusGeometry(1.5, 0.15, 8, 20, Math.PI), trim, x, 4.15, T / 2));
        }
      }
      // inner wainscot and cornice
      grp.add(P.mesh(new THREE.BoxGeometry(len, 0.25, 0.1), trim, 0, WALL_H - 0.15, -T / 2 - 0.05));
      grp.add(P.mesh(new THREE.BoxGeometry(len, 0.35, 0.2), trim, 0, WALL_H, T / 2 + 0.05));
      grp.add(P.mesh(new THREE.BoxGeometry(len + 0.6, 0.5, T + 0.6), outerMat, 0, WALL_H + 0.25, 0));
      // balustrade on top
      for (let x = -len / 2 + 0.4; x < len / 2; x += 0.55) grp.add(P.mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 8), MAT.creamLight, x, WALL_H + 0.85, 0));
      grp.add(P.mesh(new THREE.BoxGeometry(len + 0.6, 0.15, 0.45), MAT.creamLight, 0, WALL_H + 1.25, 0));
      const baked = P.bake(grp);
      this.exterior.add(baked); this.walls.push({ obj: baked, n: normal });
      return baked;
    };
    mkWall(w + T, new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -d / 2 - T / 2), 0);
    mkWall(d + T, new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-w / 2 - T / 2, 0, 0), Math.PI / 2);
    mkWall(d + T, new THREE.Vector3(1, 0, 0), new THREE.Vector3(w / 2 + T / 2, 0, 0), -Math.PI / 2);
    const front = mkWall(w + T, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, d / 2 + T / 2), Math.PI, true);
    this.doors = []; front.traverse((o) => { if ((o as any).side) this.doors.push(o); });
    // Interior wallpaper lining (only visible from inside)
    const lining = (len: number, x: number, z: number, ry: number) => { const m = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(len, 1.4), 2), MAT.wallpaper); m.position.set(x, 0.7, z); m.rotation.y = ry; this.interior.add(m); };
    lining(w, 0, -d / 2 + 0.02, 0);
    // Wall sconces on the inside of each wall and a gift table with wrapped presents by the entrance.
    const decor = new THREE.Group();
    const sconce = (x: number, z: number, ry: number) => { const g = new THREE.Group(); g.position.set(x, 3.0, z); g.rotation.y = ry;
      g.add(P.mesh(new THREE.BoxGeometry(0.18, 0.5, 0.08), MAT.gold, 0, 0, 0)); g.add(P.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), MAT.gold, 0, 0.1, 0.15, Math.PI / 2));
      g.add(P.mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.18, 10), MAT.cloth, 0, 0.32, 0.28)); g.add(P.mesh(new THREE.SphereGeometry(0.06, 8, 6), MAT.bulb, 0, 0.25, 0.28)); decor.add(g); };
    for (let x = -w / 2 + 3; x < w / 2 - 1; x += 4.4) sconce(x, -d / 2 + 0.05, 0);
    for (let z = -d / 2 + 3; z < d / 2 - 1; z += 4.4) { sconce(-w / 2 + 0.05, z, Math.PI / 2); sconce(w / 2 - 0.05, z, -Math.PI / 2); }
    const gift = new THREE.Group(); gift.position.set(w / 2 - 1.5, 0, d / 2 - 1);
    gift.add(P.mesh(new THREE.BoxGeometry(2.4, 0.75, 1.0), MAT.themeCloth, 0, 0.375, 0)); gift.add(P.mesh(new THREE.BoxGeometry(2.5, 0.05, 1.1), MAT.white, 0, 0.77, 0));
    const giftCols = [MAT.roseRed, MAT.goldSoft, MAT.white, MAT.themeRunner, MAT.leafDark];
    for (let i = 0; i < 9; i++) { const sz = 0.18 + (i % 3) * 0.07; const b = P.mesh(new THREE.BoxGeometry(sz, sz, sz), giftCols[i % 5], -0.95 + (i % 5) * 0.45, 0.8 + sz / 2 + (i >= 5 ? 0.25 : 0), -0.2 + (i % 2) * 0.35, 0, i * 0.4, 0); gift.add(b); gift.add(P.mesh(new THREE.BoxGeometry(sz + 0.01, 0.03, sz * 0.3), MAT.gold, b.position.x, b.position.y + sz / 2, b.position.z, 0, i * 0.4, 0)); }
    gift.add(P.mesh(new THREE.BoxGeometry(0.5, 0.04, 0.35), MAT.cloth, 0.75, 0.8, 0.25)); // guest book
    decor.add(gift); this.interior.add(P.bake(decor)); lining(d, -w / 2 + 0.02, 0, Math.PI / 2); lining(d, w / 2 - 0.02, 0, -Math.PI / 2);
    // Portico with columns, pediment, dome and the golden rings
    const port = new THREE.Group(); port.position.set(0, 0, d / 2 + T);
    for (const x of [-4.5, -2.4, 2.4, 4.5]) { port.add(P.mesh(new THREE.CylinderGeometry(0.38, 0.45, 6.8, 16), MAT.creamLight, x, 3.4, 2.6)); port.add(P.mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), trim, x, 6.9, 2.6)); port.add(P.mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), MAT.creamLight, x, 0.15, 2.6)); }
    port.add(P.mesh(new THREE.BoxGeometry(11, 0.7, 4.0), MAT.creamLight, 0, 7.35, 1.6));
    port.add(P.mesh(new THREE.BoxGeometry(11.2, 0.18, 4.2), trim, 0, 7.75, 1.6));
    const ped = new THREE.Shape(); ped.moveTo(-5.6, 0); ped.lineTo(5.6, 0); ped.lineTo(0, 2.4); ped.lineTo(-5.6, 0);
    port.add(P.mesh(new THREE.ExtrudeGeometry(ped, { depth: 0.6, bevelEnabled: false }), MAT.creamLight, 0, 7.8, 3.0));
    port.add(P.mesh(new THREE.TorusGeometry(0.55, 0.1, 10, 24), MAT.gold, -0.35, 8.9, 3.65)); port.add(P.mesh(new THREE.TorusGeometry(0.55, 0.1, 10, 24), MAT.gold, 0.35, 8.9, 3.65));
    port.add(P.mesh(new THREE.BoxGeometry(11, 0.2, 5.2), MAT.creamLight, 0, 0.1, 1.9));
    for (let i = 0; i < 3; i++) port.add(P.mesh(new THREE.BoxGeometry(11 - i * 0.6, 0.18, 0.5), MAT.creamLight, 0, 0.09 + i * 0.0, 4.6 + i * 0.5));
    const sgn = P.sign(this.g.s.halls[this.hallIdx].name.toUpperCase(), 7, 1.1); sgn.position.set(0, 6.0, 3.2); port.add(sgn);
    this.frontUpper.add(P.bake(port)); this.frontUpper.add(sgn);
    // Roof + central dome with rings on top
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + T * 2, 0.4, d + T * 2), MAT.creamLight); roof.position.y = WALL_H + 0.2; roof.castShadow = true; this.roof.add(roof);
    const dome = P.mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.creamLight, 0, WALL_H + 0.4, d * 0.05); this.roof.add(dome);
    const drum = P.mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.23, Math.min(w, d) * 0.24, 1.0, 24), trim, 0, WALL_H + 0.5, d * 0.05); this.roof.add(drum);
    const top = WALL_H + 0.4 + Math.min(w, d) * 0.22;
    this.roof.add(P.mesh(new THREE.CylinderGeometry(0.1, 0.25, 1.2, 10), MAT.gold, 0, top + 0.5, d * 0.05));
    this.roof.add(P.mesh(new THREE.TorusGeometry(0.9, 0.16, 10, 26), MAT.gold, -0.55, top + 1.9, d * 0.05)); this.roof.add(P.mesh(new THREE.TorusGeometry(0.9, 0.16, 10, 26), MAT.gold, 0.55, top + 1.9, d * 0.05));
    this.exterior.add(this.roof, this.frontUpper);
    // Kitchen annex at back-left with cooks' counters
    const k = new THREE.Group(); k.position.set(-w / 2 + 3, 0, -d / 2 - 4.5);
    k.add(P.mesh(new THREE.BoxGeometry(6, 0.1, 8), MAT.paving, 0, 0.05, 0));
    for (const s of [-1, 1]) k.add(P.mesh(new THREE.BoxGeometry(0.3, 3.2, 8), MAT.creamLight, s * 3, 1.6, 0));
    k.add(P.mesh(new THREE.BoxGeometry(6, 3.2, 0.3), MAT.creamLight, 0, 1.6, -4));
    k.add(P.mesh(new THREE.BoxGeometry(4.6, 0.95, 0.8), MAT.chrome, 0, 0.475, -3.2)); k.add(P.mesh(new THREE.BoxGeometry(0.8, 0.95, 4), MAT.chrome, 2.2, 0.475, -0.8));
    for (let i = 0; i < 4; i++) k.add(P.mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.25, 12), MAT.dark, -1.6 + i * 1.0, 1.08, -3.2));
    this.exterior.add(P.bake(k));
    // Interior lights (few, for phones). Chandeliers glow via emissive + bloom.
    const nCh = Math.max(2, Math.round((w * d) / 120));
    const cols = Math.max(1, Math.round(Math.sqrt(nCh * w / d))); const rows = Math.max(1, Math.ceil(nCh / cols));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const c = P.chandelier(1.3); c.position.set(-w / 2 + (i + 0.5) * (w / cols), WALL_H - 1.4, -d / 2 + (j + 0.5) * (d / rows)); this.chandeliers.push(c); this.interior.add(c); }
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight('#ffd9a0', 0, w * 1.2, 1.6); l.position.set((i - 0.5) * w * 0.5, WALL_H - 2, 0); this.lights.push(l); this.interior.add(l); }
    for (let i = 0; i < 2; i++) { const s = new THREE.SpotLight('#ff7ad9', 0, 30, 0.35, 0.6, 1); s.position.set((i - 0.5) * w * 0.6, WALL_H - 0.5, d / 2 - 2); this.interior.add(s, s.target); this.spot.push(s); }
  }

  // ---------- Interior items from the layout (rebuilt in build mode) ----------
  buildInterior(h: HallState) {
    this.interior.remove(this.itemsGroup); this.itemsGroup = new THREE.Group(); this.dance = null;
    const statics = new THREE.Group();
    for (const it of h.layout) {
      const def = ITEM_BY_ID[it.id]; if (!def) continue; const c = itemCenter(h, it); const f = footprint(it);
      let o: THREE.Object3D | null = null;
      switch (it.id) {
        case 'round_table': o = P.roundTable(10); break;
        case 'long_table': o = P.longTable(8); break;
        case 'sweetheart': o = P.sweetheartTable(); break;
        case 'stage': o = P.stage(def.w, def.d); break;
        case 'dance_floor': { const m = P.danceFloorMesh(f.w, f.d); m.position.set(c.x, 0.03, c.z); this.itemsGroup.add(m); this.dance = m; const rim = P.mesh(new THREE.BoxGeometry(f.w + 0.2, 0.04, f.d + 0.2), MAT.gold, c.x, 0.0, c.z); statics.add(rim); break; }
        case 'bar': o = P.bar(); break; case 'buffet': o = P.buffet(); break; case 'cake': o = P.cake(); break; case 'dj': o = P.djBooth(); break;
        case 'plant': o = P.plant(); break; case 'flower_arch': o = P.flowerArch(); break; case 'lamp': o = P.lamp(); break; case 'rose_bush': o = P.roseBush(); break;
        case 'photo_wall': o = P.photoWall(); break; case 'fountain': o = P.fountain(); break;
      }
      if (o) { o.position.set(c.x, 0, c.z); o.rotation.y = -(it.rot % 4) * Math.PI / 2 + (it.id === 'stage' || it.id === 'dj' || it.id === 'bar' || it.id === 'buffet' ? Math.PI * 0 : 0); statics.add(o); }
      // invisible pick box for build mode / taps
      const pick = new THREE.Mesh(new THREE.BoxGeometry(f.w * 0.95, 1.2, f.d * 0.95), new THREE.MeshBasicMaterial({ visible: false })); pick.position.set(c.x, 0.6, c.z); (pick as any).pick = { kind: 'item', uid: it.uid }; (pick as any).noBake = true; this.itemsGroup.add(pick);
    }
    // Entrance carpet inside
    const { w, d } = hallDims(h.size); const carpet = P.mesh(new THREE.BoxGeometry(2.4, 0.02, 3), MAT.carpet, 0, 0.02, d / 2 - 1.5); statics.add(carpet);
    this.itemsGroup.add(P.bake(statics));
    this.interior.add(this.itemsGroup); void w;
    this.pickables = this.pickables.filter((p) => !(p as any).pick || (p as any).pick.kind !== 'item');
    this.itemsGroup.traverse((o) => { if ((o as any).pick) this.pickables.push(o); });
    this.applyCosmetics();
  }

  // ---------- Plots around the hall ----------
  buildPlots(h: HallState) {
    this.root.remove(this.plotsGroup); this.plotsGroup = new THREE.Group(); this.root.add(this.plotsGroup);
    this.pickables = this.pickables.filter((p) => (p as any).pick?.kind !== 'plot');
    for (const id in PLOT_SLOTS) {
      const [x, z, ry] = PLOT_SLOTS[id]; const lvl = h.plots[id] ?? 0; const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry;
      if (!lvl) {
        grp.add(P.mesh(new THREE.BoxGeometry(20, 0.08, 15), MAT.grass, 0, 0.04, 0));
        const post = P.mesh(new THREE.CylinderGeometry(0.08, 0.08, 2, 6), MAT.wood, 0, 1, 6); grp.add(post);
        const s = P.mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshStandardMaterial({ map: TEX.forSale() }), 0, 2, 6.06); grp.add(s);
        const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = 5.94; grp.add(s2);
      } else grp.add(this.plotBuilding(id, lvl));
      const pick = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 15), new THREE.MeshBasicMaterial({ visible: false })); pick.position.y = 2; (pick as any).pick = { kind: 'plot', id }; grp.add(pick); this.pickables.push(pick);
      this.plotsGroup.add(grp);
    }
    // Owner's office: a real building you can tap and enter.
    const off = new THREE.Group(); off.position.copy(OFFICE_POS);
    off.add(P.building(9, 5, 7, '#f7efe0', false, '#1f3c88'));
    off.add(P.mesh(new THREE.BoxGeometry(2, 3, 0.2), MAT.wood, 0, 1.5, 3.55));
    const sg = P.sign(t('dock.office'), 4, 1); sg.position.set(0, 4, 3.62); off.add(sg);
    for (const x of [-3, 3]) { const t = P.tree('cypress'); t.position.set(x, 0, 4.5); off.add(t); }
    const pick = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshBasicMaterial({ visible: false })); pick.position.y = 3; (pick as any).pick = { kind: 'office' }; off.add(pick); this.pickables.push(pick);
    this.plotsGroup.add(off); this.officeObj = off;
    // Hall itself is pickable (opens the hall menu when zoomed out)
    const { w, d } = hallDims(h.size);
    const hp = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), new THREE.MeshBasicMaterial({ visible: false })); hp.position.y = WALL_H / 2; (hp as any).pick = { kind: 'hall' }; this.plotsGroup.add(hp); this.pickables.push(hp);
    this.updateBillboard();
  }
  private plotBuilding(id: string, lvl: number) {
    const g = new THREE.Group(); const sc = 0.85 + lvl * 0.05;
    const floor = (mat: THREE.Material) => g.add(P.mesh(new THREE.BoxGeometry(20, 0.1, 15), mat, 0, 0.05, 0));
    switch (id) {
      case 'restaurant': { floor(MAT.paving); const b = P.building(12, 5 + lvl * 0.4, 8, '#f2d6b3', true, '#a33b2b'); b.position.z = -2; g.add(b); const aw = P.mesh(new THREE.BoxGeometry(12, 0.2, 2.4), MAT.red, 0, 3.2, 2.9, 0.25); g.add(aw); for (let i = 0; i < 4; i++) { const t = P.roundTable(4, true); t.scale.setScalar(0.7); t.position.set(-4.5 + i * 3, 0, 5); g.add(t); } g.add(this.label(L(PLOT_BY_ID.restaurant), 3.5, 2.05)); break; }
      case 'hotel': { floor(MAT.paving); const b = P.building(14, 10 + lvl * 3, 9, '#e8e2f0', true, '#3a3f6a'); b.position.z = -2; g.add(b); g.add(P.mesh(new THREE.BoxGeometry(6, 0.3, 3), MAT.gold, 0, 3.4, 3.4)); g.add(this.label(L(PLOT_BY_ID.hotel), 4.5, 2.6)); break; }
      case 'garden_venue': { floor(MAT.grass); const a = P.flowerArch(3.2); a.position.set(0, 0, -4); g.add(a); for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; const c = P.chair(); c.position.set(-4 + i * 1.6, 0, -1 + r * 1.3); c.rotation.y = Math.PI; g.add(c); } for (const x of [-8, 8]) { const t = P.tree('round', 0.9); t.position.set(x, 0, -5); g.add(t); } for (let i = 0; i < 8; i++) { const b = P.roseBush(i % 2 === 0); b.position.set(-9 + i * 2.6, 0, 6.5); g.add(b); } break; }
      case 'pool_terrace': { floor(MAT.paving); const pool = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 7), new THREE.MeshStandardMaterial({ color: '#3fb5e0', roughness: 0.05, metalness: 0.2, emissive: '#0a5c80', emissiveIntensity: 0.2 })); pool.position.set(0, 0.0, -1); g.add(pool); this.water.push(pool); g.add(P.mesh(new THREE.BoxGeometry(12.6, 0.15, 0.3), MAT.creamLight, 0, 0.2, 2.6)); for (let i = 0; i < 5; i++) { g.add(P.mesh(new THREE.BoxGeometry(0.8, 0.3, 2), MAT.white, -6 + i * 3, 0.3, 5)); g.add(P.mesh(new THREE.ConeGeometry(1.2, 0.5, 10), MAT.roseRed, -6 + i * 3, 2.3, 5)); g.add(P.mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), MAT.white, -6 + i * 3, 1.1, 5)); } const p = P.tree('palm'); p.position.set(8, 0, -5); g.add(p); break; }
      case 'small_hall': { floor(MAT.paving); const b = P.building(12, 5, 9, '#f6ead6', true, '#d9ad45'); b.position.z = -1.5; g.add(b); for (const x of [-2, 2]) g.add(P.mesh(new THREE.CylinderGeometry(0.3, 0.35, 4.5, 12), MAT.creamLight, x, 2.25, 3.4)); g.add(P.mesh(new THREE.TorusGeometry(0.5, 0.09, 8, 20), MAT.gold, 0, 5.8, 3)); g.add(this.label(L(PLOT_BY_ID.small_hall), 3.5, 3.1)); break; }
      case 'flower_shop': { floor(MAT.paving); const b = P.building(9, 4.5, 7, '#fde1ea', false, '#4f9a42'); b.position.z = -2; g.add(b); for (let i = 0; i < 6; i++) { g.add(P.mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 10), MAT.goldSoft, -3.5 + i * 1.4, 0.25, 2.5)); const r = P.roseBush(i % 2 === 1); r.scale.setScalar(0.7); r.position.set(-3.5 + i * 1.4, 0.3, 2.5); g.add(r); } g.add(this.label(L(PLOT_BY_ID.flower_shop), 3.5, 1.6)); break; }
      case 'cake_shop': { floor(MAT.paving); const b = P.building(9, 4.5, 7, '#ffd6e6', false, '#ff6fa0'); b.position.z = -2; g.add(b); const c = P.cake(); c.scale.setScalar(2); c.position.set(0, 0, 3); g.add(c); g.add(this.label(L(PLOT_BY_ID.cake_shop), 3.5, 1.6)); break; }
      case 'photo_studio': { floor(MAT.paving); const b = P.building(10, 5, 7, '#2f3440', false, '#111'); b.position.z = -2; g.add(b); g.add(P.mesh(new THREE.BoxGeometry(2, 1.4, 0.4), MAT.black, 0, 5.8, 1.5)); g.add(P.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16), MAT.glass, 0, 5.8, 1.8, Math.PI / 2)); g.add(this.label(L(PLOT_BY_ID.photo_studio), 3.5, 1.6)); break; }
      case 'parking_lot': { floor(MAT.asphalt); for (let i = 0; i < 7; i++) g.add(P.mesh(new THREE.BoxGeometry(0.15, 0.02, 5), MAT.lineWhite, -8.4 + i * 2.8, 0.11, -3)); for (let i = 0; i < 6; i++) if ((i + lvl) % 3 !== 0) { const c = P.car(['#d0d6e0', '#1f3c88', '#b3122e', '#222', '#f2c94c'][i % 5]); c.scale.setScalar(0.7); c.position.set(-7 + i * 2.8, 0.1, -3); g.add(c); } break; }
    }
    g.scale.setScalar(sc);
    return P.bake(g);
  }
  private label(text: string, y: number, z: number) { const s = P.sign(text, 6, 1.3); s.position.set(0, y, z + 0.6); return s; }

  // ---------- Neighborhood: streets, traffic, buildings, backdrop per atmosphere ----------
  private buildHood(atmo: string, def: any) {
    const hood = new THREE.Group(); const S = STREET_Z;
    const groundMat = atmo === 'mountain' ? (() => { const m = MAT.grass.clone(); m.color.set('#dfe9e4'); return m; })() : atmo === 'desert' ? MAT.sand : atmo === 'downtown' ? MAT.paving : MAT.grass;
    const ground = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(700, 700), 8), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; hood.add(ground);
    // Paved block around the hall + front plaza
    const block = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(160, 104), 3), MAT.paving); block.rotation.x = -Math.PI / 2; block.position.set(0, 0.02, -8); block.receiveShadow = true; hood.add(block);
    // Road loop around the block (cars stay on these roads only)
    const roads = new THREE.Group(); const rw = 9; const X = 84, Zb = -64, Zf = S;
    const road = (x: number, z: number, w: number, d: number) => { const m = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(w, d), 6), MAT.asphalt); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.receiveShadow = true; roads.add(m); };
    road(0, Zf, 2 * X + rw, rw); road(0, Zb, 2 * X + rw, rw); road(-X, (Zf + Zb) / 2, rw, Zf - Zb); road(X, (Zf + Zb) / 2, rw, Zf - Zb);
    // extend the front street to the map edges
    road(-X - 120, Zf, 240 - rw, rw); road(X + 120, Zf, 240 - rw, rw);
    for (let x = -300; x < 300; x += 6) roads.add(P.mesh(new THREE.BoxGeometry(3, 0.02, 0.2), MAT.lineYellow, x, 0.05, Zf));
    for (let x = -X + 4; x < X; x += 6) roads.add(P.mesh(new THREE.BoxGeometry(3, 0.02, 0.2), MAT.lineWhite, x, 0.05, Zb));
    // crosswalk to the competitor
    for (let i = 0; i < 6; i++) roads.add(P.mesh(new THREE.BoxGeometry(0.8, 0.02, 7.5), MAT.lineWhite, -2.5 + i * 1, 0.05, Zf));
    // sidewalks with streetlights and benches
    for (const z of [Zf - rw / 2 - 1.5, Zf + rw / 2 + 1.5]) { roads.add(P.mesh(new THREE.BoxGeometry(600, 0.2, 3), MAT.paving, 0, 0.1, z)); for (let x = -150; x <= 150; x += 18) { const l = P.streetLight(); l.position.set(x, 0, z); l.rotation.y = z < Zf ? 0 : Math.PI; roads.add(l); } }
    hood.add(P.bake(roads, false));
    // Front plaza: red carpet, gold stanchions with rope, white roses, cypresses, limousine
    const plaza = new THREE.Group(); const h = this.g.s.halls[this.hallIdx]; const d = hallDims(h.size).d;
    const carpetLen = S - rw / 2 - 3 - (d / 2 + 5.5);
    const cp = P.mesh(new THREE.BoxGeometry(3, 0.04, carpetLen), MAT.carpet, 0, 0.04, d / 2 + 5.5 + carpetLen / 2); plaza.add(cp);
    for (let i = 0; i <= Math.floor(carpetLen / 2.5); i++) for (const s of [-1, 1]) { const st = P.stanchion(); const z = d / 2 + 6 + i * 2.5; st.position.set(s * 2, 0, z); plaza.add(st); if (i > 0) plaza.add(P.ropeBetween(new THREE.Vector3(s * 2, 0, z - 2.5), new THREE.Vector3(s * 2, 0, z))); }
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { const r = P.roseBush(); r.position.set(s * (7 + (i % 2) * 1.2), 0, d / 2 + 2 + i * 1.6); plaza.add(r); }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const t = P.tree('cypress', 1.1); t.position.set(s * 10, 0, d / 2 + 3 + i * 5); plaza.add(t); }
    const f = P.fountain(); f.scale.setScalar(1.6); f.position.set(16, 0, d / 2 + 10); plaza.add(f); this.fountainAt = new THREE.Vector3(16, 2.35, d / 2 + 10);
    // Lawns with low hedges and lamp posts so the block feels like palace gardens, not an empty lot.
    const lawn = (x: number, z: number, w: number, dd: number) => { const m = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(w, dd), 4), MAT.grass); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.035, z); m.receiveShadow = true; plaza.add(m);
      for (const s of [-1, 1]) { plaza.add(P.mesh(new THREE.BoxGeometry(w, 0.7, 0.7), MAT.leafDark, x, 0.35, z + s * (dd / 2 - 0.35))); plaza.add(P.mesh(new THREE.BoxGeometry(0.7, 0.7, dd), MAT.leafDark, x + s * (w / 2 - 0.35), 0.35, z)); } };
    const hw = hallDims(h.size).w;
    lawn(-16, d / 2 + 14, 9, 10); lawn(hw / 2 + 24, d / 2 + 26, 14, 10); lawn(-(hw / 2 + 12), -8, 14, d + 6); lawn(hw / 2 + 12, -8, 14, d + 6);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const l = P.streetLight(); l.scale.setScalar(0.75); l.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; l.position.set(s * 4.4, 0, d / 2 + 8 + i * 6); plaza.add(l); }
    const limo = P.car('#f7f7f7', true); limo.position.set(6, 0, S - rw / 2 - 4); limo.rotation.y = Math.PI / 2; plaza.add(limo);
    // planters along the block
    for (let x = -70; x <= 70; x += 14) if (Math.abs(x) > 20) { const t = P.tree(atmo === 'desert' ? 'palm' : atmo === 'mountain' ? 'snowpine' : 'round', 0.9); t.position.set(x, 0, S - rw / 2 - 5); plaza.add(t); }
    hood.add(P.bake(plaza));
    // Competitor's hall across the street
    const comp = new THREE.Group(); comp.position.set(-38, 0, S + 22);
    comp.add(P.building(30, 9, 16, '#efe3cf', true, '#c9a24a'));
    for (let i = 0; i < 6; i++) comp.add(P.mesh(new THREE.CylinderGeometry(0.5, 0.55, 8, 14), MAT.creamLight, -12.5 + i * 5, 4, -8.6));
    comp.add(P.mesh(new THREE.SphereGeometry(5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.goldSoft, 0, 9.4, 0));
    const cs = P.sign(L(def.competitor), 12, 1.8, '#5a1a2a'); cs.position.set(0, 7.2, -8.3); cs.rotation.y = Math.PI; comp.add(cs);
    hood.add(comp);
    // Neighbor buildings and backdrop by atmosphere
    this.buildBackdrop(hood, atmo);
    this.hood.add(hood);
    // Traffic loop: cars drive on the road rectangle only.
    this.traffic = new Traffic(this.hood, [X, Zf, Zb], atmo === 'mountain' ? 6 : 10);
  }
  private buildBackdrop(hood: THREE.Group, atmo: string) {
    const S = STREET_Z; const rand = mulberry(atmo.length * 97 + 13);
    const ring = new THREE.Group();
    // neighbor buildings on the left, right and back of the block
    const cols = atmo === 'downtown' ? ['#cfd6e2', '#b9c3d3', '#8fa0b8'] : atmo === 'desert' ? ['#f0d9a8', '#e8c890', '#f5e6c4'] : atmo === 'mountain' ? ['#8a5a3b', '#a0704a', '#6d4a33'] : atmo === 'castle' ? ['#a9a39a', '#8d877e', '#b8b0a2'] : ['#f1e4d0', '#e4d7f0', '#d9ecf2', '#f6dccf'];
    for (let i = 0; i < 26; i++) {
      const side = i % 3; const t = Math.floor(i / 3);
      let x = 0, z = 0;
      if (side === 0) { x = -100 - rand() * 30; z = -70 + t * 16; } else if (side === 1) { x = 100 + rand() * 30; z = -70 + t * 16; } else { x = -90 + t * 22; z = -82 - rand() * 20; }
      if (z > S - 10 && Math.abs(x) < 110) continue;
      const hgt = atmo === 'downtown' ? 30 + rand() * 60 : 6 + rand() * 12;
      const b = atmo === 'downtown' ? this.tower(10 + rand() * 6, hgt) : P.building(10 + rand() * 8, hgt, 10 + rand() * 6, cols[i % cols.length], rand() < 0.5, atmo === 'mountain' ? '#4a3020' : '#9a5a4a');
      b.position.set(x, 0, z); ring.add(b);
    }
    // trees sprinkled around
    for (let i = 0; i < 60; i++) { const a = rand() * Math.PI * 2; const r = 120 + rand() * 80; const tr = P.tree(atmo === 'desert' ? 'palm' : atmo === 'mountain' ? 'snowpine' : atmo === 'castle' ? 'pine' : 'round', 1 + rand() * 0.6); tr.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 30); if (tr.position.z > S + 30 && (atmo === 'coastal' || atmo === 'lakeside')) continue; ring.add(tr); }
    hood.add(P.bake(ring));
    // Backdrops
    if (atmo === 'coastal' || atmo === 'lakeside') {
      const beach = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(700, 40), 6), atmo === 'coastal' ? MAT.sand : MAT.grass); beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.025, S + 48); hood.add(beach);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 400, 60, 30), waterMaterial(atmo === 'coastal' ? '#1f8fc8' : '#2f8aa0')); water.rotation.x = -Math.PI / 2; water.position.set(0, -0.2, S + 268); hood.add(water); this.water.push(water);
      // a sea wall so nothing ever drives or walks into the water
      hood.add(P.mesh(new THREE.BoxGeometry(700, 0.8, 1), MAT.stone, 0, 0.2, S + 68));
      if (atmo === 'coastal') { // bridge in the distance and a lighthouse
        const br = new THREE.Group(); br.position.set(80, 0, S + 170);
        br.add(P.mesh(new THREE.BoxGeometry(260, 1.2, 8), MAT.creamLight, 0, 12, 0)); for (const x of [-60, 60]) { br.add(P.mesh(new THREE.BoxGeometry(3, 40, 3), MAT.red, x, 20, 0)); }
        for (let i = -12; i <= 12; i++) br.add(P.mesh(new THREE.BoxGeometry(2, 11, 2), MAT.creamLight, i * 10, 5.5, 0));
        hood.add(P.bake(br));
        const lh = new THREE.Group(); lh.position.set(-140, 0, S + 90); lh.add(P.mesh(new THREE.CylinderGeometry(2, 3, 18, 16), MAT.white, 0, 9, 0)); for (let i = 0; i < 3; i++) lh.add(P.mesh(new THREE.CylinderGeometry(2.6 - i * 0.3, 2.6 - i * 0.3, 1.6, 16), MAT.red, 0, 3 + i * 5, 0)); lh.add(P.mesh(new THREE.SphereGeometry(1.4), MAT.bulb, 0, 19, 0)); hood.add(P.bake(lh));
        for (let i = 0; i < 9; i++) { const u = P.mesh(new THREE.ConeGeometry(1.6, 0.6, 10), [MAT.red, MAT.lineYellow, MAT.white][i % 3], -100 + i * 22, 2.4, S + 52); hood.add(u); hood.add(P.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), MAT.white, -100 + i * 22, 1.2, S + 52)); }
      } else { // gazebo and boats
        const gz = new THREE.Group(); gz.position.set(60, 0, S + 52); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; gz.add(P.mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.5, 8), MAT.white, Math.cos(a) * 3, 1.75, Math.sin(a) * 3)); } gz.add(P.mesh(new THREE.ConeGeometry(4, 2, 6), MAT.white, 0, 4.5, 0)); gz.add(P.mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.3, 6), MAT.wood, 0, 0.15, 0)); hood.add(P.bake(gz));
      }
    }
    if (atmo === 'mountain') for (let i = 0; i < 9; i++) { const m = new THREE.Group(); const r = 40 + rand() * 30; m.add(P.mesh(new THREE.ConeGeometry(r, r * 1.3, 8), MAT.pine, 0, r * 0.65, 0)); m.add(P.mesh(new THREE.ConeGeometry(r * 0.4, r * 0.55, 8), MAT.white, 0, r * 1.3 - r * 0.25, 0)); m.position.set(-250 + i * 62, 0, -230 - rand() * 60); hood.add(P.bake(m, false)); }
    if (atmo === 'downtown') for (let i = 0; i < 30; i++) { const t = this.tower(14, 50 + rand() * 120); const a = (i / 30) * Math.PI * 2; t.position.set(Math.cos(a) * 230, 0, Math.sin(a) * 230); hood.add(t); }
    if (atmo === 'desert') { for (let i = 0; i < 14; i++) { const dn = P.mesh(new THREE.SphereGeometry(30 + rand() * 20, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.sand, -260 + i * 40, -8, -200 - rand() * 80, 0, 0, 0, 1, 0.3, 1); hood.add(dn); } const pool = new THREE.Mesh(new THREE.CircleGeometry(12, 32), waterMaterial('#3fc0d0')); pool.rotation.x = -Math.PI / 2; pool.position.set(40, 0.06, S + 40); hood.add(pool); this.water.push(pool); }
    if (atmo === 'castle') { const cw = new THREE.Group(); for (let i = 0; i < 4; i++) { const tw = new THREE.Group(); tw.add(P.mesh(new THREE.CylinderGeometry(4, 4.5, 18, 14), MAT.stone, 0, 9, 0)); tw.add(P.mesh(new THREE.ConeGeometry(5, 7, 14), new THREE.MeshStandardMaterial({ color: '#5a5f6a' }), 0, 21.5, 0)); tw.position.set(-60 + i * 40, 0, -120); cw.add(tw); } cw.add(P.mesh(new THREE.BoxGeometry(130, 12, 3), MAT.stone, 0, 6, -120)); hood.add(P.bake(cw)); for (let i = 0; i < 8; i++) { const hl = P.mesh(new THREE.SphereGeometry(50 + rand() * 30, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.grass, -280 + i * 80, -10, -250, 0, 0, 0, 1, 0.35, 1); hood.add(hl); } }
  }
  private tower(w: number, h: number) { const t = TEX.glassTower(true).clone(); t.repeat.set(1, Math.max(1, Math.round(h / 40))); t.needsUpdate = true; const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.4, emissive: '#ffcc66', emissiveMap: t, emissiveIntensity: 0 }); this.glowWindows.push(m); return P.mesh(new THREE.BoxGeometry(w, h, w), m, 0, h / 2, 0); }

  updateBillboard() {
    if (this.billboard) { this.billboard.parent?.remove(this.billboard); this.billboard = null; }
    if (!billboardActive(this.g)) return;
    const b = new THREE.Group(); b.position.set(30, 0, STREET_Z + 8);
    for (const x of [-4, 4]) b.add(P.mesh(new THREE.CylinderGeometry(0.2, 0.25, 7, 8), MAT.dark, x, 3.5, 0));
    const face = P.mesh(new THREE.PlaneGeometry(11, 5), new THREE.MeshStandardMaterial({ map: TEX.billboard(this.g.s.halls[this.hallIdx].name), emissive: '#ffffff', emissiveIntensity: 0.25, emissiveMap: TEX.billboard(this.g.s.halls[this.hallIdx].name) }), 0, 8.5, -0.1); face.rotation.y = Math.PI; b.add(face);
    b.add(P.mesh(new THREE.BoxGeometry(11.4, 5.4, 0.3), MAT.dark, 0, 8.5, 0.1));
    this.root.add(b); this.billboard = b;
  }

  /** Applies the wedding plan colors (theme, flowers, lighting) to the hall. The hall visibly changes. */
  applyPlan(plan: Plan | null) {
    const th = plan ? CFG.themes[plan.theme] : null; const flower = plan ? CFG.flowers[plan.flower]?.color : null;
    MAT.themeCloth.color.set(th ? th.colors[2] ?? '#f2ede2' : '#f2ede2'); MAT.themeRunner.color.set(th ? th.colors[0] : '#d9c39a');
    MAT.themeDrape.color.set(th ? th.colors[1] : '#f3ead8'); MAT.themeFlower.color.set(flower ?? '#ffffff'); MAT.themeAccent.color.set(th ? th.colors[0] : '#d9c39a');
    if (flower === '#ffffff' && th) MAT.themeFlower.color.set(th.colors[0] === '#1d1d2b' ? '#ffffff' : '#fffaf2');
    const lc = plan ? CFG.lighting[plan.light]?.color ?? '#ffd9a0' : '#ffd9a0';
    for (const l of this.lights) l.color.set(lc);
    if (this.dance) (this.dance.material as THREE.ShaderMaterial).uniforms.tint.value.set(plan?.light === 'led' ? '#a070ff' : th ? th.colors[0] : '#a070ff');
    this.applyCosmetics(plan);
  }
  applyCosmetics(plan?: Plan | null) {
    const i = this.hallIdx; if (i < 0) return;
    const wall = cosmeticColor(this.g, i, 'wall'); MAT.wallTint.color.set(wall ?? HALLS.halls[i].palette.wall); MAT.wallpaper.color.set(wall ?? '#ffffff');
    const chairs = cosmeticColor(this.g, i, 'chairs'); MAT.chair.color.set(chairs ?? '#e3d9c4');
    const carpet = cosmeticColor(this.g, i, 'carpet'); MAT.carpet.color.set(carpet ? carpet : '#ffffff');
    const tables = cosmeticColor(this.g, i, 'tables'); if (tables && !plan) MAT.themeCloth.color.set(tables);
    const chand = cosmeticColor(this.g, i, 'chandelier'); MAT.crystal.color.set(chand ?? '#f4fbff'); MAT.crystal.emissive.set(chand ?? '#fff4d8');
    const dance = cosmeticColor(this.g, i, 'dance'); if (this.dance) (this.dance.material as THREE.ShaderMaterial).uniforms.base.value.set(dance ?? '#f4f0ff');
  }

  /** Night 0..1 lights windows and chandeliers; party 0..1 drives the LED floor and spotlights. */
  setMood(night: number, party: number) { this.night = night; this.party = party; }
  update(dt: number, t: number, cam: THREE.Camera, interiorMode: boolean) {
    this.interiorMode = interiorMode;
    this.roof.visible = !interiorMode; this.frontUpper.visible = !interiorMode;
    const cd = new THREE.Vector3(); cam.getWorldDirection(cd);
    for (const w of this.walls) w.obj.visible = !interiorMode || w.n.dot(cd) > 0.15;
    for (const m of this.glowWindows) m.emissiveIntensity = this.night * 0.9;
    MAT.bulb.emissiveIntensity = 0.8 + this.night * 1.6; MAT.crystal.emissiveIntensity = 0.25 + this.night * 0.6;
    // Problems you can see: a power cut darkens the hall, flickering lights stutter.
    const fk = this.flicker === 2 ? 0.12 : this.flicker === 1 ? (Math.random() < 0.35 ? 0.25 : 1) : 1;
    for (const l of this.lights) l.intensity = (6 + this.night * 30) * fk;
    MAT.bulb.emissiveIntensity *= fk; MAT.crystal.emissiveIntensity *= fk;
    for (const s of this.spot) { s.intensity = this.party * 60; s.target.position.set(Math.sin(t * 0.8 + s.position.x) * 6, 0, Math.cos(t * 0.6) * 4); }
    if (this.dance) { const u = (this.dance.material as THREE.ShaderMaterial).uniforms; u.t.value = t; u.on.value += (this.party - u.on.value) * Math.min(1, dt * 2); }
    this.doorOpen += (this.doorTarget - this.doorOpen) * Math.min(1, dt * 3);
    for (const dd of this.doors) { const bq = (dd as any).baseQ as THREE.Quaternion | undefined; _q.setFromAxisAngle(_Y, (dd as any).side * this.doorOpen * 1.4); if (bq) dd.quaternion.copy(bq).multiply(_q); else dd.quaternion.copy(_q); }
    for (const w of this.water) { const m = w.material as any; if (m.uniforms?.t) m.uniforms.t.value = t; }
    for (let i = 0; i < this.chandeliers.length; i++) this.chandeliers[i].rotation.y = Math.sin(t * 0.3 + i) * 0.05;
    this.traffic?.update(dt, this.night);
    this.updateFireworks(dt); this.fx?.update(dt, t);
  }
  // Fireworks finish the night.
  launchFireworks() {
    if (this.fireworks) this.root.remove(this.fireworks);
    const N = 900; const pos = new Float32Array(N * 3); const vel = new Float32Array(N * 3); const col = new Float32Array(N * 3);
    const c = new THREE.Color(); const { d } = hallDims(this.g.s.halls[this.hallIdx].size);
    for (let b = 0; b < 6; b++) { const cx = (b - 2.5) * 8, cy = 22 + (b % 3) * 5, cz = d / 2 + 18; c.setHSL(b / 6, 0.9, 0.6);
      for (let i = 0; i < N / 6; i++) { const k = (b * N) / 6 + i; pos.set([cx, cy, cz], k * 3); const v = new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random() * 4); vel.set([v.x, v.y, v.z], k * 3); col.set([c.r, c.g, c.b], k * 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); (g as any).vel = vel;
    this.fireworks = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.fireworks); this.fwT = 0;
  }
  private updateFireworks(dt: number) {
    if (!this.fireworks || this.fwT < 0) return; this.fwT += dt;
    const g = this.fireworks.geometry; const p = g.attributes.position as THREE.BufferAttribute; const v = (g as any).vel as Float32Array;
    for (let i = 0; i < p.count; i++) { v[i * 3 + 1] -= 6 * dt; p.setXYZ(i, p.getX(i) + v[i * 3] * dt * 0.6, p.getY(i) + v[i * 3 + 1] * dt * 0.6, p.getZ(i) + v[i * 3 + 2] * dt * 0.6); }
    p.needsUpdate = true; (this.fireworks.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - this.fwT / 3.5);
    if (this.fwT > 3.6) { this.root.remove(this.fireworks); this.fireworks = null; this.fwT = -1; }
  }
}

function waterMaterial(color: string) {
  return new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, col: { value: new THREE.Color(color) }, fogColor: { value: new THREE.Color('#cfe9ff') } },
    vertexShader: `uniform float t; varying vec3 vW; varying float vH; void main(){ vec3 p = position; float h = sin(p.x*0.08 + t*1.2)*0.25 + cos(p.y*0.11 + t*0.9)*0.2; p.z += h; vH = h; vec4 w = modelMatrix*vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 col; uniform float t; varying vec3 vW; varying float vH; void main(){ float s = sin(vW.x*0.6+t*2.0)*sin(vW.z*0.5-t*1.5); vec3 c = col*(0.85+vH*0.6) + vec3(0.9,0.95,1.0)*smoothstep(0.75,1.0,s)*0.35; gl_FragColor = vec4(c, 1.0); }` });
}
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
