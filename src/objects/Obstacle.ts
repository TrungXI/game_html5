import Phaser from "phaser";
import {
  GAME_WIDTH,
  OBSTACLE_MAX_HEIGHT,
  OBSTACLE_MIN_HEIGHT,
  OBSTACLE_WIDTH,
} from "../config/constants";

/** A scrolling obstacle. Immovable, gravity-free, moves left at the current speed. */
export class Obstacle extends Phaser.Physics.Arcade.Sprite {
  /** Set once the player has cleared this obstacle, so it only scores once. */
  counted = false;

  constructor(scene: Phaser.Scene, groundTop: number, speed: number) {
    super(scene, GAME_WIDTH + OBSTACLE_WIDTH, groundTop, "tex-obstacle");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const height = Phaser.Math.Between(OBSTACLE_MIN_HEIGHT, OBSTACLE_MAX_HEIGHT);
    // "tex-obstacle" is a 1×1 texture — scale it to the desired footprint.
    this.setDisplaySize(OBSTACLE_WIDTH, height);
    this.setOrigin(0.5, 1); // sit on the ground line
    this.refreshBody();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    this.setVelocityX(-speed);
  }
}
