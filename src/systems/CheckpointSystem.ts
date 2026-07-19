import {
  BREAKOUT_BRICK_COLS,
  BREAKOUT_BRICK_ROWS,
  CHECKPOINT_SAVE_KEY,
  G2048_SIZE,
} from "../config/constants";
import type { GameId } from "../config/games";

/** In-progress Breakout run. Ball position is NOT persisted — only discrete board state. */
export interface BreakoutCheckpoint {
  level: number;
  lives: number;
  score: number;
  /** Flat boolean[] of length ROWS*COLS, true = brick still alive. */
  bricks: boolean[];
}

/** In-progress 2048 run. */
export interface Game2048Checkpoint {
  board: number[][]; // G2048_SIZE × G2048_SIZE, 0 = empty
  score: number;
}

/** Only games with supportsCheckpoint: true appear here. */
type CheckpointMap = {
  breakout?: BreakoutCheckpoint;
  game2048?: Game2048Checkpoint;
};

const BREAKOUT_BRICK_COUNT = BREAKOUT_BRICK_ROWS * BREAKOUT_BRICK_COLS;

/** Drop a stored breakout entry unless its brick array is the right length of booleans. */
function validBreakout(entry: unknown): entry is BreakoutCheckpoint {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.level !== "number" || typeof e.lives !== "number" || typeof e.score !== "number") {
    return false;
  }
  if (!Array.isArray(e.bricks) || e.bricks.length !== BREAKOUT_BRICK_COUNT) return false;
  return e.bricks.every((b) => typeof b === "boolean");
}

/** Drop a stored 2048 entry unless its board is a G2048_SIZE² matrix of numbers. */
function validGame2048(entry: unknown): entry is Game2048Checkpoint {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.score !== "number") return false;
  if (!Array.isArray(e.board) || e.board.length !== G2048_SIZE) return false;
  return e.board.every(
    (row) =>
      Array.isArray(row) &&
      row.length === G2048_SIZE &&
      row.every((v) => typeof v === "number"),
  );
}

/** Per-game resume state. One localStorage key holding a map. Corrupt-safe, mirrors SaveSystem. */
export const CheckpointSystem = {
  load(): CheckpointMap {
    try {
      const raw = localStorage.getItem(CHECKPOINT_SAVE_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const map: CheckpointMap = {};
      if (validBreakout(obj.breakout)) map.breakout = obj.breakout;
      if (validGame2048(obj.game2048)) map.game2048 = obj.game2048;
      return map;
    } catch {
      return {};
    }
  },

  has(gameId: GameId): boolean {
    const map = this.load();
    return gameId === "breakout" ? !!map.breakout : gameId === "game2048" ? !!map.game2048 : false;
  },

  get<K extends "breakout" | "game2048">(gameId: K): CheckpointMap[K] | undefined {
    return this.load()[gameId];
  },

  save(gameId: "breakout" | "game2048", data: BreakoutCheckpoint | Game2048Checkpoint): void {
    const map = this.load();
    if (gameId === "breakout") map.breakout = data as BreakoutCheckpoint;
    else map.game2048 = data as Game2048Checkpoint;
    try {
      localStorage.setItem(CHECKPOINT_SAVE_KEY, JSON.stringify(map));
    } catch {
      /* storage blocked (private mode) — ignore, non-fatal */
    }
  },

  clear(gameId: GameId): void {
    const map = this.load();
    if (gameId === "breakout") delete map.breakout;
    else if (gameId === "game2048") delete map.game2048;
    else return; // no-op for games without checkpoints
    try {
      localStorage.setItem(CHECKPOINT_SAVE_KEY, JSON.stringify(map));
    } catch {
      /* storage blocked (private mode) — ignore, non-fatal */
    }
  },
};
