// Minimapa: panel movible del HUD, muestra el mundo completo, la vista actual y las entidades.
import type { GS } from "../core/types"
import { CONFIG, CELL, W, H, PANEL_HEADER_H, PANEL_MIN_BTN_W, CAM_ZOOM } from "../core/constants"
import { minimapData } from "../engine/crates"
import { roundRectPath, font } from "../../lib/gameKit"

export function minimapRect(gs: GS): { x: number; y: number; w: number; h: number } {
  const size = CONFIG.minimap.size
  const p = gs.hud.minimap
  return { x: p.x, y: p.y, w: size, h: size }
}

export function drawMinimap(ctx: CanvasRenderingContext2D, gs: GS): void {
  if (gs.minimapHidden) return
  const data = minimapData(gs)
  const r = minimapRect(gs)
  const size = r.w

  // Escala: el mundo completo cabe en el minimapa
  const scale = size / data.worldPx

  // Panel
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.5)"
  ctx.shadowBlur = 12
  ctx.fillStyle = "rgba(10,14,28,0.78)"
  roundRectPath(ctx, r.x, r.y, size, size, 10)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = "rgba(0,229,255,0.35)"
  ctx.lineWidth = 1.5
  roundRectPath(ctx, r.x, r.y, size, size, 10)
  ctx.stroke()

  // Marco del mundo (línea del área jugable)
  const border = CONFIG.map.border.belt * scale
  ctx.strokeStyle = "rgba(255,255,255,0.25)"
  ctx.strokeRect(r.x + border, r.y + border, size - border * 2, size - border * 2)

  // Cinturón de asteroides (puntos a lo largo del borde)
  ctx.fillStyle = "rgba(180,170,150,0.5)"
  const step = 26
  for (let x = border; x <= size - border; x += step) {
    dot(ctx, r.x + x, r.y + border)
    dot(ctx, r.x + x, r.y + size - border)
  }
  for (let y = border; y <= size - border; y += step) {
    dot(ctx, r.x + border, r.y + y)
    dot(ctx, r.x + size - border, r.y + y)
  }

  // Cajas
  if (CONFIG.minimap.showCrates) {
    for (const c of data.crates) {
      ctx.fillStyle = "#ffe44d"
      ctx.beginPath()
      ctx.arc(r.x + c.x * scale, r.y + c.y * scale, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Enemigos
  for (const e of data.enemies) {
    ctx.fillStyle = e.boss ? "#ffdd44" : "#ff5533"
    ctx.beginPath()
    ctx.arc(r.x + e.x * scale, r.y + e.y * scale, e.boss ? 4 : 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Base
  ctx.fillStyle = "#7CFF5A"
  roundRectPath(ctx, r.x + data.baseX * scale - 3.5, r.y + data.baseY * scale - 3.5, 7, 7, 2)
  ctx.fill()

  // Recuadro indicador de la vista actual (la zona visible en pantalla, con zoom)
  const vw = (W / CAM_ZOOM) * scale
  const vh = (H / CAM_ZOOM) * scale
  const vx = r.x + data.playerX * scale - vw / 2
  const vy = r.y + data.playerY * scale - vh / 2
  ctx.save()
  ctx.strokeStyle = "rgba(0,229,255,0.9)"
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.strokeRect(vx, vy, vw, vh)
  ctx.setLineDash([])
  ctx.restore()

  // Jugador (triángulo rotado)
  const px = r.x + data.playerX * scale
  const py = r.y + data.playerY * scale
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(data.playerAngle)
  ctx.fillStyle = "#00e5ff"
  ctx.beginPath()
  ctx.moveTo(5, 0)
  ctx.lineTo(-3, -3.5)
  ctx.lineTo(-3, 3.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Etiqueta
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.font = font(11, 700)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(CONFIG.map.name, r.x + size / 2, r.y + size + 12)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"

  // Coordenadas del jugador (celda del mapa) abajo-centro
  const gx = Math.floor(data.playerX / CELL)
  const gy = Math.floor(data.playerY / CELL)
  ctx.fillStyle = "rgba(0,229,255,0.9)"
  ctx.font = font(13, 900)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(`x:${gx}  y:${gy}`, r.x + size / 2, r.y + size + 32)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"

  // Cabecera/edición del minimapa
  if (gs.editMode) {
    const hx = r.x
    const hy = r.y - PANEL_HEADER_H - 2
    ctx.fillStyle = "rgba(12,16,32,0.9)"
    roundRectPath(ctx, hx, hy, size, PANEL_HEADER_H, 8)
    ctx.fill()
    ctx.strokeStyle = "rgba(0,229,255,0.5)"
    ctx.lineWidth = 1.5
    roundRectPath(ctx, hx, hy, size, PANEL_HEADER_H, 8)
    ctx.stroke()
    ctx.fillStyle = "#ffffff"
    ctx.font = font(13, 800)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText("🗺 Mapa", hx + 8, hy + PANEL_HEADER_H / 2 + 1)
    const bx = hx + size - PANEL_MIN_BTN_W - 4
    ctx.fillStyle = "rgba(255,255,255,0.2)"
    ctx.beginPath()
    ctx.arc(bx + PANEL_MIN_BTN_W / 2, hy + PANEL_HEADER_H / 2, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = font(12, 800)
    ctx.fillText(gs.hud.minimap.minimized ? "▾" : "▴", bx + PANEL_MIN_BTN_W / 2, hy + PANEL_HEADER_H / 2 + 1)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath()
  ctx.arc(x, y, 1.6, 0, Math.PI * 2)
  ctx.fill()
}