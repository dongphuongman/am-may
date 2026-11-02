// Fully synthesized soundscape + generative pentatonic music. No audio assets.

// Vietnamese pentatonic (ngũ cung: Hò Xự Xang Xê Cống) as semitone offsets.
const NGU_CUNG = [0, 2, 5, 7, 9];
const scaleFreq = (root, step) => {
  const oct = Math.floor(step / NGU_CUNG.length);
  const deg = ((step % NGU_CUNG.length) + NGU_CUNG.length) % NGU_CUNG.length;
  return root * 2 ** (oct + NGU_CUNG[deg] / 12);
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Sound {
  /** outdoor: river + crickets ambience; indoors only a faint draught of wind. */
  constructor({ outdoor = true } = {}) {
    this.outdoor = outdoor;
    this.ctx = null;
    this.muted = false;
    this.instrument = localStorage.getItem('benden.music') || 'sao';
    this.musicTimer = 0;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = this.ctx = new Ctx();
    this.master = new GainNode(ctx, { gain: 0.8 });
    this.master.connect(ctx.destination);

    // Shared reverb (generated impulse response) for bells and music.
    this.reverb = new ConvolverNode(ctx, { buffer: this.impulse(3.2) });
    const wet = new GainNode(ctx, { gain: 0.5 });
    this.reverb.connect(wet).connect(this.master);
    this.musicBus = new GainNode(ctx, { gain: 0.32 });
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const loop = (filter, gain) => {
      const src = new AudioBufferSourceNode(ctx, { buffer: this.noise, loop: true });
      const g = new GainNode(ctx, { gain });
      src.connect(filter).connect(g).connect(this.master);
      src.start(0, Math.random() * 4);
      return g;
    };
    const lfo = (frequency, depth, param) => {
      const o = new OscillatorNode(ctx, { frequency });
      o.connect(new GainNode(ctx, { gain: depth })).connect(param);
      o.start();
    };
    if (this.outdoor) lfo(0.08, 0.08, loop(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 520 }), 0.32).gain);
    const windF = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 320, Q: 0.7 });
    lfo(0.05, 160, windF.frequency);
    loop(windF, this.outdoor ? 0.1 : 0.035);
    if (this.outdoor) this.crickets();
    this.setInstrument(this.instrument);
  }

  impulse(seconds) {
    const ctx = this.ctx, len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return buf;
  }

  crickets() {
    if (!this.ctx) return;
    if (!this.muted && this.ctx.state === 'running') {
      const ctx = this.ctx, t = ctx.currentTime;
      const o = new OscillatorNode(ctx, { frequency: 4200 + Math.random() * 500 });
      const g = new GainNode(ctx, { gain: 0 });
      for (let k = 0; k < 3; k++) {
        g.gain.setValueAtTime(0, t + k * 0.07);
        g.gain.linearRampToValueAtTime(0.012, t + k * 0.07 + 0.01);
        g.gain.linearRampToValueAtTime(0, t + k * 0.07 + 0.05);
      }
      o.connect(g).connect(new StereoPannerNode(ctx, { pan: Math.random() * 2 - 1 })).connect(this.master);
      o.start(t);
      o.stop(t + 0.3);
    }
    setTimeout(() => this.crickets(), 300 + Math.random() * 1500);
  }

  bell(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [[1, 1, 6], [2, 0.5, 4], [2.76, 0.4, 3], [4.07, 0.25, 2], [5.4, 0.15, 1.5]].forEach(([ratio, amp, decay]) => {
      const o = new OscillatorNode(ctx, { frequency: 196 * ratio });
      const g = new GainNode(ctx, { gain: 0.0001 });
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * vol * 0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g);
      g.connect(this.master);
      g.connect(this.reverb);
      o.start(t);
      o.stop(t + decay + 0.1);
    });
  }

  /** Temple bell (đại hồng chung): low, long, slowly beating partials. */
  bigBell(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [[1, 1, 11], [1.004, 0.6, 11], [2.02, 0.45, 8], [2.71, 0.35, 6], [3.98, 0.2, 4], [5.2, 0.12, 2.5]].forEach(([ratio, amp, decay]) => {
      const o = new OscillatorNode(ctx, { frequency: 82 * ratio });
      const g = new GainNode(ctx, { gain: 0.0001 });
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * vol * 0.32, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g);
      g.connect(this.master);
      g.connect(this.reverb);
      o.start(t);
      o.stop(t + decay + 0.1);
    });
    // Wooden striker thud.
    const thud = new AudioBufferSourceNode(ctx, { buffer: this.noise });
    const tg = new GainNode(ctx, { gain: 0.5 * vol });
    tg.gain.setValueAtTime(0.5 * vol, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    thud.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 300 })).connect(tg).connect(this.master);
    thud.start(t, Math.random() * 3);
    thud.stop(t + 0.2);
  }

  /** Wooden fish (mõ): hollow knock. */
  mo(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [[620, 0.5, 0.11], [1240, 0.15, 0.05], [380, 0.25, 0.14]].forEach(([f, amp, decay]) => {
      const o = new OscillatorNode(ctx, { frequency: f });
      o.frequency.setValueAtTime(f * 1.04, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.02);
      const g = new GainNode(ctx, { gain: amp * vol * 0.5 });
      g.gain.setValueAtTime(amp * vol * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g);
      g.connect(this.master);
      g.connect(this.reverb);
      o.start(t);
      o.stop(t + decay + 0.02);
    });
  }

  plop(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = new OscillatorNode(ctx, { frequency: 620 });
    o.frequency.setValueAtTime(620, t);
    o.frequency.exponentialRampToValueAtTime(170, t + 0.16);
    const g = new GainNode(ctx, { gain: 0.12 * vol });
    g.gain.setValueAtTime(0.12 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const g = this.master.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(m ? 0 : 0.8, t + 0.4);
  }

  // ---------- Music ----------
  /** 'sao' (sáo trúc), 'bau' (đàn bầu) or 'off'. */
  setInstrument(name) {
    this.instrument = name;
    localStorage.setItem('benden.music', name);
    clearTimeout(this.musicTimer);
    if (this.ctx && name !== 'off') this.musicTimer = setTimeout(() => this.phrase(), 1500);
  }

  phrase() {
    if (!this.ctx || this.instrument === 'off') return;
    if (this.muted || this.ctx.state !== 'running') {
      this.musicTimer = setTimeout(() => this.phrase(), 2000);
      return;
    }
    const isSao = this.instrument === 'sao';
    const root = isSao ? 587.33 : 196; // D5 for the flute, G3 for the monochord
    const notes = 4 + Math.floor(Math.random() * 4);
    let step = pick([0, 2, 3, 5]);
    let t = this.ctx.currentTime + 0.1;
    for (let i = 0; i < notes; i++) {
      const last = i === notes - 1;
      const dur = last ? pick([2.4, 3]) : pick([0.5, 0.75, 0.75, 1.1, 1.5]);
      const prev = step;
      step = last ? pick([0, 3, 5]) : Math.max(-2, Math.min(8, step + pick([-2, -1, -1, 1, 1, 2])));
      const f = scaleFreq(root, step);
      if (isSao) this.sao(f, dur, t, i === 0 || Math.random() < 0.3);
      else this.bau(f, dur, t, step !== prev && Math.random() < 0.6 ? scaleFreq(root, prev) : null);
      t += dur;
    }
    const total = t - this.ctx.currentTime;
    this.musicTimer = setTimeout(() => this.phrase(), (total + 3 + Math.random() * 5) * 1000);
  }

  /** Bamboo flute: soft sine + breath noise, scoop into the note, delayed vibrato. */
  sao(freq, dur, t, scoop) {
    const ctx = this.ctx;
    const out = new GainNode(ctx, { gain: 0 });
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.16, t + 0.12);
    out.gain.setValueAtTime(0.16, t + dur - 0.25);
    out.gain.linearRampToValueAtTime(0, t + dur + 0.15);
    out.connect(this.musicBus);

    const o = new OscillatorNode(ctx, { frequency: freq });
    const o2 = new OscillatorNode(ctx, { type: 'triangle', frequency: freq * 2 });
    for (const osc of [o, o2]) {
      const mul = osc === o ? 1 : 2;
      osc.frequency.setValueAtTime(freq * mul * (scoop ? 0.94 : 1), t);
      osc.frequency.exponentialRampToValueAtTime(freq * mul, t + 0.09);
    }
    const vib = new OscillatorNode(ctx, { frequency: 5.2 });
    const vibDepth = new GainNode(ctx, { gain: 0 });
    vibDepth.gain.setValueAtTime(0, t);
    vibDepth.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(dur, 0.6));
    vib.connect(vibDepth);
    vibDepth.connect(o.frequency);
    o.connect(out);
    o2.connect(new GainNode(ctx, { gain: 0.08 })).connect(out);

    const breath = new AudioBufferSourceNode(ctx, { buffer: this.noise, loop: true });
    breath.connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: freq * 1.5, Q: 3 }))
      .connect(new GainNode(ctx, { gain: 0.25 })).connect(out);

    for (const n of [o, o2, vib]) { n.start(t); n.stop(t + dur + 0.2); }
    breath.start(t, Math.random() * 3);
    breath.stop(t + dur + 0.2);
  }

  /** Monochord (đàn bầu): pure harmonic pluck, slides from the previous note, wide vibrato on long notes. */
  bau(freq, dur, t, slideFrom) {
    const ctx = this.ctx;
    const out = new GainNode(ctx, { gain: 0 });
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.3, t + 0.015);
    out.gain.exponentialRampToValueAtTime(0.12, t + 0.5);
    out.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.6);
    out.connect(this.musicBus);

    const o = new OscillatorNode(ctx, { frequency: freq });
    const o2 = new OscillatorNode(ctx, { frequency: freq * 2 });
    const o3 = new OscillatorNode(ctx, { frequency: freq * 3 });
    const vib = new OscillatorNode(ctx, { frequency: 5.5 });
    const vibDepth = new GainNode(ctx, { gain: 0 });
    vibDepth.gain.setValueAtTime(0, t);
    vibDepth.gain.setValueAtTime(0, t + 0.35);
    vibDepth.gain.linearRampToValueAtTime(dur > 1 ? freq * 0.022 : freq * 0.008, t + Math.max(0.4, dur * 0.7));
    vib.connect(vibDepth);
    [[o, 1, 1], [o2, 2, 0.25], [o3, 3, 0.08]].forEach(([osc, mul, amp]) => {
      osc.frequency.setValueAtTime((slideFrom ?? freq) * mul, t);
      osc.frequency.exponentialRampToValueAtTime(freq * mul, t + (slideFrom ? 0.22 : 0.01));
      vibDepth.connect(new GainNode(ctx, { gain: mul })).connect(osc.frequency);
      osc.connect(new GainNode(ctx, { gain: amp })).connect(out);
    });
    for (const n of [o, o2, o3, vib]) { n.start(t); n.stop(t + dur + 0.7); }
  }
}
