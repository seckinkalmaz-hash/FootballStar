import Phaser from 'phaser';
import { BALL, MATCH } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeBlockyPlayer('player-home', MATCH.teams.home.color, MATCH.teams.home.shorts, MATCH.teams.home.accent);
    this.makeBlockyPlayer('player-away', MATCH.teams.away.color, MATCH.teams.away.shorts, MATCH.teams.away.accent);
    this.makeBall();
    this.makeTargetDummy();
    this.makeWallDummy();
    this.scene.start('Menu');
  }

  /** Low-poly Mini Soccer Stars–like block figure with oval shadow */
  private makeBlockyPlayer(key: string, shirt: number, shorts: number, skin: number): void {
    const w = 48;
    const h = 64;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Ground shadow (elevated-look cue)
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(w / 2, h - 8, 28, 10);

    // Legs
    g.fillStyle(shorts, 1);
    g.fillRoundedRect(w / 2 - 11, h - 28, 8, 16, 2);
    g.fillRoundedRect(w / 2 + 3, h - 28, 8, 16, 2);
    g.fillStyle(0xf5f5f5, 1);
    g.fillRect(w / 2 - 11, h - 14, 8, 5);
    g.fillRect(w / 2 + 3, h - 14, 8, 5);

    // Torso
    g.fillStyle(shirt, 1);
    g.fillRoundedRect(w / 2 - 12, h - 46, 24, 20, 3);
    // Sleeves / accent
    g.fillStyle(0xffffff, 1);
    g.fillRect(w / 2 - 12, h - 44, 5, 10);
    g.fillRect(w / 2 + 7, h - 44, 5, 10);

    // Head (blocky)
    g.fillStyle(skin, 1);
    g.fillRoundedRect(w / 2 - 9, h - 60, 18, 16, 3);
    g.fillStyle(0x212121, 1);
    g.fillCircle(w / 2 - 4, h - 54, 1.6);
    g.fillCircle(w / 2 + 4, h - 54, 1.6);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeBall(): void {
    const r = BALL.radius;
    const size = r * 2 + 10;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(size / 2, size - 3, r * 1.6, 6);
    g.fillStyle(0xf5f5f5, 1);
    g.fillCircle(size / 2, size / 2 - 1, r);
    g.lineStyle(2, 0x212121, 1);
    g.strokeCircle(size / 2, size / 2 - 1, r - 1);
    g.fillStyle(0x212121, 1);
    g.fillCircle(size / 2 - 3, size / 2 - 3, 2.2);
    g.fillCircle(size / 2 + 3, size / 2, 2.2);
    g.generateTexture('ball', size, size);
    g.destroy();
  }

  private makeTargetDummy(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(28, 70, 30, 10);
    g.fillStyle(0x8d6e63, 1);
    g.fillRoundedRect(14, 48, 28, 22, 4);
    g.fillStyle(0xffeb3b, 1);
    g.fillRoundedRect(16, 10, 24, 40, 3);
    g.fillStyle(0xe53935, 1);
    g.fillCircle(28, 30, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(28, 30, 4);
    g.generateTexture('target-dummy', 56, 78);
    g.destroy();
  }

  private makeWallDummy(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(18, 52, 22, 8);
    g.fillStyle(0xe53935, 1);
    g.fillRoundedRect(6, 8, 24, 42, 2);
    g.fillCircle(18, 10, 8);
    g.generateTexture('wall-dummy', 36, 58);
    g.destroy();
  }
}
