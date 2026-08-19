"use client"
import { useEffect, useRef } from "react"
import { makeGS, update, activateShield, repairShip } from "./engine"
import { draw, worldMaxScroll, invMaxScroll, hangarInvScrollArea } from "./ui"
import { handleTap, hangarDragStart, hangarDragMove, hangarDragEnd, onHangarInvButton, onHangarTile } from "./input"
import { W, H, HUD_H, AMMO_NAMES } from "./constants"
import type { GS, AmmoType } from "./types"

export default function StarAssaultGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GS>(makeGS())

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const gs = gsRef.current

    // Canvas CSS scaling to fill screen
    const resize = () => {
      const vw = window.innerWidth, vh = window.innerHeight
      const scale = Math.min(vw / W, vh / H)
      canvas.style.width = `${W * scale}px`
      canvas.style.height = `${H * scale}px`
    }
    resize()
    window.addEventListener("resize", resize)

    // Game loop
    let rafId = 0
    const startTime = performance.now()
    const loop = (now: number) => {
      const rawDt = (now - gs.lastTime) / 1000
      gs.lastTime = now
      const dt = Math.min(rawDt, 0.05)  // cap at 50ms
      const time = (now - startTime) / 1000
      update(gs, dt)
      draw(ctx, gs, time)
      rafId = requestAnimationFrame(loop)
    }
    gs.lastTime = performance.now()
    rafId = requestAnimationFrame(loop)

    // Touch events
    const getScale = () => {
      const rect = canvas.getBoundingClientRect()
      return { sx: W / rect.width, sy: H / rect.height, rect }
    }

    // Estado de arrastre del selector de mundos (tap diferido hasta soltar)
    let tapPending: { x: number; y: number; cx: number; cy: number } | null = null
    let tapStartX = 0, tapStartY = 0

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      const t = e.touches[0]
      const tx = (t.clientX - rect.left) * sx
      const ty = (t.clientY - rect.top) * sx  // sx == sy (escala uniforme)
      gs.isTouching = true
      if (gs.phase === "world-select") {
        // Arrastre para scroll: el tap se resuelve al soltar
        tapPending = { x: tx, y: ty, cx: t.clientX, cy: t.clientY }
        tapStartX = tx; tapStartY = ty
        gs.worldDragStartY = ty
        gs.worldDragBase = gs.worldScroll
        return
      }
      // Drag & drop del hangar (items y slots)
      if (hangarDragStart(gs, tx, ty)) {
        gs.dragX = tx; gs.dragY = ty
        return
      }
      // Scroll del inventario del hangar: solo en los huecos vacíos (fuera de tiles y botones)
      if (gs.phase === "hangar" && gs.hangarTab === "inventory" && !gs.confirm
          && !onHangarTile(gs, tx, ty) && !onHangarInvButton(gs, tx, ty)) {
        const inv = hangarInvScrollArea()
        if (ty >= inv.top && ty < inv.bottom && invMaxScroll(gs) > 0) {
          tapPending = { x: tx, y: ty, cx: t.clientX, cy: t.clientY }
          tapStartX = tx; tapStartY = ty
          gs.invDragStartY = ty
          gs.invDragBase = gs.invScroll
          return
        }
      }
      // Solo mueve la nave si el toque está ENCIMA del HUD
      if (ty < H - HUD_H) { gs.touchX = tx; gs.touchY = ty }
      handleTap(gs, t.clientX, t.clientY, rect, sx, sx)
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const { sx, rect } = getScale()
      const t = e.touches[0]
      const tx = (t.clientX - rect.left) * sx
      const ty = (t.clientY - rect.top) * sx
      if (gs.dragItem) { hangarDragMove(gs, tx, ty); return }
      if (gs.phase === "world-select" && gs.worldDragStartY !== null) {
        gs.worldScroll = Math.max(0, Math.min(gs.worldDragBase + (gs.worldDragStartY - ty), worldMaxScroll()))
        if (Math.abs(tx - tapStartX) > 8 || Math.abs(ty - tapStartY) > 8) tapPending = null
        return
      }
      if (gs.phase === "hangar" && gs.invDragStartY !== null) {
        gs.invScroll = Math.max(0, Math.min(gs.invDragBase + (gs.invDragStartY - ty), invMaxScroll(gs)))
        if (Math.abs(tx - tapStartX) > 8 || Math.abs(ty - tapStartY) > 8) tapPending = null
        return
      }
      // Solo rastrea la nave encima del HUD para evitar que salte al dedo que toca botones
      if (ty < H - HUD_H) { gs.touchX = tx; gs.touchY = ty }
    }

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      if (gs.dragItem) {
        const { sx, rect } = getScale()
        const t = e.changedTouches[0]
        hangarDragEnd(gs, (t.clientX - rect.left) * sx, (t.clientY - rect.top) * sx)
        gs.dragItem = null
        gs.isTouching = false
        return
      }
      if (gs.phase === "world-select") {
        gs.worldDragStartY = null
        const { sx, rect } = getScale()
        if (tapPending) {
          handleTap(gs, tapPending.cx, tapPending.cy, rect, sx, sx)
          tapPending = null
        }
        return
      }
      if (gs.phase === "hangar" && gs.invDragStartY !== null) {
        gs.invDragStartY = null
        const { sx, rect } = getScale()
        if (tapPending) {
          handleTap(gs, tapPending.cx, tapPending.cy, rect, sx, sx)
          tapPending = null
        }
        return
      }
      gs.isTouching = false
      if (e.touches.length === 0) { gs.touchX = null; gs.touchY = null }
    }

    const onTouchCancel = (e: TouchEvent) => {
      e.preventDefault()
      if (gs.dragItem) gs.dragItem = null
      gs.isTouching = false
      if (e.touches.length === 0) { gs.touchX = null; gs.touchY = null }
    }

    const onMouseMove = (e: MouseEvent) => {
      const { sx, sy, rect } = getScale()
      const mx = (e.clientX - rect.left) * sx
      const my = (e.clientY - rect.top) * sy
      if (gs.dragItem) { hangarDragMove(gs, mx, my); return }
      if (gs.phase === "world-select" && gs.worldDragStartY !== null) {
        gs.worldScroll = Math.max(0, Math.min(gs.worldDragBase + (gs.worldDragStartY - my), worldMaxScroll()))
        if (Math.abs(mx - tapStartX) > 8 || Math.abs(my - tapStartY) > 8) tapPending = null
        return
      }
      if (gs.phase === "hangar" && gs.invDragStartY !== null) {
        gs.invScroll = Math.max(0, Math.min(gs.invDragBase + (gs.invDragStartY - my), invMaxScroll(gs)))
        if (Math.abs(mx - tapStartX) > 8 || Math.abs(my - tapStartY) > 8) tapPending = null
        return
      }
      gs.touchX = mx
      gs.touchY = my
    }

    const onMouseDown = (e: MouseEvent) => {
      const { sx, sy, rect } = getScale()
      const mx = (e.clientX - rect.left) * sx
      const my = (e.clientY - rect.top) * sy
      gs.isTouching = true
      if (gs.phase === "world-select") {
        tapPending = { x: mx, y: my, cx: e.clientX, cy: e.clientY }
        tapStartX = mx; tapStartY = my
        gs.worldDragStartY = my
        gs.worldDragBase = gs.worldScroll
        return
      }
      if (hangarDragStart(gs, mx, my)) {
        gs.dragX = mx; gs.dragY = my
        return
      }
      if (gs.phase === "hangar" && gs.hangarTab === "inventory" && !gs.confirm
          && !onHangarTile(gs, mx, my) && !onHangarInvButton(gs, mx, my)) {
        const inv = hangarInvScrollArea()
        if (my >= inv.top && my < inv.bottom && invMaxScroll(gs) > 0) {
          tapPending = { x: mx, y: my, cx: e.clientX, cy: e.clientY }
          tapStartX = mx; tapStartY = my
          gs.invDragStartY = my
          gs.invDragBase = gs.invScroll
          return
        }
      }
      handleTap(gs, e.clientX, e.clientY, rect, sx, sx)
    }

    const onMouseUp = (e: MouseEvent) => {
      if (gs.dragItem) {
        const { sx, sy, rect } = getScale()
        hangarDragEnd(gs, (e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy)
        gs.dragItem = null
        return
      }
      if (gs.phase === "world-select") {
        gs.worldDragStartY = null
        const { sx, rect } = getScale()
        if (tapPending) {
          handleTap(gs, tapPending.cx, tapPending.cy, rect, sx, sx)
          tapPending = null
        }
        return
      }
      if (gs.phase === "hangar" && gs.invDragStartY !== null) {
        gs.invDragStartY = null
        const { sx, rect } = getScale()
        if (tapPending) {
          handleTap(gs, tapPending.cx, tapPending.cy, rect, sx, sx)
          tapPending = null
        }
        return
      }
      gs.isTouching = false
    }

    // Suelta del mouse fuera del canvas durante un drag
    const onWindowMouseUp = (e: MouseEvent) => {
      if (gs.dragItem) {
        const { sx, sy, rect } = getScale()
        hangarDragEnd(gs, (e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy)
        gs.dragItem = null
        gs.isTouching = false
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const ammos: AmmoType[] = ["basic", "laser", "spread", "missile"]
      if (e.key >= "1" && e.key <= "4") {
        const idx = parseInt(e.key) - 1
        const ammo = ammos[idx]
        if (ammo && (gs.ammo[ammo] === -1 || gs.ammo[ammo] > 0)) {
          gs.activeAmmo = ammo; gs.fireTimer = 0
          gs.flashMsg = AMMO_NAMES[ammo] + " activado"; gs.flashT = 1
        }
      }
      if (e.key === "Shift" || e.key === "s" || e.key === "S") {
        activateShield(gs)
      }
      if (e.key === "r" || e.key === "R") {
        repairShip(gs)
      }
      if (e.key === " " || e.key === "Enter") {
        const { sx, rect } = getScale()
        handleTap(gs, rect.left + rect.width / 2, rect.top + rect.height / 2, rect, sx, sx)
      }
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: false })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", onTouchEnd, { passive: false })
    canvas.addEventListener("touchcancel", onTouchCancel, { passive: false })
    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("mousedown", onMouseDown)
    canvas.addEventListener("mouseup", onMouseUp)
    window.addEventListener("mouseup", onWindowMouseUp)
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
      window.removeEventListener("mouseup", onWindowMouseUp)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      width: "100vw", height: "100vh", background: "#000010", overflow: "hidden",
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