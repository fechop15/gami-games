export interface GalaxySave {
  version: number
  coins: number
  inventory: Record<string, number>
  shipId: string
  shipsOwned: string[]
  currentMap: string
  mapsCleared: string[]
  kills: number
  bossKills: Record<string, number>
  repairBots: number
  muted: boolean
  hud: Record<string, { x: number; y: number; minimized: boolean; orientation: "vertical" | "horizontal" }>
}

const KEY = "galaxy-assault-save"
const VERSION = 1
export const DEFAULT_SHIP_ID = "star"

function defaults(): GalaxySave {
  return {
    version: VERSION,
    coins: 0,
    inventory: {},
    shipId: DEFAULT_SHIP_ID,
    shipsOwned: [DEFAULT_SHIP_ID],
    currentMap: "M1",
    mapsCleared: [],
    kills: 0,
    bossKills: {},
    repairBots: 0,
    muted: false,
    hud: {},
  }
}

export function loadGalaxySave(): GalaxySave {
  if (typeof window === "undefined") return defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    const p = JSON.parse(raw) as Partial<GalaxySave>
    const d = defaults()
    return {
      version: VERSION,
      coins: typeof p.coins === "number" ? p.coins : d.coins,
      inventory: p.inventory && typeof p.inventory === "object" ? { ...p.inventory } : {},
      shipId: typeof p.shipId === "string" && p.shipId ? p.shipId : d.shipId,
      shipsOwned: Array.isArray(p.shipsOwned) && p.shipsOwned.length > 0 ? p.shipsOwned : d.shipsOwned,
      currentMap: typeof p.currentMap === "string" ? p.currentMap : d.currentMap,
      mapsCleared: Array.isArray(p.mapsCleared) ? p.mapsCleared : [],
      kills: typeof p.kills === "number" ? p.kills : 0,
      bossKills: p.bossKills && typeof p.bossKills === "object" ? { ...(p.bossKills as Record<string, number>) } : {},
      repairBots: typeof p.repairBots === "number" ? p.repairBots : 0,
      muted: p.muted === true,
      hud: p.hud && typeof p.hud === "object" ? { ...(p.hud as GalaxySave["hud"]) } : {},
    }
  } catch {
    return defaults()
  }
}

export function writeGalaxySave(d: GalaxySave): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
}