// Combate: targeting manual (tap para elegir objetivo), disparo al pulsar, balas,
// daño (evasión → escudo → casco).
import type { GS, Enemy, DropId, AmmoType } from "../core/types"
import {
  SHIELD_ABSORB, PLAYER_RADIUS, INVULN_AFTER_HIT, CONFIG, FIRE_RANGE,
  REGEN_IDLE_TIME, REGEN_SHIELD_PER_SEC, REGEN_HP_PER_SEC,
  REGEN_SAFE_SHIELD_PER_SEC, REGEN_SAFE_HP_PER_SEC,
} from "../core/constants"
import { weaponDef, weaponDamageForShip, defaultAmmo } from "../data/ammo"
import { shipBaseDamage } from "../data/ships"
import { angleTo, dist, clamp, chance, rand } from "../../lib/math"
import { evasionChance } from "./player"
import { pushEvent } from "./index"
import { addXp } from "../core/save"
import { sfx } from "../../lib/sound"

/** Devuelve el enemigo vivo más cercano a (sx, sy) en coordenadas de pantalla.
 * Usado para elegir objetivo con un tap. Devuelve null si no hay ninguno cerca. */
export function enemyAtScreen(gs: GS, sx: number, sy: number, tolerance = 60): Enemy | null {
  const wx = gs.camX + sx
  const wy = gs.camY + sy
  let best: Enemy | null = null
  let bestD = tolerance
  for (const e of gs.enemies) {
    if (!e.alive) continue
    const d = dist(wx, wy, e.x, e.y)
    if (d < bestD) {
      best = e
      bestD = d
    }
  }
  return best
}

/** Establece el objetivo marcado (retícula). Devuelve true si hay objetivo. */
export function setTarget(gs: GS, e: Enemy | null): boolean {
  gs.targetId = e ? e.id : null
  return !!e
}

/** Disparo manual: el láser activo (x1/x2/x3) dispara; los misiles disparan en
 * paralelo con su propio timer (delay mayor) mientras haya munición de misil. */
export function updateManualFire(gs: GS, dt: number): void {
  const p = gs.player
  const w = weaponDef(gs.activeWeapon)
  const isMissileActive = w.kind === "missile"

  p.fireTimer -= dt * 1000
  gs.missileTimer -= dt * 1000
  if (!gs.firing) return

  // Mantener el objetivo (si murió, se pierde)
  const target = gs.enemies.find(e => e.id === gs.targetId && e.alive)
  if (!target) {
    gs.targetId = null
    return
  }

  const a = angleTo(p.x, p.y, target.x, target.y)
  p.angle = a

  // Si el arma activa ES un misil, se dispara solo (comportamiento previo);
  // si es láser, el láser dispara y los misiles acompañan en paralelo.
  if (isMissileActive) {
    if (gs.ammo[gs.activeWeapon] <= 0) {
      gs.flashMsg = "¡Sin misiles! Recoge cajas"
      gs.flashT = Math.max(gs.flashT, 0.8)
      return
    }
    if (p.fireTimer <= 0) {
      p.fireTimer = w.fireRateMs
      gs.ammo[gs.activeWeapon] -= 1
      spawnMissile(gs, w, target, a)
    }
    return
  }

  // ── Láser activo ──
  if (gs.ammo[gs.activeWeapon] > 0 && p.fireTimer <= 0) {
    p.fireTimer = w.fireRateMs
    gs.ammo[gs.activeWeapon] -= 1
    const damage = weaponDamageForShip(shipBaseDamage(gs.save), gs.activeWeapon)
    gs.bullets.push({
      id: gs.nextId++, x: p.x, y: p.y,
      vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed,
      damage, radius: w.bulletRadius, fromPlayer: true, color: w.color,
      kind: "laser", life: shotLifetime(w.bulletSpeed), weapon: gs.activeWeapon,
    })
    sfx.slice()
  }

  // Misiles en paralelo: usa gs.missileWeapon con su propia cadencia
  const mw = gs.missileWeapon
  if (mw) {
    const mdef = weaponDef(mw)
    if (gs.ammo[mw] > 0 && gs.missileTimer <= 0) {
      gs.missileTimer = mdef.fireRateMs
      gs.ammo[mw] -= 1
      spawnMissile(gs, mdef, target, a)
      sfx.whoosh()
    }
  }
}

function spawnMissile(gs: GS, w: ReturnType<typeof weaponDef>, target: Enemy, a: number): void {
  const p = gs.player
  const damage = weaponDamageForShip(shipBaseDamage(gs.save), w.id as AmmoType)
  gs.bullets.push({
    id: gs.nextId++, x: p.x, y: p.y,
    vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed,
    damage, radius: w.bulletRadius, fromPlayer: true, color: w.color,
    kind: "missile", life: shotLifetime(w.bulletSpeed) * 1.4, weapon: w.id as AmmoType,
    homing: w.homing ?? false, turn: w.turn ?? 0, aoe: w.aoe ?? 0,
    targetId: target.id,
    arcSide: w.homing ? (missileArcFlip = missileArcFlip === 1 ? -1 : 1) : undefined,
    arcT: 0,
  })
}

let missileArcFlip: 1 | -1 = 1

// Vida del proyectil según el alcance de disparo (FIRE_RANGE) y la velocidad
function shotLifetime(speed: number): number {
  return Math.max(0.4, FIRE_RANGE / speed)
}

export function updateBullets(gs: GS, dt: number): void {
  // Mover balas (misiles homing con arco en U)
  for (const b of gs.bullets) {
    b.life -= dt
    if (b.homing && b.fromPlayer) {
      const t = gs.enemies.find(e => e.id === b.targetId && e.alive)
      const cur = Math.atan2(b.vy, b.vx)
      if (t) {
        const a = Math.atan2(t.y - b.y, t.x - b.x)
        if (b.arcSide) {
          b.arcT = (b.arcT ?? 0) + dt
          if (b.arcT < 0.45) {
            // Fase de flanqueo: vira hacia su lado para hacer la U
            const next = turnToward(cur, a + b.arcSide * Math.PI / 2, (b.turn ?? 4) * dt)
            const sp = Math.hypot(b.vx, b.vy)
            b.vx = Math.cos(next) * sp
            b.vy = Math.sin(next) * sp
            b.x += b.vx * dt
            b.y += b.vy * dt
            continue
          }
          b.arcSide = undefined
        }
        const next = turnToward(cur, a, (b.turn ?? 4) * dt)
        const sp = Math.hypot(b.vx, b.vy)
        b.vx = Math.cos(next) * sp
        b.vy = Math.sin(next) * sp
      }
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
  }

  // Colisiones balas del jugador → enemigos
  for (let i = gs.bullets.length - 1; i >= 0; i--) {
    const b = gs.bullets[i]
    if (!b.fromPlayer) continue
    let removed = false
    for (const e of gs.enemies) {
      if (!e.alive) continue
      if (dist(b.x, b.y, e.x, e.y) <= b.radius + e.size / 2) {
        e.hp -= b.damage
        e.hitFlash = 0.1
        sfx.hit()
        pushFloater(gs, b.x, b.y - e.size / 2, `-${b.damage}`, "#ffddaa", 14)
        if (b.aoe && b.aoe > 0) {
          // Explosión AoE daña a todos los enemigos cercanos
          for (const other of gs.enemies) {
            if (other !== e && other.alive && dist(b.x, b.y, other.x, other.y) <= b.aoe) {
              other.hp -= b.damage * 0.6
              other.hitFlash = 0.1
            }
          }
          gs.shake = 8
          pushShockwave(gs, b.x, b.y, b.aoe, "#ff8844")
        }
        if (e.hp <= 0) onEnemyKilled(gs, e)
        removed = true
        break
      }
    }
    if (removed) gs.bullets.splice(i, 1)
  }

  // Colisiones balas enemigas → jugador
  for (let i = gs.bullets.length - 1; i >= 0; i--) {
    const b = gs.bullets[i]
    if (b.fromPlayer) continue
    if (gs.inSafeZone) {
      gs.bullets.splice(i, 1)
      continue
    }
    if (dist(b.x, b.y, gs.player.x, gs.player.y) <= b.radius + PLAYER_RADIUS) {
      gs.bullets.splice(i, 1)
      applyDamageToPlayer(gs, b.damage)
    }
  }

  // Limpiar balas muertas / fuera de rango
  gs.bullets = gs.bullets.filter(b => b.life > 0 && b.x > -200 && b.x < CONFIG.map.size * CONFIG.map.cell + 200 && b.y > -200 && b.y < CONFIG.map.size * CONFIG.map.cell + 200)
}

function turnToward(cur: number, target: number, maxTurn: number): number {
  let d = (target - cur) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  const step = clamp(d, -maxTurn, maxTurn)
  return cur + step
}

/** Resuelve daño al jugador: evasión → escudo (%) → casco. */
export function applyDamageToPlayer(gs: GS, raw: number): void {
  const p = gs.player
  if (p.invulnT > 0 || gs.inSafeZone) return

  gs.lastHitT = gs.time

  // 1. Evasión por movimiento
  if (chance(evasionChance(gs))) {
    pushFloater(gs, p.x, p.y - 40, "EVADIDO", "#7CFF5A", 15)
    return
  }

  // 2. Escudo absorbente
  let remaining = raw
  if (p.shieldHp > 0) {
    const absorbed = Math.min(p.shieldHp, raw * SHIELD_ABSORB)
    p.shieldHp -= absorbed
    remaining = raw - absorbed
    gs.shieldFlashT = 0.35
    if (p.shieldHp <= 0) {
      p.shieldHp = 0
      sfx.error()
      pushFloater(gs, p.x, p.y - 30, "ESCUDO ROTO", "#ff5533", 14)
    }
  }

  // 3. Casco
  if (remaining > 0) {
    p.hp -= remaining
    p.invulnT = INVULN_AFTER_HIT
    gs.shake = 10
    sfx.hurt()
    pushFloater(gs, p.x, p.y - 30, `-${Math.round(remaining)}`, "#ff5533", 18)
    if (p.hp <= 0) {
      p.hp = 0
      gs.phase = "dead"
      gs.respawnT = 0
      sfx.gameover()
    }
  }
}

export function onEnemyKilled(gs: GS, e: Enemy): void {
  e.alive = false
  e.hp = 0
  e.respawnT = gs.time
  gs.kills++
  gs.save.kills++
  gs.shake = Math.max(gs.shake, e.kind === "boss" ? 14 : 6)
  sfx.explode()
  // XP por bajas (más en jefes)
  const xpGain = e.kind === "boss" ? 40 : 8
  const ups = addXp(gs.save, xpGain)
  if (ups > 0) {
    gs.flashMsg = `¡Nivel ${gs.save.level}!`
    gs.flashT = 2.2
    sfx.levelup()
    pushEvent(gs, `⬆️ ¡Subiste al nivel ${gs.save.level}!`)
  }
  pushEvent(gs, e.kind === "boss" ? `💀 ¡${CONFIG.bosses.find(b => b.id === e.type)?.name ?? "Jefe"} derrotado!` : `💥 Enemigo destruido (+${CONFIG.balance.coinsPerKill}🪙 · +${xpGain}xp)`)

  // Monedas
  const coins = e.kind === "boss" ? CONFIG.balance.coinsPerBossKill : CONFIG.balance.coinsPerKill
  gs.save.coins += coins

  // Drops (aplicar probabilidades de config)
  rollDrops(gs, e)

  pushShockwave(gs, e.x, e.y, e.size, e.kind === "boss" ? "#ffaa66" : "#ff8844")
  pushParticles(gs, e.x, e.y, e.color, e.kind === "boss" ? 24 : 12)

  if (e.kind === "boss") {
    gs.save.bossKills[e.type] = (gs.save.bossKills[e.type] ?? 0) + 1
    if (!gs.save.mapsCleared.includes("M1")) gs.save.mapsCleared = [...gs.save.mapsCleared, "M1"]
    gs.flashMsg = `¡${CONFIG.bosses.find(b => b.id === e.type)?.name ?? "Jefe"} derrotado!`
    gs.flashT = 2.2
  }
}

function rollDrops(gs: GS, e: Enemy): void {
  const drops = CONFIG.drops
  const roll = Math.random()
  if (e.kind === "boss" || chance(e.dropChance)) {
    // jefes: núcleo + chatarra seguro
    if (e.kind === "boss") {
      spawnDrop(gs, e.x, e.y, "core")
      spawnDrop(gs, e.x, e.y, "scrap")
    } else {
      if (roll < drops.core.chance) spawnDrop(gs, e.x, e.y, "core")
      else if (roll < drops.core.chance + drops.energy.chance) spawnDrop(gs, e.x, e.y, "energy")
      else if (roll < drops.core.chance + drops.energy.chance + drops.scrap.chance) spawnDrop(gs, e.x, e.y, "scrap")
    }
    if (chance(drops.repairBot.chance)) spawnDrop(gs, e.x, e.y, "repairBot")
  }
}

function spawnDrop(gs: GS, x: number, y: number, dropId: string): void {
  gs.drops.push({
    id: gs.nextId++,
    x: x + rand(-10, 10), y: y + rand(-10, 10),
    dropId: dropId as DropId,
    vx: rand(-40, 40), vy: rand(-60, -20),
    life: 12, bobT: rand(0, Math.PI * 2),
  })
}

export function pushFloater(gs: GS, x: number, y: number, text: string, color: string, size = 15): void {
  gs.floaters.push({ x, y, vy: -40, life: 1.2, maxLife: 1.2, text, color, size })
}

export function pushShockwave(gs: GS, x: number, y: number, maxR: number, color: string): void {
  gs.shockwaves.push({ x, y, r: 6, maxR, life: 0.5, maxLife: 0.5, color })
}

export function pushParticles(gs: GS, x: number, y: number, color: string, n = 10): void {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2)
    const sp = rand(40, 220)
    gs.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.4, 0.9), maxLife: 0.9, color, r: rand(2, 5),
    })
  }
}

/** Repara HP con un robot del inventario. */
export function repairShip(gs: GS): void {
  if (gs.save.repairBots <= 0) {
    gs.flashMsg = "No tienes robots de reparación"
    gs.flashT = 1.2
    return
  }
  gs.save.repairBots -= 1
  const heal = Math.round(gs.player.maxHp * CONFIG.repairBot.healPct)
  gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + heal)
  gs.flashMsg = `🤖 Reparado +${heal}`
  gs.flashT = 1.4
  sfx.powerup()
  gs.shake = 4
}

/** Regeneración progresiva del escudo y del casco.
 * Solo repara si el jugador está en zona segura O lleva REGEN_IDLE_TIME segundos
 * sin recibir daño. En zona segura repara más rápido. */
export function rechargeShield(gs: GS, dt: number): void {
  const p = gs.player
  if (p.hp >= p.maxHp && p.shieldHp >= p.shieldMaxHp) return
  if (gs.phase !== "playing") return

  const safe = gs.inSafeZone
  const idle = gs.time - gs.lastHitT >= REGEN_IDLE_TIME
  if (!safe && !idle) return

  // Escudo progresivo
  if (p.shieldHp < p.shieldMaxHp) {
    p.shieldHp = Math.min(p.shieldMaxHp, p.shieldHp + (safe ? REGEN_SAFE_SHIELD_PER_SEC : REGEN_SHIELD_PER_SEC) * dt)
  }
  // Casco progresivo (solo repara si el escudo está completo, para que el escudo se priorice)
  if (p.shieldHp >= p.shieldMaxHp && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + (safe ? REGEN_SAFE_HP_PER_SEC : REGEN_HP_PER_SEC) * dt)
  }
}

/** ¿El jugador está siendo atravesado por el láser de algún jefe? */
export function laserHitsPlayer(gs: GS): boolean {
  const p = gs.player
  for (const e of gs.enemies) {
    if (!e.alive || e.kind !== "boss" || !e.laserActive) continue
    const len = 520
    for (let t = 0; t < len; t += 10) {
      const lx = e.x + Math.cos(e.laserAngle) * t
      const ly = e.y + Math.sin(e.laserAngle) * t
      if (dist(lx, ly, p.x, p.y) < 16) return true
    }
  }
  return false
}

export { defaultAmmo }