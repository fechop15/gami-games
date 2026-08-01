"use client";
import Link from "next/link";

import { useEffect, useRef, useCallback } from "react";
import {
  font, rgba, shade, roundRectPath, drawBackground,
  drawButton, drawPill, glowText, drawPanel,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#7c3aed";

interface Block {
  x: number;
  width: number;
  y: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
  big?: boolean;
}

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover";
  paused: boolean;
  loadPct: number;
  tower: Block[];
  currentX: number;
  currentWidth: number;
  currentDir: number;
  currentSpeed: number;
  score: number;
  height: number;
  best: number;
  particles: Particle[];
  floatTexts: FloatText[];
  masterUnlocked: boolean;
  shake: number;
  lastTime: number;
}

const BLOCK_H = 32;
const BASE_SPEED = 180;
// Friendly candy-purple palette, cycles smoothly up the tower.
const COLORS = [
  "#a78bfa","#8b5cf6","#7c3aed","#6d28d9","#818cf8",
  "#60a5fa","#38bdf8","#22d3ee","#c4b5fd","#a855f7",
];

function makeColor(idx: number) {
  return COLORS[idx % COLORS.length];
}

export default function StackTowerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS | null>(null);
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});

  const initGS = useCallback((): GS => {
    const canvas = canvasRef.current!;
    const W = canvas.width;
    const startWidth = W * 0.5;
    return {
      phase: "loading",
      paused: false,
      loadPct: 0,
      tower: [{ x: (W - startWidth) / 2, width: startWidth, y: canvas.height - BLOCK_H, color: COLORS[0] }],
      currentX: 0,
      currentWidth: startWidth,
      currentDir: 1,
      currentSpeed: BASE_SPEED,
      score: 0,
      height: 0,
      best: gsRef.current?.best ?? 0,
      particles: [],
      floatTexts: [],
      masterUnlocked: false,
      shake: 0,
      lastTime: 0,
    };
  }, []);

  const spawnBlock = useCallback((gs: GS) => {
    gs.currentWidth = gs.tower[gs.tower.length - 1].width;
    gs.currentX = gs.currentDir > 0 ? -gs.currentWidth : canvasRef.current!.width;
  }, []);

  const drop = useCallback(() => {
    const gs = gsRef.current;
    if (!gs || gs.phase !== "playing" || gs.paused) return;

    const canvas = canvasRef.current!;
    const top = gs.tower[gs.tower.length - 1];
    const overlap = Math.min(gs.currentX + gs.currentWidth, top.x + top.width) - Math.max(gs.currentX, top.x);

    if (overlap <= 0 || overlap < 5) {
      gs.phase = "gameover";
      gs.best = Math.max(gs.best, gs.score);
      gs.shake = 14;
      sfx.gameover();
      return;
    }

    const newX = Math.max(gs.currentX, top.x);
    const perfect = overlap / top.width > 0.9;

    // spawn cut particles
    if (gs.currentX < top.x) {
      for (let i = 0; i < 12; i++) {
        gs.particles.push({
          x: gs.currentX + Math.random() * (top.x - gs.currentX),
          y: top.y - BLOCK_H,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 3,
          color: top.color,
          life: 1,
        });
      }
    } else if (gs.currentX + gs.currentWidth > top.x + top.width) {
      const excess = gs.currentX + gs.currentWidth - (top.x + top.width);
      for (let i = 0; i < 12; i++) {
        gs.particles.push({
          x: top.x + top.width + Math.random() * excess,
          y: top.y - BLOCK_H,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 3,
          color: top.color,
          life: 1,
        });
      }
    }

    const newBlock: Block = {
      x: perfect ? top.x : newX,
      width: perfect ? top.width : overlap,
      y: top.y - BLOCK_H,
      color: makeColor(gs.tower.length),
    };

    gs.tower.push(newBlock);
    gs.height++;

    const pts = perfect ? 60 : 10;
    gs.score += pts;
    gs.shake = perfect ? 6 : 3;

    if (perfect) {
      sfx.perfect();
      // celebratory sparkle burst
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        gs.particles.push({
          x: newBlock.x + newBlock.width / 2,
          y: newBlock.y - BLOCK_H / 2,
          vx: Math.cos(a) * 4,
          vy: Math.sin(a) * 4,
          color: "#fbbf24",
          life: 1,
        });
      }
    } else {
      sfx.pop();
    }

    gs.floatTexts.push({
      x: newBlock.x + newBlock.width / 2,
      y: newBlock.y,
      text: perfect ? "PERFECT!" : "+10",
      color: perfect ? "#fbbf24" : "#c4b5fd",
      life: 1,
      vy: -1.5,
      big: perfect,
    });

    if (gs.height === 20 && !gs.masterUnlocked) {
      gs.masterUnlocked = true;
      sfx.levelup();
      gs.floatTexts.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        text: "Maestro Apilador!",
        color: "#f59e0b",
        life: 2,
        vy: -0.5,
        big: true,
      });
    }

    // increase speed every 5 blocks
    if (gs.height % 5 === 0) {
      gs.currentSpeed *= 1.15;
    }

    gs.currentDir *= -1;
    spawnBlock(gs);

    // keep tower visible by scrolling
    const minY = gs.tower[gs.tower.length - 1].y;
    if (minY < canvas.height * 0.4) {
      const shift = canvas.height * 0.4 - minY;
      // eslint-disable-next-line react-hooks/immutability -- gsRef state is intentionally mutable game state
      for (const b of gs.tower) b.y += shift;
      gs.particles.forEach(p => p.y += shift);
      gs.floatTexts.forEach(ft => ft.y += shift);
    }
  }, [spawnBlock]);

  const startGame = useCallback(() => {
    const gs = gsRef.current;
    if (!gs) return;
    const canvas = canvasRef.current!;
    const W = canvas.width;
    const startWidth = W * 0.5;
    gs.phase = "playing";
    gs.paused = false;
    gs.tower = [{ x: (W - startWidth) / 2, width: startWidth, y: canvas.height - BLOCK_H, color: COLORS[0] }];
    gs.currentWidth = startWidth;
    gs.score = 0;
    gs.height = 0;
    gs.particles = [];
    gs.floatTexts = [];
    gs.currentSpeed = BASE_SPEED;
    gs.currentDir = 1;
    gs.masterUnlocked = false;
    gs.shake = 0;
    spawnBlock(gs);
  }, [spawnBlock]);

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

    // Preload assets, then move to onboarding.
    loadImages(
      {
        bg: "/games/stack-tower/bg.svg",
        block: "/games/stack-tower/block.svg",
        crown: "/games/stack-tower/crown.svg",
      },
      (pct) => { if (gsRef.current) gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current && gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;

    const roundedBlock = (b: Block, glossy: boolean) => {
      ctx.save();
      const g = ctx.createLinearGradient(0, b.y, 0, b.y + BLOCK_H);
      g.addColorStop(0, shade(b.color, 0.22));
      g.addColorStop(1, shade(b.color, -0.12));
      ctx.fillStyle = g;
      roundRectPath(ctx, b.x, b.y, b.width, BLOCK_H, 8);
      ctx.fill();
      // top gloss
      roundRectPath(ctx, b.x, b.y, b.width, BLOCK_H, 8);
      ctx.clip();
      const gl = ctx.createLinearGradient(0, b.y, 0, b.y + BLOCK_H * 0.5);
      gl.addColorStop(0, "rgba(255,255,255,0.3)");
      gl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(b.x, b.y, b.width, BLOCK_H * 0.5);
      ctx.restore();
      if (glossy) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        roundRectPath(ctx, b.x, b.y, b.width, BLOCK_H, 8);
        ctx.stroke();
        ctx.restore();
      }
    };

    const draw = (ts: number) => {
      const gs = gsRef.current!;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;

      const W = canvas.width;
      const H = canvas.height;

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Stack Tower");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      // update
      if (active) {
        gs.currentX += gs.currentDir * gs.currentSpeed * dt;
        if (gs.currentX > W) { gs.currentX = W; gs.currentDir = -1; }
        if (gs.currentX + gs.currentWidth < 0) { gs.currentX = -gs.currentWidth; gs.currentDir = 1; }
      }

      // update particles
      gs.particles = gs.particles.filter(p => p.life > 0);
      for (const p of gs.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= dt * 1.5;
      }
      // update float texts
      gs.floatTexts = gs.floatTexts.filter(ft => ft.life > 0);
      for (const ft of gs.floatTexts) {
        ft.y += ft.vy;
        ft.life -= dt;
      }
      if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 40);

      // background (image if available, else procedural)
      const bg = imgRef.current.bg;
      if (bg) {
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = "rgba(13,8,33,0.35)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, ["#241559", "#180f3a", "#0d0821"]);
      }

      ctx.save();
      if (gs.shake > 0) {
        ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);
      }

      // tower
      for (const b of gs.tower) roundedBlock(b, false);

      // current moving block (glowing accent)
      if (gs.phase === "playing") {
        const top = gs.tower[gs.tower.length - 1];
        const cur: Block = { x: gs.currentX, width: gs.currentWidth, y: top.y - BLOCK_H, color: makeColor(gs.tower.length) };
        ctx.save();
        ctx.shadowColor = rgba(ACCENT, 0.8);
        ctx.shadowBlur = 18;
        roundedBlock(cur, true);
        ctx.restore();
      }

      // particles
      for (const p of gs.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // float texts
      for (const ft of gs.floatTexts) {
        ctx.globalAlpha = Math.min(ft.life, 1);
        glowText(ctx, ft.text, ft.x, ft.y, ft.big ? 30 : 22, ft.color, { glow: rgba(ft.color, 0.7) });
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // HUD
      if (gs.phase === "playing" || gs.phase === "gameover") {
        glowText(ctx, `${gs.score}`, W / 2, 62, 40, "#ffffff", { glow: rgba(ACCENT, 0.6) });
        drawPill(ctx, W / 2, 78, `Altura ${gs.height}`, { accent: ACCENT, fontSize: 14, align: "center" });
      }

      // onboarding
      if (gs.phase === "onboarding") {
        drawOnboard(ctx, W, H, {
          title: "Stack Tower",
          subtitle: "Apila los bloques con precisión perfecta.",
          how: ["Toca la pantalla para soltar el bloque", "Alinéalo con el de abajo para no perder ancho"],
          scoring: "+10 por bloque · +60 PERFECT (>90% alineado)",
          accent: ACCENT,
        });
      }

      // paused (help reopened)
      if (gs.phase === "playing" && gs.paused) {
        drawOnboard(ctx, W, H, {
          title: "Cómo jugar",
          subtitle: "Apila los bloques con precisión perfecta.",
          how: ["Toca la pantalla para soltar el bloque", "Alinéalo con el de abajo para no perder ancho"],
          scoring: "+10 por bloque · +60 PERFECT",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      }

      // gameover
      if (gs.phase === "gameover") {
        ctx.fillStyle = "rgba(6,4,18,0.7)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 150, H / 2 - 140, 300, 290, 26);
        glowText(ctx, "Game Over", W / 2, H / 2 - 88, 34, "#f43f5e", { glow: "rgba(244,63,94,0.6)" });
        glowText(ctx, `${gs.score}`, W / 2, H / 2 - 20, 56, ACCENT, { glow: rgba(ACCENT, 0.8) });
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = font(16, 600);
        ctx.textAlign = "center";
        ctx.fillText(`Altura: ${gs.height} bloques`, W / 2, H / 2 + 14);
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(15, 700);
        ctx.fillText(`Mejor: ${gs.best}`, W / 2, H / 2 + 42);
        drawButton(ctx, W / 2, H / 2 + 100, 200, 56, "Jugar de nuevo", { color: ACCENT, glow: true, fontSize: 19 });
        ctx.textAlign = "left";
      }

      // top-right icon buttons (always visible)
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        unlockAudio();
        const gs = gsRef.current!;
        if (gs.phase === "onboarding") { sfx.click(); startGame(); }
        else if (gs.phase === "playing") { if (gs.paused) gs.paused = false; else drop(); }
        else if (gs.phase === "gameover") { sfx.click(); startGame(); }
      }
    };

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const W = canvas.width;
      const H = canvas.height;

      // mute button (all phases)
      if (inRect(iconButtonRect(W, 0), x, y)) { toggleMute(); if (!isMuted()) sfx.click(); return; }
      // help button (playing / onboarding)
      if ((gs.phase === "playing" || gs.phase === "onboarding") && inRect(iconButtonRect(W, 1), x, y)) {
        sfx.click();
        if (gs.phase === "playing") gs.paused = true;
        return;
      }

      if (gs.phase === "loading") return;

      if (gs.phase === "onboarding") {
        sfx.click();
        startGame();
      } else if (gs.phase === "playing") {
        if (gs.paused) {
          // continue button area
          const btn: Rect = { x: W / 2 - 110, y: Math.max(24, (H - (250 + 2 * 30 + 34)) / 2) + (250 + 2 * 30 + 34) - 74, w: 220, h: 58 };
          if (inRect(btn, x, y)) { sfx.click(); gs.paused = false; }
        } else {
          drop();
        }
      } else if (gs.phase === "gameover") {
        if (x > W / 2 - 100 && x < W / 2 + 100 && y > H / 2 + 72 && y < H / 2 + 128) {
          sfx.click();
          startGame();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointer);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
      ro.disconnect();
    };
  }, [initGS, startGame, drop, spawnBlock]);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#0d0821", minHeight: "100dvh", position: "relative" }}>
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
