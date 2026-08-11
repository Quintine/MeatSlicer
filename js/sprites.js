// ---- sprite loading + procedural fallback rendering ----
// Every sprite is optional: if assets/<name>.png failed to load, we draw
// a vector fallback so the game is always playable.

const SPRITE_MANIFEST = [
  'player', 'player_legs',
  'enemy_shambler', 'enemy_runner', 'enemy_spitter', 'enemy_splitter', 'enemy_mini', 'enemy_exploder',
  'enemy_censer', 'enemy_bulwark', 'enemy_choirmaster', 'enemy_flenserling', 'enemy_broodsac',
  'boss_bonesaw', 'boss_gorecrown', 'boss_knifecrawl',
  'boss_vealmother', 'boss_flenser', 'boss_hookchoir',
  'boss_platefather', 'boss_augerprime', 'boss_scald',
  'tile_floor1', 'tile_floor2', 'tile_floor3', 'tile_floor4',
  'tile_floor5', 'tile_floor6', 'tile_floor7', 'tile_floor8',
  'tile_wall', 'tile_wall2', 'tile_wall3', 'tile_wall4',
  'door_open', 'door_locked',
  'bullet_bone', 'bullet_saw', 'bullet_cleaver', 'bullet_harpoon', 'bullet_eye', 'bullet_syringe', 'bullet_gore', 'bullet_steam',
  'gem_small', 'gem_big', 'heart', 'ammo', 'pedestal', 'stairs',
  'decal_blood1', 'decal_blood2', 'decal_blood3', 'decal_blood4',
  // level-up perk emblems
  'perk_adrenal', 'perk_sharpen', 'perk_quick', 'perk_longbone', 'perk_bigheart',
  'perk_magnetb', 'perk_shieldheart', 'perk_scavenge', 'perk_bloodrush', 'perk_deadeye',
  'perk_critbone', 'perk_critmeat', 'perk_flensing', 'perk_ember', 'perk_frostbile',
  'perk_heavyhand', 'perk_thickhide', 'perk_secondwind', 'perk_scrapfeed', 'perk_boneknit',
  'perk_spiteflesh', 'perk_carrion', 'perk_sinew',
  // weapon icons
  'w_bonepopper', 'w_repeater', 'w_marrow', 'w_cleaver', 'w_saw', 'w_bile', 'w_hemophage', 'w_eye',
  'w_guthook', 'w_cauterizer', 'w_fleshmasher', 'w_trapqueen', 'w_tenderizer', 'w_redhand', 'w_spinaltap', 'w_swarmjar',
  // player upper bodies with the weapon and gripping hands baked together
  'pt_bonepopper', 'pt_repeater', 'pt_marrow', 'pt_cleaver', 'pt_saw', 'pt_bile', 'pt_hemophage', 'pt_eye',
  'pt_guthook', 'pt_cauterizer', 'pt_fleshmasher', 'pt_trapqueen', 'pt_tenderizer', 'pt_redhand', 'pt_spinaltap', 'pt_swarmjar',
  // item icons
  'i_hollowpoints', 'i_twitch', 'i_scalpel', 'i_leadmarrow', 'i_piercegaze', 'i_ricochet',
  'i_splittongue', 'i_hydramaw', 'i_homingtumor', 'i_orbitalknives', 'i_dentures', 'i_volatilebile',
  'i_backstabber', 'i_splinterbone', 'i_ironstomach', 'i_luckycoin', 'i_magnetmaw', 'i_bloodlust', 'i_ghoulheart',
  'i_chainsinew', 'i_mortarbone', 'i_bloatrounds', 'i_marrowglut', 'i_hollowneedle', 'i_bloodshoteye',
  'i_flayerkiss', 'i_emberjar', 'i_acidgland', 'i_hookrounds', 'i_sledgerounds', 'i_graftedtrigger',
  'i_deadmanswitch', 'i_orbitcrown', 'i_tannedhide', 'i_deadmansclock', 'i_hollowbones', 'i_boneplate',
  'i_wormgut', 'i_spinecage', 'i_secondstomach', 'i_spitewell', 'i_twinhearts', 'i_brassmagazine',
  'i_crowbait', 'i_gorgingleech', 'i_rerollrib',
  'i_chillgland', 'i_hookedsinew', 'i_gyroscopicribs', 'i_marrowpiston', 'i_splitcortex',
  'i_gristlecord', 'i_renderedfat', 'i_whipcordtendon', 'i_rusteddiadem', 'i_gorgedtick',
  'i_bonemealpowder', 'i_rimedfang', 'i_butcherstwine', 'i_cindersump',
  'i_deadweight', 'i_cauterizedveins', 'i_hollowchoir', 'i_sawbonecoil', 'i_gluttonsgut',
  'i_slaughterrhythm', 'i_painengine', 'i_thresherplate', 'i_bloodmoat', 'i_ironlung',
  'i_meathook', 'i_blooddebt',
  'i_butchersoath', 'i_secondskin', 'i_twinsidearm', 'i_crimsonmetronome', 'i_abattoirengine',
  'i_gorecrown', 'i_thousandteeth', 'i_hollowfather', 'i_thelastcut', 'i_meatgrinder',
  // active items
  'a_bonenova', 'a_offalbomb', 'a_bloodtransfusion', 'a_cleaverstorm', 'a_butchersbell',
  'a_marrowdraught', 'a_slaughtertime', 'a_panicroom', 'a_skinnerscoin', 'a_gutreroll',
  // full 64px/128px eight-direction action atlases
  'player_sheet', 'player_legs_sheet', 'player_death_sheet',
  'enemy_shambler_sheet', 'enemy_runner_sheet', 'enemy_spitter_sheet',
  'enemy_splitter_sheet', 'enemy_mini_sheet', 'enemy_exploder_sheet',
  'enemy_censer_sheet', 'enemy_bulwark_sheet', 'enemy_choirmaster_sheet', 'enemy_flenserling_sheet', 'enemy_broodsac_sheet',
  'boss_bonesaw_sheet', 'boss_gorecrown_sheet', 'boss_knifecrawl_sheet',
  'boss_vealmother_sheet', 'boss_flenser_sheet', 'boss_hookchoir_sheet',
  'boss_platefather_sheet', 'boss_augerprime_sheet', 'boss_scald_sheet',
];

const ACTOR_ANIMS = {
  idle:   { frames: 4, fps: 5,  offset: 0 },
  move:   { frames: 8, fps: 12, offset: 32 },
  attack: { frames: 6, fps: 15, offset: 96 },
  hit:    { frames: 3, fps: 18, offset: 144 },
  death:  { frames: 8, fps: 12, offset: 168 },
};

const Sprites = {
  imgs: {},
  flashCanvas: null,
  flashCtx: null,

  shadow(ctx, x, y, rx, ry, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.32 : alpha;
    ctx.fillStyle = '#050203';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },

  load() {
    let pending = 0;
    for (const name of SPRITE_MANIFEST) {
      pending++;
      const img = new Image();
      img.onload = () => { this.imgs[name] = img; if (--pending === 0) G.imagesLoaded = true; };
      img.onerror = () => { if (--pending === 0) G.imagesLoaded = true; };
      img.src = 'assets/' + name + '.png?v=53';
    }
  },

  get(name) { return this.imgs[name] || null; },

  // Compact player-only strip: eight forward-facing stride frames.
  // Runtime rotation is smooth; distance-driven phase keeps contacts from skating.
  legs(ctx, x, y, facing, phase, targetW) {
    const sheet = this.imgs.player_legs_sheet;
    if (!sheet) {
      this.draw(ctx, 'player_legs', x, y, facing, targetW);
      return;
    }
    const frameSize = 96;
    const frameCount = Math.max(1, Math.floor(sheet.width / frameSize));
    let frame = Math.floor(Math.max(0, phase) / (TAU / frameCount)) % frameCount;
    if (frame < 0) frame += frameCount;
    const tw = targetW || frameSize;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.drawImage(sheet, frame * frameSize, 0, frameSize, frameSize,
      -tw / 2, -tw / 2, tw, tw);
    ctx.restore();
  },

  // Non-directional one-row effects such as the player's authored gore burst.
  strip(ctx, name, x, y, time, frames, fps, frameSize, targetW, hold) {
    const sheet = this.imgs[name];
    if (!sheet) {
      this.actor(ctx, 'player', x, y, 0, 'death', time, targetW || frameSize);
      return;
    }
    const raw = Math.floor(Math.max(0, time) * fps);
    const frame = hold ? Math.min(frames - 1, raw) : raw % frames;
    const tw = targetW || frameSize;
    ctx.drawImage(sheet, frame * frameSize, 0, frameSize, frameSize,
      x - tw / 2, y - tw / 2, tw, tw);
  },

  actor(ctx, name, x, y, facing, action, time, targetW, alpha, scaleX, scaleY) {
    const sheet = this.imgs[name + '_sheet'];
    const def = ACTOR_ANIMS[action] || ACTOR_ANIMS.idle;
    if (!sheet) {
      this.draw(ctx, name, x, y, facing, targetW, action === 'hit', alpha, scaleX, scaleY);
      return;
    }
    const frameSize = name.startsWith('boss_') ? 128 : (name === 'player' ? 96 : 64);
    let direction = Math.round(facing / (TAU / 8)) % 8;
    if (direction < 0) direction += 8;
    const rawFrame = Math.floor(Math.max(0, time) * def.fps);
    const frame = action === 'death' ? Math.min(def.frames - 1, rawFrame) : rawFrame % def.frames;
    const cell = def.offset + direction * def.frames + frame;
    const sx = (cell % 8) * frameSize, sy = Math.floor(cell / 8) * frameSize;
    const tw = targetW || frameSize;
    ctx.save();
    ctx.translate(x, y);
    if (scaleX !== undefined || scaleY !== undefined) ctx.scale(scaleX || 1, scaleY || 1);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(sheet, sx, sy, frameSize, frameSize, -tw / 2, -tw / 2, tw, tw);
    ctx.restore();
  },

  // draw centered at x,y with rotation (radians), scaled to targetW pixels wide
  // (fallbacks are authored in a canonical 32px box, so they scale the same way)
  draw(ctx, name, x, y, rot, targetW, flash, alpha, scaleX, scaleY) {
    const img = this.imgs[name];
    const tw = targetW || 32;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (scaleX !== undefined || scaleY !== undefined) ctx.scale(scaleX || 1, scaleY || 1);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (img) {
      const s = tw / img.width;
      if (flash) {
        // Isolate masking from the already-opaque room canvas.
        if (!this.flashCanvas && typeof document !== 'undefined' && document.createElement) {
          this.flashCanvas = document.createElement('canvas');
          this.flashCtx = this.flashCanvas.getContext('2d');
        }
        if (this.flashCanvas) {
          this.flashCanvas.width = img.width; this.flashCanvas.height = img.height;
          const fc = this.flashCtx;
          fc.imageSmoothingEnabled = false;
          fc.clearRect(0, 0, img.width, img.height);
          fc.globalCompositeOperation = 'source-over';
          fc.drawImage(img, 0, 0);
          fc.globalCompositeOperation = 'source-atop';
          fc.fillStyle = '#fff4e6'; fc.fillRect(0, 0, img.width, img.height);
          ctx.drawImage(this.flashCanvas, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
        } else ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
      } else ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
    } else {
      this.fallback(ctx, name, tw / 32, flash);
    }
    ctx.restore();
  },

  // ---- vector fallbacks (only used when a PNG is missing) ----
  fallback(ctx, name, s, flash) {
    ctx.save();
    ctx.scale(s, s);
    if (flash) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; }
    const C = (c) => flash ? '#fff' : c;

    if (name === 'player_legs') {
      ctx.fillStyle = C('#3e302b');
      ctx.fillRect(-10, -9, 17, 7); ctx.fillRect(-8, 5, 17, 7);
      ctx.fillStyle = C('#666f75');
      ctx.fillRect(4, -9, 7, 7); ctx.fillRect(6, 5, 7, 7);
      ctx.fillStyle = C('#9a6c3b');
      ctx.fillRect(-7, -5, 10, 12);
    } else if (name.startsWith('pt_')) {
      ctx.fillStyle = C('#7e1926');
      ctx.beginPath(); ctx.ellipse(-4, 0, 13, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = C('#ddaF8f');
      ctx.beginPath(); ctx.arc(-1, -8, 5, 0, TAU); ctx.fill();
      ctx.fillRect(2, -7, 16, 5); ctx.fillRect(2, 3, 16, 5);
      ctx.fillStyle = C('#ddd2bd');
      ctx.fillRect(-5, -14, 10, 4);
      ctx.fillStyle = C('#737b80');
      ctx.fillRect(12, -3, 17, 6);
      ctx.fillStyle = C('#ddaF8f');
      ctx.beginPath(); ctx.arc(13, -3, 3, 0, TAU); ctx.arc(13, 4, 3, 0, TAU); ctx.fill();
    } else if (name === 'player') {
      ctx.fillStyle = C('#c9a227');
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();       // body
      ctx.fillStyle = C('#7a1212');
      ctx.fillRect(2, -4, 14, 8);                                     // cleaver arm
      ctx.fillStyle = C('#e8e0d0');
      ctx.beginPath(); ctx.arc(-3, -3, 3.5, 0, TAU); ctx.arc(-3, 4, 3.5, 0, TAU); ctx.fill(); // eyes
    } else if (name.startsWith('enemy_')) {
      const cols = { enemy_shambler: '#6a8f3c', enemy_runner: '#a33e2e', enemy_spitter: '#7a4f9e', enemy_splitter: '#8f6b3c', enemy_mini: '#b8202f', enemy_exploder: '#c93b3b' };
      const r = name === 'enemy_mini' ? 9 : (name === 'enemy_exploder' ? 10 : 11);
      ctx.fillStyle = C(cols[name] || '#888');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.fillStyle = C('#1a0505');
      ctx.beginPath(); ctx.arc(3, -3, 2.2, 0, TAU); ctx.arc(3, 3, 2.2, 0, TAU); ctx.fill();
      if (name === 'enemy_exploder') { ctx.strokeStyle = C('#ff0'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TAU); ctx.stroke(); }
    } else if (name.startsWith('boss_')) {
      const cols = {
        boss_bonesaw: '#b8b0a0', boss_gorecrown: '#8f1f2e', boss_knifecrawl: '#5a6b7a',
        boss_vealmother: '#b98d78', boss_flenser: '#d2544c', boss_hookchoir: '#74645a',
        boss_platefather: '#8e7c64', boss_augerprime: '#4f857e', boss_scald: '#b69245',
      };
      ctx.fillStyle = C(cols[name] || '#a55');
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = C('#2a0a0a'); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = C('#ff2020');
      ctx.beginPath(); ctx.arc(5, -4, 2.5, 0, TAU); ctx.arc(5, 4, 2.5, 0, TAU); ctx.fill();
    } else if (name.startsWith('tile_floor')) {
      const cols = { tile_floor1: '#241417', tile_floor2: '#2a1518', tile_floor3: '#1f1215' };
      ctx.fillStyle = C(cols[name] || '#241417');
      ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = C('#33191c');
      ctx.fillRect(-10, -6, 6, 4); ctx.fillRect(4, 8, 8, 3);
    } else if (name.startsWith('tile_wall')) {
      ctx.fillStyle = C('#3d1f22'); ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = C('#54282c'); ctx.fillRect(-16, -16, 32, 5);
    } else if (name === 'door_open' || name === 'door_locked') {
      // void
      ctx.fillStyle = C('#060104'); ctx.fillRect(-16, -10, 32, 20);
      // jamb
      ctx.fillStyle = C('#241116'); ctx.fillRect(-16, -12, 32, 3); ctx.fillRect(-16, 9, 32, 3);
      // crimson rim light
      ctx.fillStyle = C(name === 'door_locked' ? '#ff2a3c' : '#c4172a');
      ctx.fillRect(-16, -11, 2, 22); ctx.fillRect(14, -11, 2, 22);
      // bone teeth
      ctx.fillStyle = C('#d8ccb2');
      for (let i = 0; i < 5; i++) {
        const ty = -8 + i * 4;
        ctx.beginPath(); ctx.moveTo(-14, ty); ctx.lineTo(-10, ty + 2); ctx.lineTo(-14, ty + 4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(14, ty); ctx.lineTo(10, ty + 2); ctx.lineTo(14, ty + 4); ctx.closePath(); ctx.fill();
      }
      if (name === 'door_locked') {
        ctx.fillStyle = C('#8f2f2f');
        for (let i = -13; i < 15; i += 6) { ctx.beginPath(); ctx.moveTo(i, -8); ctx.lineTo(i + 3, 0); ctx.lineTo(i, 8); ctx.fill(); }
      }
    } else if (name.startsWith('bullet_')) {
      const cols = { bullet_bone: '#e8e0d0', bullet_saw: '#c0c8d0', bullet_cleaver: '#d0d8e0', bullet_harpoon: '#b09070', bullet_eye: '#e0e0f0', bullet_syringe: '#70e090', bullet_gore: '#c03b6b', bullet_steam: '#e8e0b0' };
      ctx.fillStyle = C(cols[name] || '#fff');
      if (name === 'bullet_saw') {
        for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillRect(3, -1.5, 5, 3); }
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      } else if (name === 'bullet_eye') {
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = C('#c02020'); ctx.beginPath(); ctx.arc(1, 0, 2.2, 0, TAU); ctx.fill();
      } else if (name === 'bullet_harpoon' || name === 'bullet_cleaver') {
        ctx.fillRect(-7, -2, 14, 4); ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
      }
    } else if (name.startsWith('gem_')) {
      const big = name === 'gem_big';
      ctx.fillStyle = C(big ? '#3be0c9' : '#3b8fe0');
      const r = big ? 7 : 4.5;
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); ctx.fill();
    } else if (name === 'heart') {
      ctx.fillStyle = C('#d92038');
      ctx.beginPath(); ctx.arc(-3, -2, 4, 0, TAU); ctx.arc(3, -2, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6.5, 0); ctx.lineTo(0, 7); ctx.lineTo(6.5, 0); ctx.fill();
    } else if (name === 'ammo') {
      ctx.fillStyle = C('#8a6f3c'); ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = C('#d0b060'); ctx.fillRect(-5, -3, 3, 6); ctx.fillRect(-1, -3, 3, 6); ctx.fillRect(3, -3, 3, 6);
    } else if (name === 'pedestal') {
      ctx.fillStyle = C('#5a4a52'); ctx.fillRect(-10, 2, 20, 8);
      ctx.fillStyle = C('#7a6a72'); ctx.fillRect(-7, -8, 14, 10);
    } else if (name === 'stairs') {
      ctx.fillStyle = C('#120a0c'); ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeStyle = C('#6b4a3a'); ctx.lineWidth = 3;
      for (let i = -10; i <= 8; i += 6) { ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i, 12); ctx.stroke(); }
    } else if (name.startsWith('decal_blood')) {
      ctx.fillStyle = C('#5a0a12');
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.arc(8, 4, 5, 0, TAU); ctx.arc(-7, 5, 4, 0, TAU); ctx.fill();
    } else if (name.startsWith('w_')) {
      ctx.fillStyle = C('#b8a888'); ctx.fillRect(-8, -3, 16, 6);
      ctx.fillStyle = C('#6b5333'); ctx.fillRect(-4, 3, 5, 6);
    } else if (name.startsWith('a_')) {
      ctx.fillStyle = C('#2fa898');
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = C('#0d2a26');
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 0);
    } else if (name.startsWith('i_') || name.startsWith('perk_')) {
      ctx.fillStyle = C('#c9a227');
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = C('#2a1015');
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);
    } else {
      ctx.fillStyle = C('#f0f'); ctx.fillRect(-8, -8, 16, 16);
    }
    ctx.restore();
  },
};
