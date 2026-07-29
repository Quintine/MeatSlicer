// ---- bootstrap, game loop, mode dispatch ----

let canvas, ctx, lastT = 0;

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
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
  } catch (e) {}
  requestAnimationFrame(loop);
}

function setAutoPerk(enabled) {
  G.autoPerk = !!enabled;
  try { localStorage.setItem('meatslicer_autoperk', G.autoPerk ? '1' : '0'); } catch (e) {}
  addToast('AUTO-DRAFT ' + (G.autoPerk ? 'ON' : 'OFF'), G.autoPerk ? 'level-ups now choose randomly' : 'manual mutation drafts restored');
  Sfx.menu();
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
}

function startRun() {
  Sfx.init(); Sfx.resume();
  Sfx.stopAllLoops(); Sfx.menu();
  G.floor = 1; G.score = 0; G.kills = 0; G.time = 0;
  G.parts = []; G.corpses = []; G.toasts = []; G.pendingLevelups = 0; G.perkChoices = null;
  G.pauseHelp = false; G.helpPage = 0;
  G.pressure = 1; G.streak = 0; G.roomDamaged = false; G.roomEnterT = 0; G.recentHits = [];
  G.shake = 0; G.flash = 0;
  initPlayer();
  genFloor(1);
  enterRoom(0, 0);
  G.player.shieldHp = G.player.stats.shieldPerk || 0;
  G.mode = 'play';
  Music.requestFloorMusic();
  addToast('FLOOR 1', 'clear the rooms. find the stairs. feed.');
}

function gameOver() {
  G.mode = 'gameover';
  Sfx.playerDeath();
  if (G.score > (G.best || 0)) {
    G.best = G.score;
    try { localStorage.setItem('meatslicer_best', String(G.best)); } catch (e) {}
  }
  Music.playMenu();
}

function loop(now) {
  const dt = Math.min((now - lastT) / 1000 || 0.016, 0.05);
  lastT = now;
  update(dt);
  draw();
  clearInputEdges();
  requestAnimationFrame(loop);
}

function update(dt) {
  Music.update(dt);

  // global keys
  if (keyPressed('m')) {
    G.muted = !G.muted;
    Music.setMuted(G.muted);
    Sfx.setMuted(G.muted);
  }

  switch (G.mode) {
    case 'menu':
      if (Input.mpressed || keyPressed('enter', ' ')) startRun();
      break;
    case 'play':
      G.time += dt;
      if (keyPressed('p', 'escape')) { G.mode = 'pause'; Sfx.stopAllLoops(); Sfx.menu(); break; }
      if (keyPressed('n')) Music.cycle(1);
      if (keyPressed('r')) swapWeapon();
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
    case 'levelup':
      updateLevelup();
      updateParticles(dt);
      break;
    case 'pause':
      if (G.pauseHelp) { updatePauseHelp(); break; }
      if (keyPressed('p', 'escape')) { G.mode = 'play'; Sfx.menu(); break; }
      if (keyPressed('h') || (Input.mpressed && inRect(Input.mx, Input.my, HELP_BUTTON))) {
        G.pauseHelp = true; G.helpPage = 0; Sfx.menu(); break;
      }
      if (keyPressed('r')) swapWeapon(true);
      if (keyPressed('t')) setAutoPerk(!G.autoPerk);
      if (keyPressed('-', '_')) { Sfx.setVolume(G.sfxVol - 0.1); Sfx.menu(); }
      if (keyPressed('=', '+')) { Sfx.setVolume(G.sfxVol + 0.1); Sfx.menu(); }
      if (keyPressed(',', '<')) { Music.setVolume(G.musicVol - 0.1); Sfx.menu(); }
      if (keyPressed('.', '>')) { Music.setVolume(G.musicVol + 0.1); Sfx.menu(); }
      if (keyPressed('arrowleft', '[')) Music.cycle(-1);
      else if (keyPressed('arrowright', ']')) Music.cycle(1);
      else if (Input.mpressed) {
        // jukebox arrows
        if (dist(Input.mx, Input.my, W / 2 - 200, H / 2 + 60) < 22) Music.cycle(-1);
        else if (dist(Input.mx, Input.my, W / 2 + 200, H / 2 + 60) < 22) Music.cycle(1);
      }
      break;
    case 'gameover':
      updateParticles(dt);
      if (keyPressed('r', 'enter', ' ') || Input.mpressed) startRun();
      break;
  }

  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt);
  if (G.transition > 0) G.transition = Math.max(0, G.transition - dt);
}

function draw() {
  ctx.fillStyle = '#0a0506';
  ctx.fillRect(0, 0, W, H);

  if (G.mode === 'menu') { drawMenu(ctx); return; }

  // world (with screen shake)
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);
  drawRoom(ctx);
  drawCorpses(ctx);
  drawPickups(ctx);
  drawEnemies(ctx);
  drawPlayer(ctx);
  drawBullets(ctx);
  drawParticles(ctx);
  drawTelegraphs(ctx);
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

  ctx.fillStyle = '#655155'; ctx.font = '9px monospace';
  ctx.fillText('ROOM-CLEAR COMBAT  //  PERK DRAFTS  //  SIXTEEN WEAPONS  //  CROWNED MEAT', W / 2, 474);
  if (G.best) {
    drawPixelTag(ctx, 'BEST CUT  ' + String(G.best).padStart(6, '0'), W / 2 - 74, 503, {
      width: 148, height: 26, color: '#e0b94e', accent: '#a47e25',
    });
  }
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4,2,3,0.78)'; ctx.fillRect(0, 0, W, H);
  drawPixelPanel(ctx, W / 2 - 270, 126, 540, 388, {
    accent: '#c92a40', border: 'rgba(119,51,61,0.95)', fill: 'rgba(11,5,8,0.96)',
    blood: true, seed: 8, bloodAlpha: 0.25,
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7f6768'; ctx.font = 'bold 9px monospace';
  ctx.fillText('RUN STATE // SUSPENDED', W / 2, 158);
  ctx.fillStyle = '#f0e5d7'; ctx.font = 'bold 36px monospace';
  ctx.fillText('PAUSED', W / 2, 202);
  drawBloodTrim(ctx, W / 2 - 130, 213, 260, 8, 0.45);

  ctx.fillStyle = '#b89532'; ctx.font = 'bold 10px monospace';
  ctx.fillText('JUKEBOX // ACTIVE TRACK', W / 2, 270);
  const sel = (G.musicSel === undefined || G.musicSel < 0) ? 'AUTO · FLOOR ROTATION' : Music.pretty(Music.PLAYLIST[G.musicSel]).toUpperCase();
  drawPixelPanel(ctx, W / 2 - 170, H / 2 + 20, 340, 82, {
    cut: 5, shadow: false, accent: '#468e9d', fill: 'rgba(5,10,12,0.7)', border: '#315b65',
  });
  ctx.fillStyle = '#8faeb2'; ctx.font = 'bold 9px monospace';
  ctx.fillText('NOW PLAYING', W / 2, H / 2 + 43);
  ctx.fillStyle = '#e9ded0'; ctx.font = 'bold 14px monospace';
  ctx.fillText(sel, W / 2, H / 2 + 70);

  for (const sx of [-200, 200]) {
    const x = W / 2 + sx, y = H / 2 + 60;
    const hover = dist(Input.mx, Input.my, x, y) < 22;
    drawPixelPanel(ctx, x - 20, y - 20, 40, 40, {
      cut: 5, shadow: false, fill: hover ? '#631526' : '#251017',
      border: hover ? '#ef3150' : '#65303b', accent: hover ? '#ef3150' : '#773142',
    });
    ctx.fillStyle = '#eee0d3'; ctx.font = 'bold 18px monospace';
    ctx.fillText(sx < 0 ? '<' : '>', x, y + 6);
  }

  ctx.textAlign = 'left'; ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#a99a91';
  ctx.fillText('SFX  [- / +]', W / 2 - 170, 435);
  drawPixelBar(ctx, W / 2 - 55, 426, 225, 10, G.sfxVol, {
    fill: '#c92a40', glint: '#ff7d82', border: '#63303a', segments: 10,
  });
  ctx.fillText('MUSIC [, / .]', W / 2 - 170, 445);
  drawPixelBar(ctx, W / 2 - 55, 436, 225, 10, G.musicVol, {
    fill: '#468e9d', glint: '#a5edee', border: '#315b65', segments: 10,
  });

  drawPixelTag(ctx, '[P] RESUME', W / 2 - 250, 462, { width: 112, height: 28, color: '#f0e5d7', accent: '#b5243a' });
  drawPixelTag(ctx, '[R] SWAP', W / 2 - 125, 462, { width: 112, height: 28, color: '#bba9a1', accent: '#6e3843' });
  drawPixelTag(ctx, '[T] AUTO ' + (G.autoPerk ? 'ON' : 'OFF'), W / 2, 462, { width: 112, height: 28, color: G.autoPerk ? '#79d9ca' : '#bba9a1', accent: G.autoPerk ? '#378b80' : '#6e3843' });
  drawPixelTag(ctx, '[M] MUTE', W / 2 + 125, 462, { width: 112, height: 28, color: '#bba9a1', accent: '#6e3843' });
  ctx.fillStyle = '#69585a'; ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ARROW KEYS / CLICK TO CHANGE TRACK  ·  LIVE BOSS FIGHTS OVERRIDE SELECTION', W / 2, 503);

  const hb = HELP_BUTTON;
  const helpHover = inRect(Input.mx, Input.my, hb);
  drawPixelTag(ctx, '[?] HELP', hb.x, hb.y, {
    width: hb.w, height: hb.h,
    color: helpHover ? '#f1cb53' : '#b89c46', accent: helpHover ? '#c9a227' : '#7c6424',
  });
}

function drawGameOver(ctx) {
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
  if (G.score >= (G.best || 0) && G.score > 0) {
    drawPixelTag(ctx, 'NEW BEST CUT', W / 2 - 68, 367, { width: 136, height: 26, color: '#f1cb53', accent: '#b38b2e' });
  }
  drawPixelPanel(ctx, W / 2 - 140, 414, 280, 50, {
    cut: 5, shadow: false, accent: '#cf2942', border: '#8c293c', fill: '#1a080e',
  });
  ctx.fillStyle = '#f1e4d5'; ctx.font = 'bold 12px monospace';
  ctx.fillText('[ R / ENTER ]  CUT AGAIN', W / 2, 444);
}

window.addEventListener('load', init);
