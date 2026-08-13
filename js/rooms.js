// ---- floor generation, room state, doors, hazards ----

const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const ROOM_SHAPES = {
  hall:      { x0: 48,  y0: 48,  x1: 912, y1: 592 },   // unchanged — start & boss rooms
  wide_hall: { x0: 48,  y0: 176, x1: 912, y1: 464 },   // h 224 -> 288 ("a little wider"; cy stays 320, min dim 288 < 300 keeps censer/broodsac excluded)
  tall_hall: { x0: 336, y0: 48,  x1: 624, y1: 592 },   // w 224 -> 288 (cx stays 480)
  chamber:   { x0: 208, y0: 128, x1: 752, y1: 512 },   // unchanged — item rooms
  pit:       { x0: 128, y0: 88,  x1: 832, y1: 552 },   // unchanged
  grand_hall:{ x0: 48,  y0: 48,  x1: 1680, y1: 592 },  // new, ~1.7× wide — camera scrolls horizontally (w 1632 > 960)
  deep_hall: { x0: 480, y0: 48,  x1: 912, y1: 1136 },  // new, ~1.85× tall — camera scrolls vertically (h 1088 > 640)
  meat_hall: { x0: 48,  y0: 48,  x1: 1680, y1: 1136 }, // new, 1.7× × 1.85× — camera scrolls both axes
  odd_hall:  { x0: 160, y0: 128, x1: 800, y1: 512 },   // new, fits screen but off-center — visually "odd" with zero camera
};
const ROOM_THEMES = {
  abattoir: { floor: ['tile_floor1', 'tile_floor1', 'tile_floor4', 'tile_floor6'], wall: ['tile_wall', 'tile_wall2'] },
  plant:    { floor: ['tile_floor2', 'tile_floor5', 'tile_floor7'], wall: ['tile_wall', 'tile_wall4'] },
  oxide:    { floor: ['tile_floor3', 'tile_floor3', 'tile_floor6'], wall: ['tile_wall3', 'tile_wall'] },
  flesh:    { floor: ['tile_floor8', 'tile_floor8', 'tile_floor1'], wall: ['tile_wall4', 'tile_wall2'] },
};

const ENTRY_WARN = 0.75;   // first-entry wave telegraph seconds (~750ms reaction)
const ENTRY_BUFFER = 170;  // min px between player and a freshly-entered enemy

function roomBounds(room) {
  const def = ROOM_SHAPES[(room && room.shape) || 'hall'] || ROOM_SHAPES.hall;
  return { x0: def.x0, y0: def.y0, x1: def.x1, y1: def.y1,
    cx: (def.x0 + def.x1) / 2, cy: (def.y0 + def.y1) / 2,
    w: def.x1 - def.x0, h: def.y1 - def.y0 };
}

function setArenaForRoom(room) { G.arena = roomBounds(room); }

function genFloor(floor) {
  G.rooms = {};
  const target = Math.min(5 + floor, 9);
  G.rooms['0,0'] = makeRoom(0, 0, 'start');
  let cx = 0, cy = 0, guard = 0;
  while (Object.keys(G.rooms).length < target && guard++ < 500) {
    const [dx, dy] = choice(Object.values(DIRS));
    const nx = cx + dx, ny = cy + dy;
    if (!G.rooms[nx + ',' + ny]) {
      G.rooms[nx + ',' + ny] = makeRoom(nx, ny, 'combat');
      if (chance(0.5)) { cx = nx; cy = ny; }
    } else { cx = nx; cy = ny; }
  }
  // assign boss (farthest) and item (second farthest, dist >= 2)
  const list = Object.values(G.rooms).sort((a, b) =>
    (Math.abs(b.gx) + Math.abs(b.gy)) - (Math.abs(a.gx) + Math.abs(a.gy)));
  list[0].type = 'boss';
  for (const r of list) {
    const d = Math.abs(r.gx) + Math.abs(r.gy);
    if (r.type === 'combat' && d >= 2) { r.type = 'item'; break; }
  }
  const smallShapes = ['hall', 'hall', 'pit', 'chamber', 'wide_hall', 'tall_hall', 'odd_hall'];
  const bigShapes = ['grand_hall', 'deep_hall', 'meat_hall'];
  const themes = Object.keys(ROOM_THEMES);
  for (const r of Object.values(G.rooms)) {
    r.theme = choice(themes);
    if (r.type === 'start' || r.type === 'boss') r.shape = 'hall';
    else if (r.type === 'item') r.shape = 'chamber';
    else r.shape = (G.floor >= 2 && chance(0.30)) ? choice(bigShapes) : choice(smallShapes);
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      r.doors[dir] = !!G.rooms[(r.gx + dx) + ',' + (r.gy + dy)];
    }
  }
}

function makeRoom(gx, gy, type) {
  return { gx, gy, type, shape: 'hall', theme: 'abattoir', doors: {}, cleared: type === 'start',
    visited: false, decals: [], wavesLeft: 0, spawnT: 0, bossSpawned: false, pickups: [] };
}

function roomKey(x, y) { return x + ',' + y; }

function wavesFor(floor) {
  const base = 3 + Math.ceil(floor * 1.4);
  const waves = [base];
  if (floor >= 2) waves.push(Math.ceil(base * 0.7));
  if (floor >= 4) waves.push(Math.ceil(base * 0.5));
  return waves;
}

function enterRoom(gx, gy) {
  // stash the old room's pickups (stairs, pedestals, rewards, gems all persist)
  if (G.cur) G.cur.pickups = G.pickups;
  G.enemies = [];
  G.ebullets = [];
  G.bullets = [];
  G.hazards = [];
  G.telegraphs = [];
  G.corpses = [];
  G.boss = null;
  G.roomLayer = null;
  G.roomLayerKey = '';
  G.wallLayer = null;
  G.wallLayerKey = '';
  G.roomDamaged = false;
  G.roomEnterT = G.time;
  G.entryFresh = false;
  if (G.player) G.player.metronomeTmp = 0; // fresh per-room Crimson-Metronome loan ledger

  const room = G.rooms[roomKey(gx, gy)];
  G.cur = room;
  setArenaForRoom(room);
  G.pickups = room.pickups;
  const a = G.arena;

  // spawn protection: brief invincibility walking into a fresh room
  if (G.player) {
    G.player.invT = Math.max(G.player.invT, 1.0);
    G.player.x = clamp(G.player.x, a.x0 + G.player.r, a.x1 - G.player.r);
    G.player.y = clamp(G.player.y, a.y0 + G.player.r, a.y1 - G.player.r);
  }
  // Iron Lung: re-arm the once-per-room hit block
  if (G.player && G.player.stats.ironLung > 0) G.player.ironLungReady = true;

  if (!room.visited) {
    room.visited = true;
    if (room.type === 'combat') {
      const w = wavesFor(G.floor);
      room.wavesLeft = w.length;
      room.pendingWave = w;
      G.entryFresh = true;
      spawnWave(w[0], G.floor, ENTRY_WARN);
      room.wavesLeft--;
      room.spawnT = 0;
    } else if (room.type === 'boss') {
      const boss = spawnBoss(G.floor);
      room.bossSpawned = true;
      // boss fights are a pure ammo drain, so stock the room on the way in
      spawnPickup('ammo', a.cx, a.cy + 140);
      Music.playBoss(boss.bossKind);
    } else if (room.type === 'item') {
      spawnItemPedestal(a.cx - 45, a.cy, null, 'room');
      // item rooms sometimes also stock a weapon
      if (chance(0.35)) {
        const w = rollWeaponDrop(G.floor);
        spawnPickup('weapon', a.cx + 55, a.cy, { wid: w.id });
      }
      // and occasionally a bonus active pedestal
      if (chance(0.15)) spawnActivePedestal(a.cx + 130, a.cy + 55);
      room.cleared = true;
    }
  } else if (room.type === 'combat' && !room.cleared && room.wavesLeft > 0) {
    // re-entering an uncleared room: restart waves
    spawnWave(room.pendingWave[room.pendingWave.length - room.wavesLeft], G.floor);
    room.wavesLeft--;
    room.spawnT = 0;
  }
}

// Isaac-style: the view centers on the player and is clamped so it never leaves
// the room. Rooms that fit the screen keep cam exactly at the room center —
// which is (0,0) for every current shape, so existing rendering is byte-identical.
// In larger rooms the camera may peek a little past the arena edge (into the
// drawn wall band, which is WALL thick) so walls and their exit doors come into
// view as the player reaches them.
const CAM_EDGE_PEEK = WALL * 0.9; // how far past the arena edge the camera may glide
function updateCamera() {
  const a = G.arena, p = G.player;
  if (!a || !p) return;
  G.cam = G.cam || { x: 0, y: 0 };
  G.cam.x = a.w <= W ? a.cx - W / 2 : clamp(p.x - W / 2, a.x0 - CAM_EDGE_PEEK, a.x1 - W + CAM_EDGE_PEEK);
  G.cam.y = a.h <= H ? a.cy - H / 2 : clamp(p.y - H / 2, a.y0 - CAM_EDGE_PEEK, a.y1 - H + CAM_EDGE_PEEK);
}
// screen-space mouse -> world coords (safe pre-player: cam exists from state.js)
function mxW() { return Input.mx + G.cam.x; }
function myW() { return Input.my + G.cam.y; }

function separateEntryWave() {
  const p = G.player;
  const a = G.arena;
  const minD = Math.min(ENTRY_BUFFER, Math.min(a.w, a.h) * 0.42);
  const minD2 = minD * minD;
  for (const e of G.enemies) {
    if (e.boss || e.hp <= 0) continue;
    if (dist2(e.x, e.y, p.x, p.y) < minD2) {
      const pos = spawnPosAwayFromPlayer();
      e.x = pos.x; e.y = pos.y;
    }
  }
}

function roomLocked() {
  const r = G.cur;
  if (!r) return false;
  if (r.type !== 'combat' && r.type !== 'boss') return false;
  return !r.cleared;
}

function updateRoom(dt) {
  const r = G.cur;
  const p = G.player;
  const a = G.arena;

  // If the current pressure is clearly overwhelming the build, ease it down
  // smoothly. Spawn-time application means living enemies never jump stats.
  if (G.enemies.length > 0) {
    const lowHealth = p.hp / Math.max(1, p.stats.maxHp) < 0.35;
    const stalled = G.time - G.roomEnterT > 90;
    if (lowHealth || stalled) {
      const decay = lowHealth ? 0.02 : 0.008;
      applyPressureDelta(-decay * dt * pressureDropScale());
    }
  }
  G.recentHits = (G.recentHits || []).filter(t => G.time - t < 12);

  // wave progression / room clear
  if (r.type === 'combat' && !r.cleared) {
    if (G.enemies.length === 0) {
      if (r.wavesLeft > 0) {
        r.spawnT += dt;
        if (r.spawnT > 0.9) {
          r.spawnT = 0;
          spawnWave(r.pendingWave[r.pendingWave.length - r.wavesLeft], G.floor);
          r.wavesLeft--;
        }
      } else {
        r.cleared = true;
        recordRoomClear(r);
        spawnRoomReward(a.cx, a.cy, G.floor);
        Sfx.roomClear();
        addScore(50);
      }
    }
  } else if (r.type === 'boss' && r.bossSpawned && !r.cleared) {
    if (!G.boss && G.enemies.length === 0) {
      r.cleared = true;
      recordRoomClear(r);
      Sfx.roomClear();
    }
  }

  // door transitions
  if (!roomLocked()) {
    let dir = null;
    if (p.y < a.y0 + p.r + 6 && Math.abs(p.x - a.cx) < DOOR_HALF && keyDown('w', 'arrowup')) dir = 'n';
    else if (p.y > a.y1 - p.r - 6 && Math.abs(p.x - a.cx) < DOOR_HALF && keyDown('s', 'arrowdown')) dir = 's';
    else if (p.x > a.x1 - p.r - 6 && Math.abs(p.y - a.cy) < DOOR_HALF && keyDown('d', 'arrowright')) dir = 'e';
    else if (p.x < a.x0 + p.r + 6 && Math.abs(p.y - a.cy) < DOOR_HALF && keyDown('a', 'arrowleft')) dir = 'w';
    if (dir && r.doors[dir]) {
      const [dx, dy] = DIRS[dir];
      enterRoom(r.gx + dx, r.gy + dy);
      const next = G.arena;
      // place player at the opposite door in the destination's own shape
      if (dir === 'n') { p.y = next.y1 - p.r - 8; p.x = next.cx; }
      if (dir === 's') { p.y = next.y0 + p.r + 8; p.x = next.cx; }
      if (dir === 'e') { p.x = next.x0 + p.r + 8; p.y = next.cy; }
      if (dir === 'w') { p.x = next.x1 - p.r - 8; p.y = next.cy; }
      p.x = clamp(p.x, next.x0 + p.r, next.x1 - p.r);
      p.y = clamp(p.y, next.y0 + p.r, next.y1 - p.r);
      if (G.entryFresh) { separateEntryWave(); G.entryFresh = false; }
      G.transition = 0.3;
      Sfx.door();
    }
  }
}

function recordRoomClear(room) {
  if (!G.roomDamaged) {
    G.streak++;
    applyPressureDelta(pressureGain());
  } else {
    G.streak = 0;
  }
  // active items charge on room clears: +1 per combat room, +2 per boss
  const p = G.player;
  // Crimson Metronome: a ½-heart loan is repaid when the room clears clean
  if (!G.roomDamaged && p.metronomeTmp > 0) {
    const back = Math.min(p.metronomeTmp, p.stats.maxHp - p.hp);
    p.hp += back;
    p.metronomeTmp = 0;
    if (back > 0) spawnText(p.x, p.y - 26, 'LOAN REPAID +' + back, '#d98991');
  }
  if (p && p.active) {
    const a = ACTIVES[p.active.iid];
    if (a) {
      const gain = room.type === 'boss' ? 2 : (room.type === 'combat' ? 1 : 0);
      if (gain > 0 && p.active.charges < a.cost) {
        p.active.charges = Math.min(a.cost, p.active.charges + gain);
        if (p.active.charges >= a.cost) spawnText(p.x, p.y - 30, a.name.toUpperCase() + ' READY', '#e2472f');
      }
    }
  }
  if (room.type === 'combat' && G.player.stats.roomHeal > 0 && G.player.hp < G.player.stats.maxHp) {
    const before = G.player.hp;
    healPlayer(G.player.stats.roomHeal);
    if (G.player.hp > before) spawnText(G.player.x, G.player.y - 18, 'ROOM KNIT +' + (G.player.hp - before), '#d98991');
  }
  // Bone Knit perk: small chance of a half-heart mend on each combat clear
  if (room.type === 'combat' && G.player.stats.roomHealChance > 0 && G.player.hp < G.player.stats.maxHp &&
      chance(Math.min(0.9, G.player.stats.roomHealChance))) {
    const before = G.player.hp;
    healPlayer(1);
    if (G.player.hp > before) spawnText(G.player.x, G.player.y - 30, 'BONE KNIT +' + (G.player.hp - before), '#d98991');
  }
}

function nextFloor() {
  G.floor++;
  addScore(250);
  Sfx.stairs();
  genFloor(G.floor);
  enterRoom(0, 0);
  // Shield Heart perk: fresh shield hearts each floor
  G.player.shieldHp = G.player.stats.shieldPerk || 0;
  if (G.player.shieldHp > 0) { spawnText(G.player.x, G.player.y - 20, 'SHIELD UP', '#3bc9e0'); Sfx.shieldUp(); }
  // legendary once-per-floor flags reset
  G.player.secondSkinUsed = false;
  G.player.lastCutActive = false;
  G.player.x = W / 2; G.player.y = H / 2;
  addToast('FLOOR ' + G.floor, 'the meat runs deeper here');
  Music.requestFloorMusic();
  G.transition = 0.5;
}

// ---- hazards (acid pools, fire, bear traps) ----
function updateHazards(dt) {
  const p = G.player;
  for (let i = G.hazards.length - 1; i >= 0; i--) {
    const h = G.hazards[i];
    h.t += dt;
    if (h.t >= h.life) { G.hazards.splice(i, 1); continue; }
    if (h.hostile) {
      h.tick = (h.tick || 0) - dt;
      if (h.tick <= 0 && dist2(h.x, h.y, p.x, p.y) < (h.r + p.r) * (h.r + p.r)) {
        h.tick = h.tickRate || 0.4;
        hurtPlayer(h.dmg || 1, angleTo(h.x, h.y, p.x, p.y));
      }
    }
    if (h.kind === 'trap') {
      for (const e of G.enemies) {
        if (e.boss || e.hp <= 0) continue;
        if (h.caught && h.caught.has(e)) continue; // each victim springs it once
        if (dist2(h.x, h.y, e.x, e.y) < (h.r + e.r) * (h.r + e.r)) {
          e.rootT = 2.2;
          damageEnemy(e, h.dmg, rand(0, TAU), false);
          spawnBlood(e.x, e.y, 0, 6);
          Sfx.trapSnap({ x: h.x, y: h.y });
          // a trap snaps shut on a few victims before it breaks
          if (!h.caught) h.caught = new Set();
          h.caught.add(e);
          h.charges = (h.charges === undefined ? 1 : h.charges) - 1;
          if (h.charges <= 0) { G.hazards.splice(i, 1); break; }
        }
      }
    } else if (!h.hostile || h.dps > 0) { // weapon pools hurt enemies; zero-DPS boss pools do not
      for (const e of G.enemies) {
        if (e.hp <= 0) continue;
        if (e === h.owner) continue;
        if (dist2(h.x, h.y, e.x, e.y) < (h.r + e.r * 0.5) * (h.r + e.r * 0.5)) {
          if (h.kind === 'acid') { e.slowT = 0.4; tickEnemyDamage(e, h.dps * dt); }
          else { e.burnT = Math.max(e.burnT, 0.8); e.burnDps = h.dps; }
        }
      }
    }
  }
}

// ---- rendering ----
function hashTile(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

const FLOOR_TILE_POOL = [
  'tile_floor1', 'tile_floor1', 'tile_floor1',
  'tile_floor2', 'tile_floor2', 'tile_floor2',
  'tile_floor3', 'tile_floor3',
  'tile_floor4', 'tile_floor6', 'tile_floor6', 'tile_floor6',
  'tile_floor5', 'tile_floor7', 'tile_floor8', 'tile_floor1',
];
const WALL_TILE_POOL = ['tile_wall', 'tile_wall', 'tile_wall2', 'tile_wall3', 'tile_wall4'];

function drawFloorTiles(target, r, extW, extH) {
  const a = roomBounds(r);
  const theme = ROOM_THEMES[r.theme] || ROOM_THEMES.abattoir;
  target.fillStyle = '#050204';
  target.fillRect(0, 0, extW === undefined ? W : extW, extH === undefined ? H : extH);
  target.save();
  target.beginPath(); target.rect(a.x0, a.y0, a.w, a.h); target.clip();
  const tx0 = Math.floor(a.x0 / TILE), tx1 = Math.ceil(a.x1 / TILE);
  const ty0 = Math.floor(a.y0 / TILE), ty1 = Math.ceil(a.y1 / TILE);
  for (let ty = ty0; ty < ty1; ty++) {
    for (let tx = tx0; tx < tx1; tx++) {
      const h = hashTile(tx + r.gx * 31, ty + r.gy * 31);
      const sprite = theme.floor[h % theme.floor.length];
      Sprites.draw(target, sprite, tx * TILE + TILE / 2, ty * TILE + TILE / 2, 0, TILE);
    }
  }
  target.restore();
}

function drawFloor(ctx, r) {
  // A room's 600 floor tiles are static. Cache them into one bitmap in the
  // browser; headless tests keep the simple direct path.
  const canCache = typeof document !== 'undefined' && document.createElement && G.imagesLoaded;
  if (!canCache) { drawFloorTiles(ctx, r); return; }
  const key = r.gx + ',' + r.gy + ':' + G.floor + ':' + r.shape + ':' + r.theme + ':' + hdScale();
  if (!G.roomLayer || G.roomLayerKey !== key) {
    const a = roomBounds(r);
    const rs = hdScale();
    const layer = document.createElement('canvas');
    layer.width = Math.max(W, a.x1) * rs; layer.height = Math.max(H, a.y1) * rs;
    const lctx = layer.getContext('2d');
    lctx.setTransform(rs, 0, 0, rs, 0, 0);
    lctx.imageSmoothingEnabled = !G.hdRemaster;
    drawFloorTiles(lctx, r, layer.width / rs, layer.height / rs);
    G.roomLayer = layer; G.roomLayerKey = key;
  }
  ctx.drawImage(G.roomLayer, 0, 0, G.roomLayer.width / hdScale(), G.roomLayer.height / hdScale());
}

function drawRoom(ctx) {
  const r = G.cur;
  drawFloor(ctx, r);
  // blood decals
  for (const d of r.decals) {
    Sprites.draw(ctx, d.img, d.x, d.y, d.rot, 48 * d.s, false, 0.55);
  }
  // hazards
  for (const h of G.hazards) {
    const k = 1 - h.t / h.life;
    if (h.kind === 'trap') {
      Sprites.draw(ctx, 'bullet_saw', h.x, h.y, h.t * 0.5, 28, false, clamp(k * 3, 0, 1));
    } else {
      ctx.globalAlpha = clamp(k * 2, 0, 0.55);
      const pulse = h.r * (0.82 + Math.sin(h.t * 5) * 0.08);
      ctx.fillStyle = h.hostile ? (h.kind === 'acid' ? '#a7c92b' : '#ff642b') : (h.kind === 'acid' ? '#4f9e25' : '#d65b18');
      ctx.beginPath(); ctx.arc(h.x, h.y, pulse, 0, TAU); ctx.fill();
      ctx.strokeStyle = h.hostile ? '#fff0a0' : (h.kind === 'acid' ? '#a5e34c' : '#ffb13b');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, pulse * 0.72, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // walls
  drawWalls(ctx, r);
}

function drawWallBands(target, r) {
  const a = roomBounds(r);
  const theme = ROOM_THEMES[r.theme] || ROOM_THEMES.abattoir;
  const wallPool = theme.wall;
  const left = a.x0 - WALL, right = a.x1 + WALL;
  const top = a.y0 - WALL, bottom = a.y1 + WALL;

  function clipBand(dir) {
    target.beginPath();
    if (dir === 'n' || dir === 's') {
      const y = dir === 'n' ? top : a.y1;
      if (r.doors[dir]) {
        target.rect(left, y, a.cx - DOOR_HALF - left, WALL);
        target.rect(a.cx + DOOR_HALF, y, right - a.cx - DOOR_HALF, WALL);
      } else target.rect(left, y, right - left, WALL);
    } else {
      const x = dir === 'w' ? left : a.x1;
      if (r.doors[dir]) {
        target.rect(x, top, WALL, a.cy - DOOR_HALF - top);
        target.rect(x, a.cy + DOOR_HALF, WALL, bottom - a.cy - DOOR_HALF);
      } else target.rect(x, top, WALL, bottom - top);
    }
    target.clip();
  }

  for (const dir of ['n', 's']) {
    target.save(); clipBand(dir);
    const y = dir === 'n' ? top + TILE / 2 : a.y1 + TILE / 2;
    for (let x = left; x < right; x += TILE) {
      const h = hashTile(Math.floor(x / TILE) + r.gx * 17, (dir === 'n' ? -1 : 11) + r.gy * 19);
      Sprites.draw(target, wallPool[h % wallPool.length], x + TILE / 2, y, 0, TILE);
    }
    target.restore();
  }
  for (const dir of ['w', 'e']) {
    target.save(); clipBand(dir);
    const x = dir === 'w' ? left + TILE / 2 : a.x1 + TILE / 2;
    for (let y = top; y < bottom; y += TILE) {
      const h = hashTile((dir === 'w' ? -1 : 16) + r.gx * 17, Math.floor(y / TILE) + r.gy * 19);
      Sprites.draw(target, wallPool[h % wallPool.length], x, y + TILE / 2, Math.PI / 2, TILE);
    }
    target.restore();
  }
  target.strokeStyle = 'rgba(0,0,0,0.5)'; target.lineWidth = 3;
  target.strokeRect(a.x0, a.y0, a.w, a.h);
}

function drawWalls(ctx, r) {
  const locked = roomLocked();
  const a = roomBounds(r);

  // static wall tiles are cached; door sprites are dynamic per frame
  const canCache = typeof document !== 'undefined' && document.createElement && G.imagesLoaded;
  if (canCache) {
    const key = r.gx + ',' + r.gy + ':' + G.floor + ':' + r.shape + ':' + r.theme + ':' + hdScale();
    if (!G.wallLayer || G.wallLayerKey !== key) {
      const rs = hdScale();
      const layer = document.createElement('canvas');
      layer.width = (a.x1 + WALL) * rs;
      layer.height = (a.y1 + WALL) * rs;
      const lctx = layer.getContext('2d');
      lctx.setTransform(rs, 0, 0, rs, 0, 0);
      lctx.imageSmoothingEnabled = !G.hdRemaster;
      drawWallBands(lctx, r);
      G.wallLayer = layer;
      G.wallLayerKey = key;
    }
    ctx.drawImage(G.wallLayer, 0, 0, G.wallLayer.width / hdScale(), G.wallLayer.height / hdScale());
  } else {
    drawWallBands(ctx, r);
  }

  for (const [dir, has] of Object.entries(r.doors)) {
    if (!has) continue;
    const sprite = locked ? 'door_locked' : 'door_open';
    let x, y, rot;
    if (dir === 'n') { x = a.cx; y = a.y0 - WALL / 2; rot = 0; }
    else if (dir === 's') { x = a.cx; y = a.y1 + WALL / 2; rot = 0; }
    else if (dir === 'e') { x = a.x1 + WALL / 2; y = a.cy; rot = Math.PI / 2; }
    else { x = a.x0 - WALL / 2; y = a.cy; rot = Math.PI / 2; }
    const horiz = dir === 'n' || dir === 's';
    const dirSeed = { n: 0, s: 2.1, e: 4.2, w: 6.3 }[dir];
    ctx.fillStyle = '#050103';
    if (horiz) ctx.fillRect(x - DOOR_HALF, y - WALL / 2, DOOR_HALF * 2, WALL);
    else ctx.fillRect(x - WALL / 2, y - DOOR_HALF, WALL, DOOR_HALF * 2);
    Sprites.draw(ctx, sprite, x, y, rot, 150, false, 1, 1, 0.82);
    ctx.save();
    if (horiz) ctx.translate(x, y); else { ctx.translate(x, y); ctx.rotate(Math.PI / 2); }
    ctx.globalAlpha = 0.20 + Math.sin(G.time * 2.0 + dirSeed) * 0.06;
    ctx.fillStyle = locked ? '#ff2a3c' : '#e8724a';
    ctx.fillRect(-DOOR_HALF, WALL / 2 - 8, DOOR_HALF * 2, 8);
    const rimAlpha = 0.30 + Math.sin(G.time * 2.2 + dirSeed) * 0.12;
    ctx.globalAlpha = rimAlpha;
    ctx.fillStyle = locked ? '#ff2a3c' : '#c4172a';
    ctx.fillRect(-DOOR_HALF - 2, -WALL / 2 - 2, 3, WALL + 4);
    ctx.fillRect(DOOR_HALF - 1, -WALL / 2 - 2, 3, WALL + 4);
    ctx.globalAlpha = 1;
    if (locked) {
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < 7; k++) {
          const hh = hashTile((r.gx * 3 + 17) * 31 + side * 7 + k, (r.gy * 5 + 11) * 13 + k * 3);
          const ty = -WALL / 2 + 3 + (hh % 41);
          const th = 4 + (hh % 3), tw = 3 + (hh % 2);
          ctx.fillStyle = hh % 4 === 0 ? '#e8dcc2' : '#cfc0a4';
          ctx.beginPath();
          ctx.moveTo(side * DOOR_HALF, ty - tw);
          ctx.lineTo(side * DOOR_HALF, ty + tw);
          ctx.lineTo(side * (DOOR_HALF - th), ty);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.restore();
    const chevOff = dir === 'n' ? -1 : (dir === 's' ? 1 : 0);
    const chevOffX = dir === 'w' ? -1 : (dir === 'e' ? 1 : 0);
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(G.time * 3 + dirSeed) * 0.2;
    ctx.strokeStyle = locked ? '#ff2a3c' : '#e8b04a';
    ctx.lineWidth = 3;
    for (let c = 1; c <= 2; c++) {
      const d0 = WALL + 10 + c * 12;
      ctx.beginPath();
      if (horiz) {
        const yy = y + chevOff * d0;
        ctx.moveTo(x - 10, yy); ctx.lineTo(x, yy + chevOff * 8); ctx.lineTo(x + 10, yy);
      } else {
        const xx = x + chevOffX * d0;
        ctx.moveTo(xx, y - 10); ctx.lineTo(xx + chevOffX * 8, y); ctx.lineTo(xx, y + 10);
      }
      ctx.stroke();
    }
    ctx.restore();
    if (locked) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(G.time * 6) * 0.2;
      ctx.fillStyle = '#8f1f2a';
      if (horiz) ctx.fillRect(x - DOOR_HALF, y - 8, DOOR_HALF * 2, 16);
      else ctx.fillRect(x - 8, y - DOOR_HALF, 16, DOOR_HALF * 2);
      ctx.restore();
    }
  }
}
