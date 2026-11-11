// Walkable grid for people inside the hall (1 m cells) with A* paths. Walls and furniture are blocked,
// so nobody walks through tables, the stage or the walls.
import * as THREE from 'three';
import type { HallState } from '../core/types';
import { ITEM_BY_ID } from '../core/data';
import { hallDims, footprint } from './layout';

export interface Seat { pos: THREE.Vector3; face: number; table: number; }
export class NavGrid {
  w: number; d: number; blocked: Uint8Array; seats: Seat[] = []; danceCells: THREE.Vector3[] = []; spots: Record<string, THREE.Vector3[]> = {};
  constructor(public hall: HallState) {
    const { w, d } = hallDims(hall.size); this.w = w; this.d = d; this.blocked = new Uint8Array(w * d);
    const ox = -w / 2, oz = -d / 2;
    for (const it of hall.layout) {
      const def = ITEM_BY_ID[it.id]; const f = footprint(it); const cx = ox + it.x + f.w / 2, cz = oz + it.z + f.d / 2;
      const block = (x: number, z: number) => { if (x >= 0 && z >= 0 && x < w && z < d) this.blocked[z * w + x] = 1; };
      const add = (k: string, v: THREE.Vector3) => { (this.spots[k] ??= []).push(v); };
      switch (def.kind) {
        case 'table':
          if (it.id === 'round_table') { block(it.x + 1, it.z + 1); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; this.seats.push({ pos: new THREE.Vector3(cx + Math.cos(a) * 1.2, 0, cz + Math.sin(a) * 1.2), face: Math.atan2(-Math.cos(a), -Math.sin(a)), table: it.uid }); } }
          else { for (let z = 0; z < f.d; z++) for (let x = 0; x < f.w; x++) if ((f.w === 2 && f.d === 4 && z > 0 && z < 3) || (f.w === 4 && x > 0 && x < 3)) block(it.x + x, it.z + z);
            const along = f.d > f.w; for (let i = 0; i < 4; i++) for (const s of [1, -1]) { const t = -1.2 + i * 0.8; const p = along ? new THREE.Vector3(cx + s * 0.85, 0, cz + t) : new THREE.Vector3(cx + t, 0, cz + s * 0.85); this.seats.push({ pos: p, face: along ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : (s > 0 ? Math.PI : 0), table: it.uid }); } }
          add('table', new THREE.Vector3(cx, 0, cz)); break;
        case 'head': for (let z = 0; z < f.d; z++) for (let x = 0; x < f.w; x++) block(it.x + x, it.z + z); add('head', new THREE.Vector3(cx, 0, cz)); break;
        case 'dance': for (let z = 0; z < f.d; z++) for (let x = 0; x < f.w; x++) this.danceCells.push(new THREE.Vector3(ox + it.x + x + 0.5, 0, oz + it.z + z + 0.5)); add('dance', new THREE.Vector3(cx, 0, cz)); break;
        default: for (let z = 0; z < f.d; z++) for (let x = 0; x < f.w; x++) block(it.x + x, it.z + z); add(def.kind, new THREE.Vector3(cx, 0, cz + f.d / 2 + 0.6));
      }
    }
  }
  cellOf(p: THREE.Vector3) { return { x: Math.floor(p.x + this.w / 2), z: Math.floor(p.z + this.d / 2) }; }
  free(x: number, z: number) { return x >= 0 && z >= 0 && x < this.w && z < this.d && !this.blocked[z * this.w + x]; }
  center(x: number, z: number) { return new THREE.Vector3(x - this.w / 2 + 0.5, 0, z - this.d / 2 + 0.5); }
  nearestFree(p: THREE.Vector3) {
    const c = this.cellOf(p); if (this.free(c.x, c.z)) return c;
    for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (this.free(c.x + dx, c.z + dz)) return { x: c.x + dx, z: c.z + dz };
    return c;
  }
  /** A* over free cells (8 directions, no corner cutting). Ends exactly at `to`. */
  path(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const s = this.nearestFree(from), e = this.nearestFree(to); const W = this.w, N = this.w * this.d;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open: number[] = []; const si = s.z * W + s.x, ei = e.z * W + e.x; g[si] = 0; open.push(si);
    const hfn = (i: number) => Math.hypot((i % W) - e.x, Math.floor(i / W) - e.z);
    let iter = 0;
    while (open.length && iter++ < 4000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (g[open[k]] + hfn(open[k]) < g[open[bi]] + hfn(open[bi])) bi = k;
      const cur = open.splice(bi, 1)[0]; if (cur === ei) break; closed[cur] = 1;
      const cx = cur % W, cz = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (!this.free(nx, nz)) continue;
        if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue;
        const ni = nz * W + nx; if (closed[ni]) continue; const ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; if (!open.includes(ni)) open.push(ni); }
      }
    }
    const out: THREE.Vector3[] = []; let c = ei; if (came[c] === -1 && c !== si) return [to.clone()];
    while (c !== -1 && c !== si) { out.push(this.center(c % W, Math.floor(c / W))); c = came[c]; }
    out.reverse(); out.push(to.clone()); return out;
  }
}
