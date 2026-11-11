// Original procedural music and sound effects with the Web Audio API (no audio files to license),
// plus haptic vibration on taps and key moments.
let ctx: AudioContext | null = null; let master: GainNode | null = null; let musicGain: GainNode | null = null; let sfxGain: GainNode | null = null;
let musicVol = 0.6, sfxVol = 0.8, hapticsOn = true; let track: 'day' | 'party' | 'none' = 'none'; let timer: number | null = null; let step = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = musicVol * 0.35; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol * 0.6; sfxGain.connect(master);
  } catch { ctx = null; }
}
export function setVolumes(music: number, sound: number, haptics = true) { musicVol = music; sfxVol = sound; hapticsOn = haptics; if (musicGain) musicGain.gain.value = music * 0.35; if (sfxGain) sfxGain.gain.value = sound * 0.6; }
export function haptic(ms = 10) { if (hapticsOn && navigator.vibrate) try { navigator.vibrate(ms); } catch {} }
export function suspend(s: boolean) { if (!ctx) return; if (s) ctx.suspend(); else ctx.resume(); }

function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, dest: AudioNode | null = sfxGain, attack = 0.005, slide = 0) {
  if (!ctx || !dest) return; const t0 = ctx.currentTime + when; const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur: number, vol: number, when = 0, filter = 1200, dest: AudioNode | null = sfxGain) {
  if (!ctx || !dest) return; const t0 = ctx.currentTime + when; const len = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filter; f.Q.value = 0.8; const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(dest); s.start(t0);
}
export function sfx(kind: 'tap' | 'coin' | 'cheer' | 'firework' | 'alert' | 'ring' | 'open' | 'success' | 'fail' | 'fix' | 'moment') {
  if (!ctx) return;
  switch (kind) {
    case 'tap': tone(880, 0.06, 'triangle', 0.15); break;
    case 'open': tone(520, 0.08, 'sine', 0.15); tone(780, 0.1, 'sine', 0.12, 0.05); break;
    case 'coin': tone(988, 0.08, 'square', 0.12); tone(1319, 0.25, 'square', 0.12, 0.07); break;
    case 'success': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, i * 0.09)); break;
    case 'fail': tone(330, 0.25, 'sawtooth', 0.12, 0, sfxGain, 0.01, 0.6); break;
    case 'alert': tone(740, 0.12, 'square', 0.12); tone(740, 0.12, 'square', 0.12, 0.18); haptic(40); break;
    case 'fix': tone(660, 0.1, 'triangle', 0.15); tone(990, 0.18, 'triangle', 0.15, 0.08); break;
    case 'moment': tone(1047, 0.3, 'sine', 0.2); tone(1568, 0.4, 'sine', 0.15, 0.1); haptic(25); break;
    case 'cheer': for (let i = 0; i < 6; i++) noise(0.6, 0.18, i * 0.05, 900 + Math.random() * 1200); break;
    case 'firework': noise(0.08, 0.4, 0, 3000); noise(1.2, 0.25, 0.08, 400); break;
    case 'ring': for (let i = 0; i < 4; i++) { tone(1320, 0.08, 'sine', 0.18, i * 0.16); tone(1660, 0.08, 'sine', 0.18, i * 0.16 + 0.08); } haptic(200); break;
  }
}

// ---- Music: a calm day theme and party music for the dancing ----
const DAY = { bpm: 84, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]], mel: [76, 74, 72, 74, 76, 79, 76, 74, 72, 71, 72, 74, 69, 71, 72, 0] };
const PARTY = { bpm: 118, chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], mel: [69, 0, 72, 69, 76, 0, 74, 72, 69, 0, 67, 69, 72, 0, 71, 0] };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export function playMusic(kind: 'day' | 'party' | 'none') {
  if (track === kind) return; track = kind; if (timer) { clearInterval(timer); timer = null; } if (kind === 'none' || !ctx) return;
  const s = kind === 'day' ? DAY : PARTY; const beat = 60 / s.bpm / 2; step = 0;
  timer = window.setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const bar = Math.floor(step / 8) % s.chords.length; const ch = s.chords[bar];
    if (step % 8 === 0) for (const n of ch) tone(mtof(n - 12), beat * 7.5, kind === 'day' ? 'sine' : 'triangle', 0.06, 0, musicGain, 0.08);
    const m = s.mel[step % s.mel.length]; if (m) tone(mtof(m), beat * 1.6, kind === 'day' ? 'triangle' : 'square', kind === 'day' ? 0.07 : 0.04, 0, musicGain, 0.01);
    if (kind === 'party') { if (step % 2 === 0) tone(60, 0.15, 'sine', 0.35, 0, musicGain, 0.002, 0.4); if (step % 4 === 2) noise(0.12, 0.12, 0, 2500, musicGain); noise(0.03, 0.05, 0, 8000, musicGain); tone(mtof(ch[0] - 24), beat * 0.9, 'sawtooth', 0.05, 0, musicGain); }
    else if (step % 4 === 2) tone(mtof(ch[1]), beat, 'sine', 0.035, 0, musicGain);
    step++;
  }, beat * 1000);
}
