// Eyes-closed audio plan, spoken phrasing and the controller's new cue hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Techniques as T, PhaseKind as K, audioPlan, spokenFor, roundAnnouncement, phaseGroup, makeConfig, SessionController, Timeline } from '../../docs/js/domain.js';

test('eyes-closed: inhale glides up and exhale glides down for the WHOLE phase', () => {
  for (const ms of [3000, 4000, 5500, 8000, 12000]) {
    const i = audioPlan(K.INHALE, ms, true), e = audioPlan(K.EXHALE, ms, true);
    assert.equal(i.type, 'inhale'); assert.equal(i.ms, ms); assert.ok(i.f1 > i.f0);
    assert.equal(e.type, 'exhale'); assert.equal(e.ms, ms); assert.ok(e.f1 < e.f0);
  }
  assert.equal(audioPlan(K.EXHALE_ALL, 3000).type, 'exhale');
  const c = audioPlan(K.TOP_UP, 1000); assert.equal(c.type, 'chirp'); assert.ok(c.f0 > audioPlan(K.INHALE, 3000).f1, 'chirp is higher than the inhale');
  assert.equal(audioPlan(K.HOLD_FULL, 4000).type, 'hold'); assert.equal(audioPlan(K.HOLD_EMPTY, 15000).ms, 15000);
  assert.ok(audioPlan(K.HOLD_FULL, 4000).f > audioPlan(K.HOLD_EMPTY, 4000).f);
  assert.ok(audioPlan(K.BREATHE_IN, 1500).fast);
});
test('without eyes-closed mode the original capped cue tones are used', () => {
  assert.equal(audioPlan(K.INHALE, 10000, false).ms, 2500);
  assert.equal(audioPlan(K.HOLD_FULL, 4000, false).type, 'tick');
});
test('calm spoken phrasing and round announcements', () => {
  const [i, top, ex] = T.cyclicSigh.variants[0].steps;
  assert.equal(spokenFor(i), 'साँस अंदर लीजिए'); assert.equal(spokenFor(top), 'थोड़ा और'); assert.equal(spokenFor(ex), 'धीरे-धीरे लंबी साँस छोड़िए');
  const box = T.box.variants[0].steps; assert.deepEqual(box.map(spokenFor), ['साँस अंदर लीजिए', 'रोकिए', 'साँस बाहर छोड़िए', 'रोकिए']);
  const hyper = T.hyper.variants[0].steps;
  assert.equal(spokenFor(hyper.at(-4)), 'पूरी साँस बाहर छोड़िए'); assert.equal(spokenFor(hyper.at(-3)), 'रोकिए, फेफड़े खाली');
  assert.equal(spokenFor(hyper.at(-2)), 'राहत की साँस लीजिए'); assert.equal(spokenFor(hyper.at(-1)), 'ढीला छोड़िए, साँस छोड़िए');
  assert.equal(roundAnnouncement(0, 3), '3 में से राउंड 1'); assert.equal(roundAnnouncement(2, 3), 'आख़िरी राउंड'); assert.equal(roundAnnouncement(0, 1), null);
  assert.equal(phaseGroup(K.TOP_UP), 'in'); assert.equal(phaseGroup(K.EXHALE_ALL), 'out'); assert.equal(phaseGroup(K.HOLD_EMPTY), 'hold');
});
test('controller passes phase offset (for resume), hold seconds and a single halfway cue', () => {
  let now = 0; const ev = [];
  const c = new SessionController({ clock: () => now, cues: {
    onStart: (tl) => ev.push(['start', tl.totalMs]), onSegment: (s, off) => ev.push(['seg', s.step.kind.id, off]),
    onHoldSecond: (s, sec) => ev.push(['holdsec', sec]), onHalfway: () => ev.push(['half']), onResume: () => ev.push(['resume']) } });
  c.start(makeConfig(T.box, { minutes: 1 }), 0);
  assert.deepEqual(ev[0], ['start', 48000]); assert.deepEqual(ev[1], ['seg', 'INHALE', 0]);
  for (let t = 0; t < 30000; t += 50) { now += 50; c.tick(); }
  assert.equal(ev.filter((e) => e[0] === 'half').length, 1);
  assert.deepEqual(ev.filter((e) => e[0] === 'holdsec').slice(0, 3).map((e) => e[1]), [1, 2, 3]);
  // pause 1.5 s into an exhale, resume: segment cue is re-sent with the offset so the tone covers only what's left
  while (c.segment.step.kind !== K.EXHALE) { now += 50; c.tick(); }
  now += 1500; c.tick(); c.pause(); now += 10000; ev.length = 0; c.resume();
  assert.deepEqual(ev[0], ['resume']); assert.equal(ev[1][1], 'EXHALE'); assert.ok(Math.abs(ev[1][2] - 1500) <= 50, `offset ${ev[1][2]}`);
});
test('session totals unchanged by audio work', () => {
  assert.equal(new Timeline(makeConfig(T.box)).totalMs, 288000);
});

test('Hindi text: every technique name, summary, how-to, variant and step label is in Devanagari', async () => {
  const { ALL, HYPER_WARNING, Purpose } = await import('../../docs/js/domain.js');
  const deva = /[\u0900-\u097F]/;
  for (const t of ALL) {
    for (const f of ['name', 'summary', 'howTo', 'source', 'purpose']) assert.ok(deva.test(t[f]), `${t.id}.${f}: ${t[f]}`);
    for (const v of t.variants) { assert.ok(deva.test(v.name) || /^[\d ·]+$/.test(v.name), v.name); for (const st of v.steps) assert.ok(deva.test(st.label), st.label); }
  }
  assert.ok(Object.values(Purpose).every((p) => deva.test(p)));
  assert.ok([HYPER_WARNING.title, HYPER_WARNING.lead, HYPER_WARNING.confirm, ...HYPER_WARNING.points].every((x) => deva.test(x)));
});
