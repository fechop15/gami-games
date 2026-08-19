// ── HUD y botones de control táctil ────────────────────────────────────────────
import type { GS } from '../types';
import { MAX_LIVES, SKINS, hasAbility, ABILITY_IDS } from '../config';
import { rrect, strokeRRect } from './primitives';
import { pauseBtnRect, leftBtnRect, rightBtnRect, jumpBtnRect, fireBtnRect } from '../input';

export function drawHUD(ctx: CanvasRenderingContext2D, gs: GS, cw: number) {
  const hudGrad = ctx.createLinearGradient(0, 0, 0, 56);
  hudGrad.addColorStop(0, 'rgba(0,0,0,0.72)'); hudGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = hudGrad; ctx.fillRect(0, 0, cw, 56);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 55, cw, 1);

  // Lives
  const showLives = Math.max(1, Math.min(gs.lives, MAX_LIVES));
  for (let i = 0; i < showLives; i++) {
    const hx = 18 + i * 30, hy = 20, filled = i < gs.lives;
    if (filled) {
      const hGlow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
      hGlow.addColorStop(0, 'rgba(255,80,80,0.35)'); hGlow.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = hGlow; ctx.fillRect(hx - 18, hy - 18, 36, 36);
    }
    ctx.fillStyle = filled ? '#e53935' : 'rgba(100,100,100,0.5)';
    ctx.beginPath();
    ctx.arc(hx - 5, hy - 2, 6, Math.PI, 0);
    ctx.arc(hx + 5, hy - 2, 6, Math.PI, 0);
    ctx.lineTo(hx, hy + 11); ctx.closePath(); ctx.fill();
    if (filled) {
      ctx.fillStyle = 'rgba(255,150,150,0.5)';
      ctx.beginPath(); ctx.ellipse(hx - 4, hy - 4, 3, 2, -0.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Shield + ability
  ctx.textAlign = 'left';
  ctx.font = '13px monospace';
  if (gs.shield > 0) { ctx.globalAlpha = 0.95; ctx.fillStyle = '#00e5ff'; }
  else { ctx.globalAlpha = 0.3; ctx.fillStyle = 'rgba(255,255,255,0.6)'; }
  ctx.fillText('🛡', 18, 50);
  ctx.globalAlpha = 0.85;
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText(`${SKINS[gs.skin].abilityIcon} ${SKINS[gs.skin].abilityName}`, 38, 51);
  ctx.globalAlpha = 1;

  // Level indicator
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace';
  ctx.fillText('NIVEL', cw / 2, 18);
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 20px monospace';
  ctx.fillText(`${gs.lv + 1} / 7`, cw / 2, 38);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i <= gs.lv ? '#ffd700' : 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(cw / 2 - 36 + i * 12, 48, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Coins
  const coinX = cw / 2 + 55;
  const spinW2 = 0.5 + Math.abs(Math.cos(gs.elapsed * 3)) * 0.5;
  const cgGrad = ctx.createLinearGradient(coinX - 8, 20, coinX + 8, 36);
  cgGrad.addColorStop(0, '#ffe57f'); cgGrad.addColorStop(1, '#ffa000');
  ctx.fillStyle = cgGrad;
  ctx.beginPath(); ctx.ellipse(coinX, 28, 8 * spinW2, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`×${gs.coins}`, coinX + 12, 33);

  // Score
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px monospace';
  ctx.fillText('PUNTAJE', cw - 56, 18);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
  ctx.fillText(`${gs.score}`, cw - 56, 37);

  // Pause button
  const pb = pauseBtnRect(cw);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, pb.x, pb.y, pb.w, pb.h, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
  strokeRRect(ctx, pb.x, pb.y, pb.w, pb.h, 8); ctx.lineWidth = 1;
  ctx.fillStyle = '#fff';
  ctx.fillRect(pb.x + pb.w / 2 - 7, pb.y + 9, 5, pb.h - 18);
  ctx.fillRect(pb.x + pb.w / 2 + 2, pb.y + 9, 5, pb.h - 18);

  // Run indicator
  if (gs.runT > 0) {
    ctx.globalAlpha = 0.7 + Math.sin(gs.elapsed * 12) * 0.3;
    ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('⚡ TURBO', 12, 50);
    ctx.globalAlpha = 1;
  }

  // Star power bar
  if (gs.starPowerT > 0) {
    const w = 130, x = cw / 2 - w / 2, y = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrect(ctx, x - 2, y - 2, w + 4, 10, 4);
    const bg = ctx.createLinearGradient(x, 0, x + w, 0);
    bg.addColorStop(0, '#ff1744'); bg.addColorStop(0.5, '#ffeb3b'); bg.addColorStop(1, '#00e676');
    ctx.fillStyle = bg; rrect(ctx, x, y, w * (gs.starPowerT / 6), 6, 3);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('⭐ INVENCIBLE', cw / 2, y + 21);
  }
  ctx.textAlign = 'left';
}

function drawTouchButton(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, label: string, pressed: boolean, fill: string, fg: string, fade: number) {
  if (fade < 0.02 && !pressed) return;
  ctx.save();
  ctx.globalAlpha = pressed ? 0.72 : 0.32 * fade;
  ctx.fillStyle = fill;
  rrect(ctx, r.x, r.y, r.w, r.h, r.w * 0.28);
  ctx.globalAlpha = pressed ? 0.95 : 0.5 * fade;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 2;
  strokeRRect(ctx, r.x, r.y, r.w, r.h, r.w * 0.28);
  ctx.lineWidth = 1;
  ctx.globalAlpha = pressed ? 1 : 0.9 * fade;
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.round(r.h * 0.48)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 2);
  ctx.restore();
}

export function drawTouchButtons(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS) {
  const fade = gs.btnFade;
  const dark = '#141414';
  const l = leftBtnRect(cw, ch), r = rightBtnRect(cw, ch);
  const j = jumpBtnRect(cw, ch);
  drawTouchButton(ctx, l, '◄', gs.inp.L, dark, '#ffffff', fade);
  drawTouchButton(ctx, r, '►', gs.inp.R, dark, '#ffffff', fade);
  drawTouchButton(ctx, j, '▲', gs.touchJump, dark, '#ffd700', fade);

  if (hasAbility(gs, ABILITY_IDS.FIREBALL)) {
    const fb = fireBtnRect(cw, ch);
    drawTouchButton(ctx, fb, '🔥', gs.inp.F, dark, '#ff7043', fade);
  }

  if (fade > 0.05) {
    ctx.save();
    ctx.globalAlpha = 0.7 * fade;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    const labels: [string, number, number][] = [
      ['MOVER', (l.x + r.x + r.w) / 2, l.y - 8],
      ['SALTAR', j.x + j.w / 2, j.y - 8],
    ];
    if (hasAbility(gs, ABILITY_IDS.FIREBALL)) {
      const fb = fireBtnRect(cw, ch);
      labels.push(['FUEGO', fb.x + fb.w / 2, fb.y - 8]);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (const [txt, lx, ly] of labels) ctx.strokeText(txt, lx, ly);
    ctx.fillStyle = '#111';
    for (const [txt, lx, ly] of labels) ctx.fillText(txt, lx, ly);
    ctx.restore();
  }
}
