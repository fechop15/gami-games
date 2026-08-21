// Pantallas: intro, menú de base (inventario + naves placeholder) y overlay de muerte.
import type { GS } from "../core/types"
import { W, H, CONFIG } from "../core/constants"
import { font, drawButton, drawPanel, glowText } from "../../lib/gameKit"
import { drawSprite, dirToAngle, type SpriteKey } from "../core/sprites"
import { ITEMS } from "../data/items"
import { SHIP_DEFS } from "../data/ships"

type Imgs = Record<string, HTMLImageElement>

export function drawIntro(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  // Fondo con el bg.svg
  const bg = imgs.bg
  if (bg && bg.naturalWidth > 0) {
    ctx.drawImage(bg, 0, 0, W, H)
  } else {
    ctx.fillStyle = "#050510"
    ctx.fillRect(0, 0, W, H)
  }
  ctx.fillStyle = "rgba(4,6,20,0.5)"
  ctx.fillRect(0, 0, W, H)

  // Título
  glowText(ctx, "GALAXY", W / 2, H / 2 - 150, 72, "#ffffff", { glow: "rgba(0,229,255,0.7)" })
  glowText(ctx, "ASSAULT", W / 2, H / 2 - 70, 72, "#00e5ff", { glow: "rgba(0,229,255,0.8)" })

  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.font = font(17, 600)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(`${CONFIG.map.name} · 2 NPCs · 2 Jefes · ${CONFIG.map.size}×${CONFIG.map.size}`, W / 2, H / 2 - 18)
  ctx.textBaseline = "alphabetic"

  // Nave del jugador flotando (apunta hacia arriba = dirección -π/2)
  const p = gs.save
  const drift = Math.sin(gs.time * 2) * 0.12
  drawSprite(ctx, imgs, (SHIP_DEFS.find(s => s.id === p.shipId)?.sprite ?? "player") as SpriteKey, W / 2, H / 2 + 60, 90, dirToAngle(-Math.PI / 2 + drift))
  drawSprite(ctx, imgs, "shield", W / 2, H / 2 + 60, 150, 0, 0.25 + Math.sin(gs.time * 2) * 0.08)

  // Botones
  gs.btns = []
  const play = drawButton(ctx, W / 2, H / 2 + 160, 280, 58, "▶  JUGAR", { color: "#00e5ff", glow: true, fontSize: 20 })
  gs.btns.push({ x: play.x, y: play.y, w: play.w, h: play.h })
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.font = font(13, 600)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("Toca y arrastra para mover · Auto-disparo al objetivo · Minimapa arriba", W / 2, H / 2 + 235)
  ctx.textBaseline = "alphabetic"
}

export function drawBaseMenu(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  ctx.fillStyle = "rgba(4,6,20,0.85)"
  ctx.fillRect(0, 0, W, H)

  const pw = 760
  const ph = 560
  const px = W / 2 - pw / 2
  const py = H / 2 - ph / 2
  drawPanel(ctx, px, py, pw, ph, 24)

  glowText(ctx, "⚓ BASE", W / 2, py + 56, 36, "#7CFF5A", { glow: "rgba(124,255,90,0.7)" })
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.font = font(15, 600)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()} monedas · Nave: ${SHIP_DEFS.find(s => s.id === gs.save.shipId)?.name ?? "Estrella"}`, W / 2, py + 96)
  ctx.textBaseline = "alphabetic"

  // Inventario
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = font(18, 800)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText("📦 Inventario", px + 40, py + 130)
  ctx.textBaseline = "alphabetic"

  const cols = 4
  let i = 0
  for (const item of ITEMS) {
    const qty = gs.save.inventory[item.id] ?? 0
    const cx = px + 60 + (i % cols) * 170
    const cy = py + 170 + Math.floor(i / cols) * 70
    drawSprite(ctx, imgs, item.sprite as SpriteKey, cx, cy, 44)
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.font = font(15, 800)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(`${item.name} ×${qty}`, cx + 30, cy)
    ctx.textBaseline = "alphabetic"
    i++
  }

  // Robots
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = font(15, 800)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(`🤖 Robots de reparación: ${gs.save.repairBots}`, px + 40, py + 300)
  ctx.textBaseline = "alphabetic"

  // Botones de la base
  gs.btns = []
  const close = drawButton(ctx, W / 2, py + ph - 70, 240, 50, "SALIR AL MAPA", { color: "#7CFF5A", fontSize: 17 })
  gs.btns.push({ x: close.x, y: close.y, w: close.w, h: close.h })

  // Placeholder naves (futuro)
  const shipsBtn = drawButton(ctx, px + 340, py + 360, 220, 44, "🚀 NAVES (Próximamente)", { color: "#445566", fontSize: 13 })
  gs.btns.push({ x: shipsBtn.x, y: shipsBtn.y, w: shipsBtn.w, h: shipsBtn.h })
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.font = font(12, 600)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("Comprar y cambiar naves llegará pronto", px + 340, py + 405)
  ctx.textBaseline = "alphabetic"
}

export function drawDead(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(120,0,0,0.25)"
  ctx.fillRect(0, 0, W, H)
  glowText(ctx, "💥 NAVE DESTRUIDO", W / 2, H / 2 - 40, 44, "#ff5533", { glow: "rgba(255,85,51,0.7)" })
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.font = font(16, 700)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("Respawn en la base segura…", W / 2, H / 2 + 10)
  ctx.textBaseline = "alphabetic"
}

export function handleBaseBtn(gs: GS, x: number, y: number): boolean {
  for (const b of gs.btns) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return true
    }
  }
  return false
}