# Jump Hero — Documentación del Juego

## Concepto
Plataformero vertical infinito estilo Doodle Jump. El personaje salta automáticamente al tocar cada plataforma. La cámara sube a medida que el jugador avanza. Game over si el personaje cae fuera de la pantalla por abajo.

## Mecánica central
- El personaje salta automáticamente al colisionar con cualquier plataforma desde arriba
- El jugador solo controla el movimiento horizontal
- La cámara sube cuando el personaje supera el 45% superior de la pantalla
- Los bordes son circulares (salir por la izquierda aparece por la derecha)
- Cuanto más alto, mayor es la puntuación (metros = cameraY / 100)

## Tipos de plataformas
| Color | Tipo | Comportamiento |
|---|---|---|
| Verde | Normal | Estática, salto normal |
| Azul | Móvil | Se mueve horizontalmente, +10 pts al pisar |
| Marrón | Rompible | Desaparece tras 1 salto |
| Amarilla | Resorte | Salto muy alto (SPRING_V), +50 pts |
| Gris | Nube | Dura 2 saltos antes de desaparecer |

## Power-ups
| Ícono | Tipo | Efecto |
|---|---|---|
| 🚀 | Jetpack | Vuela hacia arriba 3s con velocidad constante |
| 🛡️ | Escudo | Absorbe 1 caída mortal |

## Scoring
- Altura en metros (1 metro = 100px de camera shift)
- +50 al usar resorte
- +50 al recoger una estrella coleccionable (⭐, con sonido de moneda)
- +10 al pisar plataforma móvil
- La puntuación solo sube, nunca baja

## Progresión
A medida que sube la puntuación (difficulty = min(score/2000, 1)):
- Plataformas más rompibles/nube (pesos ajustados en `makePlatforms()`)
- Menor densidad de plataformas (gap más grande entre ellas)
- Plataformas móviles se mueven más rápido
- Power-ups aparecen con ~15% de probabilidad cada 3 plataformas nuevas

## Controles
| Control | Acción |
|---|---|
| ← / A | Mover izquierda (desktop) |
| → / D | Mover derecha (desktop) |
| Space / Enter | Iniciar / reintentar / continuar |

## Controles táctiles
El movimiento horizontal es **mantener presionado** (hold), no tap suelto:

| Gesto | Acción |
|---|---|
| Mantener mitad izquierda de la pantalla | Mueve al héroe a la izquierda mientras se sostiene |
| Mantener mitad derecha de la pantalla | Mueve al héroe a la derecha mientras se sostiene |
| Soltar el dedo | Detiene el movimiento (`pointerup` / `pointercancel` / `pointerleave`) |
| Tap botón **JUGAR** (onboarding) | Inicia la partida |
| Tap botón **Jugar de nuevo** (game over) | Reinicia sin recargar |
| Tap botón **?** (arriba der.) | Pausa + muestra instrucciones (botón CONTINUAR) |
| Tap botón **🔊/🔇** (arriba der.) | Silencia / activa el sonido |

- Los taps de movimiento **solo** actúan en fase `playing`; nunca disparan el inicio.
- El botón de mute se hit-testea **primero** en todas las fases.
- Coordenadas mapeadas con `getBoundingClientRect()` × `canvas.width/rect.width` para escalar bien en móvil.
- `paused` congela la física (movimiento, gravedad, cámara y partículas quedan detenidos).

## Sonidos
Sonidos sintetizados vía `app/lib/sound.ts` (Web Audio, sin archivos). `unlockAudio()` se llama al inicio de cada handler de input para desbloquear audio en iOS.

| Evento | Efecto |
|---|---|
| Caer/aterrizar en plataforma (normal, móvil, rompible, nube) | `sfx.jump()` |
| Rebotar en resorte / trampolín | `sfx.boost()` |
| Recoger estrella coleccionable | `sfx.coin()` |
| Recoger power-up (jetpack / escudo) | `sfx.powerup()` |
| Escudo absorbe una caída mortal | `sfx.hit()` |
| Caer fuera de la pantalla (game over) | `sfx.gameover()` |
| Botones (jugar, reintentar, help, mute on) | `sfx.click()` |

No se reproduce ningún sonido por frame.

## Assets usados
Precargados en la fase `loading` desde `/games/jump-hero/` con `loadImages()` (barra de progreso `gs.loadPct`). Todos con **fallback procedural** si la imagen no carga:

| Asset | Uso |
|---|---|
| `bg.svg` | Fondo (drawImage + overlay sutil); fallback: gradiente `drawBackground` |
| `hero.svg` | Personaje (con squash & stretch y glow); fallback: cuerpo redondeado con ojos |
| `spring.svg` | Ícono sobre plataformas de resorte; fallback: nub blanco |
| `cloud.svg` | Plataformas tipo nube; fallback: rect redondeado gris |
| `star.svg` | Estrellas coleccionables; fallback: `drawStar()` |
| `icon.svg` | Ícono del juego en el catálogo (no se dibuja en canvas) |

## Arquitectura del componente
**Archivo**: `app/jump-hero/JumpHeroGame.tsx`

**Fases**: `"loading"` → `"onboarding"` → `"playing"` → `"gameover"` (con flag `paused` para el overlay de ayuda)

**Estado clave (GS - en useRef)**:
- `px`, `py`, `pvx`, `pvy`: posición y velocidad del personaje
- `cameraY`: acumulado de cuánto ha subido la cámara (= score * 100)
- `platforms`: array de plataformas con tipo, posición y usos restantes
- `powerUps`: items en el mundo
- `jetpackTimer`, `hasShield`: power-ups activos
- `squash`, `squashTimer`: animación squash & stretch al saltar
- `stars`: fondo parallax con velocidades diferentes

**Loop de plataformas**: cuando hay menos de 20 plataformas, se generan nuevas arriba de la más alta existente. Las plataformas que caen por debajo de la pantalla se eliminan.

## Ideas para iterar
- Plataforma trampolín con animación de resorte
- Enemigos que caminan en plataformas (evitar contacto)
- Modo "Time Trial": subir X metros lo más rápido posible
- Skin del personaje (cambia colores y forma)
- Nube de tormenta que sube amenazante (game over si la alcanza)
- Efectos de partículas al pisar cada tipo de plataforma
- Highscore en localStorage con initials del jugador
