// ---- bootstrap, game loop, mode dispatch ----

let canvas, ctx, lastT = 0;

const PRESSURE_SLIDER_RECT = { x: 300, y: 470, w: 360, h: 46 };
const MENU_EXIT_BUTTON = { x: W - 208, y: H - 48, w: 180, h: 28 };
const PAUSE_MENU_BUTTON = { x: W / 2 - 75, y: 526, w: 150, h: 28 };
const PAUSE_EXIT_BUTTON = { x: W / 2 + 87, y: 526, w: 150, h: 28 };
const HD_TOGGLE_BUTTON = { x: 28, y: H - 48, w: 220, h: 28 };
const PAUSE_RESUME_BUTTON = { x: W / 2 - 237, y: 492, w: 150, h: 28 };
const PAUSE_SWAP_BUTTON   = { x: W / 2 - 75,  y: 492, w: 150, h: 28 };
const PAUSE_AUTO_BUTTON   = { x: W / 2 + 87,  y: 492, w: 150, h: 28 };
const PAUSE_MUTE_BUTTON   = { x: W / 2 - 237, y: 526, w: 150, h: 28 };
const CONFIRM_WINDOW = 3;

function pauseBars() {
  const x = W / 2 - 55, w = 225;
  return [
    { rect: { x, y: 418, w, h: 10 }, set: v => Sfx.setVolume(v) },
    { rect: { x, y: 446, w, h: 10 }, set: v => Music.setVolume(v) },
    { rect: { x, y: 474, w, h: 10 }, set: v => setHudAlpha(0.25 + v * 0.75) },
  ];
}

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  try { G.hdRemaster = localStorage.getItem('meatslicer_hd_remaster') === '1'; } catch (e) {}
  canvas.width = W * hdScale();
  canvas.height = H * hdScale();
  canvas.style.imageRendering = G.hdRemaster ? 'auto' : 'pixelated';
  ctx.imageSmoothingEnabled = !G.hdRemaster;
  G.devMode = debugEnabled();
  initInput(canvas);
  Sprites.load();
  fitCanvas();
  buildAtmosphereLayer();
  window.addEventListener('resize', fitCanvas);
  if (document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      lastT = performance.now();
      if (document.hidden) { Input.keys = {}; Input.mdown = false; }
    });
  }
  try { G.best = parseInt(localStorage.getItem('meatslicer_best') || '0', 10) || 0; }
  catch (e) { G.best = 0; }
  try {
    const sv = parseFloat(localStorage.getItem('meatslicer_sfx_volume'));
    const mv = parseFloat(localStorage.getItem('meatslicer_music_volume'));
    if (Number.isFinite(sv)) G.sfxVol = clamp(sv, 0, 1);
    if (Number.isFinite(mv)) G.musicVol = clamp(mv, 0, 1);
    G.autoPerk = localStorage.getItem('meatslicer_autoperk') === '1';
    G.muted = localStorage.getItem('meatslicer_muted') === '1';
    const pd = parseFloat(localStorage.getItem('meatslicer_pressure_dial'));
    if (Number.isFinite(pd)) G.pressureDial = clamp(Math.round(pd), PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX);
    const ha = parseFloat(localStorage.getItem('meatslicer_hud_alpha'));
    if (Number.isFinite(ha)) G.hudAlpha = clamp(ha, 0.25, 1);
  } catch (e) {}
  requestAnimationFrame(loop);
}

function setPressureDial(n) {
  G.pressureDial = clamp(Math.round(n), PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX);
  try { localStorage.setItem('meatslicer_pressure_dial', String(G.pressureDial)); } catch (e) {}
  Sfx.menu();
}
function toggleMute() {
  G.muted = !G.muted;
  Music.setMuted(G.muted);
  Sfx.setMuted(G.muted);
  try { localStorage.setItem('meatslicer_muted', G.muted ? '1' : '0'); } catch (e) {}
  addToast(G.muted ? 'AUDIO MUTED' : 'AUDIO UNMUTED', G.muted ? 'all sound is silenced' : 'sound restored');
  if (!G.muted) Sfx.menu();
}

function setHudAlpha(v) {
  G.hudAlpha = clamp(Math.round(v * 100) / 100, 0.25, 1);
  try { localStorage.setItem('meatslicer_hud_alpha', String(G.hudAlpha)); } catch (e) {}
}

function setAutoPerk(enabled) {
  G.autoPerk = !!enabled;
  try { localStorage.setItem('meatslicer_autoperk', G.autoPerk ? '1' : '0'); } catch (e) {}
  addToast('AUTO-DRAFT ' + (G.autoPerk ? 'ON' : 'OFF'), G.autoPerk ? 'level-ups now choose randomly' : 'manual mutation drafts restored');
  Sfx.menu();
}

function setHdRemaster(enabled) {
  G.hdRemaster = !!enabled;
  try { localStorage.setItem('meatslicer_hd_remaster', G.hdRemaster ? '1' : '0'); } catch (e) {}
}
function toggleHdRemaster() {
  setHdRemaster(!G.hdRemaster);
  Sfx.menu();
  location.reload();
}

function buildAtmosphereLayer() {
  if (!document.createElement) return;
  const layer = document.createElement('canvas');
  layer.width = W; layer.height = H;
  const c = layer.getContext('2d');
  const vignette = c.createRadialGradient(W / 2, H / 2, 170, W / 2, H / 2, 590);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.72, 'rgba(12,2,5,0.12)');
  vignette.addColorStop(1, 'rgba(4,1,2,0.64)');
  c.fillStyle = vignette; c.fillRect(0, 0, W, H);
  // Fixed grain gives the room texture without per-frame random allocations.
  for (let i = 0; i < 380; i++) {
    const x = hashTile(i * 17, 11) % W, y = hashTile(i * 29, 23) % H;
    c.fillStyle = i % 3 ? 'rgba(255,220,205,0.018)' : 'rgba(0,0,0,0.035)';
    c.fillRect(x, y, 1, 1);
  }
  G.atmosphereLayer = layer;
}

function fitCanvas() {
  const k = Math.min(window.innerWidth / W, window.innerHeight / H) * 0.97;
  canvas.style.width = Math.floor(W * k) + 'px';
  canvas.style.height = Math.floor(H * k) + 'px';
  if (Input.updateRect) Input.updateRect();
}

function resetRun() {
  Sfx.init(); Sfx.resume();
  Sfx.stopAllLoops(); Sfx.menu();
  G.floor = 1; G.score = 0; G.kills = 0; G.time = 0;
  G.parts = []; G.corpses = []; G.toasts = []; G.pendingLevelups = 0; G.perkChoices = null;
  G.pauseHelp = false; G.helpPage = 0;
  G.confirmAction = null; G.confirmT = 0;
  G.deathLockT = 0;
  G.pressure = 1; G.streak = 0; G.roomDamaged = false; G.roomEnterT = 0; G.recentHits = [];
  G.shake = 0; G.flash = 0; G.shotLockT = 0;
  G.debugUsed = false; G.debugFlags = {}; G.debugTimescale = 1; G.debugFrameStep = false;
  initPlayer();
  genFloor(1);
  enterRoom(0, 0);
  G.player.shieldHp = G.player.stats.shieldPerk || 0;
}

function startRun() {
  resetRun();
  G.mode = 'play';
  Music.requestFloorMusic();
  addToast('FLOOR 1', 'clear the rooms. find the stairs. feed.');
}

function returnToMenu() {
  resetRun();
  G.mode = 'menu';
  G.toasts = [];
  Music.playMenu();
}

function canQuitDesktop() {
  return !!(window.MSDesktop && typeof window.MSDesktop.quit === 'function');
}

function quitToDesktop() {
  if (canQuitDesktop()) window.MSDesktop.quit();
}

function confirmAction(name, action) {
  if (G.confirmAction === name && G.confirmT > 0) {
    G.confirmAction = null; G.confirmT = 0;
    action();
    return;
  }
  G.confirmAction = name;
  G.confirmT = CONFIRM_WINDOW;
  Sfx.menu();
}

function gameOver() {
  G.mode = 'gameover';
  G.deathLockT = DEATH_LOCK;
  spawnPlayerGore(G.player.x, G.player.y);
  Sfx.playerDeath();
  if (!G.debugUsed && G.score > (G.best || 0)) {
    G.best = G.score;
    try { localStorage.setItem('meatslicer_best', String(G.best)); } catch (e) {}
  }
  Music.playMenu();
}

function loop(now) {
  let dt = Math.min((now - lastT) / 1000 || 0.016, 0.05);
  lastT = now;
  dt *= (G.debugTimescale || 1);
  if (G.debugFlags.freeze) {
    if (G.debugFrameStep) { G.debugFrameStep = false; dt = 1 / 60; }
    else dt = 0;
  }
  update(dt);
  draw();
  clearInputEdges();
  requestAnimationFrame(loop);
}

function update(dt) {
  const menuWas = G.mode !== 'play';
  Music.update(dt);
  if (G.deathLockT > 0) G.deathLockT = Math.max(0, G.deathLockT - dt);
  if (G.confirmT > 0) {
    G.confirmT = Math.max(0, G.confirmT - dt);
    if (G.confirmT <= 0) G.confirmAction = null;
  }

  // global keys
  if (keyPressed('m')) toggleMute();

  switch (G.mode) {
    case 'menu': {
      const sl = PRESSURE_SLIDER_RECT;
      const exitClick = Input.mpressed && inRect(Input.mx, Input.my, MENU_EXIT_BUTTON);
      if (canQuitDesktop() && (keyPressed('x') || exitClick)) {
        confirmAction('desktop', quitToDesktop);
        break;
      }
      if (keyPressed('arrowleft', 'a', '-', '_')) setPressureDial(G.pressureDial - 1);
      if (keyPressed('arrowright', 'd', '=', '+')) setPressureDial(G.pressureDial + 1);
      if (Input.mpressed && inRect(Input.mx, Input.my, sl)) G.menuDialDrag = true;
      if (G.menuDialDrag && Input.mdown) {
        setPressureDial(Math.round(((Input.mx - sl.x) / sl.w) * 20) - 10);
      }
      if (!Input.mdown) G.menuDialDrag = false;
      if (keyPressed('h') || (Input.mpressed && inRect(Input.mx, Input.my, HD_TOGGLE_BUTTON))) { toggleHdRemaster(); break; }
      if (keyPressed('enter', ' ') || (Input.mpressed && !inRect(Input.mx, Input.my, sl) && !inRect(Input.mx, Input.my, HD_TOGGLE_BUTTON) && !exitClick)) startRun();
      break;
    }
    case 'play':
      G.time += dt;
      if (G.devMode && keyPressed('`', '~')) { G.debugReturn = 'play'; G.mode = 'debug'; Sfx.menu(); break; }
      if (keyPressed('p', 'escape')) { G.mode = 'pause'; G.confirmAction = null; G.confirmT = 0; Sfx.stopAllLoops(); Sfx.menu(); break; }
      if (keyPressed('n')) Music.cycle(1);
      if (keyPressed('r')) swapWeapon();
      if (keyPressed(' ')) useActive();
      if (keyPressed('t')) setAutoPerk(!G.autoPerk);
      updatePlayer(dt);
      updateRoom(dt);
      updateEnemies(dt);
      updateTelegraphs(dt);
      updateBullets(dt);
      updateHazards(dt);
      updatePickups(dt);
      updateParticles(dt);
      drawToastsUpdate(dt);
      break;
    case 'bossload':
      updateParticles(dt);
      if (G.bossLoadT > 0) G.bossLoadT -= dt;
      if (G.bossLoadT <= 0 && Sprites.warm(G.bossLoadSheet)) G.mode = 'play';
      break;
    case 'levelup':
      updateLevelup(dt);
      updateParticles(dt);
      break;
    case 'debug':
      updateDebug();
      // pinned mode lets the world keep running behind the panel
      if (G.debugPin) {
        G.time += dt;
        // mask trigger input so clicking panel buttons doesn't fire the weapon
        const md = Input.mdown, mp = Input.mpressed, mr = Input.mreleased;
        Input.mdown = Input.mpressed = Input.mreleased = false;
        updatePlayer(dt);
        Input.mdown = md; Input.mpressed = mp; Input.mreleased = mr;
        updateRoom(dt); updateEnemies(dt); updateTelegraphs(dt);
        updateBullets(dt); updateHazards(dt); updatePickups(dt); updateParticles(dt);
        drawToastsUpdate(dt);
      } else {
        updateParticles(dt);
      }
      break;
    case 'pause': {
      if (G.pauseHelp) { updatePauseHelp(); break; }
      if (G.devMode && keyPressed('`', '~')) { G.debugReturn = 'pause'; G.mode = 'debug'; Sfx.menu(); break; }
      const menuClick = Input.mpressed && inRect(Input.mx, Input.my, PAUSE_MENU_BUTTON);
      const exitClick = Input.mpressed && inRect(Input.mx, Input.my, PAUSE_EXIT_BUTTON);
      if (keyPressed('q') || menuClick) { confirmAction('menu', returnToMenu); break; }
      if (canQuitDesktop() && (keyPressed('x') || exitClick)) { confirmAction('desktop', quitToDesktop); break; }
      if (keyPressed('p', 'escape') || (Input.mpressed && inRect(Input.mx, Input.my, PAUSE_RESUME_BUTTON))) { G.mode = 'play'; G.confirmAction = null; G.confirmT = 0; Sfx.menu(); break; }
      if (keyPressed('h') || (Input.mpressed && inRect(Input.mx, Input.my, HELP_BUTTON))) {
        G.pauseHelp = true; G.helpPage = 0; G.confirmAction = null; G.confirmT = 0; Sfx.menu(); break;
      }
      if (keyPressed('r') || (Input.mpressed && inRect(Input.mx, Input.my, PAUSE_SWAP_BUTTON))) swapWeapon(true);
      if (keyPressed('t') || (Input.mpressed && inRect(Input.mx, Input.my, PAUSE_AUTO_BUTTON))) setAutoPerk(!G.autoPerk);
      if (Input.mpressed && inRect(Input.mx, Input.my, PAUSE_MUTE_BUTTON)) { toggleMute(); break; }
      if (keyPressed('-', '_')) { Sfx.setVolume(G.sfxVol - 0.1); Sfx.menu(); }
      if (keyPressed('=', '+')) { Sfx.setVolume(G.sfxVol + 0.1); Sfx.menu(); }
      if (keyPressed(',', '<')) { Music.setVolume(G.musicVol - 0.1); Sfx.menu(); }
      if (keyPressed('.', '>')) { Music.setVolume(G.musicVol + 0.1); Sfx.menu(); }
      if (keyPressed(';', ':')) { setHudAlpha(G.hudAlpha - 0.1); Sfx.menu(); }
      if (keyPressed("'", '"')) { setHudAlpha(G.hudAlpha + 0.1); Sfx.menu(); }
      // click-and-drag on the three pause sliders
      {
        const bars = pauseBars();
        if (Input.mpressed) {
          for (let i = 0; i < bars.length; i++) if (inRect(Input.mx, Input.my, bars[i].rect)) { G.pauseDrag = i; break; }
        }
        if (G.pauseDrag !== null && G.pauseDrag !== undefined && Input.mdown) {
          const b = bars[G.pauseDrag];
          const v = clamp((Input.mx - b.rect.x) / b.rect.w, 0, 1);
          b.set(v);
        }
        if (!Input.mdown) G.pauseDrag = null;
      }
      if (keyPressed('arrowleft', '[')) Music.cycle(-1);
      else if (keyPressed('arrowright', ']')) Music.cycle(1);
      else if (Input.mpressed) {
        // jukebox arrows
        if (dist(Input.mx, Input.my, W / 2 - 200, H / 2 + 60) < 22) Music.cycle(-1);
        else if (dist(Input.mx, Input.my, W / 2 + 200, H / 2 + 60) < 22) Music.cycle(1);
      }
      break;
    }
    case 'gameover':
      updateParticles(dt);
      if (G.deathLockT <= 0 && (keyPressed('r', 'enter', ' ') || Input.mpressed)) startRun();
      break;
  }

  if (menuWas && G.mode === 'play') { Input.mdown = false; G.shotLockT = 0.05; }
  G.shotLockT = Math.max(0, (G.shotLockT || 0) - dt);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt);
  if (G.transition > 0) G.transition = Math.max(0, G.transition - dt);
}

function draw() {
  ctx.setTransform(hdScale(), 0, 0, hdScale(), 0, 0);
  ctx.fillStyle = '#0a0506';
  ctx.fillRect(0, 0, W, H);

  if (G.mode === 'menu') { drawMenu(ctx); return; }
  if (G.mode === 'bossload') { drawBossLoad(ctx); return; }

  updateCamera();

  // world (with camera + screen shake)
  ctx.save();
  ctx.translate(-G.cam.x, -G.cam.y);
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);
  drawRoom(ctx);
  drawCorpses(ctx);
  drawPickups(ctx);
  drawEnemies(ctx);
  drawPlayer(ctx);
  drawBullets(ctx);
  drawParticles(ctx);
  drawTelegraphs(ctx);
  if (G.devMode) drawDebugOverlays(ctx);
  ctx.restore();

  if (G.atmosphereLayer) ctx.drawImage(G.atmosphereLayer, 0, 0);

  // Fine inner frame and corner cuts finish the playfield presentation.
  ctx.strokeStyle = 'rgba(104,36,43,0.55)'; ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.strokeStyle = 'rgba(224,177,102,0.22)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1]]) {
    ctx.moveTo(x, y + sy * 20); ctx.lineTo(x, y); ctx.lineTo(x + sx * 20, y);
  }
  ctx.stroke();

  drawHUD(ctx);

  // hurt vignette
  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(180,10,25,' + (G.flash * 0.55) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  // room transition fade
  if (G.transition > 0) {
    ctx.fillStyle = 'rgba(5,2,3,' + clamp(G.transition * 3, 0, 1) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  if (G.mode === 'levelup') drawLevelup(ctx);
  else if (G.mode === 'pause') { drawPause(ctx); if (G.pauseHelp) drawPauseHelp(ctx); }
  else if (G.mode === 'gameover') drawGameOver(ctx);
  else if (G.mode === 'debug') drawDebug(ctx);
  if (G.devMode) { if (G.debugPin && G.mode !== 'debug') drawDebugPin(ctx); }
}

function drawBossLoad(ctx) {
  if (G.cur) {
    drawFloor(ctx, G.cur);
    drawWalls(ctx, G.cur);
  }
  const sheet = G.bossLoadSheet && Sprites.get(G.bossLoadSheet);
  if (sheet) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sheet, 0, 0);
    ctx.restore();
  }
  ctx.fillStyle = '#0a0506';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const name = G.boss && G.boss.name ? G.boss.name : 'FRESH MEAT';
  ctx.fillStyle = '#d9c9bc'; ctx.font = 'bold 28px monospace';
  ctx.fillText(name, W / 2, H / 2 - 6);
  ctx.fillStyle = '#8f1f2e'; ctx.font = 'bold 11px monospace';
  ctx.fillText('FRESH MEAT APPROACHES', W / 2, H / 2 + 16);
  const pr = Math.min(1, Math.max(0, G.bossLoadT / BOSS_LOAD_MIN));
  const tier = Math.floor((1 - pr) * 5) % 3;
  ctx.fillStyle = '#3a1a1e';
  for (let i = 0; i < 3; i++) ctx.fillRect(W / 2 - 22 + i * 14, H / 2 + 30, 8, 8);
  ctx.fillStyle = '#d7a934';
  ctx.fillRect(W / 2 - 22 + tier * 14, H / 2 + 30, 8, 8);
  ctx.textAlign = 'left';
}

function drawMenu(ctx) {
  const t = performance.now() / 1000;
  const bg = ctx.createRadialGradient && ctx.createRadialGradient(W / 2, H * 0.4, 30, W / 2, H * 0.45, 590);
  if (bg && bg.addColorStop) {
    bg.addColorStop(0, '#260b11'); bg.addColorStop(0.5, '#100609'); bg.addColorStop(1, '#050204');
    ctx.fillStyle = bg;
  } else ctx.fillStyle = '#100609';
  ctx.fillRect(0, 0, W, H);

  // Low-contrast industrial grid replaces decorative circles with a cleaner,
  // modern system-screen backdrop while preserving hard pixel geometry.
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) {
    ctx.strokeStyle = x % 192 === 0 ? 'rgba(121,35,48,0.11)' : 'rgba(121,35,48,0.045)';
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 48) {
    ctx.strokeStyle = y % 192 === 0 ? 'rgba(121,35,48,0.11)' : 'rgba(121,35,48,0.045)';
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
  }
  ctx.globalAlpha = 0.13;
  Sprites.draw(ctx, 'bullet_cleaver', 168, 274, -0.2, 150);
  Sprites.draw(ctx, 'bullet_cleaver', W - 168, 274, Math.PI + 0.2, 150);
  ctx.globalAlpha = 1;

  drawPixelTag(ctx, 'SLAUGHTER PROTOCOL // 01', 28, 24, {
    width: 188, height: 24, color: '#a99089', accent: '#b6243a',
  });
  drawPixelTag(ctx, 'LOCAL RUNNER // ONLINE', W - 196, 24, {
    width: 168, height: 24, color: '#74aeb5', accent: '#398b99',
  });

  ctx.textAlign = 'center';
  ctx.font = '900 70px monospace';
  ctx.fillStyle = '#39070d'; ctx.fillText('MEATSLICER', W / 2 + 4, 248);
  ctx.fillStyle = '#f02b48'; ctx.fillText('MEATSLICER', W / 2, 243);
  ctx.fillStyle = '#ff9a8a'; ctx.globalAlpha = 0.35; ctx.fillText('MEATSLICER', W / 2, 240); ctx.globalAlpha = 1;
  drawBloodTrim(ctx, W / 2 - 230, 255, 460, 11, 0.65);
  ctx.fillStyle = '#d4ad3d'; ctx.font = 'bold 12px monospace';
  ctx.fillText('A BUTCHER\'S DESCENT  //  CLEAR · HARVEST · DESCEND', W / 2, 281);

  const pulse = 0.75 + Math.sin(t * 3) * 0.18;
  drawPixelPanel(ctx, W / 2 - 180, 320, 360, 64, {
    accent: '#e22b46', border: 'rgba(218,40,62,' + pulse + ')', lineWidth: 2,
    fill: 'rgba(12,4,7,0.9)', blood: true, seed: 4, bloodAlpha: 0.35,
  });
  ctx.fillStyle = '#7f6062'; ctx.font = 'bold 9px monospace';
  ctx.fillText('INITIATE DESCENT', W / 2, 341);
  ctx.fillStyle = '#f5e9d6'; ctx.font = 'bold 14px monospace';
  ctx.fillText('[ ENTER ]  OR  CLICK TO START', W / 2, 365);

  const controls = ['WASD MOVE', 'MOUSE AIM', 'LMB FIRE', 'R SWAP', 'P PAUSE', 'T AUTO', 'M MUTE', 'N MUSIC'];
  ctx.font = 'bold 9px monospace';
  const widths = controls.map(label => Math.ceil(ctx.measureText(label).width) + 16);
  const total = widths.reduce((sum, width) => sum + width, 0) + (controls.length - 1) * 6;
  let tx = (W - total) / 2;
  for (let i = 0; i < controls.length; i++) {
    drawPixelTag(ctx, controls[i], tx, 420, { width: widths[i], height: 24, color: '#a9958e', accent: i < 3 ? '#8f2637' : '#5f3943' });
    tx += widths[i] + 6;
  }

  // ---- pressure dial ----
  drawPressureDial(ctx);

  ctx.fillStyle = '#655155'; ctx.font = '9px monospace';
  ctx.fillText('ROOM-CLEAR COMBAT  //  PERK DRAFTS  //  SIXTEEN WEAPONS  //  CROWNED MEAT', W / 2, 530);
  if (G.best) {
    drawPixelTag(ctx, 'BEST CUT  ' + String(G.best).padStart(6, '0'), W / 2 - 74, 556, {
      width: 148, height: 26, color: '#e0b94e', accent: '#a47e25',
    });
  }
  const exitHover = inRect(Input.mx, Input.my, MENU_EXIT_BUTTON);
  const desktopExit = canQuitDesktop();
  const exitConfirm = desktopExit && G.confirmAction === 'desktop';
  drawPixelTag(ctx, !desktopExit ? '[X] DESKTOP APP ONLY' : (exitConfirm ? '[X] CONFIRM EXIT' : '[X] EXIT TO DESKTOP'), MENU_EXIT_BUTTON.x, MENU_EXIT_BUTTON.y, {
    width: MENU_EXIT_BUTTON.w, height: MENU_EXIT_BUTTON.h,
    color: !desktopExit ? '#65595b' : (exitConfirm ? '#ffd36a' : (exitHover ? '#f5e9d6' : '#ad8f8c')),
    accent: !desktopExit ? '#3a2d31' : (exitConfirm ? '#d69a22' : (exitHover ? '#e22b46' : '#6e3843')),
  });
  const hdHover = inRect(Input.mx, Input.my, HD_TOGGLE_BUTTON);
  drawPixelTag(ctx, '[H] HD REMASTER // ' + (G.hdRemaster ? 'ON' : 'OFF'), HD_TOGGLE_BUTTON.x, HD_TOGGLE_BUTTON.y, {
    width: HD_TOGGLE_BUTTON.w, height: HD_TOGGLE_BUTTON.h,
    color: G.hdRemaster ? '#e0b94e' : (hdHover ? '#f5e9d6' : '#ad8f8c'),
    accent: G.hdRemaster ? '#a47e25' : (hdHover ? '#e22b46' : '#6e3843'),
  });
}

function drawPressureDial(ctx) {
  const sl = PRESSURE_SLIDER_RECT;
  const d = G.pressureDial;
  const gain = pressureGainUnits(d), drop = pressureDropUnits(d);
  const accent = d < 0 ? '#3d8f99' : (d === 0 ? '#c59231' : '#e22b46');
  drawPixelPanel(ctx, sl.x, sl.y, sl.w, sl.h, {
    cut: 6, shadow: false, accent, fill: 'rgba(12,5,8,0.92)', border: '#63303a',
  });
  const name = d <= -9 ? 'FORGIVING' : d <= -6 ? 'MERCIFUL' : d <= -3 ? 'EASED' : d <= 0 ? 'STANDARD' :
    d <= 3 ? 'TENSE' : d <= 5 ? 'SAVAGE' : d <= 7 ? 'RELENTLESS' : d <= 9 ? 'ATROCIOUS' : 'MEAT GRINDER';
  ctx.textAlign = 'left'; ctx.fillStyle = '#9e857a'; ctx.font = 'bold 8px monospace';
  ctx.fillText('PRESSURE DIAL', sl.x + 10, sl.y + 12);
  ctx.textAlign = 'right'; ctx.fillStyle = accent; ctx.font = 'bold 9px monospace';
  ctx.fillText((d > 0 ? '+' : '') + d + ' ' + name, sl.x + sl.w - 10, sl.y + 12);
  // track with 20 steps / 21 notches
  const bx = sl.x + 34, bw = sl.w - 68, by = sl.y + 20, bh = 10;
  drawPixelBar(ctx, bx, by, bw, bh, (d + 10) / 20, {
    fill: accent, glint: '#f4d86d', border: '#5d3c43', segments: 20,
  });
  // bright notch marker
  const nx = bx + Math.round((d + 10) / 20 * bw);
  ctx.fillStyle = '#f5e9d6';
  ctx.fillRect(nx - 1, by - 2, 2, bh + 4);
  // end labels
  ctx.fillStyle = '#7d6262'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('-10', bx - 18, by + 9); ctx.fillText('+10', bx + bw + 18, by + 9);
  // derived readout
  ctx.fillStyle = '#8f7770'; ctx.font = '8px monospace';
  const rise = (gain >= 0 ? '+' : '') + gain.toFixed(1);
  ctx.fillText('RISE ' + rise + '/10 · RELIEF ' + drop.toFixed(1) + '/10 · SCORE ×LIVE PRESSURE', sl.x + sl.w / 2, sl.y + sl.h - 7);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4,2,3,0.78)'; ctx.fillRect(0, 0, W, H);
  drawPixelPanel(ctx, W / 2 - 270, 104, 540, 452, {
    accent: '#c92a40', border: 'rgba(119,51,61,0.95)', fill: 'rgba(11,5,8,0.96)',
    blood: true, seed: 8, bloodAlpha: 0.25,
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7f6768'; ctx.font = 'bold 9px monospace';
  ctx.fillText('RUN STATE // SUSPENDED', W / 2, 136);
  ctx.fillStyle = '#f0e5d7'; ctx.font = 'bold 36px monospace';
  ctx.fillText('PAUSED', W / 2, 180);
  drawBloodTrim(ctx, W / 2 - 130, 191, 260, 8, 0.45);

  ctx.fillStyle = '#b89532'; ctx.font = 'bold 10px monospace';
  ctx.fillText('JUKEBOX // ACTIVE TRACK', W / 2, 248);
  const sel = (G.musicSel === undefined || G.musicSel < 0) ? 'AUTO · FLOOR ROTATION' : Music.pretty(Music.PLAYLIST[G.musicSel]).toUpperCase();
  drawPixelPanel(ctx, W / 2 - 170, 318, 340, 82, {
    cut: 5, shadow: false, accent: '#468e9d', fill: 'rgba(5,10,12,0.7)', border: '#315b65',
  });
  ctx.fillStyle = '#8faeb2'; ctx.font = 'bold 9px monospace';
  ctx.fillText('NOW PLAYING', W / 2, 341);
  ctx.fillStyle = '#e9ded0'; ctx.font = 'bold 14px monospace';
  ctx.fillText(sel, W / 2, 368);

  for (const sx of [-200, 200]) {
    const x = W / 2 + sx, y = 358;
    const hover = dist(Input.mx, Input.my, x, y) < 22;
    drawPixelPanel(ctx, x - 20, y - 20, 40, 40, {
      cut: 5, shadow: false, fill: hover ? '#631526' : '#251017',
      border: hover ? '#ef3150' : '#65303b', accent: hover ? '#ef3150' : '#773142',
    });
    ctx.fillStyle = '#eee0d3'; ctx.font = 'bold 18px monospace';
    ctx.fillText(sx < 0 ? '<' : '>', x, y + 6);
  }

  // three sliders: SFX / MUSIC / HUD (drag or key pairs)
  const sliders = [
    { label: 'SFX  [- / +]', val: G.sfxVol, colors: { fill: '#c92a40', glint: '#ff7d82', border: '#63303a', segments: 10 } },
    { label: 'MUSIC [, / .]', val: G.musicVol, colors: { fill: '#468e9d', glint: '#a5edee', border: '#315b65', segments: 10 } },
    { label: "HUD  [; / ']", val: (G.hudAlpha - 0.25) / 0.75, colors: { fill: '#b5892f', glint: '#f4d86d', border: '#5d3c43', segments: 10 } },
  ];
  const bars = pauseBars();
  ctx.textAlign = 'left'; ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#a99a91';
  for (let i = 0; i < sliders.length; i++) {
    const by = bars[i].rect.y;
    ctx.fillStyle = '#a99a91'; ctx.fillText(sliders[i].label, W / 2 - 170, by + 9);
    drawPixelBar(ctx, bars[i].rect.x, by, bars[i].rect.w, 10, sliders[i].val, sliders[i].colors);
    ctx.fillStyle = '#e9ded0'; ctx.textAlign = 'right';
    const pct = i === 2 ? Math.round(G.hudAlpha * 100) : Math.round(sliders[i].val * 100);
    ctx.fillText(pct + '%', W / 2 + 185, by + 9);
    ctx.textAlign = 'left';
  }

  const gridX = [W / 2 - 237, W / 2 - 75, W / 2 + 87];
  const resumeHover = inRect(Input.mx, Input.my, PAUSE_RESUME_BUTTON);
  const swapHover = inRect(Input.mx, Input.my, PAUSE_SWAP_BUTTON);
  const autoHover = inRect(Input.mx, Input.my, PAUSE_AUTO_BUTTON);
  const muteHover = inRect(Input.mx, Input.my, PAUSE_MUTE_BUTTON);
  drawPixelTag(ctx, '[P] RESUME', gridX[0], 492, { width: 150, height: 28, color: resumeHover ? '#f5e9d6' : '#bba9a1', accent: resumeHover ? '#b5243a' : '#6e3843' });
  drawPixelTag(ctx, '[R] SWAP WEAPON', gridX[1], 492, { width: 150, height: 28, color: swapHover ? '#f5e9d6' : '#bba9a1', accent: swapHover ? '#b5243a' : '#6e3843' });
  drawPixelTag(ctx, '[T] AUTO ' + (G.autoPerk ? 'ON' : 'OFF'), gridX[2], 492, { width: 150, height: 28, color: G.autoPerk ? '#79d9ca' : (autoHover ? '#f5e9d6' : '#bba9a1'), accent: G.autoPerk ? '#378b80' : (autoHover ? '#b5243a' : '#6e3843') });
  const menuHover = inRect(Input.mx, Input.my, PAUSE_MENU_BUTTON);
  const exitHover = inRect(Input.mx, Input.my, PAUSE_EXIT_BUTTON);
  const menuConfirm = G.confirmAction === 'menu';
  const desktopExit = canQuitDesktop();
  const exitConfirm = desktopExit && G.confirmAction === 'desktop';
  drawPixelTag(ctx, '[M] MUTE ' + (G.muted ? 'ON' : 'OFF'), gridX[0], 526, { width: 150, height: 28, color: G.muted ? '#79d9ca' : (muteHover ? '#f5e9d6' : '#bba9a1'), accent: G.muted ? '#378b80' : (muteHover ? '#b5243a' : '#6e3843') });
  drawPixelTag(ctx, menuConfirm ? '[Q] CONFIRM MENU' : '[Q] MAIN MENU', PAUSE_MENU_BUTTON.x, PAUSE_MENU_BUTTON.y, {
    width: PAUSE_MENU_BUTTON.w, height: PAUSE_MENU_BUTTON.h,
    color: menuConfirm ? '#ffd36a' : (menuHover ? '#f5e9d6' : '#bba9a1'),
    accent: menuConfirm ? '#d69a22' : (menuHover ? '#b5243a' : '#6e3843'),
  });
  drawPixelTag(ctx, !desktopExit ? '[X] DESKTOP ONLY' : (exitConfirm ? '[X] CONFIRM EXIT' : '[X] EXIT'), PAUSE_EXIT_BUTTON.x, PAUSE_EXIT_BUTTON.y, {
    width: PAUSE_EXIT_BUTTON.w, height: PAUSE_EXIT_BUTTON.h,
    color: !desktopExit ? '#65595b' : (exitConfirm ? '#ffd36a' : (exitHover ? '#f5e9d6' : '#bba9a1')),
    accent: !desktopExit ? '#3a2d31' : (exitConfirm ? '#d69a22' : (exitHover ? '#b5243a' : '#6e3843')),
  });

  const hb = HELP_BUTTON;
  const helpHover = inRect(Input.mx, Input.my, hb);
  drawPixelTag(ctx, '[?] HELP', hb.x, hb.y, {
    width: hb.w, height: hb.h,
    color: helpHover ? '#f1cb53' : '#b89c46', accent: helpHover ? '#c9a227' : '#7c6424',
  });
}

function drawGameOver(ctx) {
  const reveal = clamp((DEATH_LOCK - G.deathLockT) / 0.9, 0, 1);
  ctx.save();
  ctx.globalAlpha = reveal;
  ctx.fillStyle = 'rgba(4,1,3,0.86)'; ctx.fillRect(0, 0, W, H);
  drawPixelPanel(ctx, W / 2 - 230, 142, 460, 350, {
    accent: '#e02945', border: '#772638', fill: 'rgba(12,4,7,0.97)',
    blood: true, seed: G.kills + 3, bloodAlpha: 0.48,
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8f6870'; ctx.font = 'bold 9px monospace';
  ctx.fillText('RUN TERMINATED // CARCASS RECOVERED', W / 2, 174);
  ctx.fillStyle = '#ee2947'; ctx.font = 'bold 48px monospace';
  ctx.fillText('BUTCHERED', W / 2, 231);
  drawBloodTrim(ctx, W / 2 - 170, 242, 340, G.kills + 3, 0.7);

  drawPixelPanel(ctx, W / 2 - 188, 278, 116, 72, { cut: 5, shadow: false, accent: '#9c7428', fill: '#130b0d' });
  drawPixelPanel(ctx, W / 2 - 58, 278, 116, 72, { cut: 5, shadow: false, accent: '#9c7428', fill: '#130b0d' });
  drawPixelPanel(ctx, W / 2 + 72, 278, 116, 72, { cut: 5, shadow: false, accent: '#9c7428', fill: '#130b0d' });
  const stats = [['FLOOR', G.floor], ['KILLS', G.kills], ['SCORE', G.score]];
  for (let i = 0; i < stats.length; i++) {
    const x = W / 2 - 130 + i * 130;
    ctx.fillStyle = '#7e6a66'; ctx.font = 'bold 9px monospace'; ctx.fillText(stats[i][0], x, 300);
    ctx.fillStyle = i === 2 ? '#e2b742' : '#eee0d3'; ctx.font = 'bold 18px monospace';
    ctx.fillText(String(stats[i][1]).padStart(i === 2 ? 6 : 2, '0'), x, 329);
  }
  if (G.debugUsed) {
    drawPixelTag(ctx, '[ DEBUG RUN — SCORE NOT RECORDED ]', W / 2 - 128, 367, { width: 256, height: 26, color: '#e02945', accent: '#77202c' });
  } else if (G.score >= (G.best || 0) && G.score > 0) {
    drawPixelTag(ctx, 'NEW BEST CUT', W / 2 - 68, 367, { width: 136, height: 26, color: '#f1cb53', accent: '#b38b2e' });
  }
  drawPixelPanel(ctx, W / 2 - 140, 414, 280, 50, {
    cut: 5, shadow: false, accent: G.deathLockT > 0 ? '#77552a' : '#cf2942',
    border: G.deathLockT > 0 ? '#604727' : '#8c293c', fill: '#1a080e',
  });
  ctx.fillStyle = G.deathLockT > 0 ? '#d4ad3d' : '#f1e4d5'; ctx.font = 'bold 12px monospace';
  ctx.fillText(G.deathLockT > 0 ? '[ INPUT LOCKED · ' + G.deathLockT.toFixed(1) + ' ]' : '[ R / ENTER ]  CUT AGAIN', W / 2, 444);
  ctx.restore();
}

window.addEventListener('load', init);
