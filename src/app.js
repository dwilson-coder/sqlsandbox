// src/app.js
import { Sidebar } from './ui/layout/Sidebar.js';
import { Editor } from './ui/layout/Editor.js';
import { Output } from './ui/layout/Output.js';
import { store } from './state/store.js';
import { showBannerIfNeeded, openSettings } from './ui/components/CookieConsent.js';
import { initLegalRouting } from './ui/pages/legal.js';

// Panel layout (stacked / side by side, either order) and the draggable divider.
const MIN_PANEL = 120;

function initPanelLayout() {
  const main = document.getElementById('main-area');
  const editor = document.getElementById('editor');
  const resizer = document.getElementById('editor-resizer');

  const isHorizontal = () => store.state.layout.orientation === 'horizontal'
    && !window.matchMedia('(max-width: 768px)').matches; // phones always stack

  const apply = () => {
    const { orientation, editorFirst } = store.state.layout;
    main.dataset.orientation = orientation;
    main.dataset.order = editorFirst ? 'editor-first' : 'output-first';
    // Start each layout from its default size
    editor.style.height = '';
    editor.style.width = '';
    resizer.setAttribute('aria-orientation', isHorizontal() ? 'vertical' : 'horizontal');
  };

  // Size the editor so the divider lands at the pointer position.
  const setEditorSize = (px) => {
    const rect = main.getBoundingClientRect();
    const total = isHorizontal() ? rect.width : rect.height;
    const size = Math.max(MIN_PANEL, Math.min(total - MIN_PANEL, px));
    if (isHorizontal()) { editor.style.width = size + 'px'; editor.style.height = ''; }
    else { editor.style.height = size + 'px'; editor.style.width = ''; }
  };
  const editorSizeAt = (clientX, clientY) => {
    const rect = main.getBoundingClientRect();
    const editorFirst = store.state.layout.editorFirst;
    if (isHorizontal()) return editorFirst ? clientX - rect.left : rect.right - clientX;
    return editorFirst ? clientY - rect.top : rect.bottom - clientY;
  };

  resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);
    main.classList.add('is-resizing');
    const move = (ev) => setEditorSize(editorSizeAt(ev.clientX, ev.clientY));
    const up = () => {
      main.classList.remove('is-resizing');
      resizer.removeEventListener('pointermove', move);
      resizer.removeEventListener('pointerup', up);
      resizer.removeEventListener('pointercancel', up);
    };
    resizer.addEventListener('pointermove', move);
    resizer.addEventListener('pointerup', up);
    resizer.addEventListener('pointercancel', up);
  });

  // Keyboard resizing: arrows move the divider 20px (40px with Shift)
  resizer.addEventListener('keydown', (e) => {
    const keys = isHorizontal() ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const step = (e.shiftKey ? 40 : 20) * (e.key === keys[0] ? -1 : 1);
    const r = resizer.getBoundingClientRect();
    const cx = r.left + r.width / 2 + (isHorizontal() ? step : 0);
    const cy = r.top + r.height / 2 + (isHorizontal() ? 0 : step);
    setEditorSize(editorSizeAt(cx, cy));
  });

  apply();
  window.addEventListener('sqlsandbox:layout', apply);
  window.matchMedia('(max-width: 768px)').addEventListener('change', apply);
}

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
              <button id="btn-diagram" title="View SQL Schema Diagram">📊 Diagram</button>
              <button id="btn-theme"></button>
              <button id="btn-settings" title="Settings">⚙️ Settings</button>
            </div>
          </header>
          <div class="app-body">
            <aside id="sidebar" class="sidebar"></aside>
            <main class="main-area" id="main-area">
              <div id="output" class="output-panel">
                <div class="panel-header">
                  <span class="panel-title">OUTPUT</span>
                  <button class="panel-action panel-btn" id="btn-clear-output" title="Clear the output">CLEAR</button>
                </div>
                <div id="output-content" class="output-content"></div>
              </div>
              <div class="editor-resizer" id="editor-resizer" role="separator" tabindex="0" aria-label="Resize editor and output panels (arrow keys)"></div>
              <div id="editor" class="editor-panel">
                <div class="panel-header">
                  <span class="panel-title">SQL EDITOR</span>
                  <span class="panel-header-right">
                    <span class="panel-hint">Ctrl+Enter to run · Ctrl+K to format</span>
                    <button class="panel-action panel-btn" id="btn-clear-editor" title="Clear the editor (Ctrl+Z to undo)">CLEAR</button>
                  </span>
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
      document.getElementById('btn-clear-editor').addEventListener('click', () => Editor.clear());
      document.getElementById('btn-settings').addEventListener('click', () => {
        import('./ui/modals/Settings.js').then(m => m.open());
      });
      document.getElementById('btn-palette').addEventListener('click', () => {
        import('./ui/components/CommandPalette.js').then(m => m.open());
      });
      document.getElementById('btn-diagram').addEventListener('click', () => {
        import('./ui/modals/SqlDiagram.js').then(m => m.open());
      });
      // Quick theme toggle (also available in Settings). Label always says what a click will do.
      const themeBtn = document.getElementById('btn-theme');
      const syncThemeBtn = () => {
        const toLight = store.state.theme === 'dark';
        themeBtn.textContent = toLight ? '☀️' : '🌙';
        themeBtn.title = toLight ? 'Switch to light mode' : 'Switch to dark mode';
        themeBtn.setAttribute('aria-label', themeBtn.title);
      };
      syncThemeBtn();
      themeBtn.addEventListener('click', () => store.toggleTheme());
      window.addEventListener('sqlsandbox:theme', syncThemeBtn);

      initPanelLayout();

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