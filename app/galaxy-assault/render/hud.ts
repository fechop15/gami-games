// HUD: barra rápida de munición (cuadros abajo-centro), botón de disparo y joystick.
import type { GS } from "../core/types"
import { W, H, AMMO_SQUARE, AMMO_GAP, AMMO_COUNT, AMMO_TOTAL, JOY_RADIUS, JOY_PAD_SIZE, PANEL_HEADER_H } from "../core/constants"
import { weaponDef, AMMO_ORDER } from "../data/ammo"
import { font, rgba, roundRectPath } from "../../lib/gameKit"
import { drawSprite, type SpriteKey } from "../core/sprites"
import { getPressedAmmo } from "../input"

type Imgs = Record<string, HTMLImageElement>

export function drawHUD(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  drawAmmoBar(ctx, gs, imgs)
  drawFireButton(ctx, gs)
  drawJoystick(ctx, gs)
  drawControlsEdit(ctx, gs)
  drawFlash(ctx, gs)
}

function drawAmmoBar(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  const barX = gs.hud.ammo.x
  const barY = gs.hud.ammo.y
  const start = barX
  const pressed = getPressedAmmo()
  for (let i = 0; i < AMMO_COUNT; i++) {
    const id = AMMO_ORDER[i]
    const w = weaponDef(id)
    const ammo = gs.ammo[id]
    const x = start + i * (AMMO_SQUARE + AMMO_GAP)
    const isMissile = id === "missile_a" || id === "missile_b"
    const active = isMissile ? gs.missileWeapon === id : id === gs.activeWeapon
    const empty = ammo <= 0

    // Cuadro
    ctx.save()
    if (active) {
      ctx.shadowColor = rgba(w.color, 0.9)
      ctx.shadowBlur = 18
    }
    ctx.fillStyle = active ? rgba(w.color, 0.25) : "rgba(8,10,20,0.7)"
    roundRectPath(ctx, x, barY, AMMO_SQUARE, AMMO_SQUARE, 12)
    ctx.fill()
    ctx.restore()

    ctx.strokeStyle = active ? w.color : empty ? "rgba(255,85,51,0.6)" : "rgba(255,255,255,0.25)"
    ctx.lineWidth = active ? 3 : 1.5
    roundRectPath(ctx, x, barY, AMMO_SQUARE, AMMO_SQUARE, 12)
    ctx.stroke()

    // Indicador pequeño del láser activo (1-3) o misil paralelo (4-5)
    ctx.fillStyle = active ? w.color : "rgba(255,255,255,0.25)"
    ctx.font = font(9, 800)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(isMissile ? "⇄" : "➤", x + AMMO_SQUARE / 2, barY + 6)
    ctx.textBaseline = "alphabetic"

    // Sprite del arma
    drawSprite(ctx, imgs, w.sprite as SpriteKey, x + AMMO_SQUARE / 2, barY + 24, 32)

    // Contador (sin texto de nombre)
    ctx.fillStyle = empty ? "#ff5533" : active ? w.color : "rgba(255,255,255,0.6)"
    ctx.font = font(14, 900)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`${ammo}`, x + AMMO_SQUARE / 2, barY + AMMO_SQUARE - 8)
    ctx.textBaseline = "alphabetic"
    ctx.textAlign = "left"
  }

  // Globo con el nombre completo del arma presionada
  if (pressed >= 0 && pressed < AMMO_ORDER.length) {
    drawAmmoTooltip(ctx, gs, pressed, start)
  }
}

// Globo (tooltip) con el nombre completo sobre el cuadro presionado
function drawAmmoTooltip(ctx: CanvasRenderingContext2D, gs: GS, idx: number, barStart: number): void {
  const id = AMMO_ORDER[idx]
  const w = weaponDef(id)
  const cx = barStart + idx * (AMMO_SQUARE + AMMO_GAP) + AMMO_SQUARE / 2
  const y = gs.hud.ammo.y - 44

  ctx.save()
  ctx.shadowColor = rgba(w.color, 0.8)
  ctx.shadowBlur = 16
  ctx.fillStyle = "rgba(8,10,20,0.92)"
  roundRectPath(ctx, cx - 90, y, 180, 34, 12)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = w.color
  ctx.lineWidth = 2
  roundRectPath(ctx, cx - 90, y, 180, 34, 12)
  ctx.stroke()

  // Punta del globo
  ctx.fillStyle = "rgba(8,10,20,0.92)"
  ctx.beginPath()
  ctx.moveTo(cx - 8, y + 34)
  ctx.lineTo(cx + 8, y + 34)
  ctx.lineTo(cx, y + 44)
  ctx.closePath()
  ctx.fill()

  const empty = gs.ammo[id] <= 0
  ctx.fillStyle = empty ? "#ff5533" : "#ffffff"
  ctx.font = font(16, 900)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(empty ? `${w.name} · sin munición` : w.name, cx, y + 17)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
}

function drawFireButton(ctx: CanvasRenderingContext2D, gs: GS): void {
  const b = gs.hud.fire
  const hasTarget = gs.targetId !== null
  const hasAmmo = gs.ammo[gs.activeWeapon] > 0
  const active = gs.firing
  const w = weaponDef(gs.activeWeapon)

  const cx = b.x + 75
  const cy = b.y + 75
  const R = 75

  ctx.save()
  if (active) {
    ctx.shadowColor = rgba(w.color, 1)
    ctx.shadowBlur = 30
  }
  ctx.fillStyle = active ? rgba(w.color, 0.5) : hasTarget && hasAmmo ? "rgba(255,60,60,0.4)" : "rgba(8,10,20,0.75)"
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = active ? w.color : hasTarget && hasAmmo ? "#ff5533" : "rgba(255,255,255,0.3)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = hasTarget && hasAmmo ? "#ffffff" : "rgba(255,255,255,0.4)"
  ctx.font = font(24, 900)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("🔫 DISPARAR", cx, cy - 8)
  ctx.font = font(11, 700)
  ctx.fillStyle = hasTarget ? "#ffdd88" : "rgba(255,255,255,0.5)"
  ctx.fillText(hasTarget ? "con objetivo" : "sin objetivo", cx, cy + 18)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
}

function drawJoystick(ctx: CanvasRenderingContext2D, gs: GS): void {
  // Pad fijo del joystick (área izquierda donde se puede reposicionar)
  const padX = gs.hud.joystick.x
  const padY = gs.hud.joystick.y
  const padCx = padX + JOY_PAD_SIZE / 2
  const padCy = padY + JOY_PAD_SIZE / 2
  ctx.strokeStyle = "rgba(0,229,255,0.16)"
  ctx.lineWidth = 2
  ctx.setLineDash([6, 10])
  ctx.beginPath()
  ctx.arc(padCx, padCy, JOY_PAD_SIZE / 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "rgba(0,229,255,0.05)"
  ctx.beginPath()
  ctx.arc(padCx, padCy, JOY_PAD_SIZE / 2, 0, Math.PI * 2)
  ctx.fill()

  if (!gs.joystick.active) return
  const { baseX, baseY, dx, dy } = gs.joystick
  const R = JOY_RADIUS
  // Base del joystick en su posición actual (reposicionable dentro del pad)
  ctx.strokeStyle = "rgba(255,255,255,0.45)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(baseX, baseY, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = "rgba(0,229,255,0.14)"
  ctx.beginPath()
  ctx.arc(baseX, baseY, R, 0, Math.PI * 2)
  ctx.fill()
  // Thumb
  ctx.fillStyle = "rgba(0,229,255,0.55)"
  ctx.beginPath()
  ctx.arc(baseX + dx * R, baseY + dy * R, 30, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(0,229,255,0.8)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(baseX + dx * R, baseY + dy * R, 30, 0, Math.PI * 2)
  ctx.stroke()
}

// En modo edición: cabeceras/bordes para joystick, disparo y munición
function drawControlsEdit(ctx: CanvasRenderingContext2D, gs: GS): void {
  if (!gs.editMode) return
  const items: Array<{ id: "joystick" | "fire" | "ammo"; x: number; y: number; w: number; h: number; title: string }> = []
  items.push({ id: "joystick", x: gs.hud.joystick.x, y: gs.hud.joystick.y, w: JOY_PAD_SIZE, h: JOY_PAD_SIZE, title: "🕹 Joystick" })
  items.push({ id: "fire", x: gs.hud.fire.x, y: gs.hud.fire.y, w: 150, h: 150, title: "🔫 Disparo" })
  items.push({ id: "ammo", x: gs.hud.ammo.x, y: gs.hud.ammo.y, w: AMMO_TOTAL, h: AMMO_SQUARE, title: "🧨 Munición" })

  for (const it of items) {
    const hy = it.y - PANEL_HEADER_H - 2
    ctx.fillStyle = "rgba(12,16,32,0.9)"
    roundRectPath(ctx, it.x, hy, it.w, PANEL_HEADER_H, 8)
    ctx.fill()
    ctx.strokeStyle = "rgba(0,229,255,0.5)"
    ctx.lineWidth = 1.5
    roundRectPath(ctx, it.x, hy, it.w, PANEL_HEADER_H, 8)
    ctx.stroke()
    ctx.fillStyle = "#ffffff"
    ctx.font = font(13, 800)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(it.title, it.x + 8, hy + PANEL_HEADER_H / 2 + 1)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    // Borde punteado del área
    ctx.strokeStyle = "rgba(0,229,255,0.9)"
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    roundRectPath(ctx, it.x - 2, it.y - 2, it.w + 4, it.h + 4, 10)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawFlash(ctx: CanvasRenderingContext2D, gs: GS): void {
  if (gs.flashT <= 0) return
  const a = Math.min(1, gs.flashT)
  ctx.globalAlpha = a
  ctx.fillStyle = "#ffdd44"
  ctx.font = font(20, 900)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(gs.flashMsg, W / 2, H / 2 - 120)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.globalAlpha = 1
}