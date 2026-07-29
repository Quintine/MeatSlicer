// ---- in-game field manual (opened from the pause screen) ----
// List pages render live from WEAPONS / ITEMS / PERKS / ENEMY_TYPES / BOSS_DEFS
// so the manual never drifts from the actual game data.

const HELP_BUTTON = { x: W - 104, y: 24, w: 80, h: 26 };

const HELP_PAGES = [
  { title: 'CONTROLS' },
  { title: 'THE LOOP' },
  { title: 'ARSENAL' },
  { title: 'MUTATIONS' },
  { title: 'IMPLANTS' },
  { title: 'BESTIARY' },
  { title: 'PRESSURE' },
];

const HELP_PANEL = { w: 720, h: 500, y: 66 };
function helpPanelX() { return (W - HELP_PANEL.w) / 2; }

function helpTabRect(i) {
  const tw = 96, gap = 6;
  const total = HELP_PAGES.length * tw + (HELP_PAGES.length - 1) * gap;
  return { x: W / 2 - total / 2 + i * (tw + gap), y: HELP_PANEL.y + 66, w: tw, h: 26 };
}

function helpCloseRect() {
  return { x: helpPanelX() + HELP_PANEL.w - 74, y: HELP_PANEL.y + 12, w: 62, h: 26 };
}

function inRect(mx, my, r) { return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }

function fit(line, n) { return line.length > n ? line.slice(0, n - 1) + '…' : line; }

function updatePauseHelp() {
  if (keyPressed('h', 'escape')) { G.pauseHelp = false; Sfx.menu(); return; }
  if (keyPressed('arrowright')) { G.helpPage = (G.helpPage + 1) % HELP_PAGES.length; Sfx.menu(); }
  else if (keyPressed('arrowleft')) { G.helpPage = (G.helpPage + HELP_PAGES.length - 1) % HELP_PAGES.length; Sfx.menu(); }
  else {
    for (let i = 0; i < HELP_PAGES.length; i++) {
      if (keyPressed(String(i + 1))) { G.helpPage = i; Sfx.menu(); break; }
    }
  }
  if (Input.mpressed) {
    if (inRect(Input.mx, Input.my, helpCloseRect()) || inRect(Input.mx, Input.my, HELP_BUTTON)) {
      G.pauseHelp = false; Sfx.menu(); return;
    }
    for (let i = 0; i < HELP_PAGES.length; i++) {
      if (inRect(Input.mx, Input.my, helpTabRect(i))) { G.helpPage = i; Sfx.menu(); break; }
    }
  }
}

// ---- shared text helpers ----
function helpLines(ctx, px, ty, sections, maxW) {
  ctx.textAlign = 'left';
  for (const sec of sections) {
    if (sec.head) {
      ctx.fillStyle = '#d7a934'; ctx.font = 'bold 10px monospace';
      ctx.fillText(sec.head, px + 40, ty);
      ty += 21;
    }
    ctx.fillStyle = '#b8a89e'; ctx.font = '9px monospace';
    for (const line of sec.lines) {
      const wraps = ctx.measureText(line).width > maxW ? 1 : 0;
      wrapText(ctx, line, px + 40, ty, maxW, 13);
      ty += 15 + wraps * 13;
    }
    ty += 9;
  }
  return ty;
}

// ---- page bodies ----
function drawHelpControls(ctx, px, py) {
  helpLines(ctx, px, py + 116, [
    { head: 'IN THE FIELD', lines: [
      'WASD / ARROWS — MOVE      MOUSE — AIM      LMB (HOLD) — FIRE',
      'LMB RELEASE — FIRE CHARGED BEAM (SPINAL TAP ONLY)',
      'R — SWAP BONE POPPER ↔ HOLSTERED SPECIAL (EMPTY SPECIALS LOCKED)',
      'P / ESC — PAUSE · M — MUTE · N — NEXT TRACK · T — AUTO-DRAFT',
      'DESKTOP APP: F11 — FULLSCREEN · F12 — DEVTOOLS · CTRL+R — RELOAD',
    ] },
    { head: 'MUTATION DRAFT (LEVEL-UP)', lines: [
      '1 / 2 / 3 OR CLICK — CHOOSE PERK · 4 / SPACE — RANDOM CUT',
      'R — REROLL ALL THREE (COSTS 1 REROLL TOKEN)',
    ] },
    { head: 'PAUSE / JUKEBOX', lines: [
      '- / = — SFX VOLUME · , / . — MUSIC VOLUME',
      '[ / ] OR ARROWS — CHANGE TRACK (LIVE BOSS FIGHTS OVERRIDE)',
      'H OR THE [?] BUTTON — THIS MANUAL',
    ] },
    { head: 'MENUS', lines: [
      'ENTER / SPACE / CLICK — START RUN · R / ENTER — RESTART AFTER DEATH',
      'PICKUPS ARE COLLECTED BY WALKING OVER THEM — NO INTERACT KEY',
    ] },
  ], HELP_PANEL.w - 80);
}

function drawHelpLoop(ctx, px, py) {
  helpLines(ctx, px, py + 116, [
    { head: 'A RUN', lines: [
      'ROOMS PER FLOOR: MIN(5 + FLOOR, 9). BOSS = FARTHEST ROOM.',
      'ITEM ROOM = SECOND FARTHEST (DIST ≥ 2): PEDESTAL + 35% WEAPON.',
      'DOORS LOCK UNTIL EVERY WAVE DIES. RE-ENTRY RESTARTS REMAINING WAVES.',
      'BOSS DROPS: ITEM PEDESTAL + WEAPON (ROLLED AT FLOOR + 2) + STAIRS.',
      'NO FINAL FLOOR — DESCEND, SCORE, SURVIVE. BEST CUT IS SAVED.',
    ] },
    { head: 'WAVES PER COMBAT ROOM', lines: [
      'BASE = 3 + CEIL(FLOOR × 1.4) · F2+: +CEIL(BASE × 0.7) · F4+: +CEIL(BASE × 0.5)',
      'WAVES SPAWN 0.9S APART · HARD CAP 72 LIVE ENEMIES',
    ] },
    { head: 'DROPS (LUCK SCALES MOST CHANCES)', lines: [
      'ROOM CLEAR: 3–5+FLOOR XP · 24%+LUCK×30% AMMO · 10%+LUCK×30% HEART',
      'NORMAL KILL: 7%+LUCK×4% AMMO · 2.2%+LUCK×3% HEART',
      'ELITE KILL: 3× XP + 3–5 GEMS · 18%+LUCK×10% ITEM · ELSE 60%+LUCK×20% AMMO',
    ] },
    { head: 'SCORE', lines: [
      'KILL +10 · ELITE +40 · BOSS 500 + FLOOR × 100 · ROOM +50 · FLOOR +250',
      'XP +1 · FULL-HP HEART +25 · TIER-IX DUPLICATE ITEM +150',
    ] },
  ], HELP_PANEL.w - 80);
}

function drawHelpArsenal(ctx, px, py) {
  const x = px + 40;
  let ty = py + 112;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d7a934'; ctx.font = 'bold 9px monospace';
  ctx.fillText('16 WEAPONS · HIGHER TIERS DROP MORE ON DEEPER FLOORS · BONE POPPER = INFINITE', x, ty);
  ty += 18;
  const cols = [0, 168, 208, 252, 300, 372, 440];
  const head = ['NAME', 'TIER', 'DMG', 'RATE', 'AMMO', 'DPS', 'BEHAVIOR'];
  ctx.fillStyle = '#7d6a68'; ctx.font = 'bold 8px monospace';
  for (let c = 0; c < cols.length; c++) ctx.fillText(head[c], x + cols[c], ty);
  ty += 13;
  ctx.font = '8px monospace';
  let row = 0;
  for (const w of Object.values(WEAPONS)) {
    if (row % 2 === 0) { ctx.fillStyle = 'rgba(255,220,200,0.03)'; ctx.fillRect(x - 4, ty - 9, HELP_PANEL.w - 72, 12); }
    const dps = Math.round(w.dmg / Math.max(0.01, w.interval) * (w.pellets || 1));
    const vals = [w.name.toUpperCase(), w.tier < 0 ? 'SIDE' : 'T' + w.tier, String(w.dmg),
      w.interval.toFixed(2) + 's', w.ammo === Infinity ? '∞' : String(w.ammo), String(dps), w.behavior.toUpperCase()];
    ctx.fillStyle = '#c9b8ae';
    for (let c = 0; c < cols.length; c++) ctx.fillText(vals[c], x + cols[c], ty);
    ty += 12.5;
    row++;
  }
  ty += 8;
  helpLines(ctx, px, ty, [
    { head: 'SHARED WEAPON STATS (FROM IMPLANTS)', lines: [
      'SPLIT / FAN / REAR ADD VOLLEYS TO ALL BEHAVIORS — BEAMS, SLAMS, SAWS INCLUDED.',
      'HOMING STEERS EVERY PROJECTILE · RANGE EXTENDS BEAMS, SLAMS, LOBS AND SAW REACH',
      'PIERCE / BOUNCE BECOME +6% POWER EACH ON MELEE-STYLE WEAPONS (SLAM/SAW/BEAM)',
      'FIRE RATE SPEEDS THE CHAINSAW TICK AND SPINAL TAP CHARGE · SIZE SCALES ALL HITBOXES',
      'AMMO PICKUPS REFILL HELD + HOLSTERED, CAPPED AT 150% OF ONE MAGAZINE',
    ] },
  ], HELP_PANEL.w - 80);
}

function drawHelpPerkList(ctx, px, py) {
  const x = px + 40;
  let ty = py + 112;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d7a934'; ctx.font = 'bold 9px monospace';
  ctx.fillText('23 PERKS · DRAFT 1 OF 3 PER LEVEL · XP FOR NEXT LEVEL: 8 + LEVEL × 4', x, ty);
  ty += 8;
  ctx.fillStyle = '#7d6a68'; ctx.font = '8px monospace';
  ctx.fillText('REROLL RIB GRANTS TOKENS (R TO REDRAW) · AUTO-DRAFT (T) PICKS RANDOMLY', x, ty + 8);
  ty += 26;
  const colW = (HELP_PANEL.w - 80) / 2;
  for (let i = 0; i < PERKS.length; i++) {
    const col = Math.floor(i / 12), r = i % 12;
    const lx = x + col * colW, ly = ty + r * 15;
    ctx.fillStyle = '#e3b746'; ctx.font = 'bold 8px monospace';
    ctx.fillText(PERKS[i].name.toUpperCase(), lx, ly);
    ctx.fillStyle = '#a08d84'; ctx.font = '8px monospace';
    ctx.fillText(fit(PERKS[i].desc.toUpperCase(), 46), lx, ly + 9);
  }
}

function drawHelpItemList(ctx, px, py) {
  const x = px + 40;
  let ty = py + 112;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d7a934'; ctx.font = 'bold 9px monospace';
  ctx.fillText('46 IMPLANTS · STACK TO TIER IX · DUPLICATE ROLLS FAVORED · TIER IX → +150 SCORE', x, ty);
  ty += 18;
  const entries = Object.entries(ITEMS);
  const colW = (HELP_PANEL.w - 80) / 2;
  const rows = Math.ceil(entries.length / 2);
  for (let i = 0; i < entries.length; i++) {
    const col = Math.floor(i / rows), r = i % rows;
    const lx = x + col * colW, ly = ty + r * 12.6;
    ctx.fillStyle = '#e3b746'; ctx.font = 'bold 7px monospace';
    ctx.fillText(entries[i][1].name.toUpperCase(), lx, ly);
    ctx.fillStyle = '#a08d84'; ctx.font = '7px monospace';
    ctx.fillText(fit(entries[i][1].desc.toUpperCase(), 52), lx + 118, ly);
  }
}

function drawHelpBestiary(ctx, px, py) {
  const x = px + 40;
  let ty = py + 112;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d7a934'; ctx.font = 'bold 9px monospace';
  ctx.fillText('6 ENEMY TYPES · ELITES: ×2.6 HP, +1 DMG, 3× XP, GOLD RING, ITEM DROPS', x, ty);
  ty += 16;
  const notes = { shambler: 'CHASER', runner: 'FAST CHASER', spitter: 'RANGED KITER', splitter: 'SPLITS INTO 2 MINIS', mini: 'SWARMER', exploder: 'FUSED SUICIDE ×2 DMG' };
  ctx.font = '8px monospace';
  let row = 0;
  for (const [type, t] of Object.entries(ENEMY_TYPES)) {
    if (row % 2 === 0) { ctx.fillStyle = 'rgba(255,220,200,0.03)'; ctx.fillRect(x - 4, ty - 9, HELP_PANEL.w - 72, 12); }
    ctx.fillStyle = '#c9b8ae';
    ctx.fillText(type.toUpperCase(), x, ty);
    ctx.fillText('HP ' + t.hp, x + 100, ty);
    ctx.fillText('SPD ' + t.spd, x + 150, ty);
    ctx.fillText('DMG ' + t.dmg, x + 210, ty);
    ctx.fillText('XP ' + t.xp, x + 260, ty);
    ctx.fillText(notes[type] || '', x + 300, ty);
    ty += 12.5;
    row++;
  }
  ty += 8;
  ty = helpLines(ctx, px, ty, [
    { head: 'SCALING (APPLIED AT SPAWN)', lines: [
      'POWER = (LEVEL − 1) × 0.5 + Σ ALL ITEM TIERS',
      'ENEMY HP = BASE × (1 + 0.22(FLOOR−1)) × (1 + 0.05·POWER) × PRESSURE',
      'ENEMY SPD = BASE × (1 + 0.04(FLOOR−1) + 0.01·POWER) × PRESSURE (±10%)',
      'CONTACT DAMAGE NEVER SCALES — ONLY ELITES GET +1',
    ] },
  ], HELP_PANEL.w - 80);
  ctx.fillStyle = '#d7a934'; ctx.font = 'bold 9px monospace';
  ctx.fillText('9 BOSSES — ROTATION = (FLOOR − 1) MOD 9 · HP × (1 + 0.30(FLOOR−1)) · CYCLES ADD PATTERNS', x, ty);
  ty += 16;
  ctx.font = '8px monospace';
  for (let i = 0; i < BOSS_DEFS.length; i++) {
    const col = i % 3, r = Math.floor(i / 3);
    ctx.fillStyle = '#c9b8ae';
    ctx.fillText(BOSS_DEFS[i].name + '  ·  ' + BOSS_DEFS[i].hp + ' HP', x + col * 210, ty + r * 13);
  }
}

function drawHelpPressure(ctx, px, py) {
  helpLines(ctx, px, py + 116, [
    { head: 'ADAPTIVE PRESSURE (HUD, BOTTOM-RIGHT)', lines: [
      'MULTIPLIES ENEMY AND BOSS HP + SPEED AT SPAWN TIME · RANGE 0.75× – 1.60×',
      '+0.01 FOR EVERY ROOM CLEARED WITHOUT TAKING ANY DAMAGE',
      'RELIEF ON HIT = 0.03 × SEVERITY × DESPERATION × CHURN',
      '  SEVERITY = HIT / (MAX HP × 0.25), CLAMPED 0.4 – 2',
      '  DESPERATION = 1 + 2 × (1 − HP FRACTION) — MORE RELIEF WHEN HURT',
      '  CHURN = 1 + 0.35 × HITS IN LAST 12S (CAP +4) — MORE WHEN SWARMED',
      'DECAY: 0.02/S BELOW 35% HP · 0.008/S AFTER 90S IN ONE ROOM',
      'LIVING ENEMIES KEEP THEIR STATS — ONLY NEW SPAWNS CHANGE',
      'STREAK = CONSECUTIVE FLAWLESS CLEARS (COSMETIC)',
    ] },
    { head: 'DEFENSE MATH', lines: [
      'ARMOR = BLOCK CHANCE: RATING / (1 + RATING), HARD CAP 75%',
      '  THICK HIDE +1/24 RATING · TANNED HIDE +0.08/0.92 (DIMINISHING)',
      'BLOCKED HIT: 0 DAMAGE, 0.2S I-FRAMES, STREAK PRESERVED',
      'SHIELD HEARTS ABSORB FIRST, REFILL EACH FLOOR · 0.9S I-FRAMES ON HIT',
      'CRIT: 5% BASE CHANCE, ×2 DAMAGE (CRITMUL STACKS)',
    ] },
  ], HELP_PANEL.w - 80);
}

const HELP_RENDERERS = [drawHelpControls, drawHelpLoop, drawHelpArsenal, drawHelpPerkList, drawHelpItemList, drawHelpBestiary, drawHelpPressure];

function drawPauseHelp(ctx) {
  ctx.fillStyle = 'rgba(4,2,3,0.84)';
  ctx.fillRect(0, 0, W, H);
  const px = helpPanelX(), py = HELP_PANEL.y, pw = HELP_PANEL.w, ph = HELP_PANEL.h;
  drawPixelPanel(ctx, px, py, pw, ph, {
    accent: '#4a9cad', border: 'rgba(74,91,110,0.95)', fill: 'rgba(8,6,10,0.97)',
    blood: true, seed: G.helpPage + 21, bloodAlpha: 0.2,
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8eb7bd'; ctx.font = 'bold 9px monospace';
  ctx.fillText('BUTCHER FIELD MANUAL — PAGE ' + (G.helpPage + 1) + ' / ' + HELP_PAGES.length, W / 2, py + 30);
  ctx.fillStyle = '#f0e5d7'; ctx.font = 'bold 22px monospace';
  ctx.fillText(HELP_PAGES[G.helpPage].title, W / 2, py + 56);

  const cr = helpCloseRect();
  drawPixelTag(ctx, '[X]', cr.x, cr.y, { width: cr.w, height: cr.h, color: '#e8bf47', accent: '#9d7726' });
  for (let i = 0; i < HELP_PAGES.length; i++) {
    const r = helpTabRect(i);
    const active = i === G.helpPage;
    const hover = inRect(Input.mx, Input.my, r);
    drawPixelTag(ctx, HELP_PAGES[i].title, r.x, r.y, {
      width: r.w, height: r.h,
      color: active ? '#f1e4d5' : (hover ? '#cdbdb2' : '#7d6a68'),
      accent: active ? '#4a9cad' : '#3c2f38',
      fill: active ? 'rgba(24,15,22,0.95)' : 'rgba(12,7,11,0.85)',
      font: 'bold 8px monospace',
    });
  }

  HELP_RENDERERS[G.helpPage](ctx, px, py);

  ctx.textAlign = 'center';
  for (let i = 0; i < HELP_PAGES.length; i++) {
    ctx.fillStyle = i === G.helpPage ? '#d7a934' : '#4d3f44';
    ctx.fillRect(W / 2 - 52 + i * 16, py + ph - 42, 8, 3);
  }
  drawPixelTag(ctx, '[H / ESC] BACK   [← →] PAGES   [1-' + HELP_PAGES.length + '] JUMP', W / 2 - 150, py + ph - 30, {
    width: 300, height: 22, color: '#8f7f79', accent: '#4d3a42', font: 'bold 8px monospace',
  });
}
