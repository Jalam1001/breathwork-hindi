// Audio, voice and vibration cues. Everything is synthesized live with the Web Audio API (no audio files).
// Eyes-closed mode: inhale = tone gliding UP for the whole phase, exhale = warmer tone gliding DOWN for the
// whole phase, hold = soft pulsing drone (+ quiet ticks), sigh top-up = short bright chirp, box corners = soft chime.
import { PhaseKind as K, isHold, audioPlan, hapticPattern, spokenFor, roundAnnouncement, Techniques } from './domain.js';

export const CUE_DEFAULTS = {
  eyesClosed: true, tones: true, holdTicks: true, ambient: false, bells: true, halfway: true,
  voice: false, voiceCounts: false, haptics: true,
  master: 0.8, toneVol: 0.7, ambientVol: 0.5, voiceVol: 0.9,
};

export class Cues {
  constructor() {
    this.settings = { ...CUE_DEFAULTS };
    this.ctx = null; this.voices = new Set(); this.bells = new Set(); this.amb = null; this.noise = null;
    this.tl = null; this.log = []; // test hook: recent scheduled cues
    this.canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this.canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.voice = null;
  }
  get audible() { return !!this.ctx && (this.settings.tones || this.settings.eyesClosed); }
  _log(e) { this.log.push({ at: this.ctx ? +this.ctx.currentTime.toFixed(3) : 0, ...e }); if (this.log.length > 400) this.log.shift(); }

  /** Must run inside a user gesture (tap) so iOS/Safari and Chrome allow sound and speech. */
  unlock() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !this.ctx) {
        const c = this.ctx = new AC();
        this.out = c.createDynamicsCompressor();
        this.out.threshold.value = -16; this.out.ratio.value = 3; this.out.attack.value = 0.01; this.out.release.value = 0.3;
        this.master = c.createGain(); this.toneBus = c.createGain(); this.ambBus = c.createGain();
        this.toneBus.connect(this.master); this.ambBus.connect(this.master); this.master.connect(this.out); this.out.connect(c.destination);
        this.master.gain.value = 0; this.applyVolumes(0.02);
      }
      if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
      if (this.ctx) { const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start(0); }
    } catch (e) { console.warn('Audio unavailable', e); }
    if (this.canSpeak && this.settings.voice) {
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); this._pickVoice(); } catch (e) { /* ignore */ }
    }
  }
  /** Prefer a Hindi (hi-IN) voice. Returns true when one is installed. */
  _pickVoice() {
    if (!this.canSpeak) return false;
    const vs = speechSynthesis.getVoices();
    const hi = vs.filter((v) => /^hi([-_]|$)/i.test(v.lang));
    this.voice = hi.find((v) => /^hi[-_]IN/i.test(v.lang) && v.localService) || hi.find((v) => /^hi[-_]IN/i.test(v.lang)) || hi[0] || null;
    return !!this.voice;
  }
  get hasHindiVoice() { return this._pickVoice(); }
  applyVolumes(tc = 0.08) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.settings;
    this.master.gain.setTargetAtTime(s.master, t, tc);
    this.toneBus.gain.setTargetAtTime(s.toneVol, t, tc);
    this.ambBus.gain.setTargetAtTime(s.ambientVol, t, tc);
  }

  // ---------- building blocks ----------
  _hold(param, now) { if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now); else { const v = param.value; param.cancelScheduledValues(now); param.setValueAtTime(v, now); } }

  /** A sustained voice: oscillators -> optional filter/tremolo -> envelope. Smooth attack and release, no clicks. */
  _voice({ oscs, dur, peak, attack = 0.18, release = 0.3, filter, tremolo, delay = 0.012, tag }) {
    const c = this.ctx, t0 = c.currentTime + delay, t1 = t0 + Math.max(0.06, dur);
    const env = c.createGain();
    const a = Math.min(attack, (t1 - t0) / 3), r = Math.min(release, (t1 - t0) / 3);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + a);
    env.gain.setValueAtTime(peak, t1 - r);
    env.gain.linearRampToValueAtTime(0, t1);
    env.connect(this.toneBus);
    let head = env;
    if (filter) { const f = c.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q ?? 0.7; f.connect(head); head = f; }
    const nodes = [];
    if (tremolo) {
      const tg = c.createGain(); tg.gain.value = 1 - tremolo.depth; tg.connect(head); head = tg;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = tremolo.rate; lg.gain.value = tremolo.depth;
      lfo.connect(lg); lg.connect(tg.gain); lfo.start(t0); lfo.stop(t1 + 0.05); nodes.push(lfo);
    }
    for (const o of oscs) {
      const n = c.createOscillator(), g = c.createGain();
      n.type = o.type || 'sine'; if (o.detune) n.detune.value = o.detune;
      n.frequency.setValueAtTime(o.f0, t0);
      if (o.f1 && o.f1 !== o.f0) n.frequency.exponentialRampToValueAtTime(o.f1, t1);
      g.gain.value = o.gain ?? 1; n.connect(g); g.connect(head);
      n.start(t0); n.stop(t1 + 0.05); nodes.push(n);
    }
    const rec = { env, nodes, t0, t1 };
    this.voices.add(rec);
    nodes[nodes.length - 1].onended = () => { this.voices.delete(rec); try { env.disconnect(); } catch (e) { /* ignore */ } };
    if (tag) this._log({ type: tag, f0: oscs[0].f0, f1: oscs[0].f1 ?? oscs[0].f0, dur: +(t1 - t0).toFixed(3) });
    return rec;
  }
  _fade(rec, time = 0.08) {
    const now = this.ctx.currentTime;
    this._hold(rec.env.gain, now); rec.env.gain.linearRampToValueAtTime(0, now + time);
    for (const n of rec.nodes) { try { n.stop(now + time + 0.03); } catch (e) { /* already stopping */ } }
  }
  fadeVoices(time = 0.08) { if (!this.ctx) return; for (const v of this.voices) this._fade(v, time); this.voices.clear(); }

  /** Rising tone. Pitch glides up over the whole duration. */
  inhale(f0, f1, dur, fast = false, tag = 'inhale') {
    return this._voice({ tag, dur, peak: fast ? 0.2 : 0.3, attack: fast ? 0.06 : 0.25, release: fast ? 0.1 : 0.35, filter: { freq: 2600 },
      oscs: [{ f0, f1, gain: 1 }, { f0: f0 * 2, f1: f1 * 2, type: 'triangle', gain: 0.12 }, { f0, f1, detune: 6, gain: 0.35 }] });
  }
  /** Falling tone, warmer and softer (low-passed, lower peak). */
  exhale(f0, f1, dur, fast = false, tag = 'exhale') {
    return this._voice({ tag, dur, peak: fast ? 0.17 : 0.26, attack: fast ? 0.06 : 0.3, release: fast ? 0.1 : 0.5, filter: { freq: 900, q: 0.5 },
      oscs: [{ f0, f1, gain: 1 }, { f0: f0 / 2, f1: f1 / 2, gain: 0.35 }, { f0, f1, type: 'triangle', detune: -5, gain: 0.25 }] });
  }
  chirp(f0, f1, dur) {
    return this._voice({ tag: 'chirp', dur, peak: 0.24, attack: 0.03, release: Math.min(0.25, dur / 2), filter: { freq: 5000 },
      oscs: [{ f0, f1, type: 'triangle', gain: 1 }, { f0: f0 * 1.5, f1: f1 * 1.5, gain: 0.25 }] });
  }
  drone(f, dur) {
    return this._voice({ tag: 'hold', dur, peak: 0.13, attack: 0.4, release: 0.4, filter: { freq: 1200 }, tremolo: { rate: 0.8, depth: 0.35 },
      oscs: [{ f0: f, gain: 1 }, { f0: f * 1.5, gain: 0.25 }, { f0: f, detune: 4, gain: 0.5 }] });
  }
  /** Legacy short cue tone (eyes-closed mode off). */
  glide(f0, f1, ms) { return this._voice({ tag: 'glide', dur: ms / 1000, peak: 0.3, attack: 0.12, release: 0.12, oscs: [{ f0, f1 }] }); }

  _strike(partials, peak, tag, out = this.toneBus) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + 0.012, nodes = [];
    const g = c.createGain(); g.connect(out);
    let end = t0;
    for (const p of partials) {
      const o = c.createOscillator(), e = c.createGain();
      o.frequency.value = p.f; e.gain.setValueAtTime(0, t0);
      e.gain.linearRampToValueAtTime(peak * p.a, t0 + (p.attack ?? 0.008));
      e.gain.exponentialRampToValueAtTime(0.0001, t0 + p.d);
      o.connect(e); e.connect(g); o.start(t0); o.stop(t0 + p.d + 0.05); nodes.push(o); end = Math.max(end, t0 + p.d);
    }
    const rec = { env: g, nodes };
    this.bells.add(rec); nodes[0].onended = () => { this.bells.delete(rec); try { g.disconnect(); } catch (e) { /* ignore */ } };
    if (tag) this._log({ type: tag, f: partials[0].f, dur: +(end - t0).toFixed(2) });
  }
  /** Tibetan singing-bowl-like strike: inharmonic partials, slow beating pairs, long decay. */
  bowl(f = 196, len = 7, peak = 0.22, tag = 'bowl') {
    const ratios = [1, 2.72, 5.14, 8.42], amps = [1, 0.55, 0.3, 0.14], decays = [1, 0.7, 0.45, 0.3];
    const parts = [];
    ratios.forEach((r, i) => { parts.push({ f: f * r, a: amps[i], d: len * decays[i], attack: 0.012 }); parts.push({ f: f * r + 0.7 + i * 0.45, a: amps[i] * 0.6, d: len * decays[i] * 0.9, attack: 0.02 }); });
    this._strike(parts, peak / 2, tag);
  }
  chime(f = 1046, peak = 0.12, tag = 'chime') { this._strike([{ f, a: 1, d: 1.4 }, { f: f * 2.76, a: 0.25, d: 0.6 }, { f: f * 1.003, a: 0.5, d: 1.2 }], peak, tag); }
  tick(peak = 0.16) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + 0.005, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 1200; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07); o.connect(g); g.connect(this.toneBus); o.start(t0); o.stop(t0 + 0.09);
    this._log({ type: 'tick' });
  }

  // ---------- ambient bed (brown noise through a low-pass, "ocean" swell with the breath) ----------
  _noiseBuffer() {
    if (this.noise) return this.noise;
    const c = this.ctx, len = c.sampleRate * 6, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
      const x = Math.floor(c.sampleRate * 0.5); // crossfade loop seam
      for (let i = 0; i < x; i++) { const k = i / x; d[i] = d[i] * k + d[len - x + i] * (1 - k); }
    }
    return (this.noise = b);
  }
  startAmbient() {
    if (!this.ctx || !this.settings.ambient || this.amb) return;
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), now = c.currentTime;
    src.buffer = this._noiseBuffer(); src.loop = true; src.loopStart = 0.5; src.loopEnd = src.buffer.duration;
    f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.4;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5, now + 2.5);
    src.connect(f); f.connect(g); g.connect(this.ambBus); src.start(now);
    this.amb = { src, f, g }; this._log({ type: 'ambient-start' });
  }
  swell(group, dur) {
    if (!this.amb || group === 'hold') return;
    const now = this.ctx.currentTime, end = now + Math.max(0.2, dur * 0.95), up = group === 'in';
    this._hold(this.amb.g.gain, now); this.amb.g.gain.linearRampToValueAtTime(up ? 0.9 : 0.3, end);
    this._hold(this.amb.f.frequency, now); this.amb.f.frequency.exponentialRampToValueAtTime(up ? 1400 : 360, end);
  }
  stopAmbient(time = 0.6) {
    if (!this.amb) return;
    const { src, g } = this.amb, now = this.ctx.currentTime;
    this._hold(g.gain, now); g.gain.linearRampToValueAtTime(0, now + time);
    try { src.stop(now + time + 0.05); } catch (e) { /* ignore */ }
    this.amb = null;
  }

  speak(text) {
    this._log({ type: 'speak', text });
    if (!this.canSpeak) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'hi-IN'; // with no Hindi voice installed the browser falls back to its default voice
      u.volume = Math.min(1, this.settings.voiceVol * this.settings.master); u.rate = 0.9; u.pitch = 0.95;
      if (!this.voice) this._pickVoice();
      if (this.voice) u.voice = this.voice;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  vibrate(p) { if (!this.canVibrate || !p.length) return; try { navigator.vibrate(p); } catch (e) { /* ignore */ } }

  /** Preview from the detail screen. */
  test() {
    if (!this.ctx) return;
    if (this.settings.eyesClosed) { this.inhale(220, 440, 2); setTimeout(() => this.ctx && this.exhale(392, 196, 2.5), 2050); }
    else this.glide(220, 440, 1200);
    if (this.settings.haptics) this.vibrate([220]);
  }

  // ---------- controller hooks ----------
  onStart(tl) {
    this.tl = tl; this.applyVolumes();
    if (this.audible && this.settings.bells) this.bowl(196, 7, 0.24, 'bell-start');
    this.startAmbient();
    if (this.settings.voice) this.speak(this.settings.eyesClosed ? 'आराम से बैठिए, और आँखें बंद कर लीजिए' : 'तैयार हो जाइए');
  }
  onResume() { this.applyVolumes(); this.startAmbient(); }
  onLeadInTick(sec) { if (this.audible && !(sec === 3 && this.settings.bells)) this.tick(0.12); }
  onSegment(seg, offsetMs = 0) {
    const s = this.settings, k = seg.step.kind, tl = this.tl;
    const off = Math.max(0, Math.min(offsetMs, seg.step.ms - 50));
    const remain = (seg.step.ms - off) / 1000, frac = off / seg.step.ms;
    const isHyper = tl?.config.technique.id === Techniques.hyper.id;
    const fresh = off < 250;
    const plan = audioPlan(k, seg.step.ms, s.eyesClosed);
    const group = plan.type === 'hold' || plan.type === 'tick' ? 'hold' : (plan.type === 'exhale' || (plan.type === 'glide' && plan.f1 < plan.f0)) ? 'out' : 'in';
    if (this.audible) {
      this.fadeVoices(0.05);
      const at = (a, b) => a * Math.pow(b / a, frac); // pitch where the glide would be now (after resume / late tick)
      if (plan.type === 'inhale') this.inhale(at(plan.f0, plan.f1), plan.f1, remain, plan.fast);
      else if (plan.type === 'exhale') this.exhale(at(plan.f0, plan.f1), plan.f1, remain, plan.fast);
      else if (plan.type === 'chirp') this.chirp(at(plan.f0, plan.f1), plan.f1, remain);
      else if (plan.type === 'hold') this.drone(plan.f, remain);
      else if (plan.type === 'glide') this.glide(plan.f0, plan.f1, Math.min(plan.ms, remain * 1000));
      else this.tick();
      if (s.eyesClosed && fresh && tl?.config.technique.visual === 'square') this.chime(seg.indexInCycle % 2 ? 1175 : 1046, 0.1, 'corner');
      if (s.eyesClosed && fresh && isHyper && seg.indexInCycle === 0 && seg.cycle > 0) this.bowl(262, 3.5, 0.16, 'round');
    }
    this.swell(group, remain);
    if (s.voice) {
      if (isHyper && seg.indexInCycle === 0 && fresh) { const r = roundAnnouncement(seg.cycle, tl.cycles); this.speak(r ? `${r}। साँस अंदर लीजिए` : 'साँस अंदर लीजिए'); }
      else if (k === K.BREATHE_IN || k === K.BREATHE_OUT) { if (k === K.BREATHE_IN && seg.indexInCycle % 10 === 0) this.speak(String(seg.indexInCycle / 2 + 1)); }
      else this.speak(spokenFor(seg.step));
    }
    if (s.haptics) this.vibrate(hapticPattern(k));
  }
  onHoldSecond(seg, sec) {
    const s = this.settings;
    if (this.audible && s.holdTicks) this.tick(s.eyesClosed ? 0.09 : 0.16);
    if (s.voice && s.voiceCounts && seg && isHold(seg.step.kind)) {
      const total = Math.round(seg.step.ms / 1000), left = total - sec;
      if (total <= 10) this.speak(String(sec + 1));
      else if (left === 10 || left <= 5) this.speak(String(left));
    }
  }
  onHalfway(tl) {
    if (tl.totalMs < 60000) return;
    if (this.audible && this.settings.halfway) this.chime(784, 0.12, 'halfway');
    if (this.settings.voice && this.settings.halfway) this.speak('आधा सत्र पूरा');
  }
  onFinished() {
    if (this.audible && this.settings.bells) this.bowl(174.6, 8, 0.26, 'bell-end');
    if (this.settings.voice) this.speak('सत्र पूरा हुआ');
    if (this.settings.haptics) this.vibrate([300]);
  }
  stop() {
    if (this.ctx) {
      this.fadeVoices(0.08);
      for (const b of this.bells) this._fade(b, 0.4); this.bells.clear();
      this.stopAmbient(0.5);
    }
    if (this.canSpeak) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    if (this.canVibrate) try { navigator.vibrate(0); } catch (e) { /* ignore */ }
  }
}
