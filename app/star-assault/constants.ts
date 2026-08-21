import cfg from "./config.json"
import type { AmmoType, PowerupKind } from "./types"

interface CfgLaser { id: string; name: string; tier: number; price: number; dmgMult: number; color: string; desc: string }
interface CfgShield { id: string; name: string; tier: number; price: number; hpMult: number; durMult: number; color: string; desc: string }
interface CfgShip {
  id: string; name: string; desc: string; price: number
  speedMult: number; hpMult: number; fireMult: number
  laserSlots: number; shieldSlots: number; shape: string
  hull: string; hull2: string; hull3: string; wing: string; accent: string; engine: string
  passive?: { magnet?: boolean }
}
interface CfgUav {
  id: string; name: string; price: number; desc: string
  kind: "laser" | "shield"; slotsBonus: number; color: string
}
type GameConfig = {
  lasers: CfgLaser[]; shields: CfgShield[]; ships: CfgShip[]
  uavs: CfgUav[]
  ammoBuy: Record<"laser" | "spread" | "missile", { price: number; amount: number }>
  repairRobot: { price: number; healPct: number }
  balance: {
    playerSpeed: number; playerVertMult: number
    enemyBaseVy: Record<string, number>; enemyWorldScale: number; enemyWorldScaleCap: number
    fusion: { count: number; baseChance: number; chanceGainPerTier: number }
    perfection: { buyStep: number; buyCostBase: number; buyCostPer: number; stepBonus: number; perfectBonus: number; coreGain: number; coreChance: number }
    shieldBase: { maxHp: number; duration: number; cooldown: number; hurtbox: number }
  }
}

export const CONFIG = cfg as GameConfig

export const W = 480
export const H = 854
export const HUD_H = 100
export const PLAYER_W = 44
export const PLAYER_H = 52
export const PLAYER_Y = H - 130                       // posición base (centro de la franja de juego)
export const PLAYER_SPEED = CONFIG.balance.playerSpeed // px/s horizontal (config: 300)
export const PLAYER_VERT_MULT = CONFIG.balance.playerVertMult
export const PLAYER_MIN_Y = H * 0.38                  // límite hacia adelante (arriba) para esquivar
export const PLAYER_MAX_Y = H - HUD_H - PLAYER_H / 2 - 8  // límite hacia atrás (abajo, encima del HUD)

export const SHIELD_DURATION = CONFIG.balance.shieldBase.duration   // segundos base que dura el escudo activo
export const SHIELD_MAX_HP   = CONFIG.balance.shieldBase.maxHp       // daño que puede absorber
export const SHIELD_COOLDOWN = CONFIG.balance.shieldBase.cooldown    // segundos base de recarga
export const SHIELD_HURTBOX  = CONFIG.balance.shieldBase.hurtbox     // radio de colisión con escudo activo

export const COMBO_TIMEOUT = 2.5  // segundos para mantener la racha
export const COMBO_MAX     = 8    // multiplicador máximo

export const FIRE_RATES: Record<AmmoType, number> = {
  basic: 200, laser: 460, spread: 340, missile: 640,  // básico buff: 220→200
}
export const AMMO_COLORS: Record<AmmoType, string> = {
  basic: "#00e5ff", laser: "#ffee00", spread: "#ff8800", missile: "#ff3322",
}
export const AMMO_NAMES: Record<AmmoType, string> = {
  basic: "BÁSICO", laser: "LÁSER", spread: "RÁFAGA", missile: "MISIL",
}
export const AMMO_ICONS: Record<AmmoType, string> = {
  basic: "●", laser: "━", spread: "≋", missile: "▲",
}

export const POWERUP_COLORS: Record<PowerupKind, string> = {
  magnet: "#00ff88", overdrive: "#ff44ff", bomb: "#ffdd00",
}
export const POWERUP_ICONS: Record<PowerupKind, string> = {
  magnet: "🧲", overdrive: "⚡", bomb: "💣",
}
export const OVERDRIVE_DURATION = 6   // segundos
export const MAGNET_DURATION    = 5   // segundos
export const OVERDRIVE_MULT     = 0.6 // cadencia ×0.6

export const CORE_PERF_GAIN = CONFIG.balance.perfection.coreGain
export const CORE_DROP_CHANCE = CONFIG.balance.perfection.coreChance

export const FUSION_COUNT = CONFIG.balance.fusion.count
export const FUSION_BASE_CHANCE = CONFIG.balance.fusion.baseChance
export const FUSION_CHANCE_GAIN = CONFIG.balance.fusion.chanceGainPerTier
export function fusionChance(tier: number): number {
  return Math.min(0.95, FUSION_BASE_CHANCE + (tier - 1) * FUSION_CHANCE_GAIN)
}

export const PERFECT_BUY_STEP = CONFIG.balance.perfection.buyStep
export function perfectBuyCost(pct: number): number { return Math.round(CONFIG.balance.perfection.buyCostBase + pct * CONFIG.balance.perfection.buyCostPer) }
export const PERFECT_POINT_COST = 5  // puntos de mejora por paso (10%) al mejorar un láser
export const PERFECT_BONUS = CONFIG.balance.perfection.perfectBonus
export const PERFECT_BONUS_PER_STEP = CONFIG.balance.perfection.stepBonus

export const REPAIR_BOT_PRICE = CONFIG.repairRobot.price
export const REPAIR_BOT_HEAL = CONFIG.repairRobot.healPct

export const AMMO_BUY: Record<"laser" | "spread" | "missile", { price: number; amount: number }> = CONFIG.ammoBuy

export const MUTE_BTN = { x: W - 54, y: 6, w: 48, h: 28 }

// Botón de cierre (X) para las ventanas (hangar / tiendas)
export const CLOSE_BTN = { x: W - 44, y: 6, w: 38, h: 34 }
export const CLOSE_BTN_EXT = 10  // área de toque ampliada