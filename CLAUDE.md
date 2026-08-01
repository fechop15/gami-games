# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Desarrollo (servidor en http://localhost:3000)
npm run dev

# Build de producción
npm run build

# Lint
npm run lint
```

> El servidor dev debe correr desde el directorio del proyecto (`candy-fiesta/`). Si hay errores de registry npm (Meli internal), el proyecto tiene `.npmrc` apuntando a `https://registry.npmjs.org/`.

---

## Estructura del proyecto

Este repo es **Gami Game** — un catálogo de juegos custom con Next.js App Router.

```
app/
├── page.tsx              ← Home: catálogo de juegos
├── layout.tsx            ← Layout global (título "Gami Game")
├── globals.css
├── lib/
│   └── games.ts          ← Registro de juegos con IDs
├── game/                 ← Juego 001: Candy Fiesta
│   ├── page.tsx
│   ├── GameCanvas.tsx    ← Componente principal (PixiJS)
│   ├── game.css
│   ├── intro.css
│   ├── components/
│   └── hooks/
│       ├── simpleEngine.ts
│       └── useEngine.ts
└── road-rush/            ← Juego 002: Road Rush
    ├── page.tsx
    ├── RoadRushGame.tsx  ← Componente principal (Canvas 2D puro)
    ├── skins.ts          ← Definición de skins
    └── save.ts           ← Persistencia en localStorage

public/
├── cars/                 ← Imágenes de carros (512×960, PNG con alpha)
│   ├── car_1.png … car_9.png
├── pixi.min.js           ← PixiJS v7.4.0 (para Candy Fiesta)
├── gsap.min.js           ← GSAP 3.12.5 (para Candy Fiesta)
├── candy_atlas.png/json  ← Spritesheet de Candy Fiesta
└── candy_bg.jpg
```

### Rutas

| Ruta | Juego | ID |
|---|---|---|
| `/` | Catálogo (home) | — |
| `/game` | Candy Fiesta | 001 |
| `/road-rush` | Road Rush | 002 |

### Registro de juegos (`app/lib/games.ts`)

Para agregar un juego nuevo, añadir una entrada al array `GAMES` con:
- `id`: string de 3 dígitos (`"003"`, etc.)
- `slug`, `title`, `description`, `route`
- `gradient`, `accentColor`, `tags`

---

## Juego 001 — Candy Fiesta (`app/game/`)

Match-3 de candies usando **PixiJS v7** + **GSAP 3**. Ambas librerías se cargan desde `/public/` (no npm) por restricciones del registry interno de MercadoLibre. Se acceden como `(window as any).PIXI` y `(window as any).gsap`.

### Arquitectura

```
page.tsx → GameCanvas.tsx (componente ~1250 líneas)
```

`GameCanvas.tsx` orquesta capas PixiJS:
```
app.stage
├── loadingLayer   (pantalla de carga)
├── introLayer     (intro con burbujas + botón Jugar)
├── gameLayer
│   ├── hudLayer   (nivel, puntaje, movimientos)
│   ├── boardLayer (tiles + sprites de orbs)
│   └── fxLayer    (partículas de explosión)
└── gameoverLayer
```

**Motor (`hooks/simpleEngine.ts`)**: lógica pura sin React ni PixiJS. Tipos especiales: `STRIPPED_HOR/VER`, `BOMB`, `WRAPPED`, `PULSATING`. 8 niveles (board 6×6 → 9×10).

**`hooks/useEngine.ts`**: hook React que consume simpleEngine. Flags críticos `_moduleInitialized` y `_gameActive` son variables de módulo (no `useRef`) — persisten entre remounts.

### Consideraciones críticas

- `reactStrictMode: false` en `next.config.ts` — el doble-mount destruye el canvas PixiJS
- Animar propiedades PixiJS con GSAP: usar `gsap.to(obj.scale, {x:1})` NO `gsap.to(obj, {scaleX:1})`
- `_dragOrb` es variable de módulo — se resetea a `null` en el cleanup del `useEffect` principal
- BOMB swapeada con orb normal apunta al color del **otro** orb, no al propio

---

## Juego 002 — Road Rush (`app/road-rush/`)

Juego endless de carriles. **Canvas 2D puro** — sin dependencias externas. Todo el juego vive en `RoadRushGame.tsx`.

### Arquitectura

```
page.tsx → RoadRushGame.tsx (Canvas 2D, ~1400 líneas)
```

El juego usa un **game loop con `requestAnimationFrame`** y estado mutable en un `useRef<GS>`. No usa React state para la lógica del juego (evita re-renders).

### Fases (`Phase`)

```
"loading" → "intro" → "playing" → "dead"
                ↕                    ↕
              "shop" ←──────────────┘
```

- **loading**: precarga imágenes de carros; muestra barra de progreso
- **intro**: pantalla inicial con botones Jugar y Tienda
- **playing**: juego activo
- **dead**: game over con distancia y monedas ganadas
- **shop**: tienda de skins (todo en canvas, sin React overlay)

### Estado del juego (`GS`)

Campos clave:
- `phase`: fase actual
- `playerLane` / `animLane`: carril objetivo vs fracción animada (lerp)
- `numLanes` / `animLanes`: carriles reales vs fracción animada (transición suave al expandir)
- `speed`: velocidad en px/s (sin límite, aumenta +32 cada 10m)
- `enemies`: array de `{id, lane, y, color}`
- `roadCoins`: monedas coleccionables en pista
- `hasRevive` / `flashTimer`: habilidad especial del skin Chrome
- `loadPct`: progreso de carga (0–1)
- `shopScrollY`: scroll de la tienda

### Spawn de obstáculos

Sistema de formaciones que escala con `gs.milestone` (milestone = cada 10m):

| Formación | Desde nivel | Descripción |
|---|---|---|
| Single | siempre | Carril único con bias anti-repetición (`lastSpawnLane`) |
| Par | nivel 3 | Dos carros adyacentes; revalida entre pushes |
| Diagonal | nivel 8 | Dos carros en carriles distintos, separados por `H × 0.75` |
| Spread | nivel 12 | Carriles alternos |
| Wave | siempre | Bloquea todos menos 1 carril — momento de presión |

**Regla de escape garantizada**: `safeToSpawn()` verifica que siempre quede ≥1 carril libre en la zona de aproximación. Se evalúa después de cada push (no antes del primero).

### Sistema de skins (`skins.ts`)

Cada `Skin` tiene: `id`, `name`, `price`, `bodyColor`, `glowColor`, `accentColor`, `description`, `imageSrc?`, `animStyle?`.

- `imageSrc`: ruta relativa a `/public/` — el juego precarga todas las imágenes en la fase "loading" usando `removeWhiteBg()` para limpiar fondos
- `animStyle: "rainbow"`: activa animación holo en tienda (CSS) y glow arcoiris en canvas (`rainbowGlow(time)`)

**Skin especial — Chrome**: tiene habilidad `hasRevive`. Al chocar con Chrome equipado, en lugar de morir: limpia pantalla, resetea velocidad a `BASE_SPEED`, consume la habilidad. Muestra badge "REVIVE" en HUD.

### Imágenes de carros (`/public/cars/`)

- Formato: PNG con canal alpha, **512×960 px**
- El fondo se elimina en runtime con `removeWhiteBg()` (filtro por saturación + brillo)
- Generadas desde `car_1.png` con rotación de hue via ffmpeg
- `car_1` = Deportivo (cyan), `car_2` = Cyber (circuito), `car_3`–`car_9` = variantes de color

### Save / monedas (`save.ts`)

- Persiste en `localStorage` bajo la clave `"road-rush-save"`
- Campos: `coins`, `unlocked[]`, `activeSkin`, `bestDistance`
- Ganancias: 1 moneda cada 10m recorridos (al morir) + 100 monedas por recolectar monedas en pista

### Inputs

| Input | Acción |
|---|---|
| `← / A` / `→ / D` | Cambiar carril |
| `Space / Enter` | Iniciar / reintentar |
| Tap mitad izquierda | Carril izquierdo |
| Tap mitad derecha | Carril derecho |
| Swipe horizontal ≥ 30px | Dirección del swipe |
| Drag vertical en tienda | Scroll de skins |

### Constantes clave

```typescript
BASE_SPEED    = 260   // px/s inicial
SPEED_STEP    = 32    // +px/s por milestone (sin tope)
MILESTONE     = 10    // metros por milestone
BASE_SPAWN    = 1600  // ms entre spawns inicial
MIN_SPAWN     = 320   // ms mínimo
COIN_SPAWN_MS = 13000 // ms entre monedas (poco frecuentes)
LANE_INTERVAL = 30    // segundos entre expansión de carril
SHOW_ENCOURAGEMENTS = true  // mensajes de ánimo (flag on/off)
```
