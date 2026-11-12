// People in the world: walking along nav paths, sitting, dancing, working, with emotes above heads.
import * as THREE from 'three';
import type { Look } from '../core/types';
import { buildCharacter, attachProp, type CharacterMesh } from './character';
import { animate, type Anim, type Face } from './animator';
import type { NavGrid } from '../world/nav';

const EMOTE_ICONS: Record<string, string> = { heart: '❤', star: '★', angry: '!', sad: '…', tear: '💧', happy: '♪', wow: '✦', question: '?', money: '$' };
const emoteTex = new Map<string, THREE.Texture>();
function emoteMaterial(kind: string) {
  let t = emoteTex.get(kind);
  if (!t) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
    const col = kind === 'angry' ? '#e53935' : kind === 'sad' || kind === 'tear' ? '#5c8fd6' : kind === 'money' ? '#2e9d4f' : '#ff4f8b';
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(32, 30, 26, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(26, 52); x.lineTo(32, 62); x.lineTo(38, 52); x.fill();
    x.fillStyle = col; x.font = 'bold 32px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(EMOTE_ICONS[kind] ?? '!', 32, 31);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; emoteTex.set(kind, t);
  }
  return new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
}

const BLOB_GEO = new THREE.CircleGeometry(0.42, 20);
let BLOB_MAT: THREE.MeshBasicMaterial | null = null;
function blobMat() {
  if (!BLOB_MAT) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    BLOB_MAT = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  }
  return BLOB_MAT;
}
export class Person {
  c: CharacterMesh; pos = new THREE.Vector3(); face = 0; path: THREE.Vector3[] = []; speed = 1.4; anim: Anim = 'idle'; afterAnim: Anim = 'idle'; afterFace: number | null = null;
  expr: Face = 'happy'; phase = Math.random() * 10; emote: THREE.Sprite | null = null; emoteT = 0; onArrive: (() => void) | null = null; role = 'guest'; data: any = {};
  bubble: { text: string; t: number } | null = null; nearCam = true; private tick = 0;
  constructor(public look: Look, detail = 1) {
    this.c = buildCharacter(look, detail);
    // Soft contact shadow under the feet: grounds people even on the Smooth setting (no real-time shadows).
    const blob = new THREE.Mesh(BLOB_GEO, blobMat()); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.scale.setScalar(this.c.dims.H / 1.75); blob.renderOrder = 1; this.c.mesh.add(blob);
  }
  get obj() { return this.c.mesh; }
  place(p: THREE.Vector3, face = 0) { this.pos.copy(p); this.face = face; this.path = []; this.sync(); }
  walkTo(nav: NavGrid | null, to: THREE.Vector3, then: Anim = 'idle', face: number | null = null, onArrive: (() => void) | null = null, run = false) {
    this.path = nav ? nav.path(this.pos, to) : [to.clone()]; this.afterAnim = then; this.afterFace = face; this.onArrive = onArrive; this.anim = run ? 'run' : this.c.props.tray ? 'tray' : 'walk'; this.speed = run ? 3.2 : this.look.body === 'elderly' ? 0.9 : 1.35;
  }
  walkPath(points: THREE.Vector3[], then: Anim = 'idle', face: number | null = null, onArrive: (() => void) | null = null) { this.path = points.map((p) => p.clone()); this.afterAnim = then; this.afterFace = face; this.onArrive = onArrive; this.anim = 'walk'; this.speed = 1.35; }
  setEmote(kind: string | null, secs = 2.5) {
    if (this.emote) { this.c.mesh.remove(this.emote); this.emote.material.dispose(); this.emote = null; }
    if (!kind) return; const s = new THREE.Sprite(emoteMaterial(kind)); s.scale.set(0.45, 0.45, 1); s.position.set(0, this.c.dims.H + 0.4, 0); s.renderOrder = 10; this.c.mesh.add(s); this.emote = s; this.emoteT = secs;
  }
  setProp(p: Parameters<typeof attachProp>[1]) { attachProp(this.c, p); }
  get moving() { return this.path.length > 0; }
  /** Anti-jam: seconds left walking "through" others, and progress tracking to detect being stuck. */
  ghost = 0; private checkT = 0; private checkX = 0; private checkZ = 0; private stuckN = 0;
  update(dt: number, t: number, lod = 1) {
    if (this.ghost > 0) this.ghost -= dt;
    if (this.path.length) {
      this.checkT += dt;
      if (this.checkT > 0.6) {
        const moved = Math.hypot(this.pos.x - this.checkX, this.pos.z - this.checkZ);
        if (moved < this.speed * 0.6 * 0.35) { this.stuckN++; this.ghost = 1.6; if (this.stuckN >= 4 && this.path.length > 1) this.path.shift(); } else this.stuckN = 0;
        this.checkT = 0; this.checkX = this.pos.x; this.checkZ = this.pos.z;
      }
      const target = this.path[0]; const dx = target.x - this.pos.x, dz = target.z - this.pos.z; const dist = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (dist <= step) { this.pos.x = target.x; this.pos.z = target.z; this.path.shift(); }
      else { this.pos.x += (dx / dist) * step; this.pos.z += (dz / dist) * step; }
      if (dist > 0.01) { const want = Math.atan2(dx, dz); let d = want - this.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; this.face += d * Math.min(1, dt * 10); }
      if (!this.path.length) { this.anim = this.afterAnim; if (this.afterFace != null) this.face = this.afterFace; const cb = this.onArrive; this.onArrive = null; cb?.(); }
    }
    if (this.emote) { this.emoteT -= dt; this.emote.position.y = this.c.dims.H + 0.4 + Math.sin(t * 4) * 0.05; if (this.emoteT <= 0) this.setEmote(null); }
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    // far away people animate at a lower rate to save CPU on phones
    this.tick += dt; if (lod > 1 && this.tick < 0.033 * lod) { this.sync(); return; }
    animate(this.c, this.anim, t, this.expr, this.phase); this.tick = 0; this.sync();
  }
  sync() { this.c.mesh.position.copy(this.pos); this.c.mesh.rotation.y = this.face; }
  dispose() { this.c.mesh.removeFromParent(); this.c.mesh.geometry.dispose(); }
}

/** Keeps people from overlapping: a light push apart for those who are standing or walking. */
export function separate(people: Person[], nav: NavGrid | null, dt: number) {
  const n = people.length;
  for (let i = 0; i < n; i++) {
    const a = people[i]; if (a.ghost > 0 || a.anim === 'sit' || a.anim === 'eat' || a.anim === 'sitTalk' || a.anim === 'drink' || a.anim === 'slowdance' || a.anim === 'faint') continue;
    for (let j = i + 1; j < n; j++) {
      const b = people[j]; if (b.ghost > 0 || b.anim === 'sit' || b.anim === 'eat' || b.anim === 'sitTalk' || b.anim === 'drink' || b.anim === 'slowdance') continue;
      let dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; let d2 = dx * dx + dz * dz;
      if (d2 <= 0.0001) { const ang = (i * 2.4 + j) % 6.28; dx = Math.cos(ang) * 0.01; dz = Math.sin(ang) * 0.01; d2 = 0.0001; } // exactly on top of each other
      if (d2 < 0.36) {
        const d = Math.sqrt(d2); const push = (0.6 - d) * 0.5 * Math.min(1, dt * 8); let ux = dx / d, uz = dz / d;
        // Two walkers meeting head-on both step to their right instead of pushing straight into each other.
        if (a.moving && b.moving) { const px = -uz, pz = ux; ux = ux * 0.4 + px * 0.9; uz = uz * 0.4 + pz * 0.9; const l = Math.hypot(ux, uz); ux /= l; uz /= l; }
        const tryMove = (p: Person, s: number) => { const nx = p.pos.x + ux * push * s, nz = p.pos.z + uz * push * s; if (!nav) { p.pos.x = nx; p.pos.z = nz; return; } const c = nav.cellOf(new THREE.Vector3(nx, 0, nz)); if (nav.free(c.x, c.z)) { p.pos.x = nx; p.pos.z = nz; } };
        tryMove(a, -1); tryMove(b, 1);
      }
    }
  }
}
