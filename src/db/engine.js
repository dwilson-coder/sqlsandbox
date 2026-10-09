// src/db/engine.js
import initSqlJs from 'sql.js';
import { bytesToBase64, base64ToBytes } from '../utils/helpers.js';

let SQL = null;

// One live connection per database id. Everything in the app (sidebar, SQL editor,
// sample loaders) goes through loadDatabase(), so they all see the same data.
// Previously each caller opened its own copy from the saved blob, so tables created
// in the sidebar were invisible to the editor and vice versa.
const connections = new Map();

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
  const id = crypto.randomUUID();
  const record = { id, name, dbBlob: bytesToBase64(db.export()) };
  connections.set(id, db);
  store.state.databases.push(record);
  store.save();
  return record;
}

export async function loadDatabase(dbRecord) {
  if (connections.has(dbRecord.id)) return connections.get(dbRecord.id);
  const SQL = await initEngine();
  const db = dbRecord.dbBlob ? new SQL.Database(base64ToBytes(dbRecord.dbBlob)) : new SQL.Database();
  connections.set(dbRecord.id, db);
  return db;
}

/** Serialize a live connection back into its record and persist to storage. */
export async function persistDatabase(dbRecord, dbInstance) {
  const { store } = await import('../state/store.js');
  dbRecord.dbBlob = bytesToBase64(dbInstance.export());
  store.save();
}

export async function deleteDatabase(id) {
  const { store } = await import('../state/store.js');
  const conn = connections.get(id);
  if (conn) {
    try { conn.close(); } catch { /* already closed */ }
    connections.delete(id);
  }
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
  const result = dbInstance.exec(`PRAGMA table_info("${String(tableName).replace(/"/g, '""')}")`);
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
  dbInstance.run(`DROP TABLE IF EXISTS "${String(tableName).replace(/"/g, '""')}"`);
}
