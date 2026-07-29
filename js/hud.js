// ---- HUD: hearts, XP, weapon, items, boss bar, minimap, toasts ----

function drawHUD(ctx) {
  const p = G.player;
  ctx.save();
  const A = clamp(G.hudAlpha === undefined ? 1 : G.hudAlpha, 0.25, 1);
  ctx.globalAlpha = A;
  // vitals use a 2-row grid; a second row pushes the rest of the panel down
  const totalVitalIcons = Math.ceil(p.stats.maxHp / 2) + Math.ceil(p.shieldHp / 2);
  const vOff = totalVitalIcons > 12 ? 22 : 0;
  const panelH = (p.holstered ? 140 : 112) + vOff;
  drawPixelPanel(ctx, 8, 8, 304, panelH, {
    accent: '#cf2942', border: 'rgba(115,43,56,0.95)', blood: true,
    seed: G.floor, bloodAlpha: 0.34,
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d9c9bc'; ctx.font = 'bold 10px monospace';
  ctx.fillText('BUTCHER // VITALS', 18, 23);
  ctx.fillStyle = '#d7a934'; ctx.textAlign = 'right';
  ctx.fillText('LV ' + String(p.level).padStart(2, '0'), 300, 23);

  // hearts: full containers = 2 HP, trailing odd maxHp draws as a half outline
  const fullHearts = Math.floor(p.stats.maxHp / 2);
  const halfContainer = p.stats.maxHp % 2 === 1;
  const maxVitalIcons = 24; // 2 rows x 12
  const shownFull = Math.min(fullHearts, maxVitalIcons);
  let slot = 0;
  for (let i = 0; i < shownFull; i++) {
    const x = 21 + (i % 12) * 22, y = 39 + Math.floor(i / 12) * 22;
    slot = i + 1;
    const fill = clamp(p.hp - i * 2, 0, 2) / 2;
    Sprites.draw(ctx, 'heart', x, y, 0, 18, false, 0.25 * A);
    if (fill > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x - 10, y - 10, 20 * fill, 20); ctx.clip();
      Sprites.draw(ctx, 'heart', x, y, 0, 18);
      ctx.restore();
    }
  }
  // half container outline (only when there's icon budget left)
  if (halfContainer && slot < maxVitalIcons) {
    const x = 21 + (slot % 12) * 22, y = 39 + Math.floor(slot / 12) * 22;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 10, y - 10, 10, 20); ctx.clip();
    Sprites.draw(ctx, 'heart', x, y, 0, 18, false, 0.25 * A);
    ctx.restore();
    const fill = clamp(p.hp - slot * 2, 0, 1);
    if (fill > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x - 10, y - 10, 10, 20); ctx.clip();
      Sprites.draw(ctx, 'heart', x, y, 0, 18);
      ctx.restore();
    }
    slot++;
  }
  // shield pips: 2 shieldHp = one full cyan heart, odd = half (matches hearts)
  const shieldFull = Math.floor(p.shieldHp / 2), shieldHalf = p.shieldHp % 2 === 1;
  const shieldIcons = shieldFull + (shieldHalf ? 1 : 0);
  const shownShieldIcons = Math.min(shieldIcons, Math.max(0, maxVitalIcons - slot));
  for (let i = 0; i < shownShieldIcons; i++) {
    const x = 21 + ((slot + i) % 12) * 22, y = 39 + Math.floor((slot + i) / 12) * 22;
    const isHalf = shieldHalf && i === shownShieldIcons - 1;
    ctx.fillStyle = '#3bc9e0';
    ctx.beginPath(); ctx.arc(x - 3, y - 2, 4, 0, TAU); ctx.arc(x + 3, y - 2, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6.5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 6.5, y); ctx.fill();
    if (isHalf) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x + 3, y - 2, 4.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  slot += shownShieldIcons;
  const hiddenVitals = Math.ceil(p.stats.maxHp / 2) + shieldIcons - slot;
  if (hiddenVitals > 0) {
    drawPixelTag(ctx, '+' + hiddenVitals, 266, 29, { width: 34, height: 21, color: '#d7b24a', accent: '#8f6724' });
  }

  const need = xpForLevel(p.level);
  drawPixelBar(ctx, 16, 53 + vOff, 220, 10, p.xp / need, {
    fill: '#3d9fc2', glint: '#a5edee', border: '#465d69', segments: 12,
  });
  ctx.fillStyle = '#88b9c4'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'right';
  ctx.fillText(Math.floor(p.xp) + ' / ' + need + ' XP', 299, 62 + vOff);

  const w = WEAPONS[p.weapon.id];
  ctx.fillStyle = 'rgba(3,2,3,0.6)'; ctx.fillRect(15, 70 + vOff, 48, 34);
  ctx.strokeStyle = 'rgba(116,56,65,0.65)'; ctx.strokeRect(15.5, 70.5 + vOff, 47, 33);
  Sprites.draw(ctx, 'w_' + w.id, 39, 87 + vOff, 0, 54);
  ctx.textAlign = 'left'; ctx.fillStyle = '#f0e5d7'; ctx.font = 'bold 12px monospace';
  ctx.fillText(w.name.toUpperCase(), 72, 84 + vOff);
  ctx.fillStyle = '#7d6262'; ctx.font = '9px monospace';
  ctx.fillText('ACTIVE WEAPON', 72, 99 + vOff);
  const ammoText = p.weapon.ammo === Infinity ? 'SIDEARM' : String(Math.ceil(p.weapon.ammo)).padStart(3, '0');
  drawPixelTag(ctx, ammoText, 238, 74 + vOff, {
    width: 58, height: 26,
    color: p.weapon.ammo === Infinity ? '#9c8d86' : (p.weapon.ammo < w.ammo * 0.25 ? '#ff4057' : '#e0b94e'),
    accent: p.weapon.ammo === Infinity ? '#5d4c50' : '#a47e25', font: 'bold 10px monospace',
  });

  if (p.holstered) {
    const holsterEmpty = p.holstered.ammo <= 0;
    ctx.fillStyle = 'rgba(86,40,48,0.35)'; ctx.fillRect(15, 112 + vOff, 281, 20);
    Sprites.draw(ctx, 'w_' + p.holstered.id, 29, 122 + vOff, 0, 28, false, 0.68 * A);
    ctx.fillStyle = holsterEmpty ? '#d94652' : '#aa9290'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
    ctx.fillText((holsterEmpty ? '[EMPTY] ' : '[R] ') + WEAPONS[p.holstered.id].name.toUpperCase(), 47, 125 + vOff);
    ctx.fillStyle = holsterEmpty ? '#ef4057' : '#d0aa4a'; ctx.textAlign = 'right';
    ctx.fillText(holsterEmpty ? 'NEEDS AMMO' : Math.ceil(p.holstered.ammo) + ' AMMO', 289, 125 + vOff);
  }

  const allItemEntries = Object.entries(p.items);
  const maxVisibleItems = allItemEntries.length > 24 ? 23 : 24;
  const itemEntries = allItemEntries.slice(0, maxVisibleItems);
  if (itemEntries.length) {
    const cols = Math.min(12, itemEntries.length), rows = Math.ceil(itemEntries.length / 12);
    const trayY = panelH + 16, trayW = 28 + cols * 34, trayH = 22 + rows * 34;
    drawPixelPanel(ctx, 8, trayY, trayW, trayH, {
      accent: '#a77d2b', cut: 5, blood: true, seed: itemEntries.length, bloodAlpha: 0.2,
    });
    ctx.fillStyle = '#9e857a'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left';
    ctx.fillText('IMPLANTS', 17, trayY + 12);
    for (let index = 0; index < itemEntries.length; index++) {
      const [iid, lvl] = itemEntries[index];
      const ix = 28 + (index % 12) * 34;
      const iy = trayY + 31 + Math.floor(index / 12) * 34;
      Sprites.draw(ctx, 'i_' + iid, ix, iy, 0, 30, false, 0.95 * A);
      if (lvl > 1) {
        ctx.fillStyle = '#ffd060'; ctx.font = 'bold 8px monospace';
        ctx.fillText(romanNum(lvl), ix - 7, iy + 11);
      }
    }
    if (allItemEntries.length > itemEntries.length) drawPixelTag(ctx, '+' + (allItemEntries.length - itemEntries.length), trayW - 49, trayY + trayH - 23, {
      width: 30, height: 20, color: '#e0b94e', accent: '#8d6724', font: 'bold 8px monospace',
    });
  }

  drawMinimap(ctx);

  drawPixelPanel(ctx, W - 180, H - 104, 172, 96, {
    accent: '#b5892f', cut: 6, blood: true, seed: G.kills + 4, bloodAlpha: 0.22,
  });
  ctx.textAlign = 'left'; ctx.fillStyle = '#88746f'; ctx.font = 'bold 8px monospace';
  ctx.fillText('RUN DATA', W - 168, H - 87);
  ctx.fillStyle = '#d6aa39'; ctx.font = 'bold 12px monospace';
  ctx.fillText('FLOOR ' + String(G.floor).padStart(2, '0'), W - 168, H - 65);
  ctx.textAlign = 'right'; ctx.fillStyle = '#a18d87'; ctx.font = '9px monospace';
  ctx.fillText('KILLS ' + String(G.kills).padStart(3, '0'), W - 18, H - 67);
  ctx.fillStyle = '#f0e5d7'; ctx.font = 'bold 11px monospace';
  ctx.fillText('SCORE ' + String(G.score).padStart(6, '0'), W - 18, H - 46);
  ctx.fillStyle = '#8f7770'; ctx.font = '8px monospace';
  ctx.fillText('×' + (G.pressure || 1).toFixed(2), W - 168, H - 46);
  ctx.textAlign = 'left';
  const dialTxt = ' D' + (G.pressureDial > 0 ? '+' : '') + G.pressureDial;
  ctx.fillStyle = G.pressure > 1 ? '#d6aa39' : '#69b8bd'; ctx.font = 'bold 8px monospace';
  ctx.fillText('PRESSURE ' + Math.round(G.pressure * 100) + '%' + dialTxt, W - 168, H - 28);
  ctx.textAlign = 'right'; ctx.fillText('STREAK ' + G.streak, W - 18, H - 28);
  drawPixelBar(ctx, W - 168, H - 20, 150, 8, (G.pressure - PRESSURE_MIN) / (PRESSURE_MAX - PRESSURE_MIN), {
    fill: G.pressure > 1 ? '#c59231' : '#3d8f99', glint: G.pressure > 1 ? '#f4d86d' : '#8ce0df', border: '#5d3c43', segments: 10,
  });

  if (G.boss && G.boss.hp > 0) {
    ctx.save(); ctx.globalAlpha = 1; // boss bar stays fully opaque
    const bw = 460, bx = W / 2 - bw / 2, by = H - 48;
    drawPixelPanel(ctx, bx, by, bw, 40, {
      accent: '#e12842', cut: 6, fill: 'rgba(12,3,6,0.92)', blood: true,
      seed: G.floor, bloodAlpha: 0.25,
    });
    const k = clamp(G.boss.hp / G.boss.maxHp, 0, 1);
    ctx.fillStyle = '#efc6bd'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('TARGET // ' + G.boss.name, bx + 12, by + 15);
    ctx.textAlign = 'right'; ctx.fillStyle = '#af7d7c';
    ctx.fillText(Math.ceil(G.boss.hp) + ' / ' + Math.ceil(G.boss.maxHp), bx + bw - 12, by + 15);
    drawPixelBar(ctx, bx + 11, by + 22, bw - 22, 10, k, {
      fill: '#b51e35', glint: '#ff7d82', border: '#6e2936', segments: 20,
    });
    ctx.restore();
  }

  ctx.textAlign = 'center';
  for (let i = 0; i < G.toasts.length; i++) {
    const t = G.toasts[i];
    const a = clamp(2.5 - t.t, 0, 1);
    const y = 22 + i * 48;
    ctx.globalAlpha = a;
    ctx.font = 'bold 13px monospace';
    const tw = Math.max(ctx.measureText(t.text).width + 48, 190);
    drawPixelPanel(ctx, W / 2 - tw / 2, y, tw, t.sub ? 40 : 28, {
      cut: 5, shadow: false, accent: '#c59231', blood: true,
      seed: i + G.floor, bloodAlpha: 0.2,
    });
    ctx.fillStyle = '#e3b746'; ctx.fillText(t.text.toUpperCase(), W / 2, y + 17);
    if (t.sub) {
      ctx.fillStyle = '#9f8981'; ctx.font = '9px monospace';
      ctx.fillText(t.sub.toUpperCase(), W / 2, y + 31);
    }
    ctx.globalAlpha = A;
  }

  if (G.muted) {
    drawPixelTag(ctx, '[M] MUTED', 9, H - 31, {
      width: 76, height: 22, color: '#a28f87', accent: '#5f2932',
    });
  }
  ctx.restore();
}

function drawMinimap(ctx) {
  const rooms = Object.values(G.rooms);
  if (!rooms.length) return;
  const s = 12, pad = 3;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const r of rooms) {
    minX = Math.min(minX, r.gx); maxX = Math.max(maxX, r.gx);
    minY = Math.min(minY, r.gy); maxY = Math.max(maxY, r.gy);
  }
  const gridW = (maxX - minX + 1) * (s + pad) - pad;
  const gridH = (maxY - minY + 1) * (s + pad) - pad;
  const panelW = Math.max(148, gridW + 24), panelH = Math.max(78, gridH + 38);
  const px = W - panelW - 8, py = 8;
  drawPixelPanel(ctx, px, py, panelW, panelH, {
    accent: '#4a9cad', cut: 6, blood: true, seed: G.floor + 9, bloodAlpha: 0.16,
  });
  ctx.fillStyle = '#8eb7bd'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left';
  ctx.fillText('SECTOR MAP', px + 11, py + 16);
  ctx.textAlign = 'right'; ctx.fillStyle = '#d1a839';
  ctx.fillText('F-' + String(G.floor).padStart(2, '0'), px + panelW - 11, py + 16);
  const ox = px + Math.floor((panelW - gridW) / 2);
  const oy = py + 27 + Math.floor((panelH - 32 - gridH) / 2);
  for (const r of rooms) {
    if (!r.visited && r !== G.cur) continue;
    const x = ox + (r.gx - minX) * (s + pad);
    const y = oy + (r.gy - minY) * (s + pad);
    ctx.fillStyle = '#130b0e'; ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
    if (r === G.cur) ctx.fillStyle = '#e9ded0';
    else if (r.type === 'boss') ctx.fillStyle = '#b72138';
    else if (r.type === 'item') ctx.fillStyle = '#c9a227';
    else if (r.cleared) ctx.fillStyle = '#43545a';
    else ctx.fillStyle = '#7a4f59';
    ctx.fillRect(x, y, s, s);
    if (r === G.cur) {
      ctx.strokeStyle = '#67c7d2'; ctx.strokeRect(x - 2.5, y - 2.5, s + 5, s + 5);
    }
  }
}

function drawToastsUpdate(dt) {
  for (const t of G.toasts) t.t += dt;
  while (G.toasts.length && G.toasts[0].t > 2.5) G.toasts.shift();
}
