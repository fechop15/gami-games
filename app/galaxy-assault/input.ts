// Input: joystick floating + tap para elegir objetivo + botón disparo + barra de munición.
import type { GS } from "./core/types"
import {
  W, H, JOY_RADIUS, JOY_ZONE_X, MUTE_BTN, MINIMAP_BTN, FIRE_BTN, REPAIR_BTN,
  AMMO_SQUARE, AMMO_GAP, AMMO_COUNT, AMMO_BAR_Y, CONFIG, inRect,
} from "./core/constants"
import { startRun, saveProgress } from "./engine"
import { repairShip, enemyAtScreen, setTarget } from "./engine/combat"
import { joystickInput } from "./engine/player"
import { AMMO_ORDER, weaponDef } from "./data/ammo"
import { toggleMute, unlockAudio, sfx } from "../lib/sound"

// ── Roles por dedo (multitouch) ──
type Role = "joystick" | "fire" | "tap" | "none"
const touchRole = new Map<number, Role>()
const tapStart = new Map<number, { x: number; y: number }>()

// Cuadro de munición presionado (para el globo de nombre en el HUD)
let pressedAmmo = -1
let pressedAmmoTouchId: number | null = null

export function getPressedAmmo(): number {
  return pressedAmmo
}

function clearPressedAmmo(): void {
  pressedAmmo = -1
  pressedAmmoTouchId = null
}

export function onTouchStart(gs: GS, id: number, x: number, y: number): void {
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

  // Barra rápida de munición (cuadros abajo-centro)
  const ammoIdx = ammoSquareAt(x, y)
  if (ammoIdx !== -1) {
    gs.activeWeapon = AMMO_ORDER[ammoIdx]
    pressedAmmo = ammoIdx
    pressedAmmoTouchId = id
    sfx.click()
    return
  }

  // Botón de disparo (mantener)
  if (inRect(FIRE_BTN, x, y)) {
    gs.firing = true
    touchRole.set(id, "fire")
    return
  }

  // Robot de reparación
  if (inRect(REPAIR_BTN, x, y)) {
    repairShip(gs)
    saveProgress(gs)
    return
  }

  // Abrir menú de base
  if (gs.inSafeZone && gs.phase === "playing" && baseBtn(gs, x, y)) {
    gs.phase = "base-menu"
    gs.baseMenuOpen = true
    sfx.click()
    return
  }

  // Zonas muertas del HUD: no joystick
  if (isUiDeadZone(x, y)) return

  // Joystick solo en la zona izquierda; en la derecha un tap selecciona objetivo (sin joystick)
  if (!touchRole.has(id)) {
    if (x < JOY_ZONE_X) {
      touchRole.set(id, "joystick")
      tapStart.set(id, { x, y })
      gs.joystick.active = true
      gs.joystick.baseX = x
      gs.joystick.baseY = y
      gs.joystick.dx = 0
      gs.joystick.dy = 0
      joystickInput(gs, 0, 0)
    } else {
      touchRole.set(id, "tap")
      tapStart.set(id, { x, y })
    }
  }
}

export function onTouchMove(gs: GS, id: number, x: number, y: number): void {
  const role = touchRole.get(id)
  if (role !== "joystick") {
    // Si un tap se convierte en arrastre, se cancela (no seleccionar por error)
    if (role === "tap") {
      const start = tapStart.get(id)
      if (start && (Math.abs(x - start.x) > 14 || Math.abs(y - start.y) > 14)) {
        tapStart.delete(id)
      }
    }
    return
  }
  const start = tapStart.get(id)
  if (start && (Math.abs(x - start.x) > 12 || Math.abs(y - start.y) > 12)) {
    tapStart.delete(id) // es arrastre, no tap
  }
  const dx = x - gs.joystick.baseX
  const dy = y - gs.joystick.baseY
  const mag = Math.hypot(dx, dy)
  if (mag > JOY_RADIUS) {
    const nx = dx / mag
    const ny = dy / mag
    joystickInput(gs, nx * JOY_RADIUS, ny * JOY_RADIUS)
  } else {
    joystickInput(gs, dx, dy)
  }
}

export function onTouchEnd(gs: GS, id: number, x: number, y: number): void {
  const role = touchRole.get(id)
  touchRole.delete(id)

  // Soltar el dedo del cuadro de munición → ocultar el globo de nombre
  if (pressedAmmoTouchId === id) clearPressedAmmo()

  if (role === "fire") {
    gs.firing = false
    tapStart.delete(id)
    return
  }

  if (role === "tap") {
    // Tap en la zona derecha: elegir o soltar objetivo (sin joystick)
    const start = tapStart.get(id)
    tapStart.delete(id)
    if (start && Math.abs(x - start.x) <= 14 && Math.abs(y - start.y) <= 14) {
      const target = enemyAtScreen(gs, x, y, 70)
      setTarget(gs, target)
      if (target) {
        sfx.click()
        gs.flashMsg = "Objetivo marcado · 🔫 para disparar"
        gs.flashT = 1.4
      } else {
        setTarget(gs, null)
      }
    }
  }

  if (role === "joystick") {
    // Leer el punto de inicio ANTES de borrarlo (para detectar tap vs arrastre)
    const start = tapStart.get(id)
    tapStart.delete(id)
    // Si fue un tap (sin arrastre): elegir o soltar objetivo
    if (start && Math.abs(x - start.x) <= 14 && Math.abs(y - start.y) <= 14) {
      const target = enemyAtScreen(gs, x, y, 70)
      setTarget(gs, target)
      if (target) {
        sfx.click()
        gs.flashMsg = "Objetivo marcado · 🔫 para disparar"
        gs.flashT = 1.4
      } else {
        setTarget(gs, null)
      }
    }
    gs.joystick.active = false
    gs.joystick.dx = 0
    gs.joystick.dy = 0
    if ([...touchRole.values()].includes("joystick")) gs.joystick.active = true
  }

  if (touchRole.size === 0) gs.isTouching = false
}

export function resetTouch(): void {
  touchRole.clear()
  tapStart.clear()
  clearPressedAmmo()
}

// Zonas de UI donde el toque NO inicia el joystick (HUD)
function isUiDeadZone(x: number, y: number): boolean {
  if (inRect(REPAIR_BTN, x, y)) return true
  if (inRect(FIRE_BTN, x, y)) return true
  // Panel del minimapa (arriba-izquierda)
  const mm = CONFIG.minimap
  if (x >= mm.offsetX && x <= mm.offsetX + mm.size && y >= mm.offsetY && y <= mm.offsetY + mm.size) return true
  // Barra de munición
  const ammoStart = W / 2 - (AMMO_COUNT * AMMO_SQUARE + (AMMO_COUNT - 1) * AMMO_GAP) / 2
  if (x >= ammoStart && x <= ammoStart + AMMO_COUNT * AMMO_SQUARE + (AMMO_COUNT - 1) * AMMO_GAP
      && y >= AMMO_BAR_Y && y <= AMMO_BAR_Y + AMMO_SQUARE) return true
  return false
}

function ammoSquareAt(x: number, y: number): number {
  if (y < AMMO_BAR_Y || y > AMMO_BAR_Y + AMMO_SQUARE) return -1
  const total = AMMO_COUNT * AMMO_SQUARE + (AMMO_COUNT - 1) * AMMO_GAP
  const start = W / 2 - total / 2
  for (let i = 0; i < AMMO_COUNT; i++) {
    const sx = start + i * (AMMO_SQUARE + AMMO_GAP)
    if (x >= sx && x <= sx + AMMO_SQUARE) return i
  }
  return -1
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
  void gs
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