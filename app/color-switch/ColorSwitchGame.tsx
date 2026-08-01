"use client";
import Link from "next/link";

import { useEffect, useRef } from "react";
import {
  font, rgba, drawBackground, drawButton, drawPill,
  glowText, drawPanel, drawStar,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#eab308";
const COLORS = ["#ef4444", "#3b82f6", "#eab308", "#22c55e"];
const BALL_R = 14;
const OBS_R  = 52;   // anillo más pequeño → más espacio para maniobrar
const GRAVITY = 680;
const IMPULSE = -400; // salto más corto y controlado
const STAR_R  = 11;

function colorCount(score: number): number {
  return score < 5 ? 2 : score < 10 ? 3 : 4;
}

interface Obstacle {
  y: number;
  r: number;
  rotation: number;
  rotSpeed: number;
  numSectors: number;
  colorOffset: number;
  passed: boolean;
}

interface StarItem {
  x: number;
  y: number;
  collected: boolean;
}

interface Particle { x: number; y: number; vx: number; vy: number; color: string; life: number; }

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover";
  paused: boolean;
  loadPct: number;
  ballY: number;
  ballVY: number;
  ballColor: number;
  obstacles: Obstacle[];
  stars: StarItem[];
  particles: Particle[];
  score: number;
  bestScore: number;
  spawnY: number;
  shake: number;
  lastTime: number;
}

function randomColor(current: number, numColors: number): number {
  let c: number;
  do { c = Math.floor(Math.random() * numColors); } while (c === current);
  return c;
}

// Devuelve el color que la bola NECESITA para pasar por este obstáculo
// según la rotación actual y la posición vertical de la bola.
function safeColorForObstacle(obs: Obstacle, ballY: number): number {
  const dy = ballY - obs.y;
  const dx = 0; // la bola siempre pasa por el centro horizontal
  const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
  const arc = (Math.PI * 2) / obs.numSectors;
  const sector = Math.floor(angle / arc) % obs.numSectors;
  return (sector + obs.colorOffset) % obs.numSectors;
}

function makeObstacle(y: number, score: number): Obstacle {
  const numColors = colorCount(score);
  return {
    y,
    r: OBS_R,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (0.8 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) * (1 + score * 0.04),
    numSectors: numColors,
    colorOffset: Math.floor(Math.random() * numColors),
    passed: false,
  };
}

function initGS(W: number, H: number, best = 0): GS {
  const obstacles: Obstacle[] = [];
  // El primer aro nace bien arriba para dar pista de arranque (antes en 0.70H,
  // pegado a la bola en 0.75H → colisión instantánea).
  for (let i = 0; i < 5; i++) {
    obstacles.push(makeObstacle(H * 0.42 - i * 280, 0));
  }
  return {
    phase: "loading",
    paused: false,
    loadPct: 0,
    ballY: H * 0.75,
    ballVY: 0,
    ballColor: 0,
    obstacles,
    stars: [{ x: W / 2, y: H * 0.55, collected: false }],
    particles: [],
    score: 0,
    bestScore: best,
    spawnY: H * 0.42 - 5 * 280,
    shake: 0,
    lastTime: 0,
  };
}

function drawSectors(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rotation: number, colorOffset: number) {
  const arc = (Math.PI * 2) / n;
  const inner = r * 0.62;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  for (let i = 0; i < n; i++) {
    const a0 = rotation + i * arc;
    const a1 = a0 + arc;
    // Índice dentro de los n colores activos (nunca fuera del rango de la bola).
    ctx.fillStyle = COLORS[(i + colorOffset) % n];
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.arc(cx, cy, inner, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // inner rim highlight
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function ballInSector(ballY: number, cy: number, obs: Obstacle, ballColor: number): boolean {
  const dx = 0;
  const dy = ballY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Safe zones: inside the central hole or beyond the ring band.
  if (dist < obs.r * 0.62 || dist > obs.r) return true;
  const angle = (Math.atan2(dy, dx) - obs.rotation + Math.PI * 4) % (Math.PI * 2);
  const arc = (Math.PI * 2) / obs.numSectors;
  const sector = Math.floor(angle / arc) % obs.numSectors;
  const sectorColor = (sector + obs.colorOffset) % obs.numSectors;
  return sectorColor === ballColor;
}

export default function ColorSwitchGame() {
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

    // Preload SVG assets, then move to onboarding.
    loadImages(
      {
        bg: "/games/color-switch/bg.svg",
        ball: "/games/color-switch/ball.svg",
        ring: "/games/color-switch/ring.svg",
        star: "/games/color-switch/star.svg",
      },
      (pct) => { if (gsRef.current) gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current && gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const ctx = canvas.getContext("2d")!;

    const burst = (gs: GS, x: number, y: number, color: string, n = 12) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        gs.particles.push({ x, y, vx: Math.cos(a) * (2 + Math.random() * 3), vy: Math.sin(a) * (2 + Math.random() * 3), color, life: 1 });
      }
    };

    // Reset play state to a fresh run and start playing with an initial hop.
    const startGame = () => {
      const gs = gsRef.current!;
      const fresh = initGS(canvas.width, canvas.height, gs.bestScore);
      fresh.phase = "playing";
      fresh.ballVY = IMPULSE;
      fresh.lastTime = gs.lastTime;
      gsRef.current = fresh;
      sfx.jump();
    };

    // A tap during play: hop the ball upward.
    const hop = () => {
      const gs = gsRef.current!;
      gs.ballVY = IMPULSE;
      sfx.jump();
    };

    // Onboarding & pause overlay button rects, updated each frame for exact hit-boxes.
    let pauseBtn: Rect | null = null;
    let restartBtn: Rect | null = null;

    const draw = (ts: number) => {
      const gs = gsRef.current!;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;
      const W = canvas.width;
      const H = canvas.height;
      const ballX = W / 2;

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, W, H, gs.loadPct, ACCENT, "Color Switch");
        drawMuteButton(ctx, W, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      if (active) {
        gs.ballVY += GRAVITY * dt;
        gs.ballY += gs.ballVY * dt;

        const targetCam = H * 0.55;
        if (gs.ballY < targetCam) {
          const shift = targetCam - gs.ballY;
          gs.ballY += shift;
          for (const o of gs.obstacles) o.y += shift;
          for (const s of gs.stars) s.y += shift;
          gs.spawnY += shift;
        }

        for (const o of gs.obstacles) o.rotation += o.rotSpeed * dt;

        while (gs.spawnY > -280) {
          gs.spawnY -= 280;
          gs.obstacles.push(makeObstacle(gs.spawnY, gs.score));
          if (Math.random() < 0.7) {
            gs.stars.push({ x: W * 0.3 + Math.random() * W * 0.4, y: gs.spawnY + 100, collected: false });
          }
        }

        for (let i = gs.obstacles.length - 1; i >= 0; i--) {
          if (gs.obstacles[i].y > H + OBS_R * 2) gs.obstacles.splice(i, 1);
        }
        for (let i = gs.stars.length - 1; i >= 0; i--) {
          if (gs.stars[i].y > H + 20) gs.stars.splice(i, 1);
        }

        // stars: collect + color switch
        for (const s of gs.stars) {
          if (!s.collected && Math.hypot(ballX - s.x, gs.ballY - s.y) < BALL_R + STAR_R) {
            s.collected = true;
            gs.score += 5;
            burst(gs, s.x, s.y, "#fbbf24", 10);

            // Siempre asigna el color seguro del obstáculo más próximo que viene.
            // Así la estrella nunca causa muerte injusta — el desafío es
            // tocar en el momento correcto, no adivinar el color.
            const numColors = colorCount(gs.score);
            const nextObs = gs.obstacles
              .filter(o => !o.passed)
              .map(o => ({ o, dy: gs.ballY - o.y }))
              .filter(({ dy, o: ob }) => dy > -ob.r)
              .sort((a, b) => a.dy - b.dy)[0];

            gs.ballColor = nextObs
              ? safeColorForObstacle(nextObs.o, gs.ballY)
              : randomColor(gs.ballColor, numColors);

            sfx.powerup();
          }
        }

        // obstacles: collision + scoring (once per obstacle)
        for (const o of gs.obstacles) {
          if (o.passed) continue;
          const dy = gs.ballY - o.y;
          if (dy > 0) {
            // Solo el lado de aproximación (bola debajo del centro) es peligroso.
            // Así un paso recto por el centro no exige acertar dos sectores
            // opuestos a la vez (que era imposible).
            const inBand = dy < o.r && dy > o.r * 0.62;
            if (inBand && !ballInSector(gs.ballY, o.y, o, gs.ballColor)) {
              gs.bestScore = Math.max(gs.bestScore, gs.score);
              gs.shake = 16;
              burst(gs, ballX, gs.ballY, COLORS[gs.ballColor], 18);
              gs.phase = "gameover";
              sfx.gameover();
              break;
            }
          } else {
            // La bola alcanzó el centro del aro → superado.
            o.passed = true;
            gs.score += 1;
            sfx.coin();
          }
        }

        if (gs.ballY > H + 40) {
          gs.bestScore = Math.max(gs.bestScore, gs.score);
          gs.shake = 12;
          gs.phase = "gameover";
          sfx.gameover();
        }
      }

      // particles update
      gs.particles = gs.particles.filter(p => p.life > 0);
      for (const p of gs.particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt * 1.6;
      }
      if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 45);

      // background (image if available, else procedural)
      const bg = imgRef.current.bg;
      if (bg) {
        ctx.drawImage(bg, 0, 0, W, H);
        ctx.fillStyle = "rgba(10,8,23,0.5)";
        ctx.fillRect(0, 0, W, H);
      } else {
        drawBackground(ctx, W, H, ["#241a33", "#141126", "#0a0817"]);
      }

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      for (const o of gs.obstacles) {
        drawSectors(ctx, ballX, o.y, o.r, o.numSectors, o.rotation, o.colorOffset);
      }

      const starImg = imgRef.current.star;
      for (const s of gs.stars) {
        if (s.collected) continue;
        if (starImg) {
          const sz = STAR_R * 2.8;
          ctx.save();
          ctx.shadowColor = "rgba(251,191,36,0.8)";
          ctx.shadowBlur = STAR_R;
          ctx.drawImage(starImg, s.x - sz / 2, s.y - sz / 2, sz, sz);
          ctx.restore();
        } else {
          drawStar(ctx, s.x, s.y, STAR_R, "#fbbf24");
        }
      }

      // ball with glow + gloss
      if (gs.phase !== "onboarding") {
        ctx.save();
        ctx.shadowColor = rgba(COLORS[gs.ballColor], 0.9);
        ctx.shadowBlur = 16;
        ctx.fillStyle = COLORS[gs.ballColor];
        ctx.beginPath();
        ctx.arc(ballX, gs.ballY, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(ballX - BALL_R * 0.3, gs.ballY - BALL_R * 0.35, BALL_R * 0.3, 0, Math.PI * 2);
        ctx.fill();
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
      ctx.restore();

      // HUD
      if (gs.phase === "playing" || gs.phase === "gameover") {
        glowText(ctx, `${gs.score}`, W / 2, 60, 38, "#ffffff", { glow: rgba(ACCENT, 0.6) });
        drawPill(ctx, W / 2, 76, `Mejor ${gs.bestScore}`, { accent: ACCENT, fontSize: 13, align: "center" });
      }

      // onboarding
      if (gs.phase === "onboarding") {
        drawOnboard(ctx, W, H, {
          title: "Color Switch",
          subtitle: "Pasa la bola solo por el color que coincide con ella.",
          how: ["Toca para saltar; pasa solo por el color que coincide", "Las estrellas cambian el color de tu bola"],
          scoring: "+1 por anillo superado · +5 por estrella",
          accent: ACCENT,
        });
      }

      // paused (help reopened)
      if (gs.phase === "playing" && gs.paused) {
        pauseBtn = drawOnboard(ctx, W, H, {
          title: "Cómo jugar",
          subtitle: "Pasa la bola solo por el color que coincide con ella.",
          how: ["Toca para saltar; pasa solo por el color que coincide", "Las estrellas cambian el color de tu bola"],
          scoring: "+1 por anillo · +5 por estrella",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      } else {
        pauseBtn = null;
      }

      // gameover
      if (gs.phase === "gameover") {
        ctx.fillStyle = "rgba(6,4,14,0.72)";
        ctx.fillRect(0, 0, W, H);
        drawPanel(ctx, W / 2 - 150, H / 2 - 130, 300, 270, 26);
        glowText(ctx, "Game Over", W / 2, H / 2 - 78, 34, "#ef4444", { glow: "rgba(239,68,68,0.6)" });
        glowText(ctx, `${gs.score}`, W / 2, H / 2 - 8, 56, ACCENT, { glow: rgba(ACCENT, 0.8) });
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(16, 700);
        ctx.textAlign = "center";
        ctx.fillText(`Mejor: ${gs.bestScore}`, W / 2, H / 2 + 30);
        restartBtn = drawButton(ctx, W / 2, H / 2 + 90, 200, 56, "Jugar de nuevo", { color: ACCENT, glow: true, textColor: "#1a1300", fontSize: 19 });
        ctx.textAlign = "left";
      } else {
        restartBtn = null;
      }

      // top-right icon buttons
      drawMuteButton(ctx, W, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, W, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const pointFromEvent = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * canvas.width / rect.width,
        y: (clientY - rect.top) * canvas.height / rect.height,
      };
    };

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current!;
      const W = canvas.width;
      const { x, y } = pointFromEvent(e.clientX, e.clientY);

      // mute button (all phases) — hit-tested first
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
          if (pauseBtn && inRect(pauseBtn, x, y)) { sfx.click(); gs.paused = false; }
        } else {
          hop();
        }
      } else if (gs.phase === "gameover") {
        if (restartBtn && inRect(restartBtn, x, y)) { sfx.click(); startGame(); }
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current!;
      if (gs.phase === "onboarding") { sfx.click(); startGame(); }
      else if (gs.phase === "playing") { if (gs.paused) gs.paused = false; else hop(); }
      else if (gs.phase === "gameover") { sfx.click(); startGame(); }
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
    <div style={{ display: "flex", justifyContent: "center", background: "#0a0817", minHeight: "100dvh", position: "relative" }}>
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
