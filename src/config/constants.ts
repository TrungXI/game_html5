export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Colors (hex numbers for Phaser)
export const COLOR = {
  bg: 0x1b2838,
  player: 0x4fc3f7,
  obstacle: 0xff6b6b,
  ground: 0x2e3f52,
  text: "#ffffff",
  accent: "#4fc3f7",
} as const;

// Stack Tower — block palette cycles as the tower grows (hex numbers for Phaser).
export const STACK_COLORS = [
  0x4fc3f7, 0xff6b6b, 0xffd166, 0x06d6a0, 0xa78bfa, 0xff9f1c,
] as const;

// Stack Tower tuning
export const STACK_BLOCK_HEIGHT = 90;
export const STACK_BLOCK_WIDTH_START = 480;
export const STACK_SLIDE_SPEED_START = 260; // px/sec, horizontal sweep
export const STACK_SLIDE_SPEED_MAX = 720;
export const STACK_SLIDE_SPEED_RAMP = 14; // px/sec added per placed block
export const STACK_ACTIVE_ROW_Y = 260; // y of the active sliding block
export const STACK_BASE_ROWS_VISIBLE = 9; // rows kept on screen before scrolling

// Player physics
export const GRAVITY_Y = 2200;
export const JUMP_VELOCITY = -820;
export const PLAYER_SIZE = 64;
export const PLAYER_X = 200; // fixed horizontal position

// Ground
export const GROUND_HEIGHT = 160;

// Obstacles
export const OBSTACLE_WIDTH = 70;
export const OBSTACLE_MIN_HEIGHT = 120;
export const OBSTACLE_MAX_HEIGHT = 340;
export const OBSTACLE_SPEED_START = 420; // px/sec, scrolls left
export const OBSTACLE_SPEED_MAX = 900;
export const OBSTACLE_SPEED_RAMP = 6; // px/sec added per second survived
export const SPAWN_DELAY_START = 1500; // ms between obstacles
export const SPAWN_DELAY_MIN = 700;
export const SPAWN_DELAY_RAMP = 20; // ms shaved per spawn

// Scoring
export const SCORE_PER_PASS = 1; // +1 when an obstacle is cleared

// Storage
export const SAVE_KEY = "html5-arcade-starter:v1";
export const MUTE_SAVE_KEY = "html5-arcade-starter:mute:v1";

// SDK — default provider when VITE_SDK_PROVIDER is not set (local dev = noop).
export const SDK_PROVIDER: "noop" | "poki" | "crazygames" = "noop";

// ── Rank / progression ──────────────────────────────────────────────
export const RANK_SAVE_KEY = "html5-arcade-starter:rank:v1";
// XP awarded per game-over run = XP_BASE + floor(score * xpPerPoint[gameId]).
export const XP_BASE = 5;
export const XP_PER_POINT: Record<string, number> = {
  tapjumper: 2, // score is # obstacles passed (small numbers)
  stack: 2, // score is # blocks stacked
  snake: 3, // score is # apples eaten
  breakout: 1, // score is points (10 per brick — larger numbers)
  game2048: 1, // score is the 2048 running score (large)
  // score is 10..1000 move-efficiency points; scale down so one game (~50 XP for a
  // perfect run) stays in line with the other games rather than leaping tiers.
  memory: 0.05,
};
// Rank tiers: cumulative XP thresholds, ascending. index 0 is the floor tier.
export const RANKS: readonly { title: string; minXP: number; color: number }[] = [
  { title: "BRONZE", minXP: 0, color: 0xcd7f32 },
  { title: "SILVER", minXP: 100, color: 0xc0c0c0 },
  { title: "GOLD", minXP: 300, color: 0xffd166 },
  { title: "PLATINUM", minXP: 700, color: 0x4fc3f7 },
  { title: "DIAMOND", minXP: 1500, color: 0x06d6a0 },
];

// ── Checkpoint ──────────────────────────────────────────────────────
export const CHECKPOINT_SAVE_KEY = "html5-arcade-starter:checkpoint:v1";

// ── Menu card grid ──────────────────────────────────────────────────
export const CARD_COLOR = 0x2e3f52;
export const CARD_COLOR_ACTIVE = 0x4fc3f7;

// ── Snake ───────────────────────────────────────────────────────────
export const SNAKE_COLS = 15;
export const SNAKE_ROWS = 20;
export const SNAKE_STEP_MS = 140; // ms per grid step (constant speed)
export const SNAKE_HEAD_COLOR = 0x06d6a0;
export const SNAKE_BODY_COLOR = 0x4fc3f7;
export const SNAKE_FOOD_COLOR = 0xff6b6b;

// ── Breakout ────────────────────────────────────────────────────────
export const BREAKOUT_BRICK_ROWS = 5;
export const BREAKOUT_BRICK_COLS = 8;
export const BREAKOUT_LIVES = 3;
export const BREAKOUT_PADDLE_WIDTH = 200;
export const BREAKOUT_PADDLE_HEIGHT = 32;
export const BREAKOUT_PADDLE_SPEED = 900; // px/sec for keyboard move
export const BREAKOUT_BALL_SIZE = 28;
export const BREAKOUT_BALL_SPEED = 560; // px/sec
export const BREAKOUT_BRICK_SCORE = 10;

// ── 2048 ────────────────────────────────────────────────────────────
export const G2048_SIZE = 4; // 4×4 grid
export const G2048_START_TILES = 2;
export const G2048_WIN_VALUE = 2048;
export const TILE_COLORS: Record<number, number> = {
  2: 0x2e3f52, 4: 0x3a4a5e, 8: 0xff9f1c, 16: 0xff6b6b, 32: 0xff4757,
  64: 0xe8452e, 128: 0xffd166, 256: 0xffc233, 512: 0xffb700,
  1024: 0x06d6a0, 2048: 0x4fc3f7,
};

// ── Per-game accent color ───────────────────────────────────────────
// A distinct tint per game, used as a top strip on its menu card so the grid
// reads at a glance. Keyed by GameId; MenuScene falls back to CARD_COLOR_ACTIVE.
export const GAME_ACCENTS: Record<string, number> = {
  tapjumper: 0x4fc3f7, // sky blue
  stack: 0xffd166, // amber
  snake: 0x06d6a0, // green
  breakout: 0xff6b6b, // coral
  game2048: 0xa78bfa, // violet
  memory: 0xff9f1c, // orange
};

// ── Memory Match ────────────────────────────────────────────────────
export const MEMORY_COLS = 4;
export const MEMORY_ROWS = 4; // 4×4 = 16 cards = 8 pairs (fits 720×1280 portrait)
export const MEMORY_MISMATCH_DELAY = 700; // ms a mismatched pair stays face-up
export const MEMORY_CARD_BACK = 0x2e3f52;
export const MEMORY_CARD_FACE = 0x1b2838;
// Base score for a perfect game; each move over the minimum shaves points (min 10).
export const MEMORY_SCORE_BASE = 1000;
export const MEMORY_SCORE_PER_MOVE = 20;
// The 8 distinct pair identities: a symbol drawn in a color (zero art files).
// `shape` is rendered by MemoryScene's Graphics; each pair shares symbol + color.
export const MEMORY_SYMBOLS: readonly { shape: "circle" | "square" | "triangle" | "diamond"; color: number }[] = [
  { shape: "circle", color: 0x4fc3f7 },
  { shape: "square", color: 0xff6b6b },
  { shape: "triangle", color: 0xffd166 },
  { shape: "diamond", color: 0x06d6a0 },
  { shape: "circle", color: 0xa78bfa },
  { shape: "square", color: 0xff9f1c },
  { shape: "triangle", color: 0x06d6a0 },
  { shape: "diamond", color: 0xff6b6b },
];
