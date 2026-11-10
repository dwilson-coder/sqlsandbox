// src/state/store.js
import { Consent } from './consent.js';

const STORAGE_KEY = 'sqlsandbox_state';
const DB_BLOB_KEY = 'sqlsandbox_dbs';
const DEFAULT_LAYOUT = { orientation: 'vertical', editorFirst: false };

export const store = {
  state: {
    databases: [],
    currentDbId: null,
    currentTable: null,
    tables: [],
    columns: [],
    theme: 'dark',
    // Panel layout: 'vertical' = stacked, 'horizontal' = side by side; editorFirst swaps the panels.
    layout: { orientation: 'vertical', editorFirst: false },
    queryHistory: [],
  },

  init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // The saved theme is only honoured if the user allowed "Preferences" cookies.
        if (!Consent.allowed('preferences')) { delete parsed.theme; delete parsed.layout; }
        this.state = { ...this.state, ...parsed };
        this.state.layout = { ...DEFAULT_LAYOUT, ...(parsed.layout || {}) };
      }
    } catch (e) {
      console.warn('Failed to restore state:', e);
    }
    // Restore db blobs separately
    try {
      const blobs = localStorage.getItem(DB_BLOB_KEY);
      if (blobs) {
        const blobMap = JSON.parse(blobs);
        this.state.databases.forEach(db => {
          if (blobMap[db.id]) db.dbBlob = blobMap[db.id];
        });
      }
    } catch (e) {
      console.warn('Failed to restore db blobs:', e);
    }
  },

  save() {
    try {
      // Save metadata without dbBlob (keeps localStorage light)
      const { databases, ...rest } = this.state;
      const meta = {
        ...rest,
        theme: Consent.allowed('preferences') ? rest.theme : 'dark',
        layout: Consent.allowed('preferences') ? rest.layout : DEFAULT_LAYOUT,
        databases: databases.map(({ dbBlob, ...d }) => d),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));

      // Save blobs separately
      const blobMap = {};
      databases.forEach(d => { if (d.dbBlob) blobMap[d.id] = d.dbBlob; });
      localStorage.setItem(DB_BLOB_KEY, JSON.stringify(blobMap));
    } catch (e) {
      console.warn('Save failed (quota?):', e);
    }
  },

  toggleTheme() {
    this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
  },

  setTheme(theme) {
    this.state.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.state.theme);
    this.save();
    window.dispatchEvent(new CustomEvent('sqlsandbox:theme', { detail: { theme: this.state.theme } }));
  },

  setLayout(changes) {
    const next = { ...DEFAULT_LAYOUT, ...this.state.layout, ...changes };
    if (next.orientation !== 'horizontal') next.orientation = 'vertical';
    next.editorFirst = !!next.editorFirst;
    this.state.layout = next;
    this.save();
    window.dispatchEvent(new CustomEvent('sqlsandbox:layout', { detail: next }));
  },
};

// Re-save when the user changes their cookie choices so the theme is stored (or dropped) straight away.
if (typeof window !== 'undefined') {
  window.addEventListener('sqlsandbox:consent', () => store.save());
}
