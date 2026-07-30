// Ammo economy calibration harness: simulates each special weapon in live
// headless combat and reports kills per magazine / per ammo pickup (refill).
// The design target is ~8-13 kills per refill — one ammo pickup should fund
// roughly the ~10 kills it takes to find the next one.
//
// Run: node tools/ammo_sim.js [weaponId ...]
// Exit code 1 if any simulated weapon lands outside the 8-13 band.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- deterministic RNG so runs are reproducible ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- fake canvas 2d context (same stub family as test/smoke.js) ----
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

function boot(seed) {
  let simTime = 0;
  const rng = mulberry32(seed);
  const mathShim = Object.create(Math);
  mathShim.random = rng;
  const canvasStub = {
    width: 960, height: 640, style: {},
    getContext: () => fakeCtx(),
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
  };
  const sandbox = {
    console,
    performance: { now: () => simTime },
    requestAnimationFrame: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => canvasStub },
    Image: class { constructor() { this.width = 32; this.height = 32; } set src(v) { this.onerror && this.onerror(); } },
    Audio: class {
      constructor() { this.volume = 0; this.paused = true; }
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
    },
    AudioContext: undefined,
    setTimeout: (fn) => fn(),
    Math: mathShim, JSON, Object, Array, Number, String, Boolean, Promise, Uint8ClampedArray, Proxy, Reflect, Set, Map, Date, Error, RegExp, parseInt, parseFloat, isNaN, Infinity, NaN, undefined,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  const files = ['utils', 'state', 'input', 'sfx', 'sfxbank', 'audio', 'sprites', 'particles', 'weapons',
    'bullets', 'pickups', 'items', 'perks', 'enemies', 'bosses', 'rooms', 'player', 'hud', 'help', 'main'];
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
  }
  vm.runInContext('Object.assign(this, { G, Input, WEAPONS, W, H, WALL, ENEMY_TYPES })', sandbox);
  sandbox.__tick = (dtMs) => { simTime += dtMs; sandbox.update(dtMs / 1000); sandbox.clearInputEdges(); };
  return sandbox;
}

// aim classes: how much simulated hand jitter the weapon class gets
const AIM_JITTER = {
  bullet: 0.07, spread: 0.05, bounce: 0.07, boomerang: 0.05, pierce_drag: 0.04,
  cone: 0.03, flame: 0.03,
  homing: 0, lob: 0, lob_trap: 0, lob_swarm: 0, slam: 0, saw: 0, beam: 0,
};

const FLOOR = 3;          // mid-game enemy mix
const CROWD = 8;          // enemies kept alive in the arena
const MAX_SECONDS = 240;  // dry-magazine safety valve

function simulate(wid, seed) {
  const ctx = boot(seed);
  const rng = mulberry32(seed ^ 0x9e3779b9); // outer-scope decisions stay seeded too
  const w = ctx.WEAPONS[wid];
  // skip menu straight into a run, then take over the arena
  vm.runInContext('startRun()', ctx);
  for (let i = 0; i < 5; i++) ctx.__tick(16);
  const G = ctx.G, p = G.player;
  G.floor = FLOOR;
  p.weapon = { id: wid, ammo: w.ammo };
  p.holstered = null;
  p.hp = p.stats.maxHp = 100000;      // unkillable for the measurement
  p.stats.magnet = 0;                 // never vacuum drops
  p.stats.xpMul = 0;                  // never level up
  p.stats.luck = 0;
  p.x = ctx.W / 2; p.y = ctx.H / 2;
  G.enemies = [];
  G.pickups = [];
  G.mode = 'play';

  // measure true weapon damage (direct hits + DoT ticks)
  let damage = 0;
  ctx.__simDamage = (n) => { damage += n; };
  vm.runInContext(`
    (() => {
      const origD = damageEnemy, origT = tickEnemyDamage;
      damageEnemy = function (e, dmg, ang, kb, opts) { __simDamage(dmg); return origD(e, dmg, ang, kb, opts); };
      tickEnemyDamage = function (e, amount) { __simDamage(amount); return origT(e, amount); };
    })()
  `, ctx);

  const killsAtStart = G.kills;
  const jitter = AIM_JITTER[w.behavior] || 0;
  let t = 0, chargeHeld = false;
  const dt = 1 / 60;

  while (p.weapon.id === wid && p.weapon.ammo > 0 && t < MAX_SECONDS) {
    // top up the arena with the floor's native mix (occasional elite).
    // Enemies arrive in small clusters at engagement range — the sim stands
    // in for a player fighting *in* a wave, not one waiting across the room.
    while (G.enemies.length < CROWD) {
      const cluster = 1 + Math.floor(rng() * 2.4); // 1-3 arriving together
      const a = rng() * Math.PI * 2;
      const d = 100 + rng() * 110;
      for (let c = 0; c < cluster && G.enemies.length < CROWD + 3; c++) {
        const ca = a + (rng() - 0.5) * 0.6;
        const cd = d + (rng() - 0.5) * 50;
        const ex = Math.max(ctx.WALL + 20, Math.min(ctx.W - ctx.WALL - 20, p.x + Math.cos(ca) * cd));
        const ey = Math.max(ctx.WALL + 20, Math.min(ctx.H - ctx.WALL - 20, p.y + Math.sin(ca) * cd));
        const elite = rng() < 0.09;
        G.enemies.push(ctx.makeEnemy(ctx.pickEnemyType(FLOOR), ex, ey, FLOOR, elite));
      }
      if (G.enemies.length >= CROWD) break;
    }

    // aim at the nearest living enemy (with class-appropriate hand jitter)
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const d2 = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
      if (d2 < bd) { bd = d2; best = e; }
    }
    if (best) {
      const baseA = Math.atan2(best.y - p.y, best.x - p.x);
      const off = jitter ? (rng() + rng() - 1) * jitter : 0;
      ctx.Input.mx = p.x + Math.cos(baseA + off) * 300;
      ctx.Input.my = p.y + Math.sin(baseA + off) * 300;
      if (w.behavior.startsWith('lob')) {
        // lobbed shots land where the cursor is, so lead moving targets
        const d = Math.sqrt(bd);
        const flight = Math.max(0.12, Math.min(0.8, d / 520));
        ctx.Input.mx = best.x + (best.vx || 0) * flight;
        ctx.Input.my = best.y + (best.vy || 0) * flight;
      }
    }

    // trigger scripting: beam needs charge/release cycles, everything else holds
    if (w.behavior === 'beam') {
      if (!chargeHeld) { ctx.Input.mdown = true; chargeHeld = true; }
      if (p.charge >= w.chargeTime) { ctx.Input.mdown = false; ctx.Input.mreleased = true; chargeHeld = false; }
    } else {
      ctx.Input.mdown = true;
    }

    G.pickups.length = 0; // drops never reach the player
    ctx.__tick(16);
    ctx.Input.mreleased = false;
    t += dt;
  }
  ctx.Input.mdown = false;

  const kills = G.kills - killsAtStart;
  const ammoUsed = w.ammo - Math.max(0, p.weapon.id === wid ? p.weapon.ammo : 0);
  return {
    id: wid, name: w.name,
    ammo: w.ammo, refill: w.refill,
    seconds: t,
    kills,
    damage,
    ammoUsed,
    dmgPerAmmo: damage / Math.max(1, ammoUsed),
    killsPerMag: kills,
    killsPerRefill: kills * (w.refill / Math.max(1, ammoUsed)),
  };
}

const args = process.argv.slice(2);
const ids = args.length ? args
  : Object.values(boot(1).WEAPONS).filter(w => w.ammo !== Infinity).map(w => w.id);

console.log('floor ' + FLOOR + ' arena, crowd ' + CROWD + ', deterministic seed');
console.log('weapon            ammo  refill   time   kills  dmg/ammo  kills/refill  band');
console.log('----------------  ----  ------  -----  -----  --------  ------------  ----');
let outOfBand = 0;
for (const wid of ids) {
  // average two seeds to dampen single-run luck without losing determinism
  const runs = [simulate(wid, 1337), simulate(wid, 9001)];
  const r = {
    id: wid, name: runs[0].name, ammo: runs[0].ammo, refill: runs[0].refill,
    seconds: (runs[0].seconds + runs[1].seconds) / 2,
    kills: (runs[0].kills + runs[1].kills) / 2,
    dmgPerAmmo: (runs[0].dmgPerAmmo + runs[1].dmgPerAmmo) / 2,
    killsPerRefill: (runs[0].killsPerRefill + runs[1].killsPerRefill) / 2,
  };
  const ok = r.killsPerRefill >= 8 && r.killsPerRefill <= 13;
  if (!ok) outOfBand++;
  console.log(
    r.name.padEnd(17),
    String(r.ammo).padStart(5),
    String(r.refill).padStart(7),
    (r.seconds.toFixed(1) + 's').padStart(7),
    r.kills.toFixed(0).padStart(6),
    r.dmgPerAmmo.toFixed(1).padStart(9),
    r.killsPerRefill.toFixed(1).padStart(12),
    (ok ? '  ok' : '  OUT') ,
  );
}
console.log(outOfBand ? '\n' + outOfBand + ' weapon(s) outside the 8-13 kills/refill band' : '\nall weapons inside the 8-13 kills/refill band');
process.exit(outOfBand ? 1 : 0);
