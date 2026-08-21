import {
  W, H, WORLD_TOP, WORLD_BOTTOM, TOOLBAR_H, PICKER_H,
  CONFIG, TAX_INTERVAL, DAY_LENGTH, ACCENT,
  cropDef, animalDef, fishDef, productDef, weatherDef,
  qualityMult, storageMax, breedCost, breedChance, farmLevel, BUILDINGS, TOOLS,
} from "./constants"
import { inventoryUsed } from "./save"
import { drawWorld, drawFloatersAndSparks } from "./draw"
import { countCrops, countAnimals, wildlifeCount } from "./engine"
import type { GS, Tool } from "./types"
import { font, rgba, roundRectPath, drawButton, drawPanel, drawPill, drawOnboard } from "../lib/gameKit"

const GOLD = "#ffd54a"
const GREEN = "#7cff5a"
const BLUE = "#7cc4ff"
const RED = "#ff8a80"

function addBtn(gs: GS, action: string, x: number, y: number, w: number, h: number) {
  gs.btns.push({ action, x, y, w, h })
}

function drawPanelTone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 18) {
  drawPanel(ctx, x, y, w, h, r, "rgba(14,18,28,0.82)")
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------

export function drawIntro(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  drawWorld(ctx, gs, time)
  const btn = drawOnboard(ctx, W, H, {
    title: "ECOGranja",
    subtitle: "Explora tu granja en mundo abierto: camina hasta cualquier parcela y usa tus herramientas.",
    how: [
      "👆 Toca el suelo para moverte; el granjero camina o corre.",
      "🪓 Arar la tierra, 🌱 sembrar y 💧 regar en cada parcela.",
      "🏗️ Construye vallas, estanques, pastizales y edificios.",
      "Vende en el mercado, paga impuestos y contrata personal.",
    ],
    scoring: "Gana fama ⭐ vendiendo para desbloquear especies premium.",
    accent: ACCENT,
    playLabel: "COMENZAR",
  })
  gs.btns.push({ action: "intro:play", x: btn.x, y: btn.y, w: btn.w, h: btn.h })

  const mBtn = { x: W - 52, y: 12, w: 40, h: 40 }
  ctx.fillStyle = "rgba(15,16,32,0.55)"
  ctx.beginPath(); ctx.arc(mBtn.x + 20, mBtn.y + 20, 20, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = font(18, 700)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(gs.muted ? "🔇" : "🔊", mBtn.x + 20, mBtn.y + 21)
  gs.btns.push({ action: "mute", x: mBtn.x, y: mBtn.y, w: mBtn.w, h: mBtn.h })
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function drawTopBar(ctx: CanvasRenderingContext2D, gs: GS) {
  const s = gs.save
  const w = weatherDef(s.weather)

  // fila 1
  drawPill(ctx, 10, 8, `🪙 ${s.coins.toLocaleString()}`, { accent: GOLD, icon: "" })
  drawPill(ctx, W / 2, 8, `Día ${s.day} · ${w.emoji} ${w.name}`, { accent: w.id === "soleado" ? GOLD : BLUE, align: "center", icon: "" })
  const mBtn = { x: W - 46, y: 10, w: 36, h: 36 }
  ctx.fillStyle = "rgba(15,16,32,0.55)"
  ctx.beginPath(); ctx.arc(mBtn.x + 18, mBtn.y + 18, 18, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = font(16, 700)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(gs.muted ? "🔇" : "🔊", mBtn.x + 18, mBtn.y + 18)
  addBtn(gs, "mute", mBtn.x, mBtn.y, mBtn.w, mBtn.h)

  // fila 2
  const used = inventoryUsed(s)
  const cap = storageMax(s)
  const storageColor = used > cap ? RED : used > cap * 0.8 ? GOLD : GREEN
  drawPill(ctx, 10, 46, `⭐ ${s.fame.toLocaleString()}`, { accent: GOLD, icon: "" })
  drawPill(ctx, W / 2 - 30, 46, `📦 ${used}/${cap}`, { accent: storageColor, align: "center", icon: "" })
  drawPill(ctx, W - 10, 46, `👷 ${s.ownedStaff.length}`, { accent: BLUE, align: "right", icon: "" })
  if (s.taxesOwed > 0) {
    const tw = Math.round(ctx.measureText(`⚠️ $${s.taxesOwed}`).width) + 34
    const tbtn = { x: W / 2 - tw / 2, y: 44, w: tw, h: 28 }
    ctx.fillStyle = "#d63031"
    roundRectPath(ctx, tbtn.x, tbtn.y, tbtn.w, tbtn.h, 14)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = font(11, 900)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`⚠️ $${s.taxesOwed}`, tbtn.x + tbtn.w / 2, tbtn.y + tbtn.h / 2 + 1)
    addBtn(gs, "modal:tax", tbtn.x, tbtn.y, tbtn.w, tbtn.h)
  }

  // fila 3: progreso del día + avanzar
  const barX = 16, barW = W - 150, barY = 88, barH = 9
  ctx.fillStyle = "rgba(255,255,255,0.15)"
  roundRectPath(ctx, barX, barY, barW, barH, barH / 2)
  ctx.fill()
  const pct = Math.min(1, gs.dayTime / DAY_LENGTH)
  if (pct > 0) {
    ctx.fillStyle = GOLD
    roundRectPath(ctx, barX, barY, Math.max(barH, barW * pct), barH, barH / 2)
    ctx.fill()
  }
  const daysToTax = TAX_INTERVAL - (s.day % TAX_INTERVAL)
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.font = font(9, 600)
  ctx.textAlign = "left"
  ctx.fillText(`Impuestos en ${daysToTax}d`, barX, barY + 20)

  const nextBtn = { x: W - 126, y: 82, w: 110, h: 28 }
  drawButton(ctx, nextBtn.x + nextBtn.w / 2, nextBtn.y + nextBtn.h / 2, nextBtn.w, nextBtn.h, "▶ Día+1", {
    color: ACCENT, textColor: "#0c2410", fontSize: 12,
  })
  addBtn(gs, "day:advance", nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h)
}

// ---------------------------------------------------------------------------
// Rail de navegación (menús)
// ---------------------------------------------------------------------------

const RAIL_BTNS: Array<{ action: string; glyph: string; label: string }> = [
  { action: "tab:shop", glyph: "🛒", label: "Tienda" },
  { action: "tab:market", glyph: "💰", label: "Mercado" },
  { action: "tab:staff", glyph: "👷", label: "Personal" },
  { action: "tab:eco", glyph: "🦊", label: "Eco" },
  { action: "modal:help", glyph: "?", label: "Ayuda" },
]

function drawNavRail(ctx: CanvasRenderingContext2D, gs: GS) {
  const size = 42
  const gap = 10
  const startY = WORLD_TOP + 6
  for (let i = 0; i < RAIL_BTNS.length; i++) {
    const b = RAIL_BTNS[i]
    const x = W - size - 8
    const y = startY + i * (size + gap)
    ctx.fillStyle = "rgba(15,16,32,0.6)"
    ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = rgba(ACCENT, 0.3)
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = "#fff"
    ctx.font = font(16, 700)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(b.glyph, x + size / 2, y + size / 2 + 1)
    addBtn(gs, b.action, x, y, size, size)
  }
}

// ---------------------------------------------------------------------------
// Barra de herramientas
// ---------------------------------------------------------------------------

function drawToolbar(ctx: CanvasRenderingContext2D, gs: GS) {
  const tbY = H - TOOLBAR_H
  ctx.fillStyle = "rgba(10,14,20,0.92)"
  ctx.fillRect(0, tbY, W, TOOLBAR_H)
  ctx.fillStyle = "rgba(255,255,255,0.08)"
  ctx.fillRect(0, tbY, W, 2)

  const n = TOOLS.length
  const bw = W / n
  for (let i = 0; i < n; i++) {
    const t = TOOLS[i]
    const x = i * bw
    const active = gs.tool === t.id
    ctx.fillStyle = active ? rgba(ACCENT, 0.18) : "transparent"
    ctx.fillRect(x, tbY + 2, bw, TOOLBAR_H - 2)
    if (active) {
      ctx.fillStyle = ACCENT
      roundRectPath(ctx, x + 10, tbY + 6, bw - 20, 3, 2)
      ctx.fill()
    }
    ctx.textAlign = "center"
    ctx.font = font(24, 700)
    ctx.fillText(t.glyph, x + bw / 2, tbY + 44)
    ctx.fillStyle = active ? ACCENT : "rgba(255,255,255,0.5)"
    ctx.font = font(11, 800)
    ctx.fillText(t.label, x + bw / 2, tbY + 66)
    addBtn(gs, `tool:${t.id}`, x, tbY, bw, TOOLBAR_H)
  }

  // contador de trabajos encolados
  const pendingCount = gs.queue.length + (gs.pending ? 1 : 0)
  if (pendingCount > 0) {
    const badge = { x: W - 52, y: tbY + 8, w: 36, h: 24 }
    ctx.fillStyle = "#ffd54a"
    roundRectPath(ctx, badge.x, badge.y, badge.w, badge.h, 12)
    ctx.fill()
    ctx.fillStyle = "#2a1e00"
    ctx.font = font(13, 900)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`x${pendingCount}`, badge.x + badge.w / 2, badge.y + badge.h / 2 + 1)
  }
}

// ---------------------------------------------------------------------------
// Selector de opciones (semillas / construcciones / animales)
// ---------------------------------------------------------------------------

function pickerOptions(gs: GS): Array<{ id: string; glyph: string; cost: string }> {
  switch (gs.tool) {
    case "plant":
      return gs.save.unlockedCrops.map(id => {
        const c = cropDef(id)!
        return { id, glyph: c.emoji, cost: `$${c.buy}` }
      })
    case "build":
      return BUILDINGS.map(b => ({ id: b.id, glyph: b.emoji, cost: `$${b.cost}` }))
    case "criar":
      return gs.save.unlockedAnimals.map(id => {
        const a = animalDef(id)!
        return { id, glyph: a.emoji, cost: `$${a.buy}` }
      })
    case "fish":
      return gs.save.unlockedFish.map(id => {
        const f = fishDef(id)!
        return { id, glyph: f.emoji, cost: `$${f.fryCost}` }
      })
    default:
      return []
  }
}

function toolNeedsPicker(tool: Tool): boolean {
  return tool === "plant" || tool === "build" || tool === "criar" || tool === "fish"
}

function drawPicker(ctx: CanvasRenderingContext2D, gs: GS) {
  if (!toolNeedsPicker(gs.tool)) return
  const opts = pickerOptions(gs)
  if (opts.length === 0) return
  const py = H - TOOLBAR_H - PICKER_H
  ctx.fillStyle = "rgba(10,14,20,0.9)"
  ctx.fillRect(0, py, W, PICKER_H)

  const itemW = 64
  const gap = 8
  const total = opts.length * (itemW + gap) - gap
  let startX = (W - total) / 2
  if (total > W) { startX = 6 }  // compacto si hay muchos
  for (const o of opts) {
    if (startX + itemW > W) break
    const selected = gs.selOption === o.id
    ctx.fillStyle = selected ? rgba(ACCENT, 0.25) : "rgba(255,255,255,0.07)"
    roundRectPath(ctx, startX, py + 6, itemW, PICKER_H - 12, 10)
    ctx.fill()
    if (selected) {
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 2
      roundRectPath(ctx, startX, py + 6, itemW, PICKER_H - 12, 10)
      ctx.stroke()
    }
    ctx.textAlign = "center"
    ctx.font = font(24, 700)
    ctx.fillText(o.glyph, startX + itemW / 2, py + 26)
    ctx.fillStyle = "rgba(255,255,255,0.6)"
    ctx.font = font(10, 800)
    ctx.fillText(o.cost, startX + itemW / 2, py + 42)
    addBtn(gs, `pick:${o.id}`, startX, py + 6, itemW, PICKER_H - 12)
    startX += itemW + gap
  }
}

// ---------------------------------------------------------------------------
// Hoja de animal y de cría
// ---------------------------------------------------------------------------

const SHEET_H = 360
const SHEET_TOP = H - SHEET_H - 8
export { SHEET_H, SHEET_TOP }

function sheetHeader(ctx: CanvasRenderingContext2D, gs: GS, title: string) {
  drawPanelTone(ctx, 8, SHEET_TOP, W - 16, SHEET_H, 22)
  ctx.fillStyle = "#fff"
  ctx.font = font(17, 900)
  ctx.textAlign = "left"
  ctx.fillText(title, 24, SHEET_TOP + 28)
  ctx.font = font(14, 800)
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.fillText("✕", W - 32, SHEET_TOP + 28)
  addBtn(gs, "sheet:close", W - 52, SHEET_TOP + 8, 44, 34)
}

function drawAnimalSheet(ctx: CanvasRenderingContext2D, gs: GS) {
  const m = gs.menuTile
  if (!m) return
  const t = gs.save.tiles[m.r][m.c]
  if (!t.animalId) { gs.sheet = "none"; return }
  const a = animalDef(t.animalId)!
  const happy = t.animalHappy ?? 70
  const sellPrice = Math.round(a.sell * qualityMult(t.animalQuality ?? 1))

  sheetHeader(ctx, gs, `${a.emoji} ${a.name} · raza ${t.animalQuality ?? 1}`)
  const cx = W / 2

  ctx.textAlign = "center"
  ctx.font = font(12, 700)
  ctx.fillStyle = "rgba(255,255,255,0.8)"
  ctx.fillText(`Felicidad ${happy}% ${happy < 30 ? "😠" : happy < 60 ? "😐" : "😊"} · ${a.desc}`, cx, SHEET_TOP + 56)
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.font = font(10, 600)
  ctx.fillText(`Produce ${a.productEmoji} cada ${a.produceDays}d · comida $${a.feed}/día`, cx, SHEET_TOP + 78)

  const by = SHEET_TOP + 120
  const bw1 = (W - 56) / 2
  const b1 = { x: 16, y: by, w: bw1, h: 54 }
  drawButton(ctx, b1.x + b1.w / 2, b1.y + b1.h / 2, b1.w, b1.h, "🍽️ Alimentar", { color: GOLD, textColor: "#2a1e00", fontSize: 14 })
  addBtn(gs, `feed:${m.r}:${m.c}`, b1.x, b1.y, b1.w, b1.h)

  const b2 = { x: W - 16 - bw1, y: by, w: bw1, h: 54 }
  drawButton(ctx, b2.x + b2.w / 2, b2.y + b2.h / 2, b2.w, b2.h, `🐣 Criar ($${breedCost(t.animalQuality ?? 1)})`, { color: GREEN, textColor: "#0c2410", fontSize: 13 })
  addBtn(gs, `breed:${m.r}:${m.c}`, b2.x, b2.y, b2.w, b2.h)

  const by2 = by + 66
  const b3 = { x: 16, y: by2, w: W - 32, h: 54 }
  drawButton(ctx, b3.x + b3.w / 2, b3.y + b3.h / 2, b3.w, b3.h, `🪙 Vender $${sellPrice}`, { color: RED, textColor: "#2a0a0a", fontSize: 15 })
  addBtn(gs, `sellanimal:${m.r}:${m.c}`, b3.x, b3.y, b3.w, b3.h)

  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.font = font(10, 600)
  ctx.textAlign = "center"
  ctx.fillText("Para más animales: selecciona 🐔 Criar y toca un pastizal vacío.", cx, SHEET_TOP + SHEET_H - 26)
}

function drawBreedSheet(ctx: CanvasRenderingContext2D, gs: GS) {
  const bt = gs.breedTarget
  if (!bt) return
  const t = gs.save.tiles[bt.r][bt.c]
  if (!t.animalId) { gs.sheet = "none"; return }
  const a = animalDef(t.animalId)!
  const cost = breedCost(t.animalQuality ?? 1)
  const chancePct = Math.round(breedChance(t.animalQuality ?? 1) * 100)

  sheetHeader(ctx, gs, `🐣 Criar ${a.emoji} ${a.name}`)
  ctx.textAlign = "center"
  ctx.font = font(12, 700)
  ctx.fillStyle = "rgba(255,255,255,0.8)"
  ctx.fillText(`Coste $${cost} · Probabilidad de raza +1: ${chancePct}%`, W / 2, SHEET_TOP + 52)
  ctx.font = font(10, 600)
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.fillText("Elige un ejemplar de la misma especie. Necesitas un pastizal libre.", W / 2, SHEET_TOP + 72)

  const mates: Array<{ r: number; c: number; q: number }> = []
  for (let rr = 0; rr < gs.save.tiles.length; rr++) {
    for (let cc = 0; cc < gs.save.tiles[rr].length; cc++) {
      if (rr === bt.r && cc === bt.c) continue
      const mt = gs.save.tiles[rr][cc]
      if (mt.animalId === t.animalId) mates.push({ r: rr, c: cc, q: mt.animalQuality ?? 1 })
    }
  }

  if (mates.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(12, 700)
    ctx.textAlign = "center"
    ctx.fillText("Necesitas otro ejemplar de la misma especie", W / 2, SHEET_TOP + 130)
    return
  }

  let y = SHEET_TOP + 96
  for (const m of mates) {
    if (y > SHEET_TOP + SHEET_H - 40) break
    ctx.fillStyle = "rgba(255,255,255,0.06)"
    roundRectPath(ctx, 20, y, W - 40, 52, 10)
    ctx.fill()
    ctx.textAlign = "left"
    ctx.font = font(22, 700)
    ctx.fillText(a.emoji, 30, y + 27)
    ctx.fillStyle = "#fff"
    ctx.font = font(11, 800)
    ctx.fillText(`${a.name} (${m.r + 1},${m.c + 1})`, 58, y + 20)
    ctx.fillStyle = GOLD
    ctx.font = font(10, 800)
    ctx.fillText(`✦ raza ${m.q}`, 58, y + 38)
    const b = { x: W - 104, y: y + 9, w: 72, h: 34 }
    drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `$${cost}`, { color: GREEN, textColor: "#0c2410", fontSize: 12 })
    addBtn(gs, `dobreed:${bt.r}:${bt.c}:${m.r}:${m.c}`, b.x, b.y, b.w, b.h)
    y += 60
  }
}

// ---------------------------------------------------------------------------
// Pesca
// ---------------------------------------------------------------------------

function drawFishing(ctx: CanvasRenderingContext2D, gs: GS) {
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.fillRect(0, 0, W, H)
  const bx = 40, bw = W - 80, by = WORLD_BOTTOM - 90, bh = 46
  ctx.fillStyle = "rgba(15,16,32,0.9)"
  roundRectPath(ctx, bx - 12, by - 40, bw + 24, bh + 60, 18)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = font(16, 900)
  ctx.textAlign = "center"
  ctx.fillText("🎣 Pesca: toca para soltar", W / 2, by - 16)

  ctx.fillStyle = "rgba(255,255,255,0.12)"
  roundRectPath(ctx, bx, by, bw, bh, bh / 2)
  ctx.fill()
  const zx = bx + gs.fishing.zone * bw - (gs.fishing.zoneW * bw) / 2
  const zw = gs.fishing.zoneW * bw
  ctx.fillStyle = "rgba(255,212,74,0.85)"
  roundRectPath(ctx, zx, by, zw, bh, bh / 2)
  ctx.fill()
  const prog = Math.min(1, gs.fishing.t / gs.fishing.dur)
  const marker = Math.abs(1 - prog * 2)
  const mx = bx + marker * bw
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.moveTo(mx, by - 6)
  ctx.lineTo(mx - 8, by - 22)
  ctx.lineTo(mx + 8, by - 22)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = "#fff"
  roundRectPath(ctx, mx - 3, by - 2, 6, bh + 4, 3)
  ctx.fill()
}

// ---------------------------------------------------------------------------
// Menús (tienda, mercado, personal, ecosistema)
// ---------------------------------------------------------------------------

function drawMenuHeader(ctx: CanvasRenderingContext2D, gs: GS, title: string, rightText: string, accent = GOLD) {
  drawPanelTone(ctx, 8, 8, W - 16, H - 16, 22)
  ctx.fillStyle = "#fff"
  ctx.font = font(18, 900)
  ctx.textAlign = "left"
  ctx.fillText(title, 24, 40)
  drawPill(ctx, W - 12, 16, rightText, { accent, align: "right", icon: "" })
}

interface SheetRow { h: number; draw: (y: number) => void }

function drawList(ctx: CanvasRenderingContext2D, gs: GS, rows: SheetRow[], top: number, bottom: number) {
  const contentH = rows.reduce((s, r) => s + r.h, 0)
  const maxS = Math.max(0, contentH - (bottom - top))
  gs.listScroll = Math.max(0, Math.min(gs.listScroll, maxS))
  let y = top - gs.listScroll
  for (const row of rows) {
    if (y + row.h >= top - 8 && y <= bottom + 8) row.draw(y)
    y += row.h
  }
  if (maxS > 0) {
    const thumbH = Math.max(20, (bottom - top) * ((bottom - top) / contentH))
    const tY = top + (bottom - top - thumbH) * (gs.listScroll / maxS)
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    roundRectPath(ctx, W - 8, tY, 4, thumbH, 2)
    ctx.fill()
  }
}

function drawShop(ctx: CanvasRenderingContext2D, gs: GS) {
  drawMenuHeader(ctx, gs, "🛒 Tienda", `⭐ ${gs.save.fame.toLocaleString()}`)

  const tabs: Array<{ id: string; label: string }> = [
    { id: "seeds", label: "Semillas" },
    { id: "animals", label: "Animales" },
    { id: "fish", label: "Peces" },
    { id: "decor", label: "Jardín" },
    { id: "extras", label: "Extras" },
  ]
  const tabW = (W - 40) / tabs.length
  for (let i = 0; i < tabs.length; i++) {
    const active = gs.shopTab === tabs[i].id
    const x = 20 + i * tabW
    ctx.fillStyle = active ? rgba(ACCENT, 0.2) : "rgba(255,255,255,0.06)"
    roundRectPath(ctx, x, 64, tabW - 4, 34, 8)
    ctx.fill()
    if (active) {
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 1.5
      roundRectPath(ctx, x, 64, tabW - 4, 34, 8)
      ctx.stroke()
    }
    ctx.fillStyle = active ? ACCENT : "rgba(255,255,255,0.6)"
    ctx.font = font(11, 800)
    ctx.textAlign = "center"
    ctx.fillText(tabs[i].label, x + (tabW - 4) / 2, 86)
    addBtn(gs, `shop:tab:${tabs[i].id}`, x, 64, tabW - 4, 34)
  }

  const top = 112
  const bottom = H - 96 - 8
  let rows: SheetRow[] = []

  if (gs.shopTab === "seeds") {
    rows = CONFIG.crops.map(crop => ({
      h: 62,
      draw: (y: number) => {
        const owned = gs.save.unlockedCrops.includes(crop.id)
        const locked = gs.save.fame < crop.unlockFame
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 52, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(locked ? "🔒" : crop.emoji, 30, y + 27)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(crop.name, 62, y + 19)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(`crece ${crop.growDays}d · da ${crop.yield}u · venta $${crop.price}`, 62, y + 36)
        const b = { x: W - 96, y: y + 8, w: 66, h: 36 }
        if (locked) {
          ctx.fillStyle = "rgba(255,255,255,0.4)"
          ctx.font = font(9, 700)
          ctx.textAlign = "center"
          ctx.fillText(`⭐ ${crop.unlockFame}`, b.x + b.w / 2, b.y + 12)
          ctx.font = font(8, 600)
          ctx.fillText("fama", b.x + b.w / 2, b.y + 25)
        } else if (owned) {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "✓", { color: "rgba(255,255,255,0.25)", textColor: "#fff", fontSize: 14 })
        } else {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "DESBLOQ.", { color: GOLD, textColor: "#2a1e00", fontSize: 10 })
          addBtn(gs, `shop:seed:${crop.id}`, b.x, b.y, b.w, b.h)
        }
      },
    }))
  } else if (gs.shopTab === "animals") {
    rows = CONFIG.animals.map(a => ({
      h: 62,
      draw: (y: number) => {
        const owned = gs.save.unlockedAnimals.includes(a.id)
        const locked = gs.save.fame < a.unlockFame
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 52, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(locked ? "🔒" : a.emoji, 30, y + 27)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(a.name, 62, y + 19)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(a.desc, 62, y + 36)
        const b = { x: W - 96, y: y + 8, w: 66, h: 36 }
        if (locked) {
          ctx.fillStyle = "rgba(255,255,255,0.4)"
          ctx.font = font(9, 700)
          ctx.textAlign = "center"
          ctx.fillText(`⭐ ${a.unlockFame}`, b.x + b.w / 2, b.y + 12)
          ctx.font = font(8, 600)
          ctx.fillText("fama", b.x + b.w / 2, b.y + 25)
        } else if (owned) {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "✓", { color: "rgba(255,255,255,0.25)", textColor: "#fff", fontSize: 14 })
        } else {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "DESBLOQ.", { color: GOLD, textColor: "#2a1e00", fontSize: 10 })
          addBtn(gs, `shop:animal:${a.id}`, b.x, b.y, b.w, b.h)
        }
      },
    }))
  } else if (gs.shopTab === "fish") {
    rows = CONFIG.fish.map(f => ({
      h: 62,
      draw: (y: number) => {
        const owned = gs.save.unlockedFish.includes(f.id)
        const locked = gs.save.fame < f.unlockFame
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 52, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(locked ? "🔒" : f.emoji, 30, y + 27)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(f.name, 62, y + 19)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(`alevines $${f.fryCost} · venta $${f.catchPrice}`, 62, y + 36)
        const b = { x: W - 96, y: y + 8, w: 66, h: 36 }
        if (locked) {
          ctx.fillStyle = "rgba(255,255,255,0.4)"
          ctx.font = font(9, 700)
          ctx.textAlign = "center"
          ctx.fillText(`⭐ ${f.unlockFame}`, b.x + b.w / 2, b.y + 12)
          ctx.font = font(8, 600)
          ctx.fillText("fama", b.x + b.w / 2, b.y + 25)
        } else if (owned) {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "✓", { color: "rgba(255,255,255,0.25)", textColor: "#fff", fontSize: 14 })
        } else {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "DESBLOQ.", { color: GOLD, textColor: "#2a1e00", fontSize: 10 })
          addBtn(gs, `shop:fish:${f.id}`, b.x, b.y, b.w, b.h)
        }
      },
    }))
  } else if (gs.shopTab === "decor") {
    rows = CONFIG.decorations.map(d => ({
      h: 62,
      draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 52, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(d.emoji, 30, y + 27)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(d.name, 62, y + 19)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(d.effect, 62, y + 36)
        const b = { x: W - 96, y: y + 8, w: 66, h: 36 }
        const owned = gs.save.decorations[d.id] ?? 0
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, owned > 0 ? `×${owned}` : `$${d.cost}`, { color: GREEN, textColor: "#0c2410", fontSize: 11 })
        addBtn(gs, `shop:decor:${d.id}`, b.x, b.y, b.w, b.h)
      },
    }))
  } else {
    rows = CONFIG.extras.map(e => ({
      h: 62,
      draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 52, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(e.emoji, 30, y + 27)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(e.name, 62, y + 19)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(e.effect, 62, y + 36)
        const b = { x: W - 96, y: y + 8, w: 66, h: 36 }
        const owned = e.id === "abono" ? gs.save.abono : gs.save.repelente
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, owned > 0 ? `×${owned}` : `$${e.cost}`, { color: GREEN, textColor: "#0c2410", fontSize: 12 })
        addBtn(gs, `shop:extra:${e.id}`, b.x, b.y, b.w, b.h)
      },
    }))
  }

  drawList(ctx, gs, rows, top, bottom)
}

function drawMarket(ctx: CanvasRenderingContext2D, gs: GS) {
  drawMenuHeader(ctx, gs, "💰 Mercado", `🪙 ${gs.save.coins.toLocaleString()}`)

  const sellAllBtn = { x: W - 130, y: 44, w: 106, h: 34 }
  drawButton(ctx, sellAllBtn.x + sellAllBtn.w / 2, sellAllBtn.y + sellAllBtn.h / 2, sellAllBtn.w, sellAllBtn.h, "VENDER TODO", {
    color: GOLD, textColor: "#2a1e00", fontSize: 11,
  })
  addBtn(gs, "market:sellall", sellAllBtn.x, sellAllBtn.y, sellAllBtn.w, sellAllBtn.h)

  const groups: Record<string, { productId: string; qty: number; value: number; avgQ: number }> = {}
  for (const k of Object.keys(gs.save.inventory)) {
    const [pid, qs] = k.split(":")
    const q = qs ? parseInt(qs, 10) : 1
    const p = productDef(pid)
    if (!p) continue
    const g = groups[pid] ?? { productId: pid, qty: 0, value: 0, avgQ: 0 }
    g.qty += gs.save.inventory[k]
    g.value += Math.round(p.basePrice * qualityMult(q)) * gs.save.inventory[k]
    g.avgQ += q * gs.save.inventory[k]
    groups[pid] = g
  }
  for (const pid of Object.keys(groups)) groups[pid].avgQ = Math.round(groups[pid].avgQ / groups[pid].qty)

  const rows: SheetRow[] = []
  if (Object.keys(groups).length === 0) {
    rows.push({ h: 90, draw: (y: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.5)"
      ctx.font = font(13, 700)
      ctx.textAlign = "center"
      ctx.fillText("No tienes productos para vender", W / 2, y + 40)
      ctx.font = font(10, 600)
      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.fillText("Siembra, pesca y cría para llenar el almacén 📦", W / 2, y + 58)
    } })
  } else {
    for (const pid of Object.keys(groups)) {
      const g = groups[pid]
      const p = productDef(pid)!
      rows.push({
        h: 62, draw: (y: number) => {
          ctx.fillStyle = "rgba(255,255,255,0.05)"
          roundRectPath(ctx, 20, y, W - 40, 52, 10)
          ctx.fill()
          ctx.textAlign = "left"
          ctx.font = font(24, 700)
          ctx.fillText(p.emoji, 30, y + 27)
          ctx.fillStyle = "#fff"
          ctx.font = font(12, 800)
          ctx.fillText(p.name, 62, y + 20)
          ctx.fillStyle = GOLD
          ctx.font = font(10, 800)
          ctx.fillText(`✦${g.avgQ}`, 62, y + 38)
          ctx.fillStyle = "rgba(255,255,255,0.5)"
          ctx.font = font(10, 600)
          ctx.fillText(`x${g.qty}`, 100, y + 38)
          ctx.fillStyle = "#fff"
          ctx.font = font(13, 900)
          ctx.fillText(`$${g.value}`, 170, y + 27)
          const b = { x: W - 96, y: y + 8, w: 66, h: 36 }
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "VENDER", { color: GREEN, textColor: "#0c2410", fontSize: 11 })
          addBtn(gs, `market:sell:${pid}`, b.x, b.y, b.w, b.h)
        },
      })
    }
  }
  drawList(ctx, gs, rows, 92, H - 96 - 8)
}

function drawStaff(ctx: CanvasRenderingContext2D, gs: GS) {
  drawMenuHeader(ctx, gs, "👷 Personal", `🪙 ${gs.save.coins.toLocaleString()}`)

  const rows: SheetRow[] = []
  rows.push({ h: 40, draw: (y: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(11, 700)
    ctx.textAlign = "center"
    ctx.fillText("Trabajan al final de cada día; el salario se descuenta a diario.", W / 2, y + 24)
  } })

  for (const st of CONFIG.staff) {
    const hired = gs.save.ownedStaff.includes(st.id)
    rows.push({
      h: 70, draw: (y: number) => {
        ctx.fillStyle = hired ? rgba(ACCENT, 0.1) : "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 60, 12)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(28, 700)
        ctx.fillText(st.emoji, 30, y + 31)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText(st.name, 64, y + 21)
        ctx.fillStyle = "rgba(255,255,255,0.55)"
        ctx.font = font(9, 600)
        ctx.fillText(st.desc, 64, y + 39)
        const b = { x: W - 100, y: y + 12, w: 70, h: 36 }
        if (hired) {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "Despedir", { color: RED, textColor: "#2a0a0a", fontSize: 11 })
          addBtn(gs, `staff:fire:${st.id}`, b.x, b.y, b.w, b.h)
        } else {
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `$${st.wage}×2`, { color: GREEN, textColor: "#0c2410", fontSize: 11 })
          addBtn(gs, `staff:hire:${st.id}`, b.x, b.y, b.w, b.h)
        }
      },
    })
  }
  drawList(ctx, gs, rows, 56, H - 96 - 8)
}

function drawEco(ctx: CanvasRenderingContext2D, gs: GS) {
  drawMenuHeader(ctx, gs, "🦊 Ecosistema", `⭐ ${gs.save.fame.toLocaleString()}`)

  const rows: SheetRow[] = []
  const w = weatherDef(gs.save.weather)
  rows.push({ h: 38, draw: (y: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = font(12, 800)
    ctx.textAlign = "center"
    ctx.fillText(`${w.emoji} ${w.name} — ${w.desc}`, W / 2, y + 20)
  } })
  rows.push({ h: 38, draw: (y: number) => {
    const crops = countCrops(gs.save)
    const animals = countAnimals(gs.save)
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(10, 700)
    ctx.textAlign = "center"
    ctx.fillText(`Cultivos: ${crops} · Animales: ${animals} · Nivel: ${farmLevel(gs.save.fame)}`, W / 2, y + 20)
  } })

  for (const wl of CONFIG.wildlife) {
    const n = wildlifeCount(gs.save, wl.id)
    rows.push({
      h: 56, draw: (y: number) => {
        const isBenefit = wl.kind === "benefit"
        ctx.fillStyle = isBenefit ? "rgba(120,255,90,0.08)" : "rgba(255,120,120,0.08)"
        roundRectPath(ctx, 20, y, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(24, 700)
        ctx.fillText(wl.emoji, 30, y + 24)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(wl.name, 60, y + 18)
        ctx.fillStyle = isBenefit ? "rgba(140,255,110,0.85)" : "rgba(255,140,140,0.85)"
        ctx.font = font(9, 600)
        ctx.fillText(wl.desc, 60, y + 33)
        ctx.fillStyle = "#fff"
        ctx.font = font(11, 900)
        ctx.textAlign = "right"
        ctx.fillText(`x${n}`, W - 34, y + 21)
        ctx.fillStyle = "rgba(255,255,255,0.35)"
        ctx.font = font(8, 600)
        ctx.fillText(`← ${wl.source}`, W - 34, y + 37)
        ctx.textAlign = "left"
      },
    })
  }

  rows.push({ h: 50, draw: (y: number) => {
    const st = gs.save.stats
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = font(11, 700)
    ctx.textAlign = "center"
    ctx.fillText(`Cosechado ${st.harvested} · Vendido ${st.sold} · Pesca ${st.caught} · Crías ${st.bred}`, W / 2, y + 17)
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(10, 600)
    ctx.fillText(`Ganado $${st.earned} · Impuestos $${st.taxes} · Repelente ${gs.save.repelenteT > 0 ? gs.save.repelenteT + "d" : "no"}`, W / 2, y + 34)
  } })

  rows.push({ h: 58, draw: (y: number) => {
    ctx.fillStyle = "rgba(255,120,120,0.08)"
    roundRectPath(ctx, 20, y, W - 40, 48, 10)
    ctx.fill()
    ctx.fillStyle = "rgba(255,150,150,0.9)"
    ctx.font = font(12, 900)
    ctx.textAlign = "left"
    ctx.fillText("🗑️ Reiniciar granja", 30, y + 22)
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = font(9, 600)
    ctx.fillText("Borra todo el progreso guardado", 30, y + 40)
    addBtn(gs, "reset:ask", 20, y, W - 40, 48)
  } })

  drawList(ctx, gs, rows, 56, H - 96 - 8)
}

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------

function drawModalDim(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(0,0,0,0.65)"
  ctx.fillRect(0, 0, W, H)
}

function drawDayModal(ctx: CanvasRenderingContext2D, gs: GS) {
  drawModalDim(ctx)
  const w = weatherDef(gs.save.weather)
  const bw = W - 48, bh = 470
  const bx = (W - bw) / 2, by = (H - bh) / 2 - 10
  drawPanel(ctx, bx, by, bw, bh, 24)

  ctx.fillStyle = "#fff"
  ctx.font = font(22, 900)
  ctx.textAlign = "center"
  ctx.fillText(`Día ${gs.save.day}`, W / 2, by + 46)
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.font = font(13, 700)
  ctx.fillText(`${w.emoji} ${w.name}`, W / 2, by + 76)

  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = font(12, 700)
  ctx.textAlign = "left"
  let y = by + 108
  const log = gs.dayLog.length > 0 ? gs.dayLog : ["Un día tranquilo en la granja."]
  for (const line of log.slice(-8)) {
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fillText(`• ${line}`, bx + 24, y)
    y += 34
  }

  const b = { x: W / 2 - 90, y: by + bh - 62, w: 180, h: 48 }
  drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "CONTINUAR ▶", { color: ACCENT, textColor: "#0c2410", fontSize: 14, glow: true })
  addBtn(gs, "modal:close", b.x, b.y, b.w, b.h)
}

function drawTaxModal(ctx: CanvasRenderingContext2D, gs: GS) {
  drawModalDim(ctx)
  const bw = W - 48, bh = 380
  const bx = (W - bw) / 2, by = (H - bh) / 2
  drawPanel(ctx, bx, by, bw, bh, 24)

  ctx.fillStyle = RED
  ctx.font = font(24, 900)
  ctx.textAlign = "center"
  ctx.fillText("🏛️ ¡Impuestos!", W / 2, by + 50)
  ctx.fillStyle = "rgba(255,255,255,0.8)"
  ctx.font = font(13, 700)
  ctx.fillText(`Debes pagar al fisco:`, W / 2, by + 88)
  ctx.fillStyle = GOLD
  ctx.font = font(34, 900)
  ctx.fillText(`$${gs.save.taxesOwed}`, W / 2, by + 134)
  ctx.fillStyle = "rgba(255,255,255,0.55)"
  ctx.font = font(11, 600)
  ctx.fillText("La deuda acumula intereses del 4% cada día.", W / 2, by + 166)
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.font = font(10, 600)
  ctx.fillText("El contador reduce el monto un 20%.", W / 2, by + 186)

  const canPay = gs.save.coins >= gs.save.taxesOwed
  const pay = { x: W / 2 - 90, y: by + bh - 108, w: 180, h: 46 }
  drawButton(ctx, pay.x + pay.w / 2, pay.y + pay.h / 2, pay.w, pay.h, `PAGAR $${gs.save.taxesOwed}`, {
    color: canPay ? GOLD : "rgba(255,255,255,0.25)", textColor: canPay ? "#2a1e00" : "rgba(255,255,255,0.5)", fontSize: 12,
  })
  if (canPay) addBtn(gs, "tax:pay", pay.x, pay.y, pay.w, pay.h)

  const later = { x: W / 2 - 90, y: by + bh - 52, w: 180, h: 40 }
  drawButton(ctx, later.x + later.w / 2, later.y + later.h / 2, later.w, later.h, "Más tarde", {
    color: "rgba(255,255,255,0.2)", textColor: "rgba(255,255,255,0.8)", fontSize: 12,
  })
  addBtn(gs, "modal:close", later.x, later.y, later.w, later.h)
}

function drawConfirmModal(ctx: CanvasRenderingContext2D, gs: GS) {
  drawModalDim(ctx)
  const bw = W - 48, bh = 260
  const bx = (W - bw) / 2, by = (H - bh) / 2
  drawPanel(ctx, bx, by, bw, bh, 24)

  ctx.fillStyle = "#fff"
  ctx.font = font(20, 900)
  ctx.textAlign = "center"
  ctx.fillText("¿Reiniciar granja?", W / 2, by + 56)
  ctx.fillStyle = "rgba(255,255,255,0.6)"
  ctx.font = font(12, 700)
  ctx.fillText("Se perderá todo el progreso. ¿Continuar?", W / 2, by + 92)

  const no = { x: W / 2 - 150, y: by + bh - 74, w: 120, h: 48 }
  const yes = { x: W / 2 + 30, y: by + bh - 74, w: 120, h: 48 }
  drawButton(ctx, no.x + no.w / 2, no.y + no.h / 2, no.w, no.h, "Cancelar", { color: "rgba(255,255,255,0.2)", textColor: "#fff", fontSize: 13 })
  addBtn(gs, "modal:close", no.x, no.y, no.w, no.h)
  drawButton(ctx, yes.x + yes.w / 2, yes.y + yes.h / 2, yes.w, yes.h, "Borrar", { color: RED, textColor: "#2a0a0a", fontSize: 13 })
  addBtn(gs, "reset:yes", yes.x, yes.y, yes.w, yes.h)
}

function drawHelpModal(ctx: CanvasRenderingContext2D, gs: GS) {
  drawModalDim(ctx)
  const bw = W - 48, bh = 500
  const bx = (W - bw) / 2, by = (H - bh) / 2 - 10
  drawPanel(ctx, bx, by, bw, bh, 24)
  ctx.fillStyle = ACCENT
  ctx.font = font(22, 900)
  ctx.textAlign = "center"
  ctx.fillText("Cómo jugar", W / 2, by + 48)
  const lines = [
    ["👆 Muévete", "Toca el suelo y el granjero camina (corre si está lejos)."],
    ["🪓 Arar", "Convierte hierba en tierra arada para sembrar."],
    ["🌱🌾 Sembrar y cosechar", "Elige semilla, siembra, riega y cosecha al madurar."],
    ["🐔 Criar", "En pastizales compra animales; alimenta, vende y cría razas."],
    ["🎣 Pescar", "Construye estanques, siembra peces y pesca con el minijuego."],
    ["🏗️ Construir", "Vallas, estanques, pastizales y edificios del jardín."],
    ["📈 Día", "Cada día: crecimiento, salarios, impuestos y clima."],
    ["🦊 Fauna", "La fauna ayuda o perjudica según tus construcciones."],
  ]
  ctx.textAlign = "left"
  let y = by + 92
  for (const [k, v] of lines) {
    ctx.fillStyle = "#fff"
    ctx.font = font(12, 800)
    ctx.fillText(k, bx + 28, y)
    ctx.fillStyle = "rgba(255,255,255,0.6)"
    ctx.font = font(10, 600)
    ctx.fillText(v, bx + 28, y + 18)
    y += 48
  }
  const b = { x: W / 2 - 90, y: by + bh - 62, w: 180, h: 48 }
  drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "ENTENDIDO", { color: ACCENT, textColor: "#0c2410", fontSize: 14 })
  addBtn(gs, "modal:close", b.x, b.y, b.w, b.h)
}

function drawModals(ctx: CanvasRenderingContext2D, gs: GS) {
  if (gs.modal === "day") drawDayModal(ctx, gs)
  else if (gs.modal === "tax") drawTaxModal(ctx, gs)
  else if (gs.modal === "confirm") drawConfirmModal(ctx, gs)
  else if (gs.modal === "help") drawHelpModal(ctx, gs)
}

function drawFlash(ctx: CanvasRenderingContext2D, gs: GS) {
  if (gs.flashT > 0 && gs.flashMsg) {
    const a = Math.min(1, gs.flashT / 0.5)
    ctx.globalAlpha = Math.min(1, a)
    ctx.fillStyle = "rgba(10,14,22,0.85)"
    const w = ctx.measureText(gs.flashMsg).width + 40
    roundRectPath(ctx, W / 2 - w / 2, 150, w, 40, 20)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = font(13, 800)
    ctx.textAlign = "center"
    ctx.fillText(gs.flashMsg, W / 2, 175)
    ctx.globalAlpha = 1
  }
}

function drawMenuNav(ctx: CanvasRenderingContext2D, gs: GS) {
  const items: Array<{ action: string; glyph: string; label: string }> = [
    { action: "tab:farm", glyph: "🏡", label: "Granja" },
    { action: "tab:shop", glyph: "🛒", label: "Tienda" },
    { action: "tab:market", glyph: "💰", label: "Mercado" },
    { action: "tab:staff", glyph: "👷", label: "Personal" },
    { action: "tab:eco", glyph: "🦊", label: "Eco" },
  ]
  const tabW = W / items.length
  const y = H - 96
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const active = it.action === `tab:${gs.phase}`
    const x = i * tabW
    ctx.fillStyle = active ? "rgba(255,255,255,0.08)" : "transparent"
    ctx.fillRect(x, y, tabW, 96)
    if (active) {
      ctx.fillStyle = ACCENT
      ctx.fillRect(x + 12, y, tabW - 24, 3)
    }
    ctx.textAlign = "center"
    ctx.font = font(22, 700)
    ctx.fillText(it.glyph, x + tabW / 2, y + 34)
    ctx.fillStyle = active ? ACCENT : "rgba(255,255,255,0.45)"
    ctx.font = font(11, 800)
    ctx.fillText(it.label, x + tabW / 2, y + 60)
    addBtn(gs, it.action, x, y, tabW, 96)
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function drawScreen(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  gs.btns = []

  if (gs.phase === "intro") {
    drawIntro(ctx, gs, time)
    return
  }

  if (gs.phase === "farm") {
    drawWorld(ctx, gs, time)
    drawTopBar(ctx, gs)
    drawNavRail(ctx, gs)
    drawToolbar(ctx, gs)
    drawPicker(ctx, gs)
    if (gs.sheet === "animal") drawAnimalSheet(ctx, gs)
    if (gs.sheet === "breed") drawBreedSheet(ctx, gs)
    if (gs.fishing.active) drawFishing(ctx, gs)
  } else {
    if (gs.phase === "shop") drawShop(ctx, gs)
    else if (gs.phase === "market") drawMarket(ctx, gs)
    else if (gs.phase === "staff") drawStaff(ctx, gs)
    else if (gs.phase === "eco") drawEco(ctx, gs)
    drawMenuNav(ctx, gs)
  }

  drawFloatersAndSparks(ctx, gs)
  drawFlash(ctx, gs)
  drawModals(ctx, gs)
}