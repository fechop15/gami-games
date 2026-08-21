// Input: joystick en pad fijo + tap para elegir objetivo + botón disparo + barra de munición.
import type { GS, HudPanelId } from "./core/types"
import {
  W, H, JOY_RADIUS, JOY_PAD_X, JOY_PAD_Y, JOY_PAD_SIZE, MUTE_BTN, MINIMAP_BTN, FIRE_BTN, EDIT_BTN,
  AMMO_SQUARE, AMMO_GAP, AMMO_COUNT, AMMO_BAR_Y, PANEL_HEADER_H, PANEL_MIN_BTN_W, CONFIG, AMMO_SHOP, inRect,
} from "./core/constants"
import { startRun, saveProgress, saveHudLayout } from "./engine"
import { enemyAtScreen, setTarget } from "./engine/combat"
import { joystickInput } from "./engine/player"
import { panelRect } from "./render/panels"
import { AMMO_ORDER, weaponDef, buyAmmo } from "./data/ammo"
import { toggleMute, unlockAudio, sfx } from "../lib/sound"

// ── Roles por dedo (multitouch) ──
type Role = "joystick" | "fire" | "tap" | "panel" | "none"
const touchRole = new Map<number, Role>()
const tapStart = new Map<number, { x: number; y: number }>()
const dragPanel: { id: HudPanelId | null; offX: number; offY: number } = { id: null, offX: 0, offY: 0 }

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

/** Rectángulo del pad del joystick (zona fija izquierda). */
export function joystickPadRect(): { x: number; y: number; w: number; h: number } {
  return { x: JOY_PAD_X, y: JOY_PAD_Y, w: JOY_PAD_SIZE, h: JOY_PAD_SIZE }
}

function inJoystickPad(x: number, y: number): boolean {
  const p = joystickPadRect()
  return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h
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
    // Botones de la tienda de munición (compra)
    for (const b of gs.shopBtns) {
      if (inRect(b, x, y)) {
        if (buyAmmo(gs, b.ammo)) {
          sfx.coin()
          gs.flashMsg = `+${AMMO_SHOP[b.ammo].amount} ${weaponDef(b.ammo).name}`
          gs.flashT = 1.4
          saveProgress(gs)
        } else {
          sfx.error()
          gs.flashMsg = "No tienes suficientes monedas"
          gs.flashT = 1.2
        }
        return
      }
    }
    // Botón salir
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

  // Botón de edición de paneles
  if (inRect(EDIT_BTN, x, y)) {
    gs.editMode = !gs.editMode
    sfx.click()
    if (!gs.editMode) saveHudLayout(gs)
    gs.flashMsg = gs.editMode ? "✏️ Arrastra los paneles · ✓ para guardar" : "Paneles guardados"
    gs.flashT = 1.6
    return
  }

  // Modo edición: interactuar con paneles
  if (gs.editMode) {
    const panel = panelAt(gs, x, y)
    if (panel) {
      const pid = panel.id
      if (panel.isMin) {
        gs.hud[pid].minimized = !gs.hud[pid].minimized
        sfx.click()
      } else if (panel.isOrient) {
        gs.hud[pid].orientation = gs.hud[pid].orientation === "vertical" ? "horizontal" : "vertical"
        sfx.click()
      } else {
        // Cabecera o cuerpo: arrastrar el panel
        touchRole.set(id, "panel")
        dragPanel.id = pid
        dragPanel.offX = x - gs.hud[pid].x
        dragPanel.offY = y - gs.hud[pid].y
      }
      return
    }
  }

  // Barra rápida de munición (cuadros abajo-centro)
  const ammoIdx = ammoSquareAt(x, y)
  if (ammoIdx !== -1) {
    const ammo = AMMO_ORDER[ammoIdx]
    if (ammo === "missile_a" || ammo === "missile_b") {
      // Selecciona el misil que dispara en paralelo
      gs.missileWeapon = ammo
    } else {
      gs.activeWeapon = ammo
    }
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

  // Abrir menú de base
  if (gs.inSafeZone && gs.phase === "playing" && baseBtn(gs, x, y)) {
    gs.phase = "base-menu"
    gs.baseMenuOpen = true
    sfx.click()
    return
  }

  // Zonas muertas del HUD: no joystick
  if (isUiDeadZone(x, y)) return

  // Joystick solo dentro del pad fijo (reposicionable al tocar dentro de él);
  // fuera del pad, un tap selecciona objetivo (sin joystick)
  if (!touchRole.has(id)) {
    if (inJoystickPad(x, y)) {
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
  if (role === "panel") {
    if (dragPanel.id) {
      gs.hud[dragPanel.id].x = Math.max(0, Math.min(W - 40, x - dragPanel.offX))
      gs.hud[dragPanel.id].y = Math.max(0, Math.min(H - 30, y - dragPanel.offY))
    }
    return
  }
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

  if (role === "panel") {
    if (dragPanel.id) {
      saveHudLayout(gs)
      dragPanel.id = null
    }
    return
  }

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

// Hit-test de los paneles del HUD (para mover/minimizar/orientar en modo edición)
function panelAt(gs: GS, x: number, y: number): { id: HudPanelId; isMin: boolean; isOrient: boolean } | null {
  const ids: HudPanelId[] = ["vitals", "stats", "events", "minimap"]
  for (const id of ids) {
    const r = id === "minimap" ? minimapRectFromHud(gs) : panelRect(id, gs)
    // Cabecera del panel
    const header = id === "minimap" ? { x: r.x, y: r.y - PANEL_HEADER_H - 2, w: r.w, h: PANEL_HEADER_H } : { x: r.x, y: r.y, w: r.w, h: PANEL_HEADER_H }
    if (inRect(header, x, y)) {
      const isMin = x >= header.x + header.w - PANEL_MIN_BTN_W - 14 && x <= header.x + header.w
      const isOrient = id === "vitals" && x >= header.x + header.w - PANEL_MIN_BTN_W - 40 && x <= header.x + header.w - PANEL_MIN_BTN_W - 12
      return { id, isMin, isOrient }
    }
    if (inRect({ x: r.x, y: r.y + (id === "minimap" ? 0 : PANEL_HEADER_H), w: r.w, h: 200 }, x, y)) {
      return { id, isMin: false, isOrient: false }
    }
  }
  return null
}

function minimapRectFromHud(gs: GS) {
  return { x: gs.hud.minimap.x, y: gs.hud.minimap.y, w: CONFIG.minimap.size, h: CONFIG.minimap.size }
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
      const ammo = AMMO_ORDER[idx]
      if (ammo === "missile_a" || ammo === "missile_b") gs.missileWeapon = ammo
      else gs.activeWeapon = ammo
      const w = weaponDef(ammo)
      gs.flashMsg = w.name + (ammo === "missile_a" || ammo === "missile_b" ? " (paralelo)" : "")
      gs.flashT = 1.2
      sfx.click()
    }
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