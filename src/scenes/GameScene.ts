import Phaser from "phaser";
import {
  COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRAVITY_Y,
  GROUND_HEIGHT,
  OBSTACLE_SPEED_MAX,
  OBSTACLE_SPEED_RAMP,
  OBSTACLE_SPEED_START,
  OBSTACLE_WIDTH,
  PLAYER_SIZE,
  PLAYER_X,
  SCORE_PER_PASS,
  SPAWN_DELAY_MIN,
  SPAWN_DELAY_RAMP,
  SPAWN_DELAY_START,
} from "../config/constants";
import type { GameId } from "../config/games";
import { Obstacle } from "../objects/Obstacle";
import { Player } from "../objects/Player";
import type { IGameSDK } from "../sdk/IGameSDK";
import { AudioManager } from "../systems/AudioManager";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

/** The demo mini-game: "Tap Jumper" — a one-button avoider. */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private spawnTimer!: Phaser.Time.TimerEvent;
  private scoreText!: Phaser.GameObjects.Text;

  private sdk!: IGameSDK;
  private audio!: AudioManager;

  private readonly gameId: GameId = "tapjumper";
  private score = 0;
  private groundTop = 0;
  private speed = OBSTACLE_SPEED_START;
  private spawnDelay = SPAWN_DELAY_START;
  private isOver = false;

  constructor() {
    super("Game");
  }

  create(): void {
    // Reset per-run state (scenes are reused across replays).
    this.score = 0;
    this.speed = OBSTACLE_SPEED_START;
    this.spawnDelay = SPAWN_DELAY_START;
    this.isOver = false;

    this.sdk = this.registry.get("sdk") as IGameSDK;
    this.audio = new AudioManager(this);

    this.physics.world.gravity.y = GRAVITY_Y;
    this.groundTop = GAME_HEIGHT - GROUND_HEIGHT;

    this.createPlayer();
    this.createGround();

    this.obstacles = this.physics.add.group();

    this.physics.add.overlap(this.player, this.obstacles, () => this.endRun());

    this.createHud();
    this.bindInput();
    this.startSpawning();

    this.sdk.gameplayStart();
  }

  private createPlayer(): void {
    // Spawn resting on the ground line.
    this.player = new Player(this, this.groundTop - PLAYER_SIZE / 2);
  }

  private createGround(): void {
    const ground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - GROUND_HEIGHT / 2,
      GAME_WIDTH,
      GROUND_HEIGHT,
      COLOR.ground,
    );
    this.physics.add.existing(ground, true); // static body
    this.physics.add.collider(this.player, ground);
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
    const jump = () => {
      this.player.jump();
      this.audio.play("jump");
    };
    this.input.on("pointerdown", jump);
    this.input.keyboard?.on("keydown-SPACE", jump);
  }

  private startSpawning(): void {
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      loop: true,
      callback: this.spawnObstacle,
      callbackScope: this,
    });
  }

  private spawnObstacle(): void {
    if (this.isOver) return;
    const obstacle = new Obstacle(this, this.groundTop, this.speed);
    this.obstacles.add(obstacle);

    // Shorten the spawn cadence toward the floor and reschedule the timer.
    this.spawnDelay = Math.max(SPAWN_DELAY_MIN, this.spawnDelay - SPAWN_DELAY_RAMP);
    this.spawnTimer.reset({
      delay: this.spawnDelay,
      loop: true,
      callback: this.spawnObstacle,
      callbackScope: this,
    });
  }

  update(_time: number, delta: number): void {
    if (this.isOver) return;

    const dt = delta / 1000;
    // Ramp speed toward the cap and re-apply it to live obstacles.
    this.speed = Math.min(OBSTACLE_SPEED_MAX, this.speed + OBSTACLE_SPEED_RAMP * dt);

    for (const child of this.obstacles.getChildren()) {
      const obstacle = child as Obstacle;
      obstacle.setVelocityX(-this.speed);

      // Score once the obstacle's right edge clears the player's X.
      if (!obstacle.counted && obstacle.x + OBSTACLE_WIDTH / 2 < PLAYER_X) {
        obstacle.counted = true;
        this.score += SCORE_PER_PASS;
        this.scoreText.setText(String(this.score));
        this.audio.play("score");
      }

      // Recycle obstacles once fully off-screen left.
      if (obstacle.x < -OBSTACLE_WIDTH) {
        obstacle.destroy();
      }
    }
  }

  private endRun(): void {
    if (this.isOver) return;
    this.isOver = true;

    // Freeze the simulation before awaiting the ad so the frame doesn't drift.
    this.spawnTimer.remove(false);
    this.physics.pause();
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
