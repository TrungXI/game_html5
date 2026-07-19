import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLOR } from "./constants";
import { BootScene } from "../scenes/BootScene";
import { PreloadScene } from "../scenes/PreloadScene";
import { MenuScene } from "../scenes/MenuScene";
import { GameScene } from "../scenes/GameScene";
import { StackScene } from "../scenes/StackScene";
import { SnakeScene } from "../scenes/SnakeScene";
import { BreakoutScene } from "../scenes/BreakoutScene";
import { Game2048Scene } from "../scenes/Game2048Scene";
import { MemoryScene } from "../scenes/MemoryScene";
import { GameOverScene } from "../scenes/GameOverScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: COLOR.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    GameScene,
    StackScene,
    SnakeScene,
    BreakoutScene,
    Game2048Scene,
    MemoryScene,
    GameOverScene,
  ],
};
