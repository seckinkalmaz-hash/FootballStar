# FootballStar

Personal **Soccer Stars–style** flick soccer prototype (Phase 1: single-player).

Turn-based table soccer: drag a disc back to set aim + power, release to şut/pas. Physics resolves, then the opponent plays.

**Stack:** TypeScript · Phaser 3 · Vite  
**Art:** Original simple geometry only

## Play

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173`).  
Demo: `/?autostart=1`

```bash
npm run build
npm run preview
```

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Select disc | Click / tap a Blue disc | `1` / `2` / `3` |
| Flick (şut / pas) | Drag **back**, release | Arrows aim · hold Space · release |
| Menu | MENU | `M` |
| Rematch | REMATCH | `R` |

Pick **2v2** or **3v3**. First to 3 goals wins (3:00 backup timer). You flick all Blue discs; Red is AI.

## Scope

See `/docs` plan in the project store: flick match sim, not continuous WASD running soccer.
