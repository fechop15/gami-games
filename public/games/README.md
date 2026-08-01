# Assets de juegos (`public/games/`)

SVGs generados por juego, listos para cablear en el código. Cada carpeta usa el slug del juego. Todos los `bg.svg` son 1080×1920 (mobile portrait), los `icon.svg` son 512×512, y los sprites son ~256×256 con fondo transparente.

## stack-tower (accent `#7c3aed`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical del juego: degradé violeta con silueta de ciudad y bloques flotantes decorativos. |
| `icon.svg` | Ícono cuadrado para el catálogo: torre de 3 bloques de colores sobre fondo violeta. |
| `block.svg` | Sprite de bloque redondeado con brillo, para la torre que se apila. |
| `crown.svg` | Corona dorada, ítem de logro/celebración al alcanzar cierta altura. |

## bubble-pop (accent `#f43f5e`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical rosa con burbujas de contorno y manchas de color de baja opacidad. |
| `icon.svg` | Ícono cuadrado: racimo de burbujas translúcidas sobre fondo rosa. |
| `bubble.svg` | Burbuja jugable con highlight brillante, fondo transparente. |
| `bomb.svg` | Bomba con mecha encendida, obstáculo/ítem especial. |

## snake-evo (accent `#10b981`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical neón oscuro (verde/cian) con grid de piso estilo retro-arcade. |
| `icon.svg` | Ícono cuadrado: serpiente enroscada neón sobre fondo verde oscuro. |
| `apple.svg` | Manzana roja, ítem de comida básico para crecer. |
| `gem.svg` | Gema dorada, ítem de bonus/puntaje alto. |
| `head.svg` | Cabeza de la serpiente con ojos y lengua, para el sprite del jugador. |

## brick-blitz (accent `#ef4444`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical rojo con filas de ladrillos decorativos de fondo (amarillo/cian/blanco). |
| `icon.svg` | Ícono cuadrado: ladrillos, pelota y paleta sobre fondo rojo. |
| `ball.svg` | Pelota blanca/gris con brillo, el proyectil del juego. |
| `paddle.svg` | Paleta roja alargada controlada por el jugador. |
| `powerup.svg` | Cápsula naranja con rayo, power-up recolectable. |

## fruit-slash (accent `#84cc16`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical lima con estelas de corte y frutas translúcidas de fondo. |
| `icon.svg` | Ícono cuadrado: sandía cortada por la mitad con estela de corte. |
| `watermelon.svg` | Sandía entera con corteza y vetas, fruta a cortar. |
| `orange.svg` | Naranja con hoja, fruta a cortar. |
| `bomb.svg` | Bomba (mecha verde lima) — evitar cortar. |
| `splash.svg` | Efecto de salpicadura/jugo para animar el corte de una fruta. |

## jump-hero (accent `#0ea5e9`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical de cielo celeste con sol, nubes y plataformas flotantes. |
| `icon.svg` | Ícono cuadrado: personaje saltador con capa roja sobre fondo celeste. |
| `hero.svg` | Personaje jugable de pie, con capa y botas, listo para animar salto. |
| `spring.svg` | Resorte/trampolín amarillo para impulsar al héroe hacia arriba. |
| `cloud.svg` | Nube blanca decorativa/plataforma. |
| `star.svg` | Estrella dorada coleccionable. |

## merge-2048 (accent `#f59e0b`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical ámbar cálido con tiles cuadrados translúcidos de fondo. |
| `icon.svg` | Ícono cuadrado: tile "2048" sobre fondo ámbar degradado. |
| `sparkle.svg` | Destello/estrella de fusión, para animar el merge de tiles. |
| `trophy.svg` | Trofeo dorado, ítem de logro al alcanzar el tile máximo. |

## color-switch (accent `#eab308`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical amarillo con anillos concéntricos multicolor de fondo. |
| `icon.svg` | Ícono cuadrado: anillo de 4 colores con núcleo blanco. |
| `ball.svg` | Bola jugable dividida en 4 cuadrantes de color con núcleo blanco. |
| `ring.svg` | Anillo giratorio de 4 colores, el obstáculo principal a atravesar. |
| `star.svg` | Estrella dorada coleccionable. |

## tap-fever (accent `#a855f7`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical púrpura neón con círculos de contorno y confeti geométrico de fondo. |
| `icon.svg` | Ícono cuadrado: anillos concéntricos neón (rosa/cian) con núcleo dorado. |
| `ring-target.svg` | Objetivo circular con anillos rosa/púrpura, el blanco a tocar al ritmo. |
| `confetti.svg` | Partículas de confeti de colores para celebrar aciertos. |
| `bolt.svg` | Rayo degradado amarillo-púrpura, ítem de combo/energía. |

## gravity-ball (accent `#6366f1`)

| Archivo | Uso |
|---|---|
| `bg.svg` | Fondo vertical índigo con líneas de laberinto y portales tenues de fondo. |
| `icon.svg` | Ícono cuadrado: bola física junto a un portal cian/violeta sobre fondo índigo. |
| `ball.svg` | Bola física con brillo, el sprite principal controlado por gravedad. |
| `portal.svg` | Portal circular con degradé cian→violeta→índigo, teletransporte. |
| `spike.svg` | Hilera de picos rojos, obstáculo letal. |
| `flag.svg` | Bandera de meta/checkpoint. |

---

### Notas de integración

- Todos los SVG tienen `viewBox` y son independientes (sin fuentes externas, sin referencias a otros archivos).
- Los sprites (no `bg.svg`/`icon.svg`) tienen fondo transparente — se pueden usar directamente como `<img>`, sprite Pixi/Canvas, o CSS `background-image`.
- La paleta de cada juego gira en torno a su `accentColor` definido en `app/lib/games.ts`, con degradés claro→oscuro para dar volumen y toques de colores complementarios para contraste (dorado, cian, rosa, etc.).
