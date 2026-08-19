import { CONFIG, SHIELD_MAX_HP, SHIELD_DURATION, SHIELD_COOLDOWN, PERFECT_BONUS, PERFECT_BONUS_PER_STEP } from "./constants"
import { DEFAULT_LASER_ID, DEFAULT_SHIELD_ID } from "./save"
import type { EquipmentState, ShipLoadout, ShipUpgrades, StarSave, LaserInstance } from "./save"
import type { GS } from "./types"
import { SHIP_DEFS, getShip } from "./ships"

// Contador global para generar uids únicos de instancias de láser
let laserUidCounter = 0
export function nextLaserUid(type: string): string {
  return type + "_" + (++laserUidCounter)
}

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

// Busca una instancia de láser por su uid
export function getLaserInstance(eq: EquipmentState, uid: string): LaserInstance | undefined {
  return eq.lasers.find(l => l.uid === uid)
}
// Perfección individual de una instancia de láser
export function laserPerfectionOf(eq: EquipmentState, uid: string): number {
  return Math.min(100, getLaserInstance(eq, uid)?.perfection ?? 0)
}
// Multiplicador de daño de UNA instancia (type + perfección individual)
export function singleLaserMult(eq: EquipmentState, uid: string): number {
  const inst = getLaserInstance(eq, uid)
  if (!inst) return 0
  const def = laserDef(inst.type)
  const pct = Math.min(100, inst.perfection)
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
// Rellena todos los loadouts con items disponibles donde haya huecos libres
export function ensureLoadouts(eq: EquipmentState) {
  for (const ship of SHIP_DEFS) {
    const lo = getLoadout(eq, ship.id)
    for (let i = 0; i < lo.lasers.length; i++) {
      if (!lo.lasers[i]) {
        // llena con el uid de una instancia disponible (o crea una estándar)
        const available = eq.lasers[0]
        if (available) lo.lasers[i] = available.uid
        else { const inst = addLaserToInventory(eq, DEFAULT_LASER_ID); lo.lasers[i] = inst.uid }
      }
    }
    for (let i = 0; i < lo.shields.length; i++) if (!lo.shields[i]) lo.shields[i] = DEFAULT_SHIELD_ID
  }
}
// Uids de láseres equipados en la nave actual
export function equippedLaserUids(gs: GS): string[] {
  const ship = getShip(gs.save)
  const lo = getLoadout(gs.save.equipment, ship.id)
  return lo.lasers.filter((x): x is string => !!x)
}
export function equippedShieldIds(gs: GS): string[] {
  const ship = getShip(gs.save)
  const lo = getLoadout(gs.save.equipment, ship.id)
  return lo.shields.filter((x): x is string => !!x)
}
// Daño total: proporcional a la cantidad de láseres equipados (suma de sus mult individuales)
export function totalLaserMult(gs: GS): number {
  const uids = equippedLaserUids(gs)
  return uids.reduce((acc, uid) => acc + singleLaserMult(gs.save.equipment, uid), 0)
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

// Total de instancias de láser en el inventario
export function inventoryLaserTotal(eq: EquipmentState): number {
  return eq.lasers.length
}
// Gasta un láser del inventario: elimina una instancia (la primera). Devuelve true si pudo.
export function spendLaserFromInventory(eq: EquipmentState): boolean {
  if (eq.lasers.length === 0) return false
  eq.lasers.splice(0, 1)
  return true
}
// Agrega una instancia de láser al inventario
export function addLaserToInventory(eq: EquipmentState, type: string, perfection = 0): LaserInstance {
  const inst: LaserInstance = { uid: nextLaserUid(type), type, perfection }
  eq.lasers.push(inst)
  return inst
}