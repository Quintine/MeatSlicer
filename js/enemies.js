// ---- enemy types, AI, damage & death ----

const ENEMY_TYPES = {
  shambler: { hp: 26,  spd: 55,  dmg: 1, r: 18, drawSize: 64, xp: 1, sprite: 'enemy_shambler' },
  runner:   { hp: 12,  spd: 236, dmg: 1, r: 15, drawSize: 64, xp: 1, sprite: 'enemy_runner' },
  spitter:  { hp: 20,  spd: 60,  dmg: 1, r: 18, drawSize: 64, xp: 2, sprite: 'enemy_spitter', ranged: true },
  splitter: { hp: 30,  spd: 70,  dmg: 1, r: 21, drawSize: 64, xp: 1, sprite: 'enemy_splitter', splits: true },
  mini:     { hp: 6,   spd: 120, dmg: 1, r: 14, drawSize: 48, xp: 1, sprite: 'enemy_mini' },
  exploder: { hp: 14,  spd: 110, dmg: 2, r: 16, drawSize: 64, xp: 2, sprite: 'enemy_exploder', explodes: true },
};
const MAX_ENEMIES = 72;
const SPAWN_WARN = 0.5; // seconds a wave-spawned enemy materializes, frozen + harmless
const HP_BAR_SHOW = 2.5;

function makeEnemy(type, x, y, floor, elite) {
  const t = ENEMY_TYPES[type];
  const up = powerScore();
  // floor scaling × player-power scaling (+5% hp / +1% speed per upgrade)
  const fscale = (1 + (floor - 1) * 0.22) * (1 + up * 0.05);
  const sscale = 1 + (floor - 1) * 0.04 + up * 0.01;
  const e = {
    type, x, y, vx: 0, vy: 0,
    r: t.r * (elite ? 1.45 : 1),
    drawSize: t.drawSize * (elite ? 1.5 : 1),
    hp: t.hp * fscale * (elite ? 2.6 : 1) * G.pressure,
    maxHp: t.hp * fscale * (elite ? 2.6 : 1) * G.pressure,
    spd: t.spd * sscale * (elite ? 0.9 : 1) * rand(0.9, 1.1) * G.pressure,
    dmg: t.dmg + (elite ? 1 : 0),
    xp: t.xp * (elite ? 3 : 1),
    sprite: t.sprite,
    elite: !!elite,
    hitT: 0, flash: 0, hpBarT: 0, burnT: 0, burnDps: 0, bleedT: 0, bleedDps: 0,
    slowT: 0, stunT: 0, rootT: 0,
    fireT: rand(1, 2.5), fuse: -1, wob: rand(0, TAU),
    animSeed: rand(0, TAU), animT: rand(0, 1), attackT: 0, actionT: 0,
    spawnT: 0, dead: false,
    warmT: 0,
    boss: false,
  };
  return e;
}

// pick an enemy type for a floor-scaled wave
function pickEnemyType(floor) {
  const table = [
    ['shambler', 40],
    ['runner', floor >= 1 ? 25 : 0],
    ['spitter', floor >= 2 ? 18 : 0],
    ['splitter', floor >= 2 ? 16 : 0],
    ['exploder', floor >= 3 ? 14 : 0],
  ];
  const total = table.reduce((s, t) => s + t[1], 0);
  let r = Math.random() * total;
  for (const [type, w] of table) { r -= w; if (r <= 0) return type; }
  return 'shambler';
}

// true if (x,y) is within keep-out range of any of the current room's doorways
function nearAnyDoor(x, y) {
  const r = G.cur;
  if (!r) return false;
  const a = G.arena;
  const M = Math.min(130, Math.min(a.w, a.h) * 0.32);
  if (r.doors.n && Math.abs(x - a.cx) < DOOR_HALF + 30 && y < a.y0 + M) return true;
  if (r.doors.s && Math.abs(x - a.cx) < DOOR_HALF + 30 && y > a.y1 - M) return true;
  if (r.doors.e && Math.abs(y - a.cy) < DOOR_HALF + 30 && x > a.x1 - M) return true;
  if (r.doors.w && Math.abs(y - a.cy) < DOOR_HALF + 30 && x < a.x0 + M) return true;
  return false;
}

function spawnPosAwayFromPlayer() {
  const p = G.player;
  const a = G.arena;
  const safeDist = Math.min(200, Math.min(a.w, a.h) * 0.42);
  for (let tries = 0; tries < 30; tries++) {
    const x = rand(a.x0 + 40, a.x1 - 40);
    const y = rand(a.y0 + 40, a.y1 - 40);
    if (dist(x, y, p.x, p.y) <= safeDist) continue;
    if (nearAnyDoor(x, y)) continue;
    return { x, y };
  }
  // fallback: a bounded central region, valid even in the thin hall variants
  const rx = Math.max(12, Math.min(150, a.w / 2 - 40));
  const ry = Math.max(12, Math.min(120, a.h / 2 - 40));
  return { x: rand(a.cx - rx, a.cx + rx), y: rand(a.cy - ry, a.cy + ry) };
}

function spawnWave(count, floor) {
  for (let i = 0; i < count; i++) {
    if (G.enemies.length >= MAX_ENEMIES) break;
    const pos = spawnPosAwayFromPlayer();
    const elite = chance(Math.min(0.03 + floor * 0.02, 0.2));
    const e = makeEnemy(pickEnemyType(floor), pos.x, pos.y, floor, elite);
    e.warmT = SPAWN_WARN; // telegraph the incoming spawn so the player isn't blindsided
    G.enemies.push(e);
    spawnBlood(pos.x, pos.y, rand(0, TAU), 4);
    Sfx.spawn(e);
  }
}

// returns true if the enemy died
function damageEnemy(e, dmg, ang, knockback, opts) {
  if (e.hp <= 0) return true;
  if (e.phased) return false;
  if (!(dmg > 0)) return false; // NaN / zero / negative damage does nothing
  // crit roll
  const p = G.player;
  const o = opts || {};
  const crit = !!(p && !o.noCrit && chance(p.stats.crit || 0));
  if (crit) dmg *= p.stats.critMul || 2;
  // Dead Weight: execute wounded enemies
  if (p && p.stats.executeBonus > 0 && e.maxHp > 0 && e.hp / e.maxHp < 0.30) dmg *= 1 + p.stats.executeBonus;
  // Cauterized Veins: bonus damage to burning enemies
  if (p && p.stats.burnDamageBonus > 0 && e.burnT > 0) dmg *= 1 + p.stats.burnDamageBonus;
  const mitigated = e.dmgTakenMul !== undefined && e.dmgTakenMul < 1;
  dmg *= e.dmgTakenMul === undefined ? 1 : e.dmgTakenMul;
  e.hp -= dmg;
  e.flash = 0.12;
  e.hpBarT = HP_BAR_SHOW;
  spawnText(e.x, e.y, Math.max(1, Math.round(dmg)), mitigated ? '#d0b887' : '#ffb0a0');
  if (e.plates > 0) {
    e.plateDmg = (e.plateDmg || 0) + dmg;
    const threshold = e.maxHp * 0.06;
    if (e.plateDmg >= threshold) {
      e.plateDmg -= threshold;
      e.plates--;
      e.rootT = Math.max(e.rootT || 0, 0.45);
      e.flash = 0.2;
      addShake(6);
      spawnGibs(e.x, e.y, 4, true);
      spawnText(e.x, e.y - e.r, 'PLATE BROKEN', '#ffd080');
      Sfx.boss(e, 'plate');
      if (e.plates <= 0) {
        e.dmgTakenMul = 1;
        addToast('ARMOR BREACHED', 'Plate Father is exposed');
        Sfx.boss(e, 'enrage');
      }
    }
  }
  if (knockback && !e.boss && !e.dragged) {
    const kb = p ? p.stats.knockbackMul || 1 : 1;
    e.vx += Math.cos(ang) * 90 * kb; e.vy += Math.sin(ang) * 90 * kb;
  }
  if (p && !o.noProc) procOnHit(e, dmg, ang, o);
  Sfx.hit(e, crit);
  if (e.hp <= 0) { killEnemy(e, ang); return true; }
  return false;
}

// Shared player-hit payload. Every weapon primitive routes through damageEnemy,
// so items remain useful for bullets, beams, slams, saws, traps and orbitals.
function procOnHit(e, dmg, ang, opts) {
  const p = G.player, s = p.stats;
  const chanceScale = opts.procScale === undefined ? 1 : opts.procScale;
  const magnitudeScale = opts.procMagnitudeScale === undefined ? 1 : opts.procMagnitudeScale;
  const intervalScale = opts.procIntervalScale === undefined ? 1 : opts.procIntervalScale;
  const procDamage = dmg / Math.max(0.05, intervalScale) * magnitudeScale;
  // Thousand Teeth: bullets shatter into 6 extra shards that can crit.
  // Shards inherit the shard flag so they don't recurse. The −40% base bullet
  // damage is applied as a global dmgMul penalty in the item's apply().
  if (s.thousandTeeth > 0 && !(opts.bullet && opts.bullet.shard) && chance(clamp(chanceScale, 0, 1))) {
    for (let i = 0; i < 6; i++) {
      const sa = rand(0, TAU);
      const shardCrit = chance(s.crit || 0);
      G.bullets.push({
        x: e.x, y: e.y, ang: sa,
        vx: Math.cos(sa) * 300 * s.shotSpeedMul, vy: Math.sin(sa) * 300 * s.shotSpeedMul,
        r: 3 * s.sizeMul, dmg: procDamage * 0.4 * (shardCrit ? (s.critMul || 2) : 1), pierce: 0, bounce: s.bounce,
        life: 0.35 * s.rangeMul, t: 0, behavior: 'bullet', sprite: 'bullet_bone',
        homing: s.homing ? 1.6 + s.homing * 0.7 : 0, shard: true, sizeMul: s.sizeMul,
      });
    }
    spawnSpark(e.x, e.y, ang);
  }
  if (s.splinter > 0 && !(opts.bullet && opts.bullet.shard) && chance(clamp(chanceScale, 0, 1))) {
    const count = Math.min(18, Math.floor(s.splinter));
    for (let i = 0; i < count; i++) {
      const sa = rand(0, TAU);
      G.bullets.push({
        x: e.x, y: e.y, ang: sa,
        vx: Math.cos(sa) * 300 * s.shotSpeedMul, vy: Math.sin(sa) * 300 * s.shotSpeedMul,
        r: 3 * s.sizeMul, dmg: procDamage * 0.4, pierce: 0, bounce: s.bounce,
        life: 0.35 * s.rangeMul, t: 0, behavior: 'bullet', sprite: 'bullet_bone',
        homing: s.homing ? 1.6 + s.homing * 0.7 : 0, shard: true, sizeMul: s.sizeMul,
      });
    }
    spawnSpark(e.x, e.y, ang);
  }
  if (s.bleed > 0) {
    e.bleedT = Math.max(e.bleedT || 0, 2.2);
    e.bleedDps = Math.max(e.bleedDps || 0, procDamage * s.bleed * 0.45);
  }
  if (s.igniteChance > 0 && chance(clamp(s.igniteChance * chanceScale, 0, 0.9))) {
    e.burnT = Math.max(e.burnT || 0, 1.8);
    e.burnDps = Math.max(e.burnDps || 0, 5 * s.dmgMul);
  }
  if (s.slowOnHit > 0 && chance(clamp(s.slowOnHit * chanceScale, 0, 0.9))) e.slowT = Math.max(e.slowT || 0, 1.5);
  if (!e.boss && s.stunOnHit > 0 && chance(clamp(s.stunOnHit * chanceScale, 0, 0.75))) e.stunT = Math.max(e.stunT || 0, 0.35);
  if (s.pullOnHit > 0 && !e.boss && chance(clamp(s.pullOnHit * chanceScale, 0, 0.8))) {
    const toward = angleTo(e.x, e.y, p.x, p.y);
    e.vx += Math.cos(toward) * 170; e.vy += Math.sin(toward) * 170;
  }
  if (s.acidOnHit > 0 && G.hazards.length < 80 && chance(clamp(s.acidOnHit * chanceScale, 0, 0.65))) {
    G.hazards.push({ kind: 'acid', x: e.x, y: e.y, r: 18 * s.sizeMul, life: 2.5, t: 0, dps: 5 * s.dmgMul });
  }
  if (s.chain > 0 && G.enemies.length > 1 && chance(clamp(chanceScale, 0, 1))) {
    const hit = new Set([e]);
    let from = e;
    for (let i = 0; i < Math.min(6, Math.floor(s.chain)); i++) {
      let next = null, best = 180 * 180;
      for (const target of G.enemies) {
        if (target.hp <= 0 || target.phased || hit.has(target)) continue;
        const d2 = dist2(from.x, from.y, target.x, target.y);
        if (d2 < best) { best = d2; next = target; }
      }
      if (!next) break;
      hit.add(next);
      damageEnemy(next, procDamage * 0.35, angleTo(from.x, from.y, next.x, next.y), false, { noProc: true, noCrit: true });
      spawnSpark(next.x, next.y, angleTo(from.x, from.y, next.x, next.y));
      from = next;
    }
  }
  if (s.mortar > 0) {
    p.mortarHits = (p.mortarHits || 0) + chanceScale;
    const every = Math.max(2, 7 - Math.min(5, Math.floor(s.mortar)));
    if (p.mortarHits >= every) {
      p.mortarHits -= every;
      const radius = 42 + s.mortar * 5;
      for (const target of G.enemies) {
        if (target.hp > 0 && target !== e && dist2(e.x, e.y, target.x, target.y) < radius * radius) {
          damageEnemy(target, procDamage * 0.55, angleTo(e.x, e.y, target.x, target.y), true, { noProc: true, noCrit: true });
        }
      }
      spawnExplosionFx(e.x, e.y, radius);
    }
  }
}

function tickEnemyDamage(e, amount) {
  if (!(amount > 0) || e.hp <= 0) return;
  e.hp -= amount * (e.dmgTakenMul === undefined ? 1 : e.dmgTakenMul);
  if (e.hp <= 0) killEnemy(e, rand(0, TAU));
}

function killEnemy(e, ang) {
  if (e.dead) return;
  spawnCorpse(e);
  e.dead = true;
  e.hp = 0;
  const p = G.player;
  if (p.stats.frenzy > 0) p.frenzyT = Math.max(p.frenzyT || 0, 3);
  G.kills++;
  if (p.stats.slaughterRhythm > 0) { p.killStamps = p.killStamps || []; p.killStamps.push(G.time); }
  addScore(e.boss ? 500 : (e.elite ? 40 : 10));
  spawnBlood(e.x, e.y, ang || rand(0, TAU), e.boss ? 40 : (e.elite ? 20 : 10), e.boss || e.elite);
  spawnGibs(e.x, e.y, e.boss ? 16 : (e.elite ? 8 : 4), e.boss || e.elite);
  if (e.boss || e.elite) spawnShockwave(e.x, e.y, e.boss ? e.r * 2.4 : e.r * 1.7, '#b82a38', e.boss ? 0.9 : 0.55);
  if (!e.boss) Sfx.enemyDie(e);

  // Vampire Dentures heal on kills, naturally normalizing slow and rapid weapons.
  const stealChance = clamp((p.stats.lifestealChance || 0) * 3, 0, 0.9);
  if (p.hp < p.stats.maxHp && stealChance && chance(stealChance)) {
    lifestealPlayer(e.boss ? 4 : (e.elite ? 2 : 1));
  }

  if (e.boss) { onBossDeath(e); return; }

  // Gore Crown: free nova on every kill
  if (p.stats.goreCrown > 0) {
    areaDamage(e.x, e.y, 70 * Math.sqrt(p.stats.sizeMul), 8 * p.stats.dmgMul * p.stats.dmgLiveMul, true, { noProc: true, noCrit: true });
    spawnExplosionFx(e.x, e.y, 60);
  }

  // Blood Moat: kills leave an acid pool
  if (p.stats.bloodMoat > 0 && G.hazards.length < 80) {
    G.hazards.push({ kind: 'acid', x: e.x, y: e.y, r: 16 * p.stats.sizeMul, life: 2.5, t: 0, dps: 5 * p.stats.dmgMul * p.stats.dmgLiveMul });
  }
  // Meat Hook: kills yank nearby enemies to the corpse
  if (p.stats.meatHook > 0) {
    const yankR = 120 + p.stats.meatHook * 15;
    for (const o of G.enemies) {
      if (o === e || o.hp <= 0 || o.boss) continue;
      if (dist2(o.x, o.y, e.x, e.y) < yankR * yankR) {
        const a = angleTo(o.x, o.y, e.x, e.y);
        o.vx += Math.cos(a) * 240; o.vy += Math.sin(a) * 240;
      }
    }
  }

  // Volatile Bile: kills explode — radius and damage scale with tier
  if (p.stats.explodeOnKill > 0) {
    const rad = 60 + p.stats.explodeOnKill * 15;
    areaDamage(e.x, e.y, rad, (10 + p.stats.explodeOnKill * 8) * p.stats.dmgMul, true);
    spawnExplosionFx(e.x, e.y, rad);
    Sfx.explode({ x: e.x, y: e.y });
  }

  // drops
  const luck = p.stats.luck;
  let gemVal = e.xp + (p.stats.bloodlust && chance(p.stats.bloodlust) ? e.xp : 0);
  // Bloodrush keeps its XP multiplier and makes the bonus visible as extra crystals.
  const xpBonusChance = clamp((p.stats.xpMul || 1) - 1, 0, 0.9);
  if (xpBonusChance && chance(xpBonusChance)) gemVal += Math.max(1, Math.round(e.xp * 0.5));
  if (e.elite) {
    // special monsters: always bonus XP, mostly ammo, sometimes an item
    gemVal += irand(3, 5);
    spawnGems(e.x, e.y, gemVal);
    if (chance(0.18 + luck * 0.1)) {
      spawnPickup('item', e.x, e.y, { iid: rollItemId('elite', G.floor) });
    } else if (chance((0.6 + luck * 0.2) * AMMO_DROP_SCALE)) {
      spawnPickup('ammo', e.x, e.y);
    }
  } else {
    spawnGems(e.x, e.y, gemVal);
    if (chance((0.07 + luck * 0.04) * AMMO_DROP_SCALE)) {
      spawnPickup('ammo', e.x, e.y);
    } else if (chance(0.022 + luck * 0.03)) {
      spawnPickup('heart', e.x, e.y);
    }
  }

  // splitter splits
  if (ENEMY_TYPES[e.type].splits && !e.elite) {
    Sfx.split(e);
    for (let i = 0; i < 2 && G.enemies.length < MAX_ENEMIES; i++) {
      const m = makeEnemy('mini', e.x + rand(-18, 18), e.y + rand(-18, 18), G.floor, false);
      G.enemies.push(m);
    }
  }
  // exploder goes boom
  if (ENEMY_TYPES[e.type].explodes) explodeAt(e.x, e.y, 60, 2, false);
}

function explodeAt(x, y, r, dmg, fromPlayer) {
  spawnExplosionFx(x, y, r);
  Sfx.explode({ x, y });
  if (fromPlayer) {
    areaDamage(x, y, r, dmg, true);
  } else {
    const p = G.player;
    if (dist(x, y, p.x, p.y) < r + p.r) hurtPlayer(dmg, angleTo(x, y, p.x, p.y));
  }
}

function updateEnemies(dt) {
  const p = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.hp <= 0) { G.enemies.splice(i, 1); continue; }
    e.spawnT = Math.min((e.spawnT || 0) + dt, 1);
    e.animT = (e.animT || 0) + dt;
    if (e.hpBarT > 0) e.hpBarT = Math.max(0, e.hpBarT - dt);
    if (e.attackT > 0) { e.attackT -= dt; e.actionT += dt; }

    // materializing spawns are frozen and harmless until the telegraph ends
    if (e.warmT > 0) {
      e.warmT -= dt;
      e.vx = 0; e.vy = 0;
      if (e.warmT > 0) continue;
    }

    // status effects
    if (e.flash > 0) e.flash -= dt;
    if (e.orbT > 0) e.orbT -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hpBarT = HP_BAR_SHOW;
      tickEnemyDamage(e, e.burnDps * dt);
      if (chance(0.2)) addParticle({ type: 'flame', x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), vx: 0, vy: -40, life: 0.3, t: 0, r: 3 });
      if (e.hp <= 0) { G.enemies.splice(i, 1); continue; }
    }
    if (e.bleedT > 0) {
      e.bleedT -= dt;
      e.hpBarT = HP_BAR_SHOW;
      tickEnemyDamage(e, e.bleedDps * dt);
      if (e.hp <= 0) { G.enemies.splice(i, 1); continue; }
    }
    if (e.slowT > 0) e.slowT -= dt;
    if (e.stunT > 0) { e.stunT -= dt; e.vx = 0; e.vy = 0; continue; }
    if (e.rootT > 0) { e.rootT -= dt; e.vx = 0; e.vy = 0; continue; }
    if (e.dragged) { e.vx = 0; e.vy = 0; continue; } // harpooned

    if (e.boss) { updateBoss(e, dt); }
    else updateEnemyAI(e, dt);

    // integrate + separation
    e.x += e.vx * dt; e.y += e.vy * dt;
    const drag = Math.pow(0.82, dt * 60);
    e.vx *= drag; e.vy *= drag;
    // Resolve each pair once instead of twice. This halves the hottest
    // enemy-crowd loop while preserving the same mutual separation.
    for (let j = i - 1; j >= 0; j--) {
      const o = G.enemies[j];
      if (o.hp <= 0) continue;
      const d2 = dist2(e.x, e.y, o.x, o.y);
      const min = (e.r + o.r) * 0.9;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (min - d) / d * 30 * dt;
        const px = (e.x - o.x) * push, py = (e.y - o.y) * push;
        e.x += px; e.y += py; o.x -= px; o.y -= py;
      }
    }
    e.x = clamp(e.x, G.arena.x0 + e.r, G.arena.x1 - e.r);
    e.y = clamp(e.y, G.arena.y0 + e.r, G.arena.y1 - e.r);

    // contact damage
    if (e.hitT > 0) e.hitT -= dt;
    if (!e.phased && e.hitT <= 0 && p.hp > 0 && dist2(e.x, e.y, p.x, p.y) < (e.r + p.r) * (e.r + p.r)) {
      e.attackT = 0.3; e.actionT = 0;
      hurtPlayer(e.dmg, angleTo(e.x, e.y, p.x, p.y), e);
      e.hitT = 0.7;
    }
  }
}

function updateEnemyAI(e, dt) {
  const p = G.player;
  const a = angleTo(e.x, e.y, p.x, p.y);
  const d = dist(e.x, e.y, p.x, p.y);
  const spd = e.slowT > 0 ? e.spd * 0.45 : e.spd;
  const t = ENEMY_TYPES[e.type];

  if (t.ranged) {
    // spitter: hold ~230px range and fire
    if (d > 250) { e.vx += Math.cos(a) * spd * 3 * dt; e.vy += Math.sin(a) * spd * 3 * dt; }
    else if (d < 190) { e.vx -= Math.cos(a) * spd * 3 * dt; e.vy -= Math.sin(a) * spd * 3 * dt; }
    e.fireT -= dt;
    if (e.fireT <= 0 && d < 420) {
      e.fireT = e.elite ? 1.1 : 1.9;
      e.attackT = 0.34; e.actionT = 0;
      const n = e.elite ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const fa = a + (n > 1 ? (k - 1) * 0.25 : 0);
        G.ebullets.push({
          x: e.x, y: e.y, vx: Math.cos(fa) * 220, vy: Math.sin(fa) * 220,
          r: 5, dmg: 1, life: 3, t: 0, sprite: 'bullet_gore',
        });
      }
      Sfx.spit(e);
    }
  } else if (t.explodes) {
    e.vx += Math.cos(a) * spd * 4 * dt; e.vy += Math.sin(a) * spd * 4 * dt;
    if (e.fuse < 0 && d < 56) { e.fuse = 0.5; e.attackT = 0.5; e.actionT = 0; Sfx.fuse(e); }
    if (e.fuse >= 0) {
      e.fuse -= dt;
      e.flash = 0.05;
      if (e.fuse <= 0) { e.hp = 0; explodeAt(e.x, e.y, 70, 2, false); }
    }
  } else {
    // chaser with a little wobble
    e.wob += dt * 3;
    const wa = a + Math.sin(e.wob) * 0.3;
    e.vx += Math.cos(wa) * spd * 4 * dt; e.vy += Math.sin(wa) * spd * 4 * dt;
  }
}

function drawEnemies(ctx) {
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    // spawn telegraph: pulsing sigil + ghost, harmless until warmT expires
    if (e.warmT > 0) {
      const k = clamp(1 - e.warmT / SPAWN_WARN, 0, 1);
      const ringR = e.r + 30 * (1 - k);
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 26) * 0.2;
      ctx.strokeStyle = '#ff2a3c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, ringR, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.22 + k * 0.30;
      ctx.fillStyle = '#4a0713';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + k * 0.7), 0, TAU); ctx.fill();
      ctx.restore();
      Sprites.actor(ctx, e.sprite, e.x, e.y, 0, 'idle', e.animT || 0,
        e.drawSize || (e.boss ? 128 : 64), 0.18 + k * 0.55, 0.45 + k * 0.55, 0.45 + k * 0.55);
      if (e.elite) {
        ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      continue;
    }
    const p = G.player;
    const face = angleTo(e.x, e.y, p.x, p.y);
    const speed = Math.min(Math.hypot(e.vx, e.vy) / Math.max(e.spd, 1), 1);
    let action = speed > 0.12 ? 'move' : 'idle';
    let animTime = e.animT || 0;
    if (e.attackT > 0 || (e.boss && e.state !== 'idle')) {
      action = 'attack';
      animTime = e.attackT > 0 ? e.actionT : (e.animT || 0);
    }
    if (e.flash > 0) { action = 'hit'; animTime = 0.12 - e.flash; }
    let pulse = 1;
    if (e.type === 'exploder' && e.fuse >= 0) pulse = 1 + (0.5 - e.fuse) * 0.13 + Math.sin(G.time * 28) * 0.04;
    const appear = clamp((e.spawnT || 0) / 0.24, 0.12, 1);
    if (e.alpha === undefined || e.alpha > 0.05) Sprites.shadow(ctx, e.x, e.y + e.r * 0.55, e.r * 0.9, e.r * 0.34, (e.boss ? 0.5 : 0.34) * (e.alpha === undefined ? 1 : e.alpha));
    Sprites.actor(ctx, e.sprite, e.x, e.y, face, action, animTime,
      e.drawSize || (e.boss ? 128 : 64), e.alpha === undefined ? 1 : e.alpha, appear * pulse, appear * pulse);
    if (e.plates > 0) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.lineWidth = 4;
      for (let k = 0; k < e.plates; k++) {
        ctx.strokeStyle = k % 2 ? '#8d755d' : '#b79b71';
        ctx.beginPath(); ctx.arc(0, 0, e.r + 7, k * Math.PI / 2 + 0.08, k * Math.PI / 2 + 1.25); ctx.stroke();
      }
      ctx.restore();
    }
    if (e.elite) {
      ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Damaged normal monsters show a compact timed pip; elites/bosses stay visible.
    if (!e.phased && (e.boss || e.elite || (e.hpBarT > 0 && e.hp < e.maxHp))) {
      const w = e.boss ? 60 : (e.elite ? 26 : (e.type === 'mini' ? 14 : 18));
      const h = e.boss || e.elite ? 4 : 3;
      const alpha = e.boss || e.elite ? 1 : clamp(e.hpBarT / 0.5, 0, 1);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = '#24070b';
      ctx.fillRect(e.x - w / 2 - 1, e.y - e.r - 11, w + 2, h + 2);
      ctx.fillStyle = '#5a0d18';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, h);
      ctx.fillStyle = '#e22b46';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * clamp(e.hp / e.maxHp, 0, 1), h);
      ctx.restore();
    }
  }
}
