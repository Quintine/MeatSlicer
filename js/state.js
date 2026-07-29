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
  imagesLoaded: false,
  roomLayer: null,
  roomLayerKey: '',
  atmosphereLayer: null,
};

const PERK_POWER_WEIGHT = 0.5;
const PRESSURE_MIN = 0.75, PRESSURE_MAX = 1.60, PRESSURE_GAIN = 0.01;

// total player power: perks drafted (level - 1) + item tiers owned.
// monsters scale against this so difficulty tracks the build.
function powerScore() {
  const p = G.player;
  if (!p) return 0;
  let n = (p.level - 1) * PERK_POWER_WEIGHT;
  for (const iid in p.items) n += p.items[iid];
  return Math.max(0, n);
}

function addShake(n) { G.shake = Math.min(G.shake + n, 18); }
function addToast(text, sub) {
  G.toasts.push({ text, sub: sub || '', t: 0 });
  if (G.toasts.length > 3) G.toasts.shift();
}
function addScore(n) { G.score += n; }
