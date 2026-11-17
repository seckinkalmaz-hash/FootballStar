import Phaser from 'phaser';
import { FLICK, GAME_HEIGHT, GAME_WIDTH, PITCH, type TeamSide } from '../config';
import type { BallSprite } from '../entities/BallSprite';
import type { PlayerSprite } from '../entities/PlayerSprite';

/** Choose a Red disc and a flick vector (dx, dy toward travel direction). */
export function planAiFlick(
  team: TeamSide,
  discs: PlayerSprite[],
  ball: BallSprite,
  rng = Math.random,
): { disc: PlayerSprite; dirX: number; dirY: number; power: number } {
  const attackX = team === 'home' ? GAME_WIDTH - PITCH.margin : PITCH.margin;
  const defendX = team === 'home' ? PITCH.margin + 80 : GAME_WIDTH - PITCH.margin - 80;

  // Prefer disc closest to a useful strike on the ball
  let best = discs[0];
  let bestScore = -Infinity;
  for (const d of discs) {
    const dist = Phaser.Math.Distance.Between(d.x, d.y, ball.x, ball.y);
    const align =
      team === 'home'
        ? ball.x - d.x // want to be left of ball to push right
        : d.x - ball.x;
    const score = -dist + Math.max(0, align) * 0.35;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }

  const goalY = GAME_HEIGHT / 2 + (rng() - 0.5) * 40;
  // Approach point: slightly behind ball relative to attack direction
  const behind =
    team === 'home'
      ? { x: ball.x - 28, y: ball.y }
      : { x: ball.x + 28, y: ball.y };

  const canShootLane =
    (team === 'home' && best.x < ball.x && ball.x > GAME_WIDTH * 0.35) ||
    (team === 'away' && best.x > ball.x && ball.x < GAME_WIDTH * 0.65);

  let targetX: number;
  let targetY: number;
  let powerFactor: number;

  if (canShootLane && rng() > 0.25) {
    // Aim through ball toward goal
    targetX = attackX;
    targetY = goalY;
    powerFactor = 0.7 + rng() * 0.3;
  } else if (Phaser.Math.Distance.Between(best.x, best.y, ball.x, ball.y) < 140) {
    // Pass-ish / poke toward attack
    targetX = Phaser.Math.Linear(ball.x, attackX, 0.55);
    targetY = Phaser.Math.Linear(ball.y, goalY, 0.4);
    powerFactor = 0.45 + rng() * 0.35;
  } else {
    // Reposition toward ball / defend
    targetX = Phaser.Math.Linear(behind.x, defendX, 0.15);
    targetY = behind.y;
    powerFactor = 0.35 + rng() * 0.25;
  }

  let dirX = targetX - best.x;
  let dirY = targetY - best.y;
  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len;
  dirY /= len;

  // Noise so AI isn't laser-perfect
  const noise = (rng() - 0.5) * 0.22;
  const cos = Math.cos(noise);
  const sin = Math.sin(noise);
  const ndx = dirX * cos - dirY * sin;
  const ndy = dirX * sin + dirY * cos;

  const power = FLICK.minPower + (FLICK.maxPower - FLICK.minPower) * powerFactor;
  return { disc: best, dirX: ndx, dirY: ndy, power };
}
