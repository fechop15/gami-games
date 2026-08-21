// Orquesta el render por fase: mundo → HUD → minimapa → overlays.
import type { GS } from "../core/types"
import { W, H, CAM_ZOOM } from "../core/constants"
import { drawBackground, drawGrid, drawAsteroidBelt, drawBase, drawPlayer, drawEnemies, drawTargetReticle, drawBullets, drawCrates, drawDrops, drawBossLaser, drawEdgeArrows, drawEffects } from "./world"
import { drawMinimap } from "./minimap"
import { drawHUD } from "./hud"
import { drawPanel } from "./panels"
import { drawIntro, drawBaseMenu, drawDead } from "./screens"
import { drawLoading } from "../../lib/gameKit"

type Imgs = Record<string, HTMLImageElement>

export function drawScreen(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs, time: number): void {
  if (gs.phase === "loading") {
    drawLoading(ctx, W, H, gs.loadPct, "#00e5ff", "Galaxy Assault")
    return
  }
  if (gs.phase === "intro") {
    drawIntro(ctx, gs, imgs)
    return
  }
  if (gs.phase === "base-menu") {
    drawWorldBackground(ctx, gs, imgs, time)
    drawBaseMenu(ctx, gs, imgs)
    return
  }

  // Fases de juego (playing / dead)
  drawWorldBackground(ctx, gs, imgs, time)

  // Zoom de cámara: escala el mundo alrededor del centro (la nave está centrada)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(CAM_ZOOM, CAM_ZOOM)
  ctx.translate(-W / 2, -H / 2)

  // Screen shake
  if (gs.shake > 0) {
    ctx.translate((Math.random() - 0.5) * gs.shake, (Math.random() - 0.5) * gs.shake)
  }

  drawGrid(ctx, gs)
  drawAsteroidBelt(ctx, gs, imgs)
  drawBase(ctx, gs, imgs, time)
  drawCrates(ctx, gs, imgs)
  drawDrops(ctx, gs, imgs)
  drawBossLaser(ctx, gs)
  drawEnemies(ctx, gs, imgs)
  drawTargetReticle(ctx, gs, imgs, time)
  drawPlayer(ctx, gs, imgs, time)
  drawBullets(ctx, gs, imgs)
  drawEffects(ctx, gs)

  ctx.restore()

  // Arrows de borde (sin shake, en pantalla)
  if (gs.phase === "playing") {
    drawEdgeArrows(ctx, gs)
  }

  // HUD
  drawHUD(ctx, gs, imgs)
  if (!gs.hud.vitals.minimized || gs.editMode) drawPanel(ctx, gs, "vitals", imgs, time)
  if (!gs.hud.stats.minimized || gs.editMode) drawPanel(ctx, gs, "stats", imgs, time)
  if (!gs.hud.events.minimized || gs.editMode) drawPanel(ctx, gs, "events", imgs, time)
  if (!gs.hud.minimap.minimized || gs.editMode) drawMinimap(ctx, gs)

  // Overlays
  if (gs.phase === "dead") {
    drawDead(ctx)
  }
}

function drawWorldBackground(ctx: CanvasRenderingContext2D, gs: GS, imgs: Imgs, time: number): void {
  drawBackground(ctx, gs, imgs, time)
}