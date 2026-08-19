import type { StarSave } from "./save"

export type Phase =
  | "intro"
  | "world-select"
  | "hangar"
  | "ship-store"
  | "equip-store"
  | "playing"
  | "boss-intro"
  | "boss"
  | "world-clear"
  | "gameover"
  | "victory"

export type AmmoType = "basic" | "laser" | "spread" | "missile"
export type EnemyType = "scout" | "grunt" | "tank" | "stealth" | "shooter" | "kamikaze" | "splitter" | "mini"
export type PowerupKind = "magnet" | "overdrive" | "bomb"
export type DropKind = AmmoType | PowerupKind | "core"
export type EquipTab = "lasers" | "shields" | "bots" | "ammo"

export interface Bullet {
  id: number; x: number; y: number; vx: number; vy: number
  damage: number; ammo: AmmoType; fromPlayer: boolean; radius: number
  penetrate?: boolean; lifetime: number
  trackTimer?: number
}

export interface Enemy {
  id: number; type: EnemyType; x: number; y: number; vx: number; vy: number
  hp: number; maxHp: number; w: number; h: number
  fireTimer: number; fireRate: number; oscPhase: number
  stealthTimer: number; visible: boolean
  color: string; accent: string; points: number; dropChance: number
  hitFlash: number
}

export interface Boss {
  x: number; y: number; hp: number; maxHp: number; w: number; h: number
  phase: number
  attackTimer: number; attackIdx: number; moveTimer: number; targetX: number
  color: string; accent: string; alive: boolean; worldId: number
  shieldActive: boolean; shieldHp: number
  teleportTimer: number; teleportCooldown: number
  gravPulseActive: boolean; gravTimer: number
  spawnTimer: number
  hitFlash: number
}

export interface Drop {
  id: number; x: number; y: number; vx: number; vy: number; kind: DropKind; bobT: number
}

export interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; r: number
}

export interface Floater {
  x: number; y: number; vy: number; life: number; maxLife: number
  text: string; color: string; size: number
}

export interface Shockwave {
  x: number; y: number; r: number; maxR: number; life: number; maxLife: number; color: string
}

export interface Star {
  x: number; y: number; spd: number; r: number; bright: number; layer: number
}

export interface BtnArea { x: number; y: number; w: number; h: number }

export interface GS {
  phase: Phase
  playerX: number; playerY: number; playerHP: number; playerMaxHP: number; invTimer: number
  activeAmmo: AmmoType; ammo: Record<AmmoType, number>; fireTimer: number
  worldId: number; wave: number
  waveState: "spawning" | "clearing" | "boss-wait" | "done"
  toSpawn: EnemyType[]; spawnTimer: number; spawnDelay: number
  score: number
  bullets: Bullet[]; enemyBullets: Bullet[]
  enemies: Enemy[]; boss: Boss | null; drops: Drop[]; particles: Particle[]
  floaters: Floater[]; shockwaves: Shockwave[]
  trail: Array<{ x: number; y: number }>
  stars: Star[]
  lastTime: number; phaseTimer: number; nextId: number
  touchX: number | null; touchY: number | null; isTouching: boolean
  ammoBtns: Array<BtnArea & { ammo: AmmoType }>
  worldBtns: Array<BtnArea & { worldId: number }>
  hangarBtns: Array<BtnArea & { key: string }>
  shipBtns: Array<BtnArea & { shipId: string }>
  equipBtns: Array<BtnArea & { action: string }>
  equipTab: EquipTab
  hangarTab: "inventory" | "upgrades"
  repairBtn: BtnArea | null
  introBtns: Array<BtnArea & { action: string }>
  save: StarSave
  flashMsg: string; flashT: number
  worldScroll: number
  worldDragStartY: number | null
  worldDragBase: number
  bossLaserActive: boolean; bossLaserT: number; bossLaserX: number
  shieldActive: boolean; shieldHP: number; shieldMaxHP: number
  shieldDuration: number; shieldCooldown: number; shieldCdMax: number
  shieldBtn: BtnArea | null
  screenShake: number
  combo: number; comboTimer: number
  magnetT: number; overdriveT: number
  runCoins: number; lastRunCoins: number
  isEndless: boolean; endlessWave: number
}