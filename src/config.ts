export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const PITCH = {
  margin: 36,
  lineColor: 0xe8f5e9,
  grassDark: 0x1b5e20,
  grassLight: 0x2e7d32,
  goalDepth: 28,
  goalWidth: 110,
};

export const PLAYER = {
  radius: 16,
  speed: 220,
  accel: 1400,
  friction: 0.88,
  kickRange: 34,
  kickPower: 420,
  kickCooldownMs: 280,
};

export const BALL = {
  radius: 9,
  friction: 0.985,
  bounce: 0.82,
  maxSpeed: 620,
};

export const MATCH = {
  durationSec: 90,
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
