/** Stable identifier for a game — also the key under which its high score is stored. */
export type GameId = "tapjumper" | "stack";

export interface GameMeta {
  id: GameId;
  title: string;
  /** The Phaser scene key started when this game is chosen. */
  sceneKey: string;
}

/**
 * Registry of every playable game. MenuScene renders one button per entry and
 * GameOverScene looks up the sceneKey to restart the right game. To add a new
 * game: create its scene, register the scene in gameConfig, then add a row here.
 */
export const GAMES: readonly GameMeta[] = [
  { id: "tapjumper", title: "TAP JUMPER", sceneKey: "Game" },
  { id: "stack", title: "STACK TOWER", sceneKey: "Stack" },
];

export function getGameMeta(id: GameId): GameMeta {
  const meta = GAMES.find((g) => g.id === id);
  if (!meta) throw new Error(`Unknown game id: ${id}`);
  return meta;
}
