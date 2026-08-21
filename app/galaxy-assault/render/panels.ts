// Paneles HUD personalizables: vida/escudo (vertical u horizontal), stats y eventos.
import type { GS, HudPanelId } from "../core/types"
import { W, H, PANEL_HEADER_H, PANEL_MIN_BTN_W, SHIELD_ABSORB } from "../core/constants"
import { font, rgba, roundRectPath } from "../../lib/gameKit"
import { xpForNextLevel } from "../core/save"

type Imgs = Record<string, HTMLImageElement>

export interface PanelRect {
  x: number
  y: number
  w: number
  h: number
  header: { x: number; y: number; w: number; h: number }
}

// Calcula el rectángulo de cada panel según su estado (y su contenido)
export function panelRect(id: HudPanelId, gs: GS): PanelRect {
  const p = gs.hud[id]
  if (id === "vitals") {
    const vertical = p.orientation === "vertical"
    const w = vertical ? 120 : 250
    const h = vertical ? 170 : 78
    const bodyH = p.minimized ? 0 : h
    return { x: p.x, y: p.y, w, h: PANEL_HEADER_H + bodyH, header: { x: p.x, y: p.y, w, h: PANEL_HEADER_H } }
  }
  if (id === "stats") {
    const w = 260
    const h = 96
    const bodyH = p.minimized ? 0 : h
    return { x: p.x, y: p.y, w, h: PANEL_HEADER_H + bodyH, header: { x: p.x, y: p.y, w, h: PANEL_HEADER_H } }
  }
  // events
  const w = 330
  const h = 100
  const bodyH = p.minimized ? 0 : h
  return { x: p.x, y: p.y, w, h: PANEL_HEADER_H + bodyH, header: { x: p.x, y: p.y, w, h: PANEL_HEADER_H } }
}

function drawHeader(ctx: CanvasRenderingContext2D, id: HudPanelId, r: PanelRect, title: string, accent: string, gs: GS): void {
  const h = r.header
  ctx.fillStyle = "rgba(12,16,32,0.9)"
  roundRectPath(ctx, h.x, h.y, h.w, h.h, 8)
  ctx.fill()
  ctx.strokeStyle = rgba(accent, 0.5)
  ctx.lineWidth = 1.5
  roundRectPath(ctx, h.x, h.y, h.w, h.h, 8)
  ctx.stroke()
  ctx.fillStyle = "#ffffff"
  ctx.font = font(13, 800)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(title, h.x + 8, h.y + h.h / 2 + 1)
  // Botones: minimizar / orientación (solo en modo edición)
  if (gs.editMode) {
    const p = gs.hud[id]
    const bx = h.x + h.w - PANEL_MIN_BTN_W - 4
    ctx.fillStyle = "rgba(255,255,255,0.2)"
    ctx.beginPath()
    ctx.arc(bx + PANEL_MIN_BTN_W / 2, h.y + h.h / 2, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = font(12, 800)
    ctx.fillText(p.minimized ? "▾" : "▴", bx + PANEL_MIN_BTN_W / 2, h.y + h.h / 2 + 1)
    if (id === "vitals" || id === "stats") {
      const ox = bx - 26
      ctx.fillStyle = "rgba(255,255,255,0.2)"
      ctx.beginPath()
      ctx.arc(ox + 10, h.y + h.h / 2, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.font = font(11, 800)
      ctx.fillText(p.orientation === "vertical" ? "⇅" : "⇄", ox + 10, h.y + h.h / 2 + 1)
    }
  }
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
}

function drawBody(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string): void {
  ctx.fillStyle = "rgba(10,14,28,0.8)"
  roundRectPath(ctx, x, y, w, h, 0)
  ctx.fill()
  ctx.strokeStyle = rgba(accent, 0.3)
  ctx.lineWidth = 1
  roundRectPath(ctx, x, y, w, h, 0)
  ctx.stroke()
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  gs: GS,
  id: HudPanelId,
  imgs: Imgs,
  time: number,
): void {
  const p = gs.hud[id]
  const r = panelRect(id, gs)
  const accent = id === "vitals" ? "#44aaff" : id === "stats" ? "#ffd54a" : "#7CFF5A"

  if (id === "vitals") drawVitals(ctx, gs, r, time)
  else if (id === "stats") drawStats(ctx, gs, r)
  else if (id === "events") drawEvents(ctx, gs, r)
  else return

  const titles: Record<"vitals" | "stats" | "events", string> = { vitals: "Vida / Escudo", stats: "Estadísticas", events: "Acontecimientos" }
  drawHeader(ctx, id, r, titles[id], accent, gs)

  if (gs.editMode) {
    ctx.strokeStyle = rgba(accent, 0.9)
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    roundRectPath(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 10)
    ctx.stroke()
    ctx.setLineDash([])
  }
  void p
}

function drawVitals(ctx: CanvasRenderingContext2D, gs: GS, r: PanelRect, time: number): void {
  const p = gs.player
  const vertical = gs.hud.vitals.orientation === "vertical"
  if (gs.hud.vitals.minimized) return
  const bodyY = r.y + PANEL_HEADER_H
  const bw = r.w - 16
  const bh = 16
  const hpPct = Math.max(0, p.hp / p.maxHp)
  const shPct = p.shieldHp / p.shieldMaxHp

  if (vertical) {
    drawBody(ctx, r.x, bodyY, r.w, r.h - PANEL_HEADER_H, "#44aaff")
    // Barras verticales
    barV(ctx, r.x + 18, bodyY + 12, 26, r.h - PANEL_HEADER_H - 24, hpPct, "#7CFF5A", "#22aa44")
    barV(ctx, r.x + 64, bodyY + 12, 26, r.h - PANEL_HEADER_H - 24, shPct, "#44aaff", "#0066cc")
    ctx.fillStyle = "#ffffff"
    ctx.font = font(13, 900)
    ctx.textAlign = "center"
    ctx.fillText("❤", r.x + 31, bodyY + 10)
    ctx.fillText("🛡", r.x + 77, bodyY + 10)
    ctx.fillText(`${Math.ceil(p.hp)}`, r.x + 31, bodyY + r.h - PANEL_HEADER_H + 2)
    ctx.fillText(`${Math.round(p.shieldHp)}`, r.x + 77, bodyY + r.h - PANEL_HEADER_H + 2)
    ctx.textAlign = "left"
  } else {
    drawBody(ctx, r.x, bodyY, r.w, r.h - PANEL_HEADER_H, "#44aaff")
    barH(ctx, r.x + 8, bodyY + 10, bw, bh, hpPct, "#7CFF5A", "#22aa44")
    barH(ctx, r.x + 8, bodyY + 34, bw, bh, shPct, "#44aaff", "#0066cc")
    ctx.fillStyle = "#ffffff"
    ctx.font = font(12, 800)
    ctx.textAlign = "left"
    ctx.fillText(`❤ ${Math.ceil(p.hp)}/${p.maxHp}`, r.x + 10, bodyY + 8)
    ctx.fillText(`🛡 ${Math.round(p.shieldHp)}/${p.shieldMaxHp} (${Math.round(SHIELD_ABSORB * 100)}%)`, r.x + 10, bodyY + 32)
    ctx.textAlign = "left"
    void time
  }
}

function barH(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, c1: string, c2: string): void {
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  roundRectPath(ctx, x, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = c1
  roundRectPath(ctx, x + 1, y + 1, Math.max(4, (w - 2) * Math.max(0, pct)), h - 2, (h - 2) / 2)
  ctx.fill()
  void c2
}

function barV(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pct: number, c1: string, c2: string): void {
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  roundRectPath(ctx, x, y, w, h, 8)
  ctx.fill()
  const fill = Math.max(4, h * Math.max(0, pct))
  ctx.fillStyle = c1
  roundRectPath(ctx, x + 1, y + h - fill, w - 2, fill - 2, 7)
  ctx.fill()
  void c2
}

function drawStats(ctx: CanvasRenderingContext2D, gs: GS, r: PanelRect): void {
  if (gs.hud.stats.minimized) return
  const bodyY = r.y + PANEL_HEADER_H
  const bodyH = r.h - PANEL_HEADER_H
  drawBody(ctx, r.x, bodyY, r.w, bodyH, "#ffd54a")
  const s = gs.save
  const need = xpForNextLevel(s.level)
  const xpPct = Math.max(0, Math.min(1, s.xp / need))
  const bossCount = Object.values(s.bossKills).reduce((a, b) => a + b, 0)
  ctx.textBaseline = "middle"

  if (gs.hud.stats.orientation === "vertical") {
    // Layout vertical: Nivel+XP · Monedas · Bajas · Jefes apilados
    ctx.textAlign = "center"
    ctx.fillStyle = "#00e5ff"
    ctx.font = font(14, 900)
    ctx.fillText(`⭐ Nivel ${s.level}`, r.x + r.w / 2, bodyY + 16)
    const bx = r.x + 10
    const bw = r.w - 20
    const by = bodyY + 24
    const bh = 6
    ctx.fillStyle = "rgba(0,0,0,0.6)"
    roundRectPath(ctx, bx, by, bw, bh, bh / 2)
    ctx.fill()
    ctx.fillStyle = "#00e5ff"
    roundRectPath(ctx, bx + 1, by + 1, Math.max(4, (bw - 2) * xpPct), bh - 2, (bh - 2) / 2)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.7)"
    ctx.font = font(9, 700)
    ctx.fillText(`${s.xp}/${need}`, r.x + r.w / 2, by + 10)
    ctx.fillStyle = "#ffd54a"
    ctx.font = font(15, 900)
    ctx.fillText(`🪙 ${s.coins.toLocaleString()}`, r.x + r.w / 2, bodyY + 48)
    ctx.fillStyle = "#ffffff"
    ctx.font = font(14, 800)
    ctx.fillText(`💀 ${s.kills} bajas`, r.x + r.w / 2, bodyY + 72)
    ctx.fillStyle = "#ffdd88"
    ctx.fillText(`👑 ${bossCount} jefes`, r.x + r.w / 2, bodyY + 94)
  } else {
    // Grid 2×2: Nivel/XP · Monedas · Bajas · Jefes
    const colW = r.w / 2
    const rowH = bodyH / 2
    ctx.textAlign = "center"

    ctx.fillStyle = "#00e5ff"
    ctx.font = font(15, 900)
    ctx.fillText(`⭐ Nivel ${s.level}`, r.x + colW / 2, bodyY + rowH * 0.38)
    const bx = r.x + 10
    const bw = colW - 20
    const by = bodyY + rowH * 0.72
    const bh = 7
    ctx.fillStyle = "rgba(0,0,0,0.6)"
    roundRectPath(ctx, bx, by, bw, bh, bh / 2)
    ctx.fill()
    ctx.fillStyle = "#00e5ff"
    roundRectPath(ctx, bx + 1, by + 1, Math.max(4, (bw - 2) * xpPct), bh - 2, (bh - 2) / 2)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = font(9, 700)
    ctx.fillText(`${s.xp}/${need}`, r.x + colW / 2, by + bh + 10)

    ctx.fillStyle = "#ffd54a"
    ctx.font = font(15, 900)
    ctx.fillText(`🪙 ${s.coins.toLocaleString()}`, r.x + colW * 1.5, bodyY + rowH * 0.5)

    ctx.fillStyle = "#ffffff"
    ctx.font = font(14, 800)
    ctx.fillText(`💀 ${s.kills}`, r.x + colW / 2, bodyY + rowH * 1.5)
    ctx.fillStyle = "rgba(255,255,255,0.6)"
    ctx.font = font(10, 700)
    ctx.fillText("bajas", r.x + colW / 2, bodyY + rowH * 1.5 + 14)

    ctx.fillStyle = "#ffdd88"
    ctx.font = font(14, 800)
    ctx.fillText(`👑 ${bossCount}`, r.x + colW * 1.5, bodyY + rowH * 1.5)
    ctx.fillStyle = "rgba(255,255,255,0.6)"
    ctx.font = font(10, 700)
    ctx.fillText("jefes", r.x + colW * 1.5, bodyY + rowH * 1.5 + 14)
  }

  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
}

function drawEvents(ctx: CanvasRenderingContext2D, gs: GS, r: PanelRect): void {
  if (gs.hud.events.minimized) return
  const bodyY = r.y + PANEL_HEADER_H
  drawBody(ctx, r.x, bodyY, r.w, r.h - PANEL_HEADER_H, "#7CFF5A")
  ctx.textAlign = "left"
  const rows = gs.eventLog.slice(-5)
  if (rows.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.font = font(13, 700)
    ctx.fillText("Sin acontecimientos aún…", r.x + 12, bodyY + 20)
  }
  rows.forEach((msg, i) => {
    const yy = bodyY + 20 + i * 16
    ctx.fillStyle = "rgba(124,255,90,0.8)"
    ctx.font = font(11, 900)
    ctx.fillText("▸", r.x + 12, yy)
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.font = font(12, 600)
    const text = msg.length > 36 ? msg.slice(0, 35) + "…" : msg
    ctx.fillText(text, r.x + 28, yy)
  })
  ctx.textAlign = "left"
}

export { W, H }