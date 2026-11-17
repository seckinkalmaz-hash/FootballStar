import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly kickBtn: Phaser.GameObjects.Container;
  private pointerId: number | null = null;
  private vector = new Phaser.Math.Vector2(0, 0);
  private kickPressed = false;
  private readonly maxRadius = 54;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const stickX = 110;
    const stickY = GAME_HEIGHT - 100;

    this.base = scene.add
      .circle(stickX, stickY, 64, 0xffffff, 0.12)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(50)
      .setInteractive();

    this.knob = scene.add
      .circle(stickX, stickY, 28, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(51);

    this.kickBtn = this.makeKickButton(GAME_WIDTH - 100, GAME_HEIGHT - 100);

    this.base.on('pointerdown', (p: Phaser.Input.Pointer) => this.onStickDown(p));
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onStickMove(p));
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onStickUp(p));
  }

  getAxis(): Phaser.Math.Vector2 {
    return this.vector.clone();
  }

  consumeKick(): boolean {
    if (!this.kickPressed) return false;
    this.kickPressed = false;
    return true;
  }

  setVisible(v: boolean): void {
    this.base.setVisible(v);
    this.knob.setVisible(v);
    this.kickBtn.setVisible(v);
  }

  private makeKickButton(x: number, y: number): Phaser.GameObjects.Container {
    const bg = this.scene.add.circle(0, 0, 42, 0xe53935, 0.75).setStrokeStyle(3, 0xffcdd2);
    const label = this.scene.add
      .text(0, 0, 'KICK', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const c = this.scene.add.container(x, y, [bg, label]).setScrollFactor(0).setDepth(50);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.kickPressed = true;
        bg.setFillStyle(0xc62828, 0.9);
      })
      .on('pointerup', () => bg.setFillStyle(0xe53935, 0.75))
      .on('pointerout', () => bg.setFillStyle(0xe53935, 0.75));
    return c;
  }

  private onStickDown(p: Phaser.Input.Pointer): void {
    this.pointerId = p.id;
    this.updateKnob(p.x, p.y);
  }

  private onStickMove(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== p.id) return;
    this.updateKnob(p.x, p.y);
  }

  private onStickUp(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== p.id) return;
    this.pointerId = null;
    this.vector.set(0, 0);
    this.knob.setPosition(this.base.x, this.base.y);
  }

  private updateKnob(x: number, y: number): void {
    const dx = x - this.base.x;
    const dy = y - this.base.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, this.maxRadius);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    this.knob.setPosition(this.base.x + nx, this.base.y + ny);
    this.vector.set(nx / this.maxRadius, ny / this.maxRadius);
  }
}
