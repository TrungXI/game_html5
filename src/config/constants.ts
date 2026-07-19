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

// SDK — default provider when VITE_SDK_PROVIDER is not set (local dev = noop).
export const SDK_PROVIDER: "noop" | "poki" | "crazygames" = "noop";
