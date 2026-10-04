// src/ui/layout/Terminal.js
// src/ui/layout/Terminal.js
import { store } from '../../state/store.js';
import { initEngine, loadDatabase } from '../../db/engine.js';   
let currentDb = null;

export const Terminal = {
  mount(el) {
    this.el = el;
    this.el.innerHTML = `
      <div class="terminal-header" style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">
        OUTPUT
      </div>
      <div id="terminal-output"></div>
    `;
    this.output = document.getElementById('terminal-output');
  },

  async execute(code) {
    this.print(`> ${code}`, 'query');

    if (!store.state.currentDbId) {
      this.print('⚠ No database selected. Create one from the sidebar.', 'error');
      return;
    }

    try {
      const dbRecord = store.state.databases.find(d => d.id === store.state.currentDbId);
      if (!dbRecord) {
        this.print('⚠ Database not found.', 'error');
        return;
      }

      if (!currentDb || currentDb._id !== store.state.currentDbId) {
        currentDb = await loadDatabase(dbRecord);
        currentDb._id = store.state.currentDbId;
      }

      const result = currentDb.exec(code);

      if (result.length === 0) {
        this.print('✓ Executed successfully (no rows returned).', 'success');
      } else {
        const { columns, values } = result[0];
        this.printTable(columns, values);
      }

      // Save modified DB back
      const blob = currentDb.export();
      dbRecord.dbBlob = btoa(String.fromCharCode(...new Uint8Array(blob)));
      store.save();

    } catch (e) {
      this.print(`✗ ${e.message}`, 'error');
    }
  },

  print(msg, type = 'info') {
    const colors = { query: 'var(--accent)', success: '#4ec9b0', error: '#f44747', info: 'var(--text)' };
    const div = document.createElement('div');
    div.style.cssText = `padding:2px 0;color:${colors[type] || colors.info};white-space:pre-wrap;font-size:13px;`;
    div.textContent = msg;
    this.output.appendChild(div);
    this.output.scrollTop = this.output.scrollHeight;
  },

  printTable(columns, values) {
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;margin:6px 0;font-size:12px;width:100%;';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>${columns.map(c => `<th style="border:1px solid var(--border);padding:4px 8px;background:var(--bg-header);text-align:left;">${c}</th>`).join('')}</tr>`;
    const tbody = document.createElement('tbody');
    tbody.innerHTML = values.map(row =>
      `<tr>${row.map(v => `<td style="border:1px solid var(--border);padding:4px 8px;">${v ?? 'NULL'}</td>`).join('')}</tr>`
    ).join('');
    table.appendChild(thead);
    table.appendChild(tbody);
    this.output.appendChild(table);
    this.output.scrollTop = this.output.scrollHeight;
  },
};   