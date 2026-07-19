import Phaser from "phaser";
import {
  COLOR,
  G2048_SIZE,
  G2048_START_TILES,
  G2048_WIN_VALUE,
  GAME_HEIGHT,
  GAME_WIDTH,
  TILE_COLORS,
} from "../config/constants";
import type { GameId } from "../config/games";
import type { IGameSDK } from "../sdk/IGameSDK";
import { AudioManager } from "../systems/AudioManager";
import { CheckpointSystem } from "../systems/CheckpointSystem";
import { RankSystem } from "../systems/RankSystem";
import { SaveSystem } from "../systems/SaveSystem";

const BOARD_GAP = 16;
const DEFAULT_TILE_COLOR = 0x3a4a5e; // fallback for values above the palette (>2048)

/**
 * "2048" — slide-and-merge on a 4×4 grid. Arrow keys or swipe. Persists a
 * checkpoint (board + score) after every board-changing move so a run resumes
 * to the exact state. Game over when no move changes the board.
 */
export class Game2048Scene extends Phaser.Scene {
  private readonly gameId: GameId = "game2048";

  private sdk!: IGameSDK;
  private audio!: AudioManager;

  private board: number[][] = [];
  private score = 0;
  private isOver = false;
  private won = false; // flashed the "2048!" banner once

  private scoreText!: Phaser.GameObjects.Text;
  private tileLayer!: Phaser.GameObjects.Container; // rebuilt each move

  private tileSize = 0;
  private boardX = 0; // board top-left in world space
  private boardY = 0;

  private resumeRequested = false;
  private swipeStart: { x: number; y: number } | null = null;

  constructor() {
    super("Game2048");
  }

  init(data: { resume?: boolean }): void {
    this.resumeRequested = data?.resume === true;
  }

  create(): void {
    // Reset per-run state (scenes are reused across replays).
    this.score = 0;
    this.isOver = false;
    this.won = false;
    this.swipeStart = null;

    this.sdk = this.registry.get("sdk") as IGameSDK;
    this.audio = new AudioManager(this);

    // Center a square board below the HUD band.
    const boardPx = GAME_WIDTH - 80;
    this.tileSize = (boardPx - BOARD_GAP * (G2048_SIZE + 1)) / G2048_SIZE;
    this.boardX = (GAME_WIDTH - boardPx) / 2;
    this.boardY = 260;

    this.add
      .rectangle(this.boardX, this.boardY, boardPx, boardPx, COLOR.ground)
      .setOrigin(0, 0);
    this.tileLayer = this.add.container(0, 0);

    // Resume from a valid checkpoint, else start fresh.
    const saved = this.resumeRequested ? CheckpointSystem.get("game2048") : undefined;
    if (saved) {
      this.board = saved.board.map((row) => [...row]);
      this.score = saved.score;
    } else {
      this.board = this.emptyBoard();
      for (let i = 0; i < G2048_START_TILES; i++) this.spawnTile();
    }

    this.createHud();
    this.bindInput();
    this.render();

    this.sdk.gameplayStart();
  }

  private emptyBoard(): number[][] {
    return Array.from({ length: G2048_SIZE }, () => new Array<number>(G2048_SIZE).fill(0));
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

    this.add
      .text(GAME_WIDTH / 2, 150, `BEST: ${SaveSystem.getHighScore(this.gameId)}`, {
        color: COLOR.accent,
        fontSize: "32px",
      })
      .setOrigin(0.5, 0);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    kb?.on("keydown-LEFT", () => this.move(-1, 0));
    kb?.on("keydown-RIGHT", () => this.move(1, 0));
    kb?.on("keydown-UP", () => this.move(0, -1));
    kb?.on("keydown-DOWN", () => this.move(0, 1));

    // Swipe: dominant axis of the drag delta (threshold ≥ 24px).
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return; // tap, not a swipe
      if (Math.abs(dx) > Math.abs(dy)) this.move(Math.sign(dx), 0);
      else this.move(0, Math.sign(dy));
    });
  }

  private spawnTile(): void {
    const empties: { r: number; c: number }[] = [];
    for (let r = 0; r < G2048_SIZE; r++) {
      for (let c = 0; c < G2048_SIZE; c++) {
        if (this.board[r][c] === 0) empties.push({ r, c });
      }
    }
    if (empties.length === 0) return;
    const { r, c } = Phaser.Utils.Array.GetRandom(empties);
    this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  /**
   * Slide + merge in the given direction. Returns true if the board changed.
   * Each line is compacted (0s removed), equal neighbours merge once, then it
   * is padded back to length — reversed for right/down moves.
   */
  private move(dc: number, dr: number): void {
    if (this.isOver) return;

    const before = JSON.stringify(this.board);
    if (dc !== 0) {
      for (let r = 0; r < G2048_SIZE; r++) {
        this.board[r] = this.collapseLine(this.board[r], dc > 0);
      }
    } else {
      for (let c = 0; c < G2048_SIZE; c++) {
        const col = this.board.map((row) => row[c]);
        const merged = this.collapseLine(col, dr > 0);
        for (let r = 0; r < G2048_SIZE; r++) this.board[r][c] = merged[r];
      }
    }

    if (JSON.stringify(this.board) === before) return; // no change → no spawn, no save

    this.spawnTile();
    this.render();
    this.audio.play("score");

    // Persist a deep copy so later mutations can't corrupt the saved state.
    CheckpointSystem.save("game2048", {
      board: this.board.map((row) => [...row]),
      score: this.score,
    });

    if (!this.won && this.board.some((row) => row.includes(G2048_WIN_VALUE))) {
      this.won = true;
      this.flashWin();
    }

    if (!this.hasMove()) this.endRun();
  }

  /** Collapse one line toward the low index (or high index when `reverse`). */
  private collapseLine(line: number[], reverse: boolean): number[] {
    const src = reverse ? [...line].reverse() : [...line];
    const compact = src.filter((v) => v !== 0);
    const out: number[] = [];
    for (let i = 0; i < compact.length; i++) {
      if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
        const merged = compact[i] * 2;
        out.push(merged);
        this.score += merged;
        i++; // consume the pair; a merged tile can't merge again this move
      } else {
        out.push(compact[i]);
      }
    }
    while (out.length < G2048_SIZE) out.push(0);
    return reverse ? out.reverse() : out;
  }

  /** True if any empty cell remains or any adjacent equal pair can still merge. */
  private hasMove(): boolean {
    for (let r = 0; r < G2048_SIZE; r++) {
      for (let c = 0; c < G2048_SIZE; c++) {
        if (this.board[r][c] === 0) return true;
        if (c + 1 < G2048_SIZE && this.board[r][c] === this.board[r][c + 1]) return true;
        if (r + 1 < G2048_SIZE && this.board[r][c] === this.board[r + 1][c]) return true;
      }
    }
    return false;
  }

  /** Destroy and rebuild all tile objects from the current board. */
  private render(): void {
    this.scoreText.setText(String(this.score));
    this.tileLayer.removeAll(true);

    for (let r = 0; r < G2048_SIZE; r++) {
      for (let c = 0; c < G2048_SIZE; c++) {
        const value = this.board[r][c];
        if (value === 0) continue;
        const x = this.boardX + BOARD_GAP + c * (this.tileSize + BOARD_GAP);
        const y = this.boardY + BOARD_GAP + r * (this.tileSize + BOARD_GAP);
        const color = TILE_COLORS[value] ?? DEFAULT_TILE_COLOR;
        this.tileLayer.add(
          this.add.rectangle(x, y, this.tileSize, this.tileSize, color).setOrigin(0, 0),
        );
        this.tileLayer.add(
          this.add
            .text(x + this.tileSize / 2, y + this.tileSize / 2, String(value), {
              color: COLOR.text,
              fontSize: value >= 1024 ? "48px" : "56px",
              fontStyle: "bold",
            })
            .setOrigin(0.5),
        );
      }
    }
  }

  private flashWin(): void {
    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 160, "2048!", {
        color: COLOR.accent,
        fontSize: "72px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      duration: 1200,
      ease: "Cubic.easeIn",
      onComplete: () => banner.destroy(),
    });
  }

  private endRun(): void {
    if (this.isOver) return;
    this.isOver = true;
    this.audio.play("hit");

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
