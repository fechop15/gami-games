// Iconos SVG (data URI) para items y slots del juego.
// Simples, geométricos y del color del item.

export type IconKind = "laser" | "shield" | "uav"

function svgDataUri(svg: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg)
}

function itemSvg(kind: IconKind, color: string): string {
  if (kind === "shield") {
    // Escudo: hexágono con núcleo brillante
    return svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>` +
      `<path d='M12 1 L22 5 V12 C22 17.5 17.8 21.7 12 23 C6.2 21.7 2 17.5 2 12 V5 Z' fill='${color}'/>` +
      `<path d='M12 4.5 L18.5 7.4 V12 C18.5 15.8 15.7 18.8 12 19.8 C8.3 18.8 5.5 15.8 5.5 12 V7.4 Z' fill='#ffffff' opacity='0.35'/>` +
      `</svg>`,
    )
  }
  if (kind === "uav") {
    // Dron: X-frame con rotores y núcleo
    return svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>` +
      `<circle cx='5' cy='5' r='2.6' fill='${color}'/><circle cx='19' cy='5' r='2.6' fill='${color}'/>` +
      `<circle cx='5' cy='19' r='2.6' fill='${color}'/><circle cx='19' cy='19' r='2.6' fill='${color}'/>` +
      `<path d='M5 5 L19 19 M19 5 L5 19' stroke='${color}' stroke-width='2'/>` +
      `<circle cx='12' cy='12' r='4' fill='${color}'/>` +
      `<circle cx='12' cy='12' r='1.6' fill='#ffffff' opacity='0.85'/>` +
      `</svg>`,
    )
  }
  // Láser: haz en rombo con núcleo blanco
  return svgDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>` +
    `<path d='M12 1 L19 12 L12 23 L5 12 Z' fill='${color}'/>` +
    `<rect x='11' y='3' width='2' height='18' fill='#ffffff' opacity='0.9'/>` +
    `<rect x='7.5' y='10' width='9' height='1.6' fill='#ffffff' opacity='0.4'/>` +
    `</svg>`,
  )
}

const imgCache = new Map<string, HTMLImageElement>()

export function itemIconImage(kind: IconKind, color: string): HTMLImageElement {
  const key = kind + "|" + color
  let img = imgCache.get(key)
  if (!img) {
    img = new Image()
    img.src = itemSvg(kind, color)
    imgCache.set(key, img)
  }
  return img
}

// Dibuja el icono SVG centrado en (cx, cy) con el tamaño dado.
export function drawItemIcon(ctx: CanvasRenderingContext2D, kind: IconKind, color: string, cx: number, cy: number, size: number) {
  const img = itemIconImage(kind, color)
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  } else {
    // Fallback mientras la data URI decodifica
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2); ctx.fill()
  }
}
