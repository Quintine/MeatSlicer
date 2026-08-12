// ---- hybrid WebAudio SFX: generated samples with procedural fallbacks ----
const Sfx = {
  ctx: null, master: null, comp: null, glue: null, limiter: null, muted: false,
  mixBus: null, musicBus: null, musicMute: null, duckGain: null, saturators: {},
  buses: {}, active: [], procedural: [], lastPlayed: new Map(), currentWeaponLoop: null,
  fleshN: 0, wallN: 0, goreN: 0,
  lastPunch: -999, lastPunchLevel: 0,
  maxVoices: 24,
  cooldowns: {
    hit: 0.035, crit: 0.07, ricochet: 0.05, wallHit: 0.045, sawHit: 0.09, gem: 0.025,
    enemyDie: 0.04, goreBurst: 0.055, lifesteal: 0.12,
    loop_wpnloop_bile: 0.12, loop_wpnloop_cauterizer: 0.12,
    loop_wpnloop_redhand: 0.11, loop_wpnloop_spinaltap_charge: 0.12,
  },

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = G.muted ? 0 : (G.sfxVol === undefined ? 0.45 : G.sfxVol);

      this.glue = this.ctx.createDynamicsCompressor();
      this.glue.threshold.value = -10; this.glue.knee.value = 6; this.glue.ratio.value = 3.5;
      this.glue.attack.value = 0.012; this.glue.release.value = 0.14;
      this.mixBus = this.ctx.createGain(); this.mixBus.gain.value = 1;
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -0.5; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.001; this.limiter.release.value = 0.06;
      this.comp = this.glue; // compatibility alias for older diagnostics
      this.master.connect(this.glue); this.glue.connect(this.mixBus);
      this.mixBus.connect(this.limiter); this.limiter.connect(this.ctx.destination);

      const curve = new Float32Array(2048);
      const drive = 2.4, norm = Math.tanh(drive);
      for (let i = 0; i < curve.length; i++) {
        const x = i * 2 / (curve.length - 1) - 1;
        curve[i] = Math.tanh(x * drive) / norm;
      }
      this.buses = {}; this.saturators = {}; this.procedural = [];
      for (const [name, level] of Object.entries({ weapons: 0.92, impacts: 0.88, voices: 0.9, ui: 0.72 })) {
        const node = this.ctx.createGain(); node.gain.value = level; this.buses[name] = node;
        if (name === 'weapons' || name === 'impacts') {
          const shaper = this.ctx.createWaveShaper(); shaper.curve = curve; shaper.oversample = '4x';
          node.connect(shaper); shaper.connect(this.master); this.saturators[name] = shaper;
        } else node.connect(this.master);
      }
      const sub = this.ctx.createGain(); sub.gain.value = 0.9;
      const subFilter = this.ctx.createBiquadFilter(); subFilter.type = 'lowpass'; subFilter.frequency.value = 140;
      sub.connect(subFilter); subFilter.connect(this.master); this.buses.sub = sub;

      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 1;
      this.musicMute = this.ctx.createGain(); this.musicMute.gain.value = G.muted ? 0 : 1;
      this.duckGain = this.ctx.createGain(); this.duckGain.gain.value = 1;
      this.musicBus.connect(this.musicMute); this.musicMute.connect(this.duckGain); this.duckGain.connect(this.mixBus);

      if (typeof SfxBank !== 'undefined') { SfxBank.init(this.ctx); SfxBank.preload(); }
    } catch (e) { this.ctx = null; }
  },

  attachMusic(audio) {
    if (!audio || audio._sfxSource || audio._sfxAttachFailed || !this.ctx || !this.musicBus ||
        this.ctx.state !== 'running' || !this.ctx.createMediaElementSource) return false;
    try {
      const source = this.ctx.createMediaElementSource(audio);
      audio._sfxSource = source; // mark before connect: a media element can only be wrapped once
      source.connect(this.musicBus);
      return true;
    } catch (e) {
      audio._sfxAttachFailed = true;
      if (typeof console !== 'undefined' && console.warn) console.warn('Music WebAudio attach failed', e);
      return false;
    }
  },
  detachMusic(audio) {
    if (!audio || !audio._sfxSource) return;
    try { audio._sfxSource.disconnect(); } catch (e) {}
    // The owning Music entry is discarded immediately; never re-wrap this element.
  },
  duck(amount = 0.3, duration = 0.15) {
    if (!this.ctx || !this.duckGain || G.muted) return;
    const t = this.ctx.currentTime, gain = this.duckGain.gain;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(t);
    else { gain.cancelScheduledValues(t); gain.setValueAtTime(Math.max(0.001, gain.value), t); }
    gain.linearRampToValueAtTime(Math.max(0.15, 1 - clamp(amount, 0, 0.85)), t + 0.015);
    gain.exponentialRampToValueAtTime(1, t + Math.max(0.06, duration || 0.15));
  },
  punch(level, pos) {
    if (!this.ctx || G.muted || this.muted || level <= 0) return;
    const t = this.ctx.currentTime, gap = t - this.lastPunch;
    if (gap < 0.055) {
      if (level <= this.lastPunchLevel) return;
      level *= 0.55;
    }
    this.lastPunch = t; this.lastPunchLevel = level;
    const out = this.output('sub', pos, clamp(level, 0, 1.2));
    if (!out) return;
    const osc = this.ctx.createOscillator(), env = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(78, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.11);
    env.gain.setValueAtTime(0.85, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(env); env.connect(out); this.trackProcedural(osc); osc.start(t); osc.stop(t + 0.12);
    this.noise(0.012, 0.035 * level, 3500, 'impacts', pos, true);
    if (level >= 0.7) this.duck(clamp(level * 0.4, 0.22, 0.48), 0.14 + level * 0.06);
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  rampNode(node, target, duration) {
    if (!node || !this.ctx) return;
    const t = this.ctx.currentTime, gain = node.gain;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(t);
    else { gain.cancelScheduledValues(t); gain.setValueAtTime(Math.max(0, gain.value), t); }
    gain.linearRampToValueAtTime(Math.max(0, target), t + (duration || 0.018));
  },
  setMuted(m) {
    this.muted = !!m;
    this.rampNode(this.master, m ? 0 : (G.sfxVol === undefined ? 0.45 : G.sfxVol));
  },
  setMusicMuted(m) { this.rampNode(this.musicMute, m ? 0 : 1); },
  setVolume(v) {
    G.sfxVol = clamp(v, 0, 1);
    if (!G.muted) this.rampNode(this.master, G.sfxVol);
    try { localStorage.setItem('meatslicer_sfx_volume', String(G.sfxVol)); } catch (e) {}
  },

  canPlay(key) {
    if (!this.ctx || G.muted || this.muted) return false;
    const now = this.ctx.currentTime, last = this.lastPlayed.get(key) || -999;
    if (now - last < (this.cooldowns[key] || 0)) return false;
    this.lastPlayed.set(key, now);
    return true;
  },

  output(bus, pos, vol) {
    if (!this.ctx) return null;
    const gain = this.ctx.createGain();
    const p = G.player;
    let pan = 0, distanceGain = 1;
    // guard against non-finite coords (e.g. a caller passing { bossKind } with no x/y)
    if (pos && p && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      pan = clamp((pos.x - p.x) / (W / 2), -1, 1) * 0.75;
      const maxD = Math.hypot(W, H);
      distanceGain = 1 - 0.35 * clamp(dist(pos.x, pos.y, p.x, p.y) / maxD, 0, 1);
    }
    gain.gain.value = (vol === undefined ? 1 : vol) * distanceGain;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner(); panner.pan.value = pan;
      gain.connect(panner); panner.connect(this.buses[bus] || this.master);
    } else gain.connect(this.buses[bus] || this.master);
    return gain;
  },

  sample(name, bus, pos, gain, key) {
    if (typeof SfxBank === 'undefined') return false;
    if (!SfxBank.buffers.has(name)) { SfxBank.want(name); return false; }
    if (!this.canPlay(key || name)) return true;
    this.enforceVoiceLimit();
    const out = this.output(bus, pos, 1);
    return SfxBank.play(name, out, { gain: (gain || 1) * rand(0.92, 1.08), rate: rand(0.97, 1.03) });
  },

  enforceVoiceLimit() {
    const sampled = typeof SfxBank === 'undefined' ? [] : SfxBank.active;
    while (sampled.length + this.procedural.length >= this.maxVoices) {
      const sampleVoice = sampled[0], proceduralVoice = this.procedural[0];
      if (sampleVoice && (!proceduralVoice || sampleVoice.started <= proceduralVoice.started)) {
        sampled.shift();
        try { sampleVoice.src.stop(); } catch (e) {}
      } else if (proceduralVoice) {
        this.procedural.shift();
        try { proceduralVoice.src.stop(); } catch (e) {}
      } else break;
    }
  },

  trackProcedural(src) {
    if (!src || !this.ctx) return;
    this.enforceVoiceLimit();
    const voice = { src, started: this.ctx.currentTime };
    this.procedural.push(voice);
    src.onended = () => {
      const index = this.procedural.indexOf(voice);
      if (index >= 0) this.procedural.splice(index, 1);
    };
  },

  osc(freq, dur, type, vol, slide, bus, pos, detune) {
    if (!this.ctx || G.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(Math.max(0.001, vol || 0.3), t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.output(bus || 'impacts', pos));
    this.trackProcedural(o); o.start(t); o.stop(t + dur);
  },
  blip(freq, dur, type, vol, slide, bus, pos) { this.osc(freq, dur, type, vol, slide, bus, pos, 0); },
  tone(freq, dur, type, vol, slide, detune, bus, pos) {
    this.osc(freq, dur, type, (vol || 0.25) / 2, slide, bus, pos, -(detune || 8));
    this.osc(freq, dur, type, (vol || 0.25) / 2, slide, bus, pos, detune || 8);
  },
  thump(freq, dur, vol, slideTo, bus, pos) { this.osc(freq, dur, 'sine', vol || 0.4, (slideTo || 45) - freq, bus, pos, 0); },
  noise(dur, vol, low, bus, pos, highpass) {
    if (!this.ctx || G.muted) return;
    const t = this.ctx.currentTime, len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = buf; f.type = highpass ? 'highpass' : 'lowpass'; f.frequency.value = low || 900; g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this.output(bus || 'impacts', pos));
    this.trackProcedural(src); src.start(t);
  },
  click(vol, freq, bus, pos) { this.noise(0.02, vol || 0.15, freq || 1500, bus, pos, true); },

  shoot(weapon) {
    const w = typeof weapon === 'string' ? null : weapon;
    const id = w ? w.id : null, kind = w ? w.sfx : weapon;
    const sampleName = id && !['bile', 'cauterizer', 'redhand'].includes(id) ?
      (id === 'spinaltap' ? 'wpn_spinaltap_fire' : 'wpn_' + id) : null;
    const sampled = sampleName && this.sample(sampleName, 'weapons', null, 0.88, 'shoot_' + id);
    this.punch(w ? w.punch : 0.4);
    if (sampled) return;
    if (!this.canPlay('shoot_' + (id || kind))) return;
    switch (kind) {
      case 'spread': this.thump(110, .22, .5, 40, 'weapons'); this.noise(.16, .4, 900, 'weapons'); this.click(.2, 1200, 'weapons'); break;
      case 'rapid': this.thump(150, .07, .3, 60, 'weapons'); this.blip(rand(700, 900), .05, 'square', .12, -300, 'weapons'); break;
      case 'heavy': this.thump(85, .3, .6, 35, 'weapons'); this.noise(.22, .4, 500, 'weapons'); this.click(.25, 800, 'weapons'); break;
      case 'flame': this.noise(.09, .12, 700, 'weapons'); this.thump(90, .09, .12, 50, 'weapons'); break;
      case 'saw': this.tone(rand(140, 200), .08, 'sawtooth', .16, 0, 12, 'weapons'); this.thump(120, .08, .2, 60, 'weapons'); break;
      case 'beam': this.thump(70, .45, .55, 30, 'weapons'); this.blip(200, .4, 'sawtooth', .3, 1800, 'weapons'); this.noise(.35, .3, 3000, 'weapons'); break;
      case 'lob': this.thump(180, .16, .4, 70, 'weapons'); this.blip(300, .12, 'triangle', .2, -150, 'weapons'); break;
      case 'boomerang': this.blip(450, .1, 'triangle', .18, 350, 'weapons'); this.noise(.12, .14, 2500, 'weapons'); break;
      default: this.thump(170, .1, .4, 55, 'weapons'); this.blip(rand(500, 650), .06, 'square', .14, -200, 'weapons'); this.click(.12, 1800, 'weapons');
    }
  },

  syncWeaponLoop(w, active) {
    const map = { bile: 'wpnloop_bile', cauterizer: 'wpnloop_cauterizer', redhand: 'wpnloop_redhand', spinaltap: 'wpnloop_spinaltap_charge' };
    const wanted = active ? map[w.id] : null;
    if (this.currentWeaponLoop && this.currentWeaponLoop !== wanted) this.loopStop(this.currentWeaponLoop);
    this.currentWeaponLoop = wanted;
    if (!wanted || !this.ctx || G.muted) return;
    if (typeof SfxBank !== 'undefined') {
      if (SfxBank.loops.has(wanted)) return;
      const gain = wanted.includes('redhand') ? .58 : .42;
      if (SfxBank.loopStart(wanted, this.output('weapons', null), { gain })) return;
    }
    if (this.canPlay('loop_' + wanted)) {
      if (wanted.includes('redhand')) this.tone(150, .11, 'sawtooth', .16, 20, 10, 'weapons');
      else this.noise(.12, .11, wanted.includes('spinaltap') ? 2800 : 800, 'weapons');
    }
  },
  loopStop(name) { if (typeof SfxBank !== 'undefined') SfxBank.loopStop(name); if (this.currentWeaponLoop === name) this.currentWeaponLoop = null; },
  stopAllLoops() { if (typeof SfxBank !== 'undefined') SfxBank.stopAll(); this.currentWeaponLoop = null; },

  hit(e, crit) {
    const pos = e && { x: e.x, y: e.y };
    if (crit) {
      const sampled = this.sample('imp_crit', 'impacts', pos, .82, 'crit');
      this.punch(.14, pos);
      if (sampled) return;
      if (!this.canPlay('crit')) return;
      this.blip(1100, .06, 'square', .18, -500, 'impacts', pos);
      return;
    }
    this.fleshN = (this.fleshN % 4) + 1;
    if (this.sample('imp_flesh' + this.fleshN, 'impacts', pos, .68, 'hit')) return;
    if (!this.canPlay('hit')) return;
    this.noise(.075, .26, 720, 'impacts', pos);
    this.thump(170, .065, .18, 70, 'impacts', pos);
  },
  sawHit(pos) { if (!this.canPlay('sawHit')) return; this.noise(.045, .12, 1700, 'impacts', pos); this.click(.1, 2200, 'impacts', pos); },
  enemyDie(e) {
    const type = e && e.boss ? null : e && e.type, pos = e && { x: e.x, y: e.y };
    const voiced = type && this.sample('mon_' + type + '_die', 'voices', pos, e.elite ? 1 : .78, 'enemyDie');
    if (!voiced && this.canPlay('enemyDie')) {
      this.noise(.15, .3, 600, 'voices', pos);
      this.thump(160, .14, .3, 50, 'voices', pos);
      this.blip(200, .12, 'sawtooth', .15, -120, 'voices', pos);
    }
    this.goreN = (this.goreN % 3) + 1;
    const gored = this.sample('gore_burst' + this.goreN, 'impacts', pos, e && e.elite ? .72 : .5, 'goreBurst');
    if (!gored && this.canPlay('goreBurst')) this.noise(.12, .2, 430, 'impacts', pos);
    this.punch(e && e.elite ? .42 : .28, pos);
  },
  explode(pos) {
    const sampled = this.sample('imp_explosion', 'impacts', pos, .92, 'explode');
    this.punch(.82, pos);
    if (sampled) return;
    if (!this.canPlay('explode')) return;
    this.thump(70, .35, .5, 30, 'impacts', pos);
    this.noise(.4, .5, 350, 'impacts', pos);
  },
  hurt() { if (this.sample('plr_hurt', 'voices', null, .8, 'hurt')) return; this.thump(120, .2, .4, 45, 'voices'); this.blip(180, .2, 'sawtooth', .3, -100, 'voices'); },

  lifesteal() {
    const sampled = this.sample('plr_lifesteal', 'voices', null, .72, 'lifesteal');
    this.punch(.12);
    if (sampled) return;
    if (!this.canPlay('lifesteal')) return;
    this.noise(.1, .16, 650, 'voices');
    this.blip(260, .14, 'sine', .2, 180, 'voices');
  },
  playerDeath() { this.stopAllLoops(); if (this.sample('plr_death', 'voices', null, 1, 'playerDeath')) return; this.thump(80, .65, .7, 25, 'voices'); this.noise(.7, .45, 350, 'voices'); },
  ricochet(pos) { if (this.sample('imp_ricochet', 'impacts', pos, .5, 'ricochet')) return; this.blip(rand(1400, 1900), .045, 'triangle', .12, -500, 'impacts', pos); },

  wallHit(pos) {
    this.wallN = (this.wallN % 3) + 1;
    if (this.sample('imp_wall' + this.wallN, 'impacts', pos, .58, 'wallHit')) return;
    if (!this.canPlay('wallHit')) return;
    this.noise(.045, .18, 2400, 'impacts', pos, true);
    this.thump(150, .04, .1, 80, 'impacts', pos);
  },
  trapSet(pos) { this.blip(240, .08, 'square', .13, -80, 'impacts', pos); this.click(.12, 900, 'impacts', pos); },
  trapSnap(pos) { if (this.sample('imp_trap_snap', 'impacts', pos, .75, 'trapSnap')) return; this.noise(.09, .28, 1200, 'impacts', pos); this.thump(170, .08, .2, 80, 'impacts', pos); },
  split(e) { const p = { x: e.x, y: e.y }; if (this.sample('mon_splitter_split', 'voices', p, .75, 'split')) return; this.noise(.12, .25, 700, 'voices', p); },
  fuse(e) { const p = { x: e.x, y: e.y }; if (this.sample('mon_exploder_fuse', 'voices', p, .65, 'fuse')) return; this.blip(820, .25, 'square', .16, 300, 'voices', p); },
  spawn(e) { const p = { x: e.x, y: e.y }; if (this.sample('mon_spawn', 'voices', p, e.elite ? .7 : .4, 'spawn')) return; this.noise(.12, .12, 500, 'voices', p); },
  spit(e) { const p = e && { x: e.x, y: e.y }; if (this.sample('mon_spitter_attack', 'voices', p, .68, 'spit')) return; this.blip(350, .1, 'sawtooth', .15, -150, 'voices', p); this.thump(140, .08, .18, 70, 'voices', p); },

  boss(e, event) {
    const pos = e && { x: e.x, y: e.y };
    const name = event === 'death' ? 'boss_death' : (event === 'enrage' ? 'boss_enrage' : 'boss_' + e.bossKind + '_' + event);
    const gain = event === 'death' ? 1 : .88;
    const sampled = this.sample(name, 'voices', pos, gain, 'boss_' + event);
    const weight = event === 'death' ? 1 : (event === 'roar' ? .92 : (event === 'enrage' || event === 'stomp' ? .82 : .55));
    this.punch(weight, pos);
    if (event === 'death' || event === 'roar' || event === 'enrage') this.duck(event === 'death' ? .48 : .35, event === 'death' ? .34 : .22);
    if (sampled) return;
    if (!this.canPlay('boss_' + event)) return;
    if (event === 'death') {
      this.thump(55, .8, .75, 25, 'voices', pos);
      this.noise(.8, .5, 300, 'voices', pos);
    } else {
      this.thump(60, .6, .5, 30, 'voices', pos);
      this.blip(90, .6, 'sawtooth', .35, 40, 'voices', pos);
      this.noise(.5, .35, 300, 'voices', pos);
    }
  },
  bossRoar(e) { if (e) this.boss(e, 'roar'); else { this.thump(60, .6, .5, 30, 'voices'); this.noise(.5, .35, 300, 'voices'); } },

  ui(name, fallback) { if (this.sample('ui_' + name, 'ui', null, .72, 'ui_' + name)) return true; if (fallback) fallback(); return false; },
  pickup() { this.ui('menu', () => this.blip(600, .07, 'square', .15, 300, 'ui')); },
  gem() { this.ui('gem', () => this.blip(rand(800, 1100), .05, 'sine', .12, 200, 'ui')); },
  heart() { this.ui('heart', () => { this.blip(400, .15, 'sine', .25, 200, 'ui'); this.thump(140, .12, .2, 70, 'ui'); }); },
  ammo() { this.ui('ammo', () => { this.click(.14, 1600, 'ui'); this.blip(520, .08, 'square', .12, -80, 'ui'); }); },
  weapon() { this.ui('weapon', () => { this.thump(120, .14, .4, 50, 'ui'); this.blip(300, .1, 'square', .25, 200, 'ui'); this.blip(450, .12, 'square', .2, 250, 'ui'); }); },
  item() { this.ui('item', () => { this.thump(100, .2, .4, 45, 'ui'); this.blip(350, .15, 'triangle', .3, 150, 'ui'); this.blip(525, .2, 'triangle', .25, 200, 'ui'); }); },
  active() { this.ui('active', () => { this.thump(140, .22, .5, 60, 'ui'); this.blip(700, .12, 'sawtooth', .28, 500, 'ui'); this.noise(.1, .14, 2400, 'ui', null, true); }); },
  activeEmpty() { this.ui('active_empty', () => this.blip(220, .12, 'square', .18, -90, 'ui')); },
  curse() { this.ui('curse', () => { this.thump(60, .5, .5, 30, 'ui'); this.blip(180, .4, 'sawtooth', .22, -60, 'ui'); }); },
  revive() { if (this.sample('plr_revive', 'voices', null, .85, 'revive')) return; this.blip(500, .3, 'sine', .25, 300, 'ui'); this.thump(100, .3, .4, 50, 'ui'); },
  levelup() { this.ui('levelup', () => { this.blip(400, .12, 'square', .25, 200, 'ui'); setTimeout(() => this.blip(600, .12, 'square', .25, 200, 'ui'), 100); setTimeout(() => this.blip(800, .2, 'square', .25, 200, 'ui'), 200); }); },
  perk() { this.ui('perk', () => this.blip(500, .1, 'square', .25, 300, 'ui')); },
  menu() { this.ui('menu', () => this.blip(620, .055, 'square', .11, 120, 'ui')); },
  door(pos) { this.noise(.25, .3, 400, 'impacts', pos); this.thump(90, .2, .35, 40, 'impacts', pos); },
  roomClear() { this.blip(260, .18, 'triangle', .2, 280, 'ui'); this.thump(90, .18, .25, 40, 'ui'); },
  stairs() { this.ui('stairs', () => { this.blip(250, .3, 'triangle', .3, 250, 'ui'); this.thump(80, .3, .35, 40, 'ui'); }); },
  shieldBreak() { if (this.sample('plr_shield_break', 'impacts', null, .85, 'shieldBreak')) return; this.noise(.15, .3, 2600, 'impacts'); this.blip(900, .18, 'triangle', .2, -650, 'impacts'); },
  shieldUp() { if (this.sample('plr_shield_up', 'ui', null, .7, 'shieldUp')) return; this.blip(500, .16, 'sine', .18, 380, 'ui'); },
};
