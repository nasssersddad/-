// أصوات مولّدة بـ WebAudio + موسيقى عود على مقام الحجاز (بدون ملفات صوت)
export class Audio {
  constructor() {
    this.ctx = null;
    this.music = true;
    this.sfx = true;
    this.musicTimer = null;
    this.step = 0;
    this.night = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (this.music) this.startMusic();
  }

  setMusic(on) {
    this.music = on;
    if (!this.ctx) return;
    if (on) this.startMusic(); else this.stopMusic();
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slide = 0) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, freq = 1200, vol = 0.25, when = 0, q = 1) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur);
  }

  // صوت المطر: ضجة مفلترة متكررة، علوّها حسب شدة المطر (0..1)
  setRain(level) {
    if (!this.ctx) return;
    const target = this.sfx ? Math.max(0, Math.min(1, level)) * 0.16 : 0;
    if (!this.rainSrc && target > 0) {
      this.rainSrc = this.ctx.createBufferSource();
      this.rainSrc.buffer = this.noiseBuf;
      this.rainSrc.loop = true;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 5200;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      this.rainSrc.connect(hp); hp.connect(lp); lp.connect(this.rainGain); this.rainGain.connect(this.master);
      this.rainSrc.start();
    }
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
  }

  play(name) {
    switch (name) {
      case 'chop': this.noise(0.12, 700, 0.35); this.tone(140, 0.08, 'triangle', 0.2); break;
      case 'mine': this.noise(0.08, 2600, 0.3, 0, 4); this.tone(380, 0.1, 'square', 0.06); break;
      case 'dig': this.noise(0.18, 400, 0.3); break;
      case 'water': for (let i = 0; i < 3; i++) this.tone(600 + i * 180, 0.08, 'sine', 0.1, i * 0.05, 300); break;
      case 'pick': this.tone(880, 0.07, 'triangle', 0.12); this.tone(1320, 0.09, 'triangle', 0.1, 0.05); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.07); this.tone(1319, 0.2, 'square', 0.07, 0.07); break;
      case 'craft': this.tone(523, 0.08, 'triangle', 0.15); this.tone(659, 0.08, 'triangle', 0.15, 0.07); this.tone(784, 0.15, 'triangle', 0.15, 0.14); break;
      case 'build': this.noise(0.1, 500, 0.3); this.noise(0.1, 500, 0.3, 0.15); this.tone(392, 0.3, 'triangle', 0.15, 0.3); this.tone(523, 0.4, 'triangle', 0.15, 0.4); break;
      case 'level': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.15, i * 0.08)); break;
      case 'chest': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.13, i * 0.07)); this.noise(0.4, 6000, 0.08, 0, 2); break;
      case 'hit': this.noise(0.08, 1500, 0.3); this.tone(200, 0.1, 'sawtooth', 0.1, 0, -120); break;
      case 'hurt': this.tone(220, 0.25, 'sawtooth', 0.15, 0, -140); break;
      case 'swing': this.noise(0.1, 3000, 0.15, 0, 0.8); break;
      case 'ui': this.tone(660, 0.05, 'triangle', 0.1); break;
      case 'deny': this.tone(200, 0.12, 'square', 0.08); this.tone(160, 0.15, 'square', 0.08, 0.1); break;
      case 'talk': this.tone(300 + Math.random() * 120, 0.04, 'triangle', 0.06); break;
      case 'spin': this.tone(700 + Math.random() * 300, 0.03, 'square', 0.05); break;
      case 'thunder': this.noise(1.6, 120, 0.5, 0, 0.7); this.noise(0.9, 300, 0.25, 0.1, 0.8); break;
      case 'eat': this.noise(0.06, 900, 0.2); this.noise(0.06, 900, 0.2, 0.1); break;
      case 'plant': this.noise(0.1, 300, 0.25); this.tone(500, 0.1, 'sine', 0.08, 0.08); break;
      case 'camel': this.tone(180, 0.35, 'sawtooth', 0.08, 0, -60); this.tone(150, 0.4, 'sawtooth', 0.06, 0.2, -50); this.noise(0.3, 400, 0.08, 0.1); break;
      case 'rare': [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.14, i * 0.09)); this.noise(1.2, 7000, 0.07, 0.2, 2); break;
      case 'deal': this.tone(392, 0.12, 'triangle', 0.14); this.tone(523, 0.12, 'triangle', 0.14, 0.1); this.tone(784, 0.3, 'triangle', 0.14, 0.2); break;
      case 'magic': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.08, i * 0.1)); break;
      default: break;
    }
  }

  // ---------- الموسيقى ----------
  // مقام حجاز على ري: D Eb F# G A Bb C D
  pluck(freq, when, vol = 0.5, dur = 1.4) {
    // صوت قريب من العود: موجة مثلثية + فلتر ينغلق بسرعة
    const t = when;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle';
    o.frequency.value = freq; o2.frequency.value = freq * 1.003;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }

  drum(when, low) {
    const t = when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(low ? 110 : 320, t);
    o.frequency.exponentialRampToValueAtTime(low ? 55 : 180, t + 0.12);
    g.gain.setValueAtTime(low ? 0.5 : 0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (low ? 0.25 : 0.08));
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.3);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16];
    const base = 146.83; // ري
    const beat = 0.34;
    let next = this.ctx.currentTime + 0.3;
    let phrase = [];
    const makePhrase = () => {
      const p = [];
      let idx = Math.floor(Math.random() * 4) + 2;
      for (let i = 0; i < 8; i++) {
        idx = Math.max(0, Math.min(scale.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        p.push(Math.random() < 0.18 ? null : idx);
      }
      p[7] = Math.random() < 0.5 ? 0 : 4;
      return p;
    };
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.6) {
        const s = this.step % 16;
        if (s === 0) phrase = this.step % 32 === 0 || !phrase.length ? makePhrase() : phrase;
        // إيقاع مقسوم: دم - تك تك - دم - تك
        if (!this.night) {
          if (s % 8 === 0 || s % 8 === 3) this.drum(next, true);
          if (s % 8 === 2 || s % 8 === 6 || s % 8 === 7) this.drum(next, false);
        } else if (s % 8 === 0) this.drum(next, true);
        if (s % 2 === 0) {
          const n = phrase[(s / 2) % 8];
          if (n !== null && n !== undefined) {
            const f = base * Math.pow(2, scale[n] / 12);
            this.pluck(f, next, this.night ? 0.3 : 0.42);
            if (Math.random() < 0.25) this.pluck(f, next + beat * 0.5, 0.2, 0.6);
          }
        }
        if (s === 0) this.pluck(base / 2, next, 0.35, 2.5);
        next += beat;
        this.step++;
      }
    };
    this.musicTimer = setInterval(tick, 150);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
