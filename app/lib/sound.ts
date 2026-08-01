// Motor de sonido compartido para todos los juegos.
// Sonidos sintetizados con Web Audio API — sin archivos de audio.
// Se auto-desbloquea en el primer gesto del usuario (requisito de mobile).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

const STORAGE_KEY = "gami-muted";

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    try {
      muted = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {}
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Llamar una vez desde un event listener de gesto (touch/click/keydown) para desbloquear audio en iOS.
export function unlockAudio() {
  ensureCtx();
}

export function isMuted() {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {}
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {}
}

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  dur: number;
  type?: Wave;
  vol?: number;
  attack?: number;
  release?: number;
  freqEnd?: number; // glide de frecuencia
  delay?: number;   // segundos de retraso desde ahora
}

function tone({ freq, dur, type = "sine", vol = 0.5, attack = 0.005, release = 0.08, freqEnd, delay = 0 }: ToneOpts) {
  const ac = ensureCtx();
  if (!ac || !master || muted) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd && freqEnd !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + release + 0.02);
}

// Ruido blanco corto (para explosiones / impactos / cortes).
function noise({ dur = 0.2, vol = 0.4, delay = 0, filterFreq = 1200, hp = false }: { dur?: number; vol?: number; delay?: number; filterFreq?: number; hp?: boolean } = {}) {
  const ac = ensureCtx();
  if (!ac || !master || muted) return;
  const t0 = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = hp ? "highpass" : "lowpass";
  filter.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// Notas musicales base (Hz) para melodías simples.
const N: Record<string, number> = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5,
};

// Biblioteca de efectos reutilizables.
export const sfx = {
  // Toque/selección genérico.
  click() { tone({ freq: 520, dur: 0.05, type: "triangle", vol: 0.4, freqEnd: 660 }); },

  // Pop suave (burbujas, tiles, tap acertado).
  pop() { tone({ freq: 400, dur: 0.08, type: "sine", vol: 0.5, freqEnd: 900 }); },

  // Fusión / combinación (merge, match).
  merge() {
    tone({ freq: 400, dur: 0.09, type: "triangle", vol: 0.45, freqEnd: 620 });
    tone({ freq: 620, dur: 0.1, type: "sine", vol: 0.4, delay: 0.06, freqEnd: 820 });
  },

  // Moneda / recompensa brillante.
  coin() {
    tone({ freq: N.B5, dur: 0.07, type: "square", vol: 0.3 });
    tone({ freq: N.E5, dur: 0.12, type: "square", vol: 0.3, delay: 0.07 });
  },

  // Salto (plataformas).
  jump() { tone({ freq: 300, dur: 0.14, type: "sine", vol: 0.5, freqEnd: 720 }); },

  // Resorte / boost fuerte.
  boost() { tone({ freq: 260, dur: 0.25, type: "square", vol: 0.4, freqEnd: 1100 }); },

  // Corte (fruta, láser).
  slice() { noise({ dur: 0.12, vol: 0.35, filterFreq: 3000, hp: true }); tone({ freq: 900, dur: 0.08, type: "sawtooth", vol: 0.2, freqEnd: 300 }); },

  // Explosión / romper ladrillo.
  explode() { noise({ dur: 0.3, vol: 0.5, filterFreq: 900 }); tone({ freq: 180, dur: 0.2, type: "sawtooth", vol: 0.3, freqEnd: 60 }); },

  // Impacto suave (rebote pelota, choque leve).
  hit() { tone({ freq: 220, dur: 0.06, type: "square", vol: 0.35, freqEnd: 160 }); },

  // Power-up recogido.
  powerup() {
    tone({ freq: N.C5, dur: 0.09, type: "triangle", vol: 0.4 });
    tone({ freq: N.E5, dur: 0.09, type: "triangle", vol: 0.4, delay: 0.08 });
    tone({ freq: N.G5, dur: 0.14, type: "triangle", vol: 0.4, delay: 0.16 });
  },

  // Subir de nivel.
  levelup() {
    tone({ freq: N.C5, dur: 0.1, type: "square", vol: 0.35 });
    tone({ freq: N.E5, dur: 0.1, type: "square", vol: 0.35, delay: 0.1 });
    tone({ freq: N.G5, dur: 0.1, type: "square", vol: 0.35, delay: 0.2 });
    tone({ freq: N.C6, dur: 0.24, type: "square", vol: 0.4, delay: 0.3 });
  },

  // Combo (multiplicador sube según n).
  combo(n = 1) {
    const base = 500 + Math.min(n, 8) * 90;
    tone({ freq: base, dur: 0.08, type: "triangle", vol: 0.4, freqEnd: base * 1.4 });
  },

  // Perfecto / logro destacado.
  perfect() {
    tone({ freq: N.G5, dur: 0.09, type: "triangle", vol: 0.45 });
    tone({ freq: N.C6, dur: 0.16, type: "triangle", vol: 0.45, delay: 0.08 });
  },

  // Whoosh (deslizar, disparar).
  whoosh() { noise({ dur: 0.18, vol: 0.25, filterFreq: 800 }); },

  // Error / movimiento inválido.
  error() { tone({ freq: 200, dur: 0.12, type: "sawtooth", vol: 0.3, freqEnd: 120 }); },

  // Game over (descenso triste).
  gameover() {
    tone({ freq: N.E5, dur: 0.18, type: "triangle", vol: 0.4 });
    tone({ freq: N.C5, dur: 0.18, type: "triangle", vol: 0.4, delay: 0.16 });
    tone({ freq: N.A4, dur: 0.18, type: "triangle", vol: 0.4, delay: 0.32 });
    tone({ freq: N.F4, dur: 0.4, type: "sine", vol: 0.4, delay: 0.48 });
  },

  // Victoria (fanfarria).
  win() {
    tone({ freq: N.C5, dur: 0.12, type: "square", vol: 0.4 });
    tone({ freq: N.G5, dur: 0.12, type: "square", vol: 0.4, delay: 0.12 });
    tone({ freq: N.E5, dur: 0.12, type: "square", vol: 0.4, delay: 0.24 });
    tone({ freq: N.C6, dur: 0.35, type: "square", vol: 0.45, delay: 0.36 });
  },

  // Aviso de peligro / pérdida de vida.
  hurt() { tone({ freq: 320, dur: 0.15, type: "sawtooth", vol: 0.4, freqEnd: 90 }); },
};

export type Sfx = typeof sfx;
