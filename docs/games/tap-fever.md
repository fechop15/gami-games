# Tap Fever — Documentación del Juego

## Concepto
Círculos de diferentes tipos aparecen en la pantalla con un temporizador visual (el círculo se encoge). El jugador debe tocarlos antes de que expiren. Los círculos rojos son obligatorios (perder vida si expiran). Los combos multiplican los puntos.

## Mecánica central
- Los círculos aparecen en posiciones aleatorias de la pantalla
- Cada círculo tiene un tiempo de vida que se visualiza como un arco que se cierra
- Tocar un círculo antes de que expire: puntos + partículas
- Círculo rojo que expira sin tocar: -1 vida (3 vidas total)
- 3 vidas → game over

## Tipos de círculos
| Color | Tipo | Puntos | Efecto especial |
|---|---|---|---|
| Violeta | Normal | +10 × combo | — |
| Dorado | Golden | +50 × combo | Tiempo extra de vida |
| Rojo | Red | +10 × combo | Pierde 1 vida si expira sin tocar |
| Azul | Blue | +10 × combo | Congela todos los círculos 2s |
| Oscuro (borde punteado) | Fake | -20 pts | ¡No tocar! Aparece desde nivel 5+ |

## Scoring
- Puntos = valor_base × multiplicador_combo
- Combo de 5 seguidos sin fallar: ×2
- Combo de 10 seguidos: ×3
- Fallar (toque perdido o expira normal/rojo): resetea combo

## Progresión
| Nivel | Max círculos simultáneos | Vida del círculo | Intervalo spawn |
|---|---|---|---|
| 1 | 2 | 2s | 1200ms |
| 2-4 | 3 | 1.84s | 1150ms |
| 5+ | 4+ | 1.6s | 1100ms |
| 10+ | 6 | 1.0s | 700ms |
| Máx | 6 | 0.7s | 400ms |

Los círculos "fake" aparecen desde nivel 5.

## Controles
| Control | Acción |
|---|---|
| Tap / Click | Tocar círculo |
| Space / Enter | Iniciar / reintentar / continuar |

## Controles táctiles
El juego es totalmente jugable con toques en pantalla (mobile-first, canvas `maxWidth: 480`, `height: 100dvh`, `touchAction: "none"`).

- **Tocar un círculo**: acción principal de juego. Las coordenadas del `pointerdown` se mapean al espacio del canvas con `getBoundingClientRect()` y el factor `canvas.width / rect.width` (y su equivalente vertical), con `preventDefault()`.
- **Hit-box tolerante**: el radio de toque es `r + 6px` para facilitar el acierto en pantallas pequeñas; coincide con el anillo visible del objetivo.
- **Botón JUGAR** (onboarding): inicia la partida. También se puede tocar en cualquier parte de la pantalla de inicio.
- **Botón Jugar de nuevo** (game over): reinicia sin recargar la página.
- **Botón mute** (🔊/🔇, esquina superior derecha): disponible en TODAS las fases; se testea primero para que no cuente como un toque de juego.
- **Botón ayuda** (?, junto al mute): visible en onboarding y durante el juego; al tocarlo mientras se juega pausa la partida (`paused`) y muestra las instrucciones con el botón CONTINUAR.
- El área del HUD superior (`TOP_HUD = 116px`) está reservada: los círculos nunca aparecen debajo del marcador/vidas ni fuera de pantalla en modo retrato.

## Sonidos
Efectos sintetizados vía `../lib/sound` (Web Audio, sin archivos). `unlockAudio()` se llama al inicio de cada handler de input para desbloquear el audio en iOS. No hay sonidos por frame; todos son por evento.

| Evento | Sonido |
|---|---|
| Toque acertado (normal/azul) | `sfx.pop()` |
| Racha de combo (combo ≥ 3) | `sfx.combo(n)` (tono sube con `n`) |
| Círculo dorado (bonus) | `sfx.perfect()` |
| Tocar círculo fake / expirar normal | `sfx.error()` |
| Círculo rojo expira (pierde vida) | `sfx.hurt()` |
| Game over | `sfx.gameover()` |
| Botones (jugar, reintentar, ayuda, mute) | `sfx.click()` |

## Assets usados
Cargados desde `/games/tap-fever/` durante la fase `loading` con `loadImages()` + barra de progreso (`drawLoading`). Todos tienen fallback procedural si la imagen no carga.

| Asset | Uso |
|---|---|
| `bg.svg` | Fondo del juego (`drawImage` a pantalla completa + overlay sutil oscuro/azul al congelar). Fallback: gradiente violeta procedural. |
| `ring-target.svg` | Arte del objetivo dorado especial (bonus). Fallback: orbe con gradiente radial. |
| `confetti.svg` | Estallido de celebración al tocar un círculo dorado (escala y se desvanece). Fallback: destello amarillo. |
| `bolt.svg` | Icono en el centro del círculo dorado y junto a la pastilla de Combo cuando el multiplicador llega a x3 (fever). Fallback: se omite. |
| `icon.svg` | Icono del juego para el catálogo (no se dibuja en canvas). |

## Arquitectura del componente
**Archivo**: `app/tap-fever/TapFeverGame.tsx`

**Fases**: `"intro"` → `"playing"` → `"gameover"`

**Estado clave (GS - en useRef)**:
- `circles`: array de círculos activos con tipo, vida, posición
- `particles`: partículas de confetti al tocar
- `combo`, `comboMult`: contador de combo y multiplicador actual
- `frozen`, `frozenTimer`: estado de congelamiento (círculo azul)
- `spawnTimer`, `spawnInterval`: control de spawn
- `level`, `maxCircles`, `circleLife`: dificultad dinámica

**Animación de circles**:
- Arco exterior: progreso de `life/maxLife` (de completo a vacío)
- Al tocar: `tapAnim` anima el círculo expandiéndose y desvaneciendo
- El shrink es proporcional al tiempo restante (visualmente claro)

## Ideas para iterar
- Modo "Blind Tap": los círculos son invisibles los últimos 0.3s antes de expirar
- Círculo "Chain": al tocarlo enlaza a otros 2 que también deben tocarse en cadena
- Power-up "Extra Life": aparece raramente como círculo verde estrella
- Diferente forma según tipo: círculo normal, estrella dorada, triángulo rojo
- Modo Endless con ranking de máximo combo
- Vibración haptic (navigator.vibrate) al perder vida en móvil
- Temporizador de cuenta regresiva de 60s como modo alternativo
