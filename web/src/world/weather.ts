// Weather around the camera: rain streaks, drifting snow or blowing desert sand. One cheap draw call.
import * as THREE from 'three';

export type WeatherKind = 'rain' | 'snow' | 'sand';
const BOX = 70, TOP = 32;
export class Weather {
  obj: THREE.Object3D; private pos: Float32Array; private n: number; private ph: Float32Array;
  constructor(public kind: WeatherKind, density = 1) {
    this.n = Math.round((kind === 'rain' ? 1400 : kind === 'snow' ? 1100 : 900) * density);
    const per = kind === 'rain' ? 2 : 1; this.pos = new Float32Array(this.n * per * 3); this.ph = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) { const x = (Math.random() - 0.5) * BOX, y = kind === 'sand' ? Math.random() * 5 : Math.random() * TOP, z = (Math.random() - 0.5) * BOX; this.ph[i] = Math.random() * 6.28; this.set(i, x, y, z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    if (kind === 'rain') this.obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#8fa6c8', transparent: true, opacity: 0.7, depthWrite: false }));
    else this.obj = new THREE.Points(g, new THREE.PointsMaterial({ color: kind === 'snow' ? '#ffffff' : '#d9b77a', size: kind === 'snow' ? 0.22 : 0.12, transparent: true, opacity: kind === 'snow' ? 0.9 : 0.6, depthWrite: false }));
    this.obj.frustumCulled = false; this.obj.renderOrder = 5;
  }
  private set(i: number, x: number, y: number, z: number) {
    if (this.kind === 'rain') { this.pos.set([x, y, z, x + 0.08, y + 1.3, z], i * 6); } else this.pos.set([x, y, z], i * 3);
  }
  update(dt: number, t: number, center: THREE.Vector3) {
    this.obj.position.set(center.x, 0, center.z);
    const k = this.kind; const stride = k === 'rain' ? 6 : 3; const p = this.pos;
    for (let i = 0; i < this.n; i++) {
      const o = i * stride; let x = p[o], y = p[o + 1], z = p[o + 2];
      if (k === 'rain') y -= dt * 22; else if (k === 'snow') { y -= dt * 1.4; x += Math.sin(t * 0.8 + this.ph[i]) * dt * 0.6; } else { x += dt * 9; y += Math.sin(t * 2 + this.ph[i]) * dt * 0.8; z += Math.cos(t + this.ph[i]) * dt * 0.5; }
      if (y < 0) y += TOP; if (k === 'sand' && (y < 0.05 || y > 5)) y = 0.2 + Math.random() * 4; if (x > BOX / 2) x -= BOX; if (x < -BOX / 2) x += BOX;
      this.set(i, x, y, z);
    }
    (this.obj as any).geometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.obj.removeFromParent(); (this.obj as any).geometry.dispose(); ((this.obj as any).material as THREE.Material).dispose(); }
}
/** Today's weather for a hall: about one day in three, by location (mountain/castle snow, desert sand, else rain). */
export function weatherFor(hallId: string, day: number, hallIdx: number): WeatherKind | null {
  let x = (day * 2654435761 + hallIdx * 40503) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0;
  if (x % 100 >= 30) return null;
  return hallId === 'mountain' || hallId === 'castle' ? 'snow' : hallId === 'desert' ? 'sand' : 'rain';
}
