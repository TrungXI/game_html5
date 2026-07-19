import Phaser from "phaser";
import { JUMP_VELOCITY, PLAYER_X } from "../config/constants";

/** The one-button jumper. Fixed on X, gravity from the world, jumps only when grounded. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, y: number) {
    super(scene, PLAYER_X, y, "tex-player");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Keep the player pinned to the top world bound (can't fly off the top),
    // but let obstacles pass freely — only the top edge is a wall.
    this.setCollideWorldBounds(true);
  }

  jump(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down || body.touching.down) {
      this.setVelocityY(JUMP_VELOCITY);
    }
  }
}
