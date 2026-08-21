import {
  advanceDay, tapTile, closeSheet, plantSeed, waterTile, fertilizeTile, harvestTile, uprootTile,
  digPond, prepPasture, backToSoil, buyAnimalAt, feedAnimal, sellAnimal, startBreed, doBreed,
  stockFish, startFishing, resolveFishing,
  buySeed, buyAnimal, buyFish, buyDecor, buyExtra, buyExpansion,
  sellProduct, sellAll, hireStaff, fireStaff, payTaxes, resetFarm,
  tileAt,
} from "./engine"
import { SHEET_TOP, SHEET_H } from "./ui"
import { sfx, unlockAudio, toggleMute } from "../lib/sound"
import type { GS } from "./types"

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

  // interacción con la granja
  if (gs.phase === "farm") {
    if (gs.fishing.active) {
      if (!gs.fishing.done) resolveFishing(gs)
      return
    }
    if (gs.sheet !== "none") {
      if (y < SHEET_TOP || y > SHEET_TOP + SHEET_H) closeSheet(gs)
      return
    }
    const tile = tileAt(gs, x, y)
    if (tile) tapTile(gs, tile.r, tile.c)
  }
}

function runAction(gs: GS, action: string) {
  const [head, a1, a2, a3, a4] = action.split(":")

  switch (head) {
    case "intro":
      if (a1 === "play") { sfx.click(); gs.phase = "farm" }
      return
    case "mute":
      gs.muted = toggleMute()
      return
    case "modal":
      if (a1 === "close") { gs.modal = "none"; return }
      if (a1 === "tax") { sfx.click(); gs.modal = "tax"; return }
      return
    case "day":
      if (a1 === "advance") { sfx.whoosh(); advanceDay(gs) }
      return
    case "sheet":
      if (a1 === "close") { sfx.click(); closeSheet(gs) }
      return
    case "plant":
      sfx.pop(); plantSeed(gs, parseInt(a3, 10), parseInt(a4, 10), a1)
      return
    case "dig":
      sfx.pop(); digPond(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "pasture":
      sfx.pop(); prepPasture(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "water":
      sfx.pop(); waterTile(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "fert":
      sfx.pop(); fertilizeTile(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "harvest":
      sfx.coin(); harvestTile(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "uproot":
      sfx.error(); uprootTile(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "animal":
      sfx.pop(); buyAnimalAt(gs, parseInt(a2, 10), parseInt(a3, 10), a1)
      return
    case "feed":
      sfx.pop(); feedAnimal(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "sellanimal":
      sfx.coin(); sellAnimal(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "breed":
      sfx.click(); startBreed(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "dobreed":
      doBreed(gs, parseInt(a1, 10), parseInt(a2, 10), parseInt(a3, 10), parseInt(a4, 10))
      return
    case "backsoil":
      sfx.pop(); backToSoil(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "fish":
      sfx.whoosh(); startFishing(gs, parseInt(a1, 10), parseInt(a2, 10))
      return
    case "stock":
      sfx.pop(); stockFish(gs, parseInt(a2, 10), parseInt(a3, 10), a1)
      return
    case "shop":
      if (a1 === "tab") { sfx.click(); gs.shopTab = a2 as GS["shopTab"]; gs.listScroll = 0; return }
      if (a1 === "expand") { sfx.coin(); buyExpansion(gs); return }
      if (a1 === "seed") { sfx.click(); buySeed(gs, a2); return }
      if (a1 === "animal") { sfx.click(); buyAnimal(gs, a2); return }
      if (a1 === "fish") { sfx.click(); buyFish(gs, a2); return }
      if (a1 === "decor") { sfx.coin(); buyDecor(gs, a2); return }
      if (a1 === "extra") { sfx.click(); buyExtra(gs, a2); return }
      return
    case "market":
      if (a1 === "sellall") { sfx.coin(); sellAll(gs); return }
      if (a1 === "sell") { sfx.coin(); sellProduct(gs, a2); return }
      return
    case "staff":
      if (a1 === "hire") { sfx.click(); hireStaff(gs, a2); return }
      if (a1 === "fire") { sfx.error(); fireStaff(gs, a2); return }
      return
    case "tax":
      if (a1 === "pay") { sfx.coin(); payTaxes(gs); return }
      return
    case "reset":
      if (a1 === "ask") { sfx.click(); gs.modal = "confirm"; return }
      if (a1 === "yes") { sfx.gameover(); resetFarm(gs); return }
      return
    case "tab": {
      const target = a1 as string
      sfx.click()
      gs.phase = target === "farm" ? "farm" : target as GS["phase"]
      gs.sheet = "none"
      gs.selTile = null
      gs.breedTarget = null
      gs.listScroll = 0
      gs.fishing.active = false
      gs.fishing.done = false
      gs.fishing.result = null
      return
    }
  }
}