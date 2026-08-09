# MeatSlicer: A Butcher's Descent

**Clear, harvest, descend.**

MeatSlicer is an endless top-down arena roguelite. Play as the Butcher, clear rooms of flesh-hungry horrors, draft mutations, assemble grotesque item builds, defeat each floor's boss, and keep descending until the meat wins.

## Play

### Browser

On Windows, run:

```bat
play.bat
```

This starts a local server at <http://localhost:8123> and opens the game in your browser. Python is required.

### Desktop

```sh
npm install
npm start
```

### Development mode

Run `play-dev.bat` for the browser build, or:

```sh
npm start -- --dev
```

Press the backtick key (`` ` ``) while playing or paused to open the debug console.

## Test and package

```sh
npm test
npm run dist
```

`npm test` runs the smoke test. `npm run dist` packages the Windows Electron build as a zip in `dist/`.

## Documentation

See the [documentation index](docs/README.md) for the gameplay guide, weapons, items, perks, enemies, bosses, debug tools, and changelog.

## Technology

The game uses plain JavaScript and HTML5 canvas, with an Electron wrapper for the desktop build. It has no browser framework or bundler.

## Asset provenance

This project contains AI-assisted generated visual and audio assets. Production sprite stills were generated through OpenRouter and processed by the repository's asset tools; sound effects were generated with ElevenLabs. Generated assets and the rest of this repository are distributed under the MIT License.

## License

[MIT](LICENSE)
