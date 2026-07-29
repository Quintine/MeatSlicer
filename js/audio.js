// ---- music manager: crossfading loops mapped to game moods ----
const Music = {
  current: null,   // { audio, name }
  fading: null,
  bossCount: 0,

  TRACKS: {
    menu: 'Blood Arcade.mp3',
    floors: [
      'Rust Hollow Loop.mp3', 'Blood Dice Loop.mp3', 'Crimsonland Requiem.mp3',
      'Crimsonland Tool.mp3', 'Blood Arcade_Alt.mp3', 'Rust Hollow Loop_Alt.mp3',
      'Blood Dice Loop_alt.mp3', 'Crimsonland Requiem_alt.mp3', 'Crimsonland Tool_alt.mp3',
      'Blood Arcade.mp3',
    ],
    bosses: {
      bonesaw: ['Bone Saw Loop_Boss.mp3', 'Bone Saw Loop_Alt_Boss.mp3'],
      gorecrown: ['Gore Crown Loop_Boss.mp3', 'Gore Crown Loop_Alt_Boss.mp3'],
      knifecrawl: ['Knife Floor Crawl_Boss.mp3', 'Knife Floor Crawl_Alt_Boss.mp3'],
      vealmother: ['Veal Mother Loop_Boss.mp3', 'Veal Mother Loop_Alt_Boss.mp3'],
      flenser: ['Flenser Loop_Boss.mp3', 'Flenser Loop_Alt_Boss.mp3'],
      hookchoir: ['Hook Choir Loop_Boss.mp3', 'Hook Choir Loop_Alt_Boss.mp3'],
      platefather: ['Plate Father Loop_Boss.mp3', 'Plate Father Loop_Alt_Boss.mp3'],
      augerprime: ['Auger Prime Loop_Boss.mp3', 'Auger Prime Loop_Alt_Boss.mp3'],
      scald: ['Scald Loop_Boss.mp3', 'Scald Loop_Alt_Boss.mp3'],
    },
  },

  // jukebox: every non-boss track, selectable by the player
  PLAYLIST: [
    'Blood Arcade.mp3', 'Blood Arcade_Alt.mp3',
    'Rust Hollow Loop.mp3', 'Rust Hollow Loop_Alt.mp3',
    'Blood Dice Loop.mp3', 'Blood Dice Loop_alt.mp3',
    'Crimsonland Requiem.mp3', 'Crimsonland Requiem_alt.mp3',
    'Crimsonland Tool.mp3', 'Crimsonland Tool_alt.mp3',
    'Bone Saw Loop_Boss.mp3', 'Bone Saw Loop_Alt_Boss.mp3',
    'Gore Crown Loop_Boss.mp3', 'Gore Crown Loop_Alt_Boss.mp3',
    'Knife Floor Crawl_Boss.mp3', 'Knife Floor Crawl_Alt_Boss.mp3',
    'Veal Mother Loop_Boss.mp3', 'Veal Mother Loop_Alt_Boss.mp3',
    'Flenser Loop_Boss.mp3', 'Flenser Loop_Alt_Boss.mp3',
    'Hook Choir Loop_Boss.mp3', 'Hook Choir Loop_Alt_Boss.mp3',
    'Plate Father Loop_Boss.mp3', 'Plate Father Loop_Alt_Boss.mp3',
    'Auger Prime Loop_Boss.mp3', 'Auger Prime Loop_Alt_Boss.mp3',
    'Scald Loop_Boss.mp3', 'Scald Loop_Alt_Boss.mp3',
  ],
  override: null,   // filename when the player picked a track manually

  pretty(file) {
    return file.replace(/\.mp3$/i, '').replace(/_Boss$/i, '').replace(/_Alt$/i, ' (Alt)').replace(/_alt$/i, ' (Alt)');
  },

  // the track the game *should* be playing right now (respects manual override)
  requestFloorMusic() {
    if (this.override) this.play(this.override);
    else this.playFloor(G.floor);
  },

  makeAudio(name) {
    const a = new Audio('mp3-music/' + encodeURIComponent(name));
    a.loop = true;
    a.volume = 0;
    a.preload = 'auto';
    return a;
  },

  floorTrack(floor) { return this.TRACKS.floors[(floor - 1) % this.TRACKS.floors.length]; },
  bossTrack(kind) {
    const pair = this.TRACKS.bosses[kind] || this.TRACKS.bosses.bonesaw;
    return pair[this.bossCount % 2];
  },

  play(name) {
    if (this.current && this.current.name === name) return;
    if (this.fading) {
      this.fading.audio.pause();
      if (typeof Sfx !== 'undefined') Sfx.detachMusic(this.fading.audio);
      this.fading = null;
    }
    if (this.current) this.fading = this.current;
    const a = this.makeAudio(name);
    a.muted = G.muted;
    if (typeof Sfx !== 'undefined') Sfx.attachMusic(a);
    a.play().catch(() => {}); // browser may block until user gesture; retried on next call
    this.current = { audio: a, name, retryT: 0 };
  },

  playMenu() { this.play(this.TRACKS.menu); },
  playFloor(floor) { this.play(this.floorTrack(floor)); },
  playBoss(kind) { this.play(this.bossTrack(kind)); this.bossCount++; },

  stop() {
    if (this.current) {
      this.current.audio.pause();
      if (typeof Sfx !== 'undefined') Sfx.detachMusic(this.current.audio);
      this.current = null;
    }
    if (this.fading) {
      this.fading.audio.pause();
      if (typeof Sfx !== 'undefined') Sfx.detachMusic(this.fading.audio);
      this.fading = null;
    }
  },

  setMuted(m) {
    if (this.current) this.current.audio.muted = m;
    if (this.fading) this.fading.audio.muted = m;
    if (typeof Sfx !== 'undefined') Sfx.setMusicMuted(m);
  },

  setVolume(v) {
    G.musicVol = clamp(v, 0, 1);
    try { localStorage.setItem('meatslicer_music_volume', String(G.musicVol)); } catch (e) {}
    if (this.current) this.current.audio.volume = Math.min(this.current.audio.volume, G.musicVol);
    if (this.fading) this.fading.audio.volume = Math.min(this.fading.audio.volume, G.musicVol);
  },

  // cycle the jukebox selection: Auto -> track 0 -> ... -> track N -> Auto
  cycle(dir) {
    const n = this.PLAYLIST.length;
    if (G.musicSel === undefined || G.musicSel === null) G.musicSel = -1;
    G.musicSel += dir;
    if (G.musicSel >= n) G.musicSel = -1;
    if (G.musicSel < -1) G.musicSel = n - 1;

    if (G.musicSel === -1) {
      this.override = null;
      addToast('MUSIC: AUTO', 'floor rotation');
    } else {
      this.override = this.PLAYLIST[G.musicSel];
      addToast('MUSIC: ' + this.pretty(this.override));
    }
    // never interrupt a live boss track — it hands back when the boss dies
    if (!G.boss) this.requestFloorMusic();
    Sfx.pickup();
  },

  update(dt) {
    const target = G.musicVol === undefined ? 0.55 : G.musicVol;
    // Tracks created before the AudioContext resumed keep playing directly;
    // attach once the context is running so large SFX can duck the music bus.
    if (typeof Sfx !== 'undefined') {
      if (this.current) Sfx.attachMusic(this.current.audio);
      if (this.fading) Sfx.attachMusic(this.fading.audio);
    }
    if (this.current && this.current.audio.volume < target) {
      this.current.audio.volume = clamp(this.current.audio.volume + dt * 0.8, 0, target);
      // If autoplay was blocked, retry at a gentle cadence rather than once
      // per frame (which can flood promises and the browser media pipeline).
      this.current.retryT -= dt;
      if (this.current.audio.paused && this.current.retryT <= 0) {
        this.current.retryT = 1;
        this.current.audio.play().catch(() => {});
      }
    }
    if (this.fading) {
      const v = this.fading.audio.volume - dt * 0.8;
      if (v <= 0.01) {
        this.fading.audio.volume = 0;
        this.fading.audio.pause();
        if (typeof Sfx !== 'undefined') Sfx.detachMusic(this.fading.audio);
        this.fading = null;
      } else {
        this.fading.audio.volume = v;
      }
    }
  },
};
