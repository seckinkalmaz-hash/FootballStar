import Phaser from 'phaser';
import { AIM } from '../config';

export interface KickResult {
  dirX: number;
  dirY: number;
  power: number;
  power01: number;
}

/**
 * Mini Soccer Stars aim: thick yellow arrow from the ball, power %, dotted V cone.
 * Drag back from the ball (or anywhere) to set opposite travel direction + power.
 */
export class KickAim {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly pctText: Phaser.GameObjects.Text;
  private originX = 0;
  private originY = 0;
  private pulling = false;
  private pullX = 0;
  private pullY = 0;
  private onKick: ((r: KickResult) => void) | null = null;
  enabled = false;
  visible = false;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(35);
    this.pctText = scene.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffeb3b',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(36)
      .setVisible(false);
  }

  setHandler(fn: (r: KickResult) => void): void {
    this.onKick = fn;
  }

  get isPulling(): boolean {
    return this.pulling;
  }

  showAt(x: number, y: number): void {
    this.originX = x;
    this.originY = y;
    this.visible = true;
    this.enabled = true;
    // Default: slight pull "down" so travel aims up-screen (toward attack in Training)
    this.pullX = 0;
    this.pullY = 48;
    this.draw();
  }

  hide(): void {
    this.enabled = false;
    this.visible = false;
    this.pulling = false;
    this.gfx.clear();
    this.pctText.setVisible(false);
  }

  beginPull(_pointerX: number, _pointerY: number): void {
    if (!this.enabled) return;
    this.pulling = true;
  }

  updatePull(worldX: number, worldY: number): void {
    if (!this.pulling || !this.enabled) return;
    let dx = worldX - this.originX;
    let dy = worldY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > AIM.maxPull) {
      dx = (dx / len) * AIM.maxPull;
      dy = (dy / len) * AIM.maxPull;
    }
    this.pullX = dx;
    this.pullY = dy;
    this.draw();
  }

  /** Keyboard: set aim angle (travel) and power 0..1 */
  setKeyboardAim(travelAngle: number, power01: number): void {
    if (!this.enabled) return;
    const t = Phaser.Math.Clamp(power01, 0.05, 1);
    const pull = t * AIM.maxPull;
    // Pull is opposite of travel
    this.pullX = -Math.cos(travelAngle) * pull;
    this.pullY = -Math.sin(travelAngle) * pull;
    this.draw();
  }

  release(): KickResult | null {
    if (!this.pulling || !this.enabled) {
      this.pulling = false;
      return null;
    }
    this.pulling = false;
    const pullLen = Math.hypot(this.pullX, this.pullY);
    if (pullLen < 14) {
      this.draw();
      return null;
    }
    const dirX = -this.pullX / pullLen;
    const dirY = -this.pullY / pullLen;
    const power01 = Phaser.Math.Clamp(pullLen / AIM.maxPull, 0, 1);
    const power = AIM.minPower + (AIM.maxPower - AIM.minPower) * power01;
    const result = { dirX, dirY, power, power01 };
    this.onKick?.(result);
    return result;
  }

  cancelPull(): void {
    this.pulling = false;
    this.draw();
  }

  private draw(): void {
    this.gfx.clear();
    if (!this.visible) {
      this.pctText.setVisible(false);
      return;
    }

    const pullLen = Math.hypot(this.pullX, this.pullY) || 1;
    const power01 = Phaser.Math.Clamp(pullLen / AIM.maxPull, 0.08, 1);
    // Travel opposite to pull
    const dirX = -this.pullX / pullLen;
    const dirY = -this.pullY / pullLen;
    const angle = Math.atan2(dirY, dirX);
    const arrowLen = AIM.arrowMin + power01 * (AIM.arrowMax - AIM.arrowMin);

    // Dotted V cone (spread shrinks slightly with more power — tighter shot)
    const spread =
      AIM.coneSpreadMin + (1 - power01) * (AIM.coneSpread - AIM.coneSpreadMin);
    const coneLen = arrowLen * 1.35;
    this.drawDottedRay(angle - spread, coneLen);
    this.drawDottedRay(angle + spread, coneLen);

    // Thick yellow arrow
    const tipX = this.originX + dirX * arrowLen;
    const tipY = this.originY + dirY * arrowLen;
    this.gfx.lineStyle(10, 0xffeb3b, 1);
    this.gfx.lineBetween(this.originX, this.originY, tipX, tipY);
    // Arrow head
    const head = 18;
    const left = angle + Math.PI * 0.78;
    const right = angle - Math.PI * 0.78;
    this.gfx.fillStyle(0xffeb3b, 1);
    this.gfx.fillTriangle(
      tipX,
      tipY,
      tipX + Math.cos(left) * head,
      tipY + Math.sin(left) * head,
      tipX + Math.cos(right) * head,
      tipY + Math.sin(right) * head,
    );

    // Soft pull rubber (subtle)
    if (this.pulling && pullLen > 8) {
      this.gfx.lineStyle(2, 0xffffff, 0.35);
      this.gfx.lineBetween(this.originX, this.originY, this.originX + this.pullX, this.originY + this.pullY);
    }

    const pct = Math.round(power01 * 100);
    this.pctText.setText(`${pct}%`);
    this.pctText.setPosition(this.originX + dirX * (arrowLen * 0.55), this.originY + dirY * (arrowLen * 0.55) - 22);
    this.pctText.setVisible(true);
  }

  private drawDottedRay(angle: number, length: number): void {
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const a = (i + 0.2) / steps;
      const b = (i + 0.55) / steps;
      if (b > 1) break;
      const x1 = this.originX + Math.cos(angle) * length * a;
      const y1 = this.originY + Math.sin(angle) * length * a;
      const x2 = this.originX + Math.cos(angle) * length * b;
      const y2 = this.originY + Math.sin(angle) * length * b;
      this.gfx.lineStyle(3, 0xffeb3b, 0.75);
      this.gfx.lineBetween(x1, y1, x2, y2);
    }
  }
}
