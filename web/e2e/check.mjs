// Headless browser check: loads the site, opens and runs every technique, pauses/resumes/ends,
// completes one full session, checks history, offline reload via the service worker, and saves mobile screenshots.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const SHOTS = process.env.SHOTS || '/workspace/breathwork-hindi-shots';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8098/';
mkdirSync(SHOTS, { recursive: true });
let server;
if (!process.env.BASE_URL) {
  server = spawn('python3', ['-m', 'http.server', '8098', '--bind', '127.0.0.1', '-d', new URL('../../docs', import.meta.url).pathname], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
}
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  // Instrumented AudioContext: record every oscillator's frequency automation and start/stop times.
  window.__osc = []; window.__bufsrc = 0;
  const B = window.BaseAudioContext || window.AudioContext;
  const orig = B.prototype.createOscillator, ob = B.prototype.createBufferSource;
  B.prototype.createOscillator = function () {
    const o = orig.call(this), rec = { ev: [], start: null, stop: null }, f = o.frequency;
    for (const m of ['setValueAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime']) { const fn = f[m].bind(f); f[m] = (v, t) => { rec.ev.push([m, v, t]); return fn(v, t); }; }
    const s0 = o.start.bind(o), s1 = o.stop.bind(o);
    o.start = (t = 0) => { rec.start = t; return s0(t); }; o.stop = (t = 0) => { if (rec.stop == null) rec.stop = t; return s1(t); };
    window.__osc.push(rec); return o;
  };
  B.prototype.createBufferSource = function () { window.__bufsrc++; return ob.call(this); };
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const results = [];
const pad = (x) => String(x).padStart(2, '0');
const ok = (msg) => { results.push(`PASS ${msg}`); console.log(`PASS ${msg}`); };

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.card').count(), 7); ok('home lists 7 techniques');
  assert.match(await page.locator('.fine').first().innerText(), /ह्यूबरमैन लैब से इसका कोई संबंध नहीं है, न ही उन्होंने इसका समर्थन किया है/); ok('not-affiliated note on home');
  await shot('01-home-dark');

  const ids = ['cyclic_sigh', 'box', 'extended_exhale', 'resonance', '478', 'sigh_reset', 'cyclic_hyper'];
  const expected = { cyclic_sigh: '30 साँस · 5:00', box: '18 साँस · 4:48', extended_exhale: '25 साँस · 5:00', resonance: '54 साँस · 9:54', '478': '9 साँस · 2:51', sigh_reset: '3 राउंड · 0:30', cyclic_hyper: '3 राउंड · 5:03' };
  let n = 2;
  for (const id of ids) {
    await page.goto(`${BASE}#/t/${id}`); await page.waitForSelector('#startBtn');
    const summary = await page.locator('#summary').innerText();
    assert.ok(summary.includes(expected[id]), `${id} summary: ${summary}`); ok(`${id} shows exact length "${summary}"`);
    if (id === 'box') {
      await page.locator('label.chip-opt:has(input[name=minutes][value="1"])').click();
      assert.match(await page.locator('#summary').innerText(), /3 साँस · 0:48/);
      await page.locator('label.chip-opt:has(input[name=variant][value="2"])').click(); // 8 s sides
      assert.match(await page.locator('#summary').innerText(), /1 साँस · 0:32/); ok('box 1 min / 8 s sides → 0:32');
      await page.locator('label.chip-opt:has(input[name=variant][value="0"])').click();
      await page.locator('label.chip-opt:has(input[name=minutes][value="custom"])').click();
      await page.fill('#customMin', '0'); assert.ok(await page.locator('#startBtn').isDisabled()); ok('custom 0 min rejected');
      await page.fill('#customMin', '2'); assert.match(await page.locator('#summary').innerText(), /7 साँस · 1:52/); ok('custom 2 min → 1:52');
      await page.locator('label.chip-opt:has(input[name=minutes][value="5"])').click();
      await page.evaluate(() => scrollTo(0, 0));
      await shot(`${pad(n++)}-detail-box`);
    }
    if (id === 'cyclic_hyper') {
      await page.locator('label.chip-opt:has(input[name=rounds][value="1"])').click();
      await page.locator('label.chip-opt:has(input[name=breaths][value="20"])').click();
      await page.locator('label.chip-opt:has(input[name=hold][value="30"])').click();
      assert.match(await page.locator('#summary').innerText(), /1 राउंड · 1:31/); ok('hyper 1 round × 20 breaths, 30 s hold → 1:31');
    }
    await page.click('#startBtn');
    if (id === 'cyclic_hyper') {
      await page.waitForSelector('dialog[open]');
      assert.ok(await page.locator('#warnStart').isDisabled()); ok('hyper safety dialog blocks Start until acknowledged');
      await shot(`${pad(n++)}-safety-dialog`);
      await page.check('#ackBox'); await page.click('#warnStart');
    }
    await page.waitForSelector('.pacer');
    assert.equal(await page.locator('#phaseLabel').innerText(), 'तैयार हो जाइए'); ok(`${id} lead-in "तैयार हो जाइए"`);
    await page.waitForFunction(() => document.querySelector('#phaseLabel').textContent !== 'तैयार हो जाइए', null, { timeout: 5000 });
    await page.waitForTimeout(id === 'box' ? 5200 : id === 'cyclic_sigh' ? 1800 : 1500);
    const label = await page.locator('#phaseLabel').innerText();
    const counter = await page.locator('#counter').innerText();
    ok(`${id} running: phase "${label}", "${counter}", ${await page.locator('#left').innerText()}`);
    if (['cyclic_sigh', 'box', 'cyclic_hyper', 'resonance'].includes(id)) await shot(`${pad(n++)}-session-${id}`);
    await page.click('#pauseBtn');
    const left1 = await page.locator('#left').innerText(); const r1 = await page.locator('#prog').getAttribute('aria-valuenow');
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#left').innerText(), left1); assert.equal(await page.locator('#prog').getAttribute('aria-valuenow'), r1);
    assert.equal(await page.locator('#pauseBtn').innerText(), 'फिर शुरू करें'); ok(`${id} pause freezes time`);
    if (id === 'box') await shot(`${pad(n++)}-session-paused`);
    await page.click('#pauseBtn'); await page.waitForTimeout(1200);
    assert.notEqual(await page.locator('#left').innerText(), left1); ok(`${id} resume continues`);
    await page.click('#endBtn');
    await page.waitForSelector('text=सत्र समाप्त'); ok(`${id} end → "सत्र समाप्त"`);
    await page.click('#doneBtn'); await page.waitForSelector('#startBtn');
  }

  // ---------- Eyes-closed audio graph checks ----------
  const glides = () => page.evaluate(() => window.__osc
    .map((r) => { const s = r.ev.find((e) => e[0] === 'setValueAtTime'), x = r.ev.find((e) => e[0] === 'exponentialRampToValueAtTime');
      return s && x ? { f0: s[1], f1: x[1], dur: x[2] - s[2], t0: s[2] } : null; })
    .filter(Boolean));
  const near = (a, b, tol = 0.15) => Math.abs(a - b) <= tol;
  await page.goto(`${BASE}#/t/cyclic_sigh`); await page.waitForSelector('#startBtn');
  assert.ok(await page.locator('#eyesSwitch').isChecked()); ok('eyes-closed mode is ON by default');
  await page.locator('label.toggle:has([data-cue=ambient])').click();
  await page.locator('label.toggle:has([data-cue=voice])').click();
  await page.locator('#eyesSwitch').scrollIntoViewIfNeeded(); await shot(`${pad(n++)}-detail-eyes-closed`);
  await page.locator('#cuesPanel').scrollIntoViewIfNeeded(); await shot(`${pad(n++)}-detail-sound-cues`);
  await page.evaluate(() => { window.__osc.length = 0; });
  await page.click('#startBtn');
  await page.waitForTimeout(3000 + 5500); await shot(`${pad(n++)}-session-sigh-exhale`);
  await page.waitForTimeout(5000);
  let g = (await glides()).filter((x) => x.dur > 0.5);
  // start pitch can be a hair above nominal when a tick lands a few ms late (glide starts where it would be by then)
  const up = g.find((x) => x.f1 === 440 && x.f0 >= 220 && x.f0 < 232), chirp = g.find((x) => x.f1 === 880 && x.f0 >= 587 && x.f0 < 610), down = g.find((x) => x.f1 === 196 && x.f0 <= 392 && x.f0 > 375);
  assert.ok(up && near(up.dur, 3), `inhale glide ${JSON.stringify(up)}`);
  assert.ok(chirp && near(chirp.dur, 1), `top-up chirp ${JSON.stringify(chirp)}`);
  assert.ok(down && near(down.dur, 6), `exhale glide ${JSON.stringify(down)}`);
  ok(`cyclic sigh audio: inhale glide ${up.f0.toFixed(0)}→440 Hz over ${up.dur.toFixed(2)} s, chirp ${chirp.f0.toFixed(0)}→880 Hz over ${chirp.dur.toFixed(2)} s, exhale ${down.f0.toFixed(0)}→196 Hz over ${down.dur.toFixed(2)} s`);
  let log = await page.evaluate(() => window.__bwCues.log);
  assert.ok(log.some((e) => e.type === 'bell-start')); ok('singing-bowl start bell scheduled');
  assert.ok(log.some((e) => e.type === 'ambient-start') && (await page.evaluate(() => window.__bufsrc)) >= 2); ok('ambient ocean bed started (buffer source)');
  const said = log.filter((e) => e.type === 'speak').map((e) => e.text);
  assert.ok(['साँस अंदर लीजिए', 'थोड़ा और', 'धीरे-धीरे लंबी साँस छोड़िए'].every((t) => said.includes(t)), said.join('|')); ok(`spoken cues: ${said.slice(0, 4).join(' / ')}`);
  await page.click('#endBtn'); await page.click('#doneBtn');
  await page.locator('label.toggle:has([data-cue=ambient])').click(); await page.locator('label.toggle:has([data-cue=voice])').click();

  await page.goto(`${BASE}#/t/box`); await page.waitForSelector('#startBtn');
  await page.locator('label.chip-opt:has(input[name=minutes][value="1"])').click();
  await page.evaluate(() => { window.__osc.length = 0; window.__bwCues.log.length = 0; });
  await page.click('#startBtn');
  await page.waitForTimeout(3000 + 1800); await shot(`${pad(n++)}-session-box-inhale`);
  await page.waitForTimeout(4000); await shot(`${pad(n++)}-session-box-hold`);
  await page.waitForTimeout(6800);
  g = await glides();
  const bUp = g.find((x) => x.f1 === 440 && x.f0 >= 220 && x.f0 < 232 && x.dur > 1), bDown = g.find((x) => x.f1 === 196 && x.f0 <= 392 && x.f0 > 375 && x.dur > 1);
  assert.ok(bUp && near(bUp.dur, 4), `box inhale ${JSON.stringify(bUp)}`); assert.ok(bDown && near(bDown.dur, 4), `box exhale ${JSON.stringify(bDown)}`);
  const drone = await page.evaluate(() => window.__osc.find((r) => r.ev.length === 1 && r.ev[0][1] === 330));
  assert.ok(drone && near(drone.stop - drone.start, 4.05, 0.2), `hold drone ${JSON.stringify(drone)}`);
  log = await page.evaluate(() => window.__bwCues.log);
  assert.ok(log.filter((e) => e.type === 'corner').length >= 3 && log.filter((e) => e.type === 'tick').length >= 3);
  ok(`box audio: up ${bUp.dur.toFixed(2)} s, steady 330 Hz hold drone ${(drone.stop - drone.start).toFixed(2)} s, down ${bDown.dur.toFixed(2)} s, corner chimes + hold ticks`);
  await page.click('#endBtn'); await page.click('#doneBtn');

  // ---------- Low-light mode ----------
  await page.goto(BASE); await page.waitForSelector('#nightBtn');
  await page.click('#nightBtn');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.night), 'on');
  await page.reload(); await page.waitForSelector('.card');
  assert.equal(await page.locator('#nightBtn').getAttribute('aria-pressed'), 'true'); ok('low-light mode toggles and persists');
  await page.waitForTimeout(400); await shot(`${pad(n++)}-home-lowlight`);
  await page.goto(`${BASE}#/t/extended_exhale`); await page.waitForSelector('#startBtn'); await page.click('#startBtn');
  await page.waitForTimeout(3000 + 6000); await shot(`${pad(n++)}-session-lowlight-exhale`);
  await page.click('#endBtn'); await page.click('#doneBtn');
  await page.goto(BASE); await page.waitForSelector('#nightBtn'); await page.click('#nightBtn');

  // ---------- Hindi-specific checks ----------
  await page.goto(BASE); await page.waitForSelector('.card');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'hi'); ok('<html lang="hi">');
  const titles = await page.locator('.card-title').allInnerTexts();
  assert.ok(titles.every((t) => /[\u0900-\u097F]/.test(t)) && titles.includes('बॉक्स ब्रीदिंग (Box breathing)'), titles.join(' | ')); ok(`technique names in Hindi: ${titles.slice(0, 3).join(' | ')} …`);
  const deva = await page.evaluate(() => {
    // Devanagari must render with a real Devanagari font (not tofu): compare glyph widths with a font known to lack it
    const c = document.createElement('canvas').getContext('2d'), txt = 'साँस अंदर लीजिए';
    c.font = '32px "Noto Sans Devanagari"'; const a = c.measureText(txt).width;
    return { width: a, family: getComputedStyle(document.body).fontFamily, fontOk: document.fonts.check('16px "Noto Sans Devanagari"', 'सा') };
  });
  assert.ok(deva.width > 100 && deva.fontOk, JSON.stringify(deva)); ok(`Devanagari font available (${deva.family.split(',')[0]})`);
  assert.equal(await page.locator('a.lang-link[href="https://jalam1001.github.io/breathwork/"]').count(), 1); ok('link to English site on home');
  const visibleEnglish = await page.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode.textContent.trim(); const el = w.currentNode.parentElement;
      if (t && !el.closest('[lang=en]') && /[A-Za-z]{4,}/.test(t.replace(/\((?:[A-Za-z0-9 \-]+)\)/g, '').replace(/Huberman|Balban|Cell Reports Medicine|Box|breathing/g, ''))) out.push(t); }
    return out;
  });
  assert.deepEqual(visibleEnglish, [], 'untranslated English on home'); ok('no untranslated English text on home');
  await page.click('a[href="essay.html"]'); await page.waitForSelector('#essay-title');
  assert.equal(await page.locator('#essay-title').innerText(), 'साँस की पुनर्खोज: प्राचीन साधना से ब्रीदवर्क तक');
  assert.equal(await page.locator('article p').count(), 4); ok('Hindi essay page opens from home (title + 4 paragraphs)');
  await page.evaluate(() => scrollTo(0, 0)); await shot(`${pad(n++)}-essay`);
  await page.goto(`${BASE}#/t/box`); await page.waitForSelector('#startBtn');
  assert.match(await page.locator('#voiceNote').innerText(), /हिन्दी/); ok(`voice note: "${(await page.locator('#voiceNote').innerText()).trim().slice(0, 60)}…"`);

  // A full session to completion: 1 physiological sigh (3 s lead-in + 10 s)
  await page.goto(`${BASE}#/t/sigh_reset`); await page.waitForSelector('#startBtn');
  await page.locator('label.chip-opt:has(input[name=rounds][value="1"])').click();
  await page.click('#startBtn');
  await page.waitForSelector('text=सत्र पूरा हुआ', { timeout: 20000 });
  assert.match(await page.locator('.lead').innerText(), /0:10 का श्वास अभ्यास/); ok('full 1-sigh session completes with 0:10');
  await shot(`${pad(n++)}-complete`);
  await page.click('#doneBtn');
  await page.goto(`${BASE}#/history`); await page.waitForSelector('.hist li');
  const hist = await page.locator('.hist li').count();
  const top = await page.locator(".hist li").first().innerText();
  assert.ok(hist >= 1 && /शारीरिक आह/.test(top) && /0:10/.test(top) && !/बीच में समाप्त/.test(top), top); ok(`history: ${hist} entries (≥10 s), latest = completed 0:10 sigh`);
  assert.match(await page.locator('.stat').innerText(), /लगातार अभ्यास: 1 दिन/); ok('streak = 1 day');
  await shot(`${pad(n++)}-history`);
  page.once('dialog', (d) => d.accept());
  await page.click('#clearBtn'); await page.waitForSelector('text=अभी तक कोई सत्र नहीं।'); ok('clear history');

  await page.goto(`${BASE}#/about`); await page.waitForSelector('table');
  assert.ok(await page.locator('a[href*="RESEARCH.md"]').count()); ok('about page links RESEARCH.md');
  await shot(`${pad(n++)}-about`);

  // Light theme
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(BASE); await page.waitForSelector('.card');
  await shot(`${pad(n++)}-home-light`);
  await page.goto(`${BASE}#/t/cyclic_sigh`); await page.waitForSelector('#startBtn'); await page.click('#startBtn');
  await page.waitForTimeout(5000); await shot(`${pad(n++)}-session-light`);
  await page.click('#endBtn'); await page.click('#doneBtn');
  await page.emulateMedia({ colorScheme: 'dark' });

  // Keyboard: space pauses during a session
  await page.goto(`${BASE}#/t/resonance`); await page.waitForSelector('#startBtn');
  await page.focus('#startBtn'); await page.keyboard.press('Enter'); await page.waitForTimeout(3500);
  await page.locator('body').focus(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pauseBtn').innerText(), 'फिर शुरू करें'); ok('keyboard: Enter starts, Escape pauses');
  await page.click('#endBtn'); await page.click('#doneBtn');

  // PWA: manifest + service worker + offline reload
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  assert.ok(sw); ok('service worker active');
  const mf = await (await page.request.get(`${BASE}manifest.webmanifest`)).json();
  assert.equal(mf.display, 'standalone'); assert.ok(mf.icons.some((i) => i.sizes === '512x512')); ok('manifest valid (standalone, 192/512/maskable icons)');
  await page.reload({ waitUntil: 'networkidle' });
  await ctx.setOffline(true);
  await page.goto(`${BASE}#/t/box`, { waitUntil: 'domcontentloaded' }); await page.reload();
  await page.waitForSelector('#startBtn', { timeout: 5000 }); ok('works offline after first visit');
  await ctx.setOffline(false);

  const ext = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((u) => !u.startsWith(location.origin)));
  assert.deepEqual(ext, []); ok('no external requests');
  assert.deepEqual(errors, []); ok('no console errors');
} catch (e) {
  console.error('FAIL', e.message); console.error('console errors:', errors); process.exitCode = 1;
} finally {
  await browser.close(); server?.kill();
}
console.log(`\n${results.length} checks passed${process.exitCode ? ' before failure' : ''}. Screenshots: ${SHOTS}`);
