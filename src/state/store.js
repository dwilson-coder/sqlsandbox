// src/state/store.js
import { Consent } from './consent.js';

const STORAGE_KEY = 'sqlsandbox_state';
const DB_BLOB_KEY = 'sqlsandbox_dbs';

export const store = {
  state: {
    databases: [],
    currentDbId: null,
    currentTable: null,
    tables: [],
    columns: [],
    theme: 'dark',
    queryHistory: [],
  },

  init() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // The saved theme is only honoured if the user allowed "Preferences" cookies.
        if (!Consent.allowed('preferences')) delete parsed.theme;
        this.state = { ...this.state, ...parsed };
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
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.state.theme);
    this.save();
  },
};

// Re-save when the user changes their cookie choices so the theme is stored (or dropped) straight away.
if (typeof window !== 'undefined') {
  window.addEventListener('sqlsandbox:consent', () => store.save());
}
