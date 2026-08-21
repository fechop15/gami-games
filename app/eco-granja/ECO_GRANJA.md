# EcoGranja — Documentación técnica y de diseño

> Juego 015 del catálogo Gami Game
> Ruta: `/eco-granja`
> Tecnología: Canvas 2D puro (sin dependencias externas), Next.js App Router, TypeScript
> Estado: **v1** (granja viva: siembra, cría, pesca, mercado, impuestos, empleados, clima y ecosistema dinámico)

---

## Archivos

```
app/eco-granja/
├── page.tsx              ← Wrapper de Next.js (metadata + export)
├── EcoGranjaGame.tsx     ← Componente React: canvas, game loop y eventos touch/mouse (~250 líneas)
├── config.json           ← Balance y catálogos: cultivos, animales, peces, productos, clima, fauna, decoraciones, personal y extras
├── types.ts              ← Tipos compartidos (Phase, GS, entidades, etc.)
├── constants.ts          ← Constantes derivadas de config (dimensiones, costes, helpers de calidad/raza)
├── save.ts               ← Persistencia en localStorage (granja, inventario, fama, personal, estadísticas)
├── engine.ts             ← Lógica de juego: ciclo de día, cultivos, animales, estanques, impuestos, salarios, fauna, cría, pesca
├── draw.ts               ← Render del mundo: cielo por clima, parcela, cultivos, animales, estanques y efectos de clima
├── ui.ts                 ← HUD, nav inferior, hoja de parcela/cría, tienda, mercado, personal, ecosistema y modales
├── input.ts              ← handleTap (touch + mouse) y acciones por prefijo de botón
└── ECO_GRANJA.md         ← Este documento
```

---

## Arquitectura

Misma filosofía que Star Assault: **módulos por responsabilidad** y un componente React delgado que monta un `<canvas>` de **480 × 854 px** (lógico) escalado con CSS, corre el game loop (`requestAnimationFrame`) y los event listeners.

| Módulo | Responsabilidad |
|---|---|
| `config.json` | Catálogos y balance (todo ajustable sin tocar TS) |
| `save.ts` | Persistencia y saneamiento de la partida (`localStorage`) |
| `engine.ts` | `update`, `endOfDay` y todas las acciones del jugador |
| `draw.ts` | Mundo (grid, cultivos, animales, estanques) + clima |
| `ui.ts` | HUD, navegación, paneles y modales |
| `input.ts` | `handleTap` → rutas de acción |

El estado vive en `useRef<GS>`. El canvas escala uniformemente, por lo que las conversiones touch usan un único factor.

---

## Fases (`Phase`)

```
"intro" ──► "farm" ──► (pestañas) "shop" | "market" | "staff" | "eco"
```

- **Intro**: tarjeta de onboarding con botón COMENZAR.
- **Farm**: el hub. El área central muestra la cuadrícula de parcelas (desplazable) y la hoja inferior contextual por parcela.
- **Shop**: desbloquea especies (fama) y compra decoraciones/extras/expansión.
- **Market**: vende el inventario (con calidad) y "VENDER TODO".
- **Staff**: contrata/despide empleados.
- **Eco**: estado del clima, fauna (beneficios/perjuicios) y estadísticas.

Nav inferior siempre visible en fases de juego para cambiar rápido.

---

## La cuadrícula

- 5 columnas fijas; filas de 5 expandibles hasta **12** (`🚜 Expandir granja`, coste creciente).
- Cada celda puede ser **tierra** (cultivo), **pastizal** (animal) o **estanque** (peces). Convertir una parcela cuesta monedas (cavar estanque `$60`, preparar pastizal `$80`); volver a tierra es gratis.
- Scroll vertical de la granja cuando hay más filas de las visibles.

### Cultivos
| Especie | Fama | Crecimiento | Rendimiento | Venta |
|---|---|---|---|---|
| Trigo 🌾 | 0 | 2d | 3 | $8 |
| Zanahoria 🥕 | 200 | 3d | 4 | $11 |
| Maíz 🌽 | 600 | 4d | 4 | $16 |
| Tomate 🍅 | 1500 | 5d | 5 | $22 |
| Fresa 🍓 | 3500 | 6d | 6 | $32 |
| Café ☕ | 8000 | 8d | 6 | $55 |
| Trufa 🍄 | 18000 | 10d | 4 | $140 |

- **Regar** 💧 (gratis) multiplica el crecimiento; la lluvia/tormenta riega todo.
- **Calidad 1-5**: riego ≥70% de los días, abono ✨, abejas 🐝 y lluvia suben la calidad. Más calidad = más precio al vender (`+35%` por nivel).
- **Clima adverso**: helada congela cultivos sin regar, la sequía los marchita, la tormenta los daña.

### Animales (pastizal)
| Especie | Fama | Compra | Producto | Cadencia | Comida/día |
|---|---|---|---|---|---|
| Gallina 🐔 | 0 | $60 | 🥚 Huevo | 2d | $5 |
| Oveja 🐑 | 400 | $150 | 🧶 Lana | 4d | $8 |
| Conejo 🐇 | 900 | $220 | 🧵 Piel | 3d | $6 |
| Cabra 🐐 | 2000 | $300 | 🥛 Leche de cabra | 3d | $10 |
| Vaca 🐄 | 6000 | $550 | 🥛 Leche | 3d | $15 |
| Cerdo 🐖 | 12000 | $700 | 🥓 Carne | 5d | $12 |

- Cada animal paga **comida** al cierre del día; sin dinero baja la felicidad y puede **escapar**.
- **Felicidad** (0-100) acelera la producción.
- **Cría 🐣**: con un segundo ejemplar de la misma especie en otro pastizal puedes intentar una **raza +1** (hasta raza 5). La raza multiplica el precio de los productos y el valor de venta del animal.

### Estanque / pesca
- Siembra **alevines** de una especie desbloqueada (`$15-$150`) y el stock se regenera (máx 5, +1/día).
- **Minijuego de pesca**: barra con zona dorada; suelta en la zona para pesca ×2, en la barra pesca normal; con mal tiempo puedes fallar.
- Especies: Sardina 🐟, Trucha 🐠, Salmón 🐟, Dorado 🐠.

---

## Ciclo de día

`DAY_LENGTH = 40s` reales (o botón **▶ Día+1**). Al cerrar el día:

1. Clima (nuevo día, 45% de cambiar).
2. Cultivos crecen (clima × riego × lombrices), cosecha automática del peón.
3. Animales pagan comida, producen y ajustan felicidad (tormenta/lluvia).
4. Estanques regeneran stock; el pescador pesca automático.
5. **Salarios** del personal (si no alcanza, no trabajan ese día).
6. **Impuestos** cada 7 días (base + parcelas + animales + personal; el contador reduce 20%). La deuda acumula **5% de interés diario**.
7. **Ecosistema**: poblaciones de fauna evolucionan y sus eventos ocurren.
8. Modal de resumen del día.

---

## Ecosistema dinámico

Poblaciones que crecen/declinan según tus decoraciones y estructura:

| Fauna | Tipo | Efecto | Control |
|---|---|---|---|
| Abeja 🐝 | beneficio | +15% rendimiento cosechas | Colmena |
| Mariquita 🐞 | beneficio | reduce plagas | Flores |
| Lombriz 🪱 | beneficio | +10% crecimiento | Composta |
| Zorro 🦊 | perjuicio | roba huevos / asusta gallinas | Cercas |
| Jabalí 🐗 | perjuicio | destruye cultivos | Espantapájaros |
| Plaga 🦗 | perjuicio | daña cultivos | Mariquitas o repelente |

El panel **Ecosistema** muestra poblaciones, su origen y las estadísticas de la granja.

---

## Decoraciones (Jardín)

`espantapájaros 🧙`, `cerco 🚧`, `colmena 🐝`, `flores 🌻`, `composta 🪵`, `molino 🎡` (+10% ventas), `granero 🏠` (+40 almacén), `letrero 🪧`. Se compran en la tienda y aparecen en el banner "Jardín" sobre la granja.

---

## Personal

| Empleado | Salario/día | Efecto |
|---|---|---|
| Peón 🧑‍🌾 | $15 | cosecha maduros |
| Pescador 🎣 | $15 | pesca automática |
| Cuidador 🧑‍🤝‍🧑 | $22 | alimenta y reduce comida 50% |
| Contador 🧮 | $30 | −20% impuestos |

Contratar cuesta **2 días de salario** (depósito).

---

## Economía

- **Monedas 🪙**: se ganan vendiendo en el Mercado (productos y animales).
- **Fama ⭐**: aumenta con lo vendido y desbloquea especies premium en la tienda.
- **Almacén 📦**: límite de items (base 60, +40 por granero). Lleno ⇒ producción detenida.
- **Impuestos**: pagar en el aviso rojo del HUD o en el modal del día 7.

---

## Save / persistencia

Clave `"eco-granja-save"`. Se guarda al cerrar el día y tras cada acción importante (comprar, vender, contratar…). El `load` sanea tiles e inventario y aplica defaults a campos nuevos (retrocompatible).

---

## Ideas para iteraciones futuras

- [ ] Estaciones del año (primavera/verano/otoño/invierno) con catálogos rotativos.
- [ ] Misiones de clientes (pedidos en el mercado con recompensa extra).
- [ ] Huevos dorados / animales legendarios especiales.
- [ ] Mejoras de edificios (invernadero, granero nivel 2).
- [ ] Eventos aleatorios raros (feria, inspección, premio de lotería).