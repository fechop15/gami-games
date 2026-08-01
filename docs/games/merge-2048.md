# Merge 2048 — Documentación del Juego

## Concepto
Implementación del clásico 2048 con mecánicas de desbloqueo progresivo. El tablero comienza en 4×4 y se expande a 5×5 al llegar al tile 1024. Se desbloquean poderes especiales (deshacer, pista) al alcanzar ciertos hitos.

## Mecánica central
- Tablero de tiles numéricos (comienza 4×4)
- Deslizar en 4 direcciones mueve todos los tiles
- Tiles del mismo valor que colisionan se fusionan (suma sus valores)
- Al fusionar, se agrega el valor resultante al score
- Después de cada movimiento se añade un tile 2 (90%) o 4 (10%) en una celda vacía
- Game over cuando no hay movimientos posibles

## Poderes desbloqueables (solo en sesión)
| Tile alcanzado | Desbloqueo |
|---|---|
| 256 | ↩ Deshacer (1 movimiento) |
| 512 | 💡 Pista (muestra la mejor dirección calculada por greedy) |
| 1024 | Tablero se expande de 4×4 a 5×5 |
| 2048 | Animación de victoria, puede seguir jugando |

## Scoring
El score se acumula con el valor de cada fusión. Ejemplo: fusionar dos tiles de 64 = +128 al score.

## Progresión
- No hay "niveles" tradicionales — el progreso es el tile máximo alcanzado
- La expansión del tablero a 5×5 es el gran cambio de mid-game
- La meta final es alcanzar 2048 (y seguir más allá)

## Controles
| Control | Acción |
|---|---|
| ← / A | Deslizar izquierda |
| → / D | Deslizar derecha |
| ↑ / W | Deslizar arriba |
| ↓ / S | Deslizar abajo |
| Swipe touch | Dirección del swipe |
| Botones en pantalla | ◀ ▲ ▼ ▶ |

## Controles táctiles
Optimizado para móvil (React/DOM, sin canvas):
- **Swipe**: desliza en cualquier dirección sobre el tablero para mover (`onTouchStart`/`onTouchEnd`, umbral 10px, eje dominante).
- **D-pad en pantalla**: botones ◀ ▲ ▼ ▶ (tap target 60px) siempre visibles bajo el tablero.
- **Teclado**: flechas / WASD (desktop).
- **Botón de sonido 🔊/🔇**: fijo arriba a la derecha (44px), presente en TODAS las fases (loading, intro, playing, win, gameover); alterna mute global vía `toggleMute()`.
- **Botón de ayuda `?`**: fijo arriba a la derecha (44px), visible en intro y playing; abre un modal con objetivo, controles y scoring.
- Contenedores usan `minHeight: 100dvh` y `touchAction: none` para evitar scroll/zoom accidental en móvil.
- `unlockAudio()` se llama en el primer gesto (JUGAR, touchstart, cada movimiento) para desbloquear el audio en iOS.

## Sonidos
Motor compartido `app/lib/sound.ts` (Web Audio, sin archivos). Se reproduce **un solo sonido por movimiento**, por prioridad:
| Evento | Sonido |
|---|---|
| Movimiento con fusión (delta > 0) | `sfx.merge()` |
| Movimiento sin fusión | `sfx.pop()` |
| Swipe/tecla sin movimiento (inválido) | `sfx.error()` |
| Nuevo hito de tile (256 / 512 / 1024) | `sfx.levelup()` |
| Llegar a 2048 (victoria) | `sfx.win()` |
| Game over | `sfx.gameover()` |
| Botones (deshacer, pista, ayuda, reiniciar, seguir) | `sfx.click()` |

El estado de mute se persiste en `localStorage` (`gami-muted`) y se comparte entre juegos.

## Assets usados
Ubicados en `public/games/merge-2048/`. Se precargan con `new Image()` durante la fase `loading` (cada imagen cuenta en `onload` **y** `onerror`, de modo que un 404 nunca bloquea el arranque):
| Archivo | Uso |
|---|---|
| `bg.svg` | Capa de fondo full-screen fija con baja opacidad detrás del tablero |
| `trophy.svg` | Trofeo en el overlay de victoria |
| `sparkle.svg` | Destellos decorativos junto al título de victoria |
| `icon.svg` | Ícono en el encabezado del modal de ayuda |

Fase `loading` como fase inicial: muestra título + barra de progreso (color acento `#f59e0b`) según la fracción cargada; al terminar pasa a `intro`.

## Arquitectura del componente
**Archivo**: `app/merge-2048/Merge2048Game.tsx`

Este juego usa **React state** (useState) en lugar de Canvas 2D, porque el layout de tiles es naturalmente un componente React con CSS Grid. Es la excepción al patrón Canvas del resto de juegos.

**Estado clave (MergeState)**:
- `grid`: `number[][]` — el tablero de tiles
- `size`: 4 o 5 (se expande al llegar a 1024)
- `score`, `prev`, `prevScore`: para deshacer
- `unlocked256/512/1024/2048`: flags de desbloqueo en sesión
- `hintDir`: dirección sugerida por el algoritmo greedy
- `won`: flag de victoria (permite seguir jugando sin re-triggear el overlay)

**Funciones clave**:
- `slideRow()`: merge de una fila hacia la izquierda
- `move(grid, dir)`: aplica slideRow a todas las filas/columnas según dirección
- `canMove(grid)`: verifica si quedan movimientos posibles
- `getBestMove(grid)`: greedy que prueba las 4 direcciones y elige la que más puntos da

## Ideas para iterar
- Animaciones CSS de deslizamiento (transición de tiles)
- Modo "Undo ilimitado" como power-up comprado con puntos acumulados
- Tablero hexagonal como variante
- Modo "Challenge": llegar a 1024 en máx 50 movimientos
- Paleta de colores alternativa (oscura, arcoíris)
- Guardar mejor score en localStorage
- Tile 4096+ con colores animados
