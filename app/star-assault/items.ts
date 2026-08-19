import { CONFIG, SHIELD_MAX_HP, SHIELD_DURATION, SHIELD_COOLDOWN, PERFECT_BONUS, PERFECT_BONUS_PER_STEP } from "./constants"
import { DEFAULT_LASER_ID, DEFAULT_SHIELD_ID } from "./save"
import type { EquipmentState, ShipLoadout, ShipUpgrades, StarSave } from "./save"
import type { GS } from "./types"
import { SHIP_DEFS, getShip } from "./ships"

export interface LaserDef {
  id: string; name: string; tier: number; price: number
  dmgMult: number        // multiplicador de daño base
  desc: string
  color: string
}
export interface ShieldDef {
  id: string; name: string; tier: number; price: number
  hpMult: number; durMult: number
  desc: string
  color: string
}
export const LASER_DEFS: LaserDef[] = CONFIG.lasers.map(l => ({ ...l }))
export const SHIELD_DEFS: ShieldDef[] = CONFIG.shields.map(s => ({ ...s }))

export function laserDef(id: string): LaserDef { return LASER_DEFS.find(l => l.id === id) ?? LASER_DEFS[0] }
export function shieldDef(id: string): ShieldDef { return SHIELD_DEFS.find(s => s.id === id) ?? SHIELD_DEFS[0] }

// Perfección del láser: 0-100. Al 100% el láser es "perfecto" (bonus extra).
export function laserPerfectPct(eq: EquipmentState, laserId: string): number {
  return Math.min(100, eq.laserPerfection[laserId] ?? 0)
}
// Multiplicador de daño de UN láser (tier + perfección)
export function singleLaserMult(eq: EquipmentState, laserId: string): number {
  const def = laserDef(laserId)
  const pct = laserPerfectPct(eq, laserId)
  let mult = def.dmgMult * (1 + pct * PERFECT_BONUS_PER_STEP)
  if (pct >= 100) mult *= (1 + PERFECT_BONUS)
  return mult
}

// Loadout de una nave: garantiza que los slots tengan la longitud correcta
export function getLoadout(eq: EquipmentState, shipId: string): ShipLoadout {
  const ship = getShip({ shipId } as StarSave)
  const lo = eq.loadouts[shipId] ?? { lasers: [], shields: [] }
  while (lo.lasers.length < ship.laserSlots) lo.lasers.push(null)
  while (lo.shields.length < ship.shieldSlots) lo.shields.push(null)
  eq.loadouts[shipId] = lo
  return lo
}
// Rellena todos los loadouts con el item estándar donde haya huecos libres
export function ensureLoadouts(eq: EquipmentState) {
  for (const ship of SHIP_DEFS) {
    const lo = getLoadout(eq, ship.id)
    for (let i = 0; i < lo.lasers.length; i++) if (!lo.lasers[i]) lo.lasers[i] = DEFAULT_LASER_ID
    for (let i = 0; i < lo.shields.length; i++) if (!lo.shields[i]) lo.shields[i] = DEFAULT_SHIELD_ID
  }
}
// Láseres equipados en la nave actual (ids no-null)
export function equippedLaserIds(gs: GS): string[] {
  const ship = getShip(gs.save)
  const lo = getLoadout(gs.save.equipment, ship.id)
  return lo.lasers.filter((x): x is string => !!x)
}
export function equippedShieldIds(gs: GS): string[] {
  const ship = getShip(gs.save)
  const lo = getLoadout(gs.save.equipment, ship.id)
  return lo.shields.filter((x): x is string => !!x)
}
// Daño total: proporcional a la cantidad de láseres equipados (suma de sus mult)
export function totalLaserMult(gs: GS): number {
  const ids = equippedLaserIds(gs)
  return ids.reduce((acc, id) => acc + singleLaserMult(gs.save.equipment, id), 0)
}
// Escudo: proporcional a la cantidad de escudos equipados
export function totalShieldHpMult(gs: GS): number {
  const ids = equippedShieldIds(gs)
  return 1 + ids.reduce((acc, id) => acc + (shieldDef(id).hpMult - 1), 0)
}
export function totalShieldDurMult(gs: GS): number {
  const ids = equippedShieldIds(gs)
  return 1 + ids.reduce((acc, id) => acc + (shieldDef(id).durMult - 1), 0)
}
// Stats del escudo aplicadas sobre las mejoras permanentes del Hangar
export function effShieldMaxHP(gs: GS): number {
  return Math.round(SHIELD_MAX_HP * totalShieldHpMult(gs))
}
export function effShieldDur(gs: GS): number {
  return upShieldDur(gs.save.upgrades) * totalShieldDurMult(gs)
}

// Mejoras de escudo del Hangar (viven aquí para que effShield* no dependa de engine)
export function upShieldDur(u: ShipUpgrades): number { return SHIELD_DURATION + u.shieldDur }
export function upShieldCd(u: ShipUpgrades): number { return Math.max(3, SHIELD_COOLDOWN - u.shieldCd) }

// Total de láseres en el inventario (todos los tipos)
export function inventoryLaserTotal(eq: EquipmentState): number {
  return Object.values(eq.lasers).reduce((a, b) => a + b, 0)
}
// Gasta un láser del inventario (del primer tipo con stock). Devuelve true si pudo.
export function spendLaserFromInventory(eq: EquipmentState): boolean {
  for (const id of Object.keys(eq.lasers)) {
    if ((eq.lasers[id] ?? 0) > 0) { eq.lasers[id] = (eq.lasers[id] ?? 0) - 1; return true }
  }
  return false
}
export function addLaserToInventory(eq: EquipmentState, id: string, n = 1) {
  eq.lasers[id] = (eq.lasers[id] ?? 0) + n
}