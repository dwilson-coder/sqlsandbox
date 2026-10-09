import { SQL_COMMANDS } from '../../commands/sql-commands.js';
import { Editor } from '../layout/Editor.js';
import { escapeHtml } from '../../utils/helpers.js';

let openOverlay = null;

export function open() {
  if (openOverlay) { openOverlay.querySelector('#palette-input')?.focus(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'command-palette';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Search SQL commands');
  overlay.innerHTML = `
    <div class="palette-container">
      <input type="text" id="palette-input" placeholder="Search SQL commands…" autocomplete="off" aria-label="Search SQL commands" />
      <div id="palette-results" class="palette-results"></div>
      <div class="palette-footer">Click a command to see an example · Enter to expand · Esc to close</div>
    </div>
  `;
  document.body.appendChild(overlay);
  openOverlay = overlay;

  const input = overlay.querySelector('#palette-input');
  const results = overlay.querySelector('#palette-results');
  input.focus();

  let list = SQL_COMMANDS;
  let expanded = -1;   // index into `list` of the open item
  let active = 0;      // keyboard highlight

  function render() {
    if (list.length === 0) {
      results.innerHTML = `<div class="palette-empty">No commands match “${escapeHtml(input.value)}”.</div>`;
      return;
    }
    results.innerHTML = list.map((item, i) => `
      <div class="palette-entry ${i === expanded ? 'expanded' : ''} ${i === active ? 'active' : ''}" data-index="${i}">
        <div class="palette-item" role="button" tabindex="-1" aria-expanded="${i === expanded}">
          <span class="palette-caret">${i === expanded ? '▾' : '▸'}</span>
          <span class="palette-cmd">${escapeHtml(item.cmd)}</span>
          <span class="palette-desc">${escapeHtml(item.desc)}</span>
          <span class="palette-cat">${escapeHtml(item.category)}</span>
        </div>
        ${i === expanded ? `
          <div class="palette-detail">
            <div class="palette-detail-label">Example syntax</div>
            <pre class="palette-example">${escapeHtml(item.example || item.cmd)}</pre>
            <div class="palette-actions">
              <button type="button" class="btn-primary" data-do="insert">Insert into editor</button>
              <button type="button" class="btn-secondary" data-do="copy">Copy</button>
            </div>
          </div>` : ''}
      </div>
    `).join('');
    results.querySelector('.palette-entry.active')?.scrollIntoView({ block: 'nearest' });
  }

  function filter(query) {
    const q = query.trim().toLowerCase();
    if (!q) return SQL_COMMANDS;
    return SQL_COMMANDS.filter(c =>
      c.cmd.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }

  function toggle(i) {
    expanded = expanded === i ? -1 : i;
    active = i;
    render();
  }

  function insertExample(item) {
    Editor.insertText((item.example || item.cmd) + '\n');
    close();
  }

  async function copyExample(item, btn) {
    try {
      await navigator.clipboard.writeText(item.example || item.cmd);
      btn.textContent = 'Copied ✓';
    } catch {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  }

  // One delegated listener (the old per-row listeners referenced an out-of-scope variable and threw).
  results.addEventListener('click', (e) => {
    const entry = e.target.closest('.palette-entry');
    if (!entry) return;
    const i = Number(entry.dataset.index);
    const item = list[i];
    const action = e.target.closest('[data-do]')?.dataset.do;
    if (action === 'insert') insertExample(item);
    else if (action === 'copy') copyExample(item, e.target.closest('[data-do]'));
    else if (e.target.closest('.palette-item')) toggle(i);
  });

  input.addEventListener('input', () => {
    list = filter(input.value);
    expanded = list.length === 1 ? 0 : -1; // a single match opens straight away
    active = 0;
    render();
  });

  function close() {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    openOverlay = null;
    Editor.view?.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (!list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, list.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (expanded === active) insertExample(list[active]);
      else toggle(active);
    }
  }
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  render();
}
