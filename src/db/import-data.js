// src/db/import-data.js
// Import a user-chosen file into the sandbox. Uses only standard web APIs
// (File.arrayBuffer / File.text), so it behaves the same in the browser and Electron.

export const IMPORT_ACCEPT = '.sqlite,.sqlite3,.db,.db3,.sql,.csv';

/** Turn a file name into a safe SQL identifier, e.g. "My Data (2).csv" -> "my_data_2". */
export function nameFromFile(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  let id = base.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) id = 'imported';
  if (/^[0-9]/.test(id)) id = `t_${id}`;
  return id;
}

/** RFC 4180 CSV parser: quoted fields, escaped quotes (""), CRLF/LF, newlines inside quotes. */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  // Drop fully blank lines
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

/** Pick INTEGER / REAL / TEXT for each column based on its non-empty values. */
export function inferColumnTypes(dataRows, columnCount) {
  const types = [];
  for (let c = 0; c < columnCount; c++) {
    let type = 'INTEGER';
    let sawValue = false;
    for (const r of dataRows) {
      const v = (r[c] ?? '').trim();
      if (v === '') continue;
      sawValue = true;
      if (type === 'INTEGER' && !/^-?\d+$/.test(v)) type = 'REAL';
      if (type === 'REAL' && (v === '' || isNaN(Number(v)))) { type = 'TEXT'; break; }
    }
    types.push(sawValue ? type : 'TEXT');
  }
  return types;
}

/** Build header names that are unique, non-empty identifiers. */
export function normalizeHeaders(headers) {
  const seen = new Map();
  return headers.map((h, i) => {
    let name = h.trim() || `column_${i + 1}`;
    const key = name.toLowerCase();
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    if (n > 0) name = `${name}_${n + 1}`;
    return name;
  });
}

const quoteId = (s) => `"${String(s).replace(/"/g, '""')}"`;

/** Create a table from CSV text inside an open sql.js database. Returns the row count. */
export function importCsvIntoDb(dbInstance, tableName, text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('The CSV file is empty.');
  const headers = normalizeHeaders(rows[0]);
  const data = rows.slice(1);
  const types = inferColumnTypes(data, headers.length);

  const existing = dbInstance.exec(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name=${`'${tableName.replace(/'/g, "''")}'`}`
  );
  if (existing.length) throw new Error(`A table named "${tableName}" already exists in this database.`);

  const cols = headers.map((h, i) => `${quoteId(h)} ${types[i]}`).join(', ');
  dbInstance.run('BEGIN');
  try {
    dbInstance.run(`CREATE TABLE ${quoteId(tableName)} (${cols})`);
    const stmt = dbInstance.prepare(
      `INSERT INTO ${quoteId(tableName)} VALUES (${headers.map(() => '?').join(', ')})`
    );
    for (const r of data) {
      stmt.run(headers.map((_, i) => {
        const v = r[i] ?? '';
        if (v.trim() === '') return null;
        return types[i] === 'TEXT' ? v : Number(v);
      }));
    }
    stmt.free();
    dbInstance.run('COMMIT');
  } catch (e) {
    dbInstance.run('ROLLBACK');
    throw e;
  }
  return data.length;
}

/**
 * Import a File. Returns { dbId, message }.
 *  - .sqlite / .db  -> new database with the file's contents
 *  - .sql           -> new database, script executed into it
 *  - .csv           -> new table in the open database (or a new database if none is open)
 */
export async function importFile(file) {
  const { store } = await import('../state/store.js');
  const engine = await import('./engine.js');
  const ext = (file.name.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
  const name = nameFromFile(file.name);

  if (['sqlite', 'sqlite3', 'db', 'db3'].includes(ext)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const record = await engine.createDatabaseFromBytes(name, bytes);
    return { dbId: record.id, message: `Imported database "${name}".` };
  }

  if (ext === 'sql') {
    const script = await file.text();
    const record = await engine.createDatabase(name);
    const dbInstance = await engine.loadDatabase(record);
    try {
      dbInstance.exec(script);
    } catch (e) {
      await engine.deleteDatabase(record.id);
      throw new Error(`The SQL script failed: ${e.message}`);
    }
    await engine.persistDatabase(record, dbInstance);
    return { dbId: record.id, message: `Ran "${file.name}" into new database "${name}".` };
  }

  if (ext === 'csv') {
    const text = await file.text();
    let record = store.state.databases.find(d => d.id === store.state.currentDbId);
    let created = false;
    if (!record) { record = await engine.createDatabase(name); created = true; }
    const dbInstance = await engine.loadDatabase(record);
    let count;
    try {
      count = importCsvIntoDb(dbInstance, name, text);
    } catch (e) {
      if (created) await engine.deleteDatabase(record.id);
      throw e;
    }
    await engine.persistDatabase(record, dbInstance);
    return { dbId: record.id, message: `Imported ${count} row(s) into table "${name}" in "${record.name}".` };
  }

  throw new Error(`Unsupported file type ".${ext}". Use .sqlite, .db, .sql or .csv.`);
}
