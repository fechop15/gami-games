"use client";
import Link from "next/link";

import { useEffect, useRef } from "react";
import {
  font, rgba, shade, roundRectPath, drawBackground,
  drawButton, drawPill, glowText, drawPanel, drawHeart,
  drawLoading, drawMuteButton, drawHelpButton, drawOnboard,
  loadImages, iconButtonRect, inRect, type Rect,
} from "../lib/gameKit";
import { sfx, unlockAudio, toggleMute, isMuted } from "../lib/sound";

const ACCENT = "#ef4444";

interface Ball { x: number; y: number; vx: number; vy: number; speed: number; }
interface Brick { x: number; y: number; w: number; h: number; hp: number; maxHp: number; indestructible: boolean; moveDir?: number; }
interface PowerUp { x: number; y: number; vy: number; type: "multi" | "wide" | "slow" | "laser"; }
interface Particle { x: number; y: number; vx: number; vy: number; color: string; life: number; }
interface FloatText { x: number; y: number; text: string; color: string; life: number; vy: number; big?: boolean; }

interface GS {
  phase: "loading" | "onboarding" | "playing" | "gameover" | "win";
  paused: boolean;
  loadPct: number;
  balls: Ball[];
  bricks: Brick[];
  powerUps: PowerUp[];
  particles: Particle[];
  floats: FloatText[];
  paddleX: number;
  paddleW: number;
  paddleTargetX: number;
  lives: number;
  score: number;
  level: number;
  wideTimer: number;
  slowTimer: number;
  levelStartTime: number;
  shake: number;
  lastTime: number;
}

const BRICK_COLS = 10;
const BRICK_H = 24;
const BRICK_GAP = 4;
const PADDLE_H = 14;
const BALL_R = 7;
const INIT_SPEED = 320;
const HP_COLORS = ["", "#ef4444", "#f97316", "#a855f7"];

let brickBest = 0;

const LEVELS: number[][][] = [
  [[1,1,1,1,1,1,1,1,1,1],[1,0,1,0,1,0,1,0,1,0],[0,1,0,1,0,1,0,1,0,1]],
  [[2,2,2,2,2,2,2,2,2,2],[1,1,1,1,1,1,1,1,1,1],[1,0,1,0,1,0,1,0,1,0]],
  [[2,2,2,2,2,2,2,2,2,2],[1,2,1,2,1,2,1,2,1,2],[1,1,1,1,1,1,1,1,1,1],[1,0,0,1,0,0,1,0,0,1]],
  [[-1,-1,1,1,1,1,1,1,-1,-1],[2,2,2,2,2,2,2,2,2,2],[1,1,-1,1,1,1,1,-1,1,1],[1,2,1,2,1,2,1,2,1,2]],
  [[3,3,3,3,3,3,3,3,3,3],[2,2,-1,2,2,2,2,-1,2,2],[1,1,1,1,1,1,1,1,1,1],[2,0,2,0,2,0,2,0,2,0]],
  ...Array.from({ length: 10 }, (_, i) => {
    const rows = 3 + i;
    return Array.from({ length: rows }, () =>
      Array.from({ length: 10 }, () => {
        if (Math.random() < 0.1) return -1;
        const hp = Math.min(Math.floor(Math.random() * (1 + Math.floor(i / 3))) + 1, 3);
        return Math.random() < 0.15 ? 0 : hp;
      })
    );
  }),
];

function buildBricks(level: number, W: number): Brick[] {
  const layout = LEVELS[Math.min(level, LEVELS.length - 1)];
  const brickW = (W - (BRICK_COLS + 1) * BRICK_GAP) / BRICK_COLS;
  const bricks: Brick[] = [];
  for (let r = 0; r < layout.length; r++) {
    for (let c = 0; c < layout[r].length; c++) {
      const val = layout[r][c];
      if (val === 0) continue;
      const indestructible = val === -1;
      const hp = indestructible ? 999 : val;
      bricks.push({
        x: BRICK_GAP + c * (brickW + BRICK_GAP),
        y: 100 + r * (BRICK_H + BRICK_GAP),
        w: brickW,
        h: BRICK_H,
        hp,
        maxHp: hp,
        indestructible,
        moveDir: level >= 5 && !indestructible && Math.random() < 0.2 ? 1 : undefined,
      });
    }
  }
  return bricks;
}

function initGS(level: number, score: number, W: number, H: number): GS {
  const paddleW = Math.min(W * 0.22, 100);
  const paddleX = W / 2 - paddleW / 2;
  const ballY = H - 80;
  return {
    phase: "playing",
    paused: false,
    loadPct: 1,
    balls: [{ x: W / 2, y: ballY, vx: 200, vy: -INIT_SPEED, speed: INIT_SPEED }],
    bricks: buildBricks(level, W),
    powerUps: [],
    particles: [],
    floats: [],
    paddleX,
    paddleW,
    paddleTargetX: paddleX,
    lives: 3,
    score,
    level,
    wideTimer: 0,
    slowTimer: 0,
    levelStartTime: Date.now(),
    shake: 0,
    lastTime: 0,
  };
}

export default function BrickBlitzGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS | null>(null);
  const rafRef = useRef<number>(0);
  const imgRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const canvas = canvasRef.current!;

    const resize = () => {
      const prevW = canvas.width;
      const nextW = canvas.clientWidth || Math.min(window.innerWidth, 480);
      const nextH = canvas.clientHeight || window.innerHeight;
      canvas.width = nextW;
      canvas.height = nextH;
      // Recompute layout on width change without resetting the live game.
      const gs = gsRef.current;
      if (gs && prevW > 0 && nextW !== prevW) {
        const ratio = nextW / prevW;
        for (const b of gs.bricks) { b.x *= ratio; b.w *= ratio; }
        for (const ball of gs.balls) ball.x *= ratio;
        for (const pu of gs.powerUps) pu.x *= ratio;
        gs.paddleX *= ratio;
        gs.paddleTargetX *= ratio;
        gs.paddleW *= ratio;
      }
    };
    resize();

    const ctx = canvas.getContext("2d")!;

    gsRef.current = { ...initGS(0, 0, canvas.width, canvas.height), phase: "loading", loadPct: 0 };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Preload sprites, then reveal onboarding.
    loadImages(
      {
        bg: "/games/brick-blitz/bg.svg",
        ball: "/games/brick-blitz/ball.svg",
        paddle: "/games/brick-blitz/paddle.svg",
        powerup: "/games/brick-blitz/powerup.svg",
      },
      (pct) => { if (gsRef.current) gsRef.current.loadPct = pct; }
    ).then((imgs) => {
      imgRef.current = imgs;
      if (gsRef.current && gsRef.current.phase === "loading") gsRef.current.phase = "onboarding";
    });

    const paddleY = () => canvas.height - 40;

    const burst = (gs: GS, x: number, y: number, color: string, n = 10) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 4;
        gs.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, life: 1 });
      }
    };

    const ballCollidesBrick = (ball: Ball, brick: Brick) => {
      const left = ball.x - BALL_R < brick.x + brick.w;
      const right = ball.x + BALL_R > brick.x;
      const top2 = ball.y - BALL_R < brick.y + brick.h;
      const bottom = ball.y + BALL_R > brick.y;
      return left && right && top2 && bottom;
    };

    // Hit-boxes shared between draw and pointer handlers.
    let playBtnRect: Rect | null = null;
    let continueBtnRect: Rect | null = null;
    let dragging = false;

    const startGame = () => {
      gsRef.current = initGS(0, 0, canvas.width, canvas.height);
    };

    const restart = () => {
      gsRef.current = initGS(0, 0, canvas.width, canvas.height);
    };

    const gameOverBtnRect = (): Rect => {
      const w = canvas.width, h = canvas.height;
      return { x: w / 2 - 100, y: h / 2 + 72, w: 200, h: 56 };
    };

    const clampPaddle = (gs: GS, centerX: number) => {
      const x = centerX - gs.paddleW / 2;
      gs.paddleX = Math.max(0, Math.min(canvas.width - gs.paddleW, x));
      gs.paddleTargetX = gs.paddleX;
    };

    const draw = (ts: number) => {
      const gs = gsRef.current!;
      const dt = Math.min((ts - gs.lastTime) / 1000, 0.05);
      gs.lastTime = ts;
      const w = canvas.width;
      const h = canvas.height;
      const py = paddleY();

      // loading screen
      if (gs.phase === "loading") {
        drawLoading(ctx, w, h, gs.loadPct, ACCENT, "Brick Blitz");
        drawMuteButton(ctx, w, isMuted(), ACCENT);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const active = gs.phase === "playing" && !gs.paused;

      if (active) {
        gs.wideTimer = Math.max(0, gs.wideTimer - dt);
        gs.slowTimer = Math.max(0, gs.slowTimer - dt);
        if (gs.wideTimer <= 0) gs.paddleW = Math.min(w * 0.22, 100);

        gs.paddleX += (gs.paddleTargetX - gs.paddleX) * Math.min(dt * 20, 1);
        gs.paddleX = Math.max(0, Math.min(w - gs.paddleW, gs.paddleX));

        if (gs.level >= 5) {
          for (const b of gs.bricks) {
            if (b.moveDir !== undefined) {
              b.x += b.moveDir * 60 * dt;
              if (b.x <= 0) { b.x = 0; b.moveDir = 1; }
              if (b.x + b.w >= w) { b.x = w - b.w; b.moveDir = -1; }
            }
          }
        }

        const deadBalls: number[] = [];
        for (let bi = 0; bi < gs.balls.length; bi++) {
          const ball = gs.balls[bi];
          const spd = gs.slowTimer > 0 ? ball.speed * 0.55 : ball.speed;
          const dx = ball.vx / ball.speed * spd * dt;
          const dy = ball.vy / ball.speed * spd * dt;
          // Sub-step to avoid tunneling through bricks/paddle at high speed.
          const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / BALL_R));
          let dead = false;

          for (let s = 0; s < steps && !dead; s++) {
            ball.x += dx / steps;
            ball.y += dy / steps;

            // walls
            if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); sfx.hit(); }
            if (ball.x + BALL_R > w) { ball.x = w - BALL_R; ball.vx = -Math.abs(ball.vx); sfx.hit(); }
            if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); sfx.hit(); }
            if (ball.y > h + 20) { dead = true; break; }

            // paddle
            if (ball.y + BALL_R > py && ball.y - BALL_R < py + PADDLE_H && ball.x > gs.paddleX && ball.x < gs.paddleX + gs.paddleW && ball.vy > 0) {
              const rel = (ball.x - gs.paddleX) / gs.paddleW - 0.5;
              let nvx = rel * ball.speed * 1.5;
              let nvy = -Math.abs(ball.vy);
              const mag = Math.hypot(nvx, nvy) || 1;
              nvx = nvx / mag * ball.speed;
              nvy = nvy / mag * ball.speed;
              // Keep a minimum vertical component so the ball never gets stuck horizontal.
              const minVy = ball.speed * 0.35;
              if (Math.abs(nvy) < minVy) {
                nvy = -minVy;
                nvx = Math.sign(nvx || 1) * Math.sqrt(Math.max(0, ball.speed * ball.speed - nvy * nvy));
              }
              ball.vx = nvx;
              ball.vy = nvy;
              ball.y = py - BALL_R;
              sfx.hit();
            }

            // bricks
            for (let bri = gs.bricks.length - 1; bri >= 0; bri--) {
              const brick = gs.bricks[bri];
              if (!ballCollidesBrick(ball, brick)) continue;
              if (!brick.indestructible) {
                brick.hp--;
                gs.score += 10 * brick.maxHp;
                const bc = HP_COLORS[Math.min(brick.maxHp, 3)] || ACCENT;
                burst(gs, brick.x + brick.w / 2, brick.y + brick.h / 2, bc, brick.hp <= 0 ? 12 : 5);
                if (brick.hp <= 0) {
                  gs.shake = Math.max(gs.shake, 4);
                  sfx.explode();
                  gs.floats.push({ x: brick.x + brick.w / 2, y: brick.y, text: `+${10 * brick.maxHp}`, color: bc, life: 0.8, vy: -1.4 });
                  if (Math.random() < 0.2) {
                    const types: PowerUp["type"][] = ["multi", "wide", "slow", "laser"];
                    gs.powerUps.push({ x: brick.x + brick.w / 2, y: brick.y, vy: 120, type: types[Math.floor(Math.random() * types.length)] });
                  }
                  gs.bricks.splice(bri, 1);
                } else {
                  sfx.hit();
                }
              } else {
                gs.shake = Math.max(gs.shake, 3);
                sfx.hit();
              }
              const overlapL = ball.x + BALL_R - brick.x;
              const overlapR = brick.x + brick.w - (ball.x - BALL_R);
              const overlapT = ball.y + BALL_R - brick.y;
              const overlapB = brick.y + brick.h - (ball.y - BALL_R);
              const minH = Math.min(overlapL, overlapR);
              const minV = Math.min(overlapT, overlapB);
              if (minH < minV) ball.vx *= -1; else ball.vy *= -1;
              break;
            }
          }
          if (dead) deadBalls.push(bi);
        }
        for (let i = deadBalls.length - 1; i >= 0; i--) gs.balls.splice(deadBalls[i], 1);
        if (gs.balls.length === 0) {
          gs.lives--;
          gs.shake = 12;
          if (gs.lives <= 0) { gs.phase = "gameover"; brickBest = Math.max(brickBest, gs.score); sfx.gameover(); }
          else {
            sfx.hurt();
            gs.balls = [{ x: w / 2, y: py - 20, vx: 200, vy: -INIT_SPEED, speed: INIT_SPEED }];
          }
        }

        for (let i = gs.powerUps.length - 1; i >= 0; i--) {
          const pu = gs.powerUps[i];
          pu.y += pu.vy * dt;
          if (pu.y > h) { gs.powerUps.splice(i, 1); continue; }
          if (pu.y + 10 > py && pu.x > gs.paddleX && pu.x < gs.paddleX + gs.paddleW) {
            gs.powerUps.splice(i, 1);
            sfx.powerup();
            if (pu.type === "multi") {
              gs.balls.push({ x: gs.balls[0].x, y: gs.balls[0].y, vx: -gs.balls[0].vx, vy: gs.balls[0].vy, speed: gs.balls[0].speed });
              gs.balls.push({ x: gs.balls[0].x, y: gs.balls[0].y, vx: gs.balls[0].vx * 0.7, vy: gs.balls[0].vy, speed: gs.balls[0].speed });
            } else if (pu.type === "wide") {
              gs.paddleW = Math.min(w * 0.38, 180);
              gs.wideTimer = 10;
            } else if (pu.type === "slow") {
              gs.slowTimer = 8;
            } else if (pu.type === "laser") {
              const sorted = [...gs.bricks].filter(b => !b.indestructible).sort((a, b2) => a.y - b2.y);
              sorted.slice(0, 2).forEach(b => {
                gs.score += 10 * b.maxHp;
                burst(gs, b.x + b.w / 2, b.y + b.h / 2, "#fbbf24", 10);
                gs.bricks.splice(gs.bricks.indexOf(b), 1);
              });
            }
          }
        }

        if (gs.bricks.filter(b => !b.indestructible).length === 0) {
          const elapsed = Date.now() - gs.levelStartTime;
          const timeBonus = Math.max(0, Math.floor((60000 - elapsed) / 100));
          gs.score += timeBonus;
          gs.level++;
          if (gs.level >= 15) { gs.phase = "win"; brickBest = Math.max(brickBest, gs.score); sfx.win(); }
          else {
            sfx.levelup();
            gs.bricks = buildBricks(gs.level, w);
            gs.balls = [{ x: w / 2, y: py - 20, vx: 200, vy: -INIT_SPEED, speed: INIT_SPEED + gs.level * 20 }];
            gs.powerUps = [];
            gs.levelStartTime = Date.now();
          }
        }
      }

      // particles + floats update
      gs.particles = gs.particles.filter(p => p.life > 0);
      for (const p of gs.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= dt * 1.8; }
      gs.floats = gs.floats.filter(f => f.life > 0);
      for (const f of gs.floats) { f.y += f.vy; f.life -= dt; }
      if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 40);

      // background (image if available, else procedural)
      const bg = imgRef.current.bg;
      if (bg) {
        ctx.drawImage(bg, 0, 0, w, h);
        ctx.fillStyle = "rgba(13,8,16,0.5)";
        ctx.fillRect(0, 0, w, h);
      } else {
        drawBackground(ctx, w, h, ["#2a1015", "#1a0d18", "#0d0810"]);
      }

      ctx.save();
      if (gs.shake > 0) ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake);

      // bricks (glossy rounded)
      for (const b of gs.bricks) {
        const base = b.indestructible ? "#4b5563" : HP_COLORS[Math.min(b.hp, 3)];
        const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
        g.addColorStop(0, shade(base, 0.25));
        g.addColorStop(1, shade(base, -0.12));
        ctx.save();
        if (!b.indestructible) { ctx.shadowColor = rgba(base, 0.5); ctx.shadowBlur = 8; }
        ctx.fillStyle = g;
        roundRectPath(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.fill();
        ctx.restore();
        // gloss
        ctx.save();
        roundRectPath(ctx, b.x, b.y, b.w, b.h, 6);
        ctx.clip();
        const gl = ctx.createLinearGradient(0, b.y, 0, b.y + b.h * 0.5);
        gl.addColorStop(0, "rgba(255,255,255,0.28)");
        gl.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gl;
        ctx.fillRect(b.x, b.y, b.w, b.h * 0.5);
        ctx.restore();
        if (!b.indestructible && b.maxHp > 1) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = font(11, 800);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${b.hp}`, b.x + b.w / 2, b.y + b.h / 2);
          ctx.textBaseline = "alphabetic";
        }
      }
      ctx.textAlign = "left";

      // power-ups (color-coded by type + glyph)
      const puColors: Record<string, string> = { multi: "#60a5fa", wide: "#4ade80", slow: "#f87171", laser: "#fbbf24" };
      const puLabels: Record<string, string> = { multi: "×3", wide: "▬", slow: "◎", laser: "⚡" };
      for (const pu of gs.powerUps) {
        ctx.save();
        ctx.shadowColor = rgba(puColors[pu.type], 0.9);
        ctx.shadowBlur = 12;
        ctx.fillStyle = puColors[pu.type];
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.font = font(10, 800);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(puLabels[pu.type], pu.x, pu.y);
        ctx.textBaseline = "alphabetic";
      }
      ctx.textAlign = "left";

      // particles
      for (const p of gs.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // balls (sprite if available, else glowing circle)
      const ballImg = imgRef.current.ball;
      for (const ball of gs.balls) {
        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,0.9)";
        ctx.shadowBlur = 14;
        if (ballImg) {
          ctx.drawImage(ballImg, 40, 40, 176, 176, ball.x - BALL_R, ball.y - BALL_R, BALL_R * 2, BALL_R * 2);
        } else {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // paddle (sprite when normal color, procedural glossy green when wide)
      const pcol = gs.wideTimer > 0 ? "#4ade80" : ACCENT;
      const paddleImg = imgRef.current.paddle;
      if (paddleImg && gs.wideTimer <= 0) {
        ctx.save();
        ctx.shadowColor = rgba(pcol, 0.7);
        ctx.shadowBlur = 16;
        ctx.drawImage(paddleImg, 20, 100, 208, 48, gs.paddleX, py, gs.paddleW, PADDLE_H);
        ctx.restore();
      } else {
        const grad = ctx.createLinearGradient(gs.paddleX, py, gs.paddleX, py + PADDLE_H);
        grad.addColorStop(0, shade(pcol, 0.25));
        grad.addColorStop(1, shade(pcol, -0.15));
        ctx.save();
        ctx.shadowColor = rgba(pcol, 0.7);
        ctx.shadowBlur = 16;
        ctx.fillStyle = grad;
        roundRectPath(ctx, gs.paddleX, py, gs.paddleW, PADDLE_H, PADDLE_H / 2);
        ctx.fill();
        ctx.restore();
      }

      // floats
      for (const f of gs.floats) {
        ctx.globalAlpha = Math.min(f.life, 1);
        glowText(ctx, f.text, f.x, f.y, f.big ? 26 : 18, f.color, { glow: rgba(f.color, 0.7) });
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // HUD (during play / end screens)
      if (gs.phase === "playing" || gs.phase === "gameover" || gs.phase === "win") {
        glowText(ctx, `${gs.score}`, w / 2, 46, 32, "#ffffff", { glow: rgba(ACCENT, 0.6) });
        drawPill(ctx, 12, 62, `Nivel ${gs.level + 1}/15`, { accent: ACCENT, fontSize: 13 });
        for (let i = 0; i < 3; i++) {
          drawHeart(ctx, w - 24 - i * 26, 26, 18, i < gs.lives);
        }
        let timerY = 84;
        if (gs.wideTimer > 0) { drawPill(ctx, w - 12, timerY, `Wide ${gs.wideTimer.toFixed(1)}s`, { accent: "#4ade80", fontSize: 12, align: "right" }); timerY += 30; }
        if (gs.slowTimer > 0) { drawPill(ctx, w - 12, timerY, `Slow ${gs.slowTimer.toFixed(1)}s`, { accent: "#f87171", fontSize: 12, align: "right" }); }
      }

      // onboarding
      if (gs.phase === "onboarding") {
        playBtnRect = drawOnboard(ctx, w, h, {
          title: "Brick Blitz",
          subtitle: "Rompe todos los ladrillos para pasar de nivel.",
          how: ["Arrastra el dedo para mover la paleta", "Rebota la pelota y evita que caiga", "Recoge power-ups que caen"],
          scoring: "+10 por HP de ladrillo · 15 niveles",
          accent: ACCENT,
        });
      } else {
        playBtnRect = null;
      }

      // paused (help reopened)
      if (gs.phase === "playing" && gs.paused) {
        continueBtnRect = drawOnboard(ctx, w, h, {
          title: "Cómo jugar",
          subtitle: "Rompe todos los ladrillos para pasar de nivel.",
          how: ["Arrastra el dedo para mover la paleta", "Rebota la pelota y evita que caiga", "Recoge power-ups que caen"],
          scoring: "+10 por HP de ladrillo · 15 niveles",
          accent: ACCENT,
          playLabel: "CONTINUAR",
        });
      } else {
        continueBtnRect = null;
      }

      // gameover / win
      if (gs.phase === "gameover" || gs.phase === "win") {
        const won = gs.phase === "win";
        ctx.fillStyle = "rgba(8,4,8,0.72)";
        ctx.fillRect(0, 0, w, h);
        drawPanel(ctx, w / 2 - 150, h / 2 - 140, 300, 290, 26);
        glowText(ctx, won ? "¡Victoria!" : "Game Over", w / 2, h / 2 - 86, 34, won ? "#fbbf24" : ACCENT, { glow: rgba(won ? "#fbbf24" : ACCENT, 0.6) });
        glowText(ctx, `${gs.score}`, w / 2, h / 2 - 18, 54, "#ffffff", { glow: rgba(ACCENT, 0.7) });
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = font(16, 600);
        ctx.textAlign = "center";
        ctx.fillText(`Nivel ${gs.level + 1}`, w / 2, h / 2 + 14);
        ctx.fillStyle = "#fbbf24";
        ctx.font = font(15, 700);
        ctx.fillText(`Mejor: ${brickBest}`, w / 2, h / 2 + 42);
        drawButton(ctx, w / 2, h / 2 + 100, 200, 56, "Jugar de nuevo", { color: ACCENT, glow: true, fontSize: 19 });
        ctx.textAlign = "left";
      }

      // top-right icon buttons (always visible)
      drawMuteButton(ctx, w, isMuted(), ACCENT);
      if (gs.phase === "playing" || gs.phase === "onboarding") drawHelpButton(ctx, w, ACCENT);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const coords = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      const gs = gsRef.current!;
      const { x, y } = coords(e.clientX, e.clientY);
      const w = canvas.width;

      // mute button first (all phases)
      if (inRect(iconButtonRect(w, 0), x, y)) { toggleMute(); if (!isMuted()) sfx.click(); return; }
      // help button (playing / onboarding)
      if ((gs.phase === "playing" || gs.phase === "onboarding") && inRect(iconButtonRect(w, 1), x, y)) {
        sfx.click();
        if (gs.phase === "playing") gs.paused = true;
        return;
      }

      if (gs.phase === "loading") return;

      if (gs.phase === "onboarding") {
        if (playBtnRect && inRect(playBtnRect, x, y)) { sfx.click(); startGame(); }
        return;
      }
      if (gs.phase === "playing") {
        if (gs.paused) {
          if (continueBtnRect && inRect(continueBtnRect, x, y)) { sfx.click(); gs.paused = false; }
          return;
        }
        // start dragging the paddle
        dragging = true;
        try { canvas.setPointerCapture(e.pointerId); } catch {}
        clampPaddle(gs, x);
        return;
      }
      if (gs.phase === "gameover" || gs.phase === "win") {
        if (inRect(gameOverBtnRect(), x, y)) { sfx.click(); restart(); }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const gs = gsRef.current!;
      if (gs.phase !== "playing" || gs.paused) return;
      // touch must be dragging; mouse steers on hover too.
      if (e.pointerType === "touch" && !dragging) return;
      e.preventDefault();
      const { x } = coords(e.clientX, e.clientY);
      clampPaddle(gs, x);
    };

    const onPointerUp = () => { dragging = false; };

    const onKey = (e: KeyboardEvent) => {
      const gs = gsRef.current!;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        unlockAudio();
        if (gs.phase === "onboarding") { sfx.click(); startGame(); }
        else if (gs.phase === "gameover" || gs.phase === "win") { sfx.click(); restart(); }
        else if (gs.phase === "playing" && gs.paused) { sfx.click(); gs.paused = false; }
        return;
      }
      if (gs.phase !== "playing" || gs.paused) return;
      const step = gs.paddleW * 0.7;
      if (e.code === "ArrowLeft" || e.code === "KeyA") clampPaddle(gs, gs.paddleX + gs.paddleW / 2 - step);
      else if (e.code === "ArrowRight" || e.code === "KeyD") clampPaddle(gs, gs.paddleX + gs.paddleW / 2 + step);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#0d0810", minHeight: "100dvh", position: "relative" }}>
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
