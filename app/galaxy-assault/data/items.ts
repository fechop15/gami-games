// Items de inventario + robots de reparación.
import { CONFIG } from "../core/constants"
import type { GalaxySave } from "../core/save"
import type { DropId } from "../core/types"

export interface ItemDef {
  id: string
  name: string
  icon: string
  sprite: string
  desc: string
}

export const ITEMS: ItemDef[] = [
  { id: "scrap", name: "Chatarra", icon: "🔩", sprite: "drop_scrap", desc: "Material básico para fabricar." },
  { id: "energy", name: "Celda de energía", icon: "🔋", sprite: "drop_energy", desc: "Energía para tus sistemas." },
  { id: "core", name: "Núcleo", icon: "⭐", sprite: "drop_core", desc: "Núcleo raro de naves enemigas." },
]

export function itemDef(id: string): ItemDef | undefined {
  return ITEMS.find(i => i.id === id)
}

export function dropCoins(dropId: DropId): number {
  return CONFIG.drops[dropId]?.coins ?? 0
}

export function addInventory(save: GalaxySave, id: string, qty = 1): void {
  save.inventory[id] = (save.inventory[id] ?? 0) + qty
}

/** Aplica un drop de enemigo/jefe al save y devuelve las monedas ganadas. */
export function applyDrop(save: GalaxySave, dropId: DropId): number {
  if (dropId === "repairBot") {
    save.repairBots += 1
    return 0
  }
  addInventory(save, dropId, 1)
  return dropCoins(dropId)
}

export function useRepairBot(gsSave: GalaxySave): boolean {
  if (gsSave.repairBots <= 0) return false
  gsSave.repairBots -= 1
  return true
}

export function repairPct(): number {
  return CONFIG.repairBot.healPct
}