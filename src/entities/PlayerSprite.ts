import Phaser from 'phaser';
import { PLAYER, type TeamSide } from '../config';

export type ControlMode = 'human' | 'ai';

export class PlayerSprite extends Phaser.Physics.Arcade.Image {
  readonly team: TeamSide;
  readonly roleIndex: number;
  control: ControlMode;
  lastKickAt = 0;
  aiCooldown = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    team: TeamSide,
    roleIndex: number,
    control: ControlMode,
  ) {
    const key =
      control === 'human' ? 'player-you' : team === 'home' ? 'player-home' : 'player-away';
    super(scene, x, y, key);
    this.team = team;
    this.roleIndex = roleIndex;
    this.control = control;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER.radius);
    body.setOffset(4, 4);
    body.setCollideWorldBounds(true);
    body.setBounce(0.2);
    body.setDrag(320);
    body.setMaxSpeed(PLAYER.speed);

    this.setDepth(5);
  }

  canKick(now: number): boolean {
    return now - this.lastKickAt >= PLAYER.kickCooldownMs;
  }

  markKick(now: number): void {
    this.lastKickAt = now;
  }
}
