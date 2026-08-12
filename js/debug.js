// ---- hidden debug console ----
// Enabled only in dev builds / launches: packaged app needs `--dev`, browser
// needs `?dev=1` or localStorage meatslicer_dev=1. Open with the ` key from
// play or pause. Mutating actions taint the run (G.debugUsed) so best-score
// persistence is skipped. See docs/dev-debug.md.

function debugEnabled() {
  try { if (window.MSDesktop && window.MSDesktop.dev) return true; } catch (e) {}
  try { if (typeof location !== 'undefined' && location.search && location.search.indexOf('dev=1') !== -1) return true; } catch (e) {}
  try { if (typeof localStorage !== 'undefined' && localStorage.getItem('meatslicer_dev') === '1') return true; } catch (e) {}
  return false;
}

// Reset stats to defaults and re-apply every owned item tier and drafted perk.
// Removal / tier-setting routes through here because item.apply() is one-way.
// Note: maxHp-lowering items (Blood Debt, Butcher's Oath) replay in ownership
// insertion order, so the result is valid but not necessarily bit-identical to
// the original build order; hp is snapshotted and clamped afterward.
function debugRebuildStats() {
  const p = G.player;
  if (!p) return;
  const hp = p.hp;
  p.stats = defaultPlayerStats();
  p.shieldHp = 0;
  for (const iid in p.items) {
    const item = ITEMS[iid];
    const n = p.items[iid] || 0;
    for (let i = 0; i < n; i++) item.apply(p.stats, p);
  }
  if (p.perks) for (const pid of p.perks) {
    const perk = PERKS.find(x => x.id === pid);
    if (perk) perk.apply(p.stats, p);
  }
  p.hp = clamp(hp, 1, p.stats.maxHp);
  refreshOrbitals(p);
}

function debugTaint() { G.debugUsed = true; }

// ---- layout (mirrors HELP_PANEL in js/help.js) ----
const DEBUG_PANEL = { w: 920, h: 600, y: 22 };
function debugPanelX() { return (W - DEBUG_PANEL.w) / 2; }
function debugTabRect(i) {
  const gap = 5;
  const tw = Math.min(112, Math.floor((DEBUG_PANEL.w - 40 - (DEBUG_PAGES.length - 1) * gap) / DEBUG_PAGES.length));
  const total = DEBUG_PAGES.length * tw + (DEBUG_PAGES.length - 1) * gap;
  return { x: W / 2 - total / 2 + i * (tw + gap), y: DEBUG_PANEL.y + 78, w: tw, h: 30 };
}
function debugCloseRect() { return { x: debugPanelX() + DEBUG_PANEL.w - 92, y: DEBUG_PANEL.y + 18, w: 62, h: 30 }; }
function debugBodyRect() { return { x: debugPanelX() + 16, y: DEBUG_PANEL.y + 116, w: DEBUG_PANEL.w - 32, h: DEBUG_PANEL.h - 168 }; }

// ---- tiny widget helpers ----
function dbgText(ctx, text, x, y, color, font, align) {
  ctx.fillStyle = color; ctx.font = font || hfont(9); ctx.textAlign = align || 'left';
  ctx.fillText(text, x, y);
}
function dbgButton(ctx, label, x, y, w, h, opts) {
  const o = opts || {};
  const hover = inRect(Input.mx, Input.my, { x, y, w, h });
  drawPixelTag(ctx, label, x, y, {
    width: w, height: h,
    color: o.active ? '#ffd060' : (hover ? '#f0e2d4' : (o.color || '#b7a49c')),
    accent: o.active ? '#c0392b' : (hover ? '#8a3546' : '#4d3038'),
    fill: o.active ? 'rgba(48,18,22,0.95)' : 'rgba(14,8,12,0.9)',
    font: o.font || hfont(8, true),
  });
  o._hover = hover;
  o._rect = { x, y, w, h };
  return o;
}
function dbgClicked(rect) { return Input.mpressed && inRect(Input.mx, Input.my, rect); }
// clamp the cursor to the arena so spawned pickups/pedestals never land in walls
function dbgCursor() {
  const a = G.arena;
  return { x: clamp(mxW(), a.x0 + 12, a.x1 - 12), y: clamp(myW(), a.y0 + 12, a.y1 - 12) };
}

// number row: label + [-] value [+]
function dbgNumRow(ctx, label, x, y, w, get, set, step, min, max, fmt) {
  dbgText(ctx, label, x, y + 14, '#cdbdb2', hfont(9, true));
  const v = get();
  const minus = dbgButton(ctx, '−', x + w - 118, y, 26, 20);
  const plus = dbgButton(ctx, '+', x + w - 30, y, 26, 20);
  dbgText(ctx, (fmt ? fmt(v) : String(v)), x + w - 60, y + 14, '#e8d8c8', hfont(9, true), 'center');
  if (dbgClicked(minus._rect)) { set(clamp(v - step, min, max)); return true; }
  if (dbgClicked(plus._rect)) { set(clamp(v + step, min, max)); return true; }
  return false;
}
function dbgToggle(ctx, label, x, y, w, on, hint) {
  const b = dbgButton(ctx, label + ': ' + (on ? 'ON' : 'off'), x, y, w, 24, { active: on });
  return { rect: b._rect, on };
}

// ---- shared scrollable picker ----
// items: [{ key, label, sub?, color? }]. state: { scroll, sel }. rowH fixed.
// kbd: when true this picker owns arrow/page-key navigation (see dual-picker tabs).
function debugPicker(ctx, rect, items, state, rowH, kbd) {
  rowH = rowH || 24;
  const vis = Math.floor(rect.h / rowH);
  const maxScroll = Math.max(0, items.length - vis);
  state.scroll = clamp(state.scroll || 0, 0, maxScroll);
  if (state.sel === undefined || state.sel >= items.length) state.sel = Math.min(items.length - 1, Math.max(0, state.sel || 0));

  // keyboard nav — only when this picker has focus (kbd=true). Tabs that show
  // two pickers pass kbd based on which rect the mouse is over, so a keypress
  // doesn't drive both at once.
  if (kbd) {
    if (keyPressed('arrowdown')) state.sel = Math.min(items.length - 1, state.sel + 1);
    if (keyPressed('arrowup')) state.sel = Math.max(0, state.sel - 1);
    if (keyPressed('pagedown')) state.sel = Math.min(items.length - 1, state.sel + vis);
    if (keyPressed('pageup')) state.sel = Math.max(0, state.sel - vis);
  }
  if (state.sel < state.scroll) state.scroll = state.sel;
  if (state.sel >= state.scroll + vis) state.scroll = state.sel - vis + 1;

  drawPixelPanel(ctx, rect.x, rect.y, rect.w, rect.h, { cut: 4, shadow: false, fill: 'rgba(6,3,6,0.6)', border: 'rgba(70,36,44,0.7)', accent: '#5a2030' });
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4); ctx.clip();
  let clicked = -1;
  for (let i = 0; i < vis; i++) {
    const idx = state.scroll + i;
    if (idx >= items.length) break;
    const it = items[idx];
    const ry = rect.y + i * rowH;
    const rrow = { x: rect.x + 4, y: ry, w: rect.w - 8, h: rowH };
    const sel = idx === state.sel;
    const hover = inRect(Input.mx, Input.my, rrow);
    if (sel || hover) {
      ctx.fillStyle = sel ? 'rgba(120,30,45,0.5)' : 'rgba(90,50,60,0.3)';
      ctx.fillRect(rrow.x, rrow.y, rrow.w, rrow.h);
    }
    if (hover && Input.mpressed) clicked = idx;
    dbgText(ctx, it.label, rect.x + 10, ry + rowH / 2 + 3, it.color || (sel ? '#ffd7a0' : '#c8b6ac'), hfont(8, sel));
    if (it.sub) dbgText(ctx, it.sub, rect.x + rect.w - 10, ry + rowH / 2 + 3, '#7d6a66', hfont(8), 'right');
  }
  ctx.restore();
  if (clicked >= 0) state.sel = clicked;
  // scrollbar
  if (items.length > vis) {
    const sh = Math.max(20, rect.h * vis / items.length);
    const sy = rect.y + (rect.h - sh) * (state.scroll / Math.max(1, maxScroll));
    ctx.fillStyle = 'rgba(140,60,80,0.6)'; ctx.fillRect(rect.x + rect.w - 6, sy, 3, sh);
  }
  dbgText(ctx, items.length + ' · [↑↓] nav · [click] select', rect.x + 4, rect.y + rect.h + 13, '#6f5c58', hfont(8));
  return state.sel;
}

// convenience getters
function dbgWeaponItems() { return Object.keys(WEAPONS).map(id => ({ key: id, label: WEAPONS[id].name, sub: 't' + WEAPONS[id].tier + ' · ' + WEAPONS[id].behavior })); }
function dbgItemItems() {
  const order = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  return Object.keys(ITEMS).sort((a, b) => order[ITEMS[a].rarity] - order[ITEMS[b].rarity]).map(iid => {
    const it = ITEMS[iid];
    return { key: iid, label: it.name + (G.player.items[iid] ? '  ' + romanNum(G.player.items[iid]) : ''), sub: it.rarity, color: ITEM_RARITY[it.rarity].color };
  });
}
function dbgPerkItems() { return PERKS.map(p => ({ key: p.id, label: p.name + (G.player.perks && G.player.perks.indexOf(p.id) !== -1 ? '  ✓' : ''), sub: p.desc })); }
function dbgActiveItems() { return Object.keys(ACTIVES).map(aid => ({ key: aid, label: ACTIVES[aid].name, sub: 'cost ' + ACTIVES[aid].cost })); }
function dbgEnemyItems() { return Object.keys(ENEMY_TYPES).map(t => ({ key: t, label: ENEMY_TYPES[t].name || t, sub: 'hp ' + ENEMY_TYPES[t].hp })); }
function dbgBossItems() { return BOSS_DEFS.map(b => ({ key: b.kind, label: b.name, sub: b.kind })); }

// persistent per-tab ui state
const DBG = {
  weapon: { scroll: 0, sel: 0 }, item: { scroll: 0, sel: 0 }, perk: { scroll: 0, sel: 0 },
  active: { scroll: 0, sel: 0 }, enemy: { scroll: 0, sel: 0 }, boss: { scroll: 0, sel: 0 },
  statScroll: 0, spawnCount: 4, spawnElite: false, floorJump: 1, pickupSel: 0,
  fpsFrames: 0, fpsT: 0, fps: 60, // wall-clock fps meter for the stats tab
};

// ---- per-tab renderers ----
function dbgRenderPlayer(ctx, b) {
  const p = G.player;
  let y = b.y + 4;
  dbgText(ctx, 'HEALTH ' + p.hp + ' / ' + p.stats.maxHp + '   SHIELD ' + p.shieldHp + '   LEVEL ' + p.level + '   XP ' + p.xp + '/' + xpForLevel(p.level), b.x, y, '#e8d0bd', hfont(10, true));
  y += 22;
  const halfW = (b.w - 20) / 2;
  dbgNumRow(ctx, 'HP', b.x, y, halfW, () => p.hp, v => { debugTaint(); p.hp = clamp(v, 1, p.stats.maxHp); }, 1, 1, p.stats.maxHp);
  dbgNumRow(ctx, 'maxHp', b.x + halfW + 20, y, halfW, () => p.stats.maxHp, v => { debugTaint(); p.stats.maxHp = Math.max(1, v); p.hp = clamp(p.hp, 1, p.stats.maxHp); }, 2, 1, 99);
  y += 26;
  dbgNumRow(ctx, 'shield', b.x, y, halfW, () => p.shieldHp, v => { debugTaint(); p.shieldHp = Math.max(0, v); }, 1, 0, 20);
  dbgNumRow(ctx, 'level', b.x + halfW + 20, y, halfW, () => p.level, v => { debugTaint(); p.level = Math.max(1, v); }, 1, 1, 99);
  y += 30;
  const acts = [
    { t: 'FULL HEAL', fn: () => { p.hp = p.stats.maxHp; spawnText(p.x, p.y - 16, 'FULL', '#7dd87d'); } },
    { t: 'KILL PLAYER', fn: () => { p.hp = 0; gameOver(); } },
    { t: '+1 LEVELUP', fn: () => { G.pendingLevelups++; addToast('DEBUG', '+1 pending levelup'); } },
    { t: 'OPEN DRAFT', fn: () => { openPerkDraft(); } },
    { t: 'TP TO CURSOR', fn: () => { p.x = clamp(mxW(), G.arena.x0 + p.r, G.arena.x1 - p.r); p.y = clamp(myW(), G.arena.y0 + p.r, G.arena.y1 - p.r); } },
    { t: '+500 SCORE', fn: () => addScore(500) },
  ];
  for (let i = 0; i < acts.length; i++) {
    const ax = b.x + (i % 3) * (b.w / 3), ay = y + Math.floor(i / 3) * 32;
    const btn = dbgButton(ctx, acts[i].t, ax, ay, b.w / 3 - 12, 26);
    if (dbgClicked(btn._rect)) { debugTaint(); acts[i].fn(); Sfx.menu(); }
  }
  y += 2 * 32 + 6;
  dbgText(ctx, 'TOGGLES', b.x, y, '#8eb7bd', hfont(9, true));
  y += 8;
  const togs = [
    { k: 'god', label: 'GOD MODE', hint: 'hurtPlayer no-ops' },
    { k: 'infAmmo', label: 'INF AMMO', hint: 'ammo topped each frame' },
    { k: 'ohko', label: 'ONE-SHOT KILL', hint: 'dmg ×1e9 in damageEnemy' },
  ];
  for (let i = 0; i < togs.length; i++) {
    const tx = b.x + i * (b.w / 3);
    const t = dbgToggle(ctx, togs[i].label, tx, y + 6, b.w / 3 - 16, !!G.debugFlags[togs[i].k]);
    dbgText(ctx, togs[i].hint, tx, y + 36, '#6f5c58', hfont(8));
    if (dbgClicked(t.rect)) { G.debugFlags[togs[i].k] = !t.on; if (!t.on) debugTaint(); Sfx.menu(); }
  }
  y += 52;
  dbgText(ctx, 'Mutating this tab taints the run — best score will not be saved.', b.x, y, '#7d5a58', hfont(8));
}

function debugRefillAmmo() {
  const p = G.player;
  for (const inst of [p.weapon, p.holstered]) {
    if (inst && inst.ammo !== Infinity) inst.ammo = WEAPONS[inst.id].ammo;
  }
}

function dbgRenderWeapons(ctx, b) {
  const p = G.player;
  const lw = 320;
  dbgText(ctx, 'CURRENT: ' + WEAPONS[p.weapon.id].name + '  ammo ' + (p.weapon.ammo === Infinity ? '∞' : Math.ceil(p.weapon.ammo)), b.x, b.y + 4, '#e8d0bd', hfont(9, true));
  dbgText(ctx, 'HOLSTER: ' + (p.holstered ? WEAPONS[p.holstered.id].name : '—'), b.x, b.y + 20, '#b7a49c', hfont(8));
  const list = dbgWeaponItems();
  const rect = { x: b.x, y: b.y + 30, w: lw, h: b.h - 30 };
  const sel = debugPicker(ctx, rect, list, DBG.weapon, 24, true);
  const wid = list[sel] && list[sel].key;
  const ax = b.x + lw + 20;
  let ay = b.y + 6;
  const act = (label, fn, active) => {
    const btn = dbgButton(ctx, label, ax, ay, b.w - lw - 20, 26, { active }); ay += 32;
    if (dbgClicked(btn._rect)) { debugTaint(); fn(); Sfx.menu(); }
  };
  act('EQUIP ' + (wid ? WEAPONS[wid].name.toUpperCase() : '—'), () => {
    if (p.weapon.id !== 'bonepopper') p.holstered = p.weapon;
    p.weapon = { id: wid, ammo: WEAPONS[wid].ammo };
    p.charge = 0; p.fireT = 0;
    addToast('DEBUG', WEAPONS[wid].name);
  });
  act('REFILL AMMO', () => { debugRefillAmmo(); });
  act('HOLSTER CURRENT', () => { if (p.weapon.id !== 'bonepopper') { p.holstered = p.weapon; p.weapon = { id: 'bonepopper', ammo: Infinity }; } });
  act('DROP AT CURSOR', () => { const c = dbgCursor(); spawnPickup('weapon', c.x, c.y, { wid }); });
  act('SPAWN ITEM PEDESTAL', () => { const c = dbgCursor(); spawnItemPedestal(c.x, c.y, null, 'room'); });
  ay += 4;
  dbgNumRow(ctx, 'ammo', ax, ay, b.w - lw - 20, () => (p.weapon.ammo !== Infinity ? p.weapon.ammo : (p.holstered && p.holstered.ammo !== Infinity ? p.holstered.ammo : 999)), v => { debugTaint(); const t = p.weapon.ammo !== Infinity ? p.weapon : (p.holstered && p.holstered.ammo !== Infinity ? p.holstered : null); if (t) t.ammo = Math.max(0, v); }, 10, 0, 999);
  dbgText(ctx, 'Equip swaps the live weapon; the old one goes to the holster unless it was the Bone Popper.', ax, ay + 32, '#6f5c58', hfont(8));
}

function dbgRenderItems(ctx, b) {
  const lw = 340;
  const list = dbgItemItems();
  const rect = { x: b.x, y: b.y, w: lw, h: b.h - 16 };
  const sel = debugPicker(ctx, rect, list, DBG.item, 24, true);
  const iid = list[sel] && list[sel].key;
  const item = iid && ITEMS[iid];
  const ax = b.x + lw + 20;
  let ay = b.y + 6;
  if (item) {
    dbgText(ctx, item.name, ax, ay, ITEM_RARITY[item.rarity].color, hfont(10, true)); ay += 16;
    dbgText(ctx, 'tier ' + (G.player.items[iid] || 0) + ' / ' + itemCap(iid) + ' · ' + item.rarity, ax, ay, '#b7a49c', hfont(8)); ay += 14;
    wrapText(ctx, item.desc.toUpperCase(), ax, ay + 8, b.w - lw - 24, 12); ay += 40;
    const act = (label, fn) => {
      const btn = dbgButton(ctx, label, ax, ay, b.w - lw - 20, 24); ay += 30;
      if (dbgClicked(btn._rect)) { debugTaint(); fn(); Sfx.menu(); }
    };
    act('GIVE +1  (' + item.name + ')', () => giveItem(iid));
    act('REMOVE 1 TIER', () => { const n = G.player.items[iid] || 0; if (n > 1) { G.player.items[iid] = n - 1; debugRebuildStats(); } else if (n === 1) { delete G.player.items[iid]; debugRebuildStats(); } });
    act('REMOVE ALL', () => { if (G.player.items[iid]) { delete G.player.items[iid]; debugRebuildStats(); } });
    act('SET TO MAX TIER', () => { G.player.items[iid] = itemCap(iid); debugRebuildStats(); });
    ay += 4;
    dbgNumRow(ctx, 'tier', ax, ay, b.w - lw - 20, () => (G.player.items[iid] || 0), v => { debugTaint(); const t = Math.round(clamp(v, 0, itemCap(iid))); if (t === 0) delete G.player.items[iid]; else G.player.items[iid] = t; debugRebuildStats(); }, 1, 0, itemCap(iid));
    ay += 34;
  }
  dbgText(ctx, 'PRESETS', ax, ay, '#8eb7bd', hfont(9, true)); ay += 8;
  const pre = [
    { t: 'ONE OF EVERYTHING', fn: () => { for (const k in ITEMS) if (!G.player.items[k]) giveItem(k); } },
    { t: 'MAX EVERYTHING', fn: () => { for (const k in ITEMS) G.player.items[k] = itemCap(k); debugRebuildStats(); } },
    { t: 'CLEAR BUILD', fn: () => { G.player.items = {}; G.player.perks = []; debugRebuildStats(); } },
  ];
  for (const pr of pre) {
    const btn = dbgButton(ctx, pr.t, ax, ay, b.w - lw - 20, 24); ay += 30;
    if (dbgClicked(btn._rect)) { debugTaint(); pr.fn(); Sfx.menu(); }
  }
  dbgText(ctx, 'Removal / tier-set rebuilds stats from scratch. maxHp-lowering items replay in ownership order.', b.x, b.y + b.h + 14, '#6f5c58', hfont(8));
}

function dbgRenderPerks(ctx, b) {
  const half = (b.w - 16) / 2;
  const focusRight = Input.mx >= b.x + half + 16; // active-item column owns keys when hovered
  const plist = dbgPerkItems();
  const rect = { x: b.x, y: b.y, w: half, h: b.h - 60 };
  const sel = debugPicker(ctx, rect, plist, DBG.perk, 24, !focusRight);
  const pid = plist[sel] && plist[sel].key;
  let ay = b.y + b.h - 52;
  let btn = dbgButton(ctx, 'GRANT ' + (pid ? pid.toUpperCase() : '—'), b.x, ay, half, 26);
  if (dbgClicked(btn._rect) && pid) { debugTaint(); const perk = PERKS.find(p => p.id === pid); if (perk) grantPerk(perk); }
  ay += 32;
  btn = dbgButton(ctx, 'REMOVE SELECTED', b.x, ay, half / 2 - 4, 24);
  if (dbgClicked(btn._rect) && pid) { const i = G.player.perks.indexOf(pid); if (i !== -1) { G.player.perks.splice(i, 1); debugTaint(); debugRebuildStats(); } }
  btn = dbgButton(ctx, 'CLEAR ALL PERKS', b.x + half / 2 + 4, ay, half / 2 - 4, 24);
  if (dbgClicked(btn._rect)) { G.player.perks = []; debugTaint(); debugRebuildStats(); }

  const ax = b.x + half + 16;
  dbgText(ctx, 'DRAFTED (' + (G.player.perks ? G.player.perks.length : 0) + ')', ax, b.y + 4, '#e8d0bd', hfont(9, true));
  let py = b.y + 22;
  for (const pid2 of (G.player.perks || [])) {
    const pk = PERKS.find(p => p.id === pid2);
    dbgText(ctx, pk ? pk.name : pid2, ax, py, '#c8b6ac', hfont(8));
    py += 14;
  }
  py += 10;
  dbgText(ctx, 'ACTIVE ITEM', ax, py, '#8eb7bd', hfont(9, true)); py += 6;
  const alist = dbgActiveItems();
  const arect = { x: ax, y: py, w: half, h: b.h - (py - b.y) - 60 };
  const asel = debugPicker(ctx, arect, alist, DBG.active, 20, focusRight);
  const aid = alist[asel] && alist[asel].key;
  py = arect.y + arect.h + 20;
  btn = dbgButton(ctx, 'EQUIP ' + (aid ? aid.toUpperCase() : '—'), ax, py, half / 2 - 4, 24);
  if (dbgClicked(btn._rect) && aid) { debugTaint(); G.player.active = { iid: aid, charges: ACTIVES[aid].cost }; addToast('DEBUG', ACTIVES[aid].name); }
  btn = dbgButton(ctx, 'FIRE', ax + half / 2 + 4, py, half / 2 - 4, 24);
  if (dbgClicked(btn._rect)) { debugTaint(); useActive(true); }
}

function dbgRenderWorld(ctx, b) {
  const half = (b.w - 16) / 2;
  let y = b.y + 4;
  dbgText(ctx, 'FLOOR ' + G.floor + '  ROOM ' + (G.cur ? G.cur.gx + ',' + G.cur.gy + ' (' + G.cur.type + ')' : '—'), b.x, y, '#e8d0bd', hfont(10, true));
  y += 20;
  dbgNumRow(ctx, 'jump to floor', b.x, y, half, () => DBG.floorJump, v => { DBG.floorJump = Math.max(1, Math.round(v)); }, 1, 1, 99);
  let btn = dbgButton(ctx, 'WARP TO FLOOR ' + DBG.floorJump, b.x + half + 20, y, half, 22);
  if (dbgClicked(btn._rect)) { debugTaint(); G.floor = DBG.floorJump; genFloor(G.floor); enterRoom(0, 0); Sfx.menu(); }
  y += 30;
  const navs = [
    { t: 'NEXT FLOOR', fn: () => nextFloor() },
    { t: 'TO BOSS ROOM', fn: () => { const r = Object.values(G.rooms).find(r => r.type === 'boss'); if (r) enterRoom(r.gx, r.gy); } },
    { t: 'TO ITEM ROOM', fn: () => { const r = Object.values(G.rooms).find(r => r.type === 'item'); if (r) enterRoom(r.gx, r.gy); } },
    { t: 'CLEAR ROOM', fn: () => { for (const e of G.enemies) if (!e.boss) e.hp = 0; if (G.cur) { G.cur.cleared = true; G.cur.wavesLeft = 0; } } },
    { t: 'KILL ALL', fn: () => { for (const e of G.enemies) e.hp = 0; } },
    { t: 'KILL BOSS', fn: () => { if (G.boss) G.boss.hp = 0; } },
    { t: 'REGEN FLOOR', fn: () => { genFloor(G.floor); enterRoom(0, 0); } },
  ];
  for (let i = 0; i < navs.length; i++) {
    const nx = b.x + (i % 2) * (half + 20), ny = y + Math.floor(i / 2) * 28;
    btn = dbgButton(ctx, navs[i].t, nx, ny, half, 24);
    if (dbgClicked(btn._rect)) { debugTaint(); navs[i].fn(); Sfx.menu(); }
  }
  y += Math.ceil(navs.length / 2) * 28 + 8;

  dbgText(ctx, 'SPAWN ENEMY', b.x, y, '#8eb7bd', hfont(9, true));
  y += 4;
  const focusBoss = Input.mx >= b.x + half + 20; // boss column owns keys when hovered
  const elist = dbgEnemyItems();
  const erect = { x: b.x, y, w: half, h: b.y + b.h - y - 56 };
  const esel = debugPicker(ctx, erect, elist, DBG.enemy, 20, !focusBoss);
  const etype = elist[esel] && elist[esel].key;
  let ey = erect.y + erect.h + 20;
  dbgNumRow(ctx, 'count', b.x, ey, half, () => DBG.spawnCount, v => { DBG.spawnCount = Math.round(clamp(v, 1, 40)); }, 1, 1, 40);
  const et = dbgToggle(ctx, 'ELITE', b.x, ey + 24, 60, DBG.spawnElite);
  if (dbgClicked(et.rect)) DBG.spawnElite = !DBG.spawnElite;
  btn = dbgButton(ctx, 'SPAWN ' + DBG.spawnCount + '× ' + (etype ? etype.toUpperCase() : '—'), b.x + 70, ey + 20, half - 70, 24);
  if (dbgClicked(btn._rect) && etype) {
    debugTaint();
    for (let i = 0; i < DBG.spawnCount; i++) {
      if (G.enemies.length >= MAX_ENEMIES) break;
      const pos = spawnPosAwayFromPlayer();
      const e = makeEnemy(etype, pos.x, pos.y, G.floor, DBG.spawnElite);
      G.enemies.push(e);
    }
    Sfx.menu();
  }

  const bx = b.x + half + 20;
  dbgText(ctx, 'SPAWN BOSS', bx, y - 4, '#8eb7bd', hfont(9, true));
  const blist = dbgBossItems();
  const brect = { x: bx, y, w: half, h: b.y + b.h - y - 88 };
  const bsel = debugPicker(ctx, brect, blist, DBG.boss, 20, focusBoss);
  const bkind = blist[bsel] && blist[bsel].key;
  btn = dbgButton(ctx, 'SPAWN ' + (bkind ? bkind.toUpperCase() : '—'), bx, brect.y + brect.h + 18, half, 24);
  if (dbgClicked(btn._rect) && bkind) {
    debugTaint();
    const idx = BOSS_DEFS.findIndex(d => d.kind === bkind);
    spawnBoss(G.floor, idx >= 0 ? idx : undefined);
    Music.playBoss(bkind);
    Sfx.menu();
  }
  const kinds = ['heart', 'ammo', 'gem'];
  btn = dbgButton(ctx, 'SPAWN PICKUP AT CURSOR', bx, brect.y + brect.h + 48, half / 2 - 4, 24);
  if (dbgClicked(btn._rect)) {
    debugTaint();
    spawnPickup(kinds[DBG.pickupSel % kinds.length], dbgCursor().x, dbgCursor().y, kinds[DBG.pickupSel % kinds.length] === 'gem' ? { v: 5 } : undefined);
    Sfx.menu();
  }
  const pk = dbgButton(ctx, 'type: ' + kinds[DBG.pickupSel % 3], bx + half / 2 + 4, brect.y + brect.h + 48, half / 2 - 4, 24);
  if (dbgClicked(pk._rect)) { DBG.pickupSel++; Sfx.menu(); }
}

function dbgRenderPressure(ctx, b) {
  let y = b.y + 4;
  dbgText(ctx, 'PRESSURE ' + G.pressure.toFixed(3) + '   DIAL ' + G.pressureDial + '   LOCKED ' + (G.debugFlags.pressureLock ? 'YES' : 'no'), b.x, y, '#e8d0bd', hfont(11, true));
  y += 24;
  const half = (b.w - 16) / 2;
  dbgNumRow(ctx, 'set pressure', b.x, y, half, () => G.pressure, v => { debugTaint(); G.pressure = clamp(v, PRESSURE_MIN, PRESSURE_MAX); }, 0.05, PRESSURE_MIN, PRESSURE_MAX, v => v.toFixed(3));
  dbgNumRow(ctx, 'set dial', b.x + half + 20, y, half, () => G.pressureDial, v => { debugTaint(); setPressureDial(Math.round(v)); }, 1, PRESSURE_DIAL_MIN, PRESSURE_DIAL_MAX);
  y += 30;
  const lk = dbgToggle(ctx, 'FREEZE PRESSURE', b.x, y, 180, !!G.debugFlags.pressureLock, 'applyPressureDelta no-ops');
  if (dbgClicked(lk.rect)) { G.debugFlags.pressureLock = !lk.on; if (!lk.on) debugTaint(); Sfx.menu(); }
  y += 40;
  dbgText(ctx, 'LIVE VALUES (current dial)', b.x, y, '#8eb7bd', hfont(9, true)); y += 16;
  const rows = [
    ['pressureGainUnits', pressureGainUnits(G.pressureDial).toFixed(3) + ' → gain ' + pressureGain().toFixed(4) + '/room'],
    ['pressureDropUnits', pressureDropUnits(G.pressureDial).toFixed(3) + ' → relief scale ' + pressureDropScale().toFixed(3)],
    ['G.streak', String(G.streak)],
    ['recentHits (12s)', String((G.recentHits || []).length)],
    ['abattoirEngine', String(G.player.stats.abattoirEngine)],
  ];
  for (const r of rows) { dbgText(ctx, r[0], b.x, y, '#b7a49c', hfont(8)); dbgText(ctx, r[1], b.x + 220, y, '#e8d0bd', hfont(8)); y += 15; }
  y += 8;
  dbgText(ctx, 'Pressure is applied at spawn time; existing enemies are not re-scaled.', b.x, y, '#6f5c58', hfont(8));
}

function dbgRenderStats(ctx, b) {
  const p = G.player;
  const def = defaultPlayerStats();
  const keys = Object.keys(def);
  const colW = (b.w - 40) / 2;
  const lineH = 13;
  const perCol = Math.floor((b.h - 90) / lineH);
  const vis = perCol * 2;
  const maxScroll = Math.max(0, keys.length - vis);
  DBG.statScroll = clamp(DBG.statScroll || 0, 0, maxScroll);
  if (keyPressed('arrowdown')) DBG.statScroll = Math.min(maxScroll, DBG.statScroll + 1);
  if (keyPressed('arrowup')) DBG.statScroll = Math.max(0, DBG.statScroll - 1);
  if (keyPressed('pagedown')) DBG.statScroll = Math.min(maxScroll, DBG.statScroll + perCol);
  if (keyPressed('pageup')) DBG.statScroll = Math.max(0, DBG.statScroll - perCol);

  let y = b.y + 2;
  dbgText(ctx, 'powerScore ' + powerScore().toFixed(2) + '   floor ' + G.floor + '   time ' + G.time.toFixed(1) + 's   fps ' + DBG.fps, b.x, y, '#e8d0bd', hfont(9, true));
  y += 16;
  dbgText(ctx, 'enemies ' + G.enemies.length + '  bullets ' + G.bullets.length + '  ebullets ' + G.ebullets.length + '  pickups ' + G.pickups.length + '  parts ' + G.parts.length + '  hazards ' + G.hazards.length, b.x, y, '#b7a49c', hfont(8));
  y += 18;
  const colHeader = ['KEY', 'VALUE', 'Δ'];
  for (let c = 0; c < 2; c++) {
    const cx = b.x + c * (colW + 20);
    dbgText(ctx, colHeader[0], cx, y, '#8eb7bd', hfont(8, true));
    dbgText(ctx, colHeader[1], cx + colW - 130, y, '#8eb7bd', hfont(8, true));
    dbgText(ctx, colHeader[2], cx + colW - 40, y, '#8eb7bd', hfont(8, true));
  }
  y += 14;
  const startY = y;
  for (let i = 0; i < vis; i++) {
    const idx = DBG.statScroll + i;
    if (idx >= keys.length) break;
    const k = keys[idx];
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const cx = b.x + col * (colW + 20);
    const ry = startY + row * lineH;
    const cur = p.stats[k];
    const dv = def[k];
    const changed = cur !== dv;
    dbgText(ctx, k, cx, ry + 10, changed ? '#ffd7a0' : '#a8968e', hfont(8, changed));
    dbgText(ctx, typeof cur === 'number' ? (Math.abs(cur) < 10 ? cur.toFixed(3) : Math.round(cur)) : String(cur), cx + colW - 130, ry + 10, changed ? '#ffd060' : '#c8b6ac', hfont(8, changed));
    if (changed) dbgText(ctx, typeof cur === 'number' ? '+' + (cur - dv).toFixed(2) : '*', cx + colW - 40, ry + 10, '#7dd87d', hfont(8));
  }
  dbgText(ctx, 'highlighted = differs from defaultPlayerStats() · [↑↓/pg] scroll (' + (DBG.statScroll + 1) + '-' + Math.min(keys.length, DBG.statScroll + vis) + '/' + keys.length + ')', b.x, b.y + b.h + 14, '#6f5c58', hfont(8));
}

function dbgRenderMisc(ctx, b) {
  let y = b.y + 4;
  const half = (b.w - 16) / 2;
  dbgText(ctx, 'TIME / RENDER', b.x, y, '#8eb7bd', hfont(9, true)); y += 6;
  const ts = [0.25, 1, 4];
  for (let i = 0; i < ts.length; i++) {
    const btn = dbgButton(ctx, '×' + ts[i], b.x + i * 70, y, 60, 24, { active: (G.debugTimescale || 1) === ts[i] });
    if (dbgClicked(btn._rect)) { G.debugTimescale = ts[i]; if (ts[i] !== 1) debugTaint(); Sfx.menu(); }
  }
  const fr = dbgToggle(ctx, 'FREEZE', b.x + 230, y, 90, !!G.debugFlags.freeze);
  if (dbgClicked(fr.rect)) { G.debugFlags.freeze = !fr.on; if (!fr.on) debugTaint(); Sfx.menu(); }
  const st = dbgButton(ctx, 'STEP 1F', b.x + 330, y, 90, 24, { active: false });
  if (dbgClicked(st._rect) && G.debugFlags.freeze) { debugTaint(); G.debugFrameStep = true; Sfx.menu(); }
  y += 34;
  const viz = [
    { k: 'showCollide', label: 'COLLISION CIRCLES' },
    { k: 'showArena', label: 'ARENA BOUNDS' },
    { k: 'showHpNums', label: 'ENEMY HP NUMBERS' },
    { k: 'showHazards', label: 'HAZARD/TELEGRAPH' },
    { k: 'showMagnet', label: 'MAGNET RADIUS' },
  ];
  for (let i = 0; i < viz.length; i++) {
    const vx = b.x + (i % 3) * 200, vy = y + Math.floor(i / 3) * 28;
    const t = dbgToggle(ctx, viz[i].label, vx, vy, 160, !!G.debugFlags[viz[i].k]);
    if (dbgClicked(t.rect)) { G.debugFlags[viz[i].k] = !t.on; Sfx.menu(); } // read-only: no taint
  }
  y += 2 * 28 + 8;
  dbgText(ctx, 'RUN VALUES', b.x, y, '#8eb7bd', hfont(9, true)); y += 4;
  dbgNumRow(ctx, 'score', b.x, y, half, () => G.score, v => { debugTaint(); G.score = Math.max(0, Math.round(v)); }, 100, 0, 9999999);
  dbgNumRow(ctx, 'kills', b.x + half + 20, y, half, () => G.kills, v => { debugTaint(); G.kills = Math.max(0, Math.round(v)); }, 10, 0, 99999);
  y += 30;
  dbgNumRow(ctx, 'streak', b.x, y, half, () => G.streak, v => { debugTaint(); G.streak = Math.max(0, Math.round(v)); }, 1, 0, 99);
  const go = dbgButton(ctx, 'TRIGGER GAME OVER', b.x + half + 20, y, half, 22);
  if (dbgClicked(go._rect)) { debugTaint(); G.player.hp = 0; gameOver(); }
  y += 34;
  dbgText(ctx, 'FX / AUDIO TEST', b.x, y, '#8eb7bd', hfont(9, true)); y += 4;
  const fx = [
    { t: 'SHAKE', fn: () => addShake(12) }, { t: 'FLASH', fn: () => { G.flash = 0.6; } },
    { t: 'TOAST', fn: () => addToast('DEBUG TOAST', 'subtitle', 3) }, { t: 'SHOOT SFX', fn: () => Sfx.shoot(WEAPONS.repeater) },
    { t: 'BOSS ROAR', fn: () => Sfx.boss({ bossKind: 'bonesaw', x: G.player.x, y: G.player.y }, 'roar') }, { t: 'PERK SFX', fn: () => Sfx.perk() },
  ];
  for (let i = 0; i < fx.length; i++) {
    const fx2 = fx[i], bx = b.x + (i % 3) * 170, by = y + Math.floor(i / 3) * 26;
    const btn = dbgButton(ctx, fx2.t, bx, by, 160, 22);
    if (dbgClicked(btn._rect)) { fx2.fn(); }
  }
  y += 2 * 26 + 10;
  dbgText(ctx, 'PIN OVERLAY (live)', b.x, y, '#8eb7bd', hfont(9, true)); y += 4;
  const pin = dbgToggle(ctx, 'PIN PANEL + LIVE WORLD', b.x, y, 260, G.debugPin, 'game keeps running behind the panel');
  if (dbgClicked(pin.rect)) { G.debugPin = !pin.on; Sfx.menu(); }
  y += 34;
  dbgText(ctx, G.debugUsed ? 'RUN TAINTED — best score will NOT be saved' : 'run clean so far (mutating actions taint)', b.x, y, G.debugUsed ? '#e02945' : '#7dd87d', hfont(8, true));
}

const DEBUG_PAGES = [
  { title: 'PLAYER', render: dbgRenderPlayer },
  { title: 'WEAPONS', render: dbgRenderWeapons },
  { title: 'ITEMS', render: dbgRenderItems },
  { title: 'PERKS+ACTIVE', render: dbgRenderPerks },
  { title: 'WORLD', render: dbgRenderWorld },
  { title: 'PRESSURE', render: dbgRenderPressure },
  { title: 'STATS', render: dbgRenderStats },
  { title: 'MISC', render: dbgRenderMisc },
];

// ---- top-level update / draw ----
function updateDebug() {
  // infinite-ammo upkeep (also runs while pinned so live play benefits)
  if (G.debugFlags.infAmmo && G.player) for (const inst of [G.player.weapon, G.player.holstered]) if (inst && inst.ammo !== Infinity) inst.ammo = WEAPONS[inst.id].ammo;

  // wall-clock fps counter for the stats tab (independent of timescale/freeze)
  DBG.fpsFrames++;
  const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (!DBG.fpsT) DBG.fpsT = nowMs;
  if (nowMs - DBG.fpsT >= 500) { DBG.fps = Math.round(DBG.fpsFrames * 1000 / (nowMs - DBG.fpsT)); DBG.fpsFrames = 0; DBG.fpsT = nowMs; }

  if (keyPressed('`', '~', 'escape')) { G.mode = G.debugReturn || 'play'; Sfx.menu(); return; }
  if (keyPressed('arrowright')) { G.debugPage = (G.debugPage + 1) % DEBUG_PAGES.length; Sfx.menu(); }
  else if (keyPressed('arrowleft')) { G.debugPage = (G.debugPage + DEBUG_PAGES.length - 1) % DEBUG_PAGES.length; Sfx.menu(); }
  else for (let i = 0; i < DEBUG_PAGES.length; i++) if (keyPressed(String(i + 1))) { G.debugPage = i; Sfx.menu(); break; }
  if (Input.mpressed) {
    if (inRect(Input.mx, Input.my, debugCloseRect())) { G.mode = G.debugReturn || 'play'; Sfx.menu(); return; }
    for (let i = 0; i < DEBUG_PAGES.length; i++) if (inRect(Input.mx, Input.my, debugTabRect(i))) { G.debugPage = i; Sfx.menu(); break; }
  }
}

function drawDebug(ctx) {
  ctx.fillStyle = G.debugPin ? 'rgba(4,2,3,0.55)' : 'rgba(4,2,3,0.9)';
  ctx.fillRect(0, 0, W, H);
  const px = debugPanelX(), py = DEBUG_PANEL.y, pw = DEBUG_PANEL.w, ph = DEBUG_PANEL.h;
  drawPixelPanel(ctx, px, py, pw, ph, {
    accent: '#c0392b', border: 'rgba(120,50,60,0.95)', fill: 'rgba(10,5,8,0.97)',
    blood: true, seed: G.debugPage + 31, bloodAlpha: 0.22,
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2908a'; ctx.font = hfont(9, true);
  ctx.fillText('BUTCHER DEBUG CONSOLE' + (G.debugPin ? '  ·  PINNED / LIVE' : '  ·  PAUSED'), W / 2, py + 40);
  ctx.fillStyle = '#f0e5d7'; ctx.font = hfont(18, true);
  ctx.fillText('[' + (G.debugPage + 1) + '] ' + DEBUG_PAGES[G.debugPage].title, W / 2, py + 66);
  const cr = debugCloseRect();
  drawPixelTag(ctx, '[X]', cr.x, cr.y, { width: cr.w, height: cr.h, color: '#e8bf47', accent: '#9d7726' });
  for (let i = 0; i < DEBUG_PAGES.length; i++) {
    const r = debugTabRect(i);
    const active = i === G.debugPage;
    drawPixelTag(ctx, (i + 1) + ' ' + DEBUG_PAGES[i].title, r.x, r.y, {
      width: r.w, height: r.h,
      color: active ? '#ffd7a0' : (inRect(Input.mx, Input.my, r) ? '#cdbdb2' : '#7d6a68'),
      accent: active ? '#c0392b' : '#3c2f38',
      fill: active ? 'rgba(40,14,18,0.95)' : 'rgba(12,7,11,0.85)',
      font: hfont(7, true),
    });
  }
  DEBUG_PAGES[G.debugPage].render(ctx, debugBodyRect());
  ctx.textAlign = 'center';
  drawPixelTag(ctx, '[` / ESC] CLOSE   [← →] TABS   [1-' + DEBUG_PAGES.length + '] JUMP   ' + (G.debugUsed ? 'TAINTED' : 'CLEAN'), W / 2 - 260, py + ph - 34, {
    width: 520, height: 22, color: G.debugUsed ? '#e02945' : '#8f7f79', accent: '#4d3a42', font: hfont(8, true),
  });
}

// live world overlays (drawn during play when devMode is on and toggles are set)
function drawDebugOverlays(ctx) {
  if (!G.devMode) return;
  const f = G.debugFlags;
  if (!(f.showCollide || f.showArena || f.showHpNums || f.showHazards || f.showMagnet)) return;
  const p = G.player;
  ctx.save();
  ctx.lineWidth = 1;
  if (f.showArena) {
    ctx.strokeStyle = 'rgba(90,200,220,0.8)';
    ctx.strokeRect(G.arena.x0, G.arena.y0, G.arena.w, G.arena.h);
  }
  if (f.showCollide) {
    ctx.strokeStyle = 'rgba(120,220,120,0.7)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,120,120,0.6)';
    for (const e of G.enemies) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke(); }
  }
  if (f.showHpNums) {
    ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd0a0';
    for (const e of G.enemies) if (e.hp > 0) ctx.fillText(Math.ceil(e.hp) + '/' + Math.ceil(e.maxHp), e.x, e.y - e.r - 14);
  }
  if (f.showHazards) {
    ctx.strokeStyle = 'rgba(230,180,60,0.7)';
    for (const hz of G.hazards) { ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, TAU); ctx.stroke(); }
    for (const tg of G.telegraphs) { ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, TAU); ctx.stroke(); }
  }
  if (f.showMagnet) {
    ctx.strokeStyle = 'rgba(140,160,255,0.5)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 90 * (p.stats.magnet || 1), 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// compact always-on-top readout when pinned but panel is closed
function drawDebugPin(ctx) {
  const p = G.player;
  const lines = [
    'DEBUG ' + (G.debugUsed ? 'TAINTED' : 'clean'),
    'hp ' + p.hp + '/' + p.stats.maxHp + '  pwr ' + powerScore().toFixed(1) + '  press ' + G.pressure.toFixed(2),
    'wpn ' + WEAPONS[p.weapon.id].name + '  en ' + G.enemies.length + '  fl ' + G.floor,
  ];
  const w = 300, h = 18 + lines.length * 14;
  const x = W - w - 8, y = 8;
  ctx.fillStyle = 'rgba(8,4,6,0.78)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(192,57,43,0.7)'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = 'left'; ctx.font = hfont(8, true);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = i === 0 ? (G.debugUsed ? '#e02945' : '#7dd87d') : '#cdbdb2';
    ctx.fillText(lines[i], x + 8, y + 15 + i * 14);
  }
}
