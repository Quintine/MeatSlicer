// ---- nine rotating industrial-horror bosses ----

const BOSS_DEFS = [
  { kind: 'bonesaw',    name: 'BONE SAW',          sprite: 'boss_bonesaw',    hp: 520, spd: 60, r: 45, drawSize: 128, debutCycle: 0 },
  { kind: 'gorecrown',  name: 'GORE CROWN',        sprite: 'boss_gorecrown',  hp: 600, spd: 42, r: 48, drawSize: 128, debutCycle: 0 },
  { kind: 'knifecrawl', name: 'KNIFE FLOOR CRAWL', sprite: 'boss_knifecrawl', hp: 560, spd: 75, r: 45, drawSize: 128, debutCycle: 0 },
  { kind: 'vealmother', name: 'VEAL MOTHER',       sprite: 'boss_vealmother', hp: 640, spd: 34, r: 52, drawSize: 128, debutCycle: 1 },
  { kind: 'flenser',    name: 'THE FLENSER',       sprite: 'boss_flenser',    hp: 460, spd: 96, r: 40, drawSize: 128, debutCycle: 1 },
  { kind: 'hookchoir',  name: 'HOOK CHOIR',        sprite: 'boss_hookchoir',  hp: 580, spd: 46, r: 50, drawSize: 128, debutCycle: 1 },
  { kind: 'platefather',name: 'PLATE FATHER',      sprite: 'boss_platefather',hp: 700, spd: 38, r: 54, drawSize: 128, debutCycle: 2 },
  { kind: 'augerprime', name: 'AUGER PRIME',       sprite: 'boss_augerprime', hp: 600, spd: 52, r: 48, drawSize: 128, debutCycle: 2 },
  { kind: 'scald',      name: 'THE SCALD',         sprite: 'boss_scald',      hp: 620, spd: 40, r: 50, drawSize: 128, debutCycle: 2 },
];

function bossIndexForFloor(floor) { return (floor - 1) % BOSS_DEFS.length; }

function spawnBoss(floor) {
  const def = BOSS_DEFS[bossIndexForFloor(floor)];
  const cycle = Math.floor((floor - 1) / 3);
  const tier = Math.max(0, cycle - def.debutCycle);
  const up = powerScore();
  const pressureHp = G.pressure;
  const hpMul = (1 + (floor - 1) * 0.30) * (1 + up * 0.05) * pressureHp;
  const e = {
    type: 'boss_' + def.kind, bossKind: def.kind, boss: true, name: def.name,
    x: G.arena.cx, y: G.arena.cy - 100, vx: 0, vy: 0,
    r: def.r, hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    drawSize: def.drawSize,
    spd: def.spd * (1 + cycle * 0.1 + up * 0.01) * G.pressure, dmg: 2,
    sprite: def.sprite, elite: false,
    hitT: 0, flash: 0, burnT: 0, burnDps: 0, slowT: 0, rootT: 0,
    wob: 0, animSeed: rand(0, TAU), animT: 0, attackT: 0, actionT: 0,
    spawnT: 0, dead: false,
    state: 'idle', stateT: 1.2, atkT: 2.2, sumT: 4,
    chargeAng: 0, cycle, tier, atkCount: 0, dashes: 0, spiralOff: 0, enragedPlayed: false,
    atkT2: 2.6, alpha: 1, phased: false, dmgTakenMul: def.kind === 'platefather' ? 0.25 : 1,
    plates: def.kind === 'platefather' ? 4 : 0, plateDmg: 0,
    escorts: [], broodTriggered: false, blinkCount: 0, hookRespawnT: 0,
  };
  G.enemies.push(e);
  G.boss = e;
  Sfx.boss(e, 'roar');
  addToast(def.name, 'fresh meat wants YOU');
  return e;
}

function updateBoss(e, dt) {
  e.wob += dt;
  const p = G.player;
  const a = angleTo(e.x, e.y, p.x, p.y);
  const d = dist(e.x, e.y, p.x, p.y);
  const enraged = e.hp < e.maxHp * 0.35;
  const spdMul = enraged ? 1.35 : 1;
  if (enraged && !e.enragedPlayed) { e.enragedPlayed = true; Sfx.boss(e, 'enrage'); }

  switch (e.bossKind) {
    case 'bonesaw': updateBoneSaw(e, dt, a, d, spdMul, enraged); break;
    case 'gorecrown': updateGoreCrown(e, dt, a, d, spdMul, enraged); break;
    case 'knifecrawl': updateKnifeCrawl(e, dt, a, d, spdMul, enraged); break;
    case 'vealmother': updateVealMother(e, dt, a, d, spdMul, enraged); break;
    case 'flenser': updateFlenser(e, dt, a, d, spdMul, enraged); break;
    case 'hookchoir': updateHookChoir(e, dt, a, d, spdMul, enraged); break;
    case 'platefather': updatePlateFather(e, dt, a, d, spdMul, enraged); break;
    case 'augerprime': updateAugerPrime(e, dt, a, d, spdMul, enraged); break;
    case 'scald': updateScald(e, dt, a, d, spdMul, enraged); break;
  }
}

// --- Bone Saw: telegraphed charges + flings bouncing saws ---
function updateBoneSaw(e, dt, a, d, spdMul, enraged) {
  const p = G.player;
  e.stateT -= dt; e.atkT -= dt;

  if (e.state === 'idle') {
    e.vx += Math.cos(a) * e.spd * spdMul * 3 * dt;
    e.vy += Math.sin(a) * e.spd * spdMul * 3 * dt;
    if (e.atkT <= 0) {
      e.atkT = enraged ? 2.2 : 3.2;
      if (chance(0.55)) { // telegraph a charge
        e.state = 'aim'; e.stateT = 0.6; e.vx = 0; e.vy = 0;
      } else { // fling saws
        const n = enraged ? 10 : 6;
        for (let i = 0; i < n; i++) {
          const fa = a + (i - (n - 1) / 2) * 0.28;
          G.ebullets.push({
            x: e.x, y: e.y, vx: Math.cos(fa) * 240, vy: Math.sin(fa) * 240,
            r: 8, dmg: 1, life: 3.2, t: 0, sprite: 'bullet_saw',
          });
        }
        Sfx.boss(e, 'saws');
      }
    }
  } else if (e.state === 'aim') {
    e.chargeAng = a;
    if (e.stateT <= 0) { e.state = 'charge'; e.stateT = 0.85; Sfx.boss(e, 'charge'); }
  } else if (e.state === 'charge') {
    e.vx = Math.cos(e.chargeAng) * 430 * spdMul;
    e.vy = Math.sin(e.chargeAng) * 430 * spdMul;
    if (chance(0.5)) spawnBlood(e.x, e.y, e.chargeAng + Math.PI, 2);
    // wall slam
    const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
    if (nx < G.arena.x0 + e.r + 2 || nx > G.arena.x1 - e.r - 2 || ny < G.arena.y0 + e.r + 2 || ny > G.arena.y1 - e.r - 2) {
      e.state = 'idle'; e.stateT = 1; e.atkT = 1.2;
      addShake(10); Sfx.explode({ x: e.x, y: e.y });
    }
    if (e.stateT <= 0) { e.state = 'idle'; e.stateT = 0.8; }
  }
}

// --- Gore Crown: rings + summons; cycles add volleys, double rings, spirals, nastier summons ---
function updateGoreCrown(e, dt, a, d, spdMul, enraged) {
  e.atkT -= dt; e.sumT -= dt;
  // slow relentless chase
  e.vx += Math.cos(a) * e.spd * spdMul * 3 * dt;
  e.vy += Math.sin(a) * e.spd * spdMul * 3 * dt;

  if (e.atkT <= 0) {
    e.atkT = Math.max((enraged ? 1.6 : 2.4) - e.cycle * 0.15, 1.2);
    e.atkCount++;
    const ringN = Math.min((enraged ? 18 : 12) + e.cycle * 4, 40);
    // cycle 2+: alternate between rings and aimed gore volleys
    if (e.tier >= 1 && e.atkCount % 2 === 0) {
      const n = 3 + Math.min(e.cycle, 4);
      for (let i = 0; i < n; i++) {
        const fa = a + (i - (n - 1) / 2) * 0.22;
        G.ebullets.push({
          x: e.x, y: e.y, vx: Math.cos(fa) * 260, vy: Math.sin(fa) * 260,
          r: 6, dmg: 1, life: 3, t: 0, sprite: 'bullet_gore',
        });
      }
    } else {
      // rings: cycle 3+ every 3rd is doubled, cycle 4+ rings slowly rotate
      if (e.tier >= 3) e.spiralOff += 0.35;
      const off = e.spiralOff + rand(0, TAU);
      const rings = (e.tier >= 2 && e.atkCount % 3 === 0) ? 2 : 1;
      for (let ri = 0; ri < rings; ri++) {
        for (let i = 0; i < ringN; i++) {
          const fa = off + ri * (Math.PI / ringN) + (i / ringN) * TAU;
          G.ebullets.push({
            x: e.x, y: e.y, vx: Math.cos(fa) * 170, vy: Math.sin(fa) * 170,
            r: 6, dmg: 1, life: 4, t: 0, sprite: 'bullet_gore',
          });
        }
      }
    }
    Sfx.boss(e, 'volley');
  }
  if (e.sumT <= 0) {
    e.sumT = Math.max((enraged ? 5 : 7) - e.cycle * 0.5, 3.5);
    const n = Math.min(2 + e.cycle, 5, Math.max(0, MAX_ENEMIES - G.enemies.length));
    for (let i = 0; i < n; i++) {
      const pos = spawnPosAwayFromPlayer();
      let type = chance(0.6) ? 'runner' : 'mini';
      if (e.tier >= 1 && chance(0.3)) type = 'splitter';       // tier 2+: splitters join
      if (e.tier >= 2 && chance(0.25)) type = 'exploder';      // tier 3+: exploders join
      G.enemies.push(makeEnemy(type, pos.x, pos.y, G.floor, false));
      spawnBlood(pos.x, pos.y, 0, 6);
    }
    Sfx.boss(e, 'summon');
  }
}

// --- Knife Floor Crawl: telegraphs + dashes; cycles add hunting telegraphs, dash trails, volleys, chain dashes ---
function updateKnifeCrawl(e, dt, a, d, spdMul, enraged) {
  const p = G.player;
  e.atkT -= dt; e.stateT -= dt;
  if (e.state === 'idle') {
    e.vx += Math.cos(a) * e.spd * spdMul * 3 * dt;
    e.vy += Math.sin(a) * e.spd * spdMul * 3 * dt;
    if (e.atkT <= 0) {
      e.atkT = Math.max((enraged ? 1.8 : 2.6) - e.cycle * 0.15, 1.3);
      const n = Math.min(3 + e.cycle, 6);
      for (let i = 0; i < n; i++) {
        const tx = i === 0 ? p.x : p.x + rand(-130, 130);
        const ty = i === 0 ? p.y : p.y + rand(-130, 130);
        G.telegraphs.push({
          kind: 'knives',
          x: clamp(tx, G.arena.x0 + 20, G.arena.x1 - 20), y: clamp(ty, G.arena.y0 + 20, G.arena.y1 - 20),
          r: 34, t: 0, dur: Math.max(0.7 - e.cycle * 0.05, 0.45), tick: 0,
          track: e.tier >= 1 && i === 0 ? 0.4 : 0, // tier 2+: one telegraph hunts you
        });
      }
      // cycle 3+: cleaver volley
      if (e.tier >= 2) {
        const vn = 3 + Math.min(e.cycle - 1, 3);
        for (let i = 0; i < vn; i++) {
          const fa = a + (i - (vn - 1) / 2) * 0.2;
          G.ebullets.push({
            x: e.x, y: e.y, vx: Math.cos(fa) * 300, vy: Math.sin(fa) * 300,
            r: 6, dmg: 1, life: 2.5, t: 0, sprite: 'bullet_cleaver',
          });
        }
        Sfx.boss(e, 'knives');
      }
      if (chance(Math.min(enraged ? 0.5 : 0.3 + e.cycle * 0.08, 0.6))) {
        e.state = 'dash'; e.stateT = 0.5; e.chargeAng = a;
        e.dashes = e.tier >= 3 ? 2 : 1; // tier 4+: chain dash
        Sfx.boss(e, 'dash');
      }
    }
  } else if (e.state === 'dash') {
    e.vx = Math.cos(e.chargeAng) * 320 * spdMul;
    e.vy = Math.sin(e.chargeAng) * 320 * spdMul;
    if (e.stateT <= 0) {
      // cycle 2+: knives erupt where the dash ends
      if (e.tier >= 1) {
        G.telegraphs.push({
          kind: 'knives', x: clamp(e.x, G.arena.x0 + 20, G.arena.x1 - 20), y: clamp(e.y, G.arena.y0 + 20, G.arena.y1 - 20),
          r: 34, t: 0, dur: 0.55, tick: 0, track: 0,
        });
      }
      if (e.dashes > 1) { // chain dash
        e.dashes--;
        e.chargeAng = angleTo(e.x, e.y, p.x, p.y);
        e.stateT = 0.45;
      } else {
        e.state = 'idle';
      }
    }
  }
}

function fireBossBullet(e, ang, speed, sprite, opts) {
  const o = opts || {};
  G.ebullets.push({
    x: e.x, y: e.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    r: o.r || 6, dmg: o.dmg || 1, life: o.life || 3.5, t: 0,
    sprite: sprite || 'bullet_gore', homing: o.homing || 0,
    accel: o.accel || 0, bounces: o.bounces || 0,
  });
}

function fireBossRing(e, count, speed, sprite, off, opts, gapStart, gapSize) {
  for (let i = 0; i < count; i++) {
    if (gapStart !== undefined) {
      const delta = (i - gapStart + count) % count;
      if (delta < gapSize) continue;
    }
    fireBossBullet(e, (off || 0) + (i / count) * TAU, speed, sprite, opts);
  }
}

// --- Veal Mother: brood summons, homing bile, escort-gated shield phase ---
function updateVealMother(e, dt, a, d, spdMul, enraged) {
  e.atkT -= dt; e.sumT -= dt; e.stateT -= dt;
  const escortAlive = e.escorts.some(m => m && m.hp > 0);
  if (e.broodTriggered && !escortAlive && e.dmgTakenMul < 1) {
    e.dmgTakenMul = 1; e.state = 'idle';
    addToast('BROOD SHIELD BROKEN', 'the mother is exposed');
  }
  const moveMul = escortAlive ? 0.5 : 1;
  e.vx += Math.cos(a) * e.spd * spdMul * moveMul * 3 * dt;
  e.vy += Math.sin(a) * e.spd * spdMul * moveMul * 3 * dt;

  if (!e.broodTriggered && e.hp < e.maxHp * 0.5) {
    e.broodTriggered = true; e.state = 'brood'; e.stateT = 0.7;
    const slots = Math.max(0, MAX_ENEMIES - G.enemies.length);
    for (let i = 0; i < Math.min(2, slots); i++) {
      const ang = a + Math.PI + (i ? 0.7 : -0.7);
      const m = makeEnemy('splitter', clamp(e.x + Math.cos(ang) * 90, G.arena.x0 + 30, G.arena.x1 - 30),
        clamp(e.y + Math.sin(ang) * 90, G.arena.y0 + 30, G.arena.y1 - 30), G.floor, true);
      e.escorts.push(m); G.enemies.push(m); Sfx.spawn(m);
    }
    if (e.escorts.length) e.dmgTakenMul = 0.35;
    addToast('BROOD SHIELD', 'kill the splitters');
    Sfx.boss(e, 'birth');
  }

  if (e.atkT <= 0) {
    e.atkT = escortAlive ? 1.6 : (enraged ? 2.4 : 3.4);
    if (escortAlive) {
      fireBossRing(e, 10 + Math.min(e.tier, 3) * 2, 175, 'bullet_syringe', rand(0, TAU), { life: 4 });
    } else {
      const n = e.tier >= 3 ? 9 : 5;
      for (let i = 0; i < n; i++) {
        const fa = a + (i - (n - 1) / 2) * 0.18;
        fireBossBullet(e, fa, 190, 'bullet_syringe', { life: 3.2, homing: 1.2 });
      }
    }
    e.attackT = 0.35; e.actionT = 0;
    Sfx.boss(e, 'bile');
  }
  if (e.sumT <= 0) {
    e.sumT = enraged ? 3.8 : 5.5;
    const n = Math.min(3 + e.tier, 6, Math.max(0, MAX_ENEMIES - G.enemies.length));
    for (let i = 0; i < n; i++) {
      const pos = spawnPosAwayFromPlayer();
      let type = 'mini';
      if (e.tier >= 1 && chance(0.3)) type = 'splitter';
      if (e.tier >= 2 && chance(0.2)) type = 'exploder';
      const m = makeEnemy(type, pos.x, pos.y, G.floor, false);
      G.enemies.push(m); spawnBlood(pos.x, pos.y, 0, 5); Sfx.spawn(m);
    }
    e.state = 'birth'; e.stateT = 0.5; Sfx.boss(e, 'birth');
  }
  if (e.state === 'birth' && e.stateT <= 0) e.state = escortAlive ? 'brood' : 'idle';
}

// --- The Flenser: telegraphed vanish, reposition, cleaver ambush ---
function updateFlenser(e, dt, a, d, spdMul, enraged) {
  const p = G.player;
  e.atkT -= dt; e.stateT -= dt;
  if (e.state === 'idle') {
    e.alpha = 1; e.phased = false;
    e.vx += Math.cos(a) * e.spd * spdMul * 3.5 * dt;
    e.vy += Math.sin(a) * e.spd * spdMul * 3.5 * dt;
    if (e.atkT <= 0) {
      e.atkT = enraged ? 1.5 : 2.4; e.state = 'fade'; e.stateT = 0.35;
      e.blinkCount = e.tier >= 3 ? 2 : 1; e.oldX = e.x; e.oldY = e.y;
      e.vx = 0; e.vy = 0; Sfx.boss(e, 'blink');
    }
  } else if (e.state === 'fade') {
    e.vx = 0; e.vy = 0; e.alpha = clamp(e.stateT / 0.35, 0, 1);
    if (e.stateT <= 0) {
      e.state = 'gone'; e.stateT = enraged ? 0.3 : 0.5; e.phased = true; e.alpha = 0;
      const behind = p.aim + Math.PI, range = rand(90, 140);
      e.x = clamp(p.x + Math.cos(behind) * range, G.arena.x0 + e.r, G.arena.x1 - e.r);
      e.y = clamp(p.y + Math.sin(behind) * range, G.arena.y0 + e.r, G.arena.y1 - e.r);
      G.telegraphs.push({ kind: 'knives', x: e.x, y: e.y, r: 38, t: 0, dur: e.stateT + 0.22, tick: 0, track: 0 });
      if (e.tier >= 1) G.telegraphs.push({ kind: 'knives', x: e.oldX, y: e.oldY, r: 30, t: 0, dur: 0.6, tick: 0, track: 0 });
    }
  } else if (e.state === 'gone') {
    e.vx = 0; e.vy = 0;
    if (e.stateT <= 0) {
      e.state = 'strike'; e.stateT = 0.4; e.phased = false; e.alpha = 1;
      const strikeA = angleTo(e.x, e.y, p.x, p.y);
      const volleys = e.tier >= 2 ? 2 : 1;
      for (let v = 0; v < volleys; v++) for (let i = 0; i < 7; i++) {
        fireBossBullet(e, strikeA + (i - 3) * 0.16 + v * 0.08, 330 - v * 35, 'bullet_cleaver', { life: 2.5 });
      }
      e.chargeAng = strikeA + Math.PI; e.attackT = 0.4; e.actionT = 0;
      Sfx.boss(e, 'flay');
    }
  } else if (e.state === 'strike') {
    e.vx = Math.cos(e.chargeAng) * 380 * spdMul;
    e.vy = Math.sin(e.chargeAng) * 380 * spdMul;
    if (e.stateT <= 0) {
      e.blinkCount--;
      if (e.blinkCount > 0) {
        e.state = 'fade'; e.stateT = 0.35; e.oldX = e.x; e.oldY = e.y; Sfx.boss(e, 'blink');
      } else e.state = 'idle';
    }
  }
}

function spawnHookRing(e, count, radius, spin) {
  for (let i = 0; i < count; i++) {
    const b = {
      x: e.x, y: e.y, vx: 0, vy: 0, r: 7, dmg: 1, life: 20, t: 0,
      sprite: 'bullet_harpoon', behavior: 'orbit', anchor: e,
      orbA: (i / count) * TAU, orbR: radius, orbTargetR: radius,
      orbSpd: spin, releaseSpd: 300,
    };
    G.ebullets.push(b);
  }
}

// --- Hook Choir: chained hook rings wind outward then launch tangentially ---
function updateHookChoir(e, dt, a, d, spdMul, enraged) {
  e.atkT -= dt; e.atkT2 -= dt; e.stateT -= dt; e.hookRespawnT -= dt;
  e.vx += Math.cos(a) * e.spd * spdMul * 2.5 * dt;
  e.vy += Math.sin(a) * e.spd * spdMul * 2.5 * dt;
  const liveHooks = G.ebullets.filter(b => b.behavior === 'orbit' && b.anchor === e);
  if (!liveHooks.length && e.hookRespawnT <= 0) {
    spawnHookRing(e, 4 + Math.min(e.tier, 3), 70, (enraged ? 2.65 : 1.9));
    if (e.tier >= 1) spawnHookRing(e, 4 + Math.min(e.tier, 2), 110, -(enraged ? 2.25 : 1.6));
  }
  if (e.state === 'idle' && e.atkT <= 0) {
    e.state = 'wind'; e.stateT = 0.7; e.atkT = enraged ? 2.8 : 4;
    for (const b of liveHooks) { b.orbTargetR = 170; b.orbSpd *= 1.75; }
    Sfx.boss(e, 'chains');
  } else if (e.state === 'wind' && e.stateT <= 0) {
    e.state = 'idle'; e.hookRespawnT = 1.2;
    for (const b of liveHooks) {
      const releaseAng = b.orbA + Math.sign(b.orbSpd) * Math.PI / 2;
      b.behavior = null; b.anchor = null; b.homing = e.tier >= 3 ? 0.8 : 0;
      b.vx = Math.cos(releaseAng) * 300; b.vy = Math.sin(releaseAng) * 300;
    }
    Sfx.boss(e, 'release');
  }
  if (e.atkT2 <= 0) {
    e.atkT2 = 2.8;
    for (let i = -1; i <= 1; i++) fireBossBullet(e, a + i * 0.18, 260, 'bullet_harpoon', { life: 3 });
  }
}

function spawnPlateStomp(e) {
  const rings = e.tier >= 3 ? [120, 200] : [120];
  for (const radius of rings) for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU + (radius > 120 ? Math.PI / 6 : 0);
    G.hazards.push({ kind: 'fire', hostile: true, owner: e,
      x: e.x + Math.cos(ang) * radius, y: e.y + Math.sin(ang) * radius,
      r: 32, life: 3.5, t: 0, tick: 0, tickRate: 0.45, dmg: 1, dps: 0 });
  }
  addShake(9); Sfx.boss(e, 'stomp');
}

// --- Plate Father: breakable armor, projectile walls, tallow stomps ---
function updatePlateFather(e, dt, a, d, spdMul, enraged) {
  e.atkT -= dt; e.stateT -= dt;
  e.vx += Math.cos(a) * e.spd * spdMul * 2.4 * dt;
  e.vy += Math.sin(a) * e.spd * spdMul * 2.4 * dt;
  if (e.state === 'stomp') {
    e.vx = 0; e.vy = 0;
    if (e.stateT <= 0) { spawnPlateStomp(e); e.state = 'idle'; }
    return;
  }
  if (e.atkT <= 0) {
    e.atkT = enraged ? 2 : 3; e.atkCount++;
    if (e.atkCount % 2 === 0) {
      e.state = 'stomp'; e.stateT = 0.7; e.attackT = 0.7; e.actionT = 0;
    } else {
      const count = 20, gap = e.tier >= 1 ? 2 : 3;
      const gapStart = irand(0, count - 1), off = rand(0, TAU);
      fireBossRing(e, count, 150, 'bullet_gore', off, { life: 4.5 }, gapStart, gap);
      if (e.tier >= 2) fireBossRing(e, count, 125, 'bullet_gore', off + Math.PI / count, { life: 5 }, (gapStart + 7) % count, gap);
      e.attackT = 0.45; e.actionT = 0; Sfx.boss(e, 'wall');
    }
  }
}

// --- Auger Prime: rotating beam arms and accelerating saw spit ---
function updateAugerPrime(e, dt, a, d, spdMul, enraged) {
  e.atkT -= dt; e.stateT -= dt;
  if (e.state === 'idle') {
    e.vx += Math.cos(a) * e.spd * spdMul * 2.7 * dt;
    e.vy += Math.sin(a) * e.spd * spdMul * 2.7 * dt;
    if (e.atkT <= 0) {
      e.atkT = enraged ? 2.4 : 3.6; e.state = 'spool'; e.stateT = enraged ? 0.5 : 0.8;
      e.chargeAng = a; e.vx = 0; e.vy = 0; Sfx.boss(e, 'spool');
    }
  } else if (e.state === 'spool') {
    e.vx = 0; e.vy = 0;
    if (e.stateT <= 0) {
      e.state = 'sweep'; e.stateT = 2.2;
      const arms = e.tier >= 3 ? 3 : (e.tier >= 1 ? 2 : 1);
      G.telegraphs.push({ kind: 'sweep', owner: e, ang: e.chargeAng,
        spin: (chance(0.5) ? -1 : 1) * (e.tier >= 2 ? 1.65 : 1.15),
        len: 420, w: 26, arms, t: 0, dur: 2.2, tick: 0 });
      for (let i = -1; i <= 1; i++) fireBossBullet(e, e.chargeAng + i * 0.22, 150, 'bullet_saw', { accel: 260, life: 2.6, bounces: 1 });
      Sfx.boss(e, 'sweep');
    }
  } else if (e.state === 'sweep') {
    e.vx = 0; e.vy = 0;
    if (e.stateT <= 0) e.state = 'idle';
  }
}

// --- The Scald: steam vents, hostile tallow pools, stalling burst rings ---
function updateScald(e, dt, a, d, spdMul, enraged) {
  const p = G.player;
  e.atkT -= dt;
  e.vx += Math.cos(a) * e.spd * spdMul * 2.4 * dt;
  e.vy += Math.sin(a) * e.spd * spdMul * 2.4 * dt;
  if (e.atkT <= 0) {
    e.atkT = enraged ? 1.9 : 2.8; e.atkCount++;
    const n = e.tier >= 2 ? 7 : 3 + Math.min(e.tier, 2);
    const radius = e.tier >= 1 ? 58 : 46;
    const activePools = G.hazards.filter(h => h.hostile).length + G.telegraphs.filter(t => t.kind === 'pool').length;
    const availablePools = Math.max(0, 14 - activePools);
    for (let i = 0; i < Math.min(n, availablePools); i++) {
      const tx = i === 0 ? p.x : p.x + rand(-180, 180);
      const ty = i === 0 ? p.y : p.y + rand(-150, 150);
      G.telegraphs.push({ kind: 'pool', owner: e,
        x: clamp(tx, G.arena.x0 + radius, G.arena.x1 - radius), y: clamp(ty, G.arena.y0 + radius, G.arena.y1 - radius),
        r: radius, t: 0, dur: 0.6, life: enraged ? 7 : 5 });
    }
    e.attackT = 0.45; e.actionT = 0; Sfx.boss(e, 'vent');
    if (e.atkCount % 3 === 0) {
      fireBossRing(e, 16, 220, 'bullet_steam', rand(0, TAU), { accel: -60, life: 3.4, r: 8 });
      if (e.tier >= 3) fireBossRing(e, 16, 155, 'bullet_steam', rand(0, TAU), { accel: -35, life: 4.2, r: 8 });
      addShake(7); Sfx.boss(e, 'burst');
    }
  }
}

// telegraphs resolve here (knives erupting, lingering blades)
function updateTelegraphs(dt) {
  const p = G.player;
  for (let i = G.telegraphs.length - 1; i >= 0; i--) {
    const t = G.telegraphs[i];
    t.t += dt;
    if (t.kind === 'sweep') {
      if (!t.owner || t.owner.hp <= 0 || t.t >= t.dur) { G.telegraphs.splice(i, 1); continue; }
      t.ang += t.spin * dt; t.tick -= dt;
      let hit = false;
      for (let arm = 0; arm < t.arms; arm++) {
        const ang = t.ang + (arm / t.arms) * TAU;
        const ex = t.owner.x + Math.cos(ang) * t.len;
        const ey = t.owner.y + Math.sin(ang) * t.len;
        if (distToSegment(p.x, p.y, t.owner.x, t.owner.y, ex, ey) < t.w / 2 + p.r) hit = true;
      }
      if (hit && t.tick <= 0) { t.tick = 0.5; hurtPlayer(1, angleTo(t.owner.x, t.owner.y, p.x, p.y)); }
      continue;
    }
    if (t.kind === 'pool') {
      if (t.t >= t.dur) {
        G.hazards.push({ kind: 'acid', hostile: true, owner: t.owner,
          x: t.x, y: t.y, r: t.r, life: t.life, t: 0, tick: 0, tickRate: 0.4, dmg: 1, dps: 0 });
        for (let k = 0; k < 10; k++) addParticle({ type: 'smoke', x: t.x + rand(-t.r, t.r), y: t.y + rand(-t.r, t.r), vx: rand(-15, 15), vy: -rand(40, 100), life: 0.5, t: 0, r: rand(3, 7) });
        G.telegraphs.splice(i, 1);
      }
      continue;
    }
    // hunting telegraphs track the player briefly before locking
    if (t.kind === 'knives' && t.track > 0) {
      t.track -= dt;
      const ta = angleTo(t.x, t.y, p.x, p.y);
      const ts = 140 * dt;
      t.x = clamp(t.x + Math.cos(ta) * ts, G.arena.x0 + 20, G.arena.x1 - 20);
      t.y = clamp(t.y + Math.sin(ta) * ts, G.arena.y0 + 20, G.arena.y1 - 20);
    }
    if (t.kind === 'knives' && t.t >= t.dur) {
      // erupt
      if (dist(t.x, t.y, p.x, p.y) < t.r + p.r) hurtPlayer(1, angleTo(t.x, t.y, p.x, p.y));
      for (let k = 0; k < 8; k++) {
        addParticle({ type: 'spark', x: t.x + rand(-t.r, t.r), y: t.y + rand(-t.r, t.r), vx: 0, vy: -rand(60, 160), life: 0.3, t: 0, r: 2 });
      }
      Sfx.boss(G.boss || { bossKind: 'knifecrawl', x: t.x, y: t.y }, 'knives');
      t.kind = 'linger'; t.t = 0; t.dur = 1.1; t.tick = 0;
    } else if (t.kind === 'linger') {
      t.tick -= dt;
      if (t.tick <= 0) {
        t.tick = 0.4;
        if (dist(t.x, t.y, p.x, p.y) < t.r) hurtPlayer(1, angleTo(t.x, t.y, p.x, p.y));
      }
      if (t.t >= t.dur) G.telegraphs.splice(i, 1);
    }
  }
}

function drawTelegraphs(ctx) {
  for (const t of G.telegraphs) {
    if (t.kind === 'sweep') {
      if (!t.owner) continue;
      const pulse = 0.65 + Math.sin(t.t * 24) * 0.2;
      for (let arm = 0; arm < t.arms; arm++) {
        const ang = t.ang + (arm / t.arms) * TAU;
        const ex = t.owner.x + Math.cos(ang) * t.len;
        const ey = t.owner.y + Math.sin(ang) * t.len;
        ctx.globalAlpha = 0.24 * pulse; ctx.strokeStyle = '#ff442e'; ctx.lineWidth = t.w;
        ctx.beginPath(); ctx.moveTo(t.owner.x, t.owner.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(t.owner.x, t.owner.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (t.kind === 'pool') {
      const k = clamp(t.t / t.dur, 0, 1);
      ctx.globalAlpha = 0.2 + k * 0.35; ctx.fillStyle = '#b3ca32';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (0.7 + k * 0.3), 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = k > 0.75 ? '#fff1a0' : '#d5e64c'; ctx.lineWidth = 2 + k * 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (1 - k * 0.15), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (t.kind === 'knives') {
      const k = t.t / t.dur;
      const pulse = 0.7 + Math.sin(t.t * 26) * 0.3;
      ctx.globalAlpha = 0.25 + k * 0.45;
      ctx.strokeStyle = k > 0.72 ? '#ffdd9a' : '#ff3550'; ctx.lineWidth = 2 + k * 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (1 - k * 0.4), 0, TAU); ctx.stroke();
      ctx.globalAlpha = (0.2 + k * 0.35) * pulse;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.15 + k * 0.3;
      ctx.fillStyle = '#e51f3b';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (1 - k * 0.4), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (t.kind === 'linger') {
      ctx.globalAlpha = 0.8 * (1 - t.t / t.dur);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + 0.4;
        Sprites.draw(ctx, 'bullet_cleaver', t.x + Math.cos(a) * t.r * 0.5, t.y + Math.sin(a) * t.r * 0.5, a + Math.PI / 2, 24);
      }
      ctx.globalAlpha = 1;
    }
  }
}

function onBossDeath(e) {
  G.boss = null;
  Sfx.boss(e, 'death');
  G.telegraphs = [];
  G.ebullets = [];
  G.hazards = G.hazards.filter(h => !h.hostile);
  // Isaac-style: boss death ends the fight. Minions are swept without score or drops.
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const m = G.enemies[i];
    if (m === e || m.boss) continue;
    spawnBlood(m.x, m.y, rand(0, TAU), 8);
    spawnGibs(m.x, m.y, 3);
    spawnCorpse(m);
    m.dead = true;
    m.hp = 0;
  }
  addScore(500 + G.floor * 100);
  addShake(12);
  // boss reward: item pedestal + a real weapon drop + ammo + stairs down
  spawnItemPedestal(G.arena.cx - 90, G.arena.cy, null, 'boss');
  spawnPickup('ammo', G.arena.cx, G.arena.cy - 40);
  // 30% chance of a bonus active pedestal (additive — never replaces the passive)
  if (chance(0.30)) spawnActivePedestal(G.arena.cx - 160, G.arena.cy + 60);
  const bw = rollWeaponDrop(G.floor + 2); // bosses drop the good stuff
  spawnPickup('weapon', G.arena.cx + 90, G.arena.cy, { wid: bw.id });
  spawnPickup('stairs', G.arena.cx, G.arena.cy + 80);
  addToast(e.name + ' DESTROYED', 'take the meat, take the stairs');
  Music.requestFloorMusic();
}
