import Phaser from 'phaser';
import { BALL, MATCH, PLAYER } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeCircle('player-home', PLAYER.radius, MATCH.teams.home.color, MATCH.teams.home.accent);
    this.makeCircle('player-away', PLAYER.radius, MATCH.teams.away.color, MATCH.teams.away.accent);
    this.makeCircle('player-you', PLAYER.radius, MATCH.teams.home.color, 0xfff176, true);
    this.makeBall();
    this.scene.start('Menu');
  }

  private makeCircle(
    key: string,
    radius: number,
    fill: number,
    ring: number,
    star = false,
  ): void {
    const size = radius * 2 + 8;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(size / 2 + 1, size / 2 + 2, radius);
    g.fillStyle(fill, 1);
    g.fillCircle(size / 2, size / 2, radius);
    g.lineStyle(3, ring, 1);
    g.strokeCircle(size / 2, size / 2, radius - 1);
    if (star) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(size / 2, size / 2, 4);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeBall(): void {
    const r = BALL.radius;
    const size = r * 2 + 6;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(size / 2 + 1, size / 2 + 2, r);
    g.fillStyle(0xf5f5f5, 1);
    g.fillCircle(size / 2, size / 2, r);
    g.lineStyle(2, 0x212121, 1);
    g.strokeCircle(size / 2, size / 2, r - 1);
    g.fillStyle(0x212121, 1);
    g.fillCircle(size / 2 - 3, size / 2 - 2, 2);
    g.fillCircle(size / 2 + 3, size / 2 + 1, 2);
    g.generateTexture('ball', size, size);
    g.destroy();
  }
}
