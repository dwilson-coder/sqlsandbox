// src/app.js
import { Sidebar } from './ui/layout/Sidebar.js';
import { Editor } from './ui/layout/Editor.js';
import { Output } from './ui/layout/Output.js';
import { store } from './state/store.js';
import { showBannerIfNeeded, openSettings } from './ui/components/CookieConsent.js';
import { initLegalRouting } from './ui/pages/legal.js';

export function createApp(root) {
  return {
    mount() {
      root.innerHTML = `
        <div class="app-shell">
          <header class="app-header">
            <div class="header-left">
              <img src="/logo.svg" alt="SQL Sandbox" class="logo" />
              <span class="app-title">SQL Sandbox</span>
              <span id="active-db-badge" class="active-db-badge"></span>
            </div>
            <div class="header-actions">
              <button id="btn-run" title="Run Query (Ctrl+Enter)">⚡ Run</button>
              <button id="btn-format" title="Format SQL (Ctrl+K)">✨ Format</button>
              <button id="btn-palette" title="Command Search (Ctrl+Shift+P)">🔍 Commands</button>
              <button id="btn-theme" title="Toggle Theme">🌙</button>
            </div>
          </header>
          <div class="app-body">
            <aside id="sidebar" class="sidebar"></aside>
            <main class="main-area">
              <div id="output" class="output-panel">
                <div class="panel-header">
                  <span class="panel-title">OUTPUT</span>
                  <button class="panel-action" id="btn-clear-output" title="Clear Output">✕</button>
                </div>
                <div id="output-content" class="output-content"></div>
              </div>
              <div class="editor-resizer"></div>
              <div id="editor" class="editor-panel">
                <div class="panel-header">
                  <span class="panel-title">SQL EDITOR</span>
                  <span class="panel-hint">Ctrl+Enter to run · Ctrl+K to format</span>
                </div>
                <div id="editor-container" class="editor-container"></div>
              </div>
            </main>
          </div>
          <footer class="app-footer">
            <div class="footer-left">
              <span>© ${new Date().getFullYear()} <a href="https://codeboxllc.net/" target="_blank" rel="noopener noreferrer">CodeBox LLC</a> — Built by Damion Wilson</span>
            </div>
            <div class="footer-right">
              <a href="#/privacy">Privacy Policy</a>
              <a href="#/terms">Terms of Service</a>
              <a href="#" id="link-cookie-settings">Cookie Settings</a>
              <span class="footer-sep" aria-hidden="true">|</span>
              <a href="https://codeboxllc.net/" target="_blank" rel="noopener noreferrer">Website</a>
              <a href="https://www.linkedin.com/in/damion-coder-wilson" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              <a href="https://bsky.app/profile/dwilsoncoder.bsky.social" target="_blank" rel="noopener noreferrer">Bluesky</a>
              <a href="https://github.com/dwilson-coder/sqlsandbox.git" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </footer>
        </div>
      `;

      Sidebar.mount(document.getElementById('sidebar'));
      Output.mount(document.getElementById('output-content'));
      Editor.mount(document.getElementById('editor-container'));

      // Active DB badge
      function updateActiveDbBadge() {
        const badge = document.getElementById('active-db-badge');
        if (!badge) return;
        const db = store.state.databases.find(d => d.id === store.state.currentDbId);
        badge.textContent = db ? `● ${db.name}` : '○ No database selected';
        badge.classList.toggle('active', !!db);
      }

      updateActiveDbBadge();

      // Watch sidebar mutations to keep badge in sync
      const observer = new MutationObserver(updateActiveDbBadge);
      observer.observe(document.getElementById('sidebar'), { childList: true, subtree: true });

      // Header buttons
      document.getElementById('btn-run').addEventListener('click', () => Editor.run());
      document.getElementById('btn-format').addEventListener('click', () => Editor.format());
      document.getElementById('btn-clear-output').addEventListener('click', () => Output.clear());
      document.getElementById('btn-palette').addEventListener('click', () => {
        import('./ui/components/CommandPalette.js').then(m => m.open());
      });
      document.getElementById('btn-theme').addEventListener('click', () => {
        store.toggleTheme();
        Editor.setTheme();
      });

      // Ctrl/Cmd+Shift+P opens command search from anywhere (including inside the editor)
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          import('./ui/components/CommandPalette.js').then(m => m.open());
        }
      }, true);

      // Legal pages + cookie control
      document.getElementById('link-cookie-settings').addEventListener('click', (e) => {
        e.preventDefault();
        openSettings();
      });
      initLegalRouting();
      showBannerIfNeeded();
    }
  };
}   