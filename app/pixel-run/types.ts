// ── Tipos y contratos compartidos de Pixel Run ─────────────────────────────────

export type Phase = 'intro' | 'playing' | 'dead' | 'lvlDone' | 'gameOver' | 'win' | 'shop' | 'transition';
export type Theme = 'green' | 'cave' | 'sky' | 'sea' | 'lava' | 'jungle' | 'cloud';

export interface Platform { x: number; y: number; w: number; h: number; origX: number; dir: number; spd: number; rng: number; }
export interface Enemy { id: number; type: 'spider' | 'worm' | 'monkey' | 'plant' | 'espin'; x: number; y: number; vx: number; vy: number; w: number; h: number; patL: number; patR: number; alive: boolean; stompT: number; fr: number; ft: number; baseY: number; }
export interface Coin { x: number; y: number; got: boolean; }
export interface Spike { x: number; y: number; w: number; }
export interface Projectile { x: number; y: number; vx: number; vy: number; life: number; }
export interface Fireball { x: number; y: number; vx: number; life: number; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; ml: number; col: string; r: number; }
export interface TD { sx: number; sy: number; cx: number; cy: number; t: number; btn?: 'L' | 'R' | 'jump' | 'run' | 'fire'; }

export type TouchBtn = TD['btn'];

export interface StarCoin { x: number; y: number; got: boolean; }

export interface GS {
  phase: Phase; lv: number; lives: number; score: number; coins: number; elapsed: number;
  px: number; py: number; pvx: number; pvy: number; onG: boolean; fR: boolean;
  ps: 'idle' | 'run' | 'jump' | 'fall' | 'dead'; afr: number; aft: number;
  invT: number; coyT: number; jBuf: number;
  plats: Platform[]; ens: Enemy[]; cns: Coin[]; sps: Spike[];
  gX: number; lW: number; theme: Theme; gY: number;
  camX: number; parts: Particle[]; projs: Projectile[];
  inp: { L: boolean; R: boolean; J: boolean; F: boolean; };
  runT: number; ltap: { L: number; R: number; };
  tMap: Map<number, TD>;
  phT: number; msg: string; msgT: number;
  startX: number;
  ckX: number; ckY: number; ckList: number[]; nextCk: number;
  sqT: number; sqDir: number; prevOnG: boolean;
  stepT: number;
  lvlCoins: number; totalLvlCoins: number;
  stars: number[];
  hitStop: number; flashT: number; flashCol: string;
  comboT: number; comboN: number;
  starPowerT: number; starCoin: StarCoin | null;
  entryT: number; entryLock: boolean;
  paused: boolean;
  transT: number; transToLv: number;
  jumpStrength: number; jumpHeld: boolean; touchJump: boolean;
  btnFade: number;
  owned: number[]; skin: number; streak: number; lastDay: string;
  extras: number;
  shopMsg: string; shopMsgT: number;
  jumpsLeft: number;
  fbCd: number; fbs: Fireball[];
  shield: number;
}

export interface Skin {
  name: string; price: number;
  hat: string; hatMid: string; hatDk: string;
  body: string; bodyMid: string; bodyDk: string;
  collar: string; collarDk: string;
  ability: string; abilityIcon: string; abilityName: string;
}

export interface Rect { x: number; y: number; w: number; h: number; }

export interface Save {
  stars: number[]; best: number; coins: number; owned: number[]; skin: number;
  streak: number; lastDay: string; extras: number;
}

export type AbilityId = 'spikeImmune' | 'doubleJump' | 'fireball' | 'softLand';
