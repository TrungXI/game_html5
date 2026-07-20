import Phaser from "phaser";
import {
  COLOR,
  GAME_WIDTH,
  WHACK_COLS,
  WHACK_DURATION_MS,
  WHACK_HOLE_COLOR,
  WHACK_MOLE_COLORS,
  WHACK_POINTS_PER_HIT,
  WHACK_ROWS,
  WHACK_SPAWN_INTERVAL_MIN,
  WHACK_SPAWN_INTERVAL_START,
  WHACK_UP_DURATION_MIN,
  WHACK_UP_DURATION_START,
} from "../config/constants";
import type { GameId } from "../config/games";
import type { IGameSDK } from "../sdk/IGameSDK";
import { AudioManager } from "../systems/AudioManager";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

const HOLE_COUNT = WHACK_COLS * WHACK_ROWS;
const GRID_TOP = 320;
const HOLE_GAP = 30;

/** One hole slot: its center, drawn mole container, and up/down state. */
interface Hole {
  cx: number;
  cy: number;
  mole: Phaser.GameObjects.Container; // the drawn mole, shown only when up
  up: boolean;
  hideAt: number; // scene time (ms) at which an up mole auto-hides
}

/**
 * "Whack-a-Mole" — a 3×3 grid of dark holes. Moles pop up at random empty holes
 * for a shrinking window; tap one (or press its number key 1-9) while it's up to
 * score. A 30-second clock ticks down, and as it does moles appear more often and
 * stay up for less time. Every mole is a Graphics circle + face — zero art files.
 * Playable by pointer and keyboard. No checkpoint (opted out per SPEC).
 */
export class WhackScene extends Phaser.Scene {
  private readonly gameId: GameId = "whack";

  private sdk!: IGameSDK;
  private audio!: AudioManager;

  private holes: Hole[] = [];
  private score = 0;
  private isOver = false;
  private startTime = 0; // scene time (ms) at which the run began
  private nextSpawnAt = 0; // scene time (ms) of the next scheduled pop-up
  private colorCursor = 0; // rotates the mole palette per pop

  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private holeRadiusX = 0;
  private holeRadiusY = 0;

  constructor() {
    super("Whack");
  }

  create(): void {
    // Reset per-run state (scenes are reused across replays).
    this.holes = [];
    this.score = 0;
    this.isOver = false;
    this.colorCursor = 0;

    this.sdk = this.registry.get("sdk") as IGameSDK;
    this.audio = new AudioManager(this);

    // Ellipse holes sized to tile the grid across the play width.
    const cellW = (GAME_WIDTH - HOLE_GAP * (WHACK_COLS + 1)) / WHACK_COLS;
    const cellH = cellW; // square cells → round-ish holes
    this.holeRadiusX = cellW * 0.42;
    this.holeRadiusY = cellH * 0.3;

    this.createHud();
    this.buildGrid(cellW, cellH);
    this.bindInput();

    this.startTime = this.time.now;
    this.nextSpawnAt = this.startTime + WHACK_SPAWN_INTERVAL_START;

    this.sdk.gameplayStart();
  }

  private createHud(): void {
    this.add
      .text(GAME_WIDTH / 2, 60, "WHACK", {
        color: COLOR.accent,
        fontSize: "60px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 150, "SCORE: 0", {
        color: COLOR.text,
        fontSize: "40px",
      })
      .setOrigin(0.5, 0);

    this.timeText = this.add
      .text(GAME_WIDTH / 2, 210, "TIME: 30", {
        color: COLOR.accent,
        fontSize: "36px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 260, `BEST: ${SaveSystem.getHighScore(this.gameId)}`, {
        color: COLOR.accent,
        fontSize: "28px",
      })
      .setOrigin(0.5, 0);
  }

  /** Lay out the 3×3 holes; each holds a hidden mole ready to pop up. */
  private buildGrid(cellW: number, cellH: number): void {
    for (let index = 0; index < HOLE_COUNT; index++) {
      const col = index % WHACK_COLS;
      const row = Math.floor(index / WHACK_COLS);
      const cx = HOLE_GAP + col * (cellW + HOLE_GAP) + cellW / 2;
      const cy = GRID_TOP + row * (cellH + HOLE_GAP) + cellH / 2;

      // Dark ground ellipse the mole rises out of.
      this.add.ellipse(cx, cy, this.holeRadiusX * 2, this.holeRadiusY * 2, WHACK_HOLE_COLOR);

      const mole = this.add.container(cx, cy);
      mole.setVisible(false);
      mole.setInteractive(
        new Phaser.Geom.Circle(0, 0, this.holeRadiusX),
        Phaser.Geom.Circle.Contains,
      );
      mole.on("pointerdown", () => this.whack(index));

      this.holes.push({ cx, cy, mole, up: false, hideAt: 0 });
    }
  }

  /** Draw a mole (colored circle + simple face) into an empty container. */
  private drawMole(hole: Hole): void {
    const color = WHACK_MOLE_COLORS[this.colorCursor % WHACK_MOLE_COLORS.length];
    this.colorCursor += 1;
    const r = this.holeRadiusX * 0.9;

    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.fillCircle(0, 0, r);
    // Eyes + a small snout — enough to read as a face, all Graphics (no art files).
    body.fillStyle(0xffffff, 1);
    body.fillCircle(-r * 0.35, -r * 0.2, r * 0.18);
    body.fillCircle(r * 0.35, -r * 0.2, r * 0.18);
    body.fillStyle(0x000000, 1);
    body.fillCircle(-r * 0.35, -r * 0.2, r * 0.09);
    body.fillCircle(r * 0.35, -r * 0.2, r * 0.09);
    body.fillStyle(0x2b1a10, 1);
    body.fillCircle(0, r * 0.25, r * 0.16);

    hole.mole.removeAll(true);
    hole.mole.add(body);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    // Number keys 1-9 map to the 9 holes. Phaser names digit keys with spelled-out
    // words (keydown-ONE..NINE), not the numeric string.
    const DIGIT_NAMES = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
    DIGIT_NAMES.forEach((name, i) => {
      kb.on(`keydown-${name}`, () => this.whack(i));
    });
  }

  /** How far through the run we are, 0 at the start → 1 at the final second. */
  private progress(): number {
    const elapsed = this.time.now - this.startTime;
    return Phaser.Math.Clamp(elapsed / WHACK_DURATION_MS, 0, 1);
  }

  /** Current pop-up interval, lerped shorter as the run progresses. */
  private spawnInterval(): number {
    return Phaser.Math.Linear(
      WHACK_SPAWN_INTERVAL_START,
      WHACK_SPAWN_INTERVAL_MIN,
      this.progress(),
    );
  }

  /** Current up-window, lerped shorter as the run progresses. */
  private upDuration(): number {
    return Phaser.Math.Linear(
      WHACK_UP_DURATION_START,
      WHACK_UP_DURATION_MIN,
      this.progress(),
    );
  }

  /** Whack a hole: score + pop only if a mole is currently up there. */
  private whack(index: number): void {
    if (this.isOver) return;
    const hole = this.holes[index];
    if (!hole.up) return;

    // Hide immediately so a mole can't be double-hit.
    hole.up = false;
    this.score += WHACK_POINTS_PER_HIT;
    this.scoreText.setText(`SCORE: ${this.score}`);
    this.audio.play("score");

    // A quick pop tween on the mole before it vanishes.
    this.tweens.add({
      targets: hole.mole,
      scale: { from: 1, to: 1.35 },
      alpha: { from: 1, to: 0 },
      duration: 120,
      ease: "Quad.easeOut",
      onComplete: () => {
        hole.mole.setVisible(false).setScale(1).setAlpha(1);
      },
    });
  }

  /** Raise a mole at a random empty hole. */
  private popMole(): void {
    const empties = this.holes.filter((h) => !h.up && !h.mole.visible);
    if (empties.length === 0) return;
    const hole = Phaser.Utils.Array.GetRandom(empties);

    this.drawMole(hole);
    hole.up = true;
    hole.hideAt = this.time.now + this.upDuration();
    hole.mole.setVisible(true).setScale(0).setAlpha(1);
    // Rise: a short scale-up so the mole reads as popping out of its hole.
    this.tweens.add({
      targets: hole.mole,
      scale: 1,
      duration: 90,
      ease: "Back.easeOut",
    });
  }

  /** Auto-hide a mole whose up-window elapsed without a hit. */
  private hideMole(hole: Hole): void {
    hole.up = false;
    hole.mole.setVisible(false).setScale(1).setAlpha(1);
  }

  update(): void {
    if (this.isOver) return;

    const now = this.time.now;
    const remainingMs = WHACK_DURATION_MS - (now - this.startTime);
    if (remainingMs <= 0) {
      this.timeText.setText("TIME: 0");
      this.endRun();
      return;
    }
    this.timeText.setText(`TIME: ${Math.ceil(remainingMs / 1000)}`);

    // Retire any moles whose visible window has passed.
    for (const hole of this.holes) {
      if (hole.up && now >= hole.hideAt) this.hideMole(hole);
    }

    // Spawn on schedule, then book the next pop-up at the current (ramped) rate.
    if (now >= this.nextSpawnAt) {
      this.popMole();
      this.nextSpawnAt = now + this.spawnInterval();
    }
  }

  private endRun(): void {
    if (this.isOver) return;
    this.isOver = true;
    this.audio.play("lose");

    this.sdk.gameplayStop();
    const isNewBest = SaveSystem.submitScore(this.gameId, this.score);
    RankSystem.addXP(this.gameId, this.score);
    const highScore = SaveSystem.getHighScore(this.gameId);

    void this.sdk.showInterstitial().then(() => {
      this.scene.start("GameOver", {
        gameId: this.gameId,
        score: this.score,
        highScore,
        isNewBest,
      });
    });
  }
}
