"use client"
import { useEffect, useRef } from "react"
import { loadStarSave, writeStarSave, StarSave, ShipUpgrades } from "./save"

/* ════════════════════════════════════════════════════════════════════
   CONSTANTES
   ════════════════════════════════════════════════════════════════════ */
const W = 480
const H = 854
const PLAYER_W = 44
const PLAYER_H = 52
const PLAYER_Y = H - 130
const PLAYER_SPEED = 360   // px/s horizontal
const HUD_H = 100

const SHIELD_DURATION    = 4    // segundos base que dura el escudo activo
const SHIELD_MAX_HP      = 60   // daño que puede absorber (rebalanceado 100→60)
const SHIELD_COOLDOWN    = 8    // segundos base de recarga (rebalanceado 10→8)
const SHIELD_HURTBOX     = 24   // radio de colisión con escudo activo (rebalanceado 40→24)

const COMBO_TIMEOUT      = 2.5  // segundos para mantener la racha
const COMBO_MAX          = 8    // multiplicador máximo

const FIRE_RATES: Record<AmmoType, number> = {
  basic: 200, laser: 460, spread: 340, missile: 640,  // básico buff: 220→200
}
const AMMO_COLORS: Record<AmmoType, string> = {
  basic: "#00e5ff", laser: "#ffee00", spread: "#ff8800", missile: "#ff3322",
}
const AMMO_NAMES: Record<AmmoType, string> = {
  basic: "BÁSICO", laser: "LÁSER", spread: "RÁFAGA", missile: "MISIL",
}
const AMMO_ICONS: Record<AmmoType, string> = {
  basic: "●", laser: "━", spread: "≋", missile: "▲",
}

// Power-ups de campo (no munición)
const POWERUP_COLORS: Record<PowerupKind, string> = {
  magnet: "#00ff88", overdrive: "#ff44ff", bomb: "#ffdd00",
}
const POWERUP_ICONS: Record<PowerupKind, string> = {
  magnet: "🧲", overdrive: "⚡", bomb: "💣",
}
const OVERDRIVE_DURATION = 6   // segundos
const MAGNET_DURATION    = 5   // segundos
const OVERDRIVE_MULT     = 0.6 // cadencia ×0.6

/* ════════════════════════════════════════════════════════════════════
   NAVES — tienda y stats
   ════════════════════════════════════════════════════════════════════ */
type ShipShape = "delta" | "interceptor" | "tank" | "jet" | "phantom" | "omega"

interface ShipDef {
  id: string
  name: string
  desc: string
  price: number
  speedMult: number      // multiplicador de velocidad de movimiento
  hpMult: number         // multiplicador de HP máximo
  fireMult: number       // multiplicador de tiempo de disparo (< 1 = más rápido)
  shape: ShipShape
  hull: string; hull2: string; hull3: string   // gradiente del fuselaje
  wing: string
  accent: string
  engine: string
  passive?: { magnet?: boolean }   // imán permanente
}

const SHIP_DEFS: ShipDef[] = [
  {
    id: "aurora", name: "Aurora", desc: "Nave de combate equilibrada. Incluida por defecto.",
    price: 0, speedMult: 1, hpMult: 1, fireMult: 1, shape: "delta",
    hull: "#00e5ff", hull2: "#0088cc", hull3: "#004488",
    wing: "#0088cc", accent: "#aaeeff", engine: "#00e5ff",
  },
  {
    id: "vibora", name: "Víbora", desc: "Interceptora ultrarrápida, algo más frágil.",
    price: 800, speedMult: 1.25, hpMult: 0.85, fireMult: 1, shape: "interceptor",
    hull: "#44ff88", hull2: "#22aa55", hull3: "#114422",
    wing: "#22aa55", accent: "#ccffdd", engine: "#44ff88",
  },
  {
    id: "juggernaut", name: "Juggernaut", desc: "Blindaje pesado y cañones dobles.",
    price: 1500, speedMult: 0.8, hpMult: 1.5, fireMult: 1, shape: "tank",
    hull: "#ff8844", hull2: "#cc5511", hull3: "#662200",
    wing: "#cc5511", accent: "#ffddbb", engine: "#ffaa44",
  },
  {
    id: "fenix", name: "Fénix", desc: "Cadencia superior, casco ligero.",
    price: 2500, speedMult: 1.1, hpMult: 0.8, fireMult: 0.85, shape: "jet",
    hull: "#ff44aa", hull2: "#cc2277", hull3: "#660033",
    wing: "#cc2277", accent: "#ffccee", engine: "#ff66cc",
  },
  {
    id: "phantom", name: "Phantom", desc: "Sigilosa: imán de drops permanente.",
    price: 3500, speedMult: 1.05, hpMult: 0.9, fireMult: 0.95, shape: "phantom",
    hull: "#aa88ff", hull2: "#6633cc", hull3: "#220055",
    wing: "#6633cc", accent: "#ddccff", engine: "#bb88ff",
    passive: { magnet: true },
  },
  {
    id: "omega", name: "Omega", desc: "La leyenda: todo lo anterior, mejorado.",
    price: 6000, speedMult: 1.15, hpMult: 1.25, fireMult: 0.85, shape: "omega",
    hull: "#ffdd44", hull2: "#ffaa00", hull3: "#885500",
    wing: "#ffaa00", accent: "#fff3cc", engine: "#ffdd44",
  },
]

function getShip(save: StarSave): ShipDef {
  return SHIP_DEFS.find(s => s.id === save.shipId) ?? SHIP_DEFS[0]
}

// Multiplicador de daño del combo aplicado al score
function comboMult(combo: number): number { return 1 + combo * 0.25 }

// Mejoras permanentes de nave derivadas del save + nave equipada
function upMaxHP(u: ShipUpgrades, ship: ShipDef): number { return Math.round((100 + u.hp * 20) * ship.hpMult) }
function upShieldDur(u: ShipUpgrades): number { return SHIELD_DURATION + u.shieldDur }
function upShieldCd(u: ShipUpgrades): number { return Math.max(3, SHIELD_COOLDOWN - u.shieldCd) }
function upFireMult(u: ShipUpgrades): number { return 1 - u.fireRate * 0.08 }
function upHasMagnet(u: ShipUpgrades, ship: ShipDef): boolean { return u.magnet >= 1 || ship.passive?.magnet === true }

/* ════════════════════════════════════════════════════════════════════
   TIPOS
   ════════════════════════════════════════════════════════════════════ */
type Phase =
  | "intro"
  | "world-select"
  | "hangar"
  | "ship-store"
  | "playing"
  | "boss-intro"
  | "boss"
  | "world-clear"
  | "gameover"
  | "victory"

type AmmoType = "basic" | "laser" | "spread" | "missile"
type EnemyType = "scout" | "grunt" | "tank" | "stealth" | "shooter" | "kamikaze" | "splitter" | "mini"
type PowerupKind = "magnet" | "overdrive" | "bomb"
type DropKind = AmmoType | PowerupKind

interface Bullet {
  id: number; x: number; y: number; vx: number; vy: number
  damage: number; ammo: AmmoType; fromPlayer: boolean; radius: number
  penetrate?: boolean; lifetime: number
  // missile tracking
  trackTimer?: number
}

interface Enemy {
  id: number; type: EnemyType; x: number; y: number; vx: number; vy: number
  hp: number; maxHp: number; w: number; h: number
  fireTimer: number; fireRate: number; oscPhase: number
  stealthTimer: number; visible: boolean
  color: string; accent: string; points: number; dropChance: number
  hitFlash: number   // segundos restantes de flash blanco
}

interface Boss {
  x: number; y: number; hp: number; maxHp: number; w: number; h: number
  phase: number         // 1 or 2
  attackTimer: number; attackIdx: number; moveTimer: number; targetX: number
  color: string; accent: string; alive: boolean; worldId: number
  // world-specific
  shieldActive: boolean; shieldHp: number
  teleportTimer: number; teleportCooldown: number
  gravPulseActive: boolean; gravTimer: number
  spawnTimer: number
  hitFlash: number
}

interface Drop {
  id: number; x: number; y: number; vx: number; vy: number; kind: DropKind; bobT: number
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; r: number
}

interface Floater {
  x: number; y: number; vy: number; life: number; maxLife: number
  text: string; color: string; size: number
}

interface Shockwave {
  x: number; y: number; r: number; maxR: number; life: number; maxLife: number; color: string
}

interface Star {
  x: number; y: number; spd: number; r: number; bright: number; layer: number
}

interface BtnArea { x: number; y: number; w: number; h: number }

interface GS {
  phase: Phase
  playerX: number; playerHP: number; playerMaxHP: number; invTimer: number
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
  touchX: number | null; isTouching: boolean
  ammoBtns: Array<BtnArea & { ammo: AmmoType }>
  worldBtns: Array<BtnArea & { worldId: number }>
  hangarBtns: Array<BtnArea & { key: keyof ShipUpgrades }>
  shipBtns: Array<BtnArea & { shipId: string }>
  introBtns: Array<BtnArea & { action: string }>
  save: StarSave
  flashMsg: string; flashT: number
  worldScroll: number          // scroll del selector de mundos
  worldDragStartY: number | null
  worldDragBase: number
  bossLaserActive: boolean; bossLaserT: number; bossLaserX: number
  shieldActive: boolean; shieldHP: number; shieldMaxHP: number
  shieldDuration: number; shieldCooldown: number; shieldCdMax: number
  shieldBtn: BtnArea | null
  screenShake: number
  // combo
  combo: number; comboTimer: number
  // power-ups activos
  magnetT: number; overdriveT: number
  // meta-progresión de la corrida
  runCoins: number; lastRunCoins: number
  // modo endless
  isEndless: boolean; endlessWave: number
}

/* ════════════════════════════════════════════════════════════════════
   DEFINICIÓN DE MUNDOS
   ════════════════════════════════════════════════════════════════════ */
interface WaveDef { enemies: EnemyType[]; delay: number }
interface WorldDef {
  id: number; name: string; subtitle: string
  bgColor: string; nebula: string; accent: string
  waves: WaveDef[]
  bossName: string; bossColor: string; bossAccent: string; bossHp: number
}

const WORLDS: WorldDef[] = [
  {
    id: 0, name: "Cinturón Rojo", subtitle: "El campo de asteroides",
    bgColor: "#0d0200", nebula: "#5a1200", accent: "#ff5500",
    waves: [
      { enemies: ["scout","scout","scout","grunt","grunt"], delay: 1200 },
      { enemies: ["scout","grunt","grunt","grunt","scout","scout"], delay: 1100 },
      { enemies: ["grunt","grunt","scout","scout","grunt","scout","grunt"], delay: 1000 },
    ],
    bossName: "Centinela Rojo", bossColor: "#cc2200", bossAccent: "#ff8844", bossHp: 900,
  },
  {
    id: 1, name: "Nebulosa Violeta", subtitle: "Los cazadores invisibles",
    bgColor: "#050010", nebula: "#2d0050", accent: "#cc44ff",
    waves: [
      { enemies: ["stealth","stealth","stealth","shooter","stealth"], delay: 1300 },
      { enemies: ["shooter","stealth","stealth","shooter","stealth","shooter"], delay: 1200 },
      { enemies: ["stealth","shooter","shooter","stealth","shooter","stealth","shooter"], delay: 1100 },
    ],
    bossName: "Espectro Oscuro", bossColor: "#6600aa", bossAccent: "#dd66ff", bossHp: 1100,
  },
  {
    id: 2, name: "Enjambre Verde", subtitle: "La marea imparable",
    bgColor: "#001500", nebula: "#002800", accent: "#44ff44",
    waves: [
      { enemies: ["scout","scout","scout","scout","scout","tank","scout"], delay: 800 },
      { enemies: ["tank","scout","scout","scout","scout","tank","scout","scout"], delay: 700 },
      { enemies: ["tank","tank","scout","scout","scout","scout","scout","tank","scout"], delay: 600 },
    ],
    bossName: "Reina del Enjambre", bossColor: "#006600", bossAccent: "#88ff44", bossHp: 1300,
  },
  {
    id: 3, name: "Singularidad Azul", subtitle: "Donde la gravedad colapsa",
    bgColor: "#000015", nebula: "#001040", accent: "#4488ff",
    waves: [
      { enemies: ["grunt","shooter","grunt","shooter","tank","shooter"], delay: 1100 },
      { enemies: ["tank","shooter","grunt","shooter","grunt","shooter","tank"], delay: 1000 },
      { enemies: ["tank","tank","shooter","grunt","shooter","grunt","shooter","tank"], delay: 900 },
    ],
    bossName: "El Devorador", bossColor: "#001166", bossAccent: "#44aaff", bossHp: 1500,
  },
  {
    id: 4, name: "Trono Estelar", subtitle: "El enfrentamiento final",
    bgColor: "#0a0800", nebula: "#302000", accent: "#ffcc00",
    waves: [
      { enemies: ["tank","shooter","stealth","scout","grunt","shooter","tank","stealth"], delay: 900 },
      { enemies: ["tank","stealth","shooter","tank","grunt","stealth","shooter","scout","tank"], delay: 800 },
      { enemies: ["tank","stealth","shooter","tank","shooter","stealth","tank","grunt","shooter","stealth","tank"], delay: 700 },
    ],
    bossName: "El Emperador", bossColor: "#664400", bossAccent: "#ffdd44", bossHp: 2000,
  },
  {
    id: 5, name: "Corona Helada", subtitle: "Los cristales del olvido",
    bgColor: "#000d1a", nebula: "#00304a", accent: "#66ddff",
    waves: [
      { enemies: ["grunt","shooter","grunt","shooter","splitter","grunt","shooter"], delay: 900 },
      { enemies: ["shooter","splitter","grunt","tank","shooter","grunt","splitter","shooter"], delay: 850 },
      { enemies: ["tank","splitter","shooter","grunt","splitter","shooter","tank","shooter","splitter"], delay: 800 },
    ],
    bossName: "La Reina del Hielo", bossColor: "#003366", bossAccent: "#66ccff", bossHp: 2300,
  },
  {
    id: 6, name: "Núcleo Ígneo", subtitle: "El corazón incandescente",
    bgColor: "#0f0000", nebula: "#420000", accent: "#ff7733",
    waves: [
      { enemies: ["tank","kamikaze","tank","grunt","kamikaze","shooter","kamikaze"], delay: 800 },
      { enemies: ["kamikaze","tank","kamikaze","splitter","tank","kamikaze","grunt","tank"], delay: 750 },
      { enemies: ["tank","kamikaze","splitter","tank","kamikaze","tank","splitter","kamikaze","tank"], delay: 700 },
    ],
    bossName: "El Coloso de Magma", bossColor: "#661100", bossAccent: "#ff8844", bossHp: 2600,
  },
  {
    id: 7, name: "El Vacío", subtitle: "Más allá del universo conocido",
    bgColor: "#000008", nebula: "#150033", accent: "#dd66ff",
    waves: [
      { enemies: ["tank","stealth","shooter","splitter","kamikaze","tank","shooter","stealth","grunt"], delay: 800 },
      { enemies: ["tank","shooter","stealth","kamikaze","splitter","tank","shooter","stealth","kamikaze","tank"], delay: 720 },
      { enemies: ["tank","stealth","shooter","kamikaze","splitter","tank","shooter","stealth","kamikaze","splitter","tank","grunt"], delay: 640 },
    ],
    bossName: "Null, el Aniquilador", bossColor: "#220033", bossAccent: "#ff55ff", bossHp: 3200,
  },
  {
    id: 8, name: "Bosque Nocturno", subtitle: "Donde crecen las pesadillas",
    bgColor: "#021006", nebula: "#063a12", accent: "#66ff88",
    waves: [
      { enemies: ["grunt","splitter","grunt","shooter","scout","splitter","grunt"], delay: 850 },
      { enemies: ["splitter","shooter","grunt","tank","splitter","shooter","grunt","splitter"], delay: 800 },
      { enemies: ["tank","splitter","shooter","grunt","splitter","shooter","tank","splitter","shooter"], delay: 750 },
    ],
    bossName: "La Madre Maleza", bossColor: "#0a3a1a", bossAccent: "#88ff66", bossHp: 3600,
  },
  {
    id: 9, name: "Mar de Mercurio", subtitle: "El océano de metal líquido",
    bgColor: "#000b14", nebula: "#0a3a5a", accent: "#88ccff",
    waves: [
      { enemies: ["shooter","stealth","shooter","grunt","splitter","shooter","stealth"], delay: 850 },
      { enemies: ["tank","shooter","stealth","splitter","shooter","tank","stealth","shooter"], delay: 780 },
      { enemies: ["tank","shooter","stealth","splitter","shooter","tank","stealth","splitter","shooter","tank"], delay: 720 },
    ],
    bossName: "El Leviatán", bossColor: "#0a3050", bossAccent: "#66eeff", bossHp: 4000,
  },
  {
    id: 10, name: "Purgatorio Dorado", subtitle: "Las puertas del juicio",
    bgColor: "#140e00", nebula: "#4a3a00", accent: "#ffcc44",
    waves: [
      { enemies: ["grunt","shooter","tank","kamikaze","grunt","shooter","kamikaze"], delay: 800 },
      { enemies: ["tank","shooter","kamikaze","grunt","shooter","tank","kamikaze","shooter"], delay: 740 },
      { enemies: ["tank","shooter","kamikaze","splitter","tank","shooter","kamikaze","shooter","tank","kamikaze"], delay: 680 },
    ],
    bossName: "El Inquisidor", bossColor: "#4a3a00", bossAccent: "#ffdd66", bossHp: 4500,
  },
  {
    id: 11, name: "Fragmentos Carmesí", subtitle: "El cielo desgarrado",
    bgColor: "#140005", nebula: "#3a0010", accent: "#ff4466",
    waves: [
      { enemies: ["kamikaze","splitter","kamikaze","stealth","shooter","kamikaze","splitter"], delay: 780 },
      { enemies: ["splitter","kamikaze","stealth","tank","splitter","kamikaze","shooter","splitter"], delay: 720 },
      { enemies: ["tank","splitter","kamikaze","stealth","splitter","kamikaze","tank","splitter","kamikaze"], delay: 660 },
    ],
    bossName: "La Cosechadora", bossColor: "#3a0018", bossAccent: "#ff5577", bossHp: 5000,
  },
  {
    id: 12, name: "Catedral Fantasma", subtitle: "Ecos del más allá",
    bgColor: "#070b12", nebula: "#1a2a44", accent: "#aaccff",
    waves: [
      { enemies: ["stealth","grunt","stealth","shooter","grunt","splitter","stealth"], delay: 820 },
      { enemies: ["stealth","shooter","tank","stealth","grunt","shooter","stealth","splitter"], delay: 760 },
      { enemies: ["tank","stealth","shooter","stealth","splitter","grunt","tank","stealth","shooter","stealth"], delay: 700 },
    ],
    bossName: "El Obispo", bossColor: "#222a44", bossAccent: "#ddeeff", bossHp: 5500,
  },
  {
    id: 13, name: "Abismo Esmeralda", subtitle: "La profundidad sin luz",
    bgColor: "#001409", nebula: "#003a1a", accent: "#44ffaa",
    waves: [
      { enemies: ["tank","shooter","tank","grunt","kamikaze","tank","shooter"], delay: 780 },
      { enemies: ["tank","kamikaze","tank","shooter","grunt","tank","kamikaze","shooter"], delay: 720 },
      { enemies: ["tank","tank","shooter","kamikaze","splitter","tank","shooter","kamikaze","tank"], delay: 660 },
    ],
    bossName: "El Titán Verde", bossColor: "#003322", bossAccent: "#55ff88", bossHp: 6200,
  },
  {
    id: 14, name: "Torre del Atardecer", subtitle: "El último bastión",
    bgColor: "#14050a", nebula: "#3a1a2a", accent: "#ff8844",
    waves: [
      { enemies: ["tank","stealth","shooter","kamikaze","splitter","tank","stealth"], delay: 760 },
      { enemies: ["tank","shooter","stealth","splitter","kamikaze","tank","shooter","stealth"], delay: 700 },
      { enemies: ["tank","shooter","stealth","kamikaze","splitter","tank","shooter","stealth","kamikaze","splitter"], delay: 640 },
    ],
    bossName: "La Vanguardia", bossColor: "#3a1020", bossAccent: "#ffaa66", bossHp: 7000,
  },
  {
    id: 15, name: "Infinito", subtitle: "Más allá del todo",
    bgColor: "#050010", nebula: "#1a0040", accent: "#ffdd55",
    waves: [
      { enemies: ["tank","shooter","stealth","kamikaze","splitter","grunt","tank","shooter"], delay: 720 },
      { enemies: ["tank","shooter","stealth","kamikaze","splitter","tank","shooter","stealth","kamikaze","splitter"], delay: 660 },
      { enemies: ["tank","shooter","stealth","kamikaze","splitter","tank","shooter","stealth","kamikaze","splitter","tank","shooter"], delay: 600 },
    ],
    bossName: "Amarok, el Último", bossColor: "#2a0044", bossAccent: "#ffee66", bossHp: 8000,
  },
]

/* ════════════════════════════════════════════════════════════════════
   HELPERS: crear entidades
   ════════════════════════════════════════════════════════════════════ */
function nextId(gs: GS): number { return gs.nextId++ }

function makeEnemy(type: EnemyType, worldId: number, id: number, diffMult = 1): Enemy {
  const x = 60 + Math.random() * (W - 120)
  const configs: Record<EnemyType, Partial<Enemy>> = {
    scout:    { w:28, h:28, hp:40,  maxHp:40,  vy:110, fireRate:0,    color:"#ff4422", accent:"#ff8866", points:50,  dropChance:0.15 },
    grunt:    { w:36, h:34, hp:90,  maxHp:90,  vy:70,  fireRate:2800, color:"#996644", accent:"#ccaa88", points:100, dropChance:0.25 },
    tank:     { w:52, h:48, hp:240, maxHp:240, vy:40,  fireRate:2000, color:"#447744", accent:"#88cc88", points:200, dropChance:0.40 },
    stealth:  { w:34, h:32, hp:55,  maxHp:55,  vy:80,  fireRate:2200, color:"#8844cc", accent:"#cc88ff", points:120, dropChance:0.30 },
    shooter:  { w:38, h:36, hp:70,  maxHp:70,  vy:50,  fireRate:1600, color:"#226688", accent:"#44aacc", points:150, dropChance:0.35 },
    kamikaze: { w:30, h:30, hp:30,  maxHp:30,  vy:130, fireRate:0,    color:"#ff2266", accent:"#ffaacc", points:130, dropChance:0.30 },
    splitter: { w:40, h:38, hp:80,  maxHp:80,  vy:60,  fireRate:0,    color:"#dd8800", accent:"#ffcc66", points:160, dropChance:0.35 },
    mini:     { w:20, h:20, hp:22,  maxHp:22,  vy:150, fireRate:0,    color:"#ffaa44", accent:"#ffdd99", points:40,  dropChance:0.10 },
  }
  const cfg = configs[type]
  // Tint with world accent slightly (solo tipos base)
  const baseTinted = ["scout","grunt","tank","stealth","shooter"].includes(type)
  const color = !baseTinted ? cfg.color! :
                worldId === 0 ? cfg.color! :
                worldId === 1 ? (type === "stealth" ? "#9933ee" : cfg.color!) :
                worldId === 2 ? "#226622" :
                worldId === 3 ? "#224466" :
                worldId === 4 ? cfg.color! :
                worldId === 5 ? "#336688" :
                worldId === 6 ? "#993322" :
                worldId === 7 ? "#5a44aa" :
                worldId === 8 ? "#2a6a2a" :
                worldId === 9 ? "#5a7a9a" :
                worldId === 10 ? "#996622" :
                worldId === 11 ? "#aa2244" :
                worldId === 12 ? "#5566aa" :
                worldId === 13 ? "#1a7a3a" :
                worldId === 14 ? "#994466" :
                worldId === 15 ? "#4a3a8a" :
                cfg.color!
  const hp = Math.round(cfg.hp! * diffMult)
  return {
    id, type, x, y: -50,
    vx: type === "scout" ? (Math.random() - 0.5) * 140 : 0,
    vy: (cfg.vy ?? 70) * (1 + worldId * 0.15) * (0.9 + diffMult * 0.1),
    hp, maxHp: hp, w: cfg.w!, h: cfg.h!,
    fireTimer: cfg.fireRate ? cfg.fireRate * Math.random() : 999999,
    fireRate: cfg.fireRate ?? 0,
    oscPhase: Math.random() * Math.PI * 2,
    stealthTimer: type === "stealth" ? 2200 : 0,
    visible: type !== "stealth" ? true : false,
    color, accent: cfg.accent ?? "#ffffff",
    points: cfg.points!, dropChance: cfg.dropChance!,
    hitFlash: 0,
  }
}

function makeBoss(worldId: number, hpMult = 1): Boss {
  const def = WORLDS[worldId]
  const hp = Math.round(def.bossHp * hpMult)
  return {
    x: W / 2, y: -100, hp, maxHp: hp,
    w: 90, h: 84,
    phase: 1, attackTimer: 3000, attackIdx: 0, moveTimer: 0, targetX: W / 2,
    color: def.bossColor, accent: def.bossAccent, alive: true, worldId,
    shieldActive: false, shieldHp: 200,
    teleportTimer: 0, teleportCooldown: 4500,
    gravPulseActive: false, gravTimer: 0,
    spawnTimer: 0, hitFlash: 0,
  }
}

function makeStar(): Star {
  // 3 capas de parallax: 0 lejana (lenta, tenue), 1 media, 2 cercana (rápida, brillante)
  const layer = Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2
  const spd  = layer === 0 ? 15 + Math.random() * 20 : layer === 1 ? 45 + Math.random() * 35 : 90 + Math.random() * 70
  const r    = layer === 0 ? 0.4 + Math.random() * 0.6 : layer === 1 ? 0.8 + Math.random() * 0.9 : 1.3 + Math.random() * 1.4
  const bright = layer === 0 ? 0.2 + Math.random() * 0.25 : layer === 1 ? 0.4 + Math.random() * 0.3 : 0.65 + Math.random() * 0.35
  return { x: Math.random() * W, y: Math.random() * H, spd, r, bright, layer }
}

function makeGS(): GS {
  const save = loadStarSave()
  const stars: Star[] = Array.from({ length: 120 }, makeStar)
  const maxHP = upMaxHP(save.upgrades, getShip(save))
  return {
    phase: "intro",
    playerX: W / 2, playerHP: maxHP, playerMaxHP: maxHP, invTimer: 0,
    activeAmmo: "basic",
    ammo: { basic: -1, laser: 0, spread: 0, missile: 0 },
    fireTimer: 0,
    worldId: 0, wave: 0,
    waveState: "spawning", toSpawn: [], spawnTimer: 0, spawnDelay: 1200,
    score: 0,
    bullets: [], enemyBullets: [], enemies: [], boss: null, drops: [], particles: [],
    floaters: [], shockwaves: [], trail: [],
    stars, lastTime: 0, phaseTimer: 0, nextId: 0,
    touchX: null, isTouching: false,
    ammoBtns: [], worldBtns: [], hangarBtns: [], shipBtns: [], introBtns: [],
    save, flashMsg: "", flashT: 0,
    worldScroll: 0, worldDragStartY: null, worldDragBase: 0,
    bossLaserActive: false, bossLaserT: 0, bossLaserX: W / 2,
    shieldActive: false, shieldHP: SHIELD_MAX_HP, shieldMaxHP: SHIELD_MAX_HP,
    shieldDuration: 0, shieldCooldown: 0, shieldCdMax: SHIELD_COOLDOWN,
    shieldBtn: null, screenShake: 0,
    combo: 0, comboTimer: 0,
    magnetT: 0, overdriveT: 0,
    runCoins: 0, lastRunCoins: 0,
    isEndless: false, endlessWave: 0,
  }
}

/* Helper: efectos visuales reutilizables */
function spawnFloater(gs: GS, x: number, y: number, text: string, color: string, size = 12) {
  gs.floaters.push({ x, y, vy: -34, life: 0.8, maxLife: 0.8, text, color, size })
}

function spawnShockwave(gs: GS, x: number, y: number, maxR: number, color: string) {
  gs.shockwaves.push({ x, y, r: 0, maxR, life: 0.4, maxLife: 0.4, color })
}

/* ════════════════════════════════════════════════════════════════════
   SPAWN BULLETS / PARTICLES
   ════════════════════════════════════════════════════════════════════ */
function spawnPlayerBullets(gs: GS) {
  const x = gs.playerX, y = PLAYER_Y - PLAYER_H / 2 - 4
  const ammo = gs.activeAmmo
  const configs: Record<AmmoType, () => Bullet[]> = {
    basic: () => [{
      id: nextId(gs), x, y, vx: 0, vy: -540, damage: 26,   // buff 22→26
      ammo, fromPlayer: true, radius: 6, lifetime: 3,
    }],
    laser: () => [{
      id: nextId(gs), x, y, vx: 0, vy: -720, damage: 65,
      ammo, fromPlayer: true, radius: 5, penetrate: true, lifetime: 3,
    }],
    spread: () => [
      { id: nextId(gs), x, y, vx: -130, vy: -520, damage: 22, ammo, fromPlayer: true, radius: 7, lifetime: 3 },
      { id: nextId(gs), x, y, vx:    0, vy: -560, damage: 22, ammo, fromPlayer: true, radius: 7, lifetime: 3 },
      { id: nextId(gs), x, y, vx:  130, vy: -520, damage: 22, ammo, fromPlayer: true, radius: 7, lifetime: 3 },
    ],
    missile: () => [{
      id: nextId(gs), x, y, vx: 0, vy: -380, damage: 90,
      ammo, fromPlayer: true, radius: 8, lifetime: 4, trackTimer: 0,
    }],
  }
  return configs[ammo]()
}

function spawnEnemyBullet(gs: GS, x: number, y: number, vx: number, vy: number, dmg: number) {
  gs.enemyBullets.push({
    id: nextId(gs), x, y, vx, vy, damage: dmg,
    ammo: "basic", fromPlayer: false, radius: 7, lifetime: 5,
  })
}

function spawnParticles(gs: GS, x: number, y: number, color: string, count: number, speed = 180) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2
    const spd = speed * (0.3 + Math.random() * 0.7)
    gs.particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 0.5 + Math.random() * 0.5, maxLife: 0.5 + Math.random() * 0.5,
      color, r: 2 + Math.random() * 5,
    })
  }
}

function spawnDrop(gs: GS, x: number, y: number) {
  // 22% de probabilidad de que el drop sea un power-up de campo en vez de munición
  if (Math.random() < 0.22) {
    const pu: PowerupKind[] = ["magnet", "overdrive", "bomb"]
    const kind = pu[Math.floor(Math.random() * pu.length)]
    gs.drops.push({ id: nextId(gs), x, y, vx: 0, vy: 55, kind, bobT: Math.random() * Math.PI * 2 })
    return
  }
  const types: AmmoType[] = ["laser", "spread", "missile"]
  // Weight by world (later worlds = better drops)
  const weights = [
    [6, 2, 1], [5, 3, 2], [4, 3, 3], [3, 4, 3], [2, 4, 4],
    [2, 4, 5], [2, 5, 5], [1, 5, 6],
    [2, 4, 6], [2, 4, 7], [1, 4, 7], [1, 4, 8],
    [1, 3, 8], [1, 3, 9], [0, 3, 9], [0, 3, 10],
  ][Math.min(gs.worldId, 15)] ?? [5, 3, 2]
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let kind: DropKind = "laser"
  for (let i = 0; i < types.length; i++) {
    r -= weights[i]; if (r <= 0) { kind = types[i]; break }
  }
  gs.drops.push({ id: nextId(gs), x, y, vx: 0, vy: 60, kind, bobT: Math.random() * Math.PI * 2 })
}

/* ════════════════════════════════════════════════════════════════════
   UPDATE
   ════════════════════════════════════════════════════════════════════ */
function update(gs: GS, dt: number) {
  gs.phaseTimer += dt
  if (gs.flashT > 0) gs.flashT -= dt
  if (gs.screenShake > 0) gs.screenShake = Math.max(0, gs.screenShake - dt * 20)

  // Update stars (parallax por capa)
  for (const s of gs.stars) {
    s.y += s.spd * dt
    if (s.y > H) { s.y = -4; s.x = Math.random() * W }
  }

  // Efectos visuales que corren siempre
  updateFloaters(gs, dt)
  updateShockwaves(gs, dt)

  if (gs.phase !== "playing" && gs.phase !== "boss") return

  // Combo timer
  if (gs.comboTimer > 0) {
    gs.comboTimer -= dt
    if (gs.comboTimer <= 0) gs.combo = 0
  }
  // Power-ups temporales
  if (gs.magnetT > 0) gs.magnetT -= dt
  if (gs.overdriveT > 0) gs.overdriveT -= dt

  updatePlayer(gs, dt)
  updatePlayerFire(gs, dt)
  updateBullets(gs, dt)
  updateEnemies(gs, dt)
  if (gs.boss) updateBoss(gs, dt)
  updateDrops(gs, dt)
  updateParticles(gs, dt)
  checkCollisions(gs)
  updateWaveProgression(gs, dt)
}

function updateFloaters(gs: GS, dt: number) {
  gs.floaters = gs.floaters.filter(f => {
    f.y += f.vy * dt; f.vy *= 0.92; f.life -= dt
    return f.life > 0
  })
}

function updateShockwaves(gs: GS, dt: number) {
  gs.shockwaves = gs.shockwaves.filter(s => {
    s.life -= dt
    s.r = s.maxR * (1 - s.life / s.maxLife)
    return s.life > 0
  })
}

// Registra una muerte de enemigo: combo, score, monedas, efectos
function registerKill(gs: GS, e: Enemy) {
  gs.combo = Math.min(gs.combo + 1, COMBO_MAX)
  gs.comboTimer = COMBO_TIMEOUT
  if (gs.combo > gs.save.bestCombo) gs.save.bestCombo = gs.combo
  const gained = Math.round(e.points * comboMult(gs.combo))
  gs.score += gained
  gs.runCoins += Math.max(1, Math.floor(gs.combo / 2))
  spawnFloater(gs, e.x, e.y - 8, `+${gained}`, gs.combo >= 4 ? "#ffdd44" : "#ffffff", gs.combo >= 4 ? 14 : 11)
  spawnParticles(gs, e.x, e.y, e.color, 18, 200)
  spawnShockwave(gs, e.x, e.y, e.w * 2, "#ffffff")
  if (Math.random() < e.dropChance) spawnDrop(gs, e.x, e.y)
  SFX.explosion()
}

function updatePlayer(gs: GS, dt: number) {
  if (gs.touchX !== null) {
    const dx = gs.touchX - gs.playerX
    const maxStep = PLAYER_SPEED * getShip(gs.save).speedMult * dt
    gs.playerX += Math.sign(dx) * Math.min(Math.abs(dx), maxStep)
    gs.playerX = Math.max(PLAYER_W / 2 + 4, Math.min(W - PLAYER_W / 2 - 4, gs.playerX))
  }
  if (gs.invTimer > 0) gs.invTimer -= dt

  // Estela de la nave (últimas 8 posiciones)
  gs.trail.push({ x: gs.playerX, y: PLAYER_Y })
  if (gs.trail.length > 8) gs.trail.shift()

  // Escudo activo: consume duración y HP
  if (gs.shieldActive) {
    gs.shieldDuration -= dt
    if (gs.shieldDuration <= 0 || gs.shieldHP <= 0) {
      gs.shieldActive = false
      gs.shieldCdMax = upShieldCd(gs.save.upgrades)
      gs.shieldCooldown = gs.shieldCdMax
      spawnParticles(gs, gs.playerX, PLAYER_Y, "#4488ff", 14, 160)
      if (gs.shieldHP <= 0) {
        gs.flashMsg = "¡Escudo destruido!"
        gs.flashT = 1.8
        SFX.shieldBreak()
      } else {
        gs.flashMsg = "Escudo agotado"
        gs.flashT = 1.2
        SFX.shieldOff()
      }
    }
  }
  if (!gs.shieldActive && gs.shieldCooldown > 0) gs.shieldCooldown -= dt
}

function activateShield(gs: GS) {
  if ((gs.phase !== "playing" && gs.phase !== "boss")) return
  if (gs.shieldActive || gs.shieldCooldown > 0) {
    if (gs.shieldCooldown > 0) {
      gs.flashMsg = `Escudo en recarga: ${Math.ceil(gs.shieldCooldown)}s`
      gs.flashT = 1
    }
    return
  }
  gs.shieldActive = true
  gs.shieldHP = gs.shieldMaxHP
  gs.shieldDuration = upShieldDur(gs.save.upgrades)
  spawnParticles(gs, gs.playerX, PLAYER_Y, "#4488ff", 18, 140)
  gs.flashMsg = "¡Escudo activado!"
  gs.flashT = 1
  SFX.shieldOn()
}

function effectiveFireRate(gs: GS, ammo: AmmoType): number {
  let rate = FIRE_RATES[ammo] / 1000
  rate *= upFireMult(gs.save.upgrades)
  rate *= getShip(gs.save).fireMult
  if (gs.overdriveT > 0) rate *= OVERDRIVE_MULT
  return rate
}

function updatePlayerFire(gs: GS, dt: number) {
  gs.fireTimer -= dt
  if (gs.fireTimer <= 0) {
    gs.fireTimer = effectiveFireRate(gs, gs.activeAmmo)
    const newBullets = spawnPlayerBullets(gs)
    if (gs.activeAmmo !== "basic") {
      const current = gs.ammo[gs.activeAmmo]
      if (current <= 0) {
        gs.activeAmmo = "basic"
        gs.fireTimer = effectiveFireRate(gs, "basic")
        gs.flashMsg = "¡Sin " + AMMO_NAMES[gs.activeAmmo] + "!"
        gs.flashT = 1.5
        return
      }
      gs.ammo[gs.activeAmmo] = Math.max(0, current - 1)
      if (gs.ammo[gs.activeAmmo] === 0) {
        gs.flashMsg = "¡Sin munición especial!"
        gs.flashT = 1.5
        gs.activeAmmo = "basic"
      }
    }
    gs.bullets.push(...newBullets)
    // Sonido de disparo
    if (gs.activeAmmo === "laser") SFX.shootLaser()
    else if (gs.activeAmmo === "spread") SFX.shootSpread()
    else if (gs.activeAmmo === "missile") SFX.shootMissile()
    else SFX.shoot()
  }
}

function updateBullets(gs: GS, dt: number) {
  // Player bullets
  gs.bullets = gs.bullets.filter(b => {
    b.lifetime -= dt
    // Missile tracking
    if (b.ammo === "missile" && b.trackTimer !== undefined) {
      b.trackTimer -= dt
      if (b.trackTimer <= 0) {
        b.trackTimer = 0.12
        // Find nearest enemy
        let nearest: Enemy | Boss | null = null
        let minDist = Infinity
        for (const e of gs.enemies) {
          const d = Math.hypot(e.x - b.x, e.y - b.y)
          if (d < minDist) { minDist = d; nearest = e }
        }
        if (!nearest && gs.boss?.alive) nearest = gs.boss
        if (nearest) {
          const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x)
          const spd = Math.hypot(b.vx, b.vy)
          b.vx += Math.cos(ang) * spd * 0.3
          b.vy += Math.sin(ang) * spd * 0.3
          const newSpd = Math.hypot(b.vx, b.vy)
          const maxSpd = 600
          if (newSpd > maxSpd) { b.vx = b.vx / newSpd * maxSpd; b.vy = b.vy / newSpd * maxSpd }
        }
      }
    }
    // Estela de humo del misil
    if (b.ammo === "missile") {
      gs.particles.push({
        x: b.x, y: b.y + 6, vx: (Math.random() - 0.5) * 20, vy: 40,
        life: 0.3, maxLife: 0.3, color: "#ff8800", r: 2 + Math.random() * 2,
      })
    }
    // World 4 gravity reversal
    if (gs.phase === "boss" && gs.boss?.gravPulseActive && gs.worldId === 3) {
      b.vy += 800 * dt   // pulls bullets downward
    }
    b.x += b.vx * dt; b.y += b.vy * dt
    return b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20 && b.lifetime > 0
  })
  // Enemy bullets
  gs.enemyBullets = gs.enemyBullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.lifetime -= dt
    return b.y < H + 20 && b.y > -20 && b.x > -20 && b.x < W + 20 && b.lifetime > 0
  })
}

function updateEnemies(gs: GS, dt: number) {
  for (const e of gs.enemies) {
    if (e.hitFlash > 0) e.hitFlash -= dt
    // Stealth toggle
    if (e.type === "stealth") {
      e.stealthTimer -= dt * 1000
      if (e.stealthTimer <= 0) {
        e.visible = !e.visible
        e.stealthTimer = e.visible ? 2200 : 1100
      }
    }
    // Scout oscillation
    if (e.type === "scout") {
      e.oscPhase += dt * 2.8
      e.x += Math.cos(e.oscPhase) * 130 * dt
    }
    // Kamikaze: acelera hacia el jugador
    if (e.type === "kamikaze") {
      const dx = gs.playerX - e.x
      e.vx += Math.sign(dx) * 300 * dt
      e.vx = Math.max(-260, Math.min(260, e.vx))
      e.vy = Math.min(e.vy + 120 * dt, 320)
      e.x += e.vx * dt; e.y += e.vy * dt
      // Estela roja
      if (Math.random() < 0.5) gs.particles.push({
        x: e.x, y: e.y - e.h / 2, vx: 0, vy: -30, life: 0.25, maxLife: 0.25, color: "#ff3366", r: 2,
      })
    } else if (e.type === "shooter") {
      // Shooter stays near top, oscillates X slowly
      if (e.y < H * 0.28) { e.y += e.vy * dt }
      else { e.vy = 0; e.oscPhase += dt * 1.2; e.x += Math.sin(e.oscPhase) * 60 * dt }
    } else {
      e.y += e.vy * dt
    }
    e.x = Math.max(e.w / 2 + 4, Math.min(W - e.w / 2 - 4, e.x))

    // Enemy fire
    if (e.fireRate > 0 && e.y > 0) {
      e.fireTimer -= dt * 1000
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireRate * (0.8 + Math.random() * 0.4)
        if (e.visible || e.type !== "stealth") {
          // Aim at player
          const dx = gs.playerX - e.x, dy = PLAYER_Y - e.y
          const mag = Math.hypot(dx, dy) || 1
          const spd = 200 + gs.worldId * 30
          spawnEnemyBullet(gs, e.x, e.y + e.h / 2, dx / mag * spd, dy / mag * spd, 12 + gs.worldId * 3)
        }
      }
    }
  }
  // Penalización: enemigos que ESCAPAN por el fondo cortan el combo
  const escaped = gs.enemies.filter(e => e.y >= H + 55)
  if (escaped.length > 0 && (gs.combo > 0 || gs.score > 0)) {
    gs.combo = 0; gs.comboTimer = 0
    spawnFloater(gs, W / 2, H - HUD_H - 30, "¡Escapó! Combo x1", "#ff5555", 13)
  }
  gs.enemies = gs.enemies.filter(e => e.y < H + 55)
}

function updateBoss(gs: GS, dt: number) {
  const b = gs.boss!
  if (!b.alive) return
  if (b.hitFlash > 0) b.hitFlash -= dt

  // Entry animation
  if (b.y < 120) { b.y += 80 * dt; return }

  // Move toward targetX
  b.moveTimer -= dt
  if (b.moveTimer <= 0) {
    b.moveTimer = 2.2 + Math.random()
    b.targetX = 80 + Math.random() * (W - 160)
  }
  const dx = b.targetX - b.x
  b.x += Math.sign(dx) * Math.min(Math.abs(dx), 120 * dt)

  // Phase 2 threshold
  if (b.hp < b.maxHp * 0.5 && b.phase === 1) {
    b.phase = 2
    gs.flashMsg = "¡FASE 2 ACTIVADA!"
    gs.flashT = 2
    gs.screenShake = 8
    spawnParticles(gs, b.x, b.y, b.accent, 30, 300)
    b.attackTimer = Math.min(b.attackTimer, 1200)
    SFX.bossPhase2()
  }

  // Attack timer
  b.attackTimer -= dt * 1000
  if (b.attackTimer <= 0) {
    executeBossAttack(gs, b)
    const baseRate = b.phase === 1 ? 2600 : 1600
    b.attackTimer = baseRate * (0.7 + Math.random() * 0.4)
  }

  // World-specific updates
  if (gs.worldId === 1) {  // Teleport boss
    b.teleportTimer -= dt * 1000
    if (b.teleportTimer <= 0) {
      b.teleportTimer = b.teleportCooldown
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
      b.x = 80 + Math.random() * (W - 160)
      b.y = 80 + Math.random() * (H * 0.3)
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
    }
  }
  if (gs.worldId === 3) {  // Gravity boss
    if (b.gravPulseActive) {
      b.gravTimer -= dt
      if (b.gravTimer <= 0) {
        b.gravPulseActive = false
        gs.flashMsg = "¡PULSO TERMINADO!"
        gs.flashT = 1
      }
    }
  }
  if (gs.worldId === 2) {  // Swarm queen spawns minions
    b.spawnTimer -= dt * 1000
    if (b.spawnTimer <= 0) {
      b.spawnTimer = b.phase === 1 ? 5000 : 3000
      const count = b.phase === 1 ? 2 : 4
      for (let i = 0; i < count; i++) {
        const e = makeEnemy("scout", gs.worldId, nextId(gs))
        e.x = b.x + (Math.random() - 0.5) * 80; e.y = b.y + b.h / 2
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Minions invocados!"
      gs.flashT = 1.2
    }
  }

  // Laser attack for boss
  if (gs.bossLaserActive) {
    gs.bossLaserT -= dt
    if (gs.bossLaserT <= 0) gs.bossLaserActive = false
  }
}

function executeBossAttack(gs: GS, b: Boss) {
  const px = gs.playerX, py = PLAYER_Y
  const bx = b.x, by = b.y + b.h / 2

  if (gs.worldId === 0) {
    // Centinela Rojo: spread shots
    const ways = b.phase === 1 ? 3 : 5
    for (let i = 0; i < ways; i++) {
      const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * (Math.PI / 5)
      const spd = 220
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 18)
    }
    if (b.phase === 2 && Math.random() < 0.4) {
      // Circle burst
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 160, Math.sin(ang) * 160, 14)
      }
    }
  } else if (gs.worldId === 1) {
    // Espectro Oscuro: aimed + laser
    const dx = px - bx, dy = py - by
    const spd = 260
    const burst = b.phase === 1 ? 1 : 3
    for (let i = 0; i < burst; i++) {
      const spread = (i - (burst - 1) / 2) * 0.3
      const ang = Math.atan2(dy, dx) + spread
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 20)
    }
    if (b.phase === 2 && Math.random() < 0.5) {
      gs.bossLaserActive = true
      gs.bossLaserT = 1.4
      gs.bossLaserX = bx
    }
  } else if (gs.worldId === 2) {
    // Reina: spiral
    b.attackIdx++
    const baseAng = (b.attackIdx * 0.7) % (Math.PI * 2)
    const ways = b.phase === 1 ? 4 : 6
    for (let i = 0; i < ways; i++) {
      const ang = baseAng + (i / ways) * Math.PI * 2
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 190, Math.sin(ang) * 190, 16)
    }
  } else if (gs.worldId === 3) {
    // Devorador: gravity + orbital
    if (!b.gravPulseActive && Math.random() < 0.4) {
      b.gravPulseActive = true
      b.gravTimer = 2.5
      gs.flashMsg = "¡PULSO GRAVITACIONAL!"
      gs.flashT = 1.5
    } else {
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2
        const spd = 170
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 15)
      }
    }
  } else if (gs.worldId === 4) {
    // Emperador: phase-scaled attacks
    if (b.phase === 1) {
      const ways = 3
      for (let i = 0; i < ways; i++) {
        const ang = -Math.PI / 2 + (i - 1) * 0.45
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 240, Math.sin(ang) * 240, 22)
      }
    } else {
      // Phase 2: 5-way + homing
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.35
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 260, Math.sin(ang) * 260, 24)
      }
      gs.bossLaserActive = true
      gs.bossLaserT = 1.6
      gs.bossLaserX = bx
      // Spawn elites
      if (Math.random() < 0.5) {
        const e = makeEnemy(Math.random() < 0.5 ? "tank" : "shooter", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 100; e.y = by + 40
        gs.enemies.push(e)
      }
    }
  } else if (gs.worldId === 5) {
    // Reina del Hielo: ráfagas apuntadas + anillos de cristal
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const spd = 250
    if (b.phase === 1) {
      // Trío apuntado + anillo lento ocasional
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.28
        const ang = Math.atan2(dy, dx) + spread
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 20)
      }
      if (Math.random() < 0.35) {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2
          spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 120, Math.sin(ang) * 120, 12)
        }
      }
    } else {
      // Fase 2: doble anillo giratorio + disparo grande
      for (let r = 0; r < 2; r++) {
        const off = b.attackIdx * 0.3 + r * Math.PI
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + off
          spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 165, Math.sin(ang) * 165, 13)
        }
      }
      spawnEnemyBullet(gs, bx, by, dx / mag * 280, dy / mag * 280, 24)
      if (Math.random() < 0.45) {
        gs.bossLaserActive = true
        gs.bossLaserT = 1.5
        gs.bossLaserX = bx
      }
    }
  } else if (gs.worldId === 6) {
    // Coloso de Magma: ráfaga radial + bola de magma apuntada
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const ways = b.phase === 1 ? 10 : 14
    for (let i = 0; i < ways; i++) {
      const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.15
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 175, Math.sin(ang) * 175, 14)
    }
    // Bola de magma lenta y potente
    spawnEnemyBullet(gs, bx, by, dx / mag * 180, dy / mag * 180, 30)
    if (b.phase === 2 && Math.random() < 0.45) {
      // Invoca kamikazes
      for (let i = 0; i < 3; i++) {
        const e = makeEnemy("kamikaze", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 120; e.y = by + 30
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Magma vivo!"
      gs.flashT = 1.2
    }
  } else if (gs.worldId === 7) {
    // Null, el Aniquilador: repertorio combinado de los jefes previos
    b.attackIdx++
    if (b.phase === 1) {
      // Cono 5 vías + espiral ocasional
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.35
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 255, Math.sin(ang) * 255, 22)
      }
      if (Math.random() < 0.4) {
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + b.attackIdx * 0.3
          spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 190, Math.sin(ang) * 190, 15)
        }
      }
    } else {
      // Fase 2: cono 7 vías + láser + élites + teleport
      for (let i = 0; i < 7; i++) {
        const ang = -Math.PI / 2 + (i - 3) * 0.28
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 270, Math.sin(ang) * 270, 24)
      }
      gs.bossLaserActive = true
      gs.bossLaserT = 1.7
      gs.bossLaserX = bx
      if (Math.random() < 0.55) {
        const e = makeEnemy(Math.random() < 0.5 ? "tank" : "stealth", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 120; e.y = by + 40
        gs.enemies.push(e)
      }
      if (Math.random() < 0.3) {
        spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
        b.x = 80 + Math.random() * (W - 160)
        b.y = 80 + Math.random() * (H * 0.3)
        spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
      }
    }
  } else if (gs.worldId === 8) {
    // Madre Maleza: enredaderas apuntadas + siembra de minions
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const volley = b.phase === 1 ? 3 : 5
    for (let i = 0; i < volley; i++) {
      const spread = (i - (volley - 1) / 2) * 0.26
      const ang = Math.atan2(dy, dx) + spread
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 250, Math.sin(ang) * 250, 20)
    }
    if (Math.random() < (b.phase === 1 ? 0.35 : 0.6)) {
      const n = b.phase === 1 ? 2 : 3
      for (let i = 0; i < n; i++) {
        const e = makeEnemy(Math.random() < 0.5 ? "scout" : "grunt", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 110; e.y = by + 30
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Maleza crece!"
      gs.flashT = 1.2
    }
    if (b.phase === 2) {
      // Anillo vegetal lento
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + b.attackIdx * 0.2
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 130, Math.sin(ang) * 130, 13)
      }
    }
  } else if (gs.worldId === 9) {
    // Leviatán: ráfagas + barrido de láser amplio
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const ways = b.phase === 1 ? 4 : 6
    for (let i = 0; i < ways; i++) {
      const spread = (i - (ways - 1) / 2) * 0.22
      const ang = Math.atan2(dy, dx) + spread
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 260, Math.sin(ang) * 260, 20)
    }
    if (Math.random() < (b.phase === 1 ? 0.35 : 0.55)) {
      gs.bossLaserActive = true
      gs.bossLaserT = b.phase === 1 ? 1.1 : 1.6
      gs.bossLaserX = bx
    }
  } else if (gs.worldId === 10) {
    // Inquisidor: cono severo + teleport judicial
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const ways = b.phase === 1 ? 5 : 7
    for (let i = 0; i < ways; i++) {
      const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * 0.3
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 250, Math.sin(ang) * 250, 22)
    }
    if (Math.random() < (b.phase === 1 ? 0.25 : 0.5)) {
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
      b.x = 80 + Math.random() * (W - 160)
      b.y = 80 + Math.random() * (H * 0.3)
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
    }
    if (b.phase === 2 && Math.random() < 0.35) {
      // Bola de juicio apuntada
      spawnEnemyBullet(gs, bx, by, dx / mag * 260, dy / mag * 260, 26)
    }
  } else if (gs.worldId === 11) {
    // Cosechadora: ráfagas radiales + siega con splitters
    b.attackIdx++
    const ways = b.phase === 1 ? 12 : 16
    for (let i = 0; i < ways; i++) {
      const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.12
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 180, Math.sin(ang) * 180, 14)
    }
    if (Math.random() < (b.phase === 1 ? 0.3 : 0.55)) {
      const n = b.phase === 1 ? 1 : 2
      for (let i = 0; i < n; i++) {
        const e = makeEnemy("splitter", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 100; e.y = by + 30
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Segadores liberados!"
      gs.flashT = 1.2
    }
  } else if (gs.worldId === 12) {
    // Obispo: anillos litúrgicos + teleport + láser
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const rings = b.phase === 1 ? 1 : 2
    for (let r = 0; r < rings; r++) {
      const off = b.attackIdx * 0.25 + r * (Math.PI / 2)
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + off
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 150, Math.sin(ang) * 150, 14)
      }
    }
    spawnEnemyBullet(gs, bx, by, dx / mag * 260, dy / mag * 260, 22)
    if (b.phase === 2) {
      if (Math.random() < 0.45) {
        gs.bossLaserActive = true
        gs.bossLaserT = 1.5
        gs.bossLaserX = bx
      }
      if (Math.random() < 0.3) {
        spawnParticles(gs, b.x, b.y, b.accent, 18, 220)
        b.x = 80 + Math.random() * (W - 160)
        b.y = 80 + Math.random() * (H * 0.3)
        spawnParticles(gs, b.x, b.y, b.accent, 18, 220)
      }
    }
  } else if (gs.worldId === 13) {
    // Titán Verde: placaje radial + onda expansiva lenta + refuerzos
    b.attackIdx++
    const ways = b.phase === 1 ? 10 : 14
    for (let i = 0; i < ways; i++) {
      const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.1
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 190, Math.sin(ang) * 190, 15)
    }
    // Onda lenta y grande
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + b.attackIdx * 0.3
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 105, Math.sin(ang) * 105, 20)
    }
    if (b.phase === 2 && Math.random() < 0.4) {
      const e = makeEnemy("tank", gs.worldId, nextId(gs))
      e.x = bx + (Math.random() - 0.5) * 120; e.y = by + 30
      gs.enemies.push(e)
      gs.flashMsg = "¡Refuerzos de titanio!"
      gs.flashT = 1.2
    }
  } else if (gs.worldId === 14) {
    // Vanguardia: alterna cono / espiral según el ataque
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    if (b.attackIdx % 2 === 0) {
      const ways = b.phase === 1 ? 5 : 7
      for (let i = 0; i < ways; i++) {
        const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * 0.32
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 255, Math.sin(ang) * 255, 21)
      }
    } else {
      const ways = b.phase === 1 ? 8 : 12
      for (let i = 0; i < ways; i++) {
        const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.2
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 180, Math.sin(ang) * 180, 14)
      }
    }
    if (b.phase === 2) {
      spawnEnemyBullet(gs, bx, by, dx / mag * 270, dy / mag * 270, 24)
      if (Math.random() < 0.3) {
        gs.bossLaserActive = true
        gs.bossLaserT = 1.4
        gs.bossLaserX = bx
      }
    }
  } else if (gs.worldId === 15) {
    // Amarok: el repertorio completo, potenciado
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    // Espiral doble giratoria
    const spiralWays = b.phase === 1 ? 8 : 12
    for (let r = 0; r < 2; r++) {
      const off = r * Math.PI
      for (let i = 0; i < spiralWays; i++) {
        const ang = (i / spiralWays) * Math.PI * 2 + b.attackIdx * 0.18 + off
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 185, Math.sin(ang) * 185, 15)
      }
    }
    // Cono principal
    const ways = b.phase === 1 ? 7 : 9
    for (let i = 0; i < ways; i++) {
      const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * 0.26
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 270, Math.sin(ang) * 270, 24)
    }
    // Bola apuntada letal
    spawnEnemyBullet(gs, bx, by, dx / mag * 290, dy / mag * 290, 30)
    if (b.phase === 2) {
      gs.bossLaserActive = true
      gs.bossLaserT = 1.8
      gs.bossLaserX = bx
      for (let i = 0; i < 2; i++) {
        const e = makeEnemy(Math.random() < 0.5 ? "tank" : "stealth", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 130; e.y = by + 40
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡FURIA DE AMAROK!"
      gs.flashT = 1.3
    }
  }
}

function collectDrop(gs: GS, d: Drop) {
  if (d.kind === "magnet" || d.kind === "overdrive" || d.kind === "bomb") {
    // Power-up de campo
    if (d.kind === "magnet") {
      gs.magnetT = MAGNET_DURATION
      gs.flashMsg = "🧲 ¡Imán activado!"
    } else if (d.kind === "overdrive") {
      gs.overdriveT = OVERDRIVE_DURATION
      gs.flashMsg = "⚡ ¡Sobrecarga de disparo!"
    } else {
      // Bomba: limpia balas enemigas y daña a todos los enemigos visibles
      gs.enemyBullets = []
      gs.screenShake = Math.max(gs.screenShake, 10)
      for (const e of gs.enemies) {
        e.hp -= 120; e.hitFlash = 0.1
        spawnParticles(gs, e.x, e.y, "#ffdd00", 6, 150)
        if (e.hp <= 0 && e.hp !== -1) { registerKill(gs, e); e.hp = -1 }
      }
      gs.enemies = gs.enemies.filter(e => e.hp > 0)
      if (gs.boss?.alive) { gs.boss.hp -= 200; gs.boss.hitFlash = 0.12 }
      spawnShockwave(gs, W / 2, H / 2, W, "#ffdd00")
      gs.flashMsg = "💣 ¡BOMBA!"
    }
    gs.flashT = 1.5
    spawnParticles(gs, d.x, d.y, POWERUP_COLORS[d.kind], 14, 150)
    SFX.pickup()
    return
  }
  // Munición
  const ammo = d.kind as AmmoType
  const amounts: Record<AmmoType, number> = { basic: -1, laser: 15, spread: 20, missile: 10 }
  gs.ammo[ammo] += amounts[ammo]
  spawnParticles(gs, d.x, d.y, AMMO_COLORS[ammo], 10, 120)
  gs.flashMsg = `+${amounts[ammo]} ${AMMO_NAMES[ammo]}!`
  gs.flashT = 1.5
  SFX.pickup()
}

function updateDrops(gs: GS, dt: number) {
  const magnetOn = gs.magnetT > 0 || upHasMagnet(gs.save.upgrades, getShip(gs.save))
  gs.drops = gs.drops.filter(d => {
    d.bobT += dt * 2
    if (magnetOn) {
      // Vuela hacia la nave
      const dx = gs.playerX - d.x, dy = PLAYER_Y - d.y
      const mag = Math.hypot(dx, dy) || 1
      const pull = 420
      d.x += dx / mag * pull * dt
      d.y += dy / mag * pull * dt
    } else {
      d.y += d.vy * dt
    }
    // Check collection
    const dist = Math.hypot(d.x - gs.playerX, d.y - PLAYER_Y)
    if (dist < 32) {
      collectDrop(gs, d)
      return false
    }
    return d.y < H + 40
  })
}

function updateParticles(gs: GS, dt: number) {
  gs.particles = gs.particles.filter(p => {
    p.x += p.vx * dt; p.y += p.vy * dt
    p.vx *= 0.96; p.vy *= 0.96
    p.life -= dt
    return p.life > 0
  })
}

// Daño al jugador; el escudo absorbe si está activo. Devuelve true si murió.
function damagePlayer(gs: GS, dmg: number, invSet: number, hitColor: string) {
  if (gs.shieldActive) {
    gs.shieldHP -= dmg
    spawnParticles(gs, gs.playerX, PLAYER_Y, "#4488ff", 8, 150)
    gs.screenShake = Math.max(gs.screenShake, 4)
    return false
  }
  if (gs.invTimer > 0) return false
  gs.playerHP -= dmg
  gs.invTimer = invSet
  gs.combo = 0; gs.comboTimer = 0   // recibir daño corta la racha
  gs.screenShake = Math.max(gs.screenShake, 7)
  spawnParticles(gs, gs.playerX, PLAYER_Y, hitColor, 14, 170)
  SFX.playerHit()
  if (gs.playerHP <= 0) { gs.playerHP = 0; transitionTo(gs, "gameover"); return true }
  return false
}

function onBossDefeated(gs: GS, b2: Boss) {
  b2.alive = false
  gs.score += 1000 + gs.worldId * 500
  gs.runCoins += 50 + gs.worldId * 25
  gs.screenShake = 14
  spawnShockwave(gs, b2.x, b2.y, 200, b2.accent)
  spawnParticles(gs, b2.x, b2.y, b2.accent, 60, 350)
  for (let i = 0; i < 5; i++) {
    setTimeout(() => spawnParticles(gs, b2.x + (Math.random()-0.5)*100, b2.y + (Math.random()-0.5)*60, b2.accent, 20, 200), i * 200)
  }
  SFX.bigExplosion()
  if (gs.isEndless) {
    // En endless el jefe no termina el nivel: se reanuda con más dificultad
    gs.boss = null
    gs.bossLaserActive = false
    gs.phase = "playing"
    gs.flashMsg = "¡Mini-jefe derrotado! +monedas"
    gs.flashT = 2
    startNextEndlessWave(gs)
  } else {
    transitionTo(gs, "world-clear")
  }
}

function checkCollisions(gs: GS) {
  // Player bullets vs enemies
  for (const e of gs.enemies) {
    const toRemove: number[] = []
    for (const b of gs.bullets) {
      if (!e.visible && e.type === "stealth") continue
      const dist = Math.hypot(b.x - e.x, b.y - e.y)
      if (dist < b.radius + Math.min(e.w, e.h) / 2) {
        e.hp -= b.damage
        e.hitFlash = 0.07
        spawnParticles(gs, b.x, b.y, AMMO_COLORS[b.ammo], 4, 120)
        spawnFloater(gs, b.x, b.y - 6, String(b.damage), AMMO_COLORS[b.ammo], 10)
        if (!b.penetrate) toRemove.push(b.id)
        if (e.hp > 0) {
          SFX.enemyHit()
        } else {
          // Splitter se divide al morir
          if (e.type === "splitter") {
            for (let s = -1; s <= 1; s += 2) {
              const mini = makeEnemy("mini", gs.worldId, nextId(gs))
              mini.x = e.x; mini.y = e.y; mini.vx = s * 90
              gs.enemies.push(mini)
            }
          }
          registerKill(gs, e)
          e.hp = -1  // mark dead
        }
      }
    }
    if (toRemove.length) gs.bullets = gs.bullets.filter(b => !toRemove.includes(b.id))
  }
  gs.enemies = gs.enemies.filter(e => e.hp > 0)

  // Player bullets vs boss
  if (gs.boss?.alive) {
    const b2 = gs.boss
    const toRemoveBoss: number[] = []
    for (const b of gs.bullets) {
      const dist = Math.hypot(b.x - b2.x, b.y - b2.y)
      if (dist < b.radius + Math.min(b2.w, b2.h) / 2) {
        let dmg = b.damage
        if (b2.shieldActive) { dmg = Math.round(dmg * 0.15) }
        b2.hp -= dmg
        b2.hitFlash = 0.06
        spawnParticles(gs, b.x, b.y, b2.shieldActive ? "#44aaff" : AMMO_COLORS[b.ammo], 4, 100)
        spawnFloater(gs, b.x, b.y - 6, String(dmg), b2.shieldActive ? "#44aaff" : AMMO_COLORS[b.ammo], 10)
        if (!b.penetrate) toRemoveBoss.push(b.id)
        if (b2.hp > 0) {
          SFX.enemyHit()
        } else {
          onBossDefeated(gs, b2)
        }
      }
    }
    if (toRemoveBoss.length) gs.bullets = gs.bullets.filter(b => !toRemoveBoss.includes(b.id))
  }

  // Enemy bullets vs player (escudo absorbe el daño)
  for (const b of gs.enemyBullets) {
    const dist = Math.hypot(b.x - gs.playerX, b.y - PLAYER_Y)
    const hitRadius = gs.shieldActive ? SHIELD_HURTBOX : 18
    if (dist < b.radius + hitRadius) {
      b.lifetime = 0
      if (damagePlayer(gs, b.damage, 1.2, "#00e5ff")) return
      if (!gs.shieldActive) break
    }
  }

  // Colisión cuerpo-a-cuerpo: enemigo contra la nave
  const contactDmg: Partial<Record<EnemyType, number>> = {
    scout: 12, grunt: 18, tank: 30, stealth: 14, shooter: 16, kamikaze: 25, splitter: 20, mini: 10,
  }
  for (const e of gs.enemies) {
    if (!e.visible && e.type === "stealth") continue
    const dist = Math.hypot(e.x - gs.playerX, e.y - PLAYER_Y)
    if (dist < e.w / 2 + 18) {
      const dmg = contactDmg[e.type] ?? 15
      // El kamikaze y los minis explotan al chocar
      if (e.type === "kamikaze" || e.type === "mini" || e.type === "splitter") {
        e.hp = -1
        spawnParticles(gs, e.x, e.y, e.color, 16, 200)
        spawnShockwave(gs, e.x, e.y, e.w * 2, "#ff4400")
        SFX.explosion()
      }
      if (damagePlayer(gs, dmg, 1.2, "#ff4400")) return
    }
  }
  gs.enemies = gs.enemies.filter(e => e.hp > 0)

  // Boss laser vs player
  if (gs.bossLaserActive && gs.boss?.alive) {
    const lx = gs.bossLaserX
    if (Math.abs(gs.playerX - lx) < 20) {
      if (gs.shieldActive) {
        gs.shieldHP -= 40 * 0.016
      } else if (gs.invTimer <= 0) {
        gs.playerHP -= 30 * 0.016
        gs.invTimer = 0.05
        if (gs.playerHP <= 0) { gs.playerHP = 0; transitionTo(gs, "gameover"); return }
      }
    }
  }

  // Boss contact
  if (gs.boss?.alive) {
    const b2 = gs.boss
    const dist = Math.hypot(gs.playerX - b2.x, PLAYER_Y - b2.y)
    if (dist < 40) {
      if (damagePlayer(gs, 30, 1.5, "#ff4400")) return
    }
  }
}

// Dificultad y composición procedural para el modo Endless
function endlessDiffMult(wave: number): number { return 1 + Math.floor(wave / 3) * 0.12 }

function genEndlessWave(gs: GS): EnemyType[] {
  const wave = gs.endlessWave
  const diff = Math.floor(wave / 3)
  const count = Math.min(6 + Math.floor(wave / 2), 16)
  // Piscina de tipos que crece con la dificultad
  const pool: EnemyType[] = ["scout", "grunt"]
  if (wave >= 2) pool.push("shooter")
  if (wave >= 3) pool.push("kamikaze")
  if (wave >= 4) pool.push("tank", "stealth")
  if (wave >= 6) pool.push("splitter")
  const list: EnemyType[] = []
  for (let i = 0; i < count; i++) list.push(pool[Math.floor(Math.random() * pool.length)])
  // Cicla el worldId por estética de fondo
  gs.worldId = wave % WORLDS.length
  return list.concat(new Array(diff).fill("scout"))  // relleno extra a mayor dificultad
}

function startNextEndlessWave(gs: GS) {
  gs.endlessWave++
  if (gs.endlessWave > gs.save.endlessBest) gs.save.endlessBest = gs.endlessWave
  // Mini-jefe cada 5 oleadas
  if (gs.endlessWave % 5 === 0) {
    gs.boss = makeBoss((gs.endlessWave / 5 - 1) % WORLDS.length, 0.6 + gs.endlessWave * 0.04)
    gs.phase = "boss"
    gs.waveState = "done"
    gs.flashMsg = `¡MINI-JEFE! Oleada ${gs.endlessWave}`
    gs.flashT = 2.2
    SFX.bossIntro()
    return
  }
  gs.toSpawn = genEndlessWave(gs)
  gs.spawnTimer = 0
  gs.spawnDelay = Math.max(400, 900 - gs.endlessWave * 25)
  gs.waveState = "spawning"
  gs.flashMsg = `OLEADA ${gs.endlessWave}`
  gs.flashT = 1.6
}

function updateWaveProgression(gs: GS, dt: number) {
  // ── Modo ENDLESS ──
  if (gs.isEndless) {
    if (gs.waveState === "spawning") {
      gs.spawnTimer -= dt * 1000
      if (gs.spawnTimer <= 0 && gs.toSpawn.length > 0) {
        const type = gs.toSpawn.shift()!
        gs.enemies.push(makeEnemy(type, gs.worldId, nextId(gs), endlessDiffMult(gs.endlessWave)))
        gs.spawnTimer = gs.spawnDelay
      }
      if (gs.toSpawn.length === 0) gs.waveState = "clearing"
    }
    if (gs.waveState === "clearing" && gs.enemies.length === 0) {
      startNextEndlessWave(gs)
    }
    return
  }

  // ── Modo CAMPAÑA ──
  const worldDef = WORLDS[gs.worldId]
  const waveDef = worldDef.waves[gs.wave]

  if (gs.waveState === "spawning") {
    gs.spawnTimer -= dt * 1000
    if (gs.spawnTimer <= 0 && gs.toSpawn.length > 0) {
      const type = gs.toSpawn.shift()!
      gs.enemies.push(makeEnemy(type, gs.worldId, nextId(gs)))
      gs.spawnTimer = waveDef.delay
    }
    if (gs.toSpawn.length === 0) gs.waveState = "clearing"
  }

  if (gs.waveState === "clearing") {
    if (gs.enemies.length === 0) {
      if (gs.wave < worldDef.waves.length - 1) {
        gs.wave++
        const nextWave = worldDef.waves[gs.wave]
        gs.toSpawn = [...nextWave.enemies]
        gs.spawnTimer = nextWave.delay
        gs.waveState = "spawning"
        gs.flashMsg = `OLEADA ${gs.wave + 1}/${worldDef.waves.length}`
        gs.flashT = 2
      } else {
        gs.waveState = "boss-wait"
        gs.phaseTimer = 0
        transitionTo(gs, "boss-intro")
      }
    }
  }
}

// Resetea todo lo común al arrancar una partida (campaña o endless)
function resetRunState(gs: GS) {
  const maxHP = upMaxHP(gs.save.upgrades, getShip(gs.save))
  gs.playerMaxHP = maxHP; gs.playerHP = maxHP; gs.invTimer = 0
  gs.enemies = []; gs.bullets = []; gs.enemyBullets = []; gs.drops = []
  gs.boss = null; gs.bossLaserActive = false
  gs.fireTimer = 0
  gs.shieldActive = false; gs.shieldHP = SHIELD_MAX_HP
  gs.shieldDuration = 0; gs.shieldCooldown = 0
  gs.screenShake = 0
  gs.combo = 0; gs.comboTimer = 0
  gs.magnetT = 0; gs.overdriveT = 0
  gs.floaters = []; gs.shockwaves = []; gs.trail = []
}

// Banca las monedas de la corrida al save
function bankCoins(gs: GS) {
  gs.lastRunCoins = gs.runCoins
  if (gs.runCoins > 0) {
    gs.save.coins += gs.runCoins
    gs.runCoins = 0
  }
  writeStarSave(gs.save)
}

function startEndless(gs: GS) {
  gs.isEndless = true
  gs.endlessWave = 0
  gs.score = 0
  gs.runCoins = 0
  gs.worldId = 0
  gs.ammo = { basic: -1, laser: 0, spread: 0, missile: 0 }
  gs.activeAmmo = "basic"
  resetRunState(gs)
  gs.phase = "playing"; gs.phaseTimer = 0
  startNextEndlessWave(gs)
}

function transitionTo(gs: GS, phase: Phase) {
  gs.phase = phase
  gs.phaseTimer = 0

  if (phase === "playing") {
    gs.isEndless = false
    const worldDef = WORLDS[gs.worldId]
    gs.wave = 0
    gs.toSpawn = [...worldDef.waves[0].enemies]
    gs.spawnTimer = worldDef.waves[0].delay
    gs.waveState = "spawning"
    resetRunState(gs)
  }

  if (phase === "boss-intro") {
    SFX.bossIntro()
  }

  if (phase === "boss") {
    gs.boss = makeBoss(gs.worldId)
    gs.enemies = []; gs.bullets = []; gs.enemyBullets = []
    gs.bossLaserActive = false
  }

  if (phase === "world-clear") {
    const prev = gs.save
    if (gs.worldId + 1 > prev.worldsCleared) prev.worldsCleared = gs.worldId + 1
    const prevHs = prev.highScores[gs.worldId] ?? 0
    if (gs.score > prevHs) prev.highScores[gs.worldId] = gs.score
    bankCoins(gs)
    SFX.worldClear()
  }

  if (phase === "gameover") {
    if (gs.isEndless && gs.endlessWave > gs.save.endlessBest) gs.save.endlessBest = gs.endlessWave
    bankCoins(gs)
    spawnParticles(gs, gs.playerX, PLAYER_Y, "#ff4400", 30, 250)
    spawnShockwave(gs, gs.playerX, PLAYER_Y, 120, "#ff4400")
  }
}

/* ════════════════════════════════════════════════════════════════════
   DRAW HELPERS
   ════════════════════════════════════════════════════════════════════ */
function drawShipShape(ctx: CanvasRenderingContext2D, ship: ShipDef) {
  const { shape, hull, hull2, hull3, wing, accent, engine } = ship
  const eng = (gx: number, gy: number, rx: number, ry: number) => {
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, rx)
    glow.addColorStop(0, engine + "cc")
    glow.addColorStop(1, engine + "00")
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  }
  const hullGrad = () => {
    const hg = ctx.createLinearGradient(-14, -24, 14, 24)
    hg.addColorStop(0, hull); hg.addColorStop(0.5, hull2); hg.addColorStop(1, hull3)
    ctx.fillStyle = hg
  }

  if (shape === "interceptor") {
    eng(0, 16, 14, 10)
    // Alas barridas
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-27, 10); ctx.lineTo(-23, 19); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(27, 10); ctx.lineTo(23, 19); ctx.lineTo(6, 11); ctx.closePath(); ctx.fill()
    // Aletas de cola
    ctx.fillStyle = hull2
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-13, 22); ctx.lineTo(-5, 21); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(13, 22); ctx.lineTo(5, 21); ctx.closePath(); ctx.fill()
    // Fuselaje afilado
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(12, -10); ctx.lineTo(8, 20); ctx.lineTo(-8, 20); ctx.lineTo(-12, -10)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -10, 4, 8, 0, 0, Math.PI * 2); ctx.fill()
  } else if (shape === "tank") {
    eng(0, 18, 26, 15)
    // Cuerpo ancho
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(20, -8); ctx.lineTo(22, 18); ctx.lineTo(-22, 18); ctx.lineTo(-20, -8)
    ctx.closePath(); ctx.fill()
    // Cañones dobles
    ctx.fillStyle = wing
    ctx.fillRect(-15, -22, 7, 12); ctx.fillRect(8, -22, 7, 12)
    // Placas de blindaje laterales
    ctx.fillStyle = hull3
    ctx.fillRect(-21, -6, 4, 22); ctx.fillRect(17, -6, 4, 22)
    // Cockpit blindado
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.roundRect(-8, -8, 16, 12, 4); ctx.fill()
  } else if (shape === "jet") {
    // Doble motor
    eng(-8, 18, 11, 12); eng(8, 18, 11, 12)
    // Alas en flecha
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-25, 8); ctx.lineTo(-18, 17); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(25, 8); ctx.lineTo(18, 17); ctx.lineTo(4, 8); ctx.closePath(); ctx.fill()
    // Fuselaje redondeado
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(13, -12, 11, 16)
    ctx.lineTo(-11, 16); ctx.quadraticCurveTo(-13, -12, 0, -26)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -9, 5, 9, 0, 0, Math.PI * 2); ctx.fill()
  } else if (shape === "phantom") {
    eng(0, 16, 16, 11)
    // Alas angulares
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-23, -8); ctx.lineTo(-25, 16); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(23, -8); ctx.lineTo(25, 16); ctx.lineTo(6, 12); ctx.closePath(); ctx.fill()
    // Fuselaje de sigilo (cortante)
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(16, -2); ctx.lineTo(10, 20); ctx.lineTo(-10, 20); ctx.lineTo(-16, -2)
    ctx.closePath(); ctx.fill()
    // Cabina en diamante
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(4, -6); ctx.lineTo(0, 2); ctx.lineTo(-4, -6)
    ctx.closePath(); ctx.fill()
  } else if (shape === "omega") {
    // Doble motor superior
    eng(-7, 20, 12, 13); eng(7, 20, 12, 13)
    // Alas grandes
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-28, 16); ctx.lineTo(-24, 24); ctx.lineTo(-8, 14); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(28, 16); ctx.lineTo(24, 24); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill()
    // Winglets
    ctx.beginPath(); ctx.moveTo(-24, 2); ctx.lineTo(-31, 6); ctx.lineTo(-26, 12); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(24, 2); ctx.lineTo(31, 6); ctx.lineTo(26, 12); ctx.closePath(); ctx.fill()
    // Fuselaje alargado
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(16, -6); ctx.lineTo(14, 24); ctx.lineTo(-14, 24); ctx.lineTo(-16, -6)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -10, 7, 11, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    // delta (Aurora) — forma clásica
    eng(0, 18, 22, 16)
    // Alas
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-24, 16); ctx.lineTo(-20, 22); ctx.lineTo(-8, 12)
    ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(24, 16); ctx.lineTo(20, 22); ctx.lineTo(8, 12)
    ctx.closePath(); ctx.fill()
    // Fuselaje
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(14, -6); ctx.lineTo(12, 22); ctx.lineTo(-12, 22); ctx.lineTo(-14, -6)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -8, 6, 10, 0, 0, Math.PI * 2); ctx.fill()
  }
}

function drawPlayerShip(
  ctx: CanvasRenderingContext2D, x: number, y: number, ship: ShipDef,
  invTimer: number, shieldActive: boolean, shieldHP: number, shieldMaxHP: number,
  shieldCooldown: number, shieldCdMax: number, time: number,
) {
  if (invTimer > 0 && Math.floor(invTimer * 12) % 2 === 0) return  // blink
  ctx.save()
  ctx.translate(x, y)

  // Escudo (se dibuja debajo de la nave)
  if (shieldActive) {
    const shieldPct = shieldHP / shieldMaxHP
    const pulse = 0.55 + Math.sin(time * 10) * 0.15
    // Resplandor exterior
    const shGlow = ctx.createRadialGradient(0, 0, 20, 0, 0, 48)
    shGlow.addColorStop(0, `rgba(68,136,255,${pulse * 0.35})`)
    shGlow.addColorStop(1, "rgba(68,136,255,0)")
    ctx.fillStyle = shGlow
    ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill()
    // Hexágono de escudo (6 lados)
    const shR = 40
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6 + time * 0.8
      i === 0 ? ctx.moveTo(Math.cos(a) * shR, Math.sin(a) * shR)
               : ctx.lineTo(Math.cos(a) * shR, Math.sin(a) * shR)
    }
    ctx.closePath()
    const shieldColor = shieldPct > 0.5 ? "#4488ff" : shieldPct > 0.25 ? "#88aaff" : "#ff8844"
    ctx.strokeStyle = shieldColor; ctx.lineWidth = 3
    ctx.shadowColor = shieldColor; ctx.shadowBlur = 16
    ctx.stroke()
    ctx.fillStyle = `rgba(68,136,255,${pulse * 0.08 * shieldPct})`
    ctx.fill()
    ctx.shadowBlur = 0
  }

    drawShipShape(ctx, ship)

  // Indicador de recarga sobre la nave
  if (!shieldActive && shieldCooldown > 0) {
    const cdPct = 1 - shieldCooldown / shieldCdMax
    ctx.strokeStyle = "rgba(100,160,255,0.5)"; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + cdPct * Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawEnemyShip(ctx: CanvasRenderingContext2D, e: Enemy) {
  const alpha = e.type === "stealth" ? (e.visible ? 1 : 0.15) : 1
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(e.x, e.y)

  if (e.type === "scout") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 14); ctx.lineTo(14, -14); ctx.lineTo(0, -8); ctx.lineTo(-14, -14)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "grunt") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 17); ctx.lineTo(18, 8); ctx.lineTo(18, -8); ctx.lineTo(0, -17); ctx.lineTo(-18, -8); ctx.lineTo(-18, 8)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "tank") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.roundRect(-26, -24, 52, 48, 4)
    ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 3; ctx.stroke()
    // Cannons
    ctx.fillStyle = "#333"
    ctx.fillRect(-20, 18, 10, 14); ctx.fillRect(10, 18, 10, 14)
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "stealth") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 16); ctx.lineTo(17, 2); ctx.lineTo(12, -16); ctx.lineTo(-12, -16); ctx.lineTo(-17, 2)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 1.5; ctx.stroke()
  } else if (e.type === "shooter") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, -18); ctx.lineTo(18, 0); ctx.lineTo(0, 18); ctx.lineTo(-18, 0)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2, false); ctx.stroke()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 5, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "kamikaze") {
    // Punta de flecha agresiva apuntando abajo
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 16); ctx.lineTo(15, -12); ctx.lineTo(6, -6); ctx.lineTo(0, -14)
    ctx.lineTo(-6, -6); ctx.lineTo(-15, -12)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 1.5; ctx.stroke()
    // Núcleo pulsante
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.arc(0, 2, 3, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "splitter") {
    // Célula que se divide: dos lóbulos
    ctx.fillStyle = e.color
    ctx.beginPath(); ctx.arc(-8, 0, 13, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(8, 0, 13, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(-8, 0, 13, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(8, 0, 13, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.arc(-8, 0, 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "mini") {
    ctx.fillStyle = e.color
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill()
  }

  // Hit-flash blanco (encima del sprite)
  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = "source-atop"
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, e.hitFlash * 12)})`
    ctx.fillRect(-e.w, -e.h, e.w * 2, e.h * 2)
    ctx.globalCompositeOperation = "source-over"
  }

  // HP bar (below ship)
  if (e.hp < e.maxHp && e.type !== "mini") {
    const pct = Math.max(0, e.hp / e.maxHp)
    const bw = e.w + 8, bh = 4, bx = -bw / 2, by = e.h / 2 + 4
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx, by, bw, bh)
    ctx.fillStyle = pct > 0.5 ? "#44ff44" : pct > 0.25 ? "#ffaa00" : "#ff3300"
    ctx.fillRect(bx, by, bw * pct, bh)
  }
  ctx.restore()
}

function drawBossShip(ctx: CanvasRenderingContext2D, boss: Boss, time: number) {
  if (!boss.alive) return
  ctx.save()
  ctx.translate(boss.x, boss.y)
  const pulse = 0.94 + Math.sin(time * 3) * 0.06

  // Shield
  if (boss.shieldActive) {
    ctx.strokeStyle = "#44aaff"; ctx.lineWidth = 3; ctx.globalAlpha = 0.6 + Math.sin(time * 5) * 0.2
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Outer ring
  ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.5
  ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 1

  // Main body
  const bg = ctx.createRadialGradient(0, 0, 10, 0, 0, 46)
  bg.addColorStop(0, boss.accent)
  bg.addColorStop(0.5, boss.color)
  bg.addColorStop(1, "#110000")
  ctx.fillStyle = bg

  if (boss.worldId === 0) {
    // Centinela: angular heavy cruiser
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    ctx.moveTo(0, -42); ctx.lineTo(38, -20); ctx.lineTo(44, 10); ctx.lineTo(28, 42)
    ctx.lineTo(-28, 42); ctx.lineTo(-44, 10); ctx.lineTo(-38, -20)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 1) {
    // Espectro: teardrop/ghost
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    ctx.moveTo(0, -40); ctx.bezierCurveTo(38, -40, 42, 10, 32, 40)
    ctx.lineTo(-32, 40); ctx.bezierCurveTo(-42, 10, -38, -40, 0, -40)
    ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 2) {
    // Reina enjambre: organic
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.ellipse(20, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = bg
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 3) {
    // Devorador: black hole style
    const rings = 4
    for (let i = rings; i >= 1; i--) {
      const r = i * 12
      const alpha = 0.2 + (rings - i) / rings * 0.6
      ctx.globalAlpha = alpha
      ctx.fillStyle = i % 2 === 0 ? boss.color : "#000020"
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, i * 14, 0, Math.PI * 2); ctx.stroke()
    }
  } else if (boss.worldId === 4) {
    // Emperador: ornate crown shape
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    ctx.moveTo(0, -44); ctx.lineTo(20, -28); ctx.lineTo(40, -38); ctx.lineTo(44, -8)
    ctx.lineTo(40, 20); ctx.lineTo(20, 42); ctx.lineTo(-20, 42)
    ctx.lineTo(-40, 20); ctx.lineTo(-44, -8); ctx.lineTo(-40, -38)
    ctx.lineTo(-20, -28)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    ctx.restore()
    // Crown spikes
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 14, -42); ctx.lineTo(i * 10, -62); ctx.stroke()
    }
  } else if (boss.worldId === 5) {
    // Reina del Hielo: cristal hexagonal
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      if (i === 0) ctx.moveTo(Math.cos(a) * 42, Math.sin(a) * 42)
      else ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42)
    }
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    // Copos: líneas radiales
    ctx.strokeStyle = boss.accent; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20)
      ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    // Cristal interior
    ctx.fillStyle = boss.color
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      if (i === 0) ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 26)
      else ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26)
    }
    ctx.closePath(); ctx.fill()
    ctx.restore()
  } else if (boss.worldId === 6) {
    // Coloso de Magma: núcleo envuelto en placas
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i / 8) * Math.PI * 2 + boss.attackIdx)
      ctx.fillStyle = i % 2 === 0 ? boss.color : "#330a00"
      ctx.beginPath(); ctx.ellipse(30, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
    }
    // Núcleo en fusión
    const lava = ctx.createRadialGradient(0, 0, 0, 0, 0, 22)
    lava.addColorStop(0, "#fff2cc")
    lava.addColorStop(0.5, "#ffaa00")
    lava.addColorStop(1, boss.color)
    ctx.fillStyle = lava
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 7) {
    // Null: obsidiana con púas angulares
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30)
      ctx.lineTo(Math.cos(a) * 52, Math.sin(a) * 52)
      ctx.stroke()
    }
    ctx.fillStyle = boss.color
    ctx.beginPath()
    ctx.moveTo(0, -38); ctx.lineTo(20, -22); ctx.lineTo(38, -8); ctx.lineTo(28, 16)
    ctx.lineTo(16, 38); ctx.lineTo(0, 26); ctx.lineTo(-16, 38); ctx.lineTo(-28, 16)
    ctx.lineTo(-38, -8); ctx.lineTo(-20, -22)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 8) {
    // Madre Maleza: flor carnívora orgánica
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i / 8) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.ellipse(30, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
    }
    // Pedúnculo y boca
    ctx.strokeStyle = "#3a6a2a"; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(0, -10); ctx.stroke()
    ctx.fillStyle = "#66ff88"
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(20, -8); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.lineTo(-20, -8)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 9) {
    // Leviatán: serpiente acorazada
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(0, 16 + i * 8)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.ellipse(0, 0, 34 - i * 6, 12 - i * 2, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
    }
    // Cabeza y aletas
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(16, -8); ctx.lineTo(0, 14); ctx.lineTo(-16, -8)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = boss.accent
      ctx.beginPath(); ctx.moveTo(s * 12, -6); ctx.lineTo(s * 30, 6); ctx.lineTo(s * 12, 18); ctx.closePath(); ctx.fill()
    }
    ctx.restore()
  } else if (boss.worldId === 10) {
    // Inquisidor: arco gótico de juicio
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.fillStyle = boss.color
    ctx.beginPath()
    ctx.moveTo(-30, 40); ctx.lineTo(-30, 0); ctx.lineTo(-42, -18)
    ctx.lineTo(-30, -22); ctx.lineTo(-16, -40); ctx.lineTo(0, -48)
    ctx.lineTo(16, -40); ctx.lineTo(30, -22); ctx.lineTo(42, -18)
    ctx.lineTo(30, 0); ctx.lineTo(30, 40)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    // Vidrieras
    ctx.fillStyle = boss.accent
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(10, -16); ctx.lineTo(0, 0); ctx.lineTo(-10, -16); ctx.closePath(); ctx.fill()
    // Campanas
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = "#ffcc44"
      ctx.beginPath(); ctx.arc(s * 22, 26, 7, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  } else if (boss.worldId === 11) {
    // Cosechadora: estrella giratoria de cuchillas
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.rotate(boss.attackIdx * 0.3)
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(14, -10); ctx.lineTo(0, 8); ctx.lineTo(-14, -10)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = boss.accent
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  } else if (boss.worldId === 12) {
    // Obispo: cúpula de catedral con halo
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-38, -4); ctx.lineTo(-20, -30); ctx.lineTo(-20, -44)
    ctx.lineTo(-8, -34); ctx.lineTo(0, -52); ctx.lineTo(8, -34); ctx.lineTo(20, -44)
    ctx.lineTo(20, -30); ctx.lineTo(38, -4); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Ventanas del rosetón
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.fillStyle = boss.accent
      ctx.beginPath(); ctx.arc(Math.cos(a) * 24, Math.sin(a) * 24, 3.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  } else if (boss.worldId === 13) {
    // Titán Verde: golem apilado angular
    ctx.save(); ctx.scale(pulse, pulse)
    // Hombros
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.roundRect(-44, -18, 30, 30, 6); ctx.fill()
    ctx.beginPath(); ctx.roundRect(14, -18, 30, 30, 6); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Torso
    ctx.beginPath(); ctx.roundRect(-20, -34, 40, 48, 6); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Cabeza
    ctx.beginPath(); ctx.roundRect(-14, -52, 28, 22, 5); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Ojos de núcleo
    ctx.fillStyle = "#55ff88"
    ctx.beginPath(); ctx.arc(-6, -42, 3.5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(6, -42, 3.5, 0, Math.PI * 2); ctx.fill()
    // Brazos cañón
    ctx.fillStyle = boss.color
    ctx.fillRect(-40, -14, 8, 30); ctx.fillRect(32, -14, 8, 30)
    ctx.restore()
  } else if (boss.worldId === 14) {
    // Vanguardia: plataforma de batalla en punta de flecha
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(40, -14); ctx.lineTo(46, 26)
    ctx.lineTo(26, 42); ctx.lineTo(0, 30); ctx.lineTo(-26, 42); ctx.lineTo(-46, 26)
    ctx.lineTo(-40, -14)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2.5; ctx.stroke()
    // Torretas
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = boss.accent
      ctx.beginPath(); ctx.roundRect(s * 26 - 6, 10, 12, 22, 4); ctx.fill()
    }
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.ellipse(0, 8, 8, 14, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  } else {
    // Amarok: núcleo final con anillos orbitales
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.rotate(boss.attackIdx * 0.15)
    // Anillos orbitales
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke()
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.arc(44, 0, 5, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    // Núcleo facetado
    ctx.fillStyle = boss.color
    ctx.beginPath()
    ctx.moveTo(0, -32); ctx.lineTo(22, -20); ctx.lineTo(32, 0); ctx.lineTo(22, 20)
    ctx.lineTo(0, 32); ctx.lineTo(-22, 20); ctx.lineTo(-32, 0); ctx.lineTo(-22, -20)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    // Corazón de oro
    ctx.fillStyle = "#ffee66"
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // Core glow
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 18)
  core.addColorStop(0, "#ffffff")
  core.addColorStop(0.4, boss.accent)
  core.addColorStop(1, "transparent")
  ctx.fillStyle = core
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill()

  // Hit-flash blanco
  if (boss.hitFlash > 0) {
    ctx.globalAlpha = Math.min(0.75, boss.hitFlash * 12)
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  ctx.save()
  if (b.fromPlayer) {
    const color = AMMO_COLORS[b.ammo]
    if (b.ammo === "laser") {
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.shadowColor = color; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 28); ctx.stroke()
    } else if (b.ammo === "missile") {
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 12); ctx.lineTo(b.x - 5, b.y + 8); ctx.lineTo(b.x + 5, b.y + 8); ctx.closePath(); ctx.fill()
      // Exhaust
      ctx.fillStyle = "#ff8800"; ctx.globalAlpha = 0.6
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 14, 4, 6, 0, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.ellipse(b.x, b.y, b.radius * 0.7, b.radius, 0, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    ctx.fillStyle = "#ff4444"; ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 6
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.85, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function isPowerup(k: DropKind): k is PowerupKind {
  return k === "magnet" || k === "overdrive" || k === "bomb"
}

function drawDrop(ctx: CanvasRenderingContext2D, d: Drop, time: number) {
  const bob = Math.sin(d.bobT + time * 3) * 4
  const powerup = isPowerup(d.kind)
  const color = isPowerup(d.kind) ? POWERUP_COLORS[d.kind] : AMMO_COLORS[d.kind]
  const icon = isPowerup(d.kind) ? POWERUP_ICONS[d.kind] : AMMO_ICONS[d.kind]
  ctx.save()
  ctx.translate(d.x, d.y + bob)
  ctx.shadowColor = color; ctx.shadowBlur = 14
  // Power-ups: anillo doble giratorio para destacar
  if (powerup) {
    ctx.rotate(time * 2)
    ctx.strokeStyle = color; ctx.lineWidth = 2.5
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11)
      ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16)
      ctx.stroke()
    }
    ctx.rotate(-time * 2)
  }
  // Outer ring
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke()
  // Inner fill
  ctx.fillStyle = color + "44"
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill()
  // Icon
  ctx.fillStyle = color; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(icon, 0, 0)
  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D, gs: GS) {
  const world = WORLDS[gs.worldId]
  // Base
  ctx.fillStyle = world.bgColor
  ctx.fillRect(0, 0, W, H)
  // Nebula clouds
  const nebulaGrad = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, H * 0.6)
  nebulaGrad.addColorStop(0, world.nebula + "55")
  nebulaGrad.addColorStop(0.5, world.nebula + "22")
  nebulaGrad.addColorStop(1, "transparent")
  ctx.fillStyle = nebulaGrad
  ctx.fillRect(0, 0, W, H)
  const nebulaGrad2 = ctx.createRadialGradient(W * 0.7, H * 0.7, 0, W * 0.7, H * 0.7, H * 0.5)
  nebulaGrad2.addColorStop(0, world.nebula + "33")
  nebulaGrad2.addColorStop(1, "transparent")
  ctx.fillStyle = nebulaGrad2
  ctx.fillRect(0, 0, W, H)
}

function drawStars(ctx: CanvasRenderingContext2D, gs: GS) {
  const streak = gs.phase === "boss"   // durante el jefe, la capa cercana se estira
  for (const s of gs.stars) {
    if (s.layer === 2) {
      // Capa cercana: leve tinte del mundo y posible streak
      const world = WORLDS[Math.min(gs.worldId, WORLDS.length - 1)]
      ctx.strokeStyle = `rgba(255,255,255,${s.bright})`
      if (streak) {
        ctx.lineWidth = s.r
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.spd * 0.06); ctx.stroke()
      } else {
        ctx.fillStyle = `rgba(255,255,255,${s.bright})`
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
      }
      // Punto de acento tenue
      ctx.fillStyle = world.accent + "22"
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.6, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = `rgba(255,255,255,${s.bright})`
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
    }
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, gs: GS) {
  const world = WORLDS[gs.worldId]
  // Bottom HUD panel
  const hudY = H - HUD_H
  const panelGrad = ctx.createLinearGradient(0, hudY, 0, H)
  panelGrad.addColorStop(0, "rgba(0,0,0,0)")
  panelGrad.addColorStop(0.1, "rgba(0,0,12,0.92)")
  panelGrad.addColorStop(1, "rgba(0,0,20,0.98)")
  ctx.fillStyle = panelGrad; ctx.fillRect(0, hudY, W, HUD_H)

  // HP bar
  const hpPct = Math.max(0, gs.playerHP / gs.playerMaxHP)
  const hpW = W - 160, hpX = 14, hpY = hudY + 10, hpH = 14
  ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(hpX, hpY, hpW, hpH)
  const hpColor = hpPct > 0.5 ? "#22ff44" : hpPct > 0.25 ? "#ffaa00" : "#ff3300"
  ctx.fillStyle = hpColor
  ctx.fillRect(hpX, hpY, hpW * hpPct, hpH)
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1
  ctx.strokeRect(hpX, hpY, hpW, hpH)
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText(`HP ${Math.ceil(gs.playerHP)}`, hpX + 4, hpY + hpH / 2)
  ctx.fillStyle = "#aaaaaa"; ctx.textAlign = "right"
  ctx.fillText(`${gs.score.toLocaleString()}`, W - 14, hpY + hpH / 2)

  // Ammo buttons (izquierda) + Escudo (derecha)
  const ammos: AmmoType[] = ["basic", "laser", "spread", "missile"]
  const shieldBtnW = 90, gap = 6
  const ammoArea = W - 20 - shieldBtnW - gap
  const btnW = (ammoArea - (ammos.length - 1) * 4) / ammos.length
  const btnH = 42, btnY = hudY + 30
  gs.ammoBtns = []

  for (let i = 0; i < ammos.length; i++) {
    const ammo = ammos[i]
    const btnX = 10 + i * (btnW + 4)
    const isActive = gs.activeAmmo === ammo
    const count = gs.ammo[ammo]
    const hasAmmo = count === -1 || count > 0
    const color = AMMO_COLORS[ammo]

    gs.ammoBtns.push({ ammo, x: btnX, y: btnY, w: btnW, h: btnH })

    ctx.fillStyle = isActive ? color + "33" : "rgba(255,255,255,0.05)"
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill()
    if (isActive) {
      ctx.strokeStyle = color; ctx.lineWidth = 2
      ctx.shadowColor = color; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.stroke()
      ctx.shadowBlur = 0
    }
    if (!hasAmmo && ammo !== "basic") {
      ctx.fillStyle = "rgba(0,0,0,0.5)"
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill()
    }

    ctx.fillStyle = hasAmmo ? color : "#444"
    ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(AMMO_ICONS[ammo], btnX + btnW / 2, btnY + 13)
    ctx.font = "bold 10px monospace"
    ctx.fillStyle = hasAmmo ? "#ffffff" : "#555"
    ctx.fillText(count === -1 ? "∞" : String(count), btnX + btnW / 2, btnY + 30)
  }

  // Botón de escudo
  const sBtnX = W - 10 - shieldBtnW, sBtnY = btnY
  gs.shieldBtn = { x: sBtnX, y: sBtnY, w: shieldBtnW, h: btnH }
  const shReady = !gs.shieldActive && gs.shieldCooldown <= 0
  const shColor = gs.shieldActive ? "#66bbff"
                : shReady         ? "#4488ff"
                :                   "#334466"
  // Fondo del botón
  ctx.fillStyle = gs.shieldActive ? "#4488ff22" : shReady ? "#4488ff15" : "rgba(20,30,60,0.5)"
  ctx.beginPath(); ctx.roundRect(sBtnX, sBtnY, shieldBtnW, btnH, 6); ctx.fill()
  ctx.strokeStyle = shColor; ctx.lineWidth = gs.shieldActive ? 2.5 : 1.5
  if (gs.shieldActive) { ctx.shadowColor = "#4488ff"; ctx.shadowBlur = 12 }
  ctx.beginPath(); ctx.roundRect(sBtnX, sBtnY, shieldBtnW, btnH, 6); ctx.stroke()
  ctx.shadowBlur = 0
  // Arco de recarga
  if (!gs.shieldActive && gs.shieldCooldown > 0) {
    const cdPct = 1 - gs.shieldCooldown / gs.shieldCdMax
    ctx.strokeStyle = "#4466aa"; ctx.lineWidth = 3
    const cx2 = sBtnX + shieldBtnW / 2, cy2 = sBtnY + btnH / 2
    ctx.beginPath(); ctx.arc(cx2, cy2, 16, -Math.PI / 2, -Math.PI / 2 + cdPct * Math.PI * 2); ctx.stroke()
    ctx.fillStyle = "#556688"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(`${Math.ceil(gs.shieldCooldown)}s`, cx2, cy2 + 1)
  } else {
    // HP bar del escudo dentro del botón
    if (gs.shieldActive) {
      const shPct = gs.shieldHP / gs.shieldMaxHP
      ctx.fillStyle = "#113366"; ctx.fillRect(sBtnX + 6, sBtnY + btnH - 10, shieldBtnW - 12, 5)
      ctx.fillStyle = shPct > 0.5 ? "#44aaff" : shPct > 0.25 ? "#aaddff" : "#ff8844"
      ctx.fillRect(sBtnX + 6, sBtnY + btnH - 10, (shieldBtnW - 12) * shPct, 5)
    }
    // Ícono del escudo
    ctx.fillStyle = shColor; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("🛡", sBtnX + shieldBtnW / 2, sBtnY + (gs.shieldActive ? 14 : 17))
    ctx.fillStyle = shReady ? "#aaccff" : gs.shieldActive ? "#ffffff" : "#445566"
    ctx.font = "bold 9px monospace"
    ctx.fillText(gs.shieldActive ? `${Math.ceil(gs.shieldDuration)}s` : "ESCUDO", sBtnX + shieldBtnW / 2, sBtnY + (gs.shieldActive ? 30 : 31))
  }

  // Top HUD
  const topH = 36
  const topGrad = ctx.createLinearGradient(0, 0, 0, topH + 10)
  topGrad.addColorStop(0, "rgba(0,0,20,0.95)"); topGrad.addColorStop(1, "transparent")
  ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, topH + 10)
  ctx.fillStyle = world.accent; ctx.font = "bold 13px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText(gs.isEndless ? "ENDLESS" : `MUNDO ${gs.worldId + 1}`, 14, 18)
  if (gs.isEndless) {
    ctx.fillStyle = "#aaaaaa"; ctx.textAlign = "center"; ctx.font = "bold 13px monospace"
    ctx.fillText(gs.phase === "boss" ? "¡MINI-JEFE!" : `OLEADA ${gs.endlessWave}`, W / 2, 18)
  } else if (gs.phase === "playing") {
    const wdef = WORLDS[gs.worldId]
    ctx.fillStyle = "#aaaaaa"; ctx.textAlign = "center"
    ctx.fillText(`OLEADA ${gs.wave + 1}/${wdef.waves.length}`, W / 2, 18)
  } else if (gs.phase === "boss") {
    ctx.fillStyle = "#ff4444"; ctx.textAlign = "center"; ctx.font = "bold 13px monospace"
    ctx.fillText("¡JEFE!", W / 2, 18)
  }

  // Combo (esquina derecha superior, debajo del mute)
  if (gs.combo >= 2) {
    const cpulse = 1 + Math.sin(Date.now() / 90) * 0.08
    const cy = 46
    ctx.save()
    ctx.translate(W - 62, cy); ctx.scale(cpulse, cpulse)
    ctx.fillStyle = gs.combo >= 6 ? "#ff4488" : gs.combo >= 4 ? "#ffcc44" : "#ffffff"
    ctx.font = "bold 20px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.shadowColor = ctx.fillStyle as string; ctx.shadowBlur = 8
    ctx.fillText(`x${gs.combo}`, 0, 0)
    ctx.restore()
    // Barra de tiempo del combo
    ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(W - 92, cy + 14, 60, 3)
    ctx.fillStyle = gs.combo >= 6 ? "#ff4488" : "#ffcc44"
    ctx.fillRect(W - 92, cy + 14, 60 * Math.max(0, gs.comboTimer / COMBO_TIMEOUT), 3)
  }

  // Power-ups activos (izquierda, sobre el HUD)
  let puY = H - HUD_H - 16
  if (gs.overdriveT > 0) {
    ctx.fillStyle = "#ff44ff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
    ctx.fillText(`⚡ ${gs.overdriveT.toFixed(1)}s`, 14, puY); puY -= 16
  }
  if (gs.magnetT > 0) {
    ctx.fillStyle = "#00ff88"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
    ctx.fillText(`🧲 ${gs.magnetT.toFixed(1)}s`, 14, puY)
  }

  // Boss HP bar at top
  if (gs.phase === "boss" && gs.boss?.alive) {
    const bpct = Math.max(0, gs.boss.hp / gs.boss.maxHp)
    const bw = W - 28, bh = 12, bx = 14, by = 26
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(bx, by, bw, bh)
    const bc = bpct > 0.5 ? "#ff5500" : bpct > 0.25 ? "#ff8800" : "#ff0000"
    ctx.fillStyle = bc; ctx.fillRect(bx, by, bw * bpct, bh)
    ctx.strokeStyle = bc + "99"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh)
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(WORLDS[gs.worldId].bossName.toUpperCase(), bx + bw / 2, by + bh / 2)
  }

  // Gravity pulse indicator
  if (gs.phase === "boss" && gs.boss?.gravPulseActive) {
    ctx.fillStyle = "rgba(0,100,255,0.2)"
    ctx.fillRect(0, HUD_H + 36, W, H - HUD_H - 36 - HUD_H)
    ctx.strokeStyle = "#4488ff"; ctx.lineWidth = 2
    ctx.strokeRect(4, 40, W - 8, H - 80)
    ctx.fillStyle = "#4488ff"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"
    ctx.fillText("⚠ CAMPO GRAVITACIONAL ACTIVO ⚠", W / 2, 58)
  }

  // Flash message
  if (gs.flashT > 0) {
    const alpha = Math.min(1, gs.flashT * 2)
    ctx.fillStyle = `rgba(255,255,100,${alpha})`
    ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(gs.flashMsg, W / 2, H / 2 - 40)
  }
}

/* ════════════════════════════════════════════════════════════════════
   DRAW PHASES
   ════════════════════════════════════════════════════════════════════ */
function drawIntro(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  // Dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, W, H)
  // Title
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 52px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 30
  ctx.fillText("STAR", W / 2, H / 2 - 150)
  ctx.fillStyle = "#00e5ff"
  ctx.fillText("ASSAULT", W / 2, H / 2 - 92)
  ctx.shadowBlur = 0
  ctx.fillStyle = "#aaaaaa"; ctx.font = "13px monospace"
  ctx.fillText(`${WORLDS.length} mundos · combos · power-ups · jefes épicos`, W / 2, H / 2 - 44)

  // Monedas
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 16px monospace"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()}`, W / 2, H / 2 - 14)

  gs.introBtns = []
  const pulse = 0.96 + Math.sin(time * 2.5) * 0.04
  const mkBtn = (label: string, action: string, cy: number, color: string, textColor: string) => {
    const bw = 220, bh = 46, bx = W / 2 - bw / 2, by = cy - bh / 2
    gs.introBtns.push({ action, x: bx, y: by, w: bw, h: bh })
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pulse, pulse)
    ctx.fillStyle = color
    ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 10); ctx.fill()
    ctx.fillStyle = textColor; ctx.font = "bold 17px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(label, 0, 0)
    ctx.restore()
  }
  mkBtn("▶  CAMPAÑA", "campaign", H / 2 + 20, "#00e5ff", "#001020")
  mkBtn("♾  ENDLESS", "endless", H / 2 + 78, "#ff44aa", "#20000f")
  mkBtn("🔧  HANGAR", "hangar", H / 2 + 136, "#ffcc44", "#201400")
  mkBtn("🚀  NAVES", "ships", H / 2 + 194, "#44ff88", "#001405")

  // Récord endless
  if (gs.save.endlessBest > 0) {
    ctx.fillStyle = "#ff88bb"; ctx.font = "11px monospace"; ctx.textAlign = "center"
    ctx.fillText(`Mejor oleada endless: ${gs.save.endlessBest}`, W / 2, H / 2 + 250)
  }

  // Credits
  ctx.fillStyle = "#555555"; ctx.font = "11px monospace"; ctx.textAlign = "center"
  ctx.fillText("Desliza para mover · Disparo automático · 🛡 escudo", W / 2, H - 40)
}

/* Pantalla de HANGAR — mejoras permanentes de nave */
interface UpgradeDef { key: keyof ShipUpgrades; name: string; desc: string; max: number; cost: (lvl: number) => number }
const UPGRADE_DEFS: UpgradeDef[] = [
  { key: "hp",        name: "Blindaje",    desc: "+20 HP máximo",         max: 3, cost: l => 200 + l * 150 },
  { key: "shieldDur", name: "Escudo+",     desc: "+1s de escudo",         max: 3, cost: l => 250 + l * 150 },
  { key: "shieldCd",  name: "Recarga",     desc: "-1s recarga escudo",    max: 3, cost: l => 250 + l * 150 },
  { key: "fireRate",  name: "Cadencia",    desc: "-8% tiempo de disparo", max: 3, cost: l => 300 + l * 200 },
  { key: "magnet",    name: "Imán perm.",  desc: "Atrae drops siempre",   max: 1, cost: () => 600 },
]

function drawHangar(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("🔧 HANGAR", W / 2, 28)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 16px monospace"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()} monedas`, W / 2, 62)

  gs.hangarBtns = []
  const cardH = 96, cardW = W - 40, cx = 20
  for (let i = 0; i < UPGRADE_DEFS.length; i++) {
    const def = UPGRADE_DEFS[i]
    const lvl = gs.save.upgrades[def.key]
    const maxed = lvl >= def.max
    const cost = def.cost(lvl)
    const afford = gs.save.coins >= cost
    const cy = 96 + i * (cardH + 8)
    gs.hangarBtns.push({ key: def.key, x: cx, y: cy, w: cardW, h: cardH })

    // Card
    ctx.fillStyle = maxed ? "#1a2a1a" : afford ? "#ffcc4422" : "#1a1a22"
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.fill()
    ctx.strokeStyle = maxed ? "#44ff88" : afford ? "#ffcc4488" : "#333"; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke()

    // Nombre + desc
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 17px monospace"
    ctx.fillText(def.name, cx + 16, cy + 14)
    ctx.fillStyle = "#aaaaaa"; ctx.font = "12px monospace"
    ctx.fillText(def.desc, cx + 16, cy + 38)

    // Nivel (pips)
    for (let p = 0; p < def.max; p++) {
      ctx.fillStyle = p < lvl ? "#44ff88" : "#444"
      ctx.beginPath(); ctx.arc(cx + 20 + p * 16, cy + 68, 5, 0, Math.PI * 2); ctx.fill()
    }

    // Botón de costo / estado
    ctx.textAlign = "right"; ctx.textBaseline = "middle"
    if (maxed) {
      ctx.fillStyle = "#44ff88"; ctx.font = "bold 14px monospace"
      ctx.fillText("MÁX ✓", cx + cardW - 16, cy + cardH / 2)
    } else {
      const pulse = afford ? 1 + Math.sin(time * 4 + i) * 0.05 : 1
      ctx.save(); ctx.translate(cx + cardW - 58, cy + cardH / 2); ctx.scale(pulse, pulse)
      ctx.fillStyle = afford ? "#ffcc44" : "#443311"
      ctx.beginPath(); ctx.roundRect(-52, -18, 104, 36, 8); ctx.fill()
      ctx.fillStyle = afford ? "#201400" : "#776644"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"
      ctx.fillText(`🪙 ${cost}`, 0, 0)
      ctx.restore()
    }
  }

  // Volver
  ctx.fillStyle = "#888"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
  ctx.fillText("← Volver al menú", W / 2, H - 18)
}

/* Pantalla de TIENDA DE NAVES — comprar y equipar naves */
function drawShipStore(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#44ff88"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("🚀 TIENDA DE NAVES", W / 2, 26)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 16px monospace"
  ctx.fillText(`🪙 ${gs.save.coins.toLocaleString()} monedas`, W / 2, 60)

  gs.shipBtns = []
  const cardH = 100, cardW = W - 40, cx = 20
  for (let i = 0; i < SHIP_DEFS.length; i++) {
    const ship = SHIP_DEFS[i]
    const owned = gs.save.shipsOwned.includes(ship.id)
    const equipped = gs.save.shipId === ship.id
    const afford = gs.save.coins >= ship.price
    const cy = 92 + i * (cardH + 6)
    gs.shipBtns.push({ shipId: ship.id, x: cx, y: cy, w: cardW, h: cardH })

    // Card
    ctx.fillStyle = equipped ? "#22ff8833" : owned ? "#222a22" : afford ? "#44ff8833" : "#1a1a22"
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.fill()
    ctx.strokeStyle = equipped ? "#44ff88" : owned ? "#2a5a3a" : afford ? "#44ff8866" : "#333"; ctx.lineWidth = equipped ? 2.5 : 1.5
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke()

    // Vista previa de la nave
    ctx.save()
    ctx.translate(cx + 52, cy + cardH / 2)
    ctx.scale(1.5, 1.5)
    ctx.globalAlpha = owned ? 1 : 0.35
  drawShipShape(ctx, ship)
    ctx.restore()

    // Nombre + desc
    ctx.textAlign = "left"; ctx.textBaseline = "top"
    ctx.fillStyle = owned ? "#ffffff" : "#cccccc"; ctx.font = "bold 16px monospace"
    ctx.fillText(ship.name, cx + 92, cy + 12)
    ctx.fillStyle = "#999999"; ctx.font = "11px monospace"
    ctx.fillText(ship.desc, cx + 92, cy + 32)
    // Stats
    ctx.fillStyle = "#88cc88"; ctx.font = "bold 10px monospace"
    const parts: string[] = []
    if (ship.speedMult !== 1) parts.push(`VEL ${ship.speedMult.toFixed(2)}x`)
    if (ship.hpMult !== 1) parts.push(`HP ${ship.hpMult.toFixed(2)}x`)
    if (ship.fireMult !== 1) parts.push(`CAD ${ship.fireMult.toFixed(2)}x`)
    if (ship.passive?.magnet) parts.push("🧲 IMÁN")
    ctx.fillText(parts.join("  "), cx + 92, cy + 52)

    // Botón derecho: comprar / equipar / equipada
    const btnW = 92, btnH = 40
    const btnX = cx + cardW - btnW - 12, btnY = cy + cardH - btnH - 10
    ctx.save()
    if (equipped) {
      ctx.fillStyle = "#44ff88"
      ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("✓ EQUIPADA", btnX + btnW / 2, btnY + btnH / 2)
    } else if (owned) {
      const pulse = 0.92 + Math.sin(time * 4 + i) * 0.08
      ctx.translate(btnX + btnW / 2, btnY + btnH / 2); ctx.scale(pulse, pulse)
      ctx.fillStyle = "#44ff88"
      ctx.beginPath(); ctx.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8); ctx.fill()
      ctx.fillStyle = "#001405"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("EQUIPAR", 0, 0)
    } else {
      const pulse = afford ? 0.92 + Math.sin(time * 4 + i) * 0.08 : 1
      ctx.translate(btnX + btnW / 2, btnY + btnH / 2); ctx.scale(pulse, pulse)
      ctx.fillStyle = afford ? "#44ff88" : "#223322"
      ctx.beginPath(); ctx.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 8); ctx.fill()
      ctx.fillStyle = afford ? "#001405" : "#667766"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(`🪙 ${ship.price}`, 0, 0)
    }
    ctx.restore()
  }
  // Volver
  ctx.fillStyle = "#888"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
  ctx.fillText("← Volver al menú", W / 2, H - 18)
}

function worldMaxScroll(): number {
  const bh = 96, gap = 10
  const listTop = 88, listBottom = H - 40
  const totalH = WORLDS.length * (bh + gap) - gap
  return Math.max(0, listTop + totalH - listBottom)
}

function drawWorldSelect(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("SELECCIONAR MUNDO", W / 2, 30)
  ctx.fillStyle = "#555"; ctx.font = "12px monospace"
  ctx.fillText(`Mundos conquistados: ${gs.save.worldsCleared}/${WORLDS.length}`, W / 2, 66)

  // Lista desplazable
  gs.worldBtns = []
  const bh = 96, bw = W - 40, bx = 20
  const listTop = 88, listBottom = H - 40
  const maxScroll = worldMaxScroll()
  gs.worldScroll = Math.max(0, Math.min(gs.worldScroll, maxScroll))

  for (let i = 0; i < WORLDS.length; i++) {
    const world = WORLDS[i]
    const unlocked = i === 0 || i <= gs.save.worldsCleared
    const by = listTop + i * (bh + 10) - gs.worldScroll
    gs.worldBtns.push({ worldId: i, x: bx, y: by, w: bw, h: bh })

    // Card bg
    ctx.fillStyle = unlocked ? world.accent + "33" : "#111111"
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill()
    if (unlocked) {
      ctx.strokeStyle = world.accent + "88"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.stroke()
    }
    // Lock
    if (!unlocked) {
      ctx.fillStyle = "#333"; ctx.font = "28px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("🔒", bx + bw / 2, by + bh / 2)
      ctx.fillStyle = "#444"; ctx.font = "12px monospace"
      ctx.fillText("Conquista el mundo anterior", bx + bw / 2, by + bh / 2 + 26)
      continue
    }
    // World info
    ctx.textAlign = "left"
    ctx.fillStyle = world.accent; ctx.font = "bold 18px monospace"; ctx.textBaseline = "top"
    ctx.fillText(`${i + 1}. ${world.name}`, bx + 16, by + 14)
    ctx.fillStyle = "#aaaaaa"; ctx.font = "12px monospace"
    ctx.fillText(world.subtitle, bx + 16, by + 38)
    // Boss name
    ctx.fillStyle = "#666"; ctx.font = "11px monospace"
    ctx.fillText(`Jefe: ${world.bossName}`, bx + 16, by + 56)
    // High score
    const hs = gs.save.highScores[i] ?? 0
    if (hs > 0) {
      ctx.fillStyle = "#ffcc44"; ctx.font = "bold 11px monospace"; ctx.textAlign = "right"
      ctx.fillText(`★ ${hs.toLocaleString()}`, bx + bw - 16, by + 14)
    }
    // Cleared badge
    if (i < gs.save.worldsCleared) {
      ctx.fillStyle = "#22ff88"; ctx.font = "bold 12px monospace"; ctx.textAlign = "right"
      ctx.fillText("✓ CONQUISTADO", bx + bw - 16, by + 56)
    }
    // Play chevron
    const pulse = 0.9 + Math.sin(time * 3 + i) * 0.1
    ctx.fillStyle = world.accent + "cc"; ctx.textAlign = "right"; ctx.font = `bold ${20 * pulse}px monospace`; ctx.textBaseline = "middle"
    ctx.fillText("▶", bx + bw - 12, by + bh / 2)
  }
  // Indicador de scroll
  if (maxScroll > 0) {
    ctx.fillStyle = "#666"; ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("⌄ Desliza para ver más ⌄", W / 2, listBottom + 9)
  }
  // Back
  ctx.fillStyle = "#555555"; ctx.font = "13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
  ctx.fillText("← Atrás", W / 2, H - 20)
}

function drawBossIntro(ctx: CanvasRenderingContext2D, gs: GS) {
  const alpha = Math.min(1, gs.phaseTimer / 0.5)
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.8})`; ctx.fillRect(0, 0, W, H)

  const world = WORLDS[gs.worldId]
  const shake = gs.phaseTimer < 1.5 ? Math.sin(gs.phaseTimer * 30) * 3 : 0

  ctx.save(); ctx.translate(W / 2 + shake, H / 2)
  ctx.fillStyle = "#ff2200"; ctx.font = "bold 24px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 20
  ctx.fillText("⚠ JEFE ENTRANTE ⚠", 0, -60)
  ctx.shadowBlur = 0

  ctx.fillStyle = world.accent; ctx.font = "bold 36px monospace"
  ctx.fillText(world.bossName.toUpperCase(), 0, 0)

  ctx.fillStyle = "#888"; ctx.font = "14px monospace"
  ctx.fillText(`Mundo ${gs.worldId + 1} — ${world.name}`, 0, 50)

  if (gs.phaseTimer > 2) {
    ctx.fillStyle = "#ffffff"; ctx.font = `bold ${14 + Math.sin(gs.phaseTimer * 4) * 2}px monospace`
    ctx.fillText("¡PREPÁRATE!", 0, 100)
  }
  ctx.restore()

  if (gs.phaseTimer > 3.5) transitionTo(gs, "boss")
}

function drawWorldClear(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  const t = gs.phaseTimer
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, t * 2)})`; ctx.fillRect(0, 0, W, H)

  const world = WORLDS[gs.worldId]
  ctx.fillStyle = world.accent; ctx.font = "bold 38px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = world.accent; ctx.shadowBlur = 30
  ctx.fillText("¡MUNDO CONQUISTADO!", W / 2, H / 2 - 70)
  ctx.shadowBlur = 0

  ctx.fillStyle = "#ffffff"; ctx.font = "bold 22px monospace"
  ctx.fillText(world.name.toUpperCase(), W / 2, H / 2 - 20)

  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 20px monospace"
  ctx.fillText(`Puntaje: ${gs.score.toLocaleString()}`, W / 2, H / 2 + 20)

  ctx.fillStyle = "#ffdd44"; ctx.font = "bold 14px monospace"
  ctx.fillText(`🪙 +${gs.lastRunCoins} monedas`, W / 2, H / 2 + 48)

  const hs = gs.save.highScores[gs.worldId] ?? 0
  if (gs.score >= hs) {
    ctx.fillStyle = "#44ff88"; ctx.font = "bold 16px monospace"
    ctx.fillText("★ NUEVO RÉCORD ★", W / 2, H / 2 + 74)
  }

  if (t > 2) {
    const isLast = gs.worldId >= WORLDS.length - 1
    const pulse = 0.92 + Math.sin(time * 3) * 0.08
    ctx.save(); ctx.translate(W / 2, H / 2 + 130); ctx.scale(pulse, pulse)
    ctx.fillStyle = isLast ? "#ffcc44" : world.accent
    ctx.beginPath(); ctx.roundRect(-100, -26, 200, 52, 10); ctx.fill()
    ctx.fillStyle = "#000010"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(isLast ? "🏆 VER FINAL" : "SIGUIENTE MUNDO →", 0, 0)
    ctx.restore()
  }
}

function drawGameover(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.88, gs.phaseTimer * 2)})` ; ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = "#ff2200"; ctx.font = "bold 48px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 30
  ctx.fillText("GAME OVER", W / 2, H / 2 - 80)
  ctx.shadowBlur = 0

  ctx.fillStyle = "#aaaaaa"; ctx.font = "16px monospace"
  ctx.fillText(gs.isEndless ? `ENDLESS — Oleada ${gs.endlessWave}` : `Mundo ${gs.worldId + 1} — ${WORLDS[gs.worldId].name}`, W / 2, H / 2 - 24)
  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 20px monospace"
  ctx.fillText(`Puntaje: ${gs.score.toLocaleString()}`, W / 2, H / 2 + 6)
  // Combo máximo + monedas ganadas
  ctx.fillStyle = "#ff88bb"; ctx.font = "13px monospace"
  ctx.fillText(`Combo máx: x${gs.save.bestCombo}`, W / 2, H / 2 + 32)
  ctx.fillStyle = "#ffdd44"; ctx.font = "bold 14px monospace"
  ctx.fillText(`🪙 +${gs.lastRunCoins} monedas`, W / 2, H / 2 + 54)

  if (gs.phaseTimer > 1.5) {
    const pulse = 0.92 + Math.sin(time * 2.5) * 0.08
    ctx.save(); ctx.translate(W / 2, H / 2 + 100); ctx.scale(pulse, pulse)
    ctx.fillStyle = "#ff4444"
    ctx.beginPath(); ctx.roundRect(-90, -24, 180, 48, 10); ctx.fill()
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("↺  REINTENTAR", 0, 0)
    ctx.restore()

    ctx.save(); ctx.translate(W / 2, H / 2 + 160); ctx.scale(pulse * 0.9, pulse * 0.9)
    ctx.fillStyle = "#333"
    ctx.beginPath(); ctx.roundRect(-90, -24, 180, 48, 10); ctx.fill()
    ctx.fillStyle = "#aaa"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("≡  MENÚ", 0, 0)
    ctx.restore()
  }
}

function drawVictory(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.9, gs.phaseTimer)})` ; ctx.fillRect(0, 0, W, H)

  // Gold particles effect via text
  ctx.fillStyle = "#ffdd44"; ctx.font = "bold 42px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.shadowColor = "#ffaa00"; ctx.shadowBlur = 40
  ctx.fillText("¡VICTORIOSO!", W / 2, H / 2 - 100)
  ctx.shadowBlur = 0

  ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px monospace"
  ctx.fillText("Has conquistado todos los mundos", W / 2, H / 2 - 40)

  ctx.fillStyle = "#ffcc44"; ctx.font = "bold 26px monospace"
  const totalScore = gs.save.highScores.reduce((a, b) => a + b, 0)
  ctx.fillText(`Récord total: ${totalScore.toLocaleString()}`, W / 2, H / 2 + 20)

  ctx.fillStyle = "#88ff88"; ctx.font = "14px monospace"
  ctx.fillText("El universo está en paz gracias a ti", W / 2, H / 2 + 70)

  if (gs.phaseTimer > 2) {
    const pulse = 0.92 + Math.sin(time * 2.5) * 0.08
    ctx.save(); ctx.translate(W / 2, H / 2 + 140); ctx.scale(pulse, pulse)
    ctx.fillStyle = "#ffdd44"
    ctx.beginPath(); ctx.roundRect(-110, -26, 220, 52, 10); ctx.fill()
    ctx.fillStyle = "#000010"; ctx.font = "bold 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("≡ MENÚ PRINCIPAL", 0, 0)
    ctx.restore()
  }
}

/* ════════════════════════════════════════════════════════════════════
   DRAW FRAME
   ════════════════════════════════════════════════════════════════════ */
function draw(ctx: CanvasRenderingContext2D, gs: GS, time: number) {
  ctx.clearRect(0, 0, W, H)

  // Screen shake
  const shakeX = gs.screenShake > 0 ? (Math.random() - 0.5) * gs.screenShake * 2 : 0
  const shakeY = gs.screenShake > 0 ? (Math.random() - 0.5) * gs.screenShake : 0
  ctx.save()
  ctx.translate(shakeX, shakeY)

  drawBackground(ctx, gs)
  drawStars(ctx, gs)

  if (gs.phase === "intro") {
    drawIntro(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "world-select") {
    drawWorldSelect(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "hangar") {
    drawHangar(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "ship-store") {
    drawShipStore(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "gameover") {
    for (const p of gs.particles) drawParticle(ctx, p)
    drawShockwaves(ctx, gs); drawFloaters(ctx, gs)
    drawGameover(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "victory") {
    for (const p of gs.particles) drawParticle(ctx, p)
    drawShockwaves(ctx, gs)
    drawVictory(ctx, gs, time); ctx.restore(); drawMuteBtn(ctx); return
  }
  if (gs.phase === "boss-intro") {
    if (gs.boss) drawBossShip(ctx, gs.boss, time)
    drawBossIntro(ctx, gs); ctx.restore(); drawMuteBtn(ctx); return
  }

  // Playing / boss
  for (const p of gs.particles) drawParticle(ctx, p)
  drawTrail(ctx, gs)
  for (const d of gs.drops) drawDrop(ctx, d, time)
  for (const e of gs.enemies) drawEnemyShip(ctx, e)
  if (gs.boss?.alive) drawBossShip(ctx, gs.boss, time)
  for (const b of gs.bullets) drawBullet(ctx, b)
  for (const b of gs.enemyBullets) drawBullet(ctx, b)
  drawShockwaves(ctx, gs)

  // Boss laser
  if (gs.bossLaserActive && gs.boss?.alive) {
    const alpha = Math.min(1, gs.bossLaserT / 0.3)
    ctx.strokeStyle = `rgba(255,220,0,${alpha * 0.9})`
    ctx.lineWidth = 4 + Math.sin(time * 20) * 2
    ctx.shadowColor = "#ffee00"; ctx.shadowBlur = 20
    ctx.beginPath(); ctx.moveTo(gs.bossLaserX, gs.boss.y + gs.boss.h / 2)
    ctx.lineTo(gs.bossLaserX, H - HUD_H)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  drawPlayerShip(
    ctx, gs.playerX, PLAYER_Y, getShip(gs.save), gs.invTimer,
    gs.shieldActive, gs.shieldHP, gs.shieldMaxHP,
    gs.shieldCooldown, gs.shieldCdMax, time,
  )

  drawFloaters(ctx, gs)

  ctx.restore()  // fin screen shake

  if (gs.phase === "world-clear") {
    drawWorldClear(ctx, gs, time)
  } else {
    drawHUD(ctx, gs)
  }

  // Botón de silencio — siempre visible en todas las fases
  drawMuteBtn(ctx)
}

const MUTE_BTN = { x: W - 54, y: 6, w: 48, h: 28 }

function drawMuteBtn(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = MUTE_BTN
  ctx.save()
  ctx.fillStyle = _soundMuted ? "rgba(60,10,10,0.88)" : "rgba(0,20,50,0.75)"
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill()
  ctx.strokeStyle = _soundMuted ? "#ff4444" : "#4488ff"
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.stroke()
  ctx.fillStyle = _soundMuted ? "#ff6666" : "#88bbff"
  ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(_soundMuted ? "✕ SFX" : "♫ SFX", x + w / 2, y + h / 2)
  ctx.restore()
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = p.life / p.maxLife
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

function drawTrail(ctx: CanvasRenderingContext2D, gs: GS) {
  const n = gs.trail.length
  for (let i = 0; i < n; i++) {
    const t = gs.trail[i]
    const a = (i / n) * 0.5
    const r = 4 + (i / n) * 8
    ctx.fillStyle = `rgba(0,200,255,${a})`
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 20, r * 0.6, r, 0, 0, Math.PI * 2); ctx.fill()
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const f of gs.floaters) {
    const alpha = Math.min(1, f.life / f.maxLife * 1.5)
    ctx.globalAlpha = alpha
    ctx.fillStyle = f.color
    ctx.font = `bold ${f.size}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(f.text, f.x, f.y)
    ctx.globalAlpha = 1
  }
}

function drawShockwaves(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const s of gs.shockwaves) {
    const alpha = s.life / s.maxLife
    ctx.strokeStyle = s.color === "#ffffff"
      ? `rgba(255,255,255,${alpha * 0.8})`
      : hexToRgba(s.color, alpha * 0.8)
    ctx.lineWidth = 3 * alpha
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke()
    // Destello central breve
    if (s.life > s.maxLife * 0.6) {
      const fa = (s.life - s.maxLife * 0.6) / (s.maxLife * 0.4)
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.maxR * 0.4)
      g.addColorStop(0, `rgba(255,255,255,${fa * 0.5})`)
      g.addColorStop(1, "transparent")
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(s.x, s.y, s.maxR * 0.4, 0, Math.PI * 2); ctx.fill()
    }
  }
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

/* ════════════════════════════════════════════════════════════════════
   INPUT HANDLERS
   ════════════════════════════════════════════════════════════════════ */
function handleTap(gs: GS, cx: number, cy: number, canvasRect: DOMRect, scaleX: number, scaleY: number) {
  const x = (cx - canvasRect.left) * scaleX
  const y = (cy - canvasRect.top) * scaleY

  // Botón de silencio — prioridad máxima, siempre activo
  const mb = MUTE_BTN
  if (x >= mb.x - 6 && x <= mb.x + mb.w + 6 && y >= mb.y - 6 && y <= mb.y + mb.h + 6) {
    _soundMuted = !_soundMuted
    return
  }

  if (gs.phase === "intro") {
    for (const btn of gs.introBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if (btn.action === "campaign") transitionTo(gs, "world-select")
        else if (btn.action === "endless") startEndless(gs)
        else if (btn.action === "hangar") { gs.phase = "hangar"; gs.phaseTimer = 0 }
        else if (btn.action === "ships") { gs.phase = "ship-store"; gs.phaseTimer = 0 }
        return
      }
    }
    return
  }

  if (gs.phase === "ship-store") {
    if (y > H - 42) { gs.phase = "intro"; gs.phaseTimer = 0; return }
    for (const btn of gs.shipBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const ship = SHIP_DEFS.find(s => s.id === btn.shipId)!
        const owned = gs.save.shipsOwned.includes(ship.id)
        if (owned) {
          if (gs.save.shipId !== ship.id) {
            gs.save.shipId = ship.id
            writeStarSave(gs.save)
            gs.flashMsg = `${ship.name} equipada`
            gs.flashT = 1.2
            SFX.pickup()
          }
        } else {
          if (gs.save.coins >= ship.price) {
            gs.save.coins -= ship.price
            gs.save.shipsOwned.push(ship.id)
            gs.save.shipId = ship.id
            writeStarSave(gs.save)
            gs.flashMsg = `¡${ship.name} comprada!`
            gs.flashT = 1.5
            SFX.worldClear()
          } else {
            gs.flashMsg = "Monedas insuficientes"
            gs.flashT = 1
            SFX.shieldOff()
          }
        }
        return
      }
    }
    return
  }

  if (gs.phase === "hangar") {
    if (y > H - 42) { gs.phase = "intro"; gs.phaseTimer = 0; return }
    for (const btn of gs.hangarBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const def = UPGRADE_DEFS.find(d => d.key === btn.key)!
        const lvl = gs.save.upgrades[btn.key]
        if (lvl >= def.max) { gs.flashMsg = "Ya está al máximo"; gs.flashT = 1; return }
        const cost = def.cost(lvl)
        if (gs.save.coins >= cost) {
          gs.save.coins -= cost
          gs.save.upgrades[btn.key] = lvl + 1
          writeStarSave(gs.save)
          SFX.pickup()
        } else {
          gs.flashMsg = "Monedas insuficientes"; gs.flashT = 1
          SFX.shieldOff()
        }
        return
      }
    }
    return
  }

  if (gs.phase === "world-select") {
    // Check back area
    if (y > H - 40) { gs.phase = "intro"; gs.phaseTimer = 0; return }
    for (const btn of gs.worldBtns) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const unlocked = btn.worldId === 0 || btn.worldId <= gs.save.worldsCleared
        if (unlocked) {
          gs.worldId = btn.worldId
          gs.score = 0
          gs.runCoins = 0
          gs.ammo = { basic: -1, laser: 0, spread: 0, missile: 0 }
          gs.activeAmmo = "basic"
          transitionTo(gs, "playing")
        }
        return
      }
    }
    return
  }

  if (gs.phase === "playing" || gs.phase === "boss") {
    // Botón de escudo (área de toque ampliada para dedos)
    if (gs.shieldBtn) {
      const sb = gs.shieldBtn
      if (x >= sb.x - 6 && x <= sb.x + sb.w + 6 && y >= sb.y - 14 && y <= sb.y + sb.h + 10) {
        activateShield(gs)
        return
      }
    }
    // Botones de munición (área de toque ampliada para dedos)
    for (const btn of gs.ammoBtns) {
      if (x >= btn.x - 4 && x <= btn.x + btn.w + 4 && y >= btn.y - 14 && y <= btn.y + btn.h + 10) {
        const count = gs.ammo[btn.ammo]
        if (count === -1 || count > 0) {
          gs.activeAmmo = btn.ammo
          gs.fireTimer = 0
          gs.flashMsg = AMMO_NAMES[btn.ammo] + " activado"
          gs.flashT = 1
        }
        return
      }
    }
    return
  }

  if (gs.phase === "world-clear") {
    if (gs.phaseTimer > 2) {
      if (gs.worldId >= WORLDS.length - 1) {
        transitionTo(gs, "victory")
      } else {
        gs.worldId++
        gs.score = 0
        gs.ammo = { basic: -1, laser: 0, spread: 0, missile: 0 }
        gs.activeAmmo = "basic"
        transitionTo(gs, "playing")
      }
    }
    return
  }

  if (gs.phase === "gameover") {
    if (gs.phaseTimer > 1.5) {
      // Check retry button
      if (y > H / 2 + 76 && y < H / 2 + 124) {
        if (gs.isEndless) {
          startEndless(gs)
        } else {
          gs.score = 0
          gs.runCoins = 0
          gs.ammo = { basic: -1, laser: 0, spread: 0, missile: 0 }
          gs.activeAmmo = "basic"
          transitionTo(gs, "playing")
        }
        return
      }
      // Check menu button
      if (y > H / 2 + 136 && y < H / 2 + 184) {
        gs.phase = "intro"; gs.phaseTimer = 0; return
      }
    }
    return
  }

  if (gs.phase === "victory") {
    if (gs.phaseTimer > 2) {
      gs.phase = "intro"; gs.phaseTimer = 0
    }
    return
  }
}

/* ════════════════════════════════════════════════════════════════════
   AUDIO — Web Audio API (síntesis procedural, sin archivos externos)
   ════════════════════════════════════════════════════════════════════ */
let _audioCtx: AudioContext | null = null
let _soundMuted = false

function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

function playTone(
  freq: number, type: OscillatorType, duration: number,
  volume = 0.25, freqEnd?: number, startDelay = 0,
) {
  if (_soundMuted) return
  try {
    const ac = getAudioCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain); gain.connect(ac.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ac.currentTime + startDelay)
    if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + startDelay + duration)
    gain.gain.setValueAtTime(volume, ac.currentTime + startDelay)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startDelay + duration)
    osc.start(ac.currentTime + startDelay)
    osc.stop(ac.currentTime + startDelay + duration + 0.01)
  } catch {}
}

function playNoise(duration: number, volume = 0.15, highpass = 800) {
  if (_soundMuted) return
  try {
    const ac = getAudioCtx()
    const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    const filter = ac.createBiquadFilter()
    filter.type = "highpass"; filter.frequency.value = highpass
    const gain = ac.createGain()
    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination)
    src.start(); src.stop(ac.currentTime + duration + 0.01)
  } catch {}
}

const SFX = {
  shoot()       { playTone(660, "square", 0.06, 0.12, 220) },
  shootLaser()  { playTone(1200, "sawtooth", 0.12, 0.15, 400) },
  shootSpread() {
    playTone(580, "square", 0.05, 0.08, 200)
    playTone(620, "square", 0.05, 0.08, 200, 0.03)
    playTone(540, "square", 0.05, 0.08, 200, 0.06)
  },
  shootMissile() { playTone(320, "sawtooth", 0.18, 0.18, 180) },
  enemyHit()     { playNoise(0.06, 0.12, 1200) },
  explosion()    {
    playNoise(0.3, 0.25, 80)
    playTone(80, "sine", 0.3, 0.2, 30)
  },
  bigExplosion() {
    playNoise(0.6, 0.35, 40)
    playTone(60, "sine", 0.6, 0.3, 20)
    playTone(120, "sawtooth", 0.4, 0.15, 40, 0.05)
  },
  playerHit()    {
    playNoise(0.15, 0.2, 400)
    playTone(220, "square", 0.18, 0.15, 110)
  },
  shieldOn()     {
    playTone(800, "sine", 0.08, 0.2, 1400)
    playTone(600, "sine", 0.12, 0.12, 1000, 0.04)
  },
  shieldOff()    { playTone(500, "sine", 0.2, 0.15, 150) },
  shieldBreak()  {
    playNoise(0.25, 0.2, 300)
    playTone(300, "sawtooth", 0.25, 0.12, 80)
  },
  pickup()       {
    playTone(660, "sine", 0.06, 0.18)
    playTone(880, "sine", 0.06, 0.18, undefined, 0.06)
    playTone(1100, "sine", 0.1, 0.18, undefined, 0.12)
  },
  bossIntro()    {
    for (let i = 0; i < 4; i++) {
      playTone(100 + i * 30, "sawtooth", 0.3, 0.2 - i * 0.03, undefined, i * 0.22)
    }
    playNoise(0.8, 0.08, 60)
  },
  worldClear()   {
    const notes = [523, 659, 784, 1047]
    notes.forEach((n, i) => playTone(n, "sine", 0.25, 0.22, undefined, i * 0.18))
  },
  bossPhase2()   {
    playTone(150, "sawtooth", 0.5, 0.3, 80)
    playNoise(0.3, 0.15, 200)
  },
}

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function StarAssaultGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(makeGS())

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const gs = gsRef.current

    // Canvas CSS scaling to fill screen
    const resize = () => {
      const vw = window.innerWidth, vh = window.innerHeight
      const scale = Math.min(vw / W, vh / H)
      canvas.style.width = `${W * scale}px`
      canvas.style.height = `${H * scale}px`
    }
    resize()
    window.addEventListener("resize", resize)

    // Game loop
    let rafId = 0
    const startTime = performance.now()
    const loop = (now: number) => {
      const rawDt = (now - gs.lastTime) / 1000
      gs.lastTime = now
      const dt = Math.min(rawDt, 0.05)  // cap at 50ms
      const time = (now - startTime) / 1000
      update(gs, dt)
      draw(ctx, gs, time)
      rafId = requestAnimationFrame(loop)
    }
    gs.lastTime = performance.now()
    rafId = requestAnimationFrame(loop)

    // Touch events
    const getScale = () => {
      const rect = canvas.getBoundingClientRect()
      return { sx: W / rect.width, sy: H / rect.height, rect }
    }

    // Estado de arrastre del selector de mundos (tap diferido hasta soltar)
    let tapPending: { x: number; y: number; cx: number; cy: number } | null = null
    let tapStartX = 0, tapStartY = 0

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      const t = e.touches[0]
      const tx = (t.clientX - rect.left) * sx
      const ty = (t.clientY - rect.top) * sx  // sx == sy (escala uniforme)
      gs.isTouching = true
      if (gs.phase === "world-select") {
        // Arrastre para scroll: el tap se resuelve al soltar
        tapPending = { x: tx, y: ty, cx: t.clientX, cy: t.clientY }
        tapStartX = tx; tapStartY = ty
        gs.worldDragStartY = ty
        gs.worldDragBase = gs.worldScroll
        return
      }
      // Solo mueve la nave si el toque está ENCIMA del HUD
      if (ty < H - HUD_H) gs.touchX = tx
      handleTap(gs, t.clientX, t.clientY, rect, sx, sx)
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      const t = e.touches[0]
      const tx = (t.clientX - rect.left) * sx
      const ty = (t.clientY - rect.top) * sx
      if (gs.phase === "world-select" && gs.worldDragStartY !== null) {
        gs.worldScroll = Math.max(0, Math.min(gs.worldDragBase + (gs.worldDragStartY - ty), worldMaxScroll()))
        if (Math.abs(tx - tapStartX) > 8 || Math.abs(ty - tapStartY) > 8) tapPending = null
        return
      }
      // Solo rastrea la nave encima del HUD para evitar que salte al dedo que toca botones
      if (ty < H - HUD_H) gs.touchX = tx
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (gs.phase === "world-select") {
        gs.worldDragStartY = null
        const { sx, rect } = getScale()
        if (tapPending) {
          handleTap(gs, tapPending.cx, tapPending.cy, rect, sx, sx)
          tapPending = null
        }
        return
      }
      gs.isTouching = false
      if (e.touches.length === 0) gs.touchX = null
    }

    const onMouseMove = (e: MouseEvent) => {
      const { sx, sy, rect } = getScale()
      const mx = (e.clientX - rect.left) * sx
      const my = (e.clientY - rect.top) * sy
      if (gs.phase === "world-select" && gs.worldDragStartY !== null) {
        gs.worldScroll = Math.max(0, Math.min(gs.worldDragBase + (gs.worldDragStartY - my), worldMaxScroll()))
        if (Math.abs(mx - tapStartX) > 8 || Math.abs(my - tapStartY) > 8) tapPending = null
        return
      }
      gs.touchX = mx
    }

    const onMouseDown = (e: MouseEvent) => {
      const { sx, sy, rect } = getScale()
      const mx = (e.clientX - rect.left) * sx
      const my = (e.clientY - rect.top) * sy
      gs.isTouching = true
      if (gs.phase === "world-select") {
        tapPending = { x: mx, y: my, cx: e.clientX, cy: e.clientY }
        tapStartX = mx; tapStartY = my
        gs.worldDragStartY = my
        gs.worldDragBase = gs.worldScroll
        return
      }
      handleTap(gs, e.clientX, e.clientY, rect, sx, sx)
    }

    const onMouseUp = () => {
      if (gs.phase === "world-select") {
        gs.worldDragStartY = null
        const { sx, rect } = getScale()
        if (tapPending) {
          handleTap(gs, tapPending.cx, tapPending.cy, rect, sx, sx)
          tapPending = null
        }
        return
      }
      gs.isTouching = false
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const ammos: AmmoType[] = ["basic", "laser", "spread", "missile"]
      if (e.key >= "1" && e.key <= "4") {
        const idx = parseInt(e.key) - 1
        const ammo = ammos[idx]
        if (ammo && (gs.ammo[ammo] === -1 || gs.ammo[ammo] > 0)) {
          gs.activeAmmo = ammo; gs.fireTimer = 0
          gs.flashMsg = AMMO_NAMES[ammo] + " activado"; gs.flashT = 1
        }
      }
      if (e.key === "Shift" || e.key === "s" || e.key === "S") {
        activateShield(gs)
      }
      if (e.key === " " || e.key === "Enter") {
        const { sx, rect } = getScale()
        handleTap(gs, rect.left + rect.width / 2, rect.top + rect.height / 2, rect, sx, sx)
      }
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: false })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", onTouchEnd, { passive: false })
    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("mousedown", onMouseDown)
    canvas.addEventListener("mouseup", onMouseUp)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", onTouchEnd)
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("mousedown", onMouseDown)
      canvas.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      width: "100vw", height: "100vh", background: "#000010", overflow: "hidden",
      userSelect: "none", WebkitUserSelect: "none",
    }}>
      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ display: "block", imageRendering: "pixelated", touchAction: "none" }}
      />
    </div>
  )
}
