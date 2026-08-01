# Snake Evo — Documentación del Juego

## Concepto
Versión evolucionada del Snake clásico en grid 20×20. Mantiene la mecánica central de comer y crecer, pero agrega niveles, ítems dorados con temporizador, obstáculos estáticos y móviles que escalan con la dificultad.

## Mecánica central
- Serpiente en grid 20×20 que crece al comer comida roja
- Choque con paredes (los bordes son transitables — wrap) ni consigo misma
- Comida normal: aparece en celda aleatoria vacía
- Ítem dorado: aparece cada 10 comidas, dura 5s, da más puntos

## Scoring
| Evento | Puntos |
|---|---|
| Comida normal | +10 |
| Ítem dorado | +50 |

## Progresión
| Cada 5 comidas | Efecto |
|---|---|
| +1 nivel | Velocidad +15% |
| Nivel 5+ | Obstáculos estáticos en tablero |
| Nivel 10+ | Obstáculos se mueven 1 celda cada 3s |

La velocidad máxima es 60ms por movimiento (sin tope explícito).

## Controles
| Control | Acción |
|---|---|
| ← / A | Izquierda |
| → / D | Derecha |
| ↑ / W | Arriba |
| ↓ / S | Abajo |
| Swipe touch | Dirección del swipe |
| Click / Tap | Iniciar / reintentar |

## Controles táctiles
Integración mobile-first sobre un `<canvas>` que ocupa `100dvh` (ancho máx. 480px), con `ResizeObserver` que recalcula el tamaño de celda sin reiniciar la partida.

| Gesto | Acción |
|---|---|
| **Swipe** (arriba/abajo/izq/der, umbral ~20px) | Gira la serpiente en esa dirección |
| Tap corto (<20px) en onboarding | Empieza a jugar (toca en cualquier lado o el botón JUGAR) |
| Tap corto sobre "Jugar de nuevo" | Reinicia tras game over (sin recargar) |
| Tap sobre botón 🔊 (arriba-derecha) | Silencia / activa audio (en todas las fases) |
| Tap sobre botón "?" | Pausa y muestra instrucciones (botón CONTINUAR) |
| Flechas / WASD | Extra de escritorio |
| Space / Enter | Iniciar / reintentar / continuar |

Detalles de implementación:
- `pointerdown` hace hit-test de 🔊 (slot 0) y "?" (slot 1) **primero**; si no, guarda el punto de inicio del swipe.
- `pointerup` calcula `dx`/`dy`: si `|dx|` y `|dy|` < 20px es tap (botones/estado); si no, es swipe → dirección dominante.
- Coordenadas mapeadas con `getBoundingClientRect()` escalando por `canvas.width / rect.width`.
- Se evita el giro de 180° (reversa contra el propio cuerpo) en `setDir()`.
- Fase inicial `"loading"` con barra de progreso mientras precargan los SVG.

## Sonidos
Motor compartido `app/lib/sound.ts` (Web Audio, sintetizado). `unlockAudio()` se llama al inicio de cada handler de input para desbloquear en iOS. Botón de mute persistente en todas las fases (`toggleMute` / `isMuted`, guardado en localStorage).

| Evento | Efecto |
|---|---|
| Comer comida (manzana) | `sfx.pop()` |
| Recoger gema dorada | `sfx.powerup()` |
| Subir de nivel (cada 5 comidas) | `sfx.levelup()` |
| Chocar (contra sí misma / obstáculo) | `sfx.hit()` + `sfx.gameover()` |
| Botones (jugar, reintentar, mute, pausa) | `sfx.click()` |

## Assets usados
SVGs precargados desde `/public/games/snake-evo/` durante la fase `"loading"` (helper `loadImages`), cada uno con fallback procedural si falla la carga.

| Asset | Uso |
|---|---|
| `bg.svg` | Fondo del juego (`drawImage` a pantalla completa + overlay verde sutil). Fallback: gradiente `drawBackground`. |
| `apple.svg` | Comida normal, con pulso de escala y glow rojo. Fallback: orbe rojo pulsante. |
| `gem.svg` | Ítem dorado bonus (temporizado). Fallback: estrella `drawStar`. |
| `head.svg` | Cabeza de la serpiente, rotada hacia la dirección de avance. Fallback: segmento redondeado con ojos procedurales. |
| `icon.svg` | Ícono del juego en el catálogo (no cargado en runtime del canvas). |

## Arquitectura del componente
**Archivo**: `app/snake-evo/SnakeEvoGame.tsx`

**Fases**: `"intro"` → `"playing"` → `"gameover"`

**Estado clave (GS - en useRef)**:
- `snake`: array de celdas `{x, y}[]` (head = index 0)
- `dir`, `nextDir`: dirección actual y siguiente (para buffer de input)
- `food`, `golden`: posición de comida y ítem dorado
- `obstacles`: array de obstáculos `{x, y, moveTimer, dir}`
- `moveTimer`: acumulador de tiempo para sincronizar movimiento
- `speed`: ms entre movimientos (reduce con el nivel)

**Animaciones**:
- Comida: pulso radial (sin de frecuencia 3× la animación general)
- Ítem dorado: glow animado con shadowBlur
- Serpiente: gradiente verde de cabeza a cola

## Ideas para iterar
- Modo "Walls Off" (sin bordes — la serpiente atraviesa paredes, ya implementado)
- Modo "Maze" con paredes fijas en patrones de laberinto
- Power-up "Ghost" que permite atravesar el propio cuerpo 3s
- Power-up "Shrink" que reduce la cola a la mitad
- Multiplicador de puntos por nivel acumulado al morir
- Skins de serpiente (cambia el color del gradiente)
- Sistema de récord persistente en localStorage
