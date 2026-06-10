/* Procedural audio: an ambient drone for the broken lands, chimes for
   discoveries, a fanfare for shards. No assets — pure WebAudio. */
'use strict';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.mood = 'day';        // day | night | battle — read by the composer
  }

  /** Create the context lazily (browsers require a user gesture first). */
  ensure(seed) {
    if (seed !== undefined) this._seed = seed;
    if (this.ctx) {
      // iOS suspends contexts aggressively; nudge it on any gesture
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this._startAmbient();
    this._startMusic();
  }

  /* -------- the composer: every world has its own song -------- */

  _startMusic() {
    this._mstep = 0;
    this._mnext = this.ctx.currentTime + 0.3;
    this._mrand = mulberry32((this._seed || 0x50EE7) >>> 0);
    this._mIdx = 3;             // melody random-walk position
    setInterval(() => this._scheduleMusic(), 50);
  }

  _scheduleMusic() {
    const ctx = this.ctx;
    while (this._mnext < ctx.currentTime + 0.25) {
      this._playStep(this._mnext);
      this._mnext += this._stepDur();
      this._mstep++;
    }
  }

  _stepDur() {
    return this.mood === 'battle' ? 0.21 : this.mood === 'night' ? 0.46 : 0.34;
  }

  _playStep(t) {
    const r = this._mrand;
    // pentatonic: bright by day, minor by night and in the Umbra
    const semis = this.mood === 'day'
      ? [0, 2, 4, 7, 9, 12, 14, 16]
      : [0, 3, 5, 7, 10, 12, 15, 17];
    const base = 220;

    const prob = this.mood === 'battle' ? 0.66 : this.mood === 'night' ? 0.34 : 0.48;
    if (r() < prob) {
      this._mIdx = Math.max(0, Math.min(semis.length - 1,
        this._mIdx + ((r() * 3) | 0) - 1));
      const f = base * Math.pow(2, semis[this._mIdx] / 12);
      this._pluck(f, t, this.mood === 'battle' ? 0.06 : 0.045);
    }
    if (this._mstep % 16 === 0) {     // slow pad chords underneath
      for (const s of [0, 7, 12]) {
        this._pad(110 * Math.pow(2, s / 12), t, 16 * this._stepDur());
      }
    }
    if (this.mood === 'battle') {     // war drums in the Umbra
      if (this._mstep % 4 === 0) this._kick(t);
      if (this._mstep % 2 === 1) this._hat(t);
    }
  }

  _pluck(freq, t, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.55);
  }

  _pad(freq, t, dur) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.016, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.1);
  }

  _kick(t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.2);
  }

  _hat(t) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(hp); hp.connect(g); g.connect(this.master);
    src.start(t);
  }

  thunder() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.1 + Math.random() * 0.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 170;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t);
  }

  _startAmbient() {
    const ctx = this.ctx;
    const amb = ctx.createGain();
    amb.gain.value = 0.035;
    amb.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.connect(amb);

    for (const [freq, detune] of [[55, 0], [82.4, 4], [110, -3]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const og = ctx.createGain();
      og.gain.value = 0.4;
      osc.connect(og); og.connect(filter);
      osc.start();
    }

    // slow swell so the drone breathes
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(amb.gain);
    lfo.start();
  }

  _note(freq, when, dur, vol, type) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  discovery() {
    this._note(659, 0, 0.9, 0.10);
    this._note(880, 0.12, 1.0, 0.09);
    this._note(988, 0.24, 1.4, 0.08);
  }

  attune() {
    [392, 523, 659, 784].forEach((f, i) => this._note(f, i * 0.1, 1.2, 0.09));
  }

  fanfare() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      this._note(f, i * 0.16, 1.8, 0.11);
      this._note(f / 2, i * 0.16, 1.8, 0.05, 'triangle');
    });
  }

  closeBook() {
    this._note(440, 0, 0.3, 0.05, 'triangle');
  }

  battleStart() {
    [110, 138.6, 164.8, 220].forEach((f, i) => this._note(f, i * 0.09, 1.4, 0.10, 'sawtooth'));
  }

  hit(big) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = big ? 0.3 : 0.15;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = big ? 900 : 1600;
    const g = ctx.createGain();
    g.gain.value = big ? 0.4 : 0.22;
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
    if (big) this._note(72, 0, 0.5, 0.18, 'sine');
  }

  heal() {
    [523, 659, 784].forEach((f, i) => this._note(f, i * 0.07, 0.8, 0.07, 'triangle'));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
