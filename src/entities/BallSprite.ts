import Phaser from 'phaser';
import { BALL } from '../config';

export class BallSprite extends Phaser.Physics.Arcade.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'ball');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(BALL.radius);
    body.setOffset(3, 3);
    body.setCollideWorldBounds(true);
    body.setBounce(BALL.bounce, BALL.bounce);
    body.setMaxSpeed(BALL.maxSpeed);
    body.setDrag(8);

    this.setDepth(6);
  }

  applyFriction(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.velocity.scale(BALL.friction);
    if (body.speed < 8) {
      body.setVelocity(0, 0);
    }
  }
}
