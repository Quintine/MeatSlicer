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
  brassmagazine: { name: 'Brass Magazine',   desc: '+10% ammo efficiency, +20% ammo found', rarity: 'common', cap: 5, apply: s => { s.ammoEff += 0.10; s.ammoPickupMul *= 1.20; } },
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
  ghoulheart:    { name: 'Ghoul Heart',      desc: '+4 max HP, heal 4',           rarity: 'uncommon', cap: 5, apply: (s, p) => { s.maxHp += 4; p.hp = Math.min(s.maxHp, p.hp + 4); } },

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

  // ---- phase 3 additions (small engine hooks) ----
  deadweight:    { name: 'Dead Weight',      desc: '+40% damage to enemies under 30% HP', rarity: 'uncommon', cap: 5, apply: s => { s.executeBonus += 0.40; } },
  cauterizedveins:{ name: 'Cauterized Veins', desc: '+15% ignite, +25% damage to burning enemies', rarity: 'uncommon', cap: 5, apply: s => { s.igniteChance += 0.15; s.burnDamageBonus += 0.25; } },
  hollowchoir:   { name: 'Hollow Choir',     desc: 'Every 4th shot fires a free extra volley', rarity: 'rare', cap: 3, apply: s => { s.choirEvery += 1; } },
  sawbonecoil:   { name: 'Sawbone Coil',     desc: 'Expiring bullets split into 2 shards', rarity: 'uncommon', cap: 5, apply: s => { s.sawboneCoil += 1; } },
  gluttonsgut:   { name: "Glutton's Gut",    desc: 'Hearts heal +1 extra; overheal becomes score', rarity: 'common', cap: 5, apply: s => { s.gluttonGut += 1; } },
  slaughterrhythm:{ name: 'Slaughter Rhythm', desc: '+4% fire rate per recent kill (cap +40%)', rarity: 'rare', cap: 3, apply: s => { s.slaughterRhythm += 0.04; } },
  painengine:    { name: 'Pain Engine',      desc: '+30% damage for 4s after being hit', rarity: 'rare', cap: 3, apply: s => { s.painEngine += 0.30; } },
  thresherplate: { name: 'Thresher Plate',   desc: 'Passive contact-damage aura', rarity: 'uncommon', cap: 5, apply: s => { s.thresherPlate += 1; } },
  bloodmoat:     { name: 'Blood Moat',       desc: 'Kills leave an acid pool',     rarity: 'uncommon', cap: 4, apply: s => { s.bloodMoat += 1; } },
  ironlung:      { name: 'Iron Lung',        desc: 'The first hit each room is blocked', rarity: 'rare', cap: 3, apply: s => { s.ironLung += 1; } },
  meathook:      { name: 'Meat Hook',        desc: 'Kills yank nearby enemies to the corpse', rarity: 'uncommon', cap: 4, apply: s => { s.meatHook += 1; } },
  blooddebt:     { name: 'Blood Debt',       desc: '+35% damage, −½ heart container', rarity: 'rare', cap: 3, apply: (s, p) => { s.dmgMul *= 1.35; s.maxHp = Math.max(1, s.maxHp - 1); p.hp = Math.min(p.hp, s.maxHp); } },

  // ---- phase 4: boss-exclusive legendaries (cap 1, curses allowed) ----
  butchersoath:  { name: "Butcher's Oath",   desc: '+80% damage, but max HP set to 2', rarity: 'legendary', cap: 1, apply: (s, p) => { s.dmgMul *= 1.8; s.maxHp = Math.min(s.maxHp, 2); p.hp = Math.min(p.hp, s.maxHp); } },
  secondskin:    { name: 'Second Skin',      desc: 'Revive once per floor at ½ heart', rarity: 'legendary', cap: 1, apply: s => { s.secondSkin += 1; } },
  twinsidearm:   { name: 'Twin Sidearm',     desc: 'Bone Popper double-taps; specials burn 2× ammo', rarity: 'legendary', cap: 1, apply: s => { s.twinSidearm += 1; } },
  crimsonmetronome:{ name: 'Crimson Metronome', desc: '+60% fire rate; every 8th shot lends ½ heart, repaid if you clear the room clean', rarity: 'legendary', cap: 1, apply: s => { s.rateMul *= 1.6; s.crimsonMetronome += 1; } },
  abattoirengine:{ name: 'Abattoir Engine',  desc: 'Pressure rises 2× faster; score and luck ×1.5', rarity: 'legendary', cap: 1, apply: s => { s.abattoirEngine += 1; s.luck += 0.5; } },
  gorecrown:     { name: 'Gore Crown',       desc: 'Free nova on every kill, −25% damage', rarity: 'legendary', cap: 1, apply: s => { s.goreCrown += 1; s.dmgMul *= 0.75; } },
  thousandteeth: { name: 'Thousand Teeth',   desc: '+6 shards that can crit, −40% base bullet damage', rarity: 'legendary', cap: 1, apply: s => { s.thousandTeeth += 1; s.dmgMul *= 0.6; } },
  hollowfather:  { name: 'Hollow Father',    desc: '3 damage-scaling orbitals, −25% fire rate', rarity: 'legendary', cap: 1, apply: s => { s.orbitals += 3; s.hollowFather += 1; s.rateMul *= 0.75; } },
  thelastcut:    { name: 'The Last Cut',     desc: 'At ½ heart: ×3 damage, +1s immunity', rarity: 'legendary', cap: 1, apply: s => { s.theLastCut += 1; } },
  meatgrinder:   { name: 'Meat Grinder',     desc: '12 dps aura within 90px, +1 damage taken per hit', rarity: 'legendary', cap: 1, apply: s => { s.meatGrinder += 1; } },
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
    addToast(item.name + ' ' + romanNum(lvl + 1), 'UPGRADED — ' + item.desc, 5.5);
    spawnText(p.x, p.y - 14, 'UPGRADED!', '#ffd060');
  } else {
    addToast(item.name, item.desc, 5.5);
    spawnText(p.x, p.y - 14, item.name.toUpperCase(), ITEM_RARITY[item.rarity].color);
  }
  if (item.rarity === 'legendary') Sfx.curse(); else Sfx.item();
  refreshOrbitals(p);
}

// spawn an item pedestal (item room / boss reward); source drives the pool roll
function spawnItemPedestal(x, y, iid, source) {
  spawnPickup('itemspot', x, y);
  spawnPickup('item', x, y, { iid: iid || rollItemId(source || 'room', G.floor) });
}

// ---- active items: room-clear charged, dedicated pedestal pickups ----
// Actives live in their own table so p.items (tier math + powerScore) stays clean.
// charges are granted by recordRoomClear: +1 per combat room, +2 per boss.
const ACTIVES = {
  bonenova:        { name: 'Bone Nova',        desc: 'Damage ring + hard knockback', cost: 2, use(p) {
    areaDamage(p.x, p.y, 150, 30 * p.stats.dmgMul, true, { source: 'player' });
    for (const e of G.enemies) { const a = angleTo(p.x, p.y, e.x, e.y); e.vx += Math.cos(a) * 500; e.vy += Math.sin(a) * 500; }
    spawnShockwave(p.x, p.y, 150, '#e8dcc2', 0.8); addShake(8);
  } },
  offalbomb:       { name: 'Offal Bomb',       desc: 'Gore bomb at the cursor',    cost: 1, use(p) {
    explodeAt(Input.mx, Input.my, 95, 25 * p.stats.dmgMul, true);
  } },
  bloodtransfusion:{ name: 'Blood Transfusion', desc: 'Heal 2 hearts, lose 25% current XP', cost: 2, use(p) {
    p.xp = Math.floor(p.xp * 0.75);
    healPlayer(4); spawnText(p.x, p.y - 16, '+2 HEARTS', '#d92038');
  } },
  cleaverstorm:    { name: 'Cleaver Storm',    desc: '12 orbiting cleavers for 6s', cost: 2, use(p) {
    p.cleaverStormT = 6;
  } },
  butchersbell:    { name: "Butcher's Bell",   desc: 'Pull every enemy in and stun 1s', cost: 2, use(p) {
    for (const e of G.enemies) {
      if (e.boss) continue;
      const a = angleTo(e.x, e.y, p.x, p.y);
      e.vx += Math.cos(a) * 700; e.vy += Math.sin(a) * 700;
      e.stunT = Math.max(e.stunT || 0, 1);
    }
    spawnShockwave(p.x, p.y, 320, '#c9a227', 0.7); addShake(6);
  } },
  marrowdraught:   { name: 'Marrow Draught',   desc: '+100% fire rate and free ammo for 5s', cost: 3, use(p) {
    p.marrowDraughtT = 5;
  } },
  slaughtertime:   { name: 'Slaughter Time',   desc: 'Enemies at 25% speed for 5s', cost: 3, use(p) {
    for (const e of G.enemies) e.slowT = Math.max(e.slowT || 0, 5);
  } },
  panicroom:       { name: 'Panic Room',       desc: '2.5s invulnerable, can\'t fire', cost: 3, use(p) {
    p.panicRoomT = 2.5;
    p.invT = Math.max(p.invT, 2.5);
  } },
  skinnerscoin:    { name: "Skinner's Coin",   desc: 'Clear all enemy bullets into gems', cost: 3, use(p) {
    for (const b of G.ebullets) spawnPickup('gem', b.x, b.y, { v: 1 });
    G.ebullets = [];
    spawnShockwave(p.x, p.y, 480, '#55f5dc', 0.5);
  } },
  gutreroll:       { name: 'Gut Reroll',       desc: 'Reroll the pedestal you\'re standing on', cost: 1, use(p) {
    for (const k of G.pickups) {
      if (k.type === 'item' && dist2(k.x, k.y, p.x, p.y) < 120 * 120) {
        k.iid = rollItemId('room', G.floor);
        spawnText(k.x, k.y - 40, 'REROLLED', '#e2472f');
        return;
      }
    }
    addToast('NO PEDESTAL', 'stand on an item pedestal to reroll it');
  } },
};

function useActive(force) {
  const p = G.player;
  if (!p.active || (G.mode !== 'play' && !force)) return;
  const a = ACTIVES[p.active.iid];
  if (!a) return;
  if (p.active.charges < a.cost) {
    addToast(a.name, 'not ready — clear ' + (a.cost - p.active.charges) + ' more room' + (a.cost - p.active.charges > 1 ? 's' : ''));
    Sfx.activeEmpty();
    return;
  }
  p.active.charges = 0;
  a.use(p);
  spawnText(p.x, p.y - 22, a.name.toUpperCase(), '#e2472f');
  Sfx.active();
}

// spawn an active pedestal (boss / item-room bonus drops)
function spawnActivePedestal(x, y) {
  spawnPickup('itemspot', x, y);
  spawnPickup('active', x, y, { aid: choice(Object.keys(ACTIVES)) });
}
