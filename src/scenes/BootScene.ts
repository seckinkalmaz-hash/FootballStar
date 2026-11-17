import Phaser from 'phaser';
import { BALL, DISC, MATCH } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeDisc('disc-home', MATCH.teams.home.color, MATCH.teams.home.accent);
    this.makeDisc('disc-away', MATCH.teams.away.color, MATCH.teams.away.accent);
    this.makeBall();
    this.scene.start('Menu');
  }

  private makeDisc(key: string, fill: number, ring: number): void {
    const r = DISC.radius;
    const size = r * 2 + 8;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.28);
    g.fillCircle(size / 2 + 1, size / 2 + 2, r);
    g.fillStyle(fill, 1);
    g.fillCircle(size / 2, size / 2, r);
    g.lineStyle(4, ring, 1);
    g.strokeCircle(size / 2, size / 2, r - 2);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(size / 2 - 5, size / 2 - 5, 5);
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
    g.fillCircle(size / 2 - 3, size / 2 - 2, 2.2);
    g.fillCircle(size / 2 + 3, size / 2 + 1, 2.2);
    g.generateTexture('ball', size, size);
    g.destroy();
  }
}
