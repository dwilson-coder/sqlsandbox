// src/db/sql-runner.js
// Runs whatever the user types or pastes: any number of statements, any mix of
// plain SQLite and the MySQL-style commands SQLite lacks (CREATE DATABASE, USE,
// SHOW …, DESCRIBE, TRUNCATE, …).
import { store } from '../state/store.js';
import {
  createDatabase, deleteDatabase, loadDatabase, persistDatabase, getTables,
} from './engine.js';
import { splitStatements, parseCommand, adaptMySQL, firstKeyword, sqlString, sqlIdent } from './sql-parse.js';

const DML = new Set(['INSERT', 'UPDATE', 'DELETE', 'REPLACE']);
const SCHEMA_CHANGING = new Set(['CREATE', 'DROP', 'ALTER']);
const READ_ONLY = new Set(['SELECT', 'EXPLAIN', 'VALUES']);

const HELP_TEXT = [
  'Database commands:',
  '  CREATE DATABASE name;     create a database',
  '  SHOW DATABASES;           list databases',
  '  USE name;                 switch to a database',
  '  DROP DATABASE name;       delete a database',
  'Table commands:',
  '  SHOW TABLES;              list tables in the current database',
  '  DESCRIBE table;           show columns (also: DESC table, SHOW COLUMNS FROM table)',
  '  SHOW CREATE TABLE table;  show the CREATE statement',
  '  SHOW INDEX FROM table;    list indexes',
  '  TRUNCATE TABLE table;     delete all rows',
  'Everything else is standard SQLite: CREATE TABLE, INSERT, SELECT, UPDATE, DELETE, ALTER TABLE, JOINs, views, triggers, PRAGMAs …',
  'You can paste a whole script — statements run in order and stop at the first error.',
].join('\n');

const msg = (type, text) => ({ kind: 'message', type, text });

function currentRecord() {
  return store.state.databases.find(d => d.id === store.state.currentDbId) || null;
}

function findDatabase(name) {
  const n = name.trim().toLowerCase();
  return store.state.databases.find(d => d.name.trim().toLowerCase() === n) || null;
}

async function requireDb() {
  const rec = currentRecord();
  if (!rec) {
    throw new Error('No database selected. Run CREATE DATABASE name; then USE name; (or double-click a database in the sidebar).');
  }
  return { rec, db: await loadDatabase(rec) };
}

function rowsOf(db, sql) {
  const r = db.exec(sql);
  return r.length ? r[0].values : [];
}

function resolveTable(db, name) {
  const rows = rowsOf(db, `SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND lower(name) = lower(${sqlString(name)})`);
  return rows.length ? rows[0][0] : null;
}

function friendlyError(message, stmt) {
  let hint = '';
  if (/near "AUTO_INCREMENT"/i.test(message)) hint = 'SQLite spells it AUTOINCREMENT (no underscore) and it only works on an INTEGER PRIMARY KEY column.';
  else if (/near "(ENGINE|CHARSET|COLLATE)"/i.test(message)) hint = 'SQLite has no ENGINE / CHARSET table options — remove them.';
  else if (/^ALTER/i.test(stmt) && /near "(MODIFY|CHANGE|ALTER)"/i.test(message)) hint = 'SQLite ALTER TABLE supports RENAME TO, RENAME COLUMN, ADD COLUMN and DROP COLUMN only.';
  else if (/no such table/i.test(message)) hint = 'Run SHOW TABLES; to see what exists in the current database.';
  else if (/no such column/i.test(message)) hint = 'Run DESCRIBE table_name; to see the column names.';
  else if (/already exists/i.test(message) && /^CREATE\s+TABLE/i.test(stmt)) hint = 'Use CREATE TABLE IF NOT EXISTS …, or DROP TABLE first.';
  return hint ? `${message}\n💡 ${hint}` : message;
}

/** Save the current database if this script has modified it. */
async function flush(out, flags) {
  const rec = currentRecord();
  if (!flags.dirty || !rec) { flags.dirty = false; return; }
  flags.dirty = false;
  try {
    const db = await loadDatabase(rec);
    await persistDatabase(rec, db);
    if (flags.schemaChanged) { store.state.tables = getTables(db); store.save(); }
  } catch (e) {
    out.push(msg('error', `Could not save the database: ${e.message}`));
  }
}

// ── MySQL-style commands ────────────────────────────────────────────────────────
async function runCommand(cmd, out, flags) {
  switch (cmd.type) {
    case 'help':
      out.push(msg('info', HELP_TEXT));
      return;

    case 'create-db': {
      if (findDatabase(cmd.name)) {
        if (cmd.ifNotExists) { out.push(msg('info', `Database '${cmd.name}' already exists.`)); return; }
        throw new Error(`Can't create database '${cmd.name}'; database exists.`);
      }
      await createDatabase(cmd.name);
      flags.schemaChanged = true;
      out.push(msg('success', `Database '${cmd.name}' created. Run USE ${cmd.name}; to switch to it.`));
      return;
    }

    case 'drop-db': {
      const rec = findDatabase(cmd.name);
      if (!rec) {
        if (cmd.ifExists) { out.push(msg('info', `Database '${cmd.name}' doesn't exist.`)); return; }
        throw new Error(`Can't drop database '${cmd.name}'; database doesn't exist.`);
      }
      const wasCurrent = rec.id === store.state.currentDbId;
      await deleteDatabase(rec.id);
      flags.schemaChanged = true;
      out.push(msg('success', `Database '${rec.name}' dropped.${wasCurrent ? ' No database is selected now — run USE name; to pick one.' : ''}`));
      return;
    }

    case 'use': {
      const rec = findDatabase(cmd.name);
      if (!rec) throw new Error(`Unknown database '${cmd.name}'. Run SHOW DATABASES; to see what exists.`);
      await flush(out, flags); // save work done in the database we're leaving
      const db = await loadDatabase(rec);
      store.state.currentDbId = rec.id;
      store.state.currentTable = null;
      store.state.columns = [];
      store.state.tables = getTables(db);
      store.save();
      flags.schemaChanged = true;
      out.push(msg('success', `Database changed to '${rec.name}'.`));
      return;
    }

    case 'show-dbs': {
      const cur = store.state.currentDbId;
      out.push({
        kind: 'table',
        columns: ['Database', 'In use'],
        values: store.state.databases.map(d => [d.name, d.id === cur ? '●' : '']),
      });
      out.push(msg('success', `${store.state.databases.length} database(s).`));
      return;
    }

    case 'select-db': {
      const rec = currentRecord();
      out.push({ kind: 'table', columns: ['DATABASE()'], values: [[rec ? rec.name : null]] });
      return;
    }

    case 'show-tables': {
      const { rec, db } = await requireDb();
      const rows = rowsOf(db, `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`);
      out.push({ kind: 'table', columns: [`Tables_in_${rec.name}`, 'Type'], values: rows.map(r => [r[0], r[1] === 'view' ? 'VIEW' : 'BASE TABLE']) });
      out.push(msg('success', `${rows.length} table(s).`));
      return;
    }

    case 'describe': {
      const { rec, db } = await requireDb();
      const table = resolveTable(db, cmd.name);
      if (!table) throw new Error(`Table '${cmd.name}' doesn't exist in database '${rec.name}'.`);
      const ddl = (rowsOf(db, `SELECT sql FROM sqlite_master WHERE lower(name) = lower(${sqlString(table)}) AND type IN ('table','view')`)[0] || [''])[0] || '';
      const hasAuto = /AUTOINCREMENT/i.test(ddl);
      // PRAGMA columns: cid, name, type, notnull, dflt_value, pk
      const cols = rowsOf(db, `PRAGMA table_info(${sqlIdent(table)})`);
      out.push({
        kind: 'table',
        columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
        values: cols.map(c => [c[1], c[2] || '', c[3] ? 'NO' : 'YES', c[5] ? 'PRI' : '', c[4], c[5] && hasAuto ? 'auto_increment' : '']),
      });
      out.push(msg('success', `${cols.length} column(s).`));
      return;
    }

    case 'show-create': {
      const { rec, db } = await requireDb();
      const table = resolveTable(db, cmd.name);
      if (!table) throw new Error(`Table '${cmd.name}' doesn't exist in database '${rec.name}'.`);
      const rows = rowsOf(db, `SELECT name, sql FROM sqlite_master WHERE lower(name) = lower(${sqlString(table)}) AND type IN ('table','view')`);
      out.push({ kind: 'table', columns: ['Table', 'Create Table'], values: [rows[0]] });
      return;
    }

    case 'show-index': {
      const { rec, db } = await requireDb();
      const table = resolveTable(db, cmd.name);
      if (!table) throw new Error(`Table '${cmd.name}' doesn't exist in database '${rec.name}'.`);
      const values = [];
      for (const ix of rowsOf(db, `PRAGMA index_list(${sqlIdent(table)})`)) {
        // index_list: seq, name, unique, origin, partial
        for (const col of rowsOf(db, `PRAGMA index_info(${sqlIdent(ix[1])})`)) {
          values.push([table, ix[2] ? 0 : 1, ix[1], col[0] + 1, col[2]]);
        }
      }
      out.push({ kind: 'table', columns: ['Table', 'Non_unique', 'Key_name', 'Seq_in_index', 'Column_name'], values });
      out.push(msg('success', `${values.length} index column(s).`));
      return;
    }

    case 'truncate': {
      const { rec, db } = await requireDb();
      const table = resolveTable(db, cmd.name);
      if (!table) throw new Error(`Table '${cmd.name}' doesn't exist in database '${rec.name}'.`);
      db.run(`DELETE FROM ${sqlIdent(table)}`);
      const removed = db.getRowsModified();
      if (rowsOf(db, `SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'`).length) {
        db.run(`DELETE FROM sqlite_sequence WHERE name = ${sqlString(table)}`);
      }
      flags.dirty = true;
      out.push(msg('success', `Table '${table}' truncated (${removed} row(s) removed).`));
      return;
    }
  }
}

// ── Plain SQLite ─────────────────────────────────────────────────────────────
async function runNative(original, out, flags) {
  const { db } = await requireDb();
  const { sql: stmt, notes } = adaptMySQL(original);
  if (notes.length) out.push(msg('info', `↪ Adapted for SQLite: ${notes.join('; ')}`));
  const kw = firstKeyword(stmt);
  const results = db.exec(stmt);

  if (results.length) {
    for (const r of results) {
      out.push({ kind: 'table', columns: r.columns, values: r.values });
      out.push(msg('success', `${r.values.length} row(s) returned.`));
    }
  } else if (DML.has(kw)) {
    out.push(msg('success', `${db.getRowsModified()} row(s) affected.`));
  } else if (kw === 'SELECT' || kw === 'VALUES' || (kw === 'WITH' && !/\b(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(stmt))) {
    // sql.js returns no result set at all for a query that matches zero rows
    out.push(msg('success', '0 row(s) returned.'));
  } else {
    out.push(msg('success', 'OK'));
  }

  if (!READ_ONLY.has(kw)) flags.dirty = true;
  if (SCHEMA_CHANGING.has(kw)) flags.schemaChanged = true;
}

/**
 * Run a script. Resolves to { items, schemaChanged } where items is a list of
 *   { kind: 'query', text } | { kind: 'table', columns, values } | { kind: 'message', type, text }
 * Never throws: errors are reported as items.
 */
export async function runScript(sql) {
  const statements = splitStatements(sql);
  const out = [];
  const flags = { dirty: false, schemaChanged: false };

  if (statements.length === 0) {
    out.push(msg('info', 'Nothing to run — the editor only contains comments or whitespace.'));
    return { items: out, schemaChanged: false };
  }

  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      out.push({ kind: 'query', text: stmt });
      try {
        const cmd = parseCommand(stmt);
        if (cmd) await runCommand(cmd, out, flags);
        else await runNative(stmt, out, flags);
      } catch (e) {
        out.push(msg('error', friendlyError(e && e.message ? e.message : String(e), stmt)));
        if (statements.length > 1) {
          out.push(msg('info', `Stopped at statement ${i + 1} of ${statements.length}. Statements before it were kept.`));
        }
        break;
      }
    }
  } finally {
    // Persist whatever succeeded, even if a later statement failed.
    await flush(out, flags);
  }

  return { items: out, schemaChanged: flags.schemaChanged };
}
