import Phaser from 'phaser';
import { PLAYER, type TeamSide } from '../config';

/** Static wall-like blocker — Mini Soccer Stars players do not billiard-slide. */
export class PlayerSprite extends Phaser.Physics.Arcade.Image {
  readonly team: TeamSide;
  readonly slot: number;
  selected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, team: TeamSide, slot: number) {
    const key = team === 'home' ? 'player-home' : 'player-away';
    super(scene, x, y, key);
    this.team = team;
    this.slot = slot;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER.radius);
    body.setOffset(24 - PLAYER.radius, 64 - PLAYER.radius * 2 - 6);
    body.setCollideWorldBounds(true);
    body.setBounce(0, 0);
    body.setImmovable(true);
    body.setAllowGravity(false);
    body.setDamping(false);
    body.setDrag(0);
    body.setMaxSpeed(0);
    body.setMass(PLAYER.mass);
    body.setVelocity(0, 0);

    this.setDepth(5);
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.setTint(on ? 0xfff59d : 0xffffff);
    this.setScale(on ? 1.06 : 1);
  }

  stopHard(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
  }
}
