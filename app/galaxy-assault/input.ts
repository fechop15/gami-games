// Input: joystick dinámico (mitad izquierda), botones del HUD, cambio de arma, teclado.
import type { GS } from "./core/types"
import {
  W, H, JOY_RADIUS, MUTE_BTN, MINIMAP_BTN, WEAPON_BTN, REPAIR_BTN, inRect,
} from "./core/constants"
import { startRun, saveProgress } from "./engine"
import { repairShip } from "./engine/combat"
import { joystickInput } from "./engine/player"
import { AMMO_ORDER, weaponDef } from "./data/ammo"
import { toggleMute, unlockAudio, sfx } from "../lib/sound"

export function onTouchStart(gs: GS, x: number, y: number): void {
  unlockAudio()
  gs.isTouching = true

  // Botón de silencio — prioridad máxima, siempre activo
  if (inRect(MUTE_BTN, x, y)) { toggleMute(); return }

  if (gs.phase === "loading") return

  if (gs.phase === "intro") {
    for (const b of gs.btns) {
      if (inRect(b, x, y)) {
        sfx.click()
        startRun(gs)
        saveProgress(gs)
        return
      }
    }
    return
  }

  if (gs.phase === "base-menu") {
    // Cualquier botón del menú
    for (const b of gs.btns) {
      if (inRect(b, x, y)) {
        sfx.click()
        gs.phase = "playing"
        gs.baseMenuOpen = false
        saveProgress(gs)
        return
      }
    }
    return
  }

  if (gs.phase !== "playing" && gs.phase !== "dead") return

  // Botón de minimapa
  if (inRect(MINIMAP_BTN, x, y)) { gs.minimapHidden = !gs.minimapHidden; sfx.click(); return }

  // Cambiar arma
  if (inRect(WEAPON_BTN, x, y)) {
    cycleWeapon(gs)
    return
  }

  // Robot de reparación
  if (inRect(REPAIR_BTN, x, y)) {
    repairShip(gs)
    saveProgress(gs)
    return
  }

  // Abrir menú de base (solo dentro de zona segura)
  if (gs.inSafeZone && gs.phase === "playing") {
    // Botón de base flotante
    if (baseBtn(gs, x, y)) {
      gs.phase = "base-menu"
      gs.baseMenuOpen = true
      sfx.click()
      return
    }
  }

  // Joystick: mitad izquierda de la pantalla
  if (x < W * 0.55) {
    gs.joystick.active = true
    gs.joystick.baseX = x
    gs.joystick.baseY = y
    gs.joystick.dx = 0
    gs.joystick.dy = 0
    onTouchMove(gs, x, y)
  }
}

export function onTouchMove(gs: GS, x: number, y: number): void {
  if (!gs.joystick.active) return
  const dx = x - gs.joystick.baseX
  const dy = y - gs.joystick.baseY
  // Clamp al radio del joystick
  const mag = Math.hypot(dx, dy)
  if (mag > JOY_RADIUS) {
    const nx = dx / mag
    const ny = dy / mag
    joystickInput(gs, nx * JOY_RADIUS, ny * JOY_RADIUS)
  } else {
    joystickInput(gs, dx, dy)
  }
}

export function onTouchEnd(gs: GS): void {
  gs.isTouching = false
  gs.joystick.active = false
  gs.joystick.dx = 0
  gs.joystick.dy = 0
}

export function cycleWeapon(gs: GS): void {
  const idx = AMMO_ORDER.indexOf(gs.activeWeapon)
  const next = (idx + 1) % AMMO_ORDER.length
  gs.activeWeapon = AMMO_ORDER[next]
  const w = weaponDef(gs.activeWeapon)
  gs.flashMsg = w.name + (gs.ammo[gs.activeWeapon] <= 0 ? " (sin munición)" : "")
  gs.flashT = 1.2
  sfx.click()
}

export function onKeyDown(gs: GS, e: KeyboardEvent): void {
  if (e.key >= "1" && e.key <= "5") {
    const idx = parseInt(e.key, 10) - 1
    if (idx < AMMO_ORDER.length) {
      gs.activeWeapon = AMMO_ORDER[idx]
      const w = weaponDef(gs.activeWeapon)
      gs.flashMsg = w.name
      gs.flashT = 1.2
      sfx.click()
    }
  }
  if (e.key === "r" || e.key === "R") {
    repairShip(gs)
    saveProgress(gs)
  }
  if (e.key === "m" || e.key === "M") {
    gs.minimapHidden = !gs.minimapHidden
  }
  if (e.key === " " || e.key === "Enter") {
    if (gs.phase === "intro") {
      startRun(gs)
      saveProgress(gs)
    }
  }
  if (e.key === "b" || e.key === "B") {
    if (gs.inSafeZone && gs.phase === "playing") {
      gs.phase = "base-menu"
      gs.baseMenuOpen = true
    }
  }
  if (e.key === "Escape" && gs.phase === "base-menu") {
    gs.phase = "playing"
    gs.baseMenuOpen = false
  }
}

function baseBtn(gs: GS, x: number, y: number): boolean {
  // Botón "⚓ BASE" cuando se está dentro de zona segura
  const bw = 140
  const bh = 44
  return x >= W / 2 - bw / 2 && x <= W / 2 + bw / 2 && y >= H - 120 && y <= H - 120 + bh
}

export function drawBaseButton(ctx: CanvasRenderingContext2D, gs: GS): void {
  if (!gs.inSafeZone || gs.phase !== "playing") return
  const bw = 140
  const bh = 44
  const x = W / 2 - bw / 2
  const y = H - 120
  ctx.save()
  ctx.shadowColor = "rgba(124,255,90,0.6)"
  ctx.shadowBlur = 14
  ctx.fillStyle = "#1a5c2a"
  ctx.beginPath()
  ctx.roundRect(x, y, bw, bh, 22)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = "#7CFF5A"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, bw, bh, 22)
  ctx.stroke()
  ctx.fillStyle = "#ffffff"
  ctx.font = "800 16px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("⚓ BASE", x + bw / 2, y + bh / 2 + 1)
  ctx.textBaseline = "alphabetic"
}