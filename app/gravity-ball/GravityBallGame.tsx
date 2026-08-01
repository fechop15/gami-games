"use client";
import Link from "next/link";

import { useEffect, useRef, useCallback } from "react";
import {
  font, rgba, roundRectPath, drawBackground, drawButton, drawPill,
  glowText, drawPanel,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#6366f1";

type TileType = "wall" | "spike" | "antigrav" | "speed" | "portal";

interface Tile {
  type: TileType;
  x: number;
  y: number;
  w: number;
  h: number;
  portalTarget?: { x: number; y: number };
}

interface Level {
  tiles: Tile[];
  start: { x: number; y: number };
  exit: { x: number; y: number };
  bg: string;
}

interface Particle { x: number; y: number; vx: number; vy: number; color: string; life: number; }
interface FloatText { x: number; y: number; text: string; color: string; life: number; vy: number; }

const BALL_R = 12;
// Gravedad suave + empuje fuerte: el jugador tiene autoridad clara sobre la bola.
const GRAVITY_DOWN = 240;
const FORCE = 720;
const DAMPING = 0.97;

// Floating joystick geometry (canvas coords).
const JOY_R = 46;
const JOY_STICK_R = 24;

function bgStops(i: number): string[] {
  if (i < 5) return ["#1c2044", "#12142e", "#090b1c"];
  if (i < 10) return ["#132244", "#0d1430", "#070a1c"];
  if (i < 15) return ["#271640", "#180f2a", "#0b0718"];
  return ["#123322", "#0b2016", "#05120b"];
}

function makeLevel(i: number, W: number, H: number): Level {
  const margin = 40;
  const bg = i < 5 ? "#0f1117" : i < 10 ? "#0d1226" : i < 15 ? "#160d1a" : "#0a1a0a";

  // base walls
  const walls: Tile[] = [
    { type: "wall", x: 0, y: 0, w: W, h: margin },
    { type: "wall", x: 0, y: H - margin, w: W, h: margin },
    { type: "wall", x: 0, y: 0, w: margin, h: H },
    { type: "wall", x: W - margin, y: 0, w: margin, h: H },
  ];

  const seed = i * 137.5;
  const rng = (n: number) => ((Math.sin(seed + n) * 43758.5453) % 1 + 1) % 1;

  // Zona jugable interna (todo obstáculo queda dentro, nada off-screen en portrait).
  const innerX = margin * 2;
  const innerY = margin * 2;
  const innerW = Math.max(80, W - margin * 4);
  const innerH = Math.max(80, H - margin * 4);

  const start = { x: margin + BALL_R + 20, y: H / 2 };
  // Meta en posición variable por nivel: mitad derecha del área jugable, con margen.
  const exit = {
    x: innerX + (0.5 + rng(901) * 0.45) * innerW,
    y: innerY + 30 + rng(902) * Math.max(1, innerH - 60),
  };

  // Despeje garantizado alrededor del inicio y la meta.
  const CLEAR = 96;

  const extra: Tile[] = [];
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const count = Math.min(3 + Math.floor(i * 0.7), 9);
  let attempts = 0;

  while (extra.length < count && attempts < count * 8) {
    const k = attempts++;
    const w = 40 + rng(k * 4 + 2) * 70;
    const h = 18 + rng(k * 4 + 3) * 24;
    const x = innerX + rng(k * 4) * Math.max(1, innerW - w);
    const y = innerY + rng(k * 4 + 1) * Math.max(1, innerH - h);
    const cx = x + w / 2, cy = y + h / 2;

    // No invadir el despeje del inicio/meta.
    if (Math.hypot(cx - start.x, cy - start.y) < CLEAR + w / 2) continue;
    if (Math.hypot(cx - exit.x, cy - exit.y) < CLEAR + w / 2) continue;
    // No solaparse con obstáculos ya colocados (deja hueco para pasar).
    if (rects.some(r => x < r.x + r.w + 24 && x + w > r.x - 24 && y < r.y + r.h + 24 && y + h > r.y - 24)) continue;

    // Tipo del obstáculo según el nivel (sin portales: más legible).
    let type: TileType = "wall";
    const idx = extra.length;
    if (i >= 6 && idx % 4 === 2) type = "antigrav";
    else if (i >= 12 && idx % 4 === 3) type = "speed";
    else if (i >= 10 && idx % 5 === 0) type = "spike";

    extra.push(type === "antigrav" ? { type, x, y, w, h: h * 1.4 } : { type, x, y, w, h });
    rects.push({ x, y, w, h });
  }

  return { tiles: [...walls, ...extra], start, exit, bg };
}

interface GS {
  phase: "loading" | "onboarding" | "playing" | "win" | "gameover";
  paused: boolean;
  loadPct: number;
  bx: number;
  by: number;
  vx: number;
  vy: number;
  gravDir: number;
  level: Level;
  levelIdx: number;
  score: number;
  totalScore: number;
  frameCount: number;
  deathCount: number;
  levelDeaths: number;
  keys: Set<string>;
  joyActive: boolean;
  joyId: number;
  joyBaseX: number;
  joyBaseY: number;
  joyDx: number;
  joyDy: number;
  portalCd: number;
  speedCd: number;
  particles: Particle[];
  floats: FloatText[];
  shake: number;
  lastTime: number;
  checkpoint: number;
}

const TILE_COLORS: Record<TileType, string> = {
  wall:     "#3b4763",
  spike:    "#ef4444",
  antigrav: "#a855f7",
  speed:    "#3b82f6",
  portal:   "#22d3ee",
};

function readCheckpoint(): number {
  try { return parseInt(sessionStorage.getItem("gb_checkpoint") ?? "0") || 0; } catch { return 0; }
}

export default function GravityBallGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS | null>(null);
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});
  const bestRef = useRef<number>(0);

  const initGS = useCallback((): GS => {
    const canvas = canvasRef.current!;
    const level = makeLevel(0, canvas.width, canvas.height);
    return {
      phase: "loading",
      paused: false,
      loadPct: 0,
      bx: level.start.x,
      by: level.start.y,
      vx: 0,
      vy: 0,
      gravDir: 1,
      level,
      levelIdx: 0,
      score: 1000,
      totalScore: 0,
      frameCount: 0,
      deathCount: 0,
      levelDeaths: 0,
      keys: new Set(),
      joyActive: false,
      joyId: -1,
      joyBaseX: 0,
      joyBaseY: 0,
      joyDx: 0,
      joyDy: 0,
      portalCd: 0,
      speedCd: 0,
      particles: [],
      floats: [],
      shake: 0,
      lastTime: 0,
      checkpoint: 0,
    };
  }, []);

  const loadLevel = useCallback((gs: GS, levelIdx: number) => {
    const canvas = canvasRef.current!;
    gs.level = makeLevel(levelIdx, canvas.width, canvas.height);
    gs.levelIdx = levelIdx;
    gs.bx = gs.level.start.x;
    gs.by = gs.level.start.y;
    gs.vx = 0;
    gs.vy = 0;
    gs.gravDir = 1;
    gs.score = 1000;
    gs.levelDeaths = 0;
    gs.frameCount = 0;
    gs.portalCd = 0;
    gs.speedCd = 0;
    gs.particles = [];
    gs.floats = [];
  }, []);

  const startGame = useCallback((fromCheckpoint: boolean) => {
    const gs = gsRef.current;
    if (!gs) return;
    const start = fromCheckpoint ? readCheckpoint() : 0;
    gs.checkpoint = start;
    gs.totalScore = 0;
    gs.deathCount = 0;
    gs.paused = false;
    gs.shake = 0;
    loadLevel(gs, start);
    gs.phase = "playing";
  }, [loadLevel]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      canvas.width = canvas.clientWidth || Math.min(window.innerWidth, 480);
      canvas.height = canvas.clientHeight || window.innerHeight;
    };
    resize();
    gsRef.current = initGS();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Preload SVG assets, then move to onboarding.
    loadImages(
      {
        bg: "/games/gravity-ball/bg.svg",
        ball: "/games/gravity-ball/ball.svg",
        portal: "/games/gravity-ball/portal.svg",
        spike: "/games/gravity-ball/spike.svg",
        flag: "/games/gravity-ball/flag.svg",
      },
      (pct) => { if (gsRef.current) gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current && gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;

    const burst = (gs: GS, x: number, y: number, color: string, n = 14) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const s = 2 + Math.random() * 4;
        gs.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: 1 });
      }
    };

    const rectCollide = (bx: number, by: number, tile: Tile) => {
      return bx + BALL_R > tile.x && bx - BALL_R < tile.x + tile.w &&
             by + BALL_R > tile.y && by - BALL_R < tile.y + tile.h;
    };

    // Rects reused by the pointer handler (set during draw).
    let onboardBtn: Rect | null = null;

    const draw = (ts: number) => {
      const gs = gsRef.current!;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;

      const W = canvas.width;
      const H = canvas.height;

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Gravity Ball");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      if (active) {
        gs.frameCount++;
        if (gs.portalCd > 0) gs.portalCd -= dt;
        if (gs.speedCd > 0) gs.speedCd -= dt;

        // input
        let fx = 0, fy = 0;
        if (gs.keys.has("ArrowLeft") || gs.keys.has("a") || gs.keys.has("A")) fx -= FORCE;
        if (gs.keys.has("ArrowRight") || gs.keys.has("d") || gs.keys.has("D")) fx += FORCE;
        if (gs.keys.has("ArrowUp") || gs.keys.has("w") || gs.keys.has("W")) fy -= FORCE;
        if (gs.keys.has("ArrowDown") || gs.keys.has("s") || gs.keys.has("S")) fy += FORCE;
        if (gs.joyActive) { fx += gs.joyDx * FORCE; fy += gs.joyDy * FORCE; }

        // gravity
        fy += GRAVITY_DOWN * gs.gravDir;

        gs.vx = (gs.vx + fx * dt) * Math.pow(DAMPING, dt * 60);
        gs.vy = (gs.vy + fy * dt) * Math.pow(DAMPING, dt * 60);

        // cap speed
        const spd = Math.hypot(gs.vx, gs.vy);
        if (spd > 600) { gs.vx = gs.vx / spd * 600; gs.vy = gs.vy / spd * 600; }

        gs.bx += gs.vx * dt;
        gs.by += gs.vy * dt;

        // score tick
        if (gs.frameCount % 60 === 0 && gs.score > 0) gs.score--;

        // tile interactions
        let died = false;
        let inAntigrav = false;
        for (const tile of gs.level.tiles) {
          if (!rectCollide(gs.bx, gs.by, tile)) continue;
          if (tile.type === "wall") {
            // push out along the smallest overlap axis
            const ol = gs.bx + BALL_R - tile.x;
            const or2 = tile.x + tile.w - (gs.bx - BALL_R);
            const ot = gs.by + BALL_R - tile.y;
            const ob = tile.y + tile.h - (gs.by - BALL_R);
            const minO = Math.min(ol, or2, ot, ob);
            let impact = 0;
            if (minO === ol) { gs.bx -= ol; impact = Math.abs(gs.vx); gs.vx *= -0.4; }
            else if (minO === or2) { gs.bx += or2; impact = Math.abs(gs.vx); gs.vx *= -0.4; }
            else if (minO === ot) { gs.by -= ot; impact = Math.abs(gs.vy); gs.vy *= -0.4; }
            else { gs.by += ob; impact = Math.abs(gs.vy); gs.vy *= -0.4; }
            // Only sound a real bounce, not per-frame resting contact.
            if (impact > 150) sfx.hit();
          } else if (tile.type === "spike") {
            died = true;
          } else if (tile.type === "antigrav") {
            inAntigrav = true;
            if (gs.gravDir !== -1) { gs.gravDir = -1; sfx.coin(); }
          } else if (tile.type === "speed") {
            if (gs.speedCd <= 0) {
              gs.vx *= 1.4;
              gs.vy *= 1.4;
              gs.speedCd = 0.4;
              sfx.powerup();
              burst(gs, gs.bx, gs.by, TILE_COLORS.speed, 8);
            }
          } else if (tile.type === "portal" && tile.portalTarget && gs.portalCd <= 0) {
            burst(gs, gs.bx, gs.by, TILE_COLORS.portal, 12);
            gs.bx = tile.portalTarget.x;
            gs.by = tile.portalTarget.y;
            gs.vx = 0; gs.vy = 0;
            gs.portalCd = 0.5;
            sfx.whoosh();
            burst(gs, gs.bx, gs.by, TILE_COLORS.portal, 12);
          }
        }

        // restore gravity when outside every antigrav zone
        if (!inAntigrav && gs.gravDir !== 1) gs.gravDir = 1;

        if (died) {
          gs.levelDeaths++;
          gs.deathCount++;
          burst(gs, gs.bx, gs.by, "#ef4444", 18);
          gs.floats.push({ x: gs.bx, y: gs.by, text: "-100", color: "#ef4444", life: 1, vy: -1.2 });
          gs.shake = 14;
          sfx.explode();
          sfx.hurt();
          gs.bx = gs.level.start.x;
          gs.by = gs.level.start.y;
          gs.vx = 0; gs.vy = 0;
          gs.gravDir = 1;
          gs.score = Math.max(0, gs.score - 100);
        }

        // exit check
        const ex = gs.level.exit;
        if (Math.hypot(gs.bx - ex.x, gs.by - ex.y) < BALL_R + 18) {
          const noDeathBonus = gs.levelDeaths === 0 ? 500 : 0;
          gs.totalScore += gs.score + noDeathBonus;
          bestRef.current = Math.max(bestRef.current, gs.totalScore);
          const nextIdx = gs.levelIdx + 1;
          if (nextIdx >= 20) {
            gs.phase = "win";
            sfx.win();
          } else {
            if (nextIdx % 5 === 0) {
              gs.checkpoint = nextIdx;
              try { sessionStorage.setItem("gb_checkpoint", String(nextIdx)); } catch { /* ignore */ }
            }
            loadLevel(gs, nextIdx);
            sfx.levelup();
            gs.floats.push({ x: gs.level.start.x, y: gs.level.start.y - 30, text: noDeathBonus ? "+BONO 500" : "¡Nivel!", color: "#22c55e", life: 1.2, vy: -0.8 });
          }
        }
      }

      // update particles + floats + shake (always, so effects settle while paused too)
      gs.particles = gs.particles.filter(p => p.life > 0);
      for (const p of gs.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= dt * 1.6; }
      gs.floats = gs.floats.filter(f => f.life > 0);
      for (const f of gs.floats) { f.y += f.vy; f.life -= dt; }
      if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 45);

      // background: image (if available) + subtle overlay, else procedural gradient
      const bgImg = imgRef.current.bg;
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, W, H);
        ctx.fillStyle = "rgba(7,8,20,0.42)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, bgStops(gs.levelIdx));
      }

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      const playingLike = gs.phase === "playing" || gs.phase === "win" || gs.phase === "gameover";
      if (playingLike) {
        // tiles
        for (const tile of gs.level.tiles) {
          if (tile.type === "spike") {
            const spikeImg = imgRef.current.spike;
            if (spikeImg) {
              ctx.save();
              ctx.shadowColor = rgba("#ef4444", 0.6);
              ctx.shadowBlur = 10;
              ctx.drawImage(spikeImg, tile.x, tile.y, tile.w, tile.h);
              ctx.restore();
            } else {
              ctx.save();
              ctx.shadowColor = rgba("#ef4444", 0.6);
              ctx.shadowBlur = 10;
              ctx.fillStyle = TILE_COLORS.spike;
              const cols = Math.max(1, Math.floor(tile.w / 14));
              for (let i = 0; i < cols; i++) {
                ctx.beginPath();
                ctx.moveTo(tile.x + i * 14, tile.y + tile.h);
                ctx.lineTo(tile.x + i * 14 + 7, tile.y);
                ctx.lineTo(tile.x + i * 14 + 14, tile.y + tile.h);
                ctx.closePath();
                ctx.fill();
              }
              ctx.restore();
            }
          } else if (tile.type === "wall") {
            ctx.fillStyle = TILE_COLORS.wall;
            roundRectPath(ctx, tile.x, tile.y, tile.w, tile.h, 6);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            roundRectPath(ctx, tile.x, tile.y, tile.w, Math.min(tile.h, 6), 4);
            ctx.fill();
          } else if (tile.type === "antigrav") {
            ctx.save();
            ctx.shadowColor = rgba("#a855f7", 0.6); ctx.shadowBlur = 12;
            ctx.fillStyle = "rgba(168,85,247,0.35)";
            roundRectPath(ctx, tile.x, tile.y, tile.w, tile.h, 8);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#e9d5ff";
            ctx.font = font(13, 800);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("↑", tile.x + tile.w / 2, tile.y + tile.h / 2);
            ctx.textBaseline = "alphabetic";
          } else if (tile.type === "speed") {
            ctx.save();
            ctx.shadowColor = rgba("#3b82f6", 0.5); ctx.shadowBlur = 10;
            ctx.fillStyle = TILE_COLORS.speed;
            roundRectPath(ctx, tile.x, tile.y, tile.w, tile.h, 8);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#dbeafe";
            ctx.font = font(12, 800);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("»", tile.x + tile.w / 2, tile.y + tile.h / 2);
            ctx.textBaseline = "alphabetic";
          } else if (tile.type === "portal") {
            const portalImg = imgRef.current.portal;
            const pcx = tile.x + tile.w / 2;
            const pcy = tile.y + tile.h / 2;
            ctx.save();
            ctx.shadowColor = rgba(TILE_COLORS.portal, 0.7); ctx.shadowBlur = 14;
            if (portalImg) {
              const s = 30;
              ctx.drawImage(portalImg, pcx - s / 2, pcy - s / 2, s, s);
            } else {
              ctx.fillStyle = TILE_COLORS.portal;
              ctx.beginPath();
              ctx.arc(pcx, pcy, tile.w / 2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
        ctx.textAlign = "left";

        // exit / goal (flag if available, else pulsing portal ring)
        const ex = gs.level.exit;
        const t2 = (ts % 1000) / 1000;
        const flagImg = imgRef.current.flag;
        ctx.save();
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 22 + Math.sin(t2 * Math.PI * 2) * 12;
        if (flagImg) {
          const s = 52;
          ctx.drawImage(flagImg, ex.x - s / 2, ex.y - s / 2, s, s);
        } else {
          ctx.strokeStyle = rgba(ACCENT, 0.5);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(ex.x, ex.y, 22 + Math.sin(t2 * Math.PI * 2) * 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = ACCENT;
          ctx.beginPath();
          ctx.arc(ex.x, ex.y, 18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        if (!flagImg) {
          ctx.fillStyle = "#fff";
          ctx.font = font(11, 800);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("META", ex.x, ex.y);
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = "left";
        }

        // ball (image if available, else radial-gradient orb)
        const ballImg = imgRef.current.ball;
        ctx.save();
        ctx.shadowColor = gs.gravDir < 0 ? rgba("#a855f7", 0.9) : rgba(ACCENT, 0.9);
        ctx.shadowBlur = 16;
        if (ballImg) {
          ctx.drawImage(ballImg, gs.bx - BALL_R, gs.by - BALL_R, BALL_R * 2, BALL_R * 2);
        } else {
          const ballGrad = ctx.createRadialGradient(gs.bx - 4, gs.by - 4, 2, gs.bx, gs.by, BALL_R);
          ballGrad.addColorStop(0, gs.gravDir < 0 ? "#c084fc" : "#93c5fd");
          ballGrad.addColorStop(1, gs.gravDir < 0 ? "#7e22ce" : "#1d4ed8");
          ctx.fillStyle = ballGrad;
          ctx.beginPath();
          ctx.arc(gs.bx, gs.by, BALL_R, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        if (gs.gravDir < 0) {
          // purple tint overlay to signal inverted gravity even with the image ball
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#a855f7";
          ctx.beginPath();
          ctx.arc(gs.bx, gs.by, BALL_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // particles
        for (const p of gs.particles) {
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // float texts
        for (const f of gs.floats) {
          ctx.globalAlpha = Math.min(f.life, 1);
          glowText(ctx, f.text, f.x, f.y, 20, f.color, { glow: rgba(f.color, 0.7) });
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // ---- virtual joystick (during play) ----
      if (gs.phase === "playing") {
        const baseX = gs.joyActive ? gs.joyBaseX : 76;
        const baseY = gs.joyActive ? gs.joyBaseY : H - 100;
        ctx.save();
        ctx.globalAlpha = gs.joyActive ? 0.45 : 0.22;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(baseX, baseY, JOY_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = gs.joyActive ? 0.9 : 0.5;
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(baseX + gs.joyDx * JOY_R, baseY + gs.joyDy * JOY_R, JOY_STICK_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Pista para el primer jugador mientras no toca el joystick.
        if (!gs.joyActive) {
          ctx.save();
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = "#fff";
          ctx.font = font(12, 700);
          ctx.textAlign = "center";
          ctx.fillText("Mantén y arrastra", baseX, baseY - JOY_R - 12);
          ctx.textAlign = "left";
          ctx.restore();
        }
      }

      // HUD pills (outside shake)
      if (playingLike) {
        drawPill(ctx, W / 2, 20, `Nivel ${gs.levelIdx + 1}/20`, { accent: ACCENT, fontSize: 15, align: "center" });
        drawPill(ctx, W - 66, 20, `${gs.score}`, { accent: "#fbbf24", textColor: "#fbbf24", fontSize: 15, align: "right", icon: "★" });
        drawPill(ctx, W - 66, 54, `Total ${gs.totalScore}`, { accent: "#94a3b8", fontSize: 13, align: "right" });
      }

      // onboarding card
      if (gs.phase === "onboarding") {
        onboardBtn = drawOnboard(ctx, W, H, {
          title: "Gravity Ball",
          subtitle: "Guía la bola hasta la meta esquivando los picos.",
          how: [
            "Mantén el dedo y arrástralo: la bola va hacia ahí",
            "La gravedad la jala suave hacia abajo",
            "Moradas invierten gravedad · azules dan turbo · picos = -100",
          ],
          scoring: "1000 pts por nivel · +500 sin morir · 20 niveles",
          accent: ACCENT,
        });
      }

      // paused (help reopened during play)
      if (gs.phase === "playing" && gs.paused) {
        onboardBtn = drawOnboard(ctx, W, H, {
          title: "Cómo jugar",
          subtitle: "Guía la bola hasta la meta esquivando los picos.",
          how: [
            "Mantén el dedo y arrástralo: la bola va hacia ahí",
            "La gravedad la jala suave hacia abajo",
            "Moradas invierten gravedad · azules dan turbo · picos = -100",
          ],
          scoring: "1000 pts por nivel · +500 sin morir · 20 niveles",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      }

      // win / gameover overlay
      if (gs.phase === "win" || gs.phase === "gameover") {
        ctx.fillStyle = "rgba(4,6,18,0.72)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 160, H / 2 - 130, 320, 275, 26);
        const win = gs.phase === "win";
        glowText(ctx, win ? "¡Completado!" : "Game Over", W / 2, H / 2 - 78, 34, win ? "#22c55e" : "#ef4444", { glow: win ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)" });
        glowText(ctx, `${gs.totalScore}`, W / 2, H / 2 - 12, 52, ACCENT, { glow: rgba(ACCENT, 0.8) });
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = font(16, 600);
        ctx.textAlign = "center";
        ctx.fillText(`Muertes: ${gs.deathCount}`, W / 2, H / 2 + 20);
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(15, 700);
        ctx.fillText(`Mejor: ${bestRef.current}`, W / 2, H / 2 + 46);
        drawButton(ctx, W / 2, H / 2 + 85, 180, 50, "Jugar de nuevo", { color: ACCENT, glow: true, fontSize: 18 });
        ctx.textAlign = "left";
      }

      // top-right icon buttons (always visible)
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    // ---- input helpers ----
    const toCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const restartRectHit = (x: number, y: number) => {
      const W = canvas.width, H = canvas.height;
      return x > W / 2 - 90 && x < W / 2 + 90 && y > H / 2 + 60 && y < H / 2 + 110;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const gs = gsRef.current!;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
      unlockAudio();
      gs.keys.add(e.key);
      if (e.code === "Space" || e.code === "Enter") {
        if (gs.phase === "onboarding") { sfx.click(); startGame(true); }
        else if (gs.phase === "playing" && gs.paused) { sfx.click(); gs.paused = false; }
        else if (gs.phase === "win" || gs.phase === "gameover") { sfx.click(); startGame(false); }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { gsRef.current!.keys.delete(e.key); };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current!;
      const W = canvas.width;
      const { x, y } = toCanvas(e.clientX, e.clientY);

      // mute button first (all phases)
      if (inRect(iconButtonRect(W, 0), x, y)) { toggleMute(); if (!isMuted()) sfx.click(); return; }
      // help button (playing / onboarding)
      if ((gs.phase === "playing" || gs.phase === "onboarding") && inRect(iconButtonRect(W, 1), x, y)) {
        sfx.click();
        if (gs.phase === "playing" && !gs.paused) gs.paused = true;
        return;
      }

      if (gs.phase === "loading") return;

      if (gs.phase === "onboarding") {
        if (!onboardBtn || inRect(onboardBtn, x, y)) { sfx.click(); startGame(true); }
        return;
      }

      if (gs.phase === "win" || gs.phase === "gameover") {
        if (restartRectHit(x, y)) { sfx.click(); startGame(false); }
        return;
      }

      // playing
      if (gs.paused) {
        if (onboardBtn && inRect(onboardBtn, x, y)) { sfx.click(); gs.paused = false; }
        return;
      }

      // otherwise: engage the floating joystick
      if (!gs.joyActive) {
        gs.joyActive = true;
        gs.joyId = e.pointerId;
        gs.joyBaseX = x;
        gs.joyBaseY = y;
        gs.joyDx = 0;
        gs.joyDy = 0;
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const gs = gsRef.current!;
      if (!gs.joyActive || e.pointerId !== gs.joyId) return;
      e.preventDefault();
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const rawDx = x - gs.joyBaseX;
      const rawDy = y - gs.joyBaseY;
      const len = Math.hypot(rawDx, rawDy);
      const clamp = Math.min(len, JOY_R) / JOY_R;
      gs.joyDx = len > 0 ? (rawDx / len) * clamp : 0;
      gs.joyDy = len > 0 ? (rawDy / len) * clamp : 0;
    };

    const onPointerUp = (e: PointerEvent) => {
      const gs = gsRef.current!;
      if (e.pointerId !== gs.joyId) return;
      gs.joyActive = false;
      gs.joyId = -1;
      gs.joyDx = 0;
      gs.joyDy = 0;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      ro.disconnect();
    };
  }, [initGS, startGame, loadLevel]);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#090b1c", minHeight: "100dvh", position: "relative" }}>
      <Link
        href="/"
        style={{
          position: "absolute", top: 14, left: 14, zIndex: 10,
          color: "#fff", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)",
          borderRadius: 999, padding: "8px 14px", fontSize: 14, fontWeight: 700,
          textDecoration: "none", fontFamily: "system-ui, sans-serif",
        }}
      >
        ← Volver
      </Link>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", maxWidth: 480, height: "100dvh", touchAction: "none" }}
      />
    </div>
  );
}
