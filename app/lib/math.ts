// Helpers matemáticos compartidos entre los juegos.
// Funciones puras y sin estado — cualquier juego puede importarlas.

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

export function chance(p: number): boolean {
  return Math.random() < p
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return dx * dx + dy * dy
}

/** Ángulo en radianes desde (x1,y1) hacia (x2,y2). */
export function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1)
}

/** Interpola un ángulo respetando el giro más corto (resultado en radianes). */
export function angleLerp(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Colisión círculo-círculo. */
export function circleCollide(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  return distSq(x1, y1, x2, y2) <= (r1 + r2) * (r1 + r2)
}