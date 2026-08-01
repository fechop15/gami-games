# Gravity Ball — Documentación del Juego

## Concepto
Juego de física con 20 niveles. El jugador guía una bola con gravedad hacia un portal de salida verde. El nivel genera obstáculos proceduralmente usando una semilla determinista, garantizando que cada nivel sea siempre el mismo. Un joystick virtual permite control táctil.

## Mecánica central
- La bola tiene `vx`, `vy` con damping (0.985^(dt×60)) y gravedad hacia abajo
- El jugador aplica fuerzas en 4 direcciones (flechas/WASD o joystick)
- Al tocar un pico (spike): muere y reaparece en el inicio del nivel, -100 pts
- Al tocar zona anti-gravedad (púrpura): la gravedad se invierte (hacia arriba)
- Al tocar zona de velocidad (azul): velocidad ×1.4 momentánea
- Al tocar portal (verde claro): teletransporta a la posición del portal destino
- Llegar al EXIT (círculo verde grande): pasa al siguiente nivel

## Scoring
| Evento | Puntos |
|---|---|
| Score inicial por nivel | 1000 |
| Cada 60 frames en el nivel | -1 pt |
| Bonus "sin muertes" en el nivel | +500 |
| Acumulado entre niveles | Suma al totalScore |
| Muerte | -100 pts (mínimo 0) |

## Progresión (20 niveles procedurales)
| Niveles | Características |
|---|---|
| 1-5 | Solo paredes (wall), sin elementos especiales |
| 6-10 | Zonas anti-gravedad (antigrav) |
| 11-15 | Picos (spike) + zonas de velocidad (speed) |
| 16-20 | Portales de teletransporte + todo mezclado |

La cantidad de obstáculos escala: `3 + level_index` tiles generados.

**Checkpoint**: cada 5 niveles se guarda el índice en `sessionStorage` ("gb_checkpoint") para reanudar desde ese punto.

## Controles
| Control | Acción |
|---|---|
| ← / A | Fuerza izquierda |
| → / D | Fuerza derecha |
| ↑ / W | Fuerza arriba |
| ↓ / S | Fuerza abajo |
| Joystick virtual flotante | Control táctil principal (ver "Controles táctiles") |

## Arquitectura del componente
**Archivo**: `app/gravity-ball/GravityBallGame.tsx`

**Fases**: `"loading"` → `"onboarding"` → `"playing"` → `"win"` | `"gameover"`
(el flag `paused` congela la física al abrir la ayuda "?" durante el juego).

**Estado clave (GS - en useRef)**:
- `bx`, `by`, `vx`, `vy`: posición y velocidad de la bola
- `gravDir`: 1 (hacia abajo) o -1 (hacia arriba, en zona antigrav)
- `level`: objeto `{tiles, start, exit, bg}` generado por `makeLevel()`
- `levelIdx`: índice del nivel actual (0-19)
- `score`: puntuación del nivel actual (regresa a 1000 en cada nivel)
- `totalScore`: suma acumulada de todos los niveles
- `loadPct`: progreso de precarga de assets (0–1) para la pantalla de carga
- `joyActive/joyId/joyBaseX/joyBaseY/joyDx/joyDy`: estado del joystick virtual flotante
- `portalCd/speedCd`: cooldowns que evitan reactivar portal/turbo cada frame
- `keys`: Set de teclas actualmente presionadas (extra de escritorio)

## Controles táctiles
El control principal es un **joystick virtual flotante** (totalmente jugable con el dedo):
- `pointerdown` en el área de juego fija la **base** del joystick en ese punto y lo activa.
- `pointermove` mueve el **knob**; el offset se normaliza y se clampa al radio `JOY_R` (46 px). El vector resultante (`joyDx`, `joyDy` en `[-1,1]`) se multiplica por `FORCE` y se aplica como aceleración cada frame.
- `pointerup`/`pointercancel` recentra el knob y pone la entrada en cero.
- Las coordenadas se mapean con `getBoundingClientRect()` (`*canvas.width/rect.width`) y se usa `preventDefault()` + `setPointerCapture`.
- Los botones **mute** (`iconButtonRect(W,0)`) y **ayuda "?"** (`iconButtonRect(W,1)`) se testean ANTES de tratar el pointer como joystick.
- START / RESTART / CONTINUAR son botones tocables en canvas (rect de `drawOnboard` y del panel de fin).
- Teclado (flechas / WASD, Espacio/Enter) se mantiene como extra opcional de escritorio.

## Sonidos
Motor compartido `app/lib/sound.ts` (`sfx`, `unlockAudio`, `toggleMute`, `isMuted`). Se llama `unlockAudio()` al inicio de cada handler de input. Sin sonidos por frame (con gating por umbral/cooldown):
- `sfx.hit()`: rebote contra pared (solo si el impacto supera 150 px/s).
- `sfx.whoosh()`: entrar a un portal de teletransporte (cooldown 0.5 s).
- `sfx.powerup()`: recoger zona de turbo (cooldown 0.4 s).
- `sfx.coin()`: entrar a zona anti-gravedad (solo al invertir la gravedad).
- `sfx.levelup()`: avanzar de nivel al llegar a la meta.
- `sfx.win()`: completar el nivel 20 (victoria final).
- `sfx.explode()` + `sfx.hurt()`: chocar con un pico (pérdida de puntos + reaparición).
- `sfx.click()`: botones (JUGAR, CONTINUAR, reintentar, mute/ayuda).

## Assets usados
Cargados desde `/games/gravity-ball/` con `loadImages()` durante la fase `"loading"` (todos con fallback procedural):
- `bg.svg`: fondo (drawImage + overlay oscuro sutil; fallback gradiente `bgStops`).
- `ball.svg`: la bola (fallback orbe con gradiente radial; en anti-gravedad se superpone un tinte morado).
- `portal.svg`: tiles de teletransporte (fallback círculo cian).
- `spike.svg`: picos, estirado sobre el rect del tile (fallback triángulos procedurales).
- `flag.svg`: la meta/salida (fallback anillo indigo pulsante con etiqueta "META").
- `icon.svg`: ícono del catálogo (no se dibuja en canvas).

**Generación de niveles** (`makeLevel(i, W, H)`):
Usa una función `rng(n)` basada en `Math.sin` con semilla `i*137.5` para generar posiciones deterministas. Así cada ejecución produce el mismo nivel para el mismo índice.

## Ideas para iterar
- Editor de niveles: drag & drop de tiles en el canvas
- Niveles diseñados a mano (con arrays hardcodeados) para los primeros 5
- Modo speedrun: tiempo total de todos los niveles sin muertes
- Física mejorada: rebote real contra paredes (actualmente push-out simple)
- Bola con skin: pelota de fútbol, planeta, etc.
- Obstáculos que se mueven (plataformas móviles)
- Recolectables (estrellas) para boost de score dentro del nivel
- Modo "Minimal Gravity": damping muy alto, casi sin fricción
