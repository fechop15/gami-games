"use client";
import Link from "next/link";

import { useEffect, useRef, useCallback } from "react";
import {
  font, rgba, shade, drawBackground,
  drawButton, drawPill, glowText, drawPanel,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#f43f5e";
const BUBBLE_COLORS = ["#ef4444","#3b82f6","#22c55e","#f59e0b","#a855f7"];
const BOMB_COLOR = "#1f2937";
const R = 20; // bubble radius
const COLS = 11;

interface Bubble {
  col: number;
  row: number;
  color: string;
  isBomb?: boolean;
  x: number;
  y: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  isBomb: boolean;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
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

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover";
  paused: boolean;
  loadPct: number;
  grid: (Bubble | null)[][];
  proj: Projectile | null;
  nextColor: string;
  nextIsBomb: boolean;
  queueColor: string;
  queueIsBomb: boolean;
  aimX: number;
  aimY: number;
  score: number;
  best: number;
  level: number;
  combo: number;
  floatTexts: FloatText[];
  particles: Particle[];
  shake: number;
  lastTime: number;
  rows: number;
  numColors: number;
  shooterX: number;
  shooterY: number;
}

function hexX(col: number, row: number, startX: number): number {
  const offset = row % 2 === 1 ? R : 0;
  return startX + col * R * 2 + R + offset;
}

function hexY(row: number, startY: number): number {
  return startY + row * (R * 1.75);
}

function randomColor(numColors: number): string {
  return BUBBLE_COLORS[Math.floor(Math.random() * numColors)];
}

function colorsInGrid(grid: (Bubble | null)[][]): string[] {
  const s = new Set<string>();
  for (const row of grid) for (const b of row) if (b && !b.isBomb) s.add(b.color);
  return s.size > 0 ? [...s] : [];
}

function randomFromGrid(grid: (Bubble | null)[][], numColors: number): string {
  const cols = colorsInGrid(grid);
  if (cols.length === 0) return randomColor(numColors);
  return cols[Math.floor(Math.random() * cols.length)];
}

function buildGrid(rows: number, numColors: number, includeBombs: boolean): (Bubble | null)[][] {
  const grid: (Bubble | null)[][] = [];
  for (let row = 0; row < rows; row++) {
    const cols = row % 2 === 0 ? COLS : COLS - 1;
    const rowArr: (Bubble | null)[] = [];
    for (let col = 0; col < cols; col++) {
      const isBomb = includeBombs && Math.random() < 0.08;
      rowArr.push({ col, row, color: isBomb ? BOMB_COLOR : randomColor(numColors), isBomb, x: 0, y: 0 });
    }
    grid.push(rowArr);
  }
  return grid;
}

function updatePositions(grid: (Bubble | null)[][], startX: number, startY: number) {
  for (let row = 0; row < grid.length; row++) {
    const rowArr = grid[row];
    for (let col = 0; col < rowArr.length; col++) {
      const b = rowArr[col];
      if (b) {
        b.x = hexX(col, row, startX);
        b.y = hexY(row, startY);
      }
    }
  }
}

function getNeighbors(grid: (Bubble | null)[][], row: number, col: number): [number, number][] {
  const even = row % 2 === 0;
  const candidates: [number, number][] = [
    [row - 1, even ? col - 1 : col],
    [row - 1, even ? col : col + 1],
    [row, col - 1],
    [row, col + 1],
    [row + 1, even ? col - 1 : col],
    [row + 1, even ? col : col + 1],
  ];
  return candidates.filter(([r, c]) => r >= 0 && r < grid.length && c >= 0 && c < (grid[r]?.length ?? 0));
}

function floodFill(grid: (Bubble | null)[][], row: number, col: number, color: string): [number, number][] {
  const visited = new Set<string>();
  const result: [number, number][] = [];
  const queue: [number, number][] = [[row, col]];
  while (queue.length) {
    const [r, c] = queue.shift()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const b = grid[r]?.[c];
    if (!b || b.color !== color) continue;
    result.push([r, c]);
    for (const nb of getNeighbors(grid, r, c)) queue.push(nb);
  }
  return result;
}

function findOrphans(grid: (Bubble | null)[][]): [number, number][] {
  const connected = new Set<string>();
  const queue: [number, number][] = [];
  // top row is always connected
  const topRow = grid[0];
  for (let c = 0; c < topRow.length; c++) {
    if (topRow[c]) { queue.push([0, c]); connected.add(`0,${c}`); }
  }
  while (queue.length) {
    const [r, c] = queue.shift()!;
    for (const [nr, nc] of getNeighbors(grid, r, c)) {
      const key = `${nr},${nc}`;
      if (!connected.has(key) && grid[nr]?.[nc]) {
        connected.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  const orphans: [number, number][] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < (grid[row]?.length ?? 0); col++) {
      if (grid[row][col] && !connected.has(`${row},${col}`)) orphans.push([row, col]);
    }
  }
  return orphans;
}

function gridEmpty(grid: (Bubble | null)[][]): boolean {
  return grid.every(row => row.every(b => b === null));
}

export default function BubblePopGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS | null>(null);
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});

  const getStartX = (W: number) => (W - (COLS * R * 2)) / 2;
  const getStartY = () => 100;
  const getShooterY = (H: number) => H - 80;

  const buildGS = useCallback((level: number, score: number, best = 0): GS => {
    const canvas = canvasRef.current!;
    const W = canvas.width;
    const H = canvas.height;
    const rows = 5 + level;
    const numColors = Math.min(4 + (level > 0 ? 1 : 0), 5);
    const includeBombs = level >= 2;
    const grid = buildGrid(rows, numColors, includeBombs);
    updatePositions(grid, getStartX(W), getStartY());
    const nextIsBomb = includeBombs && Math.random() < 0.1;
    const queueIsBomb = includeBombs && Math.random() < 0.1;
    return {
      phase: "playing",
      paused: false,
      loadPct: 1,
      grid,
      proj: null,
      nextColor: nextIsBomb ? BOMB_COLOR : randomColor(numColors),
      nextIsBomb,
      queueColor: queueIsBomb ? BOMB_COLOR : randomColor(numColors),
      queueIsBomb,
      aimX: W / 2,
      aimY: H * 0.4,
      score,
      best,
      level,
      combo: 0,
      floatTexts: [],
      particles: [],
      shake: 0,
      lastTime: 0,
      rows,
      numColors,
      shooterX: W / 2,
      shooterY: getShooterY(H),
    };
  }, []);

  const spawnPop = useCallback((gs: GS, x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random();
      const sp = 2 + Math.random() * 3;
      gs.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, life: 1 });
    }
  }, []);

  const shoot = useCallback(() => {
    const gs = gsRef.current;
    if (!gs || gs.phase !== "playing" || gs.paused || gs.proj) return;
    const dx = gs.aimX - gs.shooterX;
    const dy = gs.aimY - gs.shooterY;
    const len = Math.hypot(dx, dy);
    if (len < 5 || dy >= 0) return; // must shoot upward
    const speed = 950;
    gs.proj = {
      x: gs.shooterX,
      y: gs.shooterY,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      color: gs.nextColor,
      isBomb: gs.nextIsBomb,
    };
    sfx.whoosh();
    const numColors = gs.numColors;
    const includeBombs = gs.level >= 2;
    // avanzar cola: queue → next, generar nueva queue
    gs.nextColor = gs.queueColor;
    gs.nextIsBomb = gs.queueIsBomb;
    gs.queueIsBomb = includeBombs && Math.random() < 0.1;
    gs.queueColor = gs.queueIsBomb ? BOMB_COLOR : randomFromGrid(gs.grid, numColors);
  }, []);

  const snapBubble = useCallback((gs: GS, px: number, py: number) => {
    const canvas = canvasRef.current!;
    const W = canvas.width;
    const startX = getStartX(W);
    const startY = getStartY();
    // find nearest empty slot
    let bestDist = Infinity;
    let bestRow = -1;
    let bestCol = -1;

    // check existing rows + one new row at top
    const maxRow = Math.min(gs.grid.length + 1, gs.rows + 2);
    for (let row = 0; row < maxRow; row++) {
      const cols = row % 2 === 0 ? COLS : COLS - 1;
      for (let col = 0; col < cols; col++) {
        if (gs.grid[row]?.[col]) continue;
        const bx = hexX(col, row, startX);
        const by = hexY(row, startY);
        const d = Math.hypot(px - bx, py - by);
        if (d < bestDist) { bestDist = d; bestRow = row; bestCol = col; }
      }
    }

    if (bestRow === -1) return;

    // ensure grid has enough rows
    while (gs.grid.length <= bestRow) {
      const newRow = gs.grid.length;
      const cols = newRow % 2 === 0 ? COLS : COLS - 1;
      gs.grid.push(new Array(cols).fill(null));
    }

    const proj = gs.proj!;
    const newBubble: Bubble = {
      col: bestCol,
      row: bestRow,
      color: proj.isBomb ? BOMB_COLOR : proj.color,
      isBomb: proj.isBomb,
      x: hexX(bestCol, bestRow, startX),
      y: hexY(bestRow, startY),
    };
    gs.grid[bestRow][bestCol] = newBubble;

    // game over if bubble lands below threshold
    const H = canvas.height;
    if (newBubble.y > getShooterY(H) - R * 3) {
      gs.best = Math.max(gs.best, gs.score);
      gs.phase = "gameover";
      gs.shake = 14;
      sfx.gameover();
      return;
    }

    let scored = 0;
    if (proj.isBomb) {
      // bomb: destroy neighbors in radius 2
      const toRemove: [number, number][] = [];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = bestRow + dr;
          const nc = bestCol + dc;
          if (nr >= 0 && nr < gs.grid.length && nc >= 0 && nc < (gs.grid[nr]?.length ?? 0) && gs.grid[nr][nc]) {
            toRemove.push([nr, nc]);
          }
        }
      }
      for (const [r, c] of toRemove) {
        const bb = gs.grid[r][c]!;
        spawnPop(gs, bb.x, bb.y, bb.color === BOMB_COLOR ? "#f59e0b" : bb.color);
        gs.grid[r][c] = null;
        scored += 10;
      }
      gs.shake = 12;
      sfx.explode();
    } else {
      // match 3+
      const group = floodFill(gs.grid, bestRow, bestCol, proj.color);
      if (group.length >= 3) {
        for (const [r, c] of group) {
          const bb = gs.grid[r][c]!;
          spawnPop(gs, bb.x, bb.y, bb.color);
          gs.grid[r][c] = null;
          scored += 10;
        }
        gs.combo++;
        const multiplier = Math.min(gs.combo, 4);
        scored *= multiplier;
        gs.shake = Math.min(4 + group.length, 12);
        sfx.pop();
        if (gs.combo > 1) sfx.combo(gs.combo);

        // orphans
        const orphans = findOrphans(gs.grid);
        for (const [r, c] of orphans) {
          const bb = gs.grid[r][c]!;
          spawnPop(gs, bb.x, bb.y, bb.color);
          gs.grid[r][c] = null;
          scored += 20;
        }
        if (orphans.length > 0) sfx.coin();

        gs.floatTexts.push({
          x: newBubble.x,
          y: newBubble.y - 20,
          text: gs.combo > 1 ? `+${scored} ×${multiplier}` : `+${scored}`,
          life: 1.2,
          color: multiplier > 1 ? "#fbbf24" : "#fff",
        });
      } else {
        gs.combo = 0;
      }
    }

    gs.score += scored;

    // level up if grid is empty
    if (gridEmpty(gs.grid)) {
      const prevBest = gs.best;
      const newGS = buildGS(gs.level + 1, gs.score, prevBest);
      Object.assign(gs, newGS);
      sfx.levelup();
      gs.floatTexts.push({ x: W / 2, y: H / 2, text: `¡Nivel ${gs.level + 1}!`, life: 1.6, color: ACCENT });
    }
  }, [buildGS, spawnPop]);

  const startGame = useCallback(() => {
    const best = gsRef.current?.best ?? 0;
    gsRef.current = buildGS(0, 0, best);
  }, [buildGS]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      canvas.width = canvas.clientWidth || Math.min(window.innerWidth, 480);
      canvas.height = canvas.clientHeight || window.innerHeight;
      const gs = gsRef.current;
      if (gs) {
        const W = canvas.width;
        const H = canvas.height;
        gs.shooterX = W / 2;
        gs.shooterY = getShooterY(H);
        updatePositions(gs.grid, getStartX(W), getStartY());
      }
    };
    resize();

    gsRef.current = { ...buildGS(0, 0), phase: "loading", loadPct: 0 };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Preload assets, then move to onboarding.
    loadImages(
      {
        bg: "/games/bubble-pop/bg.svg",
        bubble: "/games/bubble-pop/bubble.svg",
        bomb: "/games/bubble-pop/bomb.svg",
        icon: "/games/bubble-pop/icon.svg",
      },
      (pct) => { if (gsRef.current) gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current && gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;

    // Rects captured each frame for hit-testing in pointer handlers.
    let pauseBtn: Rect | null = null;
    let gameoverBtn: Rect | null = null;
    let shootArmed = false;

    const drawBubble = (cx: number, cy: number, color: string, alpha = 1, isBomb = false) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const bombImg = imgRef.current.bomb;
      if (isBomb && bombImg) {
        const d = R * 2.2;
        ctx.drawImage(bombImg, cx - d / 2, cy - d / 2, d, d);
        ctx.restore();
        return;
      }
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.2, cx, cy, R);
      g.addColorStop(0, shade(color, 0.45));
      g.addColorStop(0.6, color);
      g.addColorStop(1, shade(color, -0.25));
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // gloss highlight
      ctx.beginPath();
      ctx.arc(cx - R * 0.3, cy - R * 0.32, R * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fill();
      if (isBomb) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(R, 900);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✦", cx, cy + 1);
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
    };

    const drawGameBackground = (W: number, H: number) => {
      const bg = imgRef.current.bg;
      if (bg) {
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = "rgba(15,10,22,0.42)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, ["#3a1526", "#241023", "#0f0a16"]);
      }
    };

    const HOW = [
      "Arrastra el dedo para apuntar",
      "Suelta para disparar la burbuja",
      "Conecta 3+ del mismo color",
    ];

    const draw = (ts: number) => {
      const gs = gsRef.current!;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;
      const W = canvas.width;
      const H = canvas.height;

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Bubble Pop");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      // update projectile
      if (active && gs.proj) {
        gs.proj.x += gs.proj.vx * dt;
        gs.proj.y += gs.proj.vy * dt;
        // bounce walls
        if (gs.proj.x - R < 0) { gs.proj.x = R; gs.proj.vx *= -1; }
        if (gs.proj.x + R > W) { gs.proj.x = W - R; gs.proj.vx *= -1; }
        // snap if hit ceiling or grid bubble
        if (gs.proj.y - R < getStartY() - R) {
          snapBubble(gs, gs.proj.x, gs.proj.y);
          gs.proj = null;
        } else {
          // check collision with grid
          let snapped = false;
          for (const row of gs.grid) {
            for (const b of row) {
              if (b && Math.hypot(gs.proj!.x - b.x, gs.proj!.y - b.y) < R * 1.9) {
                snapBubble(gs, gs.proj!.x, gs.proj!.y);
                gs.proj = null;
                snapped = true;
                break;
              }
            }
            if (snapped) break;
          }
        }
      }

      // update float texts / particles (paused freezes them too)
      if (active) {
        gs.floatTexts = gs.floatTexts.filter(ft => ft.life > 0);
        for (const ft of gs.floatTexts) { ft.y -= 1; ft.life -= dt; }
        gs.particles = gs.particles.filter(p => p.life > 0);
        for (const p of gs.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= dt * 1.8; }
        if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 45);
      }

      // background
      drawGameBackground(W, H);

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      // grid
      for (const row of gs.grid) {
        for (const b of row) {
          if (b) drawBubble(b.x, b.y, b.color, 1, b.isBomb);
        }
      }

      // projectile
      if (gs.proj) drawBubble(gs.proj.x, gs.proj.y, gs.proj.color, 1, gs.proj.isBomb);

      // particles
      for (const p of gs.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // aim line + shooter (only while actively playing)
      if (gs.phase === "playing") {
        ctx.save();
        ctx.setLineDash([6, 10]);
        ctx.strokeStyle = rgba(ACCENT, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gs.shooterX, gs.shooterY);
        const dx = gs.aimX - gs.shooterX;
        const dy = gs.aimY - gs.shooterY;
        const len = Math.hypot(dx, dy);
        if (len > 0 && dy < 0) {
          ctx.lineTo(gs.shooterX + (dx / len) * 140, gs.shooterY + (dy / len) * 140);
        }
        ctx.stroke();
        ctx.restore();

        // shooter bubble
        drawBubble(gs.shooterX, gs.shooterY, gs.nextColor, 1, gs.nextIsBomb);

        // next bubble indicator
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = font(11, 700);
        ctx.textAlign = "center";
        ctx.fillText("próxima", gs.shooterX + 55, gs.shooterY - 12);
        drawBubble(gs.shooterX + 55, gs.shooterY + 8, gs.queueColor, 0.7, gs.queueIsBomb);
      }

      // float texts
      for (const ft of gs.floatTexts) {
        ctx.globalAlpha = Math.max(ft.life, 0);
        glowText(ctx, ft.text, ft.x, ft.y, 20, ft.color, { glow: rgba(ft.color, 0.7) });
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // HUD pills
      if (gs.phase === "playing" || gs.phase === "gameover") {
        drawPill(ctx, 104, 14, `${gs.score}`, { accent: ACCENT, fontSize: 16, icon: "★" });
        drawPill(ctx, W / 2, 14, `Nivel ${gs.level + 1}`, { accent: ACCENT, fontSize: 15, align: "center" });
        if (gs.combo > 1 && gs.phase === "playing") {
          drawPill(ctx, W / 2, 44, `Combo ×${Math.min(gs.combo, 4)}`, { accent: "#fbbf24", textColor: "#fbbf24", fontSize: 15, align: "center" });
        }
      }

      // onboarding
      pauseBtn = null;
      gameoverBtn = null;
      if (gs.phase === "onboarding") {
        drawOnboard(ctx, W, H, {
          title: "Bubble Pop",
          subtitle: "Conecta 3+ burbujas del mismo color para reventarlas.",
          how: HOW,
          scoring: "+10 por burbuja × combo · +20 por burbuja suelta",
          accent: ACCENT,
        });
      }

      // paused (help reopened)
      if (gs.phase === "playing" && gs.paused) {
        pauseBtn = drawOnboard(ctx, W, H, {
          title: "Cómo jugar",
          subtitle: "Conecta 3+ burbujas del mismo color para reventarlas.",
          how: HOW,
          scoring: "+10 por burbuja × combo · +20 por burbuja suelta",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      }

      // gameover
      if (gs.phase === "gameover") {
        ctx.fillStyle = "rgba(10,6,14,0.72)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 150, H / 2 - 120, 300, 260, 26);
        glowText(ctx, "Game Over", W / 2, H / 2 - 66, 34, ACCENT, { glow: rgba(ACCENT, 0.6) });
        glowText(ctx, `${gs.score}`, W / 2, H / 2, 54, "#fbbf24", { glow: "rgba(251,191,36,0.7)" });
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = font(16, 600);
        ctx.textAlign = "center";
        ctx.fillText(`Nivel ${gs.level + 1} · Mejor: ${gs.best}`, W / 2, H / 2 + 34);
        gameoverBtn = drawButton(ctx, W / 2, H / 2 + 85, 190, 52, "Jugar de nuevo", { color: ACCENT, glow: true, fontSize: 18 });
        ctx.textAlign = "left";
      }

      // top-right icon buttons (always visible)
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      ctx.textAlign = "left";
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const coords = (e: PointerEvent) => {
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
      const { x, y } = coords(e);
      const W = canvas.width;
      shootArmed = false;

      // mute button (all phases)
      if (inRect(iconButtonRect(W, 0), x, y)) { toggleMute(); if (!isMuted()) sfx.click(); return; }
      // help button (playing / onboarding)
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
          if (pauseBtn && inRect(pauseBtn, x, y)) { sfx.click(); gs.paused = false; }
        } else {
          gs.aimX = x;
          gs.aimY = y;
          shootArmed = true;
        }
      } else if (gs.phase === "gameover") {
        if (gameoverBtn && inRect(gameoverBtn, x, y)) { sfx.click(); startGame(); }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const gs = gsRef.current!;
      if (gs.phase !== "playing" || gs.paused) return;
      const { x, y } = coords(e);
      gs.aimX = x;
      gs.aimY = y;
    };

    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      const gs = gsRef.current!;
      if (shootArmed && gs.phase === "playing" && !gs.paused) {
        const { x, y } = coords(e);
        gs.aimX = x;
        gs.aimY = y;
        shoot();
      }
      shootArmed = false;
    };

    // Optional desktop keyboard extras.
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current!;
      if (gs.phase === "onboarding") { sfx.click(); startGame(); }
      else if (gs.phase === "playing") { if (gs.paused) gs.paused = false; else shoot(); }
      else if (gs.phase === "gameover") { sfx.click(); startGame(); }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, [buildGS, shoot, snapBubble, startGame]);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#0f0a16", minHeight: "100dvh", position: "relative" }}>
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
