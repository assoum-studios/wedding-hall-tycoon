// Developer preview of the character system (not part of the game build).
import * as THREE from 'three';
import { Stage } from './world/scene';
import { buildCharacter, attachProp } from './characters/character';
import { animate, type Anim } from './characters/animator';
import { Rng } from './core/rng';
import { randomLook } from './characters/looks';
import type { Look } from './core/types';

const st = new Stage(document.getElementById('c') as HTMLCanvasElement); st.setQuality('high'); st.setDayTime(0.2);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#f1ebe0', roughness: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; st.scene.add(floor);
const params = new URLSearchParams(location.search); const mode = params.get('m') ?? 'cast';
const rng = new Rng(7);
const looks: [Look, Anim, string | null][] = mode === 'cast' ? [
  [{ gender: 'm', skin: 1, hair: 0, hairColor: 1, outfit: 0, color: 0, acc: [], beard: 1, uniform: 'manager' }, 'tablet', 'tablet'],
  [{ gender: 'm', skin: 1, hair: 0, hairColor: 1, outfit: 0, color: 0, acc: ['watch'], beard: 2 }, 'crossed', null],
  [{ gender: 'f', skin: 1, hair: 0, hairColor: 2, outfit: 2, color: 2, acc: ['earrings', 'watch'] }, 'pose', null],
  [{ gender: 'f', skin: 0, hair: 1, hairColor: 2, outfit: 6, color: 2, acc: ['earrings'], dress: 'bride' }, 'idle', 'bouquet'],
  [{ gender: 'm', skin: 2, hair: 2, hairColor: 0, outfit: 1, color: 1, acc: [], beard: 0, dress: 'groom' }, 'wave', null],
  [{ gender: 'm', skin: 3, hair: 1, hairColor: 0, outfit: 0, color: 0, acc: [], uniform: 'waiter' }, 'tray', 'tray'],
  [{ gender: 'm', skin: 4, hair: 1, hairColor: 0, outfit: 0, color: 0, acc: [], beard: 2, uniform: 'cook' }, 'cook', null],
  [{ gender: 'f', skin: 2, hair: 2, hairColor: 1, outfit: 0, color: 0, acc: [], uniform: 'security' }, 'idle', null],
  [{ gender: 'm', skin: 5, hair: 3, hairColor: 6, outfit: 0, color: 0, acc: [], uniform: 'valet' }, 'idle', null],
  [{ ...randomLook(rng, { gender: 'f', body: 'adult' }) }, 'dance2', null],
  [{ ...randomLook(rng, { gender: 'm', body: 'elderly' }) }, 'clap', null],
  [{ ...randomLook(rng, { gender: 'f', body: 'child' }) }, 'cheer', null],
] : Array.from({ length: 24 }, () => [randomLook(rng), (['idle', 'dance1', 'dance3', 'clap', 'talk', 'walk'] as Anim[])[rng.int(0, 5)], null]);
const only = params.get('only'); const chars = (only ? [looks[Number(only)]] : looks).map(([l, a, p], i) => {
  const c = buildCharacter(l); const cols = mode === 'cast' ? 6 : 8;
  c.mesh.position.set((i % cols - (cols - 1) / 2) * 0.9, 0, -Math.floor(i / cols) * 1.4); st.scene.add(c.mesh);
  if (p) attachProp(c, p as any); return { c, a };
});
const zoom = params.get('z');
st.camera.position.set(0, zoom ? 1.5 : 2.2, zoom ? 2.2 : 7.2); st.camera.lookAt(zoom ? -0.45 * (6 - 1) / 2 + 0 : 0, zoom ? 1.4 : 0.9, zoom ? 0 : -0.7);
if (zoom) { const ang = Number(params.get('a') ?? 0); st.camera.position.set(Number(zoom) + Math.sin(ang) * 1.6, 1.55, Math.cos(ang) * 1.6); st.camera.lookAt(Number(zoom), 1.4, 0); }
st.updaters.add((dt, t) => { const fr = params.get('t'); for (const { c, a } of chars) animate(c, a, fr ? Number(fr) : t, 'happy', c.mesh.position.x); });
st.start();
(window as any).ready = true;
