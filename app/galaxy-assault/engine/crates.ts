// Cajas de bonos (munición) y drops de inventario: spawn, recogida, datos del minimapa.
import type { GS, Crate } from "../core/types"
import { CONFIG, BASE_X, BASE_Y, PLAYABLE_MIN, PLAYABLE_MAX } from "../core/constants"
import { rand, dist } from "../../lib/math"
import { weaponDef, AMMO_ORDER } from "../data/ammo"
import { applyDrop } from "../data/items"
import { pushFloater, pushParticles } from "./combat"
import { pushEvent } from "./index"
import { sfx } from "../../lib/sound"

export function updateCrates(gs: GS, dt: number): void {
  // Spawn de cajas de munición aleatorias
  gs.crateTimer += dt * 1000
  const cfg = CONFIG.crates
  const active = gs.crates.length
  if (gs.crateTimer >= cfg.spawnInterval && active < cfg.maxOnField) {
    gs.crateTimer = 0
    const pos = cratePosition(gs)
    const type = weightedCrateType()
    gs.crates.push({
      id: gs.nextId++,
      x: pos.x, y: pos.y, type,
      life: cfg.life, maxLife: cfg.life,
      bobT: rand(0, Math.PI * 2),
    })
  }

  // Vida de cajas
  for (let i = gs.crates.length - 1; i >= 0; i--) {
    const c = gs.crates[i]
    c.life -= dt
    c.bobT += dt * 2
    if (c.life <= 0) gs.crates.splice(i, 1)
  }

  // Recogida de cajas (recarga munición del tipo)
  for (let i = gs.crates.length - 1; i >= 0; i--) {
    const c = gs.crates[i]
    if (dist(c.x, c.y, gs.player.x, gs.player.y) <= 34) {
      const w = weaponDef(c.type)
      gs.ammo[c.type] = Math.min(w.maxAmmo, gs.ammo[c.type] + w.crateAmount)
      gs.crates.splice(i, 1)
      pushFloater(gs, c.x, c.y - 20, `+${w.crateAmount} ${w.name}`, w.color, 15)
      pushParticles(gs, c.x, c.y, w.color, 8)
      sfx.coin()
      pushEvent(gs, `📦 Recogiste ${w.crateAmount} de ${w.name}`)
    }
  }
}

function cratePosition(gs: GS): { x: number; y: number } {
  for (let i = 0; i < 30; i++) {
    const x = rand(PLAYABLE_MIN, PLAYABLE_MAX)
    const y = rand(PLAYABLE_MIN, PLAYABLE_MAX)
    const dBase = dist(x, y, BASE_X, BASE_Y)
    const dPlayer = dist(x, y, gs.player.x, gs.player.y)
    if (dBase >= CONFIG.crates.minDistFromBase && dPlayer >= 180) return { x, y }
  }
  return { x: rand(PLAYABLE_MIN, PLAYABLE_MAX), y: rand(PLAYABLE_MIN, PLAYABLE_MAX) }
}

function weightedCrateType(): Crate["type"] {
  // Peso según crateChance de config
  const total = AMMO_ORDER.reduce((s, id) => s + weaponDef(id).crateChance, 0)
  let r = Math.random() * total
  for (const id of AMMO_ORDER) {
    r -= weaponDef(id).crateChance
    if (r <= 0) return id
  }
  return "x1"
}

export function updateDrops(gs: GS, dt: number): void {
  for (let i = gs.drops.length - 1; i >= 0; i--) {
    const d = gs.drops[i]
    d.life -= dt
    d.x += d.vx * dt
    d.y += d.vy * dt
    d.bobT += dt * 2
    // Recogida
    if (dist(d.x, d.y, gs.player.x, gs.player.y) <= 30) {
      const coins = applyDrop(gs.save, d.dropId)
      if (d.dropId === "repairBot") {
        pushFloater(gs, d.x, d.y - 18, "🤖 Robot reparación", "#33aaff", 14)
        sfx.powerup()
        pushEvent(gs, "🤖 Recogiste un robot de reparación")
      } else {
        gs.save.coins += coins
        const names = { core: "Núcleo", energy: "Energía", scrap: "Chatarra" } as const
        pushFloater(gs, d.x, d.y - 18, `+${names[d.dropId]}`, d.dropId === "core" ? "#ffdd44" : "#88ddff", 13)
        sfx.pop()
        pushEvent(gs, `🔧 Recogiste ${names[d.dropId]}${coins > 0 ? ` (+${coins}🪙)` : ""}`)
      }
      gs.drops.splice(i, 1)
      continue
    }
    if (d.life <= 0) gs.drops.splice(i, 1)
  }
}

// ── Datos para el minimapa ──
export interface MinimapData {
  worldPx: number
  baseX: number
  baseY: number
  playerX: number
  playerY: number
  playerAngle: number
  enemies: Array<{ x: number; y: number; boss: boolean }>
  crates: Array<{ x: number; y: number }>
}

export function minimapData(gs: GS): MinimapData {
  const worldPx = CONFIG.map.size * CONFIG.map.cell
  const cap = CONFIG.minimap.showEnemiesCap
  const enemies: MinimapData["enemies"] = []
  for (const e of gs.enemies) {
    if (!e.alive) continue
    if (e.kind === "boss") enemies.push({ x: e.x, y: e.y, boss: true })
    else if (enemies.filter(en => !en.boss).length < cap) enemies.push({ x: e.x, y: e.y, boss: false })
  }
  return {
    worldPx,
    baseX: BASE_X,
    baseY: BASE_Y,
    playerX: gs.player.x,
    playerY: gs.player.y,
    playerAngle: gs.player.angle,
    enemies,
    crates: gs.crates.map(c => ({ x: c.x, y: c.y })),
  }
}