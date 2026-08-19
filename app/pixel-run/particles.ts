// ── Partículas (spawn / actualización / dibujo) ────────────────────────────────
import type { GS, Particle } from './types';

export function spawnParticles(gs: GS, x: number, y: number, baseColor: string, count: number, palette?: string[]) {
  const colors = palette ?? [baseColor, '#fff', '#ffd700', '#ff6b6b'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const spd = 80 + Math.random() * 180;
    gs.parts.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 60,
      life: 0.5 + Math.random() * 0.4,
      ml: 0.9,
      col: colors[Math.floor(Math.random() * colors.length)],
      r: 3 + Math.random() * 4,
    });
  }
}

// Partícula genérica (polvo, ráfagas) reutilizable para evitar repetir objetos
export function addParticle(
  gs: GS,
  x: number, y: number,
  vx: number, vy: number,
  life: number,
  col: string,
  r: number,
  ml?: number,
) {
  gs.parts.push({ x, y, vx, vy, life, ml: ml ?? life, col, r });
}

export function updateParticles(gs: GS, dt: number) {
  for (const p of gs.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.life -= dt;
  }
  gs.parts = gs.parts.filter(p => p.life > 0);
}

export function drawParticles(ctx: CanvasRenderingContext2D, parts: Particle[], camX: number) {
  for (const p of parts) {
    const alpha = Math.max(0, p.life / p.ml);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = p.r * 3;
    ctx.shadowColor = p.col;
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y, p.r * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}
