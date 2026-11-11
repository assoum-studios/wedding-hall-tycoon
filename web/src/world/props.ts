// Stylized props: tables, chairs, chandeliers, stage, bar, buffet, cake, arches, plants, cars, trees, street furniture.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAT, TEX } from './textures';

type Mat = THREE.Material;
export function mesh(geo: THREE.BufferGeometry, mat: Mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; return m;
}
const G = () => new THREE.Group();
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r: number, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);

/** Merge all static meshes of a group into one mesh per material (far fewer draw calls on phones). */
export function bake(root: THREE.Object3D, shadows = true): THREE.Group {
  root.updateMatrixWorld(true);
  const byMat = new Map<Mat, THREE.BufferGeometry[]>(); const keep: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (o !== root && ((o as any).noBake || (m.isMesh && Array.isArray(m.material)) || (o as any).isLight)) { keep.push(o); return; }
    if (m.isMesh) {
      const mat = m.material as Mat; let g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const list = byMat.get(mat) ?? []; list.push(g); byMat.set(mat, list);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  const out = G();
  for (const [mat, list] of byMat) { const merged = mergeGeometries(list, false); if (!merged) continue; const mm = new THREE.Mesh(merged, mat); mm.castShadow = shadows; mm.receiveShadow = true; out.add(mm); list.forEach((g) => g.dispose()); }
  // Kept objects (doors, lights, multi-material buildings) move to the baked group with their world transform.
  for (const k of keep) { const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3(); k.matrixWorld.decompose(wp, wq, ws); k.removeFromParent(); k.position.copy(wp); k.quaternion.copy(wq); k.scale.copy(ws); (k as any).baseQ = k.quaternion.clone(); out.add(k); }
  return out;
}

export function chair(withSash = true) {
  const g = G();
  g.add(mesh(box(0.42, 0.06, 0.42), MAT.chair, 0, 0.45, 0));
  g.add(mesh(cyl(0.21, 0.21, 0.08, 12), MAT.themeCloth, 0, 0.5, 0)); // cushion
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) g.add(mesh(cyl(0.022, 0.018, 0.45, 6), MAT.chair, x, 0.225, z));
  g.add(mesh(box(0.42, 0.5, 0.05), MAT.chair, 0, 0.76, -0.19));
  for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.012, 0.012, 0.42, 5), MAT.goldSoft, -0.12 + i * 0.12, 0.76, -0.16));
  if (withSash) g.add(mesh(box(0.44, 0.1, 0.06), MAT.themeRunner, 0, 0.72, -0.21));
  return g;
}
export function roundTable(seats = 10, withChairs = true) {
  const g = G(); const r = 0.85;
  g.add(mesh(cyl(r, r, 0.05, 28), MAT.white, 0, 0.75, 0));
  g.add(mesh(cyl(r + 0.02, r + 0.12, 0.73, 28), MAT.themeCloth, 0, 0.385, 0)); // tablecloth to the floor
  g.add(mesh(cyl(r * 0.45, r * 0.45, 0.012, 20), MAT.themeRunner, 0, 0.785, 0));
  // centerpiece: gold stand with flowers and candles
  g.add(mesh(cyl(0.03, 0.08, 0.35, 10), MAT.gold, 0, 0.95, 0));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(mesh(sph(0.075, 10, 8), MAT.themeFlower, Math.cos(a) * 0.11, 1.15 + (i % 2) * 0.05, Math.sin(a) * 0.11)); }
  g.add(mesh(sph(0.09, 10, 8), MAT.themeFlower, 0, 1.22, 0));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; g.add(mesh(sph(0.06, 8, 6), MAT.leaf, Math.cos(a) * 0.17, 1.1, Math.sin(a) * 0.17)); }
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2;
    // plate, glass
    g.add(mesh(cyl(0.12, 0.1, 0.015, 14), MAT.white, Math.cos(a) * (r - 0.2), 0.785, Math.sin(a) * (r - 0.2)));
    g.add(mesh(cyl(0.025, 0.02, 0.1, 8), MAT.glass, Math.cos(a + 0.18) * (r - 0.12), 0.83, Math.sin(a + 0.18) * (r - 0.12)));
    if (withChairs) { const c = chair(); c.position.set(Math.cos(a) * (r + 0.35), 0, Math.sin(a) * (r + 0.35)); c.rotation.y = -a - Math.PI / 2; g.add(c); }
  }
  return g;
}
export function longTable(seats = 8) {
  const g = G(); const L = 3.2;
  g.add(mesh(box(1.0, 0.05, L), MAT.white, 0, 0.75, 0)); g.add(mesh(box(1.05, 0.72, L + 0.05), MAT.themeCloth, 0, 0.38, 0)); g.add(mesh(box(0.35, 0.012, L), MAT.themeRunner, 0, 0.785, 0));
  for (let i = 0; i < 3; i++) { g.add(mesh(sph(0.1, 10, 8), MAT.themeFlower, 0, 0.88, -1 + i)); g.add(mesh(cyl(0.02, 0.02, 0.18, 6), MAT.cloth, 0.12, 0.88, -1 + i)); }
  const per = seats / 2;
  for (let i = 0; i < per; i++) for (const s of [1, -1]) { const z = -L / 2 + 0.4 + i * ((L - 0.8) / (per - 1)); const c = chair(); c.position.set(s * 0.85, 0, z); c.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(c); g.add(mesh(cyl(0.12, 0.1, 0.015, 14), MAT.white, s * 0.3, 0.785, z)); }
  return g;
}
export function sweetheartTable() {
  const g = G(); g.add(mesh(box(2.2, 0.05, 0.9), MAT.white, 0, 0.75, 0)); g.add(mesh(box(2.3, 0.73, 1.0), MAT.themeCloth, 0, 0.38, 0));
  // floral garland on the front
  for (let i = 0; i < 14; i++) g.add(mesh(sph(0.09, 8, 6), i % 3 ? MAT.themeFlower : MAT.leaf, -1.1 + i * 0.17, 0.62 + Math.sin(i * 0.9) * 0.08, 0.52));
  for (const x of [-0.45, 0.45]) { const c = chair(); c.scale.set(1.25, 1.25, 1.25); c.position.set(x, 0, -0.75); g.add(c); }
  g.add(mesh(cyl(0.03, 0.08, 0.4, 10), MAT.gold, 0, 0.97, 0)); g.add(mesh(sph(0.16, 12, 8), MAT.themeFlower, 0, 1.2, 0));
  return g;
}
export function chandelier(scale = 1) {
  const g = G(); g.scale.setScalar(scale);
  g.add(mesh(cyl(0.02, 0.02, 1.2, 6), MAT.gold, 0, 0.6, 0));
  g.add(mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 28), MAT.gold, 0, 0, 0, Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 22), MAT.gold, 0, -0.25, 0, Math.PI / 2));
  g.add(mesh(sph(0.16, 12, 10), MAT.gold, 0, -0.1, 0));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(mesh(cyl(0.025, 0.025, 0.12, 6), MAT.white, Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6)); g.add(mesh(sph(0.04, 8, 6), MAT.bulb, Math.cos(a) * 0.6, 0.17, Math.sin(a) * 0.6)); }
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const r = i % 2 ? 0.58 : 0.4; g.add(mesh(new THREE.OctahedronGeometry(0.05), MAT.crystal, Math.cos(a) * r, -0.2 - (i % 3) * 0.12, Math.sin(a) * r, 0, 0, 0, 1, 1.8, 1)); }
  g.add(mesh(new THREE.OctahedronGeometry(0.09), MAT.crystal, 0, -0.55, 0, 0, 0, 0, 1, 2, 1));
  return g;
}
export function stage(w = 6, d = 3) {
  const g = G();
  g.add(mesh(box(w, 0.6, d), MAT.wood, 0, 0.3, 0)); g.add(mesh(box(w + 0.1, 0.08, d + 0.1), MAT.gold, 0, 0.62, 0));
  g.add(mesh(box(2, 0.3, 0.8), MAT.carpet, 0, 0.15, d / 2 + 0.4)); // steps
  // backdrop arch with drapes and flowers
  const arch = new THREE.TorusGeometry(w * 0.32, 0.12, 10, 32, Math.PI);
  g.add(mesh(arch, MAT.gold, 0, 0.65, -d / 2 + 0.2));
  for (const s of [-1, 1]) { g.add(mesh(box(0.35, 3.2, 0.35), MAT.creamLight, s * w * 0.32, 2.2, -d / 2 + 0.2)); g.add(mesh(box(1.4, 3.6, 0.05), MAT.themeDrape, s * (w * 0.32 + 0.9), 2.4, -d / 2 + 0.05)); }
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; g.add(mesh(sph(0.16, 8, 6), i % 3 ? MAT.themeFlower : MAT.leaf, Math.cos(a) * w * 0.32, 0.65 + Math.sin(a) * w * 0.32, -d / 2 + 0.3)); }
  for (const s of [-1, 1]) { g.add(mesh(box(0.45, 1.0, 0.45), MAT.black, s * (w / 2 - 0.4), 1.1, d / 2 - 0.4)); g.add(mesh(cyl(0.14, 0.14, 0.05, 14), MAT.dark, s * (w / 2 - 0.4), 1.3, d / 2 - 0.16, Math.PI / 2)); }
  return g;
}
export function djBooth() {
  const g = G(); g.add(mesh(box(2.2, 1.0, 0.9), MAT.black, 0, 0.5, 0)); g.add(mesh(box(2.25, 0.06, 0.95), MAT.gold, 0, 1.02, 0));
  for (const x of [-0.5, 0.5]) g.add(mesh(cyl(0.22, 0.22, 0.04, 18), MAT.dark, x, 1.07, 0));
  g.add(mesh(box(0.5, 0.06, 0.3), MAT.chrome, 0, 1.07, 0.1));
  for (const x of [-1.4, 1.4]) { g.add(mesh(box(0.55, 1.6, 0.5), MAT.black, x, 0.8, 0)); for (const y of [0.5, 1.15]) g.add(mesh(cyl(0.18, 0.18, 0.04, 16), MAT.dark, x, y, 0.26, Math.PI / 2)); }
  return g;
}
export function bar() {
  const g = G(); g.add(mesh(box(3.6, 1.1, 0.7), MAT.wood, 0, 0.55, 0.3)); g.add(mesh(box(3.8, 0.08, 0.85), MAT.marble, 0, 1.14, 0.3)); g.add(mesh(box(3.62, 0.06, 0.72), MAT.gold, 0, 0.2, 0.3));
  g.add(mesh(box(3.6, 2.0, 0.3), MAT.wood, 0, 1.0, -0.75));
  for (let s = 0; s < 3; s++) { g.add(mesh(box(3.4, 0.04, 0.3), MAT.gold, 0, 1.0 + s * 0.45, -0.55)); for (let i = 0; i < 10; i++) g.add(mesh(cyl(0.04, 0.045, 0.28, 8), [MAT.glass, MAT.roseRed, MAT.leafDark, MAT.goldSoft][(i + s) % 4], -1.5 + i * 0.33, 1.17 + s * 0.45, -0.55)); }
  for (let i = 0; i < 4; i++) { g.add(mesh(cyl(0.2, 0.2, 0.06, 14), MAT.red, -1.2 + i * 0.8, 0.8, 1.0)); g.add(mesh(cyl(0.03, 0.03, 0.78, 6), MAT.chrome, -1.2 + i * 0.8, 0.39, 1.0)); }
  return g;
}
export function buffet() {
  const g = G(); g.add(mesh(box(3.6, 0.8, 0.9), MAT.themeCloth, 0, 0.4, 0)); g.add(mesh(box(3.7, 0.05, 1.0), MAT.white, 0, 0.82, 0));
  for (let i = 0; i < 5; i++) { const x = -1.4 + i * 0.7; g.add(mesh(box(0.55, 0.06, 0.4), MAT.chrome, x, 0.88, 0)); g.add(mesh(sph(0.26, 14, 8, ), MAT.chrome, x, 0.92, 0, 0, 0, 0, 1, 0.45, 0.75)); }
  g.add(mesh(box(3.6, 0.1, 0.2), MAT.themeRunner, 0, 0.6, 0.46));
  return g;
}
export function cake() {
  const g = G(); g.add(mesh(cyl(0.6, 0.6, 0.75, 20), MAT.themeCloth, 0, 0.375, 0)); g.add(mesh(cyl(0.3, 0.3, 0.04, 20), MAT.gold, 0, 0.78, 0));
  let y = 0.8; for (const [r, h] of [[0.26, 0.2], [0.2, 0.18], [0.14, 0.16]] as const) { g.add(mesh(cyl(r, r, h, 22), MAT.white, 0, y + h / 2, 0)); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(mesh(sph(0.028, 6, 5), MAT.themeFlower, Math.cos(a) * r, y + h, Math.sin(a) * r)); } y += h; }
  g.add(mesh(sph(0.05, 8, 6), MAT.roseRed, 0, y + 0.04, 0)); return g;
}
export function flowerArch(w = 2.6) {
  const g = G(); g.add(mesh(new THREE.TorusGeometry(w / 2, 0.06, 8, 30, Math.PI), MAT.goldSoft, 0, 0.2, 0));
  for (const s of [-1, 1]) g.add(mesh(cyl(0.06, 0.06, 0.25, 8), MAT.goldSoft, s * w / 2, 0.1, 0));
  for (let i = 0; i <= 26; i++) { const a = (i / 26) * Math.PI; const k = i % 4; g.add(mesh(sph(0.13 + (k === 0 ? 0.04 : 0), 9, 7), k === 3 ? MAT.leaf : MAT.themeFlower, Math.cos(a) * w / 2, 0.2 + Math.sin(a) * w / 2, (k - 1.5) * 0.04)); }
  return g;
}
export function plant() { const g = G(); g.add(mesh(cyl(0.22, 0.17, 0.45, 12), MAT.goldSoft, 0, 0.225, 0)); g.add(mesh(sph(0.42, 12, 10), MAT.leaf, 0, 0.85, 0, 0, 0, 0, 1, 1.25, 1)); return g; }
export function roseBush(red = false) { const g = G(); g.add(mesh(sph(0.45, 12, 8), MAT.leafDark, 0, 0.4, 0, 0, 0, 0, 1, 0.8, 1)); for (let i = 0; i < 11; i++) { const a = i * 2.4; g.add(mesh(sph(0.09, 8, 6), red ? MAT.roseRed : MAT.rose, Math.cos(a) * 0.32, 0.45 + (i % 3) * 0.12, Math.sin(a) * 0.32)); } return g; }
export function lamp() { const g = G(); g.add(mesh(cyl(0.18, 0.22, 0.05, 12), MAT.gold, 0, 0.03, 0)); g.add(mesh(cyl(0.03, 0.03, 1.6, 8), MAT.gold, 0, 0.8, 0)); g.add(mesh(cyl(0.18, 0.26, 0.35, 14), MAT.cloth, 0, 1.7, 0)); g.add(mesh(sph(0.08), MAT.bulb, 0, 1.6, 0)); return g; }
export function photoWall() { const g = G(); g.add(mesh(box(2.8, 2.4, 0.15), MAT.leafDark, 0, 1.2, 0)); for (let i = 0; i < 30; i++) g.add(mesh(sph(0.11, 8, 6), MAT.themeFlower, -1.25 + (i % 6) * 0.5, 0.3 + Math.floor(i / 6) * 0.45, 0.1)); g.add(mesh(box(2.9, 0.1, 0.25), MAT.gold, 0, 2.45, 0)); return g; }
export function fountain() { const g = G(); g.add(mesh(cyl(0.95, 1.0, 0.45, 24), MAT.creamLight, 0, 0.225, 0)); const w = mesh(cyl(0.85, 0.85, 0.05, 24), MAT.glass, 0, 0.4, 0); g.add(w); g.add(mesh(cyl(0.12, 0.18, 1.0, 12), MAT.creamLight, 0, 0.7, 0)); g.add(mesh(cyl(0.45, 0.2, 0.18, 18), MAT.creamLight, 0, 1.2, 0)); g.add(mesh(sph(0.12), MAT.gold, 0, 1.4, 0)); return g; }
export function danceFloorMesh(w: number, d: number) {
  // Animated LED tiles via a tiny shader. Time and intensity are driven by the hall.
  const mat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, on: { value: 0 }, base: { value: new THREE.Color('#f4f0ff') }, tint: { value: new THREE.Color('#a070ff') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float t; uniform float on; uniform vec3 base; uniform vec3 tint; varying vec2 vUv;
      void main(){ vec2 g = vUv*vec2(${w.toFixed(1)}, ${d.toFixed(1)}); vec2 c = floor(g); vec2 f = fract(g);
        float edge = step(0.06, f.x)*step(0.06, f.y)*step(f.x,0.94)*step(f.y,0.94);
        float h = fract(sin(dot(c, vec2(12.9898,78.233)))*43758.5453);
        float pulse = 0.5+0.5*sin(t*3.0 + h*6.28 + c.x*0.7);
        vec3 led = mix(tint, vec3(1.0,0.5,0.8), h)*pulse*1.4;
        vec3 col = mix(base*0.95, led, on) * (0.55 + 0.45*edge);
        gl_FragColor = vec4(col,1.0); }` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; (m as any).noBake = true; return m;
}

// ---------------- Outdoors ----------------
export function tree(kind: 'round' | 'pine' | 'palm' | 'cypress' | 'snowpine' = 'round', s = 1) {
  const g = G();
  if (kind === 'round') { g.add(mesh(cyl(0.15 * s, 0.22 * s, 2.2 * s, 8), MAT.trunk, 0, 1.1 * s, 0)); g.add(mesh(sph(1.4 * s, 12, 10), MAT.leaf, 0, 2.9 * s, 0)); g.add(mesh(sph(0.9 * s, 10, 8), MAT.leaf, 0.7 * s, 2.5 * s, 0.3 * s)); g.add(mesh(sph(0.9 * s, 10, 8), MAT.leafDark, -0.6 * s, 2.6 * s, -0.4 * s)); }
  if (kind === 'pine' || kind === 'snowpine') { g.add(mesh(cyl(0.15 * s, 0.2 * s, 1.2 * s, 7), MAT.trunk, 0, 0.6 * s, 0)); for (let i = 0; i < 3; i++) { g.add(mesh(new THREE.ConeGeometry((1.5 - i * 0.4) * s, 1.8 * s, 10), MAT.pine, 0, (1.6 + i * 1.0) * s, 0)); if (kind === 'snowpine') g.add(mesh(new THREE.ConeGeometry((0.9 - i * 0.25) * s, 0.7 * s, 10), MAT.white, 0, (2.2 + i * 1.0) * s, 0)); } }
  if (kind === 'cypress') { g.add(mesh(cyl(0.1 * s, 0.14 * s, 0.6 * s, 6), MAT.trunk, 0, 0.3 * s, 0)); g.add(mesh(sph(0.75 * s, 12, 10), MAT.leafDark, 0, 2.1 * s, 0, 0, 0, 0, 1, 2.6, 1)); }
  if (kind === 'palm') {
    for (let i = 0; i < 6; i++) g.add(mesh(cyl(0.16 * s, 0.2 * s, 0.9 * s, 8), MAT.trunk, Math.sin(i * 0.3) * 0.15 * s, (0.45 + i * 0.85) * s, 0, 0, 0, Math.sin(i * 0.4) * 0.05));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const leaf = mesh(new THREE.ConeGeometry(0.35 * s, 2.6 * s, 4), MAT.leaf, Math.cos(a) * 1.1 * s, 5.0 * s, Math.sin(a) * 1.1 * s, 0, -a, Math.PI / 2 - 0.35); leaf.scale.set(1, 1, 0.25); g.add(leaf); }
  }
  return g;
}
export function streetLight() { const g = G(); g.add(mesh(cyl(0.08, 0.12, 5, 8), MAT.dark, 0, 2.5, 0)); g.add(mesh(box(0.08, 0.08, 1.2), MAT.dark, 0, 4.95, 0.55)); const l = mesh(sph(0.22, 10, 8), MAT.bulb, 0, 4.8, 1.1, 0, 0, 0, 1, 0.6, 1); g.add(l); return g; }
export function bench() { const g = G(); g.add(mesh(box(1.8, 0.08, 0.5), MAT.wood, 0, 0.45, 0)); g.add(mesh(box(1.8, 0.45, 0.06), MAT.wood, 0, 0.75, -0.22)); for (const x of [-0.75, 0.75]) g.add(mesh(box(0.08, 0.45, 0.5), MAT.dark, x, 0.22, 0)); return g; }
export function stanchion() { const g = G(); g.add(mesh(cyl(0.16, 0.18, 0.05, 12), MAT.gold, 0, 0.025, 0)); g.add(mesh(cyl(0.035, 0.035, 0.9, 8), MAT.gold, 0, 0.47, 0)); g.add(mesh(sph(0.07), MAT.gold, 0, 0.95, 0)); return g; }
export function ropeBetween(a: THREE.Vector3, b: THREE.Vector3) {
  const pts: THREE.Vector3[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, 0.85 - Math.sin(t * Math.PI) * 0.22, a.z + (b.z - a.z) * t)); }
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.03, 6), MAT.red);
}
const carMats = new Map<string, THREE.MeshStandardMaterial>();
export function car(color = '#ffffff', limo = false) {
  const g = G(); let m = carMats.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.5 }); carMats.set(color, m); }
  const L = limo ? 6.6 : 4.2;
  g.add(mesh(box(1.8, 0.55, L), m, 0, 0.55, 0)); g.add(mesh(sph(0.9, 12, 8), m, 0, 0.6, L / 2 - 0.2, 0, 0, 0, 1, 0.4, 0.5)); g.add(mesh(sph(0.9, 12, 8), m, 0, 0.6, -L / 2 + 0.2, 0, 0, 0, 1, 0.4, 0.4));
  g.add(mesh(box(1.6, 0.5, L * (limo ? 0.62 : 0.5)), MAT.glass, 0, 1.05, -0.15)); g.add(mesh(box(1.62, 0.06, L * (limo ? 0.62 : 0.5)), m, 0, 1.32, -0.15));
  for (const z of [L / 2 - 0.8, -L / 2 + 0.8]) for (const x of [-0.85, 0.85]) { g.add(mesh(cyl(0.34, 0.34, 0.25, 14), MAT.black, x, 0.34, z, 0, 0, Math.PI / 2)); g.add(mesh(cyl(0.18, 0.18, 0.27, 10), MAT.chrome, x, 0.34, z, 0, 0, Math.PI / 2)); }
  for (const x of [-0.6, 0.6]) { g.add(mesh(sph(0.12, 8, 6), MAT.bulb, x, 0.62, L / 2 + 0.1)); g.add(mesh(sph(0.1, 8, 6), MAT.roseRed, x, 0.62, -L / 2 - 0.05)); }
  if (limo) g.add(mesh(box(0.9, 0.35, 0.12), MAT.chrome, 0, 0.6, L / 2 + 0.22));
  return g;
}
export function building(w: number, h: number, d: number, color: string, lit = false, roofColor = '#8a5a4a') {
  const g = G(); const wm = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const winT = TEX.windows(lit).clone(); winT.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 8))); winT.needsUpdate = true;
  const facade = new THREE.MeshStandardMaterial({ map: winT, color, roughness: 0.8, emissive: lit ? '#ffcc66' : '#000000', emissiveMap: lit ? winT : null, emissiveIntensity: lit ? 0.5 : 0 });
  g.add(mesh(box(w, h, d), [wm, wm, wm, wm, facade, facade] as any, 0, h / 2, 0));
  g.add(mesh(box(w + 0.4, 0.4, d + 0.4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 }), 0, h + 0.2, 0));
  return g;
}
export function sign(text: string, w = 6, h = 1.5, bg?: string) { const t = TEX.sign(text, bg); return mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.15 })); }
