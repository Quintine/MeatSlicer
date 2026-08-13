// ---- global game state ----
const W = 960, H = 640, TILE = 64, WALL = 48, DOOR_HALF = 44;

const G = {
  mode: 'menu',        // menu | play | levelup | pause | gameover
  time: 0,
  floor: 1,
  score: 0,
  kills: 0,
  player: null,
  rooms: {},           // "x,y" -> room
  cur: null,           // current room
  enemies: [],
  bullets: [],         // player projectiles
  ebullets: [],        // enemy projectiles
  pickups: [],
  parts: [],           // particles
  corpses: [],         // short-lived frame-animated deaths
  hazards: [],         // acid/fire pools, traps (hurt enemies)
  telegraphs: [],      // boss telegraphs -> effects (hurt player)
  toasts: [],
  shake: 0,
  flash: 0,            // red screen flash when hurt
  boss: null,          // live boss ref
  pendingLevelups: 0,
  perkChoices: null,
  autoPerk: false,
  pressure: 1,
  pressureDial: 0,
  streak: 0,
  shotLockT: 0,
  roomDamaged: false,
  roomEnterT: 0,
  recentHits: [],
  confirmAction: null,
  confirmT: 0,
  deathLockT: 0,
  transition: 0,       // room transition fade
  muted: false,
  pauseHelp: false,
  helpPage: 0,
  // debug console state (see js/debug.js); devMode is set in init()
  debugUsed: false,
  debugFlags: {},
  debugPage: 0,
  debugPin: false,
  debugTimescale: 1,
  debugFrameStep: false,
  sfxVol: 0.45,
  musicVol: 0.55,
  hudAlpha: 1,
  hdRemaster: false,
  imagesLoaded: false,
  roomLayer: null,
  roomLayerKey: '',
  atmosphereLayer: null,
  arena: { x0: WALL, y0: WALL, x1: W - WALL, y1: H - WALL, cx: W / 2, cy: H / 2, w: W - WALL * 2, h: H - WALL * 2 },
  cam: { x: 0, y: 0 },   // world coords of the viewport's top-left; 0,0 for every fit-to-screen room
};

const PERK_POWER_WEIGHT = 0.5;
// ammo economy: global dial for drop frequency (refill size is per-weapon)
const AMMO_DROP_SCALE = 0.75;
// Generic ammo refills track the live pressure dial at 80% of the HP scaling.
function ammoPressureMul() { return 1 + (G.pressure - 1) * 0.8; }
const STUN_UNIT = 0.03 / 0.97; // Sine Weave raw rating per stack, so the first stack = 3% stagger chance
const PRESSURE_MIN = 0.60, PRESSURE_MAX = 2.00;
// seconds a player-dropped weapon stays un-pickable (prevents instant swap loops)
const WEAPON_DROP_LOCKOUT = 2.5;
const PRESSURE_UNIT = 0.01;          // one "point" on the dial scale
const PRESSURE_GAIN = PRESSURE_UNIT; // retained: dial 0 == 1 point
const PRESSURE_DROP_BASE = 3;        // dial 0 == 0.03 relief base
const PRESSURE_RELIEF_MUL = 0.5;   // global brake: all pressure drops (hit relief + passive decay) are halved
const DEATH_LOCK = 3;
const PRESSURE_DIAL_MIN = -10, PRESSURE_DIAL_MAX = 10;

function hdScale() { return G.hdRemaster ? 4 : 1; }

// Preserve the old -5 / 0 / +5 balance while adding genuinely wider extremes.
function pressureGainUnits(dial) {
  const d = clamp(dial, PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX);
  if (d <= -5) return (d + 5) * 0.4;     // -10 -> -2, -5 -> 0
  if (d <= 0) return 1 + d * 0.2;        // -5 -> 0, 0 -> 1
  if (d <= 5) return 1 + d * 0.8;        // 0 -> 1, +5 -> 5
  return 5 + (d - 5);                    // +5 -> 5, +10 -> 10
}
function pressureDropUnits(dial) {
  const d = clamp(dial, PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX);
  if (d <= -5) return 5 - (d + 5) * 0.6; // -10 -> 8, -5 -> 5
  if (d <= 0) return 3 - d * 0.4;        // -5 -> 5, 0 -> 3
  if (d <= 5) return 3 - d * 0.6;        // 0 -> 3, +5 -> 0
  return 0;
}
function pressureGain()      { const base = pressureGainUnits(G.pressureDial) * PRESSURE_UNIT; return base * (G.player && G.player.stats.abattoirEngine > 0 ? 2 : 1); }
function pressureDropScale() { return pressureDropUnits(G.pressureDial) / PRESSURE_DROP_BASE; }

// total player power: perks drafted (level - 1) + item tiers owned, weighted by rarity.
// monsters scale against this so difficulty tracks the build.
function powerScore() {
  const p = G.player;
  if (!p) return 0;
  let n = (p.level - 1) * PERK_POWER_WEIGHT;
  for (const iid in p.items) n += p.items[iid] * ITEM_RARITY[ITEMS[iid].rarity].power;
  if (p.active) n += 2; // holding an active item is a flat power contribution
  return Math.max(0, n);
}

function addShake(n) { G.shake = Math.min(G.shake + n, 18); }
function addToast(text, sub, dur) {
  G.toasts.push({ text, sub: sub || '', t: 0, dur: dur || 2.5 });
  if (G.toasts.length > 3) G.toasts.shift();
}
function addScore(n) {
  if (!n) return;
  const scaled = Math.round(n * (G.pressure || 1));
  G.score += n > 0 ? Math.max(1, scaled) : scaled;
}

// Single mutation point for G.pressure. Three sites (hurt relief, room decay,
// room-clear gain) route here so the debug pressure-lock can freeze difficulty
// in one place. Each site already clamped to the same bounds.
function applyPressureDelta(d) {
  if (G.debugFlags && G.debugFlags.pressureLock) return;
  G.pressure = clamp(G.pressure + d, PRESSURE_MIN, PRESSURE_MAX);
}
