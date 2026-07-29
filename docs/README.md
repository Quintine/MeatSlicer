# MeatSlicer: A Butcher's Descent

**Clear, harvest, descend.**

MeatSlicer is an endless top-down arena roguelite. You are the Butcher, descending floor by floor through an infinite meat-locker hell: clear rooms of flesh-hungry horrors, draft mutations, stack grotesque passive items into a broken build, kill the boss, take the stairs. The descent never ends — the only question is how deep you get before you're butchered, and whether your score becomes the new best cut.

## Documentation index

| Doc | Contents |
|---|---|
| [Gameplay Guide](gameplay.md) | Core loop, controls, player stats, rooms & floors, pickups, leveling, scoring, pressure/difficulty systems, HUD |
| [Weapons](weapons.md) | All 16 weapons with exact stats, drop tiers, and damage math |
| [Items](items.md) | All 46 passive items, stacking/tier rules, proc numbers, synergies |
| [Perks](perks.md) | All 23 Mutation Draft perks, XP curve, draft mechanics |
| [Enemies](enemies.md) | All 6 enemy types, elites, drops, wave and scaling formulas |
| [Bosses](bosses.md) | All 9 bosses: rotation, scaling, full attack patterns, counters |

### Quick numbers

- **16 weapons** (1 infinite-ammo sidearm + 15 special weapons across 4 tiers)
- **46 passive items** (stacking, tier cap IX)
- **23 perks** (draft 1 of 3 per level-up)
- **6 enemy types** (+ elite variants)
- **9 bosses** (fixed rotation, one per floor)
- **∞ floors** (permadeath, endless descent, high-score chase)

## Running the game

### Browser (quickest)

```
play.bat
```

Serves the game locally at <http://localhost:8123> and opens it. Close the minimized server window to stop.

### Electron (desktop app)

```
npm install
npm start
```

### Build a distributable

```
npm run dist
```

Packages a Windows zip via electron-builder into `dist/`.

### Tests

```
npm test
```

Runs the smoke test (`test/smoke.js`).

## Tech overview

- **Stack:** plain JavaScript + HTML5 canvas, no framework. Electron wrapper for desktop.
- **Entry:** `index.html` loads `js/main.js` and the game modules directly (no bundler).
- **Code layout** (`js/`): `main` (loop, screens), `state` (global state), `rooms` (floor gen), `player`, `input`, `weapons`, `bullets`, `items`, `perks`, `pickups`, `enemies`, `bosses`, `hud`, `sprites`, `particles`, `audio`, `sfx`, `sfxbank`, `utils`.
- **Persistence:** `localStorage` only (best score, volumes, auto-draft setting).

## The fantasy in one paragraph

Rooms lock behind you. The meat waves come in threes. Elites gleam gold and drop the good stuff. Set the Pressure Dial before you descend — the gauge climbs the longer you stay flawless, and every point of score rides it. Every boss — saw, crown, mother, flenser, choir, father, auger, scald — cycles back around, deeper and meaner, until the meat finally wins. Take the meat. Take the stairs.
