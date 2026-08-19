// ── Audio procedural (sin dependencias) ────────────────────────────────────────

let _ac: AudioContext | null = null;

function getAC(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ac) try { _ac = new AudioContext(); } catch { return null; }
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
}

function beep(f1: number, f2: number, dur: number, type: OscillatorType = 'sine', vol = 0.11) {
  const ac = getAC(); if (!ac) return;
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.connect(g); g.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(f1, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  osc.start(); osc.stop(ac.currentTime + dur);
}

export function sfxStep() {
  const ac = getAC(); if (!ac) return;
  const dur = 0.055, sr = ac.sampleRate;
  const buf = ac.createBuffer(1, Math.floor(sr * dur), sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2) * 0.5;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 280;
  const g = ac.createGain();
  g.gain.value = 0.15;
  src.connect(f); f.connect(g); g.connect(ac.destination);
  src.start();
}

export const sfxJump  = () => beep(300, 600, 0.11, 'sine', 0.09);
export const sfxCoin  = () => beep(880, 1760, 0.09, 'sine', 0.07);
export const sfxStomp = () => beep(180, 55, 0.13, 'square', 0.16);
export const sfxDie   = () => beep(440, 110, 0.35, 'sawtooth', 0.12);
export const sfxBuy   = () => beep(520, 1040, 0.12, 'triangle', 0.10);
export const sfxCombo = (n: number) => beep(500 + n * 120, 1000 + n * 200, 0.10, 'square', 0.10);

// Arpegio de varias notas con un único oscilador de forma compartida
function arpeggio(freqs: number[], type: OscillatorType, spacing: number, vol: number) {
  const ac = getAC(); if (!ac) return;
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = type; osc.frequency.value = f;
    const t = ac.currentTime + i * spacing;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t); osc.stop(t + 0.18);
  });
}

export const sfxLevel = () => arpeggio([523, 659, 784, 1047], 'sine', 0.11, 0.12);
export const sfxPower = () => arpeggio([660, 880, 1100, 1320, 1660], 'triangle', 0.06, 0.10);
