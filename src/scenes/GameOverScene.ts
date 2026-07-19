import Phaser from "phaser";
import { COLOR, GAME_HEIGHT, GAME_WIDTH } from "../config/constants";
import { getGameMeta, type GameId } from "../config/games";
import type { IGameSDK } from "../sdk/IGameSDK";

interface GameOverData {
  gameId: GameId;
  score: number;
  highScore: number;
  isNewBest: boolean;
}

/** Shows the run result and offers "play again" or a rewarded "continue". */
export class GameOverScene extends Phaser.Scene {
  private result!: GameOverData;

  constructor() {
    super("GameOver");
  }

  init(data: GameOverData): void {
    this.result = data;
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const sdk = this.registry.get("sdk") as IGameSDK;
    const meta = getGameMeta(this.result.gameId);

    this.add
      .text(cx, cy - 320, meta.title, {
        color: COLOR.accent,
        fontSize: "48px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 240, "GAME OVER", {
        color: COLOR.text,
        fontSize: "80px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 110, `SCORE: ${this.result.score}`, {
        color: COLOR.text,
        fontSize: "56px",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 40, `BEST: ${this.result.highScore}`, {
        color: COLOR.accent,
        fontSize: "40px",
      })
      .setOrigin(0.5);

    if (this.result.isNewBest) {
      this.add
        .text(cx, cy + 20, "NEW BEST!", {
          color: COLOR.accent,
          fontSize: "48px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    // "PLAY AGAIN" — tap / Space restarts the SAME game that just ended.
    const playAgain = this.add
      .text(cx, cy + 130, "PLAY AGAIN", {
        color: COLOR.text,
        fontSize: "52px",
        backgroundColor: "#2e3f52",
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const retry = () => this.scene.start(meta.sceneKey, { gameId: meta.id });
    playAgain.on("pointerdown", retry);
    this.input.keyboard?.once("keydown-SPACE", retry);

    // "MENU" — back to game select.
    const menu = this.add
      .text(cx, cy + 240, "MENU", {
        color: COLOR.text,
        fontSize: "44px",
        backgroundColor: "#2e3f52",
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const toMenu = () => this.scene.start("Menu");
    menu.on("pointerdown", toMenu);
    this.input.keyboard?.once("keydown-ESC", toMenu);

    // "CONTINUE (watch ad)" — rewarded seam.
    const continueBtn = this.add
      .text(cx, cy + 350, "CONTINUE (watch ad)", {
        color: COLOR.text,
        fontSize: "40px",
        backgroundColor: "#4fc3f7",
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    continueBtn.on("pointerdown", async () => {
      const ok = await sdk.showRewarded();
      if (ok) {
        // Placeholder "reward": simply start a fresh run. A real game would
        // resume the SAME run (revive the player at their last position);
        // mid-run state-restore is intentionally out of scope for this starter.
        this.scene.start(meta.sceneKey, { gameId: meta.id });
      }
    });
  }
}
