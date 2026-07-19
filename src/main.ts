import Phaser from "phaser";
import { gameConfig } from "./config/gameConfig";
import { createSDK } from "./sdk/SDKManager";

const game = new Phaser.Game(gameConfig);
// Create the portal SDK once and share it with every scene via the registry.
game.registry.set("sdk", createSDK());
