// Mirrors app/src/test/.../TimingTest.kt and ControllerTest.kt from the Android app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Techniques as T, ALL, PhaseKind as K, hyperRoundSteps, Timeline, makeConfig, Pacer, Streaks, History,
  hapticPattern, toneFor, formatClock, SessionController, isHold, epochDay, sessionSummary } from '../../docs/js/domain.js';

const kinds = (t, v = 0) => t.variants[v].steps.map((s) => s.kind);
const ms = (t, v = 0) => t.variants[v].steps.map((s) => s.ms);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const total = (t, minutes = 5, v = 0, rounds = t.defaultRounds) => new Timeline(makeConfig(t, { variantIndex: v, minutes, rounds }));

test('cyclic sigh pattern', () => {
  assert.deepEqual(kinds(T.cyclicSigh), [K.INHALE, K.TOP_UP, K.EXHALE]);
  assert.deepEqual(ms(T.cyclicSigh), [3000, 1000, 6000]);
  assert.deepEqual(ms(T.cyclicSigh, 1), [3500, 1500, 7000]);
  for (const v of T.cyclicSigh.variants) assert.ok(v.steps[2].ms > v.steps[0].ms + v.steps[1].ms);
});
test('box patterns have equal sides', () => {
  assert.deepEqual(kinds(T.box), [K.INHALE, K.HOLD_FULL, K.EXHALE, K.HOLD_EMPTY]);
  assert.deepEqual(T.box.variants.map((v) => { const d = [...new Set(v.steps.map((s) => s.ms))]; assert.equal(d.length, 1); return d[0]; }), [4000, 5000, 8000, 3000]);
});
test('extended exhale is twice inhale', () => {
  for (const v of T.extendedExhale.variants) assert.equal(v.steps[0].ms * 2, v.steps[1].ms);
  assert.deepEqual(ms(T.extendedExhale), [4000, 8000]);
  assert.deepEqual(ms(T.extendedExhale, 1), [3000, 6000]);
});
test('resonance rate', () => {
  const c = sum(ms(T.resonance)); assert.equal(c, 11000); assert.ok(Math.abs(60000 / c - 5.4545) < 0.01);
  assert.equal(60000 / sum(ms(T.resonance, 1)), 6);
});
test('4-7-8', () => assert.deepEqual(ms(T.fourSevenEight), [4000, 7000, 8000]));
test('hyperventilation round', () => {
  const s = hyperRoundSteps({ breaths: 30, holdSeconds: 15 });
  assert.equal(s.filter((x) => x.kind === K.BREATHE_IN).length, 30);
  assert.equal(s.filter((x) => x.kind === K.BREATHE_OUT).length, 30);
  assert.equal(s[61].kind, K.HOLD_EMPTY); assert.equal(s[61].ms, 15000);
  assert.equal(sum(s.map((x) => x.ms)), 30 * 2500 + 3000 + 15000 + 8000);
  assert.equal(sum(hyperRoundSteps({ breaths: 25, holdSeconds: 30 }).map((x) => x.ms)), 25 * 2500 + 3000 + 30000 + 8000);
});
test('exact session totals (same numbers as the Kotlin tests)', () => {
  assert.equal(total(T.cyclicSigh).totalMs, 300000); assert.equal(total(T.cyclicSigh).cycles, 30);
  assert.equal(total(T.box).totalMs, 288000); assert.equal(total(T.box).cycles, 18);
  assert.equal(total(T.box, 1).totalMs, 48000);
  assert.equal(total(T.box, 1, 2).totalMs, 32000);
  assert.equal(total(T.extendedExhale).totalMs, 300000);
  assert.equal(total(T.resonance, 10).totalMs, 594000);
  assert.equal(total(T.resonance, 20).totalMs, 1199000);
  assert.equal(total(T.fourSevenEight, 3).totalMs, 171000);
  assert.equal(total(T.sighReset).totalMs, 30000);
  assert.equal(total(T.sighReset, 5, 0, 1).totalMs, 10000);
  assert.equal(total(T.hyper).totalMs, 303000);
  assert.equal(total(T.hyper, 5, 0, 5).totalMs, 505000);
  assert.equal(formatClock(total(T.box).totalMs), '4:48');
  assert.equal(sessionSummary(total(T.box)), 'सत्र: 18 साँस · 4:48 (केवल पूरी साँसें)');
  assert.equal(sessionSummary(total(T.sighReset)), 'सत्र: 3 राउंड · 0:30');
});
test('every technique and duration never exceeds the chosen time', () => {
  for (const t of ALL.filter((x) => x.mode === 'timed')) for (let v = 0; v < t.variants.length; v++) for (const m of [1, 3, 5, 10, 15, 20, 37]) {
    const tl = total(t, m, v);
    assert.ok(tl.totalMs <= m * 60000 || tl.cycles === 1, `${t.id} ${m}`);
    assert.ok(m * 60000 - tl.totalMs < tl.cycleMs, `${t.id} ${m}`);
    assert.equal(sum(tl.segments.map((s) => s.step.ms)), tl.totalMs);
    assert.equal(tl.segments.at(-1).endMs, tl.totalMs);
    for (let i = 1; i < tl.segments.length; i++) assert.equal(tl.segments[i - 1].endMs, tl.segments[i].startMs);
  }
});
test('indexAt finds segments', () => {
  const tl = total(T.box, 1);
  assert.equal(tl.indexAt(0), 0); assert.equal(tl.indexAt(3999), 0); assert.equal(tl.indexAt(4000), 1);
  assert.equal(tl.indexAt(16000), 4); assert.equal(tl.indexAt(99999), tl.segments.length - 1);
});
test('pacer shapes', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  close(Pacer.scale(K.INHALE, 0, true), Pacer.MIN); close(Pacer.scale(K.INHALE, 1, true), Pacer.MID);
  close(Pacer.scale(K.TOP_UP, 1, true), Pacer.MAX); close(Pacer.scale(K.INHALE, 1, false), Pacer.MAX);
  close(Pacer.scale(K.EXHALE, 1, false), Pacer.MIN);
  assert.deepEqual(Pacer.boxPoint(0, 0), [0, 1]); assert.deepEqual(Pacer.boxPoint(0, 1), [0, 0]);
  assert.deepEqual(Pacer.boxPoint(1, 1), [1, 0]); assert.deepEqual(Pacer.boxPoint(2, 1), [1, 1]); assert.deepEqual(Pacer.boxPoint(3, 1), [0, 1]);
});
test('tones and haptics', () => {
  assert.equal(toneFor(K.INHALE, 2000).ms, 2000); assert.equal(toneFor(K.INHALE, 10000).ms, 2500);
  assert.equal(toneFor(K.EXHALE, 6000).ms, 3500); assert.equal(toneFor(K.HOLD_FULL, 4000).type, 'tick');
  assert.equal(toneFor(K.INHALE, 1).f0, 220); assert.equal(toneFor(K.EXHALE, 1).f1, 196);
  assert.deepEqual(hapticPattern(K.INHALE), [220]); assert.deepEqual(hapticPattern(K.EXHALE), [90, 110, 90]);
  assert.deepEqual(hapticPattern(K.BREATHE_OUT), []); assert.deepEqual(hapticPattern(K.HOLD_EMPTY), [30]);
});
test('streaks and history codec', () => {
  assert.equal(Streaks.current(new Set([10, 9, 8, 5]), 10), 3); assert.equal(Streaks.current(new Set([9, 8, 7]), 10), 3);
  assert.equal(Streaks.current(new Set([7]), 10), 0);
  const e = { epochDay: 20000, techniqueId: 'box', seconds: 288, completed: true };
  assert.deepEqual(History.decode(History.encode(e)), e); assert.equal(History.decode('bad'), null);
  assert.equal(epochDay(new Date(1970, 0, 2, 23, 30)), 1);
});

// ---- Controller (mirrors ControllerTest.kt) ----
function harness() {
  const h = { now: 0, seen: [], holds: 0, finished: 0, done: null };
  h.c = new SessionController({ clock: () => h.now, cues: {
    onSegment: (s) => h.seen.push(s.step.kind), onHoldSecond: () => h.holds++, onFinished: () => h.finished++ },
    onComplete: (s) => { h.done = s; } });
  h.run = (dur, stepMs = 100) => { for (let t = 0; t < dur; t += stepMs) { h.now += stepMs; h.c.tick(); } };
  return h;
}
test('box runs in order with lead-in and finishes', () => {
  const h = harness();
  h.c.start(makeConfig(T.box, { minutes: 1 }));
  assert.equal(h.c.state.run, 'lead_in');
  h.run(3000); assert.equal(h.c.state.run, 'running');
  h.run(48000);
  assert.equal(h.c.state.run, 'finished'); assert.ok(h.c.state.completed);
  assert.equal(h.seen.length, 12);
  assert.deepEqual(h.seen.slice(0, 4), [K.INHALE, K.HOLD_FULL, K.EXHALE, K.HOLD_EMPTY]);
  assert.equal(h.finished, 1); assert.equal(h.done.elapsedMs, 48000);
  assert.equal(h.holds, 3 * 2 * 3);
});
test('pause freezes time', () => {
  const h = harness();
  h.c.start(makeConfig(T.extendedExhale, { minutes: 1 }), 0);
  h.run(5000); const e = h.c.state.elapsedMs;
  h.c.pause(); h.now += 60000; h.c.tick(); assert.equal(h.c.state.elapsedMs, e);
  h.c.resume(); h.run(1000); assert.equal(h.c.state.elapsedMs, e + 1000);
  assert.equal(h.c.segment.step.kind, K.EXHALE);
});
test('end early records elapsed', () => {
  const h = harness();
  h.c.start(makeConfig(T.cyclicSigh, { minutes: 5 }), 0);
  h.run(20000); h.c.end();
  assert.equal(h.done.completed, false); assert.equal(h.done.elapsedMs, 20000); assert.equal(h.finished, 0);
});
test('late ticks do not drift', () => {
  const h = harness();
  h.c.start(makeConfig(T.resonance, { minutes: 1 }), 0);
  h.now += 16600; h.c.tick();
  assert.equal(h.c.state.elapsedMs, 16600); assert.equal(h.c.segment.step.kind, K.EXHALE); assert.equal(h.c.state.index, 3);
});
test('hyper rounds use selected breaths and hold', () => {
  const tl = new Timeline(makeConfig(T.hyper, { rounds: 2, hyper: { breaths: 20, holdSeconds: 30 } }));
  assert.equal(tl.totalMs, 2 * (20 * 2500 + 3000 + 30000 + 8000));
  assert.ok(isHold(tl.segments[41].step.kind));
});
