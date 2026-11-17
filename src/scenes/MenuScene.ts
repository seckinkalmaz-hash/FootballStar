import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, type SquadSize } from '../config';

export class MenuScene extends Phaser.Scene {
  private squadSize: SquadSize = 3;

  constructor() {
    super('Menu');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1a12);

    this.add
      .text(cx, 88, 'FootballStar', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '56px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 148, 'Arcade soccer · Mini Soccer Stars vibe', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#a5d6a7',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 210, 'You control the starred Blue player.\nAI teammates & Red opponents. Short timed match.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#c8e6c9',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);

    const sizeLabel = this.add
      .text(cx, 290, this.sizeText(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fff59d',
      })
      .setOrigin(0.5);

    this.makeButton(cx - 110, 340, '2v2', () => {
      this.squadSize = 2;
      sizeLabel.setText(this.sizeText());
    });
    this.makeButton(cx + 110, 340, '3v3', () => {
      this.squadSize = 3;
      sizeLabel.setText(this.sizeText());
    });

    this.makeButton(cx, 420, 'Kick Off', () => {
      this.scene.start('Game', { squadSize: this.squadSize });
    }, 200, 52);

    this.add
      .text(cx, 500, 'Move: WASD / arrows · Kick: Space or click · Touch: stick + Kick', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#81c784',
      })
      .setOrigin(0.5);
  }

  private sizeText(): string {
    return `Squad: ${this.squadSize}v${this.squadSize}`;
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    w = 140,
    h = 44,
  ): void {
    const bg = this.add.rectangle(x, y, w, h, 0x1b5e20, 1).setStrokeStyle(2, 0xa5d6a7);
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x2e7d32))
      .on('pointerout', () => bg.setFillStyle(0x1b5e20))
      .on('pointerdown', onClick);
    text.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
  }
}
