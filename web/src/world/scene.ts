// Renderer, lights, sky, day/night and quality presets (Smooth / High / Ultra).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Settings } from '../core/types';

export type Quality = Settings['quality'];
export const QUALITY = {
  smooth: { scale: 0.75, shadowMap: 1024, bloom: false, msaa: false, guests: 40, particles: 0.4, pixelRatioMax: 1.5 },
  high: { scale: 1.0, shadowMap: 2048, bloom: true, msaa: true, guests: 90, particles: 0.8, pixelRatioMax: 2 },
  ultra: { scale: 1.0, shadowMap: 4096, bloom: true, msaa: true, guests: 160, particles: 1.0, pixelRatioMax: 3 },
};

/** Guess a quality preset on first launch from the GPU and screen. */
export function autoQuality(): Quality {
  try {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'smooth';
    const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    const r = dbg ? String((gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const mem = (navigator as any).deviceMemory ?? 4; const cores = navigator.hardwareConcurrency ?? 4;
    if (/Mali-4|Mali-T|Adreno \(TM\) [3-5]\d\d|PowerVR|SwiftShader|llvmpipe/i.test(r) || mem <= 3 || cores <= 4) return 'smooth';
    if (/Adreno \(TM\) [7-8]\d\d|Mali-G7[1-9]|Mali-G[7-9]\d\d|Immortalis|Apple|NVIDIA|AMD|Radeon|Intel/i.test(r) && mem >= 6) return 'ultra';
    return 'high';
  } catch { return 'high'; }
}

export class Stage {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; ambient: THREE.AmbientLight;
  composer: EffectComposer | null = null; bloom: UnrealBloomPass | null = null;
  sky: THREE.Mesh; skyU: { top: { value: THREE.Color }; bottom: { value: THREE.Color }; sunDir: { value: THREE.Vector3 }; stars: { value: number } };
  quality: Quality = 'high'; settings: Settings | null = null; time = 0; dayT = 0.35; // 0 morning .. 1 night
  updaters = new Set<(dt: number, t: number) => void>();
  private last = performance.now(); fps = 60; private fpsAcc = 0; private fpsN = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.3, 900);
    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#e8d8b8', 0.9); this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.15); this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#fff3dd', 2.6); this.sun.position.set(40, 70, 35); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 10; sc.far = 200;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03; this.scene.add(this.sun); this.scene.add(this.sun.target);
    // Gradient sky dome with stars at night.
    this.skyU = { top: { value: new THREE.Color('#3f8fe0') }, bottom: { value: new THREE.Color('#cfe9ff') }, sunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() }, stars: { value: 0 } };
    const skyMat = new THREE.ShaderMaterial({ uniforms: this.skyU as any, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float stars; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ float t = clamp(vP.y*1.4+0.15,0.0,1.0); vec3 c = mix(bottom, top, t);
          float s = max(dot(normalize(vP), sunDir), 0.0); c += vec3(1.0,0.85,0.6)*pow(s, 180.0)*1.5 + vec3(1.0,0.7,0.4)*pow(s,8.0)*0.15;
          vec3 g = floor(vP*260.0); float st = step(0.997, h(g)) * stars * smoothstep(0.05,0.3,vP.y); c += vec3(st);
          gl_FragColor = vec4(c,1.0); }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat); this.sky.renderOrder = -1; this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog('#cfe9ff', 160, 520);
    // Soft studio reflections so gold, glass and marble look polished.
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; (this.scene as any).environmentIntensity = 0.55;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  setQuality(q: Quality, settings?: Settings) {
    this.quality = q; if (settings) this.settings = settings; const Q = QUALITY[q];
    const pr = this.fast ? 0.5 : Math.min(window.devicePixelRatio || 1, Q.pixelRatioMax) * Q.scale;
    this.renderer.setPixelRatio(pr);
    const shadows = !this.fast && (this.settings?.shadows ?? true);
    this.renderer.shadowMap.enabled = shadows; this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap); this.sun.shadow.map?.dispose(); (this.sun.shadow as any).map = null;
    const glow = (this.settings?.glow ?? true) && Q.bloom;
    if (glow && !this.composer) {
      this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.88); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    }
    if (!glow && this.composer) { this.composer.dispose(); this.composer = null; this.bloom = null; }
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w < h ? 55 : 42; this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h); this.composer?.setPixelRatio(this.renderer.getPixelRatio());
  }
  /** 0 = bright day, 0.5 = sunset, 1 = night. */
  setDayTime(t: number) {
    this.dayT = t;
    const day = { top: new THREE.Color('#3f8fe0'), bottom: new THREE.Color('#d6ecff') };
    const dusk = { top: new THREE.Color('#5a4a9a'), bottom: new THREE.Color('#ffb27a') };
    const night = { top: new THREE.Color('#0a1030'), bottom: new THREE.Color('#2a2f5a') };
    const lerp3 = (a: THREE.Color, b: THREE.Color, c: THREE.Color) => t < 0.5 ? a.clone().lerp(b, t * 2) : b.clone().lerp(c, (t - 0.5) * 2);
    this.skyU.top.value.copy(lerp3(day.top, dusk.top, night.top)); this.skyU.bottom.value.copy(lerp3(day.bottom, dusk.bottom, night.bottom));
    this.skyU.stars.value = Math.max(0, (t - 0.6) / 0.4);
    const ang = 0.9 - t * 0.85; const dir = new THREE.Vector3(Math.cos(ang) * 0.6, Math.sin(ang) * 0.9 + 0.05, 0.45).normalize();
    this.skyU.sunDir.value.copy(dir); this.sun.position.copy(dir.clone().multiplyScalar(90)).add(this.sun.target.position);
    this.sun.intensity = t < 0.5 ? 2.6 - t * 2.4 : Math.max(0.25, 1.4 - (t - 0.5) * 2.4);
    this.sun.color.set(t < 0.4 ? '#fff3dd' : t < 0.7 ? '#ffb070' : '#8aa0ff');
    this.hemi.intensity = 0.9 - t * 0.55; this.hemi.color.set(t < 0.6 ? '#cfe8ff' : '#6a78c0');
    (this.scene.fog as THREE.Fog).color.copy(this.skyU.bottom.value);
    this.renderer.toneMappingExposure = 1.05 - t * 0.2;
    if (this.bloom) this.bloom.strength = 0.25 + t * 0.45;
  }
  focusShadow(target: THREE.Vector3, radius: number) {
    this.sun.target.position.copy(target); const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -radius; sc.right = radius; sc.top = radius; sc.bottom = -radius; sc.updateProjectionMatrix(); this.setDayTime(this.dayT);
  }
  /** ?fast in the URL (automated tests on software rendering): fewer frames, bigger time steps. */
  fast = typeof location !== 'undefined' && location.search.includes('fast');
  frame() {
    const now = performance.now(); const dt = Math.min(this.fast ? 1.0 : 0.1, (now - this.last) / 1000); this.last = now; this.time += dt;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    for (const u of this.updaters) u(dt, this.time);
    this.sky.position.copy(this.camera.position);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
  start() { if (this.fast) { const loop = () => { this.frame(); setTimeout(loop, 700); }; setTimeout(loop, 100); return; } const loop = () => { this.frame(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}
