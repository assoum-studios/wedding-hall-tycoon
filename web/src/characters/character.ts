// Modular stylized characters. Every person shares one skeleton (so every animation works on everyone),
// then gets their own head, face, skin, hair, beard, clothes, shoes and accessories baked into one mesh.
import * as THREE from 'three';
import type { Look } from '../core/types';
import { SKIN, HAIR_COLORS, ACCENTS } from '../core/game';

export const B = { root: 0, hips: 1, spine: 2, chest: 3, neck: 4, head: 5, uaL: 6, faL: 7, hL: 8, uaR: 9, faR: 10, hR: 11, thL: 12, shL: 13, ftL: 14, thR: 15, shR: 16, ftR: 17, browL: 18, browR: 19, mouth: 20, eyeL: 21, eyeR: 22 } as const;
const BONE_COUNT = 23;

/** Outfit tables. Owner outfits match the customization screen: navy, black tux, cream, red, green, purple. */
export const OUTFITS = [
  { jacket: '#22336e', pants: '#22336e', shirt: '#ffffff', tie: '#2f4fb5' },
  { jacket: '#151518', pants: '#151518', shirt: '#ffffff', tie: '#111111', bow: true },
  { jacket: '#efe6d3', pants: '#efe6d3', shirt: '#ffffff', tie: '#d4af37' },
  { jacket: '#b3192b', pants: '#b3192b', shirt: '#ffffff', tie: '#7a0f1c' },
  { jacket: '#1e6b43', pants: '#1e6b43', shirt: '#ffffff', tie: '#d4af37' },
  { jacket: '#5b2a9e', pants: '#5b2a9e', shirt: '#ffffff', tie: '#d4af37' },
];
const UNIFORMS: Record<string, { jacket: string; pants: string; shirt: string; tie?: string; bow?: boolean; vest?: string; hat?: string; apron?: string; badge?: boolean; earpiece?: boolean; headset?: boolean; sleeves?: string; glasses?: boolean }> = {
  waiter: { jacket: '#ffffff', vest: '#17171c', pants: '#17171c', shirt: '#ffffff', tie: '#17171c', bow: true, sleeves: '#ffffff' },
  cook: { jacket: '#fbfbf7', pants: '#4a4d55', shirt: '#fbfbf7', hat: 'chef', sleeves: '#fbfbf7' },
  bartender: { jacket: '#ffffff', vest: '#6d1426', pants: '#17171c', shirt: '#ffffff', tie: '#6d1426', sleeves: '#ffffff' },
  security: { jacket: '#1b1d24', pants: '#1b1d24', shirt: '#ffffff', tie: '#0d0d10', earpiece: true, glasses: true },
  valet: { jacket: '#c4242f', pants: '#17171c', shirt: '#ffffff', tie: '#17171c', hat: 'cap' },
  host: { jacket: '#2b3f7d', pants: '#2b3f7d', shirt: '#ffffff', tie: '#d4af37', badge: true },
  decorator: { jacket: '#f1ece2', pants: '#3a4a5c', shirt: '#f1ece2', apron: '#3c8a5c', sleeves: '#f1ece2' },
  tech: { jacket: '#22252b', pants: '#4b5040', shirt: '#22252b', headset: true, sleeves: '#22252b' },
  cleaner: { jacket: '#7fb7d9', pants: '#7fb7d9', shirt: '#7fb7d9', sleeves: '#7fb7d9', apron: '#5c8fb0' },
  manager: { jacket: '#1f2f6b', pants: '#1f2f6b', shirt: '#ffffff', tie: '#d4af37', badge: true },
};

type V3 = [number, number, number];
class Builder {
  pos: number[] = []; nor: number[] = []; col: number[] = []; si: number[] = []; sw: number[] = []; idx: number[][] = [[], [], []]; n = 0;
  add(geo: THREE.BufferGeometry, color: string | THREE.Color, bone: number, mat = 0, m?: THREE.Matrix4) {
    if (m) geo.applyMatrix4(m);
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const p = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i)); this.nor.push(nn.getX(i), nn.getY(i), nn.getZ(i));
      this.col.push(c.r, c.g, c.b); this.si.push(bone, 0, 0, 0); this.sw.push(1, 0, 0, 0);
    }
    const index = geo.index;
    if (index) for (let i = 0; i < index.count; i++) this.idx[mat].push(index.getX(i) + this.n);
    else for (let i = 0; i < p.count; i++) this.idx[mat].push(i + this.n);
    this.n += p.count; geo.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    const all: number[] = []; let start = 0;
    this.idx.forEach((list, mi) => { if (!list.length) return; for (const i of list) all.push(i); g.addGroup(start, list.length, mi); start += list.length; });
    g.setIndex(all); g.computeBoundingSphere(); return g;
  }
}
const M = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const sphere = (r: number, ws = 14, hs = 10, phiStart = 0, phiLen = Math.PI * 2, thStart = 0, thLen = Math.PI) => new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen, thStart, thLen);
const capsule = (r: number, len: number, rs = 10) => new THREE.CapsuleGeometry(r, len, 4, rs);
const cyl = (rt: number, rb: number, h: number, s = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

// Shared materials: matte (skin and cloth), glossy (shoes, eyes, hair shine), veil (translucent).
let MATS: THREE.Material[] | null = null;
export function charMaterials() {
  if (!MATS) MATS = [
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.15 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  ];
  return MATS;
}

export interface Dims { H: number; head: number; hipY: number; shoulderY: number; shoulderX: number; kneeY: number; elbowY: number; wristY: number; neckY: number; headY: number; waistR: number; chestR: number; armR: number; legR: number; }
export function dimsFor(look: Look): Dims {
  const female = look.gender === 'f'; const body = look.body ?? 'adult';
  let H = (female ? 1.66 : 1.78) * (look.height ?? 1); let headK = 1;
  if (body === 'child') { H = 1.12; headK = 1.25; } if (body === 'elderly') H *= 0.95;
  const head = 0.158 * (H / 1.75) * headK;
  return { H, head, hipY: H * 0.52, shoulderY: H * 0.795, shoulderX: (female ? 0.175 : 0.215) * (H / 1.75), kneeY: H * 0.28, elbowY: H * 0.6, wristY: H * 0.43, neckY: H * 0.83, headY: H * 0.83 + head * 1.05,
    waistR: (female ? 0.118 : 0.15) * (H / 1.75), chestR: (female ? 0.145 : 0.185) * (H / 1.75), armR: (female ? 0.05 : 0.064) * (H / 1.75), legR: (female ? 0.066 : 0.084) * (H / 1.75) };
}

export interface CharacterMesh { mesh: THREE.SkinnedMesh; bones: THREE.Bone[]; dims: Dims; look: Look; rest: THREE.Quaternion[]; restPos: THREE.Vector3[]; props: Record<string, THREE.Object3D>; }

function makeSkeleton(d: Dims) {
  const b: THREE.Bone[] = []; for (let i = 0; i < BONE_COUNT; i++) b.push(new THREE.Bone());
  const set = (i: number, parent: number | null, x: number, y: number, z: number) => { b[i].position.set(x, y, z); if (parent != null) b[parent].add(b[i]); };
  // positions are relative to parents
  set(B.root, null, 0, 0, 0);
  set(B.hips, B.root, 0, d.hipY, 0);
  set(B.spine, B.hips, 0, d.H * 0.08, 0);
  set(B.chest, B.spine, 0, d.H * 0.11, 0);
  set(B.neck, B.chest, 0, d.neckY - d.hipY - d.H * 0.19, 0);
  set(B.head, B.neck, 0, d.head * 0.55, 0);
  const shY = d.shoulderY - (d.hipY + d.H * 0.19);
  set(B.uaL, B.chest, d.shoulderX, shY, 0); set(B.faL, B.uaL, 0, d.elbowY - d.shoulderY, 0); set(B.hL, B.faL, 0, d.wristY - d.elbowY, 0);
  set(B.uaR, B.chest, -d.shoulderX, shY, 0); set(B.faR, B.uaR, 0, d.elbowY - d.shoulderY, 0); set(B.hR, B.faR, 0, d.wristY - d.elbowY, 0);
  set(B.thL, B.hips, d.H * 0.055, -d.H * 0.02, 0); set(B.shL, B.thL, 0, d.kneeY - d.hipY + d.H * 0.02, 0); set(B.ftL, B.shL, 0, -d.kneeY + d.H * 0.04, 0);
  set(B.thR, B.hips, -d.H * 0.055, -d.H * 0.02, 0); set(B.shR, B.thR, 0, d.kneeY - d.hipY + d.H * 0.02, 0); set(B.ftR, B.shR, 0, -d.kneeY + d.H * 0.04, 0);
  const hy = d.headY - (d.neckY + d.head * 0.55);
  set(B.browL, B.head, d.head * 0.38, hy + d.head * 0.36, d.head * 0.88); set(B.browR, B.head, -d.head * 0.38, hy + d.head * 0.36, d.head * 0.88);
  set(B.mouth, B.head, 0, hy - d.head * 0.3, d.head * 0.9);
  // eye bones so eyes can blink and widen
  set(B.eyeL, B.head, d.head * 0.36, hy + d.head * 0.08, d.head * 0.8); set(B.eyeR, B.head, -d.head * 0.36, hy + d.head * 0.08, d.head * 0.8);
  return b;
}

/** Builds one character. Result is a single skinned mesh (2-3 draw calls) for performance on phones. */
export function buildCharacter(look: Look, detail = 1): CharacterMesh {
  const d = dimsFor(look); const bld = new Builder(); const female = look.gender === 'f';
  const skin = SKIN[look.skin % SKIN.length]; const hairC = HAIR_COLORS[look.hairColor % HAIR_COLORS.length];
  const seg = detail >= 1 ? 1 : 0.7; const S = (n: number) => Math.max(6, Math.round(n * seg));
  const uni = look.uniform ? UNIFORMS[look.uniform] : null;
  let outfit: any = uni ?? (look.outfit < 6 ? OUTFITS[look.outfit] : null);
  const isDress = !uni && (look.dress === 'bride' || (female && look.outfit >= 6));
  const accent = ACCENTS[look.color % ACCENTS.length];
  if (!uni && look.dress === 'groom') outfit = { jacket: '#141418', pants: '#141418', shirt: '#ffffff', tie: '#141418', bow: true } as any;
  if (!uni && !isDress && look.c && !female && look.outfit < 6 && !look.dress && look.c2) outfit = { jacket: look.c, pants: look.c, shirt: '#ffffff', tie: look.c2 } as any;
  if (!uni && !isDress && look.gender === 'f' && look.outfit < 6 && look.c) outfit = { ...OUTFITS[look.outfit] } as any;
  if (!uni && !look.c && outfit && !isDress && !outfit.bow && look.dress !== 'groom') outfit = { ...outfit, tie: ACCENTS[look.color % ACCENTS.length] === '#f4efe4' ? '#d4af37' : ACCENTS[look.color % ACCENTS.length] };
  const jacket = outfit?.jacket ?? '#ffffff'; const pants = outfit?.pants ?? '#222';
  const dressColor = look.dress === 'bride' ? '#fbf8f2' : look.c ?? accent;

  // ---- Head and face ----
  const hy = d.headY, hr = d.head;
  bld.add(sphere(hr, S(22), S(18)), skin, B.head, 0, M(0, hy, 0, 1, 1.08, 1.0));
  bld.add(sphere(hr * 0.62, S(14), S(10)), skin, B.head, 0, M(0, hy - hr * 0.42, hr * 0.18, 1.05, 0.78, 1.0)); // jaw/cheeks
  bld.add(sphere(hr * 0.17, 8, 6), skin, B.head, 0, M(hr * 0.98, hy - hr * 0.05, -hr * 0.05, 0.5, 1, 0.8)); // ears
  bld.add(sphere(hr * 0.17, 8, 6), skin, B.head, 0, M(-hr * 0.98, hy - hr * 0.05, -hr * 0.05, 0.5, 1, 0.8));
  bld.add(sphere(hr * 0.13, 10, 8), new THREE.Color(skin).multiplyScalar(0.96), B.head, 0, M(0, hy - hr * 0.12, hr * 0.98, 0.9, 1.1, 1)); // nose
  // Big expressive eyes.
  const eyeY = hy + hr * 0.08, eyeX = hr * 0.36, eyeZ = hr * 0.8;
  const iris = ['#5a3a22', '#3d2614', '#2f5a7a', '#4d6b3a'][look.skin % 2 === 0 ? 0 : 1];
  for (const sx of [1, -1]) {
    bld.add(sphere(hr * 0.26, S(14), S(12)), '#ffffff', sx > 0 ? B.eyeL : B.eyeR, 1, M(sx * eyeX, eyeY, eyeZ, 0.95, 1.15, 0.55));
    bld.add(sphere(hr * 0.16, S(12), S(10)), iris, sx > 0 ? B.eyeL : B.eyeR, 1, M(sx * eyeX, eyeY - hr * 0.02, eyeZ + hr * 0.1, 1, 1.05, 0.5));
    bld.add(sphere(hr * 0.085, 10, 8), '#0b0b0b', sx > 0 ? B.eyeL : B.eyeR, 1, M(sx * eyeX, eyeY - hr * 0.02, eyeZ + hr * 0.15, 1, 1, 0.45));
    bld.add(sphere(hr * 0.04, 6, 5), '#ffffff', sx > 0 ? B.eyeL : B.eyeR, 1, M(sx * eyeX + hr * 0.05, eyeY + hr * 0.05, eyeZ + hr * 0.2));
    // eyelid line
    bld.add(sphere(hr * 0.27, S(12), 6, 0, Math.PI * 2, 0, Math.PI * 0.32), skin, B.head, 0, M(sx * eyeX, eyeY + hr * 0.01, eyeZ - hr * 0.01, 1, 1.15, 0.6, -0.25));
    if (female) for (let k = 0; k < 3; k++) bld.add(capsule(hr * 0.012, hr * 0.08, 4), '#1a1110', sx > 0 ? B.browL : B.browR, 0, M(sx * (eyeX + hr * (0.08 + k * 0.07)), eyeY + hr * 0.25, eyeZ + hr * 0.05, 1, 1, 1, 0, 0, sx * (0.6 + k * 0.25)));
  }
  // Eyebrows on their own bones so faces can frown or lift.
  for (const sx of [1, -1]) bld.add(capsule(hr * (female ? 0.03 : 0.045), hr * 0.28, 6), look.hairColor === 5 ? '#9a9a9a' : hairC, sx > 0 ? B.browL : B.browR, 0, M(sx * eyeX, eyeY + hr * 0.36, eyeZ + hr * 0.08, 1, 1, 0.7, 0, 0, Math.PI / 2 + sx * 0.12));
  // Smile (torus arc) on the mouth bone.
  const lip = female ? '#c24d5c' : new THREE.Color(skin).multiplyScalar(0.62);
  bld.add(new THREE.TorusGeometry(hr * 0.2, hr * 0.045, 6, 14, Math.PI), lip, B.mouth, 0, M(0, hy - hr * 0.3, hr * 0.92, 1, 0.75, 0.6, 0, 0, Math.PI));
  bld.add(sphere(hr * 0.16, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#ffffff', B.mouth, 0, M(0, hy - hr * 0.3, hr * 0.9, 1, 0.45, 0.4)); // teeth hint
  // Beard and moustache like the General Manager.
  if (look.beard && !female) {
    const bc = new THREE.Color(hairC).multiplyScalar(0.9);
    if (look.beard >= 1) bld.add(sphere(hr * 0.66, S(16), S(10), 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), bc, B.head, 0, M(0, hy - hr * 0.32, hr * 0.2, 1.08, 0.95, 1.0));
    if (look.beard >= 2) bld.add(capsule(hr * 0.07, hr * 0.3, 6), bc, B.head, 0, M(0, hy - hr * 0.2, hr * 0.94, 1, 1, 0.7, 0, 0, Math.PI / 2));
    if (look.beard >= 3) bld.add(sphere(hr * 0.3, 10, 8), bc, B.head, 0, M(0, hy - hr * 0.75, hr * 0.55, 1, 0.8, 0.8));
  }
  // ---- Hair ----
  addHair(bld, look, d, hairC, S);
  // ---- Neck and torso ----
  bld.add(cyl(hr * 0.42, hr * 0.48, d.H * 0.07, 10), skin, B.neck, 0, M(0, d.neckY, 0));
  const torsoTop = d.shoulderY + 0.02, torsoBot = d.hipY - d.H * 0.02;
  const chestY = (torsoTop + torsoBot) / 2 + d.H * 0.04;
  const top = isDress ? dressColor : jacket;
  // Tailored torso: a smooth lathe from jacket hem to collar, flattened front-to-back.
  const bodyCol = outfit?.vest ?? top; const H = d.H;
  const waistY = d.hipY + H * 0.07; const hemY = isDress ? d.hipY + H * 0.03 : d.hipY - H * 0.07;
  const lower = [new THREE.Vector2(0.001, hemY - 0.01), new THREE.Vector2(d.waistR * (female ? 1.12 : 1.08), hemY), new THREE.Vector2(d.waistR * (female ? 1.06 : 1.05), (hemY + waistY) / 2), new THREE.Vector2(d.waistR, waistY)];
  const upper = [new THREE.Vector2(d.waistR, waistY), new THREE.Vector2(d.chestR * (female ? 0.92 : 0.98), waistY + H * 0.09), new THREE.Vector2(d.chestR, d.shoulderY - H * 0.06), new THREE.Vector2(d.chestR * 0.93, d.shoulderY - H * 0.015), new THREE.Vector2(d.chestR * 0.62, d.shoulderY + H * 0.015), new THREE.Vector2(hr * 0.5, d.shoulderY + H * 0.025), new THREE.Vector2(0.001, d.shoulderY + H * 0.026)];
  bld.add(new THREE.LatheGeometry(lower, S(20)), outfit?.vest && !isDress ? outfit.vest : bodyCol, B.hips, 0, M(0, 0, 0, 1.18, 1, 0.78));
  bld.add(new THREE.LatheGeometry(upper, S(20)), bodyCol, B.chest, 0, M(0, 0, 0, 1.18, 1, 0.78));
  // Rounded shoulders blending into the sleeves.
  for (const sx of [1, -1]) bld.add(sphere(d.armR * 1.08, 12, 10), isDress && !uni && look.dress === 'bride' ? skin : outfit?.vest ? outfit.sleeves ?? '#fff' : top, B.chest, 0, M(sx * d.shoulderX, d.shoulderY - H * 0.02, 0, 1.05, 0.8, 1));
  if (!isDress) {
    // Shirt V, tie / bow tie, lapels.
    const vZ = d.chestR * 0.74;
    bld.add(cyl(0.001, d.chestR * 0.36, d.H * 0.13, 3), outfit!.shirt, B.chest, 0, M(0, torsoTop - d.H * 0.07, vZ, 1, 1, 0.25, Math.PI, 0, 0));
    if ((outfit as any).bow) { bld.add(sphere(d.H * 0.018, 6, 5), outfit!.tie ?? '#111', B.chest, 0, M(d.H * 0.016, torsoTop - d.H * 0.03, vZ + 0.012, 1.4, 0.8, 0.6)); bld.add(sphere(d.H * 0.018, 6, 5), outfit!.tie ?? '#111', B.chest, 0, M(-d.H * 0.016, torsoTop - d.H * 0.03, vZ + 0.012, 1.4, 0.8, 0.6)); }
    else if (outfit!.tie) bld.add(cyl(d.H * 0.014, d.H * 0.006, d.H * 0.14, 4), outfit!.tie, B.chest, 1, M(0, torsoTop - d.H * 0.1, vZ + 0.01, 1, 1, 0.35, Math.PI, 0, 0));
    if (!outfit!.vest && !uni?.apron && !(look.uniform === 'cook') && !(look.uniform === 'tech') && !(look.uniform === 'cleaner'))
      for (const sx of [1, -1]) bld.add(cyl(0.001, d.chestR * 0.2, d.H * 0.16, 3), new THREE.Color(jacket).multiplyScalar(0.8), B.chest, 0, M(sx * d.chestR * 0.24, torsoTop - d.H * 0.08, vZ + 0.005, 1, 1, 0.2, Math.PI, 0, -sx * 0.25));
    // Buttons
    bld.add(sphere(d.H * 0.008, 5, 4), new THREE.Color(jacket).multiplyScalar(0.6), B.spine, 0, M(0, torsoBot + d.H * 0.07, d.waistR * 0.82));
    if (outfit!.vest) for (const sx of [1, -1]) bld.add(capsule(d.armR * 0.95, d.H * 0.05, 8), outfit!.sleeves ?? '#fff', B.chest, 0, M(sx * d.chestR * 0.95, chestY, 0, 1, 1, 1));
    if (uni?.apron) bld.add(cyl(d.waistR * 0.95, d.waistR * 1.15, d.H * 0.32, 10, true), uni.apron, B.spine, 0, M(0, torsoBot - d.H * 0.04, d.waistR * 0.12, 1, 1, 0.8));
    if (look.uniform === 'cook') for (let k = 0; k < 3; k++) for (const sx of [1, -1]) bld.add(sphere(d.H * 0.008, 5, 4), '#bbb', B.chest, 0, M(sx * d.chestR * 0.3, chestY + d.H * 0.04 - k * d.H * 0.04, d.chestR * 0.76));
    if (uni?.badge) bld.add(new THREE.BoxGeometry(d.H * 0.045, d.H * 0.016, d.H * 0.005), '#d9b44a', B.chest, 1, M(-d.chestR * 0.5, chestY + d.H * 0.03, d.chestR * 0.8, 1, 1, 1, 0, -0.3));
    // Belt
    bld.add(cyl(d.waistR * 1.04, d.waistR * 1.04, d.H * 0.02, 12), '#1a1410', B.hips, 0, M(0, d.hipY + d.H * 0.01, 0, 1.06, 1, 0.84));
    bld.add(new THREE.BoxGeometry(d.H * 0.025, d.H * 0.018, 0.01), '#d9b44a', B.hips, 1, M(0, d.hipY + d.H * 0.01, d.waistR * 0.88));
  } else {
    // Dress: fitted bodice already done, now the skirt.
    const bride = look.dress === 'bride'; const len = bride ? d.hipY + 0.0 : d.hipY - d.kneeY * 0.85;
    const hemY = d.hipY + d.H * 0.04 - len; const flare = bride ? 0.55 : 0.26;
    const pts: THREE.Vector2[] = []; const N = 10;
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(d.waistR * 1.02 + (flare * (d.H / 1.7)) * Math.pow(t, bride ? 1.4 : 1.1), d.hipY + d.H * 0.04 - len * t)); }
    pts.push(new THREE.Vector2(0.001, hemY));
    bld.add(new THREE.LatheGeometry(pts.reverse(), S(22)), dressColor, B.hips, 0);
    if (bride) {
      // layered ruffles and the train
      for (let k = 1; k <= 3; k++) bld.add(new THREE.TorusGeometry(d.waistR + (flare * (d.H / 1.7)) * Math.pow(k / 3.3, 1.4), 0.018, 6, S(26)), '#ffffff', B.hips, 0, M(0, d.hipY + d.H * 0.04 - len * (k / 3.3), 0, 1, 1, 1, Math.PI / 2));
      bld.add(sphere(0.5, S(16), 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#fbf8f2', B.hips, 0, M(0, 0.02, -0.45, 0.6, 0.12, 1.2));
      bld.add(sphere(hr * 1.1, 14, 10), '#ffffff', B.head, 2, M(0, hy - hr * 0.3, -hr * 0.35, 1.05, 1.0, 0.9)); // veil over hair back
      bld.add(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(hr * 1.0, -0.02), new THREE.Vector2(d.H * 0.18, -d.H * 0.45), new THREE.Vector2(d.H * 0.22, -d.H * 0.62)], 18), '#ffffff', B.head, 2, M(0, hy + hr * 0.9, -hr * 0.4, 1, 1, 0.6));
      bld.add(new THREE.TorusGeometry(hr * 0.75, hr * 0.06, 6, 16), '#e9e3ff', B.head, 1, M(0, hy + hr * 0.82, -hr * 0.1, 1, 1, 1, Math.PI / 2 - 0.2)); // tiara
    }
  }
  if (look.dress === 'groom') { bld.add(sphere(d.H * 0.016, 8, 6), '#ffffff', B.chest, 0, M(d.chestR * 0.55, d.shoulderY - d.H * 0.06, d.chestR * 0.72)); bld.add(sphere(d.H * 0.01, 6, 4), '#e8b8c0', B.chest, 0, M(d.chestR * 0.55, d.shoulderY - d.H * 0.055, d.chestR * 0.74)); }
  // ---- Arms ----
  const sleeve = isDress ? (look.dress === 'bride' ? skin : skin) : outfit!.vest ? outfit!.sleeves ?? '#fff' : jacket;
  for (const [ua, fa, h, sx] of [[B.uaL, B.faL, B.hL, 1], [B.uaR, B.faR, B.hR, -1]] as const) {
    const upLen = d.shoulderY - d.elbowY, foLen = d.elbowY - d.wristY;
    bld.add(capsule(d.armR, upLen - d.armR, S(10)), sleeve, ua, 0, M(sx * d.shoulderX, d.shoulderY - upLen / 2, 0));
    bld.add(capsule(d.armR * 0.9, foLen - d.armR, S(10)), sleeve, fa, 0, M(sx * d.shoulderX, d.elbowY - foLen / 2, 0));
    if (!isDress) bld.add(cyl(d.armR * 0.85, d.armR * 0.85, d.H * 0.015, 8), outfit!.shirt, fa, 0, M(sx * d.shoulderX, d.wristY + d.H * 0.012, 0));
    // hand + thumb
    bld.add(sphere(d.armR * 1.15, 10, 8), skin, h, 0, M(sx * d.shoulderX, d.wristY - d.armR * 0.9, 0.0, 0.8, 1.15, 1));
    bld.add(capsule(d.armR * 0.32, d.armR * 0.7, 5), skin, h, 0, M(sx * (d.shoulderX - d.armR * 0.55), d.wristY - d.armR * 0.6, d.armR * 0.5, 1, 1, 1, 0.4, 0, sx * 0.5));
    // four fingers, slightly curled
    for (let f = 0; f < 4; f++) bld.add(capsule(d.armR * 0.2, d.armR * 0.62, 5), skin, h, 0, M(sx * d.shoulderX + sx * (f - 1.5) * d.armR * 0.36 * 0.6, d.wristY - d.armR * 1.95, d.armR * (0.1 + f * 0.03), 1, 1, 1, 0.25, 0, 0));
    if (look.acc.includes('watch') && sx < 0) bld.add(cyl(d.armR * 0.95, d.armR * 0.95, d.H * 0.012, 10), '#d4af37', fa, 1, M(sx * d.shoulderX, d.wristY + d.H * 0.02, 0));
  }
  // ---- Legs ----
  const dressBride = look.dress === 'bride';
  for (const [th, sh, ft, sx] of [[B.thL, B.shL, B.ftL, 1], [B.thR, B.shR, B.ftR, -1]] as const) {
    const lx = sx * d.H * 0.055; const thLen = d.hipY - d.kneeY, shLen = d.kneeY - d.H * 0.05;
    const legC = isDress ? skin : pants;
    if (!dressBride) {
      bld.add(capsule(d.legR, thLen - d.legR, S(10)), isDress ? dressColor : legC, th, 0, M(lx, d.hipY - thLen / 2 - d.H * 0.01, 0));
      bld.add(capsule(d.legR * (isDress ? 0.7 : 0.88), shLen - d.legR, S(10)), legC, sh, 0, M(lx, d.kneeY - shLen / 2, 0));
    }
    // Shoes: glossy. Heels for women in dresses / suits.
    const shoe = look.dress === 'bride' ? '#f4efe6' : female && isDress ? (look.c2 ?? '#1a1a1a') : look.uniform === 'cook' || look.uniform === 'cleaner' ? '#2b2b2b' : female && look.outfit === 2 ? '#f4efe6' : '#111111';
    bld.add(sphere(d.legR * 1.05, 12, 8), shoe, ft, 1, M(lx, d.H * 0.025, d.legR * 0.7, 0.9, 0.55, 1.9));
    if (female) bld.add(cyl(d.legR * 0.2, d.legR * 0.15, d.H * 0.05, 5), shoe, ft, 1, M(lx, d.H * 0.025, -d.legR * 0.5));
  }
  // ---- Accessories ----
  const fz = hr * 0.98;
  if (look.acc.includes('glasses') || look.acc.includes('sunglasses') || uni?.glasses) {
    const sun = look.acc.includes('sunglasses') || uni?.glasses;
    for (const sx of [1, -1]) bld.add(new THREE.TorusGeometry(hr * 0.24, hr * 0.03, 5, 14), '#1a1a1a', B.head, 1, M(sx * eyeX, eyeY, fz, 1, 0.9, 1));
    if (sun) for (const sx of [1, -1]) bld.add(new THREE.CircleGeometry(hr * 0.23, 14), '#151515', B.head, 1, M(sx * eyeX, eyeY, fz + 0.002, 1, 0.9, 1));
    bld.add(capsule(hr * 0.02, hr * 0.18, 4), '#1a1a1a', B.head, 1, M(0, eyeY + hr * 0.04, fz, 1, 1, 1, 0, 0, Math.PI / 2));
  }
  if (look.acc.includes('earrings')) for (const sx of [1, -1]) bld.add(sphere(hr * 0.07, 8, 6), '#fdfdf4', B.head, 1, M(sx * hr * 1.0, hy - hr * 0.3, 0));
  if (look.acc.includes('necklace')) bld.add(new THREE.TorusGeometry(hr * 0.58, hr * 0.025, 5, 20), '#f2e6c4', B.chest, 1, M(0, d.neckY - d.H * 0.025, hr * 0.12, 1, 1, 0.9, Math.PI / 2 - 0.35));
  if (uni?.earpiece) bld.add(sphere(hr * 0.08, 6, 5), '#222', B.head, 1, M(-hr * 1.02, hy - hr * 0.05, 0.01));
  if (uni?.headset) { bld.add(new THREE.TorusGeometry(hr * 1.02, hr * 0.05, 5, 16, Math.PI), '#222', B.head, 0, M(0, hy + hr * 0.1, 0)); for (const sx of [1, -1]) bld.add(cyl(hr * 0.22, hr * 0.22, hr * 0.12, 10), '#222', B.head, 0, M(sx * hr * 1.0, hy - hr * 0.05, 0, 1, 1, 1, 0, 0, Math.PI / 2)); }
  if (uni?.hat === 'chef') { bld.add(cyl(hr * 0.85, hr * 0.8, hr * 0.7, 14), '#ffffff', B.head, 0, M(0, hy + hr * 1.15, 0)); bld.add(sphere(hr * 1.0, 14, 10), '#ffffff', B.head, 0, M(0, hy + hr * 1.6, 0, 1, 0.65, 1)); }
  if (uni?.hat === 'cap') { bld.add(sphere(hr * 1.02, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#c4242f', B.head, 0, M(0, hy + hr * 0.25, 0)); bld.add(cyl(hr * 0.6, hr * 0.6, hr * 0.06, 12), '#17171c', B.head, 0, M(0, hy + hr * 0.3, hr * 0.7, 1, 1, 0.8)); }

  const geo = bld.build();
  const bones = makeSkeleton(d);
  const mesh = new THREE.SkinnedMesh(geo, charMaterials());
  mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true; mesh.frustumCulled = true;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, d.H / 2, 0), d.H * 0.75);
  const rest = bones.map((b) => b.quaternion.clone()); const restPos = bones.map((b) => b.position.clone());
  return { mesh, bones, dims: d, look, rest, restPos, props: {} };
}

function addHair(bld: Builder, look: Look, d: Dims, hairC: string, S: (n: number) => number) {
  const hr = d.head, hy = d.headY; const female = look.gender === 'f'; const c = new THREE.Color(hairC); const hi = c.clone().lerp(new THREE.Color('#ffffff'), 0.08);
  const cap = (scaleY = 1, back = 0) => bld.add(sphere(hr * 1.07, S(20), S(12), 0, Math.PI * 2, 0, Math.PI * 0.5), c, B.head, 0, M(0, hy + hr * 0.12, -hr * 0.1 - back, 1.0, scaleY, 1.04, -0.42));
  if (!female) {
    switch (look.hair % 7) {
      case 0: // General Manager: groomed quiff swept back
        cap(1.05); bld.add(sphere(hr * 0.7, S(16), S(10)), hi, B.head, 0, M(0, hy + hr * 0.82, hr * 0.32, 1.25, 0.55, 0.85, -0.35));
        bld.add(sphere(hr * 0.75, S(14), S(10)), c, B.head, 0, M(0, hy + hr * 0.7, -hr * 0.2, 1.3, 0.6, 1.1));
        for (const sx of [1, -1]) bld.add(sphere(hr * 0.35, 10, 8), c, B.head, 0, M(sx * hr * 0.9, hy + hr * 0.1, -hr * 0.1, 0.4, 0.9, 1.0)); break;
      case 1: cap(0.9); break; // short crop
      case 2: cap(1.0); bld.add(sphere(hr * 0.6, S(14), 8), c, B.head, 0, M(hr * 0.35, hy + hr * 0.78, hr * 0.25, 1.2, 0.45, 0.9, -0.3, 0, -0.3)); break; // side part
      case 3: cap(1.0); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; bld.add(sphere(hr * 0.3, 8, 6), c, B.head, 0, M(Math.cos(a) * hr * 0.65, hy + hr * 0.7, Math.sin(a) * hr * 0.55 - hr * 0.1)); } break; // curly
      case 4: bld.add(sphere(hr * 1.03, S(18), S(10), 0, Math.PI * 2, 0, Math.PI * 0.5), c.clone().lerp(new THREE.Color(SKIN[look.skin]), 0.35), B.head, 0, M(0, hy + hr * 0.05, -hr * 0.04, 1, 1, 1, -0.15)); break; // buzz
      case 5: cap(1.0); bld.add(sphere(hr * 0.32, 10, 8), c, B.head, 0, M(0, hy + hr * 0.75, -hr * 0.75)); break; // man bun
      case 6: bld.add(sphere(hr * 1.04, S(16), 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.3), c, B.head, 0, M(0, hy, -hr * 0.05)); break; // balding
    }
  } else {
    cap(1.05);
    switch (look.hair % 6) {
      case 0: // high bun like the reference
        bld.add(sphere(hr * 0.5, S(14), S(10)), c, B.head, 0, M(0, hy + hr * 1.05, -hr * 0.25));
        bld.add(new THREE.TorusGeometry(hr * 0.42, hr * 0.12, 6, 14), hi, B.head, 0, M(0, hy + hr * 0.92, -hr * 0.2, 1, 1, 1, Math.PI / 2 - 0.3));
        for (const sx of [1, -1]) bld.add(capsule(hr * 0.08, hr * 0.5, 5), c, B.head, 0, M(sx * hr * 0.75, hy - hr * 0.3, hr * 0.45, 1, 1, 1, 0, 0, sx * 0.15)); break;
      case 1: // long wavy
        bld.add(capsule(hr * 0.75, hr * 1.4, S(12)), c, B.head, 0, M(0, hy - hr * 0.7, -hr * 0.45, 1.25, 1, 0.6));
        for (const sx of [1, -1]) bld.add(capsule(hr * 0.3, hr * 1.2, 8), hi, B.head, 0, M(sx * hr * 0.85, hy - hr * 0.6, -hr * 0.05, 1, 1, 1, 0, 0, sx * 0.1)); break;
      case 2: // ponytail
        bld.add(sphere(hr * 0.25, 10, 8), c, B.head, 0, M(0, hy + hr * 0.55, -hr * 0.95));
        bld.add(capsule(hr * 0.22, hr * 1.1, 8), c, B.head, 0, M(0, hy - hr * 0.2, -hr * 1.15, 1, 1, 1, 0.25)); break;
      case 3: // curly updo
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; bld.add(sphere(hr * 0.28, 8, 6), c, B.head, 0, M(Math.cos(a) * hr * 0.35, hy + hr * 1.0 + Math.sin(a * 2) * hr * 0.05, Math.sin(a) * hr * 0.35 - hr * 0.2)); } break;
      case 4: // bob
        bld.add(sphere(hr * 1.15, S(18), S(10), 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.45), c, B.head, 0, M(0, hy - hr * 0.05, -hr * 0.08, 1.02, 1.0, 1.0)); break;
      case 5: // long straight
        bld.add(new THREE.BoxGeometry(hr * 2.1, hr * 2.2, hr * 0.5), c, B.head, 0, M(0, hy - hr * 0.8, -hr * 0.65));
        for (const sx of [1, -1]) bld.add(new THREE.BoxGeometry(hr * 0.35, hr * 1.8, hr * 0.35), hi, B.head, 0, M(sx * hr * 0.92, hy - hr * 0.55, hr * 0.05)); break;
    }
  }
}

// Props held in hands (tray, tablet, phone, mop, bouquet).
export function attachProp(c: CharacterMesh, kind: 'tray' | 'tablet' | 'phone' | 'mop' | 'bouquet' | 'pan' | null) {
  for (const k in c.props) { c.props[k].parent?.remove(c.props[k]); delete c.props[k]; }
  if (!kind) return;
  const d = c.dims; let o: THREE.Object3D;
  const mat = (col: string, gloss = false) => new THREE.MeshStandardMaterial({ color: col, roughness: gloss ? 0.2 : 0.6, metalness: gloss ? 0.6 : 0 });
  const hand = c.bones[kind === 'tablet' ? B.hL : B.hR];
  switch (kind) {
    case 'tray': { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 18), mat('#c9c9cf', true)); g.add(t);
      for (let i = 0; i < 3; i++) { const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.1, 8), mat('#f2f6ff')); gl.position.set(Math.cos(i * 2) * 0.1, 0.055, Math.sin(i * 2) * 0.1); g.add(gl); }
      g.position.set(0, -0.06, 0.12); o = g; break; }
    case 'tablet': o = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.26, 0.012), mat('#6a6e78', true)); o.position.set(0.0, -0.08, 0.06); o.rotation.set(-0.6, 0, 0); break;
    case 'phone': o = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.01), mat('#222', true)); o.position.set(0, -0.05, 0.03); break;
    case 'mop': { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 6), mat('#9a7a50')); s.position.y = -0.4; g.add(s); const h = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.1), mat('#5aa0d0')); h.position.y = -1.0; g.add(h); o = g; break; }
    case 'bouquet': { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(i % 2 ? '#ffffff' : '#ffd6e0')); f.position.set(Math.cos(i) * 0.05, 0.02 + (i % 3) * 0.02, Math.sin(i) * 0.05 + 0.08); g.add(f); } o = g; break; }
    case 'pan': o = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.04, 14), mat('#333', true)); o.position.set(0, -0.06, 0.15); break;
  }
  hand.add(o!); c.props[kind] = o!; void d;
}
