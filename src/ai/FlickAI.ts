import Phaser from 'phaser';
import { AIM, GAME_HEIGHT, GAME_WIDTH, PITCH, type TeamSide } from '../config';
import type { BallSprite } from '../entities/BallSprite';
import type { PlayerSprite } from '../entities/PlayerSprite';
import type { KickResult } from '../ui/KickAim';

/** Plan a kick from the ball toward goal / pass lane (Mini Soccer Stars–style). */
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

  const goalY = GAME_HEIGHT / 2 + (rng() - 0.5) * 50;
  const attacking =
    (team === 'home' && ball.x > GAME_WIDTH * 0.4) ||
    (team === 'away' && ball.x < GAME_WIDTH * 0.6);

  let targetX: number;
  let targetY: number;
  let power01: number;
  if (attacking && rng() > 0.2) {
    targetX = attackX;
    targetY = goalY;
    power01 = 0.65 + rng() * 0.3;
  } else {
    targetX = Phaser.Math.Linear(ball.x, attackX, 0.5);
    targetY = Phaser.Math.Linear(ball.y, goalY, 0.35);
    power01 = 0.4 + rng() * 0.35;
  }

  let dirX = targetX - ball.x;
  let dirY = targetY - ball.y;
  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len;
  dirY /= len;
  const noise = (rng() - 0.5) * (attacking ? 0.16 : 0.28);
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
