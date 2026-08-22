// Jugador: joystick → velocidad, colisión con asteroides/límites del mapa.
import type { GS, Asteroid } from "../core/types"
import {
  PLAYER_SPEED, PLAYER_ACCEL, PLAYER_RADIUS, PLAYABLE_MIN, PLAYABLE_MAX,
  JOY_RADIUS, JOY_DEADZONE, BASE_X, BASE_Y, SAFE_RADIUS,
} from "../core/constants"
import { shipSpeedMult } from "../data/ships"
import { circleCollide, clamp, dist, angleLerp } from "../../lib/math"

/** Actualiza el estado del joystick a partir del input táctil (dx,dy en px). */
export function joystickInput(gs: GS, dx: number, dy: number): void {
  const mag = Math.hypot(dx, dy)
  if (mag <= JOY_DEADZONE) {
    gs.joystick.dx = 0
    gs.joystick.dy = 0
    return
  }
  const max = JOY_RADIUS
  const norm = Math.min(mag, max) / max
  const nx = dx / mag
  const ny = dy / mag
  gs.joystick.dx = nx * norm
  gs.joystick.dy = ny * norm
}

export function updatePlayer(gs: GS, dt: number): void {
  const p = gs.player
  const mult = shipSpeedMult(gs.save)
  const jx = gs.joystick.dx
  const jy = gs.joystick.dy
  const targetVx = jx * PLAYER_SPEED * mult
  const targetVy = jy * PLAYER_SPEED * mult

  const k = Math.min(1, dt * PLAYER_ACCEL)
  p.vx += (targetVx - p.vx) * k
  p.vy += (targetVy - p.vy) * k

  let nx = p.x + p.vx * dt
  let ny = p.y + p.vy * dt

  // Límites del área jugable primero
  nx = clamp(nx, PLAYABLE_MIN, PLAYABLE_MAX)
  ny = clamp(ny, PLAYABLE_MIN, PLAYABLE_MAX)

  // Colisión con asteroides (empuje iterativo contra la posición actual para
  // deslizar por el borde en lugar de quedar atrapado entre el anillo y el límite)
  for (let pass = 0; pass < 2; pass++) {
    for (const a of gs.asteroids) {
      if (!collideShipAsteroid(nx, ny, a)) continue
      const dx = nx - a.x
      const dy = ny - a.y
      const d = Math.hypot(dx, dy) || 1
      const pushDist = PLAYER_RADIUS + a.radius - d
      nx += (dx / d) * pushDist
      ny += (dy / d) * pushDist
    }
  }
  // Re-clamp tras el empuje para que nunca quede fuera del mapa ni atrapado
  p.x = clamp(nx, PLAYABLE_MIN, PLAYABLE_MAX)
  p.y = clamp(ny, PLAYABLE_MIN, PLAYABLE_MAX)

  // Velocidad actual (para motor/efectos)
  p.speed = Math.hypot(p.vx, p.vy)
  p.enginePhase += dt * 9

// Orientación: al disparar, la nave apunta con el frente al objetivo marcado;
  // en ausencia de combate, apunta hacia donde el joystick quiere ir
  // (y sin input, hacia la dirección de la velocidad). Giro suave.
  let aim: number | null = null
  if (gs.firing && gs.targetId !== null) {
    const target = gs.enemies.find(e => e.id === gs.targetId && e.alive)
    if (target) aim = Math.atan2(target.y - p.y, target.x - p.x)
  }
  if (aim === null && gs.joystick.active && (jx !== 0 || jy !== 0)) {
    aim = Math.atan2(jy, jx)
  }
  if (aim === null && p.speed > 8) aim = Math.atan2(p.vy, p.vx)
  if (aim !== null) {
    p.angle = angleLerp(p.angle, aim, Math.min(1, dt * 10))
  }

  // Inmunidad post-daño
  if (p.invulnT > 0) p.invulnT -= dt
  if (p.shieldCooldown > 0) p.shieldCooldown -= dt

  // Zona segura
  gs.inSafeZone = dist(p.x, p.y, BASE_X, BASE_Y) <= SAFE_RADIUS
}

function collideShipAsteroid(sx: number, sy: number, a: Asteroid): boolean {
  return circleCollide(sx, sy, PLAYER_RADIUS, a.x, a.y, a.radius)
}