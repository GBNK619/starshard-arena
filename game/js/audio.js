// Starshard Arena — audio.js
// All sound is synthesized with WebAudio: no audio files exist. The engine
// stays silent until unlock() runs from a user gesture (browser policy),
// and every effect is a small oscillator or noise burst with an envelope.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.lastShootAt = 0;
    this.musicTimer = null;
    this.nextNoteAt = 0;
    this.step = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.14;
    this.musicGain.connect(this.master);
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // One enveloped oscillator blip. slideTo bends the pitch over the life
  // of the note, which is most of what makes these read as effects.
  tone(freq, dur, { type = 'sine', vol = 0.3, slideTo = null, delay = 0, dest = null } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(dest ?? this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise, for explosions and the dash whoosh.
  noise(dur, { vol = 0.3, from = 2400, to = 300, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() {
    // Throttled: at high fire rates the blips would pile into a buzz.
    const now = performance.now();
    if (now - this.lastShootAt < 45) return;
    this.lastShootAt = now;
    this.tone(760, 0.07, { type: 'square', vol: 0.08, slideTo: 210 });
  }

  hit() {
    this.tone(240, 0.05, { type: 'triangle', vol: 0.12, slideTo: 140 });
  }

  explosion(big = false) {
    this.noise(big ? 0.5 : 0.28, { vol: big ? 0.5 : 0.3, from: 3000, to: 120 });
    this.tone(big ? 130 : 170, big ? 0.45 : 0.25, { type: 'sine', vol: 0.35, slideTo: 40 });
  }

  pickup() {
    this.tone(880, 0.07, { type: 'sine', vol: 0.16 });
    this.tone(1318, 0.1, { type: 'sine', vol: 0.14, delay: 0.05 });
  }

  heart() {
    this.tone(523, 0.12, { type: 'triangle', vol: 0.18 });
    this.tone(659, 0.12, { type: 'triangle', vol: 0.18, delay: 0.08 });
    this.tone(784, 0.2, { type: 'triangle', vol: 0.18, delay: 0.16 });
  }

  dash() {
    this.noise(0.16, { vol: 0.16, from: 900, to: 3400 });
  }

  hurt() {
    this.tone(300, 0.25, { type: 'sawtooth', vol: 0.25, slideTo: 70 });
    this.noise(0.2, { vol: 0.2, from: 1600, to: 200 });
  }

  shieldBreak() {
    this.tone(1180, 0.16, { type: 'triangle', vol: 0.22, slideTo: 320 });
  }

  upgrade() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.16, delay: i * 0.07 }));
  }

  waveStart() {
    this.tone(392, 0.14, { type: 'square', vol: 0.1 });
    this.tone(587, 0.2, { type: 'square', vol: 0.1, delay: 0.1 });
  }

  win() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => this.tone(f, 0.24, { type: 'triangle', vol: 0.2, delay: i * 0.13 }));
  }

  lose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(f, 0.3, { type: 'sawtooth', vol: 0.14, delay: i * 0.17 }));
  }

  // A quiet two-bar loop: a pulsing bass in A minor with a sparse plucked
  // arpeggio over it, scheduled a little ahead of the clock.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 82.4, 0];
    const arp = [440, 0, 523, 0, 659, 0, 523, 0, 349, 0, 440, 0, 523, 0, 392, 0];
    const stepDur = 0.21;
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      // After a mute or a stall the schedule may lag far behind the clock;
      // resync instead of bursting every missed note at once.
      if (this.nextNoteAt < this.ctx.currentTime - 0.25) {
        this.nextNoteAt = this.ctx.currentTime + 0.05;
      }
      while (this.nextNoteAt < this.ctx.currentTime + 0.3) {
        const i = this.step % 16;
        const delay = Math.max(0, this.nextNoteAt - this.ctx.currentTime);
        if (bass[i]) this.tone(bass[i], 0.2, { type: 'triangle', vol: 0.5, delay, dest: this.musicGain });
        if (arp[i]) this.tone(arp[i], 0.16, { type: 'sine', vol: 0.16, delay, dest: this.musicGain });
        this.nextNoteAt += stepDur;
        this.step++;
      }
    }, 110);
  }
}
