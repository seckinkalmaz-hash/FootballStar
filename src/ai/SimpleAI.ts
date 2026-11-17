import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PITCH, PLAYER, type TeamSide } from '../config';
import type { BallSprite } from '../entities/BallSprite';
import type { PlayerSprite } from '../entities/PlayerSprite';

const GOAL_HOME_X = PITCH.margin;
const GOAL_AWAY_X = GAME_WIDTH - PITCH.margin;

export class SimpleAI {
  update(
    player: PlayerSprite,
    ball: BallSprite,
    teammates: PlayerSprite[],
    opponents: PlayerSprite[],
    delta: number,
  ): void {
    if (player.control !== 'ai') return;

    player.aiCooldown = Math.max(0, player.aiCooldown - delta);
    const body = player.body as Phaser.Physics.Arcade.Body;
    const attackX = player.team === 'home' ? GOAL_AWAY_X : GOAL_HOME_X;
    const defendX = player.team === 'home' ? GOAL_HOME_X + 70 : GOAL_AWAY_X - 70;

    const distBall = Phaser.Math.Distance.Between(player.x, player.y, ball.x, ball.y);
    const closest = this.isClosestToBall(player, teammates, ball);
    const behindBall = this.isBehindBall(player, ball);

    let tx = ball.x;
    let ty = ball.y;

    if (player.roleIndex === 0) {
      // Deeper / more defensive
      tx = Phaser.Math.Linear(defendX, ball.x, 0.45);
      ty = Phaser.Math.Linear(GAME_HEIGHT / 2, ball.y, 0.55);
      if (closest && distBall < 120) {
        tx = ball.x;
        ty = ball.y;
      }
    } else if (!closest) {
      // Support / spacing
      const side = player.roleIndex % 2 === 0 ? -1 : 1;
      tx = Phaser.Math.Linear(player.x, ball.x, 0.35) + side * 40;
      ty = Phaser.Math.Clamp(
        Phaser.Math.Linear(GAME_HEIGHT / 2, ball.y, 0.5) + side * 70,
        PITCH.margin + 40,
        GAME_HEIGHT - PITCH.margin - 40,
      );
    } else if (behindBall) {
      tx = ball.x + (attackX > ball.x ? -18 : 18);
      ty = ball.y;
    }

    // Avoid stacking on teammates
    for (const mate of teammates) {
      if (mate === player) continue;
      const d = Phaser.Math.Distance.Between(player.x, player.y, mate.x, mate.y);
      if (d < 42) {
        tx += (player.x - mate.x) * 0.4;
        ty += (player.y - mate.y) * 0.4;
      }
    }

    // Light marking pressure on nearest opponent when not on ball
    if (!closest) {
      const mark = this.nearest(player, opponents);
      if (mark) {
        tx = Phaser.Math.Linear(tx, mark.x, 0.15);
        ty = Phaser.Math.Linear(ty, mark.y, 0.15);
      }
    }

    const angle = Phaser.Math.Angle.Between(player.x, player.y, tx, ty);
    const speed = closest ? PLAYER.speed : PLAYER.speed * 0.85;
    body.setAcceleration(Math.cos(angle) * PLAYER.accel * 0.75, Math.sin(angle) * PLAYER.accel * 0.75);
    body.setMaxSpeed(speed);

    if (distBall <= PLAYER.kickRange && player.aiCooldown <= 0) {
      this.tryKick(player, ball, attackX);
    }
  }

  private tryKick(player: PlayerSprite, ball: BallSprite, attackX: number): void {
    const now = player.scene.time.now;
    if (!player.canKick(now)) return;

    const towardGoal = Phaser.Math.Angle.Between(ball.x, ball.y, attackX, GAME_HEIGHT / 2);
    const noise = Phaser.Math.FloatBetween(-0.28, 0.28);
    const power = PLAYER.kickPower * Phaser.Math.FloatBetween(0.75, 1.05);
    const body = ball.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(towardGoal + noise) * power, Math.sin(towardGoal + noise) * power);
    player.markKick(now);
    player.aiCooldown = 220 + Math.random() * 180;
  }

  private isClosestToBall(
    player: PlayerSprite,
    teammates: PlayerSprite[],
    ball: BallSprite,
  ): boolean {
    const my = Phaser.Math.Distance.Between(player.x, player.y, ball.x, ball.y);
    for (const mate of teammates) {
      if (mate === player) continue;
      const d = Phaser.Math.Distance.Between(mate.x, mate.y, ball.x, ball.y);
      if (d + 8 < my) return false;
    }
    return true;
  }

  private isBehindBall(player: PlayerSprite, ball: BallSprite): boolean {
    if (player.team === 'home') return player.x <= ball.x + 10;
    return player.x >= ball.x - 10;
  }

  private nearest(from: PlayerSprite, others: PlayerSprite[]): PlayerSprite | null {
    let best: PlayerSprite | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const o of others) {
      const d = Phaser.Math.Distance.Between(from.x, from.y, o.x, o.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }
}

export function goalCenterX(team: TeamSide): number {
  return team === 'home' ? GOAL_HOME_X : GOAL_AWAY_X;
}
