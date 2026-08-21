import {
  W, H, NAV_H, FARM_TOP, FARM_BOTTOM, CELL, CELL_GAP,
  CONFIG, TAX_INTERVAL, DAY_LENGTH, ACCENT,
  cropDef, animalDef, fishDef, productDef, weatherDef,
  qualityMult, storageMax, breedCost, breedChance, farmLevel, NAV_TABS, MAX_ROWS, rowCost,
} from "./constants"
import { inventoryUsed } from "./save"
import { drawWorld, drawFloatersAndSparks } from "./draw"
import { countCrops, countAnimals, wildlifeCount } from "./engine"
import type { GS } from "./types"
import { font, rgba, roundRectPath, drawButton, drawPanel, drawPill, drawOnboard } from "../lib/gameKit"

const GOLD = "#ffd54a"
const GREEN = "#7cff5a"
const BLUE = "#7cc4ff"
const RED = "#ff8a80"
const WHITE = "#ffffff"

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
    subtitle: "Construye una granja viva: siembra, cría, pesca y vende para desbloquear las mejores especies.",
    how: [
      "Toca una parcela para sembrar, cosechar o regar.",
      "Prepara pastizales y estanques para animales y pesca.",
      "Vende en el mercado, paga impuestos y contrata personal.",
      "El clima y la fauna (🦊🐗🐝) cambian día a día.",
    ],
    scoring: "Gana fama ⭐ vendiendo para desbloquear especies premium.",
    accent: ACCENT,
    playLabel: "COMENZAR",
  })
  gs.btns.push({ action: "intro:play", x: btn.x, y: btn.y, w: btn.w, h: btn.h })

  const muted = gs.muted
  const mBtn = { x: W - 52, y: 12, w: 40, h: 40 }
  ctx.save()
  ctx.fillStyle = "rgba(15,16,32,0.55)"
  ctx.beginPath(); ctx.arc(mBtn.x + 20, mBtn.y + 20, 20, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  ctx.fillStyle = "#fff"
  ctx.font = font(18, 700)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(muted ? "🔇" : "🔊", mBtn.x + 20, mBtn.y + 21)
  gs.btns.push({ action: "mute", x: mBtn.x, y: mBtn.y, w: mBtn.w, h: mBtn.h })
}

// ---------------------------------------------------------------------------
// Top bar compartida
// ---------------------------------------------------------------------------

function drawTopBar(ctx: CanvasRenderingContext2D, gs: GS) {
  const s = gs.save
  const w = weatherDef(s.weather)
  const rows = s.tiles.length

  // fila 1: monedas / clima / día
  drawPill(ctx, 12, 10, `🪙 ${s.coins.toLocaleString()}`, { accent: GOLD, icon: "" })
  drawPill(ctx, W / 2, 10, `${w.emoji} ${w.name}`, { accent: w.id === "soleado" ? GOLD : BLUE, align: "center", icon: "" })
  drawPill(ctx, W - 12, 10, `Día ${s.day}`, { accent: WHITE, align: "right", icon: "" })

  // fila 2: almacén / fama / personal / impuestos
  const used = inventoryUsed(s)
  const cap = storageMax(s)
  const storageColor = used > cap ? RED : used > cap * 0.8 ? GOLD : GREEN
  drawPill(ctx, 12, 48, `📦 ${used}/${cap}`, { accent: storageColor, icon: "" })
  drawPill(ctx, W / 2 - 20, 48, `⭐ ${s.fame.toLocaleString()}`, { accent: GOLD, align: "center", icon: "" })
  drawPill(ctx, W - 12, 48, `👷 ${s.ownedStaff.length}`, { accent: BLUE, align: "right", icon: "" })

  // aviso de impuestos
  if (s.taxesOwed > 0) {
    const tw = Math.round(ctx.measureText(`⚠️ IMPUESTOS $${s.taxesOwed}`).width) + 40
    const tbtn = { x: W / 2 - tw / 2, y: 84, w: tw, h: 34 }
    ctx.save()
    ctx.fillStyle = "#d63031"
    roundRectPath(ctx, tbtn.x, tbtn.y, tbtn.w, tbtn.h, 17)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = "#fff"
    ctx.font = font(13, 900)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`⚠️ IMPUESTOS $${s.taxesOwed}`, tbtn.x + tbtn.w / 2, tbtn.y + tbtn.h / 2 + 1)
    addBtn(gs, "modal:tax", tbtn.x, tbtn.y, tbtn.w, tbtn.h)
  }

  // fila 3: progreso del día + botón avanzar
  const barX = 20, barW = W - 132, barY = 116, barH = 10
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
  ctx.font = font(10, 600)
  ctx.textAlign = "left"
  ctx.fillText(`Impuestos en ${daysToTax}d`, barX, barY + 24)

  const nextBtn = { x: W - 100, y: 108, w: 88, h: 32 }
  drawButton(ctx, nextBtn.x + nextBtn.w / 2, nextBtn.y + nextBtn.h / 2, nextBtn.w, nextBtn.h, "▶ Día+1", {
    color: ACCENT, textColor: "#0c2410", fontSize: 13,
  })
  addBtn(gs, "day:advance", nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h)

  // niveles de fila
  void rows
}

// ---------------------------------------------------------------------------
// Nav inferior
// ---------------------------------------------------------------------------

function drawNav(ctx: CanvasRenderingContext2D, gs: GS) {
  const tabW = W / NAV_TABS.length
  gs.tabs = []
  for (let i = 0; i < NAV_TABS.length; i++) {
    const t = NAV_TABS[i]
    const active = gs.phase === t.action.slice(4)
    const x = i * tabW
    const y = H - NAV_H
    gs.tabs.push({ action: t.action, label: t.label, glyph: t.glyph, x, y, w: tabW, h: NAV_H })
    addBtn(gs, t.action, x, y, tabW, NAV_H)

    ctx.fillStyle = active ? "rgba(255,255,255,0.08)" : "transparent"
    ctx.fillRect(x, y, tabW, NAV_H)
    if (active) {
      ctx.fillStyle = ACCENT
      ctx.fillRect(x + 12, y, tabW - 24, 3)
    }
    ctx.textAlign = "center"
    ctx.font = font(22, 700)
    ctx.fillText(t.glyph, x + tabW / 2, y + 34)
    ctx.fillStyle = active ? ACCENT : "rgba(255,255,255,0.45)"
    ctx.font = font(11, 800)
    ctx.fillText(t.label, x + tabW / 2, y + 60)
  }
}

// ---------------------------------------------------------------------------
// Fase Granja
// ---------------------------------------------------------------------------

function drawFarm(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  drawWorld(ctx, gs, time)
  drawTopBar(ctx, gs)

  // indicador de scroll
  const ms = maxScrollLocal(gs)
  if (ms > 0) {
    const rows = gs.save.tiles.length
    const vis = Math.floor((FARM_BOTTOM - FARM_TOP) / (CELL + CELL_GAP))
    const thumbH = Math.max(24, (FARM_BOTTOM - FARM_TOP) * (vis / rows))
    const tY = FARM_TOP + (FARM_BOTTOM - FARM_TOP - thumbH) * (gs.scroll / ms)
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    roundRectPath(ctx, W - 6, tY, 3, thumbH, 2)
    ctx.fill()
  }

  if (gs.sheet === "tile" && gs.selTile) drawTileSheet(ctx, gs)
  if (gs.sheet === "breed" && gs.breedTarget) drawBreedSheet(ctx, gs)

  if (gs.fishing.active) drawFishing(ctx, gs)
}

function maxScrollLocal(gs: GS): number {
  const rows = gs.save.tiles.length
  const farmH = FARM_BOTTOM - FARM_TOP
  const gridH = rows * (CELL + CELL_GAP) - CELL_GAP
  return Math.max(0, gridH - farmH)
}

// ---------------------------------------------------------------------------
// Hoja de parcela
// ---------------------------------------------------------------------------

const SHEET_H = 486
const SHEET_TOP = H - SHEET_H - 6

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

function drawTileSheet(ctx: CanvasRenderingContext2D, gs: GS) {
  const { r, c } = gs.selTile!
  const t = gs.save.tiles[r][c]
  const cx = W / 2

  if (t.kind === "soil" && !t.cropId) {
    sheetHeader(ctx, gs, "🌱 Parcela de tierra")
    const contentTop = SHEET_TOP + 44
    const items = gs.save.unlockedCrops.map(id => cropDef(id)!).map(crop => ({
      h: 56,
      draw: (y: number) => {
        const by = y
        ctx.fillStyle = "rgba(255,255,255,0.06)"
        roundRectPath(ctx, 20, by, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(crop.emoji, 30, by + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText(`${crop.name} · ${crop.growDays}d · ${crop.yield}u`, 62, by + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(10, 600)
        ctx.fillText(`Calidad: regado/abono/abejas`, 62, by + 36)
        // botón sembrar
        const b = { x: W - 92, y: by + 6, w: 62, h: 34 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `$${crop.buy}`, { color: GREEN, textColor: "#0c2410", fontSize: 12 })
        addBtn(gs, `plant:${crop.id}:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    }))
    // acciones de terreno
    const pondRow = {
      h: 56, draw: (y: number) => {
        ctx.fillStyle = "rgba(120,180,255,0.1)"
        roundRectPath(ctx, 20, y, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(24, 700)
        ctx.fillText("🌊", 30, y + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText("Cavar estanque", 62, y + 21)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(10, 600)
        ctx.fillText("Permite pescar", 62, y + 36)
        const b = { x: W - 92, y: y + 6, w: 62, h: 34 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `$${CONFIG.balance.pondDigCost}`, { color: BLUE, textColor: "#06242e", fontSize: 12 })
        addBtn(gs, `dig:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    }
    const pastureRow = {
      h: 56, draw: (y: number) => {
        ctx.fillStyle = "rgba(140,255,90,0.1)"
        roundRectPath(ctx, 20, y, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(24, 700)
        ctx.fillText("🌿", 30, y + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText("Preparar pastizal", 62, y + 21)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(10, 600)
        ctx.fillText("Permite criar animales", 62, y + 36)
        const b = { x: W - 92, y: y + 6, w: 62, h: 34 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `$${CONFIG.balance.pasturePrepCost}`, { color: GREEN, textColor: "#0c2410", fontSize: 12 })
        addBtn(gs, `pasture:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    }
    drawList(ctx, gs, [...items, pondRow, pastureRow], contentTop, SHEET_TOP + SHEET_H - 40)
    return
  }

  if (t.kind === "soil" && t.cropId) {
    const crop = cropDef(t.cropId)!
    const ready = (t.cropProgress ?? 0) >= 1
    sheetHeader(ctx, gs, `${crop.emoji} ${crop.name}`)
    const contentTop = SHEET_TOP + 44
    const rows: SheetRow[] = []

    // estado
    rows.push({
      h: 60, draw: (y: number) => {
        const p = t.cropProgress ?? 0
        ctx.textAlign = "left"
        ctx.font = font(12, 700)
        ctx.fillStyle = "rgba(255,255,255,0.8)"
        ctx.fillText(`Progreso: ${Math.round(p * 100)}%`, 24, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(10, 600)
        ctx.fillText(`Regado ${t.cropWater ?? 0}/${t.cropDays ?? 0} días${t.cropFert ? " · abonado ✨" : ""}`, 24, y + 38)
        ctx.fillStyle = "rgba(255,255,255,0.15)"
        roundRectPath(ctx, 24, y + 44, W - 48, 8, 4)
        ctx.fill()
        ctx.fillStyle = ready ? GOLD : GREEN
        roundRectPath(ctx, 24, y + 44, Math.max(6, (W - 48) * p), 8, 4)
        ctx.fill()
      },
    })
    if (!t.wateredToday) {
      rows.push({
        h: 50, draw: (y: number) => {
          const b = { x: 24, y, w: (W - 60) / 2, h: 38 }
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "💧 Regar", { color: BLUE, textColor: "#06242e", fontSize: 13 })
          addBtn(gs, `water:${r}:${c}`, b.x, b.y, b.w, b.h)
          const b2 = { x: W - 24 - (W - 60) / 2, y, w: (W - 60) / 2, h: 38 }
          const canFert = gs.save.abono > 0 && !t.cropFert
          drawButton(ctx, b2.x + b2.w / 2, b2.y + b2.h / 2, b2.w, b2.h, `✨ Abono (${gs.save.abono})`, {
            color: canFert ? GOLD : "rgba(255,255,255,0.25)", textColor: canFert ? "#2a1e00" : "rgba(255,255,255,0.5)", fontSize: 12,
          })
          if (canFert) addBtn(gs, `fert:${r}:${c}`, b2.x, b2.y, b2.w, b2.h)
        },
      })
    }
    rows.push({
      h: 50, draw: (y: number) => {
        const b = { x: 24, y, w: W - 48, h: 38 }
        const color = ready ? GREEN : "rgba(255,255,255,0.25)"
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, ready ? `🌾 Cosechar (+${crop.yield})` : "Aún no está listo", {
          color, textColor: ready ? "#0c2410" : "rgba(255,255,255,0.5)", fontSize: 13,
        })
        if (ready) addBtn(gs, `harvest:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    })
    rows.push({
      h: 50, draw: (y: number) => {
        const b = { x: 24, y, w: W - 48, h: 38 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "🪓 Arrancar cultivo", { color: "rgba(255,255,255,0.18)", textColor: "rgba(255,255,255,0.7)", fontSize: 12 })
        addBtn(gs, `uproot:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    })
    drawList(ctx, gs, rows, contentTop, SHEET_TOP + SHEET_H - 40)
    void cx
    return
  }

  if (t.kind === "pasture" && !t.animalId) {
    sheetHeader(ctx, gs, "🌿 Pastizal vacío")
    const contentTop = SHEET_TOP + 44
    const items = gs.save.unlockedAnimals.map(id => animalDef(id)!).map(a => ({
      h: 56,
      draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.06)"
        roundRectPath(ctx, 20, y, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(24, 700)
        ctx.fillText(a.emoji, 30, y + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(a.name, 62, y + 18)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(`${a.productEmoji} cada ${a.produceDays}d · comida $${a.feed}`, 62, y + 34)
        const b = { x: W - 92, y: y + 6, w: 62, h: 34 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `$${a.buy}`, { color: GREEN, textColor: "#0c2410", fontSize: 12 })
        addBtn(gs, `animal:${a.id}:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    }))
    const back = {
      h: 56, draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.06)"
        roundRectPath(ctx, 20, y, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(22, 700)
        ctx.fillText("🟫", 30, y + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText("Volver a tierra", 62, y + 25)
        const b = { x: W - 92, y: y + 6, w: 62, h: 34 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "↩", { color: "rgba(255,255,255,0.35)", textColor: "#fff", fontSize: 14 })
        addBtn(gs, `backsoil:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    }
    drawList(ctx, gs, [...items, back], contentTop, SHEET_TOP + SHEET_H - 40)
    return
  }

  if (t.kind === "pasture" && t.animalId) {
    const a = animalDef(t.animalId)!
    sheetHeader(ctx, gs, `${a.emoji} ${a.name} · raza ${t.animalQuality ?? 1}`)
    const rows: SheetRow[] = []
    const happy = t.animalHappy ?? 70
    const sellPrice = Math.round(a.sell * qualityMult(t.animalQuality ?? 1))
    rows.push({
      h: 54, draw: (y: number) => {
        ctx.textAlign = "left"
        ctx.font = font(12, 700)
        ctx.fillStyle = "rgba(255,255,255,0.85)"
        ctx.fillText(`Felicidad: ${happy}% ${happy < 30 ? "😠" : happy < 60 ? "😐" : "😊"}`, 24, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(10, 600)
        ctx.fillText(`${a.desc}`, 24, y + 38)
      },
    })
    rows.push({
      h: 50, draw: (y: number) => {
        const b = { x: 24, y, w: (W - 60) / 2, h: 38 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "🍽️ Alimentar", { color: GOLD, textColor: "#2a1e00", fontSize: 13 })
        addBtn(gs, `feed:${r}:${c}`, b.x, b.y, b.w, b.h)
        const b2 = { x: W - 24 - (W - 60) / 2, y, w: (W - 60) / 2, h: 38 }
        drawButton(ctx, b2.x + b2.w / 2, b2.y + b2.h / 2, b2.w, b2.h, `🐣 Criar $${breedCost(t.animalQuality ?? 1)}`, { color: GREEN, textColor: "#0c2410", fontSize: 11 })
        addBtn(gs, `breed:${r}:${c}`, b2.x, b2.y, b2.w, b2.h)
      },
    })
    rows.push({
      h: 50, draw: (y: number) => {
        const b = { x: 24, y, w: W - 48, h: 38 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `🪙 Vender $${sellPrice}`, { color: RED, textColor: "#2a0a0a", fontSize: 13 })
        addBtn(gs, `sellanimal:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    })
    drawList(ctx, gs, rows, SHEET_TOP + 44, SHEET_TOP + SHEET_H - 40)
    return
  }

  if (t.kind === "pond") {
    sheetHeader(ctx, gs, `🌊 Estanque${t.pondFish ? ` · ${fishDef(t.pondFish)?.emoji}` : ""}`)
    const contentTop = SHEET_TOP + 44
    const rows: SheetRow[] = []
    if (t.pondFish && (t.pondStock ?? 0) > 0) {
      rows.push({
        h: 54, draw: (y: number) => {
          const b = { x: 24, y, w: W - 48, h: 40 }
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `🎣 Pescar (${t.pondStock})`, { color: BLUE, textColor: "#06242e", fontSize: 14 })
          addBtn(gs, `fish:${r}:${c}`, b.x, b.y, b.w, b.h)
        },
      })
    } else {
      rows.push({
        h: 40, draw: (y: number) => {
          ctx.fillStyle = "rgba(255,255,255,0.4)"
          ctx.font = font(11, 700)
          ctx.textAlign = "center"
          ctx.fillText(t.pondFish ? "Sin peces: espera a que se regeneren" : "Sembra alevines para pescar", W / 2, y + 24)
        },
      })
    }
    const fishItems = gs.save.unlockedFish.map(id => fishDef(id)!).map(f => ({
      h: 56,
      draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.06)"
        roundRectPath(ctx, 20, y, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(24, 700)
        ctx.fillText(f.emoji, 30, y + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText(f.name, 62, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(10, 600)
        ctx.fillText(`venta $${f.catchPrice}`, 62, y + 36)
        const b = { x: W - 92, y: y + 6, w: 62, h: 34 }
        const isActive = t.pondFish === f.id
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, isActive ? "✓" : `$${f.fryCost}`, {
          color: isActive ? "rgba(255,255,255,0.3)" : BLUE, textColor: "#06242e", fontSize: 12,
        })
        if (!isActive) addBtn(gs, `stock:${f.id}:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    }))
    const back = {
      h: 56, draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.06)"
        roundRectPath(ctx, 20, y, W - 40, 46, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(22, 700)
        ctx.fillText("🟫", 30, y + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText("Volver a tierra", 62, y + 25)
        const b = { x: W - 92, y: y + 6, w: 62, h: 34 }
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "↩", { color: "rgba(255,255,255,0.35)", textColor: "#fff", fontSize: 14 })
        addBtn(gs, `backsoil:${r}:${c}`, b.x, b.y, b.w, b.h)
      },
    }
    drawList(ctx, gs, [...rows, ...fishItems, back], contentTop, SHEET_TOP + SHEET_H - 40)
    return
  }
}

interface SheetRow { h: number; draw: (y: number) => void }

// ---------------------------------------------------------------------------
// Hoja de cría
// ---------------------------------------------------------------------------

function drawBreedSheet(ctx: CanvasRenderingContext2D, gs: GS) {
  const { r, c } = gs.breedTarget!
  const t = gs.save.tiles[r][c]
  if (!t.animalId) return
  const a = animalDef(t.animalId)!
  const cost = breedCost(t.animalQuality ?? 1)
  const chance = Math.round(breedChance(t.animalQuality ?? 1) * 100)

  drawPanelTone(ctx, 8, SHEET_TOP, W - 16, SHEET_H, 22)
  ctx.fillStyle = "#fff"
  ctx.font = font(17, 900)
  ctx.textAlign = "left"
  ctx.fillText(`🐣 Criar ${a.emoji} ${a.name}`, 24, SHEET_TOP + 28)
  ctx.font = font(14, 800)
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.fillText("✕", W - 32, SHEET_TOP + 28)
  addBtn(gs, "sheet:close", W - 52, SHEET_TOP + 8, 44, 34)

  const infoY = SHEET_TOP + 44
  ctx.fillStyle = "rgba(255,255,255,0.75)"
  ctx.font = font(12, 700)
  ctx.textAlign = "center"
  ctx.fillText(`Coste: $${cost} · Probabilidad de raza +1: ${chance}%`, W / 2, infoY + 12)
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.font = font(10, 600)
  ctx.fillText("Elige otro ejemplar de la misma especie. Necesitas un pastizal libre.", W / 2, infoY + 30)

  // candidatos
  const mates: Array<{ r: number; c: number; q: number }> = []
  for (let rr = 0; rr < gs.save.tiles.length; rr++) {
    for (let cc = 0; cc < gs.save.tiles[rr].length; cc++) {
      if (rr === r && cc === c) continue
      const mt = gs.save.tiles[rr][cc]
      if (mt.animalId === t.animalId) mates.push({ r: rr, c: cc, q: mt.animalQuality ?? 1 })
    }
  }

  const rows: SheetRow[] = []
  if (mates.length === 0) {
    rows.push({ h: 60, draw: (y: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.5)"
      ctx.font = font(12, 700)
      ctx.textAlign = "center"
      ctx.fillText("Necesitas otro ejemplar de la misma especie", W / 2, y + 30)
    } })
  } else {
    for (const m of mates) {
      rows.push({
        h: 60, draw: (y: number) => {
          ctx.fillStyle = "rgba(255,255,255,0.06)"
          roundRectPath(ctx, 20, y, W - 40, 50, 10)
          ctx.fill()
          ctx.textAlign = "left"
          ctx.font = font(24, 700)
          ctx.fillText(a.emoji, 30, y + 28)
          ctx.fillStyle = "#fff"
          ctx.font = font(12, 800)
          ctx.fillText(`${a.name} en ${m.r + 1},${m.c + 1}`, 62, y + 22)
          ctx.fillStyle = GOLD
          ctx.font = font(11, 800)
          ctx.fillText(`✦ raza ${m.q}`, 62, y + 40)
          const b = { x: W - 100, y: y + 8, w: 70, h: 34 }
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, `$${cost}`, { color: GREEN, textColor: "#0c2410", fontSize: 12 })
          addBtn(gs, `dobreed:${r}:${c}:${m.r}:${m.c}`, b.x, b.y, b.w, b.h)
        },
      })
    }
  }
  drawList(ctx, gs, rows, SHEET_TOP + 76, SHEET_TOP + SHEET_H - 40)
}

// ---------------------------------------------------------------------------
// Pesca
// ---------------------------------------------------------------------------

function drawFishing(ctx: CanvasRenderingContext2D, gs: GS) {
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  ctx.fillRect(0, 0, W, H)
  const bx = 40, bw = W - 80, by = FARM_BOTTOM - 90, bh = 46
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
  // zona dorada
  const zx = bx + gs.fishing.zone * bw - (gs.fishing.zoneW * bw) / 2
  const zw = gs.fishing.zoneW * bw
  ctx.fillStyle = "rgba(255,212,74,0.85)"
  roundRectPath(ctx, zx, by, zw, bh, bh / 2)
  ctx.fill()
  // marcador ping-pong
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
// Tienda
// ---------------------------------------------------------------------------

function drawShop(ctx: CanvasRenderingContext2D, gs: GS) {
  drawPanelTone(ctx, 8, 8, W - 16, H - 16, 22)
  ctx.fillStyle = "#fff"
  ctx.font = font(18, 900)
  ctx.textAlign = "left"
  ctx.fillText("🛒 Tienda", 24, 40)
  drawPill(ctx, W - 12, 16, `🪙 ${gs.save.coins.toLocaleString()}`, { accent: GOLD, align: "right", icon: "" })
  drawPill(ctx, W - 12, 56, `⭐ ${gs.save.fame.toLocaleString()}`, { accent: GOLD, align: "right", icon: "" })

  // pestañas
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
    roundRectPath(ctx, x, 68, tabW - 4, 34, 8)
    ctx.fill()
    if (active) {
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 1.5
      roundRectPath(ctx, x, 68, tabW - 4, 34, 8)
      ctx.stroke()
    }
    ctx.fillStyle = active ? ACCENT : "rgba(255,255,255,0.6)"
    ctx.font = font(11, 800)
    ctx.textAlign = "center"
    ctx.fillText(tabs[i].label, x + (tabW - 4) / 2, 90)
    addBtn(gs, `shop:tab:${tabs[i].id}`, x, 68, tabW - 4, 34)
  }

  // contenido
  const top = 116
  const bottom = H - NAV_H - 8
  let rows: SheetRow[] = []

  if (gs.shopTab === "seeds") {
    rows = CONFIG.crops.map(crop => ({
      h: 64,
      draw: (y: number) => {
        const owned = gs.save.unlockedCrops.includes(crop.id)
        const locked = gs.save.fame < crop.unlockFame
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 54, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(locked ? "🔒" : crop.emoji, 30, y + 28)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(crop.name, 62, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(`crece ${crop.growDays}d · da ${crop.yield}u · venta $${crop.price}`, 62, y + 36)
        const b = { x: W - 96, y: y + 9, w: 66, h: 36 }
        if (locked) {
          ctx.fillStyle = "rgba(255,255,255,0.4)"
          ctx.font = font(9, 700)
          ctx.textAlign = "center"
          ctx.fillText(`⭐ ${crop.unlockFame}`, b.x + b.w / 2, b.y + 12)
          ctx.font = font(8, 600)
          ctx.fillText("para desbloquear", b.x + b.w / 2, b.y + 25)
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
      h: 64,
      draw: (y: number) => {
        const owned = gs.save.unlockedAnimals.includes(a.id)
        const locked = gs.save.fame < a.unlockFame
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 54, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(locked ? "🔒" : a.emoji, 30, y + 28)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(a.name, 62, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(`${a.desc}`, 62, y + 36)
        const b = { x: W - 96, y: y + 9, w: 66, h: 36 }
        if (locked) {
          ctx.fillStyle = "rgba(255,255,255,0.4)"
          ctx.font = font(9, 700)
          ctx.textAlign = "center"
          ctx.fillText(`⭐ ${a.unlockFame}`, b.x + b.w / 2, b.y + 12)
          ctx.font = font(8, 600)
          ctx.fillText("para desbloquear", b.x + b.w / 2, b.y + 25)
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
      h: 64,
      draw: (y: number) => {
        const owned = gs.save.unlockedFish.includes(f.id)
        const locked = gs.save.fame < f.unlockFame
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 54, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(locked ? "🔒" : f.emoji, 30, y + 28)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(f.name, 62, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(`alevines $${f.fryCost} · venta $${f.catchPrice}`, 62, y + 36)
        const b = { x: W - 96, y: y + 9, w: 66, h: 36 }
        if (locked) {
          ctx.fillStyle = "rgba(255,255,255,0.4)"
          ctx.font = font(9, 700)
          ctx.textAlign = "center"
          ctx.fillText(`⭐ ${f.unlockFame}`, b.x + b.w / 2, b.y + 12)
          ctx.font = font(8, 600)
          ctx.fillText("para desbloquear", b.x + b.w / 2, b.y + 25)
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
      h: 64,
      draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 54, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(d.emoji, 30, y + 28)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(d.name, 62, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(d.effect, 62, y + 36)
        const b = { x: W - 96, y: y + 9, w: 66, h: 36 }
        const owned = gs.save.decorations[d.id] ?? 0
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, owned > 0 ? `×${owned}` : `$${d.cost}`, {
          color: GREEN, textColor: "#0c2410", fontSize: 11,
        })
        addBtn(gs, `shop:decor:${d.id}`, b.x, b.y, b.w, b.h)
      },
    }))
    // expansión
    rows.push({
      h: 64, draw: (y: number) => {
        const rowsCount = gs.save.tiles.length
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 54, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText("🚜", 30, y + 28)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText("Expandir granja", 62, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(rowsCount >= MAX_ROWS ? "¡Al máximo de filas!" : `Fila ${rowsCount + 1} de ${MAX_ROWS}`, 62, y + 36)
        const b = { x: W - 96, y: y + 9, w: 66, h: 36 }
        const cost = rowsCount >= MAX_ROWS ? 0 : rowCost(rowsCount)
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, cost ? `$${cost}` : "MÁX", {
          color: cost ? GOLD : "rgba(255,255,255,0.25)", textColor: "#2a1e00", fontSize: 11,
        })
        if (cost) addBtn(gs, `shop:expand`, b.x, b.y, b.w, b.h)
      },
    })
  } else {
    // extras
    rows = CONFIG.extras.map(e => ({
      h: 64,
      draw: (y: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 54, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(26, 700)
        ctx.fillText(e.emoji, 30, y + 28)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(e.name, 62, y + 20)
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.font = font(9, 600)
        ctx.fillText(e.effect, 62, y + 36)
        const b = { x: W - 96, y: y + 9, w: 66, h: 36 }
        const owned = e.id === "abono" ? gs.save.abono : gs.save.repelente
        drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, owned > 0 ? `×${owned}` : `$${e.cost}`, {
          color: GREEN, textColor: "#0c2410", fontSize: 12,
        })
        addBtn(gs, `shop:extra:${e.id}`, b.x, b.y, b.w, b.h)
      },
    }))
  }

  drawList(ctx, gs, rows, top, bottom)
}

// ---------------------------------------------------------------------------
// Mercado
// ---------------------------------------------------------------------------

function drawMarket(ctx: CanvasRenderingContext2D, gs: GS) {
  drawPanelTone(ctx, 8, 8, W - 16, H - 16, 22)
  ctx.fillStyle = "#fff"
  ctx.font = font(18, 900)
  ctx.textAlign = "left"
  ctx.fillText("💰 Mercado", 24, 40)
  drawPill(ctx, W - 12, 16, `🪙 ${gs.save.coins.toLocaleString()}`, { accent: GOLD, align: "right", icon: "" })

  // botón vender todo
  const sellAllBtn = { x: W - 130, y: 48, w: 106, h: 34 }
  drawButton(ctx, sellAllBtn.x + sellAllBtn.w / 2, sellAllBtn.y + sellAllBtn.h / 2, sellAllBtn.w, sellAllBtn.h, "VENDER TODO", {
    color: GOLD, textColor: "#2a1e00", fontSize: 11,
  })
  addBtn(gs, "market:sellall", sellAllBtn.x, sellAllBtn.y, sellAllBtn.w, sellAllBtn.h)

  // agrupar inventario
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
  for (const pid of Object.keys(groups)) {
    groups[pid].avgQ = Math.round(groups[pid].avgQ / groups[pid].qty)
  }

  const rows: SheetRow[] = []
  if (Object.keys(groups).length === 0) {
    rows.push({ h: 80, draw: (y: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.5)"
      ctx.font = font(13, 700)
      ctx.textAlign = "center"
      ctx.fillText("No tienes productos para vender", W / 2, y + 40)
      ctx.font = font(10, 600)
      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.fillText("Cosecha, pesca y cría para llenar el almacén 📦", W / 2, y + 58)
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
          ctx.fillText(`$${g.value}`, 160, y + 27)
          const b = { x: W - 96, y: y + 8, w: 66, h: 36 }
          drawButton(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, "VENDER", { color: GREEN, textColor: "#0c2410", fontSize: 11 })
          addBtn(gs, `market:sell:${pid}`, b.x, b.y, b.w, b.h)
        },
      })
    }
  }

  drawList(ctx, gs, rows, 92, H - NAV_H - 8)
}

// ---------------------------------------------------------------------------
// Personal
// ---------------------------------------------------------------------------

function drawStaff(ctx: CanvasRenderingContext2D, gs: GS) {
  drawPanelTone(ctx, 8, 8, W - 16, H - 16, 22)
  ctx.fillStyle = "#fff"
  ctx.font = font(18, 900)
  ctx.textAlign = "left"
  ctx.fillText("👷 Personal", 24, 40)
  drawPill(ctx, W - 12, 16, `🪙 ${gs.save.coins.toLocaleString()}`, { accent: GOLD, align: "right", icon: "" })

  const rows: SheetRow[] = []
  rows.push({ h: 44, draw: (y: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(11, 700)
    ctx.textAlign = "center"
    ctx.fillText("El personal trabaja al final de cada día. Los salarios se descuentan a diario.", W / 2, y + 24)
  } })

  for (const st of CONFIG.staff) {
    const hired = gs.save.ownedStaff.includes(st.id)
    rows.push({
      h: 72, draw: (y: number) => {
        ctx.fillStyle = hired ? rgba(ACCENT, 0.1) : "rgba(255,255,255,0.05)"
        roundRectPath(ctx, 20, y, W - 40, 62, 12)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(30, 700)
        ctx.fillText(st.emoji, 30, y + 32)
        ctx.fillStyle = "#fff"
        ctx.font = font(13, 800)
        ctx.fillText(st.name, 66, y + 22)
        ctx.fillStyle = "rgba(255,255,255,0.55)"
        ctx.font = font(9, 600)
        ctx.fillText(st.desc, 66, y + 40)
        const b = { x: W - 100, y: y + 12, w: 70, h: 38 }
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

  drawList(ctx, gs, rows, 56, H - NAV_H - 8)
}

// ---------------------------------------------------------------------------
// Ecosistema
// ---------------------------------------------------------------------------

function drawEco(ctx: CanvasRenderingContext2D, gs: GS) {
  drawPanelTone(ctx, 8, 8, W - 16, H - 16, 22)
  ctx.fillStyle = "#fff"
  ctx.font = font(18, 900)
  ctx.textAlign = "left"
  ctx.fillText("🦊 Ecosistema", 24, 40)
  drawPill(ctx, W - 12, 16, `⭐ ${gs.save.fame.toLocaleString()}`, { accent: GOLD, align: "right", icon: "" })

  const rows: SheetRow[] = []
  const w = weatherDef(gs.save.weather)
  rows.push({ h: 40, draw: (y: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = font(12, 800)
    ctx.textAlign = "center"
    ctx.fillText(`${w.emoji} ${w.name} — ${w.desc}`, W / 2, y + 20)
  } })
  rows.push({ h: 40, draw: (y: number) => {
    const crops = countCrops(gs.save)
    const animals = countAnimals(gs.save)
    const fish = gs.save.unlockedFish.length
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(10, 700)
    ctx.textAlign = "center"
    ctx.fillText(`Cultivos: ${crops} · Animales: ${animals} · Especies de pez: ${fish} · Nivel: ${farmLevel(gs.save.fame)}`, W / 2, y + 20)
  } })

  for (const wl of CONFIG.wildlife) {
    const n = wildlifeCount(gs.save, wl.id)
    rows.push({
      h: 58, draw: (y: number) => {
        const isBenefit = wl.kind === "benefit"
        ctx.fillStyle = isBenefit ? "rgba(120,255,90,0.08)" : "rgba(255,120,120,0.08)"
        roundRectPath(ctx, 20, y, W - 40, 48, 10)
        ctx.fill()
        ctx.textAlign = "left"
        ctx.font = font(24, 700)
        ctx.fillText(wl.emoji, 30, y + 25)
        ctx.fillStyle = "#fff"
        ctx.font = font(12, 800)
        ctx.fillText(wl.name, 60, y + 19)
        ctx.fillStyle = isBenefit ? "rgba(140,255,110,0.85)" : "rgba(255,140,140,0.85)"
        ctx.font = font(9, 600)
        ctx.fillText(wl.desc, 60, y + 34)
        ctx.fillStyle = "#fff"
        ctx.font = font(11, 900)
        ctx.textAlign = "right"
        ctx.fillText(`x${n}`, W - 34, y + 22)
        ctx.fillStyle = "rgba(255,255,255,0.35)"
        ctx.font = font(8, 600)
        ctx.fillText(`← ${wl.source}`, W - 34, y + 38)
        ctx.textAlign = "left"
      },
    })
  }

  rows.push({ h: 52, draw: (y: number) => {
    const st = gs.save.stats
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = font(11, 700)
    ctx.textAlign = "center"
    ctx.fillText(`Cosechado ${st.harvested} · Vendido ${st.sold} · Pesca ${st.caught} · Crías ${st.bred}`, W / 2, y + 18)
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(10, 600)
    ctx.fillText(`Ganado $${st.earned} · Impuestos pagados $${st.taxes}`, W / 2, y + 34)
  } })

  rows.push({ h: 60, draw: (y: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = font(10, 700)
    ctx.textAlign = "center"
    ctx.fillText("Repelente activo: " + (gs.save.repelenteT > 0 ? `${gs.save.repelenteT}d` : "no"), W / 2, y + 16)
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = font(9, 600)
    ctx.fillText("Compra repelente en la tienda (Extras). Las decoraciones del Jardín atraen aliados.", W / 2, y + 34)
  } })

  rows.push({ h: 62, draw: (y: number) => {
    ctx.fillStyle = "rgba(255,120,120,0.08)"
    roundRectPath(ctx, 20, y, W - 40, 52, 10)
    ctx.fill()
    ctx.fillStyle = "rgba(255,150,150,0.9)"
    ctx.font = font(12, 900)
    ctx.textAlign = "left"
    ctx.fillText("🗑️ Reiniciar granja", 30, y + 24)
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = font(9, 600)
    ctx.fillText("Borra todo el progreso guardado", 30, y + 42)
    addBtn(gs, "reset:ask", 20, y, W - 40, 52)
  } })

  drawList(ctx, gs, rows, 56, H - NAV_H - 8)
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
  ctx.fillText("La deuda acumula intereses del 5% cada día.", W / 2, by + 166)
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
  const bw = W - 48, bh = 470
  const bx = (W - bw) / 2, by = (H - bh) / 2 - 10
  drawPanel(ctx, bx, by, bw, bh, 24)
  ctx.fillStyle = ACCENT
  ctx.font = font(22, 900)
  ctx.textAlign = "center"
  ctx.fillText("Cómo jugar", W / 2, by + 48)
  const lines = [
    ["🌱 Siembra", "Cultiva y riega para cosechar productos."],
    ["🐔 Cría", "Alimenta animales, produce y cría razas mejores."],
    ["🎣 Pesca", "Estanques con peces: pesca con el minijuego."],
    ["💰 Vende", "El mercado convierte tu inventario en monedas."],
    ["⭐ Fama", "Vender desbloquea especies premium."],
    ["📈 Día", "Cada día: crecimiento, salarios, impuestos y clima."],
    ["🦊 Fauna", "La fauna ayuda o perjudica según tus decoraciones."],
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
    roundRectPath(ctx, W / 2 - w / 2, 180, w, 40, 20)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.font = font(13, 800)
    ctx.textAlign = "center"
    ctx.fillText(gs.flashMsg, W / 2, 205)
    ctx.globalAlpha = 1
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function drawScreen(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  gs.btns = []
  gs.tabs = []

  switch (gs.phase) {
    case "intro":
      drawIntro(ctx, gs, time)
      return
    case "farm":
      drawFarm(ctx, gs, time)
      break
    case "shop":
      drawShop(ctx, gs)
      break
    case "market":
      drawMarket(ctx, gs)
      break
    case "staff":
      drawStaff(ctx, gs)
      break
    case "eco":
      drawEco(ctx, gs)
      break
  }

  drawNav(ctx, gs)
  drawFloatersAndSparks(ctx, gs)
  drawFlash(ctx, gs)
  drawModals(ctx, gs)
}