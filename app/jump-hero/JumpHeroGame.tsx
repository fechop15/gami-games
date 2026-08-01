"use client";
import Link from "next/link";

import { useEffect, useRef } from "react";
import {
  font, rgba, shade, roundRectPath, drawBackground,
  drawButton, drawPill, glowText, drawPanel, drawStar,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#0ea5e9";

type PlatformType = "normal" | "moving" | "breakable" | "spring" | "cloud";
type PowerUpType = "jetpack" | "shield";

interface FloatText { x: number; y: number; text: string; color: string; life: number; vy: number; big?: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; color: string; life: number; r: number; }

interface Platform {
  x: number;
  y: number;
  w: number;
  type: PlatformType;
  dir?: number;
  speed?: number;
  uses?: number;
}

interface PowerUpItem {
  x: number;
  y: number;
  type: PowerUpType;
  collected: boolean;
}

interface Collectible { x: number; y: number; collected: boolean; }

interface Star { x: number; y: number; size: number; speed: number; }

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover";
  paused: boolean;
  loadPct: number;
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  cameraY: number;
  platforms: Platform[];
  powerUps: PowerUpItem[];
  collectibles: Collectible[];
  jetpackTimer: number;
  hasShield: boolean;
  score: number;
  meters: number;
  highScore: number;
  stars: Star[];
  lastTime: number;
  keys: Set<string>;
  squash: number;
  squashTimer: number;
  onGround: boolean;
  shake: number;
  floats: FloatText[];
  particles: Particle[];
}

const P_W = 28;
const P_H = 36;
const JUMP_V = -680;
const SPRING_V = -1100;
const GRAVITY = 1400;
const MOVE_SPEED = 260;
const PLAT_H = 12;
const PLAT_W_BASE = 80;
// Max reachable jump height with JUMP_V/GRAVITY ≈ 165px. Keep every gap under it
// so no platform is ever unreachable (QA: impossible-gap fix).
const MAX_GAP = 150;

function makePlatforms(startY: number, count: number, W: number, difficulty: number): Platform[] {
  const plats: Platform[] = [];
  let y = startY;
  for (let i = 0; i < count; i++) {
    const types: PlatformType[] = ["normal"];
    if (difficulty > 0.2) types.push("moving");
    if (difficulty > 0.4) types.push("breakable");
    if (difficulty > 0.1) types.push("spring");
    if (difficulty > 0.3) types.push("cloud");
    const type = i === 0 ? "normal" : types[Math.floor(Math.random() * types.length)];
    // gap always reachable: 62..130 (< MAX_GAP)
    const gap = Math.min(62 + Math.random() * 46 + difficulty * 22, MAX_GAP);
    y -= gap;
    const w = Math.max(PLAT_W_BASE - difficulty * 30, 44);
    plats.push({
      x: Math.random() * (W - w),
      y,
      w,
      type,
      dir: 1,
      speed: 60 + Math.random() * 60 + difficulty * 40,
      uses: type === "breakable" ? 1 : type === "cloud" ? 2 : 99,
    });
  }
  return plats;
}

function initGS(W: number, H: number): GS {
  const stars: Star[] = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() * 2 + 0.5,
    speed: 0.2 + Math.random() * 0.5,
  }));
  const plats = makePlatforms(H - 60, 16, W, 0);
  // La pista de arranque va en H-60 y el resto sube desde ahí. makePlatforms
  // había puesto el índice 0 con un hueco; al sobrescribirlo, el hueco real
  // hasta la 2ª plataforma se duplicaba (gap0+gap1 > salto máximo → imposible).
  // Bajamos el resto ese mismo hueco para dejar un solo gap alcanzable.
  const shift0 = (H - 60) - plats[0].y;
  for (let i = 1; i < plats.length; i++) plats[i].y += shift0;
  plats[0] = { x: W / 2 - 50, y: H - 60, w: 100, type: "normal", uses: 99, dir: 1, speed: 80 };
  return {
    phase: "loading",
    paused: false,
    loadPct: 0,
    px: W / 2 - P_W / 2,
    py: H - 60 - P_H,
    pvx: 0,
    pvy: 0,
    cameraY: 0,
    platforms: plats,
    powerUps: [],
    collectibles: [],
    jetpackTimer: 0,
    hasShield: false,
    score: 0,
    meters: 0,
    highScore: 0,
    stars,
    lastTime: 0,
    keys: new Set(),
    squash: 1,
    squashTimer: 0,
    onGround: false,
    shake: 0,
    floats: [],
    particles: [],
  };
}

export default function JumpHeroGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS | null>(null);
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      canvas.width = canvas.clientWidth || Math.min(window.innerWidth, 480);
      canvas.height = canvas.clientHeight || window.innerHeight;
    };
    resize();
    gsRef.current = initGS(canvas.width, canvas.height);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Preload SVG art, then move to onboarding. Procedural fallbacks kept below.
    loadImages(
      {
        bg: "/games/jump-hero/bg.svg",
        hero: "/games/jump-hero/hero.svg",
        spring: "/games/jump-hero/spring.svg",
        cloud: "/games/jump-hero/cloud.svg",
        star: "/games/jump-hero/star.svg",
      },
      (pct) => { if (gsRef.current) gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current && gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;
    let touchSide = 0; // -1 left, 1 right (held)

    // hit rects updated during draw, read by the pointer handler
    let pauseBtnRect: Rect | null = null;
    let restartBtnRect: Rect | null = null;

    const startGame = () => {
      const gs = gsRef.current!;
      const W = canvas.width;
      const H = canvas.height;
      const plats = makePlatforms(H - 60, 20, W, 0);
      // Mismo ajuste que initGS: evitar el doble hueco pista→2ª plataforma.
      const shift0 = (H - 60) - plats[0].y;
      for (let i = 1; i < plats.length; i++) plats[i].y += shift0;
      plats[0] = { x: W / 2 - 50, y: H - 60, w: 100, type: "normal", uses: 99, dir: 1, speed: 80 };
      gs.phase = "playing";
      gs.paused = false;
      gs.px = W / 2 - P_W / 2;
      gs.py = H - 60 - P_H;
      gs.pvx = 0;
      gs.pvy = 0;
      gs.cameraY = 0;
      gs.platforms = plats;
      gs.powerUps = [];
      gs.collectibles = [];
      gs.jetpackTimer = 0;
      gs.hasShield = false;
      gs.score = 0;
      gs.meters = 0;
      gs.squash = 1;
      gs.squashTimer = 0;
      gs.shake = 0;
      gs.floats = [];
      gs.particles = [];
      touchSide = 0;
    };

    const platColor: Record<PlatformType, string> = {
      normal: "#22c55e",
      moving: "#3b82f6",
      breakable: "#92400e",
      spring: "#eab308",
      cloud: "#94a3b8",
    };

    const ONBOARD = {
      title: "Jump Hero",
      subtitle: "Salta de plataforma en plataforma y sube lo más alto que puedas.",
      how: [
        "Toca/mantén la mitad izquierda o derecha para moverte",
        "Saltas solo al caer sobre una plataforma",
        "Recoge estrellas y power-ups (🚀 escudo 🛡️)",
      ],
      scoring: "Altura en metros · ⭐ y resortes +50",
      accent: ACCENT,
    };

    const draw = (ts: number) => {
      const gs = gsRef.current!;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;

      const W = canvas.width;
      const H = canvas.height;

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Jump Hero");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      if (active) {
        const difficulty = Math.min(gs.meters / 20, 1);

        // horizontal input (touch hold + keyboard)
        let hInput = 0;
        if (gs.keys.has("ArrowLeft") || gs.keys.has("a") || gs.keys.has("A")) hInput = -1;
        if (gs.keys.has("ArrowRight") || gs.keys.has("d") || gs.keys.has("D")) hInput = 1;
        if (touchSide !== 0) hInput = touchSide;

        gs.pvx = hInput * MOVE_SPEED;

        // gravity / jetpack
        if (gs.jetpackTimer > 0) {
          gs.jetpackTimer -= dt;
          gs.pvy = -400; // constant upward
        } else {
          gs.pvy += GRAVITY * dt;
        }

        gs.px += gs.pvx * dt;
        gs.py += gs.pvy * dt;

        // wrap horizontal
        if (gs.px + P_W < 0) gs.px = W;
        if (gs.px > W) gs.px = -P_W;

        // update moving platforms
        for (const p of gs.platforms) {
          if (p.type === "moving") {
            p.x += (p.dir ?? 1) * (p.speed ?? 80) * dt;
            if (p.x <= 0) { p.x = 0; p.dir = 1; }
            if (p.x + p.w >= W) { p.x = W - p.w; p.dir = -1; }
          }
        }

        // platform collision (only when falling, not on jetpack)
        gs.onGround = false;
        if (gs.pvy > 0 && gs.jetpackTimer <= 0) {
          for (const p of gs.platforms) {
            if (p.uses !== undefined && p.uses <= 0) continue;
            if (gs.px + P_W > p.x && gs.px < p.x + p.w && gs.py + P_H > p.y && gs.py + P_H < p.y + PLAT_H + gs.pvy * dt + 10) {
              if (p.uses !== undefined) p.uses--;
              const landX = gs.px + P_W / 2;
              const landY = p.y;
              if (p.type === "spring") {
                gs.pvy = SPRING_V;
                gs.score += 50;
                gs.squash = 1.5;
                gs.squashTimer = 0.15;
                gs.shake = 8;
                sfx.boost();
                gs.floats.push({ x: landX, y: landY - 20, text: "BOING! +50", color: "#eab308", life: 1, vy: -1.6, big: true });
              } else {
                gs.pvy = JUMP_V;
                gs.squash = 0.6;
                gs.squashTimer = 0.1;
                gs.shake = 2.5;
                sfx.jump();
                if (p.type === "moving") {
                  gs.score += 10;
                  gs.floats.push({ x: landX, y: landY - 16, text: "+10", color: "#7dd3fc", life: 1, vy: -1.4 });
                }
              }
              // landing dust puff
              for (let d = 0; d < 8; d++) {
                const a = Math.PI + (Math.random() - 0.5) * Math.PI;
                const spd = 40 + Math.random() * 80;
                gs.particles.push({ x: landX, y: landY, vx: Math.cos(a) * spd, vy: Math.abs(Math.sin(a)) * -spd * 0.4, color: platColor[p.type], life: 0.6, r: 2 + Math.random() * 3 });
              }
              gs.onGround = true;
              break;
            }
          }
        }

        // squash animation
        if (gs.squashTimer > 0) {
          gs.squashTimer -= dt;
          gs.squash += (1 - gs.squash) * dt * 15;
        } else {
          gs.squash = 1;
        }

        // camera follows player upward — scroll world down when player is above target
        if (gs.py < H * 0.55) {
          const camDelta = H * 0.55 - gs.py;
          gs.py = H * 0.55;
          gs.cameraY += camDelta;
          gs.meters = Math.max(gs.meters, Math.round(gs.cameraY / 100));
          for (const p of gs.platforms) p.y += camDelta;
          for (const pu of gs.powerUps) pu.y += camDelta;
          for (const c of gs.collectibles) c.y += camDelta;
          for (const ft of gs.floats) ft.y += camDelta;
          for (const pt of gs.particles) pt.y += camDelta;
          for (const s of gs.stars) {
            s.y += camDelta * s.speed;
            if (s.y < 0) s.y += H;
            if (s.y > H) s.y -= H;
          }
        }

        // recycle platforms below screen / spent, spawn more above
        for (let i = gs.platforms.length - 1; i >= 0; i--) {
          if (gs.platforms[i].y > H + 50 || (gs.platforms[i].uses !== undefined && gs.platforms[i].uses! <= 0)) {
            gs.platforms.splice(i, 1);
          }
        }
        while (gs.platforms.length < 20) {
          const topY = Math.min(...gs.platforms.map(p => p.y));
          const newPlats = makePlatforms(topY, 3, W, difficulty);
          gs.platforms.push(...newPlats);
          const spawnY = Math.min(...newPlats.map(p => p.y));
          // occasional power-up
          if (Math.random() < 0.14) {
            const type: PowerUpType = Math.random() < 0.5 ? "jetpack" : "shield";
            gs.powerUps.push({ x: 20 + Math.random() * (W - 60), y: spawnY - 44, type, collected: false });
          }
          // occasional collectible star
          if (Math.random() < 0.28) {
            gs.collectibles.push({ x: 18 + Math.random() * (W - 66), y: spawnY - 30 - Math.random() * 70, collected: false });
          }
        }

        // power-up collection
        for (const pu of gs.powerUps) {
          if (!pu.collected && gs.px + P_W > pu.x && gs.px < pu.x + 32 && gs.py + P_H > pu.y && gs.py < pu.y + 32) {
            pu.collected = true;
            sfx.powerup();
            if (pu.type === "jetpack") gs.jetpackTimer = 3;
            else gs.hasShield = true;
            gs.floats.push({ x: pu.x + 16, y: pu.y, text: pu.type === "jetpack" ? "JETPACK!" : "ESCUDO!", color: pu.type === "jetpack" ? "#fdba74" : "#bfdbfe", life: 1, vy: -1.4, big: true });
          }
        }
        gs.powerUps = gs.powerUps.filter(pu => !pu.collected && pu.y < H + 50);

        // collectible star pickup
        for (const c of gs.collectibles) {
          if (!c.collected && gs.px + P_W > c.x && gs.px < c.x + 30 && gs.py + P_H > c.y && gs.py < c.y + 30) {
            c.collected = true;
            gs.score += 50;
            sfx.coin();
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2;
              gs.particles.push({ x: c.x + 15, y: c.y + 15, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, color: "#fbbf24", life: 0.6, r: 2 + Math.random() * 2 });
            }
            gs.floats.push({ x: c.x + 15, y: c.y, text: "+50", color: "#fbbf24", life: 1, vy: -1.5 });
          }
        }
        gs.collectibles = gs.collectibles.filter(c => !c.collected && c.y < H + 50);

        // game over: fell off bottom
        if (gs.py > H + 50) {
          if (gs.hasShield) {
            gs.hasShield = false;
            gs.py = H - 100;
            gs.pvy = JUMP_V;
            sfx.hit();
          } else {
            gs.highScore = Math.max(gs.highScore, gs.meters);
            gs.phase = "gameover";
            gs.shake = 10;
            sfx.gameover();
          }
        }
      }

      // update juice (floats / particles / shake) — runs even while paused-frozen? no,
      // only advance when not paused so physics truly freezes.
      if (gs.phase !== "playing" || !gs.paused) {
        gs.floats = gs.floats.filter(f => f.life > 0);
        for (const f of gs.floats) { f.y += f.vy; f.life -= dt; }
        gs.particles = gs.particles.filter(p => p.life > 0);
        for (const p of gs.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt * 1.6; }
        if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 40);
      }

      // background — image if available, else procedural dreamy sky
      const bgImg = imgRef.current.bg;
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, W, H);
        ctx.fillStyle = "rgba(8,18,38,0.32)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, ["#0b2a4a", "#12385f", "#081226"]);
      }

      // twinkling background stars
      ctx.fillStyle = "#fff";
      for (const s of gs.stars) {
        ctx.globalAlpha = 0.5 + Math.random() * 0.35;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      if (gs.phase !== "onboarding") {
        // platforms (rounded + soft glow, cloud/ spring use art)
        for (const p of gs.platforms) {
          if (p.y < -PLAT_H * 3 || p.y > H + PLAT_H) continue;
          if (p.uses !== undefined && p.uses <= 0) continue;
          const cloudImg = imgRef.current.cloud;
          if (p.type === "cloud" && cloudImg) {
            ctx.drawImage(cloudImg, p.x, p.y - 8, p.w, PLAT_H + 16);
          } else {
            const base = platColor[p.type];
            ctx.save();
            ctx.shadowColor = rgba(base, 0.5);
            ctx.shadowBlur = 8;
            const g = ctx.createLinearGradient(0, p.y, 0, p.y + PLAT_H);
            g.addColorStop(0, shade(base, 0.25));
            g.addColorStop(1, shade(base, -0.1));
            ctx.fillStyle = g;
            roundRectPath(ctx, p.x, p.y, p.w, PLAT_H, 6);
            ctx.fill();
            ctx.restore();
          }
          if (p.type === "spring") {
            const springImg = imgRef.current.spring;
            if (springImg) {
              ctx.drawImage(springImg, p.x + p.w / 2 - 12, p.y - 22, 24, 24);
            } else {
              ctx.fillStyle = "#fff";
              roundRectPath(ctx, p.x + p.w / 2 - 3, p.y - 8, 6, 8, 2);
              ctx.fill();
            }
          }
        }

        // collectible stars
        for (const c of gs.collectibles) {
          if (c.collected) continue;
          const st = imgRef.current.star;
          if (st) {
            ctx.save();
            ctx.shadowColor = "rgba(251,191,36,0.8)";
            ctx.shadowBlur = 12;
            ctx.drawImage(st, c.x, c.y, 30, 30);
            ctx.restore();
          } else {
            drawStar(ctx, c.x + 15, c.y + 15, 15, "#fbbf24");
          }
        }

        // power-ups
        for (const pu of gs.powerUps) {
          if (pu.collected) continue;
          ctx.font = font(24, 400);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(pu.type === "jetpack" ? "🚀" : "🛡️", pu.x + 16, pu.y + 16);
          ctx.textBaseline = "alphabetic";
        }
        ctx.textAlign = "left";

        // player (squash & stretch) — hero art with procedural fallback
        const body = gs.jetpackTimer > 0 ? "#f97316" : gs.hasShield ? "#60a5fa" : ACCENT;
        const sx = gs.squash;
        const sy = 2 - gs.squash;
        const heroImg = imgRef.current.hero;
        ctx.save();
        ctx.translate(gs.px + P_W / 2, gs.py + P_H / 2);
        ctx.scale(sx, sy);
        ctx.shadowColor = rgba(body, 0.7);
        ctx.shadowBlur = 16;
        if (heroImg) {
          const size = 54;
          ctx.drawImage(heroImg, -size / 2, -size / 2, size, size);
          ctx.shadowBlur = 0;
        } else {
          const drawW = P_W;
          const drawH = P_H;
          const pg = ctx.createLinearGradient(0, -drawH / 2, 0, drawH / 2);
          pg.addColorStop(0, shade(body, 0.25));
          pg.addColorStop(1, shade(body, -0.08));
          ctx.fillStyle = pg;
          roundRectPath(ctx, -drawW / 2, -drawH / 2, drawW, drawH, 8);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff";
          const eyeY = -drawH * 0.15;
          ctx.beginPath(); ctx.arc(-drawW * 0.2, eyeY, drawW * 0.12, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(drawW * 0.2, eyeY, drawW * 0.12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#0b1220";
          ctx.beginPath(); ctx.arc(-drawW * 0.2, eyeY, drawW * 0.06, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(drawW * 0.2, eyeY, drawW * 0.06, 0, Math.PI * 2); ctx.fill();
        }
        // shield ring
        if (gs.hasShield) {
          ctx.strokeStyle = "rgba(147,197,253,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(P_W, P_H) * 0.72, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        // jetpack flame
        if (gs.jetpackTimer > 0) {
          ctx.save();
          ctx.shadowColor = "rgba(251,191,36,0.9)";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.ellipse(gs.px + P_W / 2, gs.py + P_H + 8, 6, 10 + Math.random() * 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // particles + float texts (world space, shaken)
      for (const p of gs.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const f of gs.floats) {
        ctx.globalAlpha = Math.min(f.life, 1);
        glowText(ctx, f.text, f.x, f.y, f.big ? 24 : 18, f.color, { glow: rgba(f.color, 0.7) });
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // end shake

      // HUD (pills)
      if (gs.phase === "playing" || gs.phase === "gameover") {
        glowText(ctx, `${gs.meters}m`, W / 2, 46, 30, "#ffffff", { glow: rgba(ACCENT, 0.5) });
        drawPill(ctx, W / 2, 60, `Mejor ${gs.highScore}m`, { accent: ACCENT, fontSize: 12, align: "center" });
        if (gs.jetpackTimer > 0) drawPill(ctx, 14, 66, `${gs.jetpackTimer.toFixed(1)}s`, { accent: "#f97316", textColor: "#fdba74", icon: "🚀", fontSize: 14, align: "left" });
        if (gs.hasShield) drawPill(ctx, 14, gs.jetpackTimer > 0 ? 100 : 66, "Escudo", { accent: "#60a5fa", textColor: "#bfdbfe", icon: "🛡️", fontSize: 14, align: "left" });
      }

      // onboarding
      if (gs.phase === "onboarding") {
        drawOnboard(ctx, W, H, ONBOARD);
      }

      // paused (help reopened)
      if (gs.phase === "playing" && gs.paused) {
        pauseBtnRect = drawOnboard(ctx, W, H, { ...ONBOARD, title: "Cómo jugar", playLabel: "CONTINUAR" });
      } else {
        pauseBtnRect = null;
      }

      // gameover
      if (gs.phase === "gameover") {
        ctx.fillStyle = "rgba(4,10,22,0.72)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 150, H / 2 - 130, 300, 270, 26);
        glowText(ctx, "¡Caíste!", W / 2, H / 2 - 78, 34, "#ef4444", { glow: "rgba(239,68,68,0.6)" });
        glowText(ctx, `${gs.meters}m`, W / 2, H / 2 - 8, 52, ACCENT, { glow: rgba(ACCENT, 0.8) });
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(16, 700);
        ctx.textAlign = "center";
        ctx.fillText(`Mejor: ${gs.highScore}m`, W / 2, H / 2 + 30);
        restartBtnRect = drawButton(ctx, W / 2, H / 2 + 85, 190, 54, "Jugar de nuevo", { color: ACCENT, glow: true, fontSize: 18 });
        ctx.textAlign = "left";
      } else {
        restartBtnRect = null;
      }

      // top-right icon buttons (always visible)
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const onKey = (e: KeyboardEvent) => {
      unlockAudio();
      const gs = gsRef.current!;
      gs.keys.add(e.key);
      if ((e.code === "Space" || e.key === "Enter")) {
        if (gs.phase === "onboarding") { sfx.click(); startGame(); }
        else if (gs.phase === "gameover") { sfx.click(); startGame(); }
        else if (gs.phase === "playing" && gs.paused) gs.paused = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => gsRef.current!.keys.delete(e.key);

    const pointerXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * canvas.width / rect.width,
        y: (e.clientY - rect.top) * canvas.height / rect.height,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current!;
      const W = canvas.width;
      const { x, y } = pointerXY(e);

      // mute button first (all phases)
      if (inRect(iconButtonRect(W, 0), x, y)) { toggleMute(); if (!isMuted()) sfx.click(); return; }
      // help button (playing / onboarding)
      if ((gs.phase === "playing" || gs.phase === "onboarding") && inRect(iconButtonRect(W, 1), x, y)) {
        sfx.click();
        if (gs.phase === "playing") { gs.paused = true; touchSide = 0; }
        return;
      }

      if (gs.phase === "loading") return;

      if (gs.phase === "onboarding") { sfx.click(); startGame(); return; }

      if (gs.phase === "gameover") {
        if (restartBtnRect && inRect(restartBtnRect, x, y)) { sfx.click(); startGame(); }
        return;
      }

      // playing
      if (gs.paused) {
        if (pauseBtnRect && inRect(pauseBtnRect, x, y)) { sfx.click(); gs.paused = false; }
        return;
      }
      // movement: hold left/right half of the screen
      touchSide = x < W / 2 ? -1 : 1;
    };

    const onPointerUp = () => { touchSide = 0; };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
      ro.disconnect();
    };
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#081226", minHeight: "100dvh", position: "relative" }}>
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
