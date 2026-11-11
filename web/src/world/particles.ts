// Lightweight particle effects: falling rose petals, confetti, gold sparkles and fountain spray.
import * as THREE from 'three';

type Kind = 'petals' | 'confetti' | 'sparkle' | 'spray';
interface Burst { pts: THREE.Points; vel: Float32Array; life: number; age: number; kind: Kind; spin: Float32Array; origin?: THREE.Vector3; loop?: boolean; }

function spriteTex(kind: Kind) {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d')!;
  if (kind === 'petals') { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(16, 16, 13, 7, 0.6, 0, Math.PI * 2); x.fill(); }
  else if (kind === 'confetti') { x.fillStyle = '#fff'; x.fillRect(6, 11, 20, 10); }
  else { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX: Partial<Record<Kind, THREE.Texture>> = {};

export class Particles {
  bursts: Burst[] = []; density = 1;
  constructor(public parent: THREE.Object3D) {}
  /** One-off burst around a point. */
  emit(kind: Kind, at: THREE.Vector3, count = 120, radius = 3, opts: { loop?: boolean } = {}) {
    count = Math.max(8, Math.round(count * this.density));
    const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3), col = new Float32Array(count * 3), spin = new Float32Array(count);
    const c = new THREE.Color();
    const palette = kind === 'petals' ? ['#ffffff', '#ffd6e0', '#ff9fb6', '#c8102e'] : kind === 'confetti' ? ['#ff5d8f', '#f7d97a', '#5b8ff0', '#6ddc56', '#ffffff', '#b49cff'] : kind === 'spray' ? ['#dff3ff', '#bfe6ff'] : ['#fff2b0', '#ffd27a'];
    for (let i = 0; i < count; i++) { this.seed(kind, at, radius, pos, vel, i); c.set(palette[i % palette.length]); col.set([c.r, c.g, c.b], i * 3); spin[i] = Math.random() * 6; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: kind === 'spray' ? 0.18 : kind === 'sparkle' ? 0.22 : 0.2, map: (TEX[kind] ??= spriteTex(kind)), vertexColors: true, transparent: true, depthWrite: false,
      blending: kind === 'sparkle' ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: kind === 'spray' ? 0.75 : 1 });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; this.parent.add(pts);
    this.bursts.push({ pts, vel, life: kind === 'petals' ? 9 : kind === 'confetti' ? 6 : kind === 'sparkle' ? 2.5 : 1e9, age: 0, kind, spin, origin: at.clone(), loop: opts.loop });
  }
  private seed(kind: Kind, at: THREE.Vector3, r: number, pos: Float32Array, vel: Float32Array, i: number) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    if (kind === 'petals' || kind === 'confetti') { pos.set([at.x + Math.cos(a) * d, at.y + 3 + Math.random() * 3, at.z + Math.sin(a) * d], i * 3); vel.set([(Math.random() - 0.5) * 0.6, -(0.4 + Math.random() * 0.5), (Math.random() - 0.5) * 0.6], i * 3); }
    else if (kind === 'sparkle') { pos.set([at.x, at.y, at.z], i * 3); const v = new THREE.Vector3().randomDirection().multiplyScalar(1 + Math.random() * 2); v.y = Math.abs(v.y) + 1; vel.set([v.x, v.y, v.z], i * 3); }
    else { pos.set([at.x + (Math.random() - 0.5) * 0.2, at.y, at.z + (Math.random() - 0.5) * 0.2], i * 3); const ang = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 0.9; vel.set([Math.cos(ang) * sp, 3.2 + Math.random() * 1.2, Math.sin(ang) * sp], i * 3); }
  }
  /** A fountain that sprays forever at this point. */
  fountain(at: THREE.Vector3, scale = 1) { this.emit('spray', at, Math.round(140 * scale), 0.2, { loop: true }); }
  update(dt: number, t: number) {
    for (const b of [...this.bursts]) {
      b.age += dt; const p = b.pts.geometry.attributes.position as THREE.BufferAttribute; const v = b.vel; const n = p.count;
      for (let i = 0; i < n; i++) {
        if (b.kind === 'petals' || b.kind === 'confetti') { // flutter while falling
          const sway = Math.sin(t * 2 + b.spin[i]) * 0.5;
          p.setXYZ(i, p.getX(i) + (v[i * 3] + sway) * dt, Math.max(0.02, p.getY(i) + v[i * 3 + 1] * dt), p.getZ(i) + (v[i * 3 + 2] + Math.cos(t * 1.7 + b.spin[i]) * 0.4) * dt);
        } else {
          v[i * 3 + 1] -= 9.8 * dt * (b.kind === 'sparkle' ? 0.4 : 1);
          p.setXYZ(i, p.getX(i) + v[i * 3] * dt, p.getY(i) + v[i * 3 + 1] * dt, p.getZ(i) + v[i * 3 + 2] * dt);
          if (b.loop && p.getY(i) < b.origin!.y - 0.3) { const pos = p.array as Float32Array; this.seed('spray', b.origin!, 0.2, pos, v, i); }
        }
      }
      p.needsUpdate = true;
      const m = b.pts.material as THREE.PointsMaterial; if (!b.loop) m.opacity = Math.max(0, Math.min(1, (b.life - b.age) / 1.5));
      if (b.age > b.life) { b.pts.removeFromParent(); b.pts.geometry.dispose(); m.dispose(); this.bursts.splice(this.bursts.indexOf(b), 1); }
    }
  }
  clear() { for (const b of this.bursts) { b.pts.removeFromParent(); b.pts.geometry.dispose(); } this.bursts = []; }
}
