import {
  W, H, FARM_TOP, FARM_BOTTOM, DECOR_TOP, DECOR_H, CELL, CELL_GAP, COLS,
  cropDef, animalDef, fishDef, weatherDef, decorDef,
} from "./constants"
import type { GS } from "./types"
import type { TileState } from "./save"
import { font, rgba, roundRectPath } from "../lib/gameKit"
import { tileX, tileY } from "./engine"

const SOIL = "#8a5a2b"
const SOIL_DARK = "#6e4520"
const SOIL_LINE = "#5c3a18"
const GRASS = "#4c9a34"
const GRASS_DARK = "#3a7a27"
const WATER = "#3f9ad1"
const WATER_DEEP = "#2c7cb3"

function weatherSky(wid: string): string[] {
  switch (wid) {
    case "lluvia": return ["#5c6b7a", "#41505e", "#2e3a45"]
    case "tormenta": return ["#3a3a4a", "#262632", "#191922"]
    case "sequia": return ["#d9a35c", "#c1885a", "#a06a3f"]
    case "calor": return ["#f5a35f", "#e0864e", "#b96a3a"]
    case "helada": return ["#b9c6d6", "#8f9fb4", "#6a7a90"]
    default: return ["#7cc4ff", "#5aa6ec", "#3a80c4"]
  }
}

export function drawWorld(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  const w = weatherDef(gs.save.weather)
  const sky = weatherSky(w.id)
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, sky[0]); grad.addColorStop(0.4, sky[1]); grad.addColorStop(1, sky[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // sol / luna
  if (w.id === "soleado" || w.id === "calor") {
    ctx.save()
    ctx.shadowColor = "rgba(255,230,120,0.9)"; ctx.shadowBlur = 40
    ctx.fillStyle = "#ffe882"
    ctx.beginPath(); ctx.arc(410, 70, 34, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  if (w.id === "helada") {
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.beginPath(); ctx.arc(410, 70, 24, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.2)"
    ctx.beginPath(); ctx.arc(418, 60, 26, 0, Math.PI * 2); ctx.fill()
  }

  // nubes
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  drawCloud(ctx, 90 + Math.sin(time * 0.3) * 12, 54, 40)
  drawCloud(ctx, 260 + Math.sin(time * 0.22 + 2) * 10, 84, 28)

  // franja de decoraciones (banner)
  drawDecorBanner(ctx, gs)

  // fondo del área de cultivo
  ctx.fillStyle = GRASS
  ctx.fillRect(0, FARM_TOP - 8, W, FARM_BOTTOM - FARM_TOP + 8)

  drawTiles(ctx, gs, time)

  drawWeatherFx(ctx, gs)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.arc(x, y, s * 0.5, 0, Math.PI * 2)
  ctx.arc(x + s * 0.5, y + s * 0.15, s * 0.4, 0, Math.PI * 2)
  ctx.arc(x - s * 0.45, y + s * 0.12, s * 0.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawDecorBanner(ctx: CanvasRenderingContext2D, gs: GS) {
  ctx.fillStyle = "rgba(20,40,16,0.55)"
  roundRectPath(ctx, 10, DECOR_TOP, W - 20, DECOR_H, 10)
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 1
  roundRectPath(ctx, 10, DECOR_TOP, W - 20, DECOR_H, 10)
  ctx.stroke()
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = font(13, 700)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText("Jardín:", 20, DECOR_TOP + DECOR_H / 2 + 1)
  const decors = Object.keys(gs.save.decorations)
  if (decors.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    ctx.fillText("sin decoraciones", 70, DECOR_TOP + DECOR_H / 2 + 1)
  } else {
    let x = 72
    ctx.font = font(17, 700)
    for (const id of decors) {
      const d = decorDef(id)
      if (!d) continue
      const n = gs.save.decorations[id]
      ctx.fillText(d.emoji, x, DECOR_TOP + DECOR_H / 2 + 1)
      if (n > 1) {
        ctx.fillStyle = "rgba(255,255,255,0.7)"
        ctx.font = font(10, 800)
        ctx.fillText(`×${n}`, x + 14, DECOR_TOP + DECOR_H / 2 + 6)
        ctx.font = font(17, 700)
      }
      x += 30
    }
  }
  ctx.textBaseline = "alphabetic"
}

function drawTiles(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  const scroll = gs.scroll
  const firstR = Math.max(0, Math.floor((FARM_TOP - FARM_TOP + scroll - CELL) / (CELL + CELL_GAP)))
  const lastR = Math.min(gs.save.tiles.length - 1, Math.floor((FARM_BOTTOM - FARM_TOP + scroll) / (CELL + CELL_GAP)))

  for (let r = firstR; r <= lastR; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = gs.save.tiles[r]?.[c]
      if (!t) continue
      drawTile(ctx, gs, t, r, c, scroll, time)
    }
  }

  // selección
  if (gs.selTile && gs.sheet !== "none") {
    const { r, c } = gs.selTile
    const x = tileX(c), y = tileY(r, scroll)
    const pulse = 0.5 + Math.sin(time * 4) * 0.25
    ctx.strokeStyle = rgba("#ffffff", 0.5 + pulse * 0.3)
    ctx.lineWidth = 3
    roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 12)
    ctx.stroke()
  }
}

function drawTile(ctx: CanvasRenderingContext2D, gs: GS, t: TileState, r: number, c: number, scroll: number, time: number) {
  const x = tileX(c)
  const y = tileY(r, scroll)

  if (t.kind === "pond") {
    drawPond(ctx, gs, t, x, y, time)
    return
  }

  if (t.kind === "pasture") {
    drawPasture(ctx, gs, t, x, y, time)
    return
  }

  // suelo con cultivo
  drawSoil(ctx, t, x, y, time)
}

function soilFill(t: TileState): string {
  if (t.cropId && (t.cropProgress ?? 0) >= 1) return "#9c6b34"
  return SOIL
}

function drawSoil(ctx: CanvasRenderingContext2D, t: TileState, x: number, y: number, time: number) {
  ctx.save()
  ctx.fillStyle = soilFill(t)
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.fill()
  // surcos
  ctx.strokeStyle = rgba(SOIL_LINE, 0.6)
  ctx.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    const lx = x + 12 + i * (CELL - 24) / 2
    ctx.beginPath()
    ctx.moveTo(lx, y + 8)
    ctx.lineTo(lx + 6, y + CELL - 8)
    ctx.stroke()
  }
  ctx.strokeStyle = rgba(SOIL_DARK, 0.8)
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.stroke()
  ctx.restore()

  if (t.cropId) drawCrop(ctx, t, x, y, time)
  else {
    ctx.fillStyle = rgba("#3c2410", 0.5)
    ctx.font = font(14, 700)
    ctx.textAlign = "center"
    ctx.fillText("+", x + CELL / 2, y + CELL / 2 + 5)
  }
}

function drawCrop(ctx: CanvasRenderingContext2D, t: TileState, x: number, y: number, time: number) {
  const crop = cropDef(t.cropId!)
  if (!crop) return
  const p = t.cropProgress ?? 0
  const cx = x + CELL / 2
  const cy = y + CELL / 2 + 4
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  if (p >= 1) {
    const pulse = 1 + Math.sin(time * 3) * 0.04
    ctx.save()
    ctx.shadowColor = rgba("#ffd54a", 0.8)
    ctx.shadowBlur = 14
    ctx.font = font(CELL * 0.52, 800)
    ctx.translate(cx, cy)
    ctx.scale(pulse, pulse)
    ctx.fillText(crop.emoji, 0, 0)
    ctx.restore()
    // etiqueta "LISTO"
    ctx.fillStyle = "#ffd54a"
    ctx.font = font(9, 900)
    ctx.fillText("LISTO", cx, y + 13)
  } else if (p < 0.33) {
    ctx.font = font(CELL * 0.3, 700)
    ctx.fillText("🌱", cx, cy)
  } else if (p < 0.66) {
    ctx.font = font(CELL * 0.38, 700)
    ctx.fillText("🌿", cx, cy)
  } else {
    ctx.font = font(CELL * 0.42, 700)
    ctx.fillText(crop.emoji, cx, cy)
  }

  // barra de progreso
  ctx.fillStyle = "rgba(0,0,0,0.35)"
  roundRectPath(ctx, x + 8, y + CELL - 16, CELL - 16, 5, 3)
  ctx.fill()
  ctx.fillStyle = p >= 1 ? "#ffd54a" : "#7cff5a"
  roundRectPath(ctx, x + 8, y + CELL - 16, Math.max(4, (CELL - 16) * p), 5, 3)
  ctx.fill()

  // indicadores
  if (t.wateredToday) {
    ctx.font = font(11, 700)
    ctx.fillText("💧", x + 14, y + 13)
  }
  if (t.cropFert) {
    ctx.font = font(11, 700)
    ctx.fillText("✨", x + CELL - 12, y + 14)
  }
  ctx.textBaseline = "alphabetic"
}

function drawPasture(ctx: CanvasRenderingContext2D, gs: GS, t: TileState, x: number, y: number, time: number) {
  ctx.save()
  ctx.fillStyle = GRASS
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.fill()
  // mechones de hierba
  ctx.strokeStyle = rgba(GRASS_DARK, 0.7)
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) {
    const gx = x + 14 + i * (CELL - 28) / 3
    const gy = y + 12 + (i % 2) * 18
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + 3, gy - 7)
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + 6, gy - 6)
    ctx.stroke()
  }
  ctx.strokeStyle = rgba("#2f6b1e", 0.9)
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.stroke()
  ctx.restore()

  if (t.animalId) {
    const a = animalDef(t.animalId)!
    const bob = Math.sin(time * 2.4 + x * 0.1 + y) * 0.05
    const cx = x + CELL / 2
    const cy = y + CELL / 2 + 4 + bob * 8
    ctx.save()
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = "rgba(0,0,0,0.35)"
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 3
    ctx.font = font(CELL * 0.52, 700)
    ctx.fillText(a.emoji, cx, cy)
    ctx.restore()

    // raza
    ctx.fillStyle = "#ffd54a"
    ctx.font = font(9, 900)
    ctx.textAlign = "center"
    ctx.fillText(`✦${t.animalQuality ?? 1}`, cx + 18, y + 14)

    // felicidad
    const happy = t.animalHappy ?? 70
    ctx.font = font(12, 700)
    ctx.fillText(happy < 30 ? "😠" : happy < 60 ? "😐" : "😊", x + 14, y + 14)

    // barra de producción
    const prog = (t.animalProg ?? 0)
    ctx.fillStyle = "rgba(0,0,0,0.35)"
    roundRectPath(ctx, x + 8, y + CELL - 15, CELL - 16, 4, 2)
    ctx.fill()
    ctx.fillStyle = "#ffd54a"
    roundRectPath(ctx, x + 8, y + CELL - 15, Math.max(3, (CELL - 16) * Math.min(1, prog)), 4, 2)
    ctx.fill()
  } else {
    ctx.fillStyle = rgba("#2f6b1e", 0.7)
    ctx.font = font(14, 700)
    ctx.textAlign = "center"
    ctx.fillText("+", x + CELL / 2, y + CELL / 2 + 5)
  }
}

function drawPond(ctx: CanvasRenderingContext2D, gs: GS, t: TileState, x: number, y: number, time: number) {
  ctx.save()
  const g = ctx.createLinearGradient(0, y, 0, y + CELL)
  g.addColorStop(0, WATER)
  g.addColorStop(1, WATER_DEEP)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x + CELL / 2, y + CELL / 2, CELL * 0.46, CELL * 0.46, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = rgba("#1d5f8a", 0.9)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(x + CELL / 2, y + CELL / 2, CELL * 0.46, CELL * 0.46, 0, 0, Math.PI * 2)
  ctx.stroke()
  // ondas
  ctx.strokeStyle = "rgba(255,255,255,0.35)"
  ctx.lineWidth = 1.5
  for (let i = 0; i < 2; i++) {
    const wOff = Math.sin(time * 2 + i * 2) * 2
    ctx.beginPath()
    ctx.ellipse(x + CELL / 2 + wOff, y + CELL / 2 + i * 10 - 6, CELL * 0.24, 6, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  if (t.pondFish) {
    const f = fishDef(t.pondFish)!
    const bob = Math.sin(time * 2 + x) * 0.06
    ctx.save()
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = font(CELL * 0.4, 700)
    ctx.translate(x + CELL / 2, y + CELL / 2 + 4 + bob * 6)
    ctx.rotate(Math.sin(time * 1.6) * 0.12)
    ctx.fillText(f.emoji, 0, 0)
    ctx.restore()
    // stock
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    roundRectPath(ctx, x + 4, y + 4, 26, 16, 8)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = font(10, 800)
    ctx.textAlign = "center"
    ctx.fillText(`x${t.pondStock ?? 0}`, x + 17, y + 13)
  } else {
    ctx.fillStyle = rgba("#ffffff", 0.75)
    ctx.font = font(14, 700)
    ctx.textAlign = "center"
    ctx.fillText("+", x + CELL / 2, y + CELL / 2 + 5)
  }
}

// ---------------------------------------------------------------------------
// Efectos de clima
// ---------------------------------------------------------------------------

export function drawWeatherFx(ctx: CanvasRenderingContext2D, gs: GS) {
  const w = weatherDef(gs.save.weather)

  if (w.id === "lluvia" || w.id === "tormenta") {
    ctx.strokeStyle = "rgba(150,190,230,0.5)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (const d of gs.rain) {
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x - (w.id === "tormenta" ? 4 : 1), d.y + d.len)
    }
    ctx.stroke()
  }

  if (w.id === "helada") {
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    for (const s of gs.snow) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = "rgba(220,235,255,0.22)"
    ctx.fillRect(0, 0, W, H)
  }

  if (w.id === "calor") {
    ctx.fillStyle = "rgba(255,160,60,0.12)"
    ctx.fillRect(0, 0, W, H)
  }

  if (w.id === "sequia") {
    ctx.fillStyle = "rgba(160,120,60,0.12)"
    ctx.fillRect(0, 0, W, H)
  }

  if (w.id === "tormenta" && gs.lightningT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, gs.lightningT * 6)})`
    ctx.fillRect(0, 0, W, H)
  }

  // barras de progreso del día en la parte superior? (en ui.ts)
}

export function drawFloatersAndSparks(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const f of gs.floaters) {
    const a = Math.max(0, f.life / f.maxLife)
    ctx.globalAlpha = a
    ctx.fillStyle = f.color
    ctx.font = font(f.size, 800)
    ctx.textAlign = "center"
    ctx.fillText(f.text, f.x, f.y)
  }
  for (const s of gs.sparks) {
    const a = Math.max(0, s.life / s.maxLife)
    ctx.globalAlpha = a
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}