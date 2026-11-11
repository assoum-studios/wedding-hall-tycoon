// Touch camera: one finger pans, pinch zooms (whole neighborhood down to guest level),
// two-finger twist rotates in the same direction as the fingers, tap selects. Mouse works too.
import * as THREE from 'three';

export class CameraRig {
  target = new THREE.Vector3(0, 0, 4); dist = 60; yaw = 0; pitch = 0.95; // pitch: radians above horizon
  goal = { target: new THREE.Vector3(0, 0, 4), dist: 60, yaw: 0, pitch: 0.95 };
  minDist = 5; maxDist = 230; speed = 1; invert = false; topDown = false; locked = false;
  bounds = { minX: -120, maxX: 120, minZ: -100, maxZ: 110 };
  onTap: (x: number, y: number) => void = () => {};
  onUserMove: () => void = () => {};
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private last: { cx: number; cy: number; d: number; a: number } | null = null; private moved = false; private button = 0;
  constructor(public cam: THREE.PerspectiveCamera, public el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => this.down(e)); el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e)); el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('wheel', (e) => { e.preventDefault(); if (this.locked) return; this.goal.dist = this.clampDist(this.goal.dist * Math.pow(1.0015, e.deltaY)); this.onUserMove(); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  private clampDist(d: number) { return Math.max(this.minDist, Math.min(this.maxDist, d)); }
  private down(e: PointerEvent) {
    this.el.setPointerCapture?.(e.pointerId); this.button = e.button;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.pointers.size === 1) this.moved = false; this.last = this.gesture();
  }
  private gesture() {
    const p = [...this.pointers.values()]; if (!p.length) return null;
    if (p.length === 1) return { cx: p[0].x, cy: p[0].y, d: 0, a: 0 };
    const [a, b] = p; return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  private move(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) this.moved = true;
    const g = this.gesture(); if (!g || !this.last || this.locked) { this.last = g; return; }
    const h = this.el.clientHeight || 800;
    if (this.pointers.size === 1) {
      if (this.button === 2) { this.goal.yaw -= ((g.cx - this.last.cx) / h) * 3 * (this.invert ? -1 : 1); this.goal.pitch = Math.max(0.25, Math.min(1.45, this.goal.pitch + ((g.cy - this.last.cy) / h) * 2)); }
      else this.pan(g.cx - this.last.cx, g.cy - this.last.cy);
    } else if (this.pointers.size >= 2 && this.last.d > 0) {
      this.pan(g.cx - this.last.cx, g.cy - this.last.cy);
      this.goal.dist = this.clampDist(this.goal.dist * (this.last.d / Math.max(1, g.d)));
      let da = g.a - this.last.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      // Screen angle grows clockwise (y points down). Turning the fingers clockwise must turn the world clockwise
      // under them, which means the camera orbits the other way: yaw += da.
      if (!this.topDown) this.goal.yaw += da * (this.invert ? -1 : 1);
      else this.goal.yaw += da * (this.invert ? -1 : 1);
    }
    this.last = g; this.onUserMove();
  }
  private up(e: PointerEvent, cancel = false) {
    const p = this.pointers.get(e.pointerId); this.pointers.delete(e.pointerId);
    if (!cancel && p && !this.moved && this.pointers.size === 0 && performance.now() - p.t < 450) this.onTap(e.clientX, e.clientY);
    this.last = this.gesture();
  }
  private pan(dx: number, dy: number) {
    const h = this.el.clientHeight || 800; const k = (this.dist / h) * 1.4 * this.speed;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.goal.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k / Math.max(0.35, Math.sin(this.pitch)));
    this.clampTarget();
  }
  private clampTarget() { const t = this.goal.target; t.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, t.x)); t.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, t.z)); }
  zoom(f: number) { this.goal.dist = this.clampDist(this.goal.dist * f); }
  rotate(a: number) { this.goal.yaw += a; }
  flyTo(target: THREE.Vector3, dist?: number, pitch?: number, yaw?: number) { this.goal.target.copy(target); if (dist) this.goal.dist = this.clampDist(dist); if (pitch != null) this.goal.pitch = pitch; if (yaw != null) this.goal.yaw = yaw; this.clampTarget(); }
  snap() { this.target.copy(this.goal.target); this.dist = this.goal.dist; this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.apply(); }
  update(dt: number) {
    const k = 1 - Math.pow(0.0005, dt);
    this.target.lerp(this.goal.target, k); this.dist += (this.goal.dist - this.dist) * k; this.yaw += (this.goal.yaw - this.yaw) * k;
    const autoPitch = this.topDown ? 1.5 : this.goal.pitch;
    this.pitch += (autoPitch - this.pitch) * k; this.apply();
  }
  private apply() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + sp * this.dist + 0.5, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.cam.lookAt(this.target.x, this.target.y + (this.dist > 30 ? Math.min(1.4, 8 / this.dist) : 0), this.target.z);
  }
  get interior() { return this.dist < 75; }
}
