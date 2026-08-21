"use client"
import { useEffect, useRef } from "react"
import { makeGS, update, maxScroll, clampScroll } from "./engine"
import { drawScreen } from "./ui"
import { handleTap } from "./input"
import { W, H, FARM_TOP, FARM_BOTTOM, NAV_H } from "./constants"
import type { GS } from "./types"

export default function EcoGranjaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(makeGS())

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const gs = gsRef.current

    const resize = () => {
      const vw = window.innerWidth, vh = window.innerHeight
      const scale = Math.min(vw / W, vh / H)
      canvas.style.width = `${W * scale}px`
      canvas.style.height = `${H * scale}px`
    }
    resize()
    window.addEventListener("resize", resize)

    let rafId = 0
    const loop = (now: number) => {
      const rawDt = (now - gs.lastTime) / 1000
      gs.lastTime = now
      const dt = Math.min(rawDt, 0.05)
      update(gs, dt)
      drawScreen(ctx, gs, gs.time)
      rafId = requestAnimationFrame(loop)
    }
    gs.lastTime = performance.now()
    rafId = requestAnimationFrame(loop)

    const getScale = () => {
      const rect = canvas.getBoundingClientRect()
      return { sx: W / rect.width, sy: H / rect.height, rect }
    }

    // drag / tap
    let tapPending: { x: number; y: number } | null = null
    let tapStartX = 0, tapStartY = 0
    let dragStartY: number | null = null
    let dragBase = 0
    let dragMode: "farm" | "list" | null = null

    const isListPhase = (p: GS["phase"]) => p === "shop" || p === "market" || p === "staff" || p === "eco"

    const startDragIfNeeded = (gs: GS, tx: number, ty: number) => {
      dragStartY = ty
      tapPending = { x: tx, y: ty }
      tapStartX = tx; tapStartY = ty
      dragMode = null
      if (gs.modal !== "none" || gs.fishing.active) return
      if (gs.phase === "farm") {
        if (gs.sheet === "none" && ty >= FARM_TOP - 6 && ty <= FARM_BOTTOM + 6) {
          dragMode = "farm"
          dragBase = gs.scroll
        }
        return
      }
      if (isListPhase(gs.phase) && ty > 100 && ty < H - NAV_H) {
        dragMode = "list"
        dragBase = gs.listScroll
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      const t = e.touches[0]
      const tx = (t.clientX - rect.left) * sx
      const ty = (t.clientY - rect.top) * sx
      gs.isTouching = true
      startDragIfNeeded(gs, tx, ty)
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (dragStartY === null) return
      const { sx, rect } = getScale()
      const t = e.touches[0]
      const tx = (t.clientX - rect.left) * sx
      const ty = (t.clientY - rect.top) * sx
      if (Math.abs(tx - tapStartX) > 8 || Math.abs(ty - tapStartY) > 8) tapPending = null
      if (dragMode === "farm") {
        gs.scroll = clampScroll(gs)
        gs.scroll = Math.max(0, Math.min(dragBase + (dragStartY - ty), maxScroll(gs)))
      } else if (dragMode === "list") {
        gs.listScroll = Math.max(0, Math.min(dragBase + (dragStartY - ty), 5000))
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      gs.isTouching = false
      dragStartY = null
      if (tapPending) {
        const { sx, rect } = getScale()
        const t = e.changedTouches[0]
        handleTap(gs, (t.clientX - rect.left) * sx, (t.clientY - rect.top) * sx)
        tapPending = null
      }
    }

    const onTouchCancel = (e: TouchEvent) => {
      e.preventDefault()
      gs.isTouching = false
      dragStartY = null
      tapPending = null
    }

    const onMouseMove = (e: MouseEvent) => {
      if (dragStartY === null) return
      const { sx, sy, rect } = getScale()
      const mx = (e.clientX - rect.left) * sx
      const my = (e.clientY - rect.top) * sy
      if (Math.abs(mx - tapStartX) > 8 || Math.abs(my - tapStartY) > 8) tapPending = null
      if (dragMode === "farm") {
        gs.scroll = Math.max(0, Math.min(dragBase + (dragStartY - my), maxScroll(gs)))
      } else if (dragMode === "list") {
        gs.listScroll = Math.max(0, Math.min(dragBase + (dragStartY - my), 5000))
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      const { sx, sy, rect } = getScale()
      const mx = (e.clientX - rect.left) * sx
      const my = (e.clientY - rect.top) * sy
      gs.isTouching = true
      startDragIfNeeded(gs, mx, my)
    }

    const onMouseUp = (e: MouseEvent) => {
      gs.isTouching = false
      dragStartY = null
      if (tapPending) {
        const { sx, sy, rect } = getScale()
        handleTap(gs, (e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy)
        tapPending = null
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleTap(gs, W / 2, H / 2)
      }
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: false })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", onTouchEnd, { passive: false })
    canvas.addEventListener("touchcancel", onTouchCancel, { passive: false })
    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("mousedown", onMouseDown)
    canvas.addEventListener("mouseup", onMouseUp)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", onTouchEnd)
      canvas.removeEventListener("touchcancel", onTouchCancel)
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("mousedown", onMouseDown)
      canvas.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      width: "100vw", height: "100vh", background: "#0c0f16", overflow: "hidden",
      userSelect: "none", WebkitUserSelect: "none",
    }}>
      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ display: "block", imageRendering: "pixelated", touchAction: "none" }}
      />
    </div>
  )
}