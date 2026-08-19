// ── Persistencia (localStorage) + racha diaria ─────────────────────────────────
import type { GS, Save } from './types';

const SKEY = 'pixel-run-save';

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function isYesterday(prev: string): boolean {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return prev === `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const DEFAULT_SAVE: Save = {
  stars: [0, 0, 0, 0, 0, 0, 0], best: 0, coins: 0, owned: [0], skin: 0,
  streak: 0, lastDay: '', extras: 0,
};

export function loadSave(): Save {
  try {
    const d = localStorage.getItem(SKEY);
    if (d) {
      const p = JSON.parse(d);
      return {
        stars: p.stars ?? DEFAULT_SAVE.stars,
        best: p.best ?? 0,
        coins: p.coins ?? 0,
        owned: p.owned ?? [0],
        skin: p.skin ?? 0,
        streak: p.streak ?? 0,
        lastDay: p.lastDay ?? '',
        extras: p.extras ?? 0,
      };
    }
  } catch {}
  return { ...DEFAULT_SAVE, stars: [...DEFAULT_SAVE.stars], owned: [...DEFAULT_SAVE.owned] };
}

export function writeSave(gs: GS) {
  try {
    const s = loadSave();
    localStorage.setItem(SKEY, JSON.stringify({
      stars: gs.stars.map((v, i) => Math.max(v, s.stars[i] ?? 0)),
      best: Math.max(gs.score, s.best),
      coins: gs.coins,
      owned: gs.owned,
      skin: gs.skin,
      streak: gs.streak,
      lastDay: gs.lastDay,
      extras: gs.extras,
    }));
  } catch {}
}

// Aplica la racha diaria (una vez por día) y devuelve true si hubo bonus
const STREAK_BONUS: Record<number, number> = { 3: 50, 7: 150, 14: 500 };

export function applyDailyStreak(gs: GS): boolean {
  const today = todayStr();
  if (gs.lastDay === today) return false;
  gs.streak = isYesterday(gs.lastDay) ? gs.streak + 1 : 1;
  gs.lastDay = today;
  const bonus = STREAK_BONUS[gs.streak];
  if (bonus) {
    gs.coins += bonus;
    gs.shopMsg = `🔥 Racha ${gs.streak} días: +${bonus}`;
    gs.shopMsgT = 4;
  }
  writeSave(gs);
  return true;
}
