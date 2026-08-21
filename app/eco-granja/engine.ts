import { writeEcoSave, loadEcoSave, invKey, inventoryUsed, type TileState, type EcoSave } from "./save"
import {
  CONFIG, DAY_LENGTH, TAX_INTERVAL, W, H,
  cropDef, animalDef, fishDef, productDef, staffDef, weatherDef, extraDef, decorDef,
  rowCost, breedChance, breedCost, qualityMult, storageMax, animalQualityMax, cropQualityMax,
  CELL, GAP, COLS, GRID_MARGIN, WORLD_TOP, VIEW_H,
  TOOL_WORK, BUILDINGS, WALK_SPEED, RUN_SPEED, RUN_THRESHOLD,
  tileWorldX, tileWorldY, tileCenterWorldX, tileCenterWorldY, worldW, worldH,
} from "./constants"
import type { GS, Tool, PlayerState } from "./types"

const ACCENT_TXT = "#7cff5a"
const TILE_STRIDE = CELL + GAP

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(a: number, b: number): number { return a + Math.random() * (b - a) }
function chance(p: number): boolean { return Math.random() < p }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

export function eachTile(save: EcoSave, fn: (t: TileState, r: number, c: number) => void) {
  for (let r = 0; r < save.tiles.length; r++)
    for (let c = 0; c < save.tiles[r].length; c++) fn(save.tiles[r][c], r, c)
}

export function countCrops(save: EcoSave): number {
  let n = 0
  eachTile(save, t => { if (t.cropId) n++ })
  return n
}

export function countAnimals(save: EcoSave): number {
  let n = 0
  eachTile(save, t => { if (t.animalId) n++ })
  return n
}

export function countSpecies(save: EcoSave, animalId: string): number {
  let n = 0
  eachTile(save, t => { if (t.animalId === animalId) n++ })
  return n
}

export function countTiles(save: EcoSave): number {
  return save.tiles.reduce((s, row) => s + row.length, 0)
}

export function wildlifeCount(save: EcoSave, id: string): number {
  return save.wildlife[id] ?? 0
}

function pushFloater(gs: GS, x: number, y: number, text: string, color: string, size = 15) {
  gs.floaters.push({ x, y, vy: -34, life: 1.3, maxLife: 1.3, text, color, size })
}

function pushSparks(gs: GS, x: number, y: number, color: string, n = 8) {
  for (let i = 0; i < n; i++) {
    gs.sparks.push({
      x, y,
      vx: rand(-60, 60), vy: rand(-90, -20),
      life: rand(0.4, 0.9), maxLife: 0.9, color, r: rand(2, 4),
    })
  }
}

function addToInventory(gs: GS, productId: string, quality: number, qty: number): boolean {
  const cap = storageMax(gs.save)
  const used = inventoryUsed(gs.save)
  const free = cap - used
  if (qty > free) {
    if (free > 0) {
      const key = invKey(productId, quality)
      gs.save.inventory[key] = (gs.save.inventory[key] ?? 0) + free
      flash(gs, "¡Almacén lleno!")
    }
    return false
  }
  const key = invKey(productId, quality)
  gs.save.inventory[key] = (gs.save.inventory[key] ?? 0) + qty
  return true
}

function log(gs: GS, text: string) {
  if (gs.dayLog.length >= 10) gs.dayLog.shift()
  gs.dayLog.push(text)
}

function persist(gs: GS) {
  writeEcoSave(gs.save)
  gs.savedAt = gs.time
}

export function flash(gs: GS, msg: string) {
  gs.flashMsg = msg
  gs.flashT = 1.6
}

// ---------------------------------------------------------------------------
// GS factory
// ---------------------------------------------------------------------------

export function makeGS(): GS {
  const save = loadEcoSave()
  const rows = save.tiles.length
  const cols = save.tiles[0]?.length ?? COLS
  const spawnX = tileCenterWorldX(Math.min(3, cols - 1))
  const spawnY = tileCenterWorldY(Math.min(3, rows - 1))
  return {
    phase: "intro",
    save,
    lastTime: 0,
    time: 0,
    dayTime: 0,
    isTouching: false,
    camX: 0,
    camY: 0,
    player: makePlayer(spawnX, spawnY),
    tool: "hand",
    selOption: null,
    pending: null,
    menuTile: null,
    breedTarget: null,
    sheet: "none",
    modal: "none",
    confirmAction: null,
    shopTab: "seeds",
    listScroll: 0,
    listDragBase: 0,
    btns: [],
    floaters: [],
    sparks: [],
    rain: [],
    snow: [],
    fishing: { active: false, t: 0, dur: CONFIG.balance.fishing.dur, zone: 0.5, zoneW: CONFIG.balance.fishing.zoneW, done: false, result: null, pondR: -1, pondC: -1 },
    flashMsg: "",
    flashT: 0,
    dayLog: [],
    muted: false,
    lightningT: 0,
    savedAt: 0,
  }
}

function makePlayer(x: number, y: number): PlayerState {
  return { x, y, tx: x, ty: y, moving: false, facing: 1, animT: 0, working: false, workT: 0, workTool: "hand" }
}

// ---------------------------------------------------------------------------
// Update (por frame)
// ---------------------------------------------------------------------------

export function update(gs: GS, dt: number) {
  gs.time += dt
  gs.dayTime += dt

  if (gs.flashT > 0) gs.flashT -= dt

  // personaje: movimiento y trabajo
  updatePlayer(gs, dt)
  updateCamera(gs, dt)

  // floaters
  for (let i = gs.floaters.length - 1; i >= 0; i--) {
    const f = gs.floaters[i]
    f.life -= dt
    f.y += f.vy * dt
    if (f.life <= 0) gs.floaters.splice(i, 1)
  }
  // sparks
  for (let i = gs.sparks.length - 1; i >= 0; i--) {
    const s = gs.sparks[i]
    s.life -= dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.vy += 120 * dt
    if (s.life <= 0) gs.sparks.splice(i, 1)
  }

  // weather particles
  const w = weatherDef(gs.save.weather)
  if (gs.phase === "farm" || gs.phase === "intro") {
    if (w.id === "lluvia" || w.id === "tormenta") {
      if (gs.rain.length < 60 && chance(dt * 40)) {
        gs.rain.push({ x: rand(0, W), y: rand(-30, 0), len: rand(12, 22), spd: rand(600, 900) })
      }
    } else {
      gs.rain.length = 0
    }
    if (w.id === "helada") {
      if (gs.snow.length < 50 && chance(dt * 30)) {
        gs.snow.push({ x: rand(0, W), y: rand(-30, 0), r: rand(1.5, 3.5), spd: rand(30, 70), sway: rand(0, Math.PI * 2) })
      }
    } else {
      gs.snow.length = 0
    }
    for (let i = gs.rain.length - 1; i >= 0; i--) {
      const d = gs.rain[i]
      d.y += d.spd * dt
      d.x += (w.id === "tormenta" ? 60 : 15) * dt
      if (d.y > H + 20) gs.rain.splice(i, 1)
    }
    for (let i = gs.snow.length - 1; i >= 0; i--) {
      const s = gs.snow[i]
      s.y += s.spd * dt
      s.x += Math.sin(gs.time * 1.5 + s.sway) * 20 * dt
      if (s.y > H + 20) gs.snow.splice(i, 1)
    }
  }
  if (gs.lightningT > 0) gs.lightningT -= dt
  if (w.id === "tormenta" && chance(dt * 0.5)) gs.lightningT = 0.14

  // fishing mini-game
  if (gs.fishing.active) {
    if (!gs.fishing.done) {
      gs.fishing.t += dt
      if (gs.fishing.t >= gs.fishing.dur) {
        resolveFishing(gs)
      }
    } else if (gs.fishing.t >= gs.fishing.dur + 1.2) {
      gs.fishing.active = false
      gs.fishing.done = false
      gs.fishing.result = null
    }
  }

  // auto day advance
  if (gs.phase === "farm" && gs.modal === "none" && !gs.fishing.active && !gs.player.working && gs.dayTime >= DAY_LENGTH) {
    gs.dayTime = 0
    endOfDay(gs)
  }
}

function updatePlayer(gs: GS, dt: number) {
  const p = gs.player

  if (p.working) {
    p.animT += dt * 12
    p.workT -= dt
    if (p.workT <= 0) {
      p.working = false
      executePending(gs)
    }
    return
  }

  const dx = p.tx - p.x
  const dy = p.ty - p.y
  const dist = Math.hypot(dx, dy)
  if (dist > 3) {
    p.moving = true
    const speed = dist > RUN_THRESHOLD ? RUN_SPEED : WALK_SPEED
    const nx = dx / dist
    const ny = dy / dist
    p.x += nx * speed * dt
    p.y += ny * speed * dt
    if (nx !== 0) p.facing = nx > 0 ? 1 : -1
    p.animT += dt * (speed / 60)
    const ndx = p.tx - p.x
    const ndy = p.ty - p.y
    if (Math.hypot(ndx, ndy) <= 3) { p.x = p.tx; p.y = p.ty }
  } else if (p.moving) {
    p.moving = false
    p.x = p.tx
    p.y = p.ty
  }

  // si hay una acción pendiente y el personaje ya está en la parcela, empezar a trabajar
  if (!p.working && gs.pending) {
    const pd = gs.pending
    const wx = tileCenterWorldX(pd.c)
    const wy = tileCenterWorldY(pd.r)
    if (Math.hypot(p.x - wx, p.y - wy) < 4) {
      p.working = true
      p.workT = TOOL_WORK[pd.tool]
      p.workTool = pd.tool
      p.animT = 0
    }
  }
}

function updateCamera(gs: GS, dt: number) {
  const rows = gs.save.tiles.length
  const maxX = Math.max(0, worldW() - W)
  const maxY = Math.max(0, worldH(rows) - VIEW_H)
  const targetX = Math.max(0, Math.min(gs.player.x - W / 2, maxX))
  const targetY = Math.max(0, Math.min(gs.player.y - WORLD_TOP - VIEW_H / 2, maxY))
  const k = Math.min(1, dt * 6)
  gs.camX += (targetX - gs.camX) * k
  gs.camY += (targetY - gs.camY) * k
  gs.camX = Math.max(0, Math.min(gs.camX, maxX))
  gs.camY = Math.max(0, Math.min(gs.camY, maxY))
}

// ---------------------------------------------------------------------------
// Movimiento y acciones con herramientas
// ---------------------------------------------------------------------------

export function requestMove(gs: GS, wx: number, wy: number) {
  const rows = gs.save.tiles.length
  const cols = gs.save.tiles[0]?.length ?? COLS
  const p = gs.player
  p.tx = Math.max(GRID_MARGIN - 8, Math.min(wx, GRID_MARGIN + cols * TILE_STRIDE - CELL + 8))
  p.ty = Math.max(GRID_MARGIN - 8, Math.min(wy, GRID_MARGIN + rows * TILE_STRIDE - CELL + 8))
  gs.pending = null
}

export function requestAction(gs: GS, tool: Tool, wx: number, wy: number) {
  const tile = tileAt(gs, wx, wy)
  if (!tile) return
  const t = gs.save.tiles[tile.r][tile.c]
  const opt = gs.selOption

  const valid = (() => {
    switch (tool) {
      case "hand": return true
      case "plow": return t.kind === "grass" && !t.building
      case "plant": return t.kind === "soil" && !t.cropId && !t.building && !!opt
      case "water": return t.kind === "soil" && !!t.cropId && !t.wateredToday
      case "harvest": return t.kind === "soil" && !!t.cropId && (t.cropProgress ?? 0) >= 1
      case "fish": {
        if (t.kind !== "pond") return false
        if (t.pondFish && (t.pondStock ?? 0) > 0) return true
        if (!t.pondFish && !!opt) return true
        return false
      }
      case "criar": return t.kind === "pasture" && (!t.animalId ? !!opt : true)
      case "build": return (t.kind === "grass" || t.kind === "soil") && !t.building && !t.cropId && !!opt
    }
  })()

  if (!valid) {
    if (tool === "plow") flash(gs, "Aquí no hay hierba que arar")
    else if (tool === "plant") flash(gs, "Necesitas tierra arada y una semilla")
    else if (tool === "water") flash(gs, "No hay cultivo para regar")
    else if (tool === "harvest") flash(gs, "No hay cultivo listo")
    else if (tool === "fish") flash(gs, !t.pondFish ? "Elige un pez para sembrar" : "Sin peces en el estanque")
    else if (tool === "build") flash(gs, "No se puede construir aquí")
    else if (tool === "criar") flash(gs, "Elige un pastizal")
    return
  }

  // mover al centro de la parcela y encolar la acción
  gs.pending = { r: tile.r, c: tile.c, tool, opt }
  const p = gs.player
  p.tx = tileCenterWorldX(tile.c)
  p.ty = tileCenterWorldY(tile.r)
}

export function tileAt(gs: GS, wx: number, wy: number): { r: number; c: number } | null {
  const rows = gs.save.tiles.length
  for (let r = 0; r < rows; r++) {
    const ty = tileWorldY(r)
    if (wx >= tileWorldX(0) - 4 && wx <= tileWorldX(0) + COLS * TILE_STRIDE + 4 && wy >= ty && wy < ty + CELL) {
      for (let c = 0; c < COLS; c++) {
        const tx = tileWorldX(c)
        if (wx >= tx && wx < tx + CELL) return { r, c }
      }
      return null
    }
  }
  return null
}

function executePending(gs: GS) {
  const p = gs.pending
  if (!p) return
  const t = gs.save.tiles[p.r]?.[p.c]
  if (t) {
    switch (p.tool) {
      case "plow": plowTile(gs, p.r, p.c); break
      case "plant": plantSeed(gs, p.r, p.c, p.opt ?? ""); break
      case "water": waterTile(gs, p.r, p.c); break
      case "harvest": harvestTile(gs, p.r, p.c); break
      case "fish": {
        if (t.pondFish && (t.pondStock ?? 0) > 0) startFishing(gs, p.r, p.c)
        else if (!t.pondFish && p.opt) stockFish(gs, p.r, p.c, p.opt)
        break
      }
      case "criar": {
        if (t.animalId) {
          gs.menuTile = { r: p.r, c: p.c }
          gs.sheet = "animal"
        } else if (p.opt) {
          buyAnimalAt(gs, p.r, p.c, p.opt)
        }
        break
      }
      case "build": placeBuilding(gs, p.r, p.c, p.opt ?? ""); break
      case "hand": break
    }
  }
  gs.pending = null
  gs.sheet = "none"
}

// ---------------------------------------------------------------------------
// Day cycle
// ---------------------------------------------------------------------------

function rollWeather(gs: GS) {
  const s = gs.save
  s.weatherDays++
  if (chance(0.45)) {
    s.weather = pick(CONFIG.weather).id
    s.weatherDays = 0
  }
}

function waterAll(gs: GS) {
  eachTile(gs.save, t => { if (t.cropId) t.wateredToday = true })
}

export function endOfDay(gs: GS) {
  const s = gs.save
  gs.dayLog = []
  s.day++
  s.repelenteT = Math.max(0, s.repelenteT - 1)

  const w = weatherDef(s.weather)
  if (w.id === "lluvia" || w.id === "tormenta") waterAll(gs)

  const worms = wildlifeCount(s, "lombriz")

  // ---- cultivos ----
  let harvestedAny = false
  eachTile(s, t => {
    if (!t.cropId) return
    const crop = cropDef(t.cropId)!
    const watered = !!t.wateredToday
    if (watered) t.cropWater = (t.cropWater ?? 0) + 1
    t.cropDays = (t.cropDays ?? 0) + 1

    if (w.id === "tormenta" && chance(0.12)) {
      t.cropProgress = Math.max(0, (t.cropProgress ?? 0) - 0.2)
      log(gs, `⛈️ La tormenta dañó un ${crop.name}`)
    }
    if (w.id === "helada" && !watered && chance(0.22)) {
      clearCrop(t)
      log(gs, `❄️ Un ${crop.name} se heló sin regar`)
      return
    }
    if ((w.id === "sequia" || w.id === "calor") && !watered && chance(0.1)) {
      clearCrop(t)
      log(gs, `🏜️ Un ${crop.name} se marchitó por la sequía`)
      return
    }

    const base = 1 / crop.growDays
    const wateredMult = watered ? 1 : 0.55
    const wormMult = worms > 0 ? 1.1 : 1
    t.cropProgress = Math.min(1, (t.cropProgress ?? 0) + base * w.growth * wateredMult * wormMult)
  })

  if (s.ownedStaff.includes("peon")) {
    eachTile(s, (t, r, c) => {
      if (t.cropId && (t.cropProgress ?? 0) >= 1) {
        harvestAt(gs, t, r, c, true)
        harvestedAny = true
      }
    })
  }
  if (harvestedAny) log(gs, "🧑🌾 El peón cosechó los cultivos maduros")

  // ---- animales ----
  const hasCuidador = s.ownedStaff.includes("cuidador")
  const feedMult = hasCuidador ? 0.5 : 1
  let feedCostTotal = 0
  eachTile(s, t => {
    if (!t.animalId) return
    const a = animalDef(t.animalId)!
    const cost = Math.round(a.feed * feedMult)
    feedCostTotal += cost
    if (s.coins >= cost) {
      s.coins -= cost
      t.animalHappy = Math.min(100, (t.animalHappy ?? 70) + 5)
      const eff = a.produceDays / (0.55 + (t.animalHappy ?? 70) / 100 * 0.9)
      t.animalProg = (t.animalProg ?? 0) + 1 / eff
      if (t.animalProg >= 1) {
        t.animalProg = 0
        const q = t.animalQuality ?? 1
        if (addToInventory(gs, a.product, q, 1)) {
          log(gs, `${a.emoji} produjo ${productDef(a.product)?.name ?? a.product}`)
        }
      }
    } else {
      t.animalHappy = Math.max(0, (t.animalHappy ?? 70) - 15)
      log(gs, `😟 ${a.name} no fue alimentada`)
      if ((t.animalHappy ?? 70) <= 0) {
        log(gs, `${a.emoji} escapó de la granja`)
        clearAnimal(t)
      }
    }
  })
  if (hasCuidador) log(gs, "🧑🤝🧑 El cuidador alimentó a los animales")
  else if (feedCostTotal > 0) log(gs, `Comida de animales: -$${feedCostTotal}`)

  if (w.id === "tormenta") {
    eachTile(s, t => { if (t.animalId) t.animalHappy = Math.max(0, (t.animalHappy ?? 70) - 4) })
  }
  if (w.id === "lluvia") {
    eachTile(s, t => { if (t.animalId) t.animalHappy = Math.min(100, (t.animalHappy ?? 70) + 3) })
  }

  // ---- estanques ----
  eachTile(s, t => {
    if (t.kind !== "pond" || !t.pondFish) return
    const maxStock = CONFIG.balance.fishMaxStock
    if (t.pondStock! < maxStock) {
      t.pondStock = Math.min(maxStock, t.pondStock! + CONFIG.balance.fishRegenPerDay)
    }
  })

  if (s.ownedStaff.includes("pescador")) {
    eachTile(s, t => {
      if (t.kind === "pond" && t.pondFish && (t.pondStock ?? 0) > 0) {
        t.pondStock!--
        if (addToInventory(gs, t.pondFish, 1, 1)) {
          s.stats.caught++
          log(gs, `🎣 El pescador atrapó un ${fishDef(t.pondFish)?.name}`)
        }
      }
    })
  }

  // ---- salarios ----
  let wages = 0
  for (const sid of s.ownedStaff) {
    const st = staffDef(sid)!
    if (s.coins >= st.wage) {
      s.coins -= st.wage
      wages += st.wage
    } else {
      log(gs, `💸 No pudiste pagar a ${st.name}`)
    }
  }
  if (wages > 0) log(gs, `Salarios: -$${wages}`)

  // ---- impuestos ----
  if (s.day % TAX_INTERVAL === 0) {
    const tiles = countTiles(s)
    const animals = countAnimals(s)
    let tax = CONFIG.balance.taxBase + tiles * CONFIG.balance.taxPerTile + animals * CONFIG.balance.taxPerAnimal
    tax += s.ownedStaff.length * CONFIG.balance.taxPerStaff
    if (s.ownedStaff.includes("contador")) tax = Math.round(tax * 0.8)
    s.taxesOwed += tax
    s.stats.taxes += tax
    s.lastTaxDay = s.day
    log(gs, `🏛️ Impuestos del día ${s.day}: $${tax}`)
    gs.modal = "tax"
  } else if (s.taxesOwed > 0) {
    const interest = Math.ceil(s.taxesOwed * CONFIG.balance.taxInterest)
    s.taxesOwed += interest
    log(gs, `📈 Interés sobre deuda: +$${interest}`)
  }

  // ---- ecosistema ----
  updateWildlife(gs)

  rollWeather(gs)

  eachTile(s, t => { t.wateredToday = false })

  persist(gs)
  gs.modal = gs.modal === "none" ? "day" : gs.modal
}

function clearCrop(t: TileState) {
  t.cropId = undefined
  t.cropProgress = undefined
  t.cropWater = undefined
  t.cropDays = undefined
  t.cropFert = undefined
  t.wateredToday = undefined
}

function clearAnimal(t: TileState) {
  t.animalId = undefined
  t.animalQuality = undefined
  t.animalHappy = undefined
  t.animalProg = undefined
}

function harvestAt(gs: GS, t: TileState, r: number, c: number, silent: boolean): boolean {
  if (!t.cropId || (t.cropProgress ?? 0) < 1) return false
  const crop = cropDef(t.cropId)!
  const s = gs.save
  const days = t.cropDays ?? 1
  const wateredDays = t.cropWater ?? 0
  const bees = wildlifeCount(s, "abeja")
  let q = 1
  if (days > 0 && wateredDays / days >= 0.7) q++
  if (t.cropFert) q++
  if (bees > 0) q++
  if (weatherDef(s.weather).id === "lluvia") q++
  q = Math.min(cropQualityMax(), q)
  if (addToInventory(gs, crop.id, q, crop.yield)) {
    s.stats.harvested += crop.yield
    if (!silent) {
      pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), `${crop.emoji} +${crop.yield}`, ACCENT_TXT)
      pushSparks(gs, tileCenterWorldX(c), tileCenterWorldY(r), "#ffd54a", 10)
    }
    log(gs, `🌾 Cosechaste ${crop.yield} ${crop.name}`)
    clearCrop(t)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Wildlife
// ---------------------------------------------------------------------------

function updateWildlife(gs: GS) {
  const s = gs.save
  const wl = s.wildlife
  const crops = countCrops(s)
  const hens = countSpecies(s, "gallina")
  const colmenas = s.decorations["colmena"] ?? 0
  const flores = s.decorations["flores"] ?? 0
  const compostas = s.decorations["composta"] ?? 0
  const cercos = s.decorations["cerco"] ?? 0
  const espantapajaros = s.decorations["espantapajaros"] ?? 0

  wl.abeja = drift(wl.abeja, colmenas * 2)
  wl.mariquita = drift(wl.mariquita, flores * 1.5)
  wl.lombriz = drift(wl.lombriz, compostas * 1.5)
  wl.zorro = drift(wl.zorro, hens >= 2 && cercos < 2 ? Math.ceil(hens / 3) : 0)
  wl.jabali = drift(wl.jabali, crops >= 5 && espantapajaros === 0 ? Math.ceil(crops / 4) : 0)
  wl.plaga = drift(wl.plaga, crops >= 6 && wl.mariquita < 2 && s.repelenteT === 0 ? Math.ceil(crops / 5) : 0)

  if (wl.zorro > 0 && hens > 0) {
    const eggKey = invKey("huevo", 1)
    if (s.inventory[eggKey] && s.inventory[eggKey] > 0 && chance(0.3)) {
      s.inventory[eggKey]--
      if (s.inventory[eggKey] <= 0) delete s.inventory[eggKey]
      log(gs, "🦊 ¡Un zorro robó un huevo!")
    } else if (chance(0.15)) {
      eachTile(s, t => {
        if (t.animalId === "gallina" && chance(0.4)) t.animalHappy = Math.max(0, (t.animalHappy ?? 70) - 8)
      })
      log(gs, "🦊 Un zorro asustó a las gallinas")
    }
  }
  if (wl.jabali > 0 && crops > 0 && chance(0.25)) {
    const targets: Array<{ r: number; c: number }> = []
    eachTile(s, (t, r, c) => { if (t.cropId) targets.push({ r, c }) })
    const pick1 = pick(targets)
    clearCrop(s.tiles[pick1.r][pick1.c])
    log(gs, "🐗 ¡Un jabalí destrozó un cultivo!")
  }
  if (wl.plaga > 0 && crops > 0 && chance(0.35)) {
    eachTile(s, t => {
      if (t.cropId && chance(0.3)) t.cropProgress = Math.max(0, (t.cropProgress ?? 0) - 0.15)
    })
    log(gs, "🦗 Una plaga dañó tus cultivos")
  }
}

function drift(cur: number, target: number): number {
  if (cur < target) return cur + 1
  if (cur > target) return Math.max(0, cur - 1)
  return cur
}

// ---------------------------------------------------------------------------
// Acciones del jugador (ejecutadas al llegar con la herramienta)
// ---------------------------------------------------------------------------

export function advanceDay(gs: GS) {
  if (gs.phase !== "farm" || gs.modal !== "none" || gs.fishing.active || gs.player.working) return
  gs.dayTime = 0
  endOfDay(gs)
}

export function plowTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind !== "grass" || t.building) return
  t.kind = "soil"
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), "🪓 arada", "#c9a06a", 13)
  pushSparks(gs, tileCenterWorldX(c), tileCenterWorldY(r), "#8a5a2b", 8)
  persist(gs)
}

export function plantSeed(gs: GS, r: number, c: number, seedId: string) {
  const t = gs.save.tiles[r][c]
  const crop = cropDef(seedId)
  if (!crop || t.kind !== "soil" || t.cropId || t.building) return
  if (!gs.save.unlockedCrops.includes(seedId)) { flash(gs, "Desbloquea la semilla primero"); return }
  if (gs.save.coins < crop.buy) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= crop.buy
  t.cropId = seedId
  t.cropProgress = 0
  t.cropWater = 0
  t.cropDays = 0
  t.cropFert = false
  t.wateredToday = false
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), `${crop.emoji} sembrado`, "#ffffff", 13)
  persist(gs)
}

export function waterTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind !== "soil" || !t.cropId) return
  t.wateredToday = true
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), "💧", "#7cc4ff", 15)
  pushSparks(gs, tileCenterWorldX(c), tileCenterWorldY(r), "#7cc4ff", 6)
  persist(gs)
}

export function fertilizeTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind !== "soil" || !t.cropId || t.cropFert) return
  if (gs.save.abono <= 0) { flash(gs, "No tienes abono"); return }
  gs.save.abono--
  t.cropFert = true
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), "💩 calidad +", "#b8ff7a", 13)
  persist(gs)
}

export function harvestTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (!harvestAt(gs, t, r, c, false)) flash(gs, "Aún no está listo")
}

export function buyAnimalAt(gs: GS, r: number, c: number, animalId: string) {
  const t = gs.save.tiles[r][c]
  const a = animalDef(animalId)
  if (!a || t.kind !== "pasture" || t.animalId) return
  if (!gs.save.unlockedAnimals.includes(animalId)) { flash(gs, "Desbloquea el animal primero"); return }
  if (gs.save.coins < a.buy) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= a.buy
  t.animalId = animalId
  t.animalQuality = 1
  t.animalHappy = 70
  t.animalProg = 0
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), `${a.emoji} +${a.name}`, "#ffffff", 14)
  persist(gs)
}

export function placeBuilding(gs: GS, r: number, c: number, id: string) {
  const t = gs.save.tiles[r][c]
  const b = BUILDINGS.find(x => x.id === id)
  if (!b || !t || t.building) return
  if (t.kind !== "grass" && t.kind !== "soil") return
  if (gs.save.coins < b.cost) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= b.cost
  if (id === "estanque") t.kind = "pond"
  else if (id === "pastizal") t.kind = "pasture"
  else gs.save.decorations[id] = (gs.save.decorations[id] ?? 0) + 1
  t.building = id
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), `${b.emoji} ${b.name}`, "#ffd54a", 14)
  pushSparks(gs, tileCenterWorldX(c), tileCenterWorldY(r), "#ffd54a", 10)
  persist(gs)
}

export function feedAnimal(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (!t.animalId) return
  const a = animalDef(t.animalId)!
  const hasCuidador = gs.save.ownedStaff.includes("cuidador")
  const cost = Math.round(a.feed * (hasCuidador ? 0.5 : 1))
  if (gs.save.coins < cost) { flash(gs, "No puedes pagar la comida"); return }
  gs.save.coins -= cost
  t.animalHappy = Math.min(100, (t.animalHappy ?? 70) + 12)
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), "🍽️ +felicidad", "#ffd54a", 13)
  gs.sheet = "none"
  persist(gs)
}

export function sellAnimal(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (!t.animalId) return
  const a = animalDef(t.animalId)!
  const q = t.animalQuality ?? 1
  const price = Math.round(a.sell * qualityMult(q))
  gs.save.coins += price
  gs.save.stats.sold += 1
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), `🪙 +$${price}`, "#ffd54a", 16)
  pushSparks(gs, tileCenterWorldX(c), tileCenterWorldY(r), "#ffd54a", 8)
  clearAnimal(t)
  gs.sheet = "none"
  gs.menuTile = null
  persist(gs)
}

export function startBreed(gs: GS, r: number, c: number) {
  gs.breedTarget = { r, c }
  gs.sheet = "breed"
}

export function doBreed(gs: GS, targetR: number, targetC: number, mateR: number, mateC: number) {
  const tt = gs.save.tiles[targetR][targetC]
  const mt = gs.save.tiles[mateR][mateC]
  if (!tt.animalId || tt.animalId !== mt.animalId) return
  const a = animalDef(tt.animalId)!
  const q1 = tt.animalQuality ?? 1
  const q2 = mt.animalQuality ?? 1
  const bestQ = Math.max(q1, q2)
  const cost = breedCost(bestQ)
  if (gs.save.coins < cost) { flash(gs, "No tienes suficientes monedas"); return }

  let freeR = -1, freeC = -1
  eachTile(gs.save, (t, r, c) => {
    if (freeR === -1 && t.kind === "pasture" && !t.animalId) { freeR = r; freeC = c }
  })
  if (freeR === -1) { flash(gs, "Necesitas un pastizal libre"); return }

  gs.save.coins -= cost
  if (chance(breedChance(bestQ))) {
    const newQ = Math.min(animalQualityMax(), bestQ + 1)
    const nt = gs.save.tiles[freeR][freeC]
    nt.animalId = tt.animalId
    nt.animalQuality = newQ
    nt.animalHappy = 70
    nt.animalProg = 0
    gs.save.stats.bred++
    pushFloater(gs, tileCenterWorldX(freeC), tileCenterWorldY(freeR), `${a.emoji} raza ${newQ}!`, "#ffd54a", 18)
    pushSparks(gs, tileCenterWorldX(freeC), tileCenterWorldY(freeR), "#ffd54a", 14)
    log(gs, `🐣 Nació un ${a.name} de raza ${newQ}`)
  } else {
    pushFloater(gs, tileCenterWorldX(mateC), tileCenterWorldY(mateR), "no hubo cría", "#ff8a80", 13)
  }
  gs.sheet = "none"
  gs.menuTile = null
  persist(gs)
}

// --- estanques / pesca ---

export function stockFish(gs: GS, r: number, c: number, fishId: string) {
  const t = gs.save.tiles[r][c]
  const f = fishDef(fishId)
  if (!f || t.kind !== "pond") return
  if (!gs.save.unlockedFish.includes(fishId)) { flash(gs, "Desbloquea el pez primero"); return }
  if (gs.save.coins < f.fryCost) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= f.fryCost
  t.pondFish = fishId
  t.pondStock = Math.max(t.pondStock ?? 0, 2)
  pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r), `${f.emoji} alevines`, "#7cc4ff", 14)
  persist(gs)
}

export function startFishing(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind !== "pond" || !t.pondFish || (t.pondStock ?? 0) <= 0) return
  gs.fishing.active = true
  gs.fishing.t = 0
  gs.fishing.done = false
  gs.fishing.result = null
  gs.fishing.pondR = r
  gs.fishing.pondC = c
  const w = weatherDef(gs.save.weather)
  gs.fishing.zoneW = CONFIG.balance.fishing.zoneW * w.fishMult
  const span = 1 - gs.fishing.zoneW
  gs.fishing.zone = rand(0, span) + gs.fishing.zoneW / 2
}

export function resolveFishing(gs: GS) {
  if (!gs.fishing.active || gs.fishing.done) return
  gs.fishing.done = true
  const prog = Math.min(1, gs.fishing.t / gs.fishing.dur)
  const marker = Math.abs(1 - prog * 2)
  const r = gs.fishing.pondR
  const c = gs.fishing.pondC
  const t = gs.save.tiles[r]?.[c]
  if (!t || t.kind !== "pond" || !t.pondFish) { gs.fishing.result = "miss"; return }

  gs.fishing.result = Math.abs(marker - gs.fishing.zone) <= gs.fishing.zoneW / 2 ? "perfect" : "ok"

  const w = weatherDef(gs.save.weather)
  if (gs.fishing.result === "ok" && w.fishMult < 0.8 && chance(CONFIG.balance.fishing.missChanceWeatherMult)) {
    gs.fishing.result = "miss"
  }

  if (gs.fishing.result !== "miss") {
    const f = fishDef(t.pondFish)!
    let catchN = 1
    if (gs.fishing.result === "perfect" && (t.pondStock ?? 0) >= 2) catchN = 2
    t.pondStock = Math.max(0, (t.pondStock ?? 0) - catchN)
    if (addToInventory(gs, f.id, 1, catchN)) {
      gs.save.stats.caught += catchN
      pushFloater(gs, tileCenterWorldX(c), tileCenterWorldY(r) - 20, `+${catchN} ${f.emoji}`, gs.fishing.result === "perfect" ? "#ffd54a" : "#ffffff", gs.fishing.result === "perfect" ? 19 : 15)
      if (gs.fishing.result === "perfect") {
        pushSparks(gs, tileCenterWorldX(c), tileCenterWorldY(r), "#ffd54a", 12)
        gs.flashMsg = "¡Pesca perfecta! ×2"
        gs.flashT = 1.4
      }
    } else {
      gs.fishing.result = "miss"
    }
  }
  persist(gs)
}

// --- tienda ---

export function buySeed(gs: GS, id: string) {
  const crop = cropDef(id)
  if (!crop) return
  if (gs.save.fame < crop.unlockFame) { flash(gs, "Desbloquea con más fama"); return }
  if (gs.save.unlockedCrops.includes(id)) { flash(gs, "Ya está desbloqueado"); return }
  gs.save.unlockedCrops.push(id)
  flash(gs, `${crop.emoji} ${crop.name} desbloqueado`)
  persist(gs)
}

export function buyAnimal(gs: GS, id: string) {
  const a = animalDef(id)
  if (!a) return
  if (gs.save.fame < a.unlockFame) { flash(gs, "Desbloquea con más fama"); return }
  if (gs.save.unlockedAnimals.includes(id)) { flash(gs, "Ya está desbloqueado"); return }
  gs.save.unlockedAnimals.push(id)
  flash(gs, `${a.emoji} ${a.name} desbloqueada`)
  persist(gs)
}

export function buyFish(gs: GS, id: string) {
  const f = fishDef(id)
  if (!f) return
  if (gs.save.fame < f.unlockFame) { flash(gs, "Desbloquea con más fama"); return }
  if (gs.save.unlockedFish.includes(id)) { flash(gs, "Ya está desbloqueado"); return }
  gs.save.unlockedFish.push(id)
  flash(gs, `${f.emoji} ${f.name} desbloqueada`)
  persist(gs)
}

export function buyDecor(gs: GS, id: string) {
  const d = decorDef(id)
  if (!d) return
  if (gs.save.coins < d.cost) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= d.cost
  gs.save.decorations[id] = (gs.save.decorations[id] ?? 0) + 1
  flash(gs, `${d.emoji} ${d.name} instalad${d.slot === "income" ? "o" : "a"}`)
  persist(gs)
}

export function buyExtra(gs: GS, id: string) {
  const e = extraDef(id)
  if (!e) return
  if (gs.save.coins < e.cost) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= e.cost
  if (id === "abono") gs.save.abono++
  if (id === "repelente") gs.save.repelente++
  flash(gs, `${e.emoji} +1 ${e.name}`)
  persist(gs)
}

export function buyExpansion(gs: GS) {
  const s = gs.save
  const rows = s.tiles.length
  if (rows >= CONFIG.balance.maxRows) { flash(gs, "¡Granja al máximo!"); return }
  const cost = rowCost(rows)
  if (s.coins < cost) { flash(gs, "No tienes suficientes monedas"); return }
  s.coins -= cost
  const newRow: TileState[] = []
  for (let c = 0; c < s.tiles[0].length; c++) newRow.push({ kind: "grass" })
  s.tiles.push(newRow)
  flash(gs, "¡Granja expandida!")
  persist(gs)
}

// --- mercado ---

export function sellProduct(gs: GS, productId: string) {
  const s = gs.save
  let total = 0
  let qty = 0
  const keys = Object.keys(s.inventory).filter(k => k.startsWith(productId + ":"))
  if (keys.length === 0) { flash(gs, "No tienes este producto"); return }
  for (const k of keys) {
    const q = parseInt(k.split(":")[1] ?? "1", 10)
    const p = productDef(productId)
    if (!p) continue
    const unit = Math.round(p.basePrice * qualityMult(q))
    total += unit * s.inventory[k]
    qty += s.inventory[k]
    delete s.inventory[k]
  }
  const molino = (s.decorations["molino"] ?? 0) > 0 ? 1.1 : 1
  const finalTotal = Math.round(total * molino)
  s.coins += finalTotal
  s.stats.sold += qty
  s.stats.earned += finalTotal
  s.fame += finalTotal
  pushFloater(gs, W / 2, 260, `🪙 +$${finalTotal}`, "#ffd54a", 18)
  pushSparks(gs, W / 2, 260, "#ffd54a", 12)
  flash(gs, `Vendiste ${qty} por $${finalTotal}`)
  persist(gs)
}

export function sellAll(gs: GS) {
  const keys = Object.keys(gs.save.inventory)
  if (keys.length === 0) { flash(gs, "No hay nada que vender"); return }
  for (const k of [...keys]) {
    const { productId, quality } = parseKey(k)
    const p = productDef(productId)
    if (!p) continue
    const unit = Math.round(p.basePrice * qualityMult(quality))
    const molino = (gs.save.decorations["molino"] ?? 0) > 0 ? 1.1 : 1
    gs.save.coins += Math.round(unit * gs.save.inventory[k] * molino)
    gs.save.stats.sold += gs.save.inventory[k]
    gs.save.stats.earned += Math.round(unit * gs.save.inventory[k] * molino)
    gs.save.fame += Math.round(unit * gs.save.inventory[k] * molino)
    delete gs.save.inventory[k]
  }
  flash(gs, "¡Mercado vaciado!")
  persist(gs)
}

function parseKey(k: string): { productId: string; quality: number } {
  const [productId, q] = k.split(":")
  return { productId, quality: q ? parseInt(q, 10) : 1 }
}

// --- personal ---

export function hireStaff(gs: GS, id: string) {
  const st = staffDef(id)
  if (!st || gs.save.ownedStaff.includes(id)) return
  if (gs.save.coins < st.wage * 2) { flash(gs, "Necesitas 2 días de salario"); return }
  gs.save.coins -= st.wage * 2
  gs.save.ownedStaff.push(id)
  flash(gs, `${st.name} contratado ✔`)
  persist(gs)
}

export function fireStaff(gs: GS, id: string) {
  gs.save.ownedStaff = gs.save.ownedStaff.filter(s => s !== id)
  flash(gs, "Empleado despedido")
  persist(gs)
}

// --- fisco ---

export function payTaxes(gs: GS) {
  const s = gs.save
  if (s.taxesOwed <= 0) return
  if (s.coins < s.taxesOwed) { flash(gs, "No tienes suficiente para pagar"); return }
  s.coins -= s.taxesOwed
  s.taxesOwed = 0
  gs.modal = "none"
  flash(gs, "¡Deuda liquidada!")
  persist(gs)
}

export function resetFarm(gs: GS) {
  gs.save = loadEcoSave()
  gs.sheet = "none"
  gs.menuTile = null
  gs.modal = "none"
  gs.dayTime = 0
  gs.pending = null
  const rows = gs.save.tiles.length
  const cols = gs.save.tiles[0]?.length ?? COLS
  const px = tileCenterWorldX(Math.min(3, cols - 1))
  const py = tileCenterWorldY(Math.min(3, rows - 1))
  gs.player = makePlayer(px, py)
  persist(gs)
}

// --- utilidades de pantalla ---

export function closeSheet(gs: GS) {
  gs.sheet = "none"
  gs.menuTile = null
  gs.breedTarget = null
}