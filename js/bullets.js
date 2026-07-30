// ---- projectile simulation (player bullets + enemy bullets) ----

const PROJECTILE_DRAW_SIZE = {
  bullet_bone: 16, bullet_saw: 24, bullet_cleaver: 24,
  bullet_harpoon: 32, bullet_eye: 24, bullet_syringe: 24, bullet_gore: 24,
  bullet_steam: 24,
};

function nearestEnemy(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const e of G.enemies) {
    if (e.phased) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function updateBullets(dt) {
  const p = G.player;
  if (G.bullets.length > 520) G.bullets.splice(0, G.bullets.length - 520);
  if (G.ebullets.length > 640) G.ebullets.splice(0, G.ebullets.length - 640);
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    // Sweep the first frame from the player's pivot to the per-weapon muzzle,
    // then sweep between simulation positions so long/fast weapons cannot skip
    // enemies standing inside the visible barrel or between frames.
    const prevX = b.spawnX === undefined ? b.x : b.spawnX;
    const prevY = b.spawnY === undefined ? b.y : b.spawnY;
    delete b.spawnX; delete b.spawnY;
    b.t += dt;
    let dead = false;

    // homing steer
    if (b.homing) {
      const e = nearestEnemy(b.x, b.y, 320);
      if (e) {
        const want = angleTo(b.x, b.y, e.x, e.y);
        const cur = Math.atan2(b.vy, b.vx);
        const na = angleLerp(cur, want, clamp(b.homing * dt, 0, 1));
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }

    // boomerang: decelerate then fly back to player
    if (b.behavior === 'boomerang') {
      b.phase += dt;
      if (b.phase > 0.45) {
        const a = angleTo(b.x, b.y, p.x, p.y);
        const sp = Math.min(Math.hypot(b.vx, b.vy) + 900 * dt, 520);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        if (dist2(b.x, b.y, p.x, p.y) < 400) dead = true; // caught
      } else {
        b.vx *= 0.985; b.vy *= 0.985;
      }
      b.ang += 14 * dt;
    }

    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.behavior === 'bounce' || b.behavior === 'pierce_drag') b.ang += 12 * dt;

    // walls
    const outL = b.x < WALL + 4, outR = b.x > W - WALL - 4, outU = b.y < WALL + 4, outD = b.y > H - WALL - 4;
    if (outL || outR || outU || outD) {
      const bouncesLeft = (b.bounces || 0) + (b.bounce || 0);
      if (bouncesLeft > 0) {
        if (outL || outR) b.vx = -b.vx;
        if (outU || outD) b.vy = -b.vy;
        b.x = clamp(b.x, WALL + 4, W - WALL - 4);
        b.y = clamp(b.y, WALL + 4, H - WALL - 4);
        if (b.bounces > 0) b.bounces--; else if (b.bounce > 0) b.bounce--;
        b.ang = Math.atan2(b.vy, b.vx);
        spawnSpark(b.x, b.y, b.ang);
        Sfx.ricochet({ x: b.x, y: b.y });
      } else if (b.lobbed) {
        dead = true; // fizzles on wall
      } else {
        spawnSpark(b.x, b.y, Math.atan2(b.vy, b.vx));
        Sfx.wallHit({ x: b.x, y: b.y });
        dead = true;
      }
    }

    // expired
    if (!dead && b.t >= b.life) {
      dead = true;
      // bile congeals into acid pools
      if (b.behavior === 'cone' && chance(0.35)) {
        G.hazards.push({ kind: 'acid', x: b.x, y: b.y, r: 24 * (b.sizeMul || 1), life: 3.5, t: 0, dps: b.dmg * 1.5 });
      }
      // Sawbone Coil: bullets split into 2 shards on expiry
      if (p.stats.sawboneCoil > 0 && !b.shard && b.behavior !== 'lob' && b.behavior !== 'lob_trap' && b.behavior !== 'lob_swarm') {
        for (let k = 0; k < 2; k++) {
          const sa = rand(0, TAU);
          G.bullets.push({
            x: b.x, y: b.y, ang: sa,
            vx: Math.cos(sa) * 260 * p.stats.shotSpeedMul, vy: Math.sin(sa) * 260 * p.stats.shotSpeedMul,
            r: 3 * p.stats.sizeMul, dmg: b.dmg * 0.4, pierce: 0, bounce: p.stats.bounce,
            life: 0.4 * p.stats.rangeMul, t: 0, behavior: 'bullet', sprite: 'bullet_bone',
            homing: p.stats.homing ? 1.6 + p.stats.homing * 0.7 : 0, shard: true, sizeMul: p.stats.sizeMul,
          });
        }
        spawnSpark(b.x, b.y, rand(0, TAU));
      }
    }

    // lobbed projectiles trigger on expiry (reached target)
    if (dead && b.lobbed && !b._triggered) {
      b._triggered = true;
      lobTrigger(b);
    }

    // enemy collision
    if (!dead) {
      for (const e of G.enemies) {
        if (e.hp <= 0 || e.phased || (b.hit && b.hit.has(e))) continue;
        if (e === b.dragTarget) continue;
        if (distToSegment(e.x, e.y, prevX, prevY, b.x, b.y) < b.r + e.r) {
          const a = Math.atan2(b.vy, b.vx);
          const killed = damageEnemy(e, b.dmg, a, true, { source: 'player', bullet: b });
          if (!b.hit) b.hit = new Set();
          b.hit.add(e);
          spawnBlood(b.x, b.y, a, 3);
          if (b.behavior === 'flame') { e.burnT = Math.max(e.burnT, 2.2); e.burnDps = Math.max(e.burnDps || 0, b.dmg * 2); }
          if (b.behavior === 'cone') {
            e.slowT = Math.max(e.slowT, 1.6);
            if (G.hazards.length < 80 && chance(0.45)) G.hazards.push({ kind: 'acid', x: b.x, y: b.y, r: 24 * (b.sizeMul || 1), life: 3.5, t: 0, dps: b.dmg * 1.5 });
          }
          // Hemophage remains an on-hit drain, naturally limited by its fire interval.
          if (b.lifesteal && p.hp < p.stats.maxHp && chance(b.lifesteal * 0.25)) lifestealPlayer(1);
          if (b.behavior === 'pierce_drag' && !b.dragTarget && !e.boss) {
            b.dragTarget = e; e.dragged = b;
          }
          if (b.pierce > 0) { b.pierce--; }
          else if (b.behavior === 'boomerang' || b.behavior === 'pierce_drag') { /* pass through */ }
          else {
            dead = true; break;
          }
        }
      }
    }

    // drag victim along with the harpoon
    if (b.dragTarget) {
      if (b.dragTarget.hp <= 0 || dead) b.dragTarget.dragged = null, b.dragTarget = null;
      else {
        b.dragTarget.x = b.x; b.dragTarget.y = b.y;
        if (b.t >= b.life) { damageEnemy(b.dragTarget, b.dmg * 0.5, b.ang, true); b.dragTarget.dragged = null; }
      }
    }

    if (dead) G.bullets.splice(i, 1);
  }

  // ---- enemy bullets ----
  for (let i = G.ebullets.length - 1; i >= 0; i--) {
    const b = G.ebullets[i];
    b.t += dt;
    if (b.behavior === 'orbit') {
      if (!b.anchor || b.anchor.hp <= 0) {
        b.behavior = null;
        const releaseAng = (b.orbA || 0) + Math.sign(b.orbSpd || 1) * Math.PI / 2;
        const releaseSpd = b.releaseSpd || 280;
        b.vx = Math.cos(releaseAng) * releaseSpd;
        b.vy = Math.sin(releaseAng) * releaseSpd;
        b.anchor = null;
      } else {
        b.orbA += b.orbSpd * dt;
        if (b.orbTargetR !== undefined) b.orbR = lerp(b.orbR, b.orbTargetR, clamp(dt * 5, 0, 1));
        b.x = b.anchor.x + Math.cos(b.orbA) * b.orbR;
        b.y = b.anchor.y + Math.sin(b.orbA) * b.orbR;
      }
    }
    if (b.behavior !== 'orbit') {
      if (b.homing) {
        const want = angleTo(b.x, b.y, p.x, p.y);
        const cur = Math.atan2(b.vy, b.vx);
        const ang = angleLerp(cur, want, clamp(b.homing * dt, 0, 1));
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      }
      if (b.accel) {
        const sp = Math.max(0, Math.hypot(b.vx, b.vy) + b.accel * dt);
        const ang = Math.atan2(b.vy, b.vx);
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    let dead = b.t >= b.life;
    if (b.behavior !== 'orbit') {
      const outL = b.x < WALL + 4, outR = b.x > W - WALL - 4;
      const outU = b.y < WALL + 4, outD = b.y > H - WALL - 4;
      if (outL || outR || outU || outD) {
        if (b.bounces > 0) {
          if (outL || outR) b.vx = -b.vx;
          if (outU || outD) b.vy = -b.vy;
          b.x = clamp(b.x, WALL + 4, W - WALL - 4);
          b.y = clamp(b.y, WALL + 4, H - WALL - 4);
          b.bounces--;
        } else dead = true;
      }
    }
    if (!dead && p.hp > 0 && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) * (b.r + p.r)) {
      hurtPlayer(b.dmg, Math.atan2(b.vy, b.vx));
      dead = true;
    }
    if (dead) G.ebullets.splice(i, 1);
  }
}

function lobTrigger(b) {
  if (b.behavior === 'lob') { // Flesh Masher: meat bomb
    const radius = 85 * (b.rangeMul || 1) * Math.sqrt(b.sizeMul || 1);
    areaDamage(b.x, b.y, radius, b.dmg, true, { source: 'player' });
    spawnExplosionFx(b.x, b.y, radius);
    spawnBlood(b.x, b.y, 0, 16, true);
    Sfx.explode({ x: b.x, y: b.y });
  } else if (b.behavior === 'lob_trap') { // Trap Queen
    G.hazards.push({ kind: 'trap', x: b.x, y: b.y, r: 16 * (b.sizeMul || 1), life: 12 * (b.rangeMul || 1), t: 0, dmg: b.dmg });
    Sfx.trapSet({ x: b.x, y: b.y });
  } else if (b.behavior === 'lob_swarm') { // Swarm Jar: homing maggots
    const st = G.player.stats;
    for (let i = 0; i < 6 + st.split + st.fan; i++) {
      const a = rand(0, TAU);
      G.bullets.push({
        x: b.x, y: b.y, ang: a,
        vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
        r: 4 * st.sizeMul, dmg: b.dmg, pierce: st.pierce, bounce: st.bounce, life: 2.2 * st.rangeMul, t: 0,
        behavior: 'maggot', sprite: 'bullet_gore', homing: 8 + st.homing * 0.7, sizeMul: st.sizeMul,
      });
    }
    spawnBlood(b.x, b.y, 0, 8);
    Sfx.spit({ x: b.x, y: b.y });
  }
}

function drawBullets(ctx) {
  for (const b of G.bullets) {
    let rot = b.ang;
    const sp = Math.hypot(b.vx || 0, b.vy || 0);
    if (sp > 20 && b.behavior !== 'boomerang') {
      const nx = b.vx / sp, ny = b.vy / sp;
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = b.behavior === 'cone' ? '#8ee84a' :
        (b.behavior === 'flame' ? '#ff8a2a' :
        (b.behavior === 'pierce_drag' ? '#b35b42' :
        (b.behavior === 'homing' ? '#df6b73' : '#f4dfbc')));
      ctx.lineWidth = Math.max(2, b.r * 0.7);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - nx * Math.min(22, sp * 0.04), b.y - ny * Math.min(22, sp * 0.04)); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (b.behavior === 'flame') {
      const life = 1 - b.t / b.life;
      ctx.globalAlpha = 0.24 * life;
      ctx.fillStyle = '#b01818'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.8 * life;
      ctx.fillStyle = '#ff8020'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(2, b.r * 0.45), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.behavior === 'cone') {
      const life = 1 - b.t / b.life;
      ctx.globalAlpha = 0.2 * life;
      ctx.fillStyle = '#b9ec55'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.75 * life;
      ctx.fillStyle = '#70c030'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d6ff78'; ctx.beginPath(); ctx.arc(b.x - 2, b.y - 2, 1.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.behavior === 'maggot') {
      ctx.fillStyle = '#d0d8b0';
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 2.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b4934'; ctx.fillRect(2.5, -1, 2, 2); ctx.restore();
      continue;
    }
    if (b.sprite === 'bullet_saw') rot = b.t * 18;
    Sprites.draw(ctx, b.sprite, b.x, b.y, rot, (PROJECTILE_DRAW_SIZE[b.sprite] || 24) * Math.sqrt(b.sizeMul || 1));
    if (b.sprite === 'bullet_saw') {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ffd67d'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, 11 + Math.sin(b.t * 28) * 2, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (b.sprite === 'bullet_harpoon' && sp > 20) {
      const nx = b.vx / sp, ny = b.vy / sp;
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#6f4b3d'; ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(b.x - nx * 7, b.y - ny * 7); ctx.lineTo(b.x - nx * 30, b.y - ny * 30); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    } else if (b.sprite === 'bullet_cleaver') {
      ctx.globalAlpha = 0.28; ctx.strokeStyle = '#f0c8b2'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, 13, rot - 1.1, rot + 0.4); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  for (const b of G.ebullets) {
    if (b.behavior === 'orbit' && b.anchor && b.anchor.hp > 0) {
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = '#7b5141'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(b.anchor.x, b.anchor.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ff3650'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.9, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    const sprite = b.sprite || 'bullet_gore';
    Sprites.draw(ctx, sprite, b.x, b.y, b.t * 6, PROJECTILE_DRAW_SIZE[sprite] || 24);
  }
}
