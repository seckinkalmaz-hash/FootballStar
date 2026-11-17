import Phaser from 'phaser';
import { DISC, type TeamSide } from '../config';

export class PlayerSprite extends Phaser.Physics.Arcade.Image {
  readonly team: TeamSide;
  readonly slot: number;
  selected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, team: TeamSide, slot: number) {
    const key = team === 'home' ? 'disc-home' : 'disc-away';
    super(scene, x, y, key);
    this.team = team;
    this.slot = slot;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(DISC.radius);
    body.setOffset(4, 4);
    body.setCollideWorldBounds(true);
    body.setBounce(DISC.bounce, DISC.bounce);
    // Linear drag (damping OFF). High drag = stops sooner after the flick.
    body.setDamping(false);
    body.setDrag(140);
    body.setMaxSpeed(DISC.maxSpeed);
    body.setMass(DISC.mass);

    this.setDepth(5);
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.setTint(on ? 0xfff59d : 0xffffff);
    this.setScale(on ? 1.08 : 1);
  }

  stopHard(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
  }
}
