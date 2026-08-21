// Municiones: x1/x2/x3 (láser) + misiles A/B. Daño = daño base nave × dmgMult.
import { CONFIG, PLAYER_BASE_DMG, AMMO_SHOP } from "../core/constants"
import type { CfgWeapon } from "../core/constants"
import type { AmmoType, GS } from "../core/types"

export const WEAPONS: CfgWeapon[] = CONFIG.weapons

export const AMMO_ORDER: AmmoType[] = ["x1", "x2", "x3", "missile_a", "missile_b"]

export function weaponDef(id: AmmoType): CfgWeapon {
  return WEAPONS.find(w => w.id === id) ?? WEAPONS[0]
}

export function weaponDamage(baseDamage: number, id: AmmoType): number {
  return Math.round(baseDamage * weaponDef(id).dmgMult)
}

export function weaponDamageForShip(baseDamage: number, id: AmmoType): number {
  return weaponDamage(baseDamage, id)
}

export function bulletDamageFor(id: AmmoType): number {
  return weaponDamage(PLAYER_BASE_DMG, id)
}

export function defaultAmmo(): Record<AmmoType, number> {
  const out = {} as Record<AmmoType, number>
  for (const w of WEAPONS) out[w.id as AmmoType] = w.maxAmmo
  return out
}

/** Sprite key (de sprites.ts) para un proyectil dado. */
export function bulletSprite(id: AmmoType): string {
  return weaponDef(id).sprite
}

/** Compra munición en la tienda de la base. Devuelve true si se concretó. */
export function buyAmmo(gs: GS, id: AmmoType): boolean {
  const shop = AMMO_SHOP[id]
  const w = weaponDef(id)
  if (!shop) return false
  if (gs.save.coins < shop.price) return false
  gs.save.coins -= shop.price
  gs.ammo[id] = Math.min(w.maxAmmo, gs.ammo[id] + shop.amount)
  return true
}