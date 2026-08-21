# Galaxy Assault — Progreso

Registro de avance con checkboxes. Marco `[x]` solo lo verificado (lint/build/test manual).

## Fase 1 — Fundaciones compartidas
- [x] `app/lib/math.ts` (clamp, lerp, rand, chance, pick, dist, distSq, angleTo, angleLerp, circleCollide)

## Fase 2 — Assets SVG (`public/games/galaxy-assault/`)
- [x] 24 SVGs generados (lista en GALAXY_ASSAULT.md)
- [x] `core/sprites.ts`: rutas + loadSprites() + drawSprite() (rotación/alpha)

## Fase 3 — Config y núcleo
- [x] `config.json` (map, minimap, player, ships, weapons, npcs, bosses, crates, drops, repairBot, balance)
- [x] `core/types.ts` · `core/constants.ts` · `core/save.ts` (localStorage)

## Fase 4 — Datos
- [x] `data/maps.ts` (M1 + cinturón de asteroides) · `data/ships.ts` · `data/ammo.ts` · `data/items.ts`

## Fase 5 — Motor
- [x] `engine/player.ts` (joystick, colisión asteroides, límites, evasión)
- [x] `engine/enemies.ts` (IA, aggro, spawn infinito, jefes, fase 2, mecánicas cone/minions+laser)
- [x] `engine/combat.ts` (targeting, auto-fire, balas, daño evasión→escudo→casco, drops)
- [x] `engine/crates.ts` (cajas de munición, drops, datos minimapa)
- [x] `engine/index.ts` (makeGS, update orquesta, cámara, respawn)

## Fase 6 — Render
- [x] `render/world.ts` (fondo, grid, asteroides, base, entidades, retícula, balas, cajas, drops, láser jefe, flechas de borde, efectos)
- [x] `render/minimap.ts` (arriba-derecha, con botón ocultar)
- [x] `render/hud.ts` (HP, escudo, evasión, munición, arma, reparar, joystick)
- [x] `render/screens.ts` (intro, base-menu con inventario + naves placeholder, dead)
- [x] `render/index.ts` (drawScreen orquesta)

## Fase 7 — Integración
- [x] `GalaxyAssaultGame.tsx` (canvas 1280×720 + RAF + touch/mouse/teclado)
- [x] `page.tsx` · `input.ts` (joystick + botones + teclas 1-5/R/M/B/Esc) · `audio.ts`

## Fase 8 — Catálogo y docs
- [x] Registro id `"016"` en `app/lib/games.ts`
- [x] `GALAXY_ASSAULT.md` (documentación técnica)
- [x] `PROGRESO.md` (este archivo)

## Fase 9 — Verificación
- [x] `npm run lint` (archivos del juego sin errores; repo tiene 199 errores preexistentes en Candy Fiesta/Road Rush)
- [x] `npm run build` (exit 0, ruta `/galaxy-assault` generada)
- [ ] Prueba manual: intro → playing (joystick, auto-disparo, cajas, base, muerte, respawn) en navegador

## Fase 10 — Pantalla de carga (v1.1)
- [x] Fase `"loading"` precarga los 24 SVGs con barra de progreso real (drawLoading)
- [x] Botón de mute activo durante la carga; tap ignorado hasta terminar
- [x] Transición automática a intro cuando los sprites están listos

## Fase 11 — Mejora de movimiento (v1.2)
- [x] Joystick floating: toca y arrastra en cualquier parte (fuera de botones/HUD)
- [x] La punta de la nave siempre apunta hacia la dirección de movimiento (giro suave con angleLerp)
- [x] Enemigos también orientan su frente hacia donde se mueven (dirToAngle en render)

## Fase 12 — Combate manual y HUD nuevo (v1.3)
- [x] Barra rápida de munición en cuadros abajo-centro (toca para elegir arma, teclas 1-5)
- [x] Barra de vida y escudo sobre la nave del jugador; barra de HP sobre todos los enemigos
- [x] Ataque manual: tap en enemigo = elegir objetivo (aro rojo pulsante + retícula); botón 🔫 DISPARAR (mantener) = disparar hacia él
- [x] La nave apunta con el frente al objetivo mientras dispara (prioridad sobre el movimiento)
- [x] Multitouch: joystick y disparo a la vez con dos dedos

## Fase 13 — Regeneración automática progresiva (v1.4)
- [x] Escudo y casco se reparan solos de forma progresiva solo en zona segura O tras 60s sin recibir daño (regen configurable en config.json)
- [x] El casco repara cuando el escudo está completo (el escudo se prioriza)
- [x] Barra de escudo sobre la nave muestra el progreso hacia la regeneración

## Fase 14 — Ajustes de control y límites (v1.5)
- [x] Joystick restringido a la zona izquierda; el tap en otras zonas selecciona objetivo sin crear joystick
- [x] Efecto visual del escudo al recibir ataque (destello) y al regenerarse (anillo giratorio)
- [x] Tope global de NPCs vivos en el mapa (`balance.maxNpcsOnMap` = 26) para no sobrepoblar

## Checklist de features (checks finos)
- [x] Minimapa arriba-derecha con botón ocultar
- [x] Cinturón de asteroides bloquea al jugador (colisión circular) + enemigos clamp al área jugable
- [x] 5 armas conmutables (x1/x2/x3 + misiles A/B) con munición por cajas aleatorias
- [x] Evasión por velocidad, escudo absorbente (%), robots de reparación
- [x] Spawn infinito configurable (timers + caps) para NPCs y jefes
- [x] Base segura en celda (10,10) con respawn y menú (inventario real + naves placeholder)
- [x] Auto-bloqueo del enemigo más cercano con retícula + barra HP + flechas de borde
- [ ] M2+ multi-universo (pendiente: derrotar jefes para desbloquear)

## Notas / decisiones de sesión
- 2026-08-20: Plan completo aprobado y juego implementado v1 (módulos, SVGs, config central, localStorage, minimapa, asteroides).
- Guardado automático cada 5s en fase de juego (progreso en `"galaxy-assault-save"`).
- Pendiente: prueba manual en navegador + ajuste de balance en `config.json`.