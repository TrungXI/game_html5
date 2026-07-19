import Phaser from "phaser";
import {
  COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_SIZE,
} from "../config/constants";
import type { IGameSDK } from "../sdk/IGameSDK";

/** Shows a progress bar, generates the demo textures, then goes to the Menu. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    const sdk = this.registry.get("sdk") as IGameSDK;
    sdk.gameLoadingStart();

    this.generateTextures();
    this.drawProgressBar();

    this.load.on("complete", () => {
      sdk.gameLoadingFinished();
      this.scene.start("Menu");
    });

    // No real files are queued, so `complete` fires immediately after start.
    // Starting the loader explicitly keeps the progress → complete flow uniform
    // for when real assets are added later.
    this.load.start();
  }

  /** Build the player/obstacle textures from Graphics — zero external art. */
  private generateTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(COLOR.player, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.generateTexture("tex-player", PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // 1×1 red texture — obstacles scale it to their footprint via setDisplaySize.
    g.fillStyle(COLOR.obstacle, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("tex-obstacle", 1, 1);

    g.destroy();
  }

  private drawProgressBar(): void {
    const barWidth = GAME_WIDTH * 0.6;
    const barHeight = 32;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2 - barHeight / 2;

    const bg = this.add.graphics();
    bg.fillStyle(COLOR.ground, 1);
    bg.fillRect(x, y, barWidth, barHeight);

    const fill = this.add.graphics();
    this.load.on("progress", (value: number) => {
      fill.clear();
      fill.fillStyle(COLOR.player, 1);
      fill.fillRect(x, y, barWidth * value, barHeight);
    });

    this.add
      .text(GAME_WIDTH / 2, y - 40, "Loading…", {
        color: COLOR.text,
        fontSize: "32px",
      })
      .setOrigin(0.5);
  }
}
