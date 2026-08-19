// ── Enemigos, entidades y colisiones del jugador ───────────────────────────────
import type { GS } from './types';
import { PW, PH, THEME_PARTS, hasAbility, ABILITY_IDS } from './config';
import { sfxStomp, sfxCombo, sfxCoin, sfxPower, sfxLevel } from './audio';
import { spawnParticles } from './particles';
import { spawnFeetY } from './physics';
import { writeSave } from './save';
import { loseLife } from './state';

export function updateEnemies(gs: GS, dt: number) {
  for (const e of gs.ens) {
    if (!e.alive) { e.stompT = Math.max(0, e.stompT - dt); continue; }

    if (e.type === 'monkey') {
      // Horizontal patrol
      e.x += e.vx * dt;
      if (e.x < e.patL) { e.x = e.patL; e.vx = Math.abs(e.vx); }
      if (e.x > e.patR) { e.x = e.patR; e.vx = -Math.abs(e.vx); }
      // Vertical jump
      e.vy += 900 * dt;
      e.y += e.vy * dt;
      if (e.y >= e.baseY) { e.y = e.baseY; e.vy = 0; }
      // Jump cooldown — when on ground (vy==0) count down
      if (e.vy === 0) {
        e.ft -= dt;
        if (e.ft <= 0) {
          e.vy = -360 - Math.random() * 60;
          e.ft = 2.2 + Math.random() * 1.8; // next jump cooldown
        }
      }
      // Walk animation frame
      e.fr = Math.floor(gs.elapsed * 6) % 2;

    } else if (e.type === 'plant') {
      // Spit seed cooldown
      e.ft -= dt;
      if (e.ft <= 0) {
        e.ft = 2.8 + Math.random() * 1.5;
        // Seed origin: mouth of plant (center-top of bounding box)
        const seedX = e.x + e.w / 2;
        const seedY = e.y + 14;
        // Direction toward player
        const dir = gs.px + PW / 2 > seedX ? 1 : -1;
        gs.projs.push({ x: seedX, y: seedY, vx: dir * 180, vy: -60, life: 2.2 });
      }

    } else {
      // spider, worm, espin — standard patrol
      e.x += e.vx * dt;
      if (e.x < e.patL) { e.x = e.patL; e.vx = Math.abs(e.vx); }
      if (e.x > e.patR) { e.x = e.patR; e.vx = -Math.abs(e.vx); }
      // Walk animation
      e.ft += dt;
      if (e.ft > 0.18) { e.fr = 1 - e.fr; e.ft = 0; }
    }
  }

  // Update projectiles (seeds)
  for (const p of gs.projs) {
    p.x += p.vx * dt;
    p.vy += 400 * dt; // slight gravity
    p.y += p.vy * dt;
    p.life -= dt;
  }
  gs.projs = gs.projs.filter(p => p.life > 0);
}

// Mueve y expira las bolas de fuego del jugador
export function updateFireballs(gs: GS, dt: number) {
  for (const fb of gs.fbs) { fb.x += fb.vx * dt; fb.life -= dt; }
  gs.fbs = gs.fbs.filter(fb => fb.life > 0);
}

function killEnemy(gs: GS, e: GS['ens'][number], pts: number, col: string, palette?: string[]) {
  e.alive = false;
  e.stompT = 0.5;
  gs.score += pts;
  sfxStomp();
  spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, col, 10, palette);
  gs.msg = `+${pts}`; gs.msgT = 0.6;
}

export function checkEntities(gs: GS, cw: number, ch: number) {
  if (gs.phase !== 'playing') return;

  const pL = gs.px, pR = gs.px + PW, pT = gs.py, pB = gs.py + PH;
  const parts = THEME_PARTS[gs.theme];

  // Bolas de fuego del jugador contra enemigos
  for (const fb of gs.fbs) {
    const fbL = fb.x - 8, fbR = fb.x + 8, fbT = fb.y - 8, fbB = fb.y + 8;
    for (const e of gs.ens) {
      if (!e.alive) continue;
      const eL = e.x, eR = e.x + e.w, eT = e.y, eB = e.y + e.h;
      if (fbR <= eL || fbL >= eR || fbB <= eT || fbT >= eB) continue;
      fb.life = 0;
      killEnemy(gs, e, 200, '#ff7043', ['#ff7043', '#ffca28', '#fff']);
      break;
    }
  }

  // Enemies
  for (const e of gs.ens) {
    if (!e.alive) continue;
    const eL = e.x, eR = e.x + e.w, eT = e.y, eB = e.y + e.h;
    if (pR <= eL || pL >= eR || pB <= eT || pT >= eB) continue;

    // Power-up estrella: destruye cualquier enemigo al tocarlo
    if (gs.starPowerT > 0) {
      killEnemy(gs, e, 300, '#fff', parts);
      continue;
    }
    if (gs.invT > 0) continue;

    // espin no se puede pisar — las púas siempre dañan
    if (e.type === 'espin') {
      if (hasAbility(gs, ABILITY_IDS.SPIKE_IMMUNE)) { continue; }   // Clásico: inmune
      loseLife(gs); return;
    }
    // Stomp: jugador cayendo, base cerca del tope del enemigo
    if (gs.pvy > 0 && pB < eT + e.h * 0.45) {
      e.alive = false;
      e.stompT = 0.5;
      gs.pvy = -420;
      gs.comboN = gs.comboT > 0 ? gs.comboN + 1 : 1;
      gs.comboT = 0.7;
      const pts = 200 * gs.comboN;
      gs.score += pts;
      gs.flashT = 0.06; gs.flashCol = '#ff9800';
      gs.hitStop = 0.05;
      if (gs.comboN > 1) { sfxCombo(gs.comboN); gs.msg = `COMBO x${gs.comboN}  +${pts}`; }
      else { sfxStomp(); gs.msg = `+${pts}`; }
      gs.msgT = 0.8;
      spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, '#f97316', 8, parts);
    } else {
      loseLife(gs);
      return;
    }
  }

  // Coins
  for (const c of gs.cns) {
    if (c.got) continue;
    const bob = Math.sin(gs.elapsed * 3 + c.x * 0.01) * 4;
    const cr = 10;
    if (pR > c.x - cr && pL < c.x + cr && pB > c.y + bob - cr && pT < c.y + bob + cr) {
      c.got = true;
      gs.score += 100;
      gs.coins++;
      gs.lvlCoins++;
      sfxCoin();
      spawnParticles(gs, c.x, c.y, '#ffd700', 6, parts);
      gs.msg = '+100'; gs.msgT = 0.6;
    }
  }

  // Moneda especial → power-up estrella
  if (gs.starCoin && !gs.starCoin.got) {
    const sc = gs.starCoin;
    const bob = Math.sin(gs.elapsed * 3) * 4;
    if (pR > sc.x - 14 && pL < sc.x + 14 && pB > sc.y + bob - 14 && pT < sc.y + bob + 14) {
      sc.got = true;
      gs.starPowerT = 6;
      gs.score += 250;
      sfxPower();
      spawnParticles(gs, sc.x, sc.y, '#fff', 16, ['#ff1744', '#ff9800', '#ffeb3b', '#00e676', '#2979ff', '#d500f9']);
      gs.msg = '¡INVENCIBLE!'; gs.msgT = 1.2;
    }
  }

  // Spikes
  if (gs.invT <= 0 && !hasAbility(gs, ABILITY_IDS.SPIKE_IMMUNE)) {
    for (const sp of gs.sps) {
      const spT = sp.y - 18, spB = sp.y;
      if (pR > sp.x && pL < sp.x + sp.w && pB > spT && pT < spB) {
        loseLife(gs);
        return;
      }
    }
  }

  // Projectiles (plant seeds)
  if (gs.invT <= 0) {
    for (const pr of gs.projs) {
      if (pR > pr.x - 6 && pL < pr.x + 6 && pB > pr.y - 6 && pT < pr.y + 6) {
        pr.life = 0; // destroy seed
        loseLife(gs);
        return;
      }
    }
  }

  // Checkpoints
  while (gs.nextCk < gs.ckList.length && gs.px + PW / 2 > gs.ckList[gs.nextCk]) {
    gs.ckX = gs.ckList[gs.nextCk];
    gs.ckY = gs.onG ? gs.py : spawnFeetY(gs, gs.ckList[gs.nextCk]) - PH;
    gs.nextCk++;
    spawnParticles(gs, gs.ckX, gs.gY - 50, '#00e676', 8);
    gs.msg = '¡Punto de control!'; gs.msgT = 1.2;
  }

  // Goal
  if (gs.px + PW > gs.gX) {
    const pct = gs.totalLvlCoins > 0 ? gs.lvlCoins / gs.totalLvlCoins : 0;
    const earned = pct >= 0.9 ? 3 : pct >= 0.5 ? 2 : 1;
    gs.stars[gs.lv] = Math.max(gs.stars[gs.lv], earned);
    gs.phase = 'lvlDone';
    gs.phT = 2.5;
    gs.score += 500;
    sfxLevel();
    spawnParticles(gs, gs.gX, gs.gY - 40, '#69f0ae', 16);
    writeSave(gs);
  }

  // Fall off — caer al vacío siempre mata (ignora invencibilidad, power-up y escudo)
  if (gs.py > ch + 80) {
    gs.invT = 0; gs.starPowerT = 0;
    loseLife(gs, true);
  }
}
