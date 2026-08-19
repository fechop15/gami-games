// ── Estado del juego: creación, carga de nivel, respawn y pérdida de vida ──────
import type { GS, Theme } from './types';
import { PW, PH, hasAbility, ABILITY_IDS } from './config';
import { loadSave, writeSave, applyDailyStreak } from './save';
import { spawnParticles } from './particles';
import { spawnFeetY } from './physics';
import { sfxPower, sfxDie } from './audio';
import { buildLevelFromDef, WORLD_DEFS } from './levels';

// Crear estado inicial a partir del guardado persistente
export function initGS(cw: number, ch: number): GS {
  const gY = ch - 70;
  const sv = loadSave();
  const gs: GS = {
    phase: 'intro', lv: 0, lives: 3 + sv.extras, score: 0, coins: sv.coins, elapsed: 0,
    px: 80, py: gY - PH, pvx: 0, pvy: 0, onG: false, fR: true,
    ps: 'idle', afr: 0, aft: 0,
    invT: 0, coyT: 0, jBuf: 0,
    plats: [], ens: [], cns: [], sps: [],
    gX: 0, lW: 0, theme: 'green', gY,
    camX: 0, parts: [], projs: [],
    inp: { L: false, R: false, J: false, F: false },
    runT: 0, ltap: { L: 0, R: 0 },
    tMap: new Map(),
    phT: 0, msg: '', msgT: 0,
    startX: 80,
    ckX: 80, ckY: gY - PH, ckList: [], nextCk: 0,
    sqT: 0, sqDir: 0, prevOnG: false, stepT: 0,
    lvlCoins: 0, totalLvlCoins: 0,
    stars: Array.from({ length: 7 }, (_, i) => sv.stars[i] ?? 0),
    hitStop: 0, flashT: 0, flashCol: '#fff',
    comboT: 0, comboN: 0,
    starPowerT: 0, starCoin: null,
    entryT: 0, entryLock: false,
    paused: false,
    transT: 0, transToLv: 0,
    jumpStrength: 1, jumpHeld: false, touchJump: false,
    btnFade: 1,
    owned: sv.owned, skin: sv.skin, streak: sv.streak, lastDay: sv.lastDay,
    extras: sv.extras,
    shopMsg: '', shopMsgT: 0,
    jumpsLeft: 0, fbCd: 0, fbs: [], shield: 1,
  };
  applyDailyStreak(gs);
  return gs;
}

// Carga un nivel completo (plataformas, enemigos, monedas, pinchos, estrella)
export function loadLevel(gs: GS, lv: number, ch: number) {
  const g = gs.gY;
  const def = WORLD_DEFS[Math.min(lv, WORLD_DEFS.length - 1)];
  const data = buildLevelFromDef(def, g);
  gs.lv = lv;
  gs.plats = data.plats;
  gs.ens = data.ens;
  gs.cns = data.cns;
  gs.sps = data.sps;
  gs.gX = data.gX;
  gs.lW = data.lW;
  gs.theme = data.theme as Theme;
  gs.startX = data.startX;
  gs.px = data.startX;
  gs.py = g - PH;
  gs.pvx = 0; gs.pvy = 0;
  gs.onG = false; gs.fR = true;
  gs.ps = 'idle'; gs.afr = 0; gs.aft = 0;
  gs.camX = 0;
  gs.parts = []; gs.projs = [];
  gs.invT = 0; gs.coyT = 0;
  gs.shield = 1;
  gs.fbs = []; gs.fbCd = 0;
  gs.jumpsLeft = hasAbility(gs, ABILITY_IDS.DOUBLE_JUMP) ? 1 : 0;
  gs.inp = { L: false, R: false, J: false, F: false };
  gs.runT = 0;
  gs.ckX = data.startX; gs.ckY = spawnFeetY(gs, data.startX) - PH; gs.ckList = data.checks; gs.nextCk = 0;
  gs.sqT = 0; gs.sqDir = 0; gs.prevOnG = false; gs.stepT = 0;
  gs.lvlCoins = 0; gs.totalLvlCoins = data.cns.length;
  gs.comboT = 0; gs.comboN = 0;
  gs.starPowerT = 0;
  gs.hitStop = 0; gs.flashT = 0;
  gs.py = g - PH - 260;
  gs.pvy = 0;
  gs.entryT = 1.4; gs.entryLock = true;
  gs.btnFade = 1;
  setupStarCoin(gs, data.cns, data.lW);
}

// La moneda más cercana al centro del nivel se vuelve la estrella especial
function setupStarCoin(gs: GS, cns: GS['cns'], lW: number) {
  gs.starCoin = null;
  if (cns.length === 0) return;
  const mid = lW / 2;
  let best = cns[0], bd = Infinity;
  for (const c of cns) { const d2 = Math.abs(c.x - mid); if (d2 < bd) { bd = d2; best = c; } }
  best.got = true;
  gs.totalLvlCoins = cns.length - 1;
  gs.starCoin = { x: best.x, y: best.y - 24, got: false };
}

// Respawnea en el último checkpoint, siempre sobre una plataforma segura
export function respawn(gs: GS) {
  gs.px = gs.ckX;
  gs.py = spawnFeetY(gs, gs.ckX) - PH;
  gs.pvx = 0; gs.pvy = 0;
  gs.onG = false; gs.fR = true;
  gs.ps = 'idle';
  gs.phase = 'playing';
  gs.camX = Math.max(0, gs.ckX - 180);
  gs.invT = 2.0;
  gs.sqT = 0;
}

// Pérdida de vida (con escudo por mundo y protección ante caer al vacío)
export function loseLife(gs: GS, noShield = false) {
  if (gs.invT > 0 || gs.starPowerT > 0) return;
  if (gs.shield > 0 && !noShield) {
    gs.shield = 0;
    gs.invT = 1.5;
    gs.flashT = 0.14; gs.flashCol = '#00e5ff';
    sfxPower();
    spawnParticles(gs, gs.px + PW / 2, gs.py + PH / 2, '#00e5ff', 14, ['#00e5ff', '#b3e5fc', '#fff']);
    gs.msg = '🛡 Escudo absorbido'; gs.msgT = 1.2;
    return;
  }
  gs.lives--;
  gs.invT = 2.0;
  gs.comboT = 0; gs.comboN = 0;
  gs.flashT = 0.14; gs.flashCol = '#fff';
  gs.hitStop = 0.09;
  sfxDie();
  spawnParticles(gs, gs.px + PW / 2, gs.py + PH / 2, '#e53935', 12);
  if (gs.lives <= 0) {
    writeSave(gs);
    gs.phase = 'gameOver';
  } else {
    gs.phase = 'dead';
    gs.phT = 1.5;
    gs.ps = 'dead';
    gs.pvy = -350;
  }
}
