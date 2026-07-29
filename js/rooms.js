// ---- floor generation, room state, doors, hazards ----

const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

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
  // wire doors
  for (const r of Object.values(G.rooms)) {
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      r.doors[dir] = !!G.rooms[(r.gx + dx) + ',' + (r.gy + dy)];
    }
  }
}

function makeRoom(gx, gy, type) {
  return { gx, gy, type, doors: {}, cleared: type === 'start', visited: false, decals: [], wavesLeft: 0, spawnT: 0, bossSpawned: false, pickups: [] };
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
  G.roomDamaged = false;
  G.roomEnterT = G.time;

  const room = G.rooms[roomKey(gx, gy)];
  G.cur = room;
  G.pickups = room.pickups;

  // spawn protection: brief invincibility walking into a fresh room
  if (G.player) G.player.invT = Math.max(G.player.invT, 1.0);

  if (!room.visited) {
    room.visited = true;
    if (room.type === 'combat') {
      const w = wavesFor(G.floor);
      room.wavesLeft = w.length;
      room.pendingWave = w;
      spawnWave(w[0], G.floor);
      room.wavesLeft--;
      room.spawnT = 0;
    } else if (room.type === 'boss') {
      const boss = spawnBoss(G.floor);
      room.bossSpawned = true;
      Music.playBoss(boss.bossKind);
    } else if (room.type === 'item') {
      spawnItemPedestal(W / 2 - 45, H / 2);
      // item rooms sometimes also stock a weapon
      if (chance(0.35)) {
        const w = rollWeaponDrop(G.floor);
        spawnPickup('weapon', W / 2 + 55, H / 2, { wid: w.id });
      }
      room.cleared = true;
    }
  } else if (room.type === 'combat' && !room.cleared && room.wavesLeft > 0) {
    // re-entering an uncleared room: restart waves
    spawnWave(room.pendingWave[room.pendingWave.length - room.wavesLeft], G.floor);
    room.wavesLeft--;
    room.spawnT = 0;
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

  // If the current pressure is clearly overwhelming the build, ease it down
  // smoothly. Spawn-time application means living enemies never jump stats.
  if (G.enemies.length > 0) {
    const lowHealth = p.hp / Math.max(1, p.stats.maxHp) < 0.35;
    const stalled = G.time - G.roomEnterT > 90;
    if (lowHealth || stalled) {
      const decay = lowHealth ? 0.02 : 0.008;
      G.pressure = Math.max(PRESSURE_MIN, G.pressure - decay * dt);
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
        spawnRoomReward(W / 2, H / 2, G.floor);
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
    if (p.y < WALL + p.r + 6 && Math.abs(p.x - W / 2) < DOOR_HALF && keyDown('w', 'arrowup')) dir = 'n';
    else if (p.y > H - WALL - p.r - 6 && Math.abs(p.x - W / 2) < DOOR_HALF && keyDown('s', 'arrowdown')) dir = 's';
    else if (p.x > W - WALL - p.r - 6 && Math.abs(p.y - H / 2) < DOOR_HALF && keyDown('d', 'arrowright')) dir = 'e';
    else if (p.x < WALL + p.r + 6 && Math.abs(p.y - H / 2) < DOOR_HALF && keyDown('a', 'arrowleft')) dir = 'w';
    if (dir && r.doors[dir]) {
      const [dx, dy] = DIRS[dir];
      enterRoom(r.gx + dx, r.gy + dy);
      // place player at opposite door
      if (dir === 'n') { p.y = H - WALL - p.r - 8; }
      if (dir === 's') { p.y = WALL + p.r + 8; }
      if (dir === 'e') { p.x = WALL + p.r + 8; }
      if (dir === 'w') { p.x = W - WALL - p.r - 8; }
      G.transition = 0.3;
      Sfx.door();
    }
  }
}

function recordRoomClear(room) {
  if (!G.roomDamaged) {
    G.streak++;
    G.pressure = Math.min(PRESSURE_MAX, G.pressure + PRESSURE_GAIN);
  } else {
    G.streak = 0;
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
        if (e.boss) continue;
        if (dist2(h.x, h.y, e.x, e.y) < (h.r + e.r) * (h.r + e.r)) {
          e.rootT = 2.2;
          damageEnemy(e, h.dmg, rand(0, TAU), false);
          spawnBlood(e.x, e.y, 0, 6);
          Sfx.trapSnap({ x: h.x, y: h.y });
          G.hazards.splice(i, 1);
          break;
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

function drawFloorTiles(target, r) {
  for (let ty = 0; ty < H / TILE; ty++) {
    for (let tx = 0; tx < W / TILE; tx++) {
      const h = hashTile(tx + r.gx * 31, ty + r.gy * 31);
      const sprite = FLOOR_TILE_POOL[h % FLOOR_TILE_POOL.length];
      Sprites.draw(target, sprite, tx * TILE + TILE / 2, ty * TILE + TILE / 2, 0, TILE);
    }
  }
}

function drawFloor(ctx, r) {
  // A room's 600 floor tiles are static. Cache them into one bitmap in the
  // browser; headless tests keep the simple direct path.
  const canCache = typeof document !== 'undefined' && document.createElement && G.imagesLoaded;
  if (!canCache) { drawFloorTiles(ctx, r); return; }
  const key = r.gx + ',' + r.gy + ':' + G.floor;
  if (!G.roomLayer || G.roomLayerKey !== key) {
    const layer = document.createElement('canvas');
    layer.width = W; layer.height = H;
    const lctx = layer.getContext('2d');
    lctx.imageSmoothingEnabled = false;
    drawFloorTiles(lctx, r);
    G.roomLayer = layer; G.roomLayerKey = key;
  }
  ctx.drawImage(G.roomLayer, 0, 0);
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

function drawWalls(ctx, r) {
  const locked = roomLocked();
  // Draw 64px industrial panels into exact 48px collision bands. Door gaps
  // are clipping regions, not skipped whole tiles, so they remain precisely
  // 88px wide even though the art grid is larger.
  function clipBand(dir) {
    ctx.beginPath();
    if (dir === 'n' || dir === 's') {
      const y = dir === 'n' ? 0 : H - WALL;
      if (r.doors[dir]) {
        ctx.rect(0, y, W / 2 - DOOR_HALF, WALL);
        ctx.rect(W / 2 + DOOR_HALF, y, W / 2 - DOOR_HALF, WALL);
      } else ctx.rect(0, y, W, WALL);
    } else {
      const x = dir === 'w' ? 0 : W - WALL;
      if (r.doors[dir]) {
        ctx.rect(x, 0, WALL, H / 2 - DOOR_HALF);
        ctx.rect(x, H / 2 + DOOR_HALF, WALL, H / 2 - DOOR_HALF);
      } else ctx.rect(x, 0, WALL, H);
    }
    ctx.clip();
  }

  for (const dir of ['n', 's']) {
    ctx.save(); clipBand(dir);
    const y = dir === 'n' ? TILE / 2 : H - TILE / 2;
    for (let x = 0; x < W; x += TILE) {
      const h = hashTile(x / TILE + r.gx * 17, (dir === 'n' ? -1 : 11) + r.gy * 19);
      Sprites.draw(ctx, WALL_TILE_POOL[h % WALL_TILE_POOL.length], x + TILE / 2, y, 0, TILE);
    }
    ctx.restore();
  }
  for (const dir of ['w', 'e']) {
    ctx.save(); clipBand(dir);
    const x = dir === 'w' ? TILE / 2 : W - TILE / 2;
    for (let y = 0; y < H; y += TILE) {
      const h = hashTile((dir === 'w' ? -1 : 16) + r.gx * 17, y / TILE + r.gy * 19);
      Sprites.draw(ctx, WALL_TILE_POOL[h % WALL_TILE_POOL.length], x, y + TILE / 2, Math.PI / 2, TILE);
    }
    ctx.restore();
  }
  // dark inner edge
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
  ctx.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);

  // doors
  for (const [dir, has] of Object.entries(r.doors)) {
    if (!has) continue;
    const sprite = locked ? 'door_locked' : 'door_open';
    let x, y, rot;
    if (dir === 'n') { x = W / 2; y = WALL / 2; rot = 0; }
    else if (dir === 's') { x = W / 2; y = H - WALL / 2; rot = 0; }
    else if (dir === 'e') { x = W - WALL / 2; y = H / 2; rot = Math.PI / 2; }
    else { x = WALL / 2; y = H / 2; rot = Math.PI / 2; }
    Sprites.draw(ctx, sprite, x, y, rot, 96);
    if (locked) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(G.time * 6) * 0.2;
      ctx.fillStyle = '#8f1f2a';
      if (dir === 'n' || dir === 's') ctx.fillRect(x - DOOR_HALF, y - 6, DOOR_HALF * 2, 12);
      else ctx.fillRect(x - 6, y - DOOR_HALF, 12, DOOR_HALF * 2);
      ctx.restore();
    }
  }
}
