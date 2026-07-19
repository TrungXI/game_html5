import { SAVE_KEY } from "../config/constants";
import type { GameId } from "../config/games";

type HighScores = Partial<Record<GameId, number>>;

interface SaveData {
  highScores: HighScores;
}

const DEFAULT: SaveData = { highScores: {} };

/** Parse whatever is in storage into the current shape, migrating older saves. */
function parse(raw: string): SaveData {
  // `{ highScore: n }` was the pre-multi-game shape — fold it into tapjumper.
  const obj = JSON.parse(raw) as {
    highScore?: unknown;
    highScores?: Record<string, unknown>;
  };

  const scores: HighScores = {};
  if (obj.highScores && typeof obj.highScores === "object") {
    for (const [key, value] of Object.entries(obj.highScores)) {
      const n = Number(value);
      if (n > 0) scores[key as GameId] = n;
    }
  }
  const legacy = Number(obj.highScore);
  if (legacy > 0 && !scores.tapjumper) scores.tapjumper = legacy;

  return { highScores: scores };
}

export const SaveSystem = {
  load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { highScores: {} };
      return parse(raw);
    } catch {
      return { ...DEFAULT, highScores: {} };
    }
  },
  getHighScore(gameId: GameId): number {
    return this.load().highScores[gameId] ?? 0;
  },
  /** Persist score if it beats this game's stored best. Returns true if new best. */
  submitScore(gameId: GameId, score: number): boolean {
    const data = this.load();
    const current = data.highScores[gameId] ?? 0;
    if (score > current) {
      data.highScores[gameId] = score;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch {
        /* storage blocked (private mode) — ignore, non-fatal */
      }
      return true;
    }
    return false;
  },
};
