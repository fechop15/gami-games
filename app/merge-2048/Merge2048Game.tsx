"use client";
/* eslint-disable @next/next/no-img-element -- decorative inline SVGs (bg/icon/trophy/sparkle); next/image adds no value for tiny static assets */
import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#f59e0b";
const ASSET = "/games/merge-2048";
const ASSET_SRCS = [`${ASSET}/bg.svg`, `${ASSET}/sparkle.svg`, `${ASSET}/trophy.svg`, `${ASSET}/icon.svg`];

// Friendly warm gradient tiles with a soft glow on the big ones.
const TILE_COLORS: Record<number, { bg: string; fg: string; glow?: string }> = {
  0:    { bg: "rgba(255,255,255,0.05)", fg: "#334155" },
  2:    { bg: "linear-gradient(145deg,#fdf4e3,#efe0c6)", fg: "#7a6a55" },
  4:    { bg: "linear-gradient(145deg,#fce9c9,#f3d7a4)", fg: "#7a6a55" },
  8:    { bg: "linear-gradient(145deg,#ffc078,#f2a04d)", fg: "#fff" },
  16:   { bg: "linear-gradient(145deg,#ffab5e,#f4863a)", fg: "#fff" },
  32:   { bg: "linear-gradient(145deg,#ff8f5e,#f26a3b)", fg: "#fff" },
  64:   { bg: "linear-gradient(145deg,#ff6f5e,#ef4444)", fg: "#fff", glow: "rgba(239,68,68,0.5)" },
  128:  { bg: "linear-gradient(145deg,#ffe07a,#f4c542)", fg: "#fff", glow: "rgba(245,197,66,0.5)" },
  256:  { bg: "linear-gradient(145deg,#ffdd66,#f2bd35)", fg: "#fff", glow: "rgba(242,189,53,0.55)" },
  512:  { bg: "linear-gradient(145deg,#ffd84d,#eeb223)", fg: "#fff", glow: "rgba(238,178,35,0.6)" },
  1024: { bg: "linear-gradient(145deg,#ffd633,#e8a814)", fg: "#fff", glow: "rgba(232,168,20,0.7)" },
  2048: { bg: "linear-gradient(145deg,#ffcf1a,#e29b0a)", fg: "#fff", glow: "rgba(226,155,10,0.85)" },
};

type Grid = number[][];

function emptyGrid(size: number): Grid {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function addRandom(grid: Grid): Grid {
  const empty: [number, number][] = [];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = grid.map(row => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

type Direction = "left" | "right" | "up" | "down";

function slideRow(row: number[]): { row: number[]; score: number } {
  const filtered = row.filter(v => v !== 0);
  let score = 0;
  const merged: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i++;
    }
  }
  while (merged.length < row.length) merged.push(0);
  return { row: merged, score };
}

function move(grid: Grid, dir: Direction): { grid: Grid; score: number; moved: boolean } {
  const size = grid.length;
  let score = 0;
  const newGrid = emptyGrid(size);
  let moved = false;

  if (dir === "left") {
    for (let r = 0; r < size; r++) {
      const { row, score: s } = slideRow(grid[r]);
      newGrid[r] = row;
      score += s;
      if (row.some((v, i) => v !== grid[r][i])) moved = true;
    }
  } else if (dir === "right") {
    for (let r = 0; r < size; r++) {
      const rev = [...grid[r]].reverse();
      const { row, score: s } = slideRow(rev);
      newGrid[r] = row.reverse();
      score += s;
      if (newGrid[r].some((v, i) => v !== grid[r][i])) moved = true;
    }
  } else if (dir === "up") {
    for (let c = 0; c < size; c++) {
      const col = grid.map(row => row[c]);
      const { row, score: s } = slideRow(col);
      for (let r = 0; r < size; r++) {
        newGrid[r][c] = row[r];
        if (row[r] !== grid[r][c]) moved = true;
      }
      score += s;
    }
  } else {
    for (let c = 0; c < size; c++) {
      const col = grid.map(row => row[c]).reverse();
      const { row, score: s } = slideRow(col);
      const rev = row.reverse();
      for (let r = 0; r < size; r++) {
        newGrid[r][c] = rev[r];
        if (rev[r] !== grid[r][c]) moved = true;
      }
      score += s;
    }
  }
  return { grid: newGrid, score, moved };
}

function canMove(grid: Grid): boolean {
  const size = grid.length;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < size && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < size && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

function maxTile(grid: Grid): number {
  return Math.max(...grid.flatMap(r => r));
}

interface MergeState {
  grid: Grid;
  score: number;
  prev: Grid | null;
  prevScore: number;
  size: number;
  phase: "loading" | "playing" | "win" | "gameover" | "intro";
  unlocked256: boolean;
  unlocked512: boolean;
  unlocked1024: boolean;
  unlocked2048: boolean;
  hintDir: Direction | null;
  hintTimer: number;
  won: boolean;
}

function initState(size = 4): MergeState {
  let grid = emptyGrid(size);
  grid = addRandom(grid);
  grid = addRandom(grid);
  return {
    grid,
    score: 0,
    prev: null,
    prevScore: 0,
    size,
    phase: "playing",
    unlocked256: false,
    unlocked512: false,
    unlocked1024: false,
    unlocked2048: false,
    hintDir: null,
    hintTimer: 0,
    won: false,
  };
}

function getBestMove(grid: Grid): Direction {
  const dirs: Direction[] = ["left", "right", "up", "down"];
  let bestScore = -1;
  let bestDir: Direction = "left";
  for (const d of dirs) {
    const { score, moved } = move(grid, d);
    if (moved && score > bestScore) { bestScore = score; bestDir = d; }
  }
  return bestDir;
}

export default function Merge2048Game() {
  const [ms, setMs] = useState<MergeState>(() => ({ ...initState(), phase: "loading" }));
  const [loadPct, setLoadPct] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [, forceRender] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msRef = useRef(ms);
  useEffect(() => { msRef.current = ms; });

  // Preload assets, then move to intro. onload AND onerror both count so a 404 never blocks.
  useEffect(() => {
    let done = 0;
    const total = ASSET_SRCS.length;
    const bump = () => {
      done++;
      setLoadPct(done / total);
      if (done >= total) setMs(p => (p.phase === "loading" ? { ...p, phase: "intro" } : p));
    };
    ASSET_SRCS.forEach(src => {
      const img = new Image();
      img.onload = bump;
      img.onerror = bump;
      img.src = src;
    });
  }, []);

  const applyMove = (state: MergeState, dir: Direction): MergeState => {
    const { grid, score: delta, moved } = move(state.grid, dir);
    if (!moved) return state;
    const newGrid = addRandom(grid);
    const newScore = state.score + delta;
    const mx = maxTile(newGrid);
    const newState: MergeState = {
      ...state,
      grid: newGrid,
      score: newScore,
      prev: state.grid,
      prevScore: state.score,
      hintDir: null,
      hintTimer: 0,
      unlocked256: state.unlocked256 || mx >= 256,
      unlocked512: state.unlocked512 || mx >= 512,
      unlocked1024: state.unlocked1024 || mx >= 1024,
      unlocked2048: state.unlocked2048 || mx >= 2048,
      won: !state.won && mx >= 2048 ? true : state.won,
    };
    if (!canMove(newGrid)) newState.phase = "gameover";
    else if (!state.won && mx >= 2048) newState.phase = "win";
    // expand board at 1024
    if (!state.unlocked1024 && mx >= 1024 && state.size === 4) {
      const big = emptyGrid(5);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) big[r][c] = newGrid[r][c];
      newState.grid = addRandom(big);
      newState.size = 5;
    }
    return newState;
  };

  // Stable handler: reads current state from msRef, decides one sound per move, then commits.
  const handleDir = useCallback((dir: Direction) => {
    unlockAudio();
    const prev = msRef.current;
    if (prev.phase !== "playing") return;
    const { moved, score: delta } = move(prev.grid, dir);
    if (!moved) { sfx.error(); return; }
    const next = applyMove(prev, dir);
    // One sound per move, by priority.
    if (next.phase === "win") sfx.win();
    else if (next.phase === "gameover") sfx.gameover();
    else if (
      (!prev.unlocked256 && next.unlocked256) ||
      (!prev.unlocked512 && next.unlocked512) ||
      (!prev.unlocked1024 && next.unlocked1024)
    ) sfx.levelup();
    else if (delta > 0) sfx.merge();
    else sfx.pop();
    setMs(next);
  }, []);

  const undo = () => {
    sfx.click();
    setMs(prev => {
      if (!prev.unlocked256 || !prev.prev) return prev;
      return { ...prev, grid: prev.prev, score: prev.prevScore, prev: null };
    });
  };

  const showHint = () => {
    sfx.click();
    setMs(prev => {
      if (!prev.unlocked512) return prev;
      const dir = getBestMove(prev.grid);
      return { ...prev, hintDir: dir, hintTimer: 2 };
    });
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setMs(p => ({ ...p, hintDir: null, hintTimer: 0 })), 2000);
  };

  // Clear pending hint timer on unmount.
  useEffect(() => () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowLeft: "left", a: "left", A: "left",
        ArrowRight: "right", d: "right", D: "right",
        ArrowUp: "up", w: "up", W: "up",
        ArrowDown: "down", s: "down", S: "down",
      };
      if (map[e.key]) { e.preventDefault(); handleDir(map[e.key]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDir]);

  const [vw, setVw] = useState(380);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onMute = () => { toggleMute(); forceRender(n => n + 1); };

  const startGame = () => { unlockAudio(); sfx.click(); setShowHelp(false); setMs(initState()); };

  const onTouchStart = (e: React.TouchEvent) => {
    unlockAudio();
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) > Math.abs(dy)) handleDir(dx > 0 ? "right" : "left");
    else handleDir(dy > 0 ? "down" : "up");
  };

  const size = ms.size;
  const gap = 8;
  const boardPx = Math.min(vw - 32, 380);
  const cellPx = (boardPx - gap * (size + 1)) / size;

  const tileColor = (v: number) => TILE_COLORS[v] ?? { bg: "linear-gradient(145deg,#4a3f5e,#2f2740)", fg: "#fff", glow: "rgba(148,110,247,0.6)" };

  const PAGE_BG = "linear-gradient(160deg,#241a2e 0%,#171022 55%,#0d0916 100%)";
  const backLink = (
    <Link href="/" style={{ position: "absolute", top: 14, left: 14, zIndex: 20, color: "#fff", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "8px 14px", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "system-ui, sans-serif" }}>← Volver</Link>
  );
  const glowBtn = (bg: string, glow: string): React.CSSProperties => ({
    background: bg, color: "#fff", border: "none", borderRadius: 14, padding: "14px 36px",
    fontSize: 19, fontWeight: 800, cursor: "pointer", fontFamily: "system-ui, sans-serif",
    boxShadow: `0 8px 22px ${glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
  });
  const pill: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: "8px 16px",
    minWidth: 92, textAlign: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  };

  const styleTag = (
    <style>{`
      @keyframes tilePop { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.14)} 100%{transform:scale(1);opacity:1} }
      @keyframes titleFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      @keyframes barShine { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
    `}</style>
  );

  // Subtle full-screen background layer (degrades gracefully if the SVG 404s).
  const bgLayer = (
    <img src={`${ASSET}/bg.svg`} alt="" aria-hidden style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.14, pointerEvents: "none", zIndex: 0 }} />
  );

  // Mute/unmute button, present on every screen.
  const soundBtn = (
    <button onClick={onMute} aria-label={isMuted() ? "Activar sonido" : "Silenciar"} style={{ position: "fixed", top: 14, right: 14, zIndex: 30, width: 44, height: 44, borderRadius: 999, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {isMuted() ? "🔇" : "🔊"}
    </button>
  );

  const helpBtn = (
    <button onClick={() => { sfx.click(); setShowHelp(true); }} aria-label="Ayuda" style={{ position: "fixed", top: 14, right: 66, zIndex: 30, width: 44, height: 44, borderRadius: 999, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 20, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
      ?
    </button>
  );

  const helpModal = showHelp && (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(8,6,16,0.82)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)", padding: 20 }}>
      <div style={{ background: "rgba(28,22,44,0.95)", borderRadius: 24, padding: "28px 26px", maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: ACCENT, display: "flex", alignItems: "center", gap: 10 }}>
          <img src={`${ASSET}/icon.svg`} alt="" width={30} height={30} style={{ borderRadius: 8 }} /> Cómo jugar
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(255,255,255,0.85)" }}><b style={{ color: "#fff" }}>Objetivo:</b> fusiona tiles iguales hasta formar el <b>2048</b>.</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(255,255,255,0.85)" }}><b style={{ color: "#fff" }}>Controles:</b> desliza en cualquier dirección o usa las flechas en pantalla para mover todos los tiles.</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(255,255,255,0.85)" }}><b style={{ color: "#fff" }}>Puntaje:</b> cada fusión suma el valor del tile resultante (dos 64 = +128).</div>
        <button onClick={() => { sfx.click(); setShowHelp(false); }} style={glowBtn("linear-gradient(145deg,#fbbf24,#e2900a)", "rgba(245,158,11,0.5)")}>Entendido</button>
      </div>
    </div>
  );

  if (ms.phase === "loading") {
    return (
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: PAGE_BG, color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        {styleTag}
        {bgLayer}
        {soundBtn}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: ACCENT, marginBottom: 6, textShadow: `0 0 30px ${ACCENT}88` }}>Merge 2048</div>
          <div style={{ color: "rgba(255,255,255,0.55)", marginBottom: 26, fontSize: 15 }}>Cargando…</div>
          <div style={{ width: 220, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.35)" }}>
            <div style={{ width: `${Math.round(loadPct * 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg,#fbbf24,${ACCENT})`, transition: "width 0.2s ease" }} />
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", marginTop: 10, fontSize: 12 }}>{Math.round(loadPct * 100)}%</div>
        </div>
      </div>
    );
  }

  if (ms.phase === "intro") {
    return (
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: PAGE_BG, color: "#fff", fontFamily: "system-ui, sans-serif", padding: "0 20px" }}>
        {styleTag}
        {bgLayer}
        {backLink}
        {soundBtn}
        {helpBtn}
        {helpModal}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: ACCENT, marginBottom: 14, textShadow: `0 0 30px ${ACCENT}88`, animation: "titleFloat 3s ease-in-out infinite" }}>2048</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Merge 2048</div>
          <div style={{ color: "rgba(255,255,255,0.7)", marginBottom: 4, fontSize: 16, textAlign: "center" }}>Fusiona tiles iguales y llega al <b style={{ color: ACCENT }}>2048</b></div>
          <div style={{ color: "rgba(255,255,255,0.55)", marginBottom: 4, fontSize: 14, textAlign: "center" }}>Desliza en cualquier dirección o toca las flechas</div>
          <div style={{ color: "rgba(255,255,255,0.45)", marginBottom: 32, fontSize: 13, textAlign: "center" }}>Cada fusión suma puntos: dos 64 = +128</div>
          <button onClick={startGame} style={glowBtn("linear-gradient(145deg,#fbbf24,#e2900a)", "rgba(245,158,11,0.55)")}>JUGAR</button>
          <button onClick={() => { sfx.click(); setShowHelp(true); }} style={{ marginTop: 16, background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Cómo jugar</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100dvh", background: PAGE_BG, color: "#fff", padding: "20px 16px", touchAction: "none", fontFamily: "system-ui, sans-serif" }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {styleTag}
      {bgLayer}
      {backLink}
      {soundBtn}
      {helpBtn}
      {helpModal}
      {/* HUD */}
      <div style={{ display: "flex", justifyContent: "space-between", width: boardPx, marginBottom: 16, marginTop: 8, position: "relative", zIndex: 1 }}>
        <div style={pill}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 0.5 }}>PUNTOS</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#fbbf24" }}>{ms.score}</div>
        </div>
        <div style={{ ...pill }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 0.5 }}>MEJOR TILE</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: ACCENT }}>{maxTile(ms.grid)}</div>
        </div>
      </div>

      {/* Unlocks */}
      {(ms.unlocked256 || ms.unlocked512) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, position: "relative", zIndex: 1 }}>
          {ms.unlocked256 && (
            <button onClick={undo} style={{ background: ms.prev ? "linear-gradient(145deg,#818cf8,#6366f1)" : "rgba(255,255,255,0.08)", color: ms.prev ? "#fff" : "rgba(255,255,255,0.4)", border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: ms.prev ? "pointer" : "default", boxShadow: ms.prev ? "0 4px 12px rgba(99,102,241,0.4)" : "none" }}>
              ↩ Deshacer
            </button>
          )}
          {ms.unlocked512 && (
            <button onClick={showHint} style={{ background: "linear-gradient(145deg,#38bdf8,#0ea5e9)", color: "#fff", border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(14,165,233,0.4)" }}>
              💡 Pista {ms.hintDir ? `→ ${ms.hintDir}` : ""}
            </button>
          )}
        </div>
      )}

      {/* Board */}
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 18, padding: gap, display: "grid", gridTemplateColumns: `repeat(${size}, ${cellPx}px)`, gap, position: "relative", zIndex: 1, boxShadow: "inset 0 2px 8px rgba(0,0,0,0.35)" }}>
        {ms.grid.flatMap((row, r) =>
          row.map((val, c) => {
            const { bg, fg, glow } = tileColor(val);
            return (
              <div
                key={val !== 0 ? `${r}-${c}-${val}` : `${r}-${c}-e`}
                style={{
                  width: cellPx,
                  height: cellPx,
                  background: bg,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: val >= 1024 ? cellPx * 0.28 : val >= 128 ? cellPx * 0.33 : cellPx * 0.42,
                  fontWeight: 900,
                  color: fg,
                  boxShadow: val !== 0
                    ? `0 4px 10px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35)${glow ? `, 0 0 18px ${glow}` : ""}`
                    : "inset 0 1px 3px rgba(0,0,0,0.25)",
                  animation: val !== 0 ? "tilePop 0.18s ease-out" : undefined,
                }}
              >
                {val !== 0 ? val : ""}
              </div>
            );
          })
        )}
      </div>

      {/* Direction buttons for touch */}
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "60px 60px 60px", gridTemplateRows: "60px 60px", gap: 8, position: "relative", zIndex: 1 }}>
        <div />
        <button onClick={() => handleDir("up")} style={btnStyle}>▲</button>
        <div />
        <button onClick={() => handleDir("left")} style={btnStyle}>◀</button>
        <button onClick={() => handleDir("down")} style={btnStyle}>▼</button>
        <button onClick={() => handleDir("right")} style={btnStyle}>▶</button>
      </div>

      {/* Overlays */}
      {(ms.phase === "win" || ms.phase === "gameover") && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(8,6,16,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, backdropFilter: "blur(3px)" }}>
          <div style={{ background: "rgba(28,22,44,0.9)", borderRadius: 26, padding: "34px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {ms.phase === "win" && (
              <img src={`${ASSET}/trophy.svg`} alt="" width={72} height={72} style={{ filter: "drop-shadow(0 0 18px rgba(251,191,36,0.7))" }} />
            )}
            <div style={{ fontSize: 38, fontWeight: 900, color: ms.phase === "win" ? "#fbbf24" : "#ef4444", textShadow: ms.phase === "win" ? "0 0 24px rgba(251,191,36,0.6)" : "0 0 24px rgba(239,68,68,0.5)", display: "flex", alignItems: "center", gap: 8 }}>
              {ms.phase === "win" && <img src={`${ASSET}/sparkle.svg`} alt="" width={26} height={26} />}
              {ms.phase === "win" ? "¡2048!" : "Game Over"}
              {ms.phase === "win" && <img src={`${ASSET}/sparkle.svg`} alt="" width={26} height={26} />}
            </div>
            <div style={{ fontSize: 54, fontWeight: 900, color: "#fff" }}>{ms.score}</div>
            {ms.phase === "win" && (
              <button onClick={() => { sfx.click(); setMs(p => ({ ...p, phase: "playing" })); }} style={glowBtn("linear-gradient(145deg,#4ade80,#22c55e)", "rgba(34,197,94,0.5)")}>
                Seguir jugando
              </button>
            )}
            <button onClick={() => { sfx.click(); setMs(initState()); }} style={glowBtn("linear-gradient(145deg,#fbbf24,#e2900a)", "rgba(245,158,11,0.5)")}>
              Jugar de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))",
  color: "#fff",
  border: "none",
  borderRadius: 14,
  fontSize: 22,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
};
