"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getSkin, SKINS, Skin } from "./skins";
import { loadSave, persistSave, coinsForDistance, Save } from "./save";

/* ══════════════════════════════════════════════════════════
   IMAGEN — eliminar fondo blanco
   ══════════════════════════════════════════════════════════ */
function removeWhiteBg(img: HTMLImageElement): HTMLCanvasElement {
  const oc  = document.createElement("canvas");
  oc.width  = img.naturalWidth;
  oc.height = img.naturalHeight;
  const ctx = oc.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, oc.width, oc.height);
  const px   = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 190 && sat < 60) {
      px[i + 3] = Math.round(Math.max(0, (1 - (min - 190) / 65)) * px[i + 3]);
    }
  }
  ctx.putImageData(data, 0, 0);
  return oc;
}

/* ══════════════════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════════════════ */
const BASE_SPEED     = 260;
const SPEED_STEP     = 32;
const MILESTONE      = 10;
const BASE_SPAWN     = 1600;
const MIN_SPAWN      = 320;
const SPAWN_STEP     = 65;
const LANE_INTERVAL  = 30;
const COIN_SPAWN_MS  = 13000;
const COIN_REWARD    = 100;
const LANE_LERP      = 2.8;
const WAVE_MULT      = 3.5;
const MAX_LANES      = 5;
const INIT_LANES     = 3;
const CAR_W_RATIO    = 0.68;
const CAR_ASPECT     = 1.88;
const PLAYER_Y_FR    = 0.76;
const LERP_SPEED     = 12;
const SWIPE_PX       = 30;
const DASH_LEN       = 34;
const DASH_GAP       = 52;
const SHOP_HEADER_H  = 68;
const SHOP_FOOTER_H  = 54;
const SHOP_CARD_H    = 108;
const SHOP_GAP       = 7;

const ENEMY_COLORS = ["#ff3a3a","#ff8a00","#ffd600","#00e676","#e040fb","#40c4ff","#ff6b9d"];
const ROAD_BG      = "#1c1c2a";
const CURB_BG      = "#111118";
const EDGE_CLR     = "rgba(255,255,255,0.88)";

const SHOW_ENCOURAGEMENTS = true;
const RAND_MSGS = [
  "¡Vas increíble!", "¡Sin miedo!", "¡Qué reflejos!", "¡Sigue así!",
  "¡Eres imparable!", "¡A toda velocidad!", "¡Nada te para!",
  "¡Qué manejo!", "¡No te detengas!", "¡Máquina!",
  "¡Esquiva todo!", "¡Velocidad total!", "¡Así se hace!",
];
const DIST_MSGS: [number, string][] = [
  [200,  "¡200 metros!"],
  [500,  "¡500 m — Excelente!"],
  [1000, "¡1 kilómetro! ¡Brutal!"],
  [2000, "¡2 km! ¡Leyenda!"],
  [5000, "¡5 km! ¡Imparable!"],
];
const LANE_MSGS = ["¡Nuevo carril!", "¡El tráfico crece!", "¡A adaptarse!"];

/* ══════════════════════════════════════════════════════════
   TIPOS
   ══════════════════════════════════════════════════════════ */
type Phase = "loading" | "intro" | "playing" | "dead" | "shop";

interface Enemy { id: number; lane: number; y: number; color: string; }
interface Coin  { id: number; lane: number; y: number; }
interface Msg   { text: string; life: number; maxLife: number; y: number; }

interface GS {
  phase: Phase;
  playerLane: number;
  animLane: number;
  enemies: Enemy[];
  distance: number;
  speed: number;
  numLanes: number;
  dashOffset: number;
  spawnTimer: number;
  spawnInterval: number;
  nextId: number;
  milestone: number;
  highScore: number;
  lastTime: number;
  expanded: number;
  timeElapsed: number;
  animLanes: number;
  waveTimer: number;
  msgs: Msg[];
  nextRandMsg: number;
  lastDistMsg: number;
  lastSpawnLane: number;
  roadCoins: Coin[];
  coinTimer: number;
  pendingCoins: number;
  hasRevive: boolean;
  flashTimer: number;
  loadPct: number;
  shopScrollY: number;
  shopScrollVel: number;   // px/s — momentum de scroll
  shopReturnPhase: "intro" | "dead";
}

type BtnBounds = { bx: number; by: number; bw: number; bh: number };
interface ShopBtn    { skinId: string; bx: number; by: number; bw: number; bh: number; }
interface ShopResult { btns: ShopBtn[]; closeBtn: BtnBounds; maxScroll: number; }
interface OverBtns   { retry: BtnBounds; shop: BtnBounds; }

/* ══════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════ */
function makeGS(hs = 0): GS {
  return {
    phase: "loading",
    playerLane: Math.floor(INIT_LANES / 2), animLane: Math.floor(INIT_LANES / 2),
    enemies: [], distance: 0, speed: BASE_SPEED, numLanes: INIT_LANES, dashOffset: 0,
    spawnTimer: 0, spawnInterval: BASE_SPAWN, nextId: 0, milestone: 0,
    highScore: hs, lastTime: 0, expanded: 0, timeElapsed: 0,
    animLanes: INIT_LANES, waveTimer: 0,
    msgs: [], nextRandMsg: 10000 + Math.random() * 5000, lastDistMsg: 0,
    lastSpawnLane: Math.floor(INIT_LANES / 2),
    roadCoins: [], coinTimer: COIN_SPAWN_MS * 0.5, pendingCoins: 0,
    hasRevive: false, flashTimer: 0,
    loadPct: 0, shopScrollY: 0, shopScrollVel: 0, shopReturnPhase: "intro",
  };
}

function hexRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function pushMsg(gs: GS, text: string, H: number) {
  if (!SHOW_ENCOURAGEMENTS) return;
  // Máximo 2 mensajes simultáneos
  if (gs.msgs.length >= 2) gs.msgs.shift();
  // Cada mensaje nuevo arranca DEBAJO del último para no pisarse
  const baseY   = H * 0.37;
  const spacing = 38;
  const startY  = gs.msgs.length > 0
    ? Math.max(...gs.msgs.map(m => m.y)) + spacing
    : baseY;
  gs.msgs.push({ text, life: 2400, maxLife: 2400, y: Math.min(startY, H * 0.56) });
}

function rainbowGlow(time: number): { color: string; blur: number } {
  const hue   = (time / 2600 * 360) % 360;
  const pulse = 0.5 + 0.5 * Math.sin(time / 1300 * Math.PI);
  return { color: `hsl(${hue},100%,58%)`, blur: 16 + pulse * 16 };
}

function geo(numLanes: number, W: number) {
  const roadW = Math.min(W * 0.84, 390);
  const roadX = (W - roadW) / 2;
  const laneW = roadW / numLanes;
  const carW  = laneW * CAR_W_RATIO;
  const carH  = carW * CAR_ASPECT;
  return { roadW, roadX, laneW, carW, carH };
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,    y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — LOADING
   ══════════════════════════════════════════════════════════ */
function drawLoading(ctx: CanvasRenderingContext2D, gs: GS, W: number, H: number) {
  ctx.fillStyle = CURB_BG;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  ctx.textAlign   = "center";
  ctx.shadowColor = "rgba(255,200,0,0.5)";
  ctx.shadowBlur  = 24;
  ctx.fillStyle   = "#ffd700";
  ctx.font        = `bold ${Math.min(W * 0.11, 46)}px system-ui, sans-serif`;
  ctx.fillText("ROAD RUSH", cx, H * 0.38);
  ctx.shadowBlur  = 0;

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font      = "13px system-ui, sans-serif";
  ctx.fillText("Preparando el juego...", cx, H * 0.38 + 38);

  const bw = Math.min(W * 0.7, 280), bh = 8;
  const bx = cx - bw / 2, by = H * 0.55;

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  rrect(ctx, bx, by, bw, bh, 4);
  ctx.fill();

  if (gs.loadPct > 0) {
    const filled = bw * Math.min(1, gs.loadPct);
    const grad   = ctx.createLinearGradient(bx, by, bx + filled, by);
    grad.addColorStop(0, "#ff6b35");
    grad.addColorStop(1, "#f7c500");
    ctx.fillStyle   = grad;
    ctx.shadowColor = "rgba(255,200,0,0.5)";
    ctx.shadowBlur  = 8;
    rrect(ctx, bx, by, filled, bh, 4);
    ctx.fill();
    ctx.shadowBlur  = 0;
  }

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font      = "11px system-ui, sans-serif";
  ctx.fillText(`${Math.round(gs.loadPct * 100)}%`, cx, by + 24);
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — AUTO
   ══════════════════════════════════════════════════════════ */
function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  bodyColor: string, isPlayer: boolean,
  glowColor   = "#00aaff",
  accentColor = "rgba(0,212,255,0.55)",
  glowBlur    = 20,
) {
  const r = w * 0.14;
  if (isPlayer) { ctx.shadowColor = glowColor; ctx.shadowBlur = glowBlur; }
  ctx.fillStyle = bodyColor;
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  const roofW = w * 0.54, roofH = h * 0.4;
  ctx.fillStyle = isPlayer ? "rgba(0,15,30,0.78)" : "rgba(0,0,0,0.48)";
  rrect(ctx, cx - roofW / 2, cy - roofH / 2, roofW, roofH, r * 0.55);
  ctx.fill();
  ctx.fillStyle = isPlayer ? "rgba(255,255,255,0.18)" : "rgba(140,200,255,0.22)";
  ctx.fillRect(cx - w * 0.26, cy - h * 0.38, w * 0.52, h * 0.11);
  ctx.fillStyle = isPlayer ? "rgba(255,255,180,0.95)" : "rgba(255,55,55,0.9)";
  ctx.fillRect(cx - w * 0.32, cy + h * 0.37, w * 0.12, h * 0.09);
  ctx.fillRect(cx + w * 0.20, cy + h * 0.37, w * 0.12, h * 0.09);
  if (isPlayer) {
    ctx.strokeStyle = accentColor;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.42);
    ctx.lineTo(cx, cy + h * 0.42);
    ctx.stroke();
  }
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — ESCENA
   ══════════════════════════════════════════════════════════ */
function drawScene(
  ctx: CanvasRenderingContext2D,
  gs: GS, W: number, H: number,
  skin: Skin,
  playerImg: HTMLCanvasElement | null,
  time = 0,
) {
  const { roadW, roadX, laneW, carW, carH } = geo(gs.animLanes, W);

  ctx.fillStyle = CURB_BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ROAD_BG;
  ctx.fillRect(roadX, 0, roadW, H);

  const dashTotal = DASH_LEN + DASH_GAP;
  const offset    = gs.dashOffset % dashTotal;
  ctx.lineWidth   = 2.5;
  ctx.setLineDash([DASH_LEN, DASH_GAP]);
  ctx.lineDashOffset = -offset;
  for (let i = 1; i < gs.numLanes; i++) {
    const lx    = roadX + i * laneW;
    const alpha = i < gs.numLanes - 1
      ? 0.5
      : 0.5 * Math.min(1, gs.animLanes - (gs.numLanes - 1));
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  ctx.strokeStyle = EDGE_CLR;
  ctx.lineWidth   = 3;
  ctx.beginPath(); ctx.moveTo(roadX,         0); ctx.lineTo(roadX,         H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(roadX + roadW, 0); ctx.lineTo(roadX + roadW, H); ctx.stroke();

  for (const e of gs.enemies) {
    drawCar(ctx, roadX + (e.lane + 0.5) * laneW, e.y, carW, carH, e.color, false);
  }

  const px = roadX + (gs.animLane + 0.5) * laneW;
  const py = H * PLAYER_Y_FR;
  const rg         = skin.animStyle === "rainbow" ? rainbowGlow(time) : null;
  const activeGlow = rg ? rg.color : skin.glowColor;
  const activeBlur = rg ? rg.blur  : 24;

  if (playerImg) {
    ctx.save();
    ctx.shadowColor = activeGlow;
    ctx.shadowBlur  = activeBlur;
    ctx.drawImage(playerImg, px - carW / 2, py - carH / 2, carW, carH);
    ctx.shadowBlur  = 0;
    ctx.restore();
  } else {
    drawCar(ctx, px, py, carW, carH, skin.bodyColor, true, activeGlow, skin.accentColor, activeBlur);
  }

  if (gs.flashTimer > 0) {
    const a = Math.min(1, gs.flashTimer / 250) * 0.65;
    ctx.fillStyle = `rgba(210,220,255,${a})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawCoins(ctx, gs, roadX, laneW, carW, time);
  drawHUD(ctx, gs, W, H);
  drawMessages(ctx, gs, W);
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — MONEDAS
   ══════════════════════════════════════════════════════════ */
function drawCoins(
  ctx: CanvasRenderingContext2D, gs: GS,
  roadX: number, laneW: number, carW: number, time: number,
) {
  if (gs.roadCoins.length === 0) return;
  const radius = carW * 0.26;
  for (const coin of gs.roadCoins) {
    const cx    = roadX + (coin.lane + 0.5) * laneW;
    const cy    = coin.y;
    const pulse = 0.88 + 0.12 * Math.sin(time / 380 + coin.id * 1.3);
    const r     = radius * pulse;
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur  = 14 * pulse;
    ctx.fillStyle   = `hsl(${46 + 12 * Math.sin(time / 600 + coin.id)}, 100%, 52%)`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = "rgba(255,255,210,0.55)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy - r * 0.22, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(120,60,0,0.88)";
    ctx.font      = `bold ${Math.round(r * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("M", cx, cy + r * 0.38);
  }
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — MENSAJES
   ══════════════════════════════════════════════════════════ */
function drawMessages(ctx: CanvasRenderingContext2D, gs: GS, W: number) {
  if (!SHOW_ENCOURAGEMENTS || gs.msgs.length === 0) return;
  ctx.textAlign = "center";
  ctx.font      = "bold 15px system-ui, sans-serif";
  for (const m of gs.msgs) {
    const t = m.life / m.maxLife;
    let alpha: number;
    if (t > 0.885)    alpha = (1 - t) / 0.115;
    else if (t < 0.23) alpha = t / 0.23;
    else               alpha = 1;
    const tw = ctx.measureText(m.text).width;
    const pw = tw + 28, ph = 30;
    const bx = W / 2 - pw / 2, by = m.y - ph / 2;
    ctx.fillStyle = `rgba(0,0,0,${0.55 * alpha})`;
    rrect(ctx, bx, by, pw, ph, 15);
    ctx.fill();
    ctx.shadowColor = `rgba(255,210,0,${0.45 * alpha})`;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = `rgba(255,215,0,${alpha})`;
    ctx.fillText(m.text, W / 2, m.y + 5);
    ctx.shadowBlur  = 0;
  }
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — HUD
   ══════════════════════════════════════════════════════════ */
function drawHUD(ctx: CanvasRenderingContext2D, gs: GS, W: number, H: number) {
  const cx = W / 2;
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  rrect(ctx, cx - 70, 12, 140, 52, 12);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd700";
  ctx.font      = "bold 26px system-ui, sans-serif";
  ctx.fillText(`${Math.floor(gs.distance)} m`, cx, 45);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font      = "10px system-ui, sans-serif";
  ctx.fillText("DISTANCIA", cx, 57);

  const spd = Math.round(gs.speed / 10);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  rrect(ctx, W - 94, H - 40, 82, 28, 9);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font      = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`vel. ${spd}`, W - 14, H - 21);

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  rrect(ctx, 12, H - 40, 90, 28, 9);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.textAlign = "left";
  ctx.fillText(`${gs.numLanes} carriles`, 20, H - 21);

  if (gs.hasRevive) {
    const rx = W - 94, ry = H - 76, rw = 82, rh = 28;
    ctx.fillStyle = "rgba(180,190,255,0.15)";
    rrect(ctx, rx, ry, rw, rh, 9);
    ctx.fill();
    ctx.strokeStyle = "rgba(200,210,255,0.55)";
    ctx.lineWidth   = 1;
    rrect(ctx, rx, ry, rw, rh, 9);
    ctx.stroke();
    ctx.shadowColor = "rgba(180,200,255,0.7)";
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = "rgba(220,230,255,0.9)";
    ctx.font        = "bold 10px system-ui, sans-serif";
    ctx.textAlign   = "right";
    ctx.fillText("REVIVE", W - 14, ry + 18);
    ctx.shadowBlur  = 0;
  }
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — INTRO
   ══════════════════════════════════════════════════════════ */
function drawIntro(
  ctx: CanvasRenderingContext2D, gs: GS, W: number, H: number, coins: number,
): { play: BtnBounds; shop: BtnBounds } {
  ctx.fillStyle = "rgba(0,0,0,0.64)";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  ctx.textAlign   = "center";
  ctx.shadowColor = "rgba(255,200,0,0.5)";
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = "#ffd700";
  ctx.font        = `bold ${Math.min(W * 0.115, 50)}px system-ui, sans-serif`;
  ctx.fillText("ROAD RUSH", cx, H * 0.27);
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = "rgba(255,255,255,0.52)";
  ctx.font        = `${Math.min(W * 0.038, 15)}px system-ui, sans-serif`;
  ctx.fillText("Esquiva el tráfico · Sobrevive el máximo", cx, H * 0.27 + 36);
  ctx.fillStyle   = "rgba(255,255,255,0.32)";
  ctx.font        = "13px system-ui, sans-serif";
  ctx.fillText("← → para cambiar de carril", cx, H * 0.5);
  ctx.fillText("desliza o toca izquierda / derecha", cx, H * 0.5 + 22);
  if (gs.highScore > 0 || coins > 0) {
    const parts: string[] = [];
    if (gs.highScore > 0) parts.push(`Récord: ${Math.floor(gs.highScore)} m`);
    if (coins > 0)        parts.push(`${coins} M`);
    ctx.fillStyle = "rgba(255,215,0,0.55)";
    ctx.font      = "12px system-ui, sans-serif";
    ctx.fillText(parts.join("   ·   "), cx, H * 0.5 + 50);
  }
  const pw = 160, ph = 50;
  const px = cx - pw / 2, py = H * 0.65;
  const pg = ctx.createLinearGradient(px, py, px + pw, py + ph);
  pg.addColorStop(0, "#ff6b35"); pg.addColorStop(1, "#f7c500");
  ctx.fillStyle = pg;
  rrect(ctx, px, py, pw, ph, 25); ctx.fill();
  ctx.fillStyle = "#1a0533";
  ctx.font      = "bold 18px system-ui, sans-serif";
  ctx.fillText("Jugar", cx, py + 32);
  const sw = 130, sh = 38;
  const sx = cx - sw / 2, sy = py + ph + 14;
  ctx.fillStyle   = "rgba(255,255,255,0.08)";
  rrect(ctx, sx, sy, sw, sh, 19); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1;
  rrect(ctx, sx, sy, sw, sh, 19); ctx.stroke();
  ctx.fillStyle   = "rgba(255,255,255,0.65)";
  ctx.font        = "bold 14px system-ui, sans-serif";
  ctx.fillText("Tienda de Skins", cx, sy + 24);
  return { play: { bx: px, by: py, bw: pw, bh: ph }, shop: { bx: sx, by: sy, bw: sw, bh: sh } };
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — GAME OVER
   ══════════════════════════════════════════════════════════ */
function drawGameOver(
  ctx: CanvasRenderingContext2D, gs: GS, W: number, H: number, coinsEarned: number,
): OverBtns {
  ctx.fillStyle = "rgba(0,0,0,0.70)";
  ctx.fillRect(0, 0, W, H);
  const cx    = W / 2;
  const cardW = Math.min(W * 0.82, 310);
  const cardH = coinsEarned > 0 ? 350 : 320;
  const cardX = cx - cardW / 2, cardY = H / 2 - cardH / 2;
  ctx.fillStyle   = "rgba(16,8,36,0.94)";
  rrect(ctx, cardX, cardY, cardW, cardH, 20); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
  rrect(ctx, cardX, cardY, cardW, cardH, 20); ctx.stroke();
  ctx.textAlign   = "center";
  ctx.shadowColor = "rgba(255,50,50,0.55)"; ctx.shadowBlur = 18;
  ctx.fillStyle   = "#ff4444";
  ctx.font        = "bold 30px system-ui, sans-serif";
  ctx.fillText("CHOQUE", cx, cardY + 52);
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = "rgba(255,255,255,0.52)";
  ctx.font        = "12px system-ui, sans-serif";
  ctx.fillText("DISTANCIA RECORRIDA", cx, cardY + 88);
  ctx.fillStyle   = "#ffd700";
  ctx.font        = "bold 34px system-ui, sans-serif";
  ctx.fillText(`${Math.floor(gs.distance)} m`, cx, cardY + 128);
  ctx.fillStyle   = "rgba(255,255,255,0.38)";
  ctx.font        = "12px system-ui, sans-serif";
  ctx.fillText(`Récord: ${Math.floor(gs.highScore)} m`, cx, cardY + 152);
  if (coinsEarned > 0) {
    ctx.fillStyle = "rgba(255,215,0,0.9)"; ctx.shadowColor = "rgba(255,215,0,0.4)"; ctx.shadowBlur = 10;
    ctx.font      = "bold 15px system-ui, sans-serif";
    ctx.fillText(`+ ${coinsEarned} monedas`, cx, cardY + 178);
    ctx.shadowBlur = 0;
  }
  const rbw = cardW - 32, rbh = 44;
  const rbx = cardX + 16, rby = cardY + cardH - 112;
  const grad = ctx.createLinearGradient(rbx, rby, rbx + rbw, rby + rbh);
  grad.addColorStop(0, "#ff6b35"); grad.addColorStop(1, "#f7c500");
  ctx.fillStyle = grad;
  rrect(ctx, rbx, rby, rbw, rbh, 22); ctx.fill();
  ctx.fillStyle = "#1a0533"; ctx.font = "bold 16px system-ui, sans-serif";
  ctx.fillText("Reintentar", cx, rby + 28);
  const tbw = cardW - 32, tbh = 38;
  const tbx = cardX + 16, tby = rby + rbh + 10;
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  rrect(ctx, tbx, tby, tbw, tbh, 19); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1;
  rrect(ctx, tbx, tby, tbw, tbh, 19); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText("Tienda de Skins", cx, tby + 24);
  return { retry: { bx: rbx, by: rby, bw: rbw, bh: rbh }, shop: { bx: tbx, by: tby, bw: tbw, bh: tbh } };
}

/* ══════════════════════════════════════════════════════════
   DIBUJO — TIENDA (canvas)
   ══════════════════════════════════════════════════════════ */
function drawSkinCard(
  ctx: CanvasRenderingContext2D,
  skin: Skin, save: Save, carImg: HTMLCanvasElement | null,
  cx: number, cy: number, cw: number, ch: number, time: number,
): BtnBounds {
  const unlocked  = save.unlocked.includes(skin.id);
  const active    = save.activeSkin === skin.id;
  const canBuy    = !unlocked && save.coins >= skin.price;
  const tooExp    = !unlocked && !canBuy;
  const isRainbow = skin.animStyle === "rainbow" && !tooExp;

  ctx.fillStyle   = active ? `rgba(${hexRgb(skin.bodyColor)},0.14)` : "rgba(255,255,255,0.04)";
  ctx.strokeStyle = active ? skin.bodyColor : "rgba(255,255,255,0.08)";
  ctx.lineWidth   = active ? 1.5 : 1;
  rrect(ctx, cx, cy, cw, ch, 10); ctx.fill();
  rrect(ctx, cx, cy, cw, ch, 10); ctx.stroke();

  const imgAreaH = ch * 0.58;
  ctx.fillStyle = tooExp ? "rgba(255,255,255,0.02)" : `rgba(${hexRgb(skin.bodyColor)},0.10)`;
  rrect(ctx, cx + 2, cy + 2, cw - 4, imgAreaH - 2, 8); ctx.fill();

  if (carImg) {
    const iH = imgAreaH - 6;
    const iW = iH * (512 / 960);
    const ix = cx + (cw - iW) / 2, iy = cy + 3;
    ctx.save();
    ctx.globalAlpha = tooExp ? 0.32 : 1;
    if (isRainbow) {
      const rg = rainbowGlow(time);
      ctx.shadowColor = rg.color; ctx.shadowBlur = rg.blur * 0.55;
    } else if (!tooExp) {
      ctx.shadowColor = skin.glowColor; ctx.shadowBlur = 7;
    }
    ctx.drawImage(carImg, ix, iy, iW, iH);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.restore();
  }

  if (active) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    rrect(ctx, cx + cw - 24, cy + 5, 18, 12, 6); ctx.fill();
    ctx.fillStyle = skin.bodyColor; ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("ON", cx + cw - 7, cy + 14);
  }

  ctx.fillStyle = tooExp ? "rgba(255,255,255,0.3)" : "#fff";
  ctx.font      = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(skin.name, cx + cw / 2, cy + imgAreaH + 14);

  if (!unlocked) {
    ctx.fillStyle = tooExp ? "rgba(255,255,255,0.18)" : "rgba(255,215,0,0.65)";
    ctx.font      = "9px system-ui, sans-serif";
    ctx.fillText(`${skin.price} M`, cx + cw / 2, cy + imgAreaH + 26);
  }

  const bh = 22, bw = cw - 16;
  const bx = cx + 8, by = cy + ch - bh - 5;

  if (active) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rrect(ctx, bx, by, bw, bh, 11); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillText("Equipado", cx + cw / 2, by + 15);
  } else if (unlocked) {
    const g = ctx.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, skin.bodyColor); g.addColorStop(1, skin.glowColor);
    ctx.fillStyle = g;
    rrect(ctx, bx, by, bw, bh, 11); ctx.fill();
    ctx.fillStyle = "#0a0a14"; ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillText("Equipar", cx + cw / 2, by + 15);
  } else if (canBuy) {
    const g = ctx.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, "#ff6b35"); g.addColorStop(1, "#f7c500");
    ctx.fillStyle = g;
    rrect(ctx, bx, by, bw, bh, 11); ctx.fill();
    ctx.fillStyle = "#1a0533"; ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillText(`Comprar · ${skin.price} M`, cx + cw / 2, by + 15);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    rrect(ctx, bx, by, bw, bh, 11); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillText(`${skin.price} M`, cx + cw / 2, by + 15);
  }
  return { bx, by, bw, bh };
}

function drawShop(
  ctx: CanvasRenderingContext2D, gs: GS, W: number, H: number,
  save: Save, carImgs: Map<string, HTMLCanvasElement>, time: number,
): ShopResult {
  // Overlay
  ctx.fillStyle = "rgba(0,0,0,0.80)";
  ctx.fillRect(0, 0, W, H);

  // Panel con márgenes verticales para que no toque los bordes
  const padY   = Math.max(22, H * 0.045);
  const panelW = Math.min(W * 0.96, 400);
  const panelH = H - padY * 2;
  const panelX = (W - panelW) / 2;
  const panelY = padY;
  const cx     = W / 2;

  ctx.fillStyle   = "rgba(12,6,26,0.97)";
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth   = 1;
  rrect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();
  rrect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.stroke();

  // ── Header ──────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.save();
  ctx.beginPath();
  rrect(ctx, panelX, panelY, panelW, SHOP_HEADER_H, 16);
  ctx.clip();
  ctx.fillRect(panelX, panelY, panelW, SHOP_HEADER_H);
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.font      = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Tienda de Skins", panelX + 14, panelY + 24);

  const coinLabel = `${save.coins} M`;
  ctx.font = "bold 13px system-ui, sans-serif";
  const coinW = ctx.measureText(coinLabel).width + 22;
  ctx.fillStyle   = "rgba(255,215,0,0.12)";
  rrect(ctx, panelX + panelW - coinW - 10, panelY + 9, coinW, 26, 13); ctx.fill();
  ctx.strokeStyle = "rgba(255,215,0,0.30)"; ctx.lineWidth = 1;
  rrect(ctx, panelX + panelW - coinW - 10, panelY + 9, coinW, 26, 13); ctx.stroke();
  ctx.fillStyle = "#ffd700"; ctx.textAlign = "right";
  ctx.fillText(coinLabel, panelX + panelW - 16, panelY + 26);

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font      = "10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("1 moneda cada 10 m recorridos", panelX + 14, panelY + 50);

  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 8, panelY + SHOP_HEADER_H);
  ctx.lineTo(panelX + panelW - 8, panelY + SHOP_HEADER_H);
  ctx.stroke();

  // ── Área scrollable ──────────────────────────────────────
  const contentAreaY = panelY + SHOP_HEADER_H;
  const contentAreaH = panelH - SHOP_HEADER_H - SHOP_FOOTER_H;
  const cardW        = (panelW - 12 - SHOP_GAP) / 2;
  const rows         = Math.ceil(SKINS.length / 2);
  const totalH       = 8 + rows * SHOP_CARD_H + (rows - 1) * SHOP_GAP + 8;
  const maxScroll    = Math.max(0, totalH - contentAreaH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX, contentAreaY, panelW, contentAreaH);
  ctx.clip();

  const btns: ShopBtn[] = [];
  SKINS.forEach((skin, i) => {
    const col      = i % 2;
    const row      = Math.floor(i / 2);
    const cardX    = panelX + 6 + col * (cardW + SHOP_GAP);
    const contentY = 8 + row * (SHOP_CARD_H + SHOP_GAP);
    const screenY  = contentAreaY + contentY - gs.shopScrollY;
    if (screenY + SHOP_CARD_H >= contentAreaY && screenY <= contentAreaY + contentAreaH) {
      const b = drawSkinCard(ctx, skin, save, carImgs.get(skin.id) ?? null, cardX, screenY, cardW, SHOP_CARD_H, time);
      btns.push({ skinId: skin.id, bx: b.bx, by: b.by, bw: b.bw, bh: b.bh });
    } else {
      btns.push({ skinId: skin.id, bx: -1000, by: -1000, bw: 0, bh: 0 });
    }
  });

  if (maxScroll > 0) {
    const trackH = contentAreaH - 8;
    const thumbH = Math.max(28, trackH * (contentAreaH / totalH));
    const thumbY = contentAreaY + 4 + (gs.shopScrollY / maxScroll) * (trackH - thumbH);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    rrect(ctx, panelX + panelW - 7, contentAreaY + 4, 3, trackH, 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    rrect(ctx, panelX + panelW - 7, thumbY, 3, thumbH, 2); ctx.fill();
  }
  ctx.restore();

  // ── Footer — botón Cerrar ────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
  const footerY = panelY + panelH - SHOP_FOOTER_H;
  ctx.beginPath();
  ctx.moveTo(panelX + 8, footerY);
  ctx.lineTo(panelX + panelW - 8, footerY);
  ctx.stroke();

  const cbw = panelW - 28, cbh = 36;
  const cbx = panelX + 14;
  const cby = footerY + (SHOP_FOOTER_H - cbh) / 2;
  ctx.fillStyle   = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth   = 1;
  rrect(ctx, cbx, cby, cbw, cbh, 18); ctx.fill();
  rrect(ctx, cbx, cby, cbw, cbh, 18); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font      = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Cerrar", cx, cby + 24);

  return { btns, closeBtn: { bx: cbx, by: cby, bw: cbw, bh: cbh }, maxScroll };
}

/* ══════════════════════════════════════════════════════════
   LÓGICA — SPAWN
   ══════════════════════════════════════════════════════════ */
function blockedAhead(gs: GS, H: number, carH: number): Set<number> {
  const py = H * PLAYER_Y_FR;
  // Incluye enemigos hasta 1 pantalla entera por encima del borde (cubre el 2° carro del diagonal)
  return new Set(gs.enemies.filter(e => e.y >= -H && e.y < py - carH * 0.2).map(e => e.lane));
}

function safeToSpawn(gs: GS, lane: number, H: number, carH: number): boolean {
  const bk = blockedAhead(gs, H, carH);
  return bk.has(lane) || bk.size < gs.numLanes - 1;
}

function rndColor(): string { return ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)]; }

function pickLane(free: number[], last: number): number {
  const w = free.map(l => l === last ? 0.12 : 1.0);
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < free.length; i++) { r -= w[i]; if (r <= 0) return free[i]; }
  return free[free.length - 1];
}

function spawnPair(gs: GS, free: number[], carH: number, H: number) {
  const sorted = [...free].sort((a, b) => a - b);
  let a = sorted[0], b = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] === 1) { a = sorted[i]; b = sorted[i + 1]; break; }
  }
  gs.enemies.push({ id: gs.nextId++, lane: a, y: -carH / 2, color: rndColor() });
  gs.lastSpawnLane = a;
  if (!safeToSpawn(gs, b, H, carH)) return;
  gs.enemies.push({ id: gs.nextId++, lane: b, y: -carH / 2 + (Math.random() - 0.5) * carH * 0.22, color: rndColor() });
  gs.lastSpawnLane = b;
}

function spawnDiagonal(gs: GS, free: number[], carH: number, H: number) {
  if (free.length < 2) return;
  const [a, b] = free.slice(0, 2).sort(() => Math.random() - 0.5);
  gs.enemies.push({ id: gs.nextId++, lane: a, y: -carH / 2, color: rndColor() });
  gs.lastSpawnLane = a;
  if (!safeToSpawn(gs, b, H, carH)) return;
  const gap = H * 0.75 + Math.random() * carH * 0.5;
  gs.enemies.push({ id: gs.nextId++, lane: b, y: -(carH / 2 + gap), color: rndColor() });
  gs.lastSpawnLane = b;
}

function spawnSpread(gs: GS, free: number[], carH: number, H: number) {
  const even = free.filter((_, i) => i % 2 === 0);
  for (const lane of even) {
    if (!safeToSpawn(gs, lane, H, carH)) break;
    gs.enemies.push({ id: gs.nextId++, lane, y: -carH / 2 + (Math.random() - 0.5) * carH * 0.18, color: rndColor() });
  }
  if (even.length) gs.lastSpawnLane = even[even.length - 1];
}

function spawnEnemy(gs: GS, H: number, carH: number) {
  const occupied = new Set(gs.enemies.filter(e => e.y < H * 0.28 + carH).map(e => e.lane));
  const free = Array.from({ length: gs.numLanes }, (_, i) => i).filter(l => !occupied.has(l) && safeToSpawn(gs, l, H, carH));
  if (free.length === 0) return;
  const level = gs.milestone;
  const formChance = Math.min(0.60, level * 0.05);
  if (free.length >= 2 && Math.random() < formChance) {
    const types: Array<"pair" | "diagonal" | "spread"> = ["pair"];
    if (level >= 8  && free.length >= 2) types.push("diagonal");
    if (level >= 12 && free.length >= 3) types.push("spread");
    const type = types[Math.floor(Math.random() * types.length)];
    if (type === "pair")     { spawnPair(gs, free, carH, H);     return; }
    if (type === "diagonal") { spawnDiagonal(gs, free, carH, H); return; }
    if (type === "spread")   { spawnSpread(gs, free, carH, H);   return; }
  }
  const lane = pickLane(free, gs.lastSpawnLane);
  gs.lastSpawnLane = lane;
  gs.enemies.push({ id: gs.nextId++, lane, y: -carH / 2, color: rndColor() });
}

function spawnWave(gs: GS, carH: number, H: number) {
  const topCars = gs.enemies.filter(e => e.y < carH * 2);
  if (topCars.length >= gs.numLanes - 1) return;
  const occupied   = new Set(topCars.map(e => e.lane));
  const candidates = Array.from({ length: gs.numLanes }, (_, i) => i).filter(l => !occupied.has(l));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const lane of candidates) {
    if (!safeToSpawn(gs, lane, H, carH)) break;
    gs.enemies.push({ id: gs.nextId++, lane, y: -carH / 2 + (Math.random() - 0.5) * carH * 0.28, color: rndColor() });
  }
}

/* ══════════════════════════════════════════════════════════
   LÓGICA — UPDATE
   ══════════════════════════════════════════════════════════ */
function update(gs: GS, dt: number, W: number, H: number, activeSkinId: string) {
  gs.timeElapsed += dt;
  gs.animLanes   += (gs.numLanes - gs.animLanes) * Math.min(LANE_LERP * dt, 1);
  const { laneW, carW, carH, roadX } = geo(gs.animLanes, W);
  gs.dashOffset  += gs.speed * dt;
  gs.distance    += gs.speed * dt / 100;
  gs.animLane    += (gs.playerLane - gs.animLane) * Math.min(LERP_SPEED * dt, 1);

  gs.spawnTimer  += dt * 1000;
  if (gs.spawnTimer >= gs.spawnInterval) { gs.spawnTimer = 0; spawnEnemy(gs, H, carH); }

  gs.waveTimer += dt * 1000;
  if (gs.waveTimer >= gs.spawnInterval * WAVE_MULT) { gs.waveTimer = 0; spawnWave(gs, carH, H); }

  for (const e of gs.enemies) e.y += gs.speed * dt;
  gs.enemies = gs.enemies.filter(e => e.y < H + carH * 2);

  for (const c of gs.roadCoins) c.y += gs.speed * dt;
  gs.roadCoins = gs.roadCoins.filter(c => c.y < H + carH);
  gs.coinTimer += dt * 1000;
  if (gs.coinTimer >= COIN_SPAWN_MS) {
    gs.coinTimer = 0;
    // Elegir carril libre de enemigos en toda la zona visible
    const takenLanes = new Set(gs.enemies.filter(e => e.y >= -H && e.y < H * PLAYER_Y_FR).map(e => e.lane));
    const freeLanes  = Array.from({ length: gs.numLanes }, (_, i) => i).filter(l => !takenLanes.has(l));
    if (freeLanes.length > 0) {
      const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      gs.roadCoins.push({ id: gs.nextId++, lane, y: -carH });
    }
  }
  const pxC = roadX + (gs.animLane + 0.5) * laneW;
  const pyC = H * PLAYER_Y_FR;
  const hitR = laneW * 0.38;
  gs.roadCoins = gs.roadCoins.filter(coin => {
    const exC = roadX + (coin.lane + 0.5) * laneW;
    if (Math.abs(pxC - exC) < hitR && Math.abs(pyC - coin.y) < hitR) {
      gs.pendingCoins += COIN_REWARD;
      pushMsg(gs, `+${COIN_REWARD} monedas`, H);
      return false;
    }
    return true;
  });

  const newMs = Math.floor(gs.distance / MILESTONE);
  if (newMs > gs.milestone) {
    const steps = newMs - gs.milestone;
    gs.milestone     = newMs;
    gs.speed         = gs.speed + SPEED_STEP * steps;
    gs.spawnInterval = Math.max(MIN_SPAWN, gs.spawnInterval - SPAWN_STEP * steps);
  }
  const targetLanes = INIT_LANES + Math.floor(gs.timeElapsed / LANE_INTERVAL);
  if (targetLanes > gs.numLanes && gs.numLanes < MAX_LANES) {
    gs.numLanes = Math.min(targetLanes, MAX_LANES);
    pushMsg(gs, LANE_MSGS[Math.floor(Math.random() * LANE_MSGS.length)], H);
  }

  if (SHOW_ENCOURAGEMENTS) {
    for (const m of gs.msgs) { m.life -= dt * 1000; m.y -= 16 * dt; }
    gs.msgs = gs.msgs.filter(m => m.life > 0);
    gs.nextRandMsg -= dt * 1000;
    if (gs.nextRandMsg <= 0) {
      gs.nextRandMsg = 9000 + Math.random() * 6000;
      pushMsg(gs, RAND_MSGS[Math.floor(Math.random() * RAND_MSGS.length)], H);
    }
    for (const [dist, text] of DIST_MSGS) {
      if (gs.distance >= dist && gs.lastDistMsg < dist) { gs.lastDistMsg = dist; pushMsg(gs, text, H); }
    }
  }

  if (gs.flashTimer > 0) gs.flashTimer = Math.max(0, gs.flashTimer - dt * 1000);

  const px = roadX + (gs.animLane + 0.5) * laneW;
  const py = H * PLAYER_Y_FR;
  for (const e of gs.enemies) {
    const ex = roadX + (e.lane + 0.5) * laneW;
    if (Math.abs(px - ex) < carW * 0.70 && Math.abs(py - e.y) < carH * 0.68) {
      if (activeSkinId === "chrome" && gs.hasRevive) {
        gs.hasRevive = false; gs.speed = BASE_SPEED; gs.spawnInterval = BASE_SPAWN;
        gs.enemies = []; gs.roadCoins = []; gs.flashTimer = 700;
        pushMsg(gs, "Segunda oportunidad!", H);
        return;
      }
      gs.phase = "dead";
      if (gs.distance > gs.highScore) gs.highScore = gs.distance;
      return;
    }
  }
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE
   ══════════════════════════════════════════════════════════ */
export default function RoadRushGame() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const gsRef          = useRef<GS>(makeGS());
  const rafRef         = useRef<number>(0);
  const introBtnsRef   = useRef<{ play: BtnBounds; shop: BtnBounds } | null>(null);
  const overBtnRef     = useRef<OverBtns | null>(null);
  const pointerStart   = useRef<{ x: number; y: number } | null>(null);
  const prevPhaseRef   = useRef<Phase>("loading");
  const lastCoinsRef   = useRef(0);
  const carImgsRef     = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const shopBtnsRef    = useRef<ShopBtn[]>([]);
  const shopCloseBtnRef = useRef<BtnBounds | null>(null);
  const shopDragRef     = useRef<{ startY: number; startScrollY: number } | null>(null);
  const shopLastMoveRef = useRef<{ y: number; t: number } | null>(null);
  const shopMaxScrollRef = useRef(0);
  const loadProgressRef  = useRef({ loaded: 0, total: 0 });

  const [save, setSave] = useState<Save>(() => loadSave());
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  const addCoinsRef = useRef((_amount: number) => {});
  useEffect(() => {
    addCoinsRef.current = (amount: number) => {
      setSave(prev => { const u = { ...prev, coins: prev.coins + amount }; persistSave(u); return u; });
    };
  });

  const awardCoinsRef = useRef((_dist: number) => {});
  useEffect(() => {
    awardCoinsRef.current = (dist: number) => {
      const earned = coinsForDistance(dist);
      lastCoinsRef.current = earned;
      if (earned === 0) return;
      setSave(prev => {
        const u: Save = { ...prev, coins: prev.coins + earned, bestDistance: Math.max(prev.bestDistance, Math.floor(dist)) };
        persistSave(u); return u;
      });
    };
  });

  const shopActionRef = useRef((_skinId: string, _buy: boolean) => {});
  useEffect(() => {
    shopActionRef.current = (skinId: string, buy: boolean) => {
      setSave(prev => {
        const skin = getSkin(skinId);
        if (buy) {
          if (prev.coins < skin.price || prev.unlocked.includes(skinId)) return prev;
          const u = { ...prev, coins: prev.coins - skin.price, unlocked: [...prev.unlocked, skinId], activeSkin: skinId };
          persistSave(u); return u;
        } else {
          if (!prev.unlocked.includes(skinId)) return prev;
          const u = { ...prev, activeSkin: skinId };
          persistSave(u); return u;
        }
      });
    };
  });

  // ── Loop ────────────────────────────────────────────────
  const loop = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gs = gsRef.current;
    const W  = canvas.width;
    const H  = canvas.height;
    const dt = gs.lastTime > 0 ? Math.min((time - gs.lastTime) / 1000, 0.05) : 0;
    gs.lastTime = time;

    const activeSkinId = saveRef.current.activeSkin;

    if (prevPhaseRef.current !== "playing" && gs.phase === "playing") {
      gs.hasRevive = activeSkinId === "chrome";
    }

    if (gs.phase === "playing") update(gs, dt, W, H, activeSkinId);

    if (gs.pendingCoins > 0) { addCoinsRef.current(gs.pendingCoins); gs.pendingCoins = 0; }

    if (prevPhaseRef.current === "playing" && gs.phase === "dead") {
      awardCoinsRef.current(gs.distance);
    }
    prevPhaseRef.current = gs.phase;

    // Render
    if (gs.phase === "loading") {
      drawLoading(ctx, gs, W, H);
    } else if (gs.phase === "shop") {
      // Momentum: aplica velocidad de scroll con fricción cuando no hay drag activo
      if (!shopDragRef.current && Math.abs(gs.shopScrollVel) > 1) {
        gs.shopScrollY    = Math.max(0, Math.min(shopMaxScrollRef.current, gs.shopScrollY + gs.shopScrollVel * dt));
        gs.shopScrollVel *= Math.pow(0.88, dt * 60); // fricción frame-rate independent
        if (Math.abs(gs.shopScrollVel) < 1) gs.shopScrollVel = 0;
      }

      const skin      = getSkin(activeSkinId);
      const playerImg = carImgsRef.current.get(skin.id) ?? null;
      drawScene(ctx, gs, W, H, skin, playerImg, time);
      const result = drawShop(ctx, gs, W, H, saveRef.current, carImgsRef.current, time);
      shopBtnsRef.current      = result.btns;
      shopCloseBtnRef.current  = result.closeBtn;
      shopMaxScrollRef.current = result.maxScroll;
    } else {
      const skin      = getSkin(activeSkinId);
      const playerImg = carImgsRef.current.get(skin.id) ?? null;
      drawScene(ctx, gs, W, H, skin, playerImg, time);
      if (gs.phase === "intro") {
        introBtnsRef.current = drawIntro(ctx, gs, W, H, saveRef.current.coins);
      } else if (gs.phase === "dead") {
        overBtnRef.current = drawGameOver(ctx, gs, W, H, lastCoinsRef.current);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // ── Canvas resize ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() { canvas!.width = canvas!.clientWidth; canvas!.height = canvas!.clientHeight; }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [loop]);

  // ── Carga de imágenes con progreso ───────────────────────
  useEffect(() => {
    const skinsWithImg = SKINS.filter(s => s.imageSrc);
    loadProgressRef.current = { loaded: 0, total: skinsWithImg.length };
    if (skinsWithImg.length === 0) { gsRef.current.phase = "intro"; return; }
    skinsWithImg.forEach(skin => {
      const img = new Image();
      const onDone = () => {
        loadProgressRef.current.loaded++;
        gsRef.current.loadPct = loadProgressRef.current.loaded / loadProgressRef.current.total;
        if (loadProgressRef.current.loaded >= loadProgressRef.current.total) {
          gsRef.current.phase = "intro";
        }
      };
      img.onload = () => { carImgsRef.current.set(skin.id, removeWhiteBg(img)); onDone(); };
      img.onerror = onDone;
      img.src = skin.imageSrc!;
    });
  }, []);

  // ── Teclado ─────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const gs = gsRef.current;
      if (gs.phase === "loading" || gs.phase === "shop") return;
      if (gs.phase === "playing") {
        if      (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") gs.playerLane = Math.max(0, gs.playerLane - 1);
        else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") gs.playerLane = Math.min(gs.numLanes - 1, gs.playerLane + 1);
      } else if (gs.phase === "intro" && (e.key === " " || e.key === "Enter")) {
        gs.phase = "playing";
      } else if (gs.phase === "dead" && (e.key === " " || e.key === "Enter" || e.key === "r" || e.key === "R")) {
        const hs = gs.highScore;
        gsRef.current = { ...makeGS(hs), phase: "playing" };
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Helpers ──────────────────────────────────────────────
  function canvasCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (c.width  / rect.width),
      y: (e.clientY - rect.top)  * (c.height / rect.height),
    };
  }
  function inBtn(btn: BtnBounds, x: number, y: number) {
    return x >= btn.bx && x <= btn.bx + btn.bw && y >= btn.by && y <= btn.by + btn.bh;
  }

  // ── Pointer down ─────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const gs = gsRef.current;
    if (gs.phase === "loading") return;
    const { x, y } = canvasCoords(e);

    if (gs.phase === "shop") {
      const closeBtn = shopCloseBtnRef.current;
      if (closeBtn && inBtn(closeBtn, x, y)) {
        gs.phase = gs.shopReturnPhase;
        shopDragRef.current = null;
        return;
      }
      gs.shopScrollVel        = 0;
      shopDragRef.current     = { startY: y, startScrollY: gs.shopScrollY };
      shopLastMoveRef.current = { y, t: performance.now() };
      return;
    }
    if (gs.phase === "intro") {
      const btns = introBtnsRef.current;
      if (btns) {
        if (inBtn(btns.play, x, y)) { gs.phase = "playing"; return; }
        if (inBtn(btns.shop, x, y)) { gs.shopReturnPhase = "intro"; gs.shopScrollY = 0; gs.phase = "shop"; return; }
      }
      return;
    }
    if (gs.phase === "dead") {
      const btns = overBtnRef.current;
      if (btns) {
        if (inBtn(btns.retry, x, y)) {
          const hs = gs.highScore;
          gsRef.current = { ...makeGS(hs), phase: "playing" };
          lastCoinsRef.current = 0;
          return;
        }
        if (inBtn(btns.shop, x, y)) { gs.shopReturnPhase = "dead"; gs.shopScrollY = 0; gs.phase = "shop"; return; }
      }
      return;
    }
    if (gs.phase === "playing") {
      pointerStart.current = { x, y };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pointer move (scroll tienda con velocidad) ──────────
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const gs = gsRef.current;
    if (gs.phase !== "shop" || !shopDragRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const y    = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

    // Aplicar desplazamiento inmediato
    const delta = shopDragRef.current.startY - y;
    gs.shopScrollY = Math.max(0, Math.min(shopMaxScrollRef.current, shopDragRef.current.startScrollY + delta));

    // Registrar velocidad instantánea (px/s)
    const now = performance.now();
    if (shopLastMoveRef.current) {
      const dt = now - shopLastMoveRef.current.t;
      if (dt > 0) {
        gs.shopScrollVel = (shopLastMoveRef.current.y - y) / (dt / 1000);
      }
    }
    shopLastMoveRef.current = { y, t: now };
  }, []);

  // ── Pointer up ───────────────────────────────────────────
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const gs = gsRef.current;

    if (gs.phase === "shop") {
      const drag = shopDragRef.current;
      shopDragRef.current = null;
      if (!drag) return;
      const rect  = canvasRef.current.getBoundingClientRect();
      const y     = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);
      const moved = Math.abs(y - drag.startY);
      if (moved < 8) {
        const { x } = canvasCoords(e);
        for (const btn of shopBtnsRef.current) {
          if (x >= btn.bx && x <= btn.bx + btn.bw && y >= btn.by && y <= btn.by + btn.bh) {
            const sv   = saveRef.current;
            const skin = getSkin(btn.skinId);
            if (sv.unlocked.includes(btn.skinId))    shopActionRef.current(btn.skinId, false);
            else if (sv.coins >= skin.price)          shopActionRef.current(btn.skinId, true);
            return;
          }
        }
      }
      return;
    }

    const start = pointerStart.current;
    pointerStart.current = null;
    if (gs.phase !== "playing" || !start) return;
    const { x } = canvasCoords(e);
    const W     = canvasRef.current.width;
    const delta = x - start.x;
    if (Math.abs(delta) >= SWIPE_PX) {
      gs.playerLane = delta < 0 ? Math.max(0, gs.playerLane - 1) : Math.min(gs.numLanes - 1, gs.playerLane + 1);
    } else {
      gs.playerLane = x < W / 2 ? Math.max(0, gs.playerLane - 1) : Math.min(gs.numLanes - 1, gs.playerLane + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerCancel = useCallback(() => {
    pointerStart.current      = null;
    shopDragRef.current       = null;
    shopLastMoveRef.current   = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerCancel}
      style={{ display: "block", width: "100%", height: "100dvh", touchAction: "none", cursor: "default" }}
    />
  );
}
