import type { EnemyType } from "./types"

export interface WaveDef { enemies: EnemyType[]; delay: number }
export interface WorldDef {
  id: number; name: string; subtitle: string
  bgColor: string; nebula: string; accent: string
  waves: WaveDef[]
  bossName: string; bossColor: string; bossAccent: string; bossHp: number
}

export const WORLDS: WorldDef[] = [
  {
    id: 0, name: "Cinturón Rojo", subtitle: "El campo de asteroides",
    bgColor: "#0d0200", nebula: "#5a1200", accent: "#ff5500",
    waves: [
      { enemies: ["scout", "scout", "scout", "grunt", "grunt"], delay: 1200 },
      { enemies: ["scout", "grunt", "grunt", "grunt", "scout", "scout"], delay: 1100 },
      { enemies: ["grunt", "grunt", "scout", "scout", "grunt", "scout", "grunt"], delay: 1000 },
    ],
    bossName: "Centinela Rojo", bossColor: "#cc2200", bossAccent: "#ff8844", bossHp: 900,
  },
  {
    id: 1, name: "Nebulosa Violeta", subtitle: "Los cazadores invisibles",
    bgColor: "#050010", nebula: "#2d0050", accent: "#cc44ff",
    waves: [
      { enemies: ["stealth", "stealth", "stealth", "shooter", "stealth"], delay: 1300 },
      { enemies: ["shooter", "stealth", "stealth", "shooter", "stealth", "shooter"], delay: 1200 },
      { enemies: ["stealth", "shooter", "shooter", "stealth", "shooter", "stealth", "shooter"], delay: 1100 },
    ],
    bossName: "Espectro Oscuro", bossColor: "#6600aa", bossAccent: "#dd66ff", bossHp: 1100,
  },
  {
    id: 2, name: "Enjambre Verde", subtitle: "La marea imparable",
    bgColor: "#001500", nebula: "#002800", accent: "#44ff44",
    waves: [
      { enemies: ["scout", "scout", "scout", "scout", "scout", "tank", "scout"], delay: 800 },
      { enemies: ["tank", "scout", "scout", "scout", "scout", "tank", "scout", "scout"], delay: 700 },
      { enemies: ["tank", "tank", "scout", "scout", "scout", "scout", "scout", "tank", "scout"], delay: 600 },
    ],
    bossName: "Reina del Enjambre", bossColor: "#006600", bossAccent: "#88ff44", bossHp: 1300,
  },
  {
    id: 3, name: "Singularidad Azul", subtitle: "Donde la gravedad colapsa",
    bgColor: "#000015", nebula: "#001040", accent: "#4488ff",
    waves: [
      { enemies: ["grunt", "shooter", "grunt", "shooter", "tank", "shooter"], delay: 1100 },
      { enemies: ["tank", "shooter", "grunt", "shooter", "grunt", "shooter", "tank"], delay: 1000 },
      { enemies: ["tank", "tank", "shooter", "grunt", "shooter", "grunt", "shooter", "tank"], delay: 900 },
    ],
    bossName: "El Devorador", bossColor: "#001166", bossAccent: "#44aaff", bossHp: 1500,
  },
  {
    id: 4, name: "Trono Estelar", subtitle: "El enfrentamiento final",
    bgColor: "#0a0800", nebula: "#302000", accent: "#ffcc00",
    waves: [
      { enemies: ["tank", "shooter", "stealth", "scout", "grunt", "shooter", "tank", "stealth"], delay: 900 },
      { enemies: ["tank", "stealth", "shooter", "tank", "grunt", "stealth", "shooter", "scout", "tank"], delay: 800 },
      { enemies: ["tank", "stealth", "shooter", "tank", "shooter", "stealth", "tank", "grunt", "shooter", "stealth", "tank"], delay: 700 },
    ],
    bossName: "El Emperador", bossColor: "#664400", bossAccent: "#ffdd44", bossHp: 2000,
  },
  {
    id: 5, name: "Corona Helada", subtitle: "Los cristales del olvido",
    bgColor: "#000d1a", nebula: "#00304a", accent: "#66ddff",
    waves: [
      { enemies: ["grunt", "shooter", "grunt", "shooter", "splitter", "grunt", "shooter"], delay: 900 },
      { enemies: ["shooter", "splitter", "grunt", "tank", "shooter", "grunt", "splitter", "shooter"], delay: 850 },
      { enemies: ["tank", "splitter", "shooter", "grunt", "splitter", "shooter", "tank", "shooter", "splitter"], delay: 800 },
    ],
    bossName: "La Reina del Hielo", bossColor: "#003366", bossAccent: "#66ccff", bossHp: 2300,
  },
  {
    id: 6, name: "Núcleo Ígneo", subtitle: "El corazón incandescente",
    bgColor: "#0f0000", nebula: "#420000", accent: "#ff7733",
    waves: [
      { enemies: ["tank", "kamikaze", "tank", "grunt", "kamikaze", "shooter", "kamikaze"], delay: 800 },
      { enemies: ["kamikaze", "tank", "kamikaze", "splitter", "tank", "kamikaze", "grunt", "tank"], delay: 750 },
      { enemies: ["tank", "kamikaze", "splitter", "tank", "kamikaze", "tank", "splitter", "kamikaze", "tank"], delay: 700 },
    ],
    bossName: "El Coloso de Magma", bossColor: "#661100", bossAccent: "#ff8844", bossHp: 2600,
  },
  {
    id: 7, name: "El Vacío", subtitle: "Más allá del universo conocido",
    bgColor: "#000008", nebula: "#150033", accent: "#dd66ff",
    waves: [
      { enemies: ["tank", "stealth", "shooter", "splitter", "kamikaze", "tank", "shooter", "stealth", "grunt"], delay: 800 },
      { enemies: ["tank", "shooter", "stealth", "kamikaze", "splitter", "tank", "shooter", "stealth", "kamikaze", "tank"], delay: 720 },
      { enemies: ["tank", "stealth", "shooter", "kamikaze", "splitter", "tank", "shooter", "stealth", "kamikaze", "splitter", "tank", "grunt"], delay: 640 },
    ],
    bossName: "Null, el Aniquilador", bossColor: "#220033", bossAccent: "#ff55ff", bossHp: 3200,
  },
  {
    id: 8, name: "Bosque Nocturno", subtitle: "Donde crecen las pesadillas",
    bgColor: "#021006", nebula: "#063a12", accent: "#66ff88",
    waves: [
      { enemies: ["grunt", "splitter", "grunt", "shooter", "scout", "splitter", "grunt"], delay: 850 },
      { enemies: ["splitter", "shooter", "grunt", "tank", "splitter", "shooter", "grunt", "splitter"], delay: 800 },
      { enemies: ["tank", "splitter", "shooter", "grunt", "splitter", "shooter", "tank", "splitter", "shooter"], delay: 750 },
    ],
    bossName: "La Madre Maleza", bossColor: "#0a3a1a", bossAccent: "#88ff66", bossHp: 3600,
  },
  {
    id: 9, name: "Mar de Mercurio", subtitle: "El océano de metal líquido",
    bgColor: "#000b14", nebula: "#0a3a5a", accent: "#88ccff",
    waves: [
      { enemies: ["shooter", "stealth", "shooter", "grunt", "splitter", "shooter", "stealth"], delay: 850 },
      { enemies: ["tank", "shooter", "stealth", "splitter", "shooter", "tank", "stealth", "shooter"], delay: 780 },
      { enemies: ["tank", "shooter", "stealth", "splitter", "shooter", "tank", "stealth", "splitter", "shooter", "tank"], delay: 720 },
    ],
    bossName: "El Leviatán", bossColor: "#0a3050", bossAccent: "#66eeff", bossHp: 4000,
  },
  {
    id: 10, name: "Purgatorio Dorado", subtitle: "Las puertas del juicio",
    bgColor: "#140e00", nebula: "#4a3a00", accent: "#ffcc44",
    waves: [
      { enemies: ["grunt", "shooter", "tank", "kamikaze", "grunt", "shooter", "kamikaze"], delay: 800 },
      { enemies: ["tank", "shooter", "kamikaze", "grunt", "shooter", "tank", "kamikaze", "shooter"], delay: 740 },
      { enemies: ["tank", "shooter", "kamikaze", "splitter", "tank", "shooter", "kamikaze", "shooter", "tank", "kamikaze"], delay: 680 },
    ],
    bossName: "El Inquisidor", bossColor: "#4a3a00", bossAccent: "#ffdd66", bossHp: 4500,
  },
  {
    id: 11, name: "Fragmentos Carmesí", subtitle: "El cielo desgarrado",
    bgColor: "#140005", nebula: "#3a0010", accent: "#ff4466",
    waves: [
      { enemies: ["kamikaze", "splitter", "kamikaze", "stealth", "shooter", "kamikaze", "splitter"], delay: 780 },
      { enemies: ["splitter", "kamikaze", "stealth", "tank", "splitter", "kamikaze", "shooter", "splitter"], delay: 720 },
      { enemies: ["tank", "splitter", "kamikaze", "stealth", "splitter", "kamikaze", "tank", "splitter", "kamikaze"], delay: 660 },
    ],
    bossName: "La Cosechadora", bossColor: "#3a0018", bossAccent: "#ff5577", bossHp: 5000,
  },
  {
    id: 12, name: "Catedral Fantasma", subtitle: "Ecos del más allá",
    bgColor: "#070b12", nebula: "#1a2a44", accent: "#aaccff",
    waves: [
      { enemies: ["stealth", "grunt", "stealth", "shooter", "grunt", "splitter", "stealth"], delay: 820 },
      { enemies: ["stealth", "shooter", "tank", "stealth", "grunt", "shooter", "stealth", "splitter"], delay: 760 },
      { enemies: ["tank", "stealth", "shooter", "stealth", "splitter", "grunt", "tank", "stealth", "shooter", "stealth"], delay: 700 },
    ],
    bossName: "El Obispo", bossColor: "#222a44", bossAccent: "#ddeeff", bossHp: 5500,
  },
  {
    id: 13, name: "Abismo Esmeralda", subtitle: "La profundidad sin luz",
    bgColor: "#001409", nebula: "#003a1a", accent: "#44ffaa",
    waves: [
      { enemies: ["tank", "shooter", "tank", "grunt", "kamikaze", "tank", "shooter"], delay: 780 },
      { enemies: ["tank", "kamikaze", "tank", "shooter", "grunt", "tank", "kamikaze", "shooter"], delay: 720 },
      { enemies: ["tank", "tank", "shooter", "kamikaze", "splitter", "tank", "shooter", "kamikaze", "tank"], delay: 660 },
    ],
    bossName: "El Titán Verde", bossColor: "#003322", bossAccent: "#55ff88", bossHp: 6200,
  },
  {
    id: 14, name: "Torre del Atardecer", subtitle: "El último bastión",
    bgColor: "#14050a", nebula: "#3a1a2a", accent: "#ff8844",
    waves: [
      { enemies: ["tank", "stealth", "shooter", "kamikaze", "splitter", "tank", "stealth"], delay: 760 },
      { enemies: ["tank", "shooter", "stealth", "splitter", "kamikaze", "tank", "shooter", "stealth"], delay: 700 },
      { enemies: ["tank", "shooter", "stealth", "kamikaze", "splitter", "tank", "shooter", "stealth", "kamikaze", "splitter"], delay: 640 },
    ],
    bossName: "La Vanguardia", bossColor: "#3a1020", bossAccent: "#ffaa66", bossHp: 7000,
  },
  {
    id: 15, name: "Infinito", subtitle: "Más allá del todo",
    bgColor: "#050010", nebula: "#1a0040", accent: "#ffdd55",
    waves: [
      { enemies: ["tank", "shooter", "stealth", "kamikaze", "splitter", "grunt", "tank", "shooter"], delay: 720 },
      { enemies: ["tank", "shooter", "stealth", "kamikaze", "splitter", "tank", "shooter", "stealth", "kamikaze", "splitter"], delay: 660 },
      { enemies: ["tank", "shooter", "stealth", "kamikaze", "splitter", "tank", "shooter", "stealth", "kamikaze", "splitter", "tank", "shooter"], delay: 600 },
    ],
    bossName: "Amarok, el Último", bossColor: "#2a0044", bossAccent: "#ffee66", bossHp: 8000,
  },
]