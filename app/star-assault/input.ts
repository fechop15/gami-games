import type { GS, EquipTab } from "./types"
import {
  H, MUTE_BTN, AMMO_NAMES, AMMO_BUY, PERFECT_BUY_STEP, perfectBuyCost,
  FUSION_COUNT, fusionChance, REPAIR_BOT_PRICE,
} from "./constants"
import {
  LASER_DEFS, SHIELD_DEFS, laserDef, shieldDef, uavDef, getLaserInstance,
  getLoadout, inventoryLaserTotal, addLaserToInventory,
} from "./items"
import { SHIP_DEFS, getShip } from "./ships"
import { WORLDS } from "./worlds"
import { transitionTo, startEndless, loadBankedAmmo, repairShip, activateShield } from "./engine"
import { UPGRADE_DEFS } from "./ui"
import { SFX, setSoundMuted, getSoundMuted } from "./audio"
import { writeStarSave, type ShipUpgrades } from "./save"

// Equipa un item del inventario en el primer slot libre de la nave actual
function equipSlot(gs: GS, kind: "laser" | "shield", id: string): boolean {
  const ship = getShip(gs.save)
  const lo = getLoadout(gs.save.equipment, ship.id)
  const arr = kind === "laser" ? lo.lasers : lo.shields
  const idx = arr.findIndex(x => x === null)
  if (idx === -1) return false
  arr[idx] = id
  return true
}

// Desequipa un item de la nave actual (quita la última copia equipada)
function unequipSlot(gs: GS, kind: "laser" | "shield", id: string): boolean {
  const ship = getShip(gs.save)
  const lo = getLoadout(gs.save.equipment, ship.id)
  const arr = kind === "laser" ? lo.lasers : lo.shields
  const idx = arr.lastIndexOf(id)
  if (idx === -1) return false
  arr[idx] = null
  return true
}

// Ejecuta una acción de gestión del inventario tras confirmarla el jugador
function execHangarAction(gs: GS, action: string) {
  const eq = gs.save.equipment
  if (action.startsWith("laser:equip:")) {
    const uid = action.slice("laser:equip:".length)
    const inst = getLaserInstance(eq, uid)
    const nm = inst ? laserDef(inst.type).name : "Láser"
    if (equipSlot(gs, "laser", uid)) {
      writeStarSave(gs.save)
      gs.flashMsg = `${nm} equipado`
      gs.flashT = 1.2; SFX.pickup()
    } else { gs.flashMsg = "Sin slots libres"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("laser:unequip:")) {
    const id = action.slice("laser:unequip:".length)
    if (unequipSlot(gs, "laser", id)) {
      writeStarSave(gs.save)
      const inst = getLaserInstance(eq, id)
      gs.flashMsg = `${inst ? laserDef(inst.type).name : "Láser"} desequipado`
      gs.flashT = 1.2; SFX.pickup()
    }
    return
  }
  if (action.startsWith("shield:equip:")) {
    const id = action.slice("shield:equip:".length)
    if (equipSlot(gs, "shield", id)) {
      writeStarSave(gs.save)
      gs.flashMsg = `${shieldDef(id).name} equipado`
      gs.flashT = 1.2; SFX.pickup()
    } else { gs.flashMsg = "Sin slots libres"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("shield:unequip:")) {
    const id = action.slice("shield:unequip:".length)
    if (unequipSlot(gs, "shield", id)) {
      writeStarSave(gs.save)
      gs.flashMsg = `${shieldDef(id).name} desequipado`
      gs.flashT = 1.2; SFX.pickup()
    }
    return
  }
  if (action.startsWith("upgrade:")) {
    const key = action.slice("upgrade:".length) as keyof ShipUpgrades
    const def = UPGRADE_DEFS.find(d => d.key === key)
    if (!def) return
    const lvl = gs.save.upgrades[key]
    if (lvl >= def.max) { gs.flashMsg = "Ya está al máximo"; gs.flashT = 1; return }
    const cost = def.cost(lvl)
    if (gs.save.coins >= cost) {
      gs.save.coins -= cost
      gs.save.upgrades[key] = lvl + 1
      writeStarSave(gs.save)
      SFX.pickup()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("laser:perf:")) {
    const uid = action.slice("laser:perf:".length)
    const inst = getLaserInstance(eq, uid)
    if (!inst) return
    const pct = inst.perfection
    if (pct >= 100) return
    const cost = perfectBuyCost(pct)
    if (gs.save.coins >= cost) {
      gs.save.coins -= cost
      inst.perfection = Math.min(100, pct + PERFECT_BUY_STEP)
      writeStarSave(gs.save)
      const np = inst.perfection
      gs.flashMsg = np >= 100 ? "★ ¡LÁSER PERFECTO! ★" : `Perfección +${PERFECT_BUY_STEP}%`
      gs.flashT = 1.6; SFX.pickup()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
}

// Ejecuta una acción de la tienda de naves tras confirmarla el jugador
function execShipAction(gs: GS, action: string) {
  if (action.startsWith("ship:buy:")) {
    const id = action.slice("ship:buy:".length)
    const ship = SHIP_DEFS.find(s => s.id === id)
    if (!ship) return
    if (gs.save.coins >= ship.price) {
      gs.save.coins -= ship.price
      gs.save.shipsOwned.push(ship.id)
      gs.save.shipId = ship.id
      writeStarSave(gs.save)
      gs.flashMsg = `¡${ship.name} comprada!`
      gs.flashT = 1.5; SFX.worldClear()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("ship:equip:")) {
    const id = action.slice("ship:equip:".length)
    const ship = SHIP_DEFS.find(s => s.id === id)
    if (!ship) return
    if (gs.save.shipId !== ship.id) {
      gs.save.shipId = ship.id
      writeStarSave(gs.save)
      gs.flashMsg = `${ship.name} equipada`
      gs.flashT = 1.2; SFX.pickup()
    }
    return
  }
}

// Fusión: gasta FUSION_COUNT del mismo tipo; si acierta obtienes 1 del nivel siguiente, si falla se pierden
function fuseItem(gs: GS, kind: "laser" | "shield", id: string) {
  const eq = gs.save.equipment
  const defs = kind === "laser" ? LASER_DEFS : SHIELD_DEFS
  const def = kind === "laser" ? laserDef(id) : shieldDef(id)
  const next = defs.find(d => d.tier === def.tier + 1)
  if (!next) {
    gs.flashMsg = "¡Ya es el nivel máximo!"
    gs.flashT = 1.2
    SFX.shieldOff()
    return
  }

  let qty: number
  if (kind === "laser") {
    // Instancias individuales: contar las del mismo type y eliminar FUSION_COUNT
    const matching = eq.lasers.filter(l => l.type === id)
    qty = matching.length
    if (qty < FUSION_COUNT) return
    let removed = 0
    for (let i = eq.lasers.length - 1; i >= 0 && removed < FUSION_COUNT; i--) {
      if (eq.lasers[i].type === id) { eq.lasers.splice(i, 1); removed++ }
    }
    if (Math.random() < fusionChance(def.tier)) {
      addLaserToInventory(eq, next.id)
      gs.flashMsg = `¡Fusión exitosa! ${next.name} ×1`
      gs.flashT = 1.6
      SFX.pickup()
    } else {
      gs.flashMsg = `Fusión fallida... se perdieron ${FUSION_COUNT} ${def.name}`
      gs.flashT = 1.6
      SFX.shieldBreak()
    }
    gs.ammo.laser = inventoryLaserTotal(eq)
    writeStarSave(gs.save)
    return
  }

  // Escudos (Record agregado)
  const stock = eq.shields
  qty = stock[id] ?? 0
  if (qty < FUSION_COUNT) return
  stock[id] = (stock[id] ?? 0) - FUSION_COUNT
  if (Math.random() < fusionChance(def.tier)) {
    stock[next.id] = (stock[next.id] ?? 0) + 1
    gs.flashMsg = `¡Fusión exitosa! ${next.name} ×1`
    gs.flashT = 1.6
    SFX.pickup()
  } else {
    gs.flashMsg = `Fusión fallida... se perdieron ${FUSION_COUNT} ${def.name}`
    gs.flashT = 1.6
    SFX.shieldBreak()
  }
  writeStarSave(gs.save)
}

/* ── DRAG & DROP del hangar ── */

// Inicia el arrastre si el punto toca un item del inventario o un slot ocupado.
// Devuelve true si se inició el drag (el tap NO debe disparar handleTap).
export function hangarDragStart(gs: GS, x: number, y: number): boolean {
  if (gs.phase !== "hangar" || gs.hangarTab !== "inventory" || gs.confirm) return false
  // Ítems del inventario primero
  for (const a of gs.itemAreas) {
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) {
      gs.dragItem = { kind: a.kind, id: a.id }
      gs.dragX = x; gs.dragY = y
      return true
    }
  }
  // Slots de la nave (solo si tienen item)
  for (const a of gs.slotAreas) {
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) {
      const ship = getShip(gs.save)
      const lo = getLoadout(gs.save.equipment, ship.id)
      const arr = a.kind === "laser" ? lo.lasers : lo.shields
      const id = arr[a.index]
      if (!id) return true  // slot vacío: traga el toque para no disparar botones
      gs.dragItem = { kind: a.kind, id }
      gs.dragX = x; gs.dragY = y
      return true
    }
  }
  return false
}

export function hangarDragMove(gs: GS, x: number, y: number): void {
  if (!gs.dragItem) return
  gs.dragX = x; gs.dragY = y
}

// ¿El punto está sobre un botón del inventario del hangar? (para no iniciar scroll)
export function onHangarInvButton(gs: GS, x: number, y: number): boolean {
  if (gs.phase !== "hangar" || gs.hangarTab !== "inventory") return false
  for (const b of gs.equipBtns) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true
  }
  return false
}

// ¿El punto está sobre un tile arrastrable del inventario? (para no iniciar scroll)
export function onHangarTile(gs: GS, x: number, y: number): boolean {
  if (gs.phase !== "hangar" || gs.hangarTab !== "inventory") return false
  for (const a of gs.itemAreas) {
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return true
  }
  return false
}

// Resuelve el drop: equipar en slot vacío, intercambiar/reemplazar, o desequipar fuera.
export function hangarDragEnd(gs: GS, x: number, y: number): void {
  const drag = gs.dragItem
  if (!drag) return
  const eq = gs.save.equipment
  const ship = getShip(gs.save)
  const lo = getLoadout(eq, ship.id)
  const slotArr = drag.kind === "laser" ? lo.lasers : lo.shields
  const equipped = drag.kind === "laser" ? lo.lasers.includes(drag.id) : lo.shields.includes(drag.id)

  // Tap sin arrastre real (menos de 12px): no hacer nada para evitar desequipar por error
  const dx = x - gs.dragX, dy = y - gs.dragY
  if (Math.sqrt(dx * dx + dy * dy) < 12) {
    gs.dragItem = null
    return
  }

  // Slot objetivo bajo el dedo
  let targetSlot = -1
  for (const a of gs.slotAreas) {
    if (a.kind !== drag.kind) continue
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) { targetSlot = a.index; break }
  }

  if (targetSlot === -1) {
    // Soltó fuera de los slots: si venía equipado, desequipar
    if (equipped) {
      for (let i = 0; i < slotArr.length; i++) if (slotArr[i] === drag.id) slotArr[i] = null
      writeStarSave(gs.save)
      const nm = drag.kind === "laser" ? laserDef(getLaserInstance(eq, drag.id)?.type ?? "laser_std").name : shieldDef(drag.id).name
      gs.flashMsg = `${nm} desequipado`
      gs.flashT = 1.2
      SFX.pickup()
    }
    return
  }

  const occupant = slotArr[targetSlot]
  if (equipped) {
    // Viene de otro slot: se mueve (se quita de todos y se coloca en el objetivo)
    for (let i = 0; i < slotArr.length; i++) if (slotArr[i] === drag.id) slotArr[i] = null
  }
  // Si el slot tenía otro item, ese vuelve al inventario (en ambos casos el item
  // siempre vive en el inventario: los láseres por instancia y los escudos por Record).
  slotArr[targetSlot] = drag.id
  writeStarSave(gs.save)
  const nm = drag.kind === "laser" ? laserDef(getLaserInstance(eq, drag.id)?.type ?? "laser_std").name : shieldDef(drag.id).name
  gs.flashMsg = occupant && occupant !== drag.id ? `${nm} reemplazado` : `${nm} equipado`
  gs.flashT = 1.2
  SFX.pickup()
}

// Ejecuta una acción de la tienda de equipamiento tras confirmarla el jugador
function execStoreAction(gs: GS, action: string) {
  const eq = gs.save.equipment
  if (action.startsWith("laser:buy:")) {
    const id = action.slice("laser:buy:".length)
    const def = laserDef(id)
    if (gs.save.coins >= def.price) {
      gs.save.coins -= def.price
      addLaserToInventory(eq, id)
      gs.ammo.laser = inventoryLaserTotal(eq)
      writeStarSave(gs.save)
      gs.flashMsg = `¡${def.name} comprado!`
      gs.flashT = 1.5; SFX.worldClear()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("laser:fuse:")) {
    fuseItem(gs, "laser", action.slice("laser:fuse:".length))
    return
  }
  if (action.startsWith("shield:buy:")) {
    const id = action.slice("shield:buy:".length)
    const def = shieldDef(id)
    if (gs.save.coins >= def.price) {
      gs.save.coins -= def.price
      eq.shields[id] = (eq.shields[id] ?? 0) + 1
      writeStarSave(gs.save)
      gs.flashMsg = `¡${def.name} comprado!`
      gs.flashT = 1.5; SFX.worldClear()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("shield:fuse:")) {
    fuseItem(gs, "shield", action.slice("shield:fuse:".length))
    return
  }
  if (action === "bot:buy") {
    if (gs.save.coins >= REPAIR_BOT_PRICE) {
      gs.save.coins -= REPAIR_BOT_PRICE
      eq.repairBots += 1
      writeStarSave(gs.save)
      gs.flashMsg = "+1 Robot de reparación"
      gs.flashT = 1.5; SFX.pickup()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("ammo:buy:")) {
    const ammo = action.slice("ammo:buy:".length) as "laser" | "spread" | "missile"
    const buy = AMMO_BUY[ammo]
    if (!buy) return
    if (gs.save.coins >= buy.price) {
      gs.save.coins -= buy.price
      if (ammo === "laser") {
        addLaserToInventory(eq, "laser_std")
        gs.ammo.laser = inventoryLaserTotal(eq)
      } else {
        gs.ammo[ammo] = (gs.ammo[ammo] ?? 0) + buy.amount
        gs.save.bankedAmmo = { ...gs.save.bankedAmmo, [ammo]: gs.ammo[ammo] }
      }
      writeStarSave(gs.save)
      gs.flashMsg = `+${buy.amount} ${AMMO_NAMES[ammo]}!`
      gs.flashT = 1.5; SFX.worldClear()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("uav:buy:")) {
    const id = action.slice("uav:buy:".length)
    const def = uavDef(id)
    if (gs.save.coins >= def.price) {
      gs.save.coins -= def.price
      eq.uavsOwned = eq.uavsOwned ?? []
      eq.uavsOwned.push(id)
      eq.uavsEquipped = eq.uavsEquipped ?? []
      eq.uavsEquipped.push(id)
      writeStarSave(gs.save)
      gs.flashMsg = `¡${def.name} comprado y equipado!`
      gs.flashT = 1.5; SFX.worldClear()
    } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
    return
  }
  if (action.startsWith("uav:equip:")) {
    const id = action.slice("uav:equip:".length)
    eq.uavsEquipped = eq.uavsEquipped ?? []
    if (!eq.uavsEquipped.includes(id)) {
      eq.uavsEquipped.push(id)
      writeStarSave(gs.save)
      gs.flashMsg = `${uavDef(id).name} equipado (+${uavDef(id).slotsBonus} slots)`
      gs.flashT = 1.4; SFX.pickup()
    }
    return
  }
  if (action.startsWith("uav:unequip:")) {
    const id = action.slice("uav:unequip:".length)
    eq.uavsEquipped = (eq.uavsEquipped ?? []).filter(x => x !== id)
    writeStarSave(gs.save)
    gs.flashMsg = `${uavDef(id).name} desequipado`
    gs.flashT = 1.2; SFX.pickup()
    return
  }
}

export function handleTap(gs: GS, cx: number, cy: number, canvasRect: DOMRect, scaleX: number, scaleY: number) {
  const x = (cx - canvasRect.left) * scaleX
  const y = (cy - canvasRect.top) * scaleY

  // Botón de silencio — prioridad máxima, siempre activo
  const mb = MUTE_BTN
  if (x >= mb.x - 6 && x <= mb.x + mb.w + 6 && y >= mb.y - 6 && y <= mb.y + mb.h + 6) {
    setSoundMuted(!getSoundMuted())
    return
  }

  // Diálogo de confirmación — bloquea cualquier otra interacción
  if (gs.confirm) {
    for (const btn of gs.confirmBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if (btn.action === "confirm:yes") {
          const a = gs.confirm.action
          gs.confirm = null
          if (gs.phase === "equip-store") execStoreAction(gs, a)
          else if (gs.phase === "ship-store") execShipAction(gs, a)
          else execHangarAction(gs, a)
        } else {
          gs.confirm = null
          SFX.shieldOff()
        }
        return
      }
    }
    return
  }

  if (gs.phase === "intro") {
    for (const btn of gs.introBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if (btn.action === "campaign") transitionTo(gs, "world-select")
        else if (btn.action === "endless") startEndless(gs)
        else if (btn.action === "hangar") { gs.phase = "hangar"; gs.phaseTimer = 0 }
        else if (btn.action === "equip") { gs.phase = "equip-store"; gs.phaseTimer = 0; gs.equipTab = "lasers" }
        else if (btn.action === "ships") { gs.phase = "ship-store"; gs.phaseTimer = 0 }
        return
      }
    }
    return
  }

  if (gs.phase === "ship-store") {
    if (y > H - 42) { gs.phase = "intro"; gs.phaseTimer = 0; return }
    for (const btn of gs.shipBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const ship = SHIP_DEFS.find(s => s.id === btn.shipId)!
        const owned = gs.save.shipsOwned.includes(ship.id)
        if (owned) {
          if (gs.save.shipId !== ship.id) {
            gs.confirm = { title: "EQUIPAR NAVE", msg: `¿Equipar la nave ${ship.name}?`, action: `ship:equip:${ship.id}` }
          }
        } else {
          if (gs.save.coins >= ship.price) {
            gs.confirm = { title: "COMPRAR NAVE", msg: `¿Comprar la nave ${ship.name} por 🪙 ${ship.price}?`, action: `ship:buy:${ship.id}` }
          } else {
            gs.flashMsg = "Monedas insuficientes"
            gs.flashT = 1
            SFX.shieldOff()
          }
        }
        return
      }
    }
    return
  }

  if (gs.phase === "equip-store") {
    if (y > H - 42) { gs.phase = "intro"; gs.phaseTimer = 0; return }
    // Recorre en orden inverso para que el botón específico tenga prioridad
    for (let i = gs.equipBtns.length - 1; i >= 0; i--) {
      const btn = gs.equipBtns[i]
      if (!(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h)) continue
      const a = btn.action
      if (a.startsWith("tab:")) {
        gs.equipTab = a.slice(4) as EquipTab
        return
      }
      const eq = gs.save.equipment
      if (a.startsWith("laser:buy:")) {
        const id = a.slice("laser:buy:".length)
        const def = laserDef(id)
        if (gs.save.coins >= def.price) {
          gs.confirm = { title: "COMPRAR LÁSER", msg: `¿Comprar ${def.name} por 🪙 ${def.price}?`, action: a }
        } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("laser:equip:")) {
        const id = a.slice("laser:equip:".length)
        if (equipSlot(gs, "laser", id)) {
          writeStarSave(gs.save)
          gs.flashMsg = `${laserDef(id).name} equipado`
          gs.flashT = 1.2; SFX.pickup()
        } else { gs.flashMsg = "Sin slots libres"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("laser:unequip:")) {
        const id = a.slice("laser:unequip:".length)
        if (unequipSlot(gs, "laser", id)) {
          writeStarSave(gs.save)
          gs.flashMsg = `${laserDef(id).name} desequipado`
          gs.flashT = 1.2; SFX.pickup()
        }
        return
      }
      if (a.startsWith("laser:fuse:")) {
        const id = a.slice("laser:fuse:".length)
        const def = laserDef(id)
        const matching = eq.lasers.filter(l => l.type === id).length
        const next = LASER_DEFS.find(d => d.tier === def.tier + 1)
        if (matching < FUSION_COUNT) return
        if (next) {
          const chance = Math.round(fusionChance(def.tier) * 100)
          gs.confirm = {
            title: "FUSIONAR LÁSER",
            msg: `¿Fusionar ${FUSION_COUNT}x ${def.name} para obtener 1x ${next.name}?\nProbabilidad: ${chance}%`,
            action: a,
          }
        } else { gs.flashMsg = "¡Ya es el nivel máximo!"; gs.flashT = 1.2; SFX.shieldOff() }
        return
      }
      if (a.startsWith("laser:perf:")) {
        const uid = a.slice("laser:perf:".length)
        const inst = getLaserInstance(eq, uid)
        if (!inst) return
        const pct = inst.perfection
        if (pct >= 100) return
        const cost = perfectBuyCost(pct)
        if (gs.save.coins >= cost) {
          gs.save.coins -= cost
          inst.perfection = Math.min(100, pct + PERFECT_BUY_STEP)
          writeStarSave(gs.save)
          const np = inst.perfection
          gs.flashMsg = np >= 100 ? "★ ¡LÁSER PERFECTO! ★" : `Perfección +${PERFECT_BUY_STEP}%`
          gs.flashT = 1.6; SFX.pickup()
        } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("shield:buy:")) {
        const id = a.slice("shield:buy:".length)
        const def = shieldDef(id)
        if (gs.save.coins >= def.price) {
          gs.confirm = { title: "COMPRAR ESCUDO", msg: `¿Comprar ${def.name} por 🪙 ${def.price}?`, action: a }
        } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("shield:equip:")) {
        const id = a.slice("shield:equip:".length)
        if (equipSlot(gs, "shield", id)) {
          writeStarSave(gs.save)
          gs.flashMsg = `${shieldDef(id).name} equipado`
          gs.flashT = 1.2; SFX.pickup()
        } else { gs.flashMsg = "Sin slots libres"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("shield:unequip:")) {
        const id = a.slice("shield:unequip:".length)
        if (unequipSlot(gs, "shield", id)) {
          writeStarSave(gs.save)
          gs.flashMsg = `${shieldDef(id).name} desequipado`
          gs.flashT = 1.2; SFX.pickup()
        }
        return
      }
      if (a.startsWith("shield:fuse:")) {
        const id = a.slice("shield:fuse:".length)
        const def = shieldDef(id)
        const qty = eq.shields[id] ?? 0
        const next = SHIELD_DEFS.find(d => d.tier === def.tier + 1)
        if (qty < FUSION_COUNT) return
        if (next) {
          const chance = Math.round(fusionChance(def.tier) * 100)
          gs.confirm = {
            title: "FUSIONAR ESCUDO",
            msg: `¿Fusionar ${FUSION_COUNT}x ${def.name} para obtener 1x ${next.name}?\nProbabilidad: ${chance}%`,
            action: a,
          }
        } else { gs.flashMsg = "¡Ya es el nivel máximo!"; gs.flashT = 1.2; SFX.shieldOff() }
        return
      }
      if (a === "bot:buy") {
        if (gs.save.coins >= REPAIR_BOT_PRICE) {
          gs.confirm = { title: "COMPRAR ROBOT", msg: `¿Comprar 1 Robot de reparación por 🪙 ${REPAIR_BOT_PRICE}?`, action: a }
        } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("ammo:buy:")) {
        const ammo = a.slice("ammo:buy:".length) as "laser" | "spread" | "missile"
        const buy = AMMO_BUY[ammo]
        if (!buy) return
        if (gs.save.coins >= buy.price) {
          gs.confirm = { title: "COMPRAR MUNICIÓN", msg: `¿Comprar ${buy.amount}x ${AMMO_NAMES[ammo]} por 🪙 ${buy.price}?`, action: a }
        } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("uav:buy:")) {
        const id = a.slice("uav:buy:".length)
        const def = uavDef(id)
        if (gs.save.coins >= def.price) {
          gs.confirm = { title: "COMPRAR UAV", msg: `¿Comprar ${def.name} por 🪙 ${def.price}?`, action: a }
        } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
        return
      }
      if (a.startsWith("uav:equip:")) {
        const id = a.slice("uav:equip:".length)
        const def = uavDef(id)
        eq.uavsEquipped = eq.uavsEquipped ?? []
        if (!eq.uavsEquipped.includes(id)) {
          gs.confirm = { title: "EQUIPAR UAV", msg: `¿Equipar ${def.name} (+${def.slotsBonus} slots)?`, action: a }
        }
        return
      }
      if (a.startsWith("uav:unequip:")) {
        const id = a.slice("uav:unequip:".length)
        gs.confirm = { title: "QUITAR UAV", msg: `¿Quitar ${uavDef(id).name} de la nave?`, action: a }
        return
      }
      // Tarjetas (solo para UI, sin acción propia)
      return
    }
    return
  }

  if (gs.phase === "hangar") {
    if (y > H - 42) { gs.phase = "intro"; gs.phaseTimer = 0; return }

    // Pestañas del hangar (inventory / upgrades)
    for (const btn of gs.hangarBtns) {
      if (!(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h)) continue
      if (btn.key === "inventory") { gs.hangarTab = "inventory"; return }
      if (btn.key === "upgrades") { gs.hangarTab = "upgrades"; return }
    }

    if (gs.hangarTab === "inventory") {
      // Inventario: equipar / quitar / mejorar con confirmación
      for (let i = gs.equipBtns.length - 1; i >= 0; i--) {
        const btn = gs.equipBtns[i]
        if (!(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h)) continue
        const a = btn.action
        if (a.startsWith("laser:equip:")) {
          const uid = a.slice("laser:equip:".length)
          const inst = getLaserInstance(gs.save.equipment, uid)
          const def = inst ? laserDef(inst.type) : laserDef("laser_std")
          const ship = getShip(gs.save)
          const lo = getLoadout(gs.save.equipment, ship.id)
          if (lo.lasers.includes(null)) {
            gs.confirm = { title: "EQUIPAR LÁSER", msg: `¿Equipar ${def.name} en tu nave?`, action: a }
          } else { gs.flashMsg = "Sin slots libres"; gs.flashT = 1; SFX.shieldOff() }
          return
        }
        if (a.startsWith("laser:unequip:")) {
          const id = a.slice("laser:unequip:".length)
          const inst = getLaserInstance(gs.save.equipment, id)
          const nm = inst ? laserDef(inst.type).name : "Láser"
          gs.confirm = { title: "QUITAR LÁSER", msg: `¿Quitar ${nm} de tu nave?`, action: a }
          return
        }
        if (a.startsWith("laser:perf:")) {
          const uid = a.slice("laser:perf:".length)
          const inst = getLaserInstance(gs.save.equipment, uid)
          if (!inst) return
          const pct = inst.perfection
          if (pct >= 100) return
          const cost = perfectBuyCost(pct)
          gs.confirm = {
            title: "MEJORAR LÁSER",
            msg: `¿Mejorar ${laserDef(inst.type).name}?\nCosto: 🪙 ${cost} · +${PERFECT_BUY_STEP}%`,
            action: a,
          }
          return
        }
        if (a.startsWith("shield:equip:")) {
          const id = a.slice("shield:equip:".length)
          const def = shieldDef(id)
          const ship = getShip(gs.save)
          const lo = getLoadout(gs.save.equipment, ship.id)
          if (lo.shields.includes(null)) {
            gs.confirm = { title: "EQUIPAR ESCUDO", msg: `¿Equipar ${def.name} en tu nave?`, action: a }
          } else { gs.flashMsg = "Sin slots libres"; gs.flashT = 1; SFX.shieldOff() }
          return
        }
        if (a.startsWith("shield:unequip:")) {
          const id = a.slice("shield:unequip:".length)
          gs.confirm = { title: "QUITAR ESCUDO", msg: `¿Quitar ${shieldDef(id).name} de tu nave?`, action: a }
          return
        }
        return
      }
      return
    }

    // Mejoras permanentes
    for (const btn of gs.hangarBtns) {
      if (!(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h)) continue
      const def = UPGRADE_DEFS.find(d => d.key === btn.key)
      if (!def) continue
      const lvl = gs.save.upgrades[def.key]
      if (lvl >= def.max) { gs.flashMsg = "Ya está al máximo"; gs.flashT = 1; return }
      const cost = def.cost(lvl)
      if (gs.save.coins >= cost) {
        gs.confirm = {
          title: "COMPRAR MEJORA",
          msg: `¿Comprar ${def.name} (nivel ${lvl + 1}) por 🪙 ${cost}?`,
          action: `upgrade:${def.key}`,
        }
      } else {
        gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1
        SFX.shieldOff()
      }
      return
    }
    return
  }

  if (gs.phase === "world-select") {
    // Check back area
    if (y > H - 40) { gs.phase = "intro"; gs.phaseTimer = 0; return }
    for (const btn of gs.worldBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const unlocked = btn.worldId === 0 || btn.worldId <= gs.save.worldsCleared
        if (unlocked) {
          gs.worldId = btn.worldId
          gs.score = 0
          gs.runCoins = 0
          loadBankedAmmo(gs)
          transitionTo(gs, "playing")
        }
        return
      }
    }
    return
  }

  if (gs.phase === "playing" || gs.phase === "boss") {
    // Botón de robot de reparación
    if (gs.repairBtn) {
      const rb = gs.repairBtn
      if (x >= rb.x - 6 && x <= rb.x + rb.w + 6 && y >= rb.y - 6 && y <= rb.y + rb.h + 6) {
        repairShip(gs)
        return
      }
    }
    // Botón de escudo (área de toque ampliada para dedos)
    if (gs.shieldBtn) {
      const sb = gs.shieldBtn
      if (x >= sb.x - 6 && x <= sb.x + sb.w + 6 && y >= sb.y - 14 && y <= sb.y + sb.h + 10) {
        activateShield(gs)
        return
      }
    }
    // Botones de munición (área de toque ampliada para dedos)
    for (const btn of gs.ammoBtns) {
      if (x >= btn.x - 4 && x <= btn.x + btn.w + 4 && y >= btn.y - 14 && y <= btn.y + btn.h + 10) {
        const count = gs.ammo[btn.ammo]
        if (count === -1 || count > 0) {
          gs.activeAmmo = btn.ammo
          gs.fireTimer = 0
          gs.flashMsg = AMMO_NAMES[btn.ammo] + " activado"
          gs.flashT = 1
        }
        return
      }
    }
    return
  }

  if (gs.phase === "world-clear") {
    if (gs.phaseTimer > 2) {
      if (gs.worldId >= WORLDS.length - 1) {
        transitionTo(gs, "victory")
      } else {
        gs.worldId++
        gs.score = 0
        loadBankedAmmo(gs)
        transitionTo(gs, "playing")
      }
    }
    return
  }

  if (gs.phase === "gameover") {
    if (gs.phaseTimer > 1.5) {
      // Check retry button
      if (y > H / 2 + 76 && y < H / 2 + 124) {
        if (gs.isEndless) {
          startEndless(gs)
        } else {
          gs.score = 0
          gs.runCoins = 0
          loadBankedAmmo(gs)
          transitionTo(gs, "playing")
        }
        return
      }
      // Check menu button
      if (y > H / 2 + 136 && y < H / 2 + 184) {
        gs.phase = "intro"; gs.phaseTimer = 0; return
      }
    }
    return
  }

  if (gs.phase === "victory") {
    if (gs.phaseTimer > 2) {
      gs.phase = "intro"; gs.phaseTimer = 0
    }
    return
  }
}