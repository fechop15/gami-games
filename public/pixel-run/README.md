# Pixel Run — Configuración de Niveles

Los mundos del juego se definen en `levels.json`. Puedes agregar o editar mundos aquí sin tocar código TypeScript.

---

## Estructura general

```json
{
  "worlds": [ <WorldDef>, ... ]
}
```

Cada mundo es un objeto `WorldDef`:

| Campo      | Tipo       | Descripción |
|------------|------------|-------------|
| `id`       | `number`   | Índice del mundo (0 = primero). Debe ser secuencial. |
| `name`     | `string`   | Nombre visible en la UI ("Prados", "Cueva", etc.) |
| `theme`    | `string`   | Paleta de colores: `"green"` `"cave"` `"sky"` `"sea"` `"lava"` `"jungle"` `"cloud"` |
| `lW`       | `number`   | Ancho total del nivel en píxeles |
| `gX`       | `number`   | Posición X de la bandera de salida (~`lW - 120`) |
| `startX`   | `number`   | Posición X inicial del personaje (usa `80`) |
| `checks`   | `number[]` | Posiciones X de los checkpoints (máx 2) |
| `plats`    | `PlatDef[]`| Plataformas del nivel |
| `ens`      | `EnemyDef[]`| Enemigos |
| `coins`    | `CoinDef[]`| Monedas coleccionables |
| `spikes`   | `SpikeDef[]`| Pinchos |

---

## Coordenadas: `yOff` (offset desde el suelo)

**Todos los objetos usan `yOff`** en lugar de coordenadas absolutas.  
`y = groundY + yOff` donde `groundY` varía según la pantalla del jugador.

- `yOff: 0` → nivel del suelo
- `yOff: -110` → 110 px por encima del suelo
- Regla práctica: el suelo mide ~80 px de alto, el jugador (~44 px) salta unos 194 px.

---

## PlatDef — Plataformas

```json
{ "x": 200, "yOff": -110, "w": 170, "h": 22 }
{ "x": 400, "yOff": -120, "w": 140, "h": 22, "spd": 70, "rng": 120 }
```

| Campo  | Tipo     | Defecto | Descripción |
|--------|----------|---------|-------------|
| `x`    | `number` | —       | Posición X izquierda de la plataforma |
| `yOff` | `number` | —       | Offset vertical desde el suelo (negativo = arriba) |
| `w`    | `number` | —       | Ancho en píxeles |
| `h`    | `number` | —       | Alto (22 px para plataformas flotantes, 80 px para suelo) |
| `spd`  | `number` | `0`     | Velocidad de movimiento horizontal (0 = estática) |
| `rng`  | `number` | `0`     | Distancia de oscilación desde `x` (solo si `spd > 0`) |

---

## EnemyDef — Enemigos

```json
{ "type": "worm", "x": 390, "yOff": -18, "patL": 200, "patR": 680 }
```

| Campo   | Tipo     | Descripción |
|---------|----------|-------------|
| `type`  | `string` | `"spider"` `"worm"` `"monkey"` `"plant"` `"espin"` |
| `x`     | `number` | Posición X inicial |
| `yOff`  | `number` | Offset vertical (usa la altura del enemigo: worm=-18, spider/espin=-24, monkey=-38, plant=-44) |
| `patL`  | `number` | Límite izquierdo de patrulla |
| `patR`  | `number` | Límite derecho de patrulla |

### Tamaños de enemigos
| Tipo   | Ancho | Alto | `yOff` sobre suelo |
|--------|-------|------|---------------------|
| worm   | 44    | 18   | -18 |
| spider | 30    | 24   | -24 |
| espin  | 30    | 24   | -24 |
| monkey | 28    | 38   | -38 |
| plant  | 26    | 44   | -44 (estático, `patL == patR`) |

> Para enemigos **sobre plataformas**, suma `yOff_plataforma + yOff_enemigo`.  
> Ejemplo: plataforma a `yOff:-100`, monkey → `yOff: -100 + (-38) = -138`.

---

## CoinDef — Monedas

```json
{ "x": 270, "yOff": -160 }
```

Coloca monedas ~40-50 px sobre la plataforma en la que están.

---

## SpikeDef — Pinchos

```json
{ "x": 420, "yOff": 0, "w": 60 }
```

| Campo   | Descripción |
|---------|-------------|
| `x`     | Posición X izquierda del bloque de pinchos |
| `yOff`  | 0 para pinchos en suelo; usa el `yOff` de la plataforma para pinchos flotantes |
| `w`     | Ancho en píxeles (el sistema divide por ~12 para contar pinchos individuales) |

---

## Agregar un mundo nuevo

1. Copia la entrada del último mundo y cambia `id` al siguiente número.
2. Ajusta `theme` a uno de los valores disponibles.
3. Define `lW` (largo del nivel) y `gX` (~`lW - 120`).
4. Agrega plataformas de suelo (`yOff:0, h:80`) con huecos navegables.
5. Agrega plataformas flotantes (`h:22`) a alturas de -80 a -200.
6. Coloca enemigos dentro de los límites de patrulla de su sección.
7. Agrega monedas 40-50 px sobre las plataformas.
8. (Opcional) Agrega pinchos sobre secciones de suelo.
9. Verifica con `npm run build` que TypeScript compile sin errores.

> **Tip de dificultad:** a mayor `id`, el juego se vuelve más difícil automáticamente.  
> Aumenta la cantidad de enemigos, reduce el ancho de plataformas y usa más plataformas móviles.
