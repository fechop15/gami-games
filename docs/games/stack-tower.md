# Stack Tower — Documentación del Juego

## Concepto
Juego de precisión donde el jugador apila bloques que se deslizan horizontalmente. Cada bloque se corta al soltar, quedando solo la parte que se superpone con el bloque anterior. Si el bloque restante es demasiado pequeño, termina el juego.

## Mecánica central
- Un bloque amarillo se desliza de lado a lado automáticamente
- El jugador presiona Space/Enter/Tap para soltarlo
- La parte que sobresale se corta y genera partículas
- La torre crece hacia arriba; la cámara sube automáticamente
- Game over si el overlap resultante es < 5px

## Scoring
| Evento | Puntos |
|---|---|
| Bloque apilado | +10 |
| PERFECT (overlap >90%) | +60 |

## Progresión
- Cada 5 bloques: velocidad del bloque deslizante +15%
- Al llegar a 20 bloques: mensaje "¡Maestro Apilador!" aparece en pantalla
- No hay límite de bloques — la dificultad escala infinitamente

## Controles
| Control | Acción |
|---|---|
| Space / Enter | Soltar bloque |
| Tap / Click | Soltar bloque |

## Arquitectura del componente
**Archivo**: `app/stack-tower/StackTowerGame.tsx`

**Fases**: `"loading"` → `"onboarding"` → `"playing"` → `"gameover"`

**Estado clave (GS)**:
- `tower`: array de bloques ya apilados `{x, width, y, color}`
- `currentX`, `currentWidth`, `currentDir`, `currentSpeed`: bloque activo en movimiento
- `particles`: partículas del corte animadas
- `floatTexts`: textos flotantes de puntuación

## Controles táctiles
Juego 100% jugable solo con toque en celular.
- **Toca la pantalla** (en cualquier parte): suelta el bloque en movimiento.
- **Botón JUGAR** (onboarding) y **Jugar de nuevo** (game over): botones grandes táctiles hit-testeados.
- **Botón "?"** (arriba a la derecha): reabre las instrucciones y pausa el juego; **CONTINUAR** para reanudar.
- **Botón 🔊/🔇** (esquina superior derecha, ≥44px): mute/unmute, visible en todas las pantallas (loading, onboarding, playing, game over).
- Entrada unificada vía `pointerdown` con mapeo de coordenadas por `getBoundingClientRect()`. `Espacio/Enter` queda solo como extra de escritorio.

## Sonidos
Cableados con `app/lib/sound.ts` (`sfx`), `unlockAudio()` en el primer gesto:
- `sfx.pop()` al apilar un bloque normal.
- `sfx.perfect()` en un PERFECT (>90% de alineación).
- `sfx.levelup()` al llegar a 20 bloques ("Maestro Apilador").
- `sfx.gameover()` al fallar el apilado.
- `sfx.click()` en botones (Jugar / reintentar / mute / ?).

## Assets usados
Precargados con `loadImages()` en la fase `loading` (con fallback procedural si fallan):
- `/games/stack-tower/bg.svg` — fondo del juego (con overlay oscuro para contraste).
- `/games/stack-tower/block.svg`, `/games/stack-tower/crown.svg` — precargados para uso decorativo.
- `/games/stack-tower/icon.svg` — ícono de la tarjeta en el catálogo (`app/page.tsx`).

## Ideas para iterar
- Añadir modos: cronometrado (30s para apilar la mayor cantidad)
- Bloques con colores especiales que dan puntos extra
- Power-up "Freeze" que detiene el bloque 2s
- Tema oscuro vs claro con selector
- Leaderboard local con top 5 puntajes
- Bloques de diferente altura en niveles avanzados
- Efecto de temblor de cámara al apilar PERFECT
