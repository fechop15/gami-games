# EcoGranja — Documentación técnica y de diseño

> Juego 015 del catálogo Gami Game
> Ruta: `/eco-granja`
> Tecnología: Canvas 2D puro (sin dependencias externas), Next.js App Router, TypeScript
> Estado: **v2** — mundo abierto con personaje (v1 era grid con hoja de acciones)

---

## Archivos

```
app/eco-granja/
├── page.tsx              ← Wrapper de Next.js (metadata + export)
├── EcoGranjaGame.tsx     ← Componente React: canvas, game loop y eventos touch/mouse
├── config.json           ← Balance y catálogos: cultivos, animales, peces, productos, clima, fauna, personal y extras
├── types.ts              ← Tipos compartidos (Phase, GS, PlayerState, Tool, etc.)
├── constants.ts          ← Constantes y catálogo de herramientas/construcciones
├── save.ts               ← Persistencia en localStorage (granja, inventario, fama, personal, estadísticas)
├── engine.ts             ← Lógica: movimiento del personaje, cámara, trabajo/acciones, ciclo de día, fauna, economía
├── draw.ts               ← Mundo en mundo-abierto (cámara que sigue al personaje), personaje animado, construcciones, clima
├── ui.ts                 ← HUD, barra de herramientas, selector de opciones, rail de menús y modales
├── input.ts              ← handleTap: botones → mundo (mover / actuar con herramienta)
└── ECO_GRANJA.md         ← Este documento
```

---

## Mundo abierto con personaje

La granja es un **mundo con scroll y cámara que sigue al granjero**. Todo se hace caminando hasta el lugar:

- **👆 Toca el suelo** → el granjero camina (y **corre** si el punto está lejos).
- El personaje tiene animación de caminar/correr (piernas, brazos, sombrero de paja), giro según la dirección y **animación de trabajo** (golpe de azada, regadera, martillo, caña…) al llegar a la parcela.
- Las **herramientas** de la barra inferior definen la actividad; al tocar una parcela válida el personaje camina, trabaja y el efecto se aplica con partículas y marcador en la parcela.

### Herramientas

| Herramienta | Acción |
|---|---|
| 👋 Mover | Camina/corre hasta el punto tocado |
| 🪓 Arar | Convierte hierba 🌱 en tierra arada |
| 🌱 Sembrar | Siembra la semilla elegida en el selector |
| 💧 Regar | Riega un cultivo |
| 🌾 Cosechar | Recoge un cultivo maduro |
| 🎣 Pescar | Pesca (o siembra alevines) en un estanque |
| 🐔 Criar | Compra animales en pastizales; sobre un animal abre su menú (alimentar/vender/criar) |
| 🏗️ Construir | Construye vallas, estanques, pastizales y edificios del jardín |

### El mundo

- Cuadrícula de **7 columnas × 7 filas** (expandible hasta 12 filas) de parcelas de **hierba** que hay que arar.
- Tipos de parcela: `grass` (hierba), `soil` (arada), `pond` (estanque), `pasture` (pastizal) y `building` (construcción).
- La cámara se centra en el personaje y se recorre automáticamente al caminar.

---

## Construcciones (🏗️ Construir)

Catálogo (se coloca en una parcela y el personaje la construye):

| Construcción | Coste | Efecto |
|---|---|---|
| 🚧 Valla | $100 | Protege de zorros |
| 🌊 Estanque | $60 | Permite pescar |
| 🌿 Pastizal | $80 | Permite criar animales |
| 🧙 Espantapájaros | $80 | Ahuyenta jabalíes |
| 🐝 Colmena | $150 | Atrae abejas (+15% cosechas) |
| 🌻 Flores | $120 | Atrae mariquitas y alegra animales |
| 🪵 Composta | $140 | Atrae lombrices (+10% crecimiento) |
| 🎡 Molino | $400 | +10% ventas |
| 🏠 Granero | $600 | +40 almacén |
| 🪧 Letrero | $50 | Decorativo |

---

## Cultivos

7 especies (Trigo → Trufa) con calidad 1-5 (riego, abono, abejas y lluvia la suben). El clima riega, acelera o daña: lluvia/tormenta riegan todo, la helada congela sin regar, la sequía/calor marchita sin regar.

## Animales y cría

6 especies; cada una paga comida diaria, tiene felicidad (acelera la producción) y produce su producto. **Criar** dos ejemplares de la misma especie tiene probabilidad de dar una **raza +1** (hasta ✦5) que multiplica el precio de productos y el valor de venta.

## Pesca

Estanques con **alevines** que se regeneran; minijuego de barra con zona dorada (pesca ×2) afectado por el clima.

---

## Ciclo de día, impuestos, personal y ecosistema

- **Día** = 40 s reales o botón **▶ Día+1**. Cada día: cultivos crecen, animales producen/comen, estanques regeneran, salarios, impuestos (cada 7 días, interés 4%/día), fauna y clima.
- **Personal**: Peón (cosecha), Pescador (pesca), Cuidador (alimenta, −50% comida), Contador (−20% impuestos).
- **Ecosistema**: abejas/mariquitas/lombrices (beneficios) y zorros/jabalíes/plagas (perjuicios) que aparecen según tus construcciones y estructura de la granja. Panel 🦊 con poblaciones y estadísticas.
- **Mercado 💰**: vende el inventario (con calidad) y "VENDER TODO". La fama ⭐ desbloquea especies premium.

---

## Persistencia

Clave `"eco-granja-save"`. Se guarda al cerrar el día y tras cada acción. `loadEcoSave` sanea tiles (tipo, construcción), inventario y aplica defaults a campos nuevos.

---

## Ideas para iteraciones futuras

- [ ] Estaciones del año con catálogos rotativos.
- [ ] Misiones de clientes en el mercado.
- [ ] Animales legendarios y huevos dorados.
- [ ] Mejoras de edificios (invernadero, granero nivel 2).
- [ ] Eventos raros (feria, inspección, premio de lotería).