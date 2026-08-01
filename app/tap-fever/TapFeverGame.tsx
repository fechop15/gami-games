"use client";
import Link from "next/link";

import { useEffect, useRef } from "react";
import {
  font, rgba, shade, drawBackground, drawButton, drawPill,
  glowText, drawPanel, drawHeart,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#a855f7";

type CircleType = "normal" | "golden" | "red" | "blue" | "fake";

interface FloatText { x: number; y: number; text: string; color: string; life: number; vy: number; big?: boolean; }

interface Circle {
  id: number;
  x: number;
  y: number;
  r: number;
  type: CircleType;
  maxLife: number;
  life: number;
  tapped: boolean;
  tapAnim: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  r: number;
}

interface Burst { x: number; y: number; life: number; r: number; }

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover";
  paused: boolean;
  loadPct: number;
  circles: Circle[];
  particles: Particle[];
  bursts: Burst[];
  lives: number;
  score: number;
  combo: number;
  comboMult: number;
  frozen: boolean;
  frozenTimer: number;
  spawnTimer: number;
  spawnInterval: number;
  level: number;
  maxCircles: number;
  circleLife: number;
  lastTime: number;
  idCounter: number;
  best: number;
  shake: number;
  floats: FloatText[];
}

const CIRCLE_COLORS: Record<CircleType, string> = {
  normal: "#a855f7",
  golden: "#fbbf24",
  red:    "#ef4444",
  blue:   "#60a5fa",
  fake:   "#1f2937",
};

function pickType(level: number): CircleType {
  const r = Math.random();
  if (level >= 5 && r < 0.1) return "fake";
  if (r < 0.05) return "blue";
  if (r < 0.12) return "red";
  if (r < 0.20) return "golden";
  return "normal";
}

function initGS(): GS {
  return {
    phase: "loading",
    paused: false,
    loadPct: 0,
    circles: [],
    particles: [],
    bursts: [],
    lives: 3,
    score: 0,
    combo: 0,
    comboMult: 1,
    frozen: false,
    frozenTimer: 0,
    spawnTimer: 0,
    spawnInterval: 1200,
    level: 1,
    maxCircles: 2,
    circleLife: 2,
    lastTime: 0,
    idCounter: 0,
    best: 0,
    shake: 0,
    floats: [],
  };
}

// Vertical band reserved at the top for the HUD (score, pills, lives, buttons).
const TOP_HUD = 116;

function spawnCircle(gs: GS, W: number, H: number) {
  if (gs.circles.filter(c => !c.tapped).length >= gs.maxCircles) return;
  const r = 34;
  const margin = r + 12;
  // Keep targets fully on-screen and below the HUD band (portrait-safe).
  const minY = TOP_HUD + r;
  const maxY = H - margin;
  if (maxY <= minY || W <= margin * 2) return;
  const x = margin + Math.random() * (W - margin * 2);
  const y = minY + Math.random() * (maxY - minY);
  const type = pickType(gs.level);
  const lifeScale = type === "golden" ? 1.3 : type === "red" ? 0.85 : 1;
  gs.circles.push({
    id: gs.idCounter++,
    x, y, r, type,
    maxLife: gs.circleLife * lifeScale,
    life: gs.circleLife * lifeScale,
    tapped: false,
    tapAnim: 0,
  });
}

export default function TapFeverGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS>(initGS());
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      // Size the backing store to the CSS box. Does NOT touch game state,
      // so a live game keeps running across orientation changes.
      canvas.width = canvas.clientWidth || Math.min(window.innerWidth, 480);
      canvas.height = canvas.clientHeight || window.innerHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Preload SVG assets, then move from loading -> onboarding.
    loadImages(
      {
        bg: "/games/tap-fever/bg.svg",
        ring: "/games/tap-fever/ring-target.svg",
        confetti: "/games/tap-fever/confetti.svg",
        bolt: "/games/tap-fever/bolt.svg",
      },
      (pct) => { gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;

    // Play rect for the current overlay (onboarding / paused / gameover),
    // captured during draw so the pointer handler hit-tests exact geometry.
    let playRect: Rect | null = null;

    const startGame = () => {
      const gs = gsRef.current;
      gs.phase = "playing";
      gs.paused = false;
      gs.circles = [];
      gs.particles = [];
      gs.bursts = [];
      gs.lives = 3;
      gs.score = 0;
      gs.combo = 0;
      gs.comboMult = 1;
      gs.frozen = false;
      gs.frozenTimer = 0;
      gs.spawnTimer = 0;
      gs.spawnInterval = 1200;
      gs.level = 1;
      gs.maxCircles = 2;
      gs.circleLife = 2;
      gs.shake = 0;
      gs.floats = [];
    };

    const tapCircle = (gs: GS, x: number, y: number) => {
      for (let i = gs.circles.length - 1; i >= 0; i--) {
        const c = gs.circles[i];
        if (c.tapped) continue;
        // Forgiving hit-box: matches the visible ring plus a small mobile margin.
        if (Math.hypot(x - c.x, y - c.y) <= c.r + 6) {
          c.tapped = true;
          c.tapAnim = 1;

          if (c.type === "fake") {
            gs.score = Math.max(0, gs.score - 20);
            gs.combo = 0;
            gs.comboMult = 1;
            gs.shake = 12;
            sfx.error();
            gs.floats.push({ x: c.x, y: c.y - 10, text: "-20", color: "#ef4444", life: 1, vy: -1.6, big: true });
            for (let j = 0; j < 10; j++) {
              const a = Math.random() * Math.PI * 2;
              gs.particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, color: "#ef4444", life: 0.8, r: 5 });
            }
            return;
          }

          gs.combo++;
          if (gs.combo >= 10) gs.comboMult = 3;
          else if (gs.combo >= 5) gs.comboMult = 2;
          else gs.comboMult = 1;

          const pts = (c.type === "golden" ? 50 : 10) * gs.comboMult;
          gs.score += pts;
          gs.shake = 3;

          // Sound: golden = perfect/bonus, streaks = combo, else a soft pop.
          if (c.type === "golden") { sfx.perfect(); gs.bursts.push({ x: c.x, y: c.y, life: 1, r: c.r }); }
          else if (gs.combo >= 3) sfx.combo(gs.combo);
          else sfx.pop();

          gs.floats.push({ x: c.x, y: c.y - 8, text: `+${pts}`, color: c.type === "golden" ? "#fbbf24" : "#d8b4fe", life: 1, vy: -1.5, big: c.type === "golden" });
          if (gs.comboMult > 1) {
            gs.floats.push({ x: c.x, y: c.y - 34, text: `COMBO x${gs.comboMult}!`, color: "#fbbf24", life: 1, vy: -1.2 });
          }

          if (c.type === "blue") {
            gs.frozen = true;
            gs.frozenTimer = 2;
          }

          const color = CIRCLE_COLORS[c.type];
          for (let j = 0; j < 14; j++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 160;
            gs.particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, color, life: 0.9 + Math.random() * 0.4, r: 3 + Math.random() * 4 });
          }
          return;
        }
      }
    };

    const draw = (ts: number) => {
      const gs = gsRef.current;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;

      const W = canvas.width;
      const H = canvas.height;

      // Loading screen.
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Tap Fever");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      if (active) {
        gs.spawnTimer += dt * 1000;
        if (gs.spawnTimer >= gs.spawnInterval) {
          gs.spawnTimer = 0;
          spawnCircle(gs, W, H);
        }

        if (gs.frozen) {
          gs.frozenTimer -= dt;
          if (gs.frozenTimer <= 0) gs.frozen = false;
        }

        const speed = gs.frozen ? 0 : 1;

        for (let i = gs.circles.length - 1; i >= 0; i--) {
          const c = gs.circles[i];
          if (c.tapped) {
            c.tapAnim -= dt * 4;
            if (c.tapAnim <= 0) gs.circles.splice(i, 1);
            continue;
          }
          c.life -= dt * speed;

          if (c.life <= 0) {
            gs.circles.splice(i, 1);
            if (c.type === "red") {
              gs.lives--;
              gs.combo = 0;
              gs.comboMult = 1;
              gs.shake = 10;
              sfx.hurt();
              if (gs.lives <= 0) { gs.phase = "gameover"; gs.best = Math.max(gs.best, gs.score); sfx.gameover(); }
            } else if (c.type === "normal") {
              gs.combo = 0;
              gs.comboMult = 1;
              sfx.error();
            }
          }
        }

        // level up every 10*level score
        const levelThreshold = gs.level * 10;
        if (gs.score >= levelThreshold * gs.level && gs.level < 20) {
          gs.level++;
          gs.maxCircles = Math.min(2 + Math.floor(gs.level / 2), 6);
          gs.circleLife = Math.max(0.7, 2 - gs.level * 0.08);
          gs.spawnInterval = Math.max(400, 1200 - gs.level * 50);
        }
      }

      // Animate transient effects (also while paused/overlay so they settle).
      gs.particles = gs.particles.filter(p => p.life > 0);
      for (const p of gs.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt;
        p.life -= dt * 1.5;
      }
      gs.bursts = gs.bursts.filter(b => b.life > 0);
      for (const b of gs.bursts) b.life -= dt * 2;
      gs.floats = gs.floats.filter(f => f.life > 0);
      for (const f of gs.floats) { f.y += f.vy; f.life -= dt; }
      if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 45);

      // Background — SVG art if loaded, else vibrant procedural gradient.
      const bg = imgRef.current.bg;
      if (bg) {
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = "rgba(13,8,25,0.38)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, gs.frozen ? ["#12213f", "#1a1638", "#0a0818"] : ["#2a1147", "#1c1033", "#0d0819"]);
      }
      if (gs.frozen) {
        ctx.fillStyle = "rgba(96,165,250,0.09)";
        ctx.fillRect(0, 0, W, H);
      }

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      // particles
      for (const p of gs.particles) {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // circles
      const ringImg = imgRef.current.ring;
      const boltImg = imgRef.current.bolt;
      for (const c of gs.circles) {
        const alpha = c.tapped ? Math.max(c.tapAnim, 0) : 1;
        const color = CIRCLE_COLORS[c.type];
        const t = c.life / c.maxLife;
        const displayR = c.tapped ? c.r * (1 + (1 - c.tapAnim) * 0.5) : c.r;

        // timer ring
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = rgba(color, 0.35);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(c.x, c.y, displayR + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(c.x, c.y, displayR + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
        ctx.stroke();

        if (c.type === "golden" && ringImg) {
          // Golden = special "target" art from ring-target.svg.
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.shadowColor = rgba(color, 0.85);
          ctx.shadowBlur = 18;
          const d = displayR * 2;
          ctx.drawImage(ringImg, c.x - displayR, c.y - displayR, d, d);
          ctx.restore();
          if (boltImg) {
            ctx.globalAlpha = alpha;
            const bd = displayR * 0.9;
            ctx.drawImage(boltImg, c.x - bd / 2, c.y - bd / 2, bd, bd);
          }
        } else {
          // main orb with radial gloss + glow
          ctx.save();
          if (c.type !== "fake") {
            ctx.shadowColor = rgba(color, 0.8);
            ctx.shadowBlur = 16;
          }
          const rg = ctx.createRadialGradient(c.x - displayR * 0.3, c.y - displayR * 0.3, displayR * 0.15, c.x, c.y, displayR * 0.85);
          rg.addColorStop(0, c.type === "fake" ? "#374151" : shade(color, 0.4));
          rg.addColorStop(1, c.type === "fake" ? "#111827" : shade(color, -0.15));
          ctx.fillStyle = rg;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(c.x, c.y, displayR * 0.78, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // highlight dot
          ctx.globalAlpha = alpha * 0.6;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(c.x - displayR * 0.28, c.y - displayR * 0.3, displayR * 0.16, 0, Math.PI * 2);
          ctx.fill();

          // fake: dashed warning border
          if (c.type === "fake") {
            ctx.globalAlpha = alpha;
            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = "#f87171";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(c.x, c.y, displayR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.globalAlpha = 1;
      }

      // confetti bursts (bonus celebration)
      const confettiImg = imgRef.current.confetti;
      for (const b of gs.bursts) {
        const scale = 1 + (1 - b.life) * 1.6;
        const d = b.r * 3 * scale;
        ctx.globalAlpha = Math.max(b.life, 0);
        if (confettiImg) {
          ctx.drawImage(confettiImg, b.x - d / 2, b.y - d / 2, d, d);
        } else {
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(b.x, b.y, d / 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // float texts
      for (const f of gs.floats) {
        ctx.globalAlpha = Math.min(f.life, 1);
        glowText(ctx, f.text, f.x, f.y, f.big ? 26 : 18, f.color, { glow: rgba(f.color, 0.7) });
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // end shake

      // HUD (hidden on overlays for a clean start screen, kept during play/gameover)
      if (gs.phase === "playing" || gs.phase === "gameover") {
        glowText(ctx, `${gs.score}`, 18, 92, 30, "#ffffff", { glow: rgba(ACCENT, 0.5), align: "left" });
        drawPill(ctx, W / 2, 14, `Nivel ${gs.level}`, { accent: ACCENT, fontSize: 13, align: "center" });
        if (gs.comboMult > 1) {
          drawPill(ctx, W / 2, 48, `Combo x${gs.comboMult}`, { accent: "#fbbf24", textColor: "#fde68a", fontSize: 14, align: "center" });
          if (gs.comboMult >= 3 && boltImg) ctx.drawImage(boltImg, W / 2 + 70, 44, 26, 26);
        }
        if (gs.frozen) drawPill(ctx, W / 2, 82, `${gs.frozenTimer.toFixed(1)}s`, { accent: "#60a5fa", textColor: "#bfdbfe", icon: "❄", fontSize: 13, align: "center" });
        // lives as hearts (below the top-right icon buttons)
        for (let i = 0; i < 3; i++) {
          drawHeart(ctx, W - 26 - i * 30, 88, 18, i < gs.lives);
        }
      }

      // onboarding overlay
      if (gs.phase === "onboarding") {
        playRect = drawOnboard(ctx, W, H, {
          title: "Tap Fever",
          subtitle: "Toca los círculos antes de que desaparezcan.",
          how: ["Toca los círculos antes de que desaparezcan", "Evita los círculos de borde rojo punteado"],
          scoring: "+10 normal · +50 dorado · combo x2/x3 al encadenar",
          accent: ACCENT,
        });
      }

      // paused (help reopened during play)
      if (gs.phase === "playing" && gs.paused) {
        playRect = drawOnboard(ctx, W, H, {
          title: "Cómo jugar",
          subtitle: "Toca los círculos antes de que desaparezcan.",
          how: ["Toca los círculos antes de que desaparezcan", "Evita los círculos de borde rojo punteado"],
          scoring: "+10 normal · +50 dorado · combo x2/x3",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      }

      // gameover overlay
      if (gs.phase === "gameover") {
        ctx.fillStyle = "rgba(6,4,14,0.72)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 150, H / 2 - 130, 300, 270, 26);
        glowText(ctx, "Game Over", W / 2, H / 2 - 78, 34, "#ef4444", { glow: "rgba(239,68,68,0.6)" });
        glowText(ctx, `${gs.score}`, W / 2, H / 2 - 6, 54, ACCENT, { glow: rgba(ACCENT, 0.8) });
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = font(16, 600);
        ctx.textAlign = "center";
        ctx.fillText(`Nivel ${gs.level}`, W / 2, H / 2 + 28);
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(15, 700);
        ctx.fillText(`Mejor: ${gs.best}`, W / 2, H / 2 + 52);
        ctx.textAlign = "left";
        const b = drawButton(ctx, W / 2, H / 2 + 95, 200, 54, "Jugar de nuevo", { color: ACCENT, glow: true, fontSize: 18 });
        playRect = { x: b.x, y: b.y, w: b.w, h: b.h };
      }

      // top-right icon buttons (mute on all phases; help during play/onboarding)
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const W = canvas.width;

      // Mute button (all phases) — must not count as a gameplay tap.
      if (inRect(iconButtonRect(W, 0), x, y)) { toggleMute(); if (!isMuted()) sfx.click(); return; }
      // Help button (playing / onboarding) — must not count as a gameplay tap.
      if ((gs.phase === "playing" || gs.phase === "onboarding") && inRect(iconButtonRect(W, 1), x, y)) {
        sfx.click();
        if (gs.phase === "playing" && !gs.paused) gs.paused = true;
        return;
      }

      if (gs.phase === "loading") return;

      if (gs.phase === "onboarding") {
        sfx.click();
        startGame();
      } else if (gs.phase === "playing") {
        if (gs.paused) {
          if (playRect && inRect(playRect, x, y)) { sfx.click(); gs.paused = false; }
        } else {
          tapCircle(gs, x, y);
        }
      } else if (gs.phase === "gameover") {
        if (playRect && inRect(playRect, x, y)) { sfx.click(); startGame(); }
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        unlockAudio();
        const gs = gsRef.current;
        if (gs.phase === "onboarding") { sfx.click(); startGame(); }
        else if (gs.phase === "gameover") { sfx.click(); startGame(); }
        else if (gs.phase === "playing" && gs.paused) gs.paused = false;
      }
    };

    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#0d0819", minHeight: "100dvh", position: "relative" }}>
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
