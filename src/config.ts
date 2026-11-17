export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const PITCH = {
  margin: 40,
  lineColor: 0xe8f5e9,
  grassDark: 0x1b5e20,
  grassLight: 0x2e7d32,
  goalDepth: 32,
  goalWidth: 120,
};

export const DISC = {
  radius: 22,
  mass: 1.2,
  bounce: 0.72,
  friction: 0.985,
  maxSpeed: 780,
};

export const BALL = {
  radius: 11,
  mass: 0.55,
  bounce: 0.85,
  friction: 0.988,
  maxSpeed: 900,
};

export const FLICK = {
  maxPull: 110,
  minPower: 180,
  maxPower: 860,
  settleSpeed: 22,
  settleMs: 320,
};

export const MATCH = {
  /** First to this many goals wins (timer is backup). */
  goalsToWin: 3,
  durationSec: 180,
  teams: {
    home: { name: 'Blue', color: 0x1e88e5, accent: 0x90caf9 },
    away: { name: 'Red', color: 0xe53935, accent: 0xef9a9a },
  },
};

export type TeamSide = 'home' | 'away';
export type SquadSize = 2 | 3;

export interface MatchOptions {
  squadSize: SquadSize;
}
