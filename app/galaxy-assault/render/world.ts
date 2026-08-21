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

  // Nebulosas con parallax sutil según la cámara
  const par = 0.08
  const ox = gs.camX * par
  const oy = gs.camY * par
  const nebulas: Array<[number, number, number, string]> = [
    [0.12, 0.15, 220, "rgba(122,42,255,0.10)"],
    [0.55, 0.3, 260, "rgba(0,196,221,0.09)"],
    [0.85, 0.62, 200, "rgba(255,51,136,0.08)"],
    [0.35, 0.75, 240, "rgba(40,120,255,0.07)"],
  ]
  for (const [nx, ny, r, c] of nebulas) {
    const cx = ((nx * W - ox) % (W + r * 2) + W + r * 2) % (W + r * 2) - r
    const cy = ((ny * H - oy) % (H + r * 2) + H + r * 2) % (H + r * 2) - r
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, r)
    g.addColorStop(0, c)
    g.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Estrellas de fondo (parallax simple, siempre en pantalla)
  for (const s of gs.stars) {
    const alpha = s.bright * (0.6 + 0.4 * Math.sin(time * 2 + s.tw))
    ctx.globalAlpha = alpha
    ctx.fillStyle = s.r > 1.4 ? "#cfe8ff" : "#ffffff"
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
    // Destello en estrellas grandes
    if (s.r > 1.5 && Math.sin(time * 3 + s.tw) > 0.7) {
      ctx.globalAlpha = alpha * 0.5
      ctx.beginPath()
      ctx.moveTo(s.x - 5, s.y)
      ctx.lineTo(s.x + 5, s.y)
      ctx.moveTo(s.x, s.y - 5)
      ctx.lineTo(s.x, s.y + 5)
      ctx.lineWidth = 1
      ctx.strokeStyle = "#cfe8ff"
      ctx.stroke()
    }
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

  // Escudo visual (malla hexagonal girando)
  if (p.shieldHp > 0) {
    const base = 0.5 + 0.12 * Math.sin(time * 3)
    const flashing = gs.shieldFlashT > 0
    const flashA = flashing ? Math.min(1, gs.shieldFlashT * 3.5) : 0
    const R = 46
    const rot = time * 0.9

    // Halo tenue
    ctx.save()
    ctx.globalAlpha = base * 0.5
    const g = ctx.createRadialGradient(sx - 8, sy - 8, 6, sx, sy, R)
    g.addColorStop(0, "rgba(220,255,255,0.3)")
    g.addColorStop(1, "rgba(0,120,220,0.05)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(sx, sy, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Malla: hexágono exterior girando
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(rot)
    ctx.globalAlpha = 0.75
    ctx.strokeStyle = "rgba(140,220,255,0.8)"
    ctx.lineWidth = 2
    ctx.shadowColor = "rgba(120,200,255,0.9)"
    ctx.shadowBlur = 12
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const px = Math.cos(a) * R
      const py = Math.sin(a) * R
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    // Hexágono interior (contrarotación)
    ctx.rotate(-rot * 2)
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = "rgba(180,240,255,0.6)"
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4
      const px = Math.cos(a) * (R - 12)
      const py = Math.sin(a) * (R - 12)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    // Radios de la malla
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R)
    }
    ctx.stroke()
    ctx.restore()

    // Efecto al recibir ataque: destello blanco/cian que crece y se apaga
    if (flashing) {
      ctx.save()
      ctx.strokeStyle = `rgba(220,255,255,${flashA})`
      ctx.lineWidth = 2 + flashA * 3
      ctx.shadowColor = "rgba(120,220,255,0.9)"
      ctx.shadowBlur = 20
      const grow = 96 + (1 - flashA) * 34
      ctx.beginPath()
      ctx.arc(sx, sy, grow / 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      ctx.fillStyle = `rgba(200,240,255,${flashA * 0.25})`
      ctx.beginPath()
      ctx.arc(sx, sy, 48, 0, Math.PI * 2)
      ctx.fill()
    }

    // Efecto de regeneración: anillo giratorio tenue
    const regenActive = p.shieldHp < p.shieldMaxHp && (gs.inSafeZone || gs.time - gs.lastHitT >= REGEN_IDLE_TIME)
    if (regenActive) {
      ctx.save()
      ctx.strokeStyle = "rgba(80,200,255,0.6)"
      ctx.lineWidth = 2
      ctx.setLineDash([6, 10])
      ctx.lineDashOffset = -time * 40
      ctx.beginPath()
      ctx.arc(sx, sy, 60, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      // Rayo de reparación ascendente
      ctx.save()
      ctx.strokeStyle = "rgba(80,220,255,0.8)"
      ctx.lineWidth = 3
      ctx.translate(sx, sy)
      ctx.rotate(-time * 1.6)
      ctx.beginPath()
      ctx.moveTo(-18, 60)
      ctx.lineTo(18, 60)
      ctx.stroke()
      ctx.restore()
    }
  } else if (gs.inSafeZone || gs.time - gs.lastHitT >= REGEN_IDLE_TIME) {
    // Escudo vacío pero regenerándose: pulso azul de "cargando"
    const pulse = 0.25 + 0.2 * Math.sin(time * 4)
    ctx.strokeStyle = `rgba(80,180,255,${pulse})`
    ctx.lineWidth = 2
    ctx.setLineDash([4, 8])
    ctx.lineDashOffset = -time * 30
    ctx.beginPath()
    ctx.arc(sx, sy, 54, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
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
    if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) continue
    if (b.fromPlayer) {
      if (b.kind === "laser") {
        // Láser largo: haz alargado en la dirección del viaje
        const wKey = b.weapon ? bulletSprite(b.weapon) : "laser_x1"
        const ang = Math.atan2(b.vy, b.vx)
        const len = b.radius * 16
        const wid = b.radius * 5
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(dirToAngle(ang))
        ctx.drawImage(imgs[wKey], -len / 2, -wid / 2, len, wid)
        // Núcleo brillante
        ctx.globalAlpha = 0.9
        ctx.fillStyle = b.color
        ctx.shadowColor = b.color
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(0, 0, b.radius * 2.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
      } else {
        const wKey = b.weapon ? bulletSprite(b.weapon) : "missile_a"
        drawSprite(ctx, imgs, wKey as SpriteKey, sx, sy, b.radius * 7, dirToAngle(Math.atan2(b.vy, b.vx)))
      }
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