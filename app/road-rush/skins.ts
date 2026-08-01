export interface Skin {
  id: string;
  name: string;
  price: number;        // 0 = gratis
  bodyColor: string;
  glowColor: string;
  accentColor: string;
  description: string;
  imageSrc?: string;    // ruta relativa a /public/ (opcional)
  animStyle?: "rainbow"; // animación especial en la tienda
}

export const SKINS: Skin[] = [
  {
    id: "default",
    name: "Deportivo",
    price: 0,
    bodyColor: "#00d4ff",
    glowColor: "#00aaff",
    accentColor: "rgba(0,212,255,0.55)",
    description: "El clásico",
    imageSrc: "/cars/car_1.png",
  },
  {
    id: "inferno",
    name: "Inferno",
    price: 200,
    bodyColor: "#ff4500",
    glowColor: "#cc2000",
    accentColor: "rgba(255,120,0,0.6)",
    description: "Fuego en las ruedas",
    imageSrc: "/cars/car_4.png",
  },
  {
    id: "toxic",
    name: "Tóxico",
    price: 200,
    bodyColor: "#39ff14",
    glowColor: "#1acc00",
    accentColor: "rgba(57,255,20,0.55)",
    description: "Brillo radiactivo",
    imageSrc: "/cars/car_5.png",
  },
  {
    id: "pink",
    name: "Rosado",
    price: 350,
    bodyColor: "#ff69b4",
    glowColor: "#dd0077",
    accentColor: "rgba(255,105,180,0.6)",
    description: "Neon rosa",
    imageSrc: "/cars/car_9.png",
  },
  {
    id: "dusk",
    name: "Dusk",
    price: 500,
    bodyColor: "#9b59b6",
    glowColor: "#7d3c98",
    accentColor: "rgba(155,89,182,0.6)",
    description: "Violeta atardecer",
    imageSrc: "/cars/car_6.png",
  },
  {
    id: "gold",
    name: "Dorado",
    price: 500,
    bodyColor: "#ffd700",
    glowColor: "#e6a800",
    accentColor: "rgba(255,215,0,0.6)",
    description: "Toque de lujo",
    imageSrc: "/cars/car_3.png",
  },
  {
    id: "cyber",
    name: "Cyber",
    price: 900,
    bodyColor: "#ff006e",
    glowColor: "#cc0055",
    accentColor: "rgba(255,0,110,0.6)",
    description: "Ciudad neon",
    imageSrc: "/cars/car_2.png",
  },
  {
    id: "ghost",
    name: "Ghost",
    price: 1500,
    bodyColor: "#4a4a6a",
    glowColor: "#1e3a8a",
    accentColor: "rgba(100,160,255,0.55)",
    description: "Modo invisible",
    imageSrc: "/cars/car_7.png",
  },
  {
    id: "chrome",
    name: "Chrome",
    price: 2500,
    bodyColor: "#d8d8d8",
    glowColor: "#aaaaaa",
    accentColor: "rgba(200,200,220,0.6)",
    description: "Ultra Premium",
    imageSrc: "/cars/car_8.png",
    animStyle: "rainbow",
  },
];

export const DEFAULT_SKIN = SKINS[0];

export function getSkin(id: string): Skin {
  return SKINS.find(s => s.id === id) ?? DEFAULT_SKIN;
}
