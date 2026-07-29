// ---- Isaac-style stacking passive items ----

const ITEMS = {
  hollowpoints:  { name: 'Hollow Points',    desc: '+25% damage',            apply: s => { s.dmgMul *= 1.25; } },
  twitch:        { name: 'Twitch Fibers',    desc: '+20% fire rate',         apply: s => { s.rateMul *= 1.20; } },
  scalpel:       { name: 'Scalpel',          desc: '+25% shot speed',        apply: s => { s.shotSpeedMul *= 1.25; } },
  leadmarrow:    { name: 'Lead Marrow',      desc: '+25% range',             apply: s => { s.rangeMul *= 1.25; } },
  piercegaze:    { name: 'Piercing Gaze',    desc: 'Shots pierce +1 enemy',  apply: s => { s.pierce += 1; } },
  ricochet:      { name: 'Ricochet Ribs',    desc: 'Shots bounce +1 time',   apply: s => { s.bounce += 1; } },
  splittongue:   { name: 'Split Tongue',     desc: 'Twin parallel shot',     apply: s => { s.split += 1; } },
  hydramaw:      { name: 'Hydra Maw',        desc: 'Fires 2 extra angled shots', apply: s => { s.fan += 1; } },
  homingtumor:   { name: 'Homing Tumor',     desc: 'Shots seek flesh (stronger per tier)', apply: s => { s.homing = (s.homing || 0) + 1; } },
  orbitalknives: { name: 'Orbital Knives',   desc: '+1 circling knife',      apply: s => { s.orbitals += 1; } },
  dentures:      { name: 'Vampire Dentures', desc: 'Kills may heal you',      apply: s => { s.lifestealChance += 0.04; } },
  volatilebile:  { name: 'Volatile Bile',    desc: 'Kills explode (bigger per tier)', apply: s => { s.explodeOnKill = (s.explodeOnKill || 0) + 1; } },
  backstabber:   { name: 'Backstabber',      desc: '+1 rear shot',           apply: s => { s.rear = (s.rear || 0) + 1; } },
  splinterbone:  { name: 'Splinter Bone',    desc: 'Shots shatter into +2 shards on hit', apply: s => { s.splinter = (s.splinter || 0) + 2; } },
  ironstomach:   { name: 'Iron Stomach',     desc: '+½ heart container, heal ½ heart', apply: (s, p) => { s.maxHp += 1; p.hp = Math.min(s.maxHp, p.hp + 1); } },
  luckycoin:     { name: 'Lucky Coin',       desc: 'Better drops',           apply: s => { s.luck += 0.2; } },
  magnetmaw:     { name: 'Magnet Maw',       desc: '+60% pickup radius',     apply: s => { s.magnet *= 1.6; } },
  bloodlust:     { name: 'Bloodlust',        desc: 'Kills may drop bonus XP', apply: s => { s.bloodlust = (s.bloodlust || 0) + 0.12; } },
  ghoulheart:    { name: 'Ghoul Heart',      desc: '+2 max HP, heal 2',      apply: (s, p) => { s.maxHp += 2; p.hp = Math.min(s.maxHp, p.hp + 2); } },
  chainsinew:    { name: 'Chain Sinew',       desc: 'Hits arc to +1 nearby enemy', apply: s => { s.chain += 1; } },
  mortarbone:    { name: 'Mortar Bone',       desc: 'Every sixth hit erupts', apply: s => { s.mortar += 1; } },
  bloatrounds:   { name: 'Bloat Rounds',      desc: '+25% attack size, +10% damage', apply: s => { s.sizeMul *= 1.25; s.dmgMul *= 1.10; } },
  marrowglut:    { name: 'Marrow Glut',       desc: '+20% damage, -10% fire rate', apply: s => { s.dmgMul *= 1.20; s.rateMul *= 0.90; } },
  hollowneedle:  { name: 'Hollow Needle',     desc: '+50% critical damage', apply: s => { s.critMul += 0.50; } },
  bloodshoteye:  { name: 'Bloodshot Eye',     desc: '+6% critical chance', apply: s => { s.crit += 0.06; } },
  flayerkiss:    { name: 'Flayer Kiss',       desc: 'Hits inflict heavy bleeding', apply: s => { s.bleed += 0.20; } },
  emberjar:      { name: 'Ember Jar',         desc: '20% chance to ignite', apply: s => { s.igniteChance += 0.20; } },
  acidgland:     { name: 'Acid Gland',        desc: 'Hits may leave acid pools', apply: s => { s.acidOnHit += 0.12; } },
  hookrounds:    { name: 'Hook Rounds',       desc: 'Hits pull enemies toward you', apply: s => { s.pullOnHit += 0.18; } },
  sledgerounds:  { name: 'Sledge Rounds',     desc: 'More knockback, hits may stun', apply: s => { s.knockbackMul *= 1.35; s.stunOnHit += 0.08; } },
  graftedtrigger:{ name: 'Grafted Trigger',   desc: '+18% fire rate', apply: s => { s.rateMul *= 1.18; } },
  deadmanswitch: { name: "Dead Man's Switch", desc: 'Kills trigger a fire-rate frenzy', apply: s => { s.frenzy += 0.12; } },
  orbitcrown:    { name: 'Orbit Crown',       desc: '+25% orbital speed and damage', apply: s => { s.orbSpeedMul *= 1.25; s.orbDmgMul *= 1.25; } },
  tannedhide:    { name: 'Tanned Hide',       desc: '+8% chance to ignore damage', apply: s => { s.armor += 0.08 / 0.92; } },
  deadmansclock: { name: "Dead Man's Clock", desc: '+0.25s hurt immunity', apply: s => { s.invBonus += 0.25; } },
  hollowbones:   { name: 'Hollow Bones',      desc: '+12% move speed', apply: s => { s.speedMul *= 1.12; } },
  boneplate:     { name: 'Bone Plate',        desc: '+½ shield heart each floor', apply: (s, p) => { s.shieldPerk = (s.shieldPerk || 0) + 1; p.shieldHp += 1; } },
  wormgut:       { name: 'Worm Gut',          desc: 'Heal ½ heart after combat rooms', apply: s => { s.roomHeal += 1; } },
  spinecage:     { name: 'Spine Cage',        desc: 'Contact attackers take damage', apply: s => { s.thorns += 8; } },
  secondstomach: { name: 'Second Stomach',    desc: '+½ heart and excess healing shields', apply: (s, p) => { s.maxHp += 1; s.overShield += 1; p.hp = Math.min(s.maxHp, p.hp + 1); } },
  spitewell:     { name: 'Spite Well',        desc: 'Taking damage releases a blood nova', apply: s => { s.retaliate += 10; } },
  twinhearts:    { name: 'Twin Hearts',       desc: '+1 max heart, heal 1 heart', apply: (s, p) => { s.maxHp += 2; p.hp = Math.min(s.maxHp, p.hp + 2); } },
  brassmagazine: { name: 'Brass Magazine',    desc: '15% less ammo use, +20% ammo found', apply: s => { s.ammoEff *= 1.15; s.ammoPickupMul *= 1.20; } },
  crowbait:      { name: 'Crow Bait',         desc: '+25% drop luck', apply: s => { s.luck += 0.25; } },
  gorgingleech:  { name: 'Gorging Leech',     desc: '+20% XP gained', apply: s => { s.xpMul *= 1.20; } },
  rerollrib:     { name: 'Reroll Rib',        desc: '+1 perk reroll each level', apply: s => { s.rerollPerLevel += 1; s.rerolls += 1; } },
};

// Stickiness ramps with commitment: 10% per distinct upgradable item owned,
// capped at 50%. Your first pickup barely biases the pool, so early drops vary.
function randomItemId() {
  const p = G.player;
  const owned = p ? Object.keys(p.items).filter(iid => (p.items[iid] || 0) < ITEM_LEVEL_CAP) : [];
  const stick = Math.min(0.5, owned.length * 0.10);
  if (owned.length && chance(stick)) return choice(owned);
  return choice(Object.keys(ITEMS));
}

const ITEM_LEVEL_CAP = 9;
function romanNum(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n - 1] || ('Lv' + n); }

// duplicate pickups upgrade the item's quality (effect re-applies per tier)
function giveItem(iid) {
  const p = G.player;
  const item = ITEMS[iid];
  const lvl = p.items[iid] || 0;
  if (lvl >= ITEM_LEVEL_CAP) {
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

// spawn an item pedestal (item room / boss reward)
function spawnItemPedestal(x, y, iid) {
  spawnPickup('itemspot', x, y);
  spawnPickup('item', x, y, { iid: iid || randomItemId() });
}
