// Naves: stats base desde config. El daño se multiplica por la munición activa.
import { CONFIG, PLAYER_MAX_HP, PLAYER_BASE_DMG } from "../core/constants"
import type { CfgShip } from "../core/constants"
import type { GalaxySave } from "../core/save"
import { DEFAULT_SHIP_ID } from "../core/save"

export const SHIP_DEFS: CfgShip[] = CONFIG.ships

export function getShip(save: GalaxySave): CfgShip {
  return SHIP_DEFS.find(s => s.id === save.shipId) ?? SHIP_DEFS[0] ?? defaultShip()
}

function defaultShip(): CfgShip {
  return { id: DEFAULT_SHIP_ID, name: "Estrella", desc: "", baseDamage: PLAYER_BASE_DMG, speedMult: 1, hpMult: 1, sprite: "player", price: 0, unlocked: true }
}

export function shipSpeedMult(save: GalaxySave): number {
  return getShip(save).speedMult
}

export function shipMaxHp(save: GalaxySave): number {
  return Math.round(PLAYER_MAX_HP * getShip(save).hpMult)
}

export function shipBaseDamage(save: GalaxySave): number {
  return getShip(save).baseDamage
}

export function shipSprite(save: GalaxySave): string {
  return getShip(save).sprite
}