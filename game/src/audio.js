// Sunset Harbor — all sound is synthesised with WebAudio. No audio files.
'use strict';

var AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  sirenOn: false,
  sirenPhase: 0,
  muted: false,

  // Call from a user gesture (Start button, first keypress).
  init: function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine hum: a sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      var lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Two-tone siren.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  },

  // speedRatio 0..1 (0 = parked / on foot). Call every frame.
  setEngine: function (speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    var t = this.ctx.currentTime;
    var target = driving ? 0.045 + 0.05 * speedRatio : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + 130 * speedRatio, t, 0.08);
  },

  setSiren: function (on) {
    this.sirenOn = on;
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, this.ctx.currentTime, 0.1);
  },

  // Alternate the siren tone; call every frame.
  updateSiren: function (dt) {
    if (!this.ctx || !this.sirenOsc || !this.sirenOn) return;
    this.sirenPhase += dt;
    var f = (Math.floor(this.sirenPhase / 0.45) % 2 === 0) ? 720 : 980;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.03);
  },

  _blip: function (freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    try {
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  },

  _noise: function (dur, vol, freq) {
    if (!this.ctx) return;
    try {
      var t = this.ctx.currentTime;
      var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 1200;
      var g = this.ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  },

  shot: function () { this._noise(0.12, 0.3, 900); this._blip(160, 0.08, 'square', 0.12, 60); },
  enemyShot: function () { this._noise(0.1, 0.15, 700); },
  chime: function () { this._blip(880, 0.12, 'sine', 0.15); this._blip(1318, 0.2, 'sine', 0.12); },
  jingle: function () {
    var self = this;
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { self._blip(f, 0.22, 'triangle', 0.16); }, i * 110);
    });
  },
  crash: function () { this._noise(0.25, 0.35, 500); },
  bust: function () { this._blip(220, 0.5, 'sawtooth', 0.15, 110); },
  click: function () { this._blip(660, 0.05, 'sine', 0.1); },
};
