import Phaser from 'phaser';
import { FLICK } from '../config';
import type { PlayerSprite } from '../entities/PlayerSprite';

export interface FlickResult {
  disc: PlayerSprite;
  dirX: number;
  dirY: number;
  power: number;
}

/**
 * Pull-back aim: drag away from desired travel direction (Soccer Stars style).
 * Travel = opposite of pull vector.
 */
export class FlickAim {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private active: PlayerSprite | null = null;
  private pulling = false;
  private pullX = 0;
  private pullY = 0;
  private onFlick: ((r: FlickResult) => void) | null = null;
  enabled = true;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(30);
  }

  setHandler(fn: (r: FlickResult) => void): void {
    this.onFlick = fn;
  }

  get isPulling(): boolean {
    return this.pulling;
  }

  begin(disc: PlayerSprite): void {
    if (!this.enabled) return;
    this.active = disc;
    this.pulling = true;
    this.pullX = 0;
    this.pullY = 0;
    disc.setSelected(true);
  }

  updatePull(worldX: number, worldY: number): void {
    if (!this.pulling || !this.active) return;
    let dx = worldX - this.active.x;
    let dy = worldY - this.active.y;
    const len = Math.hypot(dx, dy);
    if (len > FLICK.maxPull) {
      dx = (dx / len) * FLICK.maxPull;
      dy = (dy / len) * FLICK.maxPull;
    }
    this.pullX = dx;
    this.pullY = dy;
    this.draw();
  }

  /** Set pull vector explicitly (for keyboard / assisted aim). */
  setPullVector(dx: number, dy: number): void {
    if (!this.pulling || !this.active) return;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, FLICK.maxPull);
    this.pullX = (dx / len) * clamped;
    this.pullY = (dy / len) * clamped;
    this.draw();
  }

  release(): boolean {
    if (!this.pulling || !this.active) return false;
    const pullLen = Math.hypot(this.pullX, this.pullY);
    const disc = this.active;
    this.pulling = false;
    this.graphics.clear();
    this.active = null;

    if (pullLen < 12 || !this.onFlick) return false;

    const dirX = -this.pullX / pullLen;
    const dirY = -this.pullY / pullLen;
    const t = Phaser.Math.Clamp(pullLen / FLICK.maxPull, 0, 1);
    const power = FLICK.minPower + (FLICK.maxPower - FLICK.minPower) * t;
    this.onFlick({ disc, dirX, dirY, power });
    return true;
  }

  cancel(): void {
    this.pulling = false;
    this.active = null;
    this.graphics.clear();
  }

  /** Fire immediately in a direction with normalized power 0..1 */
  fire(disc: PlayerSprite, angle: number, power01: number): void {
    if (!this.enabled || !this.onFlick) return;
    const power =
      FLICK.minPower + (FLICK.maxPower - FLICK.minPower) * Phaser.Math.Clamp(power01, 0.05, 1);
    this.onFlick({
      disc,
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      power,
    });
  }

  private draw(): void {
    this.graphics.clear();
    if (!this.active) return;
    const ax = this.active.x;
    const ay = this.active.y;
    const pullLen = Math.hypot(this.pullX, this.pullY);
    if (pullLen < 4) return;

    this.graphics.lineStyle(3, 0xffffff, 0.55);
    this.graphics.lineBetween(ax, ay, ax + this.pullX, ay + this.pullY);
    this.graphics.fillStyle(0xffffff, 0.7);
    this.graphics.fillCircle(ax + this.pullX, ay + this.pullY, 6);

    const t = pullLen / FLICK.maxPull;
    const travel = 40 + t * 90;
    const tx = ax - (this.pullX / pullLen) * travel;
    const ty = ay - (this.pullY / pullLen) * travel;
    this.graphics.lineStyle(4, 0xfff176, 0.95);
    this.graphics.lineBetween(ax, ay, tx, ty);
    this.graphics.fillStyle(0xfff176, 1);
    this.graphics.fillCircle(tx, ty, 5);

    this.graphics.lineStyle(6, t > 0.75 ? 0xe53935 : 0x81c784, 0.9);
    this.graphics.strokeCircle(ax, ay, 26 + t * 10);
  }
}
