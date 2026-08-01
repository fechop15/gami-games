export interface Save {
  coins: number;
  unlocked: string[];   // IDs de skins desbloqueadas
  activeSkin: string;   // ID del skin activo
  bestDistance: number; // mejor distancia en metros
}

const KEY = "road-rush-save";

const DEFAULTS: Save = {
  coins: 0,
  unlocked: ["default"],
  activeSkin: "default",
  bestDistance: 0,
};

export function loadSave(): Save {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function persistSave(data: Save): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

// 1 moneda cada 10 metros
export function coinsForDistance(meters: number): number {
  return Math.floor(meters / 10);
}
