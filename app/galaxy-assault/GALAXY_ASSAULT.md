# Galaxy Assault — Documentación técnica y de diseño

> Juego 016 del catálogo Gami Game
> Ruta: `/galaxy-assault`
> Tecnología: Canvas 2D puro (sin dependencias externas), Next.js App Router, TypeScript
> Estado: **v1** — mapa abierto M1 en horizontal con cámara centrada, joystick + auto-disparo, armas con munición recargable, defensa (evasión/escudo/robots), minimapa y cinturón de asteroides.

---

## Archivos

```
app/galaxy-assault/
├── page.tsx               ← wrapper Next.js (metadata + export)
├── GalaxyAssaultGame.tsx  ← canvas 1280×720 + RAF + input (delgado)
├── config.json            ← TODOS los parámetros tuneables (balance)
├── audio.ts               ← re-export de app/lib/sound.ts (sfx, unlockAudio, toggleMute)
├── input.ts               ← joystick dinámico + botones HUD + cambio de arma + teclado
├── core/
│   ├── types.ts           ← Phase, GS, entidades, AmmoType
│   ├── constants.ts       ← derivados de config (layout, cámara, joystick)
│   ├── save.ts            ← localStorage "galaxy-assault-save"
│   └── sprites.ts         ← rutas SVG + loadSprites() + drawSprite()
├── data/
│   ├── maps.ts            ← M1 + cinturón de asteroides
│   ├── ships.ts           ← naves (daño base, mults, sprite) desde config
│   ├── ammo.ts            ← municiones x1/x2/x3 + misiles A/B
│   └── items.ts           ← inventario + robots de reparación
├── engine/
│   ├── index.ts           ← makeGS + update (orquesta) + cámara + respawn
│   ├── player.ts          ← joystick → movimiento, colisión asteroides, evasión
│   ├── enemies.ts         ← IA, aggro, spawn infinito (timers+caps), jefes, mecánicas
│   ├── combat.ts          ← targeting, auto-fire, balas, daño (evasión→escudo→casco), drops
│   └── crates.ts          ← cajas de munición, drops, datos del minimapa
└── render/
    ├── index.ts           ← drawScreen orquesta
    ├── world.ts           ← fondo, grid, asteroides, base, entidades, marcadores
    ├── minimap.ts         ← minimapa arriba-derecha
    ├── hud.ts             ← HP, escudo, evasión, munición, arma, reparar, joystick
    └── screens.ts         ← intro, base-menu, dead

public/games/galaxy-assault/  ← 24 SVGs (bg, icon, sprites 256×256 top-down neón)
```

**Compartido:** `app/lib/gameKit.ts` (drawButton/Panel/glowText/roundRect/loadImages), `app/lib/sound.ts` (sfx.*), `app/lib/math.ts` (clamp/lerp/rand/dist/angleTo/circleCollide — creado para este juego, reusable).

---

## Arquitectura

El componente React es delgado: monta el canvas de **1280×720** (lógico, landscape), corre el game loop con `requestAnimationFrame`, precarga los SVGs con `loadSprites()` y delega en módulos por responsabilidad. El estado vive en `useRef<GS>` (sin re-renders). El canvas escala uniformemente con CSS; las conversiones touch usan un único factor.

---

## Mundo y mapa M1

- Grid **100×100 celdas**, `CELL = 32px` → mundo **3200×3200 px**.
- **Base en celda (10,10)** → centro `(336,336)`, **radio seguro ~160px**. Dentro: sin daño, los enemigos no entran, es el respawn y abre el menú de base.
- **Cámara centrada en la nave** (la nave se dibuja siempre en el centro de pantalla), clamp al área jugable.
- **Cinturón de asteroides** alrededor del perímetro (`map.border` en config): colisión circular contra la nave (empuja), enemigos solo se clamp al área jugable.
- **Minimapa** arriba-derecha (190px): marco del mundo, cinturón, base (verde), jugador (triángulo rotado), enemigos (puntos rojos), jefes (dorados), cajas (amarillas). Botón para ocultar.

---

## Armas y munición

**Un arma activa conmutable** (botón HUD `🔁` o teclas 1-5). Cada disparo **gasta munición**; a 0 no dispara hasta recoger cajas.

| Munición | Tipo | Mult daño | Cadencia | Máx | Caja da |
|---|---|---|---|---|---|
| x1 Láser | laser | ×1.0 | 220ms | 80 | 22 |
| x2 Láser | laser | ×1.35 | 300ms | 50 | 14 |
| x3 Láser | laser | ×1.8 | 420ms | 30 | 8 |
| Misil A (homing) | missile | ×2.5 | 900ms | 12 | 4 |
| Misil B (pesado AoE) | missile | ×3.2 | 1400ms | 6 | 2 |

- **Daño = daño base de la nave × dmgMult de la munición activa**.
- **Cajas de bonos** aleatorias en el mapa (spawner por timer + cap) recargan munición del tipo de la caja. Se marcan con flecha verde si están fuera de pantalla.
- Munición **no** se persiste (se recarga con cajas cada sesión).

---

## Defensa

Orden de resolución del daño al jugador:
1. **Evasión por movimiento** — probabilidad escala con la velocidad de la nave (parado = 0%, a tope = `evasionCap` 25%). Muestra "EVADIDO".
2. **Escudo absorbente** — absorbe un **% del daño entrante** (`shieldAbsorb` 60%); el resto va al casco.
3. **Casco** — HP de la nave; a 0 → muerte → **respawn en la base** con HP lleno.

### Regeneración automática y progresiva
El **escudo** y el **casco** se reparan solos de forma progresiva (valores por segundo en `config.json`) SOLO si:
- Estás en **zona segura** (repara más rápido), o
- Llevas **`regen.idleTime` (60 s)** sin recibir daño.

El casco repara solo cuando el escudo ya está completo (el escudo se prioriza). La barra de escudo sobre la nave muestra el progreso hacia la regeneración (llenado azul tenue).

**Robots de reparación** 🤖 (item de un solo uso, botón `🤖 REPARAR` o tecla R): reparan `healPct` (40%) del HP máximo al instante.

---

## Enemigos y jefes

### NPCs (2 tipos, spawn infinito)
| Tipo | HP | Vel | Cadencia | Daño bala | Puntos | Spawn | Cap |
|---|---|---|---|---|---|---|---|
| Scout | 40 | 140 | 1700ms | 8 | 50 | 6000ms | 22 |
| Tank | 130 | 75 | 2100ms | 14 | 120 | 9000ms | 10 |

Spawner: cada tipo tiene `spawnInterval` + `maxCount`; si hay menos del cap y venció el timer → spawn aleatorio a distancia mínima de base y jugador. Además hay un **tope global** de NPCs vivos en el mapa (`balance.maxNpcsOnMap`, 26) para no sobrepoblar.

### Jefes (2, cap 1, respawn por timer largo)
- **Centinela Carmesí** (60000ms): mecánica `cone` — ráfaga en cono (3→5 en fase 2).
- **Dreadnought Violeta** (90000ms): mecánica `minions+laser` — invoca 2 scouts (fase 2) + láser de barrido.
- Ambos entran en **fase 2 al 50% HP** (más cadencia). Sueltan núcleo + chatarra garantizados.

---

## Targeting / señalización

- **Auto-bloqueo**: enemigo más cercano dentro de `fireRange` (520px). Retícula neón + barra de HP sobre él.
- **Flechas de borde**: hacia enemigos (rojas), jefes (doradas) y cajas (verdes) fuera de pantalla.
- **Auto-disparo**: balas hacia el objetivo con la munición activa (láser recto, misiles homing/AoE).

---

## Inventario y progresión

- Enemigos sueltan drops por probabilidad (config): **Chatarra** 🔩, **Celda de energía** 🔋, **Núcleo** ⭐ (raros, jefes seguros), **Robot de reparación** 🤖.
- Monedas por kill y por jefe. Se guardan en `localStorage`.
- **Menú de base** (⚓ BASE al estar en zona segura, o tecla B): inventario + robots + monedas + placeholder "🚀 Naves (Próximamente)".

---

## Save (`"galaxy-assault-save"`)

```typescript
interface GalaxySave {
  version, coins, inventory: Record<string, number>,
  shipId, shipsOwned: string[], currentMap: "M1",
  mapsCleared: string[], kills, bossKills: Record<string, number>,  // { boss1: n, boss2: n }
  repairBots, muted
}
```
Se guarda cada 5s durante el juego y al cambiar de fase. Munición no se persiste.

---

## Config (`config.json`) — balance central

`map` (tamaño, base, radio seguro, borde de asteroides) · `minimap` · `player` (velocidad, HP, daño base, escudo %, evasión, rango de tiro) · `ships` · `weapons` (5 municiones) · `npcs` (2) · `bosses` (2) · `crates` (spawn/cap/vida) · `drops` · `repairBot` · `balance` (monedas, desbloqueo M2 pendiente).

---

## Controles

| Acción | Gesto / Tecla |
|---|---|
| Mover nave | Joystick en la zona izquierda (toca y arrastra). La punta de la nave apunta hacia donde va (giro suave) |
| Elegir objetivo | Toca un enemigo en cualquier zona (retícula + aro rojo pulsante). Tocar vacío lo desmarca |
| Disparar | Mantén el botón 🔫 DISPARAR. Dispara la munición activa hacia el objetivo; la nave apunta con el frente al objetivo |
| Cambiar arma | Barra rápida de munición (cuadros abajo-centro) o teclas 1-5 |
| Reparar | Botón 🤖 REPARAR o tecla R |
| Abrir base | Botón ⚓ BASE (zona segura) o tecla B |
| Minimapa | Botón 🗺 o tecla M |
| Silenciar | Botón 🔊 |
| Menú base → volver | Botón SALIR AL MAPA o tecla Esc |

Multitouch: puedes mover (joystick) y mantener disparo (botón 🔫) a la vez con dos dedos. El joystick solo se activa en la zona izquierda; tocar en el resto no lo interrumpe.

---

## Ideas para iteraciones futuras
- **M2+**: derrotar los 2 jefes de M1 N veces desbloquea el siguiente universo (ya queda `bossKillsToUnlockNext`).
- Tienda/cambio real de naves en la base; construir naves con el inventario.
- Más tipos de NPCs y mecánicas de jefe (espiral, teleport, escudo).
- Perks por corrida, vibración táctil, música procedural.