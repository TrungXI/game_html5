import Phaser from "phaser";

/** Thin audio facade. No assets bundled — every play() is a guarded no-op today. */
export class AudioManager {
  constructor(private readonly scene: Phaser.Scene) {}
  play(key: string): void {
    if (this.scene.cache.audio.exists(key)) {
      this.scene.sound.play(key);
    }
    // else: no asset — intentionally silent. Add keys in PreloadScene to enable.
  }
}
