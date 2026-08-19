// ── Pantallas y overlays (intro, tienda, fin de nivel, etc.) ───────────────────
import type { GS } from '../types';
import { MAX_LIVES, LIFE_COST, SKINS, WORLD_NAMES, WORLD_ICONS } from '../config';
import { rrect, strokeRRect, drawButton, drawStar } from './primitives';
import { drawOnboard, drawButton as gkButton } from '../../lib/gameKit';
import { shopBtnRect, backBtnRect, liveBuyBtnRect, skinCardRect, resumeBtnRect, menuBtnRect } from '../input';

function drawSkinPreview(ctx: CanvasRenderingContext2D, cx: number, cy: number, i: number, t: number) {
  const s = SKINS[i];
  ctx.save();
  ctx.translate(cx, cy + Math.sin(t * 3 + i) * 2);
  ctx.fillStyle = s.bodyMid; rrect(ctx, -14, -6, 28, 22, 4);
  ctx.fillStyle = s.body; rrect(ctx, -14, -6, 28, 6, 3);
  ctx.fillStyle = s.collar; rrect(ctx, -9, -9, 18, 5, 2);
  ctx.fillStyle = '#ffcc80'; rrect(ctx, -11, -26, 22, 15, 4);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4, -20, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(5, -20, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = s.hatMid; rrect(ctx, -16, -30, 32, 6, 2);
  ctx.fillStyle = s.hat; rrect(ctx, -9, -45, 18, 16, 3);
  ctx.fillStyle = s.hatDk; ctx.fillRect(-9, -31, 18, 3);
  ctx.restore();
}

export function drawIntro(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS) {
  const walletLine = `🪙 ${gs.coins}   🔥 Racha ${gs.streak}d`;
  drawOnboard(ctx, cw, ch, {
    title: 'PIXEL RUN',
    subtitle: walletLine,
    how: [
      '◄ ► botones para mover',
      '▲ SALTAR: mantené para saltar más alto',
      'Doble tap en ◄ o ► = turbo ⚡',
      'Pisá enemigos para eliminarlos',
    ],
    scoring: '⭐ Recolectá monedas · Llegá a la bandera',
    accent: '#ffd700',
    playLabel: 'JUGAR',
  });

  if (gs.shopMsgT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, gs.shopMsgT);
    ctx.fillStyle = '#69f0ae';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(gs.shopMsg, cw / 2, ch * 0.96);
    ctx.restore();
  }

  const sr = shopBtnRect(cw, ch);
  gkButton(ctx, sr.x + sr.w / 2, sr.y + sr.h / 2, sr.w, sr.h, '🛒  TIENDA', {
    color: '#7b1fa2',
    glow: true,
  });

  ctx.textAlign = 'left';
}

export function drawShop(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#1a1030'); g.addColorStop(1, '#0a0818');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TIENDA', cw / 2, ch * 0.13);
  ctx.fillStyle = '#ffe57f'; ctx.font = 'bold 18px monospace';
  ctx.fillText(`🪙 ${gs.coins}`, cw / 2, ch * 0.185);

  drawButton(ctx, backBtnRect(), '#455a64', '‹ Volver');

  const lr = liveBuyBtnRect(cw, ch);
  const heartsY = lr.y - 28;
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('VIDAS', cw / 2, heartsY - 2);
  const totalH = MAX_LIVES, hSpacing = Math.min(22, (cw - 40) / totalH);
  const hStartX = cw / 2 - (totalH * hSpacing) / 2 + hSpacing / 2;
  for (let h = 0; h < totalH; h++) {
    ctx.fillStyle = h < gs.lives ? '#f44336' : 'rgba(255,255,255,0.18)';
    ctx.font = `${hSpacing * 0.8}px monospace`;
    ctx.fillText('♥', hStartX + h * hSpacing, heartsY + 16);
  }
  const canBuyLife = gs.extras < MAX_LIVES - 3 && gs.coins >= LIFE_COST;
  const atMax = gs.extras >= MAX_LIVES - 3;
  const btnColor = canBuyLife ? '#e53935' : '#616161';
  const btnLabel = atMax ? `♥ MÁXIMO (${MAX_LIVES})` : `+1 vida  🪙${LIFE_COST}`;
  drawButton(ctx, lr, btnColor, btnLabel);

  for (let i = 0; i < SKINS.length; i++) {
    const r = skinCardRect(cw, ch, i);
    const owned = gs.owned.includes(i);
    const equipped = gs.skin === i;
    ctx.fillStyle = equipped ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.06)';
    rrect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.strokeStyle = equipped ? '#ffd700' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = equipped ? 3 : 1.5;
    strokeRRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.lineWidth = 1;
    drawSkinPreview(ctx, r.x + r.w / 2, r.y + r.h * 0.56, i, t);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText(SKINS[i].name, r.x + r.w / 2, r.y + 22);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(`${SKINS[i].abilityIcon} ${SKINS[i].abilityName}`, r.x + r.w / 2, r.y + 40);
    ctx.font = 'bold 13px monospace';
    if (equipped) { ctx.fillStyle = '#69f0ae'; ctx.fillText('✓ EQUIPADO', r.x + r.w / 2, r.y + r.h - 13); }
    else if (owned) { ctx.fillStyle = '#90caf9'; ctx.fillText('Equipar', r.x + r.w / 2, r.y + r.h - 13); }
    else { ctx.fillStyle = gs.coins >= SKINS[i].price ? '#ffd700' : '#e57373'; ctx.fillText(`🪙 ${SKINS[i].price}`, r.x + r.w / 2, r.y + r.h - 13); }
  }

  if (gs.shopMsgT > 0) {
    ctx.globalAlpha = Math.min(1, gs.shopMsgT);
    ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(gs.shopMsg, cw / 2, ch * 0.95);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

export function drawPauseOverlay(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 42px monospace'; ctx.textAlign = 'center';
  ctx.fillText('❚❚ PAUSA', cw / 2, ch * 0.32);
  drawButton(ctx, resumeBtnRect(cw, ch), '#43a047', '▶  Continuar');
  drawButton(ctx, menuBtnRect(cw, ch), '#616161', '⌂  Menú');
  ctx.textAlign = 'left';
}

export function drawTransition(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS) {
  const t = gs.transT;
  const a = t > 0.45 ? 1 - (t - 0.45) / 0.45 : t / 0.45;
  ctx.fillStyle = `rgba(8,6,20,${Math.min(1, a)})`;
  ctx.fillRect(0, 0, cw, ch);
  if (a > 0.5) {
    const lv = gs.transToLv;
    ctx.globalAlpha = (a - 0.5) * 2;
    ctx.textAlign = 'center';
    ctx.font = '58px serif';
    ctx.fillText(WORLD_ICONS[lv], cw / 2, ch * 0.44);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 30px monospace';
    ctx.fillText(`Mundo ${lv + 1}`, cw / 2, ch * 0.55);
    ctx.fillStyle = '#fff'; ctx.font = '18px monospace';
    ctx.fillText(WORLD_NAMES[lv], cw / 2, ch * 0.61);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

export function drawLvlDone(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#69f0ae';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡NIVEL COMPLETO!', cw / 2, ch * 0.33);

  const pct = gs.totalLvlCoins > 0 ? gs.lvlCoins / gs.totalLvlCoins : 0;
  const earned = pct >= 0.9 ? 3 : pct >= 0.5 ? 2 : 1;
  const starY = ch * 0.48;
  const bounce = 1 + Math.sin(t * 4) * 0.06;
  ctx.save();
  ctx.scale(bounce, bounce);
  drawStar(ctx, (cw / 2 - 58) / bounce, starY / bounce, 22, earned >= 1);
  drawStar(ctx, (cw / 2)      / bounce, starY / bounce, 27, earned >= 2);
  drawStar(ctx, (cw / 2 + 58) / bounce, starY / bounce, 22, earned >= 3);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText(`Puntaje: ${gs.score}`, cw / 2, ch * 0.62);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`Monedas: ${gs.lvlCoins} / ${gs.totalLvlCoins}`, cw / 2, ch * 0.70);

  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Toca para continuar', cw / 2, ch * 0.83);
  }
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = '#e53935';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', cw / 2, ch * 0.38);

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.fillText(`Puntaje final: ${gs.score}`, cw / 2, ch * 0.50);
  ctx.fillText(`Monedas: ${gs.coins}`, cw / 2, ch * 0.58);

  if (Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Toca para reintentar', cw / 2, ch * 0.72);
  }
  ctx.textAlign = 'left';
}

export function drawWin(ctx: CanvasRenderingContext2D, cw: number, ch: number, gs: GS, t: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.70)';
  ctx.fillRect(0, 0, cw, ch);

  const pulse = 1 + Math.sin(t * 3) * 0.06;
  ctx.save();
  ctx.translate(cw / 2, ch * 0.32);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡GANASTE!', 0, 0);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡Felicitaciones, héroe!', cw / 2, ch * 0.46);
  ctx.fillText(`Puntaje total: ${gs.score}`, cw / 2, ch * 0.55);
  ctx.fillText(`Monedas: ${gs.coins}`, cw / 2, ch * 0.62);

  if (Math.floor(t * 1.5) % 2 === 0) {
    ctx.fillStyle = '#69f0ae';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Toca para volver al menú', cw / 2, ch * 0.77);
  }
  ctx.textAlign = 'left';
}
