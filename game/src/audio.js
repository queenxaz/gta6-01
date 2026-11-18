// audio.js — procedural WebAudio sound and music for Sunset Harbor.
// No audio files: every effect is synthesized (oscillators + noise), and the
// music is a small scheduled chord/arpeggio loop. Silent until the player
// first interacts, and fully muted in screenshot mode.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch (err) {
      return false;
    }
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // Chord roots for a lazy sunset groove (Am – F – C – G).
  const CHORDS = [
    [110.0, 130.81, 164.81, 220.0],
    [87.31, 130.81, 174.61, 220.0],
    [130.81, 164.81, 196.0, 261.63],
    [98.0, 146.83, 196.0, 246.94],
  ];

  function musicTick() {
    if (!ctx || muted) return;
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const note = chord[step % 4];
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = note * 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.45);
    if (step % 8 === 0) tone(chord[0] / 2, 0.5, 'sine', 0.25);
    step++;
  }

  return {
    /** Unlock audio after a user gesture. Safe to call every frame. */
    unlock() { resume(); },
    /** Start the background music loop. */
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(musicTick, 240);
    },
    /** Engine hum follows speed 0..1. */
    setEngine(speed01, on) {
      if (!ensure()) return;
      const target = on ? 0.03 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.1);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    get muted() { return muted; },
    shot() { noise(0.12, 0.35, 2600); tone(180, 0.08, 'square', 0.18, 60); },
    punch() { noise(0.08, 0.3, 700); },
    pickup() { tone(660, 0.09, 'sine', 0.22); setTimeout(() => tone(990, 0.12, 'sine', 0.22), 80); },
    cash() { tone(880, 0.08, 'sine', 0.22); setTimeout(() => tone(1174, 0.08, 'sine', 0.22), 70); setTimeout(() => tone(1568, 0.16, 'sine', 0.22), 140); },
    sirenBlip() { tone(950, 0.18, 'sine', 0.12, 700); },
    crash() { noise(0.25, 0.4, 500); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.25), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.22), i * 150)); },
    click() { tone(1200, 0.04, 'square', 0.12); },
    horn() { tone(370, 0.22, 'sawtooth', 0.14); tone(466, 0.22, 'sawtooth', 0.12); },
    wantedUp() { tone(220, 0.3, 'sawtooth', 0.2, 440); },
    explosion() { noise(0.7, 0.5, 300); tone(60, 0.6, 'sine', 0.4, 30); },
  };
}
