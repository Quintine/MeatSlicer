# Changelog

All notable changes to **MeatSlicer** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.0] — 2026-08-12

### Added
- **HD Remaster setting** — opt-in visual mode toggled from the title screen (press **H** or click the HD REMASTER tag). When on: the canvas renders at 4× resolution (3840×2560) with smooth scaling, the sprite loader serves a 4× WebP tier (`assets/hd/`) generated from the raw source art (`assets/raw/`) by `tools/hd_assets.py`, and the room-layer offscreen canvas renders at 4×. The setting persists to `localStorage` (`meatslicer_hd_remaster`) and reloads the page on toggle (no live hot-swap). If an HD file is missing, the loader falls back per-sprite to the standard PNG. **Default is off** (classic pixelated 960×640 look). Toggle is title-screen only (mid-run reload would lose the run).

## [0.7.2] — 2026-08-11

### Fixed
- **Documentation kept in sync with the 0.7.0 QoL batch** — everything that changed in 0.7.0 is now documented: the armor stat is described as a literal 0–75% dodge chance (Tanned Hide +8%, Thick Hide +4% — no more diminishing curve) in the gameplay, items, and perks guides; Red Right Hand's right-hand full-blade hitbox (reach 58 / offset 36 / radius 38) and the Cauterizer's right-hand projectile origin are now in the weapons guide; and the firing movement slow (×0.95 Bone Popper / ×0.85 otherwise) is in the player stats.

---

## [0.7.0] — 2026-08-11

### Added
- **Dual-platform release** — every push now ships BOTH a Windows zip and a Linux AppImage attached to a matching GitHub release (`dist:linux` script + AppImage target added to `electron-builder.yml`). Standing policy recorded in the release-process knowledge.
- **Crimson Metronome heart loan** — the legendary lends a half heart on its 8th shot and repays it when the room is cleared clean; a hit room forfeits the loan.
- **Weapon-drop lockout** — dropped weapons stay un-pickable for a 2.5s window to stop instant swap loops.
- **Big-room wall-peek camera** — in rooms larger than the screen, the camera now glides slightly past the arena edge (into the drawn wall band) as the player nears a wall, so walls and their exit doors come into view.
- **20 pre-existing statistical checks seeded deterministically** — large RNG sampling (item favor, elite drops, toast re-arm) now runs under a fixed seed so the smoke suite passes identically every run.

### Changed
- **Big-room door entries land at the door** — the door-transition placement now sets BOTH coordinates (destination arena's `cx`/`cy` on the opposite face), fixing the landing-into-a-wall bug in the new large room shapes.
- **Red Right Hand hitbox matches the saw** — the chainsaw's hit area now sits on the character's right hand (`aim + π/2`, offset `rho`) at full blade reach/radius, instead of a small forward circle.
- **Flamethrower fires from the right hand** — The Cauterizer's projectiles originate 26px right of the body; the Bile Blunderbuss cone is unchanged.
- **Firing slows movement** — holding fire while moving slows the player 5% with the Bone Popper and 15% with every other weapon.
- **Armour is now a literal dodge chance** — the `armor` stat is a direct 0–75% damage-dodge chance (the diminishing curve is gone); Tanned Hide +8%, Thick Hide +4%.
- **Pedestal bases persist** — an item pedestal stays after its item is taken and is never removed by walking over it.
- **Weapon fire locked out in menus + 50ms after close** — firing is impossible in any menu and for 50ms after it closes; supersedes the level-up-only click mask.
- **Perk-selection guard shortened** — the accidental-pick lock on a fresh draft dropped from 1.5s to ~0.4s.

### Fixed
- **No accidental shot when choosing an upgrade card** — the reward-click no longer carries the held button into play (now generalized to every menu→play transition).

### Removed
- **`docs/development.md`** — retired from the repo; durable developer knowledge now lives in Serena memories (`.serena/memories/meatslicer-development.md`, memory version 0.7.0, and `meatslicer-release-process.md`).

---

## [0.6.0] — 2026-08-10

### Added
- **Big rooms with Isaac-style camera** — floor rooms can spawn extra-large and odd-shaped arenas (grand hall, deep hall, meat hall, odd hall); the view follows the player and clamps to the room instead of being a fixed screen, and the floor mixes them in at higher floors with reciprocal doors.

---

## [0.5.0] — 2026-07-30

### Added
- **Hidden in-game debug console** — a dev-only cheat/inspection toolset opened with the backtick `` ` `` key from play or pause, gated behind a launch flag so it stays undiscovered in normal play (`MeatSlicer.exe --dev`, `npm start -- --dev`, `play-dev.bat`, or `localStorage.meatslicer_dev='1'`). Eight tabs reusing the field-manual canvas UI:
  - **Player** — hp/maxHp/shield/level, full-heal, kill, grant levelups, force the perk draft, teleport to cursor, and god-mode / infinite-ammo / one-shot-kill toggles
  - **Weapons** — equip any of the 16 weapons (old weapon goes to the holster), refill/set ammo, drop at cursor, spawn item pedestal
  - **Items** — give, remove, or set exact tier for any item via a stat-rebuild; presets for one-of-everything, max-everything, clear-build
  - **Perks+Active** — grant any of the 22 perks by id, remove drafted perks, equip/fire any active item
  - **World** — warp to any floor, teleport to the boss/item room, clear/kill room, spawn any of the 11 enemy types (count + elite) or any of the 9 bosses by id, spawn pickups
  - **Pressure** — set the pressure value or dial numerically, freeze pressure, live gain/relief readout
  - **Stats** *(read-only)* — the full `p.stats` table in two scrollable columns, diff-highlighted against defaults, plus powerScore, entity counts, and a wall-clock FPS meter
  - **Misc** — timescale (0.25×/1×/4×), freeze + single-frame step, render visualizers (collision circles, arena bounds, enemy HP numbers, hazard shapes, magnet radius), set score/kills/streak, trigger game over, SFX/FX test buttons, and a pin-live mode that keeps the world running behind the panel
- **Run tainting** — any mutating debug action marks the run so best-score persistence is skipped; the HUD shows a `[DEBUG]` tag and the game-over screen shows "score not recorded". Read-only tools do not taint
- **Item/perk removal via stat rebuild** — `defaultPlayerStats()` factory extracted from `initPlayer()`, plus `p.perks` tracking in `grantPerk()`, enabling `debugRebuildStats()` to reset and re-apply the whole build
- **`applyPressureDelta()`** — single mutation point for `G.pressure` (hurt relief, room decay, room-clear gain) so the debug pressure-lock can freeze difficulty in one place
- **Dev documentation** — `docs/dev-debug.md` (kept out of the player-facing manual)

### Changed
- **`spawnBoss()` accepts an optional forced boss index** so the console can spawn any boss by id
- **`useActive()` accepts an optional force flag** to fire from the debug console outside play mode

### Fixed
- **Positional audio NaN guard** — `Sfx.output()` no longer produces a silent/broken node when a caller passes a positionless object (this is why the debug BOSS ROAR test was inaudible); `pan`/`distanceGain` are only computed for finite coordinates

---

## [0.4.0] — 2026-07-30

### Added
- **Confirmed menu and desktop exits** — explicit confirm dialog before quitting
- **Locked gore death and enemy health pips** — visual health indicators on enemies, gore-styled death animation locked behind kill state
- **Variable room shapes and themes** — rooms are no longer uniform rectangles; different shapes and visual themes appear across the descent
- **Pressure dial expanded to 21 notches** — finer granularity on the pressure mechanic (previously 11 notches)
- **Five pressure-monster archetypes** — new enemy types that spawn based on pressure level
- **Boss stairs sealed after victory** — stairs to the next floor are blocked until the boss is defeated; the seal breaks on victory

### Changed
- **Pause actions and duplicate weapons polished** — pause menu interactions refined; duplicate weapon handling improved

### Fixed
- **Desktop exit disabled in browsers** — the desktop-specific quit action no longer appears when running in a browser

---

## [0.3.0] — 2026-07-30

### Added
- **Per-weapon ammo refill system** — every special weapon gets an explicit `refill` value (units per ammo pickup, tuned so one pickup funds ~10 kills), replacing the `ammoRefillFraction` log2 heuristic and `ammoWeight` overrides
- **Stream weapons** — Bile Blunderbuss and The Cauterizer join Red Right Hand as time-denominated stream weapons (`drain` per second) instead of per-shot cost
- **Boss room ammo** — boss rooms now stock one ammo pickup on entry and drop one guaranteed ammo on death
- **Calibration tool** — `tools/ammo_sim.js` calibrates every weapon into the 8–13 kills/refill band (all 15 pass); smoke test guards the ammo structure

### Changed
- **Sawblades ricochet through enemies** — bounce fix makes them chain effectively
- **Traps catch 3 victims** — increased from lower cap
- **Lobbed projectiles arc overhead** — Flesh Masher, Trap Queen, and Swarm Jar payloads now reliably deploy at the target point
- **Marrow Draught** now covers stream drain
- **Balance trimming**: Cauterizer burn (2.2s×2 → 1.5s×0.8), bile acid pools (3.5s×1.5 → 2.5s×0.8)

### Removed
- **Unused `wpn-hemophage-2.mp3`** — stale audio asset deleted

---

## [0.2.0] — 2026-07-30

### Changed
- **Toast durations are now per-toast** — `addToast` accepts a third argument for display duration; passive item and active item pickups display for **5.5s** instead of the default 2.5s

---

## [0.1.0] — Pre-release (2026-07-29 – 2026-07-30)

The initial series of commits that built the game from scratch. Grouped by feature area.

### Added — Core Game
- **Adaptive progression and item expansion** *(`8ab0857`)* — initial commit with 298 files establishing the entire game codebase: player, enemies, bosses, weapons, items, perks, HUD, rooms, bullets, particles, audio, music, sprites, and the smoke-test harness
- **Doom-style weapon audio batch** *(`64ac534`)* — all 13 weapon fire one-shots and 4 weapon loops regenerated in a chunky, bass-heavy 1993 Doom style via ElevenLabs
- **New SfxBank clips**: `ui_active`, `ui_active_empty` (active items), `ui_curse` (legendary pickups), `plr_revive` (Second Skin revive)

### Added — Items & Progression
- **Item system overhaul** *(`4f46d54`)*:
  - Item rarity bands (`common`/`uncommon`/`rare`/`legendary`) with per-item tier caps
  - Weighted source pools (elites → common, item rooms → uncommon, bosses → rare/legendary)
  - Rarity-weighted powerScore to cap difficulty inflation from common stacks
  - 14 new passives including Chill Gland (activates `slowOnHit`) and Hooked Sinew (activates `magnetPull`)
  - Rarity-tinted pedestal glow + nameplates, rarity-sorted HUD implant tray
  - Generated 14 item icons; asset cache v=38
- **Phase 3: 12 hook passives** *(`a93802e`)* — Dead Weight (execute), Cauterized Veins (burn bonus), Pain Engine, Iron Lung, Slaughter Rhythm, Hollow Choir, Sawbone Coil, Glutton's Gut, Thresher Plate, Blood Moat, Meat Hook, Blood Debt
- **Phase 4: 10 boss-exclusive legendaries** *(`f955232`)* — Butcher's Oath, Second Skin, Twin Sidearm, Crimson Metronome, Abattoir Engine, Gore Crown, Thousand Teeth, Hollow Father, The Last Cut, Meat Grinder (cap 1, boss-only, reset per floor)
- **Phase 5: Active items** *(`0ec12cd`)*:
  - 10 actives: Bone Nova, Offal Bomb, Blood Transfusion, Cleaver Storm, Butcher's Bell, Marrow Draught, Slaughter Time, Panic Room, Skinner's Coin, Gut Reroll
  - Charges accrue +1/combat room, +2/boss
  - Dedicated active pickup with weapon-style swap-drop; 30% boss / 15% item-room bonus pedestal spawns
  - HUD active slot with charge pips + READY state; ACTIVES help page
- **Differentiate duplicates** *(`4f46d54`)* — Grafted Trigger, Crow Bait, Hollow Bones, Twin Hearts

### Added — Pressure & Difficulty
- **Pressure dial** *(`a02cff5`)* — title-screen dial (-5..+5) tunes pressure rise/relief; score multiplied by live pressure
- **500ms spawn telegraph** *(`a02cff5`)* — wave spawns telegraph before appearing

### Added — Weapons
- **Rebalanced weapon tiers** *(`f71d202`)* via quantitative DPS/range/accuracy/pool scoring:
  - T0: repeater, marrow
  - T1: cleaver, saw, hemophage, eye
  - T2: bile, guthook, fleshmasher, trapqueen, redhand
  - T3: cauterizer, tenderizer, spinaltap, swarmjar
- **Ammo economy tightened** *(`4dad22d`)* — 25% less ammo per box, 25% fewer ammo drops

### Added — HUD & UI
- **In-game field manual** *(`3f856e4`)* — 7-page technical manual (controls, run loop, arsenal, mutations, implants, bestiary, pressure/defense math); renders live from game tables
- **Vitals HUD** *(`a02cff5`)* — two-row hearts, half-container outlines, half-heart shield pips
- **HUD opacity slider** *(`a02cff5`)* — in pause menu; boss bar + toasts stay opaque
- **Readable 8-page field manual** *(`a02cff5`)* — bigger panel + fonts, implants split across pages
- **Help manual layout fix** *(`d5b1828`)* — tabs shrink to fit 920px panel; implant rows spaced at 26px

### Added — Visual & Environment
- **Bigger gore-red Minis** *(`a02cff5`)* — radius 10→14, sprite 32→48 with regenerated art
- **Wider walkable doorways** *(`a02cff5`)* — clear passage for open doors, teeth only when locked
- **Item stickiness ramps** *(`a02cff5`)* — 10%/owned item (cap 50%) instead of flat 50%
- **Generated perk and item icons** *(`9ba0e22`)* — via `gen_assets.py`
- **Player documentation** *(`c76d126`)* — docs for items, perks, bosses, and gameplay
- **Desktop build** *(`956f116`)* — Electron app with custom `app://` protocol, borderless fullscreen, single-instance lock, and `MS_VERIFY` diagnostic harness

### Changed
- **Bone Knit** *(`8cf9932`)* — now a chance-based room heal: 3% roll per stack to mend half a heart on combat room clear (was guaranteed)
- **Scrap Feed** *(`a02cff5`)* — diminishing returns like Thick Hide
- **Ghoul Heart** *(`f955232`)* — now +4 HP (2 full hearts)
- **Brass Magazine** *(`f955232`)* — ammo efficiency uses diminishing additive formula (same as Scrap Feed)
- **Audio rebatch** *(`64ac534`)* — weapon fire sounds regenerated in Doom-style
- **Pinned Electron** `@40.10.2` + `electron-builder@25.1.8` for Node 20 compatibility

### Removed
- **Footstep system** *(`64ac534`)* — removed entirely (8 `plr_step*` samples, `Sfx.footstep`, player.js call site, smoke test block)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `Added` | New features |
| `Changed` | Changes in existing functionality |
| `Fixed` | Bug fixes |
| `Removed` | Removed features |

---

*Generated from the git log. Last commit: v0.8.0*
