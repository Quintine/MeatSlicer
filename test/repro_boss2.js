// Repro hunt: simulate a LONG Gore Crown (floor 2 boss) fight with a
// realistically behaving player, watching for exceptions / runaway growth.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fakeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return () => ({ width: 50 });
      if (typeof prop === 'string' && !(prop in t)) t[prop] = /^[a-z]/.test(prop) ? function () {} : undefined;
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
  requestAnimationFrame: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { getElementById: () => canvasStub },
  Image: class { constructor() { this.width = 32; this.height = 32; } set src(v) { this.onerror && this.onerror(); } },
  Audio: class { constructor() { this.volume = 0; this.paused = true; } play() { return Promise.resolve(); } pause() {} },
  AudioContext: undefined,
  setTimeout: (fn) => fn(),
  Math, JSON, Object, Array, Number, String, Boolean, Promise, Uint8ClampedArray, Proxy, Reflect, Set, Map, Date, Error, RegExp, parseInt, parseFloat, isNaN, Infinity, NaN, undefined,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.addEventListener = (ev, fn) => { (listeners['win:' + ev] = listeners['win:' + ev] || []).push(fn); };
vm.createContext(sandbox);
for (const f of ['utils', 'state', 'input', 'sfx', 'audio', 'sprites', 'particles', 'weapons',
  'bullets', 'pickups', 'items', 'perks', 'enemies', 'bosses', 'rooms', 'player', 'hud', 'main']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
}
vm.runInContext('Object.assign(this, { G, Input, WEAPONS, Music, W, H, WALL })', sandbox);

let simTime = 0;
const ctx = sandbox;
let SYS = 'init';
function step(n) {
  for (let i = 0; i < n; i++) {
    simTime += 16;
    // instrumented play-mode dispatch so the last label before a hang = culprit
    if (ctx.G.mode === 'play') {
      SYS = 'updatePlayer'; ctx.updatePlayer(0.016);
      SYS = 'updateRoom'; ctx.updateRoom(0.016);
      SYS = 'updateEnemies'; ctx.updateEnemies(0.016);
      SYS = 'updateTelegraphs'; ctx.updateTelegraphs(0.016);
      SYS = 'updateBullets'; ctx.updateBullets(0.016);
      SYS = 'updateHazards'; ctx.updateHazards(0.016);
      SYS = 'updatePickups'; ctx.updatePickups(0.016);
      SYS = 'updateParticles'; ctx.updateParticles(0.016);
      SYS = 'drawToastsUpdate'; ctx.drawToastsUpdate(0.016);
      SYS = 'draw'; ctx.draw();
    } else {
      SYS = 'update(' + ctx.G.mode + ')';
      ctx.update(0.016);
      SYS = 'draw'; ctx.draw();
    }
    ctx.clearInputEdges();
  }
}
process.on('SIGINT', () => { console.log('INT at', SYS); process.exit(1); });
for (const fn of (listeners['win:load'] || [])) fn();
step(2);

// start a run and go to floor 2's boss room
ctx.startRun();
ctx.nextFloor();
const bossRoom = Object.values(ctx.G.rooms).find(r => r.type === 'boss');
ctx.enterRoom(bossRoom.gx, bossRoom.gy);
// invincible sim player so the fight actually lasts (we're hunting freezes, not deaths)
// NOTE: keep maxHp small — drawHUD loops once per heart; huge maxHp = slow test
ctx.G.player.hp = 99999;
step(2);
console.log('boss:', ctx.G.boss && ctx.G.boss.bossKind);
if (!ctx.G.boss || ctx.G.boss.bossKind !== 'gorecrown') { console.log('SETUP FAILED'); process.exit(1); }

// realistic fight: move erratically, hold fire aimed at boss, cycle weapons,
// draft perks when offered, DON'T kill the boss (heal it) so the fight drags on
const weaponIds = Object.keys(ctx.WEAPONS);
let maxEnemies = 0, maxParts = 0, maxEbullets = 0, maxPickups = 0;
const FRAMES = 12000; // ~3.2 minutes of game time
try {
  for (let f = 0; f < FRAMES; f++) {
    // wiggle movement
    if (f % 40 === 0) {
      for (const k of ['w', 'a', 's', 'd']) ctx.Input.keys[k] = false;
      ctx.Input.keys[['w', 'a', 's', 'd'][Math.floor(Math.random() * 4)]] = true;
    }
    // aim at boss and hold fire
    if (ctx.G.boss) { ctx.Input.mx = ctx.G.boss.x; ctx.Input.my = ctx.G.boss.y; }
    ctx.Input.mdown = true;
    // swap weapons occasionally
    if (f % 900 === 0 && f > 0) {
      const wid = weaponIds[Math.floor(Math.random() * weaponIds.length)];
      ctx.G.player.weapon = { id: wid, ammo: 999 };
    }
    // keep the boss alive: top up its hp each frame
    if (ctx.G.boss) ctx.G.boss.hp = Math.min(ctx.G.boss.maxHp, ctx.G.boss.hp + 3);
    // keep the sim player alive
    ctx.G.player.hp = 99999;
    // auto-draft perks
    if (ctx.G.mode === 'levelup') ctx.choosePerk(0);

    step(1);
    maxEnemies = Math.max(maxEnemies, ctx.G.enemies.length);
    maxParts = Math.max(maxParts, ctx.G.parts.length);
    maxEbullets = Math.max(maxEbullets, ctx.G.ebullets.length);
    maxPickups = Math.max(maxPickups, ctx.G.pickups.length);
    if (f % 100 === 99) {
      console.log(`f${f + 1}: mode=${ctx.G.mode} enemies=${ctx.G.enemies.length} parts=${ctx.G.parts.length} ebul=${ctx.G.ebullets.length} pick=${ctx.G.pickups.length} bossHp=${ctx.G.boss ? Math.round(ctx.G.boss.hp) : 'dead'} weapon=${ctx.G.player.weapon.id}`);
    }
  }
} catch (e) {
  console.log('EXCEPTION DURING FIGHT:', e.stack);
  process.exit(1);
}
console.log(`survived ${FRAMES} frames. maxEnemies=${maxEnemies} maxParts=${maxParts} maxEbullets=${maxEbullets} maxPickups=${maxPickups}`);

// now kill the boss while minions are alive, then mop up
try {
  ctx.Input.mdown = false;
  if (ctx.G.boss) ctx.damageEnemy(ctx.G.boss, 999999, 0, false);
  step(5);
  console.log('boss killed with', ctx.G.enemies.length, 'minions alive; room cleared =', ctx.G.cur.cleared);
  for (const e of [...ctx.G.enemies]) ctx.damageEnemy(e, 999999, 0, false);
  step(30);
  console.log('after mop-up: cleared =', ctx.G.cur.cleared, '| stairs =', ctx.G.pickups.some(p => p.type === 'stairs'), '| floor =', ctx.G.floor);
  const stairs = ctx.G.pickups.find(p => p.type === 'stairs');
  if (stairs) {
    ctx.G.player.x = stairs.x; ctx.G.player.y = stairs.y;
    step(5);
    console.log('floor after stairs =', ctx.G.floor, '| mode =', ctx.G.mode);
  }
  console.log('POST-FIGHT OK');
} catch (e) {
  console.log('EXCEPTION AFTER FIGHT:', e.stack);
  process.exit(1);
}
