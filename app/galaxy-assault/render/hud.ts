// HUD: HP, escudo, munición, arma activa, joystick visual y botones.
import type { GS } from "../core/types"
import { W, H, WEAPON_BTN, REPAIR_BTN, SHIELD_ABSORB } from "../core/constants"
import { weaponDef, AMMO_ORDER } from "../data/ammo"
import { font, rgba, roundRectPath, drawButton } from "../../lib/gameKit"
import { drawSprite, type SpriteKey } from "../core/sprites"
import { evasionChance } from "../engine/player"

type Imgs = Record<string, HTMLImageElement>

export function drawHUD(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  drawHpBar(ctx, gs)
  drawShieldBar(ctx, gs)
  drawEvasion(ctx, gs)
  drawAmmoBar(ctx, gs, imgs)
  drawWeaponButton(ctx, gs, imgs)
  drawRepairButton(ctx, gs, imgs)
  drawJoystick(ctx, gs)
  drawFlash(ctx, gs)
}

function drawHpBar(ctx: CanvasRenderingContext2D, gs: GS): void {
  const p = gs.player
  const w = 260
  const h = 22
  const x = 16
  const y = 16
  const pct = Math.max(0, p.hp / p.maxHp)
  ctx.fillStyle = "rgba(8,10,20,0.7)"
  roundRectPath(ctx, x, y, w, h, h / 2)
  ctx.fill()
  const g = ctx.createLinearGradient(x, y, x + w, y)
  g.addColorStop(0, pct > 0.5 ? "#7CFF5A" : pct > 0.25 ? "#ffcc44" : "#ff5533")
  g.addColorStop(1, pct > 0.5 ? "#22aa44" : pct > 0.25 ? "#aa7722" : "#aa2222")
  ctx.fillStyle = g
  roundRectPath(ctx, x + 3, y + 3, Math.max(10, (w - 6) * pct), h - 6, (h - 6) / 2)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.font = font(13, 800)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(`❤ ${Math.ceil(p.hp)} / ${p.maxHp}`, x + w / 2, y + h / 2)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
}

function drawShieldBar(ctx: CanvasRenderingContext2D, gs: GS): void {
  const p = gs.player
  const w = 180
  const h = 14
  const x = 16
  const y = 48
  const pct = p.shieldHp / p.shieldMaxHp
  ctx.fillStyle = "rgba(8,10,20,0.7)"
  roundRectPath(ctx, x, y, w, h, h / 2)
  ctx.fill()
  if (p.shieldHp > 0) {
    ctx.fillStyle = "#44aaff"
    roundRectPath(ctx, x + 2, y + 2, Math.max(8, (w - 4) * pct), h - 4, (h - 4) / 2)
    ctx.fill()
  } else if (p.shieldCooldown > 0) {
    const cdPct = 1 - p.shieldCooldown / p.shieldCdMax
    ctx.fillStyle = "rgba(68,170,255,0.35)"
    roundRectPath(ctx, x + 2, y + 2, Math.max(8, (w - 4) * cdPct), h - 4, (h - 4) / 2)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(10, 700)
    ctx.textAlign = "center"
    ctx.fillText("RECARGANDO", x + w / 2, y + h / 2)
    ctx.textAlign = "left"
  }
  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.font = font(11, 700)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(`🛡 ${Math.round(p.shieldHp)} (${Math.round(SHIELD_ABSORB * 100)}% abs.)`, x + w + 10, y + h / 2)
  ctx.textBaseline = "alphabetic"
}

function drawEvasion(ctx: CanvasRenderingContext2D, gs: GS): void {
  const ev = Math.round(evasionChance(gs) * 100)
  ctx.fillStyle = "rgba(124,255,90,0.85)"
  ctx.font = font(13, 800)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(`💨 Evasión ${ev}%`, 16, 78)
  ctx.textBaseline = "alphabetic"
}

function drawAmmoBar(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  // Barras de munición por tipo (bajo el HP)
  const startY = 100
  const gap = 6
  let y = startY
  for (const id of AMMO_ORDER) {
    const w = weaponDef(id)
    const ammo = gs.ammo[id]
    const pct = ammo / w.maxAmmo
    const barW = 200
    ctx.fillStyle = "rgba(8,10,20,0.6)"
    roundRectPath(ctx, 16, y, barW, 12, 6)
    ctx.fill()
    ctx.fillStyle = ammo <= 0 ? "rgba(255,85,51,0.7)" : rgba(w.color, 0.85)
    roundRectPath(ctx, 18, y + 2, Math.max(6, (barW - 4) * pct), 8, 4)
    ctx.fill()
    ctx.fillStyle = rgba(w.color, 0.9)
    ctx.font = font(11, 800)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(`${ammo}`, 220, y + 6)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    // Ícono del arma (sprite)
    drawSprite(ctx, imgs, w.sprite as SpriteKey, 236 + 10, y + 6, 14)
    y += 12 + gap
  }
}

function drawWeaponButton(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  const b = WEAPON_BTN
  const w = weaponDef(gs.activeWeapon)
  drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `🔁 ${w.name}`, { color: w.color, fontSize: 16 })
  // mini sprite junto al botón
  drawSprite(ctx, imgs, w.sprite as SpriteKey, b.x + 26, b.y + b.h / 2, 24)
  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.font = font(11, 700)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(`Munición: ${gs.ammo[gs.activeWeapon]}/${w.maxAmmo}`, b.x, b.y - 10)
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