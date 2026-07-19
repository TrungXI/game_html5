import Phaser from "phaser";
import {
  BREAKOUT_BALL_SIZE,
  BREAKOUT_BALL_SPEED,
  BREAKOUT_BRICK_COLS,
  BREAKOUT_BRICK_ROWS,
  BREAKOUT_BRICK_SCORE,
  BREAKOUT_LIVES,
  BREAKOUT_PADDLE_HEIGHT,
  BREAKOUT_PADDLE_SPEED,
  BREAKOUT_PADDLE_WIDTH,
  COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  STACK_COLORS,
} from "../config/constants";
import type { GameId } from "../config/games";
import type { IGameSDK } from "../sdk/IGameSDK";
import { AudioManager } from "../systems/AudioManager";
import { CheckpointSystem, type BreakoutCheckpoint } from "../systems/CheckpointSystem";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

const BRICK_COUNT = BREAKOUT_BRICK_ROWS * BREAKOUT_BRICK_COLS;
const BRICK_TOP = 260; // y of the first brick row
const BRICK_GAP = 8;
const BRICK_HEIGHT = 44;

/**
 * "Breakout" — paddle bounces a ball to clear brick rows. Endless levels, 3
 * lives, arcade physics. Playable by pointer (paddle follows) or arrow keys.
 * Persists a checkpoint (level/lives/score/brick layout) so a run can resume.
 */
export class BreakoutScene extends Phaser.Scene {
  private readonly gameId: GameId = "breakout";

  private sdk!: IGameSDK;
  private audio!: AudioManager;

  private paddle!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
  private ball!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
  private bricks!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private level = 1;
  private lives = BREAKOUT_LIVES;
  private score = 0;
  private waiting = true; // ball resting on paddle, awaiting serve
  private isOver = false;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;

  private resumeRequested = false;
  private brickWidth = 0;

  constructor() {
    super("Breakout");
  }

  init(data: { resume?: boolean }): void {
    this.resumeRequested = data?.resume === true;
  }

  create(): void {
    // Reset per-run state (scenes are reused across replays).
    this.level = 1;
    this.lives = BREAKOUT_LIVES;
    this.score = 0;
    this.waiting = true;
    this.isOver = false;

    this.sdk = this.registry.get("sdk") as IGameSDK;
    this.audio = new AudioManager(this);
    this.cursors = this.input.keyboard!.createCursorKeys();

    // World bounds bounce off left/right/top only — the floor is a life loss.
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.brickWidth =
      (GAME_WIDTH - BRICK_GAP * (BREAKOUT_BRICK_COLS + 1)) / BREAKOUT_BRICK_COLS;

    this.createPaddle();
    this.createBall();
    this.bricks = this.physics.add.staticGroup();

    this.physics.add.collider(this.ball, this.paddle, this.onPaddleHit, undefined, this);
    this.physics.add.collider(this.ball, this.bricks, this.onBrickHit, undefined, this);

    // Resume from a valid checkpoint, else start a fresh level-1 grid.
    const saved = this.resumeRequested ? CheckpointSystem.get("breakout") : undefined;
    if (saved) {
      this.level = saved.level;
      this.lives = saved.lives;
      this.score = saved.score;
      this.buildBricks(saved.bricks);
    } else {
      this.buildBricks(new Array<boolean>(BRICK_COUNT).fill(true));
    }

    this.createHud();
    this.bindInput();
    this.resetBall(); // rest on paddle, wait for serve

    this.sdk.gameplayStart();
  }

  private createPaddle(): void {
    this.paddle = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 160,
      BREAKOUT_PADDLE_WIDTH,
      BREAKOUT_PADDLE_HEIGHT,
      COLOR.player,
    ) as Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    this.physics.add.existing(this.paddle);
    this.paddle.body.setImmovable(true);
    this.paddle.body.setAllowGravity(false);
    this.paddle.body.setCollideWorldBounds(true);
  }

  private createBall(): void {
    this.ball = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 200,
      BREAKOUT_BALL_SIZE,
      BREAKOUT_BALL_SIZE,
      0xffffff,
    ) as Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
    this.physics.add.existing(this.ball);
    this.ball.body.setBounce(1, 1);
    this.ball.body.setCollideWorldBounds(true);
    this.ball.body.setAllowGravity(false);
  }

  /** Build the brick grid from an alive-mask; each brick tagged with its flat index. */
  private buildBricks(alive: boolean[]): void {
    this.bricks.clear(true, true);
    for (let row = 0; row < BREAKOUT_BRICK_ROWS; row++) {
      for (let col = 0; col < BREAKOUT_BRICK_COLS; col++) {
        const index = row * BREAKOUT_BRICK_COLS + col;
        if (!alive[index]) continue;
        const x = BRICK_GAP + col * (this.brickWidth + BRICK_GAP) + this.brickWidth / 2;
        const y = BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP);
        const brick = this.add.rectangle(
          x,
          y,
          this.brickWidth,
          BRICK_HEIGHT,
          STACK_COLORS[row % STACK_COLORS.length],
        );
        this.bricks.add(brick);
        brick.setData("index", index);
      }
    }
  }

  /** Snapshot the current alive/dead state of every brick slot. */
  private brickMask(): boolean[] {
    const mask = new Array<boolean>(BRICK_COUNT).fill(false);
    for (const child of this.bricks.getChildren()) {
      const index = (child as Phaser.GameObjects.Rectangle).getData("index") as number;
      mask[index] = true;
    }
    return mask;
  }

  private saveCheckpoint(): void {
    const data: BreakoutCheckpoint = {
      level: this.level,
      lives: this.lives,
      score: this.score,
      bricks: this.brickMask(),
    };
    CheckpointSystem.save("breakout", data);
  }

  private createHud(): void {
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 60, "0", {
        color: COLOR.text,
        fontSize: "72px",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);
    this.scoreText.setText(String(this.score));

    this.livesText = this.add
      .text(GAME_WIDTH - 24, 60, "", {
        color: COLOR.accent,
        fontSize: "32px",
      })
      .setOrigin(1, 0);

    this.add
      .text(24, 60, `BEST: ${SaveSystem.getHighScore(this.gameId)}`, {
        color: COLOR.accent,
        fontSize: "32px",
      })
      .setOrigin(0, 0);

    this.updateHud();
  }

  private updateHud(): void {
    this.scoreText.setText(String(this.score));
    this.livesText.setText(`LIVES: ${this.lives}`);
  }

  private bindInput(): void {
    // Pointer: paddle center tracks pointer.x (clamped); tap also serves.
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.movePaddleTo(p.x));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.movePaddleTo(p.x);
      this.serve();
    });
    // Keyboard: SPACE serves; ←/→ handled in update() for held-key movement.
    this.input.keyboard?.on("keydown-SPACE", () => this.serve());
  }

  private movePaddleTo(x: number): void {
    const half = BREAKOUT_PADDLE_WIDTH / 2;
    this.paddle.x = Phaser.Math.Clamp(x, half, GAME_WIDTH - half);
  }

  /** Serve the resting ball upward at a slight angle; speeds up per level. */
  private serve(): void {
    if (this.isOver || !this.waiting) return;
    this.waiting = false;
    const speed = Math.min(BREAKOUT_BALL_SPEED * 1.6, BREAKOUT_BALL_SPEED * (1 + 0.1 * (this.level - 1)));
    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-30, 30) - 90); // upward
    this.ball.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  /** Rest the ball on the paddle and wait for the next serve. */
  private resetBall(): void {
    this.waiting = true;
    this.ball.body.setVelocity(0, 0);
    this.ball.setPosition(this.paddle.x, this.paddle.y - BREAKOUT_PADDLE_HEIGHT);
  }

  update(_time: number, delta: number): void {
    if (this.isOver) return;

    // Keyboard paddle movement (held keys).
    const dt = delta / 1000;
    if (this.cursors.left.isDown) this.movePaddleTo(this.paddle.x - BREAKOUT_PADDLE_SPEED * dt);
    else if (this.cursors.right.isDown) this.movePaddleTo(this.paddle.x + BREAKOUT_PADDLE_SPEED * dt);

    // The ball follows the paddle until served.
    if (this.waiting) {
      this.ball.setPosition(this.paddle.x, this.paddle.y - BREAKOUT_PADDLE_HEIGHT);
      return;
    }

    // Ball dropped below the floor → lose a life.
    if (this.ball.y - BREAKOUT_BALL_SIZE / 2 > GAME_HEIGHT) this.loseLife();
  }

  /** Reflect the ball based on where it struck the paddle for player control. */
  private onPaddleHit(): void {
    const offset = (this.ball.x - this.paddle.x) / (BREAKOUT_PADDLE_WIDTH / 2); // -1..1
    const speed = this.ball.body.velocity.length() || BREAKOUT_BALL_SPEED;
    const angle = Phaser.Math.DegToRad(-90 + offset * 60); // steer left/right, always upward
    this.ball.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.audio.play("score");
  }

  private onBrickHit(
    _ball:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
    brickObj:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
  ): void {
    const brick = brickObj as Phaser.GameObjects.Rectangle;
    brick.destroy();
    this.score += BREAKOUT_BRICK_SCORE;
    this.updateHud();
    this.audio.play("hit");
    this.saveCheckpoint(); // persist after each brick cleared

    if (this.bricks.countActive(true) === 0) this.nextLevel();
  }

  /** Empty grid → advance to the next (harder) level; checkpoint is NOT cleared. */
  private nextLevel(): void {
    this.level += 1;
    this.buildBricks(new Array<boolean>(BRICK_COUNT).fill(true));
    this.resetBall();
  }

  private loseLife(): void {
    this.lives -= 1;
    this.updateHud();
    this.audio.play("hit");
    this.saveCheckpoint(); // persist after each life lost
    if (this.lives <= 0) {
      this.endRun();
      return;
    }
    this.resetBall();
  }

  private endRun(): void {
    if (this.isOver) return;
    this.isOver = true;
    this.ball.body.setVelocity(0, 0);

    this.sdk.gameplayStop();
    CheckpointSystem.clear(this.gameId);
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
