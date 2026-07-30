// ---- The Butcher's Arsenal: 16 horrorcore weapons ----
// behavior: bullet | spread | boomerang | bounce | cone | flame | homing |
//           pierce_drag | lob | lob_trap | lob_swarm | slam | saw | beam

// Ammo economy: `ammo` is the magazine (trigger-time / burst feel), `refill`
// is what one ammo pickup hands back (~10 kills' worth). Sustained-stream
// weapons use `drain` (ammo per second while held) instead of per-shot cost.
// Calibrated with tools/ammo_sim.js — every weapon should land ~8-13 kills
// per refill at base stats.
const WEAPONS = {
  bonepopper:  { id: 'bonepopper',  name: 'Bone Popper',      held: 38, torsoW: 106, torsoFwd: 18, muzzle: 62, tier: -1, ammo: Infinity, interval: 0.60, dmg: 8,  spd: 540, range: 0.45, behavior: 'bullet',      sprite: 'bullet_bone',    sfx: 'default',   punch: 0.42, desc: 'Trusty bone-shard sidearm' },
  repeater:    { id: 'repeater',    name: 'Ribcage Repeater', held: 52, torsoW: 120, torsoFwd: 20, muzzle: 70, tier: 0,  ammo: 84, refill: 42, interval: 0.09, dmg: 6,  spd: 560, spread: 0.10, range: 0.42, behavior: 'bullet', sprite: 'bullet_bone', sfx: 'rapid', punch: 0.18, desc: 'Rattles off rib slivers' },
  marrow:      { id: 'marrow',      name: 'Marrow Scatter',   held: 54, torsoW: 120, torsoFwd: 20, muzzle: 69, tier: 0,  ammo: 20, refill: 6,  interval: 0.58, dmg: 11, spd: 500, pellets: 6, spread: 0.55, range: 0.38, behavior: 'spread', sprite: 'bullet_bone', sfx: 'spread', punch: 0.92, desc: 'A devastating close blast of jagged bone' },
  cleaver:     { id: 'cleaver',     name: 'Cleaver Cadence',  held: 60, torsoW: 124, torsoFwd: 21, muzzle: 73, tier: 1,  ammo: 26, refill: 10, interval: 0.38, dmg: 15, spd: 400, range: 1.10, behavior: 'boomerang',   sprite: 'bullet_cleaver', sfx: 'boomerang', punch: 0.42, desc: 'It always comes back' },
  saw:         { id: 'saw',         name: 'Sawblade Launcher',held: 52, torsoW: 118, torsoFwd: 20, muzzle: 70, tier: 1,  ammo: 24, refill: 9,  interval: 0.34, dmg: 13, spd: 360, bounces: 5, range: 0.60, behavior: 'bounce', sprite: 'bullet_saw', sfx: 'saw', punch: 0.45, desc: 'Bouncing, hungry steel' },
  bile:        { id: 'bile',        name: 'Bile Blunderbuss', held: 54, torsoW: 118, torsoFwd: 20, muzzle: 68, tier: 2,  ammo: 80, refill: 21, drain: 8, interval: 0.12, dmg: 7,  spd: 340, spread: 0.32, range: 0.38, behavior: 'cone', sprite: 'bullet_gore', sfx: 'flame', punch: 0.34, desc: 'A brutal corrosive torrent; pools linger' },
  hemophage:   { id: 'hemophage',   name: 'Hemophage',        held: 50, torsoW: 116, torsoFwd: 19, muzzle: 67, tier: 1,  ammo: 70, refill: 42, interval: 0.19, dmg: 8,  spd: 480, lifesteal: 0.5, range: 0.45, behavior: 'bullet', sprite: 'bullet_syringe', sfx: 'default', punch: 0.35, desc: 'Drinks what it touches' },
  eye:         { id: 'eye',         name: 'Eye Ballista',     held: 58, torsoW: 120, torsoFwd: 20, muzzle: 70, tier: 1,  ammo: 42, refill: 21, interval: 0.30, dmg: 10, spd: 320, range: 0.62, behavior: 'homing',      sprite: 'bullet_eye',     sfx: 'default', punch: 0.40, desc: 'The eyes follow. They always follow' },
  guthook:     { id: 'guthook',     name: 'Gut Hook',         held: 64, torsoW: 128, torsoFwd: 22, muzzle: 76, tier: 2,  ammo: 11, refill: 5,  interval: 0.85, dmg: 48, spd: 720, range: 0.60, behavior: 'pierce_drag', sprite: 'bullet_harpoon', sfx: 'heavy', punch: 0.95, desc: 'Impales and drags the catch' },
  cauterizer:  { id: 'cauterizer',  name: 'The Cauterizer',   held: 58, torsoW: 128, torsoFwd: 22, muzzle: 76, tier: 3,  ammo: 110, refill: 21, drain: 12, interval: 0.05, dmg: 4.5, spd: 310, spread: 0.34, range: 0.36, behavior: 'flame', sprite: 'bullet_gore', sfx: 'flame', punch: 0.32, desc: 'Incinerates anything brave enough to get close' },
  fleshmasher: { id: 'fleshmasher', name: 'Flesh Masher',     held: 62, torsoW: 128, torsoFwd: 22, muzzle: 76, tier: 2,  ammo: 14, refill: 4,  interval: 0.75, dmg: 34, spd: 999, behavior: 'lob',         sprite: 'bullet_gore',    sfx: 'lob', punch: 0.90, desc: 'Lobs ground-meat bombs' },
  trapqueen:   { id: 'trapqueen',   name: 'Trap Queen',       held: 58, torsoW: 124, torsoFwd: 21, muzzle: 73, tier: 2,  ammo: 26, refill: 13, interval: 0.55, dmg: 10, spd: 999, behavior: 'lob_trap',    sprite: 'bullet_saw',     sfx: 'lob', punch: 0.65, desc: 'Bear traps. For bears. And worse' },
  tenderizer:  { id: 'tenderizer',  name: 'The Tenderizer',   held: 66, torsoW: 132, torsoFwd: 23, muzzle: 78, tier: 3,  ammo: 10, refill: 5,  interval: 0.58, dmg: 60, spd: 0,   behavior: 'slam',        sprite: 'bullet_bone',    sfx: 'heavy', punch: 1.00, desc: 'A room-shaking close-range meat paste' },
  redhand:     { id: 'redhand',     name: 'Red Right Hand',   held: 68, torsoW: 134, torsoFwd: 24, muzzle: 80, tier: 2,  ammo: 150, refill: 72, drain: 18, interval: 0.10, dmg: 7,  spd: 0,   behavior: 'saw',         sprite: 'bullet_saw',     sfx: 'saw', punch: 0.38, desc: 'A chainsaw that liquefies anything in reach' },
  spinaltap:   { id: 'spinaltap',   name: 'Spinal Tap',       held: 68, torsoW: 136, torsoFwd: 24, muzzle: 81, tier: 3,  ammo: 7,  refill: 4,  interval: 0.30, dmg: 95, spd: 0,   chargeTime: 0.85, behavior: 'beam', sprite: 'bullet_bone', sfx: 'beam', punch: 1.00, desc: 'Charge it. Delete a line of meat' },
  swarmjar:    { id: 'swarmjar',    name: 'Swarm Jar',        held: 62, torsoW: 124, torsoFwd: 21, muzzle: 73, tier: 3,  ammo: 12, refill: 6,  interval: 0.80, dmg: 9,  spd: 999, behavior: 'lob_swarm',   sprite: 'bullet_gore',    sfx: 'lob', punch: 0.70, desc: 'A jar of friends. They are hungry' },
};

// rarity weights per tier, by floor
function rollWeaponDrop(floor) {
  const table = [
    { tier: 0, w: Math.max(20, 60 - floor * 5) },
    { tier: 1, w: 30 + floor * 2 },
    { tier: 2, w: 10 + floor * 3 },
    { tier: 3, w: Math.min(4 + floor * 2, 22) },
  ];
  const total = table.reduce((s, t) => s + t.w, 0);
  let r = Math.random() * total;
  let tier = 0;
  for (const t of table) { r -= t.w; if (r <= 0) { tier = t.tier; break; } }
  const pool = Object.values(WEAPONS).filter(w => w.tier === tier);
  return choice(pool);
}

// spawn player projectiles for one trigger pull (called when weapon fires)
function fireWeapon(p, w) {
  const st = p.stats;
  const ang = p.aim;
  const muzzle = w.muzzle || 35;
  const bx = p.x + Math.cos(ang) * muzzle, by = p.y + Math.sin(ang) * muzzle;
  const dmgMul = st.dmgMul * st.dmgLiveMul;
  const spdMul = st.shotSpeedMul;
  spawnMuzzleFx(bx, by, ang, w.behavior);

  // One shared volley shape makes split/fan/rear items useful for every
  // projectile weapon instead of only the basic bullet behavior.
  const volley = [ang];
  for (let i = 1; i <= st.split; i++) volley.push(ang + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.035);
  for (let i = 1; i <= st.fan; i++) { volley.push(ang + 0.16 * i); volley.push(ang - 0.16 * i); }
  for (let i = 1; i <= st.rear; i++) volley.push(ang + Math.PI + (i - (st.rear + 1) / 2) * 0.18);

  const mk = (a, overrides) => {
    const b = Object.assign({
      x: bx, y: by, ang: a,
      spawnX: p.x, spawnY: p.y,
      vx: Math.cos(a) * w.spd * spdMul, vy: Math.sin(a) * w.spd * spdMul,
      r: 5 * st.sizeMul, dmg: w.dmg * dmgMul, pierce: st.pierce, bounce: st.bounce,
      life: (w.range || 0.45) * st.rangeMul,
      t: 0, behavior: w.behavior, sprite: w.sprite,
      homing: w.behavior === 'homing' ? 6 + st.homing * 0.7 : (st.homing ? 1.6 + st.homing * 0.7 : 0),
      lifesteal: w.lifesteal || 0,
      bounces: w.bounces || 0, hit: null, dragTarget: null,
      rangeMul: st.rangeMul, sizeMul: st.sizeMul,
    }, overrides || {});
    G.bullets.push(b);
    return b;
  };

  switch (w.behavior) {
    case 'spread': {
      // Split adds both full volleys and a little density to a shotgun blast.
      const n = w.pellets + st.split;
      for (const center of volley) {
        for (let i = 0; i < n; i++) mk(center + rand(-w.spread, w.spread) * (0.5 + i / n));
      }
      break;
    }
    case 'cone': case 'flame': {
      for (const center of volley) {
        for (let i = 0; i < 2; i++) mk(center + rand(-w.spread, w.spread), { pierce: 2 + st.pierce, r: 6 * st.sizeMul });
      }
      break;
    }
    case 'boomerang': {
      for (const a of volley) mk(a, { r: 8 * st.sizeMul, pierce: st.pierce, phase: 0, life: (w.range || 1.1) * st.rangeMul });
      break;
    }
    case 'pierce_drag': {
      for (const a of volley) mk(a, { r: 7 * st.sizeMul, pierce: st.pierce, life: (w.range || 0.6) * st.rangeMul });
      break;
    }
    case 'lob': case 'lob_trap': case 'lob_swarm': {
      const primaryD = Math.max(dist(bx, by, Input.mx, Input.my), 1);
      for (let i = 0; i < volley.length; i++) {
        const a = volley[i];
        const tx = i === 0 ? Input.mx : p.x + Math.cos(a) * primaryD;
        const ty = i === 0 ? Input.my : p.y + Math.sin(a) * primaryD;
        const d = Math.max(dist(bx, by, tx, ty), 1);
        const flight = clamp(d / (520 * spdMul), 0.12, 0.8);
        mk(a, {
          vx: (tx - bx) / flight, vy: (ty - by) / flight,
          r: 7 * st.sizeMul, pierce: st.pierce, bounce: st.bounce,
          life: flight, lobbed: true,
        });
      }
      break;
    }
    case 'slam': {
      const inert = 1 + (st.pierce + st.bounce + st.homing) * 0.06;
      for (const a of volley) {
        const reach = 46 * st.rangeMul * Math.sqrt(st.shotSpeedMul);
        const cx = p.x + Math.cos(a) * reach, cy = p.y + Math.sin(a) * reach;
        const radius = 70 * st.rangeMul * Math.sqrt(st.sizeMul);
        areaDamage(cx, cy, radius, w.dmg * dmgMul * inert, true, { source: 'player' });
        spawnExplosionFx(cx, cy, radius);
      }
      Sfx.explode({ x: p.x + Math.cos(ang) * 46, y: p.y + Math.sin(ang) * 46 });
      break;
    }
    default: { // bullet, bounce and homing projectiles
      for (const a of volley) mk(a + rand(-(w.spread || 0), w.spread || 0));
    }
  }
}

// continuous chainsaw damage while held (def = weapon stats; the caller owns
// the time-denominated ammo drain, so inst is only kept for signature stability)
function sawTick(p, def, inst, dt) {
  const st = p.stats;
  const angles = [p.aim];
  for (let i = 1; i <= st.split; i++) angles.push(p.aim + (i % 2 ? 1 : -1) * 0.18);
  for (let i = 1; i <= st.fan; i++) { angles.push(p.aim + i * 0.28); angles.push(p.aim - i * 0.28); }
  for (let i = 1; i <= st.rear; i++) angles.push(p.aim + Math.PI + (i - (st.rear + 1) / 2) * 0.18);
  const inert = 1 + (st.pierce + st.bounce + st.homing) * 0.06;
  let hitAny = false;
  for (const a of angles) {
    const reach = 30 * st.rangeMul * Math.sqrt(st.shotSpeedMul);
    const cx = p.x + Math.cos(a) * reach, cy = p.y + Math.sin(a) * reach;
    const radius = 34 * Math.sqrt(st.sizeMul);
    for (const e of G.enemies) {
      if (dist2(cx, cy, e.x, e.y) < (radius + e.r) * (radius + e.r)) {
        const tickScale = dt / Math.max(0.01, def.interval || 0.1);
        damageEnemy(e, def.dmg * st.dmgMul * st.dmgLiveMul * st.rateMul * inert * tickScale, a, false, {
          source: 'player', procScale: tickScale, procIntervalScale: tickScale,
        });
        hitAny = true;
      }
    }
    if (chance(Math.min(1, dt * 20))) spawnSpark(cx, cy, a);
    if (hitAny) spawnBlood(cx, cy, a, 4);
  }
  if (hitAny) Sfx.sawHit({ x: p.x, y: p.y });
  // ammo cost is time-denominated and handled by the caller (player.js)
}

// fire the Spinal Tap beam
function fireBeam(p, def, charge) {
  const st = p.stats;
  const angles = [p.aim];
  for (let i = 1; i <= st.split; i++) angles.push(p.aim + (i % 2 ? 1 : -1) * 0.025);
  for (let i = 1; i <= st.fan; i++) { angles.push(p.aim + 0.16 * i); angles.push(p.aim - 0.16 * i); }
  for (let i = 1; i <= st.rear; i++) angles.push(p.aim + Math.PI + (i - (st.rear + 1) / 2) * 0.18);
  const len = 900 * st.rangeMul;
  const inert = 1 + (st.pierce + st.bounce + st.homing) * 0.06;
  const dmg = def.dmg * st.dmgMul * st.dmgLiveMul * (0.4 + 0.6 * charge) * inert;
  const width = 14 * Math.sqrt(st.sizeMul);
  for (const ang of angles) {
    const x2 = p.x + Math.cos(ang) * len, y2 = p.y + Math.sin(ang) * len;
    for (const e of G.enemies) {
      if (distToSegment(e.x, e.y, p.x, p.y, x2, y2) < e.r + width) {
        damageEnemy(e, dmg, ang, true, { source: 'player' });
      }
    }
    spawnBeam(p.x, p.y, ang, len);
  }
  const ang = p.aim;
  const muzzle = def.muzzle || 35;
  spawnMuzzleFx(p.x + Math.cos(ang) * muzzle, p.y + Math.sin(ang) * muzzle, ang, 'beam');
  p.recoil = 1;
  p.muzzleT = 0.11;
  p.attackT = 0.5;
  p.actionT = 0;
  addShake(8);
  Sfx.shoot(def);
  p.weapon.ammo -= 1 / st.ammoEff;
}

// damage every enemy in a radius (slams, explosions)
function areaDamage(x, y, r, dmg, knockback, opts) {
  for (const e of G.enemies) {
    const d = dist(x, y, e.x, e.y);
    if (d < r + e.r) {
      damageEnemy(e, dmg, angleTo(x, y, e.x, e.y), knockback, opts);
    }
  }
}
