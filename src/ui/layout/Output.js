import { store } from '../../state/store.js';
import { loadDatabase } from '../../db/engine.js';

let currentDb = null;
let currentDbId = null;

export const Output = {
  el: null,
  content: null,

  mount(el) {
    this.content = el;
    this.content.innerHTML = `<div class="output-placeholder">⚡ Run a query to see results here.</div>`;
  },

  clear() {
    this.content.innerHTML = `<div class="output-placeholder">⚡ Run a query to see results here.</div>`;
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

      if (!currentDb || currentDbId !== store.state.currentDbId) {
        currentDb = await loadDatabase(dbRecord);
        currentDbId = store.state.currentDbId;
      }

      const result = currentDb.exec(code);

      if (result.length === 0) {
        this.print('✓ Executed successfully (no rows returned).', 'success');
      } else {
        const { columns, values } = result[0];
        this.printTable(columns, values);
        this.print(`✓ ${values.length} row(s) returned.`, 'success');
      }

      // Save modified DB
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
    div.className = `output-line output-${type}`;
    div.style.cssText = `padding:2px 0;color:${colors[type] || colors.info};white-space:pre-wrap;font-size:13px;`;
    div.textContent = msg;
    this.content.appendChild(div);
    this.content.scrollTop = this.content.scrollHeight;
  },

  printTable(columns, values) {
    const table = document.createElement('table');
    table.className = 'output-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
    const tbody = document.createElement('tbody');
    tbody.innerHTML = values.map(row =>
      `<tr>${row.map(v => `<td>${v === null ? '<span class="null-val">NULL</span>' : v}</td>`).join('')}</tr>`
    ).join('');
    table.appendChild(thead);
    table.appendChild(tbody);
    this.content.appendChild(table);
    this.content.scrollTop = this.content.scrollHeight;
  },
};   