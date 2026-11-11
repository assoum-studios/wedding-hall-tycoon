// Procedural animation on the shared skeleton. Every clip works on every body (adult, child, elderly).
import * as THREE from 'three';
import { B, type CharacterMesh } from './character';

export type Anim = 'idle' | 'walk' | 'run' | 'sit' | 'eat' | 'drink' | 'talk' | 'clap' | 'cheer' | 'dance1' | 'dance2' | 'dance3' | 'dance4' | 'dance5' | 'slowdance'
  | 'tray' | 'cook' | 'clean' | 'argue' | 'faint' | 'cry' | 'phone' | 'wave' | 'point' | 'sitTalk' | 'crossed' | 'pose' | 'tablet' | 'fix';
export type Face = 'happy' | 'excited' | 'worried' | 'angry' | 'crying' | 'neutral';

const e = new THREE.Euler(); const q = new THREE.Quaternion();
function rot(c: CharacterMesh, i: number, x: number, y = 0, z = 0) { e.set(x, y, z); q.setFromEuler(e); c.bones[i].quaternion.copy(c.rest[i]).multiply(q); }

/** Sets the whole pose for an animation at time t (seconds). phase lets crowds desync. */
export function animate(c: CharacterMesh, anim: Anim, t: number, face: Face = 'happy', phase = 0) {
  const d = c.dims; const T = t + phase; const s = Math.sin, co = Math.cos;
  const old = c.look.body === 'elderly'; const kid = c.look.body === 'child';
  // reset
  for (let i = 0; i < c.bones.length; i++) { c.bones[i].quaternion.copy(c.rest[i]); c.bones[i].position.copy(c.restPos[i]); }
  c.bones[B.mouth].scale.set(1, 1, 1);
  const armOut = 0.09; // arms hang just outside the jacket
  let uaL = [0, 0, armOut], uaR = [0, 0, -armOut], faL = [0, 0, 0], faR = [0, 0, 0], thL = [0, 0, 0], thR = [0, 0, 0], shL = [0, 0, 0], shR = [0, 0, 0];
  let hips = [0, 0, 0], spine = [old ? 0.18 : 0, 0, 0], chest = [0, 0, 0], neck = [old ? -0.12 : 0, 0, 0], head = [0, 0, 0], ftL = [0, 0, 0], ftR = [0, 0, 0];
  let lift = 0, root = [0, 0, 0];
  const breathe = s(T * 2.2) * 0.015;
  const sitDrop = d.hipY - d.H * 0.02 - 0.47 - d.legR * 0.4;
  const sitPose = () => { thL = [-1.5, 0, 0.05]; thR = [-1.5, 0, -0.05]; shL = [1.5, 0, 0]; shR = [1.5, 0, 0]; lift = -sitDrop; };
  switch (anim) {
    case 'idle': case 'pose':
      chest = [breathe, 0, 0]; head = [s(T * 0.7) * 0.04, s(T * 0.4) * 0.12, 0]; uaL = [s(T * 1.1) * 0.03, 0, armOut + 0.02]; uaR = [-s(T * 1.1) * 0.03, 0, -armOut - 0.02];
      faL = [-0.12, 0, 0]; faR = [-0.12, 0, 0]; hips = [0, s(T * 0.5) * 0.05, s(T * 0.9) * 0.02]; break;
    case 'crossed':
      uaL = [-0.55, -0.2, 0.3]; uaR = [-0.55, 0.2, -0.3]; faL = [-1.9, 0.0, -0.5]; faR = [-1.9, 0, 0.5]; chest = [breathe, 0, 0]; head = [0, s(T * 0.4) * 0.1, 0]; break;
    case 'tablet':
      uaL = [-0.35, 0.1, 0.15]; faL = [-1.25, 0.3, 0]; uaR = [-0.2 + s(T * 1.6) * 0.15, 0, -0.15]; faR = [-1.1 + s(T * 1.6) * 0.2, 0, 0]; head = [0.25, 0, 0]; chest = [breathe, 0, 0]; break;
    case 'walk': case 'tray': case 'run': {
      const sp = anim === 'run' ? 11 : old ? 5.5 : 7.5; const amp = anim === 'run' ? 0.9 : old ? 0.32 : 0.5; const w = T * sp;
      thL = [s(w) * amp, 0, 0]; thR = [-s(w) * amp, 0, 0];
      shL = [Math.max(0, -co(w)) * amp * 1.3 + 0.05, 0, 0]; shR = [Math.max(0, co(w)) * amp * 1.3 + 0.05, 0, 0];
      ftL = [-s(w) * 0.2, 0, 0]; ftR = [s(w) * 0.2, 0, 0];
      uaL = [-s(w) * amp * 0.8, 0, armOut]; uaR = [s(w) * amp * 0.8, 0, -armOut]; faL = [-0.25 - Math.max(0, s(w)) * 0.3, 0, 0]; faR = [-0.25 - Math.max(0, -s(w)) * 0.3, 0, 0];
      hips = [0, s(w) * 0.08, 0]; chest = [anim === 'run' ? 0.2 : 0.03, -s(w) * 0.1, 0]; lift = Math.abs(co(w)) * (anim === 'run' ? 0.06 : 0.025);
      if (anim === 'tray') { uaR = [-0.5, 0, -0.25]; faR = [-1.4, 0.4, 0]; }
      break; }
    case 'sit': case 'sitTalk': case 'eat': case 'drink':
      sitPose(); chest = [breathe, 0, 0]; uaL = [-0.35, 0, 0.12]; uaR = [-0.35, 0, -0.12]; faL = [-0.9, 0, 0]; faR = [-0.9, 0, 0];
      if (anim === 'sitTalk') { head = [0, s(T * 0.8) * 0.4, 0]; uaR = [-0.6 + s(T * 3) * 0.15, 0, -0.2]; faR = [-1.2 + s(T * 2.3) * 0.3, 0, 0]; }
      if (anim === 'eat') { const k = (s(T * 2.5) + 1) / 2; uaR = [-0.5 - k * 0.5, 0, -0.25]; faR = [-1.0 - k * 1.1, 0, 0]; head = [0.15, 0, 0]; }
      if (anim === 'drink') { const k = Math.max(0, s(T * 1.2)); uaR = [-0.4 - k * 0.6, 0, -0.3]; faR = [-1.2 - k * 1.0, 0, 0]; head = [-k * 0.3, 0, 0]; }
      break;
    case 'talk':
      head = [s(T * 3) * 0.06, s(T * 0.9) * 0.2, 0]; uaR = [-0.4 + s(T * 3.2) * 0.2, 0, -0.25]; faR = [-1.0 + s(T * 2.6) * 0.35, 0, 0]; uaL = [-0.2 + s(T * 2.2) * 0.15, 0, 0.2]; faL = [-0.8, 0, 0]; chest = [breathe, s(T) * 0.05, 0]; break;
    case 'clap': {
      const k = Math.abs(s(T * 9)); uaL = [-0.9, 0, 0.2 - k * 0.25]; uaR = [-0.9, 0, -0.2 + k * 0.25]; faL = [-0.9, -0.6, 0]; faR = [-0.9, 0.6, 0]; lift = 0; head = [-0.05, 0, 0]; break; }
    case 'cheer': {
      const k = s(T * 7); uaL = [-0.2, 0, 2.6 + k * 0.2]; uaR = [-0.2, 0, -2.6 - k * 0.2]; faL = [-0.3, 0, 0]; faR = [-0.3, 0, 0]; lift = Math.max(0, s(T * 7)) * 0.08; head = [-0.2, 0, 0]; break; }
    case 'dance1': { // bounce + arm pumps
      const w = T * 8; lift = Math.abs(s(w / 2)) * 0.07; thL = [-Math.abs(s(w / 2)) * 0.3, 0, 0]; shL = [Math.abs(s(w / 2)) * 0.5, 0, 0]; thR = [...thL]; shR = [...shL];
      uaL = [-1.2 + s(w) * 0.6, 0, 0.4]; uaR = [-1.2 - s(w) * 0.6, 0, -0.4]; faL = [-1.2, 0, 0]; faR = [-1.2, 0, 0]; head = [s(w) * 0.1, 0, 0]; break; }
    case 'dance2': { // sway, hands up
      const w = T * 3.5; hips = [0, 0, s(w) * 0.15]; chest = [0, 0, -s(w) * 0.12]; uaL = [0, 0, 2.4 + s(w) * 0.25]; uaR = [0, 0, -2.4 + s(w) * 0.25]; faL = [-0.4, 0, 0]; faR = [-0.4, 0, 0]; root = [0, 0, 0]; thL = [0, 0, s(w) * 0.1]; thR = [0, 0, s(w) * 0.1]; break; }
    case 'dance3': { // twist
      const w = T * 7; hips = [0, s(w) * 0.5, 0]; chest = [0, -s(w) * 0.6, 0]; uaL = [-0.6, 0, 0.8]; uaR = [-0.6, 0, -0.8]; faL = [-1.4, 0, 0]; faR = [-1.4, 0, 0]; thL = [-0.25, 0, 0]; shL = [0.5, 0, 0]; thR = [-0.25, 0, 0]; shR = [0.5, 0, 0]; lift = -0.06; break; }
    case 'dance4': { // disco point
      const w = T * 4; const up = s(w) > 0; uaR = up ? [-0.3, 0, -2.6] : [0.3, 0, -0.6]; faR = [0, 0, 0]; uaL = [-0.2, 0, 0.3]; faL = [-1.6, 0, -0.8]; hips = [0, 0, up ? 0.12 : -0.12]; head = [up ? -0.25 : 0.2, 0, 0]; thL = [0, 0, 0.2]; break; }
    case 'dance5': { // shuffle step
      const w = T * 9; thL = [s(w) * 0.4, 0, 0.1]; thR = [-s(w) * 0.4, 0, -0.1]; shL = [Math.max(0, s(w)) * 0.8, 0, 0]; shR = [Math.max(0, -s(w)) * 0.8, 0, 0]; uaL = [-s(w) * 0.6, 0, 0.3]; uaR = [s(w) * 0.6, 0, -0.3]; faL = [-1, 0, 0]; faR = [-1, 0, 0]; lift = Math.abs(s(w)) * 0.05; break; }
    case 'slowdance': {
      const w = T * 1.6; uaL = [-1.3, 0, 0.3]; uaR = [-1.3, 0, -0.3]; faL = [-0.6, -0.4, 0]; faR = [-0.6, 0.4, 0]; hips = [0, 0, s(w) * 0.06]; chest = [0.05, 0, -s(w) * 0.05]; head = [0.1, 0.2, 0]; thL = [s(w) * 0.08, 0, 0]; thR = [-s(w) * 0.08, 0, 0]; break; }
    case 'cook': { const w = T * 4; uaL = [-0.7, 0, 0.2]; faL = [-0.9, 0, 0]; uaR = [-0.8 + s(w) * 0.15, 0, -0.2 + co(w) * 0.15]; faR = [-0.9, 0, 0]; head = [0.35, 0, 0]; chest = [0.15, 0, 0]; break; }
    case 'clean': { const w = T * 3; uaL = [-0.6 + s(w) * 0.3, 0, 0.3]; uaR = [-0.6 + s(w) * 0.3, 0, -0.3]; faL = [-0.6, 0, 0]; faR = [-0.6, 0, 0]; chest = [0.25, s(w) * 0.2, 0]; head = [0.2, 0, 0]; break; }
    case 'fix': { const w = T * 6; uaR = [-1.0 + s(w) * 0.2, 0, -0.1]; faR = [-0.6, 0, 0]; uaL = [-0.9, 0, 0.1]; faL = [-0.5, 0, 0]; chest = [0.3, 0, 0]; head = [0.4, 0, 0]; thL = [-0.3, 0, 0]; shL = [0.6, 0, 0]; lift = -0.05; break; }
    case 'argue': { const w = T * 5; uaR = [-0.8 + s(w) * 0.5, 0, -0.5]; faR = [-0.6 + s(w * 1.3) * 0.5, 0, 0]; uaL = [-0.6 - s(w) * 0.4, 0, 0.6]; faL = [-0.5, 0, 0]; chest = [0.1, s(w * 0.5) * 0.2, 0]; head = [-0.1 + s(w) * 0.1, s(w * 0.7) * 0.2, 0]; face = 'angry'; break; }
    case 'faint': { const k = Math.min(1, (t % 1000) / 0.8); root = [-1.45 * k, 0, 0]; uaL = [0, 0, 1.2 * k]; uaR = [0, 0, -1.2 * k]; lift = 0.1 * k; face = 'worried'; break; }
    case 'cry': { const k = s(T * 9) * 0.03; uaL = [-1.2, 0, -0.3]; uaR = [-1.2, 0, 0.3]; faL = [-1.9, 0, -0.2]; faR = [-1.9, 0, 0.2]; head = [0.25, 0, 0]; chest = [0.1 + k, 0, 0]; face = 'crying'; break; }
    case 'phone': uaR = [-0.4, 0, -0.5]; faR = [-2.4, 0, 0.4]; head = [0, 0, -0.15]; uaL = [0, 0, armOut]; chest = [breathe, 0, 0]; break;
    case 'wave': { const w = T * 8; uaR = [-0.1, 0, -2.5]; faR = [0, 0, s(w) * 0.5]; uaL = [0, 0, armOut]; head = [0, -0.1, 0]; break; }
    case 'point': uaR = [-1.5, 0, -0.1]; faR = [-0.05, 0, 0]; head = [0, -0.1, 0]; break;
  }
  if (kid) lift *= 0.6;
  rot(c, B.root, root[0], root[1], root[2]);
  rot(c, B.hips, hips[0], hips[1], hips[2]); rot(c, B.spine, spine[0], spine[1], spine[2]); rot(c, B.chest, chest[0], chest[1], chest[2]);
  rot(c, B.neck, neck[0], neck[1], neck[2]); rot(c, B.head, head[0], head[1], head[2]);
  rot(c, B.uaL, uaL[0], uaL[1], uaL[2]); rot(c, B.uaR, uaR[0], uaR[1], uaR[2]); rot(c, B.faL, faL[0], faL[1], faL[2]); rot(c, B.faR, faR[0], faR[1], faR[2]);
  rot(c, B.thL, thL[0], thL[1], thL[2]); rot(c, B.thR, thR[0], thR[1], thR[2]); rot(c, B.shL, shL[0], shL[1], shL[2]); rot(c, B.shR, shR[0], shR[1], shR[2]);
  rot(c, B.ftL, ftL[0], ftL[1], ftL[2]); rot(c, B.ftR, ftR[0], ftR[1], ftR[2]);
  c.bones[B.hips].position.y = c.restPos[B.hips].y + lift + breathe * 0.2;
  // Facial expression: brows and mouth.
  const bl = c.bones[B.browL], br = c.bones[B.browR], m = c.bones[B.mouth];
  switch (face) {
    case 'excited': bl.position.y += d.head * 0.06; br.position.y += d.head * 0.06; m.scale.set(1.15, 1.6, 1); break;
    case 'worried': rot(c, B.browL, 0, 0, 0.35); rot(c, B.browR, 0, 0, -0.35); m.scale.set(0.8, -0.6, 1); break;
    case 'angry': rot(c, B.browL, 0, 0, -0.4); rot(c, B.browR, 0, 0, 0.4); bl.position.y -= d.head * 0.04; br.position.y -= d.head * 0.04; m.scale.set(0.9, -0.7, 1); break;
    case 'crying': rot(c, B.browL, 0, 0, 0.3); rot(c, B.browR, 0, 0, -0.3); m.scale.set(1.1, 1.3, 1); break;
    case 'neutral': m.scale.set(0.9, 0.35, 1); break;
    default: break;
  }
}
