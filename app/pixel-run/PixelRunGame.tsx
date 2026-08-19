'use client';
import { useEffect, useRef } from 'react';
// Config y tipos
import type { GS, TD } from './types';
import {
  GRAV, JMP_V, WALK_V, RUN_V, PW, PH, CAM_LEAD, CAM_LERP,
  LIFE_COST, MAX_LIVES, DBL_MS, RUN_DUR, SKINS, hasAbility, ABILITY_IDS,
} from './config';
// Lógica por dominio
import { initWorldDefs } from './levels';
import { initGS, loadLevel, respawn } from './state';
import { updateMovingPlatforms, resolvePlatformsX, resolvePlatformsY, reflowWorld } from './physics';
import { updateEnemies, updateFireballs, checkEntities } from './entities';
import { updateParticles, addParticle } from './particles';
import { writeSave } from './save';
import { sfxStep, sfxJump, sfxStomp, sfxBuy } from './audio';
import { deriveInput, inRect, pauseBtnRect, shopBtnRect, backBtnRect, liveBuyBtnRect, skinCardRect, resumeBtnRect, menuBtnRect, jumpBtnRect, fireBtnRect, leftBtnRect, rightBtnRect } from './input';
import { render } from './render';

// ── Bucle de juego (física + entidades + cámara) ──────────────────────────────
function update(gs: GS, dt: number, cw: number, ch: number) {
  gs.elapsed += dt;
  gs.msgT = Math.max(0, gs.msgT - dt);
  gs.phT = Math.max(0, gs.phT - dt);
  gs.shopMsgT = Math.max(0, gs.shopMsgT - dt);
  gs.comboT = Math.max(0, gs.comboT - dt);
  if (gs.comboT <= 0) gs.comboN = 0;
  gs.starPowerT = Math.max(0, gs.starPowerT - dt);

  if (gs.phase === 'intro' || gs.phase === 'gameOver' || gs.phase === 'win'
    || gs.phase === 'shop' || gs.phase === 'transition') return;

  if (gs.phase === 'lvlDone') {
    updateParticles(gs, dt);
    return;
  }

  if (gs.phase === 'dead') {
    gs.py += gs.pvy * dt;
    gs.pvy = Math.min(gs.pvy + GRAV * dt, 900);
    updateParticles(gs, dt);
    if (gs.phT <= 0) respawn(gs);
    return;
  }

  // === PLAYING ===
  deriveInput(gs);

  if (gs.entryLock) {
    gs.inp.L = false; gs.inp.R = false; gs.inp.J = false; gs.inp.F = false;
  }

  const speed = gs.runT > 0 ? RUN_V : WALK_V;

  // Horizontal velocity
  if (gs.inp.L) { gs.pvx = -speed; gs.fR = false; }
  else if (gs.inp.R) { gs.pvx = speed; gs.fR = true; }
  else { gs.pvx *= gs.onG ? 0.60 : 0.90; if (Math.abs(gs.pvx) < 5) gs.pvx = 0; }

  // Gravity (Astronauta: caída suave → desciende más lento)
  const maxFallV = hasAbility(gs, ABILITY_IDS.SOFT_LAND) ? 330 : 900;
  gs.pvy = Math.min(gs.pvy + GRAV * dt, maxFallV);

  // Jump (con salto doble del Ninja)
  if (gs.inp.J) {
    const canJump = gs.onG || gs.coyT > 0;
    if (canJump) {
      gs.pvy = JMP_V * gs.jumpStrength;
      gs.onG = false;
      gs.coyT = 0;
      gs.jumpsLeft = hasAbility(gs, ABILITY_IDS.DOUBLE_JUMP) ? 1 : 0;
      gs.sqT = 0.12; gs.sqDir = 1;
      sfxJump();
    } else if (gs.jumpsLeft > 0) {
      gs.pvy = JMP_V * 0.92;
      gs.jumpsLeft--;
      gs.sqT = 0.12; gs.sqDir = 1;
      sfxJump();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (Math.random() - 0.5) * Math.PI;
        const spd = 50 + Math.random() * 80;
        addParticle(gs, gs.px + PW / 2, gs.py + PH,
          Math.cos(a) * spd, -Math.random() * 60, 0.3 + Math.random() * 0.2, '#cfd8dc', 2 + Math.random() * 2, 0.5);
      }
    }
    gs.inp.J = false;
    gs.jumpStrength = 1;
  }

  // Salto variable por teclado
  if (gs.pvy < 0 && !gs.jumpHeld && !gs.touchJump) {
    gs.pvy = Math.max(gs.pvy, JMP_V * 0.35);
  }
  if (gs.onG) gs.touchJump = false;

  // Bolas de fuego (Pirata)
  gs.fbCd = Math.max(0, gs.fbCd - dt);
  if (gs.inp.F && hasAbility(gs, ABILITY_IDS.FIREBALL) && gs.fbCd <= 0) {
    gs.fbCd = 0.3;
    gs.fbs.push({ x: gs.px + (gs.fR ? PW : -4), y: gs.py + PH * 0.35, vx: gs.fR ? 540 : -540, life: 1.2 });
    sfxStomp();
  }
  gs.inp.F = false;

  // Timers
  gs.onG = false;
  gs.coyT = Math.max(0, gs.coyT - dt);
  gs.runT = Math.max(0, gs.runT - dt);
  gs.invT = Math.max(0, gs.invT - dt);

  // Física
  updateMovingPlatforms(gs, dt);

  gs.px += gs.pvx * dt;
  gs.px = Math.max(0, gs.px);
  resolvePlatformsX(gs);

  gs.py += gs.pvy * dt;
  resolvePlatformsY(gs, dt);

  // Squash al aterrizar + recupera el salto doble
  if (!gs.prevOnG && gs.onG) {
    gs.sqT = 0.14; gs.sqDir = -1;
    gs.jumpsLeft = hasAbility(gs, ABILITY_IDS.DOUBLE_JUMP) ? 1 : 0;
  }
  gs.prevOnG = gs.onG;
  gs.sqT = Math.max(0, gs.sqT - dt);

  // Fin de la animación de entrada
  if (gs.entryLock) {
    gs.entryT = Math.max(0, gs.entryT - dt);
    if (gs.onG || gs.entryT <= 0) {
      gs.entryLock = false;
      for (let i = 0; i < 10; i++) {
        const a = Math.PI + (Math.random() - 0.5) * Math.PI;
        const spd = 60 + Math.random() * 100;
        addParticle(gs, gs.px + PW / 2, gs.py + PH,
          Math.cos(a) * spd, -Math.random() * 80, 0.4 + Math.random() * 0.3, 'rgba(180,150,110,0.8)', 3 + Math.random() * 3, 0.7);
      }
    }
  }
  if (!gs.entryLock && gs.btnFade > 0) {
    gs.btnFade = Math.max(0, gs.btnFade - dt * 0.5);
  }

  // Entidades y proyectiles
  updateFireballs(gs, dt);
  checkEntities(gs, cw, ch);
  updateEnemies(gs, dt);
  updateParticles(gs, dt);

  // Cámara
  const targetCamX = gs.px - cw * CAM_LEAD;
  gs.camX += (targetCamX - gs.camX) * CAM_LERP;
  gs.camX = Math.max(0, Math.min(gs.lW - cw, gs.camX));

  // Animación del jugador + sonido de pasos
  if (gs.phase === 'playing') {
    if (gs.onG) gs.ps = Math.abs(gs.pvx) > 20 ? 'run' : 'idle';
    else gs.ps = gs.pvy < 0 ? 'jump' : 'fall';

    gs.aft += dt;
    if (gs.ps === 'run' && gs.aft > 0.12) { gs.afr = 1 - gs.afr; gs.aft = 0; }
    if (gs.ps !== 'run') gs.aft = 0;

    if (gs.onG && Math.abs(gs.pvx) > 20) {
      gs.stepT -= dt;
      if (gs.stepT <= 0) {
        sfxStep();
        gs.stepT = gs.runT > 0 ? 0.14 : 0.22;
      }
    } else {
      gs.stepT = 0;
    }
  }
}

// ── Componente React: canvas + bucle + input ──────────────────────────────────
export default function PixelRunGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    let gsRef: GS | null = null;

    const resize = () => {
      const newW = canvas.clientWidth || window.innerWidth;
      const newH = canvas.clientHeight || window.innerHeight;
      canvas.width = newW;
      canvas.height = newH;
      if (gsRef) reflowWorld(gsRef, newH, newW);
    };
    resize();
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pantalla de carga
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Cargando…', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';

    let rafId = 0;
    let alive = true;
    let cleanupHandlers: (() => void) | null = null;
    let lastTouchTap = 0;

    initWorldDefs().then(() => {
      if (!alive) return;

      const gs = initGS(canvas.width, canvas.height);
      gsRef = gs;

      // ── Navegación de fases (compartida por touch/click/teclado) ──────────
      const startLevel = (lv: number) => { loadLevel(gs, lv, canvas.height); gs.phase = 'playing'; gs.paused = false; };
      const beginTransition = (toLv: number) => { gs.phase = 'transition'; gs.transT = 0.9; gs.transToLv = toLv; };
      const resetToIntro = () => {
        writeSave(gs);
        gs.lives = 3 + gs.extras; gs.score = 0; gs.paused = false;
        gs.shield = 1;
        gs.gY = canvas.height - 70; gs.phase = 'intro';
      };
      const buyOrEquip = (i: number) => {
        if (gs.owned.includes(i)) {
          gs.skin = i; writeSave(gs);
          gs.shopMsg = `${SKINS[i].name} equipado`; gs.shopMsgT = 2;
        } else if (gs.coins >= SKINS[i].price) {
          gs.coins -= SKINS[i].price; gs.owned.push(i); gs.skin = i; writeSave(gs);
          sfxBuy();
          gs.shopMsg = `¡${SKINS[i].name} desbloqueado!`; gs.shopMsgT = 2.5;
        } else {
          gs.shopMsg = 'Monedas insuficientes'; gs.shopMsgT = 2;
        }
      };
      const handleTap = (x: number, y: number) => {
        const cw = canvas.width, ch = canvas.height;
        if (gs.paused) {
          if (inRect(x, y, resumeBtnRect(cw, ch))) gs.paused = false;
          else if (inRect(x, y, menuBtnRect(cw, ch))) resetToIntro();
          return;
        }
        if (gs.phase === 'intro') {
          if (inRect(x, y, shopBtnRect(cw, ch))) { gs.phase = 'shop'; return; }
          startLevel(0);
        } else if (gs.phase === 'shop') {
          if (inRect(x, y, backBtnRect())) { writeSave(gs); gs.phase = 'intro'; return; }
          if (inRect(x, y, liveBuyBtnRect(cw, ch))) {
            const extrasMax = MAX_LIVES - 3;
            if (gs.extras < extrasMax && gs.coins >= LIFE_COST) {
              gs.coins -= LIFE_COST; gs.extras++; gs.lives = 3 + gs.extras; writeSave(gs);
              sfxBuy(); gs.shopMsg = `♥ +1 vida (${gs.lives}/${MAX_LIVES})`; gs.shopMsgT = 2;
            } else if (gs.extras >= extrasMax) {
              gs.shopMsg = 'Ya tenés el máximo de vidas'; gs.shopMsgT = 2;
            } else {
              gs.shopMsg = 'Monedas insuficientes'; gs.shopMsgT = 2;
            }
            return;
          }
          for (let i = 0; i < SKINS.length; i++) {
            if (inRect(x, y, skinCardRect(cw, ch, i))) { buyOrEquip(i); return; }
          }
        } else if (gs.phase === 'playing') {
          if (inRect(x, y, pauseBtnRect(cw))) gs.paused = true;
        } else if (gs.phase === 'lvlDone') {
          const next = gs.lv + 1;
          if (next >= 7) { writeSave(gs); gs.phase = 'win'; }
          else beginTransition(next);
        } else if (gs.phase === 'gameOver' || gs.phase === 'win') {
          resetToIntro();
        }
      };

      // ── Touch ─────────────────────────────────────────────────────────────
      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const cw = canvas.width, ch = canvas.height;
        for (const touch of Array.from(e.changedTouches)) {
          const td: TD = { sx: touch.clientX, sy: touch.clientY, cx: touch.clientX, cy: touch.clientY, t: Date.now() };
          gs.tMap.set(touch.identifier, td);

          if (hasAbility(gs, ABILITY_IDS.FIREBALL) && inRect(touch.clientX, touch.clientY, fireBtnRect(cw, ch))) {
            td.btn = 'fire';
            gs.inp.F = true;
            continue;
          }

          if (inRect(touch.clientX, touch.clientY, jumpBtnRect(cw, ch))) {
            td.btn = 'jump';
            gs.touchJump = true; gs.jumpStrength = 1; gs.inp.J = true;
            continue;
          }

          if (inRect(touch.clientX, touch.clientY, leftBtnRect(cw, ch))) td.btn = 'L';
          else if (inRect(touch.clientX, touch.clientY, rightBtnRect(cw, ch))) td.btn = 'R';

          const side = td.btn === 'L' ? 'L' : td.btn === 'R' ? 'R' : null;
          if (side) {
            const now = Date.now();
            if (now - gs.ltap[side] < DBL_MS) {
              gs.runT = RUN_DUR;
            }
            gs.ltap[side] = now;
          }
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
          const td = gs.tMap.get(touch.identifier);
          if (td) { td.cx = touch.clientX; td.cy = touch.clientY; }
        }
      };

      const releaseTouch = (touch: Touch) => {
        const td = gs.tMap.get(touch.identifier);
        if (td) {
          if (td.btn === 'jump') gs.touchJump = false;
          gs.tMap.delete(touch.identifier);
        }
      };

      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
          const td = gs.tMap.get(touch.identifier);
          if (td) {
            if (td.btn === 'jump') {
              gs.touchJump = false;
            } else {
              const dx = td.cx - td.sx;
              const dy = td.cy - td.sy;
              const elapsed = Date.now() - td.t;

              if (dy < -55 && Math.abs(dx) < 90 && elapsed < 400) {
                const mag = Math.min(1, (-dy) / 150);
                gs.jumpStrength = 0.62 + mag * 0.38;
                gs.inp.J = true;
                gs.touchJump = true;
              } else if (Math.abs(dx) < 30 && Math.abs(dy) < 30 && elapsed < 350) {
                lastTouchTap = Date.now();
                handleTap(td.sx, td.sy);
              }
            }
            gs.tMap.delete(touch.identifier);
          }
        }
      };

      const onTouchCancel = (e: TouchEvent) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) releaseTouch(touch);
      };

      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', onTouchCancel, { passive: false });

      // Click para desktop
      canvas.addEventListener('click', (e) => {
        if (Date.now() - lastTouchTap < 400) return;
        const r = canvas.getBoundingClientRect();
        handleTap(e.clientX - r.left, e.clientY - r.top);
      });

      // ── Teclado ───────────────────────────────────────────────────────────
      const keys = new Set<string>();

      const keyAdvance = () => {
        if (gs.paused) { gs.paused = false; return; }
        if (gs.phase === 'intro') startLevel(0);
        else if (gs.phase === 'shop') { writeSave(gs); gs.phase = 'intro'; }
        else if (gs.phase === 'lvlDone') {
          const next = gs.lv + 1;
          if (next >= 7) { writeSave(gs); gs.phase = 'win'; }
          else beginTransition(next);
        } else if (gs.phase === 'gameOver' || gs.phase === 'win') resetToIntro();
      };

      const GAME_KEYS = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
        'a','A','d','D','w','W',' ','Shift','Enter','Escape','p','P','x','X','f','F']);

      const onKeyDown = (e: KeyboardEvent) => {
        if (!GAME_KEYS.has(e.key)) return;
        e.preventDefault();
        const isRepeat = keys.has(e.key);
        keys.add(e.key);

        if (gs.phase === 'playing' && !gs.paused) {
          if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { gs.paused = true; return; }
          if (!isRepeat && (e.key === 'x' || e.key === 'X' || e.key === 'f' || e.key === 'F')) {
            gs.inp.F = true;
          }
          if (!isRepeat && (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W')) {
            gs.jumpStrength = 1; gs.inp.J = true;
          }
          return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') keyAdvance();
      };

      const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.key); };

      const syncKeyboard = () => {
        if (gs.phase !== 'playing' || gs.paused) { gs.jumpHeld = false; return; }
        gs.inp.L = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
        gs.inp.R = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
        gs.jumpHeld = keys.has('ArrowUp') || keys.has('w') || keys.has('W') || keys.has(' ');
        if (keys.has('Shift')) gs.runT = Math.max(gs.runT, 0.15);
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      cleanupHandlers = () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.removeEventListener('touchcancel', onTouchCancel);
      };

      // ── Bucle principal ───────────────────────────────────────────────────
      let lastT = 0;
      const loop = (t: number) => {
        const dt = Math.min((t - lastT) / 1000, 0.05);
        lastT = t;
        const cw = canvas.width, ch = canvas.height;

        gs.flashT = Math.max(0, gs.flashT - dt);

        if (gs.hitStop > 0) {
          gs.hitStop -= dt;
          render(ctx, gs, cw, ch);
          rafId = requestAnimationFrame(loop);
          return;
        }

        if (gs.paused) {
          render(ctx, gs, cw, ch);
          rafId = requestAnimationFrame(loop);
          return;
        }

        if (gs.phase === 'transition') {
          gs.transT -= dt;
          if (gs.transT <= 0.45 && gs.lv !== gs.transToLv) loadLevel(gs, gs.transToLv, ch);
          if (gs.transT <= 0) gs.phase = 'playing';
          render(ctx, gs, cw, ch);
          rafId = requestAnimationFrame(loop);
          return;
        }

        // Reset input direccional cada frame
        gs.inp.L = false;
        gs.inp.R = false;
        syncKeyboard();
        update(gs, dt, cw, ch);
        render(ctx, gs, cw, ch);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame((t) => { lastT = t; rafId = requestAnimationFrame(loop); });
    });

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      cleanupHandlers?.();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        overflow: 'hidden',
        background: '#000',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', userSelect: 'none', background: '#000' }}
      />
    </div>
  );
}
