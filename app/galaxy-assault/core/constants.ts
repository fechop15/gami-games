import cfg from "../config.json"

export interface CfgWeapon {
  id: string
  kind: "laser" | "missile"
  name: string
  dmgMult: number
  fireRateMs: number
  maxAmmo: number
  bulletSpeed: number
  bulletRadius: number
  color: string
  sprite: string
  crateAmount: number
  crateChance: number
  homing?: boolean
  turn?: number
  aoe?: number
}

export interface CfgShip {
  id: string
  name: string
  desc: string
  baseDamage: number
  speedMult: number
  hpMult: number
  sprite: string
  price: number
  unlocked: boolean
}

export interface CfgNpc {
  name: string
  hp: number
  speed: number
  aggroRange: number
  contactDamage: number
  fireRateMs: number
  bulletDamage: number
  bulletSpeed: number
  points: number
  dropChance: number
  spawnInterval: number
  maxCount: number
  minDistFromBase: number
  minDistFromPlayer: number
  sprite: string
  size: number
}

export interface CfgBoss {
  id: string
  name: string
  hp: number
  speed: number
  aggroRange: number
  contactDamage: number
  fireRateMs: number
  bulletDamage: number
  bulletSpeed: number
  points: number
  spawnInterval: number
  maxCount: number
  mechanic: string
  phase2At: number
  sprite: string
  size: number
  dropChance: number
}

export interface CfgDrop {
  chance: number
  coins?: number
}

interface GameConfig {
  map: {
    id: string
    name: string
    size: number
    cell: number
    base: { x: number; y: number }
    safeRadius: number
    border: { enabled: boolean; belt: number; radiusMin: number; radiusMax: number; spacing: number; jitter: number }
  }
  minimap: { size: number; offsetX: number; offsetY: number; showEnemiesCap: number; showCrates: boolean; showBosses: boolean }
  player: {
    speed: number
    accel: number
    maxHp: number
    baseDamage: number
    shieldAbsorb: number
    shieldHp: number
    shieldCooldown: number
    evasionCap: number
    fireRange: number
    invulnAfterHit: number
  }
  ships: CfgShip[]
  weapons: CfgWeapon[]
  npcs: Record<string, CfgNpc>
  bosses: CfgBoss[]
  crates: { spawnInterval: number; maxOnField: number; life: number; minDistFromBase: number }
  drops: Record<string, CfgDrop>
  repairBot: { healPct: number }
  balance: { coinsPerKill: number; coinsPerBossKill: number; bossKillsToUnlockNext: number }
}

export const CONFIG = cfg as GameConfig

// ── Layout (landscape) ──
export const W = 1280
export const H = 720

// ── Mundo derivado del config ──
export const MAP_SIZE = CONFIG.map.size * CONFIG.map.cell
export const CELL = CONFIG.map.cell
export const BELT = CONFIG.map.border.enabled ? CONFIG.map.border.belt : 0
export const PLAYABLE_MIN = BELT
export const PLAYABLE_MAX = MAP_SIZE - BELT

export const BASE_X = CONFIG.map.base.x * CELL + CELL / 2
export const BASE_Y = CONFIG.map.base.y * CELL + CELL / 2
export const SAFE_RADIUS = CONFIG.map.safeRadius

// ── Jugador ──
export const PLAYER_SPEED = CONFIG.player.speed
export const PLAYER_ACCEL = CONFIG.player.accel
export const PLAYER_RADIUS = 22
export const PLAYER_MAX_HP = CONFIG.player.maxHp
export const PLAYER_BASE_DMG = CONFIG.player.baseDamage
export const SHIELD_ABSORB = CONFIG.player.shieldAbsorb
export const SHIELD_MAX_HP = CONFIG.player.shieldHp
export const SHIELD_COOLDOWN = CONFIG.player.shieldCooldown
export const EVASION_CAP = CONFIG.player.evasionCap
export const FIRE_RANGE = CONFIG.player.fireRange
export const INVULN_AFTER_HIT = CONFIG.player.invulnAfterHit

// ── Joystick ──
export const JOY_RADIUS = 70
export const JOY_DEADZONE = 12

// ── Zonas táctiles del HUD ──
export const MUTE_BTN: BtnRect = { x: W - 54, y: 8, w: 44, h: 44 }
export const MINIMAP_BTN: BtnRect = { x: W - 54, y: 60, w: 44, h: 44 }
export const WEAPON_BTN: BtnRect = { x: W - 200, y: H - 70, w: 190, h: 56 }
export const REPAIR_BTN: BtnRect = { x: 16, y: H - 70, w: 170, h: 56 }

export interface BtnRect { x: number; y: number; w: number; h: number }

export function inRect(r: BtnRect | BtnAreaLike, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

export interface BtnAreaLike { x: number; y: number; w: number; h: number }

// ── Ángulo de pantalla para el fondo ──
export const BG_IMG = "/games/galaxy-assault/bg.svg"