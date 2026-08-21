import type { GalaxySave } from "./save"

export type Phase = "loading" | "intro" | "playing" | "dead" | "base-menu"

export type AmmoType = "x1" | "x2" | "x3" | "missile_a" | "missile_b"
export type WeaponKind = "laser" | "missile"
export type DropId = "scrap" | "energy" | "core" | "repairBot"
export type EnemyKind = "npc" | "boss"

export interface BtnArea { x: number; y: number; w: number; h: number }

export interface PlayerState {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  speed: number
  hp: number
  maxHp: number
  shieldHp: number
  shieldMaxHp: number
  shieldCooldown: number
  shieldCdMax: number
  invulnT: number
  fireTimer: number
}

export interface Enemy {
  id: number
  kind: EnemyKind
  type: string
  x: number
  y: number
  angle: number
  hp: number
  maxHp: number
  size: number
  speed: number
  aggro: boolean
  aggroRange: number
  contactDamage: number
  fireTimer: number
  fireRate: number
  bulletDamage: number
  bulletSpeed: number
  points: number
  dropChance: number
  hitFlash: number
  wanderT: number
  wanderAngle: number
  phase: number
  phase2At: number
  attackTimer: number
  attackIdx: number
  mechanic: string
  laserT: number
  laserActive: boolean
  laserAngle: number
  spawnTimer: number
  alive: boolean
  respawnT: number
  color: string
  accent: string
}

export interface Bullet {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  fromPlayer: boolean
  color: string
  kind: WeaponKind
  weapon?: AmmoType
  aoe?: number
  homing?: boolean
  turn?: number
  targetId?: number
  life: number
}

export interface Crate {
  id: number
  x: number
  y: number
  type: AmmoType
  life: number
  maxLife: number
  bobT: number
}

export interface Drop {
  id: number
  x: number
  y: number
  dropId: DropId
  vx: number
  vy: number
  life: number
  bobT: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  r: number
}

export interface Floater {
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  text: string
  color: string
  size: number
}

export interface Shockwave {
  x: number
  y: number
  r: number
  maxR: number
  life: number
  maxLife: number
  color: string
}

export interface Asteroid {
  x: number
  y: number
  radius: number
  angle: number
  spin: number
  variant: number
}

export interface Star {
  x: number
  y: number
  r: number
  bright: number
  tw: number
}

export interface GS {
  phase: Phase
  loadPct: number
  save: GalaxySave
  time: number
  lastTime: number
  camX: number
  camY: number
  player: PlayerState
  joystick: {
    active: boolean
    baseX: number
    baseY: number
    dx: number
    dy: number
  }
  targetId: number | null
  firing: boolean
  activeWeapon: AmmoType
  ammo: Record<AmmoType, number>
  enemies: Enemy[]
  bullets: Bullet[]
  crates: Crate[]
  drops: Drop[]
  asteroids: Asteroid[]
  stars: Star[]
  particles: Particle[]
  floaters: Floater[]
  shockwaves: Shockwave[]
  nextId: number
  spawnTimers: Record<string, number>
  crateTimer: number
  inSafeZone: boolean
  baseMenuOpen: boolean
  minimapHidden: boolean
  btns: BtnArea[]
  flashMsg: string
  flashT: number
  shake: number
  kills: number
  isTouching: boolean
  respawnT: number
  lastHitT: number
  shieldFlashT: number
}