// ---- decoded sample bank: lazy loading, MP3 silence trimming, pooled playback ----
// Sfx remains the public API. This helper returns false until a requested clip
// has decoded, allowing Sfx to use its procedural fallback without blocking.
const SfxBank = {
  ctx: null,
  buffers: new Map(),
  pending: new Map(),
  failed: new Set(),
  active: [],
  loops: new Map(),

  FILES: {
    wpn_bonepopper: 'wpn_bonepopper.mp3',
    wpn_repeater: 'wpn_repeater.mp3',
    wpn_marrow: 'wpn_marrow.mp3',
    wpn_cleaver: 'wpn_cleaver.mp3',
    wpn_saw: 'wpn_saw.mp3',
    wpn_hemophage: 'wpn_hemophage.mp3',
    wpn_eye: 'wpn_eye.mp3',
    wpn_guthook: 'wpn_guthook.mp3',
    wpn_fleshmasher: 'wpn_fleshmasher.mp3',
    wpn_trapqueen: 'wpn_trapqueen.mp3',
    wpn_tenderizer: 'wpn_tenderizer.mp3',
    wpn_swarmjar: 'wpn_swarmjar.mp3',
    wpn_spinaltap_fire: 'wpn_spinaltap_fire.mp3',
    wpnloop_bile: 'wpnloop_bile.mp3',
    wpnloop_cauterizer: 'wpnloop_cauterizer.mp3',
    wpnloop_redhand: 'wpnloop_redhand.mp3',
    wpnloop_spinaltap_charge: 'wpnloop_spinaltap_charge.mp3',

    boss_bonesaw_roar: 'boss_bonesaw_roar.mp3',
    boss_bonesaw_charge: 'boss_bonesaw_charge.mp3',
    boss_bonesaw_saws: 'boss_bonesaw_saws.mp3',
    boss_gorecrown_roar: 'boss_gorecrown_roar.mp3',
    boss_gorecrown_volley: 'boss_gorecrown_volley.mp3',
    boss_gorecrown_summon: 'boss_gorecrown_summon.mp3',
    boss_knifecrawl_roar: 'boss_knifecrawl_roar.mp3',
    boss_knifecrawl_dash: 'boss_knifecrawl_dash.mp3',
    boss_knifecrawl_knives: 'boss_knifecrawl_knives.mp3',
    boss_vealmother_roar: 'boss_vealmother_roar.mp3',
    boss_vealmother_birth: 'boss_vealmother_birth.mp3',
    boss_vealmother_bile: 'boss_vealmother_bile.mp3',
    boss_flenser_roar: 'boss_flenser_roar.mp3',
    boss_flenser_blink: 'boss_flenser_blink.mp3',
    boss_flenser_flay: 'boss_flenser_flay.mp3',
    boss_hookchoir_roar: 'boss_hookchoir_roar.mp3',
    boss_hookchoir_chains: 'boss_hookchoir_chains.mp3',
    boss_hookchoir_release: 'boss_hookchoir_release.mp3',
    boss_platefather_roar: 'boss_platefather_roar.mp3',
    boss_platefather_wall: 'boss_platefather_wall.mp3',
    boss_platefather_stomp: 'boss_platefather_stomp.mp3',
    boss_platefather_plate: 'boss_platefather_plate.mp3',
    boss_augerprime_roar: 'boss_augerprime_roar.mp3',
    boss_augerprime_spool: 'boss_augerprime_spool.mp3',
    boss_augerprime_sweep: 'boss_augerprime_sweep.mp3',
    boss_scald_roar: 'boss_scald_roar.mp3',
    boss_scald_vent: 'boss_scald_vent.mp3',
    boss_scald_burst: 'boss_scald_burst.mp3',
    boss_enrage: 'boss_enrage.mp3',
    boss_death: 'boss_death.mp3',

    mon_shambler_die: 'mon_shambler_die.mp3',
    mon_runner_die: 'mon_runner_die.mp3',
    mon_spitter_attack: 'mon_spitter_attack.mp3',
    mon_spitter_die: 'mon_spitter_die.mp3',
    mon_splitter_die: 'mon_splitter_die.mp3',
    mon_splitter_split: 'mon_splitter_split.mp3',
    mon_mini_die: 'mon_mini_die.mp3',
    mon_exploder_fuse: 'mon_exploder_fuse.mp3',
    mon_exploder_die: 'mon_exploder_die.mp3',
    mon_spawn: 'mon_spawn.mp3',

    ui_gem: 'ui_gem.mp3',
    ui_heart: 'ui_heart.mp3',
    ui_ammo: 'ui_ammo.mp3',
    ui_weapon: 'ui_weapon.mp3',
    ui_item: 'ui_item.mp3',
    ui_levelup: 'ui_levelup.mp3',
    ui_perk: 'ui_perk.mp3',
    ui_stairs: 'ui_stairs.mp3',
    ui_menu: 'ui_menu.mp3',
    ui_active: 'ui_active.mp3',
    ui_active_empty: 'ui_active_empty.mp3',
    ui_curse: 'ui_curse.mp3',
    plr_revive: 'plr_revive.mp3',

    imp_crit: 'imp_crit.mp3',
    imp_ricochet: 'imp_ricochet.mp3',
    imp_explosion: 'imp_explosion.mp3',
    plr_hurt: 'plr_hurt.mp3',
    plr_lifesteal: 'plr_lifesteal.mp3',
    plr_death: 'plr_death.mp3',
    plr_shield_break: 'plr_shield_break.mp3',
    plr_shield_up: 'plr_shield_up.mp3',
    imp_flesh1: 'imp_flesh1.mp3',
    imp_flesh2: 'imp_flesh2.mp3',
    imp_flesh3: 'imp_flesh3.mp3',
    imp_flesh4: 'imp_flesh4.mp3',
    imp_wall1: 'imp_wall1.mp3',
    imp_wall2: 'imp_wall2.mp3',
    imp_wall3: 'imp_wall3.mp3',
    gore_burst1: 'gore_burst1.mp3',
    gore_burst2: 'gore_burst2.mp3',
    gore_burst3: 'gore_burst3.mp3',
    imp_trap_snap: 'imp_trap_snap.mp3',
  },

  init(ctx) { this.ctx = ctx || null; },

  want(name) {
    if (this.buffers.has(name) || this.pending.has(name) || this.failed.has(name)) return;
    const file = this.FILES[name];
    if (!file || !this.ctx || typeof fetch !== 'function') return;
    const job = fetch('/assets/sfx/' + encodeURIComponent(file) + '?v=49')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(bytes => this.ctx.decodeAudioData(bytes))
      .then(buffer => this.buffers.set(name, this.trim(buffer)))
      .catch(() => this.failed.add(name))
      .finally(() => this.pending.delete(name));
    this.pending.set(name, job);
  },

  preload() { for (const name of Object.keys(this.FILES)) this.want(name); },

  trim(buffer) {
    const threshold = 0.002;
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    let first = 0, last = length - 1;
    outerStart: for (; first < length; first++) {
      for (let c = 0; c < channels; c++) {
        if (Math.abs(buffer.getChannelData(c)[first]) >= threshold) break outerStart;
      }
    }
    outerEnd: for (; last > first; last--) {
      for (let c = 0; c < channels; c++) {
        if (Math.abs(buffer.getChannelData(c)[last]) >= threshold) break outerEnd;
      }
    }
    // Keep 3 ms before the transient and 20 ms after the tail to avoid clicks.
    const padIn = Math.floor(buffer.sampleRate * 0.003);
    const padOut = Math.floor(buffer.sampleRate * 0.02);
    first = Math.max(0, first - padIn);
    last = Math.min(length - 1, last + padOut);
    return { buffer, offset: first / buffer.sampleRate, duration: Math.max(0.03, (last - first + 1) / buffer.sampleRate) };
  },

  play(name, output, opts) {
    const clip = this.buffers.get(name);
    if (!clip || !this.ctx || !output) { this.want(name); return false; }
    opts = opts || {};
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = clip.buffer;
    src.playbackRate.value = opts.rate || 1;
    gain.gain.value = opts.gain === undefined ? 1 : opts.gain;
    src.connect(gain); gain.connect(output);
    const voice = { src, gain, name, started: this.ctx.currentTime };
    this.active.push(voice);
    src.onended = () => { const i = this.active.indexOf(voice); if (i >= 0) this.active.splice(i, 1); };
    src.start(0, clip.offset, clip.duration);
    return true;
  },

  loopStart(name, output, opts) {
    if (this.loops.has(name)) return true;
    const clip = this.buffers.get(name);
    if (!clip || !this.ctx || !output) { this.want(name); return false; }
    opts = opts || {};
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = clip.buffer; src.loop = true;
    src.loopStart = clip.offset; src.loopEnd = clip.offset + clip.duration;
    src.playbackRate.value = opts.rate || 1;
    gain.gain.value = 0.001;
    src.connect(gain); gain.connect(output);
    src.start(0, clip.offset);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, opts.gain || 0.5), this.ctx.currentTime + 0.04);
    this.loops.set(name, { src, gain });
    return true;
  },

  loopStop(name) {
    const voice = this.loops.get(name);
    if (!voice || !this.ctx) return;
    const end = this.ctx.currentTime + 0.06;
    voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    voice.gain.gain.setValueAtTime(Math.max(0.001, voice.gain.gain.value), this.ctx.currentTime);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, end);
    voice.src.stop(end + 0.01);
    this.loops.delete(name);
  },

  stopAll() { for (const name of [...this.loops.keys()]) this.loopStop(name); },
};
