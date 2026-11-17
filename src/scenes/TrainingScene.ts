import Phaser from 'phaser';
import { AIM, BALL, GAME_HEIGHT, GAME_WIDTH, PITCH } from '../config';
import { KickAim } from '../ui/KickAim';

/**
 * Shot-on-goal drill: aim the yellow arrow into the goal mouth.
 * Wall dummies block the lane — not a billiard table.
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
  private scoredThisShot = false;
  private player!: Phaser.Physics.Arcade.Image;
  private goalLineY = 0;

  constructor() {
    super('Training');
  }

  create(): void {
    this.attempts = 0;
    this.hits = 0;
    this.resolving = false;
    this.scoredThisShot = false;
    this.drawField();
    this.createHud();

    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 96, 'player-home');
    this.player.setDepth(5);
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    pb.setAllowGravity(false);
    pb.setImmovable(true);

    this.ball = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 128, 'ball');
    this.ball.setDepth(6);
    const bb = this.ball.body as Phaser.Physics.Arcade.Body;
    bb.setCircle(BALL.radius);
    bb.setOffset(3, 3);
    bb.setBounce(0.2, 0.2);
    bb.setCollideWorldBounds(true);
    bb.setDrag(BALL.drag);
    this.physics.world.setBounds(40, 20, GAME_WIDTH - 80, GAME_HEIGHT - 60);

    // Wall of blockers in front of the goal (MSS reference)
    this.walls = this.physics.add.staticGroup();
    this.walls.create(GAME_WIDTH / 2 - 36, this.goalLineY + 78, 'wall-dummy');
    this.walls.create(GAME_WIDTH / 2 + 36, this.goalLineY + 78, 'wall-dummy');

    // Bullseye sits in the goal mouth — the thing you shoot at
    this.target = this.add
      .image(GAME_WIDTH / 2, this.goalLineY + 28, 'target-dummy')
      .setDepth(4)
      .setScale(0.95);
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
        const power = AIM.minPower + (AIM.maxPower - AIM.minPower) * 0.7;
        this.fire(Math.cos(ang), Math.sin(ang), power);
      });
    }
  }

  update(): void {
    if (!this.resolving) return;
    this.checkGoalLine();
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    if (body.speed < 24) {
      this.resolving = false;
      body.setVelocity(0, 0);
      if (!this.scoredThisShot) {
        this.statusText.setText('Miss — aim into the goal');
      }
      if (this.attempts >= 3) {
        this.statusText.setText(
          this.hits > 0 ? `Done — ${this.hits}/3 on target · M menu` : '0/3 — try again',
        );
        this.time.delayedCall(1100, () => {
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
    for (let i = 0; i < 45; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      g.lineBetween(x, y, x - 2, y + 16);
    }

    // Goal at TOP of pitch — shoot upward
    this.goalLineY = 72;
    const gx = GAME_WIDTH / 2 - PITCH.goalWidth / 2;
    const gw = PITCH.goalWidth;

    g.fillStyle(0xffffff, 0.12);
    g.fillRect(gx, 28, gw, this.goalLineY - 28);
    g.lineStyle(5, 0xfffde7, 1);
    g.strokeRect(gx, 28, gw, this.goalLineY - 28);
    // Goal line
    g.lineStyle(3, 0xffeb3b, 0.95);
    g.lineBetween(gx, this.goalLineY, gx + gw, this.goalLineY);

    // Penalty box
    g.lineStyle(2, 0xe8f5e9, 0.75);
    g.strokeRect(gx - 40, this.goalLineY, gw + 80, 110);

    this.add
      .text(GAME_WIDTH / 2, 10, 'GOAL', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#fff59d',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(3);
  }

  private createHud(): void {
    this.hexes = [];
    const cx = GAME_WIDTH / 2;
    for (let i = 0; i < 3; i++) {
      const c = this.add.container(cx - 56 + i * 56, GAME_HEIGHT - 48);
      const hex = this.add.polygon(
        0,
        0,
        [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7],
        0x1565c0,
        0.35,
      );
      hex.setStrokeStyle(2, 0x90caf9);
      c.add(hex);
      this.hexes.push(c);
      if (i < 2) {
        this.add.rectangle(cx - 28 + i * 56, GAME_HEIGHT - 48, 28, 2, 0x90caf9, 0.7).setDepth(1);
      }
    }

    this.statusText = this.add
      .text(cx, GAME_HEIGHT - 22, 'Shoot into the GOAL · drag yellow arrow · hit the bullseye', {
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
    this.hexes.forEach((c) => {
      c.removeAll(true);
      const hex = this.add.polygon(
        0,
        0,
        [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7],
        0x1565c0,
        0.35,
      );
      hex.setStrokeStyle(2, 0x90caf9);
      c.add(hex);
    });
  }

  private resetBall(): void {
    this.scoredThisShot = false;
    this.ball.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 128);
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    this.player.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 96);
    this.aim.showAt(this.ball.x, this.ball.y);
    this.aim.setKeyboardAim(-Math.PI / 2, 0.6);
    this.statusText.setText('Shoot into the GOAL · drag yellow arrow · hit the bullseye');
  }

  private fire(dirX: number, dirY: number, power: number): void {
    if (this.resolving) return;
    this.aim.hide();
    this.resolving = true;
    this.scoredThisShot = false;
    this.attempts += 1;
    this.markAttempt(this.attempts - 1, false);
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dirX * power, dirY * power);
    this.statusText.setText('Shot!');
  }

  private markAttempt(idx: number, hit: boolean): void {
    if (idx < 0 || idx >= this.hexes.length) return;
    const c = this.hexes[idx];
    c.removeAll(true);
    const hex = this.add.polygon(
      0,
      0,
      [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7],
      hit ? 0x2e7d32 : 0x1565c0,
      hit ? 0.55 : 0.35,
    );
    hex.setStrokeStyle(2, hit ? 0xa5d6a7 : 0x90caf9);
    c.add(hex);
    c.add(
      this.add
        .text(0, 0, hit ? '●' : '✕', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: hit ? '#c8e6c9' : '#ef5350',
        })
        .setOrigin(0.5),
    );
  }

  private checkGoalLine(): void {
    if (this.scoredThisShot) return;
    const gx = GAME_WIDTH / 2 - PITCH.goalWidth / 2;
    const gw = PITCH.goalWidth;
    if (
      this.ball.y < this.goalLineY + 8 &&
      this.ball.x > gx + 6 &&
      this.ball.x < gx + gw - 6
    ) {
      this.onHitTarget();
    }
  }

  private onHitTarget(): void {
    if (!this.resolving || this.scoredThisShot) return;
    this.scoredThisShot = true;
    this.hits += 1;
    this.markAttempt(this.attempts - 1, true);
    this.statusText.setText('GOAL!');
    const body = this.ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(body.velocity.x * 0.15, body.velocity.y * 0.15);
  }
}
