'use client';
import { useEffect, useRef } from 'react';
import { buildLevelFromDef, WORLD_DEFS, initWorldDefs } from './levels';
import { drawOnboard, drawButton as gkButton } from '../lib/gameKit';

// ── Constants ──────────────────────────────────────────────────────────────────
const GRAV = 1400;
const LIFE_COST = 50;
const MAX_LIVES = 10;
const JMP_V = -700;
const WALK_V = 200;
const RUN_V = 360;
const PW = 32;
const PH = 44;
const CAM_LEAD = 0.37;
const CAM_LERP = 0.10;
const COYOTE = 0.08;
const RUN_DUR = 1.5;
const DBL_MS = 300;

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = 'intro' | 'playing' | 'dead' | 'lvlDone' | 'gameOver' | 'win' | 'shop' | 'transition';
type Theme = 'green' | 'cave' | 'sky' | 'sea' | 'lava' | 'jungle' | 'cloud';

interface Platform { x: number; y: number; w: number; h: number; origX: number; dir: number; spd: number; rng: number; }
interface Enemy { id: number; type: 'spider' | 'worm' | 'monkey' | 'plant' | 'espin'; x: number; y: number; vx: number; vy: number; w: number; h: number; patL: number; patR: number; alive: boolean; stompT: number; fr: number; ft: number; baseY: number; }
interface Coin { x: number; y: number; got: boolean; }
interface Spike { x: number; y: number; w: number; }
interface Projectile { x: number; y: number; vx: number; vy: number; life: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; ml: number; col: string; r: number; }
interface TD { sx: number; sy: number; cx: number; cy: number; t: number; }

interface GS {
  phase: Phase; lv: number; lives: number; score: number; coins: number; elapsed: number;
  px: number; py: number; pvx: number; pvy: number; onG: boolean; fR: boolean;
  ps: 'idle' | 'run' | 'jump' | 'fall' | 'dead'; afr: number; aft: number;
  invT: number; coyT: number; jBuf: number;
  plats: Platform[]; ens: Enemy[]; cns: Coin[]; sps: Spike[];
  gX: number; lW: number; theme: Theme; gY: number;
  camX: number; parts: Particle[]; projs: Projectile[];
  inp: { L: boolean; R: boolean; J: boolean; };
  runT: number; ltap: { L: number; R: number; };
  tMap: Map<number, TD>;
  phT: number; msg: string; msgT: number;
  startX: number;
  ckX: number; ckY: number; ckList: number[]; nextCk: number;
  sqT: number; sqDir: number; prevOnG: boolean;
  stepT: number;
  lvlCoins: number; totalLvlCoins: number;
  stars: number[];
  // Mejoras de juego
  hitStop: number; flashT: number; flashCol: string;   // feedback de impacto
  comboT: number; comboN: number;                       // rebote en cadena
  starPowerT: number;                                   // power-up estrella
  starCoin: { x: number; y: number; got: boolean } | null;
  entryT: number; entryLock: boolean;                   // animación de entrada
  paused: boolean;                                       // pausa
  transT: number; transToLv: number;                   // transición entre mundos
  jumpStrength: number; jumpHeld: boolean; touchJump: boolean;  // salto variable
  // Wallet persistente + progresión
  owned: number[]; skin: number; streak: number; lastDay: string;
  shopMsg: string; shopMsgT: number;
}

// ── Metadata de mundos ───────────────────────────────────────────────────────
const WORLD_NAMES = ['Prados', 'Cueva', 'Cielo', 'Mar', 'Lava', 'Jungla', 'Nubes'];
const WORLD_ICONS = ['🌿', '🦇', '☁️', '🐠', '🌋', '🌴', '⚡'];
// Paletas de partículas temáticas por mundo (moneda/stomp)
const THEME_PARTS: Record<Theme, string[]> = {
  green:  ['#ffd700', '#fff', '#a5d6a7', '#66bb6a'],
  cave:   ['#ffd700', '#fff', '#ffab40', '#90a4ae'],
  sky:    ['#ffd700', '#fff', '#e1f5fe', '#90caf9'],
  sea:    ['#ffd700', '#4dd0e1', '#b2ebf2', '#e0f7fa'],
  lava:   ['#ffd700', '#ff7043', '#ffab40', '#ffca28'],
  jungle: ['#ffd700', '#a5d6a7', '#43a047', '#c5e1a5'],
  cloud:  ['#ffd700', '#fff', '#e1f5fe', '#b3e5fc'],
};

// ── Skins ────────────────────────────────────────────────────────────────────
interface Skin {
  name: string; price: number;
  hat: string; hatMid: string; hatDk: string;
  body: string; bodyMid: string; bodyDk: string;
  collar: string; collarDk: string;
}
const SKINS: Skin[] = [
  { name: 'Clásico',    price: 0,   hat: '#ffd54f', hatMid: '#f9a825', hatDk: '#e65100', body: '#ffd54f', bodyMid: '#ffc107', bodyDk: '#ff8f00', collar: '#ff8f00', collarDk: '#e65100' },
  { name: 'Ninja',      price: 200, hat: '#546e7a', hatMid: '#37474f', hatDk: '#263238', body: '#455a64', bodyMid: '#37474f', bodyDk: '#263238', collar: '#d32f2f', collarDk: '#b71c1c' },
  { name: 'Pirata',     price: 400, hat: '#8d6e63', hatMid: '#6d4c41', hatDk: '#4e342e', body: '#c62828', bodyMid: '#b71c1c', bodyDk: '#7f0000', collar: '#fdd835', collarDk: '#f9a825' },
  { name: 'Astronauta', price: 600, hat: '#eceff1', hatMid: '#cfd8dc', hatDk: '#90a4ae', body: '#eceff1', bodyMid: '#b0bec5', bodyDk: '#78909c', collar: '#29b6f6', collarDk: '#0288d1' },
];
// Color arcoíris para el power-up estrella
function rainbow(t: number): string {
  const h = Math.floor((t * 360) % 360);
  return `hsl(${h}, 90%, 60%)`;
}

// ── Fecha (racha diaria) ─────────────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function isYesterday(prev: string): boolean {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return prev === `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ── Audio (procedural, no deps) ────────────────────────────────────────────────
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
function sfxStep() {
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
function sfxJump()  { beep(300, 600, 0.11, 'sine', 0.09); }
function sfxCoin()  { beep(880, 1760, 0.09, 'sine', 0.07); }
function sfxStomp() { beep(180, 55, 0.13, 'square', 0.16); }
function sfxDie()   { beep(440, 110, 0.35, 'sawtooth', 0.12); }
function sfxLevel() {
  const ac = getAC(); if (!ac) return;
  [523, 659, 784, 1047].forEach((f, i) => {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = 'sine'; osc.frequency.value = f;
    const t = ac.currentTime + i * 0.11;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t); osc.stop(t + 0.18);
  });
}
function sfxPower() {
  const ac = getAC(); if (!ac) return;
  [660, 880, 1100, 1320, 1660].forEach((f, i) => {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = 'triangle'; osc.frequency.value = f;
    const t = ac.currentTime + i * 0.06;
    g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.start(t); osc.stop(t + 0.14);
  });
}
function sfxBuy()   { beep(520, 1040, 0.12, 'triangle', 0.10); }
function sfxCombo(n: number) { beep(500 + n * 120, 1000 + n * 200, 0.10, 'square', 0.10); }

// ── Save / load ────────────────────────────────────────────────────────────────
const SKEY = 'pixel-run-save';
interface Save { stars: number[]; best: number; coins: number; owned: number[]; skin: number; streak: number; lastDay: string; }
function loadSave(): Save {
  try {
    const d = localStorage.getItem(SKEY);
    if (d) {
      const p = JSON.parse(d);
      return {
        stars: p.stars ?? [0, 0, 0, 0, 0, 0, 0],
        best: p.best ?? 0,
        coins: p.coins ?? 0,
        owned: p.owned ?? [0],
        skin: p.skin ?? 0,
        streak: p.streak ?? 0,
        lastDay: p.lastDay ?? '',
      };
    }
  } catch {}
  return { stars: [0, 0, 0, 0, 0, 0, 0], best: 0, coins: 0, owned: [0], skin: 0, streak: 0, lastDay: '' };
}
function writeSave(gs: GS) {
  try {
    const s = loadSave();
    localStorage.setItem(SKEY, JSON.stringify({
      stars: gs.stars.map((v, i) => Math.max(v, s.stars[i] ?? 0)),
      best: Math.max(gs.score, s.best),
      coins: gs.coins,
      owned: gs.owned,
      skin: gs.skin,
      streak: gs.streak,
      lastDay: gs.lastDay,
    }));
  } catch {}
}

// ── Particles ──────────────────────────────────────────────────────────────────
function spawnParticles(gs: GS, x: number, y: number, baseColor: string, count: number, palette?: string[]) {
  const colors = palette ?? [baseColor, '#fff', '#ffd700', '#ff6b6b'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const spd = 80 + Math.random() * 180;
    gs.parts.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 60,
      life: 0.5 + Math.random() * 0.4,
      ml: 0.9,
      col: colors[Math.floor(Math.random() * colors.length)],
      r: 3 + Math.random() * 4,
    });
  }
}

// ── initGS ─────────────────────────────────────────────────────────────────────
function initGS(cw: number, ch: number): GS {
  const gY = ch - 70;
  const sv = loadSave();
  const gs: GS = {
    phase: 'intro', lv: 0, lives: 3, score: 0, coins: sv.coins, elapsed: 0,
    px: 80, py: gY - PH, pvx: 0, pvy: 0, onG: false, fR: true,
    ps: 'idle', afr: 0, aft: 0,
    invT: 0, coyT: 0, jBuf: 0,
    plats: [], ens: [], cns: [], sps: [],
    gX: 0, lW: 0, theme: 'green', gY,
    camX: 0, parts: [], projs: [],
    inp: { L: false, R: false, J: false },
    runT: 0, ltap: { L: 0, R: 0 },
    tMap: new Map(),
    phT: 0, msg: '', msgT: 0,
    startX: 80,
    ckX: 80, ckY: gY - PH, ckList: [], nextCk: 0,
    sqT: 0, sqDir: 0, prevOnG: false, stepT: 0,
    lvlCoins: 0, totalLvlCoins: 0,
    stars: Array.from({ length: 7 }, (_, i) => sv.stars[i] ?? 0),
    hitStop: 0, flashT: 0, flashCol: '#fff',
    comboT: 0, comboN: 0,
    starPowerT: 0, starCoin: null,
    entryT: 0, entryLock: false,
    paused: false,
    transT: 0, transToLv: 0,
    jumpStrength: 1, jumpHeld: false, touchJump: false,
    owned: sv.owned, skin: sv.skin, streak: sv.streak, lastDay: sv.lastDay,
    shopMsg: '', shopMsgT: 0,
  };
  // Racha diaria: al abrir el juego
  const today = todayStr();
  if (gs.lastDay !== today) {
    gs.streak = isYesterday(gs.lastDay) ? gs.streak + 1 : 1;
    gs.lastDay = today;
    // Bonus por hitos
    if (gs.streak === 3) { gs.coins += 50; gs.shopMsg = '🔥 Racha 3 días: +50'; gs.shopMsgT = 4; }
    else if (gs.streak === 7) { gs.coins += 150; gs.shopMsg = '🔥 Racha 7 días: +150'; gs.shopMsgT = 4; }
    else if (gs.streak === 14) { gs.coins += 500; gs.shopMsg = '🔥 Racha 14 días: +500'; gs.shopMsgT = 4; }
    writeSave(gs);
  }
  return gs;
}

function loadLevel(gs: GS, lv: number, ch: number) {
  const g = gs.gY;
  const def = WORLD_DEFS[Math.min(lv, WORLD_DEFS.length - 1)];
  const data = buildLevelFromDef(def, g);
  gs.lv = lv;
  gs.plats = data.plats;
  gs.ens = data.ens;
  gs.cns = data.cns;
  gs.sps = data.sps;
  gs.gX = data.gX;
  gs.lW = data.lW;
  gs.theme = data.theme as Theme;
  gs.startX = data.startX;
  gs.px = data.startX;
  gs.py = g - PH;
  gs.pvx = 0; gs.pvy = 0;
  gs.onG = false; gs.fR = true;
  gs.ps = 'idle'; gs.afr = 0; gs.aft = 0;
  gs.camX = 0;
  gs.parts = []; gs.projs = [];
  gs.invT = 0; gs.coyT = 0;
  gs.inp = { L: false, R: false, J: false };
  gs.runT = 0;
  gs.ckX = data.startX; gs.ckY = g - PH; gs.ckList = data.checks; gs.nextCk = 0;
  gs.sqT = 0; gs.sqDir = 0; gs.prevOnG = false; gs.stepT = 0;
  gs.lvlCoins = 0; gs.totalLvlCoins = data.cns.length;
  // Reset mejoras
  gs.comboT = 0; gs.comboN = 0;
  gs.starPowerT = 0;
  gs.hitStop = 0; gs.flashT = 0;
  // Animación de entrada: el personaje cae desde arriba
  gs.py = g - PH - 260;
  gs.pvy = 0;
  gs.entryT = 1.4; gs.entryLock = true;
  // Power-up estrella: la moneda más cercana al centro del nivel se vuelve especial
  gs.starCoin = null;
  if (data.cns.length > 0) {
    const mid = data.lW / 2;
    let best = data.cns[0], bd = Infinity;
    for (const c of data.cns) { const d2 = Math.abs(c.x - mid); if (d2 < bd) { bd = d2; best = c; } }
    // marcar esa moneda como recogida y crear la estrella en su lugar (un poco más alta)
    best.got = true;
    gs.totalLvlCoins = data.cns.length - 1;
    gs.starCoin = { x: best.x, y: best.y - 24, got: false };
  }
}

function respawn(gs: GS) {
  gs.px = gs.ckX;
  gs.py = gs.ckY;
  gs.pvx = 0; gs.pvy = 0;
  gs.onG = false; gs.fR = true;
  gs.ps = 'idle';
  gs.phase = 'playing';
  gs.camX = Math.max(0, gs.ckX - 180);
  gs.invT = 2.0;
  gs.sqT = 0;
}

function loseLife(gs: GS) {
  if (gs.invT > 0 || gs.starPowerT > 0) return;
  gs.lives--;
  gs.invT = 2.0;
  gs.comboT = 0; gs.comboN = 0;
  gs.flashT = 0.14; gs.flashCol = '#fff';   // flash blanco
  gs.hitStop = 0.09;                          // hit-stop
  sfxDie();
  spawnParticles(gs, gs.px + PW / 2, gs.py + PH / 2, '#e53935', 12);
  if (gs.lives <= 0) {
    writeSave(gs);   // persistir monedas al perder
    gs.phase = 'gameOver';
  } else {
    gs.phase = 'dead';
    gs.phT = 1.5;
    gs.ps = 'dead';
    gs.pvy = -350;
  }
}

// ── Drawing ────────────────────────────────────────────────────────────────────
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.8, y - r * 0.3, r * 0.65, 0, Math.PI * 2);
  ctx.arc(x - r * 0.7, y - r * 0.2, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x + r * 1.5, y + r * 0.1, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

function drawBackground(ctx: CanvasRenderingContext2D, cw: number, ch: number, theme: Theme, camX: number, t: number) {
  if (theme === 'green') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0d47a1');
    grad.addColorStop(0.45, '#1976d2');
    grad.addColorStop(0.75, '#64b5f6');
    grad.addColorStop(1, '#bbdefb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Sun
    const sunX = cw * 0.82, sunY = ch * 0.14;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 55);
    sunGrad.addColorStop(0, '#fff9c4');
    sunGrad.addColorStop(0.4, '#ffee58');
    sunGrad.addColorStop(1, 'rgba(255,238,88,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath(); ctx.arc(sunX, sunY, 55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,238,88,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.3;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(a) * 26, sunY + Math.sin(a) * 26);
      ctx.lineTo(sunX + Math.cos(a) * 44, sunY + Math.sin(a) * 44);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // Far hills layer 1
    const h1Off = -(camX * 0.15) % (cw + 600);
    ctx.fillStyle = '#1b5e20';
    for (let i = -1; i <= 2; i++) {
      const hx = h1Off + i * (cw + 600);
      ctx.beginPath();
      ctx.moveTo(hx, ch * 0.80);
      ctx.bezierCurveTo(hx + 150, ch * 0.60, hx + 300, ch * 0.62, hx + 450, ch * 0.78);
      ctx.bezierCurveTo(hx + 600, ch * 0.55, hx + 750, ch * 0.58, hx + 900, ch * 0.78);
      ctx.lineTo(hx + cw + 600, ch * 0.80);
      ctx.lineTo(hx + cw + 600, ch); ctx.lineTo(hx, ch);
      ctx.closePath(); ctx.fill();
    }
    // Far hills layer 2
    const h2Off = -(camX * 0.25) % (cw + 500);
    ctx.fillStyle = '#2e7d32';
    for (let i = -1; i <= 2; i++) {
      const hx = h2Off + i * (cw + 500);
      ctx.beginPath();
      ctx.moveTo(hx, ch * 0.82);
      ctx.bezierCurveTo(hx + 120, ch * 0.65, hx + 240, ch * 0.67, hx + 380, ch * 0.82);
      ctx.bezierCurveTo(hx + 500, ch * 0.62, hx + 640, ch * 0.65, hx + 780, ch * 0.82);
      ctx.lineTo(hx + cw + 500, ch * 0.82);
      ctx.lineTo(hx + cw + 500, ch); ctx.lineTo(hx, ch);
      ctx.closePath(); ctx.fill();
    }

    // Clouds (0.3x) with shadows
    const cloudDefs = [80, 300, 550, 820, 1100, 1380, 1660, 1940, 2230, 2530];
    cloudDefs.forEach((cx, i) => {
      const r = 30 + (i % 3) * 13;
      const cy = 38 + (i % 4) * 24;
      const screenX = ((cx - camX * 0.3) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      ctx.fillStyle = 'rgba(120,170,220,0.3)';
      drawCloud(ctx, screenX + 5, cy + 6, r * 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      drawCloud(ctx, screenX, cy, r);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(screenX - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    });

  } else if (theme === 'cave') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0d0208');
    grad.addColorStop(0.5, '#1a0a10');
    grad.addColorStop(1, '#2d1510');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Crystal clusters (0.15x)
    const crystalDefs = [100, 350, 600, 850, 1100, 1400, 1700, 2000];
    crystalDefs.forEach((cx, i) => {
      const screenX = ((cx - camX * 0.15) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      const h2 = 30 + (i % 3) * 15;
      const alpha = 0.12 + (i % 3) * 0.06;
      ctx.fillStyle = `rgba(100,60,180,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(screenX - 8, ch * 0.72); ctx.lineTo(screenX, ch * 0.72 - h2); ctx.lineTo(screenX + 8, ch * 0.72);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(screenX + 3, ch * 0.72); ctx.lineTo(screenX + 12, ch * 0.72 - h2 * 0.7); ctx.lineTo(screenX + 18, ch * 0.72);
      ctx.closePath(); ctx.fill();
    });

    // Stalactites (0.25x)
    const sOff = -(camX * 0.25);
    const stalDefs = [60, 170, 290, 430, 560, 700, 840, 990, 1130, 1270, 1420, 1570];
    stalDefs.forEach((sx2, i) => {
      const sw = 20 + (i % 3) * 10;
      const sh = 55 + (i % 4) * 28;
      const screenX = ((sx2 + sOff) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      const stalGrad = ctx.createLinearGradient(screenX - sw / 2, 0, screenX + sw / 2, sh);
      stalGrad.addColorStop(0, '#3d2010'); stalGrad.addColorStop(0.5, '#5d3020'); stalGrad.addColorStop(1, '#3d2010');
      ctx.fillStyle = stalGrad;
      ctx.beginPath();
      ctx.moveTo(screenX - sw / 2, 0); ctx.lineTo(screenX + sw / 2, 0);
      ctx.lineTo(screenX + 2, sh); ctx.lineTo(screenX - 2, sh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,180,120,0.15)';
      ctx.fillRect(screenX - 2, 0, 4, sh * 0.6);
    });

    // Torches (0.5x)
    const torchDefs = [200, 550, 900, 1250, 1600, 1950, 2300];
    torchDefs.forEach((tx) => {
      const screenX = tx - camX * 0.5;
      if (screenX < -150 || screenX > cw + 150) return;
      const flicker = 1 + Math.sin(t * 9 + tx * 0.01) * 0.22;
      const gr1 = ctx.createRadialGradient(screenX, ch * 0.60, 0, screenX, ch * 0.60, 120 * flicker);
      gr1.addColorStop(0, 'rgba(255,120,20,0.22)'); gr1.addColorStop(0.5, 'rgba(255,60,0,0.10)'); gr1.addColorStop(1, 'rgba(255,20,0,0)');
      ctx.fillStyle = gr1; ctx.fillRect(screenX - 130, ch * 0.30, 260, 260);
      const gr2 = ctx.createRadialGradient(screenX, ch * 0.62, 0, screenX, ch * 0.62, 20);
      gr2.addColorStop(0, 'rgba(255,220,80,0.7)'); gr2.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = gr2; ctx.fillRect(screenX - 25, ch * 0.52, 50, 50);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(screenX - 4, ch * 0.62, 8, 16);
      ctx.fillStyle = '#ffa000';
      const fH = 10 + Math.sin(t * 12 + tx) * 3;
      ctx.beginPath();
      ctx.moveTo(screenX - 5, ch * 0.62); ctx.lineTo(screenX + 5, ch * 0.62); ctx.lineTo(screenX, ch * 0.62 - fH);
      ctx.closePath(); ctx.fill();
    });

  } else if (theme === 'sky') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#4fc3f7');
    grad.addColorStop(0.35, '#b3e5fc');
    grad.addColorStop(0.7, '#e1f5fe');
    grad.addColorStop(1, '#fff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Twinkling stars
    const starDefs = [50,130,210,310,420,530,660,770,880,980,1100,1220,1350,1490,1640,1810];
    starDefs.forEach((sx2, i) => {
      const screenX = ((sx2 - camX * 0.05) % (cw + 100) + cw + 100) % (cw + 100) - 50;
      const sy = 20 + (i % 6) * 18;
      ctx.globalAlpha = (0.3 + Math.abs(Math.sin(t * 2 + i * 1.3)) * 0.7) * 0.6;
      ctx.fillStyle = '#fff'; ctx.fillRect(screenX, sy, 2, 2);
      ctx.globalAlpha = 1;
    });

    // Distant islands (0.2x)
    const islandDefs = [200, 700, 1300, 1900, 2600, 3300, 4000];
    islandDefs.forEach((ix, i) => {
      const screenX = ((ix - camX * 0.2) % (cw + 500) + cw + 500) % (cw + 500) - 250;
      const iy = ch * (0.30 + (i % 3) * 0.07);
      const iw = 110 + i * 8;
      ctx.fillStyle = 'rgba(50,100,50,0.2)';
      ctx.beginPath(); ctx.ellipse(screenX + 6, iy + 8, iw / 2 - 5, 14, 0, 0, Math.PI * 2); ctx.fill();
      const isGrad = ctx.createLinearGradient(screenX - iw/2, iy - 18, screenX + iw/2, iy + 18);
      isGrad.addColorStop(0, 'rgba(76,175,80,0.50)'); isGrad.addColorStop(1, 'rgba(33,150,83,0.35)');
      ctx.fillStyle = isGrad;
      ctx.beginPath(); ctx.ellipse(screenX, iy, iw / 2, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(129,199,132,0.40)';
      ctx.beginPath(); ctx.ellipse(screenX, iy - 8, iw / 2 - 12, 10, 0, 0, Math.PI * 2); ctx.fill();
    });

    // Clouds (0.4x)
    const cloudDefs = [60, 280, 520, 780, 1060, 1360, 1680, 2020];
    cloudDefs.forEach((cx, i) => {
      const r = 38 + (i % 3) * 16;
      const cy = ch * 0.12 + (i % 4) * 30;
      const screenX = ((cx - camX * 0.4) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      ctx.fillStyle = 'rgba(200,230,255,0.35)';
      drawCloud(ctx, screenX + 6, cy + 8, r * 0.85);
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      drawCloud(ctx, screenX, cy, r);
    });

  } else if (theme === 'sea') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#006064');
    grad.addColorStop(0.4, '#00838f');
    grad.addColorStop(0.8, '#00acc1');
    grad.addColorStop(1, '#b2ebf2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const rx = (cw * 0.1 + i * cw * 0.16 - (camX * 0.1) % cw + cw * 2) % (cw * 1.5) - cw * 0.25;
      const rayGrad = ctx.createLinearGradient(rx, 0, rx + 40, ch * 0.7);
      rayGrad.addColorStop(0, 'rgba(178,235,242,0.22)');
      rayGrad.addColorStop(1, 'rgba(178,235,242,0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rx - 20, 0); ctx.lineTo(rx + 60, 0);
      ctx.lineTo(rx + 80 + Math.sin(t * 0.5 + i) * 20, ch * 0.7);
      ctx.lineTo(rx - 40 + Math.sin(t * 0.5 + i) * 20, ch * 0.7);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const bubbleDefs = [80,180,290,420,560,700,860,1020,1200,1380,1570,1770,1990];
    bubbleDefs.forEach((bx2, i) => {
      const screenX = ((bx2 - camX * 0.4) % (cw + 200) + cw + 200) % (cw + 200) - 100;
      const by2 = ((ch * 0.9 - (t * (25 + i % 4 * 8) + i * 60)) % ch + ch) % ch;
      const br = 3 + (i % 3) * 2;
      ctx.strokeStyle = `rgba(178,235,242,${0.3 + (i % 3) * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(screenX, by2, br, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(224,247,250,0.12)`; ctx.fill();
    });
    ctx.lineWidth = 1;
    const coralDefs = [60,180,320,480,640,820,1010,1220,1450,1700];
    coralDefs.forEach((cx2, i) => {
      const screenX = ((cx2 - camX * 0.5) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      const ch2 = 30 + (i % 4) * 18;
      const col = i % 3 === 0 ? 'rgba(244,81,30,0.45)' : i % 3 === 1 ? 'rgba(156,39,176,0.40)' : 'rgba(255,152,0,0.40)';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(screenX, ch * 0.88); ctx.lineTo(screenX - 4, ch * 0.88 - ch2); ctx.lineTo(screenX + 4, ch * 0.88 - ch2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(screenX - 6, ch * 0.88 - ch2 * 0.5); ctx.lineTo(screenX - 14, ch * 0.88 - ch2 * 0.8); ctx.lineTo(screenX - 8, ch * 0.88 - ch2 * 0.8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(screenX + 6, ch * 0.88 - ch2 * 0.4); ctx.lineTo(screenX + 14, ch * 0.88 - ch2 * 0.75); ctx.lineTo(screenX + 8, ch * 0.88 - ch2 * 0.75); ctx.closePath(); ctx.fill();
    });
    const fishDefs = [200,500,900,1400,1900,2500];
    fishDefs.forEach((fx, i) => {
      const screenX = ((fx - camX * 0.3) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      const fy = ch * 0.25 + (i % 4) * ch * 0.12;
      const fSwim = Math.sin(t * 2 + i) * 8;
      ctx.fillStyle = `rgba(0,96,100,0.25)`;
      ctx.beginPath(); ctx.ellipse(screenX + fSwim, fy, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(screenX + fSwim - 18, fy); ctx.lineTo(screenX + fSwim - 28, fy - 8); ctx.lineTo(screenX + fSwim - 28, fy + 8); ctx.closePath(); ctx.fill();
    });

  } else if (theme === 'lava') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0d0000'); grad.addColorStop(0.4, '#1a0000');
    grad.addColorStop(0.8, '#3d0000'); grad.addColorStop(1, '#6d1c00');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    const lavaDefs = [150, 450, 780, 1120, 1480, 1860, 2260];
    lavaDefs.forEach((lx, i) => {
      const screenX = ((lx - camX * 0.2) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      const flicker = 1 + Math.sin(t * 4 + i * 1.3) * 0.25;
      const lg = ctx.createRadialGradient(screenX, ch * 0.82, 0, screenX, ch * 0.82, 80 * flicker);
      lg.addColorStop(0, 'rgba(255,87,34,0.45)'); lg.addColorStop(0.5, 'rgba(244,67,54,0.20)'); lg.addColorStop(1, 'rgba(183,28,28,0)');
      ctx.fillStyle = lg; ctx.fillRect(screenX - 90, ch * 0.55, 180, ch * 0.5);
    });
    const smokeDefs = [100, 350, 620, 900, 1200, 1550, 1930];
    smokeDefs.forEach((sx2, i) => {
      const screenX = ((sx2 - camX * 0.35) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      for (let s = 0; s < 4; s++) {
        const sy = ch * 0.78 - ((t * 30 + s * 55 + i * 80) % (ch * 0.75));
        const alpha = Math.max(0, 0.12 - s * 0.025);
        ctx.fillStyle = `rgba(80,60,60,${alpha})`;
        ctx.beginPath(); ctx.arc(screenX + Math.sin(t * 0.8 + s) * 10, sy, 12 + s * 8, 0, Math.PI * 2); ctx.fill();
      }
    });
    for (let i = 0; i < 18; i++) {
      const ex = (((i * 137 + camX * 0.6) % (cw + 100) + cw + 100)) % (cw + 100) - 50;
      const ey2 = ((t * (20 + i % 5 * 12) + i * 80) % (ch * 0.85));
      const alpha = 0.4 + Math.sin(t * 5 + i) * 0.3;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,160,0,${alpha})` : `rgba(255,87,34,${alpha})`;
      ctx.beginPath(); ctx.arc(ex, ey2, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    const crackGrad = ctx.createLinearGradient(0, ch * 0.82, 0, ch);
    crackGrad.addColorStop(0, 'rgba(255,87,34,0.35)'); crackGrad.addColorStop(0.4, 'rgba(244,67,54,0.20)'); crackGrad.addColorStop(1, 'rgba(183,28,28,0.10)');
    ctx.fillStyle = crackGrad; ctx.fillRect(0, ch * 0.82, cw, ch * 0.18);

  } else if (theme === 'jungle') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0a1f0a'); grad.addColorStop(0.3, '#1b3a1b');
    grad.addColorStop(0.7, '#2d5a2d'); grad.addColorStop(1, '#1a3d1a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const bx2 = cw * 0.08 + i * cw * 0.22 - (camX * 0.15) % (cw * 1.2);
      const beamG = ctx.createLinearGradient(bx2, 0, bx2 + 30, ch * 0.65);
      beamG.addColorStop(0, 'rgba(255,235,180,0.10)'); beamG.addColorStop(1, 'rgba(255,235,180,0)');
      ctx.fillStyle = beamG;
      ctx.beginPath(); ctx.moveTo(bx2 - 10, 0); ctx.lineTo(bx2 + 40, 0); ctx.lineTo(bx2 + 70, ch * 0.65); ctx.lineTo(bx2 - 30, ch * 0.65); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const treeDefs = [80, 240, 420, 620, 840, 1100, 1400, 1740, 2120, 2550];
    treeDefs.forEach((tx, i) => {
      const screenX = ((tx - camX * 0.15) % (cw + 500) + cw + 500) % (cw + 500) - 250;
      const tw = 18 + (i % 3) * 8;
      const th2 = ch * 0.5 + (i % 4) * ch * 0.06;
      ctx.fillStyle = 'rgba(30,15,8,0.6)';
      ctx.fillRect(screenX - tw / 4, ch * 0.5, tw / 2, ch * 0.5);
      ctx.fillStyle = `rgba(${20 + i % 3 * 10},${60 + i % 4 * 15},${20 + i % 3 * 8},0.55)`;
      ctx.beginPath(); ctx.ellipse(screenX, ch * 0.5 - th2 * 0.1, tw * 1.8, th2 * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(screenX - tw * 0.8, ch * 0.5 - th2 * 0.05, tw * 1.2, th2 * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(screenX + tw * 0.9, ch * 0.5 - th2 * 0.05, tw * 1.3, th2 * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    });
    const vineDefs = [100, 280, 480, 700, 950, 1240, 1570, 1950, 2380];
    vineDefs.forEach((vx, i) => {
      const screenX = ((vx - camX * 0.4) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      const vl = 60 + (i % 4) * 40;
      const sway = Math.sin(t * 1.2 + i * 0.9) * 8;
      ctx.strokeStyle = 'rgba(56,142,60,0.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(screenX, 0);
      ctx.bezierCurveTo(screenX + sway * 0.5, vl * 0.3, screenX + sway, vl * 0.7, screenX + sway * 0.8, vl);
      ctx.stroke();
      [0.25, 0.55, 0.85].forEach(pos => {
        ctx.fillStyle = 'rgba(76,175,80,0.4)';
        ctx.beginPath(); ctx.ellipse(screenX + sway * pos + Math.sin(pos * 5) * 6, vl * pos, 8, 4, pos * Math.PI, 0, Math.PI * 2); ctx.fill();
      });
      ctx.lineWidth = 1;
    });
    const mistG = ctx.createLinearGradient(0, ch * 0.72, 0, ch * 0.88);
    mistG.addColorStop(0, 'rgba(200,230,200,0)'); mistG.addColorStop(0.5, 'rgba(200,230,200,0.06)'); mistG.addColorStop(1, 'rgba(200,230,200,0)');
    ctx.fillStyle = mistG; ctx.fillRect(0, ch * 0.72, cw, ch * 0.16);

  } else if (theme === 'cloud') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#1565c0'); grad.addColorStop(0.35, '#42a5f5');
    grad.addColorStop(0.65, '#b3e5fc'); grad.addColorStop(1, '#e1f5fe');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    const starDefs2 = [40,100,175,265,375,490,620,760,920,1100,1300,1520,1760,2020,2310];
    starDefs2.forEach((sx2, i) => {
      const screenX = ((sx2 - camX * 0.04) % (cw + 100) + cw + 100) % (cw + 100) - 50;
      const sy2 = 12 + (i % 5) * 16;
      const blink = 0.2 + Math.abs(Math.sin(t * 2.5 + i * 1.7)) * 0.6;
      ctx.globalAlpha = blink; ctx.fillStyle = '#fff'; ctx.fillRect(screenX, sy2, 2, 2); ctx.globalAlpha = 1;
    });
    const bankOff = -(camX * 0.15);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = -1; i <= 2; i++) {
      const bx2 = bankOff + i * (cw + 300);
      ctx.beginPath();
      for (let bxi = 0; bxi < cw + 320; bxi += 48) {
        const bby = ch * 0.72 - Math.sin((bxi + t * 15) * 0.025) * 14;
        ctx.arc(bx2 + bxi, bby, 28, Math.PI, 0);
      }
      ctx.lineTo(bx2 + cw + 320, ch); ctx.lineTo(bx2, ch); ctx.closePath(); ctx.fill();
    }
    const midClouds = [60, 250, 480, 740, 1040, 1380, 1760, 2200];
    midClouds.forEach((cx2, i) => {
      const r = 32 + (i % 3) * 12;
      const cy2 = ch * 0.18 + (i % 4) * 30;
      const screenX = ((cx2 - camX * 0.35) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      ctx.fillStyle = 'rgba(220,240,255,0.40)'; drawCloud(ctx, screenX + 5, cy2 + 5, r * 0.85);
      ctx.fillStyle = 'rgba(255,255,255,0.80)'; drawCloud(ctx, screenX, cy2, r);
    });
    if (Math.sin(t * 0.7) > 0.97) {
      ctx.fillStyle = 'rgba(200,220,255,0.12)'; ctx.fillRect(0, 0, cw, ch);
      const lx = cw * 0.5 + Math.sin(t * 100) * cw * 0.3;
      ctx.strokeStyle = 'rgba(200,220,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, ch * 0.1); ctx.lineTo(lx - 10, ch * 0.35); ctx.lineTo(lx + 5, ch * 0.35); ctx.lineTo(lx - 15, ch * 0.6); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, camX: number, theme: Theme) {
  const sx = p.x - camX;
  if (sx + p.w < -10 || sx > ctx.canvas.width + 10) return;

  const isMoving = p.spd > 0;

  if (theme === 'green') {
    const dGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    dGrad.addColorStop(0, '#8d6e63'); dGrad.addColorStop(0.3, '#795548'); dGrad.addColorStop(1, '#4e342e');
    ctx.fillStyle = dGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const gGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + 10);
    gGrad.addColorStop(0, '#81c784'); gGrad.addColorStop(0.5, '#4caf50'); gGrad.addColorStop(1, '#388e3c');
    ctx.fillStyle = gGrad; ctx.fillRect(sx, p.y, p.w, 8);
    ctx.fillStyle = '#a5d6a7';
    for (let i = 4; i < p.w - 4; i += 16) ctx.fillRect(sx + i, p.y, 4, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(sx, p.y + 8, 3, p.h - 8); ctx.fillRect(sx + p.w - 3, p.y + 8, 3, p.h - 8);
    ctx.fillStyle = 'rgba(100,60,40,0.4)';
    for (let i = 0; i < Math.floor(p.w / 30); i++) ctx.fillRect(sx + 10 + i * 28, p.y + 14, 4, 3);

  } else if (theme === 'cave') {
    const sGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    sGrad.addColorStop(0, '#607d8b'); sGrad.addColorStop(0.4, '#546e7a'); sGrad.addColorStop(1, '#37474f');
    ctx.fillStyle = sGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const tGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + 6);
    tGrad.addColorStop(0, '#78909c'); tGrad.addColorStop(1, '#546e7a');
    ctx.fillStyle = tGrad; ctx.fillRect(sx, p.y, p.w, 6);
    ctx.strokeStyle = 'rgba(38,50,56,0.6)'; ctx.lineWidth = 1;
    const brickH = 14;
    for (let row = 0; row * brickH < p.h; row++) {
      const by = p.y + row * brickH;
      ctx.beginPath(); ctx.moveTo(sx, by); ctx.lineTo(sx + p.w, by); ctx.stroke();
      const offset = (row % 2) * 20;
      for (let bx = offset; bx < p.w; bx += 40) {
        ctx.beginPath(); ctx.moveTo(sx + bx, by); ctx.lineTo(sx + bx, by + brickH); ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(56,142,60,0.35)';
    for (let i = 0; i < Math.floor(p.w / 40); i++) {
      ctx.beginPath(); ctx.ellipse(sx + 8 + i * 38, p.y + 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(sx, p.y, 2, p.h);

  } else if (theme === 'sky') {
    const cGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    cGrad.addColorStop(0, '#fff'); cGrad.addColorStop(0.4, '#e3f2fd'); cGrad.addColorStop(1, '#bbdefb');
    ctx.fillStyle = cGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.fillStyle = '#fff';
    const puffStep = 24;
    for (let px2 = 0; px2 < p.w; px2 += puffStep) {
      ctx.beginPath(); ctx.arc(sx + px2 + puffStep / 2, p.y - 2, puffStep * 0.45, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx + 2, p.y, p.w - 4, 3);
    ctx.fillStyle = 'rgba(100,160,200,0.25)'; ctx.fillRect(sx, p.y + p.h - 4, p.w, 4);

  } else if (theme === 'sea') {
    const seaGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    seaGrad.addColorStop(0, '#00838f'); seaGrad.addColorStop(0.3, '#006064'); seaGrad.addColorStop(1, '#004d40');
    ctx.fillStyle = seaGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const topG = ctx.createLinearGradient(sx, p.y, sx, p.y + 8);
    topG.addColorStop(0, '#f48fb1'); topG.addColorStop(0.5, '#e91e63'); topG.addColorStop(1, '#ad1457');
    ctx.fillStyle = topG; ctx.fillRect(sx, p.y, p.w, 7);
    ctx.fillStyle = '#f48fb1';
    for (let i = 6; i < p.w - 4; i += 14) { ctx.beginPath(); ctx.arc(sx + i, p.y, 4, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx, p.y + 8, 3, p.h - 8);
    ctx.strokeStyle = 'rgba(0,188,212,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < Math.floor(p.w / 35); i++) {
      const wx = sx + 10 + i * 32;
      ctx.beginPath(); ctx.moveTo(wx, p.y + p.h); ctx.quadraticCurveTo(wx + 5, p.y + p.h * 0.5, wx, p.y + 8); ctx.stroke();
    }
    ctx.lineWidth = 1;

  } else if (theme === 'lava') {
    const lavaRockGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    lavaRockGrad.addColorStop(0, '#4e342e'); lavaRockGrad.addColorStop(0.35, '#3e2723'); lavaRockGrad.addColorStop(1, '#1a0000');
    ctx.fillStyle = lavaRockGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const lavaTopG = ctx.createLinearGradient(sx, p.y, sx, p.y + 6);
    lavaTopG.addColorStop(0, '#ff5722'); lavaTopG.addColorStop(0.6, '#bf360c'); lavaTopG.addColorStop(1, '#3e2723');
    ctx.fillStyle = lavaTopG; ctx.fillRect(sx, p.y, p.w, 6);
    ctx.fillStyle = 'rgba(255,152,0,0.5)';
    for (let i = 8; i < p.w - 4; i += 22) { ctx.fillRect(sx + i, p.y + 1, 6, 2); }
    ctx.strokeStyle = 'rgba(255,87,34,0.30)'; ctx.lineWidth = 0.8;
    for (let i = 1; i < Math.floor(p.w / 30); i++) {
      const cx2 = sx + i * 28;
      ctx.beginPath(); ctx.moveTo(cx2, p.y + 6); ctx.lineTo(cx2 + 4, p.y + 18); ctx.stroke();
    }
    ctx.lineWidth = 1;
    const edgeG = ctx.createLinearGradient(sx, p.y, sx + 3, p.y);
    edgeG.addColorStop(0, 'rgba(255,87,34,0.25)'); edgeG.addColorStop(1, 'rgba(255,87,34,0)');
    ctx.fillStyle = edgeG; ctx.fillRect(sx, p.y + 6, 3, p.h - 6);
    const edgeG2 = ctx.createLinearGradient(sx + p.w - 3, p.y, sx + p.w, p.y);
    edgeG2.addColorStop(0, 'rgba(255,87,34,0)'); edgeG2.addColorStop(1, 'rgba(255,87,34,0.25)');
    ctx.fillStyle = edgeG2; ctx.fillRect(sx + p.w - 3, p.y + 6, 3, p.h - 6);

  } else if (theme === 'jungle') {
    const barkGrad = ctx.createLinearGradient(sx, p.y, sx + p.w, p.y + p.h);
    barkGrad.addColorStop(0, '#6d4c41'); barkGrad.addColorStop(0.4, '#5d4037'); barkGrad.addColorStop(1, '#4e342e');
    ctx.fillStyle = barkGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const mossG = ctx.createLinearGradient(sx, p.y, sx, p.y + 9);
    mossG.addColorStop(0, '#81c784'); mossG.addColorStop(0.5, '#4caf50'); mossG.addColorStop(1, '#2e7d32');
    ctx.fillStyle = mossG; ctx.fillRect(sx, p.y, p.w, 8);
    ctx.fillStyle = '#a5d6a7';
    for (let i = 3; i < p.w - 3; i += 11) { ctx.beginPath(); ctx.arc(sx + i + 3, p.y, 4, Math.PI, 0); ctx.fill(); }
    ctx.strokeStyle = 'rgba(60,30,10,0.3)'; ctx.lineWidth = 0.8;
    for (let i = 1; i < Math.floor(p.w / 24); i++) {
      const lx = sx + i * 22;
      ctx.beginPath(); ctx.moveTo(lx, p.y + 8); ctx.lineTo(lx + 2, p.y + p.h); ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(76,175,80,0.50)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx + 8, p.y + p.h); ctx.quadraticCurveTo(sx + 4, p.y + p.h + 16, sx + 10, p.y + p.h + 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + p.w - 8, p.y + p.h); ctx.quadraticCurveTo(sx + p.w - 4, p.y + p.h + 12, sx + p.w - 12, p.y + p.h + 26); ctx.stroke();
    ctx.lineWidth = 1;

  } else if (theme === 'cloud') {
    const cloudPlatGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    cloudPlatGrad.addColorStop(0, '#ffffff'); cloudPlatGrad.addColorStop(0.3, '#e3f2fd'); cloudPlatGrad.addColorStop(1, '#bbdefb');
    ctx.fillStyle = cloudPlatGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.fillStyle = '#fff';
    const puffStep2 = 28;
    for (let px2 = 0; px2 < p.w + puffStep2; px2 += puffStep2) {
      ctx.beginPath(); ctx.arc(sx + px2, p.y - 3, puffStep2 * 0.52, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let px2 = puffStep2 / 2; px2 < p.w; px2 += puffStep2) {
      ctx.beginPath(); ctx.arc(sx + px2, p.y + 2, puffStep2 * 0.32, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(100,160,255,0.15)'; ctx.fillRect(sx, p.y + p.h - 3, p.w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(sx + 2, p.y, p.w - 4, 2);
  }

  // Overlay visual para plataformas móviles
  if (isMoving) {
    // Borde naranja pulsante
    ctx.strokeStyle = 'rgba(255,152,0,0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, p.y + 1, p.w - 2, p.h - 2);
    ctx.lineWidth = 1;
    // Flechas ◄ ► indicando movimiento
    ctx.fillStyle = 'rgba(255,200,60,0.80)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◄ ►', sx + p.w / 2, p.y + p.h * 0.62);
    ctx.textAlign = 'left';
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS, camX: number) {
  if (gs.invT > 0 && Math.floor(gs.elapsed * 8) % 2 === 0) return;

  const cx = gs.px - camX + PW / 2;
  const by = gs.py + PH;
  const fr = gs.afr;
  const ps = gs.ps;

  // Skin activo (o arcoíris si tiene power-up estrella)
  const sk = SKINS[gs.skin] ?? SKINS[0];
  const rb = gs.starPowerT > 0;
  const rc = (o: number) => rainbow(gs.elapsed * 1.5 + o);
  const cBody = rb ? rc(0) : sk.body, cBodyMid = rb ? rc(0.08) : sk.bodyMid, cBodyDk = rb ? rc(0.16) : sk.bodyDk;
  const cHat = rb ? rc(0.3) : sk.hat, cHatMid = rb ? rc(0.36) : sk.hatMid, cHatDk = rb ? rc(0.42) : sk.hatDk;
  const cCollar = rb ? rc(0.5) : sk.collar, cCollarDk = rb ? rc(0.56) : sk.collarDk;

  const legSwing = ps === 'run' ? (fr === 0 ? 3 : -3) : 0;
  const armY = ps === 'run' ? (fr === 0 ? 3 : -3) : (ps === 'jump' ? -6 : 0);

  let sqX = 1, sqY = 1;
  if (gs.sqT > 0) {
    const t = gs.sqT / 0.14;
    if (gs.sqDir === -1) { sqX = 1 + 0.38 * t; sqY = 1 - 0.30 * t; }
    else                 { sqX = 1 - 0.22 * t; sqY = 1 + 0.38 * t; }
  }

  ctx.save();
  // Subir 3px el origen para que las botas animadas no clipeen con la plataforma
  ctx.translate(cx, by - 3);

  // Aura del power-up estrella
  if (rb) {
    const glowR = 30 + Math.sin(gs.elapsed * 10) * 4;
    const g = ctx.createRadialGradient(0, -22, 0, 0, -22, glowR);
    g.addColorStop(0, `hsla(${(gs.elapsed * 180) % 360},90%,60%,0.5)`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -22, glowR, 0, Math.PI * 2); ctx.fill();
  }

  ctx.scale(gs.fR ? sqX : -sqX, sqY);

  // Shadow (en el suelo real, no en el origen del sprite)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 5, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

  // Boots
  ctx.fillStyle = '#3e2723';
  rrect(ctx, -15, -5 + legSwing, 15, 7, 3);
  rrect(ctx, 0,  -5 - legSwing, 15, 7, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-13, -4 + legSwing, 5, 2); ctx.fillRect(2, -4 - legSwing, 5, 2);

  // Legs
  const legGrad = ctx.createLinearGradient(-13, 0, 13, 0);
  legGrad.addColorStop(0, cBodyMid); legGrad.addColorStop(1, cBodyDk);
  ctx.fillStyle = legGrad;
  rrect(ctx, -13, -13 + legSwing, 12, 9, 2);
  rrect(ctx, 1, -13 - legSwing, 12, 9, 2);

  // Back arm
  const armGradB = ctx.createLinearGradient(11, 0, 19, 0);
  armGradB.addColorStop(0, '#ffcc80'); armGradB.addColorStop(1, '#ffb74d');
  ctx.fillStyle = armGradB;
  rrect(ctx, 11, -22 - armY, 7, 12, 3);

  // Overalls body
  const bodyGrad = ctx.createLinearGradient(-14, -22, 14, -10);
  bodyGrad.addColorStop(0, cBody); bodyGrad.addColorStop(0.5, cBodyMid); bodyGrad.addColorStop(1, cBodyDk);
  ctx.fillStyle = bodyGrad;
  rrect(ctx, -14, -22, 28, 14, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-12, -22, 24, 3);
  ctx.fillStyle = cCollarDk; ctx.fillRect(-4, -22, 3, 4); ctx.fillRect(2, -22, 3, 4);

  // Collar
  const colGrad = ctx.createLinearGradient(-9, -24, 9, -20);
  colGrad.addColorStop(0, cCollar); colGrad.addColorStop(1, cCollarDk);
  ctx.fillStyle = colGrad;
  rrect(ctx, -9, -24, 18, 5, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-7, -24, 14, 2);

  // Front arm
  const armGradF = ctx.createLinearGradient(-19, 0, -11, 0);
  armGradF.addColorStop(0, '#ffb74d'); armGradF.addColorStop(1, '#ffcc80');
  ctx.fillStyle = armGradF;
  rrect(ctx, -18, -22 + armY, 7, 12, 3);

  // Face
  const faceGrad = ctx.createLinearGradient(-11, -37, 11, -20);
  faceGrad.addColorStop(0, '#ffd180'); faceGrad.addColorStop(0.6, '#ffcc80'); faceGrad.addColorStop(1, '#ffb74d');
  ctx.fillStyle = faceGrad;
  rrect(ctx, -11, -37, 22, 15, 4);
  ctx.fillStyle = 'rgba(255,100,100,0.22)';
  ctx.beginPath(); ctx.ellipse(-5, -25, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb74d';
  ctx.beginPath(); ctx.ellipse(-11, -29, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

  // Eye
  ctx.fillStyle = '#fff'; rrect(ctx, 2, -35, 9, 7, 2);
  ctx.fillStyle = 'rgba(100,60,30,0.25)'; ctx.fillRect(2, -35, 9, 2);
  ctx.fillStyle = '#1565c0'; ctx.beginPath(); ctx.arc(6, -31, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(6, -31, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7.2, -32, 0.9, 0, Math.PI * 2); ctx.fill();

  // Eyebrow
  ctx.fillStyle = '#5d4037'; rrect(ctx, 1, -37, 10, 2, 1);

  // Nose
  ctx.fillStyle = '#e8a87c'; ctx.beginPath(); ctx.arc(2, -27, 2.2, 0, Math.PI * 2); ctx.fill();

  // Mustache (two lobes)
  ctx.fillStyle = '#4e342e';
  rrect(ctx, -3, -26, 7, 5, 2); rrect(ctx, 5, -26, 7, 5, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-3, -26, 12, 2);

  // Hat brim
  const brimGrad = ctx.createLinearGradient(-16, -40, -16, -33);
  brimGrad.addColorStop(0, cHat); brimGrad.addColorStop(0.5, cHatMid); brimGrad.addColorStop(1, cHatDk);
  ctx.fillStyle = brimGrad; rrect(ctx, -16, -40, 32, 6, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-14, -40, 22, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-14, -35, 28, 2);

  // Hat top
  const hatGrad = ctx.createLinearGradient(-9, -55, 9, -40);
  hatGrad.addColorStop(0, cHat); hatGrad.addColorStop(0.4, cHatMid); hatGrad.addColorStop(1, cHatDk);
  ctx.fillStyle = hatGrad; rrect(ctx, -9, -55, 18, 16, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(-2, -51, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(5, -55, 4, 16);

  // Hat band
  ctx.fillStyle = cCollarDk; ctx.fillRect(-9, -41, 18, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-9, -41, 18, 1);

  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, elapsed: number) {
  const sx = e.x - camX;
  if (sx + e.w < -40 || sx > ctx.canvas.width + 40) return;
  const cx2 = sx + e.w / 2;
  const ey = e.y;

  if (!e.alive) {
    if (e.stompT <= 0) return;
    ctx.globalAlpha = Math.min(1, e.stompT * 2);
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.ellipse(cx2, ey + e.h * 0.9, e.w * 0.5, e.h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  if (e.type === 'worm') {
    // Mirror around center when moving left so the face always faces direction of travel
    ctx.save();
    if (e.vx > 0) {
      ctx.translate(sx + e.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(sx + e.w / 2), 0);
    }
    const seg = 4;
    const segW = e.w / seg;
    const legT = e.fr === 0 ? 2 : -2;
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 2;
    for (let i = 0; i < seg; i++) {
      const bx = sx + i * segW + segW / 2;
      ctx.beginPath(); ctx.moveTo(bx - 4, ey + e.h); ctx.lineTo(bx - 6, ey + e.h + 4 + legT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 4, ey + e.h); ctx.lineTo(bx + 6, ey + e.h + 4 - legT); ctx.stroke();
    }
    ctx.lineWidth = 1;
    const segCols = ['#81c784','#66bb6a','#4caf50','#388e3c'];
    for (let i = seg - 1; i >= 0; i--) {
      const bx = sx + i * segW + segW / 2;
      const yOff = Math.sin(elapsed * 4 + i * 0.9) * 3;
      const sGrad = ctx.createRadialGradient(bx - 3, ey + e.h / 2 + yOff - 3, 1, bx, ey + e.h / 2 + yOff, segW * 0.55);
      sGrad.addColorStop(0, '#a5d6a7'); sGrad.addColorStop(1, segCols[i % 4]);
      ctx.fillStyle = sGrad;
      ctx.beginPath(); ctx.ellipse(bx, ey + e.h / 2 + yOff, segW * 0.52, e.h * 0.50, 0, 0, Math.PI * 2); ctx.fill();
      if (i < seg - 1) {
        ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(sx + (i + 1) * segW, ey + 3); ctx.lineTo(sx + (i + 1) * segW, ey + e.h - 3); ctx.stroke();
      }
    }
    const hx = sx + segW * 0.5;
    const hy = ey + e.h / 2 + Math.sin(elapsed * 4) * 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - 4, hy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 4, hy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(hx - 3, hy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 5, hy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - 2.5, hy - 4, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 5.5, hy - 4, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(hx, hy + 1, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore(); // end worm flip

  } else if (e.type === 'spider') {
    ctx.save();
    if (e.vx > 0) { ctx.translate(sx + e.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + e.w / 2), 0); }
    const bx = sx + e.w / 2;
    const abdY = ey + e.h * 0.60;
    const headY = ey + e.h * 0.28;
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(bx, ey - 20); ctx.lineTo(bx, ey + 4); ctx.stroke();
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      const legWave = Math.sin(elapsed * 6 + i * 1.5 + e.fr * Math.PI) * 5;
      const spread = 6 + i * 4;
      const midY = abdY - 4 + i * 2;
      ctx.strokeStyle = i % 2 === 0 ? '#263238' : '#37474f';
      ctx.beginPath(); ctx.moveTo(bx - 5, abdY - 2); ctx.quadraticCurveTo(bx - spread, midY + legWave, bx - spread - 8, abdY + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 5, abdY - 2); ctx.quadraticCurveTo(bx + spread, midY + legWave, bx + spread + 8, abdY + 4); ctx.stroke();
    }
    ctx.lineWidth = 1;
    const abdGrad = ctx.createRadialGradient(bx - 3, abdY - 3, 1, bx, abdY, 10);
    abdGrad.addColorStop(0, '#546e7a'); abdGrad.addColorStop(0.6, '#263238'); abdGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = abdGrad;
    ctx.beginPath(); ctx.ellipse(bx, abdY, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath(); ctx.ellipse(bx, abdY - 3, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx, abdY + 3, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b71c1c'; ctx.fillRect(bx - 1, abdY - 2.5, 2, 6);
    const hGrad = ctx.createRadialGradient(bx - 2, headY - 2, 1, bx, headY, 7);
    hGrad.addColorStop(0, '#455a64'); hGrad.addColorStop(1, '#1c313a');
    ctx.fillStyle = hGrad;
    ctx.beginPath(); ctx.ellipse(bx, headY, 7.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    const eyeRow = [[bx-5,bx-1,bx+3],[bx-4,bx,bx+4]];
    const eyeYs = [headY - 3, headY + 1];
    ctx.fillStyle = '#fff';
    eyeRow.forEach((row, ri) => { row.forEach(ex2 => { ctx.beginPath(); ctx.arc(ex2, eyeYs[ri], 1.5, 0, Math.PI * 2); ctx.fill(); }); });
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(bx - 5, headY - 3, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.moveTo(bx - 3, headY + 5); ctx.lineTo(bx - 5, headY + 10); ctx.lineTo(bx - 1, headY + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + 1, headY + 5); ctx.lineTo(bx + 3, headY + 10); ctx.lineTo(bx + 5, headY + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#76ff03';
    ctx.beginPath(); ctx.arc(bx - 4, headY + 9.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); // end spider flip

  } else if (e.type === 'monkey') {
    ctx.save();
    if (e.vx > 0) { ctx.translate(sx + e.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + e.w / 2), 0); }
    const bx = sx + e.w / 2;
    const footY = ey + e.h;
    const legSwing = e.fr === 0 ? 5 : -5;
    ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx + 8, ey + e.h * 0.45);
    ctx.bezierCurveTo(bx + 22, ey + e.h * 0.35, bx + 24, ey + e.h * 0.15, bx + 16, ey + e.h * 0.05);
    ctx.stroke();
    ctx.lineWidth = 1; ctx.lineCap = 'butt';
    ctx.fillStyle = '#795548';
    rrect(ctx, sx + 3, footY - 14 + legSwing, 9, 14, 3);
    rrect(ctx, sx + e.w - 12, footY - 14 - legSwing, 9, 14, 3);
    ctx.fillStyle = '#5d4037';
    rrect(ctx, sx + 1, footY - 5 + legSwing, 12, 6, 3);
    rrect(ctx, sx + e.w - 13, footY - 5 - legSwing, 12, 6, 3);
    const bodyGrad = ctx.createLinearGradient(sx, ey + e.h * 0.35, sx + e.w, ey + e.h * 0.65);
    bodyGrad.addColorStop(0, '#a1887f'); bodyGrad.addColorStop(0.5, '#8d6e63'); bodyGrad.addColorStop(1, '#795548');
    ctx.fillStyle = bodyGrad;
    rrect(ctx, sx + 2, ey + e.h * 0.38, e.w - 4, e.h * 0.40, 6);
    const armSw = -legSwing * 0.7;
    ctx.fillStyle = '#8d6e63';
    rrect(ctx, sx - 4, ey + e.h * 0.38 + armSw, 8, 12, 3);
    rrect(ctx, sx + e.w - 4, ey + e.h * 0.38 - armSw, 8, 12, 3);
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath(); ctx.ellipse(sx - 1, ey + e.h * 0.38 + armSw + 12, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + e.w - 1, ey + e.h * 0.38 - armSw + 12, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const headGrad = ctx.createRadialGradient(bx - 3, ey + e.h * 0.16, 2, bx, ey + e.h * 0.20, 12);
    headGrad.addColorStop(0, '#bcaaa4'); headGrad.addColorStop(1, '#8d6e63');
    ctx.fillStyle = headGrad;
    ctx.beginPath(); ctx.ellipse(bx, ey + e.h * 0.22, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#795548';
    ctx.beginPath(); ctx.ellipse(bx - 11, ey + e.h * 0.20, 5, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx + 11, ey + e.h * 0.20, 5, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath(); ctx.ellipse(bx - 11, ey + e.h * 0.22, 3, 4, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx + 11, ey + e.h * 0.22, 3, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath(); ctx.ellipse(bx + 1, ey + e.h * 0.28, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#795548';
    ctx.beginPath(); ctx.arc(bx - 2, ey + e.h * 0.28, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 4, ey + e.h * 0.28, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    rrect(ctx, bx - 9, ey + e.h * 0.15, 7, 6, 2); rrect(ctx, bx + 2, ey + e.h * 0.15, 7, 6, 2);
    ctx.fillStyle = '#4e342e';
    ctx.beginPath(); ctx.arc(bx - 5.5, ey + e.h * 0.17, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 5.5, ey + e.h * 0.17, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx - 4.5, ey + e.h * 0.15, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 6.5, ey + e.h * 0.15, 0.9, 0, Math.PI * 2); ctx.fill();
    const mouthOpen = 2 + Math.sin(elapsed * 3) * 1;
    ctx.fillStyle = '#5d4037';
    ctx.beginPath(); ctx.arc(bx + 1, ey + e.h * 0.30 + mouthOpen, 5, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 3, ey + e.h * 0.30, 3, 2); ctx.fillRect(bx + 1, ey + e.h * 0.30, 3, 2);
    ctx.restore(); // end monkey flip

  } else if (e.type === 'plant') {
    const bx = sx + e.w / 2;
    const mouthOpen = Math.max(0, Math.sin(elapsed * 2.5)) * 14;
    const sway = Math.sin(elapsed * 1.5) * 4;
    const potGrad = ctx.createLinearGradient(sx + 2, ey + e.h - 14, sx + e.w - 2, ey + e.h);
    potGrad.addColorStop(0, '#a1887f'); potGrad.addColorStop(1, '#6d4c41');
    ctx.fillStyle = potGrad; rrect(ctx, sx + 2, ey + e.h - 14, e.w - 4, 14, 3);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(sx, ey + e.h - 14, e.w, 4);
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, ey + e.h - 14);
    ctx.bezierCurveTo(bx + sway * 0.5, ey + e.h - 24, bx + sway, ey + 24, bx + sway, ey + 22);
    ctx.stroke();
    ctx.lineWidth = 1; ctx.lineCap = 'butt';
    ctx.fillStyle = '#388e3c';
    ctx.save(); ctx.translate(bx - 4 + sway * 0.5, ey + e.h * 0.55); ctx.rotate(-0.6 + sway * 0.05);
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(bx + 4 + sway * 0.5, ey + e.h * 0.48); ctx.rotate(0.7 + sway * 0.05);
    ctx.fillStyle = '#43a047';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const headCY = ey + 16 + sway * 0.3;
    const headGrad2 = ctx.createRadialGradient(bx - 3, headCY - 4, 2, bx, headCY, 12);
    headGrad2.addColorStop(0, '#66bb6a'); headGrad2.addColorStop(0.6, '#43a047'); headGrad2.addColorStop(1, '#2e7d32');
    ctx.fillStyle = headGrad2;
    ctx.beginPath(); ctx.ellipse(bx + sway * 0.3, headCY, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a5d6a7';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px2 = (bx + sway * 0.3) + Math.cos(a) * 13;
      const py2 = headCY + Math.sin(a) * 12;
      ctx.beginPath(); ctx.ellipse(px2, py2, 4, 3, a, 0, Math.PI * 2); ctx.fill();
    }
    const mouthY = headCY + 3;
    const upperGrad = ctx.createLinearGradient(bx - 10, mouthY - mouthOpen, bx + 10, mouthY);
    upperGrad.addColorStop(0, '#e53935'); upperGrad.addColorStop(1, '#b71c1c');
    ctx.fillStyle = upperGrad;
    ctx.beginPath(); ctx.arc(bx + sway * 0.3, mouthY - mouthOpen / 2, 10, Math.PI, 0); ctx.fill();
    const lowerGrad = ctx.createLinearGradient(bx - 10, mouthY, bx + 10, mouthY + mouthOpen);
    lowerGrad.addColorStop(0, '#c62828'); lowerGrad.addColorStop(1, '#e53935');
    ctx.fillStyle = lowerGrad;
    ctx.beginPath(); ctx.arc(bx + sway * 0.3, mouthY + mouthOpen / 2, 10, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fffde7';
    for (let t2 = -6; t2 <= 6; t2 += 4) {
      ctx.beginPath(); ctx.moveTo(bx + sway * 0.3 + t2 - 2, mouthY - mouthOpen / 2); ctx.lineTo(bx + sway * 0.3 + t2, mouthY - mouthOpen / 2 + 5); ctx.lineTo(bx + sway * 0.3 + t2 + 2, mouthY - mouthOpen / 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + sway * 0.3 + t2 - 2, mouthY + mouthOpen / 2); ctx.lineTo(bx + sway * 0.3 + t2, mouthY + mouthOpen / 2 - 5); ctx.lineTo(bx + sway * 0.3 + t2 + 2, mouthY + mouthOpen / 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx - 5 + sway * 0.3, headCY - 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 5 + sway * 0.3, headCY - 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(bx - 5 + sway * 0.3, headCY - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 5 + sway * 0.3, headCY - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b5e20';
    ctx.save(); ctx.translate(bx - 5 + sway * 0.3, headCY - 10); ctx.rotate(-0.4); ctx.fillRect(-5, 0, 10, 2); ctx.restore();
    ctx.save(); ctx.translate(bx + 5 + sway * 0.3, headCY - 10); ctx.rotate(0.4); ctx.fillRect(-5, 0, 10, 2); ctx.restore();

  } else {
    // ── ESPÍN (puerco espín mejorado) ─────────────────────────────────────────
    ctx.save();
    if (e.vx > 0) { ctx.translate(sx + e.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + e.w / 2), 0); }
    const bx = sx + e.w / 2;
    const footY = ey + e.h;
    const legSw = e.fr === 0 ? 3 : -3;
    const bodyC = ey + e.h * 0.60;
    const headCX = bx - 7;
    const headCY = ey + e.h * 0.30;
    const spRoot = { x: bx + 3, y: bodyC - 6 };

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(bx, footY + 2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

    // === QUILLS — shadow layer first ===
    const quills = [
      { a:-1.35,l:9 },{ a:-1.1,l:13 },{ a:-0.85,l:15 },{ a:-0.60,l:16 },
      { a:-0.35,l:16 },{ a:-0.10,l:15 },{ a: 0.15,l:14 },{ a: 0.40,l:13 },
      { a: 0.65,l:11 },{ a: 0.90,l: 9 },{ a: 1.15,l: 7 },
    ];
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    quills.forEach(({ a, l }) => {
      ctx.strokeStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.moveTo(spRoot.x + 1, spRoot.y + 1);
      ctx.lineTo(spRoot.x + 1 + Math.cos(a) * l, spRoot.y + 1 + Math.sin(a) * l);
      ctx.stroke();
    });
    // Main quills with dark→cream gradient per quill
    ctx.lineWidth = 1.8;
    quills.forEach(({ a, l }) => {
      const tx = spRoot.x + Math.cos(a) * l, ty = spRoot.y + Math.sin(a) * l;
      const qG = ctx.createLinearGradient(spRoot.x, spRoot.y, tx, ty);
      qG.addColorStop(0, '#3e2723'); qG.addColorStop(0.55, '#795548'); qG.addColorStop(1, '#f5f5f5');
      ctx.strokeStyle = qG;
      ctx.beginPath(); ctx.moveTo(spRoot.x, spRoot.y); ctx.lineTo(tx, ty); ctx.stroke();
    });
    ctx.lineWidth = 1; ctx.lineCap = 'butt';

    // === FEET ===
    ctx.fillStyle = '#4e342e';
    rrect(ctx, sx + 2, footY - 7 + legSw, 10, 7, 3);
    rrect(ctx, sx + e.w - 12, footY - 7 - legSw, 10, 7, 3);
    // Claws
    ctx.fillStyle = '#3e2723';
    [2, 5, 8].forEach(ox => ctx.fillRect(sx + ox, footY - 1 + legSw, 2, 2));
    [sx + e.w - 12, sx + e.w - 9, sx + e.w - 6].forEach(ox => ctx.fillRect(ox, footY - 1 - legSw, 2, 2));

    // === BODY (smooth belly) ===
    const bellyG = ctx.createRadialGradient(bx - 3, bodyC - 2, 2, bx, bodyC, 13);
    bellyG.addColorStop(0, '#d7ccc8'); bellyG.addColorStop(0.5, '#a1887f'); bellyG.addColorStop(1, '#6d4c41');
    ctx.fillStyle = bellyG;
    ctx.beginPath(); ctx.ellipse(bx, bodyC, 13, 10, 0.15, 0, Math.PI * 2); ctx.fill();
    // Belly texture stripes
    ctx.strokeStyle = 'rgba(80,40,20,0.12)'; ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(bx + i * 3, bodyC - 8); ctx.lineTo(bx + i * 3, bodyC + 8); ctx.stroke();
    }
    ctx.lineWidth = 1;

    // === HEAD ===
    const hG = ctx.createRadialGradient(headCX - 3, headCY - 3, 1, headCX, headCY, 11);
    hG.addColorStop(0, '#efebe9'); hG.addColorStop(0.5, '#d7ccc8'); hG.addColorStop(1, '#8d6e63');
    ctx.fillStyle = hG;
    ctx.beginPath(); ctx.ellipse(headCX, headCY, 11, 10, -0.1, 0, Math.PI * 2); ctx.fill();

    // Ear
    ctx.fillStyle = '#a1887f';
    ctx.beginPath(); ctx.ellipse(headCX + 5, headCY - 9, 4.5, 5.5, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fce4ec';
    ctx.beginPath(); ctx.ellipse(headCX + 5, headCY - 8, 2.2, 3.2, 0.25, 0, Math.PI * 2); ctx.fill();

    // Snout
    ctx.fillStyle = '#efebe9';
    ctx.beginPath(); ctx.ellipse(headCX - 10, headCY + 3, 6, 4.5, -0.15, 0, Math.PI * 2); ctx.fill();
    // Nose (pink round tip)
    const nG = ctx.createRadialGradient(headCX - 15, headCY + 1.5, 0, headCX - 15, headCY + 2, 3.5);
    nG.addColorStop(0, '#f48fb1'); nG.addColorStop(1, '#e91e63');
    ctx.fillStyle = nG;
    ctx.beginPath(); ctx.arc(headCX - 15, headCY + 2, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(headCX - 16, headCY + 1, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headCX - 14, headCY + 1, 1, 0, Math.PI * 2); ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(200,200,200,0.75)'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
    [[-0.25,-7],[-0.05,-6],[0.05,-6],[0.25,-7]].forEach(([ang, len]) => {
      ctx.beginPath();
      ctx.moveTo(headCX - 10, headCY + 2);
      ctx.lineTo(headCX - 10 + Math.cos(Math.PI + ang) * len, headCY + 2 + Math.sin(Math.PI + ang) * len);
      ctx.stroke();
    });
    ctx.lineWidth = 1; ctx.lineCap = 'butt';

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(headCX - 1, headCY - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a237e';
    ctx.beginPath(); ctx.arc(headCX - 1, headCY - 4, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(headCX - 1, headCY - 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(headCX + 0.5, headCY - 5.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headCX - 2.5, headCY - 2.5, 0.6, 0, Math.PI * 2); ctx.fill();

    // === WARNING badge (pulsing × — no stomp) ===
    const pulse = 0.6 + Math.abs(Math.sin(elapsed * 5)) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath(); ctx.arc(bx + 5, ey - 13, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcdd2';
    ctx.beginPath(); ctx.arc(bx + 5, ey - 13, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx + 2, ey - 16); ctx.lineTo(bx + 8, ey - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 8, ey - 16); ctx.lineTo(bx + 2, ey - 10); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineWidth = 1; ctx.globalAlpha = 1;

    ctx.restore(); // end espín flip
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, c: Coin, camX: number, elapsed: number) {
  if (c.got) return;
  const sx = c.x - camX;
  if (sx < -24 || sx > ctx.canvas.width + 24) return;
  const bob = Math.sin(elapsed * 3 + c.x * 0.01) * 4;
  const cy = c.y + bob;
  const spinW = Math.abs(Math.cos(elapsed * 4 + c.x * 0.005));
  const rX = 10 * (0.2 + spinW * 0.8);
  const rY = 10;

  const glow = ctx.createRadialGradient(sx, cy, 0, sx, cy, 18);
  glow.addColorStop(0, 'rgba(255,215,0,0.35)'); glow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(sx - 20, cy - 20, 40, 40);

  ctx.fillStyle = '#e65100';
  ctx.beginPath(); ctx.ellipse(sx + 1, cy + 1, rX, rY, 0, 0, Math.PI * 2); ctx.fill();

  const cGrad = ctx.createLinearGradient(sx - rX, cy - rY, sx + rX, cy + rY);
  cGrad.addColorStop(0, '#ffe57f'); cGrad.addColorStop(0.4, '#ffd700'); cGrad.addColorStop(1, '#ffa000');
  ctx.fillStyle = cGrad;
  ctx.beginPath(); ctx.ellipse(sx, cy, rX, rY, 0, 0, Math.PI * 2); ctx.fill();

  if (rX > 4) {
    ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(sx, cy, rX * 0.65, rY * 0.65, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (rX > 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(sx - rX * 0.2, cy - rY * 0.3, rX * 0.3, rY * 0.25, -0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineWidth = 1;
}

function drawSpike(ctx: CanvasRenderingContext2D, sp: Spike, camX: number, theme: Theme) {
  const sx = sp.x - camX;
  if (sx + sp.w < -10 || sx > ctx.canvas.width + 10) return;
  const count = Math.max(1, Math.floor(sp.w / 12));
  const col = theme === 'cave' ? '#90a4ae' : '#ce93d8';
  const colDark = theme === 'cave' ? '#546e7a' : '#7b1fa2';
  for (let i = 0; i < count; i++) {
    const tx = sx + i * 12, tipX = tx + 6, tipY = sp.y - 18;
    ctx.fillStyle = colDark;
    ctx.beginPath(); ctx.moveTo(tx + 1, sp.y); ctx.lineTo(tx + 11, sp.y); ctx.lineTo(tipX + 1, tipY + 3); ctx.closePath(); ctx.fill();
    const spGrad = ctx.createLinearGradient(tx, sp.y, tipX, tipY);
    spGrad.addColorStop(0, colDark); spGrad.addColorStop(0.5, col); spGrad.addColorStop(1, '#fff');
    ctx.fillStyle = spGrad;
    ctx.beginPath(); ctx.moveTo(tx, sp.y); ctx.lineTo(tx + 12, sp.y); ctx.lineTo(tipX, tipY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(tipX - 1, tipY + 2); ctx.lineTo(tx + 3, sp.y - 1); ctx.stroke();
  }
  ctx.lineWidth = 1;
}

function drawGoal(ctx: CanvasRenderingContext2D, gX: number, gY: number, camX: number, elapsed: number) {
  const sx = gX - camX;
  if (sx < -80 || sx > ctx.canvas.width + 80) return;
  const wave = Math.sin(elapsed * 4) * 7;

  // Pole
  const poleGrad = ctx.createLinearGradient(sx - 3, gY - 90, sx + 3, gY);
  poleGrad.addColorStop(0, '#bdbdbd'); poleGrad.addColorStop(0.5, '#9e9e9e'); poleGrad.addColorStop(1, '#616161');
  ctx.fillStyle = poleGrad; ctx.fillRect(sx - 3, gY - 90, 6, 90);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(sx - 1, gY - 90, 2, 90);

  // Ball on top
  const ballGrad = ctx.createRadialGradient(sx - 2, gY - 94, 1, sx, gY - 92, 6);
  ballGrad.addColorStop(0, '#fff9c4'); ballGrad.addColorStop(1, '#f9a825');
  ctx.fillStyle = ballGrad;
  ctx.beginPath(); ctx.arc(sx, gY - 92, 6, 0, Math.PI * 2); ctx.fill();

  // Checkered flag (clipped wave shape)
  const flagW = 48, flagH = 28;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx + 3, gY - 88);
  ctx.bezierCurveTo(sx + 20 + wave, gY - 84, sx + 40 + wave * 0.7, gY - 80, sx + flagW + wave * 0.5, gY - 74);
  ctx.bezierCurveTo(sx + 40 + wave * 0.7, gY - 72, sx + 20 + wave, gY - 68, sx + 3, gY - 62);
  ctx.closePath();
  ctx.clip();
  const cols = 4, rows = 2;
  const cw2 = flagW / cols, ch2 = flagH / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#212121';
      ctx.fillRect(sx + 3 + c * cw2 + wave * 0.15, gY - 88 + r * ch2, cw2 + 2, ch2 + 1);
    }
  }
  ctx.restore();

  // Base
  const baseGrad = ctx.createLinearGradient(sx - 14, gY - 8, sx + 14, gY);
  baseGrad.addColorStop(0, '#9e9e9e'); baseGrad.addColorStop(1, '#616161');
  ctx.fillStyle = baseGrad;
  rrect(ctx, sx - 14, gY - 8, 28, 8, 4);

  // Base glow
  const baseGlow = ctx.createRadialGradient(sx, gY, 0, sx, gY, 30);
  baseGlow.addColorStop(0, 'rgba(100,255,100,0.25)'); baseGlow.addColorStop(1, 'rgba(100,255,100,0)');
  ctx.fillStyle = baseGlow; ctx.fillRect(sx - 35, gY - 35, 70, 40);
}

function drawHUD(ctx: CanvasRenderingContext2D, gs: GS, cw: number) {
  // Gradient bar
  const hudGrad = ctx.createLinearGradient(0, 0, 0, 56);
  hudGrad.addColorStop(0, 'rgba(0,0,0,0.72)'); hudGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = hudGrad; ctx.fillRect(0, 0, cw, 56);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 55, cw, 1);

  // Lives (hearts with glow)
  for (let i = 0; i < 3; i++) {
    const hx = 18 + i * 30, hy = 20, filled = i < gs.lives;
    if (filled) {
      const hGlow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
      hGlow.addColorStop(0, 'rgba(255,80,80,0.35)'); hGlow.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = hGlow; ctx.fillRect(hx - 18, hy - 18, 36, 36);
    }
    ctx.fillStyle = filled ? '#e53935' : 'rgba(100,100,100,0.5)';
    ctx.beginPath();
    ctx.arc(hx - 5, hy - 2, 6, Math.PI, 0);
    ctx.arc(hx + 5, hy - 2, 6, Math.PI, 0);
    ctx.lineTo(hx, hy + 11); ctx.closePath(); ctx.fill();
    if (filled) {
      ctx.fillStyle = 'rgba(255,150,150,0.5)';
      ctx.beginPath(); ctx.ellipse(hx - 4, hy - 4, 3, 2, -0.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Level indicator (center)
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace';
  ctx.fillText('NIVEL', cw / 2, 18);
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 20px monospace';
  ctx.fillText(`${gs.lv + 1} / 7`, cw / 2, 38);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i <= gs.lv ? '#ffd700' : 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(cw / 2 - 36 + i * 12, 48, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Coins (animated spinning icon)
  const coinX = cw / 2 + 55;
  const spinW2 = 0.5 + Math.abs(Math.cos(gs.elapsed * 3)) * 0.5;
  const cgGrad = ctx.createLinearGradient(coinX - 8, 20, coinX + 8, 36);
  cgGrad.addColorStop(0, '#ffe57f'); cgGrad.addColorStop(1, '#ffa000');
  ctx.fillStyle = cgGrad;
  ctx.beginPath(); ctx.ellipse(coinX, 28, 8 * spinW2, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`×${gs.coins}`, coinX + 12, 33);

  // Score (desplazado a la izquierda del botón de pausa)
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px monospace';
  ctx.fillText('PUNTAJE', cw - 56, 18);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
  ctx.fillText(`${gs.score}`, cw - 56, 37);

  // Botón de pausa (esquina superior derecha)
  const pb = pauseBtnRect(cw);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, pb.x, pb.y, pb.w, pb.h, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
  strokeRRect(ctx, pb.x, pb.y, pb.w, pb.h, 8); ctx.lineWidth = 1;
  ctx.fillStyle = '#fff';
  ctx.fillRect(pb.x + pb.w / 2 - 7, pb.y + 9, 5, pb.h - 18);
  ctx.fillRect(pb.x + pb.w / 2 + 2, pb.y + 9, 5, pb.h - 18);

  // Run indicator
  if (gs.runT > 0) {
    ctx.globalAlpha = 0.7 + Math.sin(gs.elapsed * 12) * 0.3;
    ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('⚡ TURBO', 12, 50);
    ctx.globalAlpha = 1;
  }

  // Barra de power-up estrella
  if (gs.starPowerT > 0) {
    const w = 130, x = cw / 2 - w / 2, y = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrect(ctx, x - 2, y - 2, w + 4, 10, 4);
    const bg = ctx.createLinearGradient(x, 0, x + w, 0);
    bg.addColorStop(0, '#ff1744'); bg.addColorStop(0.5, '#ffeb3b'); bg.addColorStop(1, '#00e676');
    ctx.fillStyle = bg; rrect(ctx, x, y, w * (gs.starPowerT / 6), 6, 3);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('⭐ INVENCIBLE', cw / 2, y + 21);
  }
  ctx.textAlign = 'left';
}

function drawProjectiles(ctx: CanvasRenderingContext2D, projs: Projectile[], camX: number) {
  for (const p of projs) {
    const sx = p.x - camX;
    if (sx < -20 || sx > ctx.canvas.width + 20) continue;
    const alpha = Math.min(1, p.life * 1.5);
    ctx.globalAlpha = alpha;

    // Trail (motion blur)
    const trailLen = Math.min(18, Math.abs(p.vx) * 0.06);
    const trailGrad = ctx.createLinearGradient(sx - Math.sign(p.vx) * trailLen, p.y, sx, p.y);
    trailGrad.addColorStop(0, 'rgba(100,200,80,0)');
    trailGrad.addColorStop(1, 'rgba(100,200,80,0.5)');
    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.ellipse(sx - Math.sign(p.vx) * trailLen / 2, p.y, trailLen / 2 + 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Seed body
    const glow = ctx.createRadialGradient(sx - 1, p.y - 1, 0, sx, p.y, 8);
    glow.addColorStop(0, '#c5e1a5');
    glow.addColorStop(0.5, '#8bc34a');
    glow.addColorStop(1, '#33691e');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, p.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Inner detail
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(sx - 2, p.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Spin marks (rotating lines)
    const angle = p.x * 0.1 + p.y * 0.05;
    ctx.strokeStyle = '#33691e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(angle) * 3, p.y + Math.sin(angle) * 3);
    ctx.lineTo(sx - Math.cos(angle) * 3, p.y - Math.sin(angle) * 3);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D, parts: Particle[], camX: number) {
  for (const p of parts) {
    const alpha = Math.max(0, p.life / p.ml);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = p.r * 3;
    ctx.shadowColor = p.col;
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y, p.r * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawTouchHints(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';

  // Left arrow
  ctx.fillText('◄', 60, ch - 40);

  // Right arrow
  ctx.fillText('►', cw - 60, ch - 40);

  ctx.font = '13px monospace';
  ctx.fillText('↑ salta', cw / 2, ch - 60);
  ctx.fillText('×2 corre', cw / 2, ch - 42);

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawMessage(ctx: CanvasRenderingContext2D, gs: GS, camX: number) {
  if (gs.msgT <= 0) return;
  const alpha = Math.min(1, gs.msgT * 3);
  const yOff = (1 - gs.msgT / 0.8) * 35;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(gs.msg, gs.px - camX + PW / 2, gs.py - 10 - yOff);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawIntro(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS) {
  // Panel de onboarding estilo gameKit
  const walletLine = `🪙 ${gs.coins}   🔥 Racha ${gs.streak}d`;
  drawOnboard(ctx, cw, ch, {
    title: 'PIXEL RUN',
    subtitle: walletLine,
    how: [
      '◄ ► mantené presionado para mover',
      'Doble tap en el mismo lado = turbo ⚡',
      'Deslizá ↑ para saltar (más fuerza = más alto)',
      'Pisá enemigos para eliminarlos',
    ],
    scoring: '⭐ Recolectá monedas · Llegá a la bandera',
    accent: '#ffd700',
    playLabel: 'JUGAR',
  });

  // Mensaje de racha/shop por encima del panel
  if (gs.shopMsgT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, gs.shopMsgT);
    ctx.fillStyle = '#69f0ae';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(gs.shopMsg, cw / 2, ch * 0.96);
    ctx.restore();
  }

  // Botón de tienda con el mismo estilo que JUGAR (gameKit)
  const sr = shopBtnRect(cw, ch);
  gkButton(ctx, sr.x + sr.w / 2, sr.y + sr.h / 2, sr.w, sr.h, '🛒  TIENDA', {
    color: '#7b1fa2',
    glow: true,
  });

  ctx.textAlign = 'left';
}

function drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, gY: number, camX: number, activated: boolean, t: number) {
  const sx = x - camX;
  if (sx < -70 || sx > ctx.canvas.width + 70) return;

  const col   = activated ? '#00e676' : '#ffeb3b';
  const colDk = activated ? '#00796b' : '#f57f17';
  const pulse = 1 + Math.sin(t * (activated ? 4 : 2)) * (activated ? 0.18 : 0.07);

  // Glow aura around star
  const aura = ctx.createRadialGradient(sx, gY - 88, 0, sx, gY - 88, 28 * pulse);
  aura.addColorStop(0, activated ? 'rgba(0,230,118,0.45)' : 'rgba(255,235,59,0.30)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(sx - 32, gY - 118, 64, 64);

  // Pole (gradient, rounded cap on top)
  const pGrad = ctx.createLinearGradient(sx - 4, gY - 80, sx + 4, gY);
  pGrad.addColorStop(0, col);
  pGrad.addColorStop(0.4, colDk);
  pGrad.addColorStop(1, '#4e342e');
  ctx.fillStyle = pGrad;
  rrect(ctx, sx - 3, gY - 80, 6, 80, 3);
  // Pole shine
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(sx - 1, gY - 78, 2, 75);

  // Base block
  const baseGrad = ctx.createLinearGradient(sx - 14, gY - 10, sx + 14, gY);
  baseGrad.addColorStop(0, colDk);
  baseGrad.addColorStop(1, '#3e2723');
  ctx.fillStyle = baseGrad;
  rrect(ctx, sx - 14, gY - 10, 28, 10, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(sx - 12, gY - 10, 20, 3);

  // Star on top (pulsing scale)
  ctx.save();
  ctx.translate(sx, gY - 90);
  ctx.scale(pulse, pulse);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? 13 : 5.5;
    i === 0 ? ctx.moveTo(Math.cos(a)*r+1, Math.sin(a)*r+1) : ctx.lineTo(Math.cos(a)*r+1, Math.sin(a)*r+1);
  }
  ctx.closePath(); ctx.fill();
  // Star body
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? 13 : 5.5;
    i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fill();
  // Star outline
  ctx.strokeStyle = colDk; ctx.lineWidth = 1.8; ctx.stroke();
  // Inner shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(-2, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Label
  ctx.fillStyle = activated ? '#00695c' : '#795548';
  ctx.font = `bold ${activated ? 10 : 9}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(activated ? '✓ OK' : 'CK', sx, gY - 14);
  ctx.textAlign = 'left';
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    i === 0 ? ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
            : ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd700' : 'rgba(255,255,255,0.12)';
  ctx.fill();
  if (filled) { ctx.strokeStyle = '#f57f17'; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawLvlDone(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#69f0ae';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡NIVEL COMPLETO!', cw / 2, ch * 0.33);

  // Stars (animated entrance)
  const pct = gs.totalLvlCoins > 0 ? gs.lvlCoins / gs.totalLvlCoins : 0;
  const earned = pct >= 0.9 ? 3 : pct >= 0.5 ? 2 : 1;
  const starY = ch * 0.48;
  const bounce = 1 + Math.sin(t * 4) * 0.06;
  ctx.save();
  ctx.scale(bounce, bounce);
  drawStar(ctx, (cw / 2 - 58) / bounce, starY / bounce, 22, earned >= 1);
  drawStar(ctx, (cw / 2)      / bounce, starY / bounce, 27, earned >= 2);
  drawStar(ctx, (cw / 2 + 58) / bounce, starY / bounce, 22, earned >= 3);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText(`Puntaje: ${gs.score}`, cw / 2, ch * 0.62);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`Monedas: ${gs.lvlCoins} / ${gs.totalLvlCoins}`, cw / 2, ch * 0.70);

  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Toca para continuar', cw / 2, ch * 0.83);
  }
  ctx.textAlign = 'left';
}

function drawGameOver(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#e53935';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', cw / 2, ch * 0.38);

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText(`Puntaje final: ${gs.score}`, cw / 2, ch * 0.50);
  ctx.fillText(`Monedas: ${gs.coins}`, cw / 2, ch * 0.58);

  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Toca para reintentar', cw / 2, ch * 0.72);
  }
  ctx.textAlign = 'left';
}

function drawWin(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.70)';
  ctx.fillRect(0, 0, cw, ch);

  const pulse = 1 + Math.sin(t * 3) * 0.06;
  ctx.save();
  ctx.translate(cw / 2, ch * 0.32);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡GANASTE!', 0, 0);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡Felicitaciones, héroe!', cw / 2, ch * 0.46);
  ctx.fillText(`Puntaje total: ${gs.score}`, cw / 2, ch * 0.55);
  ctx.fillText(`Monedas: ${gs.coins}`, cw / 2, ch * 0.62);

  if (Math.floor(t * 1.5) % 2 === 0) {
    ctx.fillStyle = '#69f0ae';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Toca para volver al menú', cw / 2, ch * 0.77);
  }
  ctx.textAlign = 'left';
}

// ── Render ─────────────────────────────────────────────────────────────────────
// ── Nuevos elementos visuales ─────────────────────────────────────────────────
function strokeRRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
}

function drawButton(ctx: CanvasRenderingContext2D, r: Rect, col: string, label: string) {
  ctx.fillStyle = col; rrect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, r.x, r.y, r.w, r.h * 0.5, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(r.x + 6, r.y + r.h - 3, r.w - 12, 2);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.min(18, r.h * 0.4)}px monospace`; ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 6);
  ctx.textAlign = 'left';
}

function drawStarCoin(ctx: CanvasRenderingContext2D, sc: { x: number; y: number; got: boolean }, camX: number, t: number) {
  if (sc.got) return;
  const sx = sc.x - camX;
  if (sx < -30 || sx > ctx.canvas.width + 30) return;
  const cy = sc.y + Math.sin(t * 3) * 4;
  // Aura arcoíris
  const glow = ctx.createRadialGradient(sx, cy, 0, sx, cy, 26);
  glow.addColorStop(0, `hsla(${(t * 200) % 360},90%,62%,0.55)`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(sx - 28, cy - 28, 56, 56);
  // Estrella giratoria
  ctx.save();
  ctx.translate(sx, cy);
  ctx.rotate(t * 2);
  const pulse = 1 + Math.sin(t * 8) * 0.1;
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? 12 : 5;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  const sg = ctx.createLinearGradient(-12, -12, 12, 12);
  sg.addColorStop(0, '#fff59d'); sg.addColorStop(0.5, '#ffd700'); sg.addColorStop(1, '#ff6f00');
  ctx.fillStyle = sg; ctx.fill();
  ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1;
}

function drawSkinPreview(ctx: CanvasRenderingContext2D, cx: number, cy: number, i: number, t: number) {
  const s = SKINS[i];
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 3 + i) * 2);
  ctx.fillStyle = s.bodyMid; rrect(ctx, -14, -6, 28, 22, 4);
  ctx.fillStyle = s.body; rrect(ctx, -14, -6, 28, 6, 3);
  ctx.fillStyle = s.collar; rrect(ctx, -9, -9, 18, 5, 2);
  ctx.fillStyle = '#ffcc80'; rrect(ctx, -11, -26, 22, 15, 4);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4, -20, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(5, -20, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = s.hatMid; rrect(ctx, -16, -30, 32, 6, 2);
  ctx.fillStyle = s.hat; rrect(ctx, -9, -45, 18, 16, 3);
  ctx.fillStyle = s.hatDk; ctx.fillRect(-9, -31, 18, 3);
  ctx.restore();
}

function drawShop(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#1a1030'); g.addColorStop(1, '#0a0818');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TIENDA', cw / 2, ch * 0.13);
  ctx.fillStyle = '#ffe57f'; ctx.font = 'bold 18px monospace';
  ctx.fillText(`🪙 ${gs.coins}`, cw / 2, ch * 0.185);

  drawButton(ctx, backBtnRect(), '#455a64', '‹ Volver');

  // ── Sección de vidas ────────────────────────────────────────────────────────
  const lr = liveBuyBtnRect(cw, ch);
  const heartsY = lr.y - 28;
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('VIDAS', cw / 2, heartsY - 2);
  // corazones
  const totalH = MAX_LIVES, hSpacing = Math.min(22, (cw - 40) / totalH);
  const hStartX = cw / 2 - (totalH * hSpacing) / 2 + hSpacing / 2;
  for (let h = 0; h < totalH; h++) {
    ctx.fillStyle = h < gs.lives ? '#f44336' : 'rgba(255,255,255,0.18)';
    ctx.font = `${hSpacing * 0.8}px monospace`;
    ctx.fillText('♥', hStartX + h * hSpacing, heartsY + 16);
  }
  // botón comprar
  const canBuyLife = gs.lives < MAX_LIVES && gs.coins >= LIFE_COST;
  const btnColor = canBuyLife ? '#e53935' : '#616161';
  const btnLabel = gs.lives >= MAX_LIVES ? `♥ MÁXIMO (${MAX_LIVES})` : `+1 vida  🪙${LIFE_COST}`;
  drawButton(ctx, lr, btnColor, btnLabel);

  for (let i = 0; i < SKINS.length; i++) {
    const r = skinCardRect(cw, ch, i);
    const owned = gs.owned.includes(i);
    const equipped = gs.skin === i;
    ctx.fillStyle = equipped ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.06)';
    rrect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.strokeStyle = equipped ? '#ffd700' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = equipped ? 3 : 1.5;
    strokeRRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.lineWidth = 1;
    drawSkinPreview(ctx, r.x + r.w / 2, r.y + r.h * 0.56, i, t);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText(SKINS[i].name, r.x + r.w / 2, r.y + 22);
    ctx.font = 'bold 13px monospace';
    if (equipped) { ctx.fillStyle = '#69f0ae'; ctx.fillText('✓ EQUIPADO', r.x + r.w / 2, r.y + r.h - 13); }
    else if (owned) { ctx.fillStyle = '#90caf9'; ctx.fillText('Equipar', r.x + r.w / 2, r.y + r.h - 13); }
    else { ctx.fillStyle = gs.coins >= SKINS[i].price ? '#ffd700' : '#e57373'; ctx.fillText(`🪙 ${SKINS[i].price}`, r.x + r.w / 2, r.y + r.h - 13); }
  }

  if (gs.shopMsgT > 0) {
    ctx.globalAlpha = Math.min(1, gs.shopMsgT);
    ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(gs.shopMsg, cw / 2, ch * 0.95);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

function drawPauseOverlay(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 42px monospace'; ctx.textAlign = 'center';
  ctx.fillText('❚❚ PAUSA', cw / 2, ch * 0.32);
  drawButton(ctx, resumeBtnRect(cw, ch), '#43a047', '▶  Continuar');
  drawButton(ctx, menuBtnRect(cw, ch), '#616161', '⌂  Menú');
  ctx.textAlign = 'left';
}

function drawTransition(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS) {
  const t = gs.transT;
  const a = t > 0.45 ? 1 - (t - 0.45) / 0.45 : t / 0.45;
  ctx.fillStyle = `rgba(8,6,20,${Math.min(1, a)})`;
  ctx.fillRect(0, 0, cw, ch);
  if (a > 0.5) {
    const lv = gs.transToLv;
    ctx.globalAlpha = (a - 0.5) * 2;
    ctx.textAlign = 'center';
    ctx.font = '58px serif';
    ctx.fillText(WORLD_ICONS[lv], cw / 2, ch * 0.44);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 30px monospace';
    ctx.fillText(`Mundo ${lv + 1}`, cw / 2, ch * 0.55);
    ctx.fillStyle = '#fff'; ctx.font = '18px monospace';
    ctx.fillText(WORLD_NAMES[lv], cw / 2, ch * 0.61);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

function render(ctx: CanvasRenderingContext2D, gs: GS, cw: number, ch: number) {
  ctx.clearRect(0, 0, cw, ch);

  if (gs.phase === 'shop') {
    drawShop(ctx, cw, ch, gs, gs.elapsed);
    return;
  }

  if (gs.phase === 'intro') {
    // Draw a nice background even on intro
    drawBackground(ctx, cw, ch, 'green', 0, gs.elapsed);
    drawIntro(ctx, cw, ch, gs);
    return;
  }

  const camX = gs.camX;

  // World
  drawBackground(ctx, cw, ch, gs.theme, camX, gs.elapsed);

  for (const p of gs.plats) drawPlatform(ctx, p, camX, gs.theme);
  for (const sp of gs.sps) drawSpike(ctx, sp, camX, gs.theme);
  for (let i = 0; i < gs.ckList.length; i++) drawCheckpoint(ctx, gs.ckList[i], gs.gY, camX, i < gs.nextCk, gs.elapsed);
  drawGoal(ctx, gs.gX, gs.gY, camX, gs.elapsed);
  for (const c of gs.cns) drawCoin(ctx, c, camX, gs.elapsed);
  if (gs.starCoin) drawStarCoin(ctx, gs.starCoin, camX, gs.elapsed);
  for (const e of gs.ens) drawEnemy(ctx, e, camX, gs.elapsed);

  if (gs.phase !== 'dead' || gs.phT > 0) {
    drawPlayer(ctx, gs, camX);
  }

  drawProjectiles(ctx, gs.projs, camX);
  drawParticles(ctx, gs.parts, camX);
  drawMessage(ctx, gs, camX);

  // HUD
  drawHUD(ctx, gs, cw);
  if (gs.entryLock || gs.phase === 'playing') drawTouchHints(ctx, cw, ch);

  // Overlays
  if (gs.phase === 'lvlDone') drawLvlDone(ctx, cw, ch, gs, gs.elapsed);
  if (gs.phase === 'gameOver') drawGameOver(ctx, cw, ch, gs, gs.elapsed);
  if (gs.phase === 'win') drawWin(ctx, cw, ch, gs, gs.elapsed);
  if (gs.phase === 'dead') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#e53935';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('¡Perdiste una vida!', cw / 2, ch / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';
    ctx.fillText(`Vidas restantes: ${gs.lives}`, cw / 2, ch / 2 + 35);
    ctx.textAlign = 'left';
  }

  // Transición entre mundos
  if (gs.phase === 'transition') drawTransition(ctx, cw, ch, gs);

  // Pausa
  if (gs.paused) drawPauseOverlay(ctx, cw, ch);

  // Flash de impacto (pantalla completa, siempre al final)
  if (gs.flashT > 0) {
    const fa = Math.min(0.6, gs.flashT * 4);
    ctx.fillStyle = gs.flashCol === '#fff'
      ? `rgba(255,255,255,${fa})`
      : `rgba(255,152,0,${fa * 0.7})`;
    ctx.fillRect(0, 0, cw, ch);
  }
}

// ── Physics helpers ────────────────────────────────────────────────────────────
function resolvePlatformsX(gs: GS) {
  for (const p of gs.plats) {
    const L = gs.px, R = gs.px + PW, T = gs.py, B = gs.py + PH;
    const pL = p.x, pR = p.x + p.w, pT = p.y, pB = p.y + p.h;
    if (R <= pL || L >= pR || B <= pT + 4 || T >= pB) continue;
    if (gs.pvx > 0 && R > pL && R - pL < 24) { gs.px = pL - PW; gs.pvx = 0; }
    else if (gs.pvx < 0 && L < pR && pR - L < 24) { gs.px = pR; gs.pvx = 0; }
  }
}

function resolvePlatformsY(gs: GS, dt: number) {
  for (const p of gs.plats) {
    const L = gs.px, R = gs.px + PW, T = gs.py, B = gs.py + PH;
    const pL = p.x, pR = p.x + p.w, pT = p.y, pB = p.y + p.h;
    if (R <= pL || L >= pR || B <= pT || T >= pB) continue;

    const prevB = B - gs.pvy * dt;
    const prevT = T - gs.pvy * dt;

    if (gs.pvy >= 0 && prevB <= pT + 4) {
      gs.py = pT - PH;
      gs.pvy = 0;
      gs.onG = true;
      gs.coyT = COYOTE;
    } else if (gs.pvy < 0 && prevT >= pB - 4) {
      gs.py = pB + 1;
      gs.pvy = 0;
    }
  }
}

function updateMovingPlatforms(gs: GS, dt: number) {
  for (const p of gs.plats) {
    if (p.spd <= 0) continue;
    p.x += p.dir * p.spd * dt;
    const over = p.x - p.origX;
    if (Math.abs(over) >= p.rng) {
      p.dir *= -1;
      p.x = p.origX + Math.sign(over) * p.rng; // snap al límite que se excedió
    }
  }
}

function updateEnemies(gs: GS, dt: number) {
  for (const e of gs.ens) {
    if (!e.alive) { e.stompT = Math.max(0, e.stompT - dt); continue; }

    if (e.type === 'monkey') {
      // Horizontal patrol
      e.x += e.vx * dt;
      if (e.x < e.patL) { e.x = e.patL; e.vx = Math.abs(e.vx); }
      if (e.x > e.patR) { e.x = e.patR; e.vx = -Math.abs(e.vx); }
      // Vertical jump
      e.vy += 900 * dt;
      e.y += e.vy * dt;
      if (e.y >= e.baseY) { e.y = e.baseY; e.vy = 0; }
      // Jump cooldown — when on ground (vy==0) count down
      if (e.vy === 0) {
        e.ft -= dt;
        if (e.ft <= 0) {
          e.vy = -360 - Math.random() * 60;
          e.ft = 2.2 + Math.random() * 1.8; // next jump cooldown
        }
      }
      // Walk animation frame
      e.fr = Math.floor(gs.elapsed * 6) % 2;

    } else if (e.type === 'plant') {
      // Spit seed cooldown
      e.ft -= dt;
      if (e.ft <= 0) {
        e.ft = 2.8 + Math.random() * 1.5;
        // Seed origin: mouth of plant (center-top of bounding box)
        const seedX = e.x + e.w / 2;
        const seedY = e.y + 14;
        // Direction toward player
        const dir = gs.px + PW / 2 > seedX ? 1 : -1;
        gs.projs.push({ x: seedX, y: seedY, vx: dir * 180, vy: -60, life: 2.2 });
      }
      // Gentle sway handled in draw (uses elapsed)

    } else {
      // spider, worm, espin — standard patrol
      e.x += e.vx * dt;
      if (e.x < e.patL) { e.x = e.patL; e.vx = Math.abs(e.vx); }
      if (e.x > e.patR) { e.x = e.patR; e.vx = -Math.abs(e.vx); }
      // Walk animation
      e.ft += dt;
      if (e.ft > 0.18) { e.fr = 1 - e.fr; e.ft = 0; }
    }
  }

  // Update projectiles (seeds)
  for (const p of gs.projs) {
    p.x += p.vx * dt;
    p.vy += 400 * dt; // slight gravity
    p.y += p.vy * dt;
    p.life -= dt;
  }
  gs.projs = gs.projs.filter(p => p.life > 0);
}

function checkEntities(gs: GS, cw: number, ch: number) {
  if (gs.phase !== 'playing') return;

  const pL = gs.px, pR = gs.px + PW, pT = gs.py, pB = gs.py + PH;
  const parts = THEME_PARTS[gs.theme];

  // Enemies
  for (const e of gs.ens) {
    if (!e.alive) continue;
    const eL = e.x, eR = e.x + e.w, eT = e.y, eB = e.y + e.h;
    if (pR <= eL || pL >= eR || pB <= eT || pT >= eB) continue;

    // Power-up estrella: destruye cualquier enemigo al tocarlo
    if (gs.starPowerT > 0) {
      e.alive = false; e.stompT = 0.5;
      gs.score += 300;
      sfxStomp();
      spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, '#fff', 10, parts);
      gs.msg = '+300'; gs.msgT = 0.6;
      continue;
    }
    if (gs.invT > 0) continue;

    // espin no se puede pisar — las púas siempre dañan
    if (e.type === 'espin') { loseLife(gs); return; }
    // Stomp: jugador cayendo, base cerca del tope del enemigo
    if (gs.pvy > 0 && pB < eT + e.h * 0.45) {
      e.alive = false;
      e.stompT = 0.5;
      gs.pvy = -420;
      // Rebote en cadena
      gs.comboN = gs.comboT > 0 ? gs.comboN + 1 : 1;
      gs.comboT = 0.7;
      const pts = 200 * gs.comboN;
      gs.score += pts;
      gs.flashT = 0.06; gs.flashCol = '#ff9800';   // flash naranja
      gs.hitStop = 0.05;
      if (gs.comboN > 1) { sfxCombo(gs.comboN); gs.msg = `COMBO x${gs.comboN}  +${pts}`; }
      else { sfxStomp(); gs.msg = `+${pts}`; }
      gs.msgT = 0.8;
      spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, '#f97316', 8, parts);
    } else {
      loseLife(gs);
      return;
    }
  }

  // Coins
  for (const c of gs.cns) {
    if (c.got) continue;
    const bob = Math.sin(gs.elapsed * 3 + c.x * 0.01) * 4;
    const cr = 10;
    if (pR > c.x - cr && pL < c.x + cr && pB > c.y + bob - cr && pT < c.y + bob + cr) {
      c.got = true;
      gs.score += 100;
      gs.coins++;
      gs.lvlCoins++;
      sfxCoin();
      spawnParticles(gs, c.x, c.y, '#ffd700', 6, parts);
      gs.msg = '+100'; gs.msgT = 0.6;
    }
  }

  // Moneda especial → power-up estrella
  if (gs.starCoin && !gs.starCoin.got) {
    const sc = gs.starCoin;
    const bob = Math.sin(gs.elapsed * 3) * 4;
    if (pR > sc.x - 14 && pL < sc.x + 14 && pB > sc.y + bob - 14 && pT < sc.y + bob + 14) {
      sc.got = true;
      gs.starPowerT = 6;
      gs.score += 250;
      sfxPower();
      spawnParticles(gs, sc.x, sc.y, '#fff', 16, ['#ff1744', '#ff9800', '#ffeb3b', '#00e676', '#2979ff', '#d500f9']);
      gs.msg = '¡INVENCIBLE!'; gs.msgT = 1.2;
    }
  }

  // Spikes
  if (gs.invT <= 0) {
    for (const sp of gs.sps) {
      const spT = sp.y - 18, spB = sp.y;
      if (pR > sp.x && pL < sp.x + sp.w && pB > spT && pT < spB) {
        loseLife(gs);
        return;
      }
    }
  }

  // Projectiles (plant seeds)
  if (gs.invT <= 0) {
    for (const pr of gs.projs) {
      if (pR > pr.x - 6 && pL < pr.x + 6 && pB > pr.y - 6 && pT < pr.y + 6) {
        pr.life = 0; // destroy seed
        loseLife(gs);
        return;
      }
    }
  }

  // Checkpoints
  while (gs.nextCk < gs.ckList.length && gs.px + PW / 2 > gs.ckList[gs.nextCk]) {
    gs.ckX = gs.ckList[gs.nextCk];
    gs.ckY = gs.onG ? gs.py : gs.gY - PH;
    gs.nextCk++;
    spawnParticles(gs, gs.ckX, gs.gY - 50, '#00e676', 8);
    gs.msg = '¡Punto de control!'; gs.msgT = 1.2;
  }

  // Goal
  if (gs.px + PW > gs.gX) {
    const pct = gs.totalLvlCoins > 0 ? gs.lvlCoins / gs.totalLvlCoins : 0;
    const earned = pct >= 0.9 ? 3 : pct >= 0.5 ? 2 : 1;
    gs.stars[gs.lv] = Math.max(gs.stars[gs.lv], earned);
    gs.phase = 'lvlDone';
    gs.phT = 2.5;
    gs.score += 500;
    sfxLevel();
    spawnParticles(gs, gs.gX, gs.gY - 40, '#69f0ae', 16);
    writeSave(gs);
  }

  // Fall off — caer al vacío siempre mata (ignora invencibilidad y power-up)
  if (gs.py > ch + 80) {
    gs.invT = 0; gs.starPowerT = 0;
    loseLife(gs);
  }
}

// ── Main update ────────────────────────────────────────────────────────────────
function deriveInput(gs: GS, cw: number) {
  // inp.L/R already reset by the game loop before this call — just OR in touch state
  for (const [, td] of gs.tMap) {
    if (td.cx < cw * 0.42) gs.inp.L = true;
    else if (td.cx > cw * 0.58) gs.inp.R = true;
  }
}

function update(gs: GS, dt: number, cw: number, ch: number) {
  gs.elapsed += dt;
  gs.msgT = Math.max(0, gs.msgT - dt);
  gs.phT = Math.max(0, gs.phT - dt);
  gs.shopMsgT = Math.max(0, gs.shopMsgT - dt);
  // Timers de mejoras (tiempo de juego)
  gs.comboT = Math.max(0, gs.comboT - dt);
  if (gs.comboT <= 0) gs.comboN = 0;
  gs.starPowerT = Math.max(0, gs.starPowerT - dt);

  if (gs.phase === 'intro' || gs.phase === 'gameOver' || gs.phase === 'win'
    || gs.phase === 'shop' || gs.phase === 'transition') return;

  if (gs.phase === 'lvlDone') {
    updateParticles(gs, dt);
    if (gs.phT <= 0) {
      // Auto-advance after timer (tap also triggers this)
    }
    return;
  }

  if (gs.phase === 'dead') {
    // Death animation
    gs.py += gs.pvy * dt;
    gs.pvy = Math.min(gs.pvy + GRAV * dt, 900);
    updateParticles(gs, dt);
    if (gs.phT <= 0) respawn(gs);
    return;
  }

  // === PLAYING ===
  deriveInput(gs, cw);

  // Animación de entrada: ignora input hasta aterrizar
  if (gs.entryLock) {
    gs.inp.L = false; gs.inp.R = false; gs.inp.J = false;
  }

  const speed = gs.runT > 0 ? RUN_V : WALK_V;

  // Horizontal velocity
  if (gs.inp.L) { gs.pvx = -speed; gs.fR = false; }
  else if (gs.inp.R) { gs.pvx = speed; gs.fR = true; }
  else { gs.pvx *= gs.onG ? 0.60 : 0.90; if (Math.abs(gs.pvx) < 5) gs.pvx = 0; }

  // Gravity
  gs.pvy = Math.min(gs.pvy + GRAV * dt, 900);

  // Jump
  if (gs.inp.J) {
    const canJump = gs.onG || gs.coyT > 0;
    if (canJump) {
      gs.pvy = JMP_V * gs.jumpStrength;  // salto variable (touch: por fuerza del swipe)
      gs.onG = false;
      gs.coyT = 0;
      gs.sqT = 0.12; gs.sqDir = 1;
      sfxJump();
    }
    gs.inp.J = false;
    gs.jumpStrength = 1; // reset para el siguiente salto
  }

  // Salto variable por teclado: si no se mantiene arriba, recorta el ascenso
  if (gs.pvy < 0 && !gs.jumpHeld && !gs.touchJump) {
    gs.pvy = Math.max(gs.pvy, JMP_V * 0.35);
  }
  if (gs.onG) gs.touchJump = false;

  // Timers
  gs.onG = false;
  gs.coyT = Math.max(0, gs.coyT - dt);
  gs.runT = Math.max(0, gs.runT - dt);
  gs.invT = Math.max(0, gs.invT - dt);

  // Update moving platforms first
  updateMovingPlatforms(gs, dt);

  // Move X
  gs.px += gs.pvx * dt;
  gs.px = Math.max(0, gs.px);
  resolvePlatformsX(gs);

  // Move Y
  gs.py += gs.pvy * dt;
  resolvePlatformsY(gs, dt);

  // Squash on land
  if (!gs.prevOnG && gs.onG) { gs.sqT = 0.14; gs.sqDir = -1; }
  gs.prevOnG = gs.onG;
  gs.sqT = Math.max(0, gs.sqT - dt);

  // Fin de la animación de entrada: al aterrizar suelta el polvo y habilita control
  if (gs.entryLock) {
    gs.entryT = Math.max(0, gs.entryT - dt);
    if (gs.onG || gs.entryT <= 0) {
      gs.entryLock = false;
      // Nube de polvo al aterrizar
      for (let i = 0; i < 10; i++) {
        const a = Math.PI + (Math.random() - 0.5) * Math.PI;
        const spd = 60 + Math.random() * 100;
        gs.parts.push({
          x: gs.px + PW / 2, y: gs.py + PH,
          vx: Math.cos(a) * spd, vy: -Math.random() * 80,
          life: 0.4 + Math.random() * 0.3, ml: 0.7,
          col: 'rgba(180,150,110,0.8)', r: 3 + Math.random() * 3,
        });
      }
    }
  }

  // Entity checks
  checkEntities(gs, cw, ch);

  // Enemies
  updateEnemies(gs, dt);

  // Particles
  updateParticles(gs, dt);

  // Camera
  const targetCamX = gs.px - cw * CAM_LEAD;
  gs.camX += (targetCamX - gs.camX) * CAM_LERP;
  gs.camX = Math.max(0, Math.min(gs.lW - cw, gs.camX));

  // Player animation state
  if (gs.phase === 'playing') {
    if (gs.onG) gs.ps = Math.abs(gs.pvx) > 20 ? 'run' : 'idle';
    else gs.ps = gs.pvy < 0 ? 'jump' : 'fall';

    gs.aft += dt;
    if (gs.ps === 'run' && gs.aft > 0.12) { gs.afr = 1 - gs.afr; gs.aft = 0; }
    if (gs.ps !== 'run') gs.aft = 0;

    // Footstep sound — interval scales with speed
    if (gs.onG && Math.abs(gs.pvx) > 20) {
      gs.stepT -= dt;
      if (gs.stepT <= 0) {
        sfxStep();
        gs.stepT = gs.runT > 0 ? 0.14 : 0.22; // faster steps when running
      }
    } else {
      gs.stepT = 0; // reset so first step fires immediately on move
    }
  }
}

function updateParticles(gs: GS, dt: number) {
  for (const p of gs.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += GRAV * 0.3 * dt;
    p.life -= dt;
  }
  gs.parts = gs.parts.filter(p => p.life > 0);
}

// ── Hit regions (compartidas entre render y handlers) ──────────────────────────
type Rect = { x: number; y: number; w: number; h: number };
function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
function pauseBtnRect(cw: number): Rect { return { x: cw - 46, y: 11, w: 34, h: 34 }; }
function shopBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 115, y: ch * 0.895, w: 230, h: 48 }; }
function backBtnRect(): Rect { return { x: 18, y: 16, w: 96, h: 40 }; }
function liveBuyBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 90, y: ch * 0.225, w: 180, h: 40 }; }
function skinCardRect(cw: number, ch: number, i: number): Rect {
  const cardW = Math.min(190, cw * 0.42), cardH = 148, gapX = 18, gapY = 18;
  const x0 = cw / 2 - (2 * cardW + gapX) / 2;
  const col = i % 2, row = Math.floor(i / 2);
  return { x: x0 + col * (cardW + gapX), y: ch * 0.305 + row * (cardH + gapY), w: cardW, h: cardH };
}
function resumeBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 110, y: ch * 0.46, w: 220, h: 52 }; }
function menuBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 110, y: ch * 0.58, w: 220, h: 52 }; }

// ── React component ────────────────────────────────────────────────────────────
export default function PixelRunGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Pantalla de carga mientras se obtiene levels.json desde /public/
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Cargando…', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';

    let rafId = 0;
    let alive = true;
    let cleanupHandlers: (() => void) | null = null;

    initWorldDefs().then(() => {
      if (!alive) return;

    const gs = initGS(canvas.width, canvas.height);

    // ── Helpers de navegación (compartidos por touch/click/teclado) ──────────
    const startLevel = (lv: number) => { loadLevel(gs, lv, canvas.height); gs.phase = 'playing'; gs.paused = false; };
    const beginTransition = (toLv: number) => { gs.phase = 'transition'; gs.transT = 0.9; gs.transToLv = toLv; };
    const resetToIntro = () => {
      writeSave(gs);
      gs.lives = 3; gs.score = 0; gs.paused = false;
      gs.gY = canvas.height - 70; gs.phase = 'intro';
    };
    const buyOrEquip = (i: number) => {
      if (gs.owned.includes(i)) {
        gs.skin = i; writeSave(gs);
        gs.shopMsg = `${SKINS[i].name} equipado`; gs.shopMsgT = 2;
      } else if (gs.coins >= SKINS[i].price) {
        gs.coins -= SKINS[i].price; gs.owned.push(i); gs.skin = i; writeSave(gs);
        sfxBuy(); gs.shopMsg = `¡${SKINS[i].name} desbloqueado!`; gs.shopMsgT = 2.5;
      } else {
        gs.shopMsg = 'Monedas insuficientes'; gs.shopMsgT = 2;
      }
    };
    const handleTap = (x: number, y: number) => {
      const cw = canvas.width, ch = canvas.height;
      // Pausa activa: prioridad a sus botones
      if (gs.paused) {
        if (inRect(x, y, resumeBtnRect(cw, ch))) gs.paused = false;
        else if (inRect(x, y, menuBtnRect(cw, ch))) resetToIntro();
        return;
      }
      if (gs.phase === 'intro') {
        if (inRect(x, y, shopBtnRect(cw, ch))) { gs.phase = 'shop'; return; }
        startLevel(0);
      } else if (gs.phase === 'shop') {
        if (inRect(x, y, backBtnRect())) { writeSave(gs); gs.phase = 'intro'; return; }
        if (inRect(x, y, liveBuyBtnRect(cw, ch))) {
          if (gs.lives < MAX_LIVES && gs.coins >= LIFE_COST) {
            gs.coins -= LIFE_COST; gs.lives++; writeSave(gs);
            sfxBuy(); gs.shopMsg = `♥ +1 vida (${gs.lives}/${MAX_LIVES})`; gs.shopMsgT = 2;
          } else if (gs.lives >= MAX_LIVES) {
            gs.shopMsg = `Ya tenés el máximo de vidas`; gs.shopMsgT = 2;
          } else {
            gs.shopMsg = 'Monedas insuficientes'; gs.shopMsgT = 2;
          }
          return;
        }
        for (let i = 0; i < SKINS.length; i++) {
          if (inRect(x, y, skinCardRect(cw, ch, i))) { buyOrEquip(i); return; }
        }
      } else if (gs.phase === 'playing') {
        if (inRect(x, y, pauseBtnRect(cw))) gs.paused = true;
      } else if (gs.phase === 'lvlDone') {
        const next = gs.lv + 1;
        if (next >= 7) { writeSave(gs); gs.phase = 'win'; }
        else beginTransition(next);
      } else if (gs.phase === 'gameOver' || gs.phase === 'win') {
        resetToIntro();
      }
    };

    // Touch handlers
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const cw = canvas.width;
      for (const touch of Array.from(e.changedTouches)) {
        const td: TD = { sx: touch.clientX, sy: touch.clientY, cx: touch.clientX, cy: touch.clientY, t: Date.now() };
        gs.tMap.set(touch.identifier, td);

        // Double tap detection
        const side = touch.clientX < cw * 0.42 ? 'L' : touch.clientX > cw * 0.58 ? 'R' : null;
        if (side) {
          const now = Date.now();
          if (now - gs.ltap[side] < DBL_MS) {
            gs.runT = RUN_DUR;
          }
          gs.ltap[side] = now;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        const td = gs.tMap.get(touch.identifier);
        if (td) { td.cx = touch.clientX; td.cy = touch.clientY; }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        const td = gs.tMap.get(touch.identifier);
        if (td) {
          const dx = td.cx - td.sx;
          const dy = td.cy - td.sy;
          const elapsed = Date.now() - td.t;

          // Swipe up = salto variable (fuerza según magnitud del swipe)
          if (dy < -55 && Math.abs(dx) < 90 && elapsed < 400) {
            const mag = Math.min(1, (-dy) / 150);        // 55..150px → 0..1
            gs.jumpStrength = 0.62 + mag * 0.38;          // 0.62..1.0
            gs.inp.J = true;
            gs.touchJump = true;                          // exime del recorte por teclado
          }
          // Tap = navegación de UI
          else if (Math.abs(dx) < 30 && Math.abs(dy) < 30 && elapsed < 350) {
            handleTap(td.sx, td.sy);
          }

          gs.tMap.delete(touch.identifier);
        }
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    // Click para desktop → misma navegación que el tap
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      handleTap(e.clientX - r.left, e.clientY - r.top);
    });

    // ── Keyboard (opcional — funciona junto al touch) ──────────────────────
    const keys = new Set<string>();

    const keyAdvance = () => {
      if (gs.paused) { gs.paused = false; return; }
      if (gs.phase === 'intro') startLevel(0);
      else if (gs.phase === 'shop') { writeSave(gs); gs.phase = 'intro'; }
      else if (gs.phase === 'lvlDone') {
        const next = gs.lv + 1;
        if (next >= 7) { writeSave(gs); gs.phase = 'win'; }
        else beginTransition(next);
      } else if (gs.phase === 'gameOver' || gs.phase === 'win') resetToIntro();
    };

    const GAME_KEYS = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
      'a','A','d','D','w','W',' ','Shift','Enter','Escape','p','P']);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!GAME_KEYS.has(e.key)) return;
      e.preventDefault();
      const isRepeat = keys.has(e.key);
      keys.add(e.key);

      // Pausa con P/Escape durante el juego
      if (gs.phase === 'playing' && !gs.paused) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { gs.paused = true; return; }
        // Salto en el flanco de bajada (evita auto-hop por key-repeat)
        if (!isRepeat && (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W')) {
          gs.jumpStrength = 1; gs.inp.J = true;
        }
        return;
      }
      // Fases de menú / pausa
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') keyAdvance();
    };

    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.key); };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    cleanupHandlers = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };

    // Sincroniza teclas sostenidas cada frame
    const syncKeyboard = () => {
      if (gs.phase !== 'playing' || gs.paused) { gs.jumpHeld = false; return; }
      gs.inp.L = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
      gs.inp.R = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
      gs.jumpHeld = keys.has('ArrowUp') || keys.has('w') || keys.has('W') || keys.has(' ');
      if (keys.has('Shift')) gs.runT = Math.max(gs.runT, 0.15);
    };

    let lastT = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      const cw = canvas.width, ch = canvas.height;

      // El flash decae en tiempo real (incluso durante hit-stop)
      gs.flashT = Math.max(0, gs.flashT - dt);

      // Hit-stop: congela el mundo brevemente para dar "peso" al impacto
      if (gs.hitStop > 0) {
        gs.hitStop -= dt;
        render(ctx, gs, cw, ch);
        rafId = requestAnimationFrame(loop);
        return;
      }

      // Pausa: no actualiza, solo renderiza el overlay
      if (gs.paused) {
        render(ctx, gs, cw, ch);
        rafId = requestAnimationFrame(loop);
        return;
      }

      // Transición entre mundos: fade out → carga → fade in
      if (gs.phase === 'transition') {
        gs.transT -= dt;
        if (gs.transT <= 0.45 && gs.lv !== gs.transToLv) loadLevel(gs, gs.transToLv, ch);
        if (gs.transT <= 0) gs.phase = 'playing';
        render(ctx, gs, cw, ch);
        rafId = requestAnimationFrame(loop);
        return;
      }

      // Reset input direccional cada frame (teclado + touch se suman)
      gs.inp.L = false;
      gs.inp.R = false;
      syncKeyboard();
      update(gs, dt, cw, ch);
      render(ctx, gs, cw, ch);
      rafId = requestAnimationFrame(loop);
    };
      rafId = requestAnimationFrame((t) => { lastT = t; rafId = requestAnimationFrame(loop); });
    });

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      cleanupHandlers?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', touchAction: 'none', userSelect: 'none', background: '#000' }}
    />
  );
}
