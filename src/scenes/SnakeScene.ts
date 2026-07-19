import Phaser from "phaser";
import {
  COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  SNAKE_BODY_COLOR,
  SNAKE_COLS,
  SNAKE_FOOD_COLOR,
  SNAKE_HEAD_COLOR,
  SNAKE_ROWS,
  SNAKE_STEP_MS,
} from "../config/constants";
import type { GameId } from "../config/games";
import type { IGameSDK } from "../sdk/IGameSDK";
import { AudioManager } from "../systems/AudioManager";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

interface Cell {
  c: number;
  r: number;
}

/**
 * "Snake" — grid-based; grow on eat, die on wall/self. Grid steps on a fixed
 * timer. Playable by arrow keys or swipe. Zero external art — every cell is a
 * Phaser rectangle redrawn each tick. No checkpoint (opted out per SPEC).
 */
export class SnakeScene extends Phaser.Scene {
  private readonly gameId: GameId = "snake";

  private sdk!: IGameSDK;
  private audio!: AudioManager;

  private snake: Cell[] = []; // head first
  private food!: Cell;
  private dir: Cell = { c: 1, r: 0 }; // current direction (committed each step)
  private nextDir: Cell = { c: 1, r: 0 }; // buffered input, applied at next step

  private cell = 0; // pixel size of one grid cell
  private originX = 0; // playfield top-left in world space
  private originY = 0;

  private cellLayer!: Phaser.GameObjects.Container; // redrawn each tick
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private isOver = false;

  private swipeStart: { x: number; y: number } | null = null;

  constructor() {
    super("Snake");
  }

  create(): void {
    // Reset per-run state (scenes are reused across replays).
    this.snake = [];
    this.dir = { c: 1, r: 0 };
    this.nextDir = { c: 1, r: 0 };
    this.score = 0;
    this.isOver = false;
    this.swipeStart = null;

    this.sdk = this.registry.get("sdk") as IGameSDK;
    this.audio = new AudioManager(this);

    // Center the playfield horizontally; leave a HUD band at the top.
    this.cell = Math.floor(GAME_WIDTH / SNAKE_COLS);
    const fieldW = this.cell * SNAKE_COLS;
    const fieldH = this.cell * SNAKE_ROWS;
    this.originX = Math.floor((GAME_WIDTH - fieldW) / 2);
    this.originY = Math.floor((GAME_HEIGHT - fieldH) / 2) + 60;

    this.drawField();
    this.cellLayer = this.add.container(0, 0);

    // Seed the snake in the middle, length 3, heading right.
    const midC = Math.floor(SNAKE_COLS / 2);
    const midR = Math.floor(SNAKE_ROWS / 2);
    this.snake = [
      { c: midC, r: midR },
      { c: midC - 1, r: midR },
      { c: midC - 2, r: midR },
    ];
    this.placeFood();
    this.redraw();

    this.createHud();
    this.bindInput();

    this.time.addEvent({
      delay: SNAKE_STEP_MS,
      loop: true,
      callback: this.step,
      callbackScope: this,
    });

    this.sdk.gameplayStart();
  }

  /** Static border framing the grid so the wall bounds read clearly. */
  private drawField(): void {
    const fieldW = this.cell * SNAKE_COLS;
    const fieldH = this.cell * SNAKE_ROWS;
    this.add
      .rectangle(this.originX, this.originY, fieldW, fieldH, COLOR.ground)
      .setOrigin(0, 0);
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 60, "0", {
        color: COLOR.text,
        fontSize: "72px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, 150, `BEST: ${SaveSystem.getHighScore(this.gameId)}`, {
        color: COLOR.accent,
        fontSize: "32px",
      })
      .setOrigin(0.5, 0);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    kb?.on("keydown-LEFT", () => this.queueDir(-1, 0));
    kb?.on("keydown-RIGHT", () => this.queueDir(1, 0));
    kb?.on("keydown-UP", () => this.queueDir(0, -1));
    kb?.on("keydown-DOWN", () => this.queueDir(0, 1));

    // Swipe: record where the drag began, decide the axis on release.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return; // tap, not a swipe
      if (Math.abs(dx) > Math.abs(dy)) this.queueDir(Math.sign(dx), 0);
      else this.queueDir(0, Math.sign(dy));
    });
  }

  /** Buffer a direction, rejecting a direct 180° reversal onto the neck. */
  private queueDir(c: number, r: number): void {
    if (c === -this.dir.c && r === -this.dir.r) return;
    this.nextDir = { c, r };
  }

  private placeFood(): void {
    const free: Cell[] = [];
    for (let r = 0; r < SNAKE_ROWS; r++) {
      for (let c = 0; c < SNAKE_COLS; c++) {
        if (!this.snake.some((s) => s.c === c && s.r === r)) free.push({ c, r });
      }
    }
    // Board full is effectively a win; keep the last food to avoid an empty pick.
    if (free.length === 0) return;
    this.food = Phaser.Utils.Array.GetRandom(free);
  }

  private step(): void {
    if (this.isOver) return;

    // Commit the buffered direction at the start of the tick (prevents
    // double-turn self-kills within a single cell).
    this.dir = this.nextDir;

    const head = this.snake[0];
    const next: Cell = { c: head.c + this.dir.c, r: head.r + this.dir.r };

    // Wall collision.
    if (next.c < 0 || next.c >= SNAKE_COLS || next.r < 0 || next.r >= SNAKE_ROWS) {
      this.endRun();
      return;
    }

    const ate = next.c === this.food.c && next.r === this.food.r;

    // Self collision — the tail cell is free this tick unless we just grew.
    const body = ate ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.c === next.c && s.r === next.r)) {
      this.endRun();
      return;
    }

    this.snake.unshift(next);
    if (ate) {
      this.score += 1;
      this.scoreText.setText(String(this.score));
      this.audio.play("score");
      this.placeFood();
    } else {
      this.snake.pop();
    }

    this.redraw();
  }

  /** Clear and rebuild every cell rectangle for the current snake + food. */
  private redraw(): void {
    this.cellLayer.removeAll(true);
    const inset = 2;
    const size = this.cell - inset * 2;

    this.cellLayer.add(
      this.add
        .rectangle(
          this.originX + this.food.c * this.cell + inset,
          this.originY + this.food.r * this.cell + inset,
          size,
          size,
          SNAKE_FOOD_COLOR,
        )
        .setOrigin(0, 0),
    );

    this.snake.forEach((seg, i) => {
      this.cellLayer.add(
        this.add
          .rectangle(
            this.originX + seg.c * this.cell + inset,
            this.originY + seg.r * this.cell + inset,
            size,
            size,
            i === 0 ? SNAKE_HEAD_COLOR : SNAKE_BODY_COLOR,
          )
          .setOrigin(0, 0),
      );
    });
  }

  private endRun(): void {
    if (this.isOver) return;
    this.isOver = true;
    this.audio.play("hit");

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
