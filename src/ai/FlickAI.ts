import Phaser from 'phaser';
import { AIM, GAME_HEIGHT, GAME_WIDTH, PITCH, type TeamSide } from '../config';
import type { BallSprite } from '../entities/BallSprite';
import type { PlayerSprite } from '../entities/PlayerSprite';
import type { KickResult } from '../ui/KickAim';

/** Always plan a shot (or short push) toward the opponent goal. */
export function planAiKick(
  team: TeamSide,
  discs: PlayerSprite[],
  ball: BallSprite,
  rng = Math.random,
): { kicker: PlayerSprite; kick: KickResult } {
  const attackX = team === 'home' ? GAME_WIDTH - PITCH.margin : PITCH.margin;
  let kicker = discs[0];
  let best = Number.POSITIVE_INFINITY;
  for (const d of discs) {
    const dist = Phaser.Math.Distance.Between(d.x, d.y, ball.x, ball.y);
    if (dist < best) {
      best = dist;
      kicker = d;
    }
  }

  // Prefer corners / near-post of the goal mouth
  const half = PITCH.goalWidth * 0.38;
  const goalY = GAME_HEIGHT / 2 + (rng() - 0.5) * half * 2;
  const distToGoal = Math.abs(attackX - ball.x);
  const closeRange = distToGoal < GAME_WIDTH * 0.42;

  const power01 = closeRange ? 0.72 + rng() * 0.25 : 0.55 + rng() * 0.3;
  let dirX = attackX - ball.x;
  let dirY = goalY - ball.y;
  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len;
  dirY /= len;

  // Small aim noise — still clearly a goal shot
  const noise = (rng() - 0.5) * (closeRange ? 0.1 : 0.18);
  const cos = Math.cos(noise);
  const sin = Math.sin(noise);
  const ndx = dirX * cos - dirY * sin;
  const ndy = dirX * sin + dirY * cos;
  const power = AIM.minPower + (AIM.maxPower - AIM.minPower) * power01;

  return {
    kicker,
    kick: { dirX: ndx, dirY: ndy, power, power01 },
  };
}
