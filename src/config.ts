export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const PITCH = {
  margin: 40,
  lineColor: 0xe8f5e9,
  grassDark: 0x2e7d32,
  grassLight: 0x43a047,
  goalDepth: 36,
  goalWidth: 168,
};

/**
 * Players are static shot-blockers (not billiard discs).
 * Only the ball is kicked toward the goal each turn.
 */
export const PLAYER = {
  bodyW: 22,
  bodyH: 34,
  radius: 15,
  mass: 8,
  bounce: 0.05,
  maxSpeed: 0,
};

export const BALL = {
  radius: 11,
  mass: 0.45,
  bounce: 0.28,
  maxSpeed: 980,
  /** Linear drag so shots die instead of pool-table ping-pong */
  drag: 140,
};

/** Ball-centered aim (yellow arrow + % + dotted cone) */
export const AIM = {
  maxPull: 130,
  minPower: 220,
  maxPower: 920,
  coneSpread: 0.28,
  coneSpreadMin: 0.1,
  arrowMin: 52,
  arrowMax: 170,
};

export const FLICK = {
  settleSpeed: 28,
  settleMs: 280,
};

export const MATCH = {
  goalsToWin: 3,
  durationSec: 180,
  teams: {
    home: { name: 'Blue', color: 0x1e88e5, accent: 0x90caf9, shorts: 0xffffff },
    away: { name: 'Red', color: 0xe53935, accent: 0xffcdd2, shorts: 0x212121 },
  },
};

export type TeamSide = 'home' | 'away';
export type SquadSize = 2 | 3;

export interface MatchOptions {
  squadSize: SquadSize;
}
