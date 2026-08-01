"use client";
import Link from "next/link";

import { useEffect, useRef } from "react";
import {
  font, rgba, roundRectPath, drawBackground,
  drawButton, drawPill, glowText, drawPanel, drawStar,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#10b981";
const GRID = 20;

interface Cell { x: number; y: number; }
interface Obstacle { x: number; y: number; moveTimer: number; dir: number; }
interface Particle { x: number; y: number; vx: number; vy: number; color: string; life: number; }
interface FloatText { x: number; y: number; text: string; color: string; life: number; }

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover";
  paused: boolean;
  loadPct: number;
  snake: Cell[];
  dir: Cell;
  nextDir: Cell;
  food: Cell;
  golden: Cell | null;
  goldenTimer: number;
  goldenCount: number;
  obstacles: Obstacle[];
  score: number;
  best: number;
  level: number;
  eaten: number;
  speed: number;
  moveTimer: number;
  obstacleTimer: number;
  pulse: number;
  shake: number;
  particles: Particle[];
  floatTexts: FloatText[];
  swipeStart: { x: number; y: number } | null;
}

function rndCell(exclude: Cell[]): Cell {
  let c: Cell;
  do {
    c = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (exclude.some(e => e.x === c.x && e.y === c.y));
  return c;
}

function buildObstacles(level: number, snake: Cell[]): Obstacle[] {
  if (level < 5) return [];
  const count = Math.min((level - 4) * 2, 10);
  const obs: Obstacle[] = [];
  for (let i = 0; i < count; i++) {
    const c = rndCell([...snake, ...obs]);
    obs.push({ ...c, moveTimer: 0, dir: 0 });
  }
  return obs;
}

function initGS(best = 0): GS {
  const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  const food = rndCell(snake);
  return {
    phase: "loading",
    paused: false,
    loadPct: 0,
    snake,
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food,
    golden: null,
    goldenTimer: 0,
    goldenCount: 0,
    obstacles: [],
    score: 0,
    best,
    level: 1,
    eaten: 0,
    speed: 160,
    moveTimer: 0,
    obstacleTimer: 0,
    pulse: 0,
    shake: 0,
    particles: [],
    floatTexts: [],
    swipeStart: null,
  };
}

export default function SnakeEvoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS>(initGS());
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const canvas = canvasRef.current!;
    let cellSize = 0;
    let offsetX = 0;
    let offsetY = 0;

    // Recompute canvas backing size + grid geometry from the element's CSS box.
    // Never resets the in-progress game — grid stays 20×20, only cell size scales.
    const resize = () => {
      canvas.width = canvas.clientWidth || Math.min(window.innerWidth, 480);
      canvas.height = canvas.clientHeight || window.innerHeight;
      const side = Math.min(canvas.width, canvas.height - 80);
      cellSize = Math.floor(side / GRID);
      offsetX = Math.floor((canvas.width - cellSize * GRID) / 2);
      offsetY = Math.floor((canvas.height - cellSize * GRID) / 2);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Preload SVG assets, then move to onboarding.
    loadImages(
      {
        bg: "/games/snake-evo/bg.svg",
        apple: "/games/snake-evo/apple.svg",
        gem: "/games/snake-evo/gem.svg",
        head: "/games/snake-evo/head.svg",
      },
      (pct) => { gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;
    let lastTime = 0;

    // UI hit rects captured during draw for the pointer handler.
    let uiPlayBtn: Rect | null = null;
    let uiRestartBtn: Rect | null = null;

    const cellCenter = (c: Cell) => ({
      x: offsetX + c.x * cellSize + cellSize / 2,
      y: offsetY + c.y * cellSize + cellSize / 2,
    });

    const burst = (gs: GS, cell: Cell, color: string, n = 10) => {
      const { x, y } = cellCenter(cell);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random();
        const sp = 1.5 + Math.random() * 2.5;
        gs.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, life: 1 });
      }
    };

    const startGame = () => {
      const gs = gsRef.current;
      const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      gs.phase = "playing";
      gs.paused = false;
      gs.snake = snake;
      gs.dir = { x: 1, y: 0 };
      gs.nextDir = { x: 1, y: 0 };
      gs.food = rndCell(snake);
      gs.golden = null;
      gs.goldenTimer = 0;
      gs.goldenCount = 0;
      gs.obstacles = [];
      gs.score = 0;
      gs.level = 1;
      gs.eaten = 0;
      gs.speed = 160;
      gs.moveTimer = 0;
      gs.obstacleTimer = 0;
      gs.particles = [];
      gs.floatTexts = [];
      gs.shake = 0;
      gs.swipeStart = null;
    };

    const setDir = (nx: number, ny: number) => {
      const gs = gsRef.current;
      if (gs.phase !== "playing" || gs.paused) return;
      const { dir } = gs;
      // prevent 180° reversal into itself
      if (nx !== 0 && dir.x === -nx) return;
      if (ny !== 0 && dir.y === -ny) return;
      gs.nextDir = { x: nx, y: ny };
    };

    const draw = (ts: number) => {
      const gs = gsRef.current;
      const dt = Math.min(ts - lastTime, 50);
      lastTime = ts;
      const W = canvas.width;
      const H = canvas.height;
      const dts = dt / 1000;

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Snake Evo");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      gs.pulse = (gs.pulse + dt * 0.003) % (Math.PI * 2);

      const active = gs.phase === "playing" && !gs.paused;

      if (active) {
        gs.moveTimer += dt;
        gs.obstacleTimer += dt;

        // golden timer
        if (gs.golden) {
          gs.goldenTimer -= dt;
          if (gs.goldenTimer <= 0) gs.golden = null;
        }

        // move obstacles level 10+
        if (gs.level >= 10 && gs.obstacleTimer > 3000) {
          gs.obstacleTimer = 0;
          for (const obs of gs.obstacles) {
            const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = (obs.x + d.x + GRID) % GRID;
            const ny = (obs.y + d.y + GRID) % GRID;
            if (!gs.snake.some(s => s.x === nx && s.y === ny)) {
              obs.x = nx;
              obs.y = ny;
            }
          }
        }

        if (gs.moveTimer >= gs.speed) {
          gs.moveTimer = 0;
          gs.dir = gs.nextDir;
          const head = gs.snake[0];
          const newHead = {
            x: (head.x + gs.dir.x + GRID) % GRID,
            y: (head.y + gs.dir.y + GRID) % GRID,
          };

          // self / obstacle collision → crash
          const hitSelf = gs.snake.some(s => s.x === newHead.x && s.y === newHead.y);
          const hitObs = gs.obstacles.some(o => o.x === newHead.x && o.y === newHead.y);
          if (hitSelf || hitObs) {
            gs.best = Math.max(gs.best, gs.score);
            gs.shake = 16;
            gs.phase = "gameover";
            sfx.hit();
            sfx.gameover();
            rafRef.current = requestAnimationFrame(draw);
            return;
          }

          gs.snake.unshift(newHead);

          if (newHead.x === gs.food.x && newHead.y === gs.food.y) {
            gs.eaten++;
            gs.score += 10;
            sfx.pop();
            burst(gs, gs.food, "#ef4444", 9);
            const fc2 = cellCenter(gs.food);
            gs.floatTexts.push({ x: fc2.x, y: fc2.y, text: "+10", color: "#fff", life: 0.9 });
            gs.food = rndCell([...gs.snake, ...gs.obstacles]);

            if (gs.eaten % 10 === 0 && !gs.golden) {
              gs.golden = rndCell([...gs.snake, gs.food, ...gs.obstacles]);
              gs.goldenTimer = 5000;
            }

            if (gs.eaten % 5 === 0) {
              gs.level++;
              gs.speed = Math.max(gs.speed * 0.85, 60);
              gs.obstacles = buildObstacles(gs.level, gs.snake);
              gs.floatTexts.push({ x: W / 2, y: offsetY + 40, text: `¡Nivel ${gs.level}!`, color: ACCENT, life: 1.3 });
              sfx.levelup();
            }
          } else if (gs.golden && newHead.x === gs.golden.x && newHead.y === gs.golden.y) {
            gs.score += 50;
            gs.goldenCount++;
            sfx.powerup();
            burst(gs, gs.golden, "#fbbf24", 16);
            const gc = cellCenter(gs.golden);
            gs.floatTexts.push({ x: gc.x, y: gc.y, text: "+50", color: "#fbbf24", life: 1.1 });
            gs.shake = 8;
            gs.golden = null;
          } else {
            gs.snake.pop();
          }
        }
      }

      // update particles / float texts / shake
      gs.particles = gs.particles.filter(p => p.life > 0);
      for (const p of gs.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= dts * 1.8; }
      gs.floatTexts = gs.floatTexts.filter(f => f.life > 0);
      for (const f of gs.floatTexts) { f.y -= 0.6; f.life -= dts; }
      if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dts * 45);

      // background (image if available, else procedural)
      const bg = imgRef.current.bg;
      if (bg) {
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = "rgba(8,15,13,0.4)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, ["#0d2a20", "#0c1a17", "#080f0d"]);
      }

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      // board panel
      const boardW = cellSize * GRID;
      const boardH = cellSize * GRID;
      ctx.save();
      ctx.shadowColor = rgba(ACCENT, 0.25);
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#0e1a18";
      roundRectPath(ctx, offsetX, offsetY, boardW, boardH, 16);
      ctx.fill();
      ctx.restore();

      // grid lines (clipped to rounded board)
      ctx.save();
      roundRectPath(ctx, offsetX, offsetY, boardW, boardH, 16);
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + boardH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + boardW, offsetY + i * cellSize);
        ctx.stroke();
      }
      ctx.restore();

      // obstacles
      for (const obs of gs.obstacles) {
        ctx.fillStyle = "#64748b";
        roundRectPath(ctx, offsetX + obs.x * cellSize + 2, offsetY + obs.y * cellSize + 2, cellSize - 4, cellSize - 4, 4);
        ctx.fill();
      }

      const fc = cellSize / 2;

      // food (apple image if available, else pulsating red orb)
      const foodPulse = 0.85 + 0.15 * Math.sin(gs.pulse * 3);
      const apple = imgRef.current.apple;
      const foodCX = offsetX + gs.food.x * cellSize + fc;
      const foodCY = offsetY + gs.food.y * cellSize + fc;
      if (apple) {
        const sz = cellSize * foodPulse * 1.15;
        ctx.save();
        ctx.shadowColor = "rgba(239,68,68,0.6)";
        ctx.shadowBlur = 12;
        ctx.drawImage(apple, foodCX - sz / 2, foodCY - sz / 2, sz, sz);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = "rgba(239,68,68,0.7)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(foodCX, foodCY, fc * foodPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // golden item (gem image if available, else star)
      if (gs.golden) {
        const glow = 0.85 + 0.15 * Math.sin(gs.pulse * 5);
        const gemCX = offsetX + gs.golden.x * cellSize + fc;
        const gemCY = offsetY + gs.golden.y * cellSize + fc;
        const gem = imgRef.current.gem;
        if (gem) {
          const sz = cellSize * 1.2 * glow;
          ctx.save();
          ctx.shadowColor = "rgba(251,191,36,0.75)";
          ctx.shadowBlur = 16;
          ctx.drawImage(gem, gemCX - sz / 2, gemCY - sz / 2, sz, sz);
          ctx.restore();
        } else {
          drawStar(ctx, gemCX, gemCY, fc * 0.95 * glow, "#fbbf24");
        }
      }

      // snake with rounded glossy segments
      const headImg = imgRef.current.head;
      for (let i = gs.snake.length - 1; i >= 0; i--) {
        const s = gs.snake[i];
        const t = i / gs.snake.length;
        const r = Math.round(34 + (16 - 34) * t);
        const g2 = Math.round(211 + (185 - 211) * t);
        const b = Math.round(140 + (129 - 140) * t);
        const pad = i === 0 ? 1 : 2;
        if (i === 0 && headImg) {
          // image head, rotated to travel direction
          const cx2 = offsetX + s.x * cellSize + fc;
          const cy2 = offsetY + s.y * cellSize + fc;
          const ang = Math.atan2(gs.dir.y, gs.dir.x);
          ctx.save();
          ctx.shadowColor = rgba(ACCENT, 0.6);
          ctx.shadowBlur = 10;
          ctx.translate(cx2, cy2);
          ctx.rotate(ang);
          const sz = cellSize * 1.15;
          ctx.drawImage(headImg, -sz / 2, -sz / 2, sz, sz);
          ctx.restore();
          continue;
        }
        if (i === 0) {
          ctx.save();
          ctx.shadowColor = rgba(ACCENT, 0.6);
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = `rgb(${r},${g2},${b})`;
        roundRectPath(ctx, offsetX + s.x * cellSize + pad, offsetY + s.y * cellSize + pad, cellSize - pad * 2, cellSize - pad * 2, Math.max(3, cellSize * 0.28));
        ctx.fill();
        if (i === 0) {
          ctx.restore();
          // procedural eyes (fallback head)
          ctx.fillStyle = "#fff";
          const ex = gs.dir.x;
          const ey = gs.dir.y;
          const eyeR = cellSize * 0.13;
          const cx2 = offsetX + s.x * cellSize + fc;
          const cy2 = offsetY + s.y * cellSize + fc;
          ctx.beginPath();
          ctx.arc(cx2 + ey * fc * 0.4 + ex * fc * 0.4 - ey * fc * 0.3, cy2 + ex * fc * 0.4 + ey * fc * 0.4 - ex * fc * 0.3, eyeR, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx2 + ey * fc * 0.4 + ex * fc * 0.4 + ey * fc * 0.3, cy2 + ex * fc * 0.4 + ey * fc * 0.4 + ex * fc * 0.3, eyeR, 0, Math.PI * 2);
          ctx.fill();
          // pupils
          ctx.fillStyle = "#062015";
          ctx.beginPath();
          ctx.arc(cx2 + ey * fc * 0.4 + ex * fc * 0.5 - ey * fc * 0.3, cy2 + ex * fc * 0.4 + ey * fc * 0.5 - ex * fc * 0.3, eyeR * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx2 + ey * fc * 0.4 + ex * fc * 0.5 + ey * fc * 0.3, cy2 + ex * fc * 0.4 + ey * fc * 0.5 + ex * fc * 0.3, eyeR * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
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
      for (const f of gs.floatTexts) {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
        glowText(ctx, f.text, f.x, f.y, 18, f.color, { glow: rgba(f.color, 0.7) });
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // HUD pills
      if (gs.phase === "playing" || gs.phase === "gameover") {
        drawPill(ctx, 104, 14, `${gs.score}`, { accent: ACCENT, fontSize: 16, icon: "★" });
        drawPill(ctx, W / 2, 14, `Nivel ${gs.level}`, { accent: ACCENT, fontSize: 15, align: "center" });
        if (gs.golden) {
          const sec = (gs.goldenTimer / 1000).toFixed(1);
          drawPill(ctx, W / 2, 46, `${sec}s`, { accent: "#fbbf24", textColor: "#fbbf24", fontSize: 14, align: "center", icon: "⭐" });
        }
      }

      // onboarding
      uiPlayBtn = null;
      uiRestartBtn = null;
      if (gs.phase === "onboarding") {
        uiPlayBtn = drawOnboard(ctx, W, H, {
          title: "Snake Evo",
          subtitle: "Come, crece y evita chocar contigo mismo.",
          how: ["Desliza (swipe) para girar la serpiente", "También flechas o WASD en escritorio"],
          scoring: "+10 comida · +50 gema dorada · sube de nivel cada 5",
          accent: ACCENT,
        });
      }

      // paused (help reopened)
      if (gs.phase === "playing" && gs.paused) {
        uiPlayBtn = drawOnboard(ctx, W, H, {
          title: "Cómo jugar",
          subtitle: "Come, crece y evita chocar contigo mismo.",
          how: ["Desliza (swipe) para girar la serpiente", "También flechas o WASD en escritorio"],
          scoring: "+10 comida · +50 gema dorada",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      }

      // gameover
      if (gs.phase === "gameover") {
        ctx.fillStyle = "rgba(4,10,8,0.72)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 150, H / 2 - 130, 300, 270, 26);
        glowText(ctx, "Game Over", W / 2, H / 2 - 78, 34, "#ef4444", { glow: "rgba(239,68,68,0.6)" });
        glowText(ctx, `${gs.score}`, W / 2, H / 2 - 8, 54, "#fbbf24", { glow: "rgba(251,191,36,0.7)" });
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = font(16, 600);
        ctx.textAlign = "center";
        ctx.fillText(`Nivel ${gs.level} · ${gs.eaten} comidas`, W / 2, H / 2 + 28);
        ctx.fillStyle = ACCENT;
        ctx.font = font(15, 700);
        ctx.fillText(`Mejor: ${gs.best}`, W / 2, H / 2 + 54);
        uiRestartBtn = drawButton(ctx, W / 2, H / 2 + 100, 200, 50, "Jugar de nuevo", { color: ACCENT, glow: true, fontSize: 18 });
        ctx.textAlign = "left";
      }

      // top-right icon buttons (always visible)
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    // ---- Coordinate mapping (CSS px -> canvas backing px) ----
    const toCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    // ---- Keyboard (desktop extra) ----
    const onKey = (e: KeyboardEvent) => {
      unlockAudio();
      const gs = gsRef.current;
      if (gs.phase === "loading") return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (gs.phase === "onboarding") { sfx.click(); startGame(); return; }
        if (gs.phase === "gameover") { sfx.click(); startGame(); return; }
        if (gs.phase === "playing" && gs.paused) { sfx.click(); gs.paused = false; return; }
      }
      if (gs.phase !== "playing" || gs.paused) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") setDir(-1, 0);
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setDir(1, 0);
      else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") setDir(0, -1);
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") setDir(0, 1);
    };

    // ---- Pointer (touch + mouse): mute/help hit-test on down, swipe/tap on up ----
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current;
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const W = canvas.width;

      // mute button FIRST (all phases)
      if (inRect(iconButtonRect(W, 0), x, y)) {
        toggleMute();
        if (!isMuted()) sfx.click();
        gs.swipeStart = null;
        return;
      }
      // help button (playing / onboarding)
      if ((gs.phase === "playing" || gs.phase === "onboarding") && inRect(iconButtonRect(W, 1), x, y)) {
        sfx.click();
        if (gs.phase === "playing" && !gs.paused) gs.paused = true;
        gs.swipeStart = null;
        return;
      }
      if (gs.phase === "loading") { gs.swipeStart = null; return; }
      gs.swipeStart = { x, y };
    };

    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current;
      const start = gs.swipeStart;
      gs.swipeStart = null;
      if (gs.phase === "loading" || !start) return;

      const { x, y } = toCanvas(e.clientX, e.clientY);
      const dx = x - start.x;
      const dy = y - start.y;
      const isTap = Math.abs(dx) < 20 && Math.abs(dy) < 20;

      if (isTap) {
        if (gs.phase === "onboarding") {
          // tap anywhere (or on the Play button) starts the game
          sfx.click();
          startGame();
          return;
        }
        if (gs.phase === "gameover") {
          if (uiRestartBtn && inRect(uiRestartBtn, x, y)) { sfx.click(); startGame(); }
          return;
        }
        if (gs.phase === "playing" && gs.paused) {
          if (uiPlayBtn && inRect(uiPlayBtn, x, y)) { sfx.click(); gs.paused = false; }
          return;
        }
        return; // tap while actively playing: no-op
      }

      // swipe → direction (only while actively playing)
      if (gs.phase === "playing" && !gs.paused) {
        if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
        else setDir(0, dy > 0 ? 1 : -1);
      }
    };

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      ro.disconnect();
    };
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#080f0d", minHeight: "100dvh", position: "relative" }}>
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
