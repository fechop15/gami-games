"use client"
import { useEffect, useRef } from "react"
import { makeGS, update, saveProgress } from "./engine"
import { drawScreen } from "./render"
import { loadSprites } from "./core/sprites"
import { W, H } from "./core/constants"
import {
  onTouchStart, onTouchMove, onTouchEnd, onKeyDown, drawBaseButton,
} from "./input"
import type { GS } from "./core/types"
import { isMuted } from "../lib/sound"
import { drawIconButton } from "../lib/gameKit"
import { MUTE_BTN, MINIMAP_BTN, EDIT_BTN } from "./core/constants"

// Escala interna de renderizado (1.5x) para nitidez en pantallas de alta densidad
const RENDER_SCALE = 1.5

export default function GalaxyAssaultGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(makeGS())

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const gs = gsRef.current

    canvas.width = W * RENDER_SCALE
    canvas.height = H * RENDER_SCALE

    const resize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const scale = Math.min(vw / W, vh / H)
      canvas.style.width = `${W * scale}px`
      canvas.style.height = `${H * scale}px`
    }
    resize()
    window.addEventListener("resize", resize)

    // Preload sprites
    const imgsRef: { current: Record<string, HTMLImageElement> } = { current: {} }
    loadSprites(pct => { gs.loadPct = pct }).then(imgs => {
      imgsRef.current = imgs
      if (gs.phase === "loading") gs.phase = "intro"
    })

    let rafId = 0
    const startTime = performance.now()
    const loop = (now: number) => {
      const rawDt = (now - gs.lastTime) / 1000
      gs.lastTime = now
      const dt = Math.min(rawDt, 0.05)
      const time = (now - startTime) / 1000
      update(gs, dt)
      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0)
      drawScreen(ctx, gs, imgsRef.current, time)
      drawTopButtons(ctx, gs)
      rafId = requestAnimationFrame(loop)
    }
    gs.lastTime = performance.now()
    rafId = requestAnimationFrame(loop)

    // ── Touch / pointer ──
    const getScale = () => {
      const rect = canvas.getBoundingClientRect()
      return { sx: W / rect.width, sy: H / rect.height, rect }
    }

    const onTouchStartHandler = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      for (const t of Array.from(e.changedTouches)) {
        const x = (t.clientX - rect.left) * sx
        const y = (t.clientY - rect.top) * sx
        onTouchStart(gs, t.identifier, x, y)
      }
    }

    const onTouchMoveHandler = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      for (const t of Array.from(e.changedTouches)) {
        const x = (t.clientX - rect.left) * sx
        const y = (t.clientY - rect.top) * sx
        onTouchMove(gs, t.identifier, x, y)
      }
    }

    const onTouchEndHandler = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      for (const t of Array.from(e.changedTouches)) {
        const x = (t.clientX - rect.left) * sx
        const y = (t.clientY - rect.top) * sx
        onTouchEnd(gs, t.identifier, x, y)
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      const { sx, sy, rect } = getScale()
      const x = (e.clientX - rect.left) * sx
      const y = (e.clientY - rect.top) * sy
      gs.isTouching = true
      onTouchStart(gs, 999, x, y)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!gs.isTouching) return
      const { sx, sy, rect } = getScale()
      const x = (e.clientX - rect.left) * sx
      const y = (e.clientY - rect.top) * sy
      onTouchMove(gs, 999, x, y)
    }

    const onMouseUp = (e: MouseEvent) => {
      void e
      const { sx, sy, rect } = getScale()
      const x = (e.clientX - rect.left) * sx
      const y = (e.clientY - rect.top) * sy
      onTouchEnd(gs, 999, x, y)
    }

    const onKeyDownHandler = (e: KeyboardEvent) => {
      onKeyDown(gs, e)
    }

    // Guardar periódicamente (progreso)
    const saveInterval = window.setInterval(() => {
      if (gs.phase === "playing" || gs.phase === "base-menu") saveProgress(gs)
    }, 5000)

    canvas.addEventListener("touchstart", onTouchStartHandler, { passive: false })
    canvas.addEventListener("touchmove", onTouchMoveHandler, { passive: false })
    canvas.addEventListener("touchend", onTouchEndHandler, { passive: false })
    canvas.addEventListener("touchcancel", onTouchEndHandler, { passive: false })
    canvas.addEventListener("mousedown", onMouseDown)
    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("mouseup", onMouseUp)
    window.addEventListener("keydown", onKeyDownHandler)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(saveInterval)
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("touchstart", onTouchStartHandler)
      canvas.removeEventListener("touchmove", onTouchMoveHandler)
      canvas.removeEventListener("touchend", onTouchEndHandler)
      canvas.removeEventListener("touchcancel", onTouchEndHandler)
      canvas.removeEventListener("mousedown", onMouseDown)
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("keydown", onKeyDownHandler)
    }
  }, [])

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      width: "100vw", height: "100dvh", background: "#03040a", overflow: "hidden",
      userSelect: "none", WebkitUserSelect: "none",
    }}>
      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ display: "block", imageRendering: "auto", touchAction: "none" }}
      />
    </div>
  )
}

// Botones de la esquina superior derecha (mute + minimapa + editar) siempre visibles
function drawTopButtons(ctx: CanvasRenderingContext2D, gs: GS): void {
  drawIconButton(ctx, { x: MUTE_BTN.x, y: MUTE_BTN.y, w: MUTE_BTN.w, h: MUTE_BTN.h }, isMuted() ? "🔇" : "🔊")
  drawIconButton(ctx, { x: MINIMAP_BTN.x, y: MINIMAP_BTN.y, w: MINIMAP_BTN.w, h: MINIMAP_BTN.h }, gs.minimapHidden ? "🗺" : "🗺", gs.minimapHidden ? "#ffffff" : "#00e5ff")
  drawIconButton(ctx, { x: EDIT_BTN.x, y: EDIT_BTN.y, w: EDIT_BTN.w, h: EDIT_BTN.h }, gs.editMode ? "✓" : "⚙", gs.editMode ? "#7CFF5A" : "#ffffff")
  if (gs.phase === "playing" && gs.inSafeZone) drawBaseButton(ctx, gs)
}