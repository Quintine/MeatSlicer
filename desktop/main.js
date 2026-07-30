// ---- MeatSlicer desktop shell (Electron main process) ----
// Serves the game over a privileged app:// scheme so the renderer keeps a real
// origin: fetch() in js/sfxbank.js uses absolute /assets/... paths, and 28 mp3
// tracks stream through <audio> elements. Both need standard+stream privileges.
const { app, BrowserWindow, ipcMain, Menu, net, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const GAME_ROOT = path.join(__dirname, '..');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.setName('MeatSlicer');

// Mirrors the allowlisting in tools/serve_game.py: URL path -> file under the
// game root, with traversal protection. decodeURIComponent is required because
// the music loader encodes spaces ("Blood%20Arcade.mp3"), and path.join (not
// resolve) because pathname always begins with "/".
function installProtocol() {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    let rel;
    try { rel = decodeURIComponent(pathname); } catch (e) { rel = pathname; }
    if (rel === '/' || rel === '') rel = '/index.html';
    const served = path.normalize(path.join(GAME_ROOT, rel));
    if (served !== GAME_ROOT && !served.startsWith(GAME_ROOT + path.sep)) {
      return new Response('forbidden', { status: 400 });
    }
    return net.fetch(pathToFileURL(served).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,           // borderless windowed fullscreen on Windows
    width: 1280, height: 832,   // restore-down geometry when F11 exits
    backgroundColor: '#040305', // matches css/style.css body
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());

  // Menu removal also removes the default F11/DevTools/reload accelerators.
  // F12 and Ctrl+Shift+I are kept for debugging; Escape stays bound to pause
  // inside the game, so fullscreen is F11-only.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' || (key === 'i' && input.control && input.shift)) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    } else if (key === 'r' && input.control && !input.shift && !input.alt) {
      win.webContents.reload();
      event.preventDefault();
    }
  });

  installVerifyHarness(win);
  win.loadURL('app://meatslicer/index.html');
}

// Optional headless verification: set MS_VERIFY_OUT (json path) and optionally
// MS_VERIFY_SHOT (png path). Drives a run, drains the SFX bank, captures the
// level-up draft, writes results, and quits. Used to prove the packaged build
// serves every asset through the custom protocol.
function installVerifyHarness(win) {
  const outJson = process.env.MS_VERIFY_OUT;
  if (!outJson) return;
  const outPng = process.env.MS_VERIFY_SHOT;
  const log = [];
  win.webContents.on('console-message', (event, level, message) => {
    // Older Electron passes (event, level, message, line, sourceId); newer
    // versions pass a single params object carrying the same fields.
    const p = (event && typeof event === 'object' && 'message' in event) ? event : { level, message };
    if (p.level >= 2) log.push((p.level === 3 ? 'ERROR ' : 'WARN ') + p.message);
  });
  win.webContents.on('did-finish-load', () => {
    (async () => {
      try {
        await win.webContents.executeJavaScript('startRun(); 0');
        const waitFor = async (expr, timeoutMs) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            if (await win.webContents.executeJavaScript(expr)) return true;
            await new Promise(r => setTimeout(r, 250));
          }
          return false;
        };
        const spritesReady = await waitFor('!!G.imagesLoaded && G.mode === "play"', 30000);
        const sfxReady = await waitFor('SfxBank.pending.size === 0', 30000);
        await win.webContents.executeJavaScript(
          "G.perkChoices = ['critbone','ember','spiteflesh'].map(id => PERKS.find(p => p.id === id)); G.mode = 'levelup'; 0"
        );
        await new Promise(r => setTimeout(r, 500));
        if (outPng) fs.writeFileSync(outPng, (await win.webContents.capturePage()).toPNG());
        const info = await win.webContents.executeJavaScript(`({
          imagesLoaded: G.imagesLoaded,
          mode: G.mode,
          sfxBuffers: SfxBank.buffers.size,
          sfxFailed: SfxBank.failed.size,
          perkIcon: !!Sprites.imgs['perk_critbone'],
          itemIcon: !!Sprites.imgs['i_rerollrib'],
          music: Music.current ? Music.current.name : null,
        })`);
        fs.writeFileSync(outJson, JSON.stringify({ spritesReady, sfxReady, info, log }, null, 2));
      } catch (err) {
        fs.writeFileSync(outJson, JSON.stringify({ error: String((err && err.stack) || err), log }, null, 2));
      } finally {
        app.quit();
      }
    })();
  });
}

app.whenReady().then(() => {
  ipcMain.on('ms-quit', () => app.quit());
  installProtocol();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
