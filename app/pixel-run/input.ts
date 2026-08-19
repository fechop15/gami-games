// ── Regiones de toque/hit (compartidas entre render y handlers) y entrada ──────
import type { GS, Rect } from './types';

export function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// ── Hit regions de UI / menús ─────────────────────────────────────────────────
export function pauseBtnRect(cw: number): Rect { return { x: cw - 46, y: 11, w: 34, h: 34 }; }
export function shopBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 115, y: ch * 0.895, w: 230, h: 48 }; }
export function backBtnRect(): Rect { return { x: 18, y: 16, w: 96, h: 40 }; }
export function liveBuyBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 90, y: ch * 0.225, w: 180, h: 40 }; }
export function skinCardRect(cw: number, ch: number, i: number): Rect {
  const cardW = Math.min(190, cw * 0.42), cardH = 148, gapX = 18, gapY = 18;
  const x0 = cw / 2 - (2 * cardW + gapX) / 2;
  const col = i % 2, row = Math.floor(i / 2);
  return { x: x0 + col * (cardW + gapX), y: ch * 0.305 + row * (cardH + gapY), w: cardW, h: cardH };
}
export function resumeBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 110, y: ch * 0.46, w: 220, h: 52 }; }
export function menuBtnRect(cw: number, ch: number): Rect { return { x: cw / 2 - 110, y: ch * 0.58, w: 220, h: 52 }; }

// ── Botones de control táctil (móvil) ─────────────────────────────────────────
function btnSize(cw: number): number { return Math.max(58, Math.min(84, cw * 0.17)); }
function btnY(ch: number, s: number): number { return ch - s - 28; }
export function leftBtnRect(cw: number, ch: number): Rect { const s = btnSize(cw); return { x: 16, y: btnY(ch, s), w: s, h: s }; }
export function rightBtnRect(cw: number, ch: number): Rect { const s = btnSize(cw); return { x: 16 + s + 10, y: btnY(ch, s), w: s, h: s }; }
export function jumpBtnRect(cw: number, ch: number): Rect {
  const s = btnSize(cw);
  const js = Math.min(cw * 0.38, s * 1.8);
  return { x: cw - js - 16, y: ch - js - 28, w: js, h: js };
}
export function fireBtnRect(cw: number, ch: number): Rect {
  const s = btnSize(cw);
  const fs = Math.min(cw * 0.24, s * 1.1);
  const j = jumpBtnRect(cw, ch);
  return { x: j.x - fs - 14, y: ch - fs - 28, w: fs, h: fs };
}

// Deriva la entrada direccional desde los toques activos (los botones latchean)
export function deriveInput(gs: GS) {
  for (const [, td] of gs.tMap) {
    if (td.btn === 'L') gs.inp.L = true;
    else if (td.btn === 'R') gs.inp.R = true;
  }
}
