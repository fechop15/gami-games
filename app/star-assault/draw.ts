import type { GS, Bullet, Enemy, Boss, Drop, Particle, DropKind, PowerupKind, AmmoType } from "./types"
import { W, H, HUD_H, AMMO_COLORS, AMMO_ICONS, POWERUP_COLORS, POWERUP_ICONS, COMBO_TIMEOUT, MUTE_BTN } from "./constants"
import type { ShipDef } from "./ships"
import { WORLDS } from "./worlds"
import { getSoundMuted } from "./audio"

export { MUTE_BTN }

export function drawShipShape(ctx: CanvasRenderingContext2D, ship: ShipDef) {
  const { shape, hull, hull2, hull3, wing, accent, engine } = ship
  const eng = (gx: number, gy: number, rx: number, ry: number) => {
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, rx)
    glow.addColorStop(0, engine + "cc")
    glow.addColorStop(1, engine + "00")
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  }
  const hullGrad = () => {
    const hg = ctx.createLinearGradient(-14, -24, 14, 24)
    hg.addColorStop(0, hull); hg.addColorStop(0.5, hull2); hg.addColorStop(1, hull3)
    ctx.fillStyle = hg
  }

  if (shape === "interceptor") {
    eng(0, 16, 14, 10)
    // Alas barridas
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-27, 10); ctx.lineTo(-23, 19); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(27, 10); ctx.lineTo(23, 19); ctx.lineTo(6, 11); ctx.closePath(); ctx.fill()
    // Aletas de cola
    ctx.fillStyle = hull2
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-13, 22); ctx.lineTo(-5, 21); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(13, 22); ctx.lineTo(5, 21); ctx.closePath(); ctx.fill()
    // Fuselaje afilado
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(12, -10); ctx.lineTo(8, 20); ctx.lineTo(-8, 20); ctx.lineTo(-12, -10)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -10, 4, 8, 0, 0, Math.PI * 2); ctx.fill()
  } else if (shape === "tank") {
    eng(0, 18, 26, 15)
    // Cuerpo ancho
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(20, -8); ctx.lineTo(22, 18); ctx.lineTo(-22, 18); ctx.lineTo(-20, -8)
    ctx.closePath(); ctx.fill()
    // Cañones dobles
    ctx.fillStyle = wing
    ctx.fillRect(-15, -22, 7, 12); ctx.fillRect(8, -22, 7, 12)
    // Placas de blindaje laterales
    ctx.fillStyle = hull3
    ctx.fillRect(-21, -6, 4, 22); ctx.fillRect(17, -6, 4, 22)
    // Cockpit blindado
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.roundRect(-8, -8, 16, 12, 4); ctx.fill()
  } else if (shape === "jet") {
    // Doble motor
    eng(-8, 18, 11, 12); eng(8, 18, 11, 12)
    // Alas en flecha
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-25, 8); ctx.lineTo(-18, 17); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(25, 8); ctx.lineTo(18, 17); ctx.lineTo(4, 8); ctx.closePath(); ctx.fill()
    // Fuselaje redondeado
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(13, -12, 11, 16)
    ctx.lineTo(-11, 16); ctx.quadraticCurveTo(-13, -12, 0, -26)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -9, 5, 9, 0, 0, Math.PI * 2); ctx.fill()
  } else if (shape === "phantom") {
    eng(0, 16, 16, 11)
    // Alas angulares
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-23, -8); ctx.lineTo(-25, 16); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(23, -8); ctx.lineTo(25, 16); ctx.lineTo(6, 12); ctx.closePath(); ctx.fill()
    // Fuselaje de sigilo (cortante)
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(16, -2); ctx.lineTo(10, 20); ctx.lineTo(-10, 20); ctx.lineTo(-16, -2)
    ctx.closePath(); ctx.fill()
    // Cabina en diamante
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(4, -6); ctx.lineTo(0, 2); ctx.lineTo(-4, -6)
    ctx.closePath(); ctx.fill()
  } else if (shape === "omega") {
    // Doble motor superior
    eng(-7, 20, 12, 13); eng(7, 20, 12, 13)
    // Alas grandes
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-28, 16); ctx.lineTo(-24, 24); ctx.lineTo(-8, 14); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(28, 16); ctx.lineTo(24, 24); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill()
    // Winglets
    ctx.beginPath(); ctx.moveTo(-24, 2); ctx.lineTo(-31, 6); ctx.lineTo(-26, 12); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(24, 2); ctx.lineTo(31, 6); ctx.lineTo(26, 12); ctx.closePath(); ctx.fill()
    // Fuselaje alargado
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(16, -6); ctx.lineTo(14, 24); ctx.lineTo(-14, 24); ctx.lineTo(-16, -6)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -10, 7, 11, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    // delta (Aurora) — forma clásica
    eng(0, 18, 22, 16)
    // Alas
    ctx.fillStyle = wing
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-24, 16); ctx.lineTo(-20, 22); ctx.lineTo(-8, 12)
    ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(24, 16); ctx.lineTo(20, 22); ctx.lineTo(8, 12)
    ctx.closePath(); ctx.fill()
    // Fuselaje
    hullGrad()
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(14, -6); ctx.lineTo(12, 22); ctx.lineTo(-12, 22); ctx.lineTo(-14, -6)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = accent
    ctx.beginPath(); ctx.ellipse(0, -8, 6, 10, 0, 0, Math.PI * 2); ctx.fill()
  }
}

export function drawPlayerShip(
  ctx: CanvasRenderingContext2D, x: number, y: number, ship: ShipDef,
  invTimer: number, shieldActive: boolean, shieldHP: number, shieldMaxHP: number,
  shieldCooldown: number, shieldCdMax: number, time: number,
  shieldTier = 1, shieldColor = "#4488ff", uavCount = 0, uavColor = "#44ff88",
) {
  if (invTimer > 0 && Math.floor(invTimer * 12) % 2 === 0) return  // blink
  ctx.save()
  ctx.translate(x, y)

  // Escudo (se dibuja debajo de la nave) — el aspecto varía con el tier
  if (shieldActive) {
    const shieldPct = shieldHP / shieldMaxHP
    const pulse = 0.55 + Math.sin(time * 10) * 0.15
    const shR = 40
    const drawHex = (r: number, rot: number) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6 + rot
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
                 : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.closePath()
    }

    if (shieldTier >= 5) {
      // Aura dorada pulsante con partículas
      const auraPulse = 0.6 + Math.sin(time * 6) * 0.25
      const gold = ctx.createRadialGradient(0, 0, 10, 0, 0, 62)
      gold.addColorStop(0, `rgba(255,220,80,${auraPulse * 0.3 * shieldPct})`)
      gold.addColorStop(1, "rgba(255,220,80,0)")
      ctx.fillStyle = gold
      ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill()
      drawHex(shR + 4, time * 0.6)
      ctx.strokeStyle = "#ffee55"; ctx.lineWidth = 3.5
      ctx.shadowColor = "#ffee55"; ctx.shadowBlur = 22
      ctx.stroke()
      ctx.shadowBlur = 0
      // Partículas doradas orbitando
      for (let i = 0; i < 6; i++) {
        const a = time * 3 + (i / 6) * Math.PI * 2
        const px = Math.cos(a) * (shR + 6), py = Math.sin(a) * (shR + 6) * 0.7
        const tw = 0.5 + Math.sin(time * 10 + i) * 0.5
        ctx.fillStyle = `rgba(255,230,120,${tw})`
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill()
      }
    } else if (shieldTier >= 4) {
      // Anillo giratorio con púas/cristales
      const shGlow = ctx.createRadialGradient(0, 0, 20, 0, 0, 52)
      shGlow.addColorStop(0, hexToRgba(shieldColor, pulse * 0.35))
      shGlow.addColorStop(1, hexToRgba(shieldColor, 0))
      ctx.fillStyle = shGlow
      ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.fill()
      ctx.save(); ctx.rotate(time * 1.6)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ctx.strokeStyle = shieldColor; ctx.lineWidth = 2.5
        ctx.shadowColor = shieldColor; ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * (shR - 6), Math.sin(a) * (shR - 6))
        ctx.lineTo(Math.cos(a) * (shR + 9), Math.sin(a) * (shR + 9))
        ctx.stroke()
      }
      ctx.restore()
      ctx.shadowBlur = 0
      drawHex(shR, 0)
      ctx.strokeStyle = shieldColor; ctx.lineWidth = 3
      ctx.shadowColor = shieldColor; ctx.shadowBlur = 16
      ctx.stroke()
      ctx.fillStyle = hexToRgba(shieldColor, pulse * 0.08 * shieldPct)
      ctx.fill()
      ctx.shadowBlur = 0
    } else if (shieldTier >= 3) {
      // Doble anillo + brillo
      const shGlow = ctx.createRadialGradient(0, 0, 20, 0, 0, 50)
      shGlow.addColorStop(0, hexToRgba(shieldColor, pulse * 0.35))
      shGlow.addColorStop(1, hexToRgba(shieldColor, 0))
      ctx.fillStyle = shGlow
      ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.fill()
      drawHex(shR + 3, time * 0.4)
      ctx.strokeStyle = hexToRgba(shieldColor, 0.5); ctx.lineWidth = 2
      ctx.stroke()
      drawHex(shR - 3, time * 0.4)
      ctx.strokeStyle = shieldColor; ctx.lineWidth = 3
      ctx.shadowColor = shieldColor; ctx.shadowBlur = 18
      ctx.stroke()
      ctx.fillStyle = hexToRgba(shieldColor, pulse * 0.08 * shieldPct)
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      // Tier 1-2: hexágono básico (como siempre)
      const shGlow = ctx.createRadialGradient(0, 0, 20, 0, 0, 48)
      shGlow.addColorStop(0, `rgba(68,136,255,${pulse * 0.35})`)
      shGlow.addColorStop(1, "rgba(68,136,255,0)")
      ctx.fillStyle = shGlow
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill()
      drawHex(shR, time * 0.8)
      const shieldColor2 = shieldPct > 0.5 ? "#4488ff" : shieldPct > 0.25 ? "#88aaff" : "#ff8844"
      ctx.strokeStyle = shieldColor2; ctx.lineWidth = 3
      ctx.shadowColor = shieldColor2; ctx.shadowBlur = 16
      ctx.stroke()
      ctx.fillStyle = `rgba(68,136,255,${pulse * 0.08 * shieldPct})`
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

    drawShipShape(ctx, ship)

  // Indicador de recarga sobre la nave
  if (!shieldActive && shieldCooldown > 0) {
    const cdPct = 1 - shieldCooldown / shieldCdMax
    ctx.strokeStyle = "rgba(100,160,255,0.5)"; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + cdPct * Math.PI * 2)
    ctx.stroke()
  }

  // UAVs equipados orbitando alrededor de la nave
  if (uavCount > 0) {
    for (let i = 0; i < uavCount; i++) {
      const a = time * 2.2 + (i / uavCount) * Math.PI * 2
      const r = 36 + (i % 3) * 7
      const dx = Math.cos(a) * r
      const dy = Math.sin(a) * r * 0.62
      ctx.save()
      ctx.translate(dx, dy)
      ctx.fillStyle = uavColor
      ctx.shadowColor = uavColor; ctx.shadowBlur = 10
      // Pequeño dron: núcleo + rotores en X
      ctx.strokeStyle = uavColor; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke()
      ctx.fillStyle = uavColor
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()
    }
  }

  ctx.restore()
}

export function drawEnemyShip(ctx: CanvasRenderingContext2D, e: Enemy) {
  const alpha = e.type === "stealth" ? (e.visible ? 1 : 0.15) : 1
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(e.x, e.y)

  if (e.type === "scout") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 14); ctx.lineTo(14, -14); ctx.lineTo(0, -8); ctx.lineTo(-14, -14)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "grunt") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 17); ctx.lineTo(18, 8); ctx.lineTo(18, -8); ctx.lineTo(0, -17); ctx.lineTo(-18, -8); ctx.lineTo(-18, 8)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "tank") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.roundRect(-26, -24, 52, 48, 4)
    ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 3; ctx.stroke()
    // Cannons
    ctx.fillStyle = "#333"
    ctx.fillRect(-20, 18, 10, 14); ctx.fillRect(10, 18, 10, 14)
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "stealth") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 16); ctx.lineTo(17, 2); ctx.lineTo(12, -16); ctx.lineTo(-12, -16); ctx.lineTo(-17, 2)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 1.5; ctx.stroke()
  } else if (e.type === "shooter") {
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, -18); ctx.lineTo(18, 0); ctx.lineTo(0, 18); ctx.lineTo(-18, 0)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2, false); ctx.stroke()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 5, 0, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "kamikaze") {
    // Punta de flecha agresiva apuntando abajo
    ctx.fillStyle = e.color
    ctx.beginPath()
    ctx.moveTo(0, 16); ctx.lineTo(15, -12); ctx.lineTo(6, -6); ctx.lineTo(0, -14)
    ctx.lineTo(-6, -6); ctx.lineTo(-15, -12)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 1.5; ctx.stroke()
    // Núcleo pulsante
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.arc(0, 2, 3, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "splitter") {
    // Célula que se divide: dos lóbulos
    ctx.fillStyle = e.color
    ctx.beginPath(); ctx.arc(-8, 0, 13, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(8, 0, 13, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = e.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(-8, 0, 13, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(8, 0, 13, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.arc(-8, 0, 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI * 2); ctx.fill()
  } else if (e.type === "mini") {
    ctx.fillStyle = e.color
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = e.accent
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill()
  }

  // Hit-flash blanco (encima del sprite)
  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = "source-atop"
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, e.hitFlash * 12)})`
    ctx.fillRect(-e.w, -e.h, e.w * 2, e.h * 2)
    ctx.globalCompositeOperation = "source-over"
  }

  // HP bar (below ship)
  if (e.hp < e.maxHp && e.type !== "mini") {
    const pct = Math.max(0, e.hp / e.maxHp)
    const bw = e.w + 8, bh = 4, bx = -bw / 2, by = e.h / 2 + 4
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx, by, bw, bh)
    ctx.fillStyle = pct > 0.5 ? "#44ff44" : pct > 0.25 ? "#ffaa00" : "#ff3300"
    ctx.fillRect(bx, by, bw * pct, bh)
  }
  ctx.restore()
}

export function drawBossShip(ctx: CanvasRenderingContext2D, boss: Boss, time: number) {
  if (!boss.alive) return
  ctx.save()
  ctx.translate(boss.x, boss.y)
  const pulse = 0.94 + Math.sin(time * 3) * 0.06

  // Shield
  if (boss.shieldActive) {
    ctx.strokeStyle = "#44aaff"; ctx.lineWidth = 3; ctx.globalAlpha = 0.6 + Math.sin(time * 5) * 0.2
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Outer ring
  ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.5
  ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 1

  // Main body
  const bg = ctx.createRadialGradient(0, 0, 10, 0, 0, 46)
  bg.addColorStop(0, boss.accent)
  bg.addColorStop(0.5, boss.color)
  bg.addColorStop(1, "#110000")
  ctx.fillStyle = bg

  if (boss.worldId === 0) {
    // Centinela: angular heavy cruiser
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    ctx.moveTo(0, -42); ctx.lineTo(38, -20); ctx.lineTo(44, 10); ctx.lineTo(28, 42)
    ctx.lineTo(-28, 42); ctx.lineTo(-44, 10); ctx.lineTo(-38, -20)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 1) {
    // Espectro: teardrop/ghost
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    ctx.moveTo(0, -40); ctx.bezierCurveTo(38, -40, 42, 10, 32, 40)
    ctx.lineTo(-32, 40); ctx.bezierCurveTo(-42, 10, -38, -40, 0, -40)
    ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 2) {
    // Reina enjambre: organic
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.ellipse(20, 0, 14, 8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = bg
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 3) {
    // Devorador: black hole style
    const rings = 4
    for (let i = rings; i >= 1; i--) {
      const r = i * 12
      const alpha = 0.2 + (rings - i) / rings * 0.6
      ctx.globalAlpha = alpha
      ctx.fillStyle = i % 2 === 0 ? boss.color : "#000020"
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, i * 14, 0, Math.PI * 2); ctx.stroke()
    }
  } else if (boss.worldId === 4) {
    // Emperador: ornate crown shape
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    ctx.moveTo(0, -44); ctx.lineTo(20, -28); ctx.lineTo(40, -38); ctx.lineTo(44, -8)
    ctx.lineTo(40, 20); ctx.lineTo(20, 42); ctx.lineTo(-20, 42)
    ctx.lineTo(-40, 20); ctx.lineTo(-44, -8); ctx.lineTo(-40, -38)
    ctx.lineTo(-20, -28)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    ctx.restore()
    // Crown spikes
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 14, -42); ctx.lineTo(i * 10, -62); ctx.stroke()
    }
  } else if (boss.worldId === 5) {
    // Reina del Hielo: cristal hexagonal
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      if (i === 0) ctx.moveTo(Math.cos(a) * 42, Math.sin(a) * 42)
      else ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42)
    }
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    // Copos: líneas radiales
    ctx.strokeStyle = boss.accent; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20)
      ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    // Cristal interior
    ctx.fillStyle = boss.color
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      if (i === 0) ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 26)
      else ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26)
    }
    ctx.closePath(); ctx.fill()
    ctx.restore()
  } else if (boss.worldId === 6) {
    // Coloso de Magma: núcleo envuelto en placas
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i / 8) * Math.PI * 2 + boss.attackIdx)
      ctx.fillStyle = i % 2 === 0 ? boss.color : "#330a00"
      ctx.beginPath(); ctx.ellipse(30, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
    }
    // Núcleo en fusión
    const lava = ctx.createRadialGradient(0, 0, 0, 0, 0, 22)
    lava.addColorStop(0, "#fff2cc")
    lava.addColorStop(0.5, "#ffaa00")
    lava.addColorStop(1, boss.color)
    ctx.fillStyle = lava
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 7) {
    // Null: obsidiana con púas angulares
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30)
      ctx.lineTo(Math.cos(a) * 52, Math.sin(a) * 52)
      ctx.stroke()
    }
    ctx.fillStyle = boss.color
    ctx.beginPath()
    ctx.moveTo(0, -38); ctx.lineTo(20, -22); ctx.lineTo(38, -8); ctx.lineTo(28, 16)
    ctx.lineTo(16, 38); ctx.lineTo(0, 26); ctx.lineTo(-16, 38); ctx.lineTo(-28, 16)
    ctx.lineTo(-38, -8); ctx.lineTo(-20, -22)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 8) {
    // Madre Maleza: flor carnívora orgánica
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate((i / 8) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.ellipse(30, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
    }
    // Pedúnculo y boca
    ctx.strokeStyle = "#3a6a2a"; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(0, -10); ctx.stroke()
    ctx.fillStyle = "#66ff88"
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(20, -8); ctx.lineTo(14, 10); ctx.lineTo(-14, 10); ctx.lineTo(-20, -8)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  } else if (boss.worldId === 9) {
    // Leviatán: serpiente acorazada
    ctx.save(); ctx.scale(pulse, pulse)
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(0, 16 + i * 8)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.ellipse(0, 0, 34 - i * 6, 12 - i * 2, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
    }
    // Cabeza y aletas
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(16, -8); ctx.lineTo(0, 14); ctx.lineTo(-16, -8)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = boss.accent
      ctx.beginPath(); ctx.moveTo(s * 12, -6); ctx.lineTo(s * 30, 6); ctx.lineTo(s * 12, 18); ctx.closePath(); ctx.fill()
    }
    ctx.restore()
  } else if (boss.worldId === 10) {
    // Inquisidor: arco gótico de juicio
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.fillStyle = boss.color
    ctx.beginPath()
    ctx.moveTo(-30, 40); ctx.lineTo(-30, 0); ctx.lineTo(-42, -18)
    ctx.lineTo(-30, -22); ctx.lineTo(-16, -40); ctx.lineTo(0, -48)
    ctx.lineTo(16, -40); ctx.lineTo(30, -22); ctx.lineTo(42, -18)
    ctx.lineTo(30, 0); ctx.lineTo(30, 40)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    // Vidrieras
    ctx.fillStyle = boss.accent
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(10, -16); ctx.lineTo(0, 0); ctx.lineTo(-10, -16); ctx.closePath(); ctx.fill()
    // Campanas
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = "#ffcc44"
      ctx.beginPath(); ctx.arc(s * 22, 26, 7, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  } else if (boss.worldId === 11) {
    // Cosechadora: estrella giratoria de cuchillas
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.rotate(boss.attackIdx * 0.3)
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(14, -10); ctx.lineTo(0, 8); ctx.lineTo(-14, -10)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = boss.accent
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  } else if (boss.worldId === 12) {
    // Obispo: cúpula de catedral con halo
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-38, -4); ctx.lineTo(-20, -30); ctx.lineTo(-20, -44)
    ctx.lineTo(-8, -34); ctx.lineTo(0, -52); ctx.lineTo(8, -34); ctx.lineTo(20, -44)
    ctx.lineTo(20, -30); ctx.lineTo(38, -4); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Ventanas del rosetón
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.fillStyle = boss.accent
      ctx.beginPath(); ctx.arc(Math.cos(a) * 24, Math.sin(a) * 24, 3.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  } else if (boss.worldId === 13) {
    // Titán Verde: golem apilado angular
    ctx.save(); ctx.scale(pulse, pulse)
    // Hombros
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.roundRect(-44, -18, 30, 30, 6); ctx.fill()
    ctx.beginPath(); ctx.roundRect(14, -18, 30, 30, 6); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Torso
    ctx.beginPath(); ctx.roundRect(-20, -34, 40, 48, 6); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Cabeza
    ctx.beginPath(); ctx.roundRect(-14, -52, 28, 22, 5); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2; ctx.stroke()
    // Ojos de núcleo
    ctx.fillStyle = "#55ff88"
    ctx.beginPath(); ctx.arc(-6, -42, 3.5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(6, -42, 3.5, 0, Math.PI * 2); ctx.fill()
    // Brazos cañón
    ctx.fillStyle = boss.color
    ctx.fillRect(-40, -14, 8, 30); ctx.fillRect(32, -14, 8, 30)
    ctx.restore()
  } else if (boss.worldId === 14) {
    // Vanguardia: plataforma de batalla en punta de flecha
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.fillStyle = boss.color
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(40, -14); ctx.lineTo(46, 26)
    ctx.lineTo(26, 42); ctx.lineTo(0, 30); ctx.lineTo(-26, 42); ctx.lineTo(-46, 26)
    ctx.lineTo(-40, -14)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2.5; ctx.stroke()
    // Torretas
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = boss.accent
      ctx.beginPath(); ctx.roundRect(s * 26 - 6, 10, 12, 22, 4); ctx.fill()
    }
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.ellipse(0, 8, 8, 14, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  } else {
    // Amarok: núcleo final con anillos orbitales
    ctx.save(); ctx.scale(pulse, pulse)
    ctx.rotate(boss.attackIdx * 0.15)
    // Anillos orbitales
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke()
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * Math.PI * 2)
      ctx.fillStyle = boss.color
      ctx.beginPath(); ctx.arc(44, 0, 5, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
    // Núcleo facetado
    ctx.fillStyle = boss.color
    ctx.beginPath()
    ctx.moveTo(0, -32); ctx.lineTo(22, -20); ctx.lineTo(32, 0); ctx.lineTo(22, 20)
    ctx.lineTo(0, 32); ctx.lineTo(-22, 20); ctx.lineTo(-32, 0); ctx.lineTo(-22, -20)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = boss.accent; ctx.lineWidth = 3; ctx.stroke()
    // Corazón de oro
    ctx.fillStyle = "#ffee66"
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // Core glow
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 18)
  core.addColorStop(0, "#ffffff")
  core.addColorStop(0.4, boss.accent)
  core.addColorStop(1, "transparent")
  ctx.fillStyle = core
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill()

  // Hit-flash blanco
  if (boss.hitFlash > 0) {
    ctx.globalAlpha = Math.min(0.75, boss.hitFlash * 12)
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

export function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, laserTier = 1) {
  ctx.save()
  if (b.fromPlayer) {
    const color = AMMO_COLORS[b.ammo]
    const high = laserTier >= 3
    if (high) {
      // Bala mejorada según el tier del láser equipado
      const tScale = 1 + (laserTier - 1) * 0.22
      ctx.shadowColor = color
      ctx.shadowBlur = 14 + laserTier * 5
      if (b.ammo === "laser") {
        // Haz doble/trazo según tier
        if (laserTier >= 4) {
          ctx.strokeStyle = hexToRgba(color, 0.55); ctx.lineWidth = 5
          ctx.beginPath(); ctx.moveTo(b.x - 3, b.y); ctx.lineTo(b.x - 3, b.y + 30 * tScale); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(b.x + 3, b.y); ctx.lineTo(b.x + 3, b.y + 30 * tScale); ctx.stroke()
        }
        ctx.strokeStyle = color; ctx.lineWidth = 6 + laserTier
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 30 * tScale); ctx.stroke()
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 30 * tScale); ctx.stroke()
      } else if (b.ammo === "missile") {
        ctx.fillStyle = color
        ctx.beginPath(); ctx.moveTo(b.x, b.y - 12 * tScale); ctx.lineTo(b.x - 5 * tScale, b.y + 8 * tScale); ctx.lineTo(b.x + 5 * tScale, b.y + 8 * tScale); ctx.closePath(); ctx.fill()
        ctx.fillStyle = "#ffffff"
        ctx.beginPath(); ctx.arc(b.x, b.y - 3 * tScale, 2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = "#ff8800"; ctx.globalAlpha = 0.6
        ctx.beginPath(); ctx.ellipse(b.x, b.y + 14 * tScale, 4 * tScale, 7 * tScale, 0, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      } else {
        // Estela + cuerpo + núcleo
        ctx.fillStyle = hexToRgba(color, 0.4)
        ctx.beginPath(); ctx.ellipse(b.x, b.y + b.radius * 1.6, b.radius * 0.6, b.radius * 1.9 * tScale, 0, 0, Math.PI * 2); ctx.fill()
        if (laserTier >= 4) {
          ctx.fillStyle = hexToRgba(color, 0.45)
          ctx.beginPath(); ctx.ellipse(b.x + 4, b.y, b.radius * 0.5, b.radius * 1.2 * tScale, 0, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.ellipse(b.x - 4, b.y, b.radius * 0.5, b.radius * 1.2 * tScale, 0, 0, Math.PI * 2); ctx.fill()
        }
        ctx.fillStyle = color
        ctx.beginPath(); ctx.ellipse(b.x, b.y, b.radius * 0.85 * tScale, b.radius * 1.3 * tScale, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = "#ffffff"
        ctx.beginPath(); ctx.ellipse(b.x, b.y, b.radius * 0.4, b.radius * 0.7, 0, 0, Math.PI * 2); ctx.fill()
      }
      if (laserTier >= 5) {
        // Aura intensa de color
        const aura = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 4)
        aura.addColorStop(0, hexToRgba(color, 0.5))
        aura.addColorStop(1, hexToRgba(color, 0))
        ctx.fillStyle = aura
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.restore()
      return
    }
    // Tier 1-2: aspecto básico (como siempre)
    if (b.ammo === "laser") {
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.shadowColor = color; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 28); ctx.stroke()
    } else if (b.ammo === "missile") {
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 12); ctx.lineTo(b.x - 5, b.y + 8); ctx.lineTo(b.x + 5, b.y + 8); ctx.closePath(); ctx.fill()
      // Exhaust
      ctx.fillStyle = "#ff8800"; ctx.globalAlpha = 0.6
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 14, 4, 6, 0, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.ellipse(b.x, b.y, b.radius * 0.7, b.radius, 0, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    ctx.fillStyle = "#ff4444"; ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 6
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.85, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

export function isPowerup(k: DropKind): k is PowerupKind {
  return k === "magnet" || k === "overdrive" || k === "bomb"
}

export function drawDrop(ctx: CanvasRenderingContext2D, d: Drop, time: number) {
  const bob = Math.sin(d.bobT + time * 3) * 4
  ctx.save()
  ctx.translate(d.x, d.y + bob)

  // Núcleo de perfección: estrella dorada brillante
  if (d.kind === "core") {
    ctx.shadowColor = "#ffee44"; ctx.shadowBlur = 18
    ctx.save(); ctx.rotate(time * 1.5)
    ctx.fillStyle = "#ffee44"
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      const ax = Math.cos(a) * 16, ay = Math.sin(a) * 16
      if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay)
      const b = a + Math.PI / 5
      ctx.lineTo(Math.cos(b) * 7, Math.sin(b) * 7)
    }
    ctx.closePath(); ctx.fill()
    ctx.restore()
    ctx.shadowBlur = 0
    ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = "#ffaa00"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("PERF", 0, 24)
    ctx.restore()
    return
  }

  const powerup = isPowerup(d.kind)
  const color = isPowerup(d.kind) ? POWERUP_COLORS[d.kind] : AMMO_COLORS[d.kind]
  const icon = isPowerup(d.kind) ? POWERUP_ICONS[d.kind] : AMMO_ICONS[d.kind]
  ctx.shadowColor = color; ctx.shadowBlur = 14
  // Power-ups: anillo doble giratorio para destacar
  if (powerup) {
    ctx.rotate(time * 2)
    ctx.strokeStyle = color; ctx.lineWidth = 2.5
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11)
      ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16)
      ctx.stroke()
    }
    ctx.rotate(-time * 2)
  }
  // Outer ring
  ctx.strokeStyle = color; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke()
  // Inner fill
  ctx.fillStyle = color + "44"
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill()
  // Icon
  ctx.fillStyle = color; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(icon, 0, 0)
  ctx.restore()
}

export function drawBackground(ctx: CanvasRenderingContext2D, gs: GS) {
  const world = WORLDS[gs.worldId]
  // Base
  ctx.fillStyle = world.bgColor
  ctx.fillRect(0, 0, W, H)
  // Nebula clouds
  const nebulaGrad = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, H * 0.6)
  nebulaGrad.addColorStop(0, world.nebula + "55")
  nebulaGrad.addColorStop(0.5, world.nebula + "22")
  nebulaGrad.addColorStop(1, "transparent")
  ctx.fillStyle = nebulaGrad
  ctx.fillRect(0, 0, W, H)
  const nebulaGrad2 = ctx.createRadialGradient(W * 0.7, H * 0.7, 0, W * 0.7, H * 0.7, H * 0.5)
  nebulaGrad2.addColorStop(0, world.nebula + "33")
  nebulaGrad2.addColorStop(1, "transparent")
  ctx.fillStyle = nebulaGrad2
  ctx.fillRect(0, 0, W, H)
}

export function drawStars(ctx: CanvasRenderingContext2D, gs: GS) {
  const streak = gs.phase === "boss"   // durante el jefe, la capa cercana se estira
  for (const s of gs.stars) {
    if (s.layer === 2) {
      // Capa cercana: leve tinte del mundo y posible streak
      const world = WORLDS[Math.min(gs.worldId, WORLDS.length - 1)]
      ctx.strokeStyle = `rgba(255,255,255,${s.bright})`
      if (streak) {
        ctx.lineWidth = s.r
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.spd * 0.06); ctx.stroke()
      } else {
        ctx.fillStyle = `rgba(255,255,255,${s.bright})`
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
      }
      // Punto de acento tenue
      ctx.fillStyle = world.accent + "22"
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.6, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = `rgba(255,255,255,${s.bright})`
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
    }
  }
}

export function drawHUD(ctx: CanvasRenderingContext2D, gs: GS) {
  const world = WORLDS[gs.worldId]
  // Bottom HUD panel
  const hudY = H - HUD_H
  const panelGrad = ctx.createLinearGradient(0, hudY, 0, H)
  panelGrad.addColorStop(0, "rgba(0,0,0,0)")
  panelGrad.addColorStop(0.1, "rgba(0,0,12,0.92)")
  panelGrad.addColorStop(1, "rgba(0,0,20,0.98)")
  ctx.fillStyle = panelGrad; ctx.fillRect(0, hudY, W, HUD_H)

  // HP bar
  const hpPct = Math.max(0, gs.playerHP / gs.playerMaxHP)
  const hpW = W - 160, hpX = 14, hpY = hudY + 10, hpH = 14
  ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(hpX, hpY, hpW, hpH)
  const hpColor = hpPct > 0.5 ? "#22ff44" : hpPct > 0.25 ? "#ffaa00" : "#ff3300"
  ctx.fillStyle = hpColor
  ctx.fillRect(hpX, hpY, hpW * hpPct, hpH)
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1
  ctx.strokeRect(hpX, hpY, hpW, hpH)
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText(`HP ${Math.ceil(gs.playerHP)}`, hpX + 4, hpY + hpH / 2)
  ctx.fillStyle = "#aaaaaa"; ctx.textAlign = "right"
  ctx.fillText(`${gs.score.toLocaleString()}`, W - 14, hpY + hpH / 2)

  // Ammo buttons (izquierda) + Escudo (derecha)
  const ammos: AmmoType[] = ["basic", "laser", "spread", "missile"]
  const shieldBtnW = 90, gap = 6
  const ammoArea = W - 20 - shieldBtnW - gap
  const btnW = (ammoArea - (ammos.length - 1) * 4) / ammos.length
  const btnH = 42, btnY = hudY + 30
  gs.ammoBtns = []

  for (let i = 0; i < ammos.length; i++) {
    const ammo = ammos[i]
    const btnX = 10 + i * (btnW + 4)
    const isActive = gs.activeAmmo === ammo
    const count = gs.ammo[ammo]
    const hasAmmo = count === -1 || count > 0
    const color = AMMO_COLORS[ammo]

    gs.ammoBtns.push({ ammo, x: btnX, y: btnY, w: btnW, h: btnH })

    ctx.fillStyle = isActive ? color + "33" : "rgba(255,255,255,0.05)"
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill()
    if (isActive) {
      ctx.strokeStyle = color; ctx.lineWidth = 2
      ctx.shadowColor = color; ctx.shadowBlur = 8
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.stroke()
      ctx.shadowBlur = 0
    }
    if (!hasAmmo && ammo !== "basic") {
      ctx.fillStyle = "rgba(0,0,0,0.5)"
      ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill()
    }

    ctx.fillStyle = hasAmmo ? color : "#444"
    ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(AMMO_ICONS[ammo], btnX + btnW / 2, btnY + 13)
    ctx.font = "bold 10px monospace"
    ctx.fillStyle = hasAmmo ? "#ffffff" : "#555"
    ctx.fillText(count === -1 ? "∞" : String(count), btnX + btnW / 2, btnY + 30)
  }

  // Botón de escudo
  const sBtnX = W - 10 - shieldBtnW, sBtnY = btnY
  gs.shieldBtn = { x: sBtnX, y: sBtnY, w: shieldBtnW, h: btnH }
  const shReady = !gs.shieldActive && gs.shieldCooldown <= 0
  const shColor = gs.shieldActive ? "#66bbff"
                : shReady         ? "#4488ff"
                :                   "#334466"
  // Fondo del botón
  ctx.fillStyle = gs.shieldActive ? "#4488ff22" : shReady ? "#4488ff15" : "rgba(20,30,60,0.5)"
  ctx.beginPath(); ctx.roundRect(sBtnX, sBtnY, shieldBtnW, btnH, 6); ctx.fill()
  ctx.strokeStyle = shColor; ctx.lineWidth = gs.shieldActive ? 2.5 : 1.5
  if (gs.shieldActive) { ctx.shadowColor = "#4488ff"; ctx.shadowBlur = 12 }
  ctx.beginPath(); ctx.roundRect(sBtnX, sBtnY, shieldBtnW, btnH, 6); ctx.stroke()
  ctx.shadowBlur = 0
  // Arco de recarga
  if (!gs.shieldActive && gs.shieldCooldown > 0) {
    const cdPct = 1 - gs.shieldCooldown / gs.shieldCdMax
    ctx.strokeStyle = "#4466aa"; ctx.lineWidth = 3
    const cx2 = sBtnX + shieldBtnW / 2, cy2 = sBtnY + btnH / 2
    ctx.beginPath(); ctx.arc(cx2, cy2, 16, -Math.PI / 2, -Math.PI / 2 + cdPct * Math.PI * 2); ctx.stroke()
    ctx.fillStyle = "#556688"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(`${Math.ceil(gs.shieldCooldown)}s`, cx2, cy2 + 1)
  } else {
    // HP bar del escudo dentro del botón
    if (gs.shieldActive) {
      const shPct = gs.shieldHP / gs.shieldMaxHP
      ctx.fillStyle = "#113366"; ctx.fillRect(sBtnX + 6, sBtnY + btnH - 10, shieldBtnW - 12, 5)
      ctx.fillStyle = shPct > 0.5 ? "#44aaff" : shPct > 0.25 ? "#aaddff" : "#ff8844"
      ctx.fillRect(sBtnX + 6, sBtnY + btnH - 10, (shieldBtnW - 12) * shPct, 5)
    }
    // Ícono del escudo
    ctx.fillStyle = shColor; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("🛡", sBtnX + shieldBtnW / 2, sBtnY + (gs.shieldActive ? 14 : 17))
    ctx.fillStyle = shReady ? "#aaccff" : gs.shieldActive ? "#ffffff" : "#445566"
    ctx.font = "bold 9px monospace"
    ctx.fillText(gs.shieldActive ? `${Math.ceil(gs.shieldDuration)}s` : "ESCUDO", sBtnX + shieldBtnW / 2, sBtnY + (gs.shieldActive ? 30 : 31))
  }

  // Top HUD
  const topH = 36
  const topGrad = ctx.createLinearGradient(0, 0, 0, topH + 10)
  topGrad.addColorStop(0, "rgba(0,0,20,0.95)"); topGrad.addColorStop(1, "transparent")
  ctx.fillStyle = topGrad; ctx.fillRect(0, 0, W, topH + 10)
  ctx.fillStyle = world.accent; ctx.font = "bold 13px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText(gs.isEndless ? "ENDLESS" : `MUNDO ${gs.worldId + 1}`, 14, 18)
  if (gs.isEndless) {
    ctx.fillStyle = "#aaaaaa"; ctx.textAlign = "center"; ctx.font = "bold 13px monospace"
    ctx.fillText(gs.phase === "boss" ? "¡MINI-JEFE!" : `OLEADA ${gs.endlessWave}`, W / 2, 18)
  } else if (gs.phase === "playing") {
    const wdef = WORLDS[gs.worldId]
    ctx.fillStyle = "#aaaaaa"; ctx.textAlign = "center"
    ctx.fillText(`OLEADA ${gs.wave + 1}/${wdef.waves.length}`, W / 2, 18)
  } else if (gs.phase === "boss") {
    ctx.fillStyle = "#ff4444"; ctx.textAlign = "center"; ctx.font = "bold 13px monospace"
    ctx.fillText("¡JEFE!", W / 2, 18)
  }

  // Botón de robot de reparación (esquina superior izquierda)
  const bots = gs.save.equipment.repairBots
  gs.repairBtn = { x: 14, y: 42, w: 84, h: 34 }
  const rBtn = gs.repairBtn
  const rReady = bots > 0 && gs.playerHP < gs.playerMaxHP
  ctx.fillStyle = rReady ? "#44ff8822" : "rgba(255,255,255,0.05)"
  ctx.beginPath(); ctx.roundRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, 8); ctx.fill()
  ctx.strokeStyle = bots > 0 ? "#44ff88" : "#335544"; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, 8); ctx.stroke()
  ctx.fillStyle = bots > 0 ? "#44ff88" : "#446655"
  ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("🤖", rBtn.x + 20, rBtn.y + rBtn.h / 2)
  ctx.fillStyle = bots > 0 ? "#ffffff" : "#446655"; ctx.font = "bold 12px monospace"; ctx.textAlign = "left"
  ctx.fillText(`x${bots}`, rBtn.x + 34, rBtn.y + 14)
  ctx.fillStyle = rReady ? "#44ff88" : "#446655"; ctx.font = "bold 9px monospace"
  ctx.fillText("REPARAR", rBtn.x + 34, rBtn.y + 27)

  // Combo (esquina derecha superior, debajo del mute)
  if (gs.combo >= 2) {
    const cpulse = 1 + Math.sin(Date.now() / 90) * 0.08
    const cy = 46
    ctx.save()
    ctx.translate(W - 62, cy); ctx.scale(cpulse, cpulse)
    ctx.fillStyle = gs.combo >= 6 ? "#ff4488" : gs.combo >= 4 ? "#ffcc44" : "#ffffff"
    ctx.font = "bold 20px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.shadowColor = ctx.fillStyle as string; ctx.shadowBlur = 8
    ctx.fillText(`x${gs.combo}`, 0, 0)
    ctx.restore()
    // Barra de tiempo del combo
    ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(W - 92, cy + 14, 60, 3)
    ctx.fillStyle = gs.combo >= 6 ? "#ff4488" : "#ffcc44"
    ctx.fillRect(W - 92, cy + 14, 60 * Math.max(0, gs.comboTimer / COMBO_TIMEOUT), 3)
  }

  // Power-ups activos (izquierda, sobre el HUD)
  let puY = H - HUD_H - 16
  if (gs.overdriveT > 0) {
    ctx.fillStyle = "#ff44ff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
    ctx.fillText(`⚡ ${gs.overdriveT.toFixed(1)}s`, 14, puY); puY -= 16
  }
  if (gs.magnetT > 0) {
    ctx.fillStyle = "#00ff88"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
    ctx.fillText(`🧲 ${gs.magnetT.toFixed(1)}s`, 14, puY)
  }

  // Boss HP bar at top
  if (gs.phase === "boss" && gs.boss?.alive) {
    const bpct = Math.max(0, gs.boss.hp / gs.boss.maxHp)
    const bw = W - 28, bh = 12, bx = 14, by = 26
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(bx, by, bw, bh)
    const bc = bpct > 0.5 ? "#ff5500" : bpct > 0.25 ? "#ff8800" : "#ff0000"
    ctx.fillStyle = bc; ctx.fillRect(bx, by, bw * bpct, bh)
    ctx.strokeStyle = bc + "99"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh)
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(WORLDS[gs.worldId].bossName.toUpperCase(), bx + bw / 2, by + bh / 2)
  }

  // Gravity pulse indicator
  if (gs.phase === "boss" && gs.boss?.gravPulseActive) {
    ctx.fillStyle = "rgba(0,100,255,0.2)"
    ctx.fillRect(0, HUD_H + 36, W, H - HUD_H - 36 - HUD_H)
    ctx.strokeStyle = "#4488ff"; ctx.lineWidth = 2
    ctx.strokeRect(4, 40, W - 8, H - 80)
    ctx.fillStyle = "#4488ff"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"
    ctx.fillText("⚠ CAMPO GRAVITACIONAL ACTIVO ⚠", W / 2, 58)
  }

  // Flash message
  if (gs.flashT > 0) {
    const alpha = Math.min(1, gs.flashT * 2)
    ctx.fillStyle = `rgba(255,255,100,${alpha})`
    ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(gs.flashMsg, W / 2, H / 2 - 40)
  }
}

export function drawMuteBtn(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = MUTE_BTN
  const muted = getSoundMuted()
  ctx.save()
  ctx.fillStyle = muted ? "rgba(60,10,10,0.88)" : "rgba(0,20,50,0.75)"
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill()
  ctx.strokeStyle = muted ? "#ff4444" : "#4488ff"
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.stroke()
  ctx.fillStyle = muted ? "#ff6666" : "#88bbff"
  ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(muted ? "✕ SFX" : "♫ SFX", x + w / 2, y + h / 2)
  ctx.restore()
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = p.life / p.maxLife
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

export function drawTrail(ctx: CanvasRenderingContext2D, gs: GS) {
  const n = gs.trail.length
  for (let i = 0; i < n; i++) {
    const t = gs.trail[i]
    const a = (i / n) * 0.5
    const r = 4 + (i / n) * 8
    ctx.fillStyle = `rgba(0,200,255,${a})`
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 20, r * 0.6, r, 0, 0, Math.PI * 2); ctx.fill()
  }
}

export function drawFloaters(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const f of gs.floaters) {
    const alpha = Math.min(1, f.life / f.maxLife * 1.5)
    ctx.globalAlpha = alpha
    ctx.fillStyle = f.color
    ctx.font = `bold ${f.size}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(f.text, f.x, f.y)
    ctx.globalAlpha = 1
  }
}

export function drawShockwaves(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const s of gs.shockwaves) {
    const alpha = s.life / s.maxLife
    ctx.strokeStyle = s.color === "#ffffff"
      ? `rgba(255,255,255,${alpha * 0.8})`
      : hexToRgba(s.color, alpha * 0.8)
    ctx.lineWidth = 3 * alpha
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke()
    // Destello central breve
    if (s.life > s.maxLife * 0.6) {
      const fa = (s.life - s.maxLife * 0.6) / (s.maxLife * 0.4)
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.maxR * 0.4)
      g.addColorStop(0, `rgba(255,255,255,${fa * 0.5})`)
      g.addColorStop(1, "transparent")
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(s.x, s.y, s.maxR * 0.4, 0, Math.PI * 2); ctx.fill()
    }
  }
}

export function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}