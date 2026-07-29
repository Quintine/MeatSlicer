// ---- Crimsonland-style level-up perk draft ----

const PERKS = [
  { id: 'adrenal',  name: 'Adrenal Surge',   desc: '+3.5% fire rate',       apply: s => { s.rateMul *= 1.035; } },
  { id: 'sharpen',  name: 'Sharpened',       desc: '+4% damage',            apply: s => { s.dmgMul *= 1.04; } },
  { id: 'quick',    name: 'Quickening',      desc: '+3% move speed',        apply: s => { s.speedMul *= 1.03; } },
  { id: 'longbone', name: 'Long Bone',       desc: '+5% range',             apply: s => { s.rangeMul *= 1.05; } },
  { id: 'bigheart', name: 'Big Heart',       desc: '+½ max heart, heal ½ heart', apply: (s, p) => { s.maxHp += 1; p.hp = Math.min(s.maxHp, p.hp + 1); } },
  { id: 'magnetb',  name: 'Magnet Bile',     desc: '+10% pickup radius',    apply: s => { s.magnet *= 1.10; } },
  { id: 'shieldheart', name: 'Shield Heart', desc: '+½ shield heart at the start of each floor', apply: (s, p) => { s.shieldPerk = (s.shieldPerk || 0) + 1; p.shieldHp = (p.shieldHp || 0) + 1; } },
  { id: 'scavenge', name: 'Scavenger',       desc: '+4% drop luck',         apply: s => { s.luck += 0.04; } },
  { id: 'bloodrush',name: 'Bloodrush',       desc: '+5% XP gain, bonus crystal chance', apply: s => { s.xpMul *= 1.05; } },
  { id: 'deadeye',  name: 'Deadeye',         desc: '+5% shot speed',        apply: s => { s.shotSpeedMul *= 1.05; } },
  { id: 'critbone', name: 'Bone Splitter',   desc: '+2% critical chance',   apply: s => { s.crit += 0.02; } },
  { id: 'critmeat', name: 'Cold Precision',  desc: '+15% critical damage',  apply: s => { s.critMul += 0.15; } },
  { id: 'flensing', name: 'Flensing Edge',   desc: 'Hits inflict light bleeding', apply: s => { s.bleed += 0.08; } },
  { id: 'ember',    name: 'Ember Hands',     desc: '8% chance to ignite',   apply: s => { s.igniteChance += 0.08; } },
  { id: 'frostbile',name: 'Chill Bile',      desc: '10% chance to slow',    apply: s => { s.slowOnHit += 0.10; } },
  { id: 'heavyhand',name: 'Heavy Hand',      desc: '+20% knockback',        apply: s => { s.knockbackMul *= 1.20; } },
  { id: 'thickhide',name: 'Thick Hide',      desc: '+4% chance to ignore damage', apply: s => { s.armor += 1 / 24; } },
  { id: 'secondwind',name: 'Second Wind',    desc: '+0.15s hurt immunity',  apply: s => { s.invBonus += 0.15; } },
  { id: 'scrapfeed',name: 'Scrap Feed',      desc: '5% less ammo consumed', apply: s => { s.ammoEff *= 1.05; } },
  { id: 'boneknit', name: 'Bone Knit',       desc: '3% chance to heal ½ heart after combat rooms', apply: s => { s.roomHealChance += 0.03; } },
  { id: 'spiteflesh',name: 'Spite Flesh',    desc: 'Contact attackers take damage', apply: s => { s.thorns += 4; } },
  { id: 'carrion',  name: 'Carrion Sense',   desc: '+8% pickup radius and pull speed', apply: s => { s.magnet *= 1.08; s.magnetPull *= 1.08; } },
  { id: 'sinew',    name: 'Sinew Weave',     desc: '+3% move speed and range', apply: s => { s.speedMul *= 1.03; s.rangeMul *= 1.03; } },
];

const PERK_CARD_W = 170, PERK_CARD_H = 230, PERK_CARD_GAP = 18;
const PERK_CARD_Y = H / 2 - 100;
function perkCardX(i) {
  const total = PERK_CARD_W * 3 + PERK_CARD_GAP * 2;
  return (W - total) / 2 + i * (PERK_CARD_W + PERK_CARD_GAP);
}

function xpForLevel(level) { return 8 + level * 4; }

function gainXP(v) {
  const p = G.player;
  p.xp += v;
  addScore(Math.round(v));
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    p.stats.rerolls += p.stats.rerollPerLevel || 0;
    G.pendingLevelups++;
  }
}

function openPerkDraft() {
  if (G.autoPerk) {
    Sfx.levelup();
    let guard = 0;
    while (G.pendingLevelups > 0 && guard++ < 64) {
      grantPerk(choice(PERKS));
      G.pendingLevelups--;
    }
    G.perkChoices = null;
    G.mode = 'play';
    return;
  }
  const opts = shuffle([...PERKS]).slice(0, 3);
  G.perkChoices = opts;
  G.mode = 'levelup';
  Sfx.levelup();
}

function grantPerk(perk) {
  perk.apply(G.player.stats, G.player);
  addToast(perk.name, perk.desc);
  Sfx.perk();
}

function choosePerk(i) {
  if (!G.perkChoices || i >= G.perkChoices.length) return;
  const perk = G.perkChoices[i];
  grantPerk(perk);
  G.perkChoices = null;
  G.pendingLevelups--;
  if (G.pendingLevelups > 0) openPerkDraft();
  else G.mode = 'play';
}

function updateLevelup() {
  if (keyPressed('1')) choosePerk(0);
  else if (keyPressed('2')) choosePerk(1);
  else if (keyPressed('3')) choosePerk(2);
  else if (keyPressed('4', ' ')) choosePerk(irand(0, G.perkChoices.length - 1));
  else if (keyPressed('t')) {
    setAutoPerk(true);
    G.mode = 'play';
    openPerkDraft();
  }
  else if (keyPressed('r') && G.player.stats.rerolls > 0) {
    G.player.stats.rerolls--;
    G.perkChoices = shuffle([...PERKS]).slice(0, 3);
    Sfx.menu();
  }
  else if (Input.mpressed && G.perkChoices) {
    // click a card
    for (let i = 0; i < 3; i++) {
      const cx = perkCardX(i);
      if (Input.mx > cx && Input.mx < cx + PERK_CARD_W && Input.my > PERK_CARD_Y && Input.my < PERK_CARD_Y + PERK_CARD_H) {
        choosePerk(i); break;
      }
    }
    if (Input.my > PERK_CARD_Y + PERK_CARD_H + 10 && Input.my < PERK_CARD_Y + PERK_CARD_H + 42 && Input.mx > W / 2 - 115 && Input.mx < W / 2 + 115) {
      choosePerk(irand(0, G.perkChoices.length - 1));
    }
  }
}

function drawLevelup(ctx) {
  ctx.fillStyle = 'rgba(7,2,4,0.91)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.12;
  Sprites.draw(ctx, 'decal_blood2', 122, 96, -0.35, 180);
  Sprites.draw(ctx, 'decal_blood3', W - 108, H - 76, 0.5, 190);
  ctx.restore();
  drawPixelTag(ctx, 'MUTATION DRAFT // LEVEL ' + String(G.player.level).padStart(2, '0'), W / 2 - 108, H / 2 - 184, {
    width: 216, height: 24, color: '#cfaca5', accent: '#bf263d',
  });
  ctx.fillStyle = '#ef2946'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
  ctx.fillText('CHOOSE A CUT', W / 2, H / 2 - 137);
  drawBloodTrim(ctx, W / 2 - 145, H / 2 - 126, 290, G.player.level, 0.62);
  ctx.fillStyle = '#8d7773'; ctx.font = 'bold 10px monospace';
  ctx.fillText('SELECT ONE PERMANENT RUN MODIFIER', W / 2, H / 2 - 101);

  for (let i = 0; i < 3; i++) {
    const perk = G.perkChoices[i];
    const cx = perkCardX(i);
    const hover = Input.mx > cx && Input.mx < cx + PERK_CARD_W && Input.my > PERK_CARD_Y && Input.my < PERK_CARD_Y + PERK_CARD_H;
    if (hover) {
      ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#ef3150';
      pixelPanelPath(ctx, cx - 4, PERK_CARD_Y - 4, PERK_CARD_W + 8, PERK_CARD_H + 8, 10); ctx.fill();
      ctx.restore();
    }
    drawPixelPanel(ctx, cx, PERK_CARD_Y, PERK_CARD_W, PERK_CARD_H, {
      cut: 8, lineWidth: hover ? 2 : 1, fill: hover ? '#321019' : '#16090d',
      border: hover ? '#ef3150' : '#63303a', accent: hover ? '#ef3150' : '#992238',
      blood: true, seed: i + G.player.level, bloodAlpha: hover ? 0.55 : 0.28,
    });
    drawPixelTag(ctx, '0' + (i + 1), cx + 10, PERK_CARD_Y + 10, {
      width: 34, height: 24, color: '#e8bf47', accent: '#9d7726', fill: '#130b0d',
    });
    drawPixelPanel(ctx, cx + 47, PERK_CARD_Y + 16, 76, 76, {
      cut: 5, shadow: false, fill: 'rgba(3,2,3,0.72)',
      border: hover ? '#c93a4e' : '#49252d', accent: hover ? '#dc3049' : '#75303e',
    });
    Sprites.draw(ctx, 'perk_' + perk.id, cx + PERK_CARD_W / 2, PERK_CARD_Y + 54, 0, 68);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eee2d5'; ctx.font = 'bold 13px monospace';
    wrapText(ctx, perk.name.toUpperCase(), cx + PERK_CARD_W / 2, PERK_CARD_Y + 119, 150, 16);
    ctx.fillStyle = '#a9928b'; ctx.font = '10px monospace';
    wrapText(ctx, perk.desc.toUpperCase(), cx + PERK_CARD_W / 2, PERK_CARD_Y + 169, 146, 14);
    ctx.fillStyle = hover ? '#d7aa39' : '#5f4d4d'; ctx.font = 'bold 8px monospace';
    ctx.fillText(hover ? 'CLICK TO INSTALL' : 'PERMANENT UPGRADE', cx + PERK_CARD_W / 2, PERK_CARD_Y + 215);
  }
  drawPixelTag(ctx, '[4 / SPACE] RANDOM CUT', W / 2 - 115, PERK_CARD_Y + PERK_CARD_H + 10, {
    width: 230, height: 30, color: '#e7c65c', accent: '#a47e25',
  });
  drawPixelTag(ctx, '[T] AUTO-DRAFT: ' + (G.autoPerk ? 'ON' : 'OFF'), W - 202, 24, {
    width: 178, height: 26, color: G.autoPerk ? '#79d9ca' : '#a9958e', accent: G.autoPerk ? '#378b80' : '#67303a',
  });
  if (G.player.stats.rerolls > 0) drawPixelTag(ctx, '[R] REROLL ×' + G.player.stats.rerolls, 24, 24, {
    width: 138, height: 26, color: '#d8b84e', accent: '#947124',
  });
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); yy += lh; line = w;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}
