// WebAudio synth — every sound and all three radio grooves are original, generated here.
import { G } from './state.js';

const GROOVES = {
  strip: { bpm: 100, bass: [0, 0, 7, 0, 5, 0, 3, 10], lead: [12, 15, 19, 15, 12, 10, 7, 10], wave: 'sawtooth' },
  harbor: { bpm: 80, bass: [0, 0, 5, 3], lead: [12, 10, 7, 12], wave: 'triangle' },
  chase: { bpm: 132, bass: [0, 0, 0, 3, 0, 0, 5, 7], lead: [12, 12, 15, 12, 19, 15, 12, 10], wave: 'square' },
};
const STATIONS = ['strip', 'harbor', 'chase'];
const NOTE = (n) => 220 * Math.pow(2, n / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false;
    this.station = 0; this.radioOn = true;
    this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null;
    this.musicTimer = null; this.step = 0;
    this.footAcc = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      this.startRadio();
    } catch { this.ctx = null; }
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.7; }
  cycleRadio() { this.station = (this.station + 1) % STATIONS.length; this.step = 0; G.hud?.toast(`Radio: ${STATIONS[this.station].toUpperCase()} FM`); }
  startRadio() {
    if (!this.ctx || this.musicTimer) return;
    this.musicTimer = setInterval(() => {
      if (!this.radioOn || this.muted || G.mode !== 'play') return;
      const groove = GROOVES[STATIONS[this.station]];
      const beat = 60 / groove.bpm / 2;
      const now = this.ctx.currentTime;
      const bassN = groove.bass[this.step % groove.bass.length];
      const leadN = groove.lead[this.step % groove.lead.length];
      this.note(NOTE(bassN - 12), now, beat * 0.95, groove.wave, 0.16);
      if (this.step % 2 === 0) this.note(NOTE(leadN), now, beat * 0.9, 'sine', 0.07);
      this.step++;
    }, 300);
  }
  note(freq, when, dur, wave, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + dur + 0.02);
  }
  noise(dur, filterFreq, vol, type = 'lowpass') {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  gunshot(vol = 1) { this.noise(0.12, 1800, 0.5 * vol, 'bandpass'); this.note(160, this.ctx?.currentTime ?? 0, 0.08, 'square', 0.2 * vol); }
  dryFire() { this.note(900, this.ctx?.currentTime ?? 0, 0.04, 'square', 0.1); }
  punch() { this.noise(0.08, 300, 0.5); }
  crash() { this.noise(0.3, 500, 0.6); }
  thud() { this.noise(0.15, 200, 0.5); }
  pickup() { if (this.ctx) { this.note(880, this.ctx.currentTime, 0.12, 'sine', 0.25); this.note(1320, this.ctx.currentTime + 0.1, 0.18, 'sine', 0.25); } }
  reload() { if (this.ctx) { this.note(500, this.ctx.currentTime, 0.05, 'square', 0.12); this.note(700, this.ctx.currentTime + 0.12, 0.05, 'square', 0.12); } }
  carDoor() { this.noise(0.1, 400, 0.4); }
  explosion() { this.noise(0.8, 300, 0.9); }
  phoneRing() { if (this.ctx) { this.note(1200, this.ctx.currentTime, 0.15, 'sine', 0.2); this.note(1500, this.ctx.currentTime + 0.2, 0.15, 'sine', 0.2); } }
  missionPassed() {
    if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => this.note(f, this.ctx.currentTime + i * 0.12, 0.22, 'sine', 0.25));
  }
  wantedSting() { if (this.ctx) { this.note(220, this.ctx.currentTime, 0.4, 'sawtooth', 0.2); this.note(233, this.ctx.currentTime, 0.4, 'sawtooth', 0.2); } }
  bustedSting() { if (this.ctx) [440, 415, 392].forEach((f, i) => this.note(f, this.ctx.currentTime + i * 0.18, 0.3, 'triangle', 0.25)); }
  wastedSting() { if (this.ctx) [330, 311, 294, 262].forEach((f, i) => this.note(f, this.ctx.currentTime + i * 0.2, 0.35, 'triangle', 0.25)); }
  footstep(phase) {
    if (!this.ctx) return;
    const s = Math.sin(phase);
    if (s > 0.95 && this.footAcc < phase - 1) { this.footAcc = phase; this.noise(0.04, 900, 0.08); }
  }
  engine(ratio, handbrake) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 60 + ratio * 220 + (handbrake ? 40 : 0);
    this.engineGain.gain.value = 0.05 + ratio * 0.08;
  }
  engineOff() { if (this.engineGain) this.engineGain.gain.value = 0; }
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'sine';
      this.sirenGain.gain.value = 0.05;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenPhase = 0;
    } else if (!on && this.sirenOsc) {
      this.sirenOsc.stop(); this.sirenOsc = null; this.sirenGain = null;
    }
    if (this.sirenOsc) {
      this.sirenPhase = (this.sirenPhase ?? 0) + 0.09;
      this.sirenOsc.frequency.value = Math.sin(this.sirenPhase) > 0 ? 950 : 700;
    }
  }
}
