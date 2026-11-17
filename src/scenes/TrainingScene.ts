import Phaser from 'phaser';
import { AIM, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { KickAim } from '../ui/KickAim';

/**
 * Mini Soccer Stars–style shot challenge: yellow arrow + % + dotted cone,
 * wall dummies, bullseye target — matches user reference screenshots.
 */
export class TrainingScene extends Phaser.Scene {
  private aim!: KickAim;
  private ball!: Phaser.Physics.Arcade.Image;
  private target!: Phaser.GameObjects.Image;
  private walls: Phaser.Physics.Arcade.StaticGroup | null = null;
  private attempts = 0;
  private hits = 0;
  private hexes: Phaser.GameObjects.Container[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private resolving = false;
  private player!: Phaser.Physics.Arcade.Image;

  constructor() {
    super('Training');
  }

  create(): void {
    this.attempts = 0;
    this.hits = 0;
    this.resolving = false;
    this.drawField();
    this.createHud();

    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 110, 'player-home');
    this.player.setDepth(5);
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    pb.setAllowGravity(false);
    pb.setImmovable(true);

    this.ball = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 140, 'ball');
    this.ball.setDepth(6);
    const bb = this.ball.body as Phaser.Physics.Arcade.Body;
    bb.setCircle(11);
    bb.setOffset(3, 3);
    bb.setBounce(0.55, 0.55);
    bb.setCollideWorldBounds(true);
    bb.setDrag(40);
    this.physics.world.setBounds(40, 40, GAME_WIDTH - 80, GAME_HEIGHT - 80);

    this.walls = this.physics.add.staticGroup();
    this.walls.create(GAME_WIDTH / 2 - 28, GAME_HEIGHT / 2 + 20, 'wall-dummy');
    this.walls.create(GAME_WIDTH / 2 + 28, GAME_HEIGHT / 2 + 20, 'wall-dummy');

    this.target = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, 'target-dummy').setDepth(4);
    this.physics.add.existing(this.target, true);

    this.physics.add.collider(this.ball, this.walls);
    this.physics.add.overlap(this.ball, this.target, () => this.onHitTarget());

    this.aim = new KickAim(this);
    this.aim.setHandler((r) => this.fire(r.dirX, r.dirY, r.power));
    this.resetBall();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.resolving || !this.aim.enabled) return;
      if (p.worldY < 56) return;
      this.aim.beginPull(p.worldX, p.worldY);
      this.aim.updatePull(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.aim.isPulling) this.aim.updatePull(p.worldX, p.worldY);
    });
    this.input.on('pointerup', () => {
      if (this.aim.isPulling) this.aim.release();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-M', () => this.scene.start('Menu'));
      this.input.keyboard.on('keydown-F', () => {
        if (this.resolving || !this.aim.enabled) return;
        const ang = -Math.PI / 2;
        const power = AIM.minPower + (AIM.maxPower - AIM.minPower) * 0.62;
        this.fire(Math.cos(ang), Math.sin(ang), power);
      });
    }
  }

  update(): void {
    if (!this.resolving) return;
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    if (body.speed < 20) {
      this.resolving = false;
      body.setVelocity(0, 0);
      if (this.attempts >= 3) {
        this.statusText.setText(this.hits > 0 ? `Done — ${this.hits}/3 hits · M menu` : 'Missed all · M menu · or wait reset');
        this.time.delayedCall(1200, () => {
          this.attempts = 0;
          this.hits = 0;
          this.refreshHexes();
          this.resetBall();
        });
      } else {
        this.resetBall();
      }
    }
  }

  private drawField(): void {
    const g = this.add.graphics();
    g.fillStyle(0x2e7d32, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x43a047, 1);
    for (let x = 0; x < GAME_WIDTH; x += 80) g.fillRect(x, 0, 40, GAME_HEIGHT);
    g.lineStyle(1, 0xffffff, 0.14);
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      g.lineBetween(x, y, x - 2, y + 16);
    }
    g.lineStyle(3, 0xe8f5e9, 0.85);
    g.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 90);
    g.lineBetween(40, GAME_HEIGHT / 2 - 40, GAME_WIDTH - 40, GAME_HEIGHT / 2 - 40);
  }

  private createHud(): void {
    this.hexes = [];
    const cx = GAME_WIDTH / 2;
    for (let i = 0; i < 3; i++) {
      const c = this.add.container(cx - 56 + i * 56, 28);
      const hex = this.add.polygon(0, 0, [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7], 0x1565c0, 0.35);
      hex.setStrokeStyle(2, 0x90caf9);
      c.add(hex);
      this.hexes.push(c);
      if (i < 2) {
        this.add.rectangle(cx - 28 + i * 56, 28, 28, 2, 0x90caf9, 0.7).setDepth(1);
      }
    }

    this.statusText = this.add
      .text(cx, GAME_HEIGHT - 22, 'Drag to aim · yellow arrow + % · hit the bullseye', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#e8f5e9',
      })
      .setOrigin(0.5)
      .setDepth(20);

    const menu = this.add
      .text(GAME_WIDTH - 16, 16, 'MENU', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#c8e6c9',
        backgroundColor: '#1b5e20aa',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => this.scene.start('Menu'));
  }

  private refreshHexes(): void {
    this.hexes.forEach((c, i) => {
      c.removeAll(true);
      const hex = this.add.polygon(0, 0, [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7], 0x1565c0, 0.35);
      hex.setStrokeStyle(2, 0x90caf9);
      c.add(hex);
      if (i < this.attempts) {
        const mark = this.add
          .text(0, 0, i < this.hits ? '●' : '✕', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '16px',
            color: i < this.hits ? '#81c784' : '#ef5350',
          })
          .setOrigin(0.5);
        // Simplified: X for each attempt used; green if we already scored enough is messy —
        // show X for misses counted after attempt index. Just mark attempts with X until hit tracked separately.
        c.add(mark);
      }
    });
  }

  private resetBall(): void {
    this.ball.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 140);
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    this.player.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 100);
    this.aim.showAt(this.ball.x, this.ball.y);
    this.aim.setKeyboardAim(-Math.PI / 2, 0.55);
    this.statusText.setText('Drag to aim · yellow arrow + % · hit the bullseye');
  }

  private fire(dirX: number, dirY: number, power: number): void {
    if (this.resolving) return;
    this.aim.hide();
    this.resolving = true;
    this.attempts += 1;
    // Mark attempt hex with provisional X; onHitTarget upgrades feel
    this.hexes.forEach((c, i) => {
      if (i === this.attempts - 1) {
        c.removeAll(true);
        const hex = this.add.polygon(0, 0, [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7], 0x1565c0, 0.35);
        hex.setStrokeStyle(2, 0x90caf9);
        c.add(hex);
        c.add(
          this.add
            .text(0, 0, '✕', {
              fontFamily: 'system-ui, sans-serif',
              fontSize: '16px',
              color: '#ef5350',
            })
            .setOrigin(0.5),
        );
      }
    });
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dirX * power, dirY * power);
  }

  private onHitTarget(): void {
    if (!this.resolving) return;
    this.hits += 1;
    const idx = this.attempts - 1;
    if (idx >= 0 && idx < this.hexes.length) {
      const c = this.hexes[idx];
      c.removeAll(true);
      const hex = this.add.polygon(0, 0, [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7], 0x2e7d32, 0.55);
      hex.setStrokeStyle(2, 0xa5d6a7);
      c.add(hex);
      c.add(
        this.add
          .text(0, 0, '●', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '16px',
            color: '#c8e6c9',
          })
          .setOrigin(0.5),
      );
    }
    this.statusText.setText('HIT!');
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(body.velocity.x * 0.2, body.velocity.y * 0.2);
  }
}
