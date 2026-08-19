import type { GS, EquipTab } from "./types"
import type { ShipUpgrades } from "./save"
import {
  W, H, HUD_H, AMMO_COLORS, AMMO_ICONS, AMMO_NAMES, AMMO_BUY,
  perfectBuyCost, REPAIR_BOT_PRICE, REPAIR_BOT_HEAL,
  FUSION_COUNT, fusionChance,
} from "./constants"
import {
  LASER_DEFS, SHIELD_DEFS, UAV_DEFS, laserDef, shieldDef, uavDef, singleLaserMult, getLaserInstance,
  getLoadout, totalLaserMult, effShieldMaxHP, inventoryLaserTotal,
  equippedLaserTier, equippedShieldTier, equippedShieldIds,
} from "./items"
import { SHIP_DEFS, getShip } from "./ships"
import { WORLDS } from "./worlds"
import { transitionTo } from "./engine"
import { drawItemIcon, type IconKind } from "./icons"
import {
  drawShipShape, drawBossShip, drawPlayerShip, drawEnemyShip, drawBullet, drawDrop,
  drawBackground, drawStars, drawHUD, drawParticle, drawTrail, drawFloaters, drawShockwaves, drawMuteBtn,
} from "./draw"

function drawIntro(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  // Dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, W, H)
  // Title
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 52px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 30
  ctx.fillText("STAR", W / 2, H / 2 - 150)
  ctx.fillStyle = "#00e5ff"
  ctx.fillText("ASSAULT", W / 2, H / 2 - 92)
  ctx.shadowBlur = 0
  ctx.fillStyle = "#aaaaaa"; ctx.font = "13px monospace"
  ctx.fillText(`${WORLDS.length} mundos · combos · power-ups · jefes épicos`, W / 2, H / 2 - 44)

  // Monedas
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 16px monospace"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()}`, W / 2, H / 2 - 14)

  gs.introBtns = []
  const pulse = 0.96 + Math.sin(time * 2.5) * 0.04
  const mkBtn = (label: string, action: string, cy: number, color: string, textColor: string) => {
    const bw = 220, bh = 46, bx = W / 2 - bw / 2, by = cy - bh / 2
    gs.introBtns.push({ action, x: bx, y: by, w: bw, h: bh })
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pulse, pulse)
    ctx.fillStyle = color
    ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 10); ctx.fill()
    ctx.fillStyle = textColor; ctx.font = "bold 17px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(label, 0, 0)
    ctx.restore()
  }
  mkBtn("▶  CAMPAÑA", "campaign", H / 2 + 20, "#00e5ff", "#001020")
  mkBtn("♾  ENDLESS", "endless", H / 2 + 78, "#ff44aa", "#20000f")
  mkBtn("🔧  HANGAR", "hangar", H / 2 + 136, "#ffcc44", "#201400")
  mkBtn("🛒  TIENDA", "equip", H / 2 + 194, "#ff8844", "#201000")
  mkBtn("🚀  NAVES", "ships", H / 2 + 252, "#44ff88", "#001405")

  // Récord endless
  if (gs.save.endlessBest > 0) {
    ctx.fillStyle = "#ff88bb"; ctx.font = "11px monospace"; ctx.textAlign = "center"
    ctx.fillText(`Mejor oleada endless: ${gs.save.endlessBest}`, W / 2, H / 2 + 310)
  }

  // Credits
  ctx.fillStyle = "#555555"; ctx.font = "11px monospace"; ctx.textAlign = "center"
  ctx.fillText("Desliza para mover · Disparo automático · 🛡 escudo", W / 2, H - 40)
}

/* Pantalla de HANGAR — mejoras permanentes de nave */
interface UpgradeDef { key: keyof ShipUpgrades; name: string; desc: string; max: number; cost: (lvl: number) => number }
export const UPGRADE_DEFS: UpgradeDef[] = [
  { key: "hp",        name: "Blindaje",    desc: "+20 HP máximo",         max: 3, cost: l => 200 + l * 150 },
  { key: "shieldDur", name: "Escudo+",     desc: "+1s de escudo",         max: 3, cost: l => 250 + l * 150 },
  { key: "shieldCd",  name: "Recarga",     desc: "-1s recarga escudo",    max: 3, cost: l => 250 + l * 150 },
  { key: "fireRate",  name: "Cadencia",    desc: "-8% tiempo de disparo", max: 3, cost: l => 300 + l * 200 },
  { key: "magnet",    name: "Imán perm.",  desc: "Atrae drops siempre",   max: 1, cost: () => 600 },
]

function drawConfirmDialog(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  if (!gs.confirm) { gs.confirmBtns = []; return }
  gs.confirmBtns = []
  const bw = 320, bh = 210
  const bx = W / 2 - bw / 2, by = H / 2 - bh / 2
  ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(0, 0, W, H)

  // Caja
  ctx.fillStyle = "#0c141c"; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill()
  ctx.strokeStyle = "#ffcc44"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.stroke()

  // Título
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 17px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(gs.confirm.title, W / 2, by + 30)

  // Mensaje (envuelto en líneas)
  ctx.fillStyle = "#ffffff"; ctx.font = "13px monospace"
  const rawLines = gs.confirm.msg.split("\n")
  const lines: string[] = []
  for (const raw of rawLines) {
    const words = raw.split(" ")
    let cur = ""
    for (const w of words) {
      const test = cur ? cur + " " + w : w
      if (ctx.measureText(test).width > bw - 36 && cur) { lines.push(cur); cur = w }
      else cur = test
    }
    if (cur) lines.push(cur)
  }
  for (let i = 0; i < lines.length && i < 3; i++) ctx.fillText(lines[i], W / 2, by + 62 + i * 18)

  // Botones SÍ / NO
  const btnW = 120, btnH = 44
  const btnY = by + bh - btnH - 18
  const yesX = bx + 24, noX = bx + bw - btnW - 24
  gs.confirmBtns.push({ action: "confirm:yes", x: yesX, y: btnY, w: btnW, h: btnH })
  gs.confirmBtns.push({ action: "confirm:no", x: noX, y: btnY, w: btnW, h: btnH })

  const pulse = 0.94 + Math.sin(time * 4) * 0.06
  ctx.save(); ctx.translate(yesX + btnW / 2, btnY + btnH / 2); ctx.scale(pulse, pulse)
  ctx.fillStyle = "#44ff88"; ctx.beginPath(); ctx.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8); ctx.fill()
  ctx.fillStyle = "#001405"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("SÍ", 0, 0)
  ctx.restore()

  ctx.fillStyle = "#445566"; ctx.beginPath(); ctx.roundRect(noX, btnY, btnW, btnH, 8); ctx.fill()
  ctx.fillStyle = "#eef3f8"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("NO", noX + btnW / 2, btnY + btnH / 2)
}

function drawHangar(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("🔧 HANGAR", W / 2, 24)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 14px monospace"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()} monedas`, W / 2, 56)

  // Pestañas: Inventario | Mejoras
  gs.hangarBtns = []
  const tabs: Array<{ id: "inventory" | "upgrades"; label: string; color: string }> = [
    { id: "inventory", label: "🎒 INVENTARIO", color: "#44ff88" },
    { id: "upgrades", label: "⬆ MEJORAS", color: "#ffcc44" },
  ]
  const tabW = W / 2, tabH = 34, tabY = 82
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i]
    const tx = i * tabW
    gs.hangarBtns.push({ key: t.id, x: tx, y: tabY, w: tabW, h: tabH })
    const active = gs.hangarTab === t.id
    ctx.fillStyle = active ? t.color + "33" : "rgba(255,255,255,0.05)"
    ctx.fillRect(tx, tabY, tabW, tabH)
    ctx.fillStyle = active ? t.color : "#666"
    ctx.strokeStyle = active ? t.color : "#333"; ctx.lineWidth = active ? 2 : 1
    ctx.strokeRect(tx + 0.5, tabY + 0.5, tabW - 1, tabH - 1)
    ctx.font = active ? "bold 12px monospace" : "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(t.label, tx + tabW / 2, tabY + tabH / 2)
  }

  const listTop = tabY + tabH + 6
  const eq = gs.save.equipment
  const ship = getShip(gs.save)
  const lo = getLoadout(eq, ship.id)

  if (gs.hangarTab === "inventory") {
    gs.slotAreas = []
    gs.itemAreas = []
    gs.equipBtns = []
    // Inventario: slots de la nave actual + cuadrícula de láseres y escudos (4 por fila)
    ctx.fillStyle = "#cccccc"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    ctx.fillText(`Nave: ${ship.name} · Daño x${totalLaserMult(gs).toFixed(2)} · Escudo HP ${effShieldMaxHP(gs)}`, W / 2, listTop)
    drawSlotChips(ctx, gs, lo.lasers, lo.lasers.length, laserDef, listTop + 12, "LÁSERES EQUIPADOS", "laser")
    drawSlotChips(ctx, gs, lo.shields, lo.shields.length, shieldDef, listTop + 84, "ESCUDOS EQUIPADOS", "shield")

    // Cuadrícula desplazable del inventario
    const invTop = listTop + 156
    const invBottom = H - 48
    gs.invScroll = Math.max(0, Math.min(gs.invScroll, invMaxScroll(gs)))
    let cy = invTop - gs.invScroll

    // Sección LÁSERES
    ctx.fillStyle = "#44ff88"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillText("INVENTARIO — LÁSERES", 16, cy)
    cy += 18
    const laserTiles: InvTile[] = eq.lasers.map(inst => ({
      key: inst.uid, name: laserDef(inst.type).name, color: laserDef(inst.type).color,
      qty: 1, perfection: inst.perfection, equipped: lo.lasers.includes(inst.uid),
      tier: laserDef(inst.type).tier,
    }))
    cy = drawInvGrid(ctx, gs, laserTiles, cy, "laser")

    // Sección ESCUDOS
    cy += 12
    ctx.fillStyle = "#44aaff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillText("INVENTARIO — ESCUDOS", 16, cy)
    cy += 18
    const shieldTiles: InvTile[] = SHIELD_DEFS.map(item => ({
      key: item.id, name: item.name, color: item.color, qty: eq.shields[item.id] ?? 0,
      perfection: 0, equipped: lo.shields.some(s => s === item.id), tier: item.tier,
    }))
    drawInvGrid(ctx, gs, shieldTiles, cy, "shield")

    // Indicador de scroll
    if (invMaxScroll(gs) > 0) {
      const iy = invBottom - 16
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.roundRect(W / 2 - 110, iy - 10, 220, 22, 10); ctx.fill()
      ctx.fillStyle = "#888"; ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("⌄ Desliza para ver más ⌄", W / 2, iy)
    }

    // Item arrastrado siguiendo el dedo
    if (gs.dragItem) {
      const dk = gs.dragItem.kind
      let color = "#ffffff"
      if (dk === "laser") {
        const inst = getLaserInstance(eq, gs.dragItem.id)
        color = inst ? laserDef(inst.type).color : "#ffee00"
      } else {
        color = shieldDef(gs.dragItem.id).color
      }
      const dSize = 44
      ctx.globalAlpha = 0.85
      ctx.fillStyle = color + "33"
      ctx.fillRect(gs.dragX - dSize / 2, gs.dragY - dSize / 2, dSize, dSize)
      ctx.strokeStyle = color; ctx.lineWidth = 2
      ctx.strokeRect(gs.dragX - dSize / 2, gs.dragY - dSize / 2, dSize, dSize)
      drawItemIcon(ctx, dk, color, gs.dragX, gs.dragY, dSize - 8)
      ctx.globalAlpha = 1
    }
  } else {
    // Mejoras permanentes (lo que antes era el hangar)
    const cardH = 92, cardW = W - 40, cx = 20
    for (let i = 0; i < UPGRADE_DEFS.length; i++) {
      const def = UPGRADE_DEFS[i]
      const lvl = gs.save.upgrades[def.key]
      const maxed = lvl >= def.max
      const cost = def.cost(lvl)
      const afford = gs.save.coins >= cost
      const cy = listTop + 6 + i * (cardH + 8)
      gs.hangarBtns.push({ key: def.key, x: cx, y: cy, w: cardW, h: cardH })

      ctx.fillStyle = maxed ? "#1a2a1a" : afford ? "#ffcc4422" : "#1a1a22"
      ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.fill()
      ctx.strokeStyle = maxed ? "#44ff88" : afford ? "#ffcc4488" : "#333"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke()

      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px monospace"
      ctx.fillText(def.name, cx + 16, cy + 12)
      ctx.fillStyle = "#aaaaaa"; ctx.font = "11px monospace"
      ctx.fillText(def.desc, cx + 16, cy + 36)
      for (let p = 0; p < def.max; p++) {
        ctx.fillStyle = p < lvl ? "#44ff88" : "#444"
        ctx.beginPath(); ctx.arc(cx + 20 + p * 16, cy + 62, 5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.textAlign = "right"; ctx.textBaseline = "middle"
      if (maxed) {
        ctx.fillStyle = "#44ff88"; ctx.font = "bold 13px monospace"
        ctx.fillText("MÁX ✓", cx + cardW - 16, cy + cardH / 2)
      } else {
        const pulse = afford ? 1 + Math.sin(time * 4 + i) * 0.05 : 1
        ctx.save(); ctx.translate(cx + cardW - 56, cy + cardH / 2); ctx.scale(pulse, pulse)
        ctx.fillStyle = afford ? "#ffcc44" : "#443311"
        ctx.beginPath(); ctx.roundRect(-50, -16, 100, 32, 8); ctx.fill()
        ctx.fillStyle = afford ? "#201400" : "#776644"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"
        ctx.fillText(`🪙 ${cost}`, 0, 0)
        ctx.restore()
      }
    }
  }

  // Volver
  ctx.fillStyle = "#888"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
  ctx.fillText("← Volver al menú", W / 2, H - 18)

  // Mensaje flash (feedback de equipar/mejorar)
  if (gs.flashT > 0) {
    const alpha = Math.min(1, gs.flashT * 2)
    ctx.fillStyle = `rgba(255,255,100,${alpha})`
    ctx.font = "bold 15px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(gs.flashMsg, W / 2, H - 52)
  }

  // Diálogo de confirmación (encima de todo)
  drawConfirmDialog(ctx, gs, time)
}

/* Pantalla de TIENDA DE NAVES — comprar y equipar naves */
function drawShipStore(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#44ff88"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("🚀 TIENDA DE NAVES", W / 2, 26)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 16px monospace"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()} monedas`, W / 2, 60)

  gs.shipBtns = []
  const cardH = 100, cardW = W - 40, cx = 20
  for (let i = 0; i < SHIP_DEFS.length; i++) {
    const ship = SHIP_DEFS[i]
    const owned = gs.save.shipsOwned.includes(ship.id)
    const equipped = gs.save.shipId === ship.id
    const afford = gs.save.coins >= ship.price
    const cy = 92 + i * (cardH + 6)
    gs.shipBtns.push({ shipId: ship.id, x: cx, y: cy, w: cardW, h: cardH })

    // Card
    ctx.fillStyle = equipped ? "#22ff8833" : owned ? "#222a22" : afford ? "#44ff8833" : "#1a1a22"
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.fill()
    ctx.strokeStyle = equipped ? "#44ff88" : owned ? "#2a5a3a" : afford ? "#44ff8866" : "#333"; ctx.lineWidth = equipped ? 2.5 : 1.5
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke()

    // Vista previa de la nave
    ctx.save()
    ctx.translate(cx + 52, cy + cardH / 2)
    ctx.scale(1.5, 1.5)
    ctx.globalAlpha = owned ? 1 : 0.35
    drawShipShape(ctx, ship)
    ctx.restore()

    // Nombre + desc
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillStyle = owned ? "#ffffff" : "#cccccc"; ctx.font = "bold 16px monospace"
    ctx.fillText(ship.name, cx + 92, cy + 12)
    ctx.fillStyle = "#999999"; ctx.font = "11px monospace"
    ctx.fillText(ship.desc, cx + 92, cy + 32)
    // Stats
    ctx.fillStyle = "#88cc88"; ctx.font = "bold 10px monospace"
    const parts: string[] = []
    if (ship.speedMult !== 1) parts.push(`VEL ${ship.speedMult.toFixed(2)}x`)
    if (ship.hpMult !== 1) parts.push(`HP ${ship.hpMult.toFixed(2)}x`)
    if (ship.fireMult !== 1) parts.push(`CAD ${ship.fireMult.toFixed(2)}x`)
    if (ship.passive?.magnet) parts.push("🧲 IMÁN")
    ctx.fillText(parts.join("  "), cx + 92, cy + 52)

    // Botón derecho: comprar / equipar / equipada
    const btnW = 92, btnH = 40
    const btnX = cx + cardW - btnW - 12, btnY = cy + cardH - btnH - 10
    ctx.save()
    if (equipped) {
      ctx.fillStyle = "#44ff88"
      ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("✓ EQUIPADA", btnX + btnW / 2, btnY + btnH / 2)
    } else if (owned) {
      const pulse = 0.92 + Math.sin(time * 4 + i) * 0.08
      ctx.translate(btnX + btnW / 2, btnY + btnH / 2); ctx.scale(pulse, pulse)
      ctx.fillStyle = "#44ff88"
      ctx.beginPath(); ctx.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8); ctx.fill()
      ctx.fillStyle = "#001405"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("EQUIPAR", 0, 0)
    } else {
      const pulse = afford ? 0.92 + Math.sin(time * 4 + i) * 0.08 : 1
      ctx.translate(btnX + btnW / 2, btnY + btnH / 2); ctx.scale(pulse, pulse)
      ctx.fillStyle = afford ? "#44ff88" : "#223322"
      ctx.beginPath(); ctx.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8); ctx.fill()
      ctx.fillStyle = afford ? "#001405" : "#667766"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(`🪙 ${ship.price}`, 0, 0)
    }
    ctx.restore()
  }
  // Volver
  ctx.fillStyle = "#888"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
  ctx.fillText("← Volver al menú", W / 2, H - 18)

  // Diálogo de confirmación (encima de todo)
  drawConfirmDialog(ctx, gs, time)
}

/* ── Helpers del equip-store ── */

type EquipItem = {
  id: string; name: string; tier: number; price: number; color: string; desc: string
  dmgMult?: number; hpMult?: number; durMult?: number
}

function shortItemName(name: string): string {
  return name.replace(/^(Láser|Escudo)\s+/i, "")
}

// Cuadrado con el icono SVG del item y su tier en la esquina
function drawItemTile(ctx: CanvasRenderingContext2D, kind: IconKind, color: string, x: number, y: number, size: number, tier?: number) {
  ctx.fillStyle = color + "1f"
  ctx.fillRect(x, y, size, size)
  ctx.strokeStyle = color + "aa"; ctx.lineWidth = 1.5
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1)
  drawItemIcon(ctx, kind, color, x + size / 2, y + size / 2, size - 10)
  if (tier) {
    ctx.fillStyle = color; ctx.font = "bold 9px monospace"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"
    ctx.fillText(String(tier), x + size - 2, y + size - 1)
  }
}

function pointInRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number): boolean {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
}

function drawSlotChips(
  ctx: CanvasRenderingContext2D,
  gs: GS,
  slots: (string | null)[],
  count: number,
  defName: (id: string) => { name: string; color: string },
  top: number,
  label: string,
  kind: "laser" | "shield",
) {
  ctx.fillStyle = "#888"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"
  ctx.fillText(label, 16, top)
  const size = 40, gap = 9
  for (let i = 0; i < count; i++) {
    const id = slots[i]
    const def = id ? defName(id) : null
    const cx2 = 16 + i * (size + gap)
    const cy2 = top + 16
    const isDropTarget = !!gs.dragItem && gs.dragItem.kind === kind &&
      pointInRect(gs.dragX, gs.dragY, cx2, cy2, size, size)
    // Cuadrado del slot
    ctx.fillStyle = def ? def.color + "22" : "rgba(255,255,255,0.06)"
    ctx.fillRect(cx2, cy2, size, size)
    ctx.strokeStyle = isDropTarget ? "#ffffff" : def ? def.color + "aa" : "#444"
    ctx.lineWidth = isDropTarget ? 3 : 1.5
    if (isDropTarget) { ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 12 }
    ctx.strokeRect(cx2 + 0.5, cy2 + 0.5, size - 1, size - 1)
    ctx.shadowBlur = 0
    if (def) {
      drawItemIcon(ctx, kind, def.color, cx2 + size / 2, cy2 + size / 2, size - 8)
    } else {
      ctx.fillStyle = "#555"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("·", cx2 + size / 2, cy2 + size / 2)
    }
    // Número del slot debajo
    ctx.fillStyle = "#777"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    ctx.fillText(String(i + 1), cx2 + size / 2, cy2 + size + 2)
    // Área de drop para drag & drop
    gs.slotAreas.push({ kind, index: i, x: cx2, y: cy2, w: size, h: size })
  }
}

// Lista de items del inventario (láser o escudo) con sus botones de acción.
// mode "manage" = hangar (equipar/quitar de los slots); "store" = tienda (comprar/fusionar/perfección)
function drawItemList(
  ctx: CanvasRenderingContext2D,
  gs: GS,
  items: EquipItem[],
  top: number,
  kind: "laser" | "shield",
  mode: "manage" | "store",
) {
  const eq = gs.save.equipment
  const ship = getShip(gs.save)
  const lo = getLoadout(eq, ship.id)
  const slotArr = kind === "laser" ? lo.lasers : lo.shields
  const cardW = W - 32, cx = 16
  const cardH = 116, gap = 6
  const btnW = 100, btnH = 30

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const cy = top + i * (cardH + gap)
    const qty = kind === "laser" ? eq.lasers.filter(l => l.type === item.id).length : (eq.shields[item.id] ?? 0)
    const equippedCount = slotArr.filter(s => !!s && (kind === "laser" ? getLaserInstance(eq, s)?.type : s) === item.id).length
    const pct = kind === "laser"
      ? Math.max(0, ...eq.lasers.filter(l => l.type === item.id).map(l => l.perfection))
      : 0
    const perfect = pct >= 100
    const afford = gs.save.coins >= item.price
    const next = kind === "laser"
      ? LASER_DEFS.find(l => l.tier === item.tier + 1)
      : SHIELD_DEFS.find(s => s.tier === item.tier + 1)

    // Card
    ctx.fillStyle = equippedCount > 0 ? item.color + "22" : qty > 0 ? "#1a241a" : afford ? item.color + "10" : "#16161c"
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.fill()
    ctx.strokeStyle = equippedCount > 0 ? item.color : qty > 0 ? "#2a4a3a" : afford ? item.color + "66" : "#333"; ctx.lineWidth = equippedCount > 0 ? 2.5 : 1.5
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke()

    // Cuadrado con el icono SVG del item
    const tileSize = 46, tileX = cx + 12, tileY = cy + (cardH - tileSize) / 2
    drawItemTile(ctx, kind, item.color, tileX, tileY, tileSize, item.tier)

    // Info (a la derecha del cuadrado)
    const infoX = cx + tileSize + 22
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillStyle = item.color; ctx.font = "bold 14px monospace"
    ctx.fillText(item.name, infoX, cy + 8)
    ctx.fillStyle = "#666"; ctx.font = "10px monospace"
    ctx.fillText(`NIVEL ${item.tier}`, infoX, cy + 26)
    ctx.fillStyle = "#aaaaaa"; ctx.font = "10px monospace"
    ctx.fillText(item.desc, infoX, cy + 42)
    ctx.fillStyle = "#cccccc"; ctx.font = "bold 10px monospace"
    if (kind === "laser") {
      const inst = eq.lasers.filter(l => l.type === item.id)[0]
      const mult = inst ? singleLaserMult(eq, inst.uid).toFixed(2) : (item.dmgMult ?? 1).toFixed(2)
      ctx.fillText(`Daño x${mult}`, infoX, cy + 58)
    } else {
      ctx.fillText(`HP x${item.hpMult} · Dur +${Math.round((item.durMult! - 1) * 100)}%`, infoX, cy + 58)
    }

    // Cantidad en inventario
    ctx.fillStyle = qty > 0 ? item.color : "#555"; ctx.font = "bold 13px monospace"
    ctx.fillText(qty > 0 ? `×${qty}` : "—", infoX, cy + 74)

    // Barra de perfección (solo láseres)
    if (kind === "laser" && pct > 0) {
      const barX = infoX, barY = cy + 94, barW = 150, barH = 6
      ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = perfect ? "#ffee44" : pct > 50 ? "#44ff88" : "#ffaa44"
      ctx.fillRect(barX, barY, barW * pct / 100, barH)
      ctx.fillStyle = perfect ? "#ffee44" : "#aaa"; ctx.font = "bold 9px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
      ctx.fillText(perfect ? "★ PERFECTO ★" : `${Math.floor(pct)}%`, barX + barW + 6, barY + barH / 2)
    }

    // Botones de acción (hasta 3 apilados a la derecha), según modo
    const btnX = cx + cardW - btnW - 10
    const btnTop = cy + 10
    const buttons: Array<{ label: string; color: string; text: string; action: string }> = []
    if (mode === "manage") {
      // Hangar: equipar/quitar items del inventario en los slots
      if (equippedCount > 0) buttons.push({ label: "QUITAR", color: "#445566", text: "#eef3f8", action: `${kind}:unequip:${item.id}` })
      else if (qty > 0) buttons.push({ label: "EQUIPAR", color: item.color, text: "#0a100a", action: `${kind}:equip:${item.id}` })
      else buttons.push({ label: "NO TIENES", color: "#333", text: "#666", action: `${kind}:none` })
    } else {
      // Tienda: comprar / fusionar (la perfección se mejora por individual en el hangar)
      buttons.push({ label: `🪙 ${item.price}`, color: afford ? item.color : "#33241a", text: afford ? "#101400" : "#887766", action: `${kind}:buy:${item.id}` })
      if (qty >= FUSION_COUNT && next) buttons.push({ label: `FUSION ${Math.round(fusionChance(item.tier) * 100)}%`, color: "#aa77ff", text: "#12001e", action: `${kind}:fuse:${item.id}` })
    }

    for (let b = 0; b < buttons.length && b < 3; b++) {
      const bb = buttons[b]
      const by = btnTop + b * (btnH + 6)
      gs.equipBtns.push({ action: bb.action, x: btnX, y: by, w: btnW, h: btnH })
      ctx.fillStyle = bb.color
      ctx.beginPath(); ctx.roundRect(btnX, by, btnW, btnH, 6); ctx.fill()
      ctx.fillStyle = bb.text; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(bb.label, btnX + btnW / 2, by + btnH / 2)
    }
  }
}

// Lista compacta del inventario del hangar: cada item en una fila con su cantidad
// y botón EQUIPAR/QUITAR. Soporta scroll si no cabe (gs.invScroll).
// Cuadrícula del inventario del hangar: items como cuadros en filas de a 4.
interface InvTile {
  key: string; name: string; color: string
  qty: number; perfection: number; equipped: boolean; tier: number
}

const INV_COLS = 4
const INV_TILE_W = 106
const INV_TILE_H = 140
const INV_GAP_X = 8
const INV_GAP_Y = 10
const INV_GRID_X = 16

export function hangarInvScrollArea(): { top: number; bottom: number } {
  const listTop = 82 + 34 + 6
  return { top: listTop + 156, bottom: H - 48 }
}

export function invMaxScroll(gs: GS): number {
  const eq = gs.save.equipment
  const laserRows = Math.max(1, Math.ceil(eq.lasers.length / INV_COLS))
  const shieldRows = Math.max(1, Math.ceil(SHIELD_DEFS.length / INV_COLS))
  const headerH = 18
  const gapH = 12
  const laserH = laserRows * (INV_TILE_H + INV_GAP_Y)
  const shieldH = shieldRows * (INV_TILE_H + INV_GAP_Y)
  const contentH = headerH + laserH + gapH + headerH + shieldH
  const { top, bottom } = hangarInvScrollArea()
  return Math.max(0, contentH - (bottom - top))
}

function drawInvGrid(ctx: CanvasRenderingContext2D, gs: GS, tiles: InvTile[], top: number, kind: "laser" | "shield"): number {
  if (tiles.length === 0) return top
  for (let i = 0; i < tiles.length; i++) {
    const col = i % INV_COLS
    const row = Math.floor(i / INV_COLS)
    const tx = INV_GRID_X + col * (INV_TILE_W + INV_GAP_X)
    const ty = top + row * (INV_TILE_H + INV_GAP_Y)
    drawInvTile(ctx, gs, tiles[i], kind, tx, ty)
  }
  const rows = Math.ceil(tiles.length / INV_COLS)
  return top + rows * (INV_TILE_H + INV_GAP_Y)
}

function drawInvTile(ctx: CanvasRenderingContext2D, gs: GS, tile: InvTile, kind: "laser" | "shield", tx: number, ty: number) {
  const w = INV_TILE_W, h = INV_TILE_H
  const perfect = tile.perfection >= 100
  const owned = tile.qty > 0

  // Fondo del cuadro
  ctx.fillStyle = tile.equipped ? tile.color + "22" : owned ? "#1a241a" : "#16161c"
  ctx.beginPath(); ctx.roundRect(tx, ty, w, h, 8); ctx.fill()
  ctx.strokeStyle = tile.equipped ? tile.color : owned ? "#2a4a3a" : "#333"
  ctx.lineWidth = tile.equipped ? 2 : 1
  ctx.beginPath(); ctx.roundRect(tx, ty, w, h, 8); ctx.stroke()

  // Icono con tier
  const iconSize = 44
  const iconX = tx + (w - iconSize) / 2, iconY = ty + 6
  drawItemTile(ctx, kind, tile.color, iconX, iconY, iconSize, tile.tier)

  // Nombre corto
  ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillStyle = tile.color; ctx.font = "bold 9px monospace"
  ctx.fillText(shortItemName(tile.name), tx + w / 2, ty + 52)

  // Perfección / cantidad
  ctx.fillStyle = perfect ? "#ffee44" : "#aaa"; ctx.font = "bold 9px monospace"
  const info = kind === "laser"
    ? (perfect ? "★ PERFECTO" : `Perf ${Math.floor(tile.perfection)}%`)
    : (owned ? `×${tile.qty}` : "—")
  ctx.fillText(info, tx + w / 2, ty + 66)

  // Área arrastrable (icono + info, arriba de los botones)
  if (tile.equipped || owned) {
    gs.itemAreas.push({ kind, id: tile.key, x: tx + 2, y: ty + 2, w: w - 4, h: 72 })
  }

  // Botón equipar/quitar
  const btnW = w - 14
  const btnX = tx + 7
  let label: string, color: string, text: string, action: string
  if (tile.equipped) { label = "QUITAR"; color = "#445566"; text = "#eef3f8"; action = `${kind}:unequip:${tile.key}` }
  else if (owned) { label = "EQUIPAR"; color = tile.color; text = "#0a100a"; action = `${kind}:equip:${tile.key}` }
  else { label = "NO TIENES"; color = "#333"; text = "#666"; action = `${kind}:none` }
  const btnY = ty + 78
  gs.equipBtns.push({ action, x: btnX, y: btnY, w: btnW, h: 24 })
  ctx.fillStyle = color
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, 24, 5); ctx.fill()
  ctx.fillStyle = text; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(label, btnX + btnW / 2, btnY + 12)

  // Botón mejorar perfección (láser individual, solo si no está perfecto)
  if (kind === "laser" && !perfect && tile.perfection < 100) {
    const pBtnY = btnY + 28
    const cost = perfectBuyCost(tile.perfection)
    gs.equipBtns.push({ action: `laser:perf:${tile.key}`, x: btnX, y: pBtnY, w: btnW, h: 24 })
    ctx.fillStyle = "#ffee4433"
    ctx.beginPath(); ctx.roundRect(btnX, pBtnY, btnW, 24, 5); ctx.fill()
    ctx.fillStyle = "#ffee44"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(`MEJORAR 🪙${cost}`, btnX + btnW / 2, pBtnY + 12)
  }
}

/* Pantalla de TIENDA DE EQUIPAMIENTO — inventario + loadout por nave */
function drawEquipStore(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#ff8844"; ctx.font = "bold 24px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("🛒 TIENDA DE EQUIPAMIENTO", W / 2, 24)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 14px monospace"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()} monedas`, W / 2, 54)

  // Pestañas
  const tabs: Array<{ id: EquipTab; label: string; color: string }> = [
    { id: "lasers", label: "🔫 LÁSER", color: "#ffee00" },
    { id: "shields", label: "🛡 ESCUDO", color: "#44aaff" },
    { id: "bots", label: "🤖 ROBOTS", color: "#44ff88" },
    { id: "ammo", label: "📦 MUNICIÓN", color: "#cc88ff" },
    { id: "uav", label: "🛸 UAV", color: "#ff88cc" },
  ]
  gs.equipBtns = []
  const tabW = W / tabs.length, tabH = 34, tabY = 82
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i]
    const tx = i * tabW
    gs.equipBtns.push({ action: `tab:${t.id}`, x: tx, y: tabY, w: tabW, h: tabH })
    const active = gs.equipTab === t.id
    ctx.fillStyle = active ? t.color + "33" : "rgba(255,255,255,0.05)"
    ctx.fillRect(tx, tabY, tabW, tabH)
    ctx.strokeStyle = active ? t.color : "#333"; ctx.lineWidth = active ? 2 : 1
    ctx.strokeRect(tx + 0.5, tabY + 0.5, tabW - 1, tabH - 1)
    ctx.font = active ? "bold 12px monospace" : "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillStyle = active ? t.color : "#666"
    ctx.fillText(t.label, tx + tabW / 2, tabY + tabH / 2)
  }

  const listTop = tabY + tabH + 6
  const eq = gs.save.equipment
  const cardW = W - 32, cx = 16

  if (gs.equipTab === "lasers") {
    ctx.fillStyle = "#888"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    ctx.fillText(`Tienes ${inventoryLaserTotal(eq)} láser(es) en el inventario`, W / 2, listTop)
    drawItemList(ctx, gs, LASER_DEFS, listTop + 22, "laser", "store")
  } else if (gs.equipTab === "shields") {
    ctx.fillStyle = "#888"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    ctx.fillText(`Tienes ${Object.values(eq.shields).reduce((a, b) => a + b, 0)} escudo(s) en el inventario`, W / 2, listTop)
    drawItemList(ctx, gs, SHIELD_DEFS, listTop + 22, "shield", "store")
  } else if (gs.equipTab === "bots") {
    const bots = eq.repairBots
    ctx.fillStyle = "#888"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    ctx.fillText(`Tienes ${bots} robot(s) de reparación · Repara ${Math.round(REPAIR_BOT_HEAL * 100)}% de vida`, W / 2, listTop)
    const cy = listTop + 24
    const cardH2 = 120
    ctx.fillStyle = "#142414"; ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH2, 10); ctx.fill()
    ctx.strokeStyle = "#44ff8866"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH2, 10); ctx.stroke()
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillStyle = "#44ff88"; ctx.font = "bold 16px monospace"
    ctx.fillText("🤖 Robot de Reparación", cx + 16, cy + 14)
    ctx.fillStyle = "#aaaaaa"; ctx.font = "11px monospace"
    ctx.fillText("De un solo uso. Se activa con el botón de la", cx + 16, cy + 40)
    ctx.fillText("esquina superior durante la partida.", cx + 16, cy + 56)
    ctx.fillStyle = "#cccccc"; ctx.font = "bold 11px monospace"
    ctx.fillText(`Repara ${Math.round(REPAIR_BOT_HEAL * 100)}% del HP máximo.`, cx + 16, cy + 76)

    const afford = gs.save.coins >= REPAIR_BOT_PRICE
    const btnW = 110, btnH = 40
    const btnX = cx + cardW - btnW - 12, btnY = cy + cardH2 - btnH - 12
    gs.equipBtns.push({ action: "bot:buy", x: btnX, y: btnY, w: btnW, h: btnH })
    const pulse = afford ? 0.9 + Math.sin(time * 4) * 0.1 : 1
    ctx.save(); ctx.translate(btnX + btnW / 2, btnY + btnH / 2); ctx.scale(pulse, pulse)
    ctx.fillStyle = afford ? "#44ff88" : "#1a2a1a"
    ctx.beginPath(); ctx.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8); ctx.fill()
    ctx.fillStyle = afford ? "#0a1a0a" : "#446655"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(`🪙 ${REPAIR_BOT_PRICE}`, 0, 0)
    ctx.restore()
  } else if (gs.equipTab === "ammo") {
    // Munición: el láser vive en el inventario, spread/missile bancados
    ctx.fillStyle = "#888"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    ctx.fillText("Munición recolectada que se guarda entre partidas", W / 2, listTop)
    const banked = gs.save.bankedAmmo ?? {}
    const rows: Array<{ ammo: "laser" | "spread" | "missile"; n: number }> = [
      { ammo: "laser", n: inventoryLaserTotal(eq) },
      { ammo: "spread", n: banked.spread ?? 0 },
      { ammo: "missile", n: banked.missile ?? 0 },
    ]
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const cy = listTop + 24 + i * 60
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.beginPath(); ctx.roundRect(cx, cy, cardW, 52, 8); ctx.fill()
      ctx.strokeStyle = AMMO_COLORS[r.ammo] + "44"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx, cy, cardW, 52, 8); ctx.stroke()
      ctx.textAlign = "left"; ctx.textBaseline = "middle"
      ctx.fillStyle = AMMO_COLORS[r.ammo]; ctx.font = "bold 16px monospace"
      ctx.fillText(AMMO_ICONS[r.ammo], cx + 18, cy + 26)
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px monospace"
      ctx.fillText(AMMO_NAMES[r.ammo], cx + 40, cy + 26)
      ctx.fillStyle = "#cccccc"; ctx.font = "bold 11px monospace"
      ctx.fillText(`x${r.n}`, cx + 40, cy + 40)

      // Botón de compra
      const buy = AMMO_BUY[r.ammo]
      const afford = gs.save.coins >= buy.price
      const btnW2 = 96, btnH2 = 32
      const btnX2 = cx + cardW - btnW2 - 10, btnY2 = cy + (52 - btnH2) / 2
      gs.equipBtns.push({ action: `ammo:buy:${r.ammo}`, x: btnX2, y: btnY2, w: btnW2, h: btnH2 })
      ctx.fillStyle = afford ? AMMO_COLORS[r.ammo] : "#33241a"
      ctx.beginPath(); ctx.roundRect(btnX2, btnY2, btnW2, btnH2, 6); ctx.fill()
      ctx.fillStyle = afford ? "#101400" : "#887766"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(`🪙 ${buy.price} · +${buy.amount}`, btnX2 + btnW2 / 2, btnY2 + btnH2 / 2)
    }
    ctx.fillStyle = "#666"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("El láser se guarda en el inventario; se gasta al disparar.", W / 2, listTop + 24 + 3 * 60 + 18)
  } else {
    // UAVs: comprar y equipar drones que dan slots extra
    ctx.fillStyle = "#888"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
    const uavsEq = eq.uavsEquipped ?? []
    const bonus = uavsEq.reduce((acc, id) => acc + uavDef(id).slotsBonus, 0)
    ctx.fillText(`UAVs equipados: ${uavsEq.length} (+${bonus} slots)`, W / 2, listTop)
    const cardH3 = 104
    for (let i = 0; i < UAV_DEFS.length; i++) {
      const u = UAV_DEFS[i]
      const owned = (eq.uavsOwned ?? []).includes(u.id)
      const equipped = uavsEq.includes(u.id)
      const afford = gs.save.coins >= u.price
      const cy = listTop + 24 + i * (cardH3 + 8)
      ctx.fillStyle = equipped ? u.color + "33" : owned ? "#24242e" : afford ? u.color + "14" : "#16161c"
      ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH3, 10); ctx.fill()
      ctx.strokeStyle = equipped ? u.color : owned ? "#4a4a5a" : afford ? u.color + "66" : "#333"; ctx.lineWidth = equipped ? 2.5 : 1.5
      ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH3, 10); ctx.stroke()

      // Icono cuadrado del dron
      drawItemTile(ctx, "uav", u.color, cx + 14, cy + (cardH3 - 44) / 2, 44)

      const uInfoX = cx + 74
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = u.color; ctx.font = "bold 14px monospace"
      ctx.fillText(u.name, uInfoX, cy + 12)
      ctx.fillStyle = "#aaaaaa"; ctx.font = "10px monospace"
      ctx.fillText(u.desc, uInfoX, cy + 32)
      ctx.fillStyle = "#cccccc"; ctx.font = "bold 11px monospace"
      ctx.fillText(`${u.kind === "laser" ? "🔫" : "🛡"} +${u.slotsBonus} slot${u.slotsBonus > 1 ? "s" : ""}`, uInfoX, cy + 56)
      if (!owned) {
        ctx.fillStyle = "#888"; ctx.font = "10px monospace"
        ctx.fillText("🛸 COMPRA Y EQUIPA", uInfoX, cy + 78)
      }

      // Botón comprar / equipar / desequipar
      const bW = 92, bH = 32
      const bX = cx + cardW - bW - 10, bY = cy + (cardH3 - bH) / 2
      let label: string, col: string, txt: string, action: string
      if (equipped) { label = "QUITAR"; col = "#445566"; txt = "#eef3f8"; action = `uav:unequip:${u.id}` }
      else if (owned) { label = "EQUIPAR"; col = u.color; txt = "#100a10"; action = `uav:equip:${u.id}` }
      else { label = `🪙 ${u.price}`; col = afford ? u.color : "#33241a"; txt = afford ? "#101400" : "#887766"; action = `uav:buy:${u.id}` }
      gs.equipBtns.push({ action, x: bX, y: bY, w: bW, h: bH })
      ctx.fillStyle = col
      ctx.beginPath(); ctx.roundRect(bX, bY, bW, bH, 6); ctx.fill()
      ctx.fillStyle = txt; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(label, bX + bW / 2, bY + bH / 2)
    }
  }

  // Mensaje flash (feedback de compras/equipos/fusiones)
  if (gs.flashT > 0) {
    const alpha = Math.min(1, gs.flashT * 2)
    ctx.fillStyle = `rgba(255,255,100,${alpha})`
    ctx.font = "bold 15px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(gs.flashMsg, W / 2, H - 52)
  }

  // Volver
  ctx.fillStyle = "#888"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
  ctx.fillText("← Volver al menú", W / 2, H - 18)

  // Diálogo de confirmación (encima de todo)
  drawConfirmDialog(ctx, gs, time)
}

export function worldMaxScroll(): number {
  const bh = 96, gap = 10
  const listTop = 88, listBottom = H - 40
  const totalH = WORLDS.length * (bh + gap) - gap
  return Math.max(0, listTop + totalH - listBottom)
}

function drawWorldSelect(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("SELECCIONAR MUNDO", W / 2, 30)
  ctx.fillStyle = "#555"; ctx.font = "12px monospace"
  ctx.fillText(`Mundos conquistados: ${gs.save.worldsCleared}/${WORLDS.length}`, W / 2, 66)

  // Lista desplazable
  gs.worldBtns = []
  const bh = 96, bw = W - 40, bx = 20
  const listTop = 88, listBottom = H - 40
  const maxScroll = worldMaxScroll()
  gs.worldScroll = Math.max(0, Math.min(gs.worldScroll, maxScroll))

  for (let i = 0; i < WORLDS.length; i++) {
    const world = WORLDS[i]
    const unlocked = i === 0 || i <= gs.save.worldsCleared
    const by = listTop + i * (bh + 10) - gs.worldScroll
    gs.worldBtns.push({ worldId: i, x: bx, y: by, w: bw, h: bh })

    // Card bg
    ctx.fillStyle = unlocked ? world.accent + "33" : "#111111"
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill()
    if (unlocked) {
      ctx.strokeStyle = world.accent + "88"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.stroke()
    }
    // Lock
    if (!unlocked) {
      ctx.fillStyle = "#333"; ctx.font = "28px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("🔒", bx + bw / 2, by + bh / 2)
      ctx.fillStyle = "#444"; ctx.font = "12px monospace"
      ctx.fillText("Conquista el mundo anterior", bx + bw / 2, by + bh / 2 + 26)
      continue
    }
    // World info
    ctx.textAlign = "left"
    ctx.fillStyle = world.accent; ctx.font = "bold 18px monospace"; ctx.textBaseline = "top"
    ctx.fillText(`${i + 1}. ${world.name}`, bx + 16, by + 14)
    ctx.fillStyle = "#aaaaaa"; ctx.font = "12px monospace"
    ctx.fillText(world.subtitle, bx + 16, by + 38)
    // Boss name
    ctx.fillStyle = "#666"; ctx.font = "11px monospace"
    ctx.fillText(`Jefe: ${world.bossName}`, bx + 16, by + 56)
    // High score
    const hs = gs.save.highScores[i] ?? 0
    if (hs > 0) {
      ctx.fillStyle = "#ffcc44"; ctx.font = "bold 11px monospace"; ctx.textAlign = "right"
      ctx.fillText(`★ ${hs.toLocaleString()}`, bx + bw - 16, by + 14)
    }
    // Cleared badge
    if (i < gs.save.worldsCleared) {
      ctx.fillStyle = "#22ff88"; ctx.font = "bold 12px monospace"; ctx.textAlign = "right"
      ctx.fillText("✓ CONQUISTADO", bx + bw - 16, by + 56)
    }
    // Play chevron
    const pulse = 0.9 + Math.sin(time * 3 + i) * 0.1
    ctx.fillStyle = world.accent + "cc"; ctx.textAlign = "right"; ctx.font = `bold ${20 * pulse}px monospace`; ctx.textBaseline = "middle"
    ctx.fillText("▶", bx + bw - 12, by + bh / 2)
  }
  // Indicador de scroll
  if (maxScroll > 0) {
    ctx.fillStyle = "#666"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("⌄ Desliza para ver más ⌄", W / 2, listBottom + 9)
  }
  // Back
  ctx.fillStyle = "#555555"; ctx.font = "13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
  ctx.fillText("← Atrás", W / 2, H - 20)
}

function drawBossIntro(ctx: CanvasRenderingContext2D, gs: GS) {
  const alpha = Math.min(1, gs.phaseTimer / 0.5)
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.8})`; ctx.fillRect(0, 0, W, H)

  const world = WORLDS[gs.worldId]
  const shake = gs.phaseTimer < 1.5 ? Math.sin(gs.phaseTimer * 30) * 3 : 0

  ctx.save(); ctx.translate(W / 2 + shake, H / 2)
  ctx.fillStyle = "#ff2200"; ctx.font = "bold 24px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 20
  ctx.fillText("⚠ JEFE ENTRANTE ⚠", 0, -60)
  ctx.shadowBlur = 0

  ctx.fillStyle = world.accent; ctx.font = "bold 36px monospace"
  ctx.fillText(world.bossName.toUpperCase(), 0, 0)

  ctx.fillStyle = "#888"; ctx.font = "14px monospace"
  ctx.fillText(`Mundo ${gs.worldId + 1} — ${world.name}`, 0, 50)

  if (gs.phaseTimer > 2) {
    ctx.fillStyle = "#ffffff"; ctx.font = `bold ${14 + Math.sin(gs.phaseTimer * 4) * 2}px monospace`
    ctx.fillText("¡PREPÁRATE!", 0, 100)
  }
  ctx.restore()

  if (gs.phaseTimer > 3.5) transitionTo(gs, "boss")
}

function drawWorldClear(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  const t = gs.phaseTimer
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, t * 2)})`; ctx.fillRect(0, 0, W, H)

  const world = WORLDS[gs.worldId]
  ctx.fillStyle = world.accent; ctx.font = "bold 38px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = world.accent; ctx.shadowBlur = 30
  ctx.fillText("¡MUNDO CONQUISTADO!", W / 2, H / 2 - 70)
  ctx.shadowBlur = 0

  ctx.fillStyle = "#ffffff"; ctx.font = "bold 22px monospace"
  ctx.fillText(world.name.toUpperCase(), W / 2, H / 2 - 20)

  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 20px monospace"
  ctx.fillText(`Puntaje: ${gs.score.toLocaleString()}`, W / 2, H / 2 + 20)

  ctx.fillStyle = "#ffdd44"; ctx.font = "bold 14px monospace"
  ctx.fillText(`🪙 +${gs.lastRunCoins} monedas`, W / 2, H / 2 + 48)

  const hs = gs.save.highScores[gs.worldId] ?? 0
  if (gs.score >= hs) {
    ctx.fillStyle = "#44ff88"; ctx.font = "bold 16px monospace"
    ctx.fillText("★ NUEVO RÉCORD ★", W / 2, H / 2 + 74)
  }

  if (t > 2) {
    const isLast = gs.worldId >= WORLDS.length - 1
    const pulse = 0.92 + Math.sin(time * 3) * 0.08
    ctx.save(); ctx.translate(W / 2, H / 2 + 130); ctx.scale(pulse, pulse)
    ctx.fillStyle = isLast ? "#ffcc44" : world.accent
    ctx.beginPath(); ctx.roundRect(-100, -26, 200, 52, 10); ctx.fill()
    ctx.fillStyle = "#000010"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(isLast ? "🏆 VER FINAL" : "SIGUIENTE MUNDO →", 0, 0)
    ctx.restore()
  }
}

function drawGameover(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.88, gs.phaseTimer * 2)})` ; ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = "#ff2200"; ctx.font = "bold 48px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 30
  ctx.fillText("GAME OVER", W / 2, H / 2 - 80)
  ctx.shadowBlur = 0

  ctx.fillStyle = "#aaaaaa"; ctx.font = "16px monospace"
  ctx.fillText(gs.isEndless ? `ENDLESS — Oleada ${gs.endlessWave}` : `Mundo ${gs.worldId + 1} — ${WORLDS[gs.worldId].name}`, W / 2, H / 2 - 24)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 20px monospace"
  ctx.fillText(`Puntaje: ${gs.score.toLocaleString()}`, W / 2, H / 2 + 6)
  ctx.fillStyle = "#ff88bb"; ctx.font = "13px monospace"
  ctx.fillText(`Combo máx: x${gs.save.bestCombo}`, W / 2, H / 2 + 32)
  ctx.fillStyle = "#ffdd44"; ctx.font = "bold 14px monospace"
  ctx.fillText(`🪙 +${gs.lastRunCoins} monedas`, W / 2, H / 2 + 54)

  if (gs.phaseTimer > 1.5) {
    const pulse = 0.92 + Math.sin(time * 2.5) * 0.08
    ctx.save(); ctx.translate(W / 2, H / 2 + 100); ctx.scale(pulse, pulse)
    ctx.fillStyle = "#ff4444"
    ctx.beginPath(); ctx.roundRect(-90, -24, 180, 48, 10); ctx.fill()
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("↺  REINTENTAR", 0, 0)
    ctx.restore()

    ctx.save(); ctx.translate(W / 2, H / 2 + 160); ctx.scale(pulse * 0.9, pulse * 0.9)
    ctx.fillStyle = "#333"
    ctx.beginPath(); ctx.roundRect(-90, -24, 180, 48, 10); ctx.fill()
    ctx.fillStyle = "#aaa"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("≡  MENÚ", 0, 0)
    ctx.restore()
  }
}

function drawVictory(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.9, gs.phaseTimer)})` ; ctx.fillRect(0, 0, W, H)

  // Gold particles effect via text
  ctx.fillStyle = "#ffdd44"; ctx.font = "bold 42px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#ffaa00"; ctx.shadowBlur = 40
  ctx.fillText("¡VICTORIOSO!", W / 2, H / 2 - 100)
  ctx.shadowBlur = 0

  ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px monospace"
  ctx.fillText("Has conquistado todos los mundos", W / 2, H / 2 - 40)

  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 26px monospace"
  const totalScore = gs.save.highScores.reduce((a, b) => a + b, 0)
  ctx.fillText(`Récord total: ${totalScore.toLocaleString()}`, W / 2, H / 2 + 20)

  ctx.fillStyle = "#88ff88"; ctx.font = "14px monospace"
  ctx.fillText("El universo está en paz gracias a ti", W / 2, H / 2 + 70)

  if (gs.phaseTimer > 2) {
    const pulse = 0.92 + Math.sin(time * 2.5) * 0.08
    ctx.save(); ctx.translate(W / 2, H / 2 + 140); ctx.scale(pulse, pulse)
    ctx.fillStyle = "#ffdd44"
    ctx.beginPath(); ctx.roundRect(-110, -26, 220, 52, 10); ctx.fill()
    ctx.fillStyle = "#000010"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("≡ MENÚ PRINCIPAL", 0, 0)
    ctx.restore()
  }
}

/* ── DRAW FRAME ── */
export function draw(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.clearRect(0, 0, W, H)

  // Screen shake
  const shakeX = gs.screenShake > 0 ? (Math.random() - 0.5) * gs.screenShake * 2 : 0
  const shakeY = gs.screenShake > 0 ? (Math.random() - 0.5) * gs.screenShake : 0
  ctx.save()
  ctx.translate(shakeX, shakeY)

  drawBackground(ctx, gs)
  drawStars(ctx, gs)

  if (gs.phase === "intro") {
    drawIntro(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "world-select") {
    drawWorldSelect(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "hangar") {
    drawHangar(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "ship-store") {
    drawShipStore(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "equip-store") {
    drawEquipStore(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "gameover") {
    for (const p of gs.particles) drawParticle(ctx, p)
    drawShockwaves(ctx, gs); drawFloaters(ctx, gs)
    drawGameover(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "victory") {
    for (const p of gs.particles) drawParticle(ctx, p)
    drawShockwaves(ctx, gs)
    drawVictory(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "boss-intro") {
    if (gs.boss) drawBossShip(ctx, gs.boss, time)
    drawBossIntro(ctx, gs); ctx.restore(); drawMuteBtn(ctx); return
  }

  // Playing / boss
  for (const p of gs.particles) drawParticle(ctx, p)
  drawTrail(ctx, gs)
  for (const d of gs.drops) drawDrop(ctx, d, time)
  for (const e of gs.enemies) drawEnemyShip(ctx, e)
  if (gs.boss?.alive) drawBossShip(ctx, gs.boss, time)

  const laserTier = equippedLaserTier(gs)
  for (const b of gs.bullets) drawBullet(ctx, b, laserTier)
  for (const b of gs.enemyBullets) drawBullet(ctx, b)
  drawShockwaves(ctx, gs)

  // Boss laser
  if (gs.bossLaserActive && gs.boss?.alive) {
    const alpha = Math.min(1, gs.bossLaserT / 0.3)
    ctx.strokeStyle = `rgba(255,220,0,${alpha * 0.9})`
    ctx.lineWidth = 4 + Math.sin(time * 20) * 2
    ctx.shadowColor = "#ffee00"; ctx.shadowBlur = 20
    ctx.beginPath(); ctx.moveTo(gs.bossLaserX, gs.boss.y + gs.boss.h / 2)
    ctx.lineTo(gs.bossLaserX, H - HUD_H)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  const shieldTier = equippedShieldTier(gs)
  const sIds = equippedShieldIds(gs)
  const shieldColor = sIds.length > 0 ? shieldDef(sIds[0]).color : "#4488ff"
  const uavs = gs.save.equipment.uavsEquipped ?? []
  const uavColor = uavs.length > 0 ? uavDef(uavs[0]).color : "#44ff88"

  drawPlayerShip(
    ctx, gs.playerX, gs.playerY, getShip(gs.save), gs.invTimer,
    gs.shieldActive, gs.shieldHP, gs.shieldMaxHP,
    gs.shieldCooldown, gs.shieldCdMax, time,
    shieldTier, shieldColor, uavs.length, uavColor,
  )

  drawFloaters(ctx, gs)

  ctx.restore()  // fin screen shake

  if (gs.phase === "world-clear") {
    drawWorldClear(ctx, gs, time)
  } else {
    drawHUD(ctx, gs)
  }

  // Botón de silencio — siempre visible en todas las fases
  drawMuteBtn(ctx)
}