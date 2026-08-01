# Brick Blitz — Documentación del Juego

## Concepto
Breakout/Arkanoid con 15 niveles predefinidos, ladrillos de 1-3 HP, ladrillos irrompibles, power-ups que caen al romper ladrillos y multi-ball. La paleta se controla con mouse o touch.

## Mecánica central
- Pelota rebota libremente; la paleta está fija en la parte inferior
- Ladrillos tienen 1-3 HP (colores: rojo=1HP, naranja=2HP, violeta=3HP)
- Ladrillos grises oscuros son irrompibles (nivel 4+)
- Al nivel 5+: algunos ladrillos se mueven horizontalmente
- Power-ups caen con 20% de probabilidad al romper un ladrillo
- 3 vidas; perder una vida si la pelota cae

## Power-ups
| Ícono | Tipo | Efecto | Duración |
|---|---|---|---|
| 🔵 | Multi-ball | Agrega 2 bolas más | — |
| 🟢 | Wide | Paleta 1.7× más ancha | 10s |
| 🔴 | Speed-down | Bolas a 55% de velocidad | 8s |
| 🟡 | Laser | Destruye los 2 ladrillos más altos | instantáneo |

## Scoring
| Evento | Puntos |
|---|---|
| Ladrillo 1HP | +10 |
| Ladrillo 2HP | +20 |
| Ladrillo 3HP | +30 |
| Bonus tiempo al completar nivel | ms_restantes / 100 |

## Progresión
15 niveles predefinidos:
- Niveles 1-3: layouts simples, solo ladrillos 1HP
- Niveles 4-5: ladrillos irrompibles aparecen
- Niveles 5+: ladrillos se mueven
- Cada nivel: bola inicial con +20 px/s de velocidad

## Controles
| Control | Acción |
|---|---|
| Mouse move | Mover paleta (extra desktop) |
| Arrastrar dedo | Mover paleta (control táctil principal) |
| ← → / A D | Mover paleta (extra desktop) |
| Space / Enter | Iniciar / reintentar / continuar |
| Tap botón | Jugar / Jugar de nuevo / Continuar |

## Controles táctiles
La paleta es **arrastrable con el dedo**: `pointerdown` inicia el arrastre y `pointermove`
fija el centro de la paleta en la coordenada X del toque (limitada a los bordes). Coordenadas
mapeadas con `getBoundingClientRect()` y escaladas por `canvas.width / rect.width`; todos los
handlers hacen `preventDefault()` y `unlockAudio()` al inicio. El botón de **mute** (esquina
superior derecha) se testea primero en cada toque, antes que cualquier otra acción. START y
RESTART son botones tappeables dibujados en canvas (`drawOnboard` / panel de fin de partida).
El botón **"?"** durante el juego pausa la partida (congela las pelotas) y muestra las
instrucciones con botón "CONTINUAR". Mouse hover y teclado (flechas / A-D) quedan como extra de
escritorio.

## Sonidos
Motor compartido `app/lib/sound.ts` (Web Audio, sin archivos). Se desbloquea con `unlockAudio()`
al inicio de cada handler de input.

| Evento | Efecto |
|---|---|
| Rebote de pelota (pared / paleta / ladrillo irrompible / ladrillo con HP restante) | `sfx.hit()` |
| Ladrillo destruido | `sfx.explode()` |
| Recoger power-up | `sfx.powerup()` |
| Completar un nivel | `sfx.levelup()` |
| Ganar (nivel 15) | `sfx.win()` |
| Perder una vida (sin game over) | `sfx.hurt()` |
| Perder todas las vidas | `sfx.gameover()` |
| Botones (jugar, reintentar, continuar, ayuda, mute) | `sfx.click()` |

El botón de mute persiste en `localStorage` (`gami-muted`) y está presente en todas las fases.

## Assets usados
Cargados desde `/games/brick-blitz/` en la fase `"loading"` con `loadImages()` (barra de
progreso vía `gs.loadPct`). Todos tienen fallback procedural.

| Asset | Uso |
|---|---|
| `bg.svg` | Fondo (drawImage a pantalla completa + overlay oscuro sutil) |
| `ball.svg` | Sprite de la pelota (recorte del círculo 176×176 con glow) |
| `paddle.svg` | Sprite de la paleta en color normal (recorte de la barra; procedural verde cuando Wide) |
| `powerup.svg` | Precargado; los power-ups se dibujan procedurales por color/tipo |
| `icon.svg` | Ícono del catálogo |

## Arquitectura del componente
**Archivo**: `app/brick-blitz/BrickBlitzGame.tsx`

**Fases**: `"loading"` → `"onboarding"` → `"playing"` → `"gameover"` | `"win"` (con flag `paused` durante el juego)

**Estado clave (GS - en useRef)**:
- `balls`: array de bolas `{x, y, vx, vy, speed}`
- `bricks`: array con HP, posición, flag de movimiento
- `powerUps`: power-ups cayendo en pantalla
- `paddleX`, `paddleW`, `paddleTargetX`: paleta con lerp
- `wideTimer`, `slowTimer`: timers de power-ups activos
- `levelStartTime`: para calcular bonus de tiempo

**Layouts** (`LEVELS`): array de matrices numéricas donde 0=vacío, 1/2/3=HP, -1=irrompible.

## Ideas para iterar
- Modo "Endless": niveles procedurales infinitos
- Power-up "Magnet": la pelota queda pegada a la paleta, relanzar manualmente
- Power-up "Bomb": la bola destruye todo en radio al impactar ladrillo
- Ladrillos con movimiento vertical
- Jefes: ladrillos especiales de 10HP con patrones de ataque
- Efectos de flash al romper ladrillo de HP alto
- Guardado de progreso en localStorage (nivel actual)
