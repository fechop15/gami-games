import { writeEcoSave, loadEcoSave, invKey, inventoryUsed, type TileState, type EcoSave } from "./save"
import {
  CONFIG, DAY_LENGTH, TAX_INTERVAL,
  cropDef, animalDef, fishDef, productDef, staffDef, decorDef, weatherDef, extraDef,
  rowCost, breedChance, breedCost, qualityMult, storageMax, animalQualityMax, cropQualityMax,
  FARM_TOP, FARM_BOTTOM, CELL, CELL_GAP, COLS, GRID_MARGIN_X,
} from "./constants"
import type { GS } from "./types"

const ACCENT_TXT = "#7cff5a"

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
      gs.flashMsg = "¡Almacén lleno!"
      gs.flashT = 1.6
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

// ---------------------------------------------------------------------------
// GS factory
// ---------------------------------------------------------------------------

export function makeGS(): GS {
  const save = loadEcoSave() as EcoSave
  return {
    phase: "intro",
    save,
    lastTime: 0,
    time: 0,
    dayTime: 0,
    isTouching: false,
    scroll: 0,
    dragStartY: null,
    dragBase: 0,
    listScroll: 0,
    listDragBase: 0,
    selTile: null,
    sheet: "none",
    modal: "none",
    confirmAction: null,
    shopTab: "seeds",
    breedTarget: null,
    btns: [],
    tabs: [],
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

// ---------------------------------------------------------------------------
// Update (por frame)
// ---------------------------------------------------------------------------

export function update(gs: GS, dt: number) {
  gs.time += dt
  gs.dayTime += dt

  // flash message
  if (gs.flashT > 0) gs.flashT -= dt

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
        gs.rain.push({ x: rand(0, 480), y: rand(-30, 0), len: rand(12, 22), spd: rand(600, 900) })
      }
    } else {
      gs.rain.length = 0
    }
    if (w.id === "helada") {
      if (gs.snow.length < 50 && chance(dt * 30)) {
        gs.snow.push({ x: rand(0, 480), y: rand(-30, 0), r: rand(1.5, 3.5), spd: rand(30, 70), sway: rand(0, Math.PI * 2) })
      }
    } else {
      gs.snow.length = 0
    }
    for (let i = gs.rain.length - 1; i >= 0; i--) {
      const d = gs.rain[i]
      d.y += d.spd * dt
      d.x += (w.id === "tormenta" ? 60 : 15) * dt
      if (d.y > 900) gs.rain.splice(i, 1)
    }
    for (let i = gs.snow.length - 1; i >= 0; i--) {
      const s = gs.snow[i]
      s.y += s.spd * dt
      s.x += Math.sin(gs.time * 1.5 + s.sway) * 20 * dt
      if (s.y > 900) gs.snow.splice(i, 1)
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
  if (gs.phase === "farm" && gs.modal === "none" && !gs.fishing.active && gs.dayTime >= DAY_LENGTH) {
    gs.dayTime = 0
    endOfDay(gs)
  }
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

  // lluvia / tormenta riega todos los cultivos
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

    // eventos de clima
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

    // crecimiento
    const base = 1 / crop.growDays
    const wateredMult = watered ? 1 : 0.55
    const wormMult = worms > 0 ? 1.1 : 1
    t.cropProgress = Math.min(1, (t.cropProgress ?? 0) + base * w.growth * wateredMult * wormMult)
  })

  // peón cosecha automática
  if (s.ownedStaff.includes("peon")) {
    eachTile(s, t => {
      if (t.cropId && (t.cropProgress ?? 0) >= 1) {
        harvestAt(gs, t, true)
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
      // producción
      const eff = a.produceDays / (0.55 + (t.animalHappy ?? 70) / 100 * 0.9)
      t.animalProg = (t.animalProg ?? 0) + 1 / eff
      if (t.animalProg >= 1) {
        t.animalProg = 0
        const q = t.animalQuality ?? 1
        if (addToInventory(gs, a.product, q, 1)) {
          pushFloater(gs, 240, 200, `${a.productEmoji} +1`, "#ffffff")
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

  // tormenta asusta animales
  if (w.id === "tormenta") {
    eachTile(s, t => {
      if (t.animalId) t.animalHappy = Math.max(0, (t.animalHappy ?? 70) - 4)
    })
  }
  // lluvia alegra
  if (w.id === "lluvia") {
    eachTile(s, t => {
      if (t.animalId) t.animalHappy = Math.min(100, (t.animalHappy ?? 70) + 3)
    })
  }

  // ---- estanques ----
  eachTile(s, t => {
    if (t.kind !== "pond" || !t.pondFish) return
    const maxStock = CONFIG.balance.fishMaxStock
    if (t.pondStock! < maxStock) {
      t.pondStock = Math.min(maxStock, t.pondStock! + CONFIG.balance.fishRegenPerDay)
    }
  })

  // pescador automático
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

  // clima cambia
  rollWeather(gs)

  // reset de riego para el día siguiente
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

function harvestAt(gs: GS, t: TileState, silent: boolean): boolean {
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
      pushFloater(gs, 240, 220, `${crop.emoji} +${crop.yield}`, ACCENT_TXT)
      pushSparks(gs, 240, 220, "#ffd54a", 10)
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

  // poblaciones → objetivos (requieren una masa mínima para aparecer)
  wl.abeja = drift(wl.abeja, colmenas * 2)
  wl.mariquita = drift(wl.mariquita, flores * 1.5)
  wl.lombriz = drift(wl.lombriz, compostas * 1.5)
  wl.zorro = drift(wl.zorro, hens >= 2 && cercos < 2 ? Math.ceil(hens / 3) : 0)
  wl.jabali = drift(wl.jabali, crops >= 5 && espantapajaros === 0 ? Math.ceil(crops / 4) : 0)
  wl.plaga = drift(wl.plaga, crops >= 6 && wl.mariquita < 2 && s.repelenteT === 0 ? Math.ceil(crops / 5) : 0)

  // eventos
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
// Acciones del jugador
// ---------------------------------------------------------------------------

export function advanceDay(gs: GS) {
  if (gs.phase !== "farm" || gs.modal !== "none" || gs.fishing.active) return
  gs.dayTime = 0
  endOfDay(gs)
}

export function tapTile(gs: GS, r: number, c: number) {
  if (gs.phase !== "farm" || gs.fishing.active || gs.modal !== "none") return
  if (gs.sheet !== "none" && gs.selTile && gs.selTile.r === r && gs.selTile.c === c) {
    closeSheet(gs)
    return
  }
  gs.selTile = { r, c }
  gs.sheet = "tile"
  gs.scroll = clampScroll(gs)
}

export function closeSheet(gs: GS) {
  gs.sheet = "none"
  gs.breedTarget = null
}

// --- cultivos ---

export function plantSeed(gs: GS, r: number, c: number, seedId: string) {
  const t = gs.save.tiles[r][c]
  const crop = cropDef(seedId)
  if (!crop || t.kind !== "soil" || t.cropId) return
  if (!gs.save.unlockedCrops.includes(seedId)) { flash(gs, "Desbloquea la semilla primero"); return }
  if (gs.save.coins < crop.buy) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= crop.buy
  t.cropId = seedId
  t.cropProgress = 0
  t.cropWater = 0
  t.cropDays = 0
  t.cropFert = false
  t.wateredToday = false
  pushFloater(gs, tileCX(c), tileCY(r), `${crop.emoji} sembrado`, "#ffffff", 14)
  closeSheet(gs)
  persist(gs)
}

export function waterTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind !== "soil" || !t.cropId) return
  t.wateredToday = true
  pushFloater(gs, tileCX(c), tileCY(r), "💧", "#7cc4ff", 16)
  closeSheet(gs)
  persist(gs)
}

export function fertilizeTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind !== "soil" || !t.cropId || t.cropFert) return
  if (gs.save.abono <= 0) { flash(gs, "No tienes abono"); return }
  gs.save.abono--
  t.cropFert = true
  pushFloater(gs, tileCX(c), tileCY(r), "💩 calidad +", "#b8ff7a", 14)
  closeSheet(gs)
  persist(gs)
}

export function harvestTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (harvestAt(gs, t, false)) {
    closeSheet(gs)
    persist(gs)
  } else {
    flash(gs, "Aún no está listo")
  }
}

export function uprootTile(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind !== "soil" || !t.cropId) return
  clearCrop(t)
  pushFloater(gs, tileCX(c), tileCY(r), "cultivo arrancado", "#ff8a80", 13)
  closeSheet(gs)
  persist(gs)
}

export function digPond(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  const cost = CONFIG.balance.pondDigCost
  if (t.kind !== "soil" || t.cropId) return
  if (gs.save.coins < cost) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= cost
  t.kind = "pond"
  pushFloater(gs, tileCX(c), tileCY(r), "🌊 estanque", "#7cc4ff", 14)
  closeSheet(gs)
  persist(gs)
}

export function prepPasture(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  const cost = CONFIG.balance.pasturePrepCost
  if (t.kind !== "soil" || t.cropId) return
  if (gs.save.coins < cost) { flash(gs, "No tienes suficientes monedas"); return }
  gs.save.coins -= cost
  t.kind = "pasture"
  pushFloater(gs, tileCX(c), tileCY(r), "🌿 pastizal", "#7cff5a", 14)
  closeSheet(gs)
  persist(gs)
}

export function backToSoil(gs: GS, r: number, c: number) {
  const t = gs.save.tiles[r][c]
  if (t.kind === "soil" || t.cropId || t.animalId) return
  t.kind = "soil"
  t.pondFish = undefined
  t.pondStock = undefined
  pushFloater(gs, tileCX(c), tileCY(r), "🟫 tierra", "#c9a06a", 13)
  closeSheet(gs)
  persist(gs)
}

// --- animales ---

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
  pushFloater(gs, tileCX(c), tileCY(r), `${a.emoji} +${a.name}`, "#ffffff", 14)
  closeSheet(gs)
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
  pushFloater(gs, tileCX(c), tileCY(r), "🍽️ +felicidad", "#ffd54a", 13)
  closeSheet(gs)
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
  pushFloater(gs, tileCX(c), tileCY(r), `🪙 +$${price}`, "#ffd54a", 16)
  pushSparks(gs, tileCX(c), tileCY(r), "#ffd54a", 8)
  clearAnimal(t)
  closeSheet(gs)
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

  // buscar pastizal vacío
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
    pushFloater(gs, tileCX(freeC), tileCY(freeR), `${a.emoji} raza ${newQ}!`, "#ffd54a", 18)
    pushSparks(gs, tileCX(freeC), tileCY(freeR), "#ffd54a", 14)
    log(gs, `🐣 Nació un ${a.name} de raza ${newQ}`)
  } else {
    pushFloater(gs, tileCX(mateC), tileCY(mateR), "no hubo cría", "#ff8a80", 13)
  }
  closeSheet(gs)
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
  pushFloater(gs, tileCX(c), tileCY(r), `${f.emoji} alevines`, "#7cc4ff", 14)
  closeSheet(gs)
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
  gs.sheet = "none"
}

export function resolveFishing(gs: GS) {
  if (!gs.fishing.active || gs.fishing.done) return
  gs.fishing.done = true
  const prog = Math.min(1, gs.fishing.t / gs.fishing.dur)
  const marker = Math.abs(1 - prog * 2) // ping-pong
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
      pushFloater(gs, tileCX(c), tileCY(r) - 20, `+${catchN} ${f.emoji}`, gs.fishing.result === "perfect" ? "#ffd54a" : "#ffffff", gs.fishing.result === "perfect" ? 19 : 15)
      if (gs.fishing.result === "perfect") {
        pushSparks(gs, tileCX(c), tileCY(r), "#ffd54a", 12)
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
  for (let c = 0; c < s.tiles[0].length; c++) newRow.push({ kind: "soil" })
  s.tiles.push(newRow)
  pushFloater(gs, 240, 300, `+1 fila de tierra`, "#7cff5a", 16)
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
  pushFloater(gs, 240, 280, `🪙 +$${finalTotal}`, "#ffd54a", 18)
  pushSparks(gs, 240, 280, "#ffd54a", 12)
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
  flash(gs, `${st.name} contratad${st.id === "contador" ? "o" : "o"} ✔`)
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
  pushFloater(gs, 240, 260, `🏛️ Impuestos pagados`, "#ffffff", 16)
  gs.modal = "none"
  flash(gs, "¡Deuda liquidada!")
  persist(gs)
}

export function resetFarm(gs: GS) {
  gs.save = loadEcoSave()
  closeSheet(gs)
  gs.modal = "none"
  gs.dayTime = 0
  persist(gs)
}

// ---------------------------------------------------------------------------
// Utilidades de pantalla
// ---------------------------------------------------------------------------

export function maxScroll(gs: GS): number {
  const rows = gs.save.tiles.length
  const farmH = FARM_BOTTOM - FARM_TOP
  const gridH = rows * (CELL + CELL_GAP) - CELL_GAP
  return Math.max(0, gridH - farmH)
}

export function clampScroll(gs: GS): number {
  return Math.max(0, Math.min(gs.scroll, maxScroll(gs)))
}

export function tileX(c: number): number {
  return GRID_MARGIN_X + c * (CELL + CELL_GAP)
}

export function tileY(r: number, scroll: number): number {
  return FARM_TOP + r * (CELL + CELL_GAP) - scroll
}

export function tileCX(c: number): number {
  return tileX(c) + CELL / 2
}

export function tileCY(r: number, scroll = 0): number {
  return tileY(r, scroll) + CELL / 2
}

export function tileAt(gs: GS, x: number, y: number): { r: number; c: number } | null {
  if (x < tileX(0) - 6 || x > tileX(0) + COLS * (CELL + CELL_GAP) + 4) return null
  for (let r = 0; r < gs.save.tiles.length; r++) {
    const ty = tileY(r, gs.scroll)
    if (y >= ty && y < ty + CELL) {
      for (let c = 0; c < COLS; c++) {
        const tx = tileX(c)
        if (x >= tx && x < tx + CELL) return { r, c }
      }
      return null
    }
  }
  return null
}

export function flash(gs: GS, msg: string) {
  gs.flashMsg = msg
  gs.flashT = 1.6
}