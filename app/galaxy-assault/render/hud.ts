// HUD: barra rápida de munición (cuadros abajo-centro), botón de disparo, reparar y joystick.
import type { GS } from "../core/types"
import { W, H, FIRE_BTN, REPAIR_BTN, AMMO_SQUARE, AMMO_GAP, AMMO_COUNT, AMMO_BAR_Y } from "../core/constants"
import { weaponDef, AMMO_ORDER } from "../data/ammo"
import { font, rgba, roundRectPath, drawButton } from "../../lib/gameKit"
import { drawSprite, type SpriteKey } from "../core/sprites"
import { getPressedAmmo } from "../input"

type Imgs = Record<string, HTMLImageElement>

export function drawHUD(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  drawAmmoBar(ctx, gs, imgs)
  drawFireButton(ctx, gs)
  drawRepairButton(ctx, gs, imgs)
  drawJoystick(ctx, gs)
  drawFlash(ctx, gs)
}

function drawAmmoBar(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  const total = AMMO_COUNT * AMMO_SQUARE + (AMMO_COUNT - 1) * AMMO_GAP
  const start = W / 2 - total / 2
  const pressed = getPressedAmmo()
  for (let i = 0; i < AMMO_COUNT; i++) {
    const id = AMMO_ORDER[i]
    const w = weaponDef(id)
    const ammo = gs.ammo[id]
    const x = start + i * (AMMO_SQUARE + AMMO_GAP)
    const active = id === gs.activeWeapon
    const empty = ammo <= 0

    // Cuadro
    ctx.save()
    if (active) {
      ctx.shadowColor = rgba(w.color, 0.9)
      ctx.shadowBlur = 18
    }
    ctx.fillStyle = active ? rgba(w.color, 0.25) : "rgba(8,10,20,0.7)"
    roundRectPath(ctx, x, AMMO_BAR_Y, AMMO_SQUARE, AMMO_SQUARE, 12)
    ctx.fill()
    ctx.restore()

    ctx.strokeStyle = active ? w.color : empty ? "rgba(255,85,51,0.6)" : "rgba(255,255,255,0.25)"
    ctx.lineWidth = active ? 3 : 1.5
    roundRectPath(ctx, x, AMMO_BAR_Y, AMMO_SQUARE, AMMO_SQUARE, 12)
    ctx.stroke()

    // Sprite del arma
    drawSprite(ctx, imgs, w.sprite as SpriteKey, x + AMMO_SQUARE / 2, AMMO_BAR_Y + 22, 34)

    // Contador (sin texto de nombre)
    ctx.fillStyle = empty ? "#ff5533" : active ? w.color : "rgba(255,255,255,0.6)"
    ctx.font = font(14, 900)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`${ammo}`, x + AMMO_SQUARE / 2, AMMO_BAR_Y + AMMO_SQUARE - 8)
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
  const y = AMMO_BAR_Y - 44

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
  const b = FIRE_BTN
  const hasTarget = gs.targetId !== null
  const hasAmmo = gs.ammo[gs.activeWeapon] > 0
  const active = gs.firing
  const w = weaponDef(gs.activeWeapon)

  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const R = b.w / 2

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

function drawRepairButton(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  const b = REPAIR_BTN
  const has = gs.save.repairBots > 0
  drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `🤖 REPARAR ×${gs.save.repairBots}`, { color: has ? "#33aaff" : "#445566", fontSize: 15 })
  drawSprite(ctx, imgs, "repair_bot", b.x + b.w + 24, b.y + b.h / 2, 30)
}

function drawJoystick(ctx: CanvasRenderingContext2D, gs: GS): void {
  if (!gs.joystick.active) return
  const { baseX, baseY, dx, dy } = gs.joystick
  const R = 56
  ctx.strokeStyle = "rgba(255,255,255,0.25)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(baseX, baseY, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = "rgba(255,255,255,0.1)"
  ctx.beginPath()
  ctx.arc(baseX + dx * R, baseY + dy * R, 24, 0, Math.PI * 2)
  ctx.fill()
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