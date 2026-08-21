import {
  W, H, CELL, GAP, COLS, GRID_MARGIN, WORLD_TOP,
  cropDef, animalDef, fishDef, weatherDef, BUILDINGS,
  tileWorldX, tileWorldY,
} from "./constants"
import type { GS, Tool } from "./types"
import type { TileState } from "./save"
import { font, rgba, roundRectPath } from "../lib/gameKit"

const TILE_STRIDE = CELL + GAP

function sx(gs: GS, wx: number): number { return wx - gs.camX }
function sy(gs: GS, wy: number): number { return wy - gs.camY }

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

  if (w.id === "soleado" || w.id === "calor") {
    ctx.save()
    ctx.shadowColor = "rgba(255,230,120,0.9)"; ctx.shadowBlur = 40
    ctx.fillStyle = "#ffe882"
    ctx.beginPath(); ctx.arc(410, 66, 32, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  if (w.id === "helada") {
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.beginPath(); ctx.arc(410, 66, 24, 0, Math.PI * 2); ctx.fill()
  }

  ctx.fillStyle = "rgba(255,255,255,0.35)"
  drawCloud(ctx, 90 + Math.sin(time * 0.3) * 12, 52, 40)
  drawCloud(ctx, 260 + Math.sin(time * 0.22 + 2) * 10, 82, 28)

  // campo de hierba de fondo (rellena toda la vista)
  const fg = ctx.createLinearGradient(0, WORLD_TOP, 0, H)
  fg.addColorStop(0, GRASS); fg.addColorStop(1, "#3f8a2a")
  ctx.fillStyle = fg
  ctx.fillRect(0, WORLD_TOP, W, H - WORLD_TOP)

  drawTiles(ctx, gs, time)
  drawPlayer(ctx, gs)
  drawMoveTarget(ctx, gs, time)

  drawWeatherFx(ctx, gs)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.arc(x, y, s * 0.5, 0, Math.PI * 2)
  ctx.arc(x + s * 0.5, y + s * 0.15, s * 0.4, 0, Math.PI * 2)
  ctx.arc(x - s * 0.45, y + s * 0.12, s * 0.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawTiles(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  const rows = gs.save.tiles.length
  const firstCol = Math.max(0, Math.floor((gs.camX - GRID_MARGIN) / TILE_STRIDE) - 1)
  const lastCol = Math.min(COLS - 1, Math.floor((gs.camX + W) / TILE_STRIDE) + 1)
  const firstRow = Math.max(0, Math.floor((gs.camY - GRID_MARGIN) / TILE_STRIDE) - 1)
  const lastRow = Math.min(rows - 1, Math.floor((gs.camY + H) / TILE_STRIDE) + 1)

  for (let r = firstRow; r <= lastRow; r++) {
    for (let c = firstCol; c <= lastCol; c++) {
      const t = gs.save.tiles[r]?.[c]
      if (!t) continue
      const wx = tileWorldX(c)
      const wy = tileWorldY(r)
      const x = sx(gs, wx)
      const y = sy(gs, wy)
      if (x + CELL < -10 || x > W + 10 || y + CELL < WORLD_TOP - 10 || y > H + 10) continue
      drawTile(ctx, gs, t, r, c, x, y, time)
    }
  }
}

function drawTile(ctx: CanvasRenderingContext2D, gs: GS, t: TileState, r: number, c: number, x: number, y: number, time: number) {
  if (t.building) {
    drawBuildingTile(ctx, t, x, y, time)
    return
  }
  switch (t.kind) {
    case "grass":
      drawGrass(ctx, t, x, y)
      break
    case "pond":
      drawPond(ctx, gs, t, x, y, time)
      break
    case "pasture":
      drawPasture(ctx, gs, t, x, y, time)
      break
    default:
      drawSoil(ctx, t, x, y, time)
  }

  // marcador de acción pendiente
  if (gs.pending && gs.pending.r === r && gs.pending.c === c) {
    const pulse = 0.6 + Math.sin(time * 5) * 0.3
    ctx.strokeStyle = rgba("#ffd54a", 0.4 + pulse * 0.3)
    ctx.lineWidth = 3
    roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
    ctx.stroke()
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, t: TileState, x: number, y: number) {
  ctx.save()
  ctx.fillStyle = GRASS
  roundRectPath(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 9)
  ctx.fill()
  ctx.strokeStyle = rgba(GRASS_DARK, 0.7)
  ctx.lineWidth = 1.5
  const h = (y * 7 + x * 13) % 100
  ctx.strokeStyle = rgba("#5fbf3f", 0.7)
  for (let i = 0; i < 4; i++) {
    const gx = x + 12 + i * (CELL - 24) / 3 + ((h + i * 7) % 6)
    const gy = y + 12 + (i % 2) * 22
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + 3, gy - 8)
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + 7, gy - 7)
    ctx.stroke()
  }
  if (h < 14) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.font = font(14, 700)
    ctx.fillText("🍄", x + CELL * 0.3, y + CELL * 0.65)
  } else if (h < 20) {
    ctx.fillStyle = "rgba(120,120,120,0.8)"
    ctx.beginPath(); ctx.ellipse(x + CELL * 0.7, y + CELL * 0.6, 7, 5, 0.4, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
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
  ctx.strokeStyle = rgba(SOIL_LINE, 0.6)
  ctx.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    const lx = x + 12 + i * (CELL - 24) / 2
    ctx.beginPath()
    ctx.moveTo(lx, y + 8)
    ctx.lineTo(lx + 5, y + CELL - 8)
    ctx.stroke()
  }
  ctx.strokeStyle = rgba(SOIL_DARK, 0.8)
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.stroke()
  ctx.restore()

  if (t.cropId) drawCrop(ctx, t, x, y, time)
}

function drawCrop(ctx: CanvasRenderingContext2D, t: TileState, x: number, y: number, time: number) {
  const crop = cropDef(t.cropId!)
  if (!crop) return
  const p = t.cropProgress ?? 0
  const cx = x + CELL / 2
  const cy = y + CELL / 2 + 2
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  if (p >= 1) {
    const pulse = 1 + Math.sin(time * 3) * 0.05
    ctx.save()
    ctx.shadowColor = rgba("#ffd54a", 0.8)
    ctx.shadowBlur = 12
    ctx.font = font(CELL * 0.52, 800)
    ctx.translate(cx, cy)
    ctx.scale(pulse, pulse)
    ctx.fillText(crop.emoji, 0, 0)
    ctx.restore()
    ctx.fillStyle = "#ffd54a"
    ctx.font = font(9, 900)
    ctx.fillText("LISTO", cx, y + 11)
  } else if (p < 0.33) {
    ctx.font = font(CELL * 0.34, 700)
    ctx.fillText("🌱", cx, cy)
  } else if (p < 0.66) {
    ctx.font = font(CELL * 0.42, 700)
    ctx.fillText("🌿", cx, cy)
  } else {
    ctx.font = font(CELL * 0.46, 700)
    ctx.fillText(crop.emoji, cx, cy)
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)"
  roundRectPath(ctx, x + 10, y + CELL - 12, CELL - 20, 4, 2)
  ctx.fill()
  ctx.fillStyle = p >= 1 ? "#ffd54a" : "#7cff5a"
  roundRectPath(ctx, x + 10, y + CELL - 12, Math.max(4, (CELL - 20) * p), 4, 2)
  ctx.fill()

  if (t.wateredToday) {
    ctx.font = font(10, 700)
    ctx.fillText("💧", x + 13, y + 12)
  }
  if (t.cropFert) {
    ctx.font = font(10, 700)
    ctx.fillText("✨", x + CELL - 12, y + 12)
  }
  ctx.textBaseline = "alphabetic"
}

function drawPasture(ctx: CanvasRenderingContext2D, gs: GS, t: TileState, x: number, y: number, time: number) {
  ctx.save()
  ctx.fillStyle = GRASS
  roundRectPath(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 9)
  ctx.fill()
  ctx.strokeStyle = rgba(GRASS_DARK, 0.8)
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
  roundRectPath(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 9)
  ctx.stroke()
  ctx.restore()

  if (t.animalId) {
    const a = animalDef(t.animalId)!
    const bob = Math.sin(time * 2.4 + x * 0.1 + y) * 0.05
    ctx.save()
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = "rgba(0,0,0,0.35)"
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 3
    ctx.font = font(CELL * 0.55, 700)
    ctx.fillText(a.emoji, x + CELL / 2, y + CELL / 2 + bob * 6)
    ctx.restore()

    ctx.fillStyle = "#ffd54a"
    ctx.font = font(9, 900)
    ctx.textAlign = "center"
    ctx.fillText(`✦${t.animalQuality ?? 1}`, x + CELL / 2 + 16, y + 12)
    const happy = t.animalHappy ?? 70
    ctx.font = font(11, 700)
    ctx.fillText(happy < 30 ? "😠" : happy < 60 ? "😐" : "😊", x + 13, y + 13)

    const prog = (t.animalProg ?? 0)
    ctx.fillStyle = "rgba(0,0,0,0.35)"
    roundRectPath(ctx, x + 8, y + CELL - 11, CELL - 16, 4, 2)
    ctx.fill()
    ctx.fillStyle = "#ffd54a"
    roundRectPath(ctx, x + 8, y + CELL - 11, Math.max(3, (CELL - 16) * Math.min(1, prog)), 4, 2)
    ctx.fill()
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
  ctx.strokeStyle = "rgba(255,255,255,0.35)"
  ctx.lineWidth = 1.5
  for (let i = 0; i < 2; i++) {
    const wOff = Math.sin(time * 2 + i * 2) * 2
    ctx.beginPath()
    ctx.ellipse(x + CELL / 2 + wOff, y + CELL / 2 + i * 9 - 6, CELL * 0.24, 6, 0, 0, Math.PI * 2)
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
    ctx.translate(x + CELL / 2, y + CELL / 2 + 4 + bob * 5)
    ctx.rotate(Math.sin(time * 1.6) * 0.12)
    ctx.fillText(f.emoji, 0, 0)
    ctx.restore()
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    roundRectPath(ctx, x + 4, y + 4, 24, 15, 8)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = font(10, 800)
    ctx.textAlign = "center"
    ctx.fillText(`x${t.pondStock ?? 0}`, x + 16, y + 12)
  }
}

function drawBuildingTile(ctx: CanvasRenderingContext2D, t: TileState, x: number, y: number, time: number) {
  const b = BUILDINGS.find(bd => bd.id === t.building)
  // base
  ctx.fillStyle = t.kind === "pond" ? WATER_DEEP : t.kind === "pasture" ? GRASS_DARK : SOIL_DARK
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.fill()
  ctx.fillStyle = "rgba(0,0,0,0.25)"
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.fill()
  ctx.strokeStyle = "rgba(0,0,0,0.25)"
  ctx.lineWidth = 2
  roundRectPath(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 10)
  ctx.stroke()

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  if (t.kind === "pond") {
    // estanque construido
    ctx.fillStyle = WATER
    ctx.beginPath()
    ctx.ellipse(x + CELL / 2, y + CELL / 2, CELL * 0.44, CELL * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = font(CELL * 0.4, 700)
    ctx.fillText("🐟", x + CELL / 2, y + CELL / 2 + 2)
    return
  }
  if (t.kind === "pasture") {
    ctx.fillStyle = GRASS
    roundRectPath(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 8)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.6)"
    ctx.font = font(14, 700)
    ctx.fillText("🪧", x + CELL / 2, y + CELL / 2 + 2)
    return
  }
  if (b) {
    const bob = b.id === "molino" ? Math.sin(time * 3) * 3 : 0
    ctx.font = font(CELL * 0.6, 700)
    ctx.fillText(b.emoji, x + CELL / 2, y + CELL / 2 + bob)
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(8, 800)
    ctx.fillText(b.name.length > 10 ? b.name.slice(0, 10) + "…" : b.name, x + CELL / 2, y + CELL - 7)
  }
}

// ---------------------------------------------------------------------------
// Personaje
// ---------------------------------------------------------------------------

function toolGlyph(tool: Tool): string {
  switch (tool) {
    case "plow": return "🪓"
    case "plant": return "🌱"
    case "water": return "💧"
    case "harvest": return "🌾"
    case "fish": return "🎣"
    case "build": return "🔨"
    case "criar": return "🐣"
    default: return ""
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS) {
  const p = gs.player
  const x = sx(gs, p.x)
  const y = sy(gs, p.y)

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.3)"
  ctx.beginPath()
  ctx.ellipse(x, y + 18, 16, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  const moving = p.moving
  const working = p.working

  const facing = p.facing
  const bobY = moving ? Math.abs(Math.sin(p.animT * 2)) * -3 : working ? Math.abs(Math.sin(p.animT)) * -2 : 0
  const px = x
  const py = y + bobY

  ctx.save()
  ctx.translate(px, py)
  ctx.scale(facing, 1)

  // piernas
  ctx.fillStyle = "#4a3a2c"
  const legOff = moving ? Math.sin(p.animT * 2) * 5 : working ? Math.sin(p.animT) * 4 : 0
  ctx.fillStyle = "#4a3a2c"
  roundRectPath(ctx, -7, 8 + legOff * 0.4, 6, 10, 3)
  ctx.fill()
  roundRectPath(ctx, 1, 8 - legOff * 0.4, 6, 10, 3)
  ctx.fill()
  // botas
  ctx.fillStyle = "#5b4632"
  ctx.beginPath()
  ctx.ellipse(-4, 19 + legOff * 0.5, 5, 3, 0, 0, Math.PI * 2)
  ctx.ellipse(4, 19 - legOff * 0.5, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // torso
  const g = ctx.createLinearGradient(0, -16, 0, 10)
  g.addColorStop(0, "#6fbf4f")
  g.addColorStop(1, "#4f9a38")
  ctx.fillStyle = g
  roundRectPath(ctx, -11, -16, 22, 26, 8)
  ctx.fill()
  // cinturón
  ctx.fillStyle = "#5b4632"
  roundRectPath(ctx, -11, 4, 22, 4, 2)
  ctx.fill()

  // brazos
  ctx.strokeStyle = "#6fbf4f"
  ctx.lineWidth = 6
  ctx.lineCap = "round"
  const armPhase = moving ? -legOff * 0.6 : working ? -Math.sin(p.animT) * 5 : 0
  ctx.beginPath()
  ctx.moveTo(-8, -12)
  ctx.lineTo(-13, -2 + armPhase)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(8, -12)
  ctx.lineTo(13, -2 - armPhase)
  ctx.stroke()
  // manos
  ctx.fillStyle = "#f1c27d"
  ctx.beginPath()
  ctx.arc(-13, -2 + armPhase, 3, 0, Math.PI * 2)
  ctx.arc(13, -2 - armPhase, 3, 0, Math.PI * 2)
  ctx.fill()

  // cabeza
  ctx.fillStyle = "#f1c27d"
  ctx.beginPath()
  ctx.arc(0, -22, 10, 0, Math.PI * 2)
  ctx.fill()

  // sombrero de paja
  ctx.fillStyle = "#e3b25e"
  ctx.beginPath()
  ctx.ellipse(0, -30, 15, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#d9a34a"
  ctx.beginPath()
  ctx.arc(0, -30, 8, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = "#c68a35"
  roundRectPath(ctx, -5, -33, 10, 4, 2)
  ctx.fill()

  // herramienta al trabajar
  if (working) {
    const glyph = toolGlyph(p.workTool)
    if (glyph) {
      const swing = Math.sin(p.animT * 2) * 0.4
      ctx.save()
      ctx.translate(16, -10)
      ctx.rotate(swing)
      ctx.font = font(20, 700)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(glyph, 0, 0)
      ctx.restore()
    }
  }

  ctx.restore()
}

function drawMoveTarget(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  const p = gs.player
  if (!p.moving) return
  const x = sx(gs, p.tx)
  const y = sy(gs, p.ty)
  const bounce = Math.sin(time * 6) * 4
  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = "#ffd54a"
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(0,0,0,0.4)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y + 8 + bounce)
  ctx.lineTo(x - 5, y + 16 + bounce)
  ctx.lineTo(x + 5, y + 16 + bounce)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
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

  if (w.id === "calor") ctx.fillStyle = "rgba(255,160,60,0.12)"
  if (w.id === "sequia") ctx.fillStyle = "rgba(160,120,60,0.12)"
  if (w.id === "calor" || w.id === "sequia") ctx.fillRect(0, 0, W, H)

  if (w.id === "tormenta" && gs.lightningT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, gs.lightningT * 6)})`
    ctx.fillRect(0, 0, W, H)
  }
}

export function drawFloatersAndSparks(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const f of gs.floaters) {
    const a = Math.max(0, f.life / f.maxLife)
    ctx.globalAlpha = a
    ctx.fillStyle = f.color
    ctx.font = font(f.size, 800)
    ctx.textAlign = "center"
    ctx.fillText(f.text, sx(gs, f.x), sy(gs, f.y))
  }
  for (const s of gs.sparks) {
    const a = Math.max(0, s.life / s.maxLife)
    ctx.globalAlpha = a
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(sx(gs, s.x), sy(gs, s.y), s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function worldToScreen(gs: GS, wx: number, wy: number): { x: number; y: number } {
  return { x: sx(gs, wx), y: sy(gs, wy) }
}

export function screenToWorld(gs: GS, x: number, y: number): { x: number; y: number } {
  return { x: x + gs.camX, y: y + gs.camY }
}