// ── Render: orquesta el mundo, HUD, controles y overlays ───────────────────────
import type { GS } from '../types';
import { drawBackground, drawWorld } from './world';
import { drawHUD, drawTouchButtons } from './hud';
import {
  drawIntro, drawShop, drawPauseOverlay, drawTransition,
  drawLvlDone, drawGameOver, drawWin,
} from './screens';

export function render(ctx: CanvasRenderingContext2D, gs: GS, cw: number, ch: number) {
  ctx.clearRect(0, 0, cw, ch);

  if (gs.phase === 'shop') {
    drawShop(ctx, cw, ch, gs, gs.elapsed);
    return;
  }

  if (gs.phase === 'intro') {
    drawBackground(ctx, cw, ch, 'green', 0, gs.elapsed);
    drawIntro(ctx, cw, ch, gs);
    return;
  }

  // World + entidades (incluye partículas) y HUD
  drawWorld(ctx, gs, cw, ch);
  drawHUD(ctx, gs, cw);
  if (gs.entryLock || gs.phase === 'playing') drawTouchButtons(ctx, cw, ch, gs);

  // Overlays
  if (gs.phase === 'lvlDone') drawLvlDone(ctx, cw, ch, gs, gs.elapsed);
  if (gs.phase === 'gameOver') drawGameOver(ctx, cw, ch, gs, gs.elapsed);
  if (gs.phase === 'win') drawWin(ctx, cw, ch, gs, gs.elapsed);
  if (gs.phase === 'dead') drawDeadOverlay(ctx, cw, ch, gs);

  if (gs.phase === 'transition') drawTransition(ctx, cw, ch, gs);
  if (gs.paused) drawPauseOverlay(ctx, cw, ch);

  // Flash de impacto (pantalla completa, siempre al final)
  if (gs.flashT > 0) {
    const fa = Math.min(0.6, gs.flashT * 4);
    ctx.globalAlpha = fa;
    ctx.fillStyle = gs.flashCol;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = 1;
  }
}

function drawDeadOverlay(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#e53935';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡Perdiste una vida!', cw / 2, ch / 2);
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText(`Vidas restantes: ${gs.lives}`, cw / 2, ch / 2 + 35);
  ctx.textAlign = 'left';
}
