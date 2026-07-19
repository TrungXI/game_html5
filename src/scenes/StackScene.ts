import Phaser from "phaser";
import {
  COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  STACK_ACTIVE_ROW_Y,
  STACK_BASE_ROWS_VISIBLE,
  STACK_BLOCK_HEIGHT,
  STACK_BLOCK_WIDTH_START,
  STACK_COLORS,
  STACK_SLIDE_SPEED_MAX,
  STACK_SLIDE_SPEED_RAMP,
  STACK_SLIDE_SPEED_START,
} from "../config/constants";
import type { GameId } from "../config/games";
import type { IGameSDK } from "../sdk/IGameSDK";
import { AudioManager } from "../systems/AudioManager";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

/** A placed (or in-flight) block described by its left edge and width. */
interface Block {
  rect: Phaser.GameObjects.Rectangle;
  x: number; // left edge, in world space
  width: number;
}

/**
 * "Stack Tower" — a block sweeps across the top; drop it to stack onto the tower.
 * Overhang is sliced off (block shrinks); zero overlap ends the run. All visuals
 * are Phaser rectangles — no external art. Supports pointer and Space.
 */
export class StackScene extends Phaser.Scene {
  private readonly gameId: GameId = "stack";

  private sdk!: IGameSDK;
  private audio!: AudioManager;

  private stack: Block[] = [];
  private active!: Block;
  private direction = 1; // +1 → moving right, -1 → moving left
  private slideSpeed = STACK_SLIDE_SPEED_START;

  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private cameraY = 0; // how far the view has scrolled up
  private isOver = false;
  private locked = false; // ignores input during the drop/slice tween

  constructor() {
    super("Stack");
  }

  create(): void {
    // Reset per-run state (scenes are reused across replays).
    this.stack = [];
    this.direction = 1;
    this.slideSpeed = STACK_SLIDE_SPEED_START;
    this.score = 0;
    this.cameraY = 0;
    this.isOver = false;
    this.locked = false;

    this.sdk = this.registry.get("sdk") as IGameSDK;
    this.audio = new AudioManager(this);
    this.cameras.main.setScroll(0, 0);

    this.createBase();
    this.spawnActive();
    this.createHud();
    this.bindInput();

    this.sdk.gameplayStart();
  }

  /** The foundation the tower is built on — centered, full starting width. */
  private createBase(): void {
    const width = STACK_BLOCK_WIDTH_START;
    const x = (GAME_WIDTH - width) / 2;
    const y = GAME_HEIGHT - STACK_BLOCK_HEIGHT * 2;
    this.stack.push(this.makeBlock(x, y, width, 0));
  }

  /** Spawn the next sliding block at the active row, matching the top block's width. */
  private spawnActive(): void {
    const top = this.stack[this.stack.length - 1];
    const width = top.width;
    // Enter from whichever side leaves room for a full sweep.
    const x = this.direction > 0 ? 0 : GAME_WIDTH - width;
    const y = STACK_ACTIVE_ROW_Y + this.cameraY;
    this.active = this.makeBlock(x, y, width, this.stack.length);
  }

  private makeBlock(x: number, y: number, width: number, index: number): Block {
    const color = STACK_COLORS[index % STACK_COLORS.length];
    const rect = this.add
      .rectangle(x, y, width, STACK_BLOCK_HEIGHT, color)
      .setOrigin(0, 0.5);
    return { rect, x, width };
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 60, "0", {
        color: COLOR.text,
        fontSize: "72px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    this.add
      .text(GAME_WIDTH / 2, 150, `BEST: ${SaveSystem.getHighScore(this.gameId)}`, {
        color: COLOR.accent,
        fontSize: "32px",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
  }

  private bindInput(): void {
    const drop = () => this.drop();
    this.input.on("pointerdown", drop);
    this.input.keyboard?.on("keydown-SPACE", drop);
  }

  update(_time: number, delta: number): void {
    if (this.isOver || this.locked) return;

    const dt = delta / 1000;
    this.active.x += this.direction * this.slideSpeed * dt;

    // Bounce off the play-field edges.
    const maxX = GAME_WIDTH - this.active.width;
    if (this.active.x <= 0) {
      this.active.x = 0;
      this.direction = 1;
    } else if (this.active.x >= maxX) {
      this.active.x = maxX;
      this.direction = -1;
    }
    this.active.rect.x = this.active.x;
  }

  private drop(): void {
    if (this.isOver || this.locked) return;
    this.locked = true;

    const top = this.stack[this.stack.length - 1];
    const left = Math.max(this.active.x, top.x);
    const right = Math.min(this.active.x + this.active.width, top.x + top.width);
    const overlap = right - left;

    if (overlap <= 0) {
      // Missed the tower entirely — the block falls away and the run ends.
      this.audio.play("hit");
      this.dropOffscreen(this.active.rect);
      this.endRun();
      return;
    }

    // Slice the overhang: the surviving block is exactly the overlap region.
    // Capture original geometry before mutating so the sliver reads pre-slice edges.
    const overhang = this.active.width - overlap;
    const origLeft = this.active.x;
    const origWidth = this.active.width;
    this.active.rect.x = left;
    this.active.rect.width = overlap;
    this.active.rect.setOrigin(0, 0.5); // width change keeps left-anchored origin
    this.active.x = left;
    this.active.width = overlap;

    if (overhang > 0.5) this.spawnSliver(origLeft, origWidth, left, overlap);

    this.stack.push(this.active);
    this.score += 1;
    this.scoreText.setText(String(this.score));
    this.audio.play("score");

    // Ramp the sweep speed toward the cap for the next block.
    this.slideSpeed = Math.min(
      STACK_SLIDE_SPEED_MAX,
      this.slideSpeed + STACK_SLIDE_SPEED_RAMP,
    );

    this.scrollUpIfNeeded(() => {
      this.direction = this.direction > 0 ? -1 : 1; // alternate entry side
      this.spawnActive();
      this.locked = false;
    });
  }

  /** The sliced-off overhang piece, animated falling away for feedback. */
  private spawnSliver(
    origLeft: number,
    origWidth: number,
    overlapLeft: number,
    overlapWidth: number,
  ): void {
    const origRight = origLeft + origWidth;
    const overlapRight = overlapLeft + overlapWidth;
    let sliverX: number;
    let sliverW: number;
    if (origLeft < overlapLeft) {
      // Overhang on the left of the overlap region.
      sliverX = origLeft;
      sliverW = overlapLeft - origLeft;
    } else {
      // Overhang on the right of the overlap region.
      sliverX = overlapRight;
      sliverW = origRight - overlapRight;
    }
    if (sliverW <= 0.5) return;

    const color = STACK_COLORS[(this.stack.length) % STACK_COLORS.length];
    const sliver = this.add
      .rectangle(sliverX, this.active.rect.y, sliverW, STACK_BLOCK_HEIGHT, color)
      .setOrigin(0, 0.5)
      .setAlpha(0.9);
    this.dropOffscreen(sliver);
  }

  private dropOffscreen(rect: Phaser.GameObjects.Rectangle): void {
    this.tweens.add({
      targets: rect,
      y: rect.y + GAME_HEIGHT,
      angle: Phaser.Math.Between(-45, 45),
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeIn",
      onComplete: () => rect.destroy(),
    });
  }

  /**
   * Once the tower is tall enough, pan the camera up so the active row stays
   * near the top. Runs the callback after the pan tween (or immediately).
   */
  private scrollUpIfNeeded(done: () => void): void {
    const towerHeight = this.stack.length * STACK_BLOCK_HEIGHT;
    const threshold = STACK_BASE_ROWS_VISIBLE * STACK_BLOCK_HEIGHT;
    if (towerHeight <= threshold) {
      done();
      return;
    }

    const targetY = this.cameraY + STACK_BLOCK_HEIGHT;
    this.cameraY = targetY;
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: targetY,
      duration: 180,
      ease: "Sine.easeInOut",
      onComplete: done,
    });
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
