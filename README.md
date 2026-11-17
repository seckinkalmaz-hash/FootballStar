# FootballStar

Personal Mini Soccer Stars–style arcade football prototype (Phase 1: single-player).

**Stack:** TypeScript · Phaser 3 · Vite  
**Art:** Original simple geometry only

## Play

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173`).

```bash
npm run build    # production build → dist/
npm run preview  # serve dist/
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD or arrows | Virtual stick |
| Kick | Space or click near ball | Kick button |
| Menu | M (or MENU button) | MENU |
| Rematch | R (end screen) | REMATCH |

Pick **2v2** or **3v3** on the title screen (keys `2` / `3`, Enter to start). You control the starred Blue player; teammates and Red are AI. Matches last 90 seconds.

Demo shortcut: open `/?autostart=1` to skip straight into a 3v3 match.

## Scope

See the project plan: Phase 1 offline arcade MVP only (no multiplayer, career, or Matchday-Manager features).
