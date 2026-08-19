// ── JSON schema types ─────────────────────────────────────────────────────────
import type { Platform, Enemy, Coin, Spike } from './types';

interface PlatDef {
  x: number; yOff: number; w: number; h: number;
  spd?: number; rng?: number;
}

interface EnemyDef {
  type: 'spider' | 'worm' | 'monkey' | 'plant' | 'espin';
  x: number; yOff: number; patL: number; patR: number;
}

interface CoinDef  { x: number; yOff: number; }
interface SpikeDef { x: number; yOff: number; w: number; }

export interface WorldDef {
  id: number; name: string; theme: string;
  lW: number; gX: number; startX: number; checks: number[];
  plats: PlatDef[]; ens: EnemyDef[]; coins: CoinDef[]; spikes: SpikeDef[];
}

export type { Platform, Enemy, Coin, Spike };

export interface LvlData {
  plats: Platform[]; ens: Enemy[]; cns: Coin[]; sps: Spike[];
  gX: number; lW: number; theme: string; startX: number; checks: number[];
}

// ── Enemy dimensions & speeds (mirrors PixelRunGame.tsx) ─────────────────────

const DIMS: Record<string, [number, number]> = {
  spider: [30, 24], worm: [44, 18], monkey: [28, 38], plant: [26, 44], espin: [30, 24],
};
const SPDS: Record<string, number> = {
  spider: 75, worm: 45, monkey: 100, plant: 0, espin: 65,
};

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildLevelFromDef(def: WorldDef, g: number): LvlData {
  const plats: Platform[] = def.plats.map(p => ({
    x: p.x, y: g + p.yOff, w: p.w, h: p.h,
    origX: p.x, dir: 1, spd: p.spd ?? 0, rng: p.rng ?? 0,
  }));

  const ens: Enemy[] = def.ens.map((e, i) => {
    const [w, h] = DIMS[e.type];
    const ft0 = e.type === 'plant'  ? 2 + i * 0.7
               : e.type === 'monkey' ? 1.5 + i * 0.4
               : 0;
    return {
      id: i, type: e.type,
      x: e.x, y: g + e.yOff,
      vx: SPDS[e.type], vy: 0, w, h,
      patL: e.patL, patR: e.patR,
      alive: true, stompT: 0, fr: 0, ft: ft0,
      baseY: g + e.yOff,
    };
  });

  const cns: Coin[]  = def.coins.map(c  => ({ x: c.x,  y: g + c.yOff,  got: false }));
  const sps: Spike[] = def.spikes.map(s => ({ x: s.x,  y: g + s.yOff,  w: s.w }));

  return {
    plats, ens, cns, sps,
    gX: def.gX, lW: def.lW,
    theme: def.theme, startX: def.startX, checks: def.checks,
  };
}

// ── World defs (cargados vía fetch, no import estático) ───────────────────────

export let WORLD_DEFS: WorldDef[] = [];

export async function initWorldDefs(): Promise<void> {
  const res = await fetch('/pixel-run/levels.json');
  const data = await res.json();
  WORLD_DEFS = data.worlds as WorldDef[];
}
