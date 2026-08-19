export interface ShipUpgrades {
  hp: number         // 0-3: +20 HP máx por nivel
  shieldDur: number  // 0-3: +1 s de escudo por nivel
  shieldCd: number   // 0-3: -1 s de recarga por nivel
  fireRate: number   // 0-3: -8% de cadencia por nivel
  magnet: number     // 0-1: imán de drops permanente
}

export type AmmoType = "basic" | "laser" | "spread" | "missile"

// Equipamiento comprable por nave
export interface EquipmentState {
  laserId: string            // láser equipado (id de LASER_DEFS)
  shieldId: string           // escudo equipado (id de SHIELD_DEFS)
  ownedLasers: string[]      // láseres comprados
  ownedShields: string[]     // escudos comprados
  laserPerfection: Record<string, number>   // % de perfección (0-100) por láser
  repairBots: number         // robots de reparación disponibles (un solo uso)
}

export interface StarSave {
  worldsCleared: number      // 0 = ninguno, 1 = mundo 1 limpio, etc.
  highScores: number[]       // índice por mundo
  coins: number              // moneda para el hangar
  bestCombo: number          // mejor racha alcanzada
  endlessBest: number        // mejor oleada en modo Endless
  upgrades: ShipUpgrades     // mejoras permanentes de nave
  shipId: string             // id de la nave equipada
  shipsOwned: string[]       // ids de naves compradas
  equipment: EquipmentState  // equipamiento (láser, escudo, robots, perfección)
  bankedAmmo: Record<AmmoType, number>  // munición guardada entre partidas
}

const KEY = "star-assault-save"

const DEFAULT_UPGRADES: ShipUpgrades = {
  hp: 0, shieldDur: 0, shieldCd: 0, fireRate: 0, magnet: 0,
}

export const DEFAULT_SHIP_ID = "aurora"
export const DEFAULT_LASER_ID = "laser_std"
export const DEFAULT_SHIELD_ID = "shield_std"
export const TOTAL_WORLDS = 16

const DEFAULT_EQUIPMENT: EquipmentState = {
  laserId: DEFAULT_LASER_ID,
  shieldId: DEFAULT_SHIELD_ID,
  ownedLasers: [DEFAULT_LASER_ID],
  ownedShields: [DEFAULT_SHIELD_ID],
  laserPerfection: {},
  repairBots: 0,
}

const DEFAULT_BANKED: Record<AmmoType, number> = {
  basic: -1, laser: 0, spread: 0, missile: 0,
}

const DEFAULTS: StarSave = {
  worldsCleared: 0,
  highScores: new Array(TOTAL_WORLDS).fill(0),
  coins: 0,
  bestCombo: 0,
  endlessBest: 0,
  upgrades: { ...DEFAULT_UPGRADES },
  shipId: DEFAULT_SHIP_ID,
  shipsOwned: [DEFAULT_SHIP_ID],
  equipment: {
    ...DEFAULT_EQUIPMENT,
    ownedLasers: [...DEFAULT_EQUIPMENT.ownedLasers],
    ownedShields: [...DEFAULT_EQUIPMENT.ownedShields],
    laserPerfection: { ...DEFAULT_EQUIPMENT.laserPerfection },
  },
  bankedAmmo: { ...DEFAULT_BANKED },
}

export function loadStarSave(): StarSave {
  if (typeof window === "undefined") return cloneDefaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return cloneDefaults()
    const p = JSON.parse(raw) as Partial<StarSave>
    const highScores = p.highScores ?? []
    while (highScores.length < TOTAL_WORLDS) highScores.push(0)
    const eq = (p.equipment ?? {}) as Partial<EquipmentState>
    return {
      worldsCleared: p.worldsCleared ?? 0,
      highScores: highScores.slice(0, TOTAL_WORLDS),
      coins: p.coins ?? 0,
      bestCombo: p.bestCombo ?? 0,
      endlessBest: p.endlessBest ?? 0,
      upgrades: { ...DEFAULT_UPGRADES, ...(p.upgrades ?? {}) },
      shipId: p.shipId ?? DEFAULT_SHIP_ID,
      shipsOwned: Array.isArray(p.shipsOwned) && p.shipsOwned.length > 0 ? p.shipsOwned : [DEFAULT_SHIP_ID],
      equipment: {
        laserId: eq.laserId ?? DEFAULT_LASER_ID,
        shieldId: eq.shieldId ?? DEFAULT_SHIELD_ID,
        ownedLasers: Array.isArray(eq.ownedLasers) && eq.ownedLasers.length > 0 ? eq.ownedLasers : [DEFAULT_LASER_ID],
        ownedShields: Array.isArray(eq.ownedShields) && eq.ownedShields.length > 0 ? eq.ownedShields : [DEFAULT_SHIELD_ID],
        laserPerfection: { ...(eq.laserPerfection ?? {}) },
        repairBots: eq.repairBots ?? 0,
      },
      bankedAmmo: { ...DEFAULT_BANKED, ...(p.bankedAmmo ?? {}) },
    }
  } catch {
    return cloneDefaults()
  }
}

function cloneDefaults(): StarSave {
  return {
    ...DEFAULTS,
    upgrades: { ...DEFAULT_UPGRADES },
    equipment: {
      ...DEFAULT_EQUIPMENT,
      ownedLasers: [...DEFAULT_EQUIPMENT.ownedLasers],
      ownedShields: [...DEFAULT_EQUIPMENT.ownedShields],
      laserPerfection: { ...DEFAULT_EQUIPMENT.laserPerfection },
    },
    bankedAmmo: { ...DEFAULT_BANKED },
  }
}

export function writeStarSave(d: StarSave): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
}
