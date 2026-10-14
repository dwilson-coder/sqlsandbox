// src/ui/layout/Sidebar.js
import { store } from '../../state/store.js';
import { createDatabase, loadDatabase, persistDatabase, deleteDatabase, getTables, getColumns, createTable, deleteTable } from '../../db/engine.js';
import { escapeHtml } from '../../utils/helpers.js';

const SQL_TYPES = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATE', 'DATETIME'];

export const Sidebar = {
  el: null,

  mount(el) {
    this.el = el;
    this.render();

    // Typing CREATE DATABASE / USE / CREATE TABLE / DROP … in the editor updates the tree.
    window.addEventListener('sqlsandbox:changed', () => this.refresh());

    // Single click: action buttons only
    el.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const id = target.dataset.id;

      switch (action) {
        case 'new-db':
          await this.promptNewDatabase();
          break;
        case 'refresh':
          await this.refresh();
          break;
        case 'delete-db':
          this.confirmDeleteDatabase(id);
          break;
        case 'new-table':
          this.openTableModal(id);
          break;
        case 'delete-table':
          this.confirmDeleteTable(id);
          break;
        case 'load-sample':
          await this.loadSample();
          break;
      }
    });

    // Double click: select database OR table
    el.addEventListener('dblclick', async (e) => {
      const target = e.target.closest('[data-action="select-db"], [data-action="select-table"]');
      if (!target) return;

      const action = target.dataset.action;
      const id = target.dataset.id;

      if (action === 'select-db') {
        await this.selectDatabase(id);
      } else if (action === 'select-table') {
        await this.selectTable(id);
      }
    });
  },

  render() {
    const dbs = store.state.databases;
    let html = `
      <div class="sidebar-section">
        <div class="sidebar-section-header">
          <span>📁 DATABASES</span>
          <div class="header-btns">
            <button data-action="refresh" title="Refresh" class="sidebar-btn">⟳</button>
            <button data-action="new-db" title="New Database" class="sidebar-btn">+</button>
          </div>
        </div>
        <div class="db-list">
    `;

    if (dbs.length === 0) {
      html += `<div class="sidebar-empty">No databases yet.<br><button data-action="new-db" class="sidebar-link">+ Create one</button></div>`;
    }

    for (const db of dbs) {
      const isActive = db.id === store.state.currentDbId;
      html += `
        <div class="tree-item db-item ${isActive ? 'active' : ''}" data-action="select-db" data-id="${db.id}" title="Double-click to open">
          <span class="tree-icon">${isActive ? '📂' : '📁'}</span>
          <span class="tree-label">${escapeHtml(db.name)}</span>
          <span class="tree-actions">
            <button data-action="new-table" data-id="${db.id}" title="New Table" class="tree-btn">+</button>
            <button data-action="delete-db" data-id="${db.id}" title="Delete" class="tree-btn danger">✕</button>
          </span>
        </div>
      `;

      if (isActive && store.state.tables.length > 0) {
        for (const table of store.state.tables) {
          const isTableActive = table === store.state.currentTable;
          html += `
            <div class="tree-item table-item ${isTableActive ? 'active' : ''}" data-action="select-table" data-id="${escapeHtml(table)}" title="Double-click to select">
              <span class="tree-icon">📋</span>
              <span class="tree-label">${escapeHtml(table)}</span>
              <span class="tree-actions">
                <button data-action="delete-table" data-id="${escapeHtml(table)}" title="Delete" class="tree-btn danger">✕</button>
              </span>
            </div>
          `;

          if (isTableActive && store.state.columns.length > 0) {
            for (const col of store.state.columns) {
              html += `
                <div class="tree-item column-item">
                  <span class="tree-icon">🔹</span>
                  <span class="tree-label">${escapeHtml(col.name)} <span class="col-type">${escapeHtml(col.type)}</span></span>
                </div>
              `;
            }
          }
        }
      }
    }

    html += `
        </div>
        <div class="sidebar-footer">
          <button data-action="load-sample" class="sidebar-link">📦 Load Sample Data</button>
        </div>
      </div>
    `;

    this.el.innerHTML = html;
  },

  // ─── ACTIONS ─────────────────────────────────────────────────────────

  async selectDatabase(id) {
    store.state.currentDbId = id;
    store.state.currentTable = null;
    store.state.columns = [];

    const db = store.state.databases.find(d => d.id === id);
    if (db) {
      const dbInstance = await loadDatabase(db);
      store.state.tables = getTables(dbInstance);
    }
    store.save();
    this.render();
  },

  async selectTable(tableName) {
    store.state.currentTable = tableName;
    const db = store.state.databases.find(d => d.id === store.state.currentDbId);
    if (db) {
      const dbInstance = await loadDatabase(db);
      store.state.columns = getColumns(dbInstance, tableName);
    }
    store.save();
    this.render();
    window.dispatchEvent(new CustomEvent('sqlsandbox:activeTableChanged', { detail: { tableName } }));
  },

  async promptNewDatabase() {
    const name = prompt('Database name:');
    if (!name) return;
    try {
      await createDatabase(name);
    } catch (e) {
      console.error('Create DB failed:', e);
    }
    this.render();
    const last = store.state.databases[store.state.databases.length - 1];
    if (last) await this.selectDatabase(last.id);
  },

  confirmDeleteDatabase(id) {
    const db = store.state.databases.find(d => d.id === id);
    if (!db) return;
    if (confirm(`Delete database "${db.name}"? This cannot be undone.`)) {
      deleteDatabase(id);
      this.render();
    }
  },

  confirmDeleteTable(tableName) {
    if (!confirm(`Delete table "${tableName}"?`)) return;
    const db = store.state.databases.find(d => d.id === store.state.currentDbId);
    if (!db) return;

    loadDatabase(db).then(async dbInstance => {
      deleteTable(dbInstance, tableName);
      await persistDatabase(db, dbInstance);
      store.state.tables = getTables(dbInstance);
      store.state.currentTable = null;
      store.state.columns = [];
      store.save();
      this.render();
    });
  },

  async refresh() {
    if (store.state.currentDbId) {
      const db = store.state.databases.find(d => d.id === store.state.currentDbId);
      if (db) {
        const dbInstance = await loadDatabase(db);
        store.state.tables = getTables(dbInstance);
        if (store.state.currentTable && !store.state.tables.includes(store.state.currentTable)) {
          store.state.currentTable = null;
          store.state.columns = [];
        }
        if (store.state.currentTable) {
          store.state.columns = getColumns(dbInstance, store.state.currentTable);
        }
      }
    } else {
      store.state.tables = [];
      store.state.currentTable = null;
      store.state.columns = [];
    }
    store.save();
    this.render();
  },

  async loadSample() {
    const { loadSampleData } = await import('../../db/sample-datasets.js');
    await loadSampleData();
    this.render();
    const last = store.state.databases[store.state.databases.length - 1];
    if (last) await this.selectDatabase(last.id);
  },

  // ─── TABLE CREATION MODAL ────────────────────────────────────────────

  openTableModal(dbId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>📋 Create Table</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Table Name</label>
          <input type="text" id="tbl-name" placeholder="e.g. customers" class="form-input" />

          <div class="fields-section">
            <div class="fields-header">
              <label class="form-label">Columns</label>
              <button id="btn-add-field" class="btn-add-field">+ Add Column</button>
            </div>
            <div id="fields-list" class="fields-list"></div>
          </div>

          <div class="modal-preview">
            <label class="form-label">SQL Preview</label>
            <pre id="sql-preview" class="sql-preview"></pre>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-cancel" class="btn-secondary">Cancel</button>
          <button id="btn-create" class="btn-primary">Create Table</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const fieldsList = overlay.querySelector('#fields-list');
    const sqlPreview = overlay.querySelector('#sql-preview');
    let fields = [];

    function addField() {
      fields.push({ name: '', type: 'TEXT', pk: false, autoInc: false, notNull: false, unique: false, defaultValue: '' });
      renderFields();
    }

    function removeField(idx) {
      fields.splice(idx, 1);
      renderFields();
    }

    function renderFields() {
      fieldsList.innerHTML = fields.map((f, i) => `
        <div class="field-row" data-idx="${i}">
          <input type="text" class="form-input field-name" placeholder="name" value="${escapeHtml(f.name)}" data-prop="name" />
          <select class="form-select field-type" data-prop="type">
            ${SQL_TYPES.map(t => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <div class="field-constraints">
            <label class="chk"><input type="checkbox" data-prop="pk" ${f.pk ? 'checked' : ''} /> PK</label>
            <label class="chk" ${f.pk ? '' : 'disabled'}><input type="checkbox" data-prop="autoInc" ${f.autoInc ? 'checked' : ''} /> Auto</label>
            <label class="chk"><input type="checkbox" data-prop="notNull" ${f.notNull ? 'checked' : ''} /> NN</label>
            <label class="chk"><input type="checkbox" data-prop="unique" ${f.unique ? 'checked' : ''} /> UQ</label>
          </div>
          <input type="text" class="form-input field-default" placeholder="default" value="${escapeHtml(f.defaultValue)}" data-prop="defaultValue" />
          <button class="btn-remove-field" data-remove="${i}" title="Remove">✕</button>
        </div>
      `).join('');

      fieldsList.querySelectorAll('.field-row').forEach(row => {
        const idx = parseInt(row.dataset.idx);
        row.querySelectorAll('[data-prop]').forEach(input => {
          const handler = () => {
            const prop = input.dataset.prop;
            if (input.type === 'checkbox') {
              fields[idx][prop] = input.checked;
              if (prop === 'pk' && !input.checked) fields[idx].autoInc = false;
              if (prop === 'pk' && input.checked) fields[idx].type = 'INTEGER';
            } else {
              fields[idx][prop] = input.value;
            }
            renderFields();
            updatePreview();
          };
          input.addEventListener('input', handler);
          input.addEventListener('change', handler);
        });
      });

      fieldsList.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => removeField(parseInt(btn.dataset.remove)));
      });

      updatePreview();
    }

    function buildSQL() {
      const tableName = overlay.querySelector('#tbl-name').value.trim() || 'unnamed_table';
      const colDefs = fields
        .filter(f => f.name.trim())
        .map(f => {
          let def = `${f.name} ${f.type}`;
          if (f.pk) {
            def += ' PRIMARY KEY';
            if (f.autoInc) def += ' AUTOINCREMENT';
          }
          if (f.notNull && !f.pk) def += ' NOT NULL';
          if (f.unique) def += ' UNIQUE';
          if (f.defaultValue) def += ` DEFAULT ${f.defaultValue}`;
          return def;
        });
      return `CREATE TABLE ${tableName} (\n  ${colDefs.join(',\n  ')}\n);`;
    }

    function updatePreview() {
      sqlPreview.textContent = buildSQL();
    }

    overlay.querySelector('#btn-add-field').addEventListener('click', addField);
    overlay.querySelector('#tbl-name').addEventListener('input', updatePreview);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btn-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#btn-create').addEventListener('click', async () => {
      const tableName = overlay.querySelector('#tbl-name').value.trim();
      if (!tableName) { alert('Please enter a table name.'); return; }
      const validFields = fields.filter(f => f.name.trim());
      if (validFields.length === 0) { alert('Please add at least one column.'); return; }

      const colDefs = validFields.map(f => {
        let def = `${f.name} ${f.type}`;
        if (f.pk) {
          def += ' PRIMARY KEY';
          if (f.autoInc) def += ' AUTOINCREMENT';
        }
        if (f.notNull && !f.pk) def += ' NOT NULL';
        if (f.unique) def += ' UNIQUE';
        if (f.defaultValue) def += ` DEFAULT ${f.defaultValue}`;
        return def;
      });

      const db = store.state.databases.find(d => d.id === dbId);
      if (!db) return;

      try {
        const dbInstance = await loadDatabase(db);
        dbInstance.run(`CREATE TABLE "${tableName.replace(/"/g, '""')}" (${colDefs.join(', ')})`);
        await persistDatabase(db, dbInstance);
        store.state.tables = getTables(dbInstance);
        store.save();
        overlay.remove();
        this.render();
      } catch (e) {
        alert(`Error: ${e.message}`);
      }
    });

    addField();
  },
};   