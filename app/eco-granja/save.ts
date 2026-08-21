export type TileKind = "soil" | "pond" | "pasture"

export interface TileState {
  kind: TileKind
  // cultivo
  cropId?: string
  cropProgress?: number   // 0..1
  cropWater?: number      // días regados
  cropDays?: number       // días de crecimiento
  cropFert?: boolean      // abono aplicado
  wateredToday?: boolean  // regado durante el día actual
  // animal
  animalId?: string
  animalQuality?: number  // 1..5 (raza)
  animalHappy?: number    // 0..100
  animalProg?: number     // progreso de producción en días
  // estanque
  pondFish?: string       // especie sembrada
  pondStock?: number
}

export interface Stats {
  harvested: number
  sold: number
  caught: number
  bred: number
  earned: number
  taxes: number
}

export interface EcoSave {
  version: number
  coins: number
  fame: number
  day: number
  tiles: TileState[][]
  inventory: Record<string, number>  // "productId:quality" -> qty
  unlockedCrops: string[]
  unlockedAnimals: string[]
  unlockedFish: string[]
  ownedStaff: string[]
  decorations: Record<string, number>
  abono: number
  repelente: number
  repelenteT: number
  storageMax: number
  taxesOwed: number
  lastTaxDay: number
  weather: string
  weatherDays: number
  wildlife: Record<string, number>
  stats: Stats
  firstRun: boolean
}

const KEY = "eco-granja-save"

export const VERSION = 1

export function tileKey(t: TileState): string {
  if (t.cropId) return `crop:${t.cropId}`
  if (t.animalId) return `animal:${t.animalId}`
  if (t.kind === "pond") return "pond"
  return "soil"
}

export function invKey(productId: string, quality: number): string {
  return `${productId}:${quality}`
}

export function parseInvKey(key: string): { productId: string; quality: number } {
  const [productId, q] = key.split(":")
  return { productId, quality: q ? parseInt(q, 10) : 1 }
}

export function inventoryUsed(s: EcoSave): number {
  let n = 0
  for (const k of Object.keys(s.inventory)) n += s.inventory[k]
  return n
}

function defaultTiles(): TileState[][] {
  const rows: TileState[][] = []
  for (let r = 0; r < 5; r++) {
    const row: TileState[] = []
    for (let c = 0; c < 5; c++) row.push({ kind: "soil" })
    rows.push(row)
  }
  return rows
}

function defaults(): EcoSave {
  return {
    version: VERSION,
    coins: 30,
    fame: 0,
    day: 1,
    tiles: defaultTiles(),
    inventory: {},
    unlockedCrops: ["trigo"],
    unlockedAnimals: ["gallina"],
    unlockedFish: ["sardina"],
    ownedStaff: [],
    decorations: {},
    abono: 0,
    repelente: 0,
    repelenteT: 0,
    storageMax: 60,
    taxesOwed: 0,
    lastTaxDay: 0,
    weather: "soleado",
    weatherDays: 0,
    wildlife: { abeja: 0, mariquita: 0, lombriz: 0, zorro: 0, jabali: 0, plaga: 0 },
    stats: { harvested: 0, sold: 0, caught: 0, bred: 0, earned: 0, taxes: 0 },
    firstRun: true,
  }
}

export function loadEcoSave(): EcoSave {
  if (typeof window === "undefined") return defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    const p = JSON.parse(raw) as Partial<EcoSave>
    const d = defaults()
    // tiles con saneamiento
    let tiles = d.tiles
    if (Array.isArray(p.tiles) && p.tiles.length > 0 && Array.isArray(p.tiles[0])) {
      tiles = (p.tiles as TileState[][]).map(row =>
        row.map(t => ({
          kind: t && t.kind === "soil" || t && t.kind === "pond" || t && t.kind === "pasture" ? t.kind : "soil",
          cropId: t.cropId,
          cropProgress: t.cropProgress,
          cropWater: t.cropWater,
          cropDays: t.cropDays,
          cropFert: t.cropFert,
          wateredToday: t.wateredToday,
          animalId: t.animalId,
          animalQuality: t.animalQuality,
          animalHappy: t.animalHappy,
          animalProg: t.animalProg,
          pondFish: t.pondFish,
          pondStock: t.pondStock,
        }))
      )
    }
    return {
      version: VERSION,
      coins: typeof p.coins === "number" ? p.coins : d.coins,
      fame: typeof p.fame === "number" ? p.fame : d.fame,
      day: typeof p.day === "number" ? p.day : d.day,
      tiles,
      inventory: p.inventory && typeof p.inventory === "object" ? { ...p.inventory } : d.inventory,
      unlockedCrops: Array.isArray(p.unlockedCrops) && p.unlockedCrops.length > 0 ? p.unlockedCrops : d.unlockedCrops,
      unlockedAnimals: Array.isArray(p.unlockedAnimals) && p.unlockedAnimals.length > 0 ? p.unlockedAnimals : d.unlockedAnimals,
      unlockedFish: Array.isArray(p.unlockedFish) && p.unlockedFish.length > 0 ? p.unlockedFish : d.unlockedFish,
      ownedStaff: Array.isArray(p.ownedStaff) ? p.ownedStaff : [],
      decorations: p.decorations && typeof p.decorations === "object" ? { ...p.decorations } : {},
      abono: typeof p.abono === "number" ? p.abono : 0,
      repelente: typeof p.repelente === "number" ? p.repelente : 0,
      repelenteT: typeof p.repelenteT === "number" ? p.repelenteT : 0,
      storageMax: typeof p.storageMax === "number" ? p.storageMax : d.storageMax,
      taxesOwed: typeof p.taxesOwed === "number" ? p.taxesOwed : 0,
      lastTaxDay: typeof p.lastTaxDay === "number" ? p.lastTaxDay : 0,
      weather: typeof p.weather === "string" ? p.weather : d.weather,
      weatherDays: typeof p.weatherDays === "number" ? p.weatherDays : 0,
      wildlife: p.wildlife && typeof p.wildlife === "object" ? { ...d.wildlife, ...p.wildlife } : d.wildlife,
      stats: p.stats && typeof p.stats === "object" ? { ...d.stats, ...p.stats } : d.stats,
      firstRun: p.firstRun !== false,
    }
  } catch {
    return defaults()
  }
}

export function writeEcoSave(d: EcoSave): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
}

export function clearEcoSave(): void {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(KEY) } catch {}
}