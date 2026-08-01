# Star Assault — Documentación técnica y de diseño

> Juego 004 del catálogo Gami Game
> Ruta: `/star-assault`
> Tecnología: Canvas 2D puro (sin dependencias externas), Next.js App Router, TypeScript
> Estado: **v2** (combos, power-ups, meta-progresión, modo Endless)

---

## Archivos

```
app/star-assault/
├── page.tsx              ← Wrapper de Next.js (metadata + export)
├── StarAssaultGame.tsx   ← Todo el juego (~2400 líneas)
├── save.ts               ← Persistencia en localStorage (monedas, mejoras, récords)
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

El menú principal (`intro`) ofrece tres entradas: **CAMPAÑA**, **ENDLESS** y **HANGAR**.

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

3 oleadas por mundo. La velocidad de los enemigos escala: `vy_base * (1 + worldId * 0.15)`.

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
| Mover nave | Deslizar dedo (zona de juego, encima del HUD) |
| Disparar | Automático |
| Escudo | Botón 🛡 |
| Cambiar munición | Tocar ícono de munición |
| Power-up | Automático al recoger el drop |
| Silenciar | Botón ♫ SFX (esquina superior derecha) |
| Menús | Tocar botones |

El touch en el HUD (últimos 100px) no mueve la nave. Áreas de botón con padding extra para dedos.

---

## Save / persistencia (`save.ts`)

Clave `"star-assault-save"`. Retrocompatible con saves de v1 (campos nuevos con defaults).

```typescript
interface StarSave {
  worldsCleared: number
  highScores: number[]      // por mundo (0-4)
  coins: number             // moneda del hangar
  bestCombo: number
  endlessBest: number       // mejor oleada endless
  upgrades: ShipUpgrades    // { hp, shieldDur, shieldCd, fireRate, magnet }
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

## Ideas para iteraciones futuras (v3)

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
