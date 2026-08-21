import {
  advanceDay, requestMove, requestAction, closeSheet,
  feedAnimal, sellAnimal, startBreed, doBreed,
  buySeed, buyAnimal, buyFish, buyDecor, buyExtra, buyExpansion,
  sellProduct, sellAll, hireStaff, fireStaff, payTaxes, resetFarm,
  resolveFishing,
} from "./engine"
import { screenToWorld } from "./draw"
import { SHEET_TOP, SHEET_H } from "./ui"
import { BUILDINGS } from "./constants"
import { sfx, unlockAudio, toggleMute } from "../lib/sound"
import type { GS, Tool } from "./types"

function inRect(b: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
}

function isModalAction(action: string): boolean {
  return action.startsWith("modal:") || action.startsWith("tax:") || action.startsWith("reset:")
}

export function handleTap(gs: GS, x: number, y: number) {
  unlockAudio()

  // modal abierto: solo botones del modal
  if (gs.modal !== "none") {
    for (let i = gs.btns.length - 1; i >= 0; i--) {
      const b = gs.btns[i]
      if (inRect(b, x, y) && isModalAction(b.action)) { runAction(gs, b.action); return }
    }
    return
  }

  // botones de la interfaz (últimos dibujados = encima)
  for (let i = gs.btns.length - 1; i >= 0; i--) {
    const b = gs.btns[i]
    if (inRect(b, x, y)) { runAction(gs, b.action); return }
  }

  // interacción con el mundo
  if (gs.phase === "farm") {
    if (gs.fishing.active) {
      if (!gs.fishing.done) resolveFishing(gs)
      return
    }
    if (gs.sheet !== "none") {
      if (y < SHEET_TOP || y > SHEET_TOP + SHEET_H) closeSheet(gs)
      return
    }
    if (gs.player.working) return
    const w = screenToWorld(gs, x, y)
    if (gs.tool === "hand") requestMove(gs, w.x, w.y)
    else requestAction(gs, gs.tool, w.x, w.y)
  }
}

function defaultOptionFor(tool: Tool, gs: GS): string | null {
  switch (tool) {
    case "plant": return gs.save.unlockedCrops[0] ?? null
    case "build": return BUILDINGS[0]?.id ?? null
    case "criar": return gs.save.unlockedAnimals[0] ?? null
    case "fish": return gs.save.unlockedFish[0] ?? null
    default: return null
  }
}

function runAction(gs: GS, action: string) {
  const parts = action.split(":")
  const head = parts[0]

  switch (head) {
    case "intro":
      if (parts[1] === "play") { sfx.click(); gs.phase = "farm" }
      return
    case "mute":
      gs.muted = toggleMute()
      return
    case "modal":
      if (parts[1] === "close") { gs.modal = "none"; return }
      if (parts[1] === "tax") { sfx.click(); gs.modal = "tax"; return }
      if (parts[1] === "help") { sfx.click(); gs.modal = "help"; return }
      return
    case "day":
      if (parts[1] === "advance") { sfx.whoosh(); advanceDay(gs) }
      return
    case "tool": {
      const t = parts[1] as Tool
      sfx.click()
      gs.pending = null
      gs.queue = []
      if (t === gs.tool) { gs.tool = "hand"; gs.selOption = null }
      else {
        gs.tool = t
        gs.selOption = defaultOptionFor(t, gs)
      }
      return
    }
    case "pick":
      sfx.click()
      gs.selOption = parts[1] ?? null
      return
    case "sheet":
      if (parts[1] === "close") { sfx.click(); closeSheet(gs) }
      return
    case "feed":
      sfx.pop(); feedAnimal(gs, parseInt(parts[1], 10), parseInt(parts[2], 10))
      return
    case "sellanimal":
      sfx.coin(); sellAnimal(gs, parseInt(parts[1], 10), parseInt(parts[2], 10))
      return
    case "breed":
      sfx.click(); startBreed(gs, parseInt(parts[1], 10), parseInt(parts[2], 10))
      return
    case "dobreed":
      doBreed(gs, parseInt(parts[1], 10), parseInt(parts[2], 10), parseInt(parts[3], 10), parseInt(parts[4], 10))
      return
    case "shop":
      if (parts[1] === "tab") { sfx.click(); gs.shopTab = parts[2] as GS["shopTab"]; gs.listScroll = 0; return }
      if (parts[1] === "expand") { sfx.coin(); buyExpansion(gs); return }
      if (parts[1] === "seed") { sfx.click(); buySeed(gs, parts[2]); return }
      if (parts[1] === "animal") { sfx.click(); buyAnimal(gs, parts[2]); return }
      if (parts[1] === "fish") { sfx.click(); buyFish(gs, parts[2]); return }
      if (parts[1] === "decor") { sfx.coin(); buyDecor(gs, parts[2]); return }
      if (parts[1] === "extra") { sfx.click(); buyExtra(gs, parts[2]); return }
      return
    case "market":
      if (parts[1] === "sellall") { sfx.coin(); sellAll(gs); return }
      if (parts[1] === "sell") { sfx.coin(); sellProduct(gs, parts[2]); return }
      return
    case "staff":
      if (parts[1] === "hire") { sfx.click(); hireStaff(gs, parts[2]); return }
      if (parts[1] === "fire") { sfx.error(); fireStaff(gs, parts[2]); return }
      return
    case "tax":
      if (parts[1] === "pay") { sfx.coin(); payTaxes(gs); return }
      return
    case "reset":
      if (parts[1] === "ask") { sfx.click(); gs.modal = "confirm"; return }
      if (parts[1] === "yes") { sfx.gameover(); resetFarm(gs); return }
      return
    case "tab": {
      const target = parts[1] as string
      sfx.click()
      gs.phase = target === "farm" ? "farm" : target as GS["phase"]
      gs.sheet = "none"
      gs.menuTile = null
      gs.breedTarget = null
      gs.pending = null
      gs.listScroll = 0
      gs.fishing.active = false
      gs.fishing.done = false
      gs.fishing.result = null
      return
    }
  }
}