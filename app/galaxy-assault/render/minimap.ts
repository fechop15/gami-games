// Minimapa: panel movible del HUD, muestra mundo, base, jugador, enemigos, jefes y cajas.
import type { GS } from "../core/types"
import { CONFIG, CELL, PANEL_HEADER_H, PANEL_MIN_BTN_W, MINIMAP_VIEW_WORLD } from "../core/constants"
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

  // Escala: mostramos solo MINIMAP_VIEW_WORLD px del mundo, centrado en el jugador
  const scale = size / MINIMAP_VIEW_WORLD
  const cx = r.x + size / 2
  const cy = r.y + size / 2
  const px = (wx: number) => cx + (wx - data.playerX) * scale
  const py = (wy: number) => cy + (wy - data.playerY) * scale

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

  // Recuadro del mundo completo (solo su borde visible: indica dónde estás)
  const worldS = data.worldPx * scale
  const wx0 = cx + (0 - data.playerX) * scale
  const wy0 = cy + (0 - data.playerY) * scale
  ctx.save()
  roundRectPath(ctx, r.x, r.y, size, size, 10)
  ctx.clip()
  ctx.strokeStyle = "rgba(255,255,255,0.4)"
  ctx.lineWidth = 2
  ctx.strokeRect(wx0, wy0, worldS, worldS)
  ctx.restore()

  // Cinturón de asteroides (solo el del borde visible)
  const border = CONFIG.map.border.belt * scale
  ctx.fillStyle = "rgba(180,170,150,0.5)"
  const step = 26
  for (let x = border; x <= worldS - border; x += step) {
    dot(ctx, wx0 + x, wy0 + border)
    dot(ctx, wx0 + x, wy0 + worldS - border)
  }
  for (let y = border; y <= worldS - border; y += step) {
    dot(ctx, wx0 + border, wy0 + y)
    dot(ctx, wx0 + worldS - border, wy0 + y)
  }

  // Cajas
  if (CONFIG.minimap.showCrates) {
    for (const c of data.crates) {
      ctx.fillStyle = "#ffe44d"
      ctx.beginPath()
      ctx.arc(px(c.x), py(c.y), 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Enemigos
  for (const e of data.enemies) {
    ctx.fillStyle = e.boss ? "#ffdd44" : "#ff5533"
    ctx.beginPath()
    ctx.arc(px(e.x), py(e.y), e.boss ? 4 : 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Base
  ctx.fillStyle = "#7CFF5A"
  roundRectPath(ctx, px(data.baseX) - 3.5, py(data.baseY) - 3.5, 7, 7, 2)
  ctx.fill()

  // Jugador (triángulo rotado) — siempre al centro
  ctx.save()
  ctx.translate(cx, cy)
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