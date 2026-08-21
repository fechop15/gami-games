// Motor: estado inicial y update principal (orquesta todos los subsistemas).
import type { GS, PlayerState, HudPanelId, HudPanelState } from "../core/types"
import {
  W, H, PLAYABLE_MIN, PLAYABLE_MAX, BASE_X, BASE_Y,
  SHIELD_MAX_HP, SHIELD_COOLDOWN, PANEL_DEFAULT,
} from "../core/constants"
import { loadGalaxySave, writeGalaxySave, type GalaxySave } from "../core/save"
import { shipMaxHp } from "../data/ships"
import { defaultAmmo } from "../data/ammo"
import { currentMap, buildAsteroidBelt } from "../data/maps"
import { clamp } from "../../lib/math"
import { updatePlayer, evasionChance } from "./player"
import { updateSpawners, updateEnemies, bossLaserStep } from "./enemies"
import {
  updateManualFire, updateBullets, rechargeShield, laserHitsPlayer, applyDamageToPlayer,
  pushFloater, pushParticles,
} from "./combat"
import { updateCrates, updateDrops } from "./crates"

export function makeGS(): GS {
  const save = loadGalaxySave()
  const map = currentMap()
  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: 0.4 + Math.random() * 1.4,
    bright: 0.3 + Math.random() * 0.6,
    tw: Math.random() * Math.PI * 2,
  }))
  const maxHp = shipMaxHp(save)
  const player: PlayerState = {
    x: map.baseX,
    y: map.baseY,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    speed: 0,
    hp: maxHp,
    maxHp,
    shieldHp: SHIELD_MAX_HP,
    shieldMaxHp: SHIELD_MAX_HP,
    shieldCooldown: 0,
    shieldCdMax: SHIELD_COOLDOWN,
    invulnT: 0,
    fireTimer: 0,
  }
  const ammo = defaultAmmo()
  const hud = defaultHud(save)
  return {
    phase: "loading",
    loadPct: 0,
    save,
    time: 0,
    lastTime: 0,
    camX: 0,
    camY: 0,
    player,
    joystick: { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0 },
    targetId: null,
    firing: false,
    activeWeapon: "x1",
    missileWeapon: "missile_a",
    missileTimer: 0,
    ammo,
    enemies: [],
    bullets: [],
    crates: [],
    drops: [],
    asteroids: buildAsteroidBelt(),
    stars,
    particles: [],
    floaters: [],
    shockwaves: [],
    nextId: 1,
    spawnTimers: {},
    crateTimer: 0,
    inSafeZone: true,
    baseMenuOpen: false,
    minimapHidden: false,
    btns: [],
    shopBtns: [],
    flashMsg: "",
    flashT: 0,
    shake: 0,
    kills: 0,
    isTouching: false,
    respawnT: 0,
    lastHitT: 0,
    shieldFlashT: 0,
    hud,
    editMode: false,
    eventLog: [],
    dragPanel: null,
  }
}

// Layout del HUD: defaults según la posición guardada (o posición por defecto)
function defaultHud(save: { hud: Record<string, { x: number; y: number; minimized: boolean; orientation: "vertical" | "horizontal" }> }): Record<HudPanelId, HudPanelState> {
  const out = {} as Record<HudPanelId, HudPanelState>
  const ids: HudPanelId[] = ["vitals", "stats", "events", "minimap", "joystick", "fire", "ammo"]
  for (const id of ids) {
    const saved = save.hud[id]
    const def = PANEL_DEFAULT[id]
    out[id] = {
      x: saved?.x ?? def.x,
      y: saved?.y ?? def.y,
      minimized: saved?.minimized ?? false,
      orientation: saved?.orientation ?? "horizontal",
    }
  }
  return out
}

export function startRun(gs: GS): void {
  // Reset del mundo: enemigos, balas, cajas, drops (mantiene save y naves)
  gs.enemies = []
  gs.bullets = []
  gs.crates = []
  gs.drops = []
  gs.particles = []
  gs.floaters = []
  gs.shockwaves = []
  gs.spawnTimers = {}
  gs.crateTimer = 0
  gs.kills = 0
  gs.targetId = null
  gs.firing = false
  gs.activeWeapon = "x1"
  gs.missileWeapon = "missile_a"
  gs.missileTimer = 0
  gs.ammo = defaultAmmo()
  const map = currentMap()
  const p = gs.player
  p.x = map.baseX
  p.y = map.baseY
  p.vx = 0
  p.vy = 0
  p.angle = -Math.PI / 2
  p.hp = shipMaxHp(gs.save)
  p.maxHp = p.hp
  p.shieldHp = SHIELD_MAX_HP
  p.shieldMaxHp = SHIELD_MAX_HP
  p.shieldCooldown = 0
  p.invulnT = 1.5
  gs.phase = "playing"
  gs.respawnT = 0
  gs.joystick.dx = 0
  gs.joystick.dy = 0
  gs.inSafeZone = true
}

export function update(gs: GS, dt: number): void {
  gs.time += dt
  if (gs.flashT > 0) gs.flashT -= dt
  if (gs.shake > 0) gs.shake = Math.max(0, gs.shake - dt * 30)
  if (gs.shieldFlashT > 0) gs.shieldFlashT -= dt

  if (gs.phase === "playing") {
    updatePlayer(gs, dt)
    updateCamera(gs)
    updateSpawners(gs, dt)
    updateEnemies(gs, dt)
    for (const e of gs.enemies) if (e.alive && e.kind === "boss") bossLaserStep(gs, e, dt)
    updateCrates(gs, dt)
    updateDrops(gs, dt)
    updateManualFire(gs, dt)
    updateBullets(gs, dt)
    rechargeShield(gs, dt)

    // Láser de jefe golpea al jugador
    if (laserHitsPlayer(gs)) applyDamageToPlayer(gs, 10 * dt * 4)

    // Colisión cuerpo a cuerpo con enemigos
    for (const e of gs.enemies) {
      if (!e.alive) continue
      const d = Math.hypot(e.x - gs.player.x, e.y - gs.player.y)
      if (d <= e.size / 2 + 22) {
        applyDamageToPlayer(gs, e.contactDamage * dt * 2.5)
      }
    }

    // Al morir → fase dead
    if (gs.player.hp <= 0) {
      gs.phase = "dead"
      gs.respawnT = 0
    }
  } else if (gs.phase === "dead") {
    gs.respawnT += dt
    if (gs.respawnT >= 1.2) {
      respawnAtBase(gs)
    }
  }

  updateEffects(gs, dt)
}

function updateCamera(gs: GS): void {
  const p = gs.player
  gs.camX = clamp(p.x - W / 2, PLAYABLE_MIN - W / 2, PLAYABLE_MAX - W / 2)
  gs.camY = clamp(p.y - H / 2, PLAYABLE_MIN - H / 2, PLAYABLE_MAX - H / 2)
}

function respawnAtBase(gs: GS): void {
  const p = gs.player
  p.x = BASE_X
  p.y = BASE_Y
  p.hp = shipMaxHp(gs.save)
  p.maxHp = p.hp
  p.shieldHp = SHIELD_MAX_HP
  p.shieldMaxHp = SHIELD_MAX_HP
  p.shieldCooldown = 0
  p.invulnT = 2
  p.vx = 0
  p.vy = 0
  gs.phase = "playing"
  gs.flashMsg = "Respawn en la base"
  gs.flashT = 1.6
}

function updateEffects(gs: GS, dt: number): void {
  // Partículas
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const pt = gs.particles[i]
    pt.life -= dt
    pt.x += pt.vx * dt
    pt.y += pt.vy * dt
    if (pt.life <= 0) gs.particles.splice(i, 1)
  }
  // Floaters
  for (let i = gs.floaters.length - 1; i >= 0; i--) {
    const f = gs.floaters[i]
    f.life -= dt
    f.y += f.vy * dt
    if (f.life <= 0) gs.floaters.splice(i, 1)
  }
  // Shockwaves
  for (let i = gs.shockwaves.length - 1; i >= 0; i--) {
    const s = gs.shockwaves[i]
    s.life -= dt
    s.r += (s.maxR - s.r) * dt * 6
    if (s.life <= 0) gs.shockwaves.splice(i, 1)
  }
  // Asteroides rotando
  for (const a of gs.asteroids) a.angle += a.spin * dt

  // Limpieza de enemigos muertos (con delay para ver la muerte)
  if (gs.enemies.length > 0 && gs.enemies.some(e => !e.alive)) {
    gs.enemies = gs.enemies.filter(e => e.alive || gs.time - e.respawnT < 0.4)
  }
}

export function saveProgress(gs: GS): void {
  writeGalaxySave(gs.save)
}

// Guarda el layout del HUD en el save (posiciones/estado de paneles)
export function saveHudLayout(gs: GS): void {
  const hud: GalaxySave["hud"] = {}
  for (const id of Object.keys(gs.hud) as HudPanelId[]) {
    const p = gs.hud[id]
    hud[id] = { x: p.x, y: p.y, minimized: p.minimized, orientation: p.orientation }
  }
  gs.save.hud = hud
  saveProgress(gs)
}

// Registra un acontecimiento en el log (mantiene los últimos 5)
export function pushEvent(gs: GS, msg: string): void {
  gs.eventLog.push(msg)
  if (gs.eventLog.length > 5) gs.eventLog.shift()
}

export { evasionChance, pushFloater, pushParticles }