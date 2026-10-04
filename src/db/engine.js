// src/db/engine.js
import initSqlJs from 'sql.js';

let SQL = null;

export async function initEngine() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });
  }
  return SQL;
}

export async function createDatabase(name) {
  const { store } = await import('../state/store.js');
  const SQL = await initEngine();
  const db = new SQL.Database();
  const blob = db.export();
  const id = crypto.randomUUID();
  const record = { id, name, dbBlob: btoa(String.fromCharCode(...new Uint8Array(blob))) };
  store.state.databases.push(record);
  store.save();
  return record;
}

export async function loadDatabase(dbRecord) {
  const SQL = await initEngine();
  const bytes = Uint8Array.from(atob(dbRecord.dbBlob), c => c.charCodeAt(0));
  return new SQL.Database(bytes);
}

export async function deleteDatabase(id) {
  const { store } = await import('../state/store.js');
  store.state.databases = store.state.databases.filter(d => d.id !== id);
  if (store.state.currentDbId === id) {
    store.state.currentDbId = null;
    store.state.tables = [];
    store.state.columns = [];
    store.state.currentTable = null;
  }
  store.save();
}

export function getTables(dbInstance) {
  const result = dbInstance.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  if (result.length === 0) return [];
  return result[0].values.map(row => row[0]);
}

export function getColumns(dbInstance, tableName) {
  const result = dbInstance.exec(`PRAGMA table_info("${tableName}")`);
  if (result.length === 0) return [];
  return result[0].values.map(row => ({
    name: row[1],
    type: row[2] || 'TEXT',
  }));
}

export function createTable(dbInstance, tableName, columnsDef) {
  dbInstance.run(`CREATE TABLE IF NOT EXISTS "${tableName}" (${columnsDef})`);
}

export function deleteTable(dbInstance, tableName) {
  dbInstance.run(`DROP TABLE IF EXISTS "${tableName}"`);
}   