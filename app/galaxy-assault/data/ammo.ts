// Municiones: x1/x2/x3 (láser) + misiles A/B. Daño = daño base nave × dmgMult.
import { CONFIG, PLAYER_BASE_DMG } from "../core/constants"
import type { CfgWeapon } from "../core/constants"
import type { AmmoType } from "../core/types"

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