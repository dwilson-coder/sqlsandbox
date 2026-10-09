import { runScript } from '../../db/sql-runner.js';

const PLACEHOLDER = `<div class="output-placeholder">⚡ Run a query to see results here. Type HELP; for a list of commands.</div>`;

function formatCell(v) {
  if (v === null || v === undefined) {
    const s = document.createElement('span');
    s.className = 'null-val';
    s.textContent = 'NULL';
    return s;
  }
  if (v instanceof Uint8Array) return document.createTextNode(`<BLOB ${v.length} bytes>`);
  return document.createTextNode(String(v));
}

export const Output = {
  el: null,
  content: null,
  running: false,

  mount(el) {
    this.content = el;
    this.content.innerHTML = PLACEHOLDER;
  },

  clear() {
    this.content.innerHTML = PLACEHOLDER;
  },

  async execute(code) {
    if (this.running) return;
    this.running = true;
    this._dropPlaceholder();
    try {
      const { items, schemaChanged } = await runScript(code);
      for (const item of items) this._render(item);
      if (schemaChanged) window.dispatchEvent(new CustomEvent('sqlsandbox:changed'));
    } catch (e) {
      this.print(`✗ ${e.message}`, 'error');
    } finally {
      this.running = false;
    }
  },

  _dropPlaceholder() {
    const ph = this.content.querySelector('.output-placeholder');
    if (ph) ph.remove();
  },

  _render(item) {
    if (item.kind === 'query') {
      const oneLine = item.text.replace(/\s+/g, ' ');
      this.print(`> ${oneLine.length > 160 ? oneLine.slice(0, 157) + '…' : oneLine}`, 'query');
    } else if (item.kind === 'table') {
      this.printTable(item.columns, item.values);
    } else if (item.kind === 'message') {
      const icon = item.type === 'success' ? '✓ ' : item.type === 'error' ? '✗ ' : '';
      this.print(icon + item.text, item.type);
    }
  },

  print(msg, type = 'info') {
    const div = document.createElement('div');
    div.className = `output-line output-${type}`;
    div.textContent = msg;
    this.content.appendChild(div);
    this.content.scrollTop = this.content.scrollHeight;
  },

  printTable(columns, values) {
    const wrap = document.createElement('div');
    wrap.className = 'output-table-wrap';
    const table = document.createElement('table');
    table.className = 'output-table';

    const headRow = table.createTHead().insertRow();
    for (const c of columns) {
      const th = document.createElement('th');
      th.textContent = c;
      headRow.appendChild(th);
    }
    const body = table.createTBody();
    for (const row of values) {
      const tr = body.insertRow();
      for (const v of row) tr.insertCell().appendChild(formatCell(v));
    }
    wrap.appendChild(table);
    this.content.appendChild(wrap);
    this.content.scrollTop = this.content.scrollHeight;
  },
};
