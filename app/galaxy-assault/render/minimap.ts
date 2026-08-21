// Minimapa: arriba-derecha, muestra mundo, base, jugador, enemigos, jefes y cajas.
import type { GS } from "../core/types"
import { CONFIG } from "../core/constants"
import { minimapData } from "../engine/crates"
import { roundRectPath, font } from "../../lib/gameKit"

export function minimapRect(): { x: number; y: number; w: number; h: number } {
  const size = CONFIG.minimap.size
  return {
    x: CONFIG.minimap.offsetX,
    y: CONFIG.minimap.offsetY,
    w: size,
    h: size,
  }
}

export function drawMinimap(ctx: CanvasRenderingContext2D, gs: GS): void {
  if (gs.minimapHidden) return
  const data = minimapData(gs)
  const r = minimapRect()
  const size = r.w
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
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath()
  ctx.arc(x, y, 1.6, 0, Math.PI * 2)
  ctx.fill()
}