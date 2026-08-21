import cfg from "./config.json"
import type { Tool } from "./types"

export interface CfgCrop {
  id: string; name: string; emoji: string; unlockFame: number; buy: number
  growDays: number; yield: number; price: number; water: number
}
export interface CfgAnimal {
  id: string; name: string; emoji: string; unlockFame: number; buy: number; sell: number
  product: string; productEmoji: string; produceDays: number; feed: number; desc: string
}
export interface CfgProduct {
  id: string; name: string; emoji: string; basePrice: number
}
export interface CfgFish {
  id: string; name: string; emoji: string; unlockFame: number; fryCost: number; catchPrice: number
}
export interface CfgWeather {
  id: string; name: string; emoji: string; growth: number; fishMult: number; desc: string
}
export interface CfgWildlife {
  id: string; name: string; emoji: string; kind: "benefit" | "harm"; desc: string; source: string
}
export interface CfgDecor {
  id: string; name: string; emoji: string; cost: number; effect: string; slot: string
}
export interface CfgStaff {
  id: string; name: string; emoji: string; wage: number; desc: string
}
export interface CfgExtra {
  id: string; name: string; emoji: string; cost: number; effect: string
}
export interface CfgBalance {
  dayLength: number; taxInterval: number; taxBase: number; taxPerTile: number
  taxPerAnimal: number; taxPerStaff: number; taxInterest: number
  storageBase: number; initialCoins: number; initialRows: number; cols: number; maxRows: number
  rowCostBase: number; rowCostPer: number
  pondDigCost: number; pasturePrepCost: number; backToSoilCost: number
  fishRegenPerDay: number; fishMaxStock: number
  animalQualityMax: number; cropQualityMax: number; qualityPriceMult: number
  breedCostBase: number; breedChanceBase: number; breedChancePerQuality: number
  pesticideDays: number
  fishing: { dur: number; zoneW: number; missChanceWeatherMult: number }
}

type GameConfig = {
  balance: CfgBalance
  crops: CfgCrop[]
  animals: CfgAnimal[]
  products: CfgProduct[]
  fish: CfgFish[]
  weather: CfgWeather[]
  wildlife: CfgWildlife[]
  decorations: CfgDecor[]
  staff: CfgStaff[]
  extras: CfgExtra[]
}

export const CONFIG = cfg as GameConfig

export const W = 480
export const H = 854

export const CELL = 64
export const GAP = 4
export const TILE = CELL + GAP
export const GRID_MARGIN = 8

export const COLS = CONFIG.balance.cols
export const START_ROWS = CONFIG.balance.initialRows
export const MAX_ROWS = CONFIG.balance.maxRows

export function worldW(): number {
  return COLS * TILE + GRID_MARGIN * 2
}
export function worldH(rows: number): number {
  return rows * TILE + GRID_MARGIN * 2
}

export function tileWorldX(c: number): number {
  return GRID_MARGIN + c * TILE
}
export function tileWorldY(r: number): number {
  return GRID_MARGIN + r * TILE
}
export function tileCenterWorldX(c: number): number {
  return tileWorldX(c) + CELL / 2
}
export function tileCenterWorldY(r: number): number {
  return tileWorldY(r) + CELL / 2
}

// Layout de pantalla (fase granja)
export const TOP_H = 112
export const WORLD_TOP = TOP_H + 4
export const TOOLBAR_H = 96
export const PICKER_H = 54
export const WORLD_BOTTOM = H - TOOLBAR_H - 6
export const VIEW_H = WORLD_BOTTOM - WORLD_TOP
export const NAV_H = 96

export const DAY_LENGTH = CONFIG.balance.dayLength
export const TAX_INTERVAL = CONFIG.balance.taxInterval
export const QUALITY_MAX = CONFIG.balance.animalQualityMax
export const QUALITY_PRICE_MULT = CONFIG.balance.qualityPriceMult

export const ACCENT = "#7cff5a"
export const ACCENT_DARK = "#2e7d32"

// Movimiento del personaje
export const WALK_SPEED = 150
export const RUN_SPEED = 240
export const RUN_THRESHOLD = 260

export const TOOLS: Array<{ id: Tool; glyph: string; label: string; work: number }> = [
  { id: "hand", glyph: "👋", label: "Mover", work: 0 },
  { id: "plow", glyph: "🪓", label: "Arar", work: 0.7 },
  { id: "plant", glyph: "🌱", label: "Sembrar", work: 0.55 },
  { id: "water", glyph: "💧", label: "Regar", work: 0.6 },
  { id: "harvest", glyph: "🌾", label: "Cosechar", work: 0.7 },
  { id: "fish", glyph: "🎣", label: "Pescar", work: 0.7 },
  { id: "criar", glyph: "🐔", label: "Criar", work: 0.5 },
  { id: "build", glyph: "🏗️", label: "Construir", work: 0.9 },
]

export const TOOL_WORK: Record<Tool, number> = Object.fromEntries(TOOLS.map(t => [t.id, t.work])) as Record<Tool, number>

export const weatherDef = (id: string): CfgWeather => CONFIG.weather.find(w => w.id === id) ?? CONFIG.weather[0]
export const cropDef = (id: string): CfgCrop | undefined => CONFIG.crops.find(c => c.id === id)
export const animalDef = (id: string): CfgAnimal | undefined => CONFIG.animals.find(a => a.id === id)
export const fishDef = (id: string): CfgFish | undefined => CONFIG.fish.find(f => f.id === id)
export const productDef = (id: string): CfgProduct | undefined => CONFIG.products.find(p => p.id === id)
export const staffDef = (id: string): CfgStaff | undefined => CONFIG.staff.find(s => s.id === id)
export const decorDef = (id: string): CfgDecor | undefined => CONFIG.decorations.find(d => d.id === id)
export const wildlifeDef = (id: string): CfgWildlife | undefined => CONFIG.wildlife.find(w => w.id === id)
export const extraDef = (id: string): CfgExtra | undefined => CONFIG.extras.find(e => e.id === id)

// Catálogo de construcción (terreno + decoraciones)
export const BUILDINGS: CfgDecor[] = [
  { id: "cerco", name: "Valla", emoji: "🚧", cost: CONFIG.balance.pondDigCost + 40, effect: "Protege de zorros.", slot: "harm" },
  { id: "estanque", name: "Estanque", emoji: "🌊", cost: CONFIG.balance.pondDigCost, effect: "Permite pescar.", slot: "terrain" },
  { id: "pastizal", name: "Pastizal", emoji: "🌿", cost: CONFIG.balance.pasturePrepCost, effect: "Permite criar animales.", slot: "terrain" },
  { id: "espantapajaros", name: "Espantapájaros", emoji: "🧙", cost: 80, effect: "Ahuyenta jabalíes.", slot: "harm" },
  { id: "colmena", name: "Colmena", emoji: "🐝", cost: 150, effect: "Atrae abejas: +15% cosechas.", slot: "boost" },
  { id: "flores", name: "Flores", emoji: "🌻", cost: 120, effect: "Atrae mariquitas y alegra animales.", slot: "boost" },
  { id: "composta", name: "Composta", emoji: "🪵", cost: 140, effect: "Atrae lombrices: +10% crecimiento.", slot: "boost" },
  { id: "molino", name: "Molino", emoji: "🎡", cost: 400, effect: "+10% de ingresos en el mercado.", slot: "income" },
  { id: "granero", name: "Granero", emoji: "🏠", cost: 600, effect: "+40 de almacén.", slot: "storage" },
  { id: "letrero", name: "Letrero", emoji: "🪧", cost: 50, effect: "Decorativo.", slot: "decor" },
]

export function buildCost(id: string): number {
  const b = BUILDINGS.find(x => x.id === id)
  return b ? b.cost : 0
}

export function rowCost(rows: number): number {
  return CONFIG.balance.rowCostBase + rows * CONFIG.balance.rowCostPer
}

export function qualityMult(q: number): number {
  return 1 + Math.max(0, q - 1) * QUALITY_PRICE_MULT
}

export function cropQualityMax(): number {
  return CONFIG.balance.cropQualityMax
}

export function animalQualityMax(): number {
  return CONFIG.balance.animalQualityMax
}

export function breedChance(q: number): number {
  return Math.min(0.92, CONFIG.balance.breedChanceBase + (q - 1) * CONFIG.balance.breedChancePerQuality)
}

export function breedCost(q: number): number {
  return CONFIG.balance.breedCostBase + q * 20
}

export const GRANERO_STORAGE_BONUS = 40

export function storageMax(s: { decorations: Record<string, number>; storageMax: number }): number {
  const graneros = s.decorations["granero"] ?? 0
  return s.storageMax + graneros * GRANERO_STORAGE_BONUS
}

export function farmLevel(fame: number): number {
  return 1 + Math.floor(Math.sqrt(fame / 500))
}