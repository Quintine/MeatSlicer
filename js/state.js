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
  roomDamaged: false,
  roomEnterT: 0,
  recentHits: [],
  transition: 0,       // room transition fade
  muted: false,
  pauseHelp: false,
  helpPage: 0,
  sfxVol: 0.45,
  musicVol: 0.55,
  hudAlpha: 1,
  imagesLoaded: false,
  roomLayer: null,
  roomLayerKey: '',
  atmosphereLayer: null,
};

const PERK_POWER_WEIGHT = 0.5;
// ammo economy: global dials for refill size and drop frequency
const AMMO_REFILL_SCALE = 0.75;
const AMMO_DROP_SCALE = 0.75;
const PRESSURE_MIN = 0.75, PRESSURE_MAX = 1.60;
const PRESSURE_UNIT = 0.01;          // one "point" on the dial scale
const PRESSURE_GAIN = PRESSURE_UNIT; // retained: dial 0 == 1 point
const PRESSURE_DROP_BASE = 3;        // dial 0 == 0.03 relief base
const PRESSURE_DIAL_MIN = -5, PRESSURE_DIAL_MAX = 5;

// -5 -> 0 units, 0 -> 1 unit, +5 -> 5 units (piecewise linear)
function pressureGainUnits(dial) { const d = clamp(dial, PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX); return d <= 0 ? 1 + d * 0.2 : 1 + d * 0.8; }
// -5 -> 5 units, 0 -> 3 units, +5 -> 0 units (piecewise linear)
function pressureDropUnits(dial) { const d = clamp(dial, PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX); return d <= 0 ? 3 - d * 0.4 : 3 - d * 0.6; }
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
function addToast(text, sub) {
  G.toasts.push({ text, sub: sub || '', t: 0 });
  if (G.toasts.length > 3) G.toasts.shift();
}
function addScore(n) {
  if (!n) return;
  const scaled = Math.round(n * (G.pressure || 1));
  G.score += n > 0 ? Math.max(1, scaled) : scaled;
}
