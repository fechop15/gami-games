# Pixel Run — Documentación técnica y de diseño

> Plataformero 2D touch-first con Canvas 2D puro. Sin dependencias externas.
> Ruta: `/pixel-run` | ID en catálogo: `003`

---

## Arquitectura

```
app/pixel-run/
├── page.tsx          ← wrapper Next.js (metadata + export)
└── PixelRunGame.tsx  ← juego completo (~2600 líneas, Canvas 2D)
```

### Flujo de datos

```
useEffect
  ├── resize canvas a viewport
  ├── initGS()        → estado inicial
  ├── loadLevel(0)    → carga nivel 0
  ├── touch handlers  → actualizan gs.tMap
  ├── keyboard handler→ actualizan gs.inp + advancePhase()
  └── game loop (RAF)
        ├── reset inp.L/R = false
        ├── syncKeyboard()   → OR con teclado
        ├── update(gs, dt)
        │     ├── deriveInput()    → OR con touch
        │     ├── física jugador
        │     ├── resolución plataformas
        │     ├── checkEntities()  → enemigos, monedas, pinchos, meta
        │     ├── updateEnemies()
        │     ├── updateProjectiles()
        │     └── cámara lerp
        └── render(gs)
              ├── drawBackground()
              ├── drawPlatform() × n
              ├── drawCheckpoint() × n
              ├── drawGoal()
              ├── drawCoin() × n
              ├── drawEnemy() × n
              ├── drawPlayer()
              ├── drawProjectiles()
              ├── drawParticles()
              ├── drawHUD()
              └── overlays (intro, lvlDone, gameOver, win)
```

---

## Física

| Constante | Valor | Descripción |
|---|---|---|
| `GRAV` | 1400 px/s² | Gravedad |
| `JMP_V` | -700 px/s | Velocidad de salto |
| `WALK_V` | 200 px/s | Velocidad caminando |
| `RUN_V` | 360 px/s | Velocidad corriendo (turbo) |
| `PW × PH` | 32 × 44 px | Bounding box jugador |
| `CAM_LEAD` | 0.37 | Fracción pantalla — jugador al 37% desde izquierda |
| `CAM_LERP` | 0.10 | Suavizado de cámara por frame |
| `COYOTE` | 0.08 s | Coyote time — puede saltar 80ms después de caer |
| `RUN_DUR` | 1.5 s | Duración del turbo tras doble toque |

**Distancias de salto:**
- Caminando: ~194px horizontal
- Corriendo: ~349px horizontal
- Altura máxima: ~175px sobre el suelo

**Colisión plataformas:** X e Y separados. `resolvePlatformsX` empuja lateralmente, `resolvePlatformsY` detecta aterrizaje (prevBottom ≤ platTop) y techo.

**Squash & Stretch:**
- Aterrizaje: scaleX +38%, scaleY -30%, durante 0.14s
- Salto: scaleX -22%, scaleY +38%, durante 0.12s

---

## Controles

### Touch (principal — mobile)
| Gesto | Acción |
|---|---|
| Hold zona izquierda (< 42% pantalla) | Mover izquierda |
| Hold zona derecha (> 58% pantalla) | Mover derecha |
| Swipe arriba (dy < -55, dt < 400ms) | Saltar |
| Doble toque misma zona (< 300ms) | Turbo 1.5s |
| Tap en overlay | Avanzar fase |

**Detección:** `gs.tMap: Map<number, {sx,sy,cx,cy,t}>` — cada touch por ID. Input se resetea cada frame y touch/teclado hacen OR.

### Teclado (opcional — desktop)
| Tecla | Acción |
|---|---|
| `←` / `A` | Mover izquierda |
| `→` / `D` | Mover derecha |
| `↑` / `W` / `Space` | Saltar |
| `Shift` (hold) | Turbo |
| `Enter` / `Space` / `Escape` | Avanzar fase |

---

## Fases del juego

```
intro → playing → lvlDone → [next level] → ... → win
                → dead    → (respawn en último checkpoint)
                → gameOver
```

| Fase | Descripción |
|---|---|
| `intro` | Pantalla inicial con diagrama de controles |
| `playing` | Juego activo |
| `dead` | Animación de muerte (1.5s), luego respawn |
| `lvlDone` | Overlay de nivel completo con estrellas |
| `gameOver` | Sin vidas — tap para reiniciar |
| `win` | Completó los 7 mundos |

---

## Sistema de vidas y checkpoints

- **3 vidas** al inicio
- **2s de invencibilidad** tras recibir daño (parpadeo del personaje)
- **Checkpoints** (bandera estrella): 2 por nivel, posición fija en cada `buildLvlN`
  - Inactivo: estrella amarilla `CK`
  - Activado: estrella verde `✓ OK` con pulso más rápido
  - Al morir: respawn en el último checkpoint activado

---

## Sistema de estrellas

Al completar un nivel se calculan estrellas según monedas recolectadas:

| Condición | Estrellas |
|---|---|
| Completó el nivel | ⭐ |
| ≥ 50% de monedas | ⭐⭐ |
| ≥ 90% de monedas | ⭐⭐⭐ |

Guardado en `localStorage` bajo la clave `"pixel-run-save"`:
```json
{ "stars": [0,0,0,0,0,0,0], "best": 0 }
```

---

## Audio procedural

Sin archivos de audio. Todo generado con `AudioContext` + osciladores:

| Función | Frecuencias | Tipo | Uso |
|---|---|---|---|
| `sfxJump()` | 300→600 Hz | sine | Salto |
| `sfxCoin()` | 880→1760 Hz | sine | Recoger moneda |
| `sfxStomp()` | 180→55 Hz | square | Pisar enemigo |
| `sfxDie()` | 440→110 Hz | sawtooth | Morir |
| `sfxLevel()` | C-E-G-C (fanfarria) | sine × 4 | Nivel completo |
| `sfxStep()` | noise 55ms / lowpass 280Hz | buffer | Pasos |

Los pasos se disparan cada 0.22s (caminar) o 0.14s (turbo).

---

## Personaje — Pixel Run Hero

Dibujado con `ctx.save/scale/restore` — gorro amarillo, overalls amarillo/ámbar, botas marrones.

**Animaciones:**
- Idle: estático
- Run: `afr` alterna 0/1 cada 0.12s — piernas y brazos oscilan ±3px
- Jump: brazos arriba (+6px), sin swing de piernas
- Fall: posición neutral
- Dead: rebota y cae (solo durante fase `dead`)

**Flip:** `ctx.scale(-1,1)` al cambiar de dirección. Squash/stretch se combina con el flip.

---

## Enemigos

### Tipos

| Tipo | Velocidad | Tamaño | Pisable | Especial |
|---|---|---|---|---|
| 🐛 `worm` | 45 px/s | 44×18 | ✓ | Cuerpo segmentado con ondulación, voltea según dirección |
| 🕷️ `spider` | 75 px/s | 30×24 | ✓ | 8 patas articuladas, hilo de seda, colmillos con veneno |
| 🐒 `monkey` | 100 px/s | 28×38 | ✓ | **Salta** periódicamente (cooldown 2.2-4s), cola y brazos animados |
| 🌿 `plant` | 0 (estático) | 26×44 | ✓ (cabeza) | **Escupe semillas** cada ~3s hacia el jugador |
| 🦔 `espin` | 65 px/s | 30×24 | ✗ siempre daña | Púas con gradiente, badge ✕ pulsante |

### Semillas (proyectiles)
- `Projectile: { x, y, vx, vy, life }`
- Velocidad: ±180 px/s horizontal, gravedad suave 400 px/s²
- Vida: 2.2s o hasta impactar al jugador
- Visual: círculo verde con trail y shimmer rotatorio

### Reglas de diseño
- Cada enemigo debe patrullar **dentro** de su sección de tierra
- La `plant` tiene `patL === patR` (no se mueve)
- Los que están en plataformas elevadas tienen `y = platTopY - enemyH`

---

## Mundos — 7 niveles

| # | Tema | Ancho | Paleta |
|---|---|---|---|
| 0 | 🌿 Prados Verdes | 4300px | Cielo azul, colinas verdes, sol |
| 1 | 🦇 Cueva Oscura | 5500px | Negro/marrón, estalactitas, antorchas |
| 2 | ☁️ Mundo Cielo | 6100px | Celeste, islas flotantes, estrellas |
| 3 | 🐠 Mar | 4800px | Azul profundo, corales, peces, burbujas |
| 4 | 🌋 Lava | 5200px | Negro/rojo, embers, grietas con glow |
| 5 | 🌴 Jungla | 5500px | Verde oscuro, lianas, niebla |
| 6 | ⚡ Nubes | 5800px | Celeste claro, relámpagos, mar de nubes |

### Plataformas por tema

| Tema | Suelo | Tope | Decoración |
|---|---|---|---|
| green | Gradiente tierra+pasto | Mechones de hierba | Puntos de tierra |
| cave | Gradiente piedra | Ladrillo con musgo | Musgo en grietas |
| sky | Gradiente azul claro | Nubes en arco | - |
| sea | Gradiente coral-teal | Corales de coral rosa | Algas |
| lava | Gradiente roca volcánica | Grietas con brillo naranja | Bordes glowing |
| jungle | Gradiente madera/corteza | Musgo+tufts | Lianas colgantes |
| cloud | Blanco/azul claro | Nubes esponjosas | Borde azul eléctrico |

### Plataformas móviles
Identificadas visualmente con borde naranja + `◄ ►`. Parámetros: `mkPlat(x, y, w, 22, spd, range)`.

**Bug fix aplicado:** el clamp usaba `dir` ya invertido causando teletransporte. Ahora:
```typescript
const over = p.x - p.origX;
if (Math.abs(over) >= p.rng) {
  p.dir *= -1;
  p.x = p.origX + Math.sign(over) * p.rng; // snap al límite excedido
}
```

### Reglas de diseño de niveles
- **Huecos**: máximo 140-160px para que sean cruzables caminando
- **Pinchos**: siempre sobre tierra sólida, en el centro de cada sección — nunca en huecos ni en zona de aterrizaje
- **Plataformas elevadas**: altura mínima g-110, máxima g-170 (dentro del rango de salto ~175px desde el suelo)
- **Enemigos**: patrol range estrictamente dentro de los límites de su sección de tierra o plataforma

---

## Estructura del Game State (GS)

```typescript
interface GS {
  phase: Phase;           // fase actual del juego
  lv: number;             // nivel 0-6
  lives: number;          // vidas (3 inicial)
  score: number;          // puntaje acumulado
  coins: number;          // monedas totales
  elapsed: number;        // tiempo transcurrido (s)

  // Jugador
  px, py: number;         // posición top-left
  pvx, pvy: number;       // velocidad
  onG: boolean;           // en el suelo
  fR: boolean;            // mirando a la derecha
  ps: PlayerState;        // 'idle'|'run'|'jump'|'fall'|'dead'
  afr, aft: number;       // frame animación y timer
  invT: number;           // invencibilidad (s)
  coyT: number;           // coyote time (s)
  sqT, sqDir: number;     // squash & stretch

  // Nivel
  plats: Platform[];
  ens: Enemy[];
  cns: Coin[];
  sps: Spike[];
  projs: Projectile[];    // semillas de plantas
  gX: number;             // posición X de la meta
  lW: number;             // ancho total del nivel
  theme: Theme;
  gY: number;             // Y del suelo (ch - 70)

  // Checkpoints
  ckX: number;            // X del último checkpoint activado
  ckList: number[];       // X de todos los checkpoints del nivel
  nextCk: number;         // índice del próximo checkpoint

  // Monedas por nivel (para cálculo de estrellas)
  lvlCoins: number;
  totalLvlCoins: number;
  stars: number[];        // [0-3] × 7 niveles

  // Cámara y efectos
  camX: number;
  parts: Particle[];

  // Input
  inp: { L, R, J: boolean };
  runT: number;           // turbo timer (s)
  ltap: { L, R: number }; // timestamps último toque por lado
  tMap: Map<number, TD>;  // touches activos
  stepT: number;          // cooldown pasos

  // UI
  phT: number;            // timer de fase (lvlDone countdown)
  msg, msgT: number;      // mensaje flotante (+100, +200...)
}
```

---

## Ideas para próximas iteraciones

### Gameplay
- [ ] **Checkpoint visual**: animación al activar (estrella que explota con partículas)
- [ ] **Vidas extra**: moneda especial cada N metros que da 1 vida
- [ ] **Power-ups**: estrella de invencibilidad temporal, zapatos de turbo permanente por 10s
- [ ] **Enemigos avanzados**: tortuga (necesita pisarla 2 veces), fantasma (atraviesa plataformas)
- [ ] **Jefe de nivel** (boss): al final de cada 2 mundos, un NPC grande con mecánica especial
- [ ] **Combos**: pisar enemigos en cadena multiplica el puntaje (×2, ×3...)

### Progresión
- [ ] **Tienda entre niveles**: gastar monedas en power-ups o skins
- [ ] **Unlock de mundos**: el mundo siguiente se desbloquea al completar el anterior
- [ ] **Modo time trial**: cronómetro, puntuación por tiempo
- [ ] **Récords**: guardar el mejor tiempo por nivel en localStorage

### Visual / Audio
- [ ] **Skins de personaje**: diferente paleta de colores (ropa azul, roja, negra...)
- [ ] **Música de fondo**: generada con Web Audio API (loop de notas procedurales por tema)
- [ ] **Efectos de clima**: lluvia en jungla, nieve en nubes
- [ ] **Parallax adicional**: capa extra de objetos en segundo plano

### Técnico
- [ ] **Responsive Canvas**: soporte a `devicePixelRatio` para pantallas retina
- [ ] **Modo landscape forzado**: girar pantalla para mejor experiencia en mobile
- [ ] **Pantalla de pausa**: tap en HUD o tecla P
- [ ] **Level editor básico**: drag-and-drop de plataformas y enemigos en modo dev

### Bugs / Deuda técnica
- [ ] Revisar colisión lateral con plataformas (actualmente puede haber clipping en aristas)
- [ ] El monkey en plataformas puede salirse si hay otro enemigo empujando (no hay entity-entity collision)
- [ ] Los proyectiles de la planta no interactúan con plataformas (los atraviesan)
- [ ] `sfxStep` no suena en iOS por política de autoplay (requiere user gesture explícito)

---

## Cómo agregar un nuevo nivel

1. Definir la función `buildLvlN(g: number): LvlData`
2. Escoger un `theme` nuevo o existente
3. Dibujar el fondo en `drawBackground()` con el nuevo case
4. Dibujar las plataformas en `drawPlatform()` con el nuevo case
5. Actualizar el dispatch en `loadLevel()`:
   ```typescript
   : lv === N ? buildLvlN(g)
   ```
6. Cambiar la condición de victoria:
   ```typescript
   if (next >= N+1) gs.phase = 'win';
   ```
7. Actualizar el array de estrellas en `initGS` y `loadSave`
8. Actualizar el texto del HUD y la pantalla de intro

**Checklist de diseño del nivel:**
- [ ] Huecos ≤ 160px
- [ ] Pinchos sobre tierra sólida (no en huecos)
- [ ] Plataformas a altura g-110 a g-170
- [ ] Enemigos con patrol dentro de su sección
- [ ] 2 checkpoints distribuidos (~33% y ~66% del nivel)
- [ ] Meta al final con espacio para aterrizar

---

## Cómo agregar un nuevo enemigo

1. Agregar el tipo a la unión: `type: '...' | 'newEnemy'`
2. Agregar dimensiones y velocidad en `mkEnemy`:
   ```typescript
   const dims = { ..., newEnemy: [W, H] };
   const spds = { ..., newEnemy: VX };
   ```
3. Dibujar en `drawEnemy()` con un nuevo `else if (e.type === 'newEnemy')` — el flip horizontal con `ctx.scale(-1,1)` se debe incluir si tiene orientación
4. Definir comportamiento en `updateEnemies()`:
   - Si camina: patrol estándar
   - Si vuela: `e.vy` sinusoidal
   - Si es estático: saltar el bloque de movimiento
5. Definir colisión en `checkEntities()` — si NO es pisable, agregar:
   ```typescript
   if (e.type === 'newEnemy') { loseLife(gs); return; }
   ```

---

---

## Changelog v2 — Pack de mejoras (10 features)

**Mecánicas**
1. **Pausa** — botón ❚❚ en el HUD (o `P`/`Esc`); overlay con Continuar / Menú
2. **Salto variable** — touch: fuerza según magnitud del swipe (0.62–1.0); teclado: recorte al soltar (hold-cut)
3. **Rebote en cadena** — pisar enemigos consecutivos (ventana 0.7s) multiplica puntos: COMBO x2, x3…
4. **Power-up estrella** — moneda especial giratoria (1 por nivel, al centro); 6s de invencibilidad arcoíris que destruye enemigos; barra en HUD

**Visual / polish**
5. **Hit-stop + flash** — congelamiento de 0.05–0.09s + flash de pantalla (blanco al recibir daño, naranja al pisar)
6. **Transición entre mundos** — fade a negro con icono + nombre del mundo destino
7. **Partículas temáticas** — `THEME_PARTS` da colores por mundo en monedas y stomps
8. **Animación de entrada** — el personaje cae desde arriba con nube de polvo al aterrizar (input bloqueado ~1.4s)

**Progresión / retención**
9. **Skins** — 4 skins (Clásico, Ninja, Pirata, Astronauta) con `SKINS[]`; tienda accesible desde el menú; wallet de monedas **persistente** en localStorage
10. **Racha diaria** — `streak` + `lastDay`; bonus a los 3/7/14 días (+50/+150/+500 monedas)

**Cambios de datos**
- `Save` ahora incluye `coins`, `owned`, `skin`, `streak`, `lastDay` (monedas persisten entre sesiones)
- `Phase` añade `'shop'` y `'transition'`
- Nuevos sfx: `sfxPower`, `sfxBuy`, `sfxCombo`
- Hit-regions compartidas (`pauseBtnRect`, `shopBtnRect`, `skinCardRect`, etc.) entre render y handlers

---

*Última revisión: sesión de desarrollo iterativo 2026-07-31*
