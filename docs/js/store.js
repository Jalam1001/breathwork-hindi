// Settings and history in localStorage. Nothing leaves the device.
import { History } from './domain.js';
import { CUE_DEFAULTS } from './cues.js';

const KEY = 'breathwork.v1';
const DEFAULTS = { cues: { ...CUE_DEFAULTS }, hyperAck: false, theme: 'system', night: false, history: [] };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const old = raw.cues || {};
    const cues = { ...CUE_DEFAULTS, ...old };
    if (typeof old.volume === 'number' && old.toneVol === undefined) cues.toneVol = old.volume; // v1.0 → v1.1
    delete cues.volume;
    return { ...DEFAULTS, ...raw, cues };
  } catch (e) { return structuredClone(DEFAULTS); }
}
let data = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('Could not save', e); } }

export const Store = {
  get cues() { return { ...data.cues }; },
  setCues(c) { data.cues = { ...data.cues, ...c }; save(); },
  get hyperAck() { return !!data.hyperAck; },
  acknowledgeHyper() { data.hyperAck = true; save(); },
  get theme() { return data.theme; },
  setTheme(t) { data.theme = t; save(); },
  get night() { return !!data.night; },
  setNight(v) { data.night = !!v; save(); },
  get history() { return (data.history || []).map(History.decode).filter(Boolean); },
  add(e) { data.history = [...(data.history || []), History.encode(e)].slice(-1000); save(); },
  clearHistory() { data.history = []; save(); },
};
