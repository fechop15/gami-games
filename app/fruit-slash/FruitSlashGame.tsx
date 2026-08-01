"use client";
import Link from "next/link";

import { useEffect, useRef } from "react";
import {
  font, rgba, shade, drawBackground, drawButton, drawPill,
  glowText, drawPanel, drawHeart, popScale,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#84cc16";
const FRUITS = ["🍉","🍊","🍋","🍇","🍓"];
const FRUIT_COLORS = ["#22c55e","#f97316","#eab308","#a855f7","#ef4444"];
const BANANA_COLOR = "#fbbf24";
const PINEAPPLE_COLOR = "#84cc16";
// Only these fruit indices have dedicated sprites; the rest fall back to emoji.
const FRUIT_SPRITE: Record<number, string> = { 0: "watermelon", 1: "orange" };

let fruitBest = 0;

interface FruitObj {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  emoji: string;
  color: string;
  spriteKey?: string;
  isBomb: boolean;
  isGolden: boolean;
  isPineapple: boolean;
  sliced: boolean;
  pop: number;
  halfA?: HalfFruit;
  halfB?: HalfFruit;
  zigzag?: boolean;
  zigzagDir?: number;
  zigzagTimer?: number;
}

interface HalfFruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rot: number;
  color: string;
  emoji: string;
  life: number;
}

interface Particle { x: number; y: number; vx: number; vy: number; color: string; life: number; }

interface Splash { x: number; y: number; life: number; rot: number; color: string; }

interface SlashTrail {
  points: { x: number; y: number }[];
  life: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  big?: boolean;
}

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover";
  paused: boolean;
  loadPct: number;
  fruits: FruitObj[];
  halves: HalfFruit[];
  particles: Particle[];
  splashes: Splash[];
  slash: SlashTrail | null;
  slashing: boolean;
  swipeCount: number;
  lives: number;
  score: number;
  elapsed: number;
  spawnTimer: number;
  spawnInterval: number;
  combo: number;
  comboTimer: number;
  floatTexts: FloatText[];
  shake: number;
  lastTime: number;
  idCounter: number;
  missedFruits: number;
}

function initGS(): GS {
  return {
    phase: "loading",
    paused: false,
    loadPct: 0,
    fruits: [],
    halves: [],
    particles: [],
    splashes: [],
    slash: null,
    slashing: false,
    swipeCount: 0,
    lives: 3,
    score: 0,
    elapsed: 0,
    spawnTimer: 0,
    spawnInterval: 1800,
    combo: 0,
    comboTimer: 0,
    floatTexts: [],
    shake: 0,
    lastTime: 0,
    idCounter: 0,
    missedFruits: 0,
  };
}

function spawnFruit(gs: GS, W: number, H: number) {
  const x = W * 0.15 + Math.random() * W * 0.7;
  // Launch upward; scale to a reference height so tall portrait screens
  // don't fling fruit far above the visible area.
  const ref = Math.min(H, 760);
  const vy = -(ref * 0.95 + Math.random() * ref * 0.35);
  // Bias horizontal velocity toward the center so fruit stays on-screen.
  const vx = (W / 2 - x) * 0.6 + (Math.random() - 0.5) * 160;
  const isBomb = Math.random() < Math.min(0.05 + gs.elapsed / 300, 0.25);
  const isGolden = !isBomb && Math.random() < 0.07;
  const isPineapple = !isBomb && !isGolden && Math.random() < 0.05;
  const fruitIdx = Math.floor(Math.random() * FRUITS.length);
  const zigzag = gs.elapsed >= 60 && Math.random() < 0.2;

  gs.fruits.push({
    id: gs.idCounter++,
    x,
    y: H + 30,
    vx,
    vy,
    r: 30,
    emoji: isBomb ? "💣" : isPineapple ? "🍍" : isGolden ? "🍌" : FRUITS[fruitIdx],
    color: isBomb ? "#374151" : isPineapple ? PINEAPPLE_COLOR : isGolden ? BANANA_COLOR : FRUIT_COLORS[fruitIdx],
    spriteKey: isBomb || isGolden || isPineapple ? undefined : FRUIT_SPRITE[fruitIdx],
    isBomb,
    isGolden,
    isPineapple,
    sliced: false,
    pop: 0,
    zigzag,
    zigzagDir: Math.random() < 0.5 ? 1 : -1,
    zigzagTimer: 0,
  });
}

export default function FruitSlashGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS>(initGS());
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});
  const playBtnRef = useRef<Rect | null>(null);
  const overBtnRef = useRef<Rect | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      canvas.width = canvas.clientWidth || Math.min(window.innerWidth, 480);
      canvas.height = canvas.clientHeight || window.innerHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Preload SVG assets, then move from loading -> onboarding.
    loadImages(
      {
        bg: "/games/fruit-slash/bg.svg",
        watermelon: "/games/fruit-slash/watermelon.svg",
        orange: "/games/fruit-slash/orange.svg",
        bomb: "/games/fruit-slash/bomb.svg",
        splash: "/games/fruit-slash/splash.svg",
        icon: "/games/fruit-slash/icon.svg",
      },
      (pct) => { gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;

    const startGame = () => {
      const gs = gsRef.current;
      gs.phase = "playing";
      gs.paused = false;
      gs.fruits = [];
      gs.halves = [];
      gs.particles = [];
      gs.splashes = [];
      gs.slash = null;
      gs.slashing = false;
      gs.swipeCount = 0;
      gs.lives = 3;
      gs.score = 0;
      gs.elapsed = 0;
      gs.spawnTimer = 0;
      gs.spawnInterval = 1800;
      gs.combo = 0;
      gs.comboTimer = 0;
      gs.floatTexts = [];
      gs.shake = 0;
      gs.missedFruits = 0;
    };

    const splatter = (gs: GS, x: number, y: number, color: string, n = 12) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 5;
        gs.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, color, life: 1 });
      }
    };

    const sliceFruit = (gs: GS, fruit: FruitObj) => {
      if (fruit.sliced) return;
      fruit.sliced = true;

      if (fruit.isBomb) {
        gs.lives--;
        gs.combo = 0;
        gs.shake = 18;
        splatter(gs, fruit.x, fruit.y, "#f87171", 20);
        gs.floatTexts.push({ x: fruit.x, y: fruit.y, text: "-1 vida", color: "#ef4444", life: 1.5, big: true });
        sfx.explode();
        if (gs.lives <= 0) { gs.phase = "gameover"; fruitBest = Math.max(fruitBest, gs.score); sfx.gameover(); }
        else sfx.hurt();
        return;
      }

      if (fruit.isPineapple) {
        const W = canvas.width; const H = canvas.height;
        sfx.powerup();
        for (const f of gs.fruits) {
          if (!f.sliced && !f.isBomb) sliceFruit(gs, f);
        }
        gs.shake = 10;
        gs.floatTexts.push({ x: W / 2, y: H / 2, text: "¡ONDA!", color: PINEAPPLE_COLOR, life: 1.5, big: true });
        return;
      }

      gs.combo++;
      gs.comboTimer = 1;
      gs.swipeCount++;
      const multi = Math.min(Math.floor(gs.combo / 3) + 1, 4);
      const base = fruit.isGolden ? 30 : 10;
      const pts = base * multi;
      gs.score += pts;
      splatter(gs, fruit.x, fruit.y, fruit.color, fruit.isGolden ? 18 : 12);
      gs.splashes.push({ x: fruit.x, y: fruit.y, life: 1, rot: Math.random() * Math.PI * 2, color: fruit.color });

      // Sound: first cut in a swipe = slice; subsequent cuts = rising combo.
      if (fruit.isGolden) sfx.coin();
      else if (gs.swipeCount >= 2) sfx.combo(gs.swipeCount);
      else sfx.slice();

      gs.floatTexts.push({
        x: fruit.x,
        y: fruit.y - 20,
        text: multi > 1 ? `+${pts} ×${multi}` : `+${pts}`,
        color: fruit.isGolden ? "#fbbf24" : "#ffffff",
        life: 1,
        big: multi > 1,
      });

      fruit.halfA = { x: fruit.x, y: fruit.y, vx: -80, vy: fruit.vy * 0.3, angle: 0, rot: -3, color: fruit.color, emoji: fruit.emoji, life: 1.5 };
      fruit.halfB = { x: fruit.x, y: fruit.y, vx: 80, vy: fruit.vy * 0.3, angle: 0, rot: 3, color: fruit.color, emoji: fruit.emoji, life: 1.5 };
      gs.halves.push(fruit.halfA, fruit.halfB);
    };

    const checkSlash = (gs: GS, x: number, y: number) => {
      for (const fruit of gs.fruits) {
        if (!fruit.sliced && Math.hypot(x - fruit.x, y - fruit.y) < fruit.r + 8) {
          sliceFruit(gs, fruit);
        }
      }
    };

    const draw = (ts: number) => {
      const gs = gsRef.current;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;
      const W = canvas.width;
      const H = canvas.height;

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Fruit Slash");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      if (active) {
        gs.elapsed += dt;
        gs.spawnTimer += dt * 1000;
        gs.comboTimer = Math.max(0, gs.comboTimer - dt);
        if (gs.comboTimer <= 0) gs.combo = 0;

        gs.spawnInterval = Math.max(500, 1800 - gs.elapsed * 8);

        if (gs.spawnTimer >= gs.spawnInterval) {
          gs.spawnTimer = 0;
          const count = Math.random() < 0.3 ? 2 : 1;
          for (let i = 0; i < count; i++) spawnFruit(gs, W, H);
        }

        for (let i = gs.fruits.length - 1; i >= 0; i--) {
          const f = gs.fruits[i];
          if (f.sliced) { gs.fruits.splice(i, 1); continue; }
          if (f.pop < 1) f.pop = Math.min(1, f.pop + dt * 5);
          f.vy += 600 * dt;
          if (f.zigzag) {
            f.zigzagTimer = (f.zigzagTimer ?? 0) + dt;
            if (f.zigzagTimer > 0.3) { f.zigzagTimer = 0; f.zigzagDir = (f.zigzagDir ?? 1) * -1; }
            f.vx = (f.zigzagDir ?? 1) * 180;
          }
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          if (f.y > H + 60 && !f.isBomb) {
            gs.missedFruits++;
            gs.lives--;
            gs.combo = 0;
            gs.fruits.splice(i, 1);
            if (gs.lives <= 0) { gs.phase = "gameover"; fruitBest = Math.max(fruitBest, gs.score); sfx.gameover(); }
            else sfx.hurt();
          } else if (f.y > H + 60) {
            gs.fruits.splice(i, 1);
          }
        }

        for (let i = gs.halves.length - 1; i >= 0; i--) {
          const hf = gs.halves[i];
          hf.vy += 500 * dt;
          hf.x += hf.vx * dt;
          hf.y += hf.vy * dt;
          hf.angle += hf.rot * dt;
          hf.life -= dt;
          if (hf.life <= 0 || hf.y > H + 100) gs.halves.splice(i, 1);
        }

        if (gs.slash) {
          gs.slash.life -= dt * 3;
          if (gs.slash.life <= 0) gs.slash = null;
        }

        gs.floatTexts = gs.floatTexts.filter(ft => ft.life > 0);
        for (const ft of gs.floatTexts) { ft.y -= 1.5; ft.life -= dt; }
      }

      // particles + splashes (always settle so nothing freezes visually)
      gs.particles = gs.particles.filter(p => p.life > 0);
      for (const p of gs.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= dt * 1.6; }
      gs.splashes = gs.splashes.filter(s => s.life > 0);
      for (const s of gs.splashes) s.life -= dt * 1.2;
      if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 50);

      // background (image if available, else procedural lime-tinted night)
      const bg = imgRef.current.bg;
      if (bg) {
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = "rgba(10,18,7,0.35)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, ["#182b12", "#14210f", "#0a1207"]);
      }

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      // juice splashes (behind everything)
      const splashImg = imgRef.current.splash;
      for (const s of gs.splashes) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life) * 0.7;
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        const sz = 70 * (1.3 - s.life * 0.3);
        if (splashImg) {
          ctx.drawImage(splashImg, -sz / 2, -sz / 2, sz, sz);
        } else {
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // splatter particles
      for (const p of gs.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 * p.life + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // halves
      for (const hf of gs.halves) {
        ctx.globalAlpha = Math.max(hf.life, 0);
        ctx.save();
        ctx.translate(hf.x, hf.y);
        ctx.rotate(hf.angle);
        // blob de color (visible aunque el emoji no se renderice)
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = hf.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-4, -4, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fill();
        ctx.font = `28px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(hf.emoji, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.textBaseline = "alphabetic";

      // fruits (sprite if available, else emoji; glow halo + pop-in scale)
      for (const f of gs.fruits) {
        if (f.sliced) continue;
        const s = popScale(f.pop);
        const img = f.isBomb ? imgRef.current.bomb : f.spriteKey ? imgRef.current[f.spriteKey] : undefined;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(s, s);
        ctx.shadowColor = rgba(f.color, f.isBomb ? 0.5 : 0.8);
        ctx.shadowBlur = f.isGolden ? 26 : 16;
        if (img) {
          const d = f.r * 2.3;
          ctx.drawImage(img, -d / 2, -d / 2, d, d);
        } else {
          // Fruta procedural — SIEMPRE visible, aunque el emoji no se renderice.
          const rad = f.r;
          ctx.beginPath();
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
          ctx.fillStyle = f.color;
          ctx.fill();
          // sombreado inferior para dar volumen
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(0, rad * 0.2, rad * 0.95, 0, Math.PI * 2);
          ctx.fillStyle = rgba(shade(f.color, -0.4), 0.3);
          ctx.fill();
          // brillo superior
          ctx.beginPath();
          ctx.arc(-rad * 0.33, -rad * 0.33, rad * 0.26, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fill();
          // emoji como detalle encima (si el sistema lo soporta)
          ctx.font = `${Math.round(f.r * 1.3)}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(f.emoji, 0, 0);
        }
        ctx.restore();
      }
      ctx.textBaseline = "alphabetic";

      // slash trail (glowing tapered blade)
      if (gs.slash && gs.slash.points.length > 1) {
        const pts = gs.slash.points;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = rgba(ACCENT, 0.9);
        ctx.shadowBlur = 16;
        ctx.globalAlpha = gs.slash.life * 0.6;
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = gs.slash.life;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
      }

      // float texts
      for (const ft of gs.floatTexts) {
        ctx.globalAlpha = Math.max(ft.life, 0);
        glowText(ctx, ft.text, ft.x, ft.y, ft.big ? 26 : 20, ft.color, { glow: rgba(ft.color, 0.7) });
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // HUD (playing / gameover)
      if (gs.phase === "playing" || gs.phase === "gameover") {
        glowText(ctx, `${gs.score}`, W / 2, 46, 34, "#ffffff", { glow: rgba(ACCENT, 0.6) });
        drawPill(ctx, 16, 20, `${Math.floor(gs.elapsed)}s`, { accent: ACCENT, fontSize: 14, icon: "⏱" });
        for (let i = 0; i < 3; i++) {
          drawHeart(ctx, W - 28 - i * 28, 80, 20, i < gs.lives);
        }
        if (gs.combo >= 3) {
          glowText(ctx, `COMBO ×${Math.min(Math.floor(gs.combo / 3) + 1, 4)}`, W / 2, 78, 22, "#fbbf24", { glow: "rgba(251,191,36,0.7)" });
        }
      }

      // onboarding
      if (gs.phase === "onboarding") {
        playBtnRef.current = drawOnboard(ctx, W, H, {
          title: "Fruit Slash",
          subtitle: "Corta toda la fruta que puedas y evita las bombas.",
          how: ["Arrastra el dedo para cortar", "Encadena cortes para subir el combo", "¡No cortes las 💣 bombas!"],
          scoring: "+10 por fruta · 🍌 ×3 · combo hasta ×4",
          accent: ACCENT,
        });
      }

      // paused (help reopened)
      if (gs.phase === "playing" && gs.paused) {
        playBtnRef.current = drawOnboard(ctx, W, H, {
          title: "Cómo jugar",
          subtitle: "Corta toda la fruta que puedas y evita las bombas.",
          how: ["Arrastra el dedo para cortar", "Encadena cortes para subir el combo", "¡No cortes las 💣 bombas!"],
          scoring: "+10 por fruta · 🍌 ×3 · combo hasta ×4",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      }

      // gameover
      if (gs.phase === "gameover") {
        ctx.fillStyle = "rgba(4,8,3,0.75)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 155, H / 2 - 140, 310, 290, 26);
        glowText(ctx, "Game Over", W / 2, H / 2 - 86, 36, "#ef4444", { glow: "rgba(239,68,68,0.6)" });
        glowText(ctx, `${gs.score}`, W / 2, H / 2 - 16, 56, ACCENT, { glow: rgba(ACCENT, 0.8) });
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = font(16, 600);
        ctx.textAlign = "center";
        ctx.fillText(`${Math.floor(gs.elapsed)}s jugados`, W / 2, H / 2 + 16);
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(15, 700);
        ctx.fillText(`Mejor: ${fruitBest}`, W / 2, H / 2 + 44);
        overBtnRef.current = drawButton(ctx, W / 2, H / 2 + 102, 210, 58, "Jugar de nuevo", { color: ACCENT, glow: true, textColor: "#0d1607", fontSize: 19 });
        ctx.textAlign = "left";
      }

      // top-right icon buttons (mute always; help during play/onboarding)
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const getPos = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current;
      const pos = getPos(e);
      const W = canvas.width;

      // mute button (all phases) — hit-test FIRST
      if (inRect(iconButtonRect(W, 0), pos.x, pos.y)) { toggleMute(); if (!isMuted()) sfx.click(); return; }
      // help button (playing / onboarding)
      if ((gs.phase === "playing" || gs.phase === "onboarding") && inRect(iconButtonRect(W, 1), pos.x, pos.y)) {
        sfx.click();
        if (gs.phase === "playing") gs.paused = true;
        return;
      }

      if (gs.phase === "loading") return;

      if (gs.phase === "onboarding") {
        if (!playBtnRef.current || inRect(playBtnRef.current, pos.x, pos.y)) { sfx.click(); startGame(); }
        return;
      }

      if (gs.phase === "gameover") {
        if (overBtnRef.current && inRect(overBtnRef.current, pos.x, pos.y)) { sfx.click(); startGame(); }
        return;
      }

      // playing
      if (gs.paused) {
        if (playBtnRef.current && inRect(playBtnRef.current, pos.x, pos.y)) { sfx.click(); gs.paused = false; }
        return;
      }
      // begin a slice swipe
      gs.slashing = true;
      gs.swipeCount = 0;
      gs.slash = { points: [pos], life: 1 };
      checkSlash(gs, pos.x, pos.y);
    };

    const onPointerMove = (e: PointerEvent) => {
      const gs = gsRef.current;
      if (gs.phase !== "playing" || gs.paused || !gs.slashing || !gs.slash) return;
      e.preventDefault();
      const pos = getPos(e);
      gs.slash.points.push(pos);
      if (gs.slash.points.length > 20) gs.slash.points.shift();
      gs.slash.life = 1;
      checkSlash(gs, pos.x, pos.y);
    };

    const onPointerUp = () => {
      const gs = gsRef.current;
      gs.slashing = false;
      gs.swipeCount = 0;
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

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#0a1207", minHeight: "100dvh", position: "relative" }}>
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
