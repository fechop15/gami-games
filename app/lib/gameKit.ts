// Shared canvas design-system helpers for the mini-games.
// Goal: a cohesive, friendly, colorful "hyper-casual" look across every game.
// Pure canvas 2D — no dependencies. Import what you need per game.

export const FONT_STACK = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

/** Build a canvas font string with the shared rounded/bold stack. */
export function font(size: number, weight: number | string = 800): string {
  return `${weight} ${Math.round(size)}px ${FONT_STACK}`;
}

/** Convert #rrggbb (or #rgb) to an rgba() string with the given alpha. */
export function rgba(hex: string, a = 1): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/** Mix a hex color toward white (amt>0) or black (amt<0), amt in [-1,1]. */
export function shade(hex: string, amt: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const k = 1 + amt;
    r = Math.round(r * k);
    g = Math.round(g * k);
    b = Math.round(b * k);
  }
  return `rgb(${r},${g},${b})`;
}

/** Rounded-rect path helper (falls back if roundRect is unavailable). */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
  } else {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

/** Soft vertical gradient background. Pass 2-3 stops for a friendly sky. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stops: string[]
): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (stops.length === 1) {
    g.addColorStop(0, stops[0]);
    g.addColorStop(1, stops[0]);
  } else {
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Subtle darkening at the edges to focus the play area. */
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.35): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export interface ButtonOpts {
  color?: string;       // fill/accent color
  textColor?: string;   // label color
  fontSize?: number;    // label size
  glow?: boolean;       // soft outer glow
  radius?: number;
}

/**
 * Draw a rounded, glossy button centered on (cx,cy) with the given size.
 * The caller keeps its own hit-box; this only renders. Returns the bounds.
 */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  opts: ButtonOpts = {}
): { x: number; y: number; w: number; h: number } {
  const color = opts.color ?? "#6366f1";
  const textColor = opts.textColor ?? "#ffffff";
  const r = opts.radius ?? h / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.save();
  if (opts.glow) {
    ctx.shadowColor = rgba(color, 0.7);
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 6;
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // top gloss highlight
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  gl.addColorStop(0, "rgba(255,255,255,0.35)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();

  ctx.fillStyle = textColor;
  ctx.font = font(opts.fontSize ?? Math.round(h * 0.4), 800);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 1);
  ctx.textBaseline = "alphabetic";

  return { x, y, w, h };
}

export interface PillOpts {
  accent?: string;
  textColor?: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  icon?: string; // small emoji/glyph rendered before the text
}

/**
 * Draw a rounded HUD pill with a translucent dark backing and accent label.
 * (x,y) is the top-left of the pill unless align centers/right-aligns around x.
 */
export function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  opts: PillOpts = {}
): void {
  const accent = opts.accent ?? "#ffffff";
  const textColor = opts.textColor ?? "#ffffff";
  const fs = opts.fontSize ?? 16;
  const padX = fs * 0.85;
  const h = fs + 14;
  ctx.font = font(fs, 800);
  const label = opts.icon ? `${opts.icon}  ${text}` : text;
  const tw = ctx.measureText(label).width;
  const w = tw + padX * 2;
  let px = x;
  if (opts.align === "center") px = x - w / 2;
  else if (opts.align === "right") px = x - w;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "rgba(15,16,32,0.55)";
  roundRectPath(ctx, px, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, px, y, w, h, h / 2);
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, px + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

/** Draw text with a soft colored glow, centered by default. */
export function glowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { glow?: string; weight?: number | string; align?: CanvasTextAlign } = {}
): void {
  ctx.save();
  ctx.font = font(size, opts.weight ?? 900);
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = opts.glow ?? rgba(color, 0.6);
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw a rounded translucent panel (for overlays / dialogs). */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 24,
  fill = "rgba(20,22,40,0.72)"
): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = fill;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

/** Draw a filled 5-point star. */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  glow = true
): void {
  ctx.save();
  if (glow) {
    ctx.shadowColor = rgba(color, 0.8);
    ctx.shadowBlur = r;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const a2 = a + Math.PI / 5;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw a heart (for lives). */
export function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  filled: boolean
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 20, size / 20);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-2, 2, -10, -1, -10, -7);
  ctx.bezierCurveTo(-10, -12, -4, -12, 0, -7);
  ctx.bezierCurveTo(4, -12, 10, -12, 10, -7);
  ctx.bezierCurveTo(10, -1, 2, 2, 0, 6);
  ctx.closePath();
  if (filled) {
    ctx.shadowColor = "rgba(244,63,94,0.7)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f43f5e";
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Ease-out-back for pop/bounce scale animations. t in [0,1] -> scale factor. */
export function popScale(t: number, overshoot = 1.7): number {
  const c = overshoot;
  const p = t - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
}

// ---------------------------------------------------------------------------
// Shared mobile scaffolding: image preload, loading screen, icon buttons,
// onboarding card. Keeps the 10 mini-games visually and behaviourally
// coherent (loading -> onboarding -> playing -> gameover/win).
// ---------------------------------------------------------------------------

export interface Rect { x: number; y: number; w: number; h: number }

/** Hit-test a point against a rect (inclusive). */
export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * Preload a map of images. Resolves with the loaded HTMLImageElements keyed the
 * same way. Images that fail to load are simply omitted (games must keep a
 * procedural fallback). onProgress reports fraction in [0,1]. Never rejects.
 */
export function loadImages(
  sources: Record<string, string>,
  onProgress?: (pct: number) => void
): Promise<Record<string, HTMLImageElement>> {
  const keys = Object.keys(sources);
  const out: Record<string, HTMLImageElement> = {};
  let done = 0;
  return new Promise((resolve) => {
    if (keys.length === 0) {
      onProgress?.(1);
      resolve(out);
      return;
    }
    const finish = () => {
      done++;
      onProgress?.(done / keys.length);
      if (done === keys.length) resolve(out);
    };
    for (const k of keys) {
      const img = new Image();
      img.onload = () => {
        out[k] = img;
        finish();
      };
      img.onerror = () => finish();
      img.src = sources[k];
    }
  });
}

/** Top-right icon button slots (0 = rightmost). 44px tap targets. */
export function iconButtonRect(canvasW: number, slot = 0): Rect {
  const s = 44;
  const gap = 8;
  const margin = 12;
  return { x: canvasW - margin - s - slot * (s + gap), y: 12, w: s, h: s };
}

/** Draw a round translucent icon button with a centered glyph. */
export function drawIconButton(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  glyph: string,
  accent = "#ffffff"
): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "rgba(15,16,32,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = font(Math.round(r.h * 0.5), 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, cx, cy + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Mute button (slot 0, top-right). Returns its rect for hit-testing. */
export function drawMuteButton(ctx: CanvasRenderingContext2D, canvasW: number, muted: boolean, accent = "#ffffff"): Rect {
  const r = iconButtonRect(canvasW, 0);
  drawIconButton(ctx, r, muted ? "🔇" : "🔊", accent);
  return r;
}

/** Help "?" button (slot 1, left of mute). Returns its rect for hit-testing. */
export function drawHelpButton(ctx: CanvasRenderingContext2D, canvasW: number, accent = "#ffffff"): Rect {
  const r = iconButtonRect(canvasW, 1);
  drawIconButton(ctx, r, "?", accent);
  return r;
}

/** Consistent loading screen with progress bar. pct in [0,1]. */
export function drawLoading(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pct: number,
  accent: string,
  title = ""
): void {
  drawBackground(ctx, w, h, [shade(accent, -0.55), "#0b0a14"]);
  const cx = w / 2;
  const cy = h / 2;
  if (title) {
    glowText(ctx, title, cx, cy - 40, Math.min(38, w * 0.11), "#ffffff", { glow: rgba(accent, 0.7) });
  }
  const barW = Math.min(w * 0.6, 280);
  const barH = 12;
  const bx = cx - barW / 2;
  const by = cy + 10;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRectPath(ctx, bx, by, barW, barH, barH / 2);
  ctx.fill();
  const p = Math.max(0, Math.min(1, pct));
  if (p > 0) {
    ctx.save();
    ctx.shadowColor = rgba(accent, 0.8);
    ctx.shadowBlur = 12;
    ctx.fillStyle = accent;
    roundRectPath(ctx, bx, by, Math.max(barH, barW * p), barH, barH / 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = font(14, 600);
  ctx.textAlign = "center";
  ctx.fillText(`Cargando… ${Math.round(p * 100)}%`, cx, by + 40);
  ctx.textAlign = "left";
}

export interface OnboardOpts {
  title: string;
  subtitle?: string;      // one-line objective
  how: string[];          // touch control lines
  scoring?: string;       // one-line points/combo system
  accent: string;
  playLabel?: string;     // default "JUGAR"
}

/**
 * Draw a consistent onboarding / start card (dim overlay + panel + how-to-play
 * + big Play button). Returns the Play button rect for hit-testing.
 * Draw your background (image/procedural) BEFORE calling this.
 */
export function drawOnboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: OnboardOpts
): Rect {
  ctx.save();
  ctx.fillStyle = "rgba(6,5,16,0.72)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const pw = Math.min(w - 36, 380);
  const px = (w - pw) / 2;
  const cx = w / 2;
  const lx = px + 26;
  const innerW = pw - 52;           // ancho útil (padding 26 por lado)

  const titleSize = Math.min(34, pw * 0.11);
  const subSize = 15, howSize = 15, labelSize = 13, scoreSize = 13;
  const subLineH = 20, howLineH = 24, scoreLineH = 18;

  // Pre-medir el texto envuelto para calcular la altura real del panel.
  ctx.font = font(subSize, 600);
  const subRows = opts.subtitle ? wrapLines(ctx, opts.subtitle, innerW) : [];
  ctx.font = font(howSize, 500);
  const howBlocks = opts.how.map((line) => wrapLines(ctx, `•  ${line}`, innerW));
  const howRowCount = howBlocks.reduce((s, b) => s + b.length, 0);
  ctx.font = font(scoreSize, 700);
  const scoreRows = opts.scoring ? wrapLines(ctx, opts.scoring, innerW) : [];

  // Altura del panel = suma real del contenido (evita desbordes).
  let ph = 44 + 34;                                   // padding superior + título
  ph += subRows.length * subLineH + 4;                // subtítulo
  ph += 8 + 24;                                       // separación + "CÓMO JUGAR"
  ph += howRowCount * howLineH;                       // items
  if (scoreRows.length) ph += 6 + scoreRows.length * scoreLineH;
  ph += 14 + 58 + 16;                                 // separación + botón + margen inferior

  const py = Math.max(20, (h - ph) / 2);
  drawPanel(ctx, px, py, pw, ph, 26);

  let y = py + 44;
  glowText(ctx, opts.title, cx, y, titleSize, opts.accent, { glow: rgba(opts.accent, 0.8) });
  y += 30;

  if (subRows.length) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = font(subSize, 600);
    ctx.textAlign = "center";
    for (const r of subRows) { ctx.fillText(r, cx, y); y += subLineH; }
    y += 4;
  }

  y += 8;
  ctx.textAlign = "left";
  ctx.fillStyle = rgba(opts.accent, 0.9);
  ctx.font = font(labelSize, 800);
  ctx.fillText("CÓMO JUGAR", lx, y);
  y += 24;

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = font(howSize, 500);
  for (const block of howBlocks) {
    block.forEach((row, i) => {
      ctx.fillText(row, i === 0 ? lx : lx + 16, y);   // sangría francesa en continuaciones
      y += howLineH;
    });
  }

  if (scoreRows.length) {
    y += 6;
    ctx.fillStyle = rgba(opts.accent, 0.85);
    ctx.font = font(scoreSize, 700);
    ctx.textAlign = "center";
    for (const r of scoreRows) { ctx.fillText(r, cx, y); y += scoreLineH; }
  }

  ctx.textAlign = "left";
  const btn: Rect = { x: cx - 110, y: py + ph - 74, w: 220, h: 58 };
  drawButton(ctx, cx, btn.y + btn.h / 2, btn.w, btn.h, opts.playLabel ?? "JUGAR", { color: opts.accent, glow: true });
  return btn;
}

/** Word-wrap a string into rows that each fit within maxW (font must be set). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const rows: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      rows.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) rows.push(line);
  return rows;
}
