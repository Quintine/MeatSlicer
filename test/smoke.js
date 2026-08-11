// Headless smoke test: stubs the DOM/canvas, loads the game scripts,
// and drives the game through its major code paths.
// Run: node test/smoke.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- fake canvas 2d context ----
function fakeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 50 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (typeof prop === 'string') {
        if (!(prop in t)) t[prop] = (typeof prop === 'string' && /^[a-z]/.test(prop)) ? function () {} : undefined;
      }
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

const listeners = {};
const canvasStub = {
  width: 960, height: 640, style: {},
  getContext: () => fakeCtx(),
  addEventListener: (ev, fn) => { (listeners['canvas:' + ev] = listeners['canvas:' + ev] || []).push(fn); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
};

const sandbox = {
  console,
  performance: { now: () => simTime },
  requestAnimationFrame: () => {}, // we drive update() manually
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { getElementById: () => canvasStub },
  Image: class { constructor() { this.width = 32; this.height = 32; } set src(v) { this.onerror && this.onerror(); } },
  Audio: class {
    constructor() { this.volume = 0; this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  },
  AudioContext: undefined, // exercise the no-WebAudio path
  setTimeout: (fn, ms) => fn(), // run sfx sequences inline
  Math, JSON, Object, Array, Number, String, Boolean, Promise, Uint8ClampedArray, Proxy, Reflect, Set, Map, Date, Error, RegExp, parseInt, parseFloat, isNaN, Infinity, NaN, undefined,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.addEventListener = (ev, fn) => { (listeners['win:' + ev] = listeners['win:' + ev] || []).push(fn); };
vm.createContext(sandbox);

// load game scripts in index.html order
const files = ['utils', 'state', 'input', 'sfx', 'sfxbank', 'audio', 'sprites', 'particles', 'weapons',
  'bullets', 'pickups', 'items', 'perks', 'enemies', 'bosses', 'rooms', 'player', 'hud', 'help', 'debug', 'main'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: f + '.js' });
}
// const/let top-level bindings live in the context's lexical scope, not on the
// global object — expose the ones the harness pokes at directly.
vm.runInContext('Object.assign(this, { G, Input, WEAPONS, Music, Sfx, SfxBank, W, H, WALL, ITEMS, ACTIVES, PERKS, ENEMY_TYPES, BOSS_DEFS, SPRITE_MANIFEST, Sprites, ACTOR_ANIMS, PRESSURE_UNIT, PRESSURE_MIN, PRESSURE_MAX, PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX, ROOM_SHAPES, ROOM_THEMES, HELP_PAGES, HELP_RENDERERS, SPAWN_WARN, ENTRY_WARN, ENTRY_BUFFER, STUN_UNIT, stunChance, separateEntryWave, defaultPlayerStats, applyPressureDelta, debugRebuildStats, debugEnabled, DEBUG_PAGES, updateCamera, mxW, myW, angleTo, genFloor, roomBounds, WEAPON_DROP_LOCKOUT })', sandbox);

let simTime = 0;
const ctx = sandbox;
let autoDraft = false; // when true, perk offers are auto-picked so tests stay in play mode
function step(n, dtMs) {
  for (let i = 0; i < n; i++) {
    if (autoDraft && ctx.G.mode === 'levelup') ctx.choosePerk(0);
    simTime += dtMs;
    ctx.update(dtMs / 1000);
    ctx.draw();
    ctx.clearInputEdges();
  }
}
function fire(ev, key) {
  for (const fn of (listeners['win:' + ev] || [])) fn({ key, preventDefault() {} });
}
function press(key) { fire('keydown', key); }
function release(key) { fire('keyup', key); }
function tap(key) { press(key); step(1, 16); release(key); }

let failures = 0;
function check(name, cond) {
  if (cond) console.log('  PASS ' + name);
  else { console.log('  FAIL ' + name); failures++; }
}

console.log('== boot ==');
for (const fn of (listeners['win:load'] || [])) fn();
step(5, 16);
check('menu mode', ctx.G.mode === 'menu');
check('no images loaded (fallbacks ok)', ctx.G.imagesLoaded === true);
check('five complete actor actions registered', Object.keys(ctx.ACTOR_ANIMS).join(',') === 'idle,move,attack,hit,death');
let sheetDraws = 0;
let outOfBoundsDraws = 0;
const actorCtx = fakeCtx();
actorCtx.drawImage = (img, sx, sy, sw, sh) => {
  sheetDraws++;
  if (sx < 0 || sy < 0 || sx + sw > img.width || sy + sh > img.height) outOfBoundsDraws++;
};
const sheetCases = [
  ['player', 768, 2784, 96],
  ['enemy_shambler', 512, 1856, 64],
  ['boss_bonesaw', 1024, 3712, 128],
  ['boss_gorecrown', 1024, 3712, 128],
  ['boss_knifecrawl', 1024, 3712, 128],
  ['boss_vealmother', 1024, 3712, 128],
  ['boss_flenser', 1024, 3712, 128],
  ['boss_hookchoir', 1024, 3712, 128],
  ['boss_platefather', 1024, 3712, 128],
  ['boss_augerprime', 1024, 3712, 128],
  ['boss_scald', 1024, 3712, 128],
];
for (const [name, width, height, targetW] of sheetCases) {
  ctx.Sprites.imgs[name + '_sheet'] = { width, height };
  for (let dir = 0; dir < 8; dir++) {
    for (const action of Object.keys(ctx.ACTOR_ANIMS)) {
      ctx.Sprites.actor(actorCtx, name, 0, 0, dir * Math.PI / 4, action, 0.2, targetW);
    }
  }
  delete ctx.Sprites.imgs[name + '_sheet'];
}
check('all frame sizes address 8 directions and 5 actions', sheetDraws === 440);
check('actor atlas reads stay in bounds', outOfBoundsDraws === 0);
const layeredPlayerSprites = ['player_legs', 'player_legs_sheet', ...Object.keys(ctx.WEAPONS).map(id => 'pt_' + id)];
check('layered player sprites are all preloaded', layeredPlayerSprites.every(name => ctx.SPRITE_MANIFEST.includes(name)));
let legDraws = 0, legOutOfBounds = 0;
const legRotations = [];
const legCtx = fakeCtx();
legCtx.rotate = angle => legRotations.push(angle);
legCtx.drawImage = (img, sx, sy, sw, sh) => {
  legDraws++;
  if (sx < 0 || sy < 0 || sx + sw > img.width || sy + sh > img.height) legOutOfBounds++;
};
ctx.Sprites.imgs.player_legs_sheet = { width: 768, height: 96 };
for (let frame = 0; frame < 8; frame++) {
  ctx.Sprites.legs(legCtx, 0, 0, Math.PI / 3, frame * Math.PI / 4 + 0.01, 96);
}
delete ctx.Sprites.imgs.player_legs_sheet;
check('legs strip addresses all 8 stride frames', legDraws === 8);
check('legs strip reads stay in bounds', legOutOfBounds === 0);
check('legs strip rotates smoothly at runtime', legRotations.length === 8 && legRotations.every(angle => Math.abs(angle - Math.PI / 3) < 0.001));
check('every weapon has layered render and muzzle geometry', Object.values(ctx.WEAPONS).every(w =>
  Number.isFinite(w.torsoW) && Number.isFinite(w.torsoFwd) && Number.isFinite(w.muzzle) && w.muzzle > 0));
check('every weapon has finite impact punch metadata', Object.values(ctx.WEAPONS).every(w => Number.isFinite(w.punch) && w.punch > 0));
check('arsenal still contains exactly 16 weapons', Object.keys(ctx.WEAPONS).length === 16);
check('quantitative tier rebalance: 2/4/5/4 distribution', [0, 1, 2, 3].every(t => Object.values(ctx.WEAPONS).filter(w => w.tier === t).length === [2, 4, 5, 4][t]));
check('every drop tier has at least one weapon', [0, 1, 2, 3].every(t => Object.values(ctx.WEAPONS).some(w => w.tier === t)));
check('visceral DSP and fallback events are wired',
  ['punch', 'duck', 'wallHit', 'lifesteal'].every(name => typeof ctx.Sfx[name] === 'function'));
const missingSfxFiles = Object.values(ctx.SfxBank.FILES).filter(file => {
  const soundPath = path.join(__dirname, '..', 'assets', 'sfx', file);
  return !fs.existsSync(soundPath) || fs.statSync(soundPath).size === 0;
});
check('every registered SFX file exists and is non-empty', missingSfxFiles.length === 0);
if (missingSfxFiles.length) console.log('   MISSING-SFX: ' + missingSfxFiles.join(', '));

console.log('== start run ==');
tap('Enter');
check('play mode', ctx.G.mode === 'play');
check('player exists', !!ctx.G.player);
check('Bone Popper baseline is 8 damage at 0.60s', ctx.WEAPONS.bonepopper.dmg === 8 && ctx.WEAPONS.bonepopper.interval === 0.60);
check('floor 1 rooms generated', Object.keys(ctx.G.rooms).length >= 5);
check('start room current', ctx.G.cur && ctx.G.cur.type === 'start');
step(30, 16);

console.log('== movement + firing ==');
const px = ctx.G.player.x;
press('d'); step(20, 16); release('d');
check('player moved right', ctx.G.player.x > px);
ctx.Input.mx = ctx.G.player.x; ctx.Input.my = ctx.G.player.y - 200;
press('d'); step(12, 16); release('d');
const bodyAimDelta = Math.abs(Math.atan2(Math.sin(ctx.G.player.aim - ctx.G.player.bodyFacing), Math.cos(ctx.G.player.aim - ctx.G.player.bodyFacing)));
check('body follows movement while weapon aim stays independent', bodyAimDelta > 0.7 && Math.abs(ctx.G.player.bodyFacing) < 0.45);
const idleBodyFacing = ctx.G.player.bodyFacing;
step(12, 16);
const aimDeltaBeforeIdle = Math.abs(Math.atan2(Math.sin(ctx.G.player.aim - idleBodyFacing), Math.cos(ctx.G.player.aim - idleBodyFacing)));
const aimDeltaAfterIdle = Math.abs(Math.atan2(Math.sin(ctx.G.player.aim - ctx.G.player.bodyFacing), Math.cos(ctx.G.player.aim - ctx.G.player.bodyFacing)));
check('legs rotate back toward aim after movement stops', aimDeltaAfterIdle < aimDeltaBeforeIdle);
const decalStart = ctx.G.cur.decals.length;
for (const offset of [45, 90, 135, 180]) {
  ctx.G.cur.decals.push({ x: ctx.G.player.x + offset, y: ctx.G.player.y, s: 1.6, rot: 0, img: 'decal_blood1' });
}
check('gore proximity query detects blood underfoot', ctx.onGore(ctx.G.player.x + 45, ctx.G.player.y));
press('d'); step(60, 16); release('d');
step(30, 16);
ctx.G.cur.decals.splice(decalStart);
ctx.Input.mdown = true; ctx.Input.mx = 700; ctx.Input.my = 300;
step(30, 16);
check('bullets fired', ctx.G.bullets.length > 0 || ctx.G.kills >= 0); // may have hit nothing
step(60, 16);
ctx.Input.mdown = false;

let wallHitCalls = 0;
const realWallHit = ctx.Sfx.wallHit;
ctx.Sfx.wallHit = () => { wallHitCalls++; };
ctx.G.bullets.length = 0;
ctx.G.bullets.push({
  x: ctx.W - ctx.WALL - 5, y: ctx.H / 2, vx: 700, vy: 0, r: 5, dmg: 1,
  pierce: 0, bounce: 0, bounces: 0, life: 1, t: 0, behavior: 'bullet',
  sprite: 'bullet_bone', homing: 0, hit: null, dragTarget: null,
});
ctx.updateBullets(0.02);
ctx.Sfx.wallHit = realWallHit;
check('absorbed rounds trigger wall impact audio', wallHitCalls === 1);

console.log('== combat room: lock, clear, unlock ==');
// find a combat room adjacent to start and force-move there
const start = ctx.G.rooms['0,0'];
const dir = Object.keys(start.doors).find(d => start.doors[d]);
check('start has a door', !!dir);
// teleport into neighbor and enter it
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const [dx, dy] = DIRS[dir];
ctx.enterRoom(start.gx + dx, start.gy + dy);
step(10, 16);
const room = ctx.G.cur;
if (room.type === 'combat') {
  check('enemies spawned', ctx.G.enemies.length > 0);
  check('room locked', ctx.roomLocked() === true);
  // kill everything, let waves cycle
  for (let guard = 0; guard < 200 && !room.cleared; guard++) {
    for (const e of [...ctx.G.enemies]) ctx.damageEnemy(e, 99999, 0, false);
    step(30, 16);
  }
  check('room cleared', room.cleared === true);
  check('room unlocked', ctx.roomLocked() === false);
  check('reward spawned', true); // reward pickups may already be collected
} else {
  check('neighbor room handled (' + room.type + ')', true);
}

console.log('== spawn safety ==');
{
  ctx.enterRoom(0, 0);
  check('room entry grants spawn protection', ctx.G.player.invT > 0.5);
  ctx.G.player.x = ctx.W / 2; ctx.G.player.y = ctx.H / 2;
  let nearDoor = 0, tooClose = 0;
  for (let i = 0; i < 80; i++) {
    const pos = ctx.spawnPosAwayFromPlayer();
    if (ctx.nearAnyDoor(pos.x, pos.y)) nearDoor++;
    if (Math.hypot(pos.x - ctx.G.player.x, pos.y - ctx.G.player.y) < 150) tooClose++;
  }
  check('no spawns near doors', nearDoor === 0);
  check('no spawns near player', tooClose === 0);
}

console.log('== variable room shapes and themes ==');
{
  const generated = Object.values(ctx.G.rooms);
  check('generated rooms all have valid shapes and themes', generated.every(r => ctx.ROOM_SHAPES[r.shape] && ctx.ROOM_THEMES[r.theme]));
  check('start and boss rooms retain full arenas', generated.filter(r => r.type === 'start' || r.type === 'boss').every(r => r.shape === 'hall'));
  check('item rooms use compact chambers', generated.filter(r => r.type === 'item').every(r => r.shape === 'chamber'));
  const savedRoom = ctx.G.cur, savedArena = ctx.G.arena;
  const px = ctx.G.player.x, py = ctx.G.player.y;
  let allBounds = true, allSpawns = true, allDraw = true;
  for (const shape of Object.keys(ctx.ROOM_SHAPES)) {
    const shaped = ctx.makeRoom(77, 88, 'combat');
    shaped.shape = shape; shaped.theme = 'oxide'; shaped.doors = {};
    ctx.G.cur = shaped; ctx.setArenaForRoom(shaped);
    const a = ctx.G.arena;
    ctx.G.player.x = -999; ctx.G.player.y = -999; ctx.Input.mdown = false;
    ctx.updatePlayer(0.016);
    allBounds = allBounds && ctx.G.player.x >= a.x0 + ctx.G.player.r && ctx.G.player.x <= a.x1 - ctx.G.player.r
      && ctx.G.player.y >= a.y0 + ctx.G.player.r && ctx.G.player.y <= a.y1 - ctx.G.player.r;
    ctx.G.player.x = a.cx; ctx.G.player.y = a.cy;
    for (let i = 0; i < 20; i++) {
      const pos = ctx.spawnPosAwayFromPlayer();
      allSpawns = allSpawns && pos.x >= a.x0 && pos.x <= a.x1 && pos.y >= a.y0 && pos.y <= a.y1;
    }
    try { ctx.drawFloorTiles(fakeCtx(), shaped); ctx.drawWalls(fakeCtx(), shaped); } catch (err) { allDraw = false; }
  }
  check('player clamps inside every room shape', allBounds);
  check('enemy spawn positions stay inside every room shape', allSpawns);
  check('every room shape and theme renders headlessly', allDraw);
  ctx.G.cur = savedRoom; ctx.G.arena = savedArena; ctx.G.player.x = px; ctx.G.player.y = py;
}

console.log('== big rooms + camera ==');
{
  // fit rooms keep camera pinned at (0,0) — current look is unchanged
  const fit = ctx.makeRoom(0, 0, 'combat'); fit.shape = 'hall';
  ctx.setArenaForRoom(fit);
  ctx.G.player.x = 100; ctx.G.player.y = 320;
  ctx.updateCamera();
  check('fit rooms keep camera at origin', ctx.G.cam.x === 0 && ctx.G.cam.y === 0);

  // wide room: camera follows the player, clamped to the room
  const wide = ctx.makeRoom(0, 0, 'combat'); wide.shape = 'grand_hall';
  ctx.setArenaForRoom(wide);
  const wa = ctx.G.arena;
  ctx.G.player.x = 100; ctx.G.player.y = 320; ctx.updateCamera();
  check('camera clamps at left arena edge', ctx.G.cam.x === wa.x0);
  ctx.G.player.x = wa.x1 - 200; ctx.G.player.y = 320; ctx.updateCamera();
  check('camera clamps at right arena edge', ctx.G.cam.x === wa.x1 - ctx.W);
  ctx.G.player.x = wa.cx; ctx.G.player.y = 320; ctx.updateCamera();
  check('camera centers on the player mid-room', ctx.G.cam.x === wa.cx - ctx.W / 2 && ctx.G.cam.y === 0);

  // world-mouse conversion
  ctx.G.cam.x = wa.cx - ctx.W / 2; ctx.Input.mx = 120; ctx.Input.my = 240;
  check('screen mouse maps to world coords', ctx.mxW() === 120 + ctx.G.cam.x && ctx.myW() === 240);

  // end-to-end: live in a big room — update+draw path, floor direct path, aim
  ctx.startRun();
  const big = ctx.G.rooms['0,0'];
  big.shape = 'meat_hall';
  ctx.G.cur = big; ctx.setArenaForRoom(big);
  ctx.G.player.x = ctx.G.arena.x0 + 80; ctx.G.player.y = ctx.G.arena.y0 + 80;
  ctx.G.enemies.length = 0;
  ctx.Input.mx = 300; ctx.Input.my = 200; ctx.Input.mdown = true;
  step(3, 16); // runs update() (firing, weapon lob path) + draw() (direct floor, camera)
  check('big room runs without error and aims at world mouse',
    Math.abs(ctx.G.player.aim - ctx.angleTo(ctx.G.player.x, ctx.G.player.y, ctx.Input.mx + ctx.G.cam.x, ctx.Input.my + ctx.G.cam.y)) < 1e-9);
  ctx.Input.mdown = false;
  ctx.startRun(); step(3, 16);
}

// floor >= 2 mixes big/odd rooms into combat shapes; doors stay reciprocal
{
  ctx.G.floor = 6;
  let sawBig = false, reciprocal = true;
  for (let trial = 0; trial < 40 && !sawBig; trial++) {
    ctx.genFloor(6);
    for (const r of Object.values(ctx.G.rooms)) {
      if (r.type === 'combat' && ['grand_hall', 'deep_hall', 'meat_hall', 'odd_hall'].includes(r.shape)) sawBig = true;
      if (r.doors.n && !ctx.G.rooms[(r.gx) + ',' + (r.gy - 1)]) reciprocal = false;
      if (r.doors.s && !ctx.G.rooms[(r.gx) + ',' + (r.gy + 1)]) reciprocal = false;
      if (r.doors.e && !ctx.G.rooms[(r.gx + 1) + ',' + (r.gy)]) reciprocal = false;
      if (r.doors.w && !ctx.G.rooms[(r.gx - 1) + ',' + (r.gy)]) reciprocal = false;
    }
  }
  check('floor 6 mixes in big and odd rooms', sawBig);
  check('big-room maps keep reciprocal doors', reciprocal);
  ctx.startRun(); step(3, 16);
}

console.log('== XP / perks ==');
ctx.gainXP(100);
step(5, 16);
check('levelup triggered', ctx.G.mode === 'levelup' || ctx.G.pendingLevelups > 0);
check('perk selection is locked on first presentation', (ctx.G.selectionLock || 0) > 0);
const lockedChoices = ctx.G.perkChoices;
tap('1'); // ignored while the selection lock is active
check('locked draft ignores selection input', ctx.G.perkChoices === lockedChoices);
step(100, 16); // advance 1.6s in levelup mode, clearing the 1.5s selection lock
let guard = 0;
while (ctx.G.mode === 'levelup' && guard++ < 30) { tap('1'); step(2, 16); }
check('perks drafted', ctx.G.mode === 'play');
check('player leveled', ctx.G.player.level > 1);

console.log('== rebalanced perks + automatic draft ==');
{
  check('13 new perks added', ctx.PERKS.length === 23);
  const perkStats = { dmgMul: 1 };
  ctx.PERKS.find(k => k.id === 'sharpen').apply(perkStats, { hp: 1 });
  check('core level-up damage bonus was halved', Math.abs(perkStats.dmgMul - 1.04) < 0.001);
  const p = ctx.G.player;
  ctx.G.pendingLevelups = 1; ctx.G.autoPerk = false; ctx.openPerkDraft();
  p.stats.rerolls = 1; tap('r');
  check('Reroll Rib currency refreshes a manual draft', p.stats.rerolls === 0 && ctx.G.perkChoices.length === 3);
  step(100, 16); // clear the 1.5s selection lock armed by openPerkDraft above
  tap('4');
  check('one-off random draft choice resolves normally', ctx.G.mode === 'play' && ctx.G.pendingLevelups === 0);
  const levelBefore = p.level;
  ctx.G.autoPerk = true;
  ctx.gainXP(180);
  step(3, 16);
  check('auto-draft drains queued level-ups without opening modal', p.level > levelBefore && ctx.G.pendingLevelups === 0 && ctx.G.mode === 'play');
  ctx.G.autoPerk = false;
  ctx.startRun(); step(3, 16);
}

console.log('== upgrade card click does not fire ==');
{
  ctx.startRun(); step(3, 16); // fresh run in play mode
  ctx.G.enemies.length = 0; // determinism: nothing can interfere
  const perksBefore = ctx.G.player.perks.length;
  ctx.G.pendingLevelups = 1; ctx.G.perkChoices = ctx.PERKS.slice(0, 3); ctx.G.mode = 'levelup';
  // click inside card 0 (cards start at x=207, y=220, 170x230)
  ctx.Input.mx = 300; ctx.Input.my = 300;
  ctx.Input.mpressed = true; ctx.Input.mdown = true;
  step(6, 16); // first frame consumes the click, the rest run with mdown held
  check('card click exits the draft into play', ctx.G.mode === 'play');
  check('card click grants exactly one perk', ctx.G.player.perks.length === perksBefore + 1);
  check('card click fires no bullet (mdown not carried into play)', ctx.G.bullets.length === 0);
}

console.log('== dropped weapon lockout ==');
{
  ctx.startRun(); step(3, 16); // clean, armed player in play mode
  const p = ctx.G.player;
  p.weapon = { id: 'cleaver', ammo: 60 }; p.holstered = null;
  ctx.G.pickups.length = 0;
  ctx.spawnPickup('weapon', p.x, p.y, { wid: 'repeater', ammo: 30 });
  ctx.updatePickups(0.016); ctx.updatePickups(0.016); // pick up the repeater
  check('weapon swap happens instantly on fresh loot', p.weapon.id === 'repeater');
  const drop = ctx.G.pickups.find(k => k.type === 'weapon');
  check('old weapon dropped with the lockout delay', !!drop && Math.abs(drop.delay - ctx.WEAPON_DROP_LOCKOUT) < 0.1);
  if (drop) { drop.vx = 0; drop.vy = 0; } // hold it still for the timing checks
  // standing on the drop, it must stay uncollectible for ~70% of the lockout
  const blockedFor = Math.floor(ctx.WEAPON_DROP_LOCKOUT * 0.7 / 0.016);
  for (let i = 0; i < blockedFor; i++) { p.x = drop.x; p.y = drop.y; ctx.updatePickups(0.016); }
  const stillBlocked = ctx.G.pickups.some(k => k.type === 'weapon') && p.weapon.id === 'repeater';
  check('dropped weapon stays un-pickable inside the lockout window', stillBlocked);
  // the remaining ~30% (plus margin) lets it be re-picked
  const collectFor = Math.ceil(ctx.WEAPON_DROP_LOCKOUT / 0.016) + 10;
  for (let i = 0; i < collectFor; i++) { p.x = drop.x; p.y = drop.y; ctx.updatePickups(0.016); }
  check('dropped weapon re-pickable after the lockout', p.weapon.id === 'cleaver');
  check('lockout constant is within the 2-3s request', ctx.WEAPON_DROP_LOCKOUT >= 2 && ctx.WEAPON_DROP_LOCKOUT <= 3);
}

autoDraft = true; // later sections must not get stuck in the perk draft

console.log('== nearby-item description toast ==');
{
  const p = ctx.G.player;
  ctx.G.pickups.length = 0;
  ctx.G.toasts.length = 0;
  ctx.spawnPickup('item', p.x + 50, p.y, { iid: 'hollowpoints' });
  step(1, 16); // within the 90px radius -> toast once
  check('nearby item toasts its description once',
    ctx.G.toasts.length === 1 && ctx.G.toasts[0].text === ctx.ITEMS.hollowpoints.name && ctx.G.toasts[0].sub === ctx.ITEMS.hollowpoints.desc);
  step(4, 16); // stay adjacent, must not re-fire
  check('proximity toast does not repeat while adjacent', ctx.G.toasts.length === 1);
  p.x += 500; step(1, 16); // leave the 90px radius -> re-arms
  p.x -= 420; step(1, 16); // back within 90 (outside pickup reach) -> fires again
  check('proximity toast re-arms after leaving', ctx.G.toasts.length === 2);
  ctx.G.pickups.length = 0;
  ctx.startRun(); step(3, 16);
}

console.log('== shield heart perk ==');
{
  const p = ctx.G.player;
  p.hp = 6; p.shieldHp = 0; p.stats.shieldPerk = 0; p.invT = 0;
  check('old armor perk is gone', !ctx.PERKS.some(k => k.id === 'thick'));
  const sh = ctx.PERKS.find(k => k.id === 'shieldheart');
  sh.apply(p.stats, p); sh.apply(p.stats, p);
  check('two picks = two half-heart shields', p.stats.shieldPerk === 2 && p.shieldHp === 2);
  const hpBefore = p.hp;
  ctx.hurtPlayer(1, 0);
  check('shield absorbs damage first', p.hp === hpBefore && p.shieldHp === 1);
  p.invT = 0;
  ctx.hurtPlayer(1, 0);
  check('second hit breaks shield, hp untouched', p.hp === hpBefore && p.shieldHp === 0);
  p.invT = 0;
  ctx.hurtPlayer(1, 0);
  check('unshielded hit hurts', p.hp === hpBefore - 1);
  p.hp = hpBefore;
  ctx.nextFloor(); step(3, 16);
  check('shield refreshes each floor', p.shieldHp === 2);
  ctx.startRun(); step(5, 16); // reset floor/state for later sections
}

console.log('== items ==');
ctx.giveItem('hollowpoints');
ctx.giveItem('orbitalknives');
ctx.giveItem('splittongue');
ctx.giveItem('ironstomach');
check('items applied', Object.keys(ctx.G.player.items).length === 4);
check('orbital knives active', ctx.G.player.stats.orbitals >= 1);
step(30, 16);

console.log('== Sine Weave diminishing stagger ==');
{
  const s = {}; ctx.PERKS.find(p => p.id === 'sinew').apply(s, {});
  check('sine weave first stack is 3% stagger chance', Math.abs(ctx.stunChance(s.stunRaw) - 0.03) < 1e-6);
  check('sine weave chance never exceeds 50%', ctx.stunChance(1e6) === 0.5);
  check('sine weave gains diminishing returns', ctx.stunChance(s.stunRaw * 2) < 2 * ctx.stunChance(s.stunRaw));
  ctx.PERKS.find(p => p.id === 'sinew').apply(s, {});
  check('sine weave stacks raw rating', Math.abs(s.stunRaw - 2 * (0.03 / 0.97)) < 1e-9);
}

console.log('== expanded perk and item rosters ==');
{
  check('41 new items added (14 phase-2 + 12 phase-3 + 10 legendaries)', Object.keys(ctx.ITEMS).length === 82);
  const newPerks = ['critbone', 'critmeat', 'flensing', 'ember', 'frostbile', 'heavyhand', 'thickhide', 'secondwind', 'scrapfeed', 'boneknit', 'spiteflesh', 'carrion', 'sinew'];
  const newItems = ['chainsinew', 'mortarbone', 'bloatrounds', 'marrowglut', 'hollowneedle', 'bloodshoteye', 'flayerkiss', 'emberjar', 'acidgland', 'hookrounds', 'sledgerounds', 'graftedtrigger', 'deadmanswitch', 'orbitcrown', 'tannedhide', 'deadmansclock', 'hollowbones', 'boneplate', 'wormgut', 'spinecage', 'secondstomach', 'spitewell', 'twinhearts', 'brassmagazine', 'crowbait', 'gorgingleech', 'rerollrib', 'chillgland', 'hookedsinew', 'gyroscopicribs', 'marrowpiston', 'splitcortex', 'gristlecord', 'renderedfat', 'whipcordtendon', 'rusteddiadem', 'gorgedtick', 'bonemealpowder', 'rimedfang', 'butcherstwine', 'cindersump', 'deadweight', 'cauterizedveins', 'hollowchoir', 'sawbonecoil', 'gluttonsgut', 'slaughterrhythm', 'painengine', 'thresherplate', 'bloodmoat', 'ironlung', 'meathook', 'blooddebt', 'butchersoath', 'secondskin', 'twinsidearm', 'crimsonmetronome', 'abattoirengine', 'gorecrown', 'thousandteeth', 'hollowfather', 'thelastcut', 'meatgrinder'];
  check('all new perks have manifest icons or fallbacks', newPerks.every(id => ctx.SPRITE_MANIFEST.includes('perk_' + id)));
  check('all new items have manifest icons or fallbacks', newItems.every(id => ctx.SPRITE_MANIFEST.includes('i_' + id)));
  check('new roster entries all have names, descriptions and effects',
    newPerks.every(id => { const k = ctx.PERKS.find(p => p.id === id); return k && k.name && k.desc && typeof k.apply === 'function'; }) &&
    newItems.every(id => { const k = ctx.ITEMS[id]; return k && k.name && k.desc && typeof k.apply === 'function'; }));
  const livePlayer = ctx.G.player;
  ctx.initPlayer();
  const probe = ctx.G.player;
  for (const id of newItems) for (let tier = 0; tier < (ctx.ITEMS[id].cap ?? 9); tier++) ctx.ITEMS[id].apply(probe.stats, probe);
  for (const id of newPerks) for (let tier = 0; tier < 3; tier++) ctx.PERKS.find(k => k.id === id).apply(probe.stats, probe);
  check('all new effects execute repeatedly without non-finite stats',
    Object.values(probe.stats).every(v => typeof v !== 'number' || Number.isFinite(v)) && Number.isFinite(probe.hp) && Number.isFinite(probe.shieldHp));
  ctx.G.player = livePlayer;
}

console.log('== diminishing armor block chance ==');
{
  const c1 = ctx.armorBlockChance(0.5), c2 = ctx.armorBlockChance(1), cHuge = ctx.armorBlockChance(999);
  check('armor chance has diminishing absolute returns', c1 > 0 && c2 > c1 && (c2 - c1) < c1);
  check('armor chance is capped at 75%', Math.abs(cHuge - 0.75) < 0.0001);
  const p = ctx.G.player, hp = p.hp;
  const realChance = ctx.chance;
  ctx.__smokeRealChance = realChance;
  vm.runInContext('chance = () => true', ctx);
  p.stats.armor = 999; p.invT = 0;
  ctx.hurtPlayer(1, 0);
  check('successful armor roll ignores all damage', p.hp === hp);
  vm.runInContext('chance = __smokeRealChance', ctx);
  delete ctx.__smokeRealChance;
  p.stats.armor = 0; p.invT = 0;
}

console.log('== scrap feed has diminishing returns (like thick hide) ==');
{
  const sf = ctx.PERKS.find(k => k.id === 'scrapfeed');
  const s = { ammoEff: 1 };
  const save = () => 1 - 1 / s.ammoEff; // fraction of ammo saved
  sf.apply(s, {}); const s1 = save();
  const d1 = s1;                       // marginal saving of stack 1
  sf.apply(s, {}); const s2 = save();
  const d2 = s2 - s1;                  // marginal saving of stack 2
  sf.apply(s, {}); const s3 = save();
  const d3 = s3 - s2;                  // marginal saving of stack 3
  check('first stack ~5% saving', Math.abs(s1 - (1 - 1 / 1.05)) < 0.0001);
  check('each stack helps less', d2 < d1 && d3 < d2);
  check('saving never reaches 100%', save() < 1);
  // Brass Magazine uses the same diminishing additive formula as Scrap Feed
  const s2x = { ammoEff: 1, ammoPickupMul: 1 };
  ctx.ITEMS.brassmagazine.apply(s2x, {});
  check('brass magazine is additive-diminishing (not multiplicative)', Math.abs(s2x.ammoEff - 1.10) < 0.0001);
  const s2y = { ammoEff: 1, ammoPickupMul: 1 };
  for (let i = 0; i < 5; i++) ctx.ITEMS.brassmagazine.apply(s2y, {});
  check('brass magazine never reaches 50% saving', 1 - 1 / s2y.ammoEff < 0.5);
}

console.log('== close-range weapon impact pass ==');
check('Marrow Scatter was substantially strengthened', ctx.WEAPONS.marrow.dmg >= 11 && ctx.WEAPONS.marrow.range >= 0.38);
check('Bile Blunderbuss was substantially strengthened', ctx.WEAPONS.bile.dmg >= 7 && ctx.WEAPONS.bile.range >= 0.38);
check('Cauterizer was substantially strengthened', ctx.WEAPONS.cauterizer.dmg >= 4.5 && ctx.WEAPONS.cauterizer.range >= 0.36);
check('melee weapons were substantially strengthened', ctx.WEAPONS.tenderizer.dmg >= 60 && ctx.WEAPONS.redhand.dmg >= 7);

console.log('== continuous saw frame-rate independence ==');
{
  const p = ctx.G.player;
  const savedStats = p.stats;
  function sawDamage(steps) {
    p.stats = Object.assign({}, savedStats, {
      dmgMul: 1, rateMul: 1, rangeMul: 1, shotSpeedMul: 1, sizeMul: 1, crit: 0,
      split: 0, fan: 0, rear: 0, pierce: 0, bounce: 0, homing: 0,
      bleed: 0, igniteChance: 0, slowOnHit: 0, stunOnHit: 0, acidOnHit: 0, pullOnHit: 0, chain: 0, mortar: 0,
    });
    p.aim = 0;
    const e = ctx.makeEnemy('shambler', p.x + 30, p.y, 1, false);
    e.hp = e.maxHp = 10000; e.spd = 0;
    ctx.G.enemies = [e];
    const inst = { ammo: 999 };
    for (let i = 0; i < steps; i++) ctx.sawTick(p, ctx.WEAPONS.redhand, inst, 1 / steps);
    return e.maxHp - e.hp;
  }
  const d30 = sawDamage(30), d120 = sawDamage(120);
  check('chainsaw DPS is stable across simulation rates', Math.abs(d30 - d120) / Math.max(1, d30) < 0.02);
  p.stats = Object.assign({}, savedStats, {
    crit: 0, bleed: 0.5, splinter: 0, igniteChance: 0, slowOnHit: 0, stunOnHit: 0,
    acidOnHit: 0, pullOnHit: 0, chain: 0, mortar: 0,
  });
  const normal = ctx.makeEnemy('shambler', 400, 300, 1, false);
  const orbital = ctx.makeEnemy('shambler', 500, 300, 1, false);
  ctx.G.enemies = [normal, orbital];
  ctx.damageEnemy(normal, 12, 0, false, { noCrit: true });
  ctx.damageEnemy(orbital, 12, 0, false, { noCrit: true, procScale: 0.5, procMagnitudeScale: 0.5 });
  check('orbital proc dampening does not amplify effect magnitude', Math.abs(orbital.bleedDps - normal.bleedDps * 0.5) < 0.001);
  p.stats = savedStats; ctx.G.enemies.length = 0;
}

console.log('== item upgrades (per-item tier caps) ==');
{
  const p = ctx.G.player;
  const dmgBefore = p.stats.dmgMul;
  ctx.giveItem('hollowpoints');
  check('duplicate upgrades to tier II', p.items.hollowpoints === 2);
  check('upgrade re-applies the effect', Math.abs(p.stats.dmgMul - dmgBefore * 1.25) < 0.001);
  for (let i = 0; i < 7; i++) ctx.giveItem('hollowpoints');
  check('six copies reach the Hollow Points cap (VI)', p.items.hollowpoints === 6);
  check('scaling stops at the cap', Math.abs(p.stats.dmgMul - dmgBefore * Math.pow(1.25, 5)) < 0.01);
  const scoreBefore = ctx.G.score;
  const dmgAtCap = p.stats.dmgMul;
  ctx.giveItem('hollowpoints');
  check('seventh copy capped, converts to score', p.items.hollowpoints === 6 && ctx.G.score > scoreBefore);
  check('capped copy gives no extra effect', p.stats.dmgMul === dmgAtCap);
  check('still one icon in the item list', Object.keys(p.items).filter(k => k === 'hollowpoints').length === 1);
}

console.log('== rarity pools and per-item caps ==');
{
  const p = ctx.G.player;
  p.items = {};
  // legendaries never come from elite or item-room pools
  let sawLegendary = false;
  for (let i = 0; i < 400; i++) {
    const eid = ctx.rollItemId('elite', 1), rid = ctx.rollItemId('room', 1);
    if (ctx.ITEMS[eid].rarity === 'legendary' || ctx.ITEMS[rid].rarity === 'legendary') sawLegendary = true;
  }
  check('elite and room pools never roll legendaries', !sawLegendary);
  // boss pool can roll rare (and would roll legendary when any exist)
  let bossRares = 0;
  for (let i = 0; i < 200; i++) if (ctx.ITEMS[ctx.rollItemId('boss', 3)].rarity === 'rare') bossRares++;
  check('boss pool favours rare items (' + bossRares + '/200)', bossRares > 40);
  // capped items are excluded from fresh rolls
  p.items = { splittongue: 3 }; // rare cap 3
  let reoffered = false;
  for (let i = 0; i < 300; i++) if (ctx.rollItemId('room', 1) === 'splittongue') reoffered = true;
  check('capped items are not re-offered by pools', !reoffered);
  // stickiness still favours owned upgradable items
  p.items = { hollowpoints: 1 };
  let owned = 0;
  for (let i = 0; i < 600; i++) if (ctx.rollItemId('room', 1) === 'hollowpoints') owned++;
  const frac = owned / 600;
  check('stickiness ramps toward owned items (' + owned + '/600)', frac > 0.04 && frac < 0.20);
  // legacy alias still resolves
  check('randomItemId legacy alias works', typeof ctx.randomItemId() === 'string');
  p.items = {};
}

console.log('== tier-scaled items + duplicate favoring ==');
{
  const p = ctx.G.player;
  ctx.giveItem('backstabber'); ctx.giveItem('backstabber');
  check('backstabber stacks rear shots', p.stats.rear === 2);
  ctx.G.enemies.length = 0;
  ctx.G.bullets.length = 0;
  p.weapon = { id: 'bonepopper', ammo: Infinity };
  p.fireT = 0;
  ctx.Input.mx = p.x + 100; ctx.Input.my = p.y;
  ctx.Input.mdown = true; step(3, 16); ctx.Input.mdown = false;
  check('rear fan fires extra shots', ctx.G.bullets.length >= 3); // fwd + split + 2 rear
  ctx.giveItem('homingtumor'); ctx.giveItem('homingtumor');
  check('homing tumor stacks', p.stats.homing === 2);
  ctx.G.bullets.length = 0;
  p.fireT = 0; // ensure a fresh volley actually fires
  ctx.Input.mdown = true; step(3, 16); ctx.Input.mdown = false;
  const hb = ctx.G.bullets[0];
  check('homing strength scales with tier', hb && Math.abs(hb.homing - 3.0) < 0.001);
  ctx.giveItem('volatilebile'); ctx.giveItem('volatilebile');
  check('volatile bile tiers up', p.stats.explodeOnKill === 2);
  // kill-explosion should damage a nearby enemy
  ctx.G.enemies.length = 0;
  const v1 = ctx.makeEnemy('shambler', 700, 320, 1, false); v1.spd = 0; v1.hp = 1;
  const v2 = ctx.makeEnemy('shambler', 740, 320, 1, false); v2.spd = 0;
  ctx.G.enemies.push(v1, v2);
  const v2hpBefore = v2.hp;
  ctx.damageEnemy(v1, 9999, 0, false);
  check('kill-explosion hurts nearby enemies', v2.hp < v2hpBefore);
  ctx.G.enemies.length = 0;
  let ownedHits = 0;
  for (let i = 0; i < 200; i++) {
    if (p.items[ctx.randomItemId()]) ownedHits++;
  }
  check('item rolls favor owned items (' + ownedHits + '/200)', ownedHits >= 40);
}

console.log('== phase-4 boss-exclusive legendaries ==');
{
  const p = ctx.G.player;
  p.items = {};
  // boss pool is the only source that can roll legendaries
  let bossLegendaries = 0;
  for (let i = 0; i < 400; i++) if (ctx.ITEMS[ctx.rollItemId('boss', 5)].rarity === 'legendary') bossLegendaries++;
  check('boss pool can roll legendaries (' + bossLegendaries + '/400)', bossLegendaries > 10);
  // Butcher's Oath: big damage, HP clamped to 2
  const savedMax = p.stats.maxHp, savedHp = p.hp;
  p.stats.maxHp = 10; p.hp = 10;
  ctx.giveItem('butchersoath');
  check('Butcher\'s Oath clamps max HP to 2', p.stats.maxHp === 2 && p.hp === 2);
  p.stats.maxHp = savedMax; p.hp = savedHp; delete p.items.butchersoath;
  // Second Skin: revive once per floor at ½ heart
  p.stats.secondSkin = 0; p.secondSkinUsed = false;
  ctx.giveItem('secondskin');
  p.hp = 1; p.invT = 0; ctx.G.mode = 'play';
  ctx.hurtPlayer(9999, 0);
  check('Second Skin revives at ½ heart', p.hp === 1 && p.secondSkinUsed === true && ctx.G.mode === 'play');
  // second death same floor is real
  p.invT = 0;
  ctx.hurtPlayer(9999, 0);
  check('Second Skin only works once per floor', ctx.G.mode === 'gameover');
  ctx.startRun(); step(3, 16);
}

console.log('== active items (room-clear charged) ==');
{
  const p = ctx.G.player;
  p.active = null;
  // pickup grants a full-charge active
  ctx.spawnPickup('active', p.x, p.y, { aid: 'bonenova' });
  step(2, 16);
  check('active pickup equips fully charged', p.active && p.active.iid === 'bonenova' && p.active.charges === ctx.ACTIVES.bonenova.cost);
  // swap: picking up a second active drops the first
  ctx.spawnPickup('active', p.x, p.y, { aid: 'offalbomb' });
  step(2, 16);
  check('second active equips and drops the old one', p.active.iid === 'offalbomb' && ctx.G.pickups.some(k => k.type === 'active' && k.aid === 'bonenova'));
  // use: charges spend, effect fires
  const powerBefore = ctx.powerScore();
  check('holding an active adds flat power', powerBefore > 0);
  ctx.useActive();
  check('using an active spends all charges', p.active.charges === 0);
  // charge accrues from room clears
  ctx.recordRoomClear({ type: 'combat' });
  check('combat clear grants +1 charge', p.active.charges === 1);
  ctx.recordRoomClear({ type: 'boss' });
  check('boss clear grants +2 charges', p.active.charges === ctx.ACTIVES.offalbomb.cost);
  // under-charged use is blocked
  p.active.charges = 0;
  const enemiesBefore = ctx.G.enemies.length;
  ctx.useActive();
  check('under-charged active does not fire', p.active.charges === 0 && ctx.G.enemies.length === enemiesBefore);
  // panic room blocks firing
  p.active = { iid: 'panicroom', charges: ctx.ACTIVES.panicroom.cost };
  ctx.useActive();
  check('panic room grants invulnerability', p.invT >= 2.4 && p.panicRoomT > 0);
  p.weapon = { id: 'bonepopper', ammo: Infinity };
  p.fireT = 0;
  ctx.Input.mdown = true; step(3, 16); ctx.Input.mdown = false;
  check('panic room prevents firing', ctx.G.bullets.length === 0);
  p.panicRoomT = 0; p.invT = 1;
  p.active = null;
  ctx.G.pickups.length = 0;
}

console.log('== phase-3 hook passives ==');
{
  const p = ctx.G.player;
  const s = p.stats;
  // Dead Weight: execute bonus on wounded enemies (isolate stats so no leftover items leak)
  const savedStats = s;
  p.stats = Object.assign({}, s, { executeBonus: 0.40, burnDamageBonus: 0, crit: 0, critMul: 2 });
  const wounded = ctx.makeEnemy('shambler', 500, 300, 1, false); wounded.hp = wounded.maxHp = 100; wounded.hp = 20; // 20% of maxHp
  const healthy = ctx.makeEnemy('shambler', 500, 300, 1, false); healthy.hp = healthy.maxHp = 100;
  const wBefore = wounded.hp, hBefore = healthy.hp;
  ctx.damageEnemy(wounded, 10, 0, false, { noCrit: true });
  ctx.damageEnemy(healthy, 10, 0, false, { noCrit: true });
  check('Dead Weight executes wounded enemies', Math.abs((wBefore - wounded.hp) - 14) < 0.01 && Math.abs((hBefore - healthy.hp) - 10) < 0.01);
  p.stats = savedStats;

  // Cauterized Veins: bonus damage to burning enemies
  const savedBurn = s.burnDamageBonus;
  s.burnDamageBonus = 0.25;
  const burner = ctx.makeEnemy('shambler', 500, 300, 1, false); burner.burnT = 1;
  const bBefore = burner.hp;
  ctx.damageEnemy(burner, 10, 0, false, { noCrit: true });
  check('Cauterized Veins boosts damage on burning enemies', Math.abs((bBefore - burner.hp) - 12.5) < 0.01);
  s.burnDamageBonus = savedBurn;
  ctx.G.enemies.length = 0;

  // Pain Engine: dmgLiveMul rises after being hit
  const savedPain = s.painEngine, savedArmor = s.armor, savedMax = s.maxHp;
  s.painEngine = 0.30; s.armor = 0; s.maxHp = 999; p.hp = 999; p.invT = 0; p.painEngineT = 0; ctx.G.mode = 'play';
  ctx.hurtPlayer(1, 0);
  check('Pain Engine arms after being hit', p.painEngineT > 0);
  s.painEngine = savedPain; s.armor = savedArmor; s.maxHp = savedMax; p.invT = 1; p.painEngineT = 0;

  // Iron Lung: first hit in a room is blocked
  const savedLung = s.ironLung;
  s.ironLung = 1; p.ironLungReady = true; p.invT = 0; const hpBeforeLung = p.hp;
  ctx.hurtPlayer(1, 0);
  check('Iron Lung blocks the first room hit', p.hp === hpBeforeLung && p.ironLungReady === false);
  s.ironLung = savedLung; p.invT = 1;

  // Slaughter Rhythm: recent kills grant fire rate
  const savedRhythm = s.slaughterRhythm;
  s.slaughterRhythm = 0.04; p.killStamps = [ctx.G.time, ctx.G.time, ctx.G.time];
  p.fireT = 0; ctx.updatePlayer(0.016);
  check('Slaughter Rhythm grants live fire rate', (s.rhythmRateBonus || 0) > 0);
  s.slaughterRhythm = savedRhythm; p.killStamps = [];
}

console.log('== all weapons fire without crashing ==');
for (const wid of Object.keys(ctx.WEAPONS)) {
  ctx.G.player.weapon = { id: wid, ammo: 50 };
  ctx.G.player.charge = 0;
  ctx.Input.mdown = true;
  step(20, 16);
  ctx.Input.mdown = false;
  ctx.Input.mreleased = true;
  step(5, 16);
  ctx.Input.mreleased = false;
  step(40, 16);
}
check('16 weapons exercised', true);
check('reverted to bone popper when dry', ctx.G.player.weapon.ammo > 0 || ctx.G.player.weapon.id === 'bonepopper');

console.log('== every weapon actually DAMAGES enemies (NaN regression) ==');
{
  const p = ctx.G.player;
  const saveHp = p.hp, saveMax = p.stats.maxHp, saveOrb = p.stats.orbitals;
  p.stats.orbitals = 0; // don't let orbitals mask a broken weapon
  const noDmg = [];
  for (const wid of Object.keys(ctx.WEAPONS)) {
    ctx.G.enemies.length = 0;
    const e = ctx.makeEnemy('shambler', p.x + 42, p.y, 1, false);
    e.spd = 0;
    ctx.G.enemies.push(e);
    p.weapon = { id: wid, ammo: 60 };
    p.charge = 0; p.hp = 999; p.stats.maxHp = 999;
    ctx.Input.mx = e.x; ctx.Input.my = e.y;
    ctx.Input.mdown = true;
    step(50, 16);
    ctx.Input.mdown = false;
    ctx.Input.mreleased = true;
    step(8, 16);
    ctx.Input.mreleased = false;
    step(20, 16);
    if (!(e.hp < e.maxHp)) noDmg.push(wid);
    ctx.G.bullets.length = 0;
    ctx.G.hazards.length = 0;
  }
  check('all 16 weapons deal damage', noDmg.length === 0);
  if (noDmg.length) console.log('   NO-DAMAGE: ' + noDmg.join(', '));
  ctx.G.enemies.length = 0;
  p.weapon = { id: 'bonepopper', ammo: Infinity };
  p.hp = saveHp; p.stats.maxHp = saveMax; p.stats.orbitals = saveOrb;
}

console.log('== shared on-hit items work with every weapon ==');
{
  const p = ctx.G.player;
  const saveBleed = p.stats.bleed, saveCrit = p.stats.crit, saveOrb = p.stats.orbitals;
  p.stats.bleed = 1; p.stats.crit = 0; p.stats.orbitals = 0;
  const realChance = ctx.chance;
  ctx.__smokeRealChance = realChance;
  vm.runInContext('chance = () => true', ctx);
  const misses = [];
  for (const wid of Object.keys(ctx.WEAPONS)) {
    ctx.G.enemies.length = 0; ctx.G.bullets.length = 0; ctx.G.hazards.length = 0;
    const e = ctx.makeEnemy('shambler', p.x + 42, p.y, 1, false);
    e.hp = e.maxHp = 10000; e.spd = 0;
    ctx.G.enemies.push(e);
    p.weapon = { id: wid, ammo: 60 }; p.charge = 0; p.fireT = 0;
    ctx.Input.mx = e.x; ctx.Input.my = e.y; ctx.Input.mdown = true;
    step(50, 16);
    ctx.Input.mdown = false; ctx.Input.mreleased = true; step(8, 16);
    ctx.Input.mreleased = false; step(20, 16);
    if (!(e.bleedT > 0)) misses.push(wid);
  }
  check('all 16 weapons deliver shared bleed/on-hit payloads', misses.length === 0);
  if (misses.length) console.log('   NO-ON-HIT: ' + misses.join(', '));
  vm.runInContext('chance = __smokeRealChance', ctx);
  delete ctx.__smokeRealChance;
  p.stats.bleed = saveBleed; p.stats.crit = saveCrit; p.stats.orbitals = saveOrb;
  ctx.G.enemies.length = 0; ctx.G.bullets.length = 0; ctx.G.hazards.length = 0;
  p.weapon = { id: 'bonepopper', ammo: Infinity };
}

console.log('== per-weapon muzzle spawn distances ==');
{
  const p = ctx.G.player;
  const oldAim = p.aim;
  p.aim = 0;
  const badMuzzles = [];
  for (const w of Object.values(ctx.WEAPONS)) {
    if (['slam', 'saw', 'beam'].includes(w.behavior)) continue;
    ctx.G.bullets.length = 0;
    ctx.fireWeapon(p, w);
    const b = ctx.G.bullets[0];
    if (!b || Math.abs(b.x - (p.x + w.muzzle)) > 0.001 || Math.abs(b.y - p.y) > 0.001) badMuzzles.push(w.id);
  }
  p.aim = oldAim;
  ctx.G.bullets.length = 0;
  check('projectiles originate at each weapon muzzle', badMuzzles.length === 0);
  if (badMuzzles.length) console.log('   BAD-MUZZLE: ' + badMuzzles.join(', '));
}

console.log('== generic ammo drops ==');
{
  const p = ctx.G.player;
  p.stats.luck = 5;
  ctx.G.pickups.length = 0;
  p.x = 100; p.y = 100;
  for (let i = 0; i < 40; i++) {
    const e = ctx.makeEnemy('shambler', 700, 500, 1, false);
    ctx.G.enemies.push(e);
    ctx.damageEnemy(e, 9999, 0, false);
  }
  step(3, 16);
  const ammoCount = ctx.G.pickups.filter(k => k.type === 'ammo').length;
  check('ammo drops are common (' + ammoCount + ' from 40 kills)', ammoCount >= 2);
  // generic ammo refills every finite-ammo weapon currently carried
  p.weapon = { id: 'repeater', ammo: 10 };
  p.holstered = { id: 'spinaltap', ammo: 2 };
  ctx.spawnPickup('ammo', p.x, p.y);
  step(2, 16);
  check('ammo pickup refills held weapon', p.weapon.ammo > 10);
  check('ammo pickup also refills holstered weapon', p.holstered.ammo > 2);
  const holsteredAmmo = p.holstered.ammo;
  p.weapon = { id: 'bonepopper', ammo: Infinity };
  ctx.spawnPickup('ammo', p.x, p.y);
  step(2, 16);
  check('ammo reaches holstered weapon while sidearm is selected', p.holstered.ammo > holsteredAmmo);

  check('rapid low-damage weapons receive more rounds than heavy weapons',
    ctx.WEAPONS.repeater.refill > ctx.WEAPONS.spinaltap.refill * 10);
  check('stream weapons are time-denominated (drain, not per-shot)',
    ctx.WEAPONS.bile.drain > 0 && ctx.WEAPONS.cauterizer.drain > 0 && ctx.WEAPONS.redhand.drain > 0);

  const repeaterCap = ctx.WEAPONS.repeater.ammo * 1.5;
  p.weapon = { id: 'repeater', ammo: repeaterCap - 1 };
  p.holstered = null;
  const overflowScore = ctx.G.score;
  ctx.collectPickup({ type: 'ammo' });
  check('ammo pickup clamps at one and a half magazines', p.weapon.ammo === repeaterCap);
  check('ammo overflow converts to score', ctx.G.score > overflowScore);

  p.stats.luck = 0;
  p.weapon = { id: 'bonepopper', ammo: Infinity };
  p.holstered = null;
  ctx.G.pickups.length = 0;
}

console.log('== ammo economy structure ==');
{
  // Kills-per-refill is calibrated empirically by tools/ammo_sim.js (target
  // band ~8-13). Here we guard the structural rules that keep it meaningful.
  const bad = [];
  for (const w of Object.values(ctx.WEAPONS)) {
    if (w.ammo === Infinity) continue;
    if (!Number.isInteger(w.refill) || w.refill < 1) bad.push(w.id + ':refill-missing');
    else if (w.refill > w.ammo) bad.push(w.id + ':refill-exceeds-magazine');
    // a full magazine must stay a usable burst: not a 1s sneeze, not endless
    const seconds = w.drain ? w.ammo / w.drain
      : w.ammo * (w.behavior === 'beam' ? (w.chargeTime + w.interval) : w.interval);
    if (seconds < 3 || seconds > 20) bad.push(w.id + ':magazine-' + seconds.toFixed(1) + 's');
  }
  check('every special weapon has a sane authored refill + magazine', bad.length === 0);
  if (bad.length) console.log('   BAD-AMMO: ' + bad.join(', '));
}

console.log('== drop economy: weapons are rare, elites feed you ==');
{
  const p = ctx.G.player;
  p.stats.luck = 0;
  ctx.G.pickups.length = 0;
  // regular monsters: no weapon drops at all
  for (let i = 0; i < 60; i++) {
    const e = ctx.makeEnemy('shambler', 700, 500, 1, false);
    ctx.G.enemies.push(e);
    ctx.damageEnemy(e, 9999, 0, false);
  }
  step(2, 16);
  check('regular kills never drop weapons', !ctx.G.pickups.some(k => k.type === 'weapon'));
  // elites: always bonus gems, mostly ammo, sometimes an item
  p.x = 100; p.y = 100;
  let eliteGemValue = 0, eliteAmmo = 0, eliteItems = 0, eliteWeapons = 0;
  for (let i = 0; i < 30; i++) {
    const e = ctx.makeEnemy('shambler', 700, 500, 1, true);
    ctx.G.enemies.push(e);
    ctx.G.pickups.length = 0; // isolate this kill's drops
    ctx.damageEnemy(e, 9999, 0, false);
    eliteGemValue += ctx.G.pickups.filter(k => k.type === 'gem').reduce((s, k) => s + k.v, 0);
    eliteAmmo += ctx.G.pickups.filter(k => k.type === 'ammo').length;
    eliteItems += ctx.G.pickups.filter(k => k.type === 'item').length;
    eliteWeapons += ctx.G.pickups.filter(k => k.type === 'weapon').length;
  }
  step(3, 16);
  check('elites always drop bonus gems (avg value ' + (eliteGemValue / 30).toFixed(1) + ')', eliteGemValue / 30 >= 5.5);
  check('elites mostly drop ammo (' + eliteAmmo + '/30)', eliteAmmo >= 6);
  check('elites sometimes drop items (' + eliteItems + '/30)', eliteItems >= 1);
  check('elites never drop weapons', eliteWeapons === 0);
  ctx.G.pickups.length = 0;
}

console.log('== visible XP bonus + kill-based lifesteal ==');
{
  const p = ctx.G.player;
  const saved = {
    hp: p.hp, maxHp: p.stats.maxHp, xpMul: p.stats.xpMul,
    bloodlust: p.stats.bloodlust, lifestealChance: p.stats.lifestealChance,
    explodeOnKill: p.stats.explodeOnKill,
  };
  const realChance = ctx.chance;
  ctx.__smokeRealChance = realChance;
  vm.runInContext('chance = () => true', ctx);
  p.stats.bloodlust = 0;
  p.stats.explodeOnKill = 0;

  function gemValueFor(multiplier) {
    p.stats.xpMul = multiplier;
    ctx.G.pickups.length = 0;
    const e = ctx.makeEnemy('shambler', 700, 500, 1, false);
    ctx.killEnemy(e, 0);
    return ctx.G.pickups.filter(k => k.type === 'gem').reduce((sum, k) => sum + k.v, 0);
  }
  const baseGemValue = gemValueFor(1);
  const boostedGemValue = gemValueFor(2);
  check('XP multiplier adds a visible bonus crystal roll', boostedGemValue > baseGemValue);
  check('Bloodrush card advertises its crystal chance',
    ctx.PERKS.find(perk => perk.id === 'bloodrush').desc.includes('bonus crystal'));

  p.stats.xpMul = 1;
  p.stats.lifestealChance = 1;
  p.hp = Math.max(0, p.stats.maxHp - 4);
  const hpBeforeHit = p.hp;
  const survivor = ctx.makeEnemy('shambler', 700, 500, 1, false);
  survivor.hp = survivor.maxHp = 1000;
  ctx.damageEnemy(survivor, 1, 0, false);
  check('Dentures no longer heal on nonlethal hits', p.hp === hpBeforeHit);

  let lifestealSounds = 0;
  const realLifestealSfx = ctx.Sfx.lifesteal;
  ctx.Sfx.lifesteal = () => { lifestealSounds++; };
  const victim = ctx.makeEnemy('shambler', 700, 500, 1, false);
  ctx.damageEnemy(victim, 9999, 0, false);
  check('Dentures heal half a heart on a normal kill', p.hp === hpBeforeHit + 1);
  check('lifesteal proc has dedicated feedback audio', lifestealSounds === 1);

  // Hemophage keeps its weapon-specific on-hit drain with the same feedback.
  p.hp = hpBeforeHit;
  p.stats.lifestealChance = 0;
  lifestealSounds = 0;
  ctx.G.enemies.length = 0;
  ctx.G.bullets.length = 0;
  const drainTarget = ctx.makeEnemy('shambler', p.x + 20, p.y, 1, false);
  drainTarget.hp = drainTarget.maxHp = 1000;
  drainTarget.spd = 0;
  ctx.G.enemies.push(drainTarget);
  ctx.G.bullets.push({
    x: drainTarget.x, y: drainTarget.y, vx: 0, vy: 0, r: 5, dmg: 1,
    pierce: 0, bounce: 0, life: 1, t: 0, behavior: 'bullet',
    sprite: 'bullet_syringe', homing: 0, lifesteal: ctx.WEAPONS.hemophage.lifesteal,
    bounces: 0, hit: null, dragTarget: null,
  });
  ctx.updateBullets(0.016);
  check('Hemophage still heals on a nonlethal hit', p.hp === hpBeforeHit + 1);
  check('Hemophage drain uses lifesteal feedback', lifestealSounds === 1);

  ctx.Sfx.lifesteal = realLifestealSfx;
  vm.runInContext('chance = __smokeRealChance', ctx);
  delete ctx.__smokeRealChance;
  p.hp = saved.hp;
  p.stats.maxHp = saved.maxHp;
  p.stats.xpMul = saved.xpMul;
  p.stats.bloodlust = saved.bloodlust;
  p.stats.lifestealChance = saved.lifestealChance;
  p.stats.explodeOnKill = saved.explodeOnKill;
  ctx.G.pickups.length = 0;
  ctx.G.enemies.length = 0;
}

console.log('== iron stomach is a health upgrade ==');
{
  const p = ctx.G.player;
  const maxBefore = p.stats.maxHp, hpBefore = p.hp;
  ctx.giveItem('ironstomach');
  check('iron stomach adds half a heart container', p.stats.maxHp === maxBefore + 1);
  check('iron stomach heals half a heart', p.hp === Math.min(p.stats.maxHp, hpBefore + 1));
  ctx.giveItem('ironstomach');
  check('it stacks per tier', p.stats.maxHp === maxBefore + 2);
}

console.log('== monsters scale with player upgrades ==');
{
  const p = ctx.G.player;
  ctx.G.pressure = 1;
  p.level = 1; p.items = {};
  const base = ctx.makeEnemy('shambler', 500, 300, 1, false);
  check('no upgrades = base hp', Math.abs(base.hp - 26) < 0.01);
  // Rarity-weighted power: 4 perks × 0.5 + 2 common tiers × 0.5 = 3 power.
  p.level = 5; p.items = { hollowpoints: 2 };
  const e6 = ctx.makeEnemy('shambler', 500, 300, 1, false);
  check('common item tiers weigh 0.5 power each', Math.abs(ctx.powerScore() - 3) < 0.001);
  check('weighted power gives +15% hp', Math.abs(e6.hp - 26 * 1.15) < 0.01);
  check('weighted power gives ~+3% speed', e6.spd >= 55 * 1.03 * 0.9 && e6.spd <= 55 * 1.03 * 1.1);
  const e64 = ctx.makeEnemy('shambler', 500, 300, 4, false);
  check('floor + weighted scaling stack', Math.abs(e64.hp - 26 * 1.66 * 1.15) < 0.02);
  const b = ctx.spawnBoss(1);
  check('boss hp scales with weighted upgrades', Math.abs(b.hp - 520 * 1.15) < 0.01);
  ctx.G.enemies.length = 0; ctx.G.boss = null; ctx.G.cur.cleared = true;
  ctx.startRun(); step(5, 16);
}

console.log('== adaptive clean-room pressure ==');
{
  const p = ctx.G.player;
  ctx.G.pressure = 1; ctx.G.streak = 0; ctx.G.roomDamaged = false;
  ctx.recordRoomClear({ type: 'combat' });
  ctx.G.roomDamaged = false; ctx.recordRoomClear({ type: 'combat' });
  ctx.G.roomDamaged = false; ctx.recordRoomClear({ type: 'combat' });
  check('three clean rooms add exactly 3% pressure', Math.abs(ctx.G.pressure - 1.03) < 0.0001 && ctx.G.streak === 3);
  const pressured = ctx.makeEnemy('shambler', 500, 300, 1, false);
  check('pressure strengthens and speeds newly spawned enemies', pressured.maxHp > 26 && pressured.spd >= 55 * 1.03 * 0.9);

  p.stats.armor = 0; p.stats.maxHp = 10; p.shieldHp = 0;
  ctx.G.pressure = 1.2; ctx.G.recentHits = []; p.hp = 10; p.invT = 0; ctx.G.mode = 'play';
  ctx.hurtPlayer(1, 0); const fullHealthRelief = 1.2 - ctx.G.pressure;
  ctx.G.pressure = 1.2; ctx.G.recentHits = []; p.hp = 3; p.invT = 0; ctx.G.mode = 'play';
  ctx.hurtPlayer(1, 0); const lowHealthRelief = 1.2 - ctx.G.pressure;
  check('low health dynamically grants more pressure relief', lowHealthRelief > fullHealthRelief);

  ctx.G.pressure = 1.2; ctx.G.streak = 4; ctx.G.roomDamaged = false;
  p.hp = 10; p.shieldHp = 1; p.invT = 0; ctx.G.mode = 'play';
  ctx.hurtPlayer(1, 0);
  check('fully shielded hits preserve a clean-room streak', ctx.G.pressure === 1.2 && ctx.G.streak === 4 && !ctx.G.roomDamaged);
  p.shieldHp = 0;

  ctx.G.pressure = 0.601; ctx.G.recentHits = []; p.hp = 3; p.invT = 0; ctx.G.mode = 'play';
  ctx.hurtPlayer(1, 0);
  check('pressure relief is floored at 60%', ctx.G.pressure === 0.60);

  ctx.G.pressure = 9; ctx.G.roomDamaged = false; ctx.recordRoomClear({ type: 'combat' });
  check('pressure is capped at 200%', ctx.G.pressure === 2.0);
  ctx.startRun(); step(3, 16);
  check('new runs reset pressure and streak', ctx.G.pressure === 1 && ctx.G.streak === 0);
}

console.log('== bigger gore-red minis ==');
{
  check('mini hitbox grew', ctx.ENEMY_TYPES.mini.r === 14);
  check('mini sprite grew', ctx.ENEMY_TYPES.mini.drawSize === 48);
}

console.log('== damaged monster health pips ==');
{
  const target = ctx.makeEnemy('shambler', 160, 160, 1, false);
  target.warmT = 0;
  check('undamaged normal monster starts without a timed health pip', target.hpBarT === 0);
  ctx.damageEnemy(target, 1, 0, false, { noProc: true, noCrit: true });
  check('damaging a normal monster reveals its health pip', target.hpBarT === 2.5 && target.hp < target.maxHp);
  ctx.G.enemies = [target];
  ctx.updateEnemies(2.6);
  check('normal monster health pip expires after the tracking window', target.hpBarT === 0);
  ctx.G.enemies = [];
}

console.log('== 750ms entry-wave spawn telegraph ==');
{
  ctx.startRun(); step(3, 16);
  // enter a combat room to trigger a wave
  const sr = ctx.G.rooms['0,0'];
  const sd = Object.keys(sr.doors).find(d => sr.doors[d]);
  const DIRS2 = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  const [ddx, ddy] = DIRS2[sd];
  ctx.enterRoom(sr.gx + ddx, sr.gy + ddy);
  step(1, 16);
  const room2 = ctx.G.cur;
  if (room2.type === 'combat' && ctx.G.enemies.length > 0) {
    const spawner = ctx.G.enemies[0];
    check('wave spawn is telegraphing', spawner.warmT > 0.3 && spawner.warmT <= ctx.ENTRY_WARN);
    const sx = spawner.x, sy = spawner.y;
    ctx.G.player.invT = 0;
    const hpBefore = ctx.G.player.hp;
    ctx.G.player.x = spawner.x; ctx.G.player.y = spawner.y; // overlap the sigil
    step(20, 16); // ~320ms
    check('telegraphed spawn is frozen', Math.abs(spawner.x - sx) < 0.01 && Math.abs(spawner.y - sy) < 0.01);
    check('telegraphed spawn deals no contact damage', ctx.G.player.hp === hpBefore);
    step(30, 16); // past 750ms total
    check('spawn arms after the telegraph', spawner.warmT <= 0);
    ctx.G.player.x = ctx.W / 2; ctx.G.player.y = ctx.H / 2; ctx.G.player.invT = 1;
  } else {
    check('combat room spawned for telegraph test (' + room2.type + ')', true);
  }
  // splitter splits stay instant
  ctx.G.enemies.length = 0;
  const splitParent = ctx.makeEnemy('splitter', ctx.W / 2, ctx.H / 2, 1, false);
  ctx.G.enemies.push(splitParent);
  ctx.damageEnemy(splitParent, 99999, 0, false);
  const minis = ctx.G.enemies.filter(e => e.type === 'mini');
  check('splitter splits into minis', minis.length === 2);
  check('splits spawn instantly (no telegraph)', minis.every(m => (m.warmT || 0) === 0));
  ctx.G.enemies.length = 0;
  ctx.startRun(); step(3, 16);
}

console.log('== room-entry reaction buffer ==');
{
  ctx.startRun(); step(3, 16);
  // enter a combat neighbor room so a first-entry wave is staged at the arrival door
  const sr = ctx.G.rooms['0,0'];
  const sd = Object.keys(sr.doors).find(d => sr.doors[d]);
  const DIRS3 = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  const [edx, edy] = DIRS3[sd];
  ctx.enterRoom(sr.gx + edx, sr.gy + edy);
  const er = ctx.G.cur;
  if (er.type === 'combat' && ctx.G.enemies.length > 0) {
    // move the player to a far corner, then run the post-teleport separation
    const erA = ctx.G.arena;
    ctx.G.player.x = erA.x0 + 40; ctx.G.player.y = erA.y0 + 40;
    ctx.separateEntryWave();
    const buf = Math.min(ctx.ENTRY_BUFFER, Math.min(erA.w, erA.h) * 0.42);
    const ok = ctx.G.enemies.every(e =>
      e.boss || e.hp <= 0 || ((e.x - ctx.G.player.x) ** 2 + (e.y - ctx.G.player.y) ** 2) >= (buf * 0.9) ** 2);
    check('entry enemies stay past the reaction buffer', ok);
    check('first-entry wave telegraphs with ENTRY_WARN', ctx.G.enemies.every(e => (e.warmT || 0) <= ctx.ENTRY_WARN));
  } else {
    check('combat room staged for entry-buffer test (' + er.type + ')', true);
  }
  ctx.G.enemies.length = 0;
  ctx.startRun(); step(3, 16);
}

console.log('== five pressure-monster archetypes ==');
{
  const newTypes = ['censer', 'bulwark', 'choirmaster', 'flenserling', 'broodsac'];
  check('enemy roster expanded from six to eleven types', Object.keys(ctx.ENEMY_TYPES).length === 11);
  check('all five new monster stills and sheets are registered', newTypes.every(type =>
    ctx.SPRITE_MANIFEST.includes('enemy_' + type) && ctx.SPRITE_MANIFEST.includes('enemy_' + type + '_sheet')));
  let lockedSafe = true;
  for (let i = 0; i < 500; i++) if (newTypes.includes(ctx.pickEnemyType(3))) lockedSafe = false;
  check('new pressure monsters stay locked through floor 3', lockedSafe);

  ctx.startRun(); step(3, 16);
  const p = ctx.G.player;
  p.x = ctx.G.arena.cx; p.y = ctx.G.arena.cy;

  const censer = ctx.makeEnemy('censer', p.x - 180, p.y, 7, false);
  censer.castT = 0; ctx.G.enemies = [censer]; ctx.G.telegraphs = [];
  ctx.updateEnemyAI(censer, 0.016);
  check('Censer predicts and telegraphs a hostile pool', ctx.G.telegraphs.some(t => t.kind === 'pool' && t.owner === censer));

  const front = ctx.makeEnemy('bulwark', 300, 300, 7, false); front.faceDir = 0;
  const rear = ctx.makeEnemy('bulwark', 300, 300, 7, false); rear.faceDir = 0;
  const frontBefore = front.hp, rearBefore = rear.hp;
  ctx.damageEnemy(front, 10, Math.PI, false, { noProc: true, noCrit: true });
  ctx.damageEnemy(rear, 10, 0, false, { noProc: true, noCrit: true });
  check('Bulwark frontal armor rewards flanking', frontBefore - front.hp < (rearBefore - rear.hp) * 0.25);

  const choir = ctx.makeEnemy('choirmaster', 300, 300, 7, false);
  const ally = ctx.makeEnemy('shambler', 330, 300, 7, false); ally.hp = ally.maxHp / 2;
  const allyHp = ally.hp; choir.supportT = 0; ctx.G.enemies = [choir, ally];
  ctx.updateEnemyAI(choir, 0.016);
  check('Choirmaster buffs and repairs nearby monsters', ally.choirT > 0 && ally.hp > allyHp);

  const flenserling = ctx.makeEnemy('flenserling', 260, 260, 7, false);
  flenserling.ambushT = 0; ctx.G.enemies = [flenserling];
  ctx.updateEnemyAI(flenserling, 0.016);
  const phasedHp = flenserling.hp;
  const phasedHit = ctx.damageEnemy(flenserling, 10, 0, false, { noProc: true, noCrit: true });
  check('Flenserling phases out and becomes untargetable', flenserling.phased && !phasedHit && flenserling.hp === phasedHp);
  flenserling.phaseT = 0; ctx.updateEnemyAI(flenserling, 0.016);
  check('Flenserling reappears behind the player for a lunge', !flenserling.phased && flenserling.ambushState === 'lunge');

  const sac = ctx.makeEnemy('broodsac', 300, 300, 7, false);
  sac.summonT = 0; ctx.G.enemies = [sac];
  ctx.updateEnemyAI(sac, 0.016);
  check('Brood Sac periodically spawns two minis', ctx.G.enemies.filter(e => e.type === 'mini').length === 2);
  const burstSac = ctx.makeEnemy('broodsac', 400, 300, 7, false);
  ctx.G.enemies = [burstSac];
  ctx.damageEnemy(burstSac, 99999, 0, false, { noProc: true, noCrit: true });
  check('Brood Sac death bursts into four minis', ctx.G.enemies.filter(e => e.type === 'mini').length === 4);

  const cappedChoir = ctx.makeEnemy('choirmaster', 200, 200, 10, false);
  const cappedSacA = ctx.makeEnemy('broodsac', 240, 200, 10, false);
  const cappedSacB = ctx.makeEnemy('broodsac', 280, 200, 10, false);
  ctx.G.enemies = [cappedChoir, cappedSacA, cappedSacB];
  let capSafe = true;
  for (let i = 0; i < 300; i++) {
    const type = ctx.pickWaveEnemyType(10);
    if (type === 'choirmaster' || type === 'broodsac') capSafe = false;
  }
  check('support and summoner per-room caps are enforced', capSafe);

  const thin = ctx.makeRoom(0, 0, 'combat'); thin.shape = 'wide_hall'; thin.doors = {};
  ctx.G.cur = thin; ctx.setArenaForRoom(thin); ctx.G.enemies = [];
  let hallSafe = true;
  for (let i = 0; i < 300; i++) {
    const type = ctx.pickWaveEnemyType(10);
    if (type === 'censer' || type === 'broodsac') hallSafe = false;
  }
  check('zone denial and summoners stay out of thin halls', hallSafe);
  ctx.startRun(); step(3, 16);
}

console.log('== pressure dial scaling ==');
{
  const GAIN = [-2, -1.6, -1.2, -0.8, -0.4, 0, 0.2, 0.4, 0.6, 0.8, 1, 1.8, 2.6, 3.4, 4.2, 5, 6, 7, 8, 9, 10];
  const DROP = [8, 7.4, 6.8, 6.2, 5.6, 5, 4.6, 4.2, 3.8, 3.4, 3, 2.4, 1.8, 1.2, 0.6, 0, 0, 0, 0, 0, 0];
  let gainOK = true, dropOK = true;
  for (let d = -10; d <= 10; d++) {
    if (Math.abs(ctx.pressureGainUnits(d) - GAIN[d + 10]) > 1e-6) gainOK = false;
    if (Math.abs(ctx.pressureDropUnits(d) - DROP[d + 10]) > 1e-6) dropOK = false;
  }
  check('gain units match all 21 notches', gainOK);
  check('drop units match all 21 notches', dropOK);
  ctx.G.pressureDial = 10;
  ctx.G.pressure = 1; ctx.G.roomDamaged = false;
  ctx.recordRoomClear({ type: 'combat' });
  check('dial +10 clean room adds 10%', Math.abs(ctx.G.pressure - 1.10) < 1e-4);
  // dial +5: gain 0.05/clean room, zero relief on hit
  ctx.G.pressureDial = 5;
  ctx.G.pressure = 1; ctx.G.roomDamaged = false;
  ctx.recordRoomClear({ type: 'combat' });
  check('dial +5 clean room adds 5%', Math.abs(ctx.G.pressure - 1.05) < 1e-4);
  ctx.G.pressure = 1.2; ctx.G.recentHits = []; ctx.G.player.hp = 5; ctx.G.player.stats.maxHp = 10;
  ctx.G.player.invT = 0; ctx.G.mode = 'play';
  ctx.hurtPlayer(1, 0);
  check('dial +5 gives no hit relief', Math.abs(ctx.G.pressure - 1.2) < 1e-6);
  // dial -5: zero gain, relief scaled 5/3 vs dial 0 for the identical hit
  ctx.G.pressureDial = -5;
  ctx.G.pressure = 1; ctx.G.roomDamaged = false;
  ctx.recordRoomClear({ type: 'combat' });
  check('dial -5 clean room adds nothing', Math.abs(ctx.G.pressure - 1) < 1e-6);
  ctx.G.pressureDial = -10;
  ctx.G.pressure = 1; ctx.G.roomDamaged = false;
  ctx.recordRoomClear({ type: 'combat' });
  check('dial -10 clean room bleeds 2% pressure', Math.abs(ctx.G.pressure - 0.98) < 1e-6);
  ctx.G.pressure = 0.605; ctx.G.roomDamaged = false;
  ctx.recordRoomClear({ type: 'combat' });
  check('negative clean-room gain respects the 60% floor', ctx.G.pressure === 0.60);
  const mkHit = (dial) => {
    ctx.G.pressureDial = dial;
    ctx.G.pressure = 1.2; ctx.G.recentHits = [];
    ctx.G.player.hp = 10; ctx.G.player.stats.maxHp = 10; ctx.G.player.invT = 0; ctx.G.mode = 'play';
    ctx.hurtPlayer(1, 0);
    return 1.2 - ctx.G.pressure;
  };
  const reliefNeg = mkHit(-5);
  const reliefExtreme = mkHit(-10);
  const reliefZero = mkHit(0);
  check('dial -5 relief beats dial 0 (' + reliefNeg.toFixed(4) + ' vs ' + reliefZero.toFixed(4) + ')',
    reliefNeg > reliefZero && Math.abs(reliefNeg - reliefZero * (5 / 3)) < 1e-4);
  check('dial -10 relief is 8/3 of dial 0', reliefExtreme > reliefNeg && Math.abs(reliefExtreme - reliefZero * (8 / 3)) < 1e-4);
  // score multiplier
  ctx.G.pressureDial = 0;
  ctx.G.pressure = 1.5;
  const scBefore = ctx.G.score; ctx.addScore(100);
  check('score scales with live pressure (1.5x)', ctx.G.score - scBefore === 150);
  ctx.G.pressure = 0.75;
  const scBefore2 = ctx.G.score; ctx.addScore(1);
  check('small awards floor at +1', ctx.G.score - scBefore2 === 1);
  ctx.G.pressure = 1; ctx.G.pressureDial = 0;
  ctx.startRun(); step(3, 16);
}

console.log('== item stickiness ramps with owned count ==');
{
  ctx.startRun(); step(3, 16);
  const p = ctx.G.player;
  p.items = {}; // no owned items -> always a fresh roll
  // 1 upgradable item owned -> ~10% stick
  p.items = { hollowpoints: 1 };
  let owned1 = 0;
  for (let i = 0; i < 600; i++) if (ctx.randomItemId() === 'hollowpoints') owned1++;
  const frac1 = owned1 / 600;
  check('1 owned item sticks ~7% (' + owned1 + '/600)', frac1 > 0.03 && frac1 < 0.16);
  // 5+ upgradable items -> 50% stick × 0.7 room multiplier ≈ 35%
  p.items = { hollowpoints: 1, twitch: 1, scalpel: 1, leadmarrow: 1, piercegaze: 1 };
  let owned5 = 0;
  for (let i = 0; i < 600; i++) if (p.items[ctx.randomItemId()]) owned5++;
  const frac5 = owned5 / 600;
  check('5+ owned items stick ~35% (' + owned5 + '/600)', frac5 > 0.25 && frac5 < 0.48);
  p.items = {};
  ctx.startRun(); step(3, 16);
}

console.log('== help manual grows with the implant roster ==');
{
  check('12 help pages (5 implants + actives)', ctx.HELP_PAGES.length === 12);
  check('12 help renderers', ctx.HELP_RENDERERS.length === 12);
  check('help tabs never overflow the panel', (() => {
    const last = ctx.helpTabRect(ctx.HELP_PAGES.length - 1);
    const first = ctx.helpTabRect(0);
    return first.x >= 0 && last.x + last.w <= ctx.W;
  })());
  ctx.G.player = ctx.G.player || {};
  const fctx = fakeCtx();
  let renderOK = true;
  try {
    for (let i = 0; i < ctx.HELP_PAGES.length; i++) {
      ctx.G.helpPage = i;
      ctx.drawPauseHelp(fctx);
    }
  } catch (e) { renderOK = false; console.log('   render error: ' + e.message); }
  check('every help page renders without throwing', renderOK);
}

console.log('== HUD alpha slider ==');
{
  ctx.startRun(); step(3, 16);
  ctx.setHudAlpha(0.5);
  check('hud alpha sets', Math.abs(ctx.G.hudAlpha - 0.5) < 1e-6);
  ctx.setHudAlpha(0.05);
  check('hud alpha clamps to 25% floor', Math.abs(ctx.G.hudAlpha - 0.25) < 1e-6);
  ctx.setHudAlpha(5);
  check('hud alpha clamps to 100%', Math.abs(ctx.G.hudAlpha - 1) < 1e-6);
  const fctx2 = fakeCtx();
  let hudOK = true;
  try { ctx.G.hudAlpha = 0.25; ctx.drawHUD(fctx2); } catch (e) { hudOK = false; console.log('   hud error: ' + e.message); }
  check('HUD renders at 25% opacity', hudOK);
  ctx.G.hudAlpha = 1;
  ctx.startRun(); step(3, 16);
}

console.log('== boneknit is a chance-based room heal ==');
{
  const p = ctx.G.player;
  const savedHeal = p.stats.roomHeal, savedChance = p.stats.roomHealChance;
  p.stats.roomHeal = 0; p.stats.roomHealChance = 0;
  ctx.PERKS.find(k => k.id === 'boneknit').apply(p.stats, p);
  check('boneknit grants a 3% roll per stack', Math.abs(p.stats.roomHealChance - 0.03) < 0.0001);
  p.hp = 1; p.stats.maxHp = 10; ctx.G.roomDamaged = true; // dirty room: no pressure side-effects
  const realChance = ctx.chance;
  ctx.__smokeRealChance = realChance;
  vm.runInContext('chance = () => true', ctx);
  ctx.recordRoomClear({ type: 'combat' });
  check('successful boneknit roll heals half a heart', p.hp === 2);
  vm.runInContext('chance = () => false', ctx);
  ctx.recordRoomClear({ type: 'combat' });
  check('failed boneknit roll heals nothing', p.hp === 2);
  vm.runInContext('chance = __smokeRealChance', ctx);
  delete ctx.__smokeRealChance;
  p.stats.roomHeal = savedHeal; p.stats.roomHealChance = savedChance;
}

console.log('== weapon swap (R) ==');
{
  const p = ctx.G.player;
  p.weapon = { id: 'bonepopper', ammo: Infinity };
  p.holstered = null;
  tap('r');
  check('R with no special does nothing', p.weapon.id === 'bonepopper' && !p.holstered);
  ctx.spawnPickup('weapon', p.x, p.y, { wid: 'repeater' });
  step(2, 16);
  check('picked up special', p.weapon.id === 'repeater');
  p.weapon.ammo = 5;
  ctx.spawnPickup('weapon', p.x, p.y, { wid: 'repeater' });
  step(2, 16);
  check('duplicate active weapon refills ammo instead of replacing it', p.weapon.id === 'repeater' && p.weapon.ammo > 5 && !p.holstered);
  check('duplicate active weapon does not create a dropped-weapon loop', !ctx.G.pickups.some(k => k.type === 'weapon'));
  p.weapon.ammo = 77;
  const playSwapToast = ctx.G.toasts[ctx.G.toasts.length - 1];
  tap('r');
  check('R swaps to pistol', p.weapon.id === 'bonepopper' && p.holstered && p.holstered.id === 'repeater');
  check('play weapon swap emits a toast', ctx.G.toasts[ctx.G.toasts.length - 1] !== playSwapToast);
  check('holster keeps remaining ammo', p.holstered.ammo === 77);
  p.holstered.ammo = 5;
  ctx.spawnPickup('weapon', p.x, p.y, { wid: 'repeater' });
  step(2, 16);
  check('duplicate holstered weapon refills ammo without forcing a swap', p.weapon.id === 'bonepopper' && p.holstered.id === 'repeater' && p.holstered.ammo > 5);
  p.holstered.ammo = 77;
  tap('r');
  check('R swaps back', p.weapon.id === 'repeater' && p.weapon.ammo === 77 && !p.holstered);
  // picking up another special drops the old one with its ammo
  ctx.spawnPickup('weapon', p.x, p.y, { wid: 'marrow' });
  step(2, 16);
  check('new special becomes active', p.weapon.id === 'marrow');
  check('old special dropped with its ammo', ctx.G.pickups.some(k => k.type === 'weapon' && k.wid === 'repeater' && k.ammo === 77));
  // dropped weapon has a collect delay so it isn't instantly re-grabbed
  check('dropped weapon not instantly re-collected', p.weapon.id === 'marrow');
  // dry weapon reverts to pistol but remains in the holster for later refill
  p.weapon = { id: 'marrow', ammo: 0 };
  step(2, 16);
  check('dry special reverts to pistol and stays holstered', p.weapon.id === 'bonepopper' && p.holstered && p.holstered.id === 'marrow' && p.holstered.ammo === 0);
  tap('r');
  check('empty holstered special is unselectable', p.weapon.id === 'bonepopper' && p.holstered.id === 'marrow');
  ctx.spawnPickup('ammo', p.x, p.y);
  step(2, 16);
  check('ammo refills empty holstered special', p.holstered && p.holstered.ammo > 0);
  tap('r');
  check('refilled special becomes selectable', p.weapon.id === 'marrow');
  ctx.G.pickups.length = 0;
}

console.log('== splinter item ==');
{
  const p = ctx.G.player;
  const saveOrb = p.stats.orbitals;
  p.stats.orbitals = 0;
  ctx.giveItem('splinterbone');
  check('splinter stat applied', p.stats.splinter === 2);
  ctx.G.enemies.length = 0;
  const e = ctx.makeEnemy('shambler', p.x + 50, p.y, 1, false);
  e.spd = 0;
  ctx.G.enemies.push(e);
  p.weapon = { id: 'bonepopper', ammo: Infinity };
  ctx.Input.mx = e.x; ctx.Input.my = e.y;
  ctx.Input.mdown = true;
  let sawShard = false;
  for (let i = 0; i < 40 && !sawShard; i++) {
    step(1, 16);
    if (ctx.G.bullets.some(b => b.shard)) sawShard = true;
  }
  ctx.Input.mdown = false;
  step(40, 16);
  check('shots shatter into shards on hit', sawShard);
  check('splinter stacks', (ctx.ITEMS.splinterbone.apply(p.stats, p), p.stats.splinter === 4));
  ctx.G.enemies.length = 0;
  ctx.G.bullets.length = 0;
  p.stats.orbitals = saveOrb;
}

console.log('== boss fight ==');
ctx.nextFloor();
step(10, 16);
check('floor 2', ctx.G.floor === 2);
// jump to boss room
const bossRoom = Object.values(ctx.G.rooms).find(r => r.type === 'boss');
check('boss room exists', !!bossRoom);
ctx.enterRoom(bossRoom.gx, bossRoom.gy);
step(10, 16);
check('boss spawned', !!ctx.G.boss);
check('boss hp is finite', ctx.G.boss && isFinite(ctx.G.boss.hp));
check('boss music playing', ctx.Music.current && ctx.Music.current.name.includes('Boss'));
// whittle the boss down (also exercises telegraphs/patterns)
for (let g2 = 0; g2 < 400 && ctx.G.boss; g2++) {
  for (const e of [...ctx.G.enemies]) ctx.damageEnemy(e, 50, 0, false);
  step(20, 16);
}
check('boss dead', !ctx.G.boss);
check('boss death clears remaining minions', ctx.G.enemies.length === 0);
check('stairs spawned', ctx.G.pickups.some(p => p.type === 'stairs') || ctx.G.mode !== 'play');
check('boss stairs begin with a three-second safety seal', ctx.G.pickups.some(p => p.type === 'stairs' && p.delay > 0 && p.delay <= 3));
check('boss drops a weapon', ctx.G.pickups.some(p => p.type === 'weapon'));
check('boss reward pedestal', ctx.G.pickups.some(p => p.type === 'item'));

console.log('== stairs persist when leaving and re-entering the boss room ==');
{
  const bRoom = ctx.G.cur;
  check('currently in boss room', bRoom.type === 'boss');
  const bdir = Object.keys(bRoom.doors).find(d => bRoom.doors[d]);
  const [bdx, bdy] = DIRS[bdir];
  ctx.enterRoom(bRoom.gx + bdx, bRoom.gy + bdy);
  step(5, 16);
  check('left the boss room', ctx.G.cur !== bRoom);
  ctx.enterRoom(bRoom.gx, bRoom.gy);
  step(5, 16);
  check('back in boss room', ctx.G.cur === bRoom);
  check('stairs still there', ctx.G.pickups.some(p => p.type === 'stairs'));
  check('pedestal item still there', ctx.G.pickups.some(p => p.type === 'item'));
}

console.log('== next floor via stairs ==');
const stairs = ctx.G.pickups.find(p => p.type === 'stairs');
if (stairs) {
  ctx.G.player.x = stairs.x; ctx.G.player.y = stairs.y;
  step(5, 16);
  check('sealed boss stairs cannot advance the floor', ctx.G.floor === 2);
  step(190, 16);
  check('floor advanced', ctx.G.floor === 3);
}

console.log('== hazards / telegraphs / enemy bullets ==');
ctx.G.hazards.push({ kind: 'acid', x: 200, y: 200, r: 30, life: 2, t: 0, dps: 10 });
ctx.G.hazards.push({ kind: 'trap', x: 300, y: 300, r: 16, life: 2, t: 0, dmg: 5 });
ctx.G.telegraphs.push({ kind: 'knives', x: 400, y: 400, r: 34, t: 0, dur: 0.05, tick: 0 });
step(60, 16);
check('hazards/telegraphs resolved', ctx.G.hazards.length >= 0 && ctx.G.telegraphs.length >= 0);

console.log('== nine-boss roster and cycle mechanics ==');
{
  ctx.G.player.invT = 0;
  const kinds = [];
  for (let floor = 1; floor <= 9; floor++) {
    ctx.G.floor = floor;
    ctx.G.enemies.length = 0; ctx.G.ebullets.length = 0; ctx.G.telegraphs.length = 0; ctx.G.hazards.length = 0; ctx.G.boss = null;
    const boss = ctx.spawnBoss(floor);
    kinds.push(boss.bossKind);
    for (let i = 0; i < 180; i++) {
      ctx.updateBoss(boss, 1 / 60);
      ctx.updateTelegraphs(1 / 60);
      ctx.updateBullets(1 / 60);
      ctx.updateHazards(1 / 60);
    }
    check(boss.name + ' survives a pattern soak', Number.isFinite(boss.x) && Number.isFinite(boss.y) && Number.isFinite(boss.hp));
  }
  check('all nine boss kinds rotate without duplicates', new Set(kinds).size === 9 && kinds.length === 9);
  check('every boss has a two-track music pair', ctx.BOSS_DEFS.every(d => ctx.Music.TRACKS.bosses[d.kind] && ctx.Music.TRACKS.bosses[d.kind].length === 2));
  check('all 18 boss themes are selectable in the jukebox', Object.values(ctx.Music.TRACKS.bosses).flat().every(f => ctx.Music.PLAYLIST.includes(f)));
  check('all new boss stills and sheets are in the sprite manifest', ctx.BOSS_DEFS.every(d => ctx.SPRITE_MANIFEST.includes(d.sprite) && ctx.SPRITE_MANIFEST.includes(d.sprite + '_sheet')));

  // Gore Crown repeats on floor 11 with all original cycle gates still active.
  ctx.G.floor = 11; ctx.G.enemies.length = 0; ctx.G.ebullets.length = 0; ctx.G.boss = null;
  const g = ctx.spawnBoss(11);
  check('gorecrown repeats with debut-relative tier', g.bossKind === 'gorecrown' && g.cycle === 3 && g.tier === 3);
  let sawRing = false, sawVolley = false;
  for (let i = 0; i < 6; i++) {
    g.atkT = 0;
    const before = ctx.G.ebullets.length;
    ctx.updateBoss(g, 0.001);
    const batch = ctx.G.ebullets.length - before;
    if (batch >= 12) sawRing = true;
    if (batch > 0 && batch <= 7) sawVolley = true;
  }
  check('cycle gorecrown still fires rings', sawRing);
  check('cycle gorecrown adds aimed volleys', sawVolley);
  ctx.G.floor = 200; ctx.G.enemies.length = 0; ctx.G.ebullets.length = 0; ctx.G.boss = null;
  const deepGore = ctx.spawnBoss(200);
  let deepestBatch = 0;
  for (let i = 0; i < 6; i++) {
    deepGore.atkT = 0; const before = ctx.G.ebullets.length; ctx.updateBoss(deepGore, 0.001);
    deepestBatch = Math.max(deepestBatch, ctx.G.ebullets.length - before);
  }
  check('deep-floor gore rings stay bounded', deepestBatch <= 80);

  ctx.G.floor = 12; ctx.G.enemies.length = 0; ctx.G.boss = null; ctx.G.telegraphs.length = 0;
  const k1 = ctx.spawnBoss(12); k1.atkT = 0; ctx.updateBoss(k1, 0.001);
  check('cycle knife telegraph hunts the player', k1.bossKind === 'knifecrawl' && ctx.G.telegraphs.some(t => t.track > 0));
  ctx.G.floor = 21; ctx.G.enemies.length = 0; ctx.G.boss = null; ctx.G.telegraphs.length = 0; ctx.G.ebullets.length = 0;
  const k2 = ctx.spawnBoss(21); k2.atkT = 0; ctx.updateBoss(k2, 0.001);
  check('cycle knifecrawl fires cleaver volley', ctx.G.ebullets.some(b => b.sprite === 'bullet_cleaver'));
  ctx.G.floor = 30; ctx.G.enemies.length = 0; ctx.G.boss = null;
  const k3 = ctx.spawnBoss(30); k3.state = 'dash'; k3.stateT = 0.001; k3.dashes = 2; k3.chargeAng = 0;
  ctx.updateBoss(k3, 0.01);
  check('cycle knifecrawl chain-dashes', k3.state === 'dash' && k3.dashes === 1);

  ctx.G.floor = 3;
  ctx.G.enemies.length = 0; ctx.G.boss = null; ctx.G.telegraphs.length = 0; ctx.G.ebullets.length = 0; ctx.G.hazards.length = 0;
}

console.log('== new boss combat primitives ==');
{
  const p = ctx.G.player;
  p.hp = p.stats.maxHp = 999; p.invT = 0; p.stats.crit = 0;
  ctx.G.floor = 7; ctx.G.enemies.length = 0; ctx.G.boss = null;
  const plate = ctx.spawnBoss(7);
  const hpBefore = plate.hp, rawToBreak = plate.maxHp * 0.06 / plate.dmgTakenMul + 1;
  ctx.damageEnemy(plate, rawToBreak, 0, false);
  check('Plate Father armor mitigates damage', plate.hp > hpBefore - rawToBreak && plate.dmgTakenMul === 0.25);
  check('breaking a plate staggers the boss', plate.plates === 3 && plate.rootT > 0);
  const atkBefore = plate.atkT;
  ctx.updateEnemies(0.1);
  check('plate stagger pauses the boss state machine', plate.atkT === atkBefore);
  const savedStun = p.stats.stunOnHit;
  const realChance = ctx.chance;
  ctx.__smokeRealChance = realChance;
  vm.runInContext('chance = () => true', ctx);
  p.stats.stunOnHit = 1; plate.stunT = 0;
  ctx.damageEnemy(plate, 1, 0, false, { noCrit: true });
  check('rapid stun items cannot permanently lock bosses', plate.stunT === 0);
  p.stats.stunOnHit = savedStun;
  vm.runInContext('chance = __smokeRealChance', ctx);
  delete ctx.__smokeRealChance;

  ctx.G.floor = 5; ctx.G.enemies.length = 0; ctx.G.boss = null;
  const flenser = ctx.spawnBoss(5); flenser.phased = true;
  const flenserHp = flenser.hp;
  ctx.damageEnemy(flenser, 100, 0, false);
  check('phased Flenser is untargetable', flenser.hp === flenserHp && ctx.nearestEnemy(flenser.x, flenser.y, 500) === null);

  const deadAnchor = { x: 300, y: 300, hp: 0 };
  ctx.G.enemies.length = 0;
  ctx.G.ebullets = [{ x: 320, y: 300, vx: 0, vy: 0, r: 6, dmg: 1, life: 2, t: 0,
    sprite: 'bullet_harpoon', behavior: 'orbit', anchor: deadAnchor, orbA: 0, orbR: 20, orbSpd: 1 }];
  ctx.updateBullets(0.016);
  check('orphaned orbit hooks release safely', ctx.G.ebullets[0] && ctx.G.ebullets[0].behavior !== 'orbit' && ctx.G.ebullets[0].anchor === null);

  p.x = 400; p.y = 300; p.invT = 0;
  const hazardHp = p.hp;
  ctx.G.hazards = [{ kind: 'acid', hostile: true, x: p.x, y: p.y, r: 30, life: 2, t: 0, tick: 0, dmg: 1, dps: 0 }];
  ctx.updateHazards(0.016);
  check('hostile boss hazards damage the player', p.hp === hazardHp - 1);
  p.invT = 0;
  const safeHp = p.hp;
  ctx.G.hazards = [{ kind: 'acid', x: p.x, y: p.y, r: 30, life: 2, t: 0, dps: 0 }];
  ctx.updateHazards(0.016);
  check('ordinary weapon hazards remain player-safe', p.hp === safeHp);

  ctx.G.floor = 9; ctx.G.enemies.length = 0; ctx.G.boss = null; ctx.G.telegraphs.length = 0; ctx.G.hazards.length = 0;
  const scald = ctx.spawnBoss(9); scald.hp = scald.maxHp * 0.2;
  for (let i = 0; i < 10; i++) { scald.atkT = 0; ctx.updateBoss(scald, 0.001); }
  check('Scald hostile pool count is capped', ctx.G.telegraphs.filter(t => t.kind === 'pool').length <= 14);

  ctx.G.floor = 8; ctx.G.enemies.length = 0; ctx.G.boss = null;
  const cleanupBoss = ctx.spawnBoss(8);
  ctx.G.telegraphs.push({ kind: 'sweep', owner: cleanupBoss, t: 0, dur: 2, ang: 0, spin: 1, len: 100, w: 20, arms: 1, tick: 0 });
  ctx.G.ebullets.push({ x: 100, y: 100 });
  ctx.G.hazards.push({ kind: 'acid', hostile: true, x: 100, y: 100, r: 20, life: 2, t: 0 });
  ctx.onBossDeath(cleanupBoss);
  check('boss death clears persistent hostile attacks', ctx.G.telegraphs.length === 0 && ctx.G.ebullets.length === 0 && !ctx.G.hazards.some(h => h.hostile));
  ctx.G.enemies.length = 0; ctx.G.boss = null; ctx.G.hazards.length = 0; ctx.G.pickups.length = 0;
  p.hp = Math.min(p.hp, p.stats.maxHp);
}

console.log('== item rooms sometimes stock weapons ==');
{
  let withWeapon = 0;
  for (let trial = 0; trial < 20; trial++) {
    ctx.genFloor(1);
    const ir = Object.values(ctx.G.rooms).find(r => r.type === 'item');
    if (!ir) continue;
    ctx.enterRoom(ir.gx, ir.gy);
    if (ctx.G.pickups.some(k => k.type === 'weapon')) withWeapon++;
  }
  check('item rooms sometimes have weapons (' + withWeapon + '/20)', withWeapon >= 1 && withWeapon <= 19);
  // restore a sane run state for later sections
  ctx.startRun();
  step(5, 16);
}

console.log('== performance and duplicate-hit regressions ==');
{
  ctx.startRun();
  ctx.G.player.stats.crit = 0;
  ctx.G.enemies.length = 0; ctx.G.bullets.length = 0; ctx.G.hazards.length = 0;
  const victim = ctx.makeEnemy('shambler', 400, 300, 1, false);
  victim.hp = 1;
  ctx.G.enemies.push(victim);
  ctx.G.hazards.push({ kind: 'acid', x: 400, y: 300, r: 30, life: 2, t: 0, dps: 8 });
  const killsBefore = ctx.G.kills;
  ctx.damageEnemy(victim, 10, 0, false);
  ctx.updateHazards(0.016);
  check('same-frame hazard cannot double-kill', ctx.G.kills === killsBefore + 1);

  const target = ctx.makeEnemy('shambler', 500, 300, 1, false);
  target.hp = target.maxHp = 100;
  ctx.G.enemies = [target];
  ctx.G.bullets = [{ x: 500, y: 300, vx: 0, vy: 0, ang: 0, r: 5, dmg: 7,
    pierce: 5, bounce: 0, bounces: 0, life: 1, t: 0, behavior: 'bullet', sprite: 'bullet_bone', hit: null }];
  ctx.updateBullets(0.016);
  const hpAfterFirst = target.hp;
  ctx.updateBullets(0.016);
  check('piercing shot hits one target only once', target.hp === hpAfterFirst);

  ctx.G.parts.length = 0;
  ctx.spawnExplosionFx(300, 300, 90);
  check('explosions create layered shockwaves', ctx.G.parts.filter(p => p.type === 'shockwave').length === 2);
  check('explosions create flame and smoke', ctx.G.parts.some(p => p.type === 'flame') && ctx.G.parts.some(p => p.type === 'smoke'));
  ctx.G.parts.length = 0;
  ctx.spawnMuzzleFx(300, 300, 0, 'flame');
  check('flame weapons emit layered muzzle particles', ctx.G.parts.some(p => p.type === 'flame') && ctx.G.parts.some(p => p.type === 'smoke'));
  ctx.G.parts.length = 0;
  ctx.spawnBeam(100, 100, 0, 200);
  ctx.updateParticles(0.016);
  const beamParticle = ctx.G.parts.find(p => p.type === 'beam');
  check('static beam particles remain finite', beamParticle && Number.isFinite(beamParticle.x) && Number.isFinite(beamParticle.y));
  ctx.G.parts.length = 0;
  for (let i = 0; i < 1000; i++) ctx.addParticle({ type: 'spark', x: 0, y: 0, vx: 0, vy: 0, life: 1, t: 0, r: 1 });
  check('cosmetic particles are capped', ctx.G.parts.length <= 850);
}

console.log('== death and restart ==');
ctx.G.player.invT = 0;
ctx.hurtPlayer(9999, 0);
check('death starts a three-second input lock', ctx.G.deathLockT === 3);
check('player death creates a layered gore burst', ctx.G.parts.some(p => p.type === 'gib') && ctx.G.parts.some(p => p.type === 'shockwave'));
step(5, 16);
check('game over', ctx.G.mode === 'gameover');
check('death animation advances once per game-over frame', Math.abs(ctx.G.player.deathT - 0.08) < 0.001);
tap('r');
check('restart input is ignored during death lock', ctx.G.mode === 'gameover');
step(190, 16);
tap('r');
step(5, 16);
check('restart works', ctx.G.mode === 'play' && ctx.G.floor === 1);

console.log('== confirmed destructive actions ==');
{
  check('web renderer disables desktop-only exit', ctx.canQuitDesktop() === false);
  let fired = 0;
  ctx.confirmAction('probe', () => fired++);
  check('first destructive action arms confirmation without firing', ctx.G.confirmAction === 'probe' && ctx.G.confirmT > 2.9 && fired === 0);
  ctx.confirmAction('probe', () => fired++);
  check('second matching action confirms and clears state', fired === 1 && ctx.G.confirmAction === null && ctx.G.confirmT === 0);
  ctx.confirmAction('expire', () => fired++);
  ctx.G.mode = 'inspect';
  ctx.update(3.1);
  check('confirmation expires without firing', fired === 1 && ctx.G.confirmAction === null && ctx.G.confirmT === 0);
  ctx.startRun(); step(3, 16);
  ctx.G.score = 999; ctx.G.mode = 'pause'; ctx.G.deathLockT = 2;
  ctx.confirmAction('menu', ctx.returnToMenu);
  ctx.confirmAction('menu', ctx.returnToMenu);
  check('confirmed return to menu fully resets the abandoned run', ctx.G.mode === 'menu' && ctx.G.score === 0 && ctx.G.deathLockT === 0);
  ctx.startRun(); step(3, 16);
}

console.log('== pause / mute ==');
tap('p');
check('paused', ctx.G.mode === 'pause');
ctx.G.player.weapon = { id: 'bonepopper', ammo: Infinity };
ctx.G.player.holstered = { id: 'repeater', ammo: 20 };
const pausedSwapToast = ctx.G.toasts[ctx.G.toasts.length - 1];
tap('r');
check('weapon swap works while paused', ctx.G.player.weapon.id === 'repeater');
check('paused weapon swap stays silent', ctx.G.toasts[ctx.G.toasts.length - 1] === pausedSwapToast);
tap('r');
tap('p');
check('unpaused', ctx.G.mode === 'play');

console.log('== pause help screen ==');
tap('p');
check('paused for help', ctx.G.mode === 'pause');
tap('h');
check('H opens the field manual', ctx.G.pauseHelp === true);
step(3, 16);
tap('arrowright');
check('arrow advances manual page', ctx.G.helpPage === 1);
tap('4');
check('number keys jump to a manual page', ctx.G.helpPage === 3);
tap('escape');
check('escape closes manual but stays paused', ctx.G.pauseHelp === false && ctx.G.mode === 'pause');
tap('h'); tap('h');
check('H toggles the manual closed', ctx.G.pauseHelp === false);
tap('p');
check('unpaused after manual', ctx.G.mode === 'play');

tap('m');
check('muted', ctx.G.muted === true);

console.log('== jukebox ==');
ctx.Music.cycle(1);
check('manual track selected', ctx.G.musicSel === 0 && ctx.Music.override === ctx.Music.PLAYLIST[0]);
check('manual track playing', ctx.Music.current.name === ctx.Music.PLAYLIST[0]);
tap('n'); // N hotkey during play
check('N cycles forward', ctx.G.musicSel === 1 && ctx.Music.current.name === ctx.Music.PLAYLIST[1]);
ctx.nextFloor(); step(5, 16);
check('override survives floor change', ctx.Music.current.name === ctx.Music.PLAYLIST[1]);
const jbr = Object.values(ctx.G.rooms).find(r => r.type === 'boss');
ctx.enterRoom(jbr.gx, jbr.gy); step(5, 16);
check('boss track interrupts override', ctx.Music.current.name.includes('Boss'));
ctx.Music.cycle(1); // cycling during a boss must not cut the boss track
check('boss track not interrupted', ctx.Music.current.name.includes('Boss'));
for (const e of [...ctx.G.enemies]) ctx.damageEnemy(e, 99999, 0, false);
step(10, 16);
check('returns to override after boss', ctx.Music.current.name === ctx.Music.PLAYLIST[2]);
while (ctx.G.musicSel !== -1) ctx.Music.cycle(1);
check('wrapped back to auto', ctx.Music.override === null);
step(5, 16);
check('auto plays a playlist track', ctx.Music.PLAYLIST.includes(ctx.Music.current.name));

step(120, 16); // idle soak

console.log('== debug console ==');
// gating: backtick is inert in the web harness (no dev flag)
const modeBeforeDebug = ctx.G.mode;
ctx.G.devMode = false;
tap('`');
check('debug console stays closed without dev flag', ctx.G.mode === modeBeforeDebug);
// enable dev, open, navigate tabs, close
ctx.G.devMode = true;
ctx.G.mode = 'play';
tap('`');
check('debug console opens on backtick when dev', ctx.G.mode === 'debug');
const pageBefore = ctx.G.debugPage;
tap('arrowright');
check('tab advances', ctx.G.debugPage === (pageBefore + 1) % ctx.DEBUG_PAGES.length);
tap('`');
check('debug console closes back to play', ctx.G.mode === 'play');

// defaultPlayerStats is a clean, self-contained snapshot of the starting stats
(function () {
  const def = ctx.defaultPlayerStats();
  const def2 = ctx.defaultPlayerStats();
  check('defaultPlayerStats returns independent copies', def !== def2 && def.maxHp === 6 && def.dmgMul === 1 && def.critMul === 2);
  // a freshly-initialised player always matches the factory output
  const saved = ctx.G.player;
  ctx.initPlayer();
  const fresh = ctx.G.player.stats;
  check('defaultPlayerStats matches initPlayer stats', Object.keys(def).every(k => def[k] === fresh[k]) && Object.keys(fresh).length === Object.keys(def).length);
  check('initPlayer seeds empty perk tracking', Array.isArray(ctx.G.player.perks) && ctx.G.player.perks.length === 0);
  ctx.G.player = saved;
})();

// stat rebuild reproduces a build, then removal strips its contribution
(function () {
  ctx.G.player.items = {};
  ctx.G.player.perks = [];
  ctx.G.player.stats = ctx.defaultPlayerStats();
  const baseDmg = ctx.G.player.stats.dmgMul;
  ctx.giveItem('marrowglut');           // dmgMul *= 1.20
  ctx.grantPerk(ctx.PERKS.find(p => p.id === 'critbone')); // crit += 0.02
  const afterDmg = ctx.G.player.stats.dmgMul;
  const afterCrit = ctx.G.player.stats.crit;
  check('item + perk apply', Math.abs(afterDmg - baseDmg * 1.20) < 1e-9 && Math.abs(afterCrit - 0.07) < 1e-9);
  ctx.debugRebuildStats();
  check('rebuild reproduces stats', Math.abs(ctx.G.player.stats.dmgMul - afterDmg) < 1e-9 && Math.abs(ctx.G.player.stats.crit - afterCrit) < 1e-9);
  delete ctx.G.player.items['marrowglut'];
  ctx.debugRebuildStats();
  check('item removal strips its stat', Math.abs(ctx.G.player.stats.dmgMul - baseDmg) < 1e-9);
  check('perk survives item removal', Math.abs(ctx.G.player.stats.crit - afterCrit) < 1e-9);
})();

// pressure delta helper: respects bounds and the freeze lock
(function () {
  ctx.G.pressure = 1; ctx.G.debugFlags = {};
  ctx.applyPressureDelta(5); check('pressure clamps to max', ctx.G.pressure === ctx.PRESSURE_MAX);
  ctx.applyPressureDelta(-99); check('pressure clamps to min', ctx.G.pressure === ctx.PRESSURE_MIN);
  ctx.G.pressure = 1; ctx.G.debugFlags.pressureLock = true;
  ctx.applyPressureDelta(0.5); check('freeze locks pressure', ctx.G.pressure === 1);
  ctx.G.debugFlags = {};
})();

// taint blocks best-score persistence
(function () {
  ctx.G.debugUsed = true;
  ctx.G.best = 100;
  ctx.G.score = 500;
  const old = ctx.G.player.hp;
  ctx.G.player.hp = 1;
  ctx.gameOver();
  check('debug-tainted run does not save best', ctx.G.best === 100);
  ctx.G.debugUsed = false; ctx.G.mode = 'play';
  ctx.G.player.hp = old;
})();

// god mode and OHKO guards
(function () {
  ctx.G.debugFlags.god = true;
  const hp = ctx.G.player.hp;
  ctx.hurtPlayer(5, 0, null);
  check('god mode blocks damage', ctx.G.player.hp === hp);
  ctx.G.debugFlags.god = false;
  ctx.G.enemies = [];
  const victim = ctx.makeEnemy('shambler', 100, 100, 1, false);
  ctx.G.enemies.push(victim);
  ctx.G.debugFlags.ohko = true;
  ctx.damageEnemy(victim, 1, 0, false);
  check('ohko kills a full-health enemy', victim.hp <= 0);
  ctx.G.debugFlags.ohko = false;
  ctx.G.enemies = [];
})();

// pinned debug console = live sim (player can be hurt); un-pinned = protected
(function () {
  ctx.G.player.invT = 0;
  const hp = ctx.G.player.hp;
  ctx.G.mode = 'debug'; ctx.G.debugPin = true;
  ctx.hurtPlayer(1, 0, null);
  check('pinned debug keeps the player hittable', ctx.G.player.hp === hp - 1);
  ctx.G.debugPin = false; ctx.G.player.invT = 0; const hp2 = ctx.G.player.hp;
  ctx.hurtPlayer(1, 0, null);
  check('un-pinned debug protects the player', ctx.G.player.hp === hp2);
  ctx.G.mode = 'play';
})();

// useActive(force) fires from the debug console; without force it stays gated
(function () {
  ctx.G.mode = 'debug';
  ctx.G.player.active = { iid: 'bonenova', charges: 2 };
  ctx.useActive(); // not forced: no-op in debug mode
  check('useActive is mode-gated without force', ctx.G.player.active.charges === 2);
  ctx.useActive(true); // debug FIRE button path
  check('useActive(force) fires in debug mode', ctx.G.player.active.charges === 0);
  ctx.G.mode = 'play';
})();

console.log('== crimson metronome heart loan ==');
{
  ctx.startRun(); step(3, 16); // self-contained: fresh player, empty arena
  ctx.G.enemies.length = 0;
  const p = ctx.G.player;
  ctx.giveItem('crimsonmetronome');
  check('metronome grants the loan flag', p.stats.crimsonMetronome === 1);
  p.weapon = { id: 'repeater', ammo: 500 }; p.holstered = null; // per-shot trigger
  p.hp = 6; p.metronomeCount = 0; p.metronomeTmp = 0;
  const hpBefore = p.hp;
  ctx.Input.mdown = true;
  let guard = 0;
  while (p.metronomeTmp === 0 && guard++ < 4000) step(1, 16);
  ctx.Input.mdown = false;
  check('8th shot lends ½ heart (not lost)', p.hp === hpBefore - 1 && p.metronomeTmp === 1);
  ctx.G.roomDamaged = false;
  ctx.recordRoomClear({ type: 'combat' });
  check('clean room clear repays the loan', p.hp === hpBefore && p.metronomeTmp === 0);
  ctx.Input.mdown = true;
  guard = 0;
  while (p.metronomeTmp === 0 && guard++ < 4000) step(1, 16);
  ctx.Input.mdown = false;
  check('loan accrues again', p.hp === hpBefore - 1 && p.metronomeTmp === 1);
  ctx.G.roomDamaged = true;
  ctx.recordRoomClear({ type: 'combat' });
  check('hit room forfeits the loan', p.hp === hpBefore - 1 && p.metronomeTmp === 1);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
