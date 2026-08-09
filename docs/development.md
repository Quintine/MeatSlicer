# Development Guide

This guide consolidates the durable project knowledge used to develop, test,
package, and maintain MeatSlicer. When this guide and the implementation
disagree, the implementation and configuration files are the source of truth.

**Memory version: 0.5.2**

## Architecture

MeatSlicer is an endless top-down arena roguelite built with plain JavaScript
and HTML5 canvas. It has no browser framework, module system, or bundler.

`index.html` loads the scripts in `js/` as globals in a fixed order:

1. `utils.js`
2. `state.js`
3. `input.js`
4. `sfx.js`
5. `sfxbank.js`
6. `audio.js`
7. `sprites.js`
8. `particles.js`
9. `weapons.js`
10. `bullets.js`
11. `pickups.js`
12. `items.js`
13. `perks.js`
14. `enemies.js`
15. `bosses.js`
16. `rooms.js`
17. `player.js`
18. `hud.js`
19. `help.js`
20. `debug.js`
21. `main.js`

Because the scripts share globals, changing their order can break initialization
or runtime dependencies.

### Runtime details

- The canvas uses a fixed 960×640 logical resolution and is CSS-scaled with
  pixelated image rendering.
- There is no camera. Rooms use variable `G.arena` inset bounds for full halls,
  horizontal or vertical halls, chambers, and pits.
- Persistence uses `localStorage`. Current keys include `meatslicer_best`, the
  music and SFX volumes, `meatslicer_autoperk`, `meatslicer_pressure_dial`, and
  `meatslicer_hud_alpha`.
- `powerScore()` weights perks at 0.5 and item tiers at 1.0 when scaling enemies.
- `G.pressure` is an adaptive difficulty multiplier, clamped from 0.60 to 2.00.
  The title-screen pressure dial ranges from −10 to +10.
- `procOnHit` in `js/enemies.js` is the shared on-hit payload router used by all
  weapons.

### Cache busting

Asset and script URLs use a `?v=N` cache suffix. When shipping changed assets or
scripts, bump the value together in:

- `index.html`
- `js/sprites.js`
- `js/sfxbank.js`

## Repository layout

| Path | Purpose |
|---|---|
| `index.html` | Browser entry point and script load order |
| `js/` | Game systems and content definitions |
| `css/` | Browser and canvas presentation |
| `assets/` | Shipped sprites, animation sheets, UI art, and sound effects |
| `assets/raw/` | Generation intermediates; ignored and excluded from packages |
| `mp3-music/` | Music and boss tracks |
| `desktop/` | Electron main process, preload, and verification harness |
| `tools/` | Static server and visual asset-generation tools |
| `test/smoke.js` | Headless integration and regression suite |
| `docs/` | Player, content, release, and developer documentation |
| `build/icon.png` | Windows application icon |

## Build, run, and test

### Browser

On Windows:

```bat
play.bat
```

This runs the allowlisted static server in `tools/serve_game.py` and opens
<http://localhost:8123>. The equivalent manual command is:

```sh
python tools/serve_game.py --port 8123
```

Use `play-dev.bat` or append `?dev=1` to enable the debug console.

### Electron

```sh
npm install
npm start
```

Use `npm start -- --dev` to enable the debug console in Electron.

The lockfile currently resolves Electron 40.10.2 and electron-builder 25.1.8.
These versions support the development machine's Node 20 environment; review
Node compatibility before upgrading either package.

### Tests

Run the complete smoke suite before every commit:

```sh
npm test
```

This is equivalent to `node test/smoke.js` and must finish with
`ALL CHECKS PASSED`. The suite asserts exact balance values and scaling
formulas, so update expectations deliberately when changing game balance.

For a quick JavaScript syntax check:

```sh
node --check js/<file>.js
```

### Windows distributable

```sh
npm run dist
```

electron-builder writes a versioned zip and an unpacked application under
`dist/`. The version comes from `package.json`. `dist/` and `node_modules/` are
ignored; commit package manifests, not generated dependencies or builds.

## Electron packaging

The Electron shell serves the unchanged browser game through a privileged
`app://` protocol.

### Package contents

`electron-builder.yml` uses a strict allowlist for the desktop shell, HTML,
CSS, JavaScript, shipped assets, music, documentation, and `package.json`.
`assets/raw/**` must remain explicitly excluded because it contains large
generation intermediates that are not part of the game.

The application deliberately uses `asar: false`.

### Custom protocol requirements

The `app://` protocol is registered as standard, secure, fetch-capable, and
stream-capable. Streaming is required for looping MP3 audio. The handler must:

- call `decodeURIComponent`, because music filenames contain spaces;
- use `path.join` rather than `path.resolve`, because URL pathnames begin with
  `/`; and
- preserve traversal protection before serving a requested path.

### Window behavior

- Borderless fullscreen starts at 1280×832 restore geometry.
- F11 toggles fullscreen.
- F12 and Ctrl+Shift+I toggle developer tools.
- Ctrl+R reloads.
- The application menu is removed.
- A single-instance lock prevents duplicate app instances.

### winCodeSign extraction issue

electron-builder's winCodeSign archive can fail to extract on Windows when the
current account cannot create symlinks. The local workaround is a pre-seeded
cache under:

```text
%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0
```

If the cache must be rebuilt, extract the archive while excluding its `darwin`
entries, or enable an environment that permits symlink creation.

### Packaged-app verification

The optional harness in `desktop/main.js` drives a run, loads the sound bank,
captures diagnostics, and exits. In PowerShell:

```powershell
$env:MS_VERIFY_OUT = "$env:TEMP\meatslicer-verify.json"
Start-Process "dist\win-unpacked\MeatSlicer.exe" -Wait
Get-Content $env:MS_VERIFY_OUT
```

Set `MS_VERIFY_SHOT` to a PNG path to capture a screenshot as well. The same
variables work with `npx electron .`. A valid result has an empty `log`, no SFX
failures, and an SFX buffer count matching `SfxBank.FILES` and the files on
disk; the exact count can change as audio is added.

The Windows build is not code-signed, so downloaded copies may trigger a
SmartScreen warning. Code signing, installers, automatic updates, and
macOS/Linux packaging remain future work.

## Visual asset pipeline

The project has two visual asset tiers. AI-generated stills are the production
tier; procedural drawings are fallbacks and composition guides.

### Production sprites

`tools/gen_assets.py` generates production stills through OpenRouter's image
endpoint and derives animation sheets from them.

```sh
python tools/gen_assets.py --list
python tools/gen_assets.py <name-substrings> --quality medium
python tools/gen_assets.py <name-substrings> --force --quality medium
```

Authentication is read from `OPENROUTER_API_KEY` in the process environment or
the user-only `~/.config/MeatSlicer/.env`, outside the served game directory.
Never commit credentials.

The generator:

- attaches `assets/raw/guides/style_reference.png` as a style reference;
- requests isolated sprites on `#FF00FF` backgrounds;
- flood-keys the border to alpha;
- crops, centers, resizes, and quantizes output to the shared palette; and
- records generation metadata in `assets/raw/openrouter_manifest.json`.

`render_sheets()` calls `render_actor_sheet(name, use_existing=True)`, ensuring
animation sheets are derived from the production still.

### Procedural fallback sprites

`tools/draw_sprites.py` contains procedural fallback drawing functions. It is
useful for guides, runtime fallbacks, and derived effects.

> **Destructive-tool warning:** Never run `draw_sprites.py` without an explicit,
> narrow name filter. Its main routine writes every matching procedural still
> and rebuilds sheets with `use_existing=False`, which can overwrite production
> AI stills and their derived atlases.

Prefer `gen_assets.py` for shipped characters.

### Actor animation atlases

- Boss frames are 128×128.
- Player frames are 96×96.
- Normal enemy frames are 64×64.
- Atlases use eight columns and eight compass directions.
- Cell lookup is `offset + direction * frames + frame`.
- Source coordinates are `(cell % 8) * frameSize` and
  `floor(cell / 8) * frameSize`.
- Actions match `ACTOR_ANIMS` in `js/sprites.js`: idle, move, attack, hit, and
  death.
- Player legs use a separate eight-frame strip.

To add a production animated character:

1. Add its `Spec` to `SPECS` in `tools/gen_assets.py`.
2. Add its name to `ACTORS` in `tools/draw_sprites.py`.
3. Run `python tools/gen_assets.py <name> --quality medium`.
4. Register the still and sheet in `SPRITE_MANIFEST` as required.
5. Bump the shared cache version before shipping.

## Audio pipeline

Sound effects are generated with the ElevenLabs audio tooling. There is no
repository-local generation script, so requests should use a per-file manifest
with the exact target filename, sound description, and style brief.

Generated files may initially land in the project root, and generated filenames
may replace underscores with hyphens. Move and rename each result into
`assets/sfx/` using the underscore filename expected by the game.

To wire a new sound:

1. Generate the clip using its exact manifest and style description.
2. Move and rename it into `assets/sfx/`.
3. Register it in `SfxBank.FILES` in `js/sfxbank.js`.
4. Run `npm test` to verify every registered file exists and is non-empty.
5. Bump the shared cache version before shipping.

`Sfx.sample()` and `Sfx.ui()` can fall back to procedural audio when a sample is
missing, but registering a missing file in `SfxBank.FILES` fails the smoke test.

## Versioning and releases

Versions use `X.Y.Z` with project-specific rules:

- `X` is the main version and is changed manually by the project owner only.
- `Y` marks a major feature or content expansion.
- `Z` marks a fix, minor addition, balance tweak, or adjustment.
- Components do not roll over automatically at 9; values such as `0.42.677`
  are valid.

The version lives in `package.json` and determines the packaged artifact name.

When changing the version:

1. Update `package.json`.
2. Bump the shared `?v=N` cache value in `index.html`, `js/sprites.js`, and
   `js/sfxbank.js`.
3. Run `npm test` and commit the source changes.
4. Run `npm run dist`.
5. Verify the packaged executable with `MS_VERIFY_OUT`.

## Memory versioning

The project knowledge ("memories") — this guide and the player-facing documents
under `docs/` — carries its own `X.Y.Z` version, tracked independently of the
game release version in `package.json`:

- `X` — a major milestone. Changed by the project owner only; a routine update
  or bump rule never raises it.
- `Y` — a major feature push: a large content expansion, a major mechanic, or a
  significant restructure of the knowledge base.
- `Z` — a small addition, a bug fix, or a single new small feature (a new
  gotcha, a corrected formula, a changed workflow, or the documentation sync
  that follows a gameplay change).

Components are independent counters and never roll over: `0.999.999` and
`0.42.677` are perfectly valid, and bumping `Z` on `0.999.999` gives
`0.999.1000`. Only `X` is exempt from automatic increases — it changes by
explicit human edit.

The current version is the `**Memory version:**` stamp at the top of this
guide; that stamp is the single source of truth.

When a change to durable knowledge lands (anywhere under `docs/`):

1. Edit the stamp: bump `Z` for a small addition or fix, `Y` for a major push,
   or — for a milestone — the project owner raises `X` by hand.
2. Run `npm test` (docs are not loaded by the game, so the suite is unaffected)
   and commit with an imperative message naming the bump, e.g.
   `docs: record Iron Lung synergy (memory 0.5.0 -> 0.5.1)`.
3. No `?v=` cache bump is needed — `docs/` is not served through `index.html`
   script tags; it only ships inside packages.

## Git workflow

Every completed change should be committed:

1. Run `git status` and review `git diff`.
2. Stage only intended files.
3. Never commit credentials, local environments, raw generation data,
   dependencies, or build output.
4. Run `npm test`.
5. Commit with a concise imperative summary matching the repository history.

The primary branch is `main`, and `origin` points to the public GitHub
repository. The local repository uses the GitHub account's noreply identity for
new commits.

## Keeping project knowledge current

Architecture, commands, workflows, naming conventions, and costly gotchas
should be documented when they become durable project knowledge. Keep one topic
per section, record why a constraint exists, and update stale guidance instead
of adding contradictory instructions.

Player-facing mechanics belong in the relevant files under `docs/`. Keep those
documents synchronized with gameplay changes. This development guide should be
updated whenever the build, packaging, asset, audio, release, or contribution
workflow changes.

Keep the `**Memory version:**` stamp at the top of this guide current: any
durable-knowledge change bumps it per `## Memory versioning`.
