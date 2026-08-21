// Enemigos y jefes: IA (patrulla/aggro), spawn infinito por timers + caps, mecánicas de jefe.
import type { GS, Enemy } from "../core/types"
import {
  CONFIG, BASE_X, BASE_Y, SAFE_RADIUS, PLAYABLE_MIN, PLAYABLE_MAX, MAX_NPCS_ON_MAP,
} from "../core/constants"
import { rand, clamp, angleTo, angleLerp, dist } from "../../lib/math"
import type { CfgNpc, CfgBoss } from "../core/constants"

export function makeEnemy(gs: GS, type: string, kind: "npc" | "boss", cfg: CfgNpc | CfgBoss): Enemy {
  const isBoss = kind === "boss"
  const c = cfg as CfgNpc & CfgBoss
  const pos = spawnPosition(gs, c.minDistFromBase ?? 0, c.minDistFromPlayer ?? 0, isBoss)
  return {
    id: gs.nextId++,
    kind,
    type,
    x: pos.x,
    y: pos.y,
    angle: rand(0, Math.PI * 2),
    hp: cfg.hp,
    maxHp: cfg.hp,
    size: cfg.size,
    speed: cfg.speed,
    aggro: false,
    aggroRange: cfg.aggroRange,
    contactDamage: cfg.contactDamage,
    fireTimer: rand(500, (cfg as CfgNpc).fireRateMs ?? 1500),
    fireRate: cfg.fireRateMs,
    bulletDamage: cfg.bulletDamage,
    bulletSpeed: cfg.bulletSpeed,
    points: cfg.points,
    dropChance: cfg.dropChance,
    hitFlash: 0,
    wanderT: rand(0.5, 3),
    wanderAngle: rand(0, Math.PI * 2),
    phase: 1,
    phase2At: isBoss ? c.phase2At : 1,
    attackTimer: 2000,
    attackIdx: 0,
    mechanic: isBoss ? c.mechanic : "none",
    laserT: 0,
    laserActive: false,
    laserAngle: 0,
    spawnTimer: 0,
    alive: true,
    respawnT: 0,
    color: isBoss ? "#ff5533" : cfg === CONFIG.npcs.tank ? "#ffaa33" : "#ff5533",
    accent: isBoss ? "#ffaa66" : cfg === CONFIG.npcs.tank ? "#ffcc66" : "#ff8866",
  }
}

function spawnPosition(gs: GS, minDistFromBase: number, minDistFromPlayer: number, isBoss: boolean): { x: number; y: number } {
  const p = gs.player
  for (let i = 0; i < 40; i++) {
    const x = rand(PLAYABLE_MIN, PLAYABLE_MAX)
    const y = rand(PLAYABLE_MIN, PLAYABLE_MAX)
    const dBase = dist(x, y, BASE_X, BASE_Y)
    const dPlayer = dist(x, y, p.x, p.y)
    const dBaseMin = isBoss ? SAFE_RADIUS + 150 : minDistFromBase
    const dPlayerMin = isBoss ? 260 : minDistFromPlayer
    if (dBase >= dBaseMin && dPlayer >= dPlayerMin) return { x, y }
  }
  return { x: rand(PLAYABLE_MIN, PLAYABLE_MAX), y: rand(PLAYABLE_MIN, PLAYABLE_MAX) }
}

export function updateSpawners(gs: GS, dt: number): void {
  // NPCs — con tope GLOBAL en el mapa para no sobrepoblar
  const npcsAlive = gs.enemies.filter(e => e.kind === "npc" && e.alive).length
  if (npcsAlive < MAX_NPCS_ON_MAP) {
    for (const type of Object.keys(CONFIG.npcs)) {
      const cfg = CONFIG.npcs[type]
      const alive = gs.enemies.filter(e => e.type === type && e.alive).length
      gs.spawnTimers[type] = (gs.spawnTimers[type] ?? 0) + dt * 1000
      if (alive < cfg.maxCount && gs.spawnTimers[type] >= cfg.spawnInterval) {
        gs.spawnTimers[type] = 0
        gs.enemies.push(makeEnemy(gs, type, "npc", cfg))
      }
    }
  }
  // Jefes (cap 1 c/u)
  for (const bcfg of CONFIG.bosses) {
    const alive = gs.enemies.filter(e => e.type === bcfg.id && e.alive).length
    gs.spawnTimers[bcfg.id] = (gs.spawnTimers[bcfg.id] ?? 0) + dt * 1000
    if (alive < bcfg.maxCount && gs.spawnTimers[bcfg.id] >= bcfg.spawnInterval) {
      gs.spawnTimers[bcfg.id] = 0
      gs.enemies.push(makeEnemy(gs, bcfg.id, "boss", bcfg))
    }
  }
}

export function updateEnemies(gs: GS, dt: number): void {
  for (const e of gs.enemies) {
    if (!e.alive) {
      // respawn del jefe por timer (se maneja en updateSpawners; aquí solo limpieza)
      continue
    }
    updateEnemy(gs, e, dt)
  }
}

function updateEnemy(gs: GS, e: Enemy, dt: number): void {
  if (e.hitFlash > 0) e.hitFlash -= dt
  const p = gs.player
  const d = dist(e.x, e.y, p.x, p.y)

  // Aggro: el enemigo ataca si el jugador está dentro de rango y FUERA de zona segura
  const playerSafe = gs.inSafeZone
  if (!playerSafe && d <= e.aggroRange) e.aggro = true
  else if (playerSafe || d > e.aggroRange * 1.6) e.aggro = false

  // Movimiento
  if (e.aggro && !playerSafe) {
    const a = angleTo(e.x, e.y, p.x, p.y)
    e.x += Math.cos(a) * e.speed * dt
    e.y += Math.sin(a) * e.speed * dt
    e.angle = a
  } else {
    // Patrulla errática, pero no entra a la zona segura
    e.wanderT -= dt
    if (e.wanderT <= 0) {
      e.wanderT = rand(1.5, 4)
      e.wanderAngle = rand(0, Math.PI * 2)
    }
    e.x += Math.cos(e.wanderAngle) * e.speed * 0.45 * dt
    e.y += Math.sin(e.wanderAngle) * e.speed * 0.45 * dt
    e.angle = angleLerp(e.angle, e.wanderAngle, Math.min(1, dt * 2))

    // Repelerse del centro seguro
    if (dist(e.x, e.y, BASE_X, BASE_Y) < SAFE_RADIUS + 30) {
      const away = angleTo(BASE_X, BASE_Y, e.x, e.y)
      e.x += Math.cos(away) * e.speed * 1.5 * dt
      e.y += Math.sin(away) * e.speed * 1.5 * dt
    }
  }
  // No cruza el cinturón de asteroides (clamp al área jugable)
  e.x = clamp(e.x, PLAYABLE_MIN + e.size / 2, PLAYABLE_MAX - e.size / 2)
  e.y = clamp(e.y, PLAYABLE_MIN + e.size / 2, PLAYABLE_MAX - e.size / 2)

  // Disparo (NPC)
  if (e.kind === "npc" && e.aggro && !playerSafe) {
    e.fireTimer -= dt * 1000
    if (e.fireTimer <= 0) {
      e.fireTimer = e.fireRate
      const a = angleTo(e.x, e.y, p.x, p.y)
      gs.bullets.push({
        id: gs.nextId++, x: e.x, y: e.y,
        vx: Math.cos(a) * e.bulletSpeed, vy: Math.sin(a) * e.bulletSpeed,
        damage: e.bulletDamage, radius: 5, fromPlayer: false,
        color: "#ff5533", kind: "laser", life: 4,
      })
    }
  }

  // Mecánicas de jefe
  if (e.kind === "boss") bossMechanics(gs, e, dt)
}

function bossMechanics(gs: GS, e: Enemy, dt: number): void {
  // Fase 2 al 50% HP
  if (e.phase === 1 && e.hp <= e.maxHp * e.phase2At) {
    e.phase = 2
    e.fireRate = Math.max(350, e.fireRate * 0.65)
  }
  e.attackTimer -= dt * 1000
  if (e.attackTimer <= 0) {
    e.attackTimer = e.phase === 2 ? 1500 : 2400
    const t = e.mechanic
    if (t === "cone") bossCone(gs, e)
    else if (t === "minions+laser") bossMinionsLaser(gs, e)
    else bossCone(gs, e)
  }
}

function bossCone(gs: GS, e: Enemy): void {
  const a = angleTo(e.x, e.y, gs.player.x, gs.player.y)
  const shots = e.phase === 2 ? 5 : 3
  for (let i = 0; i < shots; i++) {
    const off = (i - (shots - 1) / 2) * 0.22
    gs.bullets.push({
      id: gs.nextId++, x: e.x, y: e.y,
      vx: Math.cos(a + off) * e.bulletSpeed, vy: Math.sin(a + off) * e.bulletSpeed,
      damage: e.bulletDamage, radius: 6, fromPlayer: false,
      color: "#ff8844", kind: "laser", life: 5,
    })
  }
}

function bossMinionsLaser(gs: GS, e: Enemy): void {
  // Invoca 2 scouts aliados (con stats de scout)
  if (e.phase === 2) {
    const scout = CONFIG.npcs.scout
    for (let i = 0; i < 2; i++) {
      const m = makeEnemy(gs, "scout", "npc", scout)
      m.x = e.x + rand(-40, 40)
      m.y = e.y + rand(-40, 40)
      m.aggro = true
      gs.enemies.push(m)
    }
  }
  // Láser de barrido
  e.laserActive = true
  e.laserT = 1.4
  e.laserAngle = angleTo(e.x, e.y, gs.player.x, gs.player.y)
}

export function bossLaserStep(gs: GS, e: Enemy, dt: number): void {
  if (!e.laserActive) return
  e.laserT -= dt
  if (e.laserT <= 0) e.laserActive = false
  else e.laserAngle += (e.phase === 2 ? 1.2 : 0.7) * dt
}