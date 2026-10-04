import { SQL_COMMANDS } from '../../commands/sql-commands.js';
import { Editor } from '../layout/Editor.js';

export function open() {
  const overlay = document.createElement('div');
  overlay.id = 'command-palette';
  overlay.innerHTML = `
    <div class="palette-container">
      <input type="text" id="palette-input" placeholder="Search SQL commands…" autocomplete="off" />
      <div id="palette-results" class="palette-results"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('palette-input');
  const results = document.getElementById('palette-results');
  input.focus();

  function render(list) {
    results.innerHTML = list.map((item, i) => `
      <div class="palette-item" data-index="${i}">
        <span class="palette-cmd">${item.cmd}</span>
        <span class="palette-desc">${item.desc}</span>
        <span class="palette-cat">${item.category}</span>
      </div>
    `).join('');

    results.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => {
        Editor.insertText(item.cmd + ' ');
        overlay.remove();
      });
    });
  }

  function filter(query) {
    if (!query) return SQL_COMMANDS;
    const q = query.toLowerCase();
    return SQL_COMMANDS.filter(c =>
      c.cmd.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }

  input.addEventListener('input', () => render(filter(input.value)));
  render(SQL_COMMANDS);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}   