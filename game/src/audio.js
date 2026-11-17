// All sound is synthesised with WebAudio: no audio files, nothing downloaded. A lazy
// audio context starts on the first user gesture; the engine hum follows the car's speed,
// the siren wails while police chase, and a tiny sequencer plays a bass-and-hats groove
// over the city.

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  /** Start the engine hum (call once); setEngine follows the car's speed. */
  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(speed01, on) {
    if (!engineOsc || muted) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.035;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }

  function stopSiren() {
    if (!sirenOsc) return;
    try {
      sirenOsc.stop();
      sirenLfo.stop();
    } catch {
      // Already stopped.
    }
    sirenOsc = null;
    sirenLfo = null;
    sirenGain = null;
  }

  // A 16-step loop: a laid-back bass line with hats, at 96 BPM.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
  function musicTick() {
    if (muted || !ctx) return;
    const step = musicStep % 16;
    if (BASS[step]) tone(BASS[step], 0.22, 'triangle', 0.11);
    if (step % 4 === 2) noise(0.03, 0.05, 6000);
    if (step % 8 === 0) tone(110, 0.3, 'sine', 0.08, 55);
    musicStep += 1;
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) stopSiren();
      return muted;
    },
    isMuted() {
      return muted;
    },
    startEngine,
    setEngine,
    startSiren,
    stopSiren,
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(musicTick, 156);
    },
    stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    click() {
      tone(660, 0.06, 'square', 0.06);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.12, 1320);
    },
    cash() {
      tone(988, 0.08, 'sine', 0.12);
      window.setTimeout(() => tone(1319, 0.12, 'sine', 0.12), 80);
    },
    shot() {
      noise(0.14, 0.5, 1800);
      tone(180, 0.1, 'square', 0.18, 60);
    },
    punch() {
      noise(0.08, 0.3, 700);
    },
    crash() {
      noise(0.25, 0.4, 500);
      tone(90, 0.2, 'sawtooth', 0.2, 40);
    },
    explosion() {
      noise(0.6, 0.6, 900);
      tone(60, 0.5, 'sawtooth', 0.3, 30);
    },
    sirenBlip() {
      tone(950, 0.12, 'triangle', 0.1, 700);
    },
    mission() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => window.setTimeout(() => tone(n, 0.18, 'triangle', 0.14), i * 110));
    },
    fail() {
      tone(330, 0.25, 'sawtooth', 0.12, 165);
      window.setTimeout(() => tone(220, 0.35, 'sawtooth', 0.12, 110), 180);
    },
  };
}
