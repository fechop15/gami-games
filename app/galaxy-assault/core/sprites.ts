// Sprites SVG del juego: rutas, precarga y dibujo con transformaciones.
import { loadImages } from "../../lib/gameKit"

export interface SpriteSet {
  bg: string
  player: string
  scout: string
  tank: string
  boss1: string
  boss2: string
  laser_x1: string
  laser_x2: string
  laser_x3: string
  missile_a: string
  missile_b: string
  crate_x1: string
  crate_x2: string
  crate_x3: string
  crate_missile: string
  drop_scrap: string
  drop_energy: string
  drop_core: string
  repair_bot: string
  base: string
  shield: string
  reticle: string
  asteroid: string
}

export const SPRITE_SRC: SpriteSet = {
  bg: "/games/galaxy-assault/bg.svg",
  player: "/games/galaxy-assault/player-ship.svg",
  scout: "/games/galaxy-assault/enemy-scout.svg",
  tank: "/games/galaxy-assault/enemy-tank.svg",
  boss1: "/games/galaxy-assault/boss-1.svg",
  boss2: "/games/galaxy-assault/boss-2.svg",
  laser_x1: "/games/galaxy-assault/laser-x1.svg",
  laser_x2: "/games/galaxy-assault/laser-x2.svg",
  laser_x3: "/games/galaxy-assault/laser-x3.svg",
  missile_a: "/games/galaxy-assault/missile-a.svg",
  missile_b: "/games/galaxy-assault/missile-b.svg",
  crate_x1: "/games/galaxy-assault/crate-x1.svg",
  crate_x2: "/games/galaxy-assault/crate-x2.svg",
  crate_x3: "/games/galaxy-assault/crate-x3.svg",
  crate_missile: "/games/galaxy-assault/crate-missile.svg",
  drop_scrap: "/games/galaxy-assault/drop-scrap.svg",
  drop_energy: "/games/galaxy-assault/drop-energy.svg",
  drop_core: "/games/galaxy-assault/drop-core.svg",
  repair_bot: "/games/galaxy-assault/repair-bot.svg",
  base: "/games/galaxy-assault/base.svg",
  shield: "/games/galaxy-assault/shield.svg",
  reticle: "/games/galaxy-assault/target-reticle.svg",
  asteroid: "/games/galaxy-assault/asteroid.svg",
}

export type SpriteKey = keyof SpriteSet

export function loadSprites(onProgress?: (pct: number) => void): Promise<Record<string, HTMLImageElement>> {
  return loadImages(SPRITE_SRC as unknown as Record<string, string>, onProgress)
}

/** Dibuja una imagen centrada en (x,y) rotada `angle` rad, con tamaño `size`. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  imgs: Record<string, HTMLImageElement>,
  key: SpriteKey,
  x: number,
  y: number,
  size: number,
  angle = 0,
  alpha = 1
): void {
  const img = imgs[key]
  if (!img || img.naturalWidth === 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.drawImage(img, -size / 2, -size / 2, size, size)
  ctx.restore()
}

// Los sprites top-down se dibujan apuntando "arriba" (hacia -y). El ángulo de
// movimiento usa la convención atan2 (0 = +x). Convierte dirección → rotación.
export function dirToAngle(a: number): number {
  return a + Math.PI / 2
}