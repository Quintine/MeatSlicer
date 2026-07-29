// Long-fight soak for a specific boss. Usage: node test/repro_boss.js <floor 1-9>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FLOOR = parseInt(process.argv[2] || '1', 10);

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

for (const fn of (listeners['win:load'] || [])) fn();
step(2);
ctx.startRun();
for (let i = 1; i < FLOOR; i++) ctx.nextFloor();
const bossRoom = Object.values(ctx.G.rooms).find(r => r.type === 'boss');
ctx.enterRoom(bossRoom.gx, bossRoom.gy);
ctx.G.player.hp = 99999; // keep sim player alive (maxHp small for HUD)
step(2);
console.log('floor', FLOOR, '| boss:', ctx.G.boss && ctx.G.boss.bossKind, '| state:', ctx.G.boss && ctx.G.boss.state);
if (!ctx.G.boss) { console.log('SETUP FAILED'); process.exit(1); }

const weaponIds = Object.keys(ctx.WEAPONS);
const FRAMES = 12000;
let prevState = 'idle', charges = 0, flingShots = 0, maxEbul = 0;
try {
  for (let f = 0; f < FRAMES; f++) {
    if (f % 40 === 0) {
      for (const k of ['w', 'a', 's', 'd']) ctx.Input.keys[k] = false;
      ctx.Input.keys[['w', 'a', 's', 'd'][Math.floor(Math.random() * 4)]] = true;
    }
    if (ctx.G.boss) { ctx.Input.mx = ctx.G.boss.x; ctx.Input.my = ctx.G.boss.y; }
    ctx.Input.mdown = true;
    if (f % 900 === 0 && f > 0) {
      ctx.G.player.weapon = { id: weaponIds[Math.floor(Math.random() * weaponIds.length)], ammo: 999 };
    }
    if (ctx.G.boss) ctx.G.boss.hp = Math.min(ctx.G.boss.maxHp, ctx.G.boss.hp + 3);
    ctx.G.player.hp = 99999;
    if (ctx.G.mode === 'levelup') ctx.choosePerk(0);
    const ebulBefore = ctx.G.ebullets.length;
    step(1);
    if (ctx.G.boss && ctx.G.boss.state !== prevState) {
      if (ctx.G.boss.state === 'charge') charges++;
      prevState = ctx.G.boss.state;
    }
    if (ctx.G.ebullets.length > ebulBefore) flingShots += ctx.G.ebullets.length - ebulBefore;
    maxEbul = Math.max(maxEbul, ctx.G.ebullets.length);
    if (f % 1000 === 999) {
      console.log(`f${f + 1}: mode=${ctx.G.mode} state=${ctx.G.boss ? ctx.G.boss.state : 'dead'} enemies=${ctx.G.enemies.length} ebul=${ctx.G.ebullets.length} bossHp=${ctx.G.boss ? Math.round(ctx.G.boss.hp) : 'dead'}`);
    }
  }
} catch (e) {
  console.log('EXCEPTION in ' + SYS + ':', e.stack);
  process.exit(1);
}
console.log(`SOAK OK | charges=${charges} flingShots=${flingShots} maxEbul=${maxEbul}`);
