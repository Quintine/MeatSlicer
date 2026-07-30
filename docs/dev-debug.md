# Debug Console

An in-game cheat / inspection toolset. It is gated behind a dev launch flag so
it doesn't interfere with normal play, and it's documented here because the
game is still in development — testers and players are welcome to use it.

## Enabling it

The console is gated behind a dev flag and is completely inert otherwise (the
open key does nothing and `G.devMode` is `false`).

| Launch | Flag |
|---|---|
| Packaged Electron app | `MeatSlicer.exe --dev` |
| `npm start` | `npm start -- --dev` |
| Browser (local server) | `http://localhost:8123/?dev=1` → use **`play-dev.bat`** |
| Any browser (persistent) | `localStorage.setItem('meatslicer_dev', '1')` in devtools |

Detection lives in `debugEnabled()` (`js/debug.js`). For the packaged app, the
`--dev` flag is forwarded into the preload's `process.argv` as `--ms-dev` via
`webPreferences.additionalArguments` (`desktop/main.js`), and
`desktop/preload.js` exposes it as `window.MSDesktop.dev` (custom app flags
aren't guaranteed to reach a renderer's `process.argv` on their own, hence the
explicit forward).

## Opening it

Press the **backtick `` ` ``** (or `~`) key from **play** or **pause**. The
game pauses (its own `G.mode = 'debug'`). `` ` `` / `Esc` / the `[X]` button
closes it back to where you came from.

Navigate tabs with `←`/`→`, number keys `1-8`, or by clicking the tab tags.

## Run tainting

Any **mutating** action sets `G.debugUsed = true`. When tainted:

- `gameOver()` skips the `meatslicer_best` best-score write.
- The HUD shows a red `[DEBUG]` tag and the game-over screen shows
  `[ DEBUG RUN — SCORE NOT RECORDED ]`.
- The console footer shows `TAINTED`.

Read-only tools (the STATS tab, the render visualizers, the FPS counter,
pinning) do **not** taint. Taint resets on the next run (`resetRun()`).

## Tabs

1. **PLAYER** — hp/maxHp/shield/level number rows, full-heal, kill, +1 pending
   levelup, force-open the perk draft, teleport to cursor, +500 score, and
   three toggles: **God mode** (`hurtPlayer` no-ops), **Infinite ammo** (ammo
   topped up each frame), **One-shot kill** (`damageEnemy` forces `dmg=1e9`,
   which still respects Plate Father's plate mitigation).
2. **WEAPONS** — picker over all 16 `WEAPONS`. Equip (old weapon goes to the
   holster unless it was the Bone Popper), refill ammo, holster current, drop
   the weapon as a pickup at the cursor, spawn an item pedestal, set ammo.
3. **ITEMS** — picker over all `ITEMS` grouped by rarity, showing current tier.
   Give +1 (routes through `giveItem`), remove 1 tier, remove all, set to max
   tier, or set an exact tier. Presets: *one of everything*, *max everything*,
   *clear build*.
4. **PERKS+ACTIVE** — grant any of the 22 `PERKS` by id, remove a drafted perk,
   clear all perks. Set / fire an active item from `ACTIVES`.
5. **WORLD** — warp to floor N (`genFloor` + `enterRoom`), next floor, teleport
   to the boss/item room, clear room, kill all, kill boss, regen floor. Spawn
   any of the 11 `ENEMY_TYPES` (count + elite flag) or any of the 9 `BOSS_DEFS`
   by id (uses `spawnBoss(floor, forcedIndex)`), and spawn pickups at cursor.
6. **PRESSURE** — set `G.pressure` (clamped to `PRESSURE_MIN..MAX`), set the
   dial, and **freeze pressure** (the `applyPressureDelta` helper in
   `js/state.js` no-ops). Shows live `pressureGainUnits`/`pressureDropUnits`,
   streak, recent hits, and the Abattoir Engine multiplier.
7. **STATS** *(read-only)* — the full `p.stats` table in two scrollable columns,
   diff-highlighted against `defaultPlayerStats()`. Plus `powerScore()`, entity
   counts, FPS, floor/time.
8. **MISC** — timescale (0.25×/1×/4×), freeze + single-frame step, render
   visualizers (collision circles, arena bounds, enemy HP numbers,
   hazard/telegraph shapes, magnet radius), set score/kills/streak, trigger
   game over, and SFX/FX test buttons. The **PIN** toggle keeps the panel open
   while the world runs live behind it (and shows a compact always-on-top
   readout when the panel is closed but a visualizer is active).

## How item/perk removal works (stat rebuild)

`ITEMS[iid].apply(stats, p)` and `perk.apply(stats, p)` are one-way mutations,
so removal isn't a subtraction — it's a rebuild. `debugRebuildStats()` resets
`p.stats` to `defaultPlayerStats()`, zeroes `shieldHp`, then re-applies every
owned item tier (`p.items[iid]` times, mirroring `giveItem`) and every drafted
perk (`p.perks`, tracked by `grantPerk`).

Two caveats:

- **maxHp-lowering items** (Blood Debt, Butcher's Oath) replay in ownership
  insertion order, so a rebuild can produce a valid but slightly different
  maxHp than the original build order. Current hp is snapshotted before and
  clamped to the new maxHp afterward.
- One-time player side effects baked into some `apply` functions (e.g. the
  immediate heal from Iron Stomach, the immediate shield from Bone Plate /
  Shield Heart) are re-granted on rebuild. This is intentional and keeps the
  model simple.

## Architecture

Everything lives in `js/debug.js`, loaded after `js/help.js` and before
`js/main.js` in `index.html`. It reuses the help manual's canvas UI primitives
(`drawPixelPanel`, `drawPixelTag`, `hfont`, `inRect`, `wrapText`) and mirrors
its `HELP_PAGES` / `updatePauseHelp` structure with a `DEBUG_PAGES` array.

The hooks into core code are intentionally minimal:

- `js/state.js` — `debugUsed`/`debugFlags`/debug panel state on `G`, plus the
  `applyPressureDelta()` helper.
- `js/player.js` — `defaultPlayerStats()` factory (extracted from `initPlayer`),
  `perks: []` field, and the god-mode early-return in `hurtPlayer()`.
- `js/perks.js` — one line in `grantPerk()` to record the perk id.
- `js/enemies.js` — one line in `damageEnemy()` for OHKO.
- `js/rooms.js` — two `applyPressureDelta()` call sites.
- `js/bosses.js` — optional `forcedIndex` param on `spawnBoss()`.
- `js/main.js` — `G.devMode` in `init()`, the open gesture in `play`/`pause`,
  the `debug` case in `update()`, timescale in `loop()`, and the
  `drawDebug`/`drawDebugOverlays`/`drawDebugPin` calls in `draw()`.
- `js/hud.js` + `drawGameOver` — the taint markers.
