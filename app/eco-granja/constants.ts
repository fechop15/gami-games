import cfg from "./config.json"

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

export const TOP_H = 132
export const NAV_H = 96
export const FARM_TOP = 178
export const FARM_BOTTOM = H - NAV_H - 10
export const DECOR_TOP = 140
export const DECOR_H = 34

export const COLS = CONFIG.balance.cols
export const MAX_ROWS = CONFIG.balance.maxRows

export const CELL = 84
export const CELL_GAP = 5
export const GRID_MARGIN_X = Math.round((W - (COLS * CELL + (COLS - 1) * CELL_GAP)) / 2)

export const DAY_LENGTH = CONFIG.balance.dayLength
export const TAX_INTERVAL = CONFIG.balance.taxInterval
export const QUALITY_MAX = CONFIG.balance.animalQualityMax
export const QUALITY_PRICE_MULT = CONFIG.balance.qualityPriceMult

export const ACCENT = "#7cff5a"
export const ACCENT_DARK = "#2e7d32"

export const NAV_TABS = [
  { action: "tab:farm", label: "Granja", glyph: "🏡" },
  { action: "tab:shop", label: "Tienda", glyph: "🛒" },
  { action: "tab:market", label: "Mercado", glyph: "💰" },
  { action: "tab:staff", label: "Personal", glyph: "👷" },
  { action: "tab:eco", label: "Ecosistema", glyph: "🦊" },
] as const

export const weatherDef = (id: string): CfgWeather => CONFIG.weather.find(w => w.id === id) ?? CONFIG.weather[0]
export const cropDef = (id: string): CfgCrop | undefined => CONFIG.crops.find(c => c.id === id)
export const animalDef = (id: string): CfgAnimal | undefined => CONFIG.animals.find(a => a.id === id)
export const fishDef = (id: string): CfgFish | undefined => CONFIG.fish.find(f => f.id === id)
export const productDef = (id: string): CfgProduct | undefined => CONFIG.products.find(p => p.id === id)
export const staffDef = (id: string): CfgStaff | undefined => CONFIG.staff.find(s => s.id === id)
export const decorDef = (id: string): CfgDecor | undefined => CONFIG.decorations.find(d => d.id === id)
export const wildlifeDef = (id: string): CfgWildlife | undefined => CONFIG.wildlife.find(w => w.id === id)
export const extraDef = (id: string): CfgExtra | undefined => CONFIG.extras.find(e => e.id === id)

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
  // nivel aproximado por fama total
  return 1 + Math.floor(Math.sqrt(fame / 500))
}