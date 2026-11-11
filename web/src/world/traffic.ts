// Cars drive on a closed rectangular road loop around the block. They only ever follow the road path,
// keep a safe distance from the car ahead, and slow down at corners - so no car can leave the road or reach water.
import * as THREE from 'three';
import { car } from './props';

interface Car { obj: THREE.Object3D; s: number; speed: number; lane: number; lights: THREE.Mesh[]; }
export class Traffic {
  cars: Car[] = []; group = new THREE.Group(); private paths: THREE.CurvePath<THREE.Vector3>[] = []; private lens: number[] = [];
  constructor(parent: THREE.Object3D, [X, Zf, Zb]: number[], count: number) {
    // Two lanes: outer clockwise, inner counter-clockwise. Rounded corners.
    for (const [off, dir] of [[2.2, 1], [-2.2, -1]] as const) {
      const x = X + off, zf = Zf + off, zb = Zb - off; const r = 6;
      const pts = [new THREE.Vector3(-x + r, 0, zf), new THREE.Vector3(x - r, 0, zf), new THREE.Vector3(x, 0, zf - r), new THREE.Vector3(x, 0, zb + r), new THREE.Vector3(x - r, 0, zb), new THREE.Vector3(-x + r, 0, zb), new THREE.Vector3(-x, 0, zb + r), new THREE.Vector3(-x, 0, zf - r)];
      const cp = new THREE.CurvePath<THREE.Vector3>();
      const corners = [new THREE.Vector3(x, 0, zf), new THREE.Vector3(x, 0, zb), new THREE.Vector3(-x, 0, zb), new THREE.Vector3(-x, 0, zf)];
      for (let i = 0; i < 4; i++) { cp.add(new THREE.LineCurve3(pts[i * 2], pts[i * 2 + 1])); cp.add(new THREE.QuadraticBezierCurve3(pts[i * 2 + 1], corners[i], pts[(i * 2 + 2) % 8])); }
      if (dir < 0) { const rev = new THREE.CurvePath<THREE.Vector3>(); const cs = [...cp.curves].reverse(); for (const c of cs) rev.add(reverseCurve(c)); this.paths.push(rev); } else this.paths.push(cp);
      this.lens.push(this.paths[this.paths.length - 1].getLength());
    }
    const colors = ['#f7f7f7', '#1f3c88', '#b3122e', '#2b2b2b', '#f2c94c', '#3c8a5c', '#9aa3b0', '#e07a2f', '#6a2cb5', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const lane = i % 2; const obj = car(colors[i % colors.length], i === 3); obj.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
      const lights: THREE.Mesh[] = []; obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as any)?.emissive && (m.material as any).emissiveIntensity > 1) lights.push(m); });
      this.cars.push({ obj, s: (i / count) * this.lens[lane] * 2 % this.lens[lane], speed: 9 + (i % 3) * 2, lane, lights }); this.group.add(obj);
    }
    parent.add(this.group);
  }
  update(dt: number, _night: number) {
    for (const c of this.cars) {
      const L = this.lens[c.lane];
      // keep distance from the nearest car ahead in the same lane
      let gap = Infinity; for (const o of this.cars) if (o !== c && o.lane === c.lane) { const d = (o.s - c.s + L) % L; if (d > 0 && d < gap) gap = d; }
      const t = c.s / L; const path = this.paths[c.lane];
      const tan = path.getTangentAt(t); const tan2 = path.getTangentAt((t + 6 / L) % 1); const turn = 1 - Math.max(0, tan.dot(tan2));
      let target = c.speed * (1 - Math.min(0.6, turn * 8)); if (gap < 14) target *= Math.max(0, (gap - 7) / 7);
      c.s = (c.s + target * dt) % L;
      const p = path.getPointAt(c.s / L); c.obj.position.set(p.x, 0, p.z);
      const tt = path.getTangentAt(c.s / L); c.obj.rotation.y = Math.atan2(tt.x, tt.z);
    }
  }
  dispose() { this.group.removeFromParent(); }
}
class Reversed extends THREE.Curve<THREE.Vector3> {
  constructor(private c: THREE.Curve<THREE.Vector3>) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) { return this.c.getPoint(1 - t, target); }
}
function reverseCurve(c: THREE.Curve<THREE.Vector3>): THREE.Curve<THREE.Vector3> { return new Reversed(c); }
