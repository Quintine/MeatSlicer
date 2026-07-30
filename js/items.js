// ---- Isaac-style stacking passive items ----

const ITEM_RARITY = {
  common:    { weight: 100, power: 0.5, color: '#c9b8ae' },
  uncommon:  { weight:  55, power: 1.0, color: '#6fb1c0' },
  rare:      { weight:  25, power: 1.5, color: '#c9a227' },
  legendary: { weight:   8, power: 3.0, color: '#e2472f' },
};

const ITEMS = {
  // ---- common ----
  hollowpoints:  { name: 'Hollow Points',    desc: '+25% damage',                 rarity: 'common', cap: 6, apply: s => { s.dmgMul *= 1.25; } },
  twitch:        { name: 'Twitch Fibers',    desc: '+20% fire rate',              rarity: 'common', cap: 6, apply: s => { s.rateMul *= 1.20; } },
  graftedtrigger:{ name: 'Grafted Trigger',  desc: '+18% fire rate, +6% shot speed', rarity: 'common', cap: 6, apply: s => { s.rateMul *= 1.18; s.shotSpeedMul *= 1.06; } },
  scalpel:       { name: 'Scalpel',          desc: '+25% shot speed',             rarity: 'common', cap: 8, apply: s => { s.shotSpeedMul *= 1.25; } },
  leadmarrow:    { name: 'Lead Marrow',      desc: '+25% range',                  rarity: 'common', cap: 8, apply: s => { s.rangeMul *= 1.25; } },
  bloodshoteye:  { name: 'Bloodshot Eye',    desc: '+6% critical chance',         rarity: 'common', cap: 8, apply: s => { s.crit += 0.06; } },
  hollowneedle:  { name: 'Hollow Needle',    desc: '+50% critical damage',        rarity: 'common', cap: 6, apply: s => { s.critMul += 0.50; } },
  luckycoin:     { name: 'Lucky Coin',       desc: 'Better drops',                rarity: 'common', cap: 5, apply: s => { s.luck += 0.2; } },
  crowbait:      { name: 'Crow Bait',        desc: '+15% luck, +25% pickup radius', rarity: 'common', cap: 5, apply: s => { s.luck += 0.15; s.magnet *= 1.25; } },
  magnetmaw:     { name: 'Magnet Maw',       desc: '+60% pickup radius',          rarity: 'common', cap: 3, apply: s => { s.magnet *= 1.6; } },
  gorgingleech:  { name: 'Gorging Leech',    desc: '+20% XP gained',              rarity: 'common', cap: 4, apply: s => { s.xpMul *= 1.20; } },
  hollowbones:   { name: 'Hollow Bones',     desc: '+14% move speed',             rarity: 'common', cap: 6, apply: s => { s.speedMul *= 1.14; } },
  brassmagazine: { name: 'Brass Magazine',   desc: '15% less ammo use, +20% ammo found', rarity: 'common', cap: 5, apply: s => { s.ammoEff *= 1.15; s.ammoPickupMul *= 1.20; } },
  ironstomach:   { name: 'Iron Stomach',     desc: '+½ heart container, heal ½ heart', rarity: 'common', cap: 8, apply: (s, p) => { s.maxHp += 1; p.hp = Math.min(s.maxHp, p.hp + 1); } },
  tannedhide:    { name: 'Tanned Hide',      desc: '+8% chance to ignore damage', rarity: 'common', cap: 6, apply: s => { s.armor += 0.08 / 0.92; } },
  bloodlust:     { name: 'Bloodlust',        desc: 'Kills may drop bonus XP',     rarity: 'common', cap: 5, apply: s => { s.bloodlust = (s.bloodlust || 0) + 0.12; } },

  // ---- uncommon ----
  bloatrounds:   { name: 'Bloat Rounds',     desc: '+25% attack size, +10% damage', rarity: 'uncommon', cap: 5, apply: s => { s.sizeMul *= 1.25; s.dmgMul *= 1.10; } },
  marrowglut:    { name: 'Marrow Glut',      desc: '+20% damage, -10% fire rate', rarity: 'uncommon', cap: 6, apply: s => { s.dmgMul *= 1.20; s.rateMul *= 0.90; } },
  piercegaze:    { name: 'Piercing Gaze',    desc: 'Shots pierce +1 enemy',       rarity: 'uncommon', cap: 5, apply: s => { s.pierce += 1; } },
  ricochet:      { name: 'Ricochet Ribs',    desc: 'Shots bounce +1 time',        rarity: 'uncommon', cap: 5, apply: s => { s.bounce += 1; } },
  flayerkiss:    { name: 'Flayer Kiss',      desc: 'Hits inflict heavy bleeding', rarity: 'uncommon', cap: 5, apply: s => { s.bleed += 0.20; } },
  emberjar:      { name: 'Ember Jar',        desc: '20% chance to ignite',        rarity: 'uncommon', cap: 5, apply: s => { s.igniteChance += 0.20; } },
  acidgland:     { name: 'Acid Gland',       desc: 'Hits may leave acid pools',   rarity: 'uncommon', cap: 6, apply: s => { s.acidOnHit += 0.12; } },
  hookrounds:    { name: 'Hook Rounds',      desc: 'Hits pull enemies toward you', rarity: 'uncommon', cap: 5, apply: s => { s.pullOnHit += 0.18; } },
  sledgerounds:  { name: 'Sledge Rounds',    desc: 'More knockback, hits may stun', rarity: 'uncommon', cap: 5, apply: s => { s.knockbackMul *= 1.35; s.stunOnHit += 0.08; } },
  chainsinew:    { name: 'Chain Sinew',       desc: 'Hits arc to +1 nearby enemy', rarity: 'uncommon', cap: 6, apply: s => { s.chain += 1; } },
  mortarbone:    { name: 'Mortar Bone',       desc: 'Every sixth hit erupts',     rarity: 'uncommon', cap: 5, apply: s => { s.mortar += 1; } },
  homingtumor:   { name: 'Homing Tumor',     desc: 'Shots seek flesh (stronger per tier)', rarity: 'uncommon', cap: 4, apply: s => { s.homing = (s.homing || 0) + 1; } },
  dentures:      { name: 'Vampire Dentures', desc: 'Kills may heal you',          rarity: 'uncommon', cap: 5, apply: s => { s.lifestealChance += 0.04; } },
  spinecage:     { name: 'Spine Cage',       desc: 'Contact attackers take damage', rarity: 'uncommon', cap: 5, apply: s => { s.thorns += 8; } },
  spitewell:     { name: 'Spite Well',       desc: 'Taking damage releases a blood nova', rarity: 'uncommon', cap: 5, apply: s => { s.retaliate += 10; } },
  orbitcrown:    { name: 'Orbit Crown',      desc: '+25% orbital speed and damage', rarity: 'uncommon', cap: 5, apply: s => { s.orbSpeedMul *= 1.25; s.orbDmgMul *= 1.25; } },
  ghoulheart:    { name: 'Ghoul Heart',      desc: '+2 max HP, heal 2',           rarity: 'uncommon', cap: 5, apply: (s, p) => { s.maxHp += 2; p.hp = Math.min(s.maxHp, p.hp + 2); } },

  // ---- rare ----
  splittongue:   { name: 'Split Tongue',     desc: 'Twin parallel shot',          rarity: 'rare', cap: 3, apply: s => { s.split += 1; } },
  hydramaw:      { name: 'Hydra Maw',        desc: 'Fires 2 extra angled shots',  rarity: 'rare', cap: 3, apply: s => { s.fan += 1; } },
  backstabber:   { name: 'Backstabber',      desc: '+1 rear shot',                rarity: 'rare', cap: 3, apply: s => { s.rear = (s.rear || 0) + 1; } },
  splinterbone:  { name: 'Splinter Bone',    desc: 'Shots shatter into +2 shards on hit', rarity: 'rare', cap: 3, apply: s => { s.splinter = (s.splinter || 0) + 2; } },
  orbitalknives: { name: 'Orbital Knives',   desc: '+1 circling knife',           rarity: 'rare', cap: 3, apply: s => { s.orbitals += 1; } },
  volatilebile:  { name: 'Volatile Bile',    desc: 'Kills explode (bigger per tier)', rarity: 'rare', cap: 3, apply: s => { s.explodeOnKill = (s.explodeOnKill || 0) + 1; } },
  deadmanswitch: { name: "Dead Man's Switch", desc: 'Kills trigger a fire-rate frenzy', rarity: 'rare', cap: 3, apply: s => { s.frenzy += 0.12; } },
  boneplate:     { name: 'Bone Plate',       desc: '+½ shield heart each floor',  rarity: 'rare', cap: 3, apply: (s, p) => { s.shieldPerk = (s.shieldPerk || 0) + 1; p.shieldHp += 1; } },
  wormgut:       { name: 'Worm Gut',         desc: 'Heal ½ heart after combat rooms', rarity: 'rare', cap: 3, apply: s => { s.roomHeal += 1; } },
  secondstomach: { name: 'Second Stomach',   desc: '+½ heart and excess healing shields', rarity: 'rare', cap: 3, apply: (s, p) => { s.maxHp += 1; s.overShield += 1; p.hp = Math.min(s.maxHp, p.hp + 1); } },
  twinhearts:    { name: 'Twin Hearts',      desc: '+1 max heart, heal to full',  rarity: 'rare', cap: 3, apply: (s, p) => { s.maxHp += 2; p.hp = s.maxHp; } },
  deadmansclock: { name: "Dead Man's Clock", desc: '+0.25s hurt immunity',        rarity: 'rare', cap: 3, apply: s => { s.invBonus += 0.25; } },
  rerollrib:     { name: 'Reroll Rib',       desc: '+1 perk reroll each level',   rarity: 'rare', cap: 2, apply: s => { s.rerollPerLevel += 1; s.rerolls += 1; } },

  // ---- phase 2 additions (clean, no new engine hooks) ----
  chillgland:    { name: 'Chill Gland',      desc: '18% chance to chill',         rarity: 'uncommon', cap: 5, apply: s => { s.slowOnHit += 0.18; } },
  hookedsinew:   { name: 'Hooked Sinew',     desc: '+30% pickup pull speed, +10% radius', rarity: 'common', cap: 5, apply: s => { s.magnetPull *= 1.30; s.magnet *= 1.10; } },
  gyroscopicribs:{ name: 'Gyroscopic Ribs',  desc: '+2 bounce, +10% range',       rarity: 'uncommon', cap: 4, apply: s => { s.bounce += 2; s.rangeMul *= 1.10; } },
  marrowpiston:  { name: 'Marrow Piston',    desc: '+30% knockback, +12% attack size', rarity: 'common', cap: 5, apply: s => { s.knockbackMul *= 1.30; s.sizeMul *= 1.12; } },
  splitcortex:   { name: 'Split Cortex',     desc: '+1 pierce, +1 chain',         rarity: 'rare', cap: 3, apply: s => { s.pierce += 1; s.chain += 1; } },
  gristlecord:   { name: 'Gristle Cord',     desc: '+0.12s hurt immunity, +4% armor', rarity: 'uncommon', cap: 4, apply: s => { s.invBonus += 0.12; s.armor += 0.04; } },
  renderedfat:   { name: 'Rendered Fat',     desc: '+½ heart, +4% armor',         rarity: 'common', cap: 6, apply: (s, p) => { s.maxHp += 1; s.armor += 0.04; p.hp = Math.min(s.maxHp, p.hp + 1); } },
  whipcordtendon:{ name: 'Whipcord Tendon',  desc: '+20% range, +8% fire rate',   rarity: 'uncommon', cap: 5, apply: s => { s.rangeMul *= 1.20; s.rateMul *= 1.08; } },
  rusteddiadem:  { name: 'Rusted Diadem',    desc: '+40% orbital speed',          rarity: 'uncommon', cap: 5, apply: s => { s.orbSpeedMul *= 1.40; } },
  gorgedtick:    { name: 'Gorged Tick',      desc: '+15% XP, +10% luck',          rarity: 'common', cap: 5, apply: s => { s.xpMul *= 1.15; s.luck += 0.10; } },
  bonemealpowder:{ name: 'Bonemeal Powder',  desc: '+15% damage, +15% shot speed', rarity: 'common', cap: 6, apply: s => { s.dmgMul *= 1.15; s.shotSpeedMul *= 1.15; } },
  rimedfang:     { name: 'Rimed Fang',       desc: '+4% crit chance, +25% crit damage', rarity: 'common', cap: 6, apply: s => { s.crit += 0.04; s.critMul += 0.25; } },
  butcherstwine: { name: 'Butcher\'s Twine', desc: '+12% bleed, +8% fire rate',   rarity: 'uncommon', cap: 5, apply: s => { s.bleed += 0.12; s.rateMul *= 1.08; } },
  cindersump:    { name: 'Cinder Sump',      desc: '+12% ignite, +12% acid',      rarity: 'uncommon', cap: 5, apply: s => { s.igniteChance += 0.12; s.acidOnHit += 0.12; } },
};

const ITEM_LEVEL_CAP = 9;
function itemCap(iid) { return ITEMS[iid].cap ?? ITEM_LEVEL_CAP; }

function romanNum(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n - 1] || ('Lv' + n); }

// ---- pools: hybrid weighted table, legendaries are boss-only ----
const ITEM_POOL_WEIGHTS = {
  elite: { common: 100, uncommon: 45, rare:  8, legendary: 0 },
  room:  { common:  45, uncommon: 85, rare: 40, legendary: 0 },
  boss:  { common:  12, uncommon: 45, rare: 70, legendary: 45 },
};
const ITEM_POOL_STICK = { elite: 1.0, room: 0.7, boss: 0.35 };

function rollItemId(source, floor) {
  const p = G.player;
  const w = ITEM_POOL_WEIGHTS[source] || ITEM_POOL_WEIGHTS.room;
  const f = floor || G.floor || 1;

  // distinct upgradable items owned, not yet at their own cap
  const owned = p ? Object.keys(p.items).filter(iid => (p.items[iid] || 0) < itemCap(iid)) : [];
  const stick = Math.min(0.5, owned.length * 0.10) * (ITEM_POOL_STICK[source] || 1);
  if (owned.length && chance(stick)) return choice(owned);

  // floor-scaled rarity table, boss-excluding legendaries from non-boss sources
  const floorScale = {
    common: Math.max(0.4, 1 - f * 0.05),
    uncommon: 1,
    rare: 1 + f * 0.08,
    legendary: 1 + f * 0.10,
  };
  let total = 0;
  const weights = {};
  for (const r in w) {
    const rw = w[r] * floorScale[r];
    weights[r] = rw;
    total += rw;
  }
  let roll = Math.random() * total;
  let band = 'common';
  for (const r in weights) { roll -= weights[r]; if (roll <= 0) { band = r; break; } }

  // candidates in the band that are not already capped
  let pool = Object.keys(ITEMS).filter(iid => ITEMS[iid].rarity === band && (p ? (p.items[iid] || 0) < itemCap(iid) : true));
  // if the band is exhausted, fall back to any unmaxed item
  if (!pool.length) pool = Object.keys(ITEMS).filter(iid => p ? (p.items[iid] || 0) < itemCap(iid) : true);
  // absolute fallback: full pool (everything capped -> giveItem converts to score)
  if (!pool.length) pool = Object.keys(ITEMS);
  return choice(pool);
}

// legacy alias used by tests / older call sites
function randomItemId() { return rollItemId('room', G.floor); }

// duplicate pickups upgrade the item's quality (effect re-applies per tier)
function giveItem(iid) {
  const p = G.player;
  const item = ITEMS[iid];
  const lvl = p.items[iid] || 0;
  const cap = itemCap(iid);
  if (lvl >= cap) {
    addScore(150);
    spawnGems(p.x, p.y, 5);
    addToast(item.name + ' MAX', 'already mastered — +150 score');
    Sfx.pickup();
    return;
  }
  item.apply(p.stats, p);
  p.items[iid] = lvl + 1;
  if (lvl > 0) {
    addToast(item.name + ' ' + romanNum(lvl + 1), 'UPGRADED — ' + item.desc);
    spawnText(p.x, p.y - 14, 'UPGRADED!', '#ffd060');
  } else {
    addToast(item.name, item.desc);
    spawnText(p.x, p.y - 14, item.name.toUpperCase(), '#c9a227');
  }
  Sfx.item();
  refreshOrbitals(p);
}

// spawn an item pedestal (item room / boss reward); source drives the pool roll
function spawnItemPedestal(x, y, iid, source) {
  spawnPickup('itemspot', x, y);
  spawnPickup('item', x, y, { iid: iid || rollItemId(source || 'room', G.floor) });
}
