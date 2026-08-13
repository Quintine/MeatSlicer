// Quantitative weapon-tier scorer: ranks the arsenal by a composite of
// effective DPS, range, accuracy, and damage pool per ammo load.
// Run: node tools/score_weapons.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { Math, Object, Infinity, NaN };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'weapons.js'), 'utf8'), sandbox);
const WEAPONS = vm.runInContext('WEAPONS', sandbox);

// Behavior-aware effective DPS model. Multipliers are conservative estimates
// of how often the gimmick actually connects in a room of ~8 enemies.
function effectiveDps(w) {
  const base = w.dmg / w.interval;
  switch (w.behavior) {
    case 'bullet':      return base;
    case 'spread':      return (w.dmg * (w.pellets || 1)) / w.interval * 0.75; // not every pellet lands
    case 'boomerang':   return base * 1.6;                                     // return pass often re-hits
    case 'bounce':      return base * (1 + Math.min(w.bounces || 0, 3) * 0.35); // wall bounces re-hit
    case 'cone':        return (w.dmg * 2) / w.interval * 1.15;                // 2/volley + acid pools
    case 'flame':       return (w.dmg * 2) / w.interval * 1.40;                // 2/volley + burn DoT
    case 'homing':      return base;                                           // accuracy handled separately
    case 'pierce_drag': return base * 1.4;                                     // pierce + drag re-hit
    case 'lob':         return base * 1.3;                                     // AoE average multi-hit
    case 'lob_trap':    return base * 1.3;                                     // direct + trap zone control
    case 'lob_swarm':   return (w.dmg * 6) / w.interval * 0.85;                // 6 homing maggots
    case 'slam':        return base * 1.3;                                     // AoE multi-hit
    case 'sweep':       return base * 1.5;                                     // arc can hit multiple enemies
    case 'saw':         return base * 1.1;                                     // continuous contact
    case 'beam':        return (w.dmg * 1.0) / ((w.chargeTime || 0.8) + w.interval) * 1.2; // full-charge cycle, line pierce
    default:            return base;
  }
}

// Nominal engagement range in px.
function effectiveRange(w) {
  switch (w.behavior) {
    case 'lob': case 'lob_trap': case 'lob_swarm': return 520;      // cursor-targeted
    case 'slam':   return 46 * (w.range || 1) + 70;                 // reach + blast radius
    case 'saw':    return 90;                                       // chainsaw reach
    case 'beam':   return 900;                                      // screen-length beam
    default:       return (w.spd || 300) * (w.range || 0.45);       // projectile travel distance
  }
}

// 0..1 hit reliability from spread, homing, and targeting style.
function accuracy(w) {
  if (w.behavior === 'homing' || w.behavior === 'lob_swarm') return 1.0;
  if (['slam', 'saw', 'beam'].includes(w.behavior)) return 0.95;    // aimed AoE can't really miss
  if (['lob', 'lob_trap'].includes(w.behavior)) return 0.9;         // cursor-targeted
  return Math.max(0.2, 1 - (w.spread || 0) / 0.6);
}

// Total damage in one ammo load (with the same behavior multipliers as DPS).
function damagePool(w) {
  if (w.ammo === Infinity) return Infinity;
  if (w.drain) return effectiveDps(w) * (w.ammo / w.drain); // time-denominated magazine
  const perShot = effectiveDps(w) * w.interval;
  return perShot * w.ammo;
}

const rows = [];
for (const w of Object.values(WEAPONS)) {
  if (w.tier < 0) continue; // sidearm excluded
  rows.push({
    id: w.id, name: w.name, cur: w.tier,
    dps: effectiveDps(w),
    range: effectiveRange(w),
    acc: accuracy(w),
    pool: damagePool(w),
  });
}

const maxDps = Math.max(...rows.map(r => r.dps));
const maxRange = Math.max(...rows.map(r => r.range));
const maxPool = Math.max(...rows.map(r => r.pool));
// linear for DPS/range (real gameplay gaps), log for the pool (huge spread)
const norm = (v, max) => v / max;
const normLog = (v, max) => Math.log1p(v) / Math.log1p(max);

for (const r of rows) {
  r.score = 100 * (0.45 * norm(r.dps, maxDps) + 0.15 * norm(r.range, maxRange) + 0.10 * r.acc + 0.30 * normLog(r.pool, maxPool));
}
rows.sort((a, b) => b.score - a.score);

console.log('rank  weapon           cur  DPS    rng   acc   pool    score');
console.log('----  ---------------- ---  -----  ----  ----  ------  -----');
for (const r of rows) {
  console.log(
    String(rows.indexOf(r) + 1).padEnd(5),
    r.name.padEnd(17),
    String(r.cur).padEnd(4),
    r.dps.toFixed(1).padStart(6),
    String(Math.round(r.range)).padStart(5),
    r.acc.toFixed(2).padStart(5),
    String(Math.round(r.pool)).padStart(7),
    r.score.toFixed(1).padStart(6),
  );
}
