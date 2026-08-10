// ---- the butcher (player) ----

function defaultPlayerStats() {
  return {
    dmgMul: 1, rateMul: 1, speedMul: 1, shotSpeedMul: 1, rangeMul: 1,
    pierce: 0, bounce: 0, homing: 0, split: 0, fan: 0, rear: 0, splinter: 0,
    orbitals: 0, lifestealChance: 0, explodeOnKill: 0,
    armor: 0, luck: 0, magnet: 1, magnetPull: 1, xpMul: 1, crit: 0.05, critMul: 2, bloodlust: 0,
    stunRaw: 0,
    bleed: 0, igniteChance: 0, slowOnHit: 0, stunOnHit: 0, acidOnHit: 0, pullOnHit: 0,
    chain: 0, knockbackMul: 1, invBonus: 0, ammoEff: 1, ammoPickupMul: 1,
    roomHeal: 0, roomHealChance: 0, thorns: 0, retaliate: 0, sizeMul: 1, mortar: 0, frenzy: 0,
    orbSpeedMul: 1, orbDmgMul: 1, overShield: 0,
    rerolls: 0, rerollPerLevel: 0,
    // phase-3 conditional / hook passives
    dmgLiveMul: 1, executeBonus: 0, burnDamageBonus: 0, choirEvery: 0, sawboneCoil: 0,
    gluttonGut: 0, slaughterRhythm: 0, painEngine: 0, thresherPlate: 0, bloodMoat: 0,
    ironLung: 0, meatHook: 0, bloodDebt: 0,
    // phase-4 legendaries
    secondSkin: 0, twinSidearm: 0, crimsonMetronome: 0, abattoirEngine: 0,
    goreCrown: 0, thousandTeeth: 0, hollowFather: 0, theLastCut: 0, meatGrinder: 0,
    maxHp: 6,
  };
}

function initPlayer() {
  G.player = {
    x: W / 2, y: H / 2, r: 20,
    hp: 6, shieldHp: 0,
    aim: 0, bodyFacing: 0, fireT: 0, charge: 0, invT: 0, frenzyT: 0,
    step: 0, moveBlend: 0, recoil: 0, muzzleT: 0,
    animT: 0, attackT: 0, actionT: 0, hitT: 0, deathT: 0,
    weapon: { id: 'bonepopper', ammo: Infinity },
    holstered: null,   // a special weapon set aside while the pistol is out
    level: 1, xp: 0,
    items: {},         // iid -> quality tier (1..3)
    perks: [],         // perk ids drafted this run, in grant order
    active: null,      // { iid, charges } — active item, room-clear charged
    orbAng: 0,
    stats: defaultPlayerStats(),
  };
}

function refreshOrbitals(p) { /* orbital count is read live from stats */ }

// R: swap between the Bone Popper and your picked-up special weapon
function swapWeapon(silent) {
  const p = G.player;
  if (!p.holstered && p.weapon.id === 'bonepopper') return; // nothing to swap
  if (p.weapon.id === 'bonepopper' && p.holstered && p.holstered.ammo <= 0) {
    if (!silent) addToast(WEAPONS[p.holstered.id].name, 'empty — find ammo');
    Sfx.menu();
    return;
  }
  const tmp = p.weapon;
  p.weapon = p.holstered || { id: 'bonepopper', ammo: Infinity };
  p.holstered = tmp.id === 'bonepopper' ? null : tmp; // the pistol itself is never holstered
  p.charge = 0;
  p.fireT = 0;
  Sfx.pickup();
  if (!silent) addToast(WEAPONS[p.weapon.id].name, p.weapon.id === 'bonepopper' ? 'sidearm out' : 'back in hand');
}

function updatePlayer(dt) {
  const p = G.player;
  const st = p.stats;
  if (p.invT > 0) p.invT -= dt;
  if (p.hitT > 0) p.hitT -= dt;
  if (p.frenzyT > 0) p.frenzyT -= dt;
  p.animT += dt;
  if (p.attackT > 0) { p.attackT -= dt; p.actionT += dt; }

  // movement
  let mx = 0, my = 0;
  if (keyDown('w', 'arrowup')) my -= 1;
  if (keyDown('s', 'arrowdown')) my += 1;
  if (keyDown('a', 'arrowleft')) mx -= 1;
  if (keyDown('d', 'arrowright')) mx += 1;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    const spd = 178 * st.speedMul;
    p.x += (mx / len) * spd * dt;
    p.y += (my / len) * spd * dt;
    p.step += dt * 9 * Math.min(st.speedMul, 1.8);
  }
  else {
    // Finish on a planted contact frame instead of freezing halfway through a stride.
    const planted = Math.round(p.step / Math.PI) * Math.PI;
    p.step = lerp(p.step, planted, clamp(dt * 10, 0, 1));
  }
  p.moveBlend = lerp(p.moveBlend, mx || my ? 1 : 0, clamp(dt * 12, 0, 1));
  p.recoil = Math.max(0, p.recoil - dt * 7);
  p.muzzleT = Math.max(0, p.muzzleT - dt);
  p.x = clamp(p.x, G.arena.x0 + p.r, G.arena.x1 - p.r);
  p.y = clamp(p.y, G.arena.y0 + p.r, G.arena.y1 - p.r);

  // aim
  p.aim = angleTo(p.x, p.y, Input.mx, Input.my);
  // The waist and legs turn smoothly with travel while the weapon torso aims freely.
  // Once planted, the lower body turns back under the independently aimed torso.
  if (mx || my) {
    p.bodyFacing = angleLerp(p.bodyFacing, Math.atan2(my, mx), clamp(dt * 12, 0, 1));
  } else {
    p.bodyFacing = angleLerp(p.bodyFacing, p.aim, clamp(dt * 8, 0, 1));
  }

  // firing
  const w = WEAPONS[p.weapon.id];
  const sustained = ['cone', 'flame', 'saw', 'beam'].includes(w.behavior);
  Sfx.syncWeaponLoop(w, sustained && Input.mdown && p.weapon.ammo > 0);
  if (p.fireT > 0) p.fireT -= dt;
  const frenzyMul = p.frenzyT > 0 ? 1 + st.frenzy : 1;
  const draughtMul = p.marrowDraughtT > 0 ? 2 : 1;
  const effectiveRate = st.rateMul * (1 + (st.rhythmRateBonus || 0)) * frenzyMul * draughtMul;
  const rate = w.interval / effectiveRate;

  if (w.behavior === 'saw') {
    if (Input.mdown && p.weapon.ammo > 0) {
      sawTick(p, w, p.weapon, dt);
      if (!(p.marrowDraughtT > 0)) p.weapon.ammo -= dt * (w.drain || 18) / st.ammoEff;
      p.muzzleT = 0.04; p.recoil = 0.18 + Math.sin(G.time * 45) * 0.05;
      if (p.attackT <= 0) p.actionT = 0;
      p.attackT = 0.2;
    }
    else p.fireT = 0;
  } else if (w.drain) {
    // cone / flame streams: projectiles are free, ammo is time-denominated
    if (Input.mdown && p.weapon.ammo > 0 && !(p.panicRoomT > 0)) {
      if (p.fireT <= 0) {
        fireWeapon(p, w);
        p.recoil = Math.min(1, p.recoil + 0.45);
        p.muzzleT = 0.07;
        p.attackT = 0.4; p.actionT = 0;
        p.fireT = rate;
        Sfx.shoot(w);
      }
      if (!(p.marrowDraughtT > 0)) p.weapon.ammo -= dt * w.drain / st.ammoEff;
    }
    else p.fireT = 0;
  } else if (w.behavior === 'beam') {
    if (Input.mdown && p.weapon.ammo > 0) {
      p.charge = Math.min(p.charge + dt * effectiveRate * Math.sqrt(st.shotSpeedMul), w.chargeTime);
    } else if (Input.mreleased && p.charge > 0) {
      if (p.charge >= w.chargeTime * 0.4) fireBeam(p, w, p.charge / w.chargeTime);
      p.charge = 0;
    } else {
      p.charge = Math.max(0, p.charge - dt * 2);
    }
  } else {
    if (Input.mdown && p.fireT <= 0 && p.weapon.ammo > 0 && !(p.panicRoomT > 0)) {
      fireWeapon(p, w);
      // Twin Sidearm: the Bone Popper double-taps
      if (st.twinSidearm > 0 && p.weapon.id === 'bonepopper') fireWeapon(p, w);
      // Hollow Choir: every 4th shot fires a free extra volley
      if (st.choirEvery > 0) {
        p.choirCount = (p.choirCount || 0) + 1;
        if (p.choirCount >= 4) { p.choirCount = 0; fireWeapon(p, w); }
      }
      // Crimson Metronome: every 8th shot costs ½ heart
      if (st.crimsonMetronome > 0) {
        p.metronomeCount = (p.metronomeCount || 0) + 1;
        if (p.metronomeCount >= 8) { p.metronomeCount = 0; p.hp = Math.max(0.5, p.hp - 1); spawnText(p.x, p.y - 14, '-½', '#e2472f'); }
      }
      p.recoil = Math.min(1, p.recoil + (w.behavior === 'slam' ? 1 : 0.45));
      p.muzzleT = 0.07;
      p.attackT = 0.4; p.actionT = 0;
      p.fireT = rate;
      if (p.weapon.ammo !== Infinity && !(p.marrowDraughtT > 0)) p.weapon.ammo -= (st.twinSidearm > 0 ? 2 : 1) / st.ammoEff;
      Sfx.shoot(w);
      if (w.behavior === 'slam') addShake(5);
    }
  }

  // out of ammo -> back to the Bone Popper
  if (p.weapon.ammo <= 0 && p.weapon.id !== 'bonepopper') {
    const spent = p.weapon;
    p.weapon = { id: 'bonepopper', ammo: Infinity };
    p.holstered = spent;
    p.charge = 0; p.fireT = 0;
    Sfx.stopAllLoops();
    addToast('Bone Popper', WEAPONS[spent.id].name + ' is empty');
  }

  // orbital knives
  if (st.orbitals > 0) {
    p.orbAng += dt * 3.2 * st.orbSpeedMul;
    const n = st.orbitals;
    for (let i = 0; i < n; i++) {
      const a = p.orbAng + (i / n) * TAU;
      const ox = p.x + Math.cos(a) * 58, oy = p.y + Math.sin(a) * 58;
      for (const e of G.enemies) {
        if (e.orbT > 0) continue;
        if (dist2(ox, oy, e.x, e.y) < (12 + e.r) * (12 + e.r)) {
          e.orbT = 0.35;
          damageEnemy(e, 12 * st.dmgMul * st.dmgLiveMul * st.orbDmgMul, a + Math.PI / 2, true, {
            source: 'player', procScale: 0.5, procMagnitudeScale: 0.5,
          });
          spawnBlood(e.x, e.y, a, 3);
        }
      }
    }
  }

  // open queued level-ups
  if (G.pendingLevelups > 0 && G.mode === 'play') openPerkDraft();

  // ---- phase-3 live multipliers & auras ----
  // Slaughter Rhythm: +rate per recent kill, Pain Engine: +dmg after being hit
  p.killStamps = (p.killStamps || []).filter(t => G.time - t < 3);
  const rhythm = st.slaughterRhythm > 0 ? Math.min(p.killStamps.length * st.slaughterRhythm, 0.40) : 0;
  st.rhythmRateBonus = rhythm;
  if (p.painEngineT > 0) p.painEngineT -= dt;
  st.dmgLiveMul = p.painEngineT > 0 ? 1 + st.painEngine : 1;
  // The Last Cut: while at ½ heart, ×3 damage
  if (st.theLastCut > 0 && p.lastCutActive && p.hp <= 1) st.dmgLiveMul *= 3;

  // Meat Grinder: passive 12 dps aura within 90px
  if (st.meatGrinder > 0) {
    p.meatGrinderTick = (p.meatGrinderTick || 0) - dt;
    if (p.meatGrinderTick <= 0) {
      p.meatGrinderTick = 0.5;
      for (const e of G.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(e.x, e.y, p.x, p.y) < (90 + e.r) * (90 + e.r)) {
          tickEnemyDamage(e, 6 * st.dmgMul * st.dmgLiveMul);
          if (chance(0.3)) spawnBlood(e.x, e.y, angleTo(p.x, p.y, e.x, e.y), 2);
        }
      }
    }
  }

  // ---- active-item timed effects ----
  // Marrow Draught: +100% fire rate and free ammo while active
  if (p.marrowDraughtT > 0) p.marrowDraughtT -= dt;
  // Panic Room: invulnerable but cannot fire
  if (p.panicRoomT > 0) p.panicRoomT -= dt;
  // Cleaver Storm: 12 orbiting cleavers shred on contact
  if (p.cleaverStormT > 0) {
    p.cleaverStormT -= dt;
    p.cleaverStormAng = (p.cleaverStormAng || 0) + dt * 6;
    p.cleaverStormTick = (p.cleaverStormTick || 0) - dt;
    const doTick = p.cleaverStormTick <= 0;
    if (doTick) p.cleaverStormTick = 0.25;
    for (let i = 0; i < 12; i++) {
      const a = p.cleaverStormAng + (i / 12) * TAU;
      const cx = p.x + Math.cos(a) * 90, cy = p.y + Math.sin(a) * 90;
      if (!doTick) continue;
      for (const e of G.enemies) {
        if (e.hp <= 0 || e.stormHitT > 0) continue;
        if (dist2(cx, cy, e.x, e.y) < (14 + e.r) * (14 + e.r)) {
          e.stormHitT = 0.3;
          damageEnemy(e, 10 * st.dmgMul * st.dmgLiveMul, a + Math.PI / 2, true, { source: 'player' });
          spawnBlood(e.x, e.y, a, 3);
        }
      }
    }
    for (const e of G.enemies) if (e.stormHitT > 0) e.stormHitT -= dt;
  }

  // Thresher Plate: passive contact-damage aura (no need to be hit)
  if (st.thresherPlate > 0) {
    p.thresherTick = (p.thresherTick || 0) - dt;
    if (p.thresherTick <= 0) {
      p.thresherTick = 0.4;
      const range = 46 * Math.sqrt(st.sizeMul);
      for (const e of G.enemies) {
        if (e.hp <= 0 || e.boss) continue;
        if (dist2(e.x, e.y, p.x, p.y) < (range + e.r) * (range + e.r)) {
          damageEnemy(e, 6 * st.thresherPlate * st.dmgMul * st.dmgLiveMul, angleTo(p.x, p.y, e.x, e.y), true, { noProc: true });
        }
      }
    }
  }
  // Iron Lung room-block cooldown flag is set in enterRoom
}

function armorBlockChance(rating) {
  return Math.min(0.75, Math.max(0, rating) / (1 + Math.max(0, rating)));
}

function pressureRelief(dmgTaken) {
  const p = G.player;
  const hpFrac = clamp(p.hp / Math.max(1, p.stats.maxHp), 0, 1);
  const severity = clamp(dmgTaken / Math.max(2, p.stats.maxHp * 0.25), 0.4, 2);
  const desperation = 1 + (1 - hpFrac) * 2;
  const churn = 1 + Math.min(G.recentHits.length, 4) * 0.35;
  return PRESSURE_DROP_BASE * PRESSURE_UNIT * severity * desperation * churn * pressureDropScale();
}

function hurtPlayer(dmg, ang, attacker) {
  if (G.debugFlags && G.debugFlags.god) return;
  const p = G.player;
  // live sim = play mode, or the pinned debug console running the world
  const live = G.mode === 'play' || (G.mode === 'debug' && G.debugPin);
  if (p.invT > 0 || p.hp <= 0 || !live) return;
  // Iron Lung: the first hit each room is blocked
  if (p.ironLungReady) {
    p.ironLungReady = false;
    p.invT = 0.5; p.hitT = 0.1;
    spawnText(p.x, p.y - 20, 'IRON LUNG', '#9fb4bd');
    addShake(2); Sfx.shieldUp();
    return;
  }
  if (p.stats.armor > 0 && chance(armorBlockChance(p.stats.armor))) {
    p.invT = 0.2;
    p.hitT = 0.1;
    spawnText(p.x, p.y - 20, 'BLOCKED', '#d8c991');
    addShake(2);
    return;
  }
  let reduced = Math.max(1, Math.round(dmg));
  // Meat Grinder: aura damages you for +1 per hit taken
  if (p.stats.meatGrinder > 0) reduced += p.stats.meatGrinder;
  // shield hearts absorb first (from the Shield Heart perk)
  if (p.shieldHp > 0) {
    const absorbed = Math.min(p.shieldHp, reduced);
    p.shieldHp -= absorbed;
    reduced -= absorbed;
    if (p.shieldHp <= 0) { spawnText(p.x, p.y - 20, 'SHIELD DOWN', '#3bc9e0'); Sfx.shieldBreak(); }
  }
  p.hp -= reduced;
  p.hitT = 0.18;
  p.invT = 0.9 + p.stats.invBonus;
  if (reduced > 0 && p.stats.painEngine > 0) p.painEngineT = 4;
  G.flash = 0.35;
  addShake(7);
  Sfx.hurt();
  spawnBlood(p.x, p.y, ang, 8);
  if (ang) { p.x += Math.cos(ang) * 14; p.y += Math.sin(ang) * 14; }
  if (reduced > 0) {
    G.roomDamaged = true;
    G.recentHits = (G.recentHits || []).filter(t => G.time - t < 12);
    G.recentHits.push(G.time);
    applyPressureDelta(-pressureRelief(reduced));
    G.streak = 0;
  }
  if (attacker && attacker.hp > 0 && p.stats.thorns > 0) {
    damageEnemy(attacker, p.stats.thorns * p.stats.dmgMul, angleTo(p.x, p.y, attacker.x, attacker.y), true, { noProc: true });
  }
  if (p.stats.retaliate > 0) {
    areaDamage(p.x, p.y, 85 * Math.sqrt(p.stats.sizeMul), p.stats.retaliate * p.stats.dmgMul, true, { noProc: true });
    spawnExplosionFx(p.x, p.y, 70);
  }
  // The Last Cut: at the brink, gain ×3 damage and +1s immunity
  if (p.stats.theLastCut > 0 && p.hp > 0 && p.hp <= 1 && !p.lastCutActive) {
    p.lastCutActive = true;
    p.invT = Math.max(p.invT, 1.0 + p.stats.invBonus);
    spawnText(p.x, p.y - 20, 'THE LAST CUT', '#e2472f');
    addToast('THE LAST CUT', '×3 damage while at ½ heart');
    Sfx.shieldUp();
  }
  if (p.hp <= 0) {
    // Second Skin: revive once per floor at ½ heart
    if (p.stats.secondSkin > 0 && !p.secondSkinUsed) {
      p.secondSkinUsed = true;
      p.hp = 1;
      p.invT = 1.5;
      G.flash = 0.6;
      addShake(10);
      spawnText(p.x, p.y - 20, 'SECOND SKIN', '#e2472f');
      addToast('SECOND SKIN', 'you refuse to die — once per floor');
      Sfx.revive();
      return;
    }
    p.hp = 0;
    p.deathT = 0;
    gameOver();
  }
}

function healPlayer(n) {
  const p = G.player;
  const missing = Math.max(0, p.stats.maxHp - p.hp);
  const healed = Math.min(missing, n);
  p.hp += healed;
  const overflow = n - healed;
  if (overflow > 0 && p.stats.overShield > 0) {
    p.shieldHp = Math.min((p.stats.shieldPerk || 0) + p.stats.overShield, p.shieldHp + overflow);
  }
}


// Lifesteal has dedicated feedback so ordinary healing sources do not double-print.
function lifestealPlayer(amount) {
  const p = G.player;
  if (!p || p.hp >= p.stats.maxHp) return false;
  const before = p.hp;
  healPlayer(amount);
  const healed = p.hp - before;
  if (healed <= 0) return false;
  const hearts = healed / 2;
  const label = hearts === 0.5 ? '+½ HEART' : ('+' + hearts + (hearts === 1 ? ' HEART' : ' HEARTS'));
  spawnText(p.x, p.y - 18, label, '#d92038');
  Sfx.lifesteal();
  return true;
}

function drawPlayer(ctx) {
  const p = G.player;
  const blink = p.invT > 0 && Math.floor(G.time * 20) % 2 === 0;
  if (blink && p.hp > 0) return;

  // orbital knives
  const st = p.stats;
  if (st.orbitals > 0) {
    for (let i = 0; i < st.orbitals; i++) {
      const a = p.orbAng + (i / st.orbitals) * TAU;
      Sprites.draw(ctx, 'bullet_cleaver', p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, a + Math.PI / 2, 24);
    }
  }
  // Cleaver Storm active: 12 orbiting cleavers
  if (p.cleaverStormT > 0) {
    for (let i = 0; i < 12; i++) {
      const a = (p.cleaverStormAng || 0) + (i / 12) * TAU;
      Sprites.draw(ctx, 'bullet_cleaver', p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, a + Math.PI / 2, 22);
    }
  }

  const w = WEAPONS[p.weapon.id];
  const kick = p.recoil * 3;
  Sprites.shadow(ctx, p.x, p.y + 17, 27 + p.moveBlend * 2, 9, 0.46);
  if (p.hp <= 0) {
    Sprites.strip(ctx, 'player_death_sheet', p.x, p.y, p.deathT || 0, 12, 14, 128, 144, true);
  } else {
    Sprites.legs(ctx, p.x, p.y + 4, p.bodyFacing, p.step, 124);
    const torsoOffset = (w.torsoFwd || 18) - kick;
    const torsoX = p.x + Math.cos(p.aim) * torsoOffset;
    const torsoY = p.y + Math.sin(p.aim) * torsoOffset;
    Sprites.draw(ctx, 'pt_' + p.weapon.id, torsoX, torsoY, p.aim, w.torsoW || 116, p.hitT > 0);
  }
  if (p.hp > 0 && p.muzzleT > 0 && w.behavior !== 'slam') {
    const muzzleDist = (w.muzzle || 40) - kick;
    const mx = p.x + Math.cos(p.aim) * muzzleDist, my = p.y + Math.sin(p.aim) * muzzleDist;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(p.aim);
    ctx.globalAlpha = p.muzzleT / 0.07;
    ctx.fillStyle = '#ffe6a0';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, -5); ctx.lineTo(9, 0); ctx.lineTo(13, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Spinal Tap charge indicator
  if (w.behavior === 'beam' && p.charge > 0.05) {
    const k = p.charge / w.chargeTime;
    ctx.strokeStyle = k >= 1 ? '#60c0ff' : '#2a5a8a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    if (k >= 1 && chance(0.3)) {
      addParticle({ type: 'spark', x: p.x + rand(-10, 10), y: p.y + rand(-10, 10), vx: 0, vy: -30, life: 0.2, t: 0, r: 1.5 });
    }
  }
}
