// BreathWork domain logic: techniques, timeline, pacer geometry, streaks, history codec.
// Pure ES module with no DOM access, so it runs in the browser and in Node tests.
// Ported 1:1 from the Android app (domain/Techniques.kt, Timeline.kt, Pacer.kt, data/Store.kt).

export const Purpose = { CALM: 'शांति', FOCUS: 'एकाग्रता', ENERGY: 'ऊर्जा', SLEEP: 'नींद' };

export const PhaseKind = {
  INHALE: { id: 'INHALE', spoken: 'साँस लें' },
  TOP_UP: { id: 'TOP_UP', spoken: 'थोड़ा और लें' },
  HOLD_FULL: { id: 'HOLD_FULL', spoken: 'रोकें' },
  EXHALE: { id: 'EXHALE', spoken: 'साँस छोड़ें' },
  HOLD_EMPTY: { id: 'HOLD_EMPTY', spoken: 'रोकें' },
  BREATHE_IN: { id: 'BREATHE_IN', spoken: 'अंदर' },
  BREATHE_OUT: { id: 'BREATHE_OUT', spoken: 'बाहर' },
  EXHALE_ALL: { id: 'EXHALE_ALL', spoken: 'पूरी साँस छोड़ें' },
};
const K = PhaseKind;
export const isInhale = (k) => k === K.INHALE || k === K.TOP_UP || k === K.BREATHE_IN;
export const isExhale = (k) => k === K.EXHALE || k === K.BREATHE_OUT || k === K.EXHALE_ALL;
export const isHold = (k) => k === K.HOLD_FULL || k === K.HOLD_EMPTY;

export const step = (kind, ms, label = kind.spoken) => ({ kind, ms, label });
export const fmtSec = (ms) => (ms % 1000 === 0 ? `${ms / 1000} से.` : `${(ms / 1000).toFixed(1)} से.`);
export const timingText = (steps) => steps.map((s) => `${s.label} ${fmtSec(s.ms)}`).join(' · ');

/** Special step labels (Hindi). */
export const LABELS = { longExhale: 'लंबी साँस छोड़ें', holdEmpty: 'रोकें, फेफड़े खाली', recovery: 'राहत की साँस लें', relax: 'ढीला छोड़ें' };

export const HYPER_DEFAULT = { breaths: 30, holdSeconds: 15 };
export function hyperRoundSteps({ breaths = 30, holdSeconds = 15 } = {}) {
  const out = [];
  for (let i = 0; i < breaths; i++) { out.push(step(K.BREATHE_IN, 1500)); out.push(step(K.BREATHE_OUT, 1000)); }
  out.push(step(K.EXHALE_ALL, 3000));
  out.push(step(K.HOLD_EMPTY, holdSeconds * 1000, LABELS.holdEmpty));
  out.push(step(K.INHALE, 4000, LABELS.recovery));
  out.push(step(K.EXHALE, 4000, LABELS.relax));
  return out;
}

const sighVariants = [
  { name: 'सामान्य (≈6 साँस/मिनट)', steps: [step(K.INHALE, 3000), step(K.TOP_UP, 1000), step(K.EXHALE, 6000, LABELS.longExhale)] },
  { name: 'धीमा (≈5 साँस/मिनट)', steps: [step(K.INHALE, 3500), step(K.TOP_UP, 1500), step(K.EXHALE, 7000, LABELS.longExhale)] },
];

function technique(t) {
  return { visual: 'circle', mode: 'timed', defaultMinutes: 5, defaultRounds: 3, needsWarning: false, ...t };
}

export const Techniques = {
  cyclicSigh: technique({
    id: 'cyclic_sigh', name: 'चक्रीय आह (Cyclic sighing)', purpose: Purpose.CALM,
    summary: 'नाक से दो बार साँस लें, फिर मुँह से लंबी, धीमी साँस छोड़ें। स्टैनफ़र्ड के 5 मिनट वाले अध्ययन में यही अभ्यास सबसे असरदार रहा।',
    howTo: 'नाक से गहरी साँस लें। फेफड़े भर जाने पर एक छोटी-सी दूसरी साँस और खींचें, ताकि वे पूरी तरह भर जाएँ। फिर मुँह से धीरे-धीरे तब तक साँस छोड़ें जब तक फेफड़े खाली न हो जाएँ। लगभग 5 मिनट तक दोहराएँ।',
    source: 'बालबन और साथी, 2023, Cell Reports Medicine; ह्यूबरमैन लैब न्यूज़लेटर "Breathwork Protocols"',
    variants: sighVariants,
  }),
  sighReset: technique({
    id: 'sigh_reset', name: 'शारीरिक आह – झटपट राहत (Physiological sigh)', purpose: Purpose.CALM,
    summary: 'दोहरी साँस वाली 1–3 आहें, जो एक मिनट से भी कम में उसी पल मन को शांत कर देती हैं।',
    howTo: 'नाक से बड़ी साँस लें, फिर एक छोटी साँस और भरें, और मुँह से पूरी साँस बाहर छोड़ दें। आमतौर पर एक से तीन आहें काफ़ी होती हैं।',
    source: 'ह्यूबरमैन लैब, "Tools for Managing Stress & Anxiety"; डॉ. जैक फ़ेल्डमैन वाला एपिसोड',
    variants: sighVariants.slice(0, 1), mode: 'rounds', defaultRounds: 3,
  }),
  box: technique({
    id: 'box', name: 'बॉक्स ब्रीदिंग (Box breathing)', purpose: Purpose.FOCUS,
    summary: 'बराबर समय तक साँस लें, रोकें, छोड़ें, रोकें। मन स्थिर रहता है और आप सजग भी रहते हैं।',
    howTo: 'नाक से साँस लें, भरे फेफड़ों के साथ रोकें, साँस छोड़ें, खाली फेफड़ों के साथ रोकें — हर चरण बराबर गिनती तक। भुजा की लंबाई अपने CO₂ सहनशीलता टेस्ट से चुनें: साँस छोड़ना 20 से. से कम → 3–4 से., 25–45 से. → 5–6 से., 50 से. से ज़्यादा → 8–10 से.।',
    source: 'बालबन और साथी, 2023 (प्रोटोकॉल तालिका); ह्यूबरमैन लैब, "How to Breathe Correctly"',
    visual: 'square',
    variants: [4, 5, 8, 3].map((s) => ({ name: `${s} सेकंड की भुजा`, steps: [step(K.INHALE, s * 1000), step(K.HOLD_FULL, s * 1000), step(K.EXHALE, s * 1000), step(K.HOLD_EMPTY, s * 1000)] })),
  }),
  extendedExhale: technique({
    id: 'extended_exhale', name: 'लंबी साँस छोड़ना (Extended exhale)', purpose: Purpose.CALM,
    summary: 'साँस छोड़ने का समय लेने से दोगुना, जिससे दिल की धड़कन धीमी होती है।',
    howTo: 'नाक से 4 की गिनती तक साँस लें, फिर मुँह या नाक से 8 की गिनती तक धीरे-धीरे छोड़ें। साँस लेने से लंबा साँस छोड़ना आपको शांति की ओर ले जाता है।',
    source: 'ह्यूबरमैन लैब, "Tools for Managing Stress & Anxiety" (साँस लेना बनाम छोड़ना और दिल की धड़कन)',
    variants: [
      { name: '4 अंदर · 8 बाहर', steps: [step(K.INHALE, 4000), step(K.EXHALE, 8000)] },
      { name: '3 अंदर · 6 बाहर', steps: [step(K.INHALE, 3000), step(K.EXHALE, 6000)] },
    ],
  }),
  resonance: technique({
    id: 'resonance', name: 'रेज़ोनेंस (संतुलित) श्वास (Resonance breathing)', purpose: Purpose.CALM,
    summary: 'लगभग 5.5–6 साँस प्रति मिनट की सहज, बराबर साँसें — यही दर हृदय-गति परिवर्तनशीलता (HRV) को सबसे ज़्यादा बढ़ाती है।',
    howTo: 'नाक से हल्के-हल्के साँस लें: 5.5 सेकंड अंदर, 5.5 सेकंड बाहर, बीच में बिना रुके।',
    source: 'लिन और साथी (5.5 साँस/मिनट), PMC8924557 के ज़रिए; ह्यूबरमैन लैब पर जेम्स नेस्टर',
    variants: [
      { name: '5.5 साँस/मिनट (5.5 · 5.5)', steps: [step(K.INHALE, 5500), step(K.EXHALE, 5500)] },
      { name: '6 साँस/मिनट (5 · 5)', steps: [step(K.INHALE, 5000), step(K.EXHALE, 5000)] },
    ],
    defaultMinutes: 10,
  }),
  fourSevenEight: technique({
    id: '478', name: '4-7-8 श्वास (4-7-8 breathing)', purpose: Purpose.SLEEP,
    summary: '4 तक साँस लें, 7 तक रोकें, 8 तक छोड़ें। लंबी रोक और लंबी साँस छोड़ने वाला यह क्रम रात को सुकून देता है।',
    howTo: 'नाक से चुपचाप 4 तक साँस लें, 7 तक रोकें, मुँह से 8 तक छोड़ें। 4 चक्रों से शुरू करें और धीरे-धीरे बढ़ाएँ।',
    source: 'डॉ. एंड्रयू वील (लंबी साँस छोड़ने की लोकप्रिय तकनीक; स्टैनफ़र्ड अध्ययन का हिस्सा नहीं)',
    variants: [{ name: '4 · 7 · 8', steps: [step(K.INHALE, 4000), step(K.HOLD_FULL, 7000), step(K.EXHALE, 8000)] }],
    defaultMinutes: 3,
  }),
  hyper: technique({
    id: 'cyclic_hyper', name: 'चक्रीय तेज़ श्वास (Cyclic hyperventilation)', purpose: Purpose.ENERGY,
    summary: 'तेज़, गहरी साँसों के राउंड, फिर खाली फेफड़ों के साथ रोक। एड्रेनालिन और सजगता बढ़ाता है (विम हॉफ़ श्वास जैसा)।',
    howTo: 'नाक से गहरी साँस लें और हवा को मुँह से अपने-आप निकल जाने दें। 25–30 बार दोहराएँ, फिर पूरी साँस छोड़ें और खाली फेफड़ों के साथ 15–30 से. रोकें। राउंड दोहराएँ।',
    source: 'बालबन और साथी, 2023 (30 साँस, 15 से. रोक, राउंड); ह्यूबरमैन लैब डेली ब्लूप्रिंट (20–25 साँस, 15–30 से. रोक)',
    variants: [{ name: '30 साँस · 15 से. रोक', steps: hyperRoundSteps() }],
    mode: 'rounds', defaultRounds: 3, needsWarning: true,
  }),
};
const T = Techniques;
export const ALL = [T.cyclicSigh, T.box, T.extendedExhale, T.resonance, T.fourSevenEight, T.sighReset, T.hyper];
export const byId = (id) => ALL.find((t) => t.id === id) || T.cyclicSigh;
export const DURATIONS = [1, 3, 5, 10, 15, 20];
export const HYPER_WARNING = {
  title: 'सुरक्षा सबसे पहले',
  lead: 'चक्रीय तेज़ श्वास से सिर हल्का लगना, झुनझुनी या बेहोशी हो सकती है।',
  points: [
    'इसे पानी में या पानी के पास, गाड़ी चलाते समय या खड़े होकर कभी न करें।',
    'किसी सुरक्षित जगह पर बैठ जाएँ या लेट जाएँ।',
    'चक्कर, बेहोशी या तबीयत ख़राब लगे तो तुरंत रुक जाएँ।',
    'अगर आप गर्भवती हैं, या आपको दिल की बीमारी, मिर्गी या दौरे, हाई ब्लड प्रेशर या पैनिक डिसऑर्डर है, तो इसका इस्तेमाल न करें।',
  ],
  confirm: 'मैंने इसे पढ़ लिया है और समझ लिया है',
};

export function cardTiming(t) {
  return t.id === T.hyper.id ? '30 साँस (1.5 से. अंदर · 1 से. बाहर) · पूरी साँस छोड़ें · 15 से. रोकें' : timingText(t.variants[0].steps);
}

/** Session configuration (mirrors SessionConfig). */
export function makeConfig(technique, { variantIndex = 0, minutes = technique.defaultMinutes, rounds = technique.defaultRounds, hyper = HYPER_DEFAULT } = {}) {
  const vi = Math.max(0, Math.min(variantIndex, technique.variants.length - 1));
  const variant = technique.variants[vi];
  const cycleSteps = technique.id === T.hyper.id ? hyperRoundSteps(hyper) : variant.steps;
  return { technique, variantIndex: vi, variant, minutes, rounds, hyper, cycleSteps };
}

/**
 * Whole cycles only. Timed sessions use as many complete cycles as fit in the chosen minutes (at least one),
 * so a session never ends mid-breath. Rounds sessions run exactly the requested number of cycles.
 */
export class Timeline {
  constructor(config) {
    this.config = config;
    const steps = config.cycleSteps;
    this.cycleMs = steps.reduce((a, s) => a + s.ms, 0);
    this.cycles = config.technique.mode === 'timed'
      ? Math.max(1, Math.floor((config.minutes * 60000) / this.cycleMs))
      : Math.max(1, config.rounds);
    this.segments = [];
    let t = 0;
    for (let c = 0; c < this.cycles; c++) {
      steps.forEach((s, i) => { this.segments.push({ step: s, startMs: t, endMs: t + s.ms, cycle: c, indexInCycle: i, cycleSize: steps.length }); t += s.ms; });
    }
    this.totalMs = this.cycles * this.cycleMs;
  }
  indexAt(elapsedMs) {
    if (elapsedMs >= this.totalMs) return this.segments.length - 1;
    let lo = 0, hi = this.segments.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.segments[mid].startMs <= elapsedMs) lo = mid; else hi = mid - 1; }
    return lo;
  }
}

export const Pacer = {
  MIN: 0.35, MID: 0.8, MAX: 1.0, FAST_LO: 0.5, FAST_HI: 0.9,
  ease(f) { const x = Math.min(1, Math.max(0, f)); return 0.5 - 0.5 * Math.cos(Math.PI * x); },
  scale(kind, fraction, hasTopUp) {
    const e = Pacer.ease(fraction);
    const lerp = (a, b) => a + (b - a) * e;
    switch (kind) {
      case K.INHALE: return lerp(Pacer.MIN, hasTopUp ? Pacer.MID : Pacer.MAX);
      case K.TOP_UP: return lerp(Pacer.MID, Pacer.MAX);
      case K.HOLD_FULL: return Pacer.MAX;
      case K.EXHALE: return lerp(Pacer.MAX, Pacer.MIN);
      case K.HOLD_EMPTY: return Pacer.MIN;
      case K.BREATHE_IN: return lerp(Pacer.FAST_LO, Pacer.FAST_HI);
      case K.BREATHE_OUT: return lerp(Pacer.FAST_HI, Pacer.FAST_LO);
      case K.EXHALE_ALL: return lerp(Pacer.FAST_LO, Pacer.MIN);
      default: return Pacer.MIN;
    }
  },
  /** Box dot in unit square (0,0 top-left): inhale up the left, hold across the top, exhale down the right, hold along the bottom. */
  boxPoint(sideIndex, fraction) {
    const f = Math.min(1, Math.max(0, fraction));
    switch (sideIndex % 4) {
      case 0: return [0, 1 - f];
      case 1: return [f, 0];
      case 2: return [1, f];
      default: return [1 - f, 1];
    }
  },
};

/** Vibration patterns for navigator.vibrate ([on, off, on, ...] ms). Same timings as the Android Haptics object. */
export function hapticPattern(kind) {
  if (kind === K.TOP_UP) return [60, 60, 60];
  if (isInhale(kind)) return kind === K.BREATHE_IN ? [40] : [220];
  if (isExhale(kind)) return kind === K.BREATHE_OUT ? [] : [90, 110, 90];
  return [30];
}

/** Tone cue parameters (Hz, ms) matching ToneSynth. */
export function toneFor(kind, ms) {
  const cap = (max) => Math.max(150, Math.min(ms, max));
  if (kind === K.TOP_UP) return { type: 'glide', f0: 440, f1: 554, ms: cap(1200) };
  if (isInhale(kind)) return { type: 'glide', f0: 220, f1: 440, ms: cap(2500) };
  if (isExhale(kind)) return { type: 'glide', f0: 440, f1: 196, ms: cap(3500) };
  return { type: 'tick' };
}

/** Visual/audio phase family: 'in', 'hold' or 'out'. */
export function phaseGroup(kind) { return isInhale(kind) ? 'in' : isExhale(kind) ? 'out' : 'hold'; }

/**
 * Eyes-closed audio plan for one phase. Inhale glides UP and exhale glides DOWN for the WHOLE phase,
 * so the length of each breath is audible; holds are a soft steady drone; the sigh top-up is a short higher chirp.
 * Without eyes-closed mode the original short, capped cue tones are used (toneFor).
 */
export function audioPlan(kind, ms, eyesClosed = true) {
  if (!eyesClosed) return toneFor(kind, ms);
  const fast = kind === K.BREATHE_IN || kind === K.BREATHE_OUT;
  if (kind === K.TOP_UP) return { type: 'chirp', f0: 587, f1: 880, ms };
  if (isInhale(kind)) return { type: 'inhale', f0: fast ? 262 : 220, f1: fast ? 392 : 440, ms, fast };
  if (isExhale(kind)) return { type: 'exhale', f0: fast ? 349 : 392, f1: fast ? 233 : 196, ms, fast };
  return { type: 'hold', f: kind === K.HOLD_FULL ? 330 : 165, ms };
}

/** Calm spoken phrasing for a step (Hindi, polite form). */
export function spokenFor(step) {
  switch (step.kind) {
    case K.INHALE: return step.label === LABELS.recovery ? 'राहत की साँस लीजिए' : 'साँस अंदर लीजिए';
    case K.TOP_UP: return 'थोड़ा और';
    case K.HOLD_FULL: return 'रोकिए';
    case K.HOLD_EMPTY: return step.label === LABELS.holdEmpty ? 'रोकिए, फेफड़े खाली' : 'रोकिए';
    case K.EXHALE: return step.label === LABELS.relax ? 'ढीला छोड़िए, साँस छोड़िए' : step.label === LABELS.longExhale ? 'धीरे-धीरे लंबी साँस छोड़िए' : 'साँस बाहर छोड़िए';
    case K.EXHALE_ALL: return 'पूरी साँस बाहर छोड़िए';
    case K.BREATHE_IN: return 'अंदर';
    case K.BREATHE_OUT: return 'बाहर';
    default: return step.label;
  }
}

/** Spoken round announcement for rounds-based sessions (null when there is nothing to say). */
export function roundAnnouncement(cycle, cycles) {
  if (cycles <= 1) return null;
  return cycle === cycles - 1 ? 'आख़िरी राउंड' : `${cycles} में से राउंड ${cycle + 1}`;
}

export const formatClock = (ms) => { const s = Math.floor((ms + 999) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const ceilSeconds = (ms) => Math.floor((ms + 999) / 1000);

export function sessionSummary(tl) {
  const t = tl.config.technique;
  const unit = t.mode === 'rounds' ? 'राउंड' : 'साँस';
  return `सत्र: ${tl.cycles} ${unit} · ${formatClock(tl.totalMs)}${t.mode === 'timed' ? ' (केवल पूरी साँसें)' : ''}`;
}

export const Streaks = {
  /** Consecutive days with any session, ending today or yesterday. */
  current(days, today) {
    const set = days instanceof Set ? days : new Set(days);
    let d = set.has(today) ? today : today - 1;
    let n = 0;
    while (set.has(d)) { n++; d--; }
    return n;
  },
};

export const History = {
  encode: (e) => `${e.epochDay}|${e.techniqueId}|${e.seconds}|${e.completed ? 1 : 0}`,
  decode(s) {
    const p = String(s).split('|');
    if (p.length !== 4) return null;
    const day = Number(p[0]), secs = Number(p[2]);
    if (!Number.isInteger(day) || !Number.isInteger(secs)) return null;
    return { epochDay: day, techniqueId: p[1], seconds: secs, completed: p[3] === '1' };
  },
};

/** Local calendar day number (days since 1970-01-01 in local time), like LocalDate.toEpochDay(). */
export function epochDay(date = new Date()) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
export function dayToDate(day) { const d = new Date(day * 86400000); return d.toISOString().slice(0, 10); }

export const LEAD_IN_MS = 3000;

/** Drives a timeline against an injectable monotonic clock (performance.now in the browser). Drift-free: state is derived from clock - anchor. */
export class SessionController {
  constructor({ clock, cues = {}, onComplete = () => {}, onChange = () => {} }) {
    this.clock = clock; this.cues = cues; this.onComplete = onComplete; this.onChange = onChange;
    this.state = { run: 'idle', timeline: null, elapsedMs: 0, leadInMs: 0, index: 0, completed: false };
    this.anchor = 0; this.lastHold = -1; this.halfDone = false;
  }
  _cue(name, ...a) { try { this.cues[name]?.(...a); } catch (e) { /* cues must never break timing */ } }
  _set(patch) { this.state = { ...this.state, ...patch }; this.onChange(this.state); }
  get segment() { return this.state.timeline?.segments[this.state.index] ?? null; }
  get totalMs() { return this.state.timeline?.totalMs ?? 0; }
  get remainingMs() { return Math.max(0, this.totalMs - this.state.elapsedMs); }
  get progress() { return this.totalMs ? Math.min(1, Math.max(0, this.state.elapsedMs / this.totalMs)) : 0; }
  get phaseElapsedMs() { const s = this.segment; return s ? Math.min(s.step.ms, Math.max(0, this.state.elapsedMs - s.startMs)) : 0; }
  get phaseRemainingMs() { const s = this.segment; return s ? s.step.ms - this.phaseElapsedMs : 0; }
  get phaseFraction() { const s = this.segment; return s ? this.phaseElapsedMs / s.step.ms : 0; }
  get isActive() { return ['lead_in', 'running', 'paused'].includes(this.state.run); }

  start(config, leadInMs = LEAD_IN_MS) {
    this._cue('stop');
    const tl = new Timeline(config);
    this.lastHold = -1; this.halfDone = false;
    this.anchor = this.clock() + leadInMs;
    this._set({ run: leadInMs > 0 ? 'lead_in' : 'running', timeline: tl, elapsedMs: 0, leadInMs, index: 0, completed: false });
    this._cue('onStart', tl);
    if (leadInMs > 0) this._cue('onLeadInTick', ceilSeconds(leadInMs)); else this._cue('onSegment', tl.segments[0], 0);
  }
  tick() {
    const s = this.state, tl = s.timeline;
    if (!tl) return;
    if (s.run === 'lead_in') {
      const left = this.anchor - this.clock();
      if (left > 0) {
        const prev = ceilSeconds(s.leadInMs), sec = ceilSeconds(left);
        this._set({ leadInMs: left });
        if (sec !== prev) this._cue('onLeadInTick', sec);
      } else {
        this._set({ run: 'running', leadInMs: 0, elapsedMs: 0, index: 0 });
        this._cue('onSegment', tl.segments[0], 0);
        this._advance();
      }
    } else if (s.run === 'running') this._advance();
  }
  _advance() {
    const s = this.state, tl = s.timeline;
    const elapsed = Math.max(0, this.clock() - this.anchor);
    if (elapsed >= tl.totalMs) { this._finish(true); return; }
    const idx = tl.indexAt(elapsed);
    this._set({ elapsedMs: elapsed, index: idx });
    const seg = tl.segments[idx];
    if (idx !== s.index) this._cue('onSegment', seg, elapsed - seg.startMs);
    if (!this.halfDone && elapsed >= tl.totalMs / 2) { this.halfDone = true; this._cue('onHalfway', tl); }
    if (isHold(seg.step.kind)) {
      const sec = Math.floor((elapsed - seg.startMs) / 1000);
      const key = seg.startMs * 1000 + sec;
      if (sec > 0 && key !== this.lastHold) { this.lastHold = key; this._cue('onHoldSecond', seg, sec); }
    }
  }
  pause() {
    const s = this.state;
    if (s.run !== 'running' && s.run !== 'lead_in') return;
    const patch = { run: 'paused' };
    if (s.run === 'running') patch.elapsedMs = Math.min(s.timeline.totalMs, Math.max(0, this.clock() - this.anchor));
    else { patch.elapsedMs = 0; patch.leadInMs = 0; }
    this._set(patch);
    this._cue('stop');
  }
  resume() {
    const s = this.state;
    if (s.run !== 'paused') return;
    this.anchor = this.clock() - s.elapsedMs;
    this._set({ run: 'running', leadInMs: 0 });
    this._cue('onResume', s.timeline);
    const seg = this.segment; if (seg) this._cue('onSegment', seg, s.elapsedMs - seg.startMs);
  }
  end() { if (this.isActive) this._finish(false); }
  reset() { this._cue('stop'); this._set({ run: 'idle', timeline: null, elapsedMs: 0, leadInMs: 0, index: 0, completed: false }); }
  _finish(completed) {
    const s = this.state;
    const elapsed = completed ? s.timeline.totalMs : s.elapsedMs;
    this._set({ run: 'finished', elapsedMs: elapsed, completed });
    this._cue('stop');
    if (completed) this._cue('onFinished');
    this.onComplete(this.state);
  }
}
