// ---- particles: blood, gibs, flame, smoke, shockwaves, sparks, text, beams ----

const MAX_PARTICLES = 850;

// Cosmetic bursts should never be able to starve the game loop. Important
// particles (damage text and beams) make room by retiring the oldest effect.
function addParticle(p, important) {
  if (G.parts.length >= MAX_PARTICLES) {
    if (!important) return false;
    G.parts.splice(0, Math.min(24, G.parts.length - MAX_PARTICLES + 1));
  }
  G.parts.push(p);
  return true;
}

function spawnBlood(x, y, ang, n, big) {
  for (let i = 0; i < n; i++) {
    const a = ang + rand(-0.9, 0.9);
    const sp = rand(40, big ? 260 : 160);
    addParticle({
      type: 'blood', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.3, 0.7), t: 0,
      r: rand(1.5, big ? 4.5 : 3),
      mist: i % 4 === 0, shade: i % 3,
    });
  }
  // persistent floor decal
  if (G.cur && chance(0.55)) {
    G.cur.decals.push({
      x: x + rand(-14, 14), y: y + rand(-14, 14),
      img: 'decal_blood' + irand(1, 4),
      s: rand(0.5, big ? 1.6 : 1.0), rot: rand(0, TAU),
    });
    if (G.cur.decals.length > 220) G.cur.decals.shift();
  }
}


// Footstep-time query only: newest decals first, with their rendered scale.
function onGore(x, y) {
  const room = G.cur;
  if (!room || !room.decals) return false;
  for (let i = room.decals.length - 1; i >= 0; i--) {
    const decal = room.decals[i], radius = 24 * decal.s;
    if (dist2(x, y, decal.x, decal.y) < radius * radius) return true;
  }
  return false;
}

function spawnGibs(x, y, n, big, important) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(60, big ? 290 : 220);
    const bone = chance(big ? 0.3 : 0.18);
    const r = rand(2, big ? 7 : 5);
    addParticle({
      type: 'gib', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.5, big ? 1.35 : 1.1), t: 0, r,
      w: r * rand(1.3, 2.6), h: r * rand(0.65, 1.25),
      bone, shade: i % 3, rot: rand(0, TAU), vr: rand(-10, 10),
    }, important);
  }
}

function spawnSpark(x, y, ang) {
  for (let i = 0; i < 4; i++) {
    const a = ang + Math.PI + rand(-0.7, 0.7);
    const sp = rand(80, 200);
    addParticle({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.1, 0.25), t: 0, r: 1.5 });
  }
}

function spawnText(x, y, str, color) {
  addParticle({ type: 'text', x: x + rand(-6, 6), y: y - 10, vx: 0, vy: -45, life: 0.7, t: 0, str, color: color || '#f7ead8' }, true);
}

function spawnBeam(x1, y1, ang, len) {
  addParticle({ type: 'beam', x: x1, y: y1, ang, len, life: 0.22, t: 0 }, true);
  for (let i = 0; i < 14; i++) {
    const d = rand(20, len);
    addParticle({
      type: 'spark', x: x1 + Math.cos(ang) * d, y: y1 + Math.sin(ang) * d,
      vx: rand(-120, 120), vy: rand(-120, 120), life: rand(0.15, 0.35), t: 0, r: 2,
    });
  }
}

function spawnSmoke(x, y, ang, n, color) {
  for (let i = 0; i < n; i++) {
    const a = ang + rand(-0.8, 0.8), sp = rand(14, 55);
    addParticle({
      type: 'smoke', x: x + rand(-3, 3), y: y + rand(-3, 3),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(5, 24),
      life: rand(0.28, 0.65), t: 0, r: rand(3, 7), color: color || '#21161a',
    });
  }
}

function spawnShockwave(x, y, radius, color, alpha, important) {
  addParticle({
    type: 'shockwave', x, y, vx: 0, vy: 0, life: 0.42, t: 0,
    r: 5, maxR: radius, color: color || '#ffb06a', alpha: alpha === undefined ? 0.8 : alpha,
  }, important);
}

function spawnMuzzleFx(x, y, ang, behavior) {
  if (behavior === 'slam') return;
  const back = ang + Math.PI;
  if (behavior === 'flame') {
    for (let i = 0; i < 3; i++) {
      const a = ang + rand(-0.22, 0.22), sp = rand(70, 155);
      addParticle({ type: 'flame', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.14, 0.3), t: 0, r: rand(3, 6) });
    }
    spawnSmoke(x, y, back, 1);
  } else if (behavior === 'cone') {
    for (let i = 0; i < 3; i++) {
      const a = ang + rand(-0.3, 0.3), sp = rand(55, 130);
      addParticle({ type: 'mist', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.18, 0.34), t: 0, r: rand(2, 5), color: '#82c83d' });
    }
  } else if (behavior === 'beam') {
    spawnShockwave(x, y, 34, '#77e7ff', 0.75);
    spawnSpark(x, y, ang);
  } else {
    const count = behavior === 'spread' ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const a = back + rand(-0.55, 0.55), sp = rand(45, 120);
      addParticle({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.08, 0.18), t: 0, r: rand(0.8, 1.6) });
    }
    if (behavior === 'lob' || behavior === 'lob_trap' || behavior === 'lob_swarm') spawnSmoke(x, y, back, 2);
  }
}

function spawnExplosionFx(x, y, r) {
  const flames = Math.min(28, 14 + Math.floor(r / 10));
  for (let i = 0; i < flames; i++) {
    const a = rand(0, TAU), sp = rand(60, 300);
    addParticle({ type: 'flame', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.22, 0.58), t: 0, r: rand(3, 8) });
  }
  spawnShockwave(x, y, r, '#ff9a55', 0.9);
  spawnShockwave(x, y, r * 0.66, '#ffd49a', 0.6);
  spawnSmoke(x, y, -Math.PI / 2, Math.min(8, 3 + Math.floor(r / 25)));
  spawnGibs(x, y, 5, r >= 80);
  addShake(6);
}

function spawnPlayerGore(x, y) {
  spawnExplosionFx(x, y, 110);
  spawnShockwave(x, y, 138, '#ff2947', 0.95, true);
  for (let i = 0; i < 4; i++) spawnBlood(x, y, i * TAU / 4, 10, true);
  spawnGibs(x, y, 26, true, true);
  for (let i = 0; i < 18; i++) {
    const a = rand(0, TAU), sp = rand(90, 350);
    addParticle({ type: 'flame', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.22, 0.68), t: 0, r: rand(4, 10) }, true);
  }
  addShake(16);
}

function spawnCorpse(e) {
  G.corpses.push({
    sprite: e.sprite, x: e.x, y: e.y,
    facing: G.player ? angleTo(e.x, e.y, G.player.x, G.player.y) : 0,
    size: e.drawSize || (e.boss ? 128 : 64), t: 0, life: e.boss ? 1.15 : 0.75,
  });
  if (G.corpses.length > 48) G.corpses.shift();
}

function updateParticles(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.t += dt;
    if (p.t >= p.life) { G.parts.splice(i, 1); continue; }
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    if (p.type === 'blood' || p.type === 'gib') {
      const drag = Math.pow(0.88, dt * 60);
      p.vx *= drag; p.vy *= drag;
    } else if (p.type === 'smoke' || p.type === 'mist') {
      const drag = Math.pow(0.94, dt * 60);
      p.vx *= drag; p.vy *= drag;
    }
    if (p.rot !== undefined) p.rot += p.vr * dt;
  }
  for (let i = G.corpses.length - 1; i >= 0; i--) {
    const c = G.corpses[i];
    c.t += dt;
    if (c.t >= c.life) G.corpses.splice(i, 1);
  }
  if (G.player && G.player.hp <= 0) G.player.deathT = (G.player.deathT || 0) + dt;
}

function drawCorpses(ctx) {
  for (const c of G.corpses) {
    const fade = clamp((c.life - c.t) * 4, 0, 1);
    Sprites.shadow(ctx, c.x, c.y + c.size * 0.2, c.size * 0.3, c.size * 0.1, 0.2 * fade);
    Sprites.actor(ctx, c.sprite, c.x, c.y, c.facing, 'death', c.t, c.size, fade);
  }
}

function drawParticles(ctx) {
  for (const p of G.parts) {
    const k = 1 - p.t / p.life;
    if (p.type === 'blood') {
      const speed = Math.hypot(p.vx || 0, p.vy || 0);
      ctx.globalAlpha = k * (p.mist ? 0.55 : 0.92);
      ctx.fillStyle = p.shade === 0 ? '#d02032' : (p.shade === 1 ? '#8f0d1c' : '#5d0913');
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * k + Math.min(4, speed * 0.018), p.r * k * (p.mist ? 0.45 : 0.7) + 0.4, 0, 0, TAU);
      ctx.fill(); ctx.restore();
    } else if (p.type === 'gib') {
      ctx.globalAlpha = k;
      ctx.strokeStyle = p.bone ? '#5b4938' : '#3c0710'; ctx.lineWidth = 1;
      ctx.fillStyle = p.bone ? '#d2bd98' : (p.shade === 0 ? '#9f1524' : (p.shade === 1 ? '#68101a' : '#3e0a0e'));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    } else if (p.type === 'spark') {
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffe69a';
      ctx.lineWidth = Math.max(1, p.r * k);
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
    } else if (p.type === 'flame') {
      const radius = p.r * k + 1;
      ctx.globalAlpha = k * 0.34;
      ctx.fillStyle = '#7b1016'; ctx.beginPath(); ctx.arc(p.x, p.y, radius * 1.75, 0, TAU); ctx.fill();
      ctx.globalAlpha = k * 0.9;
      ctx.fillStyle = k > 0.55 ? '#ff8c22' : '#d3261f'; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe7a2'; ctx.globalAlpha = k * 0.75;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.8, radius * 0.38), 0, TAU); ctx.fill();
    } else if (p.type === 'smoke') {
      ctx.globalAlpha = k * 0.36;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.45 - k * 0.45), 0, TAU); ctx.fill();
    } else if (p.type === 'mist') {
      ctx.globalAlpha = k * 0.52;
      ctx.fillStyle = p.color || '#82c83d';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.7 + (1 - k) * 0.8), 0, TAU); ctx.fill();
    } else if (p.type === 'shockwave') {
      const progress = 1 - k;
      const radius = lerp(p.r, p.maxR, progress);
      ctx.globalAlpha = k * p.alpha;
      ctx.strokeStyle = p.color; ctx.lineWidth = 1.5 + k * 5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, radius, radius * 0.72, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = k * 0.18;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, radius * 0.86, radius * 0.58, 0, 0, TAU); ctx.fill();
    } else if (p.type === 'beam') {
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#d9f6ff'; ctx.lineWidth = 13 * k + 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.ang) * p.len, p.y + Math.sin(p.ang) * p.len); ctx.stroke();
      ctx.strokeStyle = '#4bd7ff'; ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (p.type === 'text') {
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(p.str, p.x, p.y);
    }
  }
  ctx.globalAlpha = 1;
}
