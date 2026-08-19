// ── Física: colisiones, plataformas móviles, reflow y respawn seguro ───────────
import type { GS, Platform } from './types';
import { PW, PH, COYOTE } from './config';

export function resolvePlatformsX(gs: GS) {
  for (const p of gs.plats) {
    const L = gs.px, R = gs.px + PW, T = gs.py, B = gs.py + PH;
    const pL = p.x, pR = p.x + p.w, pT = p.y, pB = p.y + p.h;
    if (R <= pL || L >= pR || B <= pT + 4 || T >= pB) continue;
    if (gs.pvx > 0 && R > pL && R - pL < 24) { gs.px = pL - PW; gs.pvx = 0; }
    else if (gs.pvx < 0 && L < pR && pR - L < 24) { gs.px = pR; gs.pvx = 0; }
  }
}

export function resolvePlatformsY(gs: GS, dt: number) {
  for (const p of gs.plats) {
    const L = gs.px, R = gs.px + PW, T = gs.py, B = gs.py + PH;
    const pL = p.x, pR = p.x + p.w, pT = p.y, pB = p.y + p.h;
    if (R <= pL || L >= pR || B <= pT || T >= pB) continue;

    const prevB = B - gs.pvy * dt;
    const prevT = T - gs.pvy * dt;

    if (gs.pvy >= 0 && prevB <= pT + 4) {
      gs.py = pT - PH;
      gs.pvy = 0;
      gs.onG = true;
      gs.coyT = COYOTE;
    } else if (gs.pvy < 0 && prevT >= pB - 4) {
      gs.py = pB + 1;
      gs.pvy = 0;
    }
  }
}

export function updateMovingPlatforms(gs: GS, dt: number) {
  for (const p of gs.plats) {
    if (p.spd <= 0) continue;
    p.x += p.dir * p.spd * dt;
    const over = p.x - p.origX;
    if (Math.abs(over) >= p.rng) {
      p.dir *= -1;
      p.x = p.origX + Math.sign(over) * p.rng; // snap al límite que se excedió
    }
  }
}

// Reacomoda todo el mundo al cambiar el alto del canvas (rotación del celular).
// Toda la geometría del nivel está relativa al suelo (gs.gY); se desplaza en Y
// sin perder progreso (monedas, checkpoints, posición del jugador).
export function reflowWorld(gs: GS, newCh: number, newCw: number) {
  const newG = newCh - 70;
  const dy = newG - gs.gY;
  if (dy === 0) return;
  gs.gY = newG;
  gs.py += dy;
  gs.ckY += dy;
  for (const p of gs.plats) p.y += dy;
  for (const e of gs.ens) { e.y += dy; e.baseY += dy; }
  for (const sp of gs.sps) sp.y += dy;
  for (const c of gs.cns) c.y += dy;
  if (gs.starCoin) gs.starCoin.y += dy;
  gs.camX = Math.max(0, Math.min(gs.lW - newCw, gs.camX));
}

// Devuelve el Y de los pies del jugador sobre la plataforma más baja (más cercana
// al suelo) que hay debajo de la x dada, para que el respawn nunca caiga al vacío
// en mapas aéreos (Cielo / Nubes) donde no hay suelo continuo.
export function spawnFeetY(gs: GS, cx: number): number {
  const pcx = cx + PW / 2;

  const under = nearestPlatformBelow(gs.plats, pcx);
  if (under) return under.y;

  let nearest: Platform | null = null, nd = Infinity;
  for (const p of gs.plats) {
    const d = pcx < p.x ? p.x - pcx : pcx > p.x + p.w ? pcx - (p.x + p.w) : 0;
    if (d < nd) { nd = d; nearest = p; }
  }
  return nearest ? nearest.y : gs.gY;
}

// La plataforma más baja (mayor y → más cercana al suelo) que contiene la x dada
function nearestPlatformBelow(plats: Platform[], pcx: number): Platform | null {
  let under: Platform | null = null;
  for (const p of plats) {
    if (pcx >= p.x && pcx <= p.x + p.w) {
      if (!under || p.y > under.y) under = p;
    }
  }
  return under;
}
