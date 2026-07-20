/** Stable identifier for a game — also the key under which its high score is stored. */
export type GameId =
  | "tapjumper"
  | "stack"
  | "snake"
  | "breakout"
  | "game2048"
  | "memory"
  | "whack";

export interface GameMeta {
  id: GameId;
  title: string;
  /** The Phaser scene key started when this game is chosen. */
  sceneKey: string;
  /** True if this game persists an in-progress state that can be resumed. */
  supportsCheckpoint: boolean;
}

/**
 * Registry of every playable game. MenuScene renders one button per entry and
 * GameOverScene looks up the sceneKey to restart the right game. To add a new
 * game: create its scene, register the scene in gameConfig, then add a row here.
 */
export const GAMES: readonly GameMeta[] = [
  { id: "tapjumper", title: "TAP JUMPER", sceneKey: "Game", supportsCheckpoint: false },
  { id: "stack", title: "STACK TOWER", sceneKey: "Stack", supportsCheckpoint: false },
  { id: "snake", title: "SNAKE", sceneKey: "Snake", supportsCheckpoint: false },
  { id: "breakout", title: "BREAKOUT", sceneKey: "Breakout", supportsCheckpoint: true },
  { id: "game2048", title: "2048", sceneKey: "Game2048", supportsCheckpoint: true },
  { id: "memory", title: "MEMORY", sceneKey: "Memory", supportsCheckpoint: false },
  { id: "whack", title: "WHACK", sceneKey: "Whack", supportsCheckpoint: false },
];

export function getGameMeta(id: GameId): GameMeta {
  const meta = GAMES.find((g) => g.id === id);
  if (!meta) throw new Error(`Unknown game id: ${id}`);
  return meta;
}
