// Procedural textures drawn on canvases (no external image files needed) and the shared material palette.
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = 1, srgb = true) {
  const k = key + repeat; if (cache.has(k)) return cache.get(k)!;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d')!; draw(c);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; cache.set(k, t); return t;
}
function noise(c: CanvasRenderingContext2D, w: number, h: number, amt: number, n = 4000) { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * amt})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }

export const TEX = {
  marble: () => canvasTex('marble', 512, 512, (c) => {
    // polished cream-and-white marble tiles with gold inlay lines
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { c.fillStyle = (x + y) % 2 ? '#f4efe6' : '#fbf8f2'; c.fillRect(x * 256, y * 256, 256, 256); }
    c.strokeStyle = 'rgba(160,150,140,0.22)'; c.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) { c.beginPath(); let px = Math.random() * 512, py = Math.random() * 512; c.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - 0.5) * 120; py += (Math.random() - 0.5) * 120; c.lineTo(px, py); } c.stroke(); }
    c.strokeStyle = '#d9b45a'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, 509, 509); c.beginPath(); c.moveTo(256, 0); c.lineTo(256, 512); c.moveTo(0, 256); c.lineTo(512, 256); c.stroke();
    c.fillStyle = '#d9b45a'; c.save(); c.translate(256, 256); c.rotate(Math.PI / 4); c.fillRect(-14, -14, 28, 28); c.restore();
  }),
  wood: () => canvasTex('wood', 256, 256, (c) => { c.fillStyle = '#9a6a3e'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(60,30,10,${Math.random() * 0.25})`; c.beginPath(); const y = Math.random() * 256; c.moveTo(0, y); c.bezierCurveTo(80, y + 6, 160, y - 6, 256, y); c.stroke(); } for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, i * 32, 256, 1.5); } }),
  grass: () => canvasTex('grass', 256, 256, (c) => { c.fillStyle = '#7dbb55'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 6000; i++) { c.fillStyle = `hsl(${90 + Math.random() * 25},${45 + Math.random() * 20}%,${35 + Math.random() * 25}%)`; c.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 3); } }),
  sand: () => canvasTex('sand', 256, 256, (c) => { c.fillStyle = '#efd9a7'; c.fillRect(0, 0, 256, 256); noise(c, 256, 256, 0.12, 9000); }),
  snow: () => canvasTex('snow', 128, 128, (c) => { c.fillStyle = '#f3f7fb'; c.fillRect(0, 0, 128, 128); noise(c, 128, 128, 0.05, 2000); }),
  asphalt: () => canvasTex('asphalt', 256, 256, (c) => { c.fillStyle = '#55585e'; c.fillRect(0, 0, 256, 256); noise(c, 256, 256, 0.15, 9000); }),
  paving: () => canvasTex('paving', 256, 256, (c) => { c.fillStyle = '#e4dccb'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(120,110,90,0.35)'; c.lineWidth = 2; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, 256); c.moveTo(0, i * 32); c.lineTo(256, i * 32); c.stroke(); } noise(c, 256, 256, 0.06, 3000); }),
  carpet: () => canvasTex('carpet', 128, 256, (c) => { c.fillStyle = '#b3122e'; c.fillRect(0, 0, 128, 256); noise(c, 128, 256, 0.08, 3000); c.fillStyle = '#e1b84d'; c.fillRect(0, 0, 8, 256); c.fillRect(120, 0, 8, 256); }),
  stone: () => canvasTex('stone', 256, 256, (c) => { c.fillStyle = '#9d978d'; c.fillRect(0, 0, 256, 256); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { c.fillStyle = `hsl(35,${6 + Math.random() * 6}%,${52 + Math.random() * 14}%)`; c.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28); } noise(c, 256, 256, 0.08, 3000); }),
  wallpaper: () => canvasTex('wallpaper', 256, 256, (c) => { c.fillStyle = '#f6ecd8'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(205,170,100,0.35)'; c.lineWidth = 2; for (let x = 0; x < 256; x += 64) for (let y = 0; y < 256; y += 64) { c.beginPath(); c.ellipse(x + 32, y + 32, 14, 22, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x + 32, y + 32, 4, 0, Math.PI * 2); c.stroke(); } }),
  windows: (lit: boolean) => canvasTex('win' + lit, 128, 256, (c) => { c.fillStyle = '#d8d2c6'; c.fillRect(0, 0, 128, 256); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const on = lit && Math.random() < 0.55; c.fillStyle = on ? `hsl(45,90%,${70 + Math.random() * 15}%)` : '#5f7c96'; c.fillRect(x * 32 + 6, y * 32 + 6, 20, 22); c.fillStyle = 'rgba(255,255,255,0.25)'; if (!on) c.fillRect(x * 32 + 6, y * 32 + 6, 8, 22); } }),
  glassTower: (lit: boolean) => canvasTex('tower' + lit, 128, 512, (c) => { c.fillStyle = '#7f98b5'; c.fillRect(0, 0, 128, 512); for (let y = 0; y < 32; y++) for (let x = 0; x < 6; x++) { const on = lit && Math.random() < 0.45; c.fillStyle = on ? `hsl(48,80%,${68 + Math.random() * 20}%)` : `hsl(210,25%,${42 + Math.random() * 15}%)`; c.fillRect(x * 21 + 2, y * 16 + 2, 18, 12); } }),
  sign: (text: string, bg = '#1f3c88', fg = '#ffe9a8') => canvasTex('sign' + text + bg, 512, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, bg); g.addColorStop(1, '#0d1f52'); c.fillStyle = g; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#e8c35a'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 116); c.fillStyle = fg; c.font = 'bold 54px "Lilita One", "Lalezar", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 68);
  }, 1),
  forSale: () => canvasTex('forsale', 256, 128, (c) => { c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#2e7d32'; c.lineWidth = 10; c.strokeRect(5, 5, 246, 118); c.fillStyle = '#2e7d32'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.fillText('$', 128, 82); }),
  leaves: () => canvasTex('leaves', 128, 128, (c) => { c.fillStyle = '#4f8f3a'; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 400; i++) { c.fillStyle = `hsl(${95 + Math.random() * 30},50%,${28 + Math.random() * 30}%)`; c.beginPath(); c.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 0, Math.PI * 2); c.fill(); } }),
  billboard: (text: string) => canvasTex('bb' + text, 512, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, '#ff5d8f'); g.addColorStop(1, '#1f3c88'); c.fillStyle = g; c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#fff'; c.font = 'bold 56px "Lilita One", sans-serif'; c.textAlign = 'center'; c.fillText(text, 256, 120); c.font = 'bold 34px sans-serif'; c.fillStyle = '#ffe9a8'; c.fillText('♥ ♥ ♥', 256, 190);
  }),
};

// Shared materials. Theme-tinted ones are recolored live when the plan changes.
const M = THREE.MeshStandardMaterial;
export const MAT = {
  cream: new M({ color: '#f4e6cc', roughness: 0.8 }),
  creamLight: new M({ color: '#fbf3e3', roughness: 0.75 }),
  gold: new M({ color: '#d9ad45', roughness: 0.28, metalness: 0.85 }),
  goldSoft: new M({ color: '#e2bf68', roughness: 0.45, metalness: 0.6 }),
  white: new M({ color: '#ffffff', roughness: 0.6 }),
  cloth: new M({ color: '#fffdf8', roughness: 0.9 }),
  red: new M({ color: '#b3122e', roughness: 0.85 }),
  dark: new M({ color: '#25262b', roughness: 0.6 }),
  black: new M({ color: '#111114', roughness: 0.35, metalness: 0.2 }),
  chrome: new M({ color: '#dfe3ea', roughness: 0.15, metalness: 0.95 }),
  glass: new M({ color: '#bfe3ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }),
  windowGlow: new M({ color: '#fff0c4', emissive: '#ffd27a', emissiveIntensity: 0.0, roughness: 0.2 }),
  wood: new M({ color: '#ffffff', roughness: 0.65 }),
  leaf: new M({ color: '#4f9a42', roughness: 0.8 }),
  leafDark: new M({ color: '#2f6b35', roughness: 0.85 }),
  pine: new M({ color: '#2b5a3a', roughness: 0.85 }),
  trunk: new M({ color: '#7a5233', roughness: 0.9 }),
  rose: new M({ color: '#ffffff', roughness: 0.6 }),
  roseRed: new M({ color: '#d01c3a', roughness: 0.6 }),
  crystal: new M({ color: '#f4fbff', roughness: 0.05, metalness: 0.3, emissive: '#fff4d8', emissiveIntensity: 0.35 }),
  bulb: new M({ color: '#fff3cc', emissive: '#ffd68a', emissiveIntensity: 1.6 }),
  carpet: new M({ color: '#ffffff', roughness: 0.9 }),
  asphalt: new M({ color: '#ffffff', roughness: 0.95 }),
  paving: new M({ color: '#ffffff', roughness: 0.9 }),
  grass: new M({ color: '#ffffff', roughness: 0.95 }),
  sand: new M({ color: '#ffffff', roughness: 0.95 }),
  stone: new M({ color: '#ffffff', roughness: 0.85 }),
  marble: new M({ color: '#ffffff', roughness: 0.12, metalness: 0.05 }),
  wallpaper: new M({ color: '#ffffff', roughness: 0.85 }),
  lineWhite: new M({ color: '#f5f5f5', roughness: 0.8 }),
  lineYellow: new M({ color: '#f2c94c', roughness: 0.8 }),
  // theme-tinted
  themeCloth: new M({ color: '#ffffff', roughness: 0.9 }),
  themeRunner: new M({ color: '#d9c39a', roughness: 0.7, metalness: 0.2 }),
  themeFlower: new M({ color: '#ffffff', roughness: 0.6 }),
  themeAccent: new M({ color: '#d9c39a', roughness: 0.5, metalness: 0.3 }),
  themeDrape: new M({ color: '#f3ead8', roughness: 0.9, side: THREE.DoubleSide }),
  chair: new M({ color: '#f4efe4', roughness: 0.5 }),
  wallTint: new M({ color: '#f4e6cc', roughness: 0.85 }),
};
let texturesApplied = false;
export function applyTextures() {
  if (texturesApplied) return; texturesApplied = true;
  const set = (m: THREE.MeshStandardMaterial, t: THREE.Texture, rep = 1) => { m.map = t.clone(); m.map.repeat.set(rep, rep); m.map.needsUpdate = true; m.needsUpdate = true; };
  set(MAT.marble, TEX.marble(), 1); set(MAT.wood, TEX.wood()); set(MAT.carpet, TEX.carpet()); set(MAT.asphalt, TEX.asphalt(), 1); set(MAT.paving, TEX.paving(), 1);
  set(MAT.grass, TEX.grass(), 1); set(MAT.sand, TEX.sand(), 1); set(MAT.stone, TEX.stone(), 1); set(MAT.wallpaper, TEX.wallpaper(), 1);
  MAT.leaf.map = TEX.leaves(); MAT.leafDark.map = TEX.leaves();
}
/** World-space UVs so big ground planes tile nicely: call on PlaneGeometry after creation. */
export function worldUV(g: THREE.BufferGeometry, scale: number) {
  const p = g.attributes.position; const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / scale, p.getY(i) / scale);
  uv.needsUpdate = true; return g;
}
