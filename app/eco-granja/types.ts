import type { EcoSave } from "./save"

export type Phase = "intro" | "farm" | "shop" | "market" | "staff" | "eco"

export type ShopTab = "seeds" | "animals" | "fish" | "decor" | "extras"

export type Tool = "hand" | "plow" | "plant" | "water" | "harvest" | "fish" | "criar" | "build"

export type SheetKind = "none" | "animal" | "breed"

export type ModalKind = "none" | "day" | "tax" | "confirm" | "help"

export interface BtnArea { x: number; y: number; w: number; h: number }

export interface Btn extends BtnArea { action: string }

export interface PlayerState {
  x: number
  y: number
  tx: number
  ty: number
  moving: boolean
  facing: 1 | -1
  animT: number
  working: boolean
  workT: number
  workTool: Tool
}

export interface PendingAction {
  r: number
  c: number
  tool: Tool
  opt: string | null
}

export interface Floater {
  x: number; y: number; vy: number; life: number; maxLife: number
  text: string; color: string; size: number
}

export interface RainDrop {
  x: number; y: number; len: number; spd: number
}

export interface SnowFlake {
  x: number; y: number; r: number; spd: number; sway: number
}

export interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; r: number
}

export interface FishingState {
  active: boolean
  t: number
  dur: number
  zone: number      // centro de la zona dorada (0-1)
  zoneW: number     // ancho de la zona dorada (0-1)
  done: boolean
  result: "perfect" | "ok" | "miss" | null
  pondR: number
  pondC: number
}

export interface GS {
  phase: Phase
  save: EcoSave
  lastTime: number
  time: number
  dayTime: number
  isTouching: boolean
  camX: number
  camY: number
  player: PlayerState
  tool: Tool
  selOption: string | null
  pending: PendingAction | null
  menuTile: { r: number; c: number } | null
  breedTarget: { r: number; c: number } | null
  sheet: SheetKind
  modal: ModalKind
  confirmAction: string | null
  shopTab: ShopTab
  listScroll: number
  listDragBase: number
  btns: Btn[]
  floaters: Floater[]
  sparks: Spark[]
  rain: RainDrop[]
  snow: SnowFlake[]
  fishing: FishingState
  flashMsg: string
  flashT: number
  dayLog: string[]
  muted: boolean
  lightningT: number
  savedAt: number
}

export interface InvEntry {
  key: string
  productId: string
  quality: number
  qty: number
}