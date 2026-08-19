import { CONFIG } from "./constants"
import type { StarSave } from "./save"

export type ShipShape = "delta" | "interceptor" | "tank" | "jet" | "phantom" | "omega"

export interface ShipDef {
  id: string
  name: string
  desc: string
  price: number
  speedMult: number      // multiplicador de velocidad de movimiento
  hpMult: number         // multiplicador de HP máximo
  fireMult: number       // multiplicador de tiempo de disparo (< 1 = más rápido)
  laserSlots: number     // espacios para equipar láseres (items del inventario)
  shieldSlots: number    // espacios para equipar escudos (items del inventario)
  shape: ShipShape
  hull: string; hull2: string; hull3: string   // gradiente del fuselaje
  wing: string
  accent: string
  engine: string
  passive?: { magnet?: boolean }   // imán permanente
}

export const SHIP_DEFS: ShipDef[] = CONFIG.ships.map(s => ({ ...s, shape: s.shape as ShipShape }))

export function getShip(save: StarSave): ShipDef {
  return SHIP_DEFS.find(s => s.id === save.shipId) ?? SHIP_DEFS[0]
}