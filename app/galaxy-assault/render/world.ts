// Render del mundo: fondo, grid, cinturón de asteroides, base, entidades y marcadores.
import type { GS } from "../core/types"
import { W, H, CONFIG, BASE_X, BASE_Y, SAFE_RADIUS, REGEN_IDLE_TIME } from "../core/constants"
import { drawSprite, dirToAngle, type SpriteKey } from "../core/sprites"
import { bulletSprite } from "../data/ammo"
import { shipSprite } from "../data/ships"
import { font, rgba, roundRectPath } from "../../lib/gameKit"

type Imgs = Record<string, HTMLImageElement>

export function drawBackground(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs, time: number): void {
  const bg = imgs.bg
  if (bg && bg.naturalWidth > 0) {
    ctx.drawImage(bg, 0, 0, W, H)
    ctx.fillStyle = "rgba(4,6,20,0.35)"
    ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = "#050510"
    ctx.fillRect(0, 0, W, H)
  }

  // Estrellas de fondo (parallax simple, siempre en pantalla)
  for (const s of gs.stars) {
    const alpha = s.bright * (0.6 + 0.4 * Math.sin(time * 2 + s.tw))
    ctx.globalAlpha = alpha
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function drawGrid(ctx: CanvasRenderingContext2D, gs: GS): void {
  // Grid tenue del mundo (solo dentro de la vista)
  ctx.strokeStyle = "rgba(0,229,255,0.06)"
  ctx.lineWidth = 1
  const startX = Math.floor(gs.camX / CONFIG.map.cell) * CONFIG.map.cell
  const startY = Math.floor(gs.camY / CONFIG.map.cell) * CONFIG.map.cell
  const endX = gs.camX + W
  const endY = gs.camY + H
  ctx.beginPath()
  for (let x = startX; x <= endX; x += CONFIG.map.cell) {
    ctx.moveTo(x - gs.camX, 0)
    ctx.lineTo(x - gs.camX, H)
  }
  for (let y = startY; y <= endY; y += CONFIG.map.cell) {
    ctx.moveTo(0, y - gs.camY)
    ctx.lineTo(W, y - gs.camY)
  }
  ctx.stroke()
}

export function drawAsteroidBelt(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  for (const a of gs.asteroids) {
    const sx = a.x - gs.camX
    const sy = a.y - gs.camY
    if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue
    drawSprite(ctx, imgs, "asteroid", sx, sy, a.radius * 2, a.angle)
  }
}

export function drawBase(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs, time: number): void {
  const sx = BASE_X - gs.camX
  const sy = BASE_Y - gs.camY

  // Anillo de zona segura pulsante
  const pulse = 0.5 + 0.5 * Math.sin(time * 2)
  ctx.strokeStyle = `rgba(60,255,120,${0.25 + pulse * 0.25})`
  ctx.lineWidth = 3
  ctx.setLineDash([10, 14])
  ctx.beginPath()
  ctx.arc(sx, sy, SAFE_RADIUS, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Relleno tenue del área segura
  const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, SAFE_RADIUS)
  g.addColorStop(0, "rgba(60,255,120,0.18)")
  g.addColorStop(1, "rgba(60,255,120,0)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(sx, sy, SAFE_RADIUS, 0, Math.PI * 2)
  ctx.fill()

  drawSprite(ctx, imgs, "base", sx, sy, 120, 0, 1)

  // Etiqueta "ZONA SEGURA" cuando el jugador está dentro
  if (gs.inSafeZone) {
    ctx.fillStyle = "#7CFF5A"
    ctx.font = font(15, 800)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("⚓ ZONA SEGURA", sx, sy + 86)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs, time: number): void {
  const p = gs.player
  const sx = W / 2
  const sy = H / 2

  // Motor (llama) según velocidad
  const flame = 10 + p.speed * 0.05 + Math.sin(time * 20) * 3
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(dirToAngle(p.angle))
  ctx.fillStyle = "rgba(0,229,255,0.5)"
  ctx.beginPath()
  ctx.moveTo(-10, 14)
  ctx.lineTo(0, 14 + flame)
  ctx.lineTo(10, 14)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Cuerpo
  drawSprite(ctx, imgs, shipSprite(gs.save) as SpriteKey, sx, sy, 58, dirToAngle(p.angle))

  // Parpadeo de inmunidad
  if (p.invulnT > 0 && Math.floor(time * 12) % 2 === 0) {
    ctx.globalAlpha = 0.4
    drawSprite(ctx, imgs, shipSprite(gs.save) as SpriteKey, sx, sy, 58, dirToAngle(p.angle))
    ctx.globalAlpha = 1
  }

  // Escudo visual
  if (p.shieldHp > 0) {
    const a = 0.45 + 0.15 * Math.sin(time * 3)
    drawSprite(ctx, imgs, "shield", sx, sy, 96, 0, a)
  }

  drawShipBars(ctx, gs, sx, sy)
}

// Barras de vida y escudo sobre la nave del jugador
function drawShipBars(ctx: CanvasRenderingContext2D, gs: GS, sx: number, sy: number): void {
  const p = gs.player
  const w = 96
  const hpBarY = sy - 46
  // HP
  const hpPct = Math.max(0, p.hp / p.maxHp)
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  roundRectPath(ctx, sx - w / 2, hpBarY, w, 8, 4)
  ctx.fill()
  const g = ctx.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0)
  g.addColorStop(0, hpPct > 0.5 ? "#7CFF5A" : hpPct > 0.25 ? "#ffcc44" : "#ff5533")
  g.addColorStop(1, hpPct > 0.5 ? "#22aa44" : hpPct > 0.25 ? "#aa7722" : "#aa2222")
  ctx.fillStyle = g
  roundRectPath(ctx, sx - w / 2 + 1, hpBarY + 1, Math.max(4, (w - 2) * hpPct), 6, 3)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.font = "800 9px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(`❤ ${Math.ceil(p.hp)}/${p.maxHp}`, sx, hpBarY - 6)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"

  // Escudo
  const shPct = p.shieldHp / p.shieldMaxHp
  const shY = hpBarY + 12
  ctx.fillStyle = "rgba(0,0,0,0.6)"
  roundRectPath(ctx, sx - w / 2, shY, w, 6, 3)
  ctx.fill()
  if (p.shieldHp > 0) {
    ctx.fillStyle = "#44aaff"
    roundRectPath(ctx, sx - w / 2 + 1, shY + 1, Math.max(4, (w - 2) * shPct), 4, 2)
    ctx.fill()
  } else {
    // Progreso hacia la regeneración: en zona segura ya repone; fuera, espera el idle
    const idlePct = Math.min(1, (gs.time - gs.lastHitT) / REGEN_IDLE_TIME)
    ctx.fillStyle = "rgba(68,170,255,0.35)"
    roundRectPath(ctx, sx - w / 2 + 1, shY + 1, Math.max(4, (w - 2) * idlePct), 4, 2)
    ctx.fill()
  }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  for (const e of gs.enemies) {
    if (!e.alive) continue
    const sx = e.x - gs.camX
    const sy = e.y - gs.camY
    if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) continue
    const key = enemySprite(e.type) as SpriteKey
    const size = e.size * 1.6
    drawSprite(ctx, imgs, key, sx, sy, size, dirToAngle(e.angle))

    // Hit flash
    if (e.hitFlash > 0) {
      ctx.globalAlpha = e.hitFlash * 6
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.arc(sx, sy, size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Barra de HP sobre el enemigo (todos)
    const isTarget = gs.targetId === e.id
    const bw = e.kind === "boss" ? 70 : 44
    const bx = sx - bw / 2
    const by = sy - size / 2 - 12
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    roundRectPath(ctx, bx, by, bw, 6, 3)
    ctx.fill()
    const pct = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = pct > 0.5 ? "#7CFF5A" : pct > 0.25 ? "#ffcc44" : "#ff5533"
    roundRectPath(ctx, bx, by, Math.max(2, bw * pct), 6, 3)
    ctx.fill()
    if (isTarget) {
      ctx.strokeStyle = "#ff5533"
      ctx.lineWidth = 1.5
      roundRectPath(ctx, bx - 2, by - 2, bw + 4, 10, 5)
      ctx.stroke()
    }
  }
}

export function drawTargetReticle(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs, time: number): void {
  if (gs.targetId === null) return
  const t = gs.enemies.find(e => e.id === gs.targetId && e.alive)
  if (!t) return
  const sx = t.x - gs.camX
  const sy = t.y - gs.camY
  const pulse = 1 + Math.sin(time * 6) * 0.06
  drawSprite(ctx, imgs, "reticle", sx, sy, t.size * 2.1 * pulse, time * 1.5)

  // Aro rojo pulsante alrededor del objetivo seleccionado
  const ring = t.size * (0.8 + Math.sin(time * 5) * 0.07)
  ctx.save()
  ctx.strokeStyle = "rgba(255,60,60,0.95)"
  ctx.lineWidth = 3.5
  ctx.shadowColor = "rgba(255,60,60,0.9)"
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(sx, sy, ring, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  // Segmento rotatorio para que se note que está seleccionado
  ctx.save()
  ctx.strokeStyle = "rgba(255,255,255,0.85)"
  ctx.lineWidth = 3
  ctx.translate(sx, sy)
  ctx.rotate(time * 2.2)
  ctx.beginPath()
  ctx.arc(0, 0, ring, -0.5, 0.5)
  ctx.stroke()
  ctx.rotate(Math.PI)
  ctx.beginPath()
  ctx.arc(0, 0, ring, -0.5, 0.5)
  ctx.stroke()
  ctx.restore()
}

export function drawBullets(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  for (const b of gs.bullets) {
    const sx = b.x - gs.camX
    const sy = b.y - gs.camY
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
    if (b.fromPlayer) {
      const wKey = b.weapon ? bulletSprite(b.weapon) : "laser_x1"
      drawSprite(ctx, imgs, wKey as SpriteKey, sx, sy, b.radius * 6, dirToAngle(Math.atan2(b.vy, b.vx)))
    } else {
      ctx.fillStyle = b.color
      ctx.shadowColor = b.color
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(sx, sy, b.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }
}

export function drawCrates(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  for (const c of gs.crates) {
    const sx = c.x - gs.camX
    const sy = c.y - gs.camY + Math.sin(c.bobT) * 4
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
    const key = crateSprite(c.type) as SpriteKey
    // Blink cuando está por expirar
    const alpha = c.life < 6 ? (Math.floor(gs.time * 4) % 2 === 0 ? 0.4 : 1) : 1
    drawSprite(ctx, imgs, key, sx, sy, 46, 0, alpha)
  }
}

function crateSprite(type: string): string {
  if (type === "x1") return "crate_x1"
  if (type === "x2") return "crate_x2"
  if (type === "x3") return "crate_x3"
  return "crate_missile"
}

function enemySprite(type: string): string {
  if (type === "tank") return "tank"
  if (type === "boss1") return "boss1"
  if (type === "boss2") return "boss2"
  return "scout"
}

export function drawDrops(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs): void {
  for (const d of gs.drops) {
    const sx = d.x - gs.camX
    const sy = d.y - gs.camY + Math.sin(d.bobT) * 3
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue
    const key = dropSprite(d.dropId) as SpriteKey
    drawSprite(ctx, imgs, key, sx, sy, 34)
  }
}

function dropSprite(dropId: string): string {
  if (dropId === "core") return "drop_core"
  if (dropId === "energy") return "drop_energy"
  if (dropId === "repairBot") return "repair_bot"
  return "drop_scrap"
}

export function drawBossLaser(ctx: CanvasRenderingContext2D, gs: GS): void {
  for (const e of gs.enemies) {
    if (!e.alive || e.kind !== "boss" || !e.laserActive) continue
    const sx = e.x - gs.camX
    const sy = e.y - gs.camY
    const len = 520
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(e.laserAngle)
    const g = ctx.createLinearGradient(0, 0, len, 0)
    g.addColorStop(0, "rgba(255,80,255,0)")
    g.addColorStop(0.3, "rgba(255,80,255,0.85)")
    g.addColorStop(1, "rgba(255,200,255,0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, -5)
    ctx.lineTo(len, -2)
    ctx.lineTo(len, 2)
    ctx.lineTo(0, 5)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.beginPath()
    ctx.moveTo(0, -2)
    ctx.lineTo(len, -1)
    ctx.lineTo(len, 1)
    ctx.lineTo(0, 2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

export function drawEdgeArrows(ctx: CanvasRenderingContext2D, gs: GS): void {
  // Flechas en los bordes hacia enemigos/cajas fuera de pantalla
  const pad = 30
  for (const e of gs.enemies) {
    if (!e.alive) continue
    const sx = e.x - gs.camX
    const sy = e.y - gs.camY
    if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) continue
    const cx = Math.max(pad, Math.min(W - pad, sx))
    const cy = Math.max(pad + 40, Math.min(H - pad, sy))
    const a = Math.atan2(sy - H / 2, sx - W / 2)
    const color = e.kind === "boss" ? "#ffdd44" : "#ff5533"
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(a)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(14, 0)
    ctx.lineTo(-6, -8)
    ctx.lineTo(-6, 8)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // Flechas verdes hacia cajas
  if (CONFIG.minimap.showCrates) {
    for (const c of gs.crates) {
      const sx = c.x - gs.camX
      const sy = c.y - gs.camY
      if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) continue
      const cx = Math.max(pad, Math.min(W - pad, sx))
      const cy = Math.max(pad + 40, Math.min(H - pad, sy))
      const a = Math.atan2(sy - H / 2, sx - W / 2)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(a)
      ctx.fillStyle = "#7CFF5A"
      ctx.beginPath()
      ctx.moveTo(14, 0)
      ctx.lineTo(-6, -8)
      ctx.lineTo(-6, 8)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }
}

export function drawEffects(ctx: CanvasRenderingContext2D, gs: GS): void {
  // Partículas
  for (const p of gs.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x - gs.camX, p.y - gs.camY, p.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // Floaters
  for (const f of gs.floaters) {
    ctx.globalAlpha = Math.min(f.life, 1)
    ctx.fillStyle = f.color
    ctx.font = font(f.size, 800)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(f.text, f.x - gs.camX, f.y - gs.camY)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
  }
  ctx.globalAlpha = 1
  // Shockwaves
  for (const s of gs.shockwaves) {
    const a = Math.max(0, s.life / s.maxLife)
    ctx.strokeStyle = rgba(s.color, a)
    ctx.lineWidth = 3 * a
    ctx.beginPath()
    ctx.arc(s.x - gs.camX, s.y - gs.camY, s.r, 0, Math.PI * 2)
    ctx.stroke()
  }
}