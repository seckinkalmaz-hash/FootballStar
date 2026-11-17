export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const PITCH = {
  margin: 40,
  lineColor: 0xe8f5e9,
  grassDark: 0x2e7d32,
  grassLight: 0x43a047,
  goalDepth: 32,
  goalWidth: 120,
};

/** Blocky Mini Soccer Stars–style figure footprint */
export const PLAYER = {
  bodyW: 22,
  bodyH: 34,
  radius: 14,
  mass: 1.15,
  bounce: 0.55,
  maxSpeed: 720,
};

export const BALL = {
  radius: 11,
  mass: 0.5,
  bounce: 0.82,
  maxSpeed: 920,
};

/** Ball-centered aim (yellow arrow + % + dotted cone) */
export const AIM = {
  maxPull: 130,
  minPower: 160,
  maxPower: 880,
  coneSpread: 0.32, // radians half-angle at low power
  coneSpreadMin: 0.12,
  arrowMin: 48,
  arrowMax: 160,
};

export const FLICK = {
  settleSpeed: 22,
  settleMs: 320,
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
