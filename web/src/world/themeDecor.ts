// Theme decor: each wedding style visibly transforms the hall. It sets the table centerpieces, the decor
// along the walls, overhead string lights and the entrance arch. Everything is merged into a few meshes
// so it stays cheap on phones.
import * as THREE from 'three';
import { MAT } from './textures';
import { bake, mesh } from './props';
import * as P from './props';

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, opts: { emissive?: string; ei?: number; metal?: number; rough?: number } = {}) {
  const k = color + JSON.stringify(opts); let m = mats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.55, metalness: opts.metal ?? 0, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.ei ?? 0 }); mats.set(k, m); }
  return m;
}
const cyl = (rt: number, rb: number, h: number, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r: number, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
const G = () => new THREE.Group();
const GOLD = () => mat('#e2bf68', { metal: 0.7, rough: 0.3 });
const CANDLE = () => mat('#fff6e0', { emissive: '#ffcf7a', ei: 1.2 });
const BULB = () => mat('#fff1c4', { emissive: '#ffd27a', ei: 1.8 });

function flowerBall(r: number, y: number, x = 0, z = 0) { const g = G(); g.add(mesh(sph(r), MAT.themeFlower, x, y, z)); for (let i = 0; i < 5; i++) { const a = i * 1.26; g.add(mesh(sph(r * 0.45), MAT.leafDark, x + Math.cos(a) * r * 0.85, y - r * 0.35, z + Math.sin(a) * r * 0.85)); } return g; }
function candle(x: number, z: number, h = 0.16, y = 0.78) { const g = G(); g.add(mesh(cyl(0.035, 0.035, h, 8), CANDLE(), x, y + h / 2, z)); return g; }

/** One table centerpiece (sits on a table top at y≈0.78). */
function centerpiece(theme: string): THREE.Group {
  const g = G(); const top = 0.78;
  switch (theme) {
    case 'royal': // gold candelabra with flowers
      g.add(mesh(cyl(0.03, 0.08, 0.55, 8), GOLD(), 0, top + 0.27, 0)); for (const s of [-1, 1]) { g.add(mesh(new THREE.BoxGeometry(0.34, 0.025, 0.025), GOLD(), s * 0.15, top + 0.5, 0)); g.add(candle(s * 0.3, 0, 0.14, top + 0.5)); }
      g.add(candle(0, 0, 0.16, top + 0.55)); g.add(flowerBall(0.12, top + 0.12)); break;
    case 'boho': // pampas grass in a clay vase
      g.add(mesh(cyl(0.08, 0.1, 0.22, 10), mat('#c98c64'), 0, top + 0.11, 0)); for (let i = 0; i < 6; i++) { const a = i * 1.05; g.add(mesh(new THREE.ConeGeometry(0.04, 0.42, 6), mat('#efe0c4'), Math.cos(a) * 0.06, top + 0.42, Math.sin(a) * 0.06, Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35)); }
      g.add(mesh(sph(0.07), MAT.leafDark, 0.12, top + 0.06, 0)); break;
    case 'beach': // turquoise lantern and shells
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), mat('#5fd0d6', { emissive: '#7ae8ee', ei: 0.4 }), 0, top + 0.12, 0)); g.add(mesh(new THREE.ConeGeometry(0.12, 0.08, 4), mat('#ffffff'), 0, top + 0.28, 0, 0, Math.PI / 4, 0));
      for (const [x, z] of [[0.16, 0.05], [-0.14, -0.08], [0.05, -0.16]]) g.add(mesh(sph(0.04, 8, 6), mat('#fff3e6'), x, top + 0.02, z, 0, 0, 0, 1, 0.5, 1)); break;
    case 'glam': // tall black-and-gold vase with white plumes
      g.add(mesh(cyl(0.05, 0.03, 0.6, 10), mat('#1a1a22', { metal: 0.5, rough: 0.2 }), 0, top + 0.3, 0)); g.add(mesh(cyl(0.12, 0.05, 0.08, 10), GOLD(), 0, top + 0.63, 0));
      for (let i = 0; i < 7; i++) { const a = i * 0.9; g.add(mesh(new THREE.ConeGeometry(0.05, 0.38, 6), mat('#ffffff'), Math.cos(a) * 0.08, top + 0.86, Math.sin(a) * 0.08, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5)); } break;
    case 'romantic': // red rose dome with candles
      g.add(flowerBall(0.16, top + 0.12)); for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; g.add(candle(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.1)); } break;
    case 'rustic': // wood slice, mason jar, greenery
      g.add(mesh(cyl(0.22, 0.22, 0.04, 14), MAT.wood, 0, top + 0.02, 0)); g.add(mesh(cyl(0.06, 0.06, 0.16, 10), mat('#d8eef0', { rough: 0.1 }), 0, top + 0.12, 0)); g.add(flowerBall(0.08, top + 0.24));
      g.add(candle(0.15, 0.05, 0.08, top + 0.04)); break;
    case 'fairytale': // pastel flower tower with a sparkling orb
      g.add(mesh(cyl(0.025, 0.07, 0.5, 8), mat('#f6e7ff', { metal: 0.3 }), 0, top + 0.25, 0)); g.add(flowerBall(0.15, top + 0.6)); g.add(mesh(sph(0.05), mat('#fff', { emissive: '#ffd6f5', ei: 1.5 }), 0, top + 0.8, 0)); break;
    default: // classic: white rose bowl and two candles
      g.add(mesh(cyl(0.13, 0.08, 0.08, 12), mat('#f6f6f6', { rough: 0.15 }), 0, top + 0.04, 0)); g.add(flowerBall(0.13, top + 0.14)); g.add(candle(0.24, 0, 0.18)); g.add(candle(-0.24, 0, 0.18));
  }
  return g;
}
/** Decor that stands along the walls. */
function wallPiece(theme: string, i: number): THREE.Group {
  const g = G();
  switch (theme) {
    case 'royal': g.add(mesh(cyl(0.22, 0.3, 0.9, 12), GOLD(), 0, 0.45, 0)); g.add(flowerBall(0.38, 1.15)); break;
    case 'boho': if (i % 2) { const p = P.plant(); p.scale.setScalar(1.6); g.add(p); } else { g.add(mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), mat('#8a5a3b'), 0, 0.22, 0)); g.add(mesh(sph(0.1), BULB(), 0, 0.25, 0)); } break;
    case 'beach': { const t = P.tree('palm', 0.45); g.add(t); break; }
    case 'glam': g.add(mesh(cyl(0.12, 0.12, 2.6, 10), mat('#ffffff', { emissive: i % 2 ? '#c78bff' : '#ffd27a', ei: 0.9 }), 0, 1.3, 0)); g.add(mesh(cyl(0.2, 0.2, 0.1, 12), mat('#15151c', { metal: 0.6 }), 0, 0.05, 0)); break;
    case 'romantic': g.add(P.roseBush(true)); g.add(mesh(sph(0.22, 12, 10), mat('#e8344f', { rough: 0.3 }), 0, 2.0, 0, 0, 0, 0, 1, 1.1, 0.5)); g.add(mesh(cyl(0.006, 0.006, 1.2, 4), mat('#ffffff'), 0, 1.3, 0)); break;
    case 'rustic': g.add(mesh(cyl(0.3, 0.3, 0.8, 12), MAT.wood, 0, 0.4, 0)); for (const y of [0.15, 0.65]) g.add(mesh(cyl(0.315, 0.315, 0.05, 12), mat('#4a3a2a', { metal: 0.4 }), 0, y, 0)); g.add(flowerBall(0.28, 0.95)); break;
    case 'fairytale': { const cols = ['#ffc6e0', '#d9c6ff', '#c6f0ff', '#fff2b8']; for (let k = 0; k < 5; k++) { const a = k * 1.25; g.add(mesh(sph(0.22, 12, 10), mat(cols[(k + i) % 4], { rough: 0.25 }), Math.cos(a) * 0.22, 1.9 + (k % 2) * 0.3, Math.sin(a) * 0.22, 0, 0, 0, 1, 1.15, 1)); } g.add(mesh(cyl(0.008, 0.008, 1.8, 4), mat('#ffffff'), 0, 0.95, 0)); g.add(mesh(cyl(0.15, 0.18, 0.12, 10), mat('#f6e7ff'), 0, 0.06, 0)); break; }
    default: g.add(mesh(cyl(0.18, 0.22, 1.0, 12), mat('#fbfaf6', { rough: 0.3 }), 0, 0.5, 0)); g.add(flowerBall(0.32, 1.25));
  }
  return g;
}
const ARCH_THEMES: Record<string, boolean> = { romantic: true, fairytale: true, royal: true, classic: true, boho: true, rustic: true, beach: true, glam: true };
const LIGHTS_THEMES: Record<string, boolean> = { boho: true, rustic: true, fairytale: true, romantic: true, beach: true };

export function buildThemeDecor(theme: string, tables: THREE.Vector3[], w: number, d: number, wallH: number): THREE.Group {
  const root = G();
  for (const tp of tables) { const c = centerpiece(theme); c.position.set(tp.x, 0, tp.z); root.add(c); }
  // along both side walls and the back wall
  const step = 3.2; let i = 0;
  for (let z = -d / 2 + 2.2; z < d / 2 - 2.5; z += step) for (const s of [-1, 1]) { const p = wallPiece(theme, i++); p.position.set(s * (w / 2 - 0.8), 0, z); root.add(p); }
  for (let x = -w / 2 + 2.5; x < w / 2 - 2; x += step * 1.4) { if (Math.abs(x) < 3.5) continue; const p = wallPiece(theme, i++); p.position.set(x, 0, -d / 2 + 0.8); root.add(p); }
  // overhead string lights (little glowing bulbs across the room)
  if (LIGHTS_THEMES[theme]) {
    const rows = Math.max(3, Math.round(d / 5)); const bulb = BULB();
    for (let r = 0; r < rows; r++) { const z = -d / 2 + (r + 0.5) * (d / rows); for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 0.9) { const sag = Math.sin(((x + w / 2) / w) * Math.PI) * 0.8; root.add(mesh(sph(0.07, 6, 5), bulb, x, wallH - 0.8 - sag, z)); } }
  }
  // entrance arch in the theme's flowers
  if (ARCH_THEMES[theme]) { const a = P.flowerArch(3.2); a.position.set(0, 0, d / 2 - 2.6); root.add(a); }
  return bake(root, false);
}
