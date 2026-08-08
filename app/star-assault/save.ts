export interface ShipUpgrades {
  hp: number         // 0-3: +20 HP máx por nivel
  shieldDur: number  // 0-3: +1 s de escudo por nivel
  shieldCd: number   // 0-3: -1 s de recarga por nivel
  fireRate: number   // 0-3: -8% de cadencia por nivel
  magnet: number     // 0-1: imán de drops permanente
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
}

const KEY = "star-assault-save"

const DEFAULT_UPGRADES: ShipUpgrades = {
  hp: 0, shieldDur: 0, shieldCd: 0, fireRate: 0, magnet: 0,
}

export const DEFAULT_SHIP_ID = "aurora"
export const TOTAL_WORLDS = 16

const DEFAULTS: StarSave = {
  worldsCleared: 0,
  highScores: new Array(TOTAL_WORLDS).fill(0),
  coins: 0,
  bestCombo: 0,
  endlessBest: 0,
  upgrades: { ...DEFAULT_UPGRADES },
  shipId: DEFAULT_SHIP_ID,
  shipsOwned: [DEFAULT_SHIP_ID],
}

export function loadStarSave(): StarSave {
  if (typeof window === "undefined") return { ...DEFAULTS, upgrades: { ...DEFAULT_UPGRADES } }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS, upgrades: { ...DEFAULT_UPGRADES } }
    const p = JSON.parse(raw) as Partial<StarSave>
    const highScores = p.highScores ?? []
    while (highScores.length < TOTAL_WORLDS) highScores.push(0)
    return {
      worldsCleared: p.worldsCleared ?? 0,
      highScores: highScores.slice(0, TOTAL_WORLDS),
      coins: p.coins ?? 0,
      bestCombo: p.bestCombo ?? 0,
      endlessBest: p.endlessBest ?? 0,
      upgrades: { ...DEFAULT_UPGRADES, ...(p.upgrades ?? {}) },
      shipId: p.shipId ?? DEFAULT_SHIP_ID,
      shipsOwned: Array.isArray(p.shipsOwned) && p.shipsOwned.length > 0 ? p.shipsOwned : [DEFAULT_SHIP_ID],
    }
  } catch {
    return { ...DEFAULTS, upgrades: { ...DEFAULT_UPGRADES } }
  }
}

export function writeStarSave(d: StarSave): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
}
