import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, type SquadSize } from '../config';

interface MenuButton {
  bg: Phaser.GameObjects.Rectangle;
  onClick: () => void;
}

export class MenuScene extends Phaser.Scene {
  private squadSize: SquadSize = 3;
  private buttons: MenuButton[] = [];
  private sizeLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.buttons = [];
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1b5e20);

    this.add
      .text(cx, 64, 'FootballStar', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '52px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 118, 'Kaleye şut · yellow arrow aim', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        color: '#c8e6c9',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 168, 'Aim the ball at the GOAL. Players block — they do not slide.\nDrag yellow arrow · power % · dotted cone.', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#a5d6a7',
        align: 'center',
        lineSpacing: 5,
      })
      .setOrigin(0.5);

    this.sizeLabel = this.add
      .text(cx, 230, this.sizeText(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#fff59d',
      })
      .setOrigin(0.5);

    this.makeButton(cx - 110, 275, '2v2', () => this.setSquad(2));
    this.makeButton(cx + 110, 275, '3v3', () => this.setSquad(3));
    this.makeButton(cx, 350, 'Training', () => this.scene.start('Training'), 200, 48);
    this.makeButton(cx, 420, 'Match', () => this.scene.start('Game', { squadSize: this.squadSize }), 200, 52);

    this.add
      .text(cx, 490, 'Training = shoot into goal · Match = turn shots at opponent goal', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#81c784',
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      for (const btn of this.buttons) {
        if (Phaser.Geom.Rectangle.Contains(btn.bg.getBounds(), pointer.worldX, pointer.worldY)) {
          btn.onClick();
          return;
        }
      }
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Game', { squadSize: this.squadSize }));
      this.input.keyboard.on('keydown-T', () => this.scene.start('Training'));
      this.input.keyboard.on('keydown-TWO', () => this.setSquad(2));
      this.input.keyboard.on('keydown-THREE', () => this.setSquad(3));
    }

    const auto = new URLSearchParams(window.location.search).get('autostart');
    if (auto === 'train' || auto === 'training' || auto === '1') {
      this.time.delayedCall(200, () => this.scene.start('Training'));
    } else if (auto === 'match') {
      this.time.delayedCall(200, () => this.scene.start('Game', { squadSize: this.squadSize }));
    } else if (auto === '2' || auto === '3') {
      this.setSquad(Number(auto) as SquadSize);
      this.time.delayedCall(200, () => this.scene.start('Game', { squadSize: this.squadSize }));
    }
  }

  private setSquad(size: SquadSize): void {
    this.squadSize = size;
    this.sizeLabel.setText(this.sizeText());
  }

  private sizeText(): string {
    return `Match squad: ${this.squadSize}v${this.squadSize}`;
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    w = 140,
    h = 44,
  ): void {
    const bg = this.add
      .rectangle(x, y, w, h, 0x0d3b1e, 1)
      .setStrokeStyle(2, 0xa5d6a7)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x2e7d32));
    bg.on('pointerout', () => bg.setFillStyle(0x0d3b1e));
    bg.on('pointerdown', () => onClick());
    this.buttons.push({ bg, onClick });
  }
}
