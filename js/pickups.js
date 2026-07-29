// ---- pickups: XP gems, hearts, ammo, weapon drops, pedestals, stairs ----

function spawnPickup(type, x, y, data) {
  const p = Object.assign({
    type, x, y, t: rand(0, TAU),
    vx: rand(-40, 40), vy: rand(-40, 40),
    magnet: false,
  }, data || {});
  G.pickups.push(p);
  return p;
}

function spawnGems(x, y, value) {
  while (value >= 5) { spawnPickup('gem', x + rand(-10, 10), y + rand(-10, 10), { v: 5 }); value -= 5; }
  for (let i = 0; i < value; i++) spawnPickup('gem', x + rand(-10, 10), y + rand(-10, 10), { v: 1 });
}


// Ammo drops preserve useful trigger time: low-damage rapid weapons receive
// a larger share, while heavy multi-pellet shots receive fewer rounds.
function ammoRefillFraction(w) {
  const effectiveDamage = Math.max(1, (w.dmg || 1) * (w.pellets || 1));
  const interval = Math.max(0.05, w.interval ?? 0.3);
  const damageWeight = Math.log2(effectiveDamage / 8);
  const rateWeight = Math.log2(interval / 0.3);
  // Heavy, slow attacks push the fraction down; light, rapid attacks push it up.
  const heaviness = clamp((damageWeight + rateWeight) / 4, -1, 1);
  return clamp(0.62 - heaviness * 0.28, 0.30, 0.88) * (w.ammoWeight || 1);
}

// room-clear reward burst (weapons come from bosses / item rooms, not room clears)
function spawnRoomReward(x, y, floor) {
  spawnGems(x, y, irand(3, 5 + floor));
  const luck = G.player.stats.luck;
  if (chance(0.24 + luck * 0.3)) spawnPickup('ammo', x + rand(-30, 30), y + rand(-30, 30));
  if (chance(0.10 + luck * 0.3)) spawnPickup('heart', x + rand(-30, 30), y + rand(-30, 30));
}

function updatePickups(dt) {
  const p = G.player;
  const magR = 46 * p.stats.magnet;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    if (!k || k.dead) { G.pickups.splice(i, 1); continue; }
    if (k.delay) k.delay -= dt;
    k.t += dt;
    k.x += k.vx * dt; k.y += k.vy * dt;
    k.vx *= 0.9; k.vy *= 0.9;
    const d = dist(k.x, k.y, p.x, p.y);

    // gems & small pickups fly to the player inside magnet radius
    if ((k.type === 'gem' || k.type === 'heart' || k.type === 'ammo') && d < magR) {
      const a = angleTo(k.x, k.y, p.x, p.y);
      const sp = lerp(320, 60, d / magR);
      k.x += Math.cos(a) * sp * dt; k.y += Math.sin(a) * sp * dt;
    }

    if (d < p.r + 12 && !(k.delay > 0)) {
      collectPickup(k);
      G.pickups.splice(i, 1);
    }
  }
}

function collectPickup(k) {
  const p = G.player;
  switch (k.type) {
    case 'gem':
      gainXP(k.v * p.stats.xpMul);
      Sfx.gem();
      break;
    case 'heart':
      if (p.hp < p.stats.maxHp) { healPlayer(2); spawnText(p.x, p.y, '+2', '#d92038'); }
      else addScore(25);
      Sfx.heart();
      break;
    case 'ammo': {
      // Generic rounds refill every finite-ammo weapon the butcher is carrying,
      // including a special weapon currently holstered behind the Bone Popper.
      const carried = [];
      if (p.weapon && p.weapon.id !== 'bonepopper') carried.push(p.weapon);
      if (p.holstered && p.holstered.id !== 'bonepopper' && !carried.includes(p.holstered)) carried.push(p.holstered);
      let total = 0, wasted = 0;
      for (const inst of carried) {
        const def = WEAPONS[inst.id];
        const cap = def.ammo * 1.5;
        const wanted = Math.max(1, Math.ceil(def.ammo * ammoRefillFraction(def) * p.stats.ammoPickupMul));
        const add = Math.max(0, Math.min(wanted, cap - inst.ammo));
        inst.ammo += add;
        total += add;
        wasted += wanted - add;
      }
      if (wasted > 0) addScore(Math.round(wasted * 2));
      if (total > 0) spawnText(p.x, p.y, '+' + total + ' CARRIED AMMO', '#d0b060');
      else if (!carried.length) addScore(15);
      Sfx.ammo();
      break;
    }
    case 'weapon': {
      const w = WEAPONS[k.wid];
      // drop the old special with its remaining ammo so it's never wasted
      const old = p.weapon.id !== 'bonepopper' ? p.weapon : p.holstered;
      if (old) {
        const a = rand(0, TAU);
        spawnPickup('weapon', p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 34,
          { wid: old.id, ammo: old.ammo, delay: 0.6 });
      }
      p.weapon = { id: w.id, ammo: k.ammo !== undefined ? k.ammo : w.ammo };
      p.holstered = null;
      p.fireT = 0; p.charge = 0;
      addToast(w.name, w.desc);
      spawnText(p.x, p.y, w.name.toUpperCase(), '#ffd060');
      Sfx.weapon();
      break;
    }
    case 'item': {
      giveItem(k.iid);
      for (const q of G.pickups) if (q.type === 'itemspot') q.dead = true; // remove pedestal base
      break;
    }
    case 'stairs':
      nextFloor();
      break;
  }
}

// readable nameplate shown when the player walks up to a pickup
function drawPickupLabel(ctx, text, x, y, color) {
  ctx.save();
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  const w = Math.ceil(ctx.measureText(text).width) + 18;
  drawPixelPanel(ctx, x - w / 2, y - 10, w, 20, {
    cut: 3, shadow: false, fill: 'rgba(7,3,5,0.9)', border: 'rgba(117,59,68,0.9)', accent: color,
  });
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 4);
  ctx.restore();
}

function drawPickups(ctx) {
  const p = G.player;
  for (const k of G.pickups) {
    const bob = Math.sin(k.t * 4) * 2.5;
    if (k.type !== 'itemspot' && k.type !== 'stairs') Sprites.shadow(ctx, k.x, k.y + 9, 11, 4, 0.3);
    if (k.type === 'gem') {
      const big = k.v >= 5;
      ctx.save();
      ctx.globalAlpha = 0.12 + Math.sin(k.t * 6) * 0.04;
      ctx.fillStyle = big ? '#55f5dc' : '#55aaff';
      ctx.beginPath(); ctx.arc(k.x, k.y + bob, big ? 20 : 14, 0, TAU); ctx.fill();
      ctx.restore();
      Sprites.draw(ctx, big ? 'gem_big' : 'gem_small', k.x, k.y + bob, k.t * 0.8, big ? 32 : 24, false, 1, 0.85 + Math.abs(Math.sin(k.t * 2)) * 0.15, 1);
    }
    else if (k.type === 'heart') Sprites.draw(ctx, 'heart', k.x, k.y + bob, Math.sin(k.t * 2) * 0.08, 32, false, 1, 1 + Math.sin(k.t * 5) * 0.05, 1 + Math.sin(k.t * 5) * 0.05);
    else if (k.type === 'ammo') Sprites.draw(ctx, 'ammo', k.x, k.y + bob, Math.sin(k.t * 1.5) * 0.04, 32);
    else if (k.type === 'weapon') {
      ctx.save();
      ctx.globalAlpha = 0.24 + Math.sin(k.t * 5) * 0.08;
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(k.x, k.y, 24 + Math.sin(k.t * 4) * 3, 0, TAU); ctx.stroke();
      ctx.restore();
      Sprites.draw(ctx, 'w_' + k.wid, k.x, k.y + bob, 0, 64);
    } else if (k.type === 'itemspot') {
      Sprites.draw(ctx, 'pedestal', k.x, k.y, 0, 64);
    } else if (k.type === 'item') {
      ctx.save();
      ctx.globalAlpha = 0.2 + Math.sin(k.t * 3) * 0.07;
      ctx.fillStyle = '#ffe075';
      ctx.beginPath(); ctx.arc(k.x, k.y - 28, 30, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ffe9a6'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(k.x, k.y - 28, 25 + Math.sin(k.t * 4) * 3, 0, TAU); ctx.stroke();
      ctx.restore();
      Sprites.draw(ctx, 'i_' + k.iid, k.x, k.y - 28 + bob, 0, 64);
    } else if (k.type === 'stairs') {
      Sprites.draw(ctx, 'stairs', k.x, k.y, 0, 64);
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(k.t * 3) * 0.25;
      ctx.strokeStyle = '#d8b84e'; ctx.lineWidth = 2;
      const inset = 3 + Math.sin(k.t * 3) * 2;
      ctx.strokeRect(k.x - 31 + inset, k.y - 31 + inset, 62 - inset * 2, 62 - inset * 2);
      ctx.restore();
    }

    // hover nameplates when close
    if (dist2(k.x, k.y, p.x, p.y) < 90 * 90) {
      if (k.type === 'weapon') drawPickupLabel(ctx, WEAPONS[k.wid].name, k.x, k.y - 44, '#ffd060');
      else if (k.type === 'item') drawPickupLabel(ctx, ITEMS[k.iid].name, k.x, k.y - 66, '#c9a227');
      else if (k.type === 'stairs') drawPickupLabel(ctx, 'STAIRS DOWN', k.x, k.y - 52, '#e8e0d0');
      else if (k.type === 'ammo') drawPickupLabel(ctx, 'AMMO', k.x, k.y - 26, '#d0b060');
    }
  }
}
