import Phaser from "phaser";
import { COLOR } from "../config/constants";
import type { IGameSDK } from "../sdk/IGameSDK";

/** Earliest setup. Awaits the SDK's async init (if any), then goes to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor(COLOR.bg);

    // Real portal SDKs (e.g. CrazyGames) init asynchronously and are unusable
    // until ready — await it before continuing. NoopSDK has no init(), so the
    // optional-call is a no-op there.
    const sdk = this.registry.get("sdk") as IGameSDK;
    await sdk.init?.();

    this.scene.start("Preload");
  }
}
