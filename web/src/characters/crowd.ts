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

export class Person {
  c: CharacterMesh; pos = new THREE.Vector3(); face = 0; path: THREE.Vector3[] = []; speed = 1.4; anim: Anim = 'idle'; afterAnim: Anim = 'idle'; afterFace: number | null = null;
  expr: Face = 'happy'; phase = Math.random() * 10; emote: THREE.Sprite | null = null; emoteT = 0; onArrive: (() => void) | null = null; role = 'guest'; data: any = {};
  bubble: { text: string; t: number } | null = null; nearCam = true; private tick = 0;
  constructor(public look: Look, detail = 1) { this.c = buildCharacter(look, detail); }
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
  update(dt: number, t: number, lod = 1) {
    if (this.path.length) {
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
    const a = people[i]; if (a.anim === 'sit' || a.anim === 'eat' || a.anim === 'sitTalk' || a.anim === 'drink' || a.anim === 'slowdance') continue;
    for (let j = i + 1; j < n; j++) {
      const b = people[j]; if (b.anim === 'sit' || b.anim === 'eat' || b.anim === 'sitTalk' || b.anim === 'drink' || b.anim === 'slowdance') continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; const d2 = dx * dx + dz * dz;
      if (d2 > 0.0001 && d2 < 0.36) {
        const d = Math.sqrt(d2); const push = (0.6 - d) * 0.5 * Math.min(1, dt * 8); const ux = dx / d, uz = dz / d;
        const tryMove = (p: Person, s: number) => { const nx = p.pos.x + ux * push * s, nz = p.pos.z + uz * push * s; if (!nav) { p.pos.x = nx; p.pos.z = nz; return; } const c = nav.cellOf(new THREE.Vector3(nx, 0, nz)); if (nav.free(c.x, c.z)) { p.pos.x = nx; p.pos.z = nz; } };
        tryMove(a, -1); tryMove(b, 1);
      }
    }
  }
}
