# Color Switch — Documentación del Juego

## Concepto
Una bola cae por el centro de la pantalla bajo gravedad. El jugador debe impulsar la bola hacia arriba tocando la pantalla o presionando Space. Los obstáculos son ruedas giratorias divididas en sectores de colores; la bola solo puede pasar por el sector del mismo color que ella. Las estrellas cambian el color de la bola.

## Mecánica central
- La bola cae por el centro horizontal de la pantalla
- Tap/Space aplica un impulso hacia arriba (IMPULSE = -440 px/s)
- La gravedad la jala hacia abajo constantemente
- Los obstáculos son anillos giratorios divididos en N sectores de colores
- Si la bola toca un sector de diferente color → game over
- Si la bola toca el hueco central o está fuera del radio → pasa sin penalización
- Las estrellas doradas entre obstáculos: +5 pts y cambian el color de la bola aleatoriamente

## Scoring
| Evento | Puntos |
|---|---|
| Obstáculo superado | +1 |
| Estrella coleccionada | +5 |

Se muestra la mejor puntuación de la sesión.

## Progresión
| Rango de score | Cambio |
|---|---|
| 0-5 | 2 colores, velocidad lenta |
| 6-10 | 3 colores, más rápido |
| 11+ | 4 colores, giro más rápido, obstáculos alternan dirección |

## Controles
| Control | Acción |
|---|---|
| Space / Enter | Impulso hacia arriba |
| Click / Tap | Impulso hacia arriba |

## Controles táctiles
El juego es 100% jugable con el pulgar en móvil (canvas responsive `width:100%`, `maxWidth:480`, `height:100dvh`, `touchAction:"none"`).

| Gesto | Acción |
|---|---|
| Tap en cualquier parte (durante el juego) | Salto de la bola (impulso hacia arriba) |
| Tap en botón **JUGAR** (onboarding) | Inicia la partida |
| Tap en botón **Jugar de nuevo** (game over) | Reinicia sin recargar la página |
| Tap en botón **CONTINUAR** (pausa) | Reanuda la partida |
| Tap en 🔊 / 🔇 (arriba a la derecha) | Silencia / activa el sonido |
| Tap en **?** (arriba a la derecha) | Pausa y muestra instrucciones |

- Las coordenadas del puntero se mapean al canvas con `getBoundingClientRect()` y el factor `canvas.width/rect.width` (correcto aunque el canvas se escale por CSS).
- El botón de mute se testea **primero** en el handler, en todas las fases.
- Las hit-boxes de los botones on-screen se obtienen del rect que devuelven `drawOnboard`/`drawButton`, evitando desalineación en portrait.
- `preventDefault()` en `pointerdown` evita scroll/zoom accidental; teclado queda como extra de escritorio.

## Sonidos
Efectos sintetizados (Web Audio) vía `../lib/sound`. `unlockAudio()` se llama al inicio de cada handler de input para desbloquear audio en iOS. Sin sonidos por frame.

| Evento | SFX |
|---|---|
| Tap que hace saltar la bola | `sfx.jump()` |
| Anillo superado con el color correcto | `sfx.coin()` |
| Estrella recogida (cambio de color) | `sfx.powerup()` |
| Chocar con el color equivocado / caer | `sfx.gameover()` |
| Botones (jugar, reiniciar, mute, ayuda) | `sfx.click()` |

El estado de mute persiste en `localStorage` (`gami-muted`) y se comparte entre juegos.

## Assets usados
Precargados desde `/games/color-switch/` en la fase `"loading"` con `loadImages()` (barra de progreso vía `gs.loadPct`). Todos tienen fallback procedural si fallan al cargar.

| Asset | Uso |
|---|---|
| `bg.svg` | Fondo de pantalla (`drawImage` + overlay oscuro sutil para contraste). Fallback: gradiente procedural. |
| `star.svg` | Estrellas coleccionables (con glow). Fallback: `drawStar()`. |
| `ball.svg` | Precargado; la bola se dibuja procedural porque su color cambia en runtime. |
| `ring.svg` | Precargado; los anillos se dibujan procedurales (sectores giratorios de color dinámico). |
| `icon.svg` | Ícono del juego para el catálogo. |

## Arquitectura del componente
**Archivo**: `app/color-switch/ColorSwitchGame.tsx`

**Fases**: `"loading"` → `"onboarding"` → `"playing"` → `"gameover"` (con `paused` durante playing para el overlay de ayuda)

**Estado clave (GS - en useRef)**:
- `ballY`, `ballVY`: posición y velocidad de la bola (siempre centrada en X)
- `ballColor`: índice en el array COLORS
- `obstacles`: array con `{y, r, rotation, rotSpeed, numSectors, shape, colorOffset}`
- `stars`: items coleccionables entre obstáculos
- `score`, `bestScore`: puntuación actual y récord de sesión
- `spawnY`: la Y más baja donde aún no se ha creado un obstáculo

**Detección de colisión**: se calcula el ángulo del vector (ballX, ballY) → (cx, cy), se mapea al sector correspondiente y se compara su color con `ballColor`.

**Cámara**: cuando la bola sube por encima del 45% de la pantalla, se desplazan todos los obstáculos y estrellas hacia abajo manteniendo la bola en ese umbral.

**Nuevos obstáculos**: se generan cuando `spawnY` supera -200 (coordenadas de pantalla).

## Ideas para iterar
- Obstáculos con forma de cuadrado rotante (ya preparado con `shape: "square"`)
- Modo "Dual Ball": dos bolas de diferentes colores simultáneas
- Efecto de partículas al recolectar estrellas
- Fondo animado con gradiente que cambia según el color de la bola
- Modo "Reverse Gravity": la bola sube por defecto, tap para bajar
- Obstáculos que se expanden/contraen
- Soundtrack procedural que cambia de BPM con la dificultad
