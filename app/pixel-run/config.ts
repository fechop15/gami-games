// ── Constantes, metadatos y catálogo de personajes ─────────────────────────────
import type { GS, Skin, Theme } from './types';

export const GRAV = 1400;
export const LIFE_COST = 50;
export const MAX_LIVES = 10;
export const JMP_V = -700;
export const WALK_V = 200;
export const RUN_V = 360;
export const PW = 32;
export const PH = 44;
export const CAM_LEAD = 0.37;
export const CAM_LERP = 0.10;
export const COYOTE = 0.08;
export const RUN_DUR = 1.5;
export const DBL_MS = 300;

export const WORLD_NAMES = ['Prados', 'Cueva', 'Cielo', 'Mar', 'Lava', 'Jungla', 'Nubes'];
export const WORLD_ICONS = ['🌿', '🦇', '☁️', '🐠', '🌋', '🌴', '⚡'];
export const NUM_WORLDS = 7;

// Paletas de partículas temáticas por mundo (moneda/stomp)
export const THEME_PARTS: Record<Theme, string[]> = {
  green:  ['#ffd700', '#fff', '#a5d6a7', '#66bb6a'],
  cave:   ['#ffd700', '#fff', '#ffab40', '#90a4ae'],
  sky:    ['#ffd700', '#fff', '#e1f5fe', '#90caf9'],
  sea:    ['#ffd700', '#4dd0e1', '#b2ebf2', '#e0f7fa'],
  lava:   ['#ffd700', '#ff7043', '#ffab40', '#ffca28'],
  jungle: ['#ffd700', '#a5d6a7', '#43a047', '#c5e1a5'],
  cloud:  ['#ffd700', '#fff', '#e1f5fe', '#b3e5fc'],
};

export const ABILITY_IDS = {
  SPIKE_IMMUNE: 'spikeImmune',
  DOUBLE_JUMP: 'doubleJump',
  FIREBALL: 'fireball',
  SOFT_LAND: 'softLand',
} as const;

export const SKINS: Skin[] = [
  { name: 'Clásico',    price: 0,   hat: '#ffd54f', hatMid: '#f9a825', hatDk: '#e65100', body: '#ffd54f', bodyMid: '#ffc107', bodyDk: '#ff8f00', collar: '#ff8f00', collarDk: '#e65100', ability: ABILITY_IDS.SPIKE_IMMUNE, abilityIcon: '🛡', abilityName: 'Imune a espinas' },
  { name: 'Ninja',      price: 200, hat: '#546e7a', hatMid: '#37474f', hatDk: '#263238', body: '#455a64', bodyMid: '#37474f', bodyDk: '#263238', collar: '#d32f2f', collarDk: '#b71c1c', ability: ABILITY_IDS.DOUBLE_JUMP, abilityIcon: '⚡', abilityName: 'Doble salto' },
  { name: 'Pirata',     price: 400, hat: '#8d6e63', hatMid: '#6d4c41', hatDk: '#4e342e', body: '#c62828', bodyMid: '#b71c1c', bodyDk: '#7f0000', collar: '#fdd835', collarDk: '#f9a825', ability: ABILITY_IDS.FIREBALL, abilityIcon: '🔥', abilityName: 'Bolas de fuego' },
  { name: 'Astronauta', price: 600, hat: '#eceff1', hatMid: '#cfd8dc', hatDk: '#90a4ae', body: '#eceff1', bodyMid: '#b0bec5', bodyDk: '#78909c', collar: '#29b6f6', collarDk: '#0288d1', ability: ABILITY_IDS.SOFT_LAND, abilityIcon: '🪂', abilityName: 'Caída suave' },
];

// Color arcoíris para el power-up estrella
export function rainbow(t: number): string {
  const h = Math.floor((t * 360) % 360);
  return `hsl(${h}, 90%, 60%)`;
}

// Habilidad activa según el personaje equipado
export function skinOf(gsOrId: number | { skin: number }): Skin {
  const id = typeof gsOrId === 'number' ? gsOrId : gsOrId.skin;
  return SKINS[id] ?? SKINS[0];
}

export function hasAbility(gs: GS, id: string): boolean {
  return skinOf(gs).ability === id;
}
