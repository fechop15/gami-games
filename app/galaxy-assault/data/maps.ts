// Definición de universos/mapas. M1 es el único jugable; M2+ se agregan después.
import { CONFIG } from "../core/constants"
import type { Asteroid } from "../core/types"
import { rand } from "../../lib/math"

export interface MapDef {
  id: string
  name: string
  sizeCells: number
  cell: number
  baseX: number
  baseY: number
  safeRadius: number
}

export function currentMap(): MapDef {
  const m = CONFIG.map
  return {
    id: m.id,
    name: m.name,
    sizeCells: m.size,
    cell: m.cell,
    baseX: m.base.x * m.cell + m.cell / 2,
    baseY: m.base.y * m.cell + m.cell / 2,
    safeRadius: m.safeRadius,
  }
}

/** Genera el cinturón de asteroides alrededor del perímetro (bloquea el movimiento).
 * Usa 2 hileras por borde para rodear todo el mapa de forma densa. */
export function buildAsteroidBelt(): Asteroid[] {
  const b = CONFIG.map.border
  const size = CONFIG.map.size * CONFIG.map.cell
  const out: Asteroid[] = []
  if (!b.enabled) return out
  const layers = [b.belt / 3, (b.belt * 2) / 3]
  const per = 2 * (size - b.belt * 2)
  const n = Math.max(8, Math.floor(per / b.spacing))
  for (const mid of layers) {
    for (let i = 0; i < n; i++) {
      const t = i / n
      const edge = Math.floor(t * 4) // 0 top, 1 right, 2 bottom, 3 left
      const local = t * 4 - edge // 0..1 dentro del borde
      let x: number
      let y: number
      if (edge === 0) { x = mid + local * (size - b.belt); y = mid }
      else if (edge === 1) { x = size - mid; y = mid + local * (size - b.belt) }
      else if (edge === 2) { x = size - mid - local * (size - b.belt); y = size - mid }
      else { x = mid; y = size - mid - local * (size - b.belt) }
      x += rand(-b.jitter, b.jitter)
      y += rand(-b.jitter, b.jitter)
      x = Math.max(b.radiusMax + 2, Math.min(size - b.radiusMax - 2, x))
      y = Math.max(b.radiusMax + 2, Math.min(size - b.radiusMax - 2, y))
      out.push({
        x, y,
        radius: rand(b.radiusMin, b.radiusMax),
        angle: rand(0, Math.PI * 2),
        spin: rand(-0.4, 0.4),
        variant: i % 3,
      })
    }
  }
  return out
}