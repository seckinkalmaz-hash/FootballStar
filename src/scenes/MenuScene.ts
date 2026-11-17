import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MATCH, type SquadSize } from '../config';

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
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1a12);

    this.add
      .text(cx, 72, 'FootballStar', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '54px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 128, 'Soccer Stars–style · flick şut & pas', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#a5d6a7',
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        188,
        `Sıra sende: mavi disklerden birini geri çek → bırak.\nŞut / pas fizikle çözülür; sonra kırmızı AI oynar.\nİlk ${MATCH.goalsToWin} gol (veya süre) kazanır.`,
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '15px',
          color: '#c8e6c9',
          align: 'center',
          lineSpacing: 5,
        },
      )
      .setOrigin(0.5);

    this.sizeLabel = this.add
      .text(cx, 268, this.sizeText(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#fff59d',
      })
      .setOrigin(0.5);

    this.makeButton(cx - 110, 318, '2v2', () => this.setSquad(2));
    this.makeButton(cx + 110, 318, '3v3', () => this.setSquad(3));
    this.makeButton(cx, 400, 'Kick Off', () => this.startMatch(), 220, 56);

    this.add
      .text(cx, 468, 'Drag back to flick · Keys 1–3 select · Arrows aim · Space charge', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#81c784',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 498, 'Enter / Space: start · 2 / 3: squad', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#a5d6a7',
      })
      .setOrigin(0.5);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = pointer.worldX;
      const y = pointer.worldY;
      for (const btn of this.buttons) {
        if (Phaser.Geom.Rectangle.Contains(btn.bg.getBounds(), x, y)) {
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
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x2e7d32));
    bg.on('pointerout', () => bg.setFillStyle(0x1b5e20));
    bg.on('pointerdown', () => onClick());
    this.buttons.push({ bg, onClick });
  }
}
