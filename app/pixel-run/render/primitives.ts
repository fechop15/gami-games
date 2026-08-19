// ── Primitivas de dibujo compartidas (canvas) ─────────────────────────────────
import type { Rect } from '../types';

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function strokeRRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
}

export function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.8, y - r * 0.3, r * 0.65, 0, Math.PI * 2);
  ctx.arc(x - r * 0.7, y - r * 0.2, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x + r * 1.5, y + r * 0.1, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, col: string, label: string) {
  ctx.fillStyle = col; rrect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, r.x, r.y, r.w, r.h * 0.5, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(r.x + 6, r.y + r.h - 3, r.w - 12, 2);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.min(18, r.h * 0.4)}px monospace`; ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 6);
  ctx.textAlign = 'left';
}

export function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    i === 0 ? ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
            : ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd700' : 'rgba(255,255,255,0.12)';
  ctx.fill();
  if (filled) { ctx.strokeStyle = '#f57f17'; ctx.lineWidth = 1.5; ctx.stroke(); }
}
