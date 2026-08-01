# Fruit Slash — Documentación del Juego

## Concepto
Las frutas vuelan hacia arriba desde la parte inferior de la pantalla. El jugador arrastra el dedo/mouse para cortar las frutas en el aire. Las bombas deben evitarse. Los combos y frutas especiales multiplican el puntaje.

## Mecánica central
- Frutas (🍉🍊🍋🍇🍓) lanzan desde abajo con ángulos y velocidades aleatorias
- El jugador arrastra para trazar una línea de corte
- Al cortar una fruta: se divide en 2 mitades con física de caída
- Al cortar una bomba 💣: pierde 1 vida
- Fruta sin cortar que cae: pierde 1 vida (máx 3 caídas = game over)
- Bombas que caen sin cortar: no penalizan

## Frutas especiales
| Fruta | Efecto |
|---|---|
| 🍌 Banana dorada | ×3 puntos (isGolden = true) |
| 🍍 Piña | Onda de área: corta todas las frutas en pantalla |
| 💣 Bomba | -1 vida al cortarla |

## Scoring
- Base: +10 por fruta cortada
- Combo: cortar 3+ frutas con el mismo gesto continuo
  - 3+ frutas en el gesto: ×2
  - Gesto posterior con 3+: ×3 (si el timer de combo aún activo)
  - Máximo: ×4
- Banana dorada: base ×3 antes del multiplicador de combo

## Progresión
| Tiempo | Cambio |
|---|---|
| 0-30s | Spawn normal, pocas bombas |
| Cada 30s | `spawnInterval` reduce ~8ms/s (mínimo 500ms) |
| 60s+ | Frutas en zigzag (vx alterna cada 0.3s) |
| Con el tiempo | Más bombas (P(bomba) crece hasta 25% máx) |

## Controles táctiles
El juego usa **Pointer Events** (unifican touch + mouse). El canvas tiene
`touchAction: "none"` y los handlers llaman `preventDefault()` para evitar
scroll/zoom en mobile.

| Control | Acción |
|---|---|
| Arrastrar el dedo (touch) | Traza la línea de corte; corta toda fruta que toca el trazo |
| `pointerdown` → `pointermove` | Construye el trail del corte y testea intersección con frutas |
| Tap en botón **JUGAR** (onboarding) | Inicia la partida |
| Tap en botón **Jugar de nuevo** (game over) | Reinicia sin recargar |
| Tap **?** (arriba der.) | Pausa + muestra instrucciones; botón **CONTINUAR** reanuda |
| Tap **🔊/🔇** (arriba der.) | Silencia/activa el sonido (todas las fases) |
| Mouse + drag (desktop) | Mismo corte, como extra de escritorio |
| `Space` / `Enter` | Iniciar / reintentar / reanudar |

Mapeo de coordenadas: `getBoundingClientRect()` con escala
`canvas.width / rect.width` (y análogo en Y) para que el corte sea preciso con
el canvas responsive (`width: 100%`, `maxWidth: 480`, `height: 100dvh`).

## Sonidos
Motor compartido `app/lib/sound.ts` (Web Audio sintetizado, sin archivos).
`unlockAudio()` se llama al inicio de cada handler de input (requisito iOS).

| Evento | Sonido |
|---|---|
| Cortar una fruta | `sfx.slice()` |
| Encadenar varias frutas en un mismo gesto | `sfx.combo(n)` (tono ascendente según n) |
| Cortar 🍌 banana dorada | `sfx.coin()` |
| Cortar 🍍 piña (onda) | `sfx.powerup()` |
| Cortar 💣 bomba | `sfx.explode()` + `sfx.hurt()` (o `sfx.gameover()` si es la última vida) |
| Perder fruta que cae | `sfx.hurt()` (o `sfx.gameover()` si es la última vida) |
| Fin de partida | `sfx.gameover()` |
| Botones (jugar, ayuda, mute, reintentar) | `sfx.click()` |

No hay sonidos por frame; todos se disparan por evento.

## Assets usados
Cargados desde `/games/fruit-slash/` en la fase `"loading"` con
`loadImages(...)` (barra de progreso vía `gs.loadPct`). Todos tienen fallback
procedural, así que el juego funciona aunque un SVG falle.

| Asset | Uso |
|---|---|
| `bg.svg` | Fondo (drawImage + overlay sutil); fallback: gradiente lima nocturno |
| `watermelon.svg` | Sprite de la sandía (fruta índice 0); fallback: emoji 🍉 |
| `orange.svg` | Sprite de la naranja (fruta índice 1); fallback: emoji 🍊 |
| `bomb.svg` | Sprite de la bomba; fallback: emoji 💣 |
| `splash.svg` | Salpicadura de jugo al cortar; fallback: círculo de color |
| `icon.svg` | Ícono del juego (precargado; usado en el catálogo) |

Las frutas 🍋🍇🍓, 🍌 y 🍍 se dibujan con emoji (sin sprite dedicado).

## Arquitectura del componente
**Archivo**: `app/fruit-slash/FruitSlashGame.tsx`

**Fases**: `"loading"` → `"onboarding"` → `"playing"` → `"gameover"`
(con flag `paused` para el overlay de ayuda durante el juego)

**Patrón mobile**: canvas responsive + `ResizeObserver` (redimensiona el buffer
sin resetear la partida en curso); limpieza del `useEffect` cancela el rAF,
quita los listeners y hace `ro.disconnect()`.

**Estado clave (GS - en useRef)**:
- `fruits`: array de frutas con física `{x, y, vx, vy, r, emoji, isBomb, zigzag…}`
- `halves`: mitades de frutas cortadas con física y rotación
- `slash`: trayectoria actual del gesto `{points[], life}`
- `combo`, `comboTimer`: contador de combo con timer de reset
- `elapsed`: tiempo total jugado en segundos
- `spawnInterval`: ms entre spawns (decrece con el tiempo)

**Detección de corte**: en cada `pointermove` se verifica si alguna fruta está dentro de `fruit.r + 8` de la posición actual del puntero.

## Ideas para iterar
- Modo "Endless Zen": sin bombas, sin vidas, solo puntuación máxima
- Fruta "Reloj": congela todas las frutas 2s al cortarla
- Multiplicador por racha de cortes sin perder fruta
- Efecto de cámara lenta al cortar banana dorada
- Sonidos: whoosh al cortar, sploosh al cortar sandía
- Ranking de mejores puntajes en sessionStorage
- Visual de "jugo" que salpica según el tipo de fruta
