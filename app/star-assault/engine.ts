import type { Phase, GS, AmmoType, EnemyType, Enemy, Boss, Star, Bullet, Drop, DropKind, PowerupKind } from "./types"
import {
  W, H, HUD_H, PLAYER_W, PLAYER_H, PLAYER_Y, PLAYER_SPEED, PLAYER_VERT_MULT, PLAYER_MIN_Y, PLAYER_MAX_Y,
  SHIELD_MAX_HP, SHIELD_COOLDOWN, SHIELD_HURTBOX, COMBO_TIMEOUT, COMBO_MAX, FIRE_RATES, OVERDRIVE_MULT,
  AMMO_COLORS, AMMO_NAMES, OVERDRIVE_DURATION, MAGNET_DURATION, POWERUP_COLORS,
  CORE_PERF_GAIN, CORE_DROP_CHANCE, REPAIR_BOT_HEAL, CONFIG,
} from "./constants"
import {
  laserDef, getLaserInstance, equippedLaserUids, equippedShieldIds, totalLaserMult,
  effShieldMaxHP, effShieldDur, shieldDef, upShieldCd, equippedLaserTier,
  addLaserToInventory, ensureLoadouts,
} from "./items"
import type { ShipDef } from "./ships"
import { getShip } from "./ships"
import { WORLDS } from "./worlds"
import { SFX } from "./audio"
import { loadStarSave, writeStarSave, addXp } from "./save"
import type { ShipUpgrades } from "./save"

/* ── Helpers de mejoras de nave ── */

export function comboMult(combo: number): number { return 1 + combo * 0.25 }

export function upMaxHP(u: ShipUpgrades, ship: ShipDef): number { return Math.round((100 + u.hp * 20) * ship.hpMult) }
// Bonus de monedas ganadas por la mejora permanente "Botín"
export function upCoinMult(u: ShipUpgrades): number { return 1 + u.coinGain * 0.08 }
// Bonus de daño láser por la mejora permanente "Potencia Láser"
export function upLaserDmgMult(u: ShipUpgrades): number { return 1 + u.laserDmg * 0.06 }
export function upFireMult(u: ShipUpgrades): number { return 1 - u.fireRate * 0.08 }
export function upHasMagnet(u: ShipUpgrades, ship: ShipDef): boolean { return u.magnet >= 1 || ship.passive?.magnet === true }

/* ── HELPERS: crear entidades ── */

export function nextId(gs: GS): number { return gs.nextId++ }

export function makeEnemy(type: EnemyType, worldId: number, id: number, diffMult = 1): Enemy {
  const x = 60 + Math.random() * (W - 120)
  const configs: Record<EnemyType, Partial<Enemy>> = {
    scout:    { w: 28, h: 28, hp: 40,  maxHp: 40,  fireRate: 0,    color: "#ff4422", accent: "#ff8866", points: 50,  dropChance: 0.15 },
    grunt:    { w: 36, h: 34, hp: 90,  maxHp: 90,  fireRate: 2800, color: "#996644", accent: "#ccaa88", points: 100, dropChance: 0.25 },
    tank:     { w: 52, h: 48, hp: 240, maxHp: 240, fireRate: 2000, color: "#447744", accent: "#88cc88", points: 200, dropChance: 0.40 },
    stealth:  { w: 34, h: 32, hp: 55,  maxHp: 55,  fireRate: 2200, color: "#8844cc", accent: "#cc88ff", points: 120, dropChance: 0.30 },
    shooter:  { w: 38, h: 36, hp: 70,  maxHp: 70,  fireRate: 1600, color: "#226688", accent: "#44aacc", points: 150, dropChance: 0.35 },
    kamikaze: { w: 30, h: 30, hp: 30,  maxHp: 30,  fireRate: 0,    color: "#ff2266", accent: "#ffaacc", points: 130, dropChance: 0.30 },
    splitter: { w: 40, h: 38, hp: 80,  maxHp: 80,  fireRate: 0,    color: "#dd8800", accent: "#ffcc66", points: 160, dropChance: 0.35 },
    mini:     { w: 20, h: 20, hp: 22,  maxHp: 22,  fireRate: 0,    color: "#ffaa44", accent: "#ffdd99", points: 40,  dropChance: 0.10 },
  }
  const cfg = configs[type]
  // Velocidad base desde config (por tipo) + escala por mundo con tope
  const baseVy = CONFIG.balance.enemyBaseVy[type] ?? 70
  const worldScale = CONFIG.balance.enemyWorldScale
  const worldCap = CONFIG.balance.enemyWorldScaleCap
  const worldMult = 1 + Math.min(worldId * worldScale, worldCap)
  // Tint with world accent slightly (solo tipos base)
  const baseTinted = ["scout", "grunt", "tank", "stealth", "shooter"].includes(type)
  const color = !baseTinted ? cfg.color! :
                worldId === 0 ? cfg.color! :
                worldId === 1 ? (type === "stealth" ? "#9933ee" : cfg.color!) :
                worldId === 2 ? "#226622" :
                worldId === 3 ? "#224466" :
                worldId === 4 ? cfg.color! :
                worldId === 5 ? "#336688" :
                worldId === 6 ? "#993322" :
                worldId === 7 ? "#5a44aa" :
                worldId === 8 ? "#2a6a2a" :
                worldId === 9 ? "#5a7a9a" :
                worldId === 10 ? "#996622" :
                worldId === 11 ? "#aa2244" :
                worldId === 12 ? "#5566aa" :
                worldId === 13 ? "#1a7a3a" :
                worldId === 14 ? "#994466" :
                worldId === 15 ? "#4a3a8a" :
                cfg.color!
  const hp = Math.round(cfg.hp! * diffMult)
  return {
    id, type, x, y: -50,
    vx: type === "scout" ? (Math.random() - 0.5) * 140 : 0,
    vy: baseVy * worldMult * (0.9 + diffMult * 0.1),
    hp, maxHp: hp, w: cfg.w!, h: cfg.h!,
    fireTimer: cfg.fireRate ? cfg.fireRate * Math.random() : 999999,
    fireRate: cfg.fireRate ?? 0,
    oscPhase: Math.random() * Math.PI * 2,
    stealthTimer: type === "stealth" ? 2200 : 0,
    visible: type !== "stealth" ? true : false,
    color, accent: cfg.accent ?? "#ffffff",
    points: cfg.points!, dropChance: cfg.dropChance!,
    hitFlash: 0,
  }
}

export function makeBoss(worldId: number, hpMult = 1): Boss {
  const def = WORLDS[worldId]
  const hp = Math.round(def.bossHp * hpMult)
  return {
    x: W / 2, y: -100, hp, maxHp: hp,
    w: 90, h: 84,
    phase: 1, attackTimer: 3000, attackIdx: 0, moveTimer: 0, targetX: W / 2,
    color: def.bossColor, accent: def.bossAccent, alive: true, worldId,
    shieldActive: false, shieldHp: 200,
    teleportTimer: 0, teleportCooldown: 4500,
    gravPulseActive: false, gravTimer: 0,
    spawnTimer: 0, hitFlash: 0,
  }
}

export function makeStar(): Star {
  // 3 capas de parallax: 0 lejana (lenta, tenue), 1 media, 2 cercana (rápida, brillante)
  const layer = Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2
  const spd  = layer === 0 ? 15 + Math.random() * 20 : layer === 1 ? 45 + Math.random() * 35 : 90 + Math.random() * 70
  const r    = layer === 0 ? 0.4 + Math.random() * 0.6 : layer === 1 ? 0.8 + Math.random() * 0.9 : 1.3 + Math.random() * 1.4
  const bright = layer === 0 ? 0.2 + Math.random() * 0.25 : layer === 1 ? 0.4 + Math.random() * 0.3 : 0.65 + Math.random() * 0.35
  return { x: Math.random() * W, y: Math.random() * H, spd, r, bright, layer }
}

export function makeGS(): GS {
  const save = loadStarSave()
  ensureLoadouts(save.equipment)
  writeStarSave(save)
  const stars: Star[] = Array.from({ length: 120 }, makeStar)
  const maxHP = upMaxHP(save.upgrades, getShip(save))
  return {
    phase: "intro",
    playerX: W / 2, playerY: PLAYER_Y, playerHP: maxHP, playerMaxHP: maxHP, invTimer: 0,
    activeAmmo: "basic",
    ammo: { basic: -1, laser: 0, spread: 0, missile: 0 },
    fireTimer: 0,
    worldId: 0, wave: 0,
    waveState: "spawning", toSpawn: [], spawnTimer: 0, spawnDelay: 1200,
    score: 0,
    bullets: [], enemyBullets: [], enemies: [], boss: null, drops: [], particles: [],
    floaters: [], shockwaves: [], trail: [],
    stars, lastTime: 0, phaseTimer: 0, nextId: 0,
    touchX: null, touchY: null, isTouching: false,
    ammoBtns: [], worldBtns: [], hangarBtns: [], shipBtns: [], equipBtns: [], introBtns: [],
    equipTab: "lasers", hangarTab: "inventory", repairBtn: null,
    itemAreas: [], slotAreas: [], dragItem: null, dragX: 0, dragY: 0,
    confirm: null, confirmBtns: [],
    save, flashMsg: "", flashT: 0,
    worldScroll: 0, worldDragStartY: null, worldDragBase: 0,
    invScroll: 0, invDragStartY: null, invDragBase: 0,
    bossLaserActive: false, bossLaserT: 0, bossLaserX: W / 2,
    shieldActive: false, shieldHP: SHIELD_MAX_HP, shieldMaxHP: SHIELD_MAX_HP,
    shieldDuration: 0, shieldCooldown: 0, shieldCdMax: SHIELD_COOLDOWN,
    shieldBtn: null, screenShake: 0,
    combo: 0, comboTimer: 0,
    magnetT: 0, overdriveT: 0,
    runCoins: 0, lastRunCoins: 0,
    isEndless: false, endlessWave: 0,
  }
}

/* Helper: efectos visuales reutilizables */
export function spawnFloater(gs: GS, x: number, y: number, text: string, color: string, size = 12) {
  gs.floaters.push({ x, y, vy: -34, life: 0.8, maxLife: 0.8, text, color, size })
}

export function spawnShockwave(gs: GS, x: number, y: number, maxR: number, color: string) {
  gs.shockwaves.push({ x, y, r: 0, maxR, life: 0.4, maxLife: 0.4, color })
}

/* ── SPAWN BULLETS / PARTICLES ── */

function spawnPlayerBullets(gs: GS): Bullet[] {
  const x = gs.playerX, y = gs.playerY - PLAYER_H / 2 - 4
  const ammo = gs.activeAmmo
  // Daño proporcional a la cantidad de láseres equipados
  const dmg = (base: number) => Math.round(base * totalLaserMult(gs) * upLaserDmgMult(gs.save.upgrades))
  const configs: Record<AmmoType, () => Bullet[]> = {
    basic: () => [{
      id: nextId(gs), x, y, vx: 0, vy: -540, damage: dmg(26),   // buff 22→26
      ammo, fromPlayer: true, radius: 6, lifetime: 3,
    }],
    laser: () => [{
      id: nextId(gs), x, y, vx: 0, vy: -720, damage: dmg(65),
      ammo, fromPlayer: true, radius: 5, penetrate: true, lifetime: 3,
    }],
    spread: () => [
      { id: nextId(gs), x, y, vx: -130, vy: -520, damage: dmg(22), ammo, fromPlayer: true, radius: 7, lifetime: 3 },
      { id: nextId(gs), x, y, vx:    0, vy: -560, damage: dmg(22), ammo, fromPlayer: true, radius: 7, lifetime: 3 },
      { id: nextId(gs), x, y, vx:  130, vy: -520, damage: dmg(22), ammo, fromPlayer: true, radius: 7, lifetime: 3 },
    ],
    missile: () => [{
      id: nextId(gs), x, y, vx: 0, vy: -380, damage: dmg(90),
      ammo, fromPlayer: true, radius: 8, lifetime: 4, trackTimer: 0,
    }],
  }
  return configs[ammo]()
}

function spawnEnemyBullet(gs: GS, x: number, y: number, vx: number, vy: number, dmg: number) {
  gs.enemyBullets.push({
    id: nextId(gs), x, y, vx, vy, damage: dmg,
    ammo: "basic", fromPlayer: false, radius: 7, lifetime: 5,
  })
}

function spawnParticles(gs: GS, x: number, y: number, color: string, count: number, speed = 180) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2
    const spd = speed * (0.3 + Math.random() * 0.7)
    gs.particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 0.5 + Math.random() * 0.5, maxLife: 0.5 + Math.random() * 0.5,
      color, r: 2 + Math.random() * 5,
    })
  }
}

function spawnDrop(gs: GS, x: number, y: number) {
  // Pequeña probabilidad de núcleo de perfección (mejora el láser equipado)
  if (Math.random() < CORE_DROP_CHANCE) {
    gs.drops.push({ id: nextId(gs), x, y, vx: 0, vy: 55, kind: "core", bobT: Math.random() * Math.PI * 2 })
    return
  }
  // 22% de probabilidad de que el drop sea un power-up de campo en vez de munición
  if (Math.random() < 0.22) {
    const pu: PowerupKind[] = ["magnet", "overdrive", "bomb"]
    const kind = pu[Math.floor(Math.random() * pu.length)]
    gs.drops.push({ id: nextId(gs), x, y, vx: 0, vy: 55, kind, bobT: Math.random() * Math.PI * 2 })
    return
  }
  const types: AmmoType[] = ["laser", "spread", "missile"]
  // Weight by world (later worlds = better drops)
  const weights = [
    [6, 2, 1], [5, 3, 2], [4, 3, 3], [3, 4, 3], [2, 4, 4],
    [2, 4, 5], [2, 5, 5], [1, 5, 6],
    [2, 4, 6], [2, 4, 7], [1, 4, 7], [1, 4, 8],
    [1, 3, 8], [1, 3, 9], [0, 3, 9], [0, 3, 10],
  ][Math.min(gs.worldId, 15)] ?? [5, 3, 2]
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let kind: DropKind = "laser"
  for (let i = 0; i < types.length; i++) {
    r -= weights[i]; if (r <= 0) { kind = types[i]; break }
  }
  gs.drops.push({ id: nextId(gs), x, y, vx: 0, vy: 60, kind, bobT: Math.random() * Math.PI * 2 })
}

/* ── UPDATE ── */

export function update(gs: GS, dt: number) {
  gs.phaseTimer += dt
  if (gs.flashT > 0) gs.flashT -= dt
  if (gs.screenShake > 0) gs.screenShake = Math.max(0, gs.screenShake - dt * 20)

  // Update stars (parallax por capa)
  for (const s of gs.stars) {
    s.y += s.spd * dt
    if (s.y > H) { s.y = -4; s.x = Math.random() * W }
  }

  // Efectos visuales que corren siempre
  updateFloaters(gs, dt)
  updateShockwaves(gs, dt)

  if (gs.phase !== "playing" && gs.phase !== "boss") return

  // Combo timer
  if (gs.comboTimer > 0) {
    gs.comboTimer -= dt
    if (gs.comboTimer <= 0) gs.combo = 0
  }
  // Power-ups temporales
  if (gs.magnetT > 0) gs.magnetT -= dt
  if (gs.overdriveT > 0) gs.overdriveT -= dt

  updatePlayer(gs, dt)
  updatePlayerFire(gs, dt)
  updateBullets(gs, dt)
  updateEnemies(gs, dt)
  if (gs.boss) updateBoss(gs, dt)
  updateDrops(gs, dt)
  updateParticles(gs, dt)
  checkCollisions(gs)
  updateWaveProgression(gs, dt)
}

function updateFloaters(gs: GS, dt: number) {
  gs.floaters = gs.floaters.filter(f => {
    f.y += f.vy * dt; f.vy *= 0.92; f.life -= dt
    return f.life > 0
  })
}

function updateShockwaves(gs: GS, dt: number) {
  gs.shockwaves = gs.shockwaves.filter(s => {
    s.life -= dt
    s.r = s.maxR * (1 - s.life / s.maxLife)
    return s.life > 0
  })
}

// Registra una muerte de enemigo: combo, score, monedas, efectos
function registerKill(gs: GS, e: Enemy) {
  gs.combo = Math.min(gs.combo + 1, COMBO_MAX)
  gs.comboTimer = COMBO_TIMEOUT
  if (gs.combo > gs.save.bestCombo) gs.save.bestCombo = gs.combo
  const gained = Math.round(e.points * comboMult(gs.combo))
  gs.score += gained
  gs.runCoins += Math.max(1, Math.floor(gs.combo / 2 * upCoinMult(gs.save.upgrades)))
  spawnFloater(gs, e.x, e.y - 8, `+${gained}`, gs.combo >= 4 ? "#ffdd44" : "#ffffff", gs.combo >= 4 ? 14 : 11)
  spawnParticles(gs, e.x, e.y, e.color, 18, 200)
  spawnShockwave(gs, e.x, e.y, e.w * 2, "#ffffff")
  if (Math.random() < e.dropChance) spawnDrop(gs, e.x, e.y)
  SFX.explosion()
}

function updatePlayer(gs: GS, dt: number) {
  if (gs.touchX !== null && gs.touchY !== null) {
    // Movimiento horizontal
    const dx = gs.touchX - gs.playerX
    const maxStep = PLAYER_SPEED * getShip(gs.save).speedMult * dt
    gs.playerX += Math.sign(dx) * Math.min(Math.abs(dx), maxStep)
    gs.playerX = Math.max(PLAYER_W / 2 + 4, Math.min(W - PLAYER_W / 2 - 4, gs.playerX))
    // Movimiento vertical (adelante/arriba y atrás/abajo) con límite para esquivar
    const vyStep = PLAYER_SPEED * PLAYER_VERT_MULT * getShip(gs.save).speedMult * dt
    const dy = gs.touchY - gs.playerY
    gs.playerY += Math.sign(dy) * Math.min(Math.abs(dy), vyStep)
    gs.playerY = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_MAX_Y, gs.playerY))
  }
  if (gs.invTimer > 0) gs.invTimer -= dt

  // Estela de la nave (últimas 8 posiciones)
  gs.trail.push({ x: gs.playerX, y: gs.playerY })
  if (gs.trail.length > 8) gs.trail.shift()

  // Escudo activo: consume duración y HP
  if (gs.shieldActive) {
    gs.shieldDuration -= dt
    if (gs.shieldDuration <= 0 || gs.shieldHP <= 0) {
      gs.shieldActive = false
      gs.shieldCdMax = upShieldCd(gs.save.upgrades)
      gs.shieldCooldown = gs.shieldCdMax
      spawnParticles(gs, gs.playerX, gs.playerY, "#4488ff", 14, 160)
      if (gs.shieldHP <= 0) {
        gs.flashMsg = "¡Escudo destruido!"
        gs.flashT = 1.8
        SFX.shieldBreak()
      } else {
        gs.flashMsg = "Escudo agotado"
        gs.flashT = 1.2
        SFX.shieldOff()
      }
    }
  }
  if (!gs.shieldActive && gs.shieldCooldown > 0) gs.shieldCooldown -= dt
}

export function activateShield(gs: GS) {
  if ((gs.phase !== "playing" && gs.phase !== "boss")) return
  if (gs.shieldActive || gs.shieldCooldown > 0) {
    if (gs.shieldCooldown > 0) {
      gs.flashMsg = `Escudo en recarga: ${Math.ceil(gs.shieldCooldown)}s`
      gs.flashT = 1
    }
    return
  }
  gs.shieldActive = true
  gs.shieldMaxHP = effShieldMaxHP(gs)
  gs.shieldHP = gs.shieldMaxHP
  gs.shieldDuration = effShieldDur(gs)
  const sIds = equippedShieldIds(gs)
  const sCol = sIds.length > 0 ? shieldDef(sIds[0]).color : "#4488ff"
  spawnParticles(gs, gs.playerX, gs.playerY, sCol, 18, 140)
  gs.flashMsg = "¡Escudo activado!"
  gs.flashT = 1
  SFX.shieldOn()
}

// Usa un robot de reparación (un solo uso): repara % del HP máximo
export function repairShip(gs: GS) {
  if (gs.phase !== "playing" && gs.phase !== "boss") return
  if (gs.save.equipment.repairBots <= 0) {
    gs.flashMsg = "Sin robots de reparación"
    gs.flashT = 1
    SFX.shieldOff()
    return
  }
  if (gs.playerHP >= gs.playerMaxHP) {
    gs.flashMsg = "Vida al máximo"
    gs.flashT = 1
    return
  }
  gs.save.equipment.repairBots -= 1
  writeStarSave(gs.save)
  gs.playerHP = Math.min(gs.playerMaxHP, gs.playerHP + Math.round(gs.playerMaxHP * REPAIR_BOT_HEAL))
  gs.flashMsg = `🤖 Reparado +${Math.round(REPAIR_BOT_HEAL * 100)}%`
  gs.flashT = 1.6
  spawnParticles(gs, gs.playerX, gs.playerY, "#44ff88", 22, 160)
  SFX.pickup()
}

function effectiveFireRate(gs: GS, ammo: AmmoType): number {
  let rate = FIRE_RATES[ammo] / 1000
  rate *= upFireMult(gs.save.upgrades)
  rate *= getShip(gs.save).fireMult
  if (gs.overdriveT > 0) rate *= OVERDRIVE_MULT
  return rate
}

function updatePlayerFire(gs: GS, dt: number) {
  gs.fireTimer -= dt
  if (gs.fireTimer <= 0) {
    gs.fireTimer = effectiveFireRate(gs, gs.activeAmmo)
    const newBullets = spawnPlayerBullets(gs)
    if (gs.activeAmmo !== "basic") {
      const current = gs.ammo[gs.activeAmmo] ?? 0
      if (current <= 0) {
        gs.activeAmmo = "basic"
        gs.fireTimer = effectiveFireRate(gs, "basic")
        gs.flashMsg = "¡Sin " + AMMO_NAMES[gs.activeAmmo] + "!"
        gs.flashT = 1.5
        return
      }
      gs.ammo[gs.activeAmmo] = Math.max(0, current - 1)
      if (gs.ammo[gs.activeAmmo] === 0) {
        gs.flashMsg = "¡Sin munición especial!"
        gs.flashT = 1.5
        gs.activeAmmo = "basic"
      }
    }
    gs.bullets.push(...newBullets)
    // Sonido de disparo
    if (gs.activeAmmo === "laser") SFX.shootLaser()
    else if (gs.activeAmmo === "spread") SFX.shootSpread()
    else if (gs.activeAmmo === "missile") SFX.shootMissile()
    else SFX.shoot()
  }
}

function updateBullets(gs: GS, dt: number) {
  // Player bullets
  const laserTier = equippedLaserTier(gs)
  const tierColor = laserTier >= 5 ? "#ff55dd" : laserTier >= 4 ? "#aa66ff" : "#44ccff"
  gs.bullets = gs.bullets.filter(b => {
    b.lifetime -= dt
    // Missile tracking
    if (b.ammo === "missile" && b.trackTimer !== undefined) {
      b.trackTimer -= dt
      if (b.trackTimer <= 0) {
        b.trackTimer = 0.12
        // Find nearest enemy
        let nearest: Enemy | Boss | null = null
        let minDist = Infinity
        for (const e of gs.enemies) {
          const d = Math.hypot(e.x - b.x, e.y - b.y)
          if (d < minDist) { minDist = d; nearest = e }
        }
        if (!nearest && gs.boss?.alive) nearest = gs.boss
        if (nearest) {
          const ang = Math.atan2(nearest.y - b.y, nearest.x - b.x)
          const spd = Math.hypot(b.vx, b.vy)
          b.vx += Math.cos(ang) * spd * 0.3
          b.vy += Math.sin(ang) * spd * 0.3
          const newSpd = Math.hypot(b.vx, b.vy)
          const maxSpd = 600
          if (newSpd > maxSpd) { b.vx = b.vx / newSpd * maxSpd; b.vy = b.vy / newSpd * maxSpd }
        }
      }
    }
    // Estela de humo del misil
    if (b.ammo === "missile") {
      gs.particles.push({
        x: b.x, y: b.y + 6, vx: (Math.random() - 0.5) * 20, vy: 40,
        life: 0.3, maxLife: 0.3, color: "#ff8800", r: 2 + Math.random() * 2,
      })
    }
    // Estela de partículas según el tier del láser equipado
    if (b.ammo !== "missile" && b.ammo !== "laser" && laserTier >= 4 && Math.random() < (laserTier >= 5 ? 0.5 : 0.3)) {
      gs.particles.push({
        x: b.x, y: b.y + b.radius * 0.8, vx: (Math.random() - 0.5) * 30, vy: 60,
        life: 0.35, maxLife: 0.35, color: tierColor, r: 1.5 + Math.random() * 2,
      })
    }
    // World 4 gravity reversal
    if (gs.phase === "boss" && gs.boss?.gravPulseActive && gs.worldId === 3) {
      b.vy += 800 * dt   // pulls bullets downward
    }
    b.x += b.vx * dt; b.y += b.vy * dt
    return b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20 && b.lifetime > 0
  })
  // Enemy bullets
  gs.enemyBullets = gs.enemyBullets.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.lifetime -= dt
    return b.y < H + 20 && b.y > -20 && b.x > -20 && b.x < W + 20 && b.lifetime > 0
  })
}

function updateEnemies(gs: GS, dt: number) {
  for (const e of gs.enemies) {
    if (e.hitFlash > 0) e.hitFlash -= dt
    // Stealth toggle
    if (e.type === "stealth") {
      e.stealthTimer -= dt * 1000
      if (e.stealthTimer <= 0) {
        e.visible = !e.visible
        e.stealthTimer = e.visible ? 2200 : 1100
      }
    }
    // Scout oscillation
    if (e.type === "scout") {
      e.oscPhase += dt * 2.8
      e.x += Math.cos(e.oscPhase) * 130 * dt
    }
    // Kamikaze: acelera hacia el jugador
    if (e.type === "kamikaze") {
      const dx = gs.playerX - e.x
      e.vx += Math.sign(dx) * 300 * dt
      e.vx = Math.max(-260, Math.min(260, e.vx))
      e.vy = Math.min(e.vy + 120 * dt, 320)
      e.x += e.vx * dt; e.y += e.vy * dt
      // Estela roja
      if (Math.random() < 0.5) gs.particles.push({
        x: e.x, y: e.y - e.h / 2, vx: 0, vy: -30, life: 0.25, maxLife: 0.25, color: "#ff3366", r: 2,
      })
    } else if (e.type === "shooter") {
      // Shooter stays near top, oscillates X slowly
      if (e.y < H * 0.28) { e.y += e.vy * dt }
      else { e.vy = 0; e.oscPhase += dt * 1.2; e.x += Math.sin(e.oscPhase) * 60 * dt }
    } else {
      e.y += e.vy * dt
    }
    e.x = Math.max(e.w / 2 + 4, Math.min(W - e.w / 2 - 4, e.x))

    // Enemy fire
    if (e.fireRate > 0 && e.y > 0) {
      e.fireTimer -= dt * 1000
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireRate * (0.8 + Math.random() * 0.4)
        if (e.visible || e.type !== "stealth") {
          // Aim at player
          const dx = gs.playerX - e.x, dy = gs.playerY - e.y
          const mag = Math.hypot(dx, dy) || 1
          const spd = 200 + gs.worldId * 30
          spawnEnemyBullet(gs, e.x, e.y + e.h / 2, dx / mag * spd, dy / mag * spd, 12 + gs.worldId * 3)
        }
      }
    }
  }
  // Penalización: enemigos que ESCAPAN por el fondo cortan el combo
  const escaped = gs.enemies.filter(e => e.y >= H + 55)
  if (escaped.length > 0 && (gs.combo > 0 || gs.score > 0)) {
    gs.combo = 0; gs.comboTimer = 0
    spawnFloater(gs, W / 2, H - HUD_H - 30, "¡Escapó! Combo x1", "#ff5555", 13)
  }
  gs.enemies = gs.enemies.filter(e => e.y < H + 55)
}

function updateBoss(gs: GS, dt: number) {
  const b = gs.boss!
  if (!b.alive) return
  if (b.hitFlash > 0) b.hitFlash -= dt

  // Entry animation
  if (b.y < 120) { b.y += 80 * dt; return }

  // Move toward targetX
  b.moveTimer -= dt
  if (b.moveTimer <= 0) {
    b.moveTimer = 2.2 + Math.random()
    b.targetX = 80 + Math.random() * (W - 160)
  }
  const dx = b.targetX - b.x
  b.x += Math.sign(dx) * Math.min(Math.abs(dx), 120 * dt)

  // Phase 2 threshold
  if (b.hp < b.maxHp * 0.5 && b.phase === 1) {
    b.phase = 2
    gs.flashMsg = "¡FASE 2 ACTIVADA!"
    gs.flashT = 2
    gs.screenShake = 8
    spawnParticles(gs, b.x, b.y, b.accent, 30, 300)
    b.attackTimer = Math.min(b.attackTimer, 1200)
    SFX.bossPhase2()
  }

  // Attack timer
  b.attackTimer -= dt * 1000
  if (b.attackTimer <= 0) {
    executeBossAttack(gs, b)
    const baseRate = b.phase === 1 ? 2600 : 1600
    b.attackTimer = baseRate * (0.7 + Math.random() * 0.4)
  }

  // World-specific updates
  if (gs.worldId === 1) {  // Teleport boss
    b.teleportTimer -= dt * 1000
    if (b.teleportTimer <= 0) {
      b.teleportTimer = b.teleportCooldown
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
      b.x = 80 + Math.random() * (W - 160)
      b.y = 80 + Math.random() * (H * 0.3)
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
    }
  }
  if (gs.worldId === 3) {  // Gravity boss
    if (b.gravPulseActive) {
      b.gravTimer -= dt
      if (b.gravTimer <= 0) {
        b.gravPulseActive = false
        gs.flashMsg = "¡PULSO TERMINADO!"
        gs.flashT = 1
      }
    }
  }
  if (gs.worldId === 2) {  // Swarm queen spawns minions
    b.spawnTimer -= dt * 1000
    if (b.spawnTimer <= 0) {
      b.spawnTimer = b.phase === 1 ? 5000 : 3000
      const count = b.phase === 1 ? 2 : 4
      for (let i = 0; i < count; i++) {
        const e = makeEnemy("scout", gs.worldId, nextId(gs))
        e.x = b.x + (Math.random() - 0.5) * 80; e.y = b.y + b.h / 2
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Minions invocados!"
      gs.flashT = 1.2
    }
  }

  // Laser attack for boss
  if (gs.bossLaserActive) {
    gs.bossLaserT -= dt
    if (gs.bossLaserT <= 0) gs.bossLaserActive = false
  }
}

function executeBossAttack(gs: GS, b: Boss) {
  const px = gs.playerX, py = gs.playerY
  const bx = b.x, by = b.y + b.h / 2

  if (gs.worldId === 0) {
    // Centinela Rojo: spread shots
    const ways = b.phase === 1 ? 3 : 5
    for (let i = 0; i < ways; i++) {
      const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * (Math.PI / 5)
      const spd = 220
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 18)
    }
    if (b.phase === 2 && Math.random() < 0.4) {
      // Circle burst
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 160, Math.sin(ang) * 160, 14)
      }
    }
  } else if (gs.worldId === 1) {
    // Espectro Oscuro: aimed + laser
    const dx = px - bx, dy = py - by
    const spd = 260
    const burst = b.phase === 1 ? 1 : 3
    for (let i = 0; i < burst; i++) {
      const spread = (i - (burst - 1) / 2) * 0.3
      const ang = Math.atan2(dy, dx) + spread
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 20)
    }
    if (b.phase === 2 && Math.random() < 0.5) {
      gs.bossLaserActive = true
      gs.bossLaserT = 1.4
      gs.bossLaserX = bx
    }
  } else if (gs.worldId === 2) {
    // Reina: spiral
    b.attackIdx++
    const baseAng = (b.attackIdx * 0.7) % (Math.PI * 2)
    const ways = b.phase === 1 ? 4 : 6
    for (let i = 0; i < ways; i++) {
      const ang = baseAng + (i / ways) * Math.PI * 2
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 190, Math.sin(ang) * 190, 16)
    }
  } else if (gs.worldId === 3) {
    // Devorador: gravity + orbital
    if (!b.gravPulseActive && Math.random() < 0.4) {
      b.gravPulseActive = true
      b.gravTimer = 2.5
      gs.flashMsg = "¡PULSO GRAVITACIONAL!"
      gs.flashT = 1.5
    } else {
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2
        const spd = 170
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 15)
      }
    }
  } else if (gs.worldId === 4) {
    // Emperador: phase-scaled attacks
    if (b.phase === 1) {
      const ways = 3
      for (let i = 0; i < ways; i++) {
        const ang = -Math.PI / 2 + (i - 1) * 0.45
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 240, Math.sin(ang) * 240, 22)
      }
    } else {
      // Phase 2: 5-way + homing
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.35
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 260, Math.sin(ang) * 260, 24)
      }
      gs.bossLaserActive = true
      gs.bossLaserT = 1.6
      gs.bossLaserX = bx
      // Spawn elites
      if (Math.random() < 0.5) {
        const e = makeEnemy(Math.random() < 0.5 ? "tank" : "shooter", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 100; e.y = by + 40
        gs.enemies.push(e)
      }
    }
  } else if (gs.worldId === 5) {
    // Reina del Hielo: ráfagas apuntadas + anillos de cristal
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const spd = 250
    if (b.phase === 1) {
      // Trío apuntado + anillo lento ocasional
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.28
        const ang = Math.atan2(dy, dx) + spread
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 20)
      }
      if (Math.random() < 0.35) {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2
          spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 120, Math.sin(ang) * 120, 12)
        }
      }
    } else {
      // Fase 2: doble anillo giratorio + disparo grande
      for (let r = 0; r < 2; r++) {
        const off = b.attackIdx * 0.3 + r * Math.PI
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + off
          spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 165, Math.sin(ang) * 165, 13)
        }
      }
      spawnEnemyBullet(gs, bx, by, dx / mag * 280, dy / mag * 280, 24)
      if (Math.random() < 0.45) {
        gs.bossLaserActive = true
        gs.bossLaserT = 1.5
        gs.bossLaserX = bx
      }
    }
  } else if (gs.worldId === 6) {
    // Coloso de Magma: ráfaga radial + bola de magma apuntada
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const ways = b.phase === 1 ? 10 : 14
    for (let i = 0; i < ways; i++) {
      const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.15
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 175, Math.sin(ang) * 175, 14)
    }
    // Bola de magma lenta y potente
    spawnEnemyBullet(gs, bx, by, dx / mag * 180, dy / mag * 180, 30)
    if (b.phase === 2 && Math.random() < 0.45) {
      // Invoca kamikazes
      for (let i = 0; i < 3; i++) {
        const e = makeEnemy("kamikaze", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 120; e.y = by + 30
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Magma vivo!"
      gs.flashT = 1.2
    }
  } else if (gs.worldId === 7) {
    // Null, el Aniquilador: repertorio combinado de los jefes previos
    b.attackIdx++
    if (b.phase === 1) {
      // Cono 5 vías + espiral ocasional
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.35
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 255, Math.sin(ang) * 255, 22)
      }
      if (Math.random() < 0.4) {
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + b.attackIdx * 0.3
          spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 190, Math.sin(ang) * 190, 15)
        }
      }
    } else {
      // Fase 2: cono 7 vías + láser + élites + teleport
      for (let i = 0; i < 7; i++) {
        const ang = -Math.PI / 2 + (i - 3) * 0.28
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 270, Math.sin(ang) * 270, 24)
      }
      gs.bossLaserActive = true
      gs.bossLaserT = 1.7
      gs.bossLaserX = bx
      if (Math.random() < 0.55) {
        const e = makeEnemy(Math.random() < 0.5 ? "tank" : "stealth", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 120; e.y = by + 40
        gs.enemies.push(e)
      }
      if (Math.random() < 0.3) {
        spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
        b.x = 80 + Math.random() * (W - 160)
        b.y = 80 + Math.random() * (H * 0.3)
        spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
      }
    }
  } else if (gs.worldId === 8) {
    // Madre Maleza: enredaderas apuntadas + siembra de minions
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const volley = b.phase === 1 ? 3 : 5
    for (let i = 0; i < volley; i++) {
      const spread = (i - (volley - 1) / 2) * 0.26
      const ang = Math.atan2(dy, dx) + spread
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 250, Math.sin(ang) * 250, 20)
    }
    if (Math.random() < (b.phase === 1 ? 0.35 : 0.6)) {
      const n = b.phase === 1 ? 2 : 3
      for (let i = 0; i < n; i++) {
        const e = makeEnemy(Math.random() < 0.5 ? "scout" : "grunt", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 110; e.y = by + 30
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Maleza crece!"
      gs.flashT = 1.2
    }
    if (b.phase === 2) {
      // Anillo vegetal lento
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + b.attackIdx * 0.2
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 130, Math.sin(ang) * 130, 13)
      }
    }
  } else if (gs.worldId === 9) {
    // Leviatán: ráfagas + barrido de láser amplio
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const ways = b.phase === 1 ? 4 : 6
    for (let i = 0; i < ways; i++) {
      const spread = (i - (ways - 1) / 2) * 0.22
      const ang = Math.atan2(dy, dx) + spread
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 260, Math.sin(ang) * 260, 20)
    }
    if (Math.random() < (b.phase === 1 ? 0.35 : 0.55)) {
      gs.bossLaserActive = true
      gs.bossLaserT = b.phase === 1 ? 1.1 : 1.6
      gs.bossLaserX = bx
    }
  } else if (gs.worldId === 10) {
    // Inquisidor: cono severo + teleport judicial
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const ways = b.phase === 1 ? 5 : 7
    for (let i = 0; i < ways; i++) {
      const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * 0.3
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 250, Math.sin(ang) * 250, 22)
    }
    if (Math.random() < (b.phase === 1 ? 0.25 : 0.5)) {
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
      b.x = 80 + Math.random() * (W - 160)
      b.y = 80 + Math.random() * (H * 0.3)
      spawnParticles(gs, b.x, b.y, b.accent, 20, 250)
    }
    if (b.phase === 2 && Math.random() < 0.35) {
      // Bola de juicio apuntada
      spawnEnemyBullet(gs, bx, by, dx / mag * 260, dy / mag * 260, 26)
    }
  } else if (gs.worldId === 11) {
    // Cosechadora: ráfagas radiales + siega con splitters
    b.attackIdx++
    const ways = b.phase === 1 ? 12 : 16
    for (let i = 0; i < ways; i++) {
      const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.12
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 180, Math.sin(ang) * 180, 14)
    }
    if (Math.random() < (b.phase === 1 ? 0.3 : 0.55)) {
      const n = b.phase === 1 ? 1 : 2
      for (let i = 0; i < n; i++) {
        const e = makeEnemy("splitter", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 100; e.y = by + 30
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡Segadores liberados!"
      gs.flashT = 1.2
    }
  } else if (gs.worldId === 12) {
    // Obispo: anillos litúrgicos + teleport + láser
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    const rings = b.phase === 1 ? 1 : 2
    for (let r = 0; r < rings; r++) {
      const off = b.attackIdx * 0.25 + r * (Math.PI / 2)
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + off
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 150, Math.sin(ang) * 150, 14)
      }
    }
    spawnEnemyBullet(gs, bx, by, dx / mag * 260, dy / mag * 260, 22)
    if (b.phase === 2) {
      if (Math.random() < 0.45) {
        gs.bossLaserActive = true
        gs.bossLaserT = 1.5
        gs.bossLaserX = bx
      }
      if (Math.random() < 0.3) {
        spawnParticles(gs, b.x, b.y, b.accent, 18, 220)
        b.x = 80 + Math.random() * (W - 160)
        b.y = 80 + Math.random() * (H * 0.3)
        spawnParticles(gs, b.x, b.y, b.accent, 18, 220)
      }
    }
  } else if (gs.worldId === 13) {
    // Titán Verde: placaje radial + onda expansiva lenta + refuerzos
    b.attackIdx++
    const ways = b.phase === 1 ? 10 : 14
    for (let i = 0; i < ways; i++) {
      const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.1
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 190, Math.sin(ang) * 190, 15)
    }
    // Onda lenta y grande
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + b.attackIdx * 0.3
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 105, Math.sin(ang) * 105, 20)
    }
    if (b.phase === 2 && Math.random() < 0.4) {
      const e = makeEnemy("tank", gs.worldId, nextId(gs))
      e.x = bx + (Math.random() - 0.5) * 120; e.y = by + 30
      gs.enemies.push(e)
      gs.flashMsg = "¡Refuerzos de titanio!"
      gs.flashT = 1.2
    }
  } else if (gs.worldId === 14) {
    // Vanguardia: alterna cono / espiral según el ataque
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    if (b.attackIdx % 2 === 0) {
      const ways = b.phase === 1 ? 5 : 7
      for (let i = 0; i < ways; i++) {
        const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * 0.32
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 255, Math.sin(ang) * 255, 21)
      }
    } else {
      const ways = b.phase === 1 ? 8 : 12
      for (let i = 0; i < ways; i++) {
        const ang = (i / ways) * Math.PI * 2 + b.attackIdx * 0.2
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 180, Math.sin(ang) * 180, 14)
      }
    }
    if (b.phase === 2) {
      spawnEnemyBullet(gs, bx, by, dx / mag * 270, dy / mag * 270, 24)
      if (Math.random() < 0.3) {
        gs.bossLaserActive = true
        gs.bossLaserT = 1.4
        gs.bossLaserX = bx
      }
    }
  } else if (gs.worldId === 15) {
    // Amarok: el repertorio completo, potenciado
    b.attackIdx++
    const dx = px - bx, dy = py - by
    const mag = Math.hypot(dx, dy) || 1
    // Espiral doble giratoria
    const spiralWays = b.phase === 1 ? 8 : 12
    for (let r = 0; r < 2; r++) {
      const off = r * Math.PI
      for (let i = 0; i < spiralWays; i++) {
        const ang = (i / spiralWays) * Math.PI * 2 + b.attackIdx * 0.18 + off
        spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 185, Math.sin(ang) * 185, 15)
      }
    }
    // Cono principal
    const ways = b.phase === 1 ? 7 : 9
    for (let i = 0; i < ways; i++) {
      const ang = -Math.PI / 2 + (i - (ways - 1) / 2) * 0.26
      spawnEnemyBullet(gs, bx, by, Math.cos(ang) * 270, Math.sin(ang) * 270, 24)
    }
    // Bola apuntada letal
    spawnEnemyBullet(gs, bx, by, dx / mag * 290, dy / mag * 290, 30)
    if (b.phase === 2) {
      gs.bossLaserActive = true
      gs.bossLaserT = 1.8
      gs.bossLaserX = bx
      for (let i = 0; i < 2; i++) {
        const e = makeEnemy(Math.random() < 0.5 ? "tank" : "stealth", gs.worldId, nextId(gs))
        e.x = bx + (Math.random() - 0.5) * 130; e.y = by + 40
        gs.enemies.push(e)
      }
      gs.flashMsg = "¡FURIA DE AMAROK!"
      gs.flashT = 1.3
    }
  }
}

function collectDrop(gs: GS, d: Drop) {
  if (d.kind === "core") {
    // Núcleo de perfección: mejora el primer láser equipado (por individual)
    const eq = gs.save.equipment
    const uids = equippedLaserUids(gs)
    const curUid = uids.length > 0 ? uids[0] : (eq.lasers[0]?.uid ?? "laser_std")
    const inst = getLaserInstance(eq, curUid)
    if (!inst) return
    if (inst.perfection >= 100) {
      // Láser ya perfecto: el núcleo se convierte en monedas
      gs.runCoins += Math.round(5 * upCoinMult(gs.save.upgrades))
      gs.flashMsg = "Láser perfecto · +5 monedas"
      gs.flashT = 1.5
      spawnParticles(gs, d.x, d.y, "#ffcc44", 12, 130)
      SFX.pickup()
      return
    }
    inst.perfection = Math.min(100, inst.perfection + CORE_PERF_GAIN)
    const np = inst.perfection
    gs.flashMsg = np >= 100 ? `★ ${laserDef(inst.type).name} ¡PERFECTO! ★` : `Núcleo: perfección +${CORE_PERF_GAIN}%`
    gs.flashT = 1.8
    spawnParticles(gs, d.x, d.y, "#ffee44", 18, 160)
    spawnShockwave(gs, d.x, d.y, 40, "#ffee44")
    SFX.pickup()
    return
  }
  if (d.kind === "magnet" || d.kind === "overdrive" || d.kind === "bomb") {
    // Power-up de campo
    if (d.kind === "magnet") {
      gs.magnetT = MAGNET_DURATION
      gs.flashMsg = "🧲 ¡Imán activado!"
    } else if (d.kind === "overdrive") {
      gs.overdriveT = OVERDRIVE_DURATION
      gs.flashMsg = "⚡ ¡Sobrecarga de disparo!"
    } else {
      // Bomba: limpia balas enemigas y daña a todos los enemigos visibles
      gs.enemyBullets = []
      gs.screenShake = Math.max(gs.screenShake, 10)
      for (const e of gs.enemies) {
        e.hp -= 120; e.hitFlash = 0.1
        spawnParticles(gs, e.x, e.y, "#ffdd00", 6, 150)
        if (e.hp <= 0 && e.hp !== -1) { registerKill(gs, e); e.hp = -1 }
      }
      gs.enemies = gs.enemies.filter(e => e.hp > 0)
      if (gs.boss?.alive) { gs.boss.hp -= 200; gs.boss.hitFlash = 0.12 }
      spawnShockwave(gs, W / 2, H / 2, W, "#ffdd00")
      gs.flashMsg = "💣 ¡BOMBA!"
    }
    gs.flashT = 1.5
    spawnParticles(gs, d.x, d.y, POWERUP_COLORS[d.kind], 14, 150)
    SFX.pickup()
    return
  }
  // Munición
  const ammo = d.kind as AmmoType
  if (ammo === "laser") {
    // Los drops de "láser" dan puntos de mejora (gastables en cualquier láser)
    // y munición de láser para disparar (separada del inventario de piezas).
    const pts = 10
    gs.save.perfectionPoints = (gs.save.perfectionPoints ?? 0) + pts
    gs.ammo.laser = (gs.ammo.laser ?? 0) + 10
    gs.save.bankedAmmo = { ...gs.save.bankedAmmo, laser: gs.ammo.laser }
    writeStarSave(gs.save)
    spawnParticles(gs, d.x, d.y, AMMO_COLORS.laser, 10, 120)
    gs.flashMsg = `+${pts} puntos de mejora · +10 láser`
    gs.flashT = 1.6
    SFX.pickup()
    return
  }
  const amounts: Record<AmmoType, number> = { basic: -1, laser: 15, spread: 20, missile: 10 }
  gs.ammo[ammo] += amounts[ammo]
  spawnParticles(gs, d.x, d.y, AMMO_COLORS[ammo], 10, 120)
  gs.flashMsg = `+${amounts[ammo]} ${AMMO_NAMES[ammo]}!`
  gs.flashT = 1.5
  SFX.pickup()
}

function updateDrops(gs: GS, dt: number) {
  const magnetOn = gs.magnetT > 0 || upHasMagnet(gs.save.upgrades, getShip(gs.save))
  gs.drops = gs.drops.filter(d => {
    d.bobT += dt * 2
    if (magnetOn) {
      // Vuela hacia la nave
      const dx = gs.playerX - d.x, dy = gs.playerY - d.y
      const mag = Math.hypot(dx, dy) || 1
      const pull = 420
      d.x += dx / mag * pull * dt
      d.y += dy / mag * pull * dt
    } else {
      d.y += d.vy * dt
    }
    // Check collection
    const dist = Math.hypot(d.x - gs.playerX, d.y - gs.playerY)
    if (dist < 32) {
      collectDrop(gs, d)
      return false
    }
    return d.y < H + 40
  })
}

function updateParticles(gs: GS, dt: number) {
  gs.particles = gs.particles.filter(p => {
    p.x += p.vx * dt; p.y += p.vy * dt
    p.vx *= 0.96; p.vy *= 0.96
    p.life -= dt
    return p.life > 0
  })
}

// Daño al jugador; el escudo absorbe si está activo. Devuelve true si murió.
function damagePlayer(gs: GS, dmg: number, invSet: number, hitColor: string) {
  if (gs.shieldActive) {
    gs.shieldHP -= dmg
    spawnParticles(gs, gs.playerX, gs.playerY, "#4488ff", 8, 150)
    gs.screenShake = Math.max(gs.screenShake, 4)
    return false
  }
  if (gs.invTimer > 0) return false
  gs.playerHP -= dmg
  gs.invTimer = invSet
  gs.combo = 0; gs.comboTimer = 0   // recibir daño corta la racha
  gs.screenShake = Math.max(gs.screenShake, 7)
  spawnParticles(gs, gs.playerX, gs.playerY, hitColor, 14, 170)
  SFX.playerHit()
  if (gs.playerHP <= 0) { gs.playerHP = 0; transitionTo(gs, "gameover"); return true }
  return false
}

function onBossDefeated(gs: GS, b2: Boss) {
  b2.alive = false
  gs.score += 1000 + gs.worldId * 500
  gs.runCoins += Math.round((50 + gs.worldId * 25) * upCoinMult(gs.save.upgrades))
  gs.screenShake = 14
  spawnShockwave(gs, b2.x, b2.y, 200, b2.accent)
  spawnParticles(gs, b2.x, b2.y, b2.accent, 60, 350)
  for (let i = 0; i < 5; i++) {
    setTimeout(() => spawnParticles(gs, b2.x + (Math.random() - 0.5) * 100, b2.y + (Math.random() - 0.5) * 60, b2.accent, 20, 200), i * 200)
  }
  // Los jefes siempre arrojan núcleos para mejorar el láser
  const coreCount = gs.isEndless ? 1 : 2
  for (let i = 0; i < coreCount; i++) {
    gs.drops.push({ id: nextId(gs), x: b2.x + (Math.random() - 0.5) * 120, y: b2.y + 40 + i * 30, vx: 0, vy: 55, kind: "core", bobT: Math.random() * Math.PI * 2 })
  }
  SFX.bigExplosion()
  if (gs.isEndless) {
    // En endless el jefe no termina el nivel: se reanuda con más dificultad
    gs.boss = null
    gs.bossLaserActive = false
    gs.phase = "playing"
    gs.flashMsg = "¡Mini-jefe derrotado! +monedas"
    gs.flashT = 2
    startNextEndlessWave(gs)
  } else {
    transitionTo(gs, "world-clear")
  }
}

function checkCollisions(gs: GS) {
  // Player bullets vs enemies
  for (const e of gs.enemies) {
    const toRemove: number[] = []
    for (const b of gs.bullets) {
      if (!e.visible && e.type === "stealth") continue
      const dist = Math.hypot(b.x - e.x, b.y - e.y)
      if (dist < b.radius + Math.min(e.w, e.h) / 2) {
        e.hp -= b.damage
        e.hitFlash = 0.07
        spawnParticles(gs, b.x, b.y, AMMO_COLORS[b.ammo], 4, 120)
        spawnFloater(gs, b.x, b.y - 6, String(b.damage), AMMO_COLORS[b.ammo], 10)
        if (!b.penetrate) toRemove.push(b.id)
        if (e.hp > 0) {
          SFX.enemyHit()
        } else {
          // Splitter se divide al morir
          if (e.type === "splitter") {
            for (let s = -1; s <= 1; s += 2) {
              const mini = makeEnemy("mini", gs.worldId, nextId(gs))
              mini.x = e.x; mini.y = e.y; mini.vx = s * 90
              gs.enemies.push(mini)
            }
          }
          registerKill(gs, e)
          e.hp = -1  // mark dead
        }
      }
    }
    if (toRemove.length) gs.bullets = gs.bullets.filter(b => !toRemove.includes(b.id))
  }
  gs.enemies = gs.enemies.filter(e => e.hp > 0)

  // Player bullets vs boss
  if (gs.boss?.alive) {
    const b2 = gs.boss
    const toRemoveBoss: number[] = []
    for (const b of gs.bullets) {
      const dist = Math.hypot(b.x - b2.x, b.y - b2.y)
      if (dist < b.radius + Math.min(b2.w, b2.h) / 2) {
        let dmg = b.damage
        if (b2.shieldActive) { dmg = Math.round(dmg * 0.15) }
        b2.hp -= dmg
        b2.hitFlash = 0.06
        spawnParticles(gs, b.x, b.y, b2.shieldActive ? "#44aaff" : AMMO_COLORS[b.ammo], 4, 100)
        spawnFloater(gs, b.x, b.y - 6, String(dmg), b2.shieldActive ? "#44aaff" : AMMO_COLORS[b.ammo], 10)
        if (!b.penetrate) toRemoveBoss.push(b.id)
        if (b2.hp > 0) {
          SFX.enemyHit()
        } else {
          onBossDefeated(gs, b2)
        }
      }
    }
    if (toRemoveBoss.length) gs.bullets = gs.bullets.filter(b => !toRemoveBoss.includes(b.id))
  }

  // Enemy bullets vs player (escudo absorbe el daño)
  for (const b of gs.enemyBullets) {
    const dist = Math.hypot(b.x - gs.playerX, b.y - gs.playerY)
    const hitRadius = gs.shieldActive ? SHIELD_HURTBOX : 18
    if (dist < b.radius + hitRadius) {
      b.lifetime = 0
      if (damagePlayer(gs, b.damage, 1.2, "#00e5ff")) return
      if (!gs.shieldActive) break
    }
  }

  // Colisión cuerpo-a-cuerpo: enemigo contra la nave
  const contactDmg: Partial<Record<EnemyType, number>> = {
    scout: 12, grunt: 18, tank: 30, stealth: 14, shooter: 16, kamikaze: 25, splitter: 20, mini: 10,
  }
  for (const e of gs.enemies) {
    if (!e.visible && e.type === "stealth") continue
    const dist = Math.hypot(e.x - gs.playerX, e.y - gs.playerY)
    if (dist < e.w / 2 + 18) {
      const dmg = contactDmg[e.type] ?? 15
      // El kamikaze y los minis explotan al chocar
      if (e.type === "kamikaze" || e.type === "mini" || e.type === "splitter") {
        e.hp = -1
        spawnParticles(gs, e.x, e.y, e.color, 16, 200)
        spawnShockwave(gs, e.x, e.y, e.w * 2, "#ff4400")
        SFX.explosion()
      }
      if (damagePlayer(gs, dmg, 1.2, "#ff4400")) return
    }
  }
  gs.enemies = gs.enemies.filter(e => e.hp > 0)

  // Boss laser vs player
  if (gs.bossLaserActive && gs.boss?.alive) {
    const lx = gs.bossLaserX
    if (Math.abs(gs.playerX - lx) < 20) {
      if (gs.shieldActive) {
        gs.shieldHP -= 40 * 0.016
      } else if (gs.invTimer <= 0) {
        gs.playerHP -= 30 * 0.016
        gs.invTimer = 0.05
        if (gs.playerHP <= 0) { gs.playerHP = 0; transitionTo(gs, "gameover"); return }
      }
    }
  }

  // Boss contact
  if (gs.boss?.alive) {
    const b2 = gs.boss
    const dist = Math.hypot(gs.playerX - b2.x, gs.playerY - b2.y)
    if (dist < 40) {
      if (damagePlayer(gs, 30, 1.5, "#ff4400")) return
    }
  }
}

// Dificultad y composición procedural para el modo Endless
function endlessDiffMult(wave: number): number { return 1 + Math.floor(wave / 3) * 0.12 }

function genEndlessWave(gs: GS): EnemyType[] {
  const wave = gs.endlessWave
  const diff = Math.floor(wave / 3)
  const count = Math.min(6 + Math.floor(wave / 2), 16)
  // Piscina de tipos que crece con la dificultad
  const pool: EnemyType[] = ["scout", "grunt"]
  if (wave >= 2) pool.push("shooter")
  if (wave >= 3) pool.push("kamikaze")
  if (wave >= 4) pool.push("tank", "stealth")
  if (wave >= 6) pool.push("splitter")
  const list: EnemyType[] = []
  for (let i = 0; i < count; i++) list.push(pool[Math.floor(Math.random() * pool.length)])
  // Cicla el worldId por estética de fondo
  gs.worldId = wave % WORLDS.length
  return list.concat(new Array(diff).fill("scout"))  // relleno extra a mayor dificultad
}

function startNextEndlessWave(gs: GS) {
  gs.endlessWave++
  if (gs.endlessWave > gs.save.endlessBest) gs.save.endlessBest = gs.endlessWave
  // Mini-jefe cada 5 oleadas
  if (gs.endlessWave % 5 === 0) {
    gs.boss = makeBoss((gs.endlessWave / 5 - 1) % WORLDS.length, 0.6 + gs.endlessWave * 0.04)
    gs.phase = "boss"
    gs.waveState = "done"
    gs.flashMsg = `¡MINI-JEFE! Oleada ${gs.endlessWave}`
    gs.flashT = 2.2
    SFX.bossIntro()
    return
  }
  gs.toSpawn = genEndlessWave(gs)
  gs.spawnTimer = 0
  gs.spawnDelay = Math.max(400, 900 - gs.endlessWave * 25)
  gs.waveState = "spawning"
  gs.flashMsg = `OLEADA ${gs.endlessWave}`
  gs.flashT = 1.6
}

function updateWaveProgression(gs: GS, dt: number) {
  // ── Modo ENDLESS ──
  if (gs.isEndless) {
    if (gs.waveState === "spawning") {
      gs.spawnTimer -= dt * 1000
      if (gs.spawnTimer <= 0 && gs.toSpawn.length > 0) {
        const type = gs.toSpawn.shift()!
        gs.enemies.push(makeEnemy(type, gs.worldId, nextId(gs), endlessDiffMult(gs.endlessWave)))
        gs.spawnTimer = gs.spawnDelay
      }
      if (gs.toSpawn.length === 0) gs.waveState = "clearing"
    }
    if (gs.waveState === "clearing" && gs.enemies.length === 0) {
      startNextEndlessWave(gs)
    }
    return
  }

  // ── Modo CAMPAÑA ──
  const worldDef = WORLDS[gs.worldId]
  const waveDef = worldDef.waves[gs.wave]

  if (gs.waveState === "spawning") {
    gs.spawnTimer -= dt * 1000
    if (gs.spawnTimer <= 0 && gs.toSpawn.length > 0) {
      const type = gs.toSpawn.shift()!
      gs.enemies.push(makeEnemy(type, gs.worldId, nextId(gs)))
      gs.spawnTimer = waveDef.delay
    }
    if (gs.toSpawn.length === 0) gs.waveState = "clearing"
  }

  if (gs.waveState === "clearing") {
    if (gs.enemies.length === 0) {
      if (gs.wave < worldDef.waves.length - 1) {
        gs.wave++
        const nextWave = worldDef.waves[gs.wave]
        gs.toSpawn = [...nextWave.enemies]
        gs.spawnTimer = nextWave.delay
        gs.waveState = "spawning"
        gs.flashMsg = `OLEADA ${gs.wave + 1}/${worldDef.waves.length}`
        gs.flashT = 2
      } else {
        gs.waveState = "boss-wait"
        gs.phaseTimer = 0
        transitionTo(gs, "boss-intro")
      }
    }
  }
}

// Resetea todo lo común al arrancar una partida (campaña o endless)
function resetRunState(gs: GS) {
  const maxHP = upMaxHP(gs.save.upgrades, getShip(gs.save))
  gs.playerMaxHP = maxHP; gs.playerHP = maxHP; gs.invTimer = 0
  gs.playerX = W / 2; gs.playerY = PLAYER_Y
  gs.touchX = null; gs.touchY = null
  gs.enemies = []; gs.bullets = []; gs.enemyBullets = []; gs.drops = []
  gs.boss = null; gs.bossLaserActive = false
  gs.fireTimer = 0
  gs.shieldActive = false; gs.shieldMaxHP = effShieldMaxHP(gs); gs.shieldHP = gs.shieldMaxHP
  gs.shieldDuration = 0; gs.shieldCooldown = 0
  gs.screenShake = 0
  gs.combo = 0; gs.comboTimer = 0
  gs.magnetT = 0; gs.overdriveT = 0
  gs.floaters = []; gs.shockwaves = []; gs.trail = []
}

// Banca las monedas de la corrida al save y otorga XP por el rendimiento
function bankCoins(gs: GS) {
  gs.lastRunCoins = gs.runCoins
  if (gs.runCoins > 0) {
    gs.save.coins += gs.runCoins
    // XP por rendimiento: 1 XP por moneda ganada + bonus por mundo
    const xpGain = gs.runCoins + gs.worldId * 15
    addXp(gs.save, xpGain)
    gs.runCoins = 0
  }
  saveBankedAmmo(gs)   // la munición sobrante se guarda para futuras partidas
  writeStarSave(gs.save)
}

// Munición guardada: carga el stock bancado al inicio de la partida
export function loadBankedAmmo(gs: GS) {
  const banked = gs.save.bankedAmmo ?? {}
  gs.ammo = { basic: -1, laser: banked.laser ?? 0, spread: banked.spread ?? 0, missile: banked.missile ?? 0 }
  gs.activeAmmo = "basic"
}
// Munición guardada: persiste el sobrante de la corrida al terminarla
function saveBankedAmmo(gs: GS) {
  gs.save.bankedAmmo = { basic: -1, laser: gs.ammo.laser, spread: gs.ammo.spread, missile: gs.ammo.missile }
}

export function startEndless(gs: GS) {
  gs.isEndless = true
  gs.endlessWave = 0
  gs.score = 0
  gs.runCoins = 0
  gs.worldId = 0
  loadBankedAmmo(gs)
  resetRunState(gs)
  gs.phase = "playing"; gs.phaseTimer = 0
  startNextEndlessWave(gs)
}

export function transitionTo(gs: GS, phase: Phase) {
  gs.phase = phase
  gs.phaseTimer = 0

  if (phase === "playing") {
    gs.isEndless = false
    const worldDef = WORLDS[gs.worldId]
    gs.wave = 0
    gs.toSpawn = [...worldDef.waves[0].enemies]
    gs.spawnTimer = worldDef.waves[0].delay
    gs.waveState = "spawning"
    resetRunState(gs)
  }

  if (phase === "boss-intro") {
    SFX.bossIntro()
  }

  if (phase === "boss") {
    gs.boss = makeBoss(gs.worldId)
    gs.enemies = []; gs.bullets = []; gs.enemyBullets = []
    gs.bossLaserActive = false
  }

  if (phase === "world-clear") {
    const prev = gs.save
    if (gs.worldId + 1 > prev.worldsCleared) prev.worldsCleared = gs.worldId + 1
    const prevHs = prev.highScores[gs.worldId] ?? 0
    if (gs.score > prevHs) prev.highScores[gs.worldId] = gs.score
    bankCoins(gs)
    SFX.worldClear()
  }

  if (phase === "gameover") {
    if (gs.isEndless && gs.endlessWave > gs.save.endlessBest) gs.save.endlessBest = gs.endlessWave
    bankCoins(gs)
    spawnParticles(gs, gs.playerX, gs.playerY, "#ff4400", 30, 250)
    spawnShockwave(gs, gs.playerX, gs.playerY, 120, "#ff4400")
  }
}