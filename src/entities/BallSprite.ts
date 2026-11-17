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
    body.setDamping(false);
    body.setDrag(BALL.drag);
    body.setMaxSpeed(BALL.maxSpeed);
    body.setMass(BALL.mass);

    this.setDepth(6);
  }

  stopHard(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }
}
