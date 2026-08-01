# Bubble Pop — Documentación del Juego

## Concepto
Bubble shooter clásico con grid hexagonal. El jugador dispara burbujas de colores desde abajo y debe conectar 3 o más del mismo color para hacerlas explotar. Las burbujas huérfanas (desconectadas del tope) también caen y puntúan.

## Mecánica central
- Grid hexagonal generado al inicio de cada nivel
- El jugador apunta con mouse/touch y dispara una burbuja
- La burbuja rebota en las paredes laterales
- Al conectar 3+: flood fill del mismo color → explosión y puntos
- Burbujas huérfanas (sin conexión al techo) caen automáticamente → +20 pts cada una
- Burbuja "bomba" (nivel 3+): destruye radio de 2 celdas al aterrizar

## Scoring
| Evento | Puntos |
|---|---|
| Burbuja directa | +10 × combo |
| Burbuja huérfana | +20 |
| Combo ×2 | Segunda explosión seguida |
| Combo ×3/×4 | Tercera/cuarta explosión |

El multiplicador de combo resetea si no se conectan 3+ burbujas en un disparo.

## Progresión (niveles)
| Nivel | Filas | Colores | Bombas |
|---|---|---|---|
| 1 | 5 | 4 | No |
| 2 | 7 | 5 | No |
| 3+ | +1 por nivel | 5 | Sí (8%) |

Para subir de nivel: limpiar todas las burbujas normales del grid.

**Game over**: una burbuja aterriza demasiado cerca de la línea de disparo.

## Controles
| Control | Acción |
|---|---|
| Mover mouse | Apuntar |
| Click | Disparar |
| Touch move | Apuntar |
| Touch end | Disparar |

## Controles táctiles
Todo el juego es 100% jugable con el dedo mediante un único set de handlers `pointer*` (unificado mouse + touch). Las coordenadas se mapean con `getBoundingClientRect()` escalando por `canvas.width/rect.width` para funcionar con el canvas responsive (`width:100%`, `maxWidth:480`, `height:100dvh`).

| Fase | Gesto | Acción |
|---|---|---|
| Onboarding | Tap en cualquier parte (o botón JUGAR) | Iniciar partida |
| Playing | Arrastrar el dedo | Apuntar (actualiza la línea guía) |
| Playing | Soltar el dedo (`pointerup`) | Disparar la burbuja hacia el punto apuntado |
| Playing | Tap botón "?" (arriba der.) | Pausar y mostrar instrucciones |
| Pausa | Tap botón CONTINUAR | Reanudar |
| Todas | Tap botón 🔊/🔇 (esquina sup. der.) | Silenciar / activar sonido |
| Game over | Tap botón "Jugar de nuevo" | Reiniciar sin recargar la página |

- El disparo solo se "arma" (`shootArmed`) si el `pointerdown` empezó jugando y fuera de los botones, evitando disparos accidentales al reiniciar o cerrar overlays.
- Solo se dispara hacia arriba (`dy < 0`); toques hacia abajo se ignoran.
- Teclado (`Space`/`Enter`) queda como extra opcional de escritorio.
- `touch-action: none` + `preventDefault()` evitan el scroll/zoom del navegador durante el juego.

**Flujo de estados**: `loading → onboarding → playing → gameover`, con reinicio 100% táctil (sin recargar). El botón "?" pausa (`paused`) congelando las actualizaciones del juego.

## Sonidos
Efectos sintetizados vía Web Audio (`app/lib/sound.ts`). `unlockAudio()` se llama al inicio de cada handler de puntero/teclado para desbloquear audio en iOS. Solo se disparan en eventos discretos (nunca por frame):

| Evento | SFX |
|---|---|
| Disparar burbuja | `whoosh()` |
| Reventar grupo de 3+ | `pop()` |
| Cadena/combo (n≥2) | `combo(n)` |
| Burbujas huérfanas caen | `coin()` |
| Bomba detonada | `explode()` |
| Subir de nivel | `levelup()` |
| Tap en botones (UI) | `click()` |
| Game over | `gameover()` |

El botón de mute (🔊/🔇) está presente en TODAS las fases (loading, onboarding, playing, gameover) y persiste el estado en `localStorage` (`gami-muted`).

## Assets usados
Precargados desde `/public/games/bubble-pop/` con `loadImages()` durante la fase `loading` (con barra de progreso). Si alguna imagen falla, el juego usa siempre un fallback procedural y nunca bloquea el arranque.

| Asset | Uso |
|---|---|
| `bg.svg` | Fondo del juego vía `drawImage` + overlay oscuro (`rgba(15,10,22,0.42)`) para contraste. Fallback: gradiente procedural. |
| `bomb.svg` | Sprite de las burbujas bomba (grid, proyectil y "próxima"). Fallback: círculo procedural con glifo `✦`. |
| `bubble.svg` | Precargado en el pipeline; las burbujas de color se siguen dibujando de forma procedural (radial gradient + gloss) porque deben teñirse en 5 colores distintos. |
| `icon.svg` | Precargado (ícono del juego para el catálogo). |

## Arquitectura del componente
**Archivo**: `app/bubble-pop/BubblePopGame.tsx`

**Fases**: `"intro"` → `"playing"` → `"gameover"`

**Estado clave (GS)**:
- `grid`: array 2D de burbujas `(Bubble | null)[][]`
- `proj`: burbuja en vuelo (posición + velocidad)
- `nextColor`, `nextIsBomb`: burbuja siguiente
- `aimX`, `aimY`: posición del cursor para la línea guía
- `combo`: contador de explosiones encadenadas

**Funciones clave**:
- `floodFill()`: encuentra todas las burbujas conectadas del mismo color
- `findOrphans()`: BFS desde el techo para detectar burbujas sin conexión
- `snapBubble()`: convierte la posición del proyectil a una celda del grid

## Ideas para iterar
- Agregar modo "Time Attack" con 60s por nivel
- Burbujas con efecto arcoíris que combinan con cualquier color
- Power-up "Sniper" con disparo preciso sin rebote
- Niveles con diseños específicos (corazón, estrella, etc.)
- Animación de entrada del grid (caída desde arriba)
- Sonidos de explosión con Web Audio API
- Preview de los próximos 3 disparos
