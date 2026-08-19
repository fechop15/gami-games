# Star Assault — Documentación técnica y de diseño

> Juego 004 del catálogo Gami Game
> Ruta: `/star-assault`
> Tecnología: Canvas 2D puro (sin dependencias externas), Next.js App Router, TypeScript
> Estado: **v5** (16 mundos, tienda de naves, combos, power-ups, meta-progresión, modo Endless, equipamiento: láseres/escudos/robots, munición guardada, láseres perfectos)

---

## Archivos

```
app/star-assault/
├── page.tsx              ← Wrapper de Next.js (metadata + export)
├── StarAssaultGame.tsx   ← Todo el juego (~3600 líneas)
├── save.ts               ← Persistencia en localStorage (monedas, mejoras, naves, récords)
└── STAR_ASSAULT.md       ← Este documento
```

---

## Arquitectura del componente

El juego es un único componente React (`StarAssaultGame`) que monta un `<canvas>` de **480 × 854 px** (lógico) escalado con CSS para llenar la pantalla del dispositivo:

```
scale = min(vw / 480, vh / 854)
```

El estado del juego vive en `useRef<GS>` (no en `useState`) para evitar re-renders durante el game loop, que usa `requestAnimationFrame`. El canvas escala **uniformemente** (misma proporción X e Y), por lo que las conversiones touch usan un único factor de escala.

### Secciones del archivo (orden de aparición)

| Sección | Descripción |
|---|---|
| Constantes | Dimensiones, velocidades, escudo, combo, power-ups, **helpers de mejoras de nave** (`upMaxHP`, `upShieldDur`, `upShieldCd`, `upFireMult`, `upHasMagnet`) |
| Tipos | `Phase`, `AmmoType`, `EnemyType`, `PowerupKind`, `DropKind`, interfaces de entidades y `GS` |
| Definición de mundos | Array `WORLDS: WorldDef[]` — 5 mundos con oleadas y config de jefe |
| Helpers de entidades | `makeEnemy`, `makeBoss`, `makeStar`, `makeGS`, `spawnFloater`, `spawnShockwave` |
| Spawn | balas del jugador/enemigo, partículas, **drops (munición + power-ups)** |
| Update | orquestador `update` + subsistemas (`registerKill`, `damagePlayer`, combo, power-ups, endless) |
| Draw helpers | naves, balas, drops, fondo, estrellas, HUD, **trail, floaters, shockwaves** |
| Draw phases | intro, world-select, **hangar**, boss-intro, world-clear, gameover, victory |
| Draw frame | `draw` — orquesta con screen shake |
| Input | `handleTap` (touch + mouse) |
| Audio | `SFX.*` — síntesis procedural con Web Audio API + mute |
| Componente | `StarAssaultGame` — setup, game loop, event listeners |

---

## Fases (`Phase`)

```
"intro" ──┬─► "world-select" ─► "playing" ─► "boss-intro" ─► "boss" ─► "world-clear"
          │                        ↑                                        │
          │                        └────────── siguiente mundo ─────────────┘
          ├─► "hangar" (mejoras de nave) ──► vuelve a "intro"
          └─► [ENDLESS] "playing" ⇄ "boss" (mini-jefe cada 5 oleadas, sin fin)

     "gameover" ◄── muerte del jugador     "victory" ◄── jefe 5 derrotado
```

El menú principal (`intro`) ofrece cinco entradas: **CAMPAÑA**, **ENDLESS**, **HANGAR**, **EQUIPAMIENTO** (tienda de equipo) y **NAVES** (tienda de naves).

---

## Estado del juego (`GS`) — campos nuevos de v2

Además de los campos base (posición, HP, munición, oleadas, jefe, escudo…):

| Campo | Descripción |
|---|---|
| `combo` / `comboTimer` | Multiplicador de racha y su temporizador (2.5s) |
| `magnetT` / `overdriveT` | Segundos restantes de los power-ups activos |
| `runCoins` / `lastRunCoins` | Monedas ganadas en la corrida / snapshot para mostrar al morir |
| `isEndless` / `endlessWave` | Bandera de modo endless y número de oleada |
| `floaters` / `shockwaves` / `trail` | Efectos visuales (números flotantes, ondas, estela) |
| `shieldCdMax` | Recarga máxima del escudo del momento (para el arco de progreso, respeta mejoras) |
| `introBtns` / `hangarBtns` | Áreas táctiles de los menús |

---

## Mundos

| ID | Nombre | Enemigos | Jefe | HP jefe |
|---|---|---|---|---|
| 0 | Cinturón Rojo | scout, grunt | Centinela Rojo | 900 |
| 1 | Nebulosa Violeta | stealth, shooter | Espectro Oscuro | 1100 |
| 2 | Enjambre Verde | scout (masa), tank | Reina del Enjambre | 1300 |
| 3 | Singularidad Azul | grunt, tank, shooter | El Devorador | 1500 |
| 4 | Trono Estelar | mezcla élite | El Emperador | 2000 |
| 5 | Corona Helada | grunt, shooter, splitter | La Reina del Hielo | 2300 |
| 6 | Núcleo Ígneo | tank, kamikaze, splitter | El Coloso de Magma | 2600 |
| 7 | El Vacío | mezcla élite | Null, el Aniquilador | 3200 |
| 8 | Bosque Nocturno ⭐ | grunt, splitter, shooter | La Madre Maleza | 3600 |
| 9 | Mar de Mercurio ⭐ | shooter, stealth, splitter | El Leviatán | 4000 |
| 10 | Purgatorio Dorado ⭐ | grunt, shooter, kamikaze | El Inquisidor | 4500 |
| 11 | Fragmentos Carmesí ⭐ | kamikaze, splitter, stealth | La Cosechadora | 5000 |
| 12 | Catedral Fantasma ⭐ | stealth, shooter, splitter | El Obispo | 5500 |
| 13 | Abismo Esmeralda ⭐ | tank, shooter, kamikaze | El Titán Verde | 6200 |
| 14 | Torre del Atardecer ⭐ | mezcla élite | La Vanguardia | 7000 |
| 15 | Infinito ⭐ | mezcla élite final | Amarok, el Último | 8000 |

⭐ = nuevos en la expansión de 16 mundos.

3 oleadas por mundo. La velocidad de los enemigos escala: `vy_base * (1 + worldId * 0.15)`.
El selector de mundos es **desplazable** (arriba/abajo) para acomodar los 16 mundos.

---

## Tipos de enemigos

| Tipo | HP | Vel. Y | Dispara | Puntos | Drop | Daño contacto |
|---|---|---|---|---|---|---|
| `scout` | 40 | 110 | — | 50 | 15% | 12 |
| `grunt` | 90 | 70 | 2800ms | 100 | 25% | 18 |
| `tank` | 240 | 40 | 2000ms | 200 | 40% | 30 |
| `stealth` | 55 | 80 | 2200ms | 120 | 30% | 14 |
| `shooter` | 70 | 50→0 | 1600ms | 150 | 35% | 16 |
| `kamikaze` ⭐ | 30 | 130 (acelera) | — | 130 | 30% | 25 (explota) |
| `splitter` ⭐ | 80 | 60 | — | 160 | 35% | 20 (explota) |
| `mini` ⭐ | 22 | 150 | — | 40 | 10% | 10 (explota) |

⭐ = nuevos en v2.

**Comportamientos especiales:**
- **Scout**: zigzag sinusoidal
- **Stealth**: alterna visible (2.2s) / invisible (1.1s); inmune mientras es invisible
- **Shooter**: baja hasta 28% de pantalla y oscila disparando
- **Kamikaze**: acelera horizontalmente hacia el jugador + gravedad, explota al contacto (estela roja)
- **Splitter**: al morir se divide en 2 `mini` que divergen
- **Colisión cuerpo-a-cuerpo**: TODOS los enemigos dañan al chocar con la nave

---

## Munición

| Tipo | Cadencia | Daño | Especial | Suministro |
|---|---|---|---|---|
| `basic` | 200ms | 26 | — | Infinita |
| `laser` | 460ms | 65 | Penetra enemigos | +15 por drop |
| `spread` | 340ms | 22 × 3 | Abanico ±14° | +20 por drop |
| `missile` | 640ms | 90 | Teledirigido + estela de humo | +10 por drop |

Cadencia efectiva = `FIRE_RATES[ammo] × upFireMult(mejoras) × (overdrive ? 0.6 : 1)`.

---

## Combo (racha de kills)

| Constante | Valor |
|---|---|
| `COMBO_TIMEOUT` | 2.5 s para mantener la racha |
| `COMBO_MAX` | ×8 multiplicador máximo |
| Fórmula score | `points × (1 + combo × 0.25)` |
| Monedas por kill | `max(1, floor(combo / 2))` |

Se **rompe** al recibir daño o al dejar que un enemigo escape por el borde inferior. Se muestra en la esquina superior derecha (color escala: blanco → dorado → rosa) con barra de tiempo. El mejor combo se persiste (`save.bestCombo`).

---

## Power-ups de campo

22% de los drops son power-ups en lugar de munición:

| Power-up | Efecto | Duración |
|---|---|---|
| 🧲 Imán (`magnet`) | Los drops vuelan hacia la nave | 5 s |
| ⚡ Overdrive (`overdrive`) | Cadencia de disparo ×0.6 | 6 s |
| 💣 Bomba (`bomb`) | Limpia todas las balas enemigas + 120 daño a todos los enemigos (200 al jefe) | instantáneo |

Los timers activos se muestran sobre el HUD. La bomba otorga combo/monedas por los enemigos que mata.

---

## Escudo (rebalanceado en v2)

| Parámetro | Valor base | Constante |
|---|---|---|
| Duración | 4 s (+1 por nivel de mejora) | `SHIELD_DURATION` |
| HP absorbible | **60** (era 100) | `SHIELD_MAX_HP` |
| Recarga | **8 s** (−1 por nivel de mejora, mín 3) | `SHIELD_COOLDOWN` |
| Hurtbox activo | **24** (era 40) | `SHIELD_HURTBOX` |

Recurso táctico para un momento clave, no un botón de invulnerabilidad recurrente.

---

## Jefes — mecánicas únicas

Todos tienen 2 fases (fase 2 al 50% HP: mayor cadencia, ataques mejorados, screen shake + `SFX.bossPhase2()`) y **hit-flash** al recibir daño.

- **Centinela Rojo** (M1): ráfaga en cono 3→5 vías + burst circular en fase 2
- **Espectro Oscuro** (M2): teleporta cada 4.5s + láser vertical en fase 2
- **Reina del Enjambre** (M3): invoca scouts + ataque en espiral rotatoria
- **El Devorador** (M4): pulso gravitacional que curva las balas del jugador hacia abajo + anillo de 12 balas
- **El Emperador** (M5): cono 3→5 vías + láser + invoca élites en fase 2
- **La Reina del Hielo** (M6): trío apuntado + anillos de cristal; fase 2 con doble anillo giratorio + láser
- **El Coloso de Magma** (M7): ráfaga radial + bola de magma apuntada; fase 2 invoca kamikazes
- **Null, el Aniquilador** (M8): repertorio combinado (cono 5→7 vías, espiral, láser, élites y teleport)
- **La Madre Maleza** (M9) ⭐: enredaderas apuntadas + siembra de minions + anillo vegetal en fase 2
- **El Leviatán** (M10) ⭐: ráfagas 4→6 vías + barridos de láser frecuentes
- **El Inquisidor** (M11) ⭐: cono 5→7 vías + teleport judicial + bola de juicio en fase 2
- **La Cosechadora** (M12) ⭐: ráfagas radiales 12→16 + libera splitters
- **El Obispo** (M13) ⭐: anillos litúrgicos 1→2 + disparo apuntado + láser y teleport en fase 2
- **El Titán Verde** (M14) ⭐: ráfaga radial + onda expansiva lenta + refuerzos tank en fase 2
- **La Vanguardia** (M15) ⭐: alterna cono / espiral por ataque + láser en fase 2
- **Amarok, el Último** (M16) ⭐: espiral doble + cono 7→9 vías + bola apuntada + láser y élites en fase 2

---

## Modo Endless

Modo separado accesible desde el intro. Reutiliza el spawner con oleadas **procedurales**:

- `endlessDiffMult(wave) = 1 + floor(wave/3) × 0.12` escala HP y velocidad de enemigos
- La piscina de tipos crece con la oleada (scouts → +shooter → +kamikaze → +tank/stealth → +splitter)
- **Mini-jefe cada 5 oleadas** (jefe ciclado con HP escalado; al derrotarlo se reanuda sin terminar)
- El `worldId` cicla por estética de fondo
- Récord de oleada máxima persistido (`save.endlessBest`)

---

## Meta-progresión y Hangar (moonshot)

### Monedas
- Ganadas por kills (según combo) y por derrotar jefes (`50 + worldId × 25`)
- Se **bancan** al save al conquistar un mundo o al morir (`bankCoins`)

### Hangar (`UPGRADE_DEFS`)
Pantalla en canvas con 5 mejoras permanentes de nave:

| Mejora | Efecto | Máx nivel | Costo |
|---|---|---|---|
| Blindaje (`hp`) | +20 HP máximo | 3 | 200 + lvl×150 |
| Escudo+ (`shieldDur`) | +1s de escudo | 3 | 250 + lvl×150 |
| Recarga (`shieldCd`) | −1s recarga escudo | 3 | 250 + lvl×150 |
| Cadencia (`fireRate`) | −8% tiempo de disparo | 3 | 300 + lvl×200 |
| Imán perm. (`magnet`) | Atrae drops siempre | 1 | 600 |

Las mejoras se aplican vía los helpers `up*()` al iniciar cada corrida (`resetRunState`).

### Tienda de naves (`SHIP_DEFS`)
Pantalla accesible desde el intro (botón **🚀 NAVES**). Comprar una nave la equipa automáticamente.

| Nave | Forma | Stats | Precio |
|---|---|---|---|
| Aurora | delta | Equilibrada (base) | Gratis |
| Víbora | interceptor | VEL ×1.25, HP ×0.85 | 800 |
| Juggernaut | tank | VEL ×0.80, HP ×1.50 | 1500 |
| Fénix | jet | VEL ×1.10, HP ×0.80, CAD ×0.85 | 2500 |
| Phantom | phantom | VEL ×1.05, HP ×0.90, CAD ×0.95 + 🧲 imán permanente | 3500 |
| Omega | omega | VEL ×1.15, HP ×1.25, CAD ×0.85 | 6000 |

- Cada nave tiene su propio sprite (`drawShipShape`) y paleta de colores.
- Stats aplicados: velocidad de movimiento (`updatePlayer`), HP máximo (`upMaxHP`), tiempo de disparo (`effectiveFireRate`) y pasivo de imán (`upHasMagnet`).
- `save.shipId` = nave equipada; `save.shipsOwned` = ids compradas.

---

## Equipamiento (`equip-store`) — láseres, escudos y robots (v5)

Pantalla accesible desde el intro (botón **🛠 EQUIPAMIENTO**) con 4 pestañas: **LÁSER**, **ESCUDO**, **ROBOTS** y **MUNICIÓN**. El equipamiento aplica a cualquier nave.

### Láseres (`LASER_DEFS`) — aumentan el daño

| Láser | Nivel | Daño | Precio |
|---|---|---|---|
| Láser Estándar | 1 | ×1.00 | Gratis |
| Láser de Plasma | 2 | ×1.15 | 350 |
| Láser Fotónico | 3 | ×1.32 | 700 |
| Láser de Iones | 4 | ×1.50 | 1200 |
| Láser Taquiónico | 5 | ×1.70 | 2000 |

El daño de **todas las municiones** (`basic`, `laser`, `spread`, `missile`) se multiplica por `laserDmgMult()`.

**Perfección (0-100%)**: cada láser tiene un % de perfección que multiplica aún más el daño (`+0.6%` por punto). Al llegar a **100% el láser es PERFECTO** (bonus extra `+25%`). Se aumenta de dos formas:
- **Drops de jefes**: al derrotar un jefe siempre suelta **núcleos** (2 en campaña, 1 en endless) que dan `+12%` de perfección al láser equipado. Los enemigos también pueden soltar núcleos raramente (`CORE_DROP_CHANCE = 6%`).
- **Tienda**: botón `PERF +10%` en el láser equipado (costo creciente `60 + pct×3`).

### Escudos (`SHIELD_DEFS`) — aumentan el escudo

| Escudo | Nivel | HP absorbible | Duración | Precio |
|---|---|---|---|---|
| Escudo Estándar | 1 | ×1.00 | +0% | Gratis |
| Escudo de Energía | 2 | ×1.25 | +10% | 350 |
| Escudo de Plasma | 3 | ×1.50 | +20% | 800 |
| Escudo Prisma | 4 | ×1.80 | +35% | 1400 |
| Escudo Aegis | 5 | ×2.20 | +50% | 2200 |

Se aplican sobre las mejoras permanentes del Hangar (`upShieldDur`) vía `effShieldMaxHP`/`effShieldDur`.

### Robots de reparación (un solo uso)

- Comprables en la pestaña **ROBOTS** (`🪙 150` cada uno).
- Se activan con el botón **🤖 REPARAR** (esquina superior izquierda del HUD) o la tecla `R` durante la partida.
- Reparan `40%` del HP máximo y se consumen al usarlos.

### Munición guardada

La munición recolectada en las partidas (`laser`, `spread`, `missile`) se **guarda entre partidas** (`save.bankedAmmo`). Al iniciar una corrida se carga el stock bancado (`loadBankedAmmo`) y al terminar (mundo conquistado o game over) el sobrante se guarda (`saveBankedAmmo`). La pestaña **MUNICIÓN** muestra el stock guardado.

---

## Efectos visuales (v2)

| Efecto | Implementación |
|---|---|
| **Hit-flash** | `globalCompositeOperation = "source-atop"` + rect blanco en enemigos; círculo alpha en jefes |
| **Números de daño** | `floaters[]` que suben y se desvanecen (dorados/grandes en combo alto) |
| **Estela de nave** | Últimas 8 posiciones dibujadas como elipses cian con alpha decreciente |
| **Estela de misil** | 1 partícula naranja por frame |
| **Parallax 3 capas** | Estrellas con `layer` 0/1/2 (velocidad, tamaño, brillo distintos); capa cercana con streaks durante el jefe |
| **Ondas de choque** | `shockwaves[]` — anillo que se expande + destello radial en cada muerte |
| **Screen shake** | En impactos, muerte del jefe, fase 2, bomba |

---

## Audio (Web Audio API)

Síntesis procedural sin archivos externos. `_soundMuted` controla el mute global (botón ♫/✕ SFX siempre visible). 15 efectos: disparos, golpes, explosiones, escudo, pickup, intro/fase de jefe, mundo conquistado.

---

## Controles (móvil)

| Acción | Gesto |
|---|---|
| Mover nave | Deslizar dedo (zona de juego, encima del HUD) — horizontal y **vertical** |
| Disparar | Automático |
| Escudo | Botón 🛡 |
| Robot de reparación | Botón 🤖 REPARAR (o tecla `R`) |
| Cambiar munición | Tocar ícono de munición |
| Power-up | Automático al recoger el drop |
| Silenciar | Botón ♫ SFX (esquina superior derecha) |
| Menús | Tocar botones |

El touch en el HUD (últimos 100px) no mueve la nave. Áreas de botón con padding extra para dedos.

**Movimiento vertical**: la nave puede moverse hacia **adelante (arriba)** hasta `PLAYER_MIN_Y = H × 0.38` y hacia **atrás (abajo)** hasta justo encima del HUD (`PLAYER_MAX_Y`), para esquivar balas. El dedo controla ambas coordenadas; las balas del jugador y las colisiones usan `gs.playerY`. La velocidad vertical es `×0.9` de la horizontal para mejor control.

---

## Save / persistencia (`save.ts`)

Clave `"star-assault-save"`. Retrocompatible con saves de v1 (campos nuevos con defaults).

```typescript
interface StarSave {
  worldsCleared: number
  highScores: number[]      // por mundo (0-15)
  coins: number             // moneda del hangar / tienda
  bestCombo: number
  endlessBest: number       // mejor oleada endless
  upgrades: ShipUpgrades    // { hp, shieldDur, shieldCd, fireRate, magnet }
  shipId: string            // nave equipada
  shipsOwned: string[]      // naves compradas
  equipment: EquipmentState // { laserId, shieldId, ownedLasers, ownedShields, laserPerfection, repairBots }
  bankedAmmo: Record<AmmoType, number>   // munición guardada entre partidas
}
```

---

## Constantes clave (balance)

```typescript
PLAYER_SPEED     = 360
SHIELD_DURATION  = 4     SHIELD_MAX_HP = 60    SHIELD_COOLDOWN = 8    SHIELD_HURTBOX = 24
COMBO_TIMEOUT    = 2.5   COMBO_MAX = 8
OVERDRIVE_DURATION = 6   MAGNET_DURATION = 5   OVERDRIVE_MULT = 0.6
FIRE_RATES = { basic: 200, laser: 460, spread: 340, missile: 640 }
// Daño de balas del jugador: basic 26, laser 65, spread 22×3, missile 90
```

---

## Ideas para iteraciones futuras (v5)

### Gameplay
- [ ] **Perks por corrida** — elegir 1-2 pasivas antes de empezar (combo que decae más lento, revive único)
- [ ] **5.ª munición** — plasma de área de efecto
- [ ] **Dificultad seleccionable** en campaña
- [ ] **Logros** persistidos (primer jefe, mundo 5 sin escudo, endless 20+…)

### Enemigos / mundos
- [ ] Tipo `healer` (cura aliados cercanos)
- [ ] Jefe con múltiples puntos débiles destruibles en orden
- [ ] Jefe final con 3 fases

### UX / visual
- [ ] Animación de warp al entrar a un mundo
- [ ] Vibración táctil (`navigator.vibrate()`) en impactos críticos
- [ ] Música de fondo procedural por mundo

### Técnico
- [ ] **Pool de objetos** para bullets/particles/floaters (reducir GC en corridas largas de endless)
- [ ] Mover `WORLDS[]` y `UPGRADE_DEFS[]` a archivos separados (`worlds.ts`, `upgrades.ts`)
- [ ] Modo debug con visualización de hitboxes
```
