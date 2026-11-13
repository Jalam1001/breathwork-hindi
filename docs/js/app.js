import { ALL, byId, Techniques as T, DURATIONS, HYPER_WARNING, makeConfig, Timeline, timingText, cardTiming, sessionSummary,
  formatClock, ceilSeconds, Pacer, PhaseKind as K, Streaks, epochDay, dayToDate, SessionController, phaseGroup } from './domain.js';
import { Cues } from './cues.js';
import { Store } from './store.js';
import { Aurora, PALETTES } from './bg.js';
import { themeOf, icon } from './theme.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const cues = new Cues();
cues.settings = Store.cues;
window.__bwCues = cues; // test hook (read-only use in automated checks)
const aurora = new Aurora($('#bg'));
aurora.start();

// ---------- Theme & low-light ----------
let forceDark = false;
const isDark = () => forceDark || Store.theme === 'dark' || (Store.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
function applyTheme() {
  document.documentElement.dataset.theme = Store.theme;
  document.documentElement.dataset.night = Store.night ? 'on' : 'off';
  const dark = isDark();
  $('meta[name=theme-color]').setAttribute('content', dark ? (Store.night ? '#02040A' : '#060A18') : '#EEF1FB');
  aurora.setMode({ dark, night: Store.night });
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- Session engine ----------
let rafId = 0, intervalId = 0, wakeLock = null;
const controller = new SessionController({
  clock: () => performance.now(),
  cues,
  onComplete: (s) => {
    const secs = Math.floor(s.elapsedMs / 1000);
    if (secs >= 10) Store.add({ epochDay: epochDay(), techniqueId: s.timeline.config.technique.id, seconds: secs, completed: s.completed });
    stopLoops(); releaseWake(); renderSession();
  },
});

async function requestWake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); } }
  catch (e) { /* not allowed (e.g. low battery); session still works */ }
}
function releaseWake() { try { wakeLock?.release(); } catch (e) { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && controller.isActive && !wakeLock) requestWake();
  if (document.visibilityState === 'visible') controller.tick();
});

function startLoops() {
  stopLoops();
  intervalId = setInterval(() => controller.tick(), 50);
  const frame = () => { controller.tick(); drawSession(); rafId = requestAnimationFrame(frame); };
  rafId = requestAnimationFrame(frame);
}
function stopLoops() { clearInterval(intervalId); cancelAnimationFrame(rafId); intervalId = 0; rafId = 0; }

function startSession(cfg) {
  cues.settings = Store.cues;
  cues.unlock(); // inside the click handler: required for iOS audio and speech
  controller.start(cfg);
  requestWake();
  sessionShell();
  startLoops();
}

// ---------- Router ----------
function setChrome({ palette = PALETTES.home, dark = false } = {}) {
  forceDark = dark; applyTheme(); aurora.setPalette(palette); aurora.setEnergy(0.5);
}
function route() {
  if (controller.isActive || controller.state.run === 'finished') {
    if (controller.state.run === 'running' || controller.state.run === 'lead_in') controller.pause();
    renderSession(); return;
  }
  const h = location.hash.replace(/^#\/?/, '');
  window.scrollTo(0, 0);
  if (h.startsWith('t/')) { const t = byId(h.slice(2)); setChrome({ palette: themeOf(t.id).aurora }); renderDetail(t); }
  else { setChrome(); if (h === 'history') renderHistory(); else if (h === 'about') renderAbout(); else renderHome(); }
  const h1 = $('h1', app); if (h1 && document.activeElement === document.body) h1.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);

const ICON = {
  back: '<path d="M15.5 4.5 8 12l7.5 7.5"/>',
  theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" class="fill"/>',
  night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  history: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  ear: '<path d="M6 15a7 7 0 1 1 12-5c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M9.5 10a2.5 2.5 0 0 1 5 0"/>',
};
const svgI = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
function bar(title, { back = false, actions = '', gradient = false } = {}) {
  return `<header class="bar">
    ${back ? `<a class="icon-btn" href="#/" aria-label="तकनीकों की सूची पर वापस जाएँ">${svgI('back')}</a>` : ''}
    <h1 tabindex="-1" class="${gradient ? 'brand' : ''}">${esc(title)}</h1><div class="actions">${actions}</div></header>`;
}
const purposeChip = (p) => `<span class="chip">${esc(p)}</span>`;

function themeButton() {
  const next = { system: 'dark', dark: 'light', light: 'system' };
  const label = { system: 'थीम: सिस्टम के अनुसार', dark: 'थीम: गहरी', light: 'थीम: हल्की' };
  return `<button class="icon-btn" id="themeBtn" type="button" aria-label="${label[Store.theme]}। थीम बदलें" title="${label[Store.theme]}" data-next="${next[Store.theme]}">${svgI('theme')}</button>`;
}
const nightButton = (id = 'nightBtn') => `<button class="icon-btn night-btn" id="${id}" type="button" aria-pressed="${Store.night}" aria-label="कम रोशनी मोड" title="कम रोशनी मोड">${svgI('night')}</button>`;
function bindChrome() {
  $('#themeBtn')?.addEventListener('click', (e) => { Store.setTheme(e.currentTarget.dataset.next); applyTheme(); route(); });
  $('#nightBtn')?.addEventListener('click', toggleNight);
}
function toggleNight() {
  Store.setNight(!Store.night); applyTheme();
  document.querySelectorAll('.night-btn').forEach((b) => b.setAttribute('aria-pressed', String(Store.night)));
}

// ---------- Home ----------
function stats() {
  const h = Store.history, today = epochDay();
  return { h, streak: Streaks.current(new Set(h.map((e) => e.epochDay)), today), todayMin: Math.floor(h.filter((e) => e.epochDay === today).reduce((a, e) => a + e.seconds, 0) / 60) };
}
const tech = (id) => `data-tech="${esc(id)}"`;
function renderHome() {
  const { streak, todayMin } = stats();
  app.innerHTML = `${bar('ब्रीदवर्क', { gradient: true, actions: `<a class="lang-link" href="https://jalam1001.github.io/breathwork/" hreflang="en" lang="en" aria-label="English version">EN</a>${nightButton()}${themeButton()}
      <a class="icon-btn" href="#/history" aria-label="इतिहास">${svgI('history')}</a>
      <a class="icon-btn" href="#/about" aria-label="परिचय और स्रोत">${svgI('about')}</a>` })}
  <main class="content">
    <p class="lead">साँस को साधना बनाइए। कोई तकनीक चुनिए, समय तय कीजिए, फिर आँखें बंद करके आवाज़ के साथ साँस लीजिए।</p>
    <div class="stats"><span class="stat">🔥 लगातार: ${streak} दिन</span><span class="stat">आज: ${todayMin} मिनट</span></div>
    <ul class="cards" role="list">
      ${ALL.map((t) => `<li><a class="card" href="#/t/${t.id}" data-testid="tech-${t.id}" ${tech(t.id)}>
        <span class="card-head"><span class="card-icon">${icon(themeOf(t.id).icon)}</span><span class="card-title">${esc(t.name)}</span>${purposeChip(t.purpose)}</span>
        <span class="card-sum">${esc(t.summary)}</span>
        <span class="card-timing">${esc(cardTiming(t))}</span></a></li>`).join('')}
    </ul>
    <p class="fine">ये तकनीकें ह्यूबरमैन लैब पॉडकास्ट और बालबन और साथी, 2023 (Cell Reports Medicine) में चर्चित हैं।
      ब्रीदवर्क एक स्वतंत्र ऐप है और <strong>ह्यूबरमैन लैब से इसका कोई संबंध नहीं है, न ही उन्होंने इसका समर्थन किया है</strong>। यह चिकित्सीय सलाह नहीं है।
      <a href="#/about">स्रोत और परिचय</a> · <a href="essay.html">लेख: साँस की पुनर्खोज</a></p>
  </main>`;
  bindChrome();
}

// ---------- Detail ----------
const detailState = {};
function renderDetail(t) {
  const st = detailState[t.id] ||= { variant: 0, minutes: t.defaultMinutes, custom: false, customText: '', rounds: t.defaultRounds, breaths: 30, hold: 15 };
  const c = Store.cues, th = themeOf(t.id);
  const isHyper = t.id === T.hyper.id;
  const radios = (name, items, sel, legend) => `<fieldset class="chips"><legend>${legend}</legend>
    ${items.map(([v, label, aria]) => `<label class="chip-opt"><input type="radio" name="${name}" value="${v}" ${String(sel) === String(v) ? 'checked' : ''} ${aria ? `aria-label="${aria}"` : ''}><span>${esc(label)}</span></label>`).join('')}</fieldset>`;
  const toggle = (key, label, hint = '') => `<label class="toggle"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <input type="checkbox" role="switch" data-cue="${key}" ${c[key] ? 'checked' : ''}><span class="track" aria-hidden="true"></span></label>`;
  const slider = (key, label) => `<label class="slider"><span>${label} <output data-out="${key}">${Math.round(c[key] * 100)}%</output></span>
    <input type="range" min="0" max="100" step="5" value="${Math.round(c[key] * 100)}" data-vol="${key}" aria-label="${label} आवाज़ का स्तर"></label>`;
  app.innerHTML = `${bar(t.name, { back: true, actions: nightButton() })}
  <main class="content detail" ${tech(t.id)}>
    <section class="hero"><span class="card-icon big">${icon(th.icon)}</span>
      <div><p class="row">${purposeChip(t.purpose)}</p><p class="hero-sum">${esc(t.summary)}</p></div></section>
    <section class="panel"><h2>कैसे करें</h2><p>${esc(t.howTo)}</p>
      <p class="src">स्रोत: ${esc(t.source)}</p></section>
    <label class="eyes-card" for="eyesSwitch">
      <span class="eyes-icon">${svgI('ear')}</span>
      <span class="eyes-text"><strong>आँखें बंद मोड</strong>
        <small>हर साँस में आवाज़ आपका मार्गदर्शन करती है: साँस लेते समय पूरे समय ऊपर चढ़ता स्वर, साँस छोड़ते समय पूरे समय नीचे उतरता कोमल स्वर, और रोकते समय हल्की गुनगुनाहट। शुरुआत और अंत में घंटी (सिंगिंग बाउल)।</small></span>
      <input id="eyesSwitch" type="checkbox" role="switch" data-cue="eyesClosed" ${c.eyesClosed ? 'checked' : ''}><span class="track" aria-hidden="true"></span>
    </label>
    <form id="cfg" class="panel" novalidate>
      ${t.variants.length > 1 ? radios('variant', t.variants.map((v, i) => [i, v.name]), st.variant, 'क्रम') : ''}
      ${!isHyper ? `<p class="timing" id="timing"></p>` : ''}
      ${t.mode === 'timed'
        ? radios('minutes', [...DURATIONS.map((m) => [m, `${m} मिनट`, `${m} मिनट`]), ['custom', 'अपना समय']], st.custom ? 'custom' : st.minutes, 'अवधि') +
          `<div class="custom ${st.custom ? '' : 'hidden'}" id="customWrap"><label for="customMin">मिनट (1–120)</label>
           <input id="customMin" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(st.customText)}" aria-describedby="customErr">
           <span id="customErr" class="err" role="alert"></span></div>`
        : radios('rounds', [1, 2, 3, 4, 5].map((r) => [r, String(r), `${r} ${isHyper ? 'राउंड' : 'आहें'}`]), st.rounds, isHyper ? 'राउंड' : 'आहें') +
          (isHyper ? radios('breaths', [20, 25, 30].map((b) => [b, `${b} साँस`]), st.breaths, 'हर राउंड में साँसें') +
                     radios('hold', [15, 30].map((h) => [h, `${h} से. रोक`]), st.hold, 'खाली फेफड़ों के साथ रोक') : '')}
      <p class="summary" id="summary" aria-live="polite"></p>
    </form>
    <section class="panel" id="cuesPanel">
      <h2>आवाज़ और संकेत</h2>
      ${toggle('tones', 'स्वर', 'आँखें बंद मोड बंद होने पर छोटे संकेत-स्वर')}
      ${toggle('holdTicks', 'रोकते समय हर सेकंड हल्की टिक')}
      ${toggle('ambient', 'समुद्र जैसी पृष्ठभूमि ध्वनि', 'हल्की ध्वनि जो साँस लेते समय उठती है और छोड़ते समय थम जाती है')}
      ${toggle('bells', 'शुरुआत और अंत में घंटी')}
      ${toggle('halfway', 'आधे सत्र पर हल्की घंटी')}
      ${toggle('voice', 'बोलकर संकेत (हिन्दी)', cues.canSpeak ? '“साँस अंदर लीजिए”, “रोकिए”, “साँस बाहर छोड़िए”, राउंड, “सत्र पूरा हुआ”<span id="voiceNote"></span>' : 'इस ब्राउज़र में उपलब्ध नहीं')}
      ${toggle('voiceCounts', 'रोकते समय गिनती बोलें')}
      ${toggle('haptics', 'कंपन (वाइब्रेशन)', cues.canVibrate ? '1 लंबा = साँस लें, 2 छोटे = साँस छोड़ें' : 'इस डिवाइस/ब्राउज़र में उपलब्ध नहीं (जैसे iPhone)')}
      <h3>आवाज़ का स्तर</h3>
      ${slider('master', 'मुख्य')}${slider('toneVol', 'स्वर और घंटी')}${slider('ambientVol', 'पृष्ठभूमि')}${slider('voiceVol', 'बोली')}
      <button type="button" class="test-btn" id="testCue">▶ आवाज़ जाँचें</button>
    </section>
  </main>
  <div class="start-bar"><button class="primary big" id="startBtn" type="button" ${tech(t.id)}>शुरू करें: ${esc(t.name)}</button></div>`;
  bindChrome();

  const form = $('#cfg');
  const cfgOf = () => {
    const customMin = parseInt(st.customText, 10);
    const minutes = st.custom ? Math.min(120, Math.max(1, Number.isFinite(customMin) ? customMin : 1)) : st.minutes;
    return makeConfig(t, { variantIndex: st.variant, minutes, rounds: st.rounds, hyper: { breaths: st.breaths, holdSeconds: st.hold } });
  };
  const validCustom = () => { const n = Number(st.customText); return /^\d+$/.test(st.customText) && n >= 1 && n <= 120; };
  const update = () => {
    const cfg = cfgOf();
    if ($('#timing')) $('#timing').textContent = timingText(cfg.variant.steps);
    $('#summary').textContent = sessionSummary(new Timeline(cfg));
    $('#startBtn').disabled = t.mode === 'timed' && st.custom && !validCustom();
    const bad = !!(st.custom && st.customText && !validCustom());
    const err = $('#customErr'); if (err) err.textContent = bad ? '1 से 120 मिनट के बीच चुनें' : '';
    $('#customMin')?.setAttribute('aria-invalid', String(bad));
  };
  const syncCues = () => {
    const s = Store.cues;
    const dis = { tones: s.eyesClosed, holdTicks: !(s.tones || s.eyesClosed), voiceCounts: !s.voice, voice: !cues.canSpeak, haptics: !cues.canVibrate };
    document.querySelectorAll('#cuesPanel [data-cue]').forEach((el) => {
      const d = !!dis[el.dataset.cue]; el.disabled = d; el.closest('label').classList.toggle('disabled', d);
      if (el.dataset.cue === 'tones') el.checked = s.eyesClosed || s.tones;
    });
  };
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'variant') st.variant = +el.value;
    else if (el.name === 'minutes') { st.custom = el.value === 'custom'; if (!st.custom) st.minutes = +el.value; $('#customWrap').classList.toggle('hidden', !st.custom); if (st.custom) $('#customMin').focus(); }
    else if (el.name === 'rounds') st.rounds = +el.value;
    else if (el.name === 'breaths') st.breaths = +el.value;
    else if (el.name === 'hold') st.hold = +el.value;
    update();
  });
  $('main.detail').addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset?.cue) return;
    if (el.dataset.cue === 'tones' && Store.cues.eyesClosed) return;
    Store.setCues({ [el.dataset.cue]: el.checked }); cues.settings = Store.cues; syncCues();
  });
  document.querySelectorAll('[data-vol]').forEach((el) => el.addEventListener('input', () => {
    Store.setCues({ [el.dataset.vol]: el.value / 100 }); $(`[data-out=${el.dataset.vol}]`).textContent = `${el.value}%`;
    cues.settings = Store.cues; cues.applyVolumes();
  }));
  $('#customMin')?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); st.customText = e.target.value; update(); });
  $('#testCue').addEventListener('click', () => { cues.settings = Store.cues; cues.unlock(); cues.applyVolumes(); cues.test(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  $('#startBtn').addEventListener('click', () => {
    if (t.needsWarning && !Store.hyperAck) showWarning(() => startSession(cfgOf()));
    else startSession(cfgOf());
  });
  syncCues(); update();
  const voiceNote = () => {
    const el = $('#voiceNote'); if (!el) return;
    el.textContent = cues.hasHindiVoice ? ' · हिन्दी आवाज़ उपलब्ध है।'
      : ' · इस डिवाइस पर हिन्दी (hi-IN) आवाज़ नहीं मिली। ब्राउज़र अपनी डिफ़ॉल्ट आवाज़ इस्तेमाल करेगा या कुछ नहीं बोलेगा; स्वर और घंटियाँ फिर भी काम करेंगी।';
  };
  voiceNote();
  if (cues.canSpeak) speechSynthesis.addEventListener('voiceschanged', voiceNote, { once: true });
}

function showWarning(onConfirm) {
  const d = document.createElement('dialog');
  d.className = 'dialog';
  d.setAttribute('aria-labelledby', 'warnTitle');
  d.innerHTML = `<form method="dialog">
    <h2 id="warnTitle">⚠️ ${HYPER_WARNING.title}</h2>
    <p>${HYPER_WARNING.lead}</p>
    <ul>${HYPER_WARNING.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <label class="check"><input type="checkbox" id="ackBox"> <span>${HYPER_WARNING.confirm}</span></label>
    <div class="dialog-actions"><button value="cancel" class="text-btn" id="warnCancel">रद्द करें</button>
    <button value="ok" class="primary" id="warnStart" disabled>शुरू करें</button></div></form>`;
  document.body.append(d);
  const box = $('#ackBox', d), ok = $('#warnStart', d);
  box.addEventListener('change', () => { ok.disabled = !box.checked; });
  ok.addEventListener('click', (e) => { e.preventDefault(); if (!box.checked) return; Store.acknowledgeHyper(); d.close(); onConfirm(); });
  d.addEventListener('close', () => d.remove());
  d.showModal();
  box.focus();
}

// ---------- Session ----------
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const R = 120, C = 150;
function sessionShell() {
  const tl = controller.state.timeline, t = tl.config.technique, th = themeOf(t.id);
  const hasTopUp = tl.config.cycleSteps.some((s) => s.kind === K.TOP_UP);
  const square = t.visual === 'square';
  const side = R * 1.55, x0 = C - side / 2;
  setChrome({ palette: th.aurora, dark: true });
  const ec = Store.cues.eyesClosed;
  app.innerHTML = `<main class="session" data-phase="ready" ${tech(t.id)} aria-label="${esc(t.name)} सत्र">
    <div class="s-top"><p class="s-title">${esc(t.name)}</p>
      ${ec ? `<span class="ec-pill" title="आँखें बंद ऑडियो मार्गदर्शन चालू है">${svgI('ear')} आँखें बंद ऑडियो</span>` : ''}
      ${nightButton('nightBtnS')}</div>
    <div class="pacer-wrap">
      <svg class="pacer" viewBox="0 0 300 300" role="img" aria-labelledby="phaseLabel">
        <defs>
          <radialGradient id="orbGrad" cx="38%" cy="32%" r="75%"><stop offset="0" class="s1"/><stop offset=".5" class="s2"/><stop offset="1" class="s3"/></radialGradient>
          <radialGradient id="haloGrad"><stop offset=".45" class="h1"/><stop offset="1" class="h2"/></radialGradient>
          <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="e1"/><stop offset="1" class="e2"/></linearGradient>
        </defs>
        <circle id="halo" cx="${C}" cy="${C}" r="${R * 1.5}" fill="url(#haloGrad)"/>
        <g id="ripples"></g>
        ${square ? `
          <rect x="${x0}" y="${x0}" width="${side}" height="${side}" rx="10" class="track" stroke-width="8" fill="none"/>
          <line id="sideHi" class="side-hi" stroke-width="8" stroke-linecap="round"/>
          ${[[0, 1], [0, 0], [1, 0], [1, 1]].map(([a, b]) => `<circle cx="${x0 + a * side}" cy="${x0 + b * side}" r="6" class="corner"/>`).join('')}
          <circle id="breath" cx="${C}" cy="${C}" r="10" fill="url(#orbGrad)" class="orb"/>
          <circle id="dotHalo" r="26" class="dot-halo"/><circle id="dot" r="13" class="dot"/>` : `
          <circle cx="${C}" cy="${C}" r="${R}" class="track" stroke-width="2" fill="none"/>
          ${hasTopUp ? `<circle cx="${C}" cy="${C}" r="${R * Pacer.MID}" class="ring-mid" stroke-width="2" fill="none" stroke-dasharray="4 6"/>` : ''}
          <circle cx="${C}" cy="${C}" r="${R * Pacer.MIN}" class="track faint" stroke-width="2" fill="none"/>
          <circle id="breath" cx="${C}" cy="${C}" r="${R * Pacer.MIN}" fill="url(#orbGrad)" class="orb" stroke="url(#edgeGrad)" stroke-width="3"/>`}
      </svg>
      <div class="phase"><div id="phaseLabel" class="phase-label" aria-live="polite"></div><div id="phaseCount" class="phase-count" aria-hidden="true"></div></div>
    </div>
    <p id="counter" class="counter"></p>
    <div class="progress" role="progressbar" aria-label="सत्र की प्रगति" aria-valuemin="0" aria-valuemax="100" id="prog"><div id="progFill"></div></div>
    <p id="left" class="left"></p>
    <div class="controls">
      <button type="button" class="tonal big" id="pauseBtn">रोकें</button>
      <button type="button" class="outlined big" id="endBtn">समाप्त करें</button>
    </div>
  </main>`;
  $('#nightBtnS').addEventListener('click', toggleNight);
  $('#pauseBtn').addEventListener('click', () => {
    if (controller.state.run === 'paused') { cues.unlock(); controller.resume(); requestWake(); } else controller.pause();
    drawSession(true);
  });
  $('#endBtn').addEventListener('click', () => controller.end());
  lastSegKey = '';
  drawSession(true);
}
let lastLabel = '', lastCount = '', lastCounter = '', lastLeft = '', lastPct = -1, lastRun = '', lastSegKey = '', lastPhase = '';
function ripple(r) {
  if (reducedMotion.matches) return;
  const g = $('#ripples'); if (!g) return;
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', C); c.setAttribute('cy', C); c.setAttribute('r', r); c.setAttribute('class', 'ripple');
  c.addEventListener('animationend', () => c.remove());
  g.append(c);
  while (g.childNodes.length > 4) g.firstChild.remove();
}
function drawSession(force = false) {
  const s = controller.state, tl = s.timeline;
  if (!tl || s.run === 'finished' || s.run === 'idle' || !$('.pacer')) return;
  const t = tl.config.technique, seg = controller.segment, lead = s.run === 'lead_in';
  const hasTopUp = tl.config.cycleSteps.some((x) => x.kind === K.TOP_UP);
  const label = lead ? 'तैयार हो जाइए' : s.run === 'paused' ? `रुका हुआ · ${seg?.step.label ?? ''}` : seg?.step.label ?? '';
  const count = String(lead ? ceilSeconds(s.leadInMs) : ceilSeconds(controller.phaseRemainingMs));
  const kind = lead ? K.HOLD_EMPTY : seg?.step.kind ?? K.HOLD_EMPTY;
  const frac = lead ? 0 : controller.phaseFraction;
  const phase = lead ? 'ready' : phaseGroup(kind);
  let orbR;
  if (t.visual === 'square') {
    const side = R * 1.55, x0 = C - side / 2, idx = lead ? 0 : seg?.indexInCycle ?? 0;
    const [a, b] = Pacer.boxPoint(idx, 0), [c, d] = Pacer.boxPoint(idx, 1), [px, py] = Pacer.boxPoint(idx, frac);
    const hi = $('#sideHi');
    hi.setAttribute('x1', x0 + a * side); hi.setAttribute('y1', x0 + b * side); hi.setAttribute('x2', x0 + c * side); hi.setAttribute('y2', x0 + d * side);
    for (const id of ['#dot', '#dotHalo']) { const el = $(id); el.setAttribute('cx', x0 + px * side); el.setAttribute('cy', x0 + py * side); }
    const sc = lead ? Pacer.MIN : Pacer.scale(kind, frac, false);
    orbR = (side / 2.3) * sc; aurora.setEnergy(sc);
  } else {
    const sc = Pacer.scale(kind, frac, hasTopUp);
    orbR = R * sc; aurora.setEnergy(sc);
  }
  $('#breath').setAttribute('r', orbR.toFixed(2));
  $('#halo').setAttribute('r', (orbR * 1.55 + 10).toFixed(2));
  const segKey = lead ? 'lead' : `${s.index}`;
  if (segKey !== lastSegKey) { if (lastSegKey && !lead && s.run === 'running') ripple(orbR); lastSegKey = segKey; }
  if (force || phase !== lastPhase) {
    $('.session').dataset.phase = phase; lastPhase = phase;
    aurora.setPalette(phase === 'ready' ? themeOf(t.id).aurora : PALETTES[phase]);
  }
  if (force || label !== lastLabel) { $('#phaseLabel').textContent = label; lastLabel = label; }
  if (force || count !== lastCount) { $('#phaseCount').textContent = count; lastCount = count; }
  let counter = '';
  if (seg && !lead) {
    if (t.id === T.hyper.id) { const breath = Math.floor(seg.indexInCycle / 2) + 1, n = tl.config.hyper.breaths;
      counter = breath <= n ? `राउंड ${seg.cycle + 1} / ${tl.cycles} · साँस ${breath} / ${n}` : `राउंड ${seg.cycle + 1} / ${tl.cycles}`; }
    else counter = `${t.mode === 'rounds' ? 'आह' : 'साँस'} ${seg.cycle + 1} / ${tl.cycles}`;
  }
  if (force || counter !== lastCounter) { $('#counter').textContent = counter; lastCounter = counter; }
  const left = `${formatClock(controller.remainingMs)} बाकी`;
  if (force || left !== lastLeft) { $('#left').textContent = left; lastLeft = left; }
  const pct = Math.floor(controller.progress * 100);
  $('#progFill').style.transform = `scaleX(${controller.progress})`;
  if (force || pct !== lastPct) { $('#prog').setAttribute('aria-valuenow', pct); $('#prog').setAttribute('aria-valuetext', `${pct} प्रतिशत`); lastPct = pct; }
  if (force || s.run !== lastRun) {
    const pb = $('#pauseBtn');
    pb.textContent = s.run === 'paused' ? 'फिर शुरू करें' : 'रोकें';
    pb.className = s.run === 'paused' ? 'primary big' : 'tonal big';
    $('.session').classList.toggle('paused', s.run === 'paused');
    lastRun = s.run;
  }
}
function renderSession() {
  const s = controller.state;
  if (s.run !== 'finished') { if (!$('.pacer')) sessionShell(); drawSession(true); return; }
  const t = s.timeline.config.technique;
  setChrome({ palette: themeOf(t.id).aurora, dark: true });
  app.innerHTML = `<main class="session done" ${tech(t.id)}>
    <span class="card-icon big">${icon(themeOf(t.id).icon)}</span>
    <p class="s-title">${esc(t.name)}</p>
    <h1 tabindex="-1">${s.completed ? 'सत्र पूरा हुआ' : 'सत्र समाप्त'}</h1>
    <p class="lead">${formatClock(s.elapsedMs)} का श्वास अभ्यास</p>
    <button type="button" class="primary big wide" id="doneBtn">ठीक है</button></main>`;
  $('h1', app).focus();
  $('#doneBtn').addEventListener('click', () => { controller.reset(); const target = `#/t/${t.id}`; if (location.hash !== target) location.hash = target; else route(); });
}
document.addEventListener('keydown', (e) => {
  if (!controller.isActive || e.target.closest('dialog')) return;
  if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); $('#pauseBtn')?.click(); }
  if (e.key === 'Escape') { e.preventDefault(); if (controller.state.run !== 'paused') controller.pause(); drawSession(true); }
});

// ---------- History ----------
function renderHistory() {
  const { h, streak } = stats();
  app.innerHTML = `${bar('इतिहास', { back: true, actions: h.length ? '<button class="text-btn" id="clearBtn" type="button">मिटाएँ</button>' : '' })}
  <main class="content"><section class="panel">
    <p class="stat big">लगातार अभ्यास: ${streak} दिन</p>
    <p>सत्र: ${h.length} · कुल: ${Math.floor(h.reduce((a, e) => a + e.seconds, 0) / 60)} मिनट</p>
    <p class="src">केवल इसी डिवाइस पर (ब्राउज़र स्टोरेज में) सहेजा गया।</p>
    ${h.length ? `<ul class="hist" role="list">${h.slice().reverse().map((e) => `<li ${tech(e.techniqueId)}><span class="card-icon sm">${icon(themeOf(e.techniqueId).icon)}</span><span><strong>${esc(byId(e.techniqueId).name)}</strong>
      <span>${dayToDate(e.epochDay)} · ${formatClock(e.seconds * 1000)}${e.completed ? '' : ' (बीच में समाप्त)'}</span></span></li>`).join('')}</ul>` : '<p>अभी तक कोई सत्र नहीं।</p>'}
  </section></main>`;
  $('#clearBtn')?.addEventListener('click', () => { if (confirm('पूरा इतिहास मिटाएँ? इसे वापस नहीं लाया जा सकेगा।')) { Store.clearHistory(); renderHistory(); } });
}

// ---------- About ----------
function renderAbout() {
  const row = (n, name, purpose, timing, sources) => `<tr><td>${n}</td><th scope="row">${name}</th><td>${purpose}</td><td>${timing}</td><td>${sources}</td></tr>`;
  const a = (href, text, lang) => `<a href="${href}" rel="noopener" target="_blank"${lang ? ` lang="${lang}"` : ''}>${text}</a>`;
  app.innerHTML = `${bar('परिचय और स्रोत', { back: true })}
  <main class="content about"><section class="panel">
    <p>ये साँस की वे तकनीकें हैं जिनकी <strong>ह्यूबरमैन लैब पॉडकास्ट पर चर्चा हुई है</strong> और जिन पर प्रकाशित शोध मौजूद है।
    ब्रीदवर्क एक स्वतंत्र ऐप है। <strong>ह्यूबरमैन लैब और स्टैनफ़र्ड का इससे कोई संबंध नहीं है और वे इसका समर्थन नहीं करते।</strong> यहाँ दी गई कोई भी बात चिकित्सीय सलाह नहीं है।</p>
    <p><a href="essay.html">📖 लेख पढ़ें: “साँस की पुनर्खोज: प्राचीन साधना से ब्रीदवर्क तक”</a></p>
    <h2>मुख्य स्रोत</h2>
    <ul class="sources">
      <li lang="en">Balban MY, Neri E, Kogon MM, … Spiegel D, Huberman AD. <em>Brief structured respiration practices enhance mood and reduce physiological arousal.</em> Cell Reports Medicine 4(1):100895, 2023. ${a('https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/', 'PMC9873947')} (NCT05304000).</li>
      <li>एक महीने का रिमोट रैंडमाइज़्ड अध्ययन, जिसमें रोज़ 5 मिनट अभ्यास किया गया। चक्रीय आह से सकारात्मक मनोदशा में सबसे ज़्यादा सुधार हुआ और साँस की दर सबसे ज़्यादा घटी, और मनोदशा पर इसका असर माइंडफ़ुलनेस ध्यान से बेहतर रहा (p &lt; 0.05)।</li>
      <li>${a('https://med.stanford.edu/news/insights/2023/02/cyclic-sighing-can-help-breathe-away-anxiety.html', 'स्टैनफ़र्ड मेडिसिन का सारांश')} (अंग्रेज़ी में)</li>
      <li>${a('https://www.hubermanlab.com/newsletter/breathwork-protocols-for-health-focus-stress', 'ह्यूबरमैन लैब न्यूज़लेटर: “Breathwork Protocols for Health, Focus &amp; Stress”')}</li>
      <li>${a('https://www.hubermanlab.com/daily-blueprint', 'ह्यूबरमैन लैब डेली ब्लूप्रिंट')} (चक्रीय तेज़ श्वास और शारीरिक आह, सुरक्षा निर्देशों के साथ)</li>
      <li>${a('https://www.hubermanlab.com/episode/tools-for-managing-stress-and-anxiety', 'एपिसोड: “Tools for Managing Stress &amp; Anxiety”')} (शारीरिक आह; लंबी साँस छोड़ने से दिल की धड़कन धीमी होती है)</li>
      <li>${a('https://www.hubermanlab.com/episode/dr-jack-feldman-breathing-for-mental-physical-health-and-performance', 'एपिसोड: “Dr. Jack Feldman: Breathing for Mental &amp; Physical Health &amp; Performance”')}</li>
      <li>${a('https://www.hubermanlab.com/episode/how-to-breathe-correctly-for-optimal-health-mood-learning-and-performance', 'एपिसोड: “How to Breathe Correctly for Optimal Health, Mood, Learning &amp; Performance”')} (बॉक्स ब्रीदिंग, CO₂ सहनशीलता टेस्ट)</li>
      <li>${a('https://pmc.ncbi.nlm.nih.gov/articles/PMC8924557/', 'रेज़ोनेंस श्वास और HRV (PMC8924557)')}: उस समूह में 6–6.5 साँस/मिनट सबसे अच्छी रही; लिन और साथियों के 5.5 साँस/मिनट वाले अध्ययन का हवाला।</li>
    </ul>
    <h2>तकनीकें और उनका समय</h2>
    <div class="table-wrap" tabindex="0" role="region" aria-label="तकनीकों की तालिका"><table>
      <thead><tr><th scope="col">#</th><th scope="col">तकनीक</th><th scope="col">उद्देश्य</th><th scope="col">ऐप में समय</th><th scope="col">स्रोत क्या कहते हैं</th></tr></thead>
      <tbody>
      ${row(1, 'चक्रीय आह (Cyclic sighing)', 'शांति', 'साँस लें 3 से., थोड़ा और 1 से., छोड़ें 6 से. (10 से. का चक्र, 6/मिनट)। धीमा: 3.5 / 1.5 / 7 से.। सामान्य अवधि 5 मिनट', 'नाक से दोहरी साँस, मुँह से लंबी पूरी साँस छोड़ना, 5 मिनट (बालबन 2023)। स्रोतों में सेकंड नहीं दिए गए हैं। <strong>सेकंड ऐप ने खुद तय किए हैं।</strong>')}
      ${row(2, 'शारीरिक आह – झटपट राहत (Physiological sigh)', 'शांति', '1–5 आहें (सामान्य 3), उसी समय-क्रम में', 'उसी पल शांत होने के लिए “1–3 शारीरिक आहें”')}
      ${row(3, 'बॉक्स ब्रीदिंग (Box breathing)', 'एकाग्रता', 'हर भुजा 4 से. (3, 5, 8 से. भी)', 'सभी भुजाएँ बराबर; लंबाई CO₂ सहनशीलता टेस्ट से: 20 से. से कम → 3–4 से., 25–45 से. → 5–6 से., 50–75 से.+ → 8–10 से.')}
      ${row(4, 'लंबी साँस छोड़ना (Extended exhale)', 'शांति', 'साँस लें 4 से., छोड़ें 8 से. (3/6 भी)', 'लंबी साँस छोड़ने से दिल की धड़कन धीमी होती है। 1:2 का अनुपात ऐप ने चुना है।')}
      ${row(5, 'रेज़ोनेंस (संतुलित) श्वास', 'शांति', '5.5 से. अंदर, 5.5 से. बाहर (≈5.45/मिनट); 5/5 (6/मिनट) भी', '≈5.5–6 साँस/मिनट पर HRV में सबसे बड़ा उतार-चढ़ाव। स्टैनफ़र्ड अध्ययन का हिस्सा नहीं।')}
      ${row(6, '4-7-8 श्वास', 'नींद', 'साँस लें 4, रोकें 7, छोड़ें 8', 'डॉ. एंड्रयू वील की तकनीक। स्टैनफ़र्ड अध्ययन या ह्यूबरमैन प्रोटोकॉल का हिस्सा <strong>नहीं</strong>।')}
      ${row(7, 'चक्रीय तेज़ श्वास (Cyclic hyperventilation)', 'ऊर्जा', 'हर राउंड: 20/25/30 × (1.5 से. अंदर, 1 से. बाहर), पूरी साँस छोड़ें 3 से., खाली फेफड़ों से रोकें 15 या 30 से., राहत की साँस 4 से., ढीला छोड़ें 4 से.। 1–5 राउंड', 'बालबन 2023: 30 साँसें, 15 से. रोक, 3 राउंड। ह्यूबरमैन: 20–25 साँसें, 15–30 से. रोक। पानी के पास कभी नहीं; बैठकर या लेटकर करें; घबराहट या चिंता हो तो सावधानी रखें।')}
      </tbody></table></div>
    <p>तय-समय वाले सत्रों में <strong>केवल पूरे साँस-चक्र</strong> होते हैं: असली अवधि = floor(मिनट × 60 ÷ चक्र) × चक्र, कम से कम एक चक्र, और यह शुरू करने से पहले दिखाई जाती है। उदाहरण: 4 सेकंड वाली बॉक्स ब्रीदिंग के 5 मिनट = 18 चक्र, यानी 4:48।</p>
    <h2>आँखें बंद ऑडियो मार्गदर्शन</h2>
    <p>पूरी साँस लेने तक ऊपर चढ़ता स्वर · आह की दूसरी छोटी साँस के लिए छोटी, तीखी चहक · पूरी साँस छोड़ने तक नीचे उतरता कोमल स्वर · रोकते समय हल्की धड़कती गुनगुनाहट (धीमी टिक के साथ) · बॉक्स के हर कोने पर हल्की घंटी · शुरुआत और अंत में सिंगिंग बाउल जैसी घंटी · चाहें तो आधे सत्र पर घंटी, समुद्र जैसी पृष्ठभूमि ध्वनि और हिन्दी में बोलकर संकेत।</p>
    <p>बोलकर संकेतों के लिए आपके फ़ोन/ब्राउज़र में हिन्दी (hi-IN) आवाज़ होनी चाहिए। न हो तो ब्राउज़र अपनी डिफ़ॉल्ट आवाज़ इस्तेमाल करेगा या चुप रहेगा; स्वर और घंटियाँ हमेशा काम करती हैं।</p>
    <p>पूरे नोट्स: ${a('https://github.com/Jalam1001/breathwork/blob/main/RESEARCH.md', 'GitHub पर RESEARCH.md (अंग्रेज़ी)')} · ${a('https://github.com/Jalam1001/breathwork-hindi', 'हिन्दी संस्करण का सोर्स कोड')} · ${a('https://jalam1001.github.io/breathwork/', 'English version', 'en')}</p>
    <h2>निजता</h2>
    <p>कोई अकाउंट, विज्ञापन, एनालिटिक्स या ट्रैकर नहीं। सेटिंग्स और इतिहास इसी ब्राउज़र की लोकल स्टोरेज में रहते हैं। पहली बार खोलने के बाद ऐप बिना इंटरनेट के भी चलता है।</p>
    <h2>फ़ोन पर इंस्टॉल करें</h2>
    <p><strong>Android (Chrome):</strong> मेन्यू ⋮ → <em>होम स्क्रीन पर जोड़ें</em> / <em>ऐप इंस्टॉल करें</em>। <strong>iPhone (Safari):</strong> शेयर → <em>होम स्क्रीन पर जोड़ें</em>। ध्यान दें: iPhone पर वेब वाइब्रेशन काम नहीं करता, वहाँ आँखें बंद स्वर या बोलकर संकेत इस्तेमाल करें। iPhone पर स्वर सुनने के लिए साइलेंट स्विच बंद रखें।</p>
  </section></main>`;
}

// ---------- Boot ----------
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e)));
  // When an update activates, reload once to pick up the new version (never in the middle of a session).
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !controller.isActive) location.reload(); });
}
