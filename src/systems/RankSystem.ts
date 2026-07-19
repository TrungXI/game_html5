import { RANK_SAVE_KEY, RANKS, XP_BASE, XP_PER_POINT } from "../config/constants";
import type { GameId } from "../config/games";

interface RankData {
  xp: number; // single running total across all games
}

const DEFAULT: RankData = { xp: 0 };

/** Current tier the player sits in. */
export interface RankInfo {
  title: string; // current tier title
  color: number; // current tier color (hex)
  tierIndex: number; // 0..RANKS.length-1
}

/** Progress from the current tier toward the next, for the menu banner bar. */
export interface RankProgress {
  current: RankInfo;
  next: RankInfo | null; // null when at max tier
  xpIntoTier: number; // xp - current.minXP
  xpForTier: number; // next.minXP - current.minXP (0 if max tier)
  ratio: number; // 0..1 progress bar fill (1 when max tier)
}

function tierInfo(index: number): RankInfo {
  const tier = RANKS[index];
  return { title: tier.title, color: tier.color, tierIndex: index };
}

/** Global XP earned across every game. Corrupt-safe localStorage, mirrors SaveSystem. */
export const RankSystem = {
  load(): RankData {
    try {
      const raw = localStorage.getItem(RANK_SAVE_KEY);
      if (!raw) return { xp: 0 };
      const obj = JSON.parse(raw) as { xp?: unknown };
      const xp = Number(obj.xp);
      if (!Number.isFinite(xp) || xp < 0) return { xp: 0 };
      return { xp };
    } catch {
      return { ...DEFAULT };
    }
  },

  getXP(): number {
    return this.load().xp;
  },

  /** Adds XP for a run. xp = XP_BASE + floor(score * (XP_PER_POINT[gameId] ?? 1)). Returns new total. */
  addXP(gameId: GameId, score: number): number {
    const data = this.load();
    const safeScore = Math.max(0, score);
    const gained = XP_BASE + Math.floor(safeScore * (XP_PER_POINT[gameId] ?? 1));
    data.xp += gained;
    try {
      localStorage.setItem(RANK_SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage blocked (private mode) — ignore, non-fatal */
    }
    return data.xp;
  },

  /** Highest tier whose minXP <= current xp; falls back to RANKS[0]. */
  getRank(): RankInfo {
    const xp = this.getXP();
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (RANKS[i].minXP <= xp) return tierInfo(i);
    }
    return tierInfo(0);
  },

  getProgressToNext(): RankProgress {
    const xp = this.getXP();
    const current = this.getRank();
    const nextIndex = current.tierIndex + 1;
    const hasNext = nextIndex < RANKS.length;

    if (!hasNext) {
      return {
        current,
        next: null,
        xpIntoTier: xp - RANKS[current.tierIndex].minXP,
        xpForTier: 0,
        ratio: 1,
      };
    }

    const currentMin = RANKS[current.tierIndex].minXP;
    const nextMin = RANKS[nextIndex].minXP;
    const xpIntoTier = xp - currentMin;
    const xpForTier = nextMin - currentMin;
    return {
      current,
      next: tierInfo(nextIndex),
      xpIntoTier,
      xpForTier,
      ratio: xpForTier > 0 ? xpIntoTier / xpForTier : 1,
    };
  },
};
