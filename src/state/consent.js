// src/state/consent.js
// Cookie / local-storage consent. "Essential" storage (your databases, this consent
// choice) is always on because the app can't work without it. Everything else is opt-in.
const KEY = 'sqlsandbox_consent';
const VERSION = 1;

export const STORAGE_KEYS = ['sqlsandbox_state', 'sqlsandbox_dbs', KEY];

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.v === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

let current = read();

function write(prefs) {
  current = { v: VERSION, preferences: !!prefs.preferences, analytics: !!prefs.analytics, ts: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent('sqlsandbox:consent', { detail: current }));
}

export const Consent = {
  hasDecided() { return current !== null; },
  /** category: 'necessary' | 'preferences' | 'analytics' */
  allowed(category) {
    if (category === 'necessary') return true;
    return !!(current && current[category]);
  },
  get() { return current ? { ...current } : { preferences: false, analytics: false }; },
  set(prefs) { write(prefs); },
  acceptAll() { write({ preferences: true, analytics: true }); },
  rejectOptional() { write({ preferences: false, analytics: false }); },
  /** Remove everything this app has stored in this browser, then reload. */
  eraseEverything() {
    for (const k of STORAGE_KEYS) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
    current = null;
    location.reload();
  },
};
