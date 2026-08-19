import type { GS, EquipTab } from "./types"
import {
  H, MUTE_BTN, AMMO_NAMES, PERFECT_BUY_STEP, perfectBuyCost,
  FUSION_COUNT, fusionChance, REPAIR_BOT_PRICE,
} from "./constants"
import {
  LASER_DEFS, SHIELD_DEFS, laserDef, shieldDef, getLaserInstance,
  getLoadout, inventoryLaserTotal, addLaserToInventory,
} from "./items"
import { SHIP_DEFS, getShip } from "./ships"
import { WORLDS } from "./worlds"
import { transitionTo, startEndless, loadBankedAmmo, repairShip, activateShield } from "./engine"
import { UPGRADE_DEFS } from "./ui"
import { SFX, setSoundMuted, getSoundMuted } from "./audio"
import { writeStarSave } from "./save"

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

export function handleTap(gs: GS, cx: number, cy: number, canvasRect: DOMRect, scaleX: number, scaleY: number) {
  const x = (cx - canvasRect.left) * scaleX
  const y = (cy - canvasRect.top) * scaleY

  // Botón de silencio — prioridad máxima, siempre activo
  const mb = MUTE_BTN
  if (x >= mb.x - 6 && x <= mb.x + mb.w + 6 && y >= mb.y - 6 && y <= mb.y + mb.h + 6) {
    setSoundMuted(!getSoundMuted())
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
            gs.save.shipId = ship.id
            writeStarSave(gs.save)
            gs.flashMsg = `${ship.name} equipada`
            gs.flashT = 1.2
            SFX.pickup()
          }
        } else {
          if (gs.save.coins >= ship.price) {
            gs.save.coins -= ship.price
            gs.save.shipsOwned.push(ship.id)
            gs.save.shipId = ship.id
            writeStarSave(gs.save)
            gs.flashMsg = `¡${ship.name} comprada!`
            gs.flashT = 1.5
            SFX.worldClear()
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
          gs.save.coins -= def.price
          addLaserToInventory(eq, id)
          gs.ammo.laser = inventoryLaserTotal(eq)
          writeStarSave(gs.save)
          gs.flashMsg = `¡${def.name} comprado!`
          gs.flashT = 1.5; SFX.worldClear()
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
        fuseItem(gs, "laser", a.slice("laser:fuse:".length))
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
          gs.save.coins -= def.price
          eq.shields[id] = (eq.shields[id] ?? 0) + 1
          writeStarSave(gs.save)
          gs.flashMsg = `¡${def.name} comprado!`
          gs.flashT = 1.5; SFX.worldClear()
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
        fuseItem(gs, "shield", a.slice("shield:fuse:".length))
        return
      }
      if (a === "bot:buy") {
        if (gs.save.coins >= REPAIR_BOT_PRICE) {
          gs.save.coins -= REPAIR_BOT_PRICE
          eq.repairBots += 1
          writeStarSave(gs.save)
          gs.flashMsg = "+1 Robot de reparación"
          gs.flashT = 1.5; SFX.pickup()
        } else { gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1; SFX.shieldOff() }
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
      // Inventario: equipar / quitar items de los slots
      for (let i = gs.equipBtns.length - 1; i >= 0; i--) {
        const btn = gs.equipBtns[i]
        if (!(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h)) continue
        const a = btn.action
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
        gs.save.coins -= cost
        gs.save.upgrades[def.key] = lvl + 1
        writeStarSave(gs.save)
        SFX.pickup()
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