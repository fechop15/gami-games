export interface ShipUpgrades {
  hp: number         // 0-3: +20 HP máx por nivel
  shieldDur: number  // 0-3: +1 s de escudo por nivel
  shieldCd: number   // 0-3: -1 s de recarga por nivel
  fireRate: number   // 0-3: -8% de cadencia por nivel
  magnet: number     // 0-1: imán de drops permanente
}

export type AmmoType = "basic" | "laser" | "spread" | "missile"

// Loadout (slots) de una nave: qué items del inventario están equipados
export interface ShipLoadout {
  lasers: (string | null)[]   // items equipados en los slots de láser
  shields: (string | null)[]  // items equipados en los slots de escudo
}

// Equipamiento: inventario de items + loadout por nave
export interface EquipmentState {
  lasers: Record<string, number>        // inventario de láseres: { laserId: cantidad }
  shields: Record<string, number>       // inventario de escudos: { shieldId: cantidad }
  laserPerfection: Record<string, number>   // % de perfección (0-100) por láser base
  repairBots: number                    // robots de reparación disponibles (un solo uso)
  loadouts: Record<string, ShipLoadout> // loadout por nave (slots equipados)
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
  equipment: EquipmentState  // inventario + loadouts por nave
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

function defaultEquipment(): EquipmentState {
  return {
    lasers: { [DEFAULT_LASER_ID]: 1 },
    shields: { [DEFAULT_SHIELD_ID]: 1 },
    laserPerfection: {},
    repairBots: 0,
    loadouts: {},
  }
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
  equipment: defaultEquipment(),
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
    const eq = (p.equipment ?? {}) as Partial<EquipmentState> & Record<string, unknown>
    // Migración del formato viejo (v5: laserId/ownedLasers) al de inventario
    const lasers: Record<string, number> = {}
    if (eq.lasers && typeof eq.lasers === "object") {
      Object.assign(lasers, eq.lasers)
    } else if (Array.isArray(eq.ownedLasers)) {
      // Formato viejo: cada id comprado → 3 copias para poder fusionar
      for (const id of eq.ownedLasers) lasers[id] = 3
    }
    if (!(DEFAULT_LASER_ID in lasers)) lasers[DEFAULT_LASER_ID] = 1
    const shields: Record<string, number> = {}
    if (eq.shields && typeof eq.shields === "object") {
      Object.assign(shields, eq.shields)
    } else if (Array.isArray(eq.ownedShields)) {
      for (const id of eq.ownedShields) shields[id] = 3
    }
    if (!(DEFAULT_SHIELD_ID in shields)) shields[DEFAULT_SHIELD_ID] = 1
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
        lasers,
        shields,
        laserPerfection: { ...(eq.laserPerfection ?? {}) },
        repairBots: eq.repairBots ?? 0,
        loadouts: (eq.loadouts && typeof eq.loadouts === "object" ? eq.loadouts : {}) as Record<string, ShipLoadout>,
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
    equipment: defaultEquipment(),
    bankedAmmo: { ...DEFAULT_BANKED },
  }
}

export function writeStarSave(d: StarSave): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
}
