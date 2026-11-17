import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, type SquadSize } from '../config';

interface MenuButton {
  bg: Phaser.GameObjects.Rectangle;
  label: string;
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
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1a12).setDepth(0);

    this.add
      .text(cx, 88, 'FootballStar', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '56px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.add
      .text(cx, 148, 'Arcade soccer · Mini Soccer Stars vibe', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#a5d6a7',
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.add
      .text(
        cx,
        210,
        'You control the starred Blue player.\nAI teammates & Red opponents. Short timed match.',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#c8e6c9',
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(1);

    this.sizeLabel = this.add
      .text(cx, 290, this.sizeText(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fff59d',
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.makeButton(cx - 110, 340, '2v2', () => this.setSquad(2));
    this.makeButton(cx + 110, 340, '3v3', () => this.setSquad(3));
    this.makeButton(cx, 420, 'Kick Off', () => this.startMatch(), 220, 56);

    this.add
      .text(cx, 490, 'Enter / Space: Kick Off · Keys 2 / 3: squad size', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#a5d6a7',
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.add
      .text(cx, 518, 'In match — Move: WASD / arrows · Kick: Space or click · Touch: stick + Kick', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#81c784',
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Manual hit-test so FIT scaling / automation clicks still work
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = pointer.worldX;
      const y = pointer.worldY;
      for (const btn of this.buttons) {
        const b = btn.bg.getBounds();
        if (Phaser.Geom.Rectangle.Contains(b, x, y)) {
          btn.onClick();
          return;
        }
      }
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ENTER', () => this.startMatch());
      this.input.keyboard.on('keydown-SPACE', () => this.startMatch());
      this.input.keyboard.on('keydown-TWO', () => this.setSquad(2));
      this.input.keyboard.on('keydown-THREE', () => this.setSquad(3));
    }

    // Autostart for demos / automation: ?autostart=1 or ?autostart=2
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('autostart');
    if (auto === '2' || auto === '3') {
      this.setSquad(Number(auto) as SquadSize);
      this.time.delayedCall(200, () => this.startMatch());
    } else if (auto === '1') {
      this.time.delayedCall(200, () => this.startMatch());
    }
  }

  private setSquad(size: SquadSize): void {
    this.squadSize = size;
    this.sizeLabel.setText(this.sizeText());
  }

  private startMatch(): void {
    this.scene.start('Game', { squadSize: this.squadSize });
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
    const bg = this.add
      .rectangle(x, y, w, h, 0x1b5e20, 1)
      .setStrokeStyle(2, 0xa5d6a7)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5)
      .setDepth(3);

    bg.on('pointerover', () => bg.setFillStyle(0x2e7d32));
    bg.on('pointerout', () => bg.setFillStyle(0x1b5e20));
    bg.on('pointerdown', () => onClick());

    this.buttons.push({ bg, label, onClick });
  }
}
