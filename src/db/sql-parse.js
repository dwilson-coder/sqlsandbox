// src/db/sql-parse.js
// Pure helpers (no imports) so they can be unit-tested without a browser or sql.js.

/**
 * Split a SQL script into individual statements.
 * - Understands '…', "…", `…` and […] quoting (with '' / "" escapes)
 * - Strips line comments (double dash) and C-style block comments
 * - Keeps CREATE TRIGGER … BEGIN … END; bodies together (semicolons inside the body)
 * - Ignores semicolons inside CASE … END
 */
export function splitStatements(sql) {
  const out = [];
  const n = sql.length;
  let cur = '';
  let i = 0;
  let words = [];       // first few keywords of the current statement
  let caseDepth = 0;
  let blockEnd = false; // last token was a top-level END (end of a trigger body)
  let word = '';

  const flushWord = () => {
    if (!word) return;
    const w = word.toUpperCase();
    if (words.length < 4) words.push(w);
    if (w === 'CASE') { caseDepth++; blockEnd = false; }
    else if (w === 'END') {
      if (caseDepth > 0) { caseDepth--; blockEnd = false; } else blockEnd = true;
    } else blockEnd = false;
    word = '';
  };
  const isTrigger = () =>
    words[0] === 'CREATE' &&
    (words[1] === 'TRIGGER' || ((words[1] === 'TEMP' || words[1] === 'TEMPORARY') && words[2] === 'TRIGGER'));
  const endStatement = () => {
    const t = cur.trim();
    if (t) out.push(t);
    cur = ''; words = []; caseDepth = 0; blockEnd = false;
  };

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      flushWord();
      while (i < n && sql[i] !== '\n') i++;
      cur += ' ';
      continue;
    }
    if (ch === '/' && next === '*') {
      flushWord();
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      cur += ' ';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`' || ch === '[') {
      flushWord();
      const close = ch === '[' ? ']' : ch;
      let j = i + 1;
      while (j < n) {
        if (sql[j] === close) {
          if (close !== ']' && sql[j + 1] === close) { j += 2; continue; }
          break;
        }
        j++;
      }
      cur += sql.slice(i, j + 1);
      i = j + 1;
      blockEnd = false;
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(ch)) {
      word += ch; cur += ch; i++;
      continue;
    }

    flushWord();
    if (ch === ';') {
      if (isTrigger() && !blockEnd) cur += ch;
      else endStatement();
      i++;
      continue;
    }
    if (!/\s/.test(ch)) blockEnd = false;
    cur += ch;
    i++;
  }
  flushWord();
  endStatement();
  return out;
}

const IDENT = String.raw`("[^"]+"|` + '`[^`]+`' + String.raw`|\[[^\]]+\]|'[^']+'|[\w$]+)`;

export function unquote(tok) {
  const t = tok.trim();
  const q = t[0];
  if ((q === '"' || q === "'" || q === '`') && t.endsWith(q)) return t.slice(1, -1);
  if (q === '[' && t.endsWith(']')) return t.slice(1, -1);
  return t;
}

const re = (body) => new RegExp('^' + body + '$', 'i');

const COMMANDS = [
  ['create-db', re(String.raw`CREATE\s+(?:DATABASE|SCHEMA)\s+(IF\s+NOT\s+EXISTS\s+)?` + IDENT + String.raw`(?:\s+(?:DEFAULT|CHARACTER|CHARSET|COLLATE)\b.*)?`)],
  ['drop-db', re(String.raw`DROP\s+(?:DATABASE|SCHEMA)\s+(IF\s+EXISTS\s+)?` + IDENT)],
  ['use', re(String.raw`USE\s+` + IDENT)],
  ['show-dbs', re(String.raw`SHOW\s+(?:DATABASES|SCHEMAS)`)],
  ['show-tables', re(String.raw`SHOW\s+(?:FULL\s+)?TABLES`)],
  ['describe', re(String.raw`(?:DESCRIBE|DESC|EXPLAIN)\s+` + IDENT)],
  ['describe', re(String.raw`SHOW\s+(?:FULL\s+)?(?:COLUMNS|FIELDS)\s+(?:FROM|IN)\s+` + IDENT)],
  ['show-create', re(String.raw`SHOW\s+CREATE\s+TABLE\s+` + IDENT)],
  ['show-index', re(String.raw`SHOW\s+(?:INDEX|INDEXES|KEYS)\s+(?:FROM|IN)\s+` + IDENT)],
  ['truncate', re(String.raw`TRUNCATE(?:\s+TABLE)?\s+` + IDENT)],
  ['select-db', re(String.raw`SELECT\s+(?:DATABASE|SCHEMA)\s*\(\s*\)(?:\s+AS\s+` + IDENT + ')?')],
  ['help', re(String.raw`(?:HELP|SHOW\s+COMMANDS)`)],
];

/**
 * Recognise the MySQL-style commands SQLite doesn't have.
 * Returns { type, name?, ifNotExists?, ifExists? } or null (= send to SQLite as-is).
 */
export function parseCommand(stmt) {
  const s = stmt.trim().replace(/;+\s*$/, '');
  for (const [type, rx] of COMMANDS) {
    const m = rx.exec(s);
    if (!m) continue;
    switch (type) {
      case 'create-db': return { type, ifNotExists: !!m[1], name: unquote(m[2]) };
      case 'drop-db': return { type, ifExists: !!m[1], name: unquote(m[2]) };
      case 'use': case 'describe': case 'show-create': case 'show-index': case 'truncate':
        return { type, name: unquote(m[1]) };
      default: return { type };
    }
  }
  return null;
}

export function firstKeyword(stmt) {
  const m = /^\s*([A-Za-z]+)/.exec(stmt);
  return m ? m[1].toUpperCase() : '';
}

/** Quote a value as a SQL string literal. */
export function sqlString(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

/** Quote an identifier. */
export function sqlIdent(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

// ── MySQL → SQLite adaptation for pasted CREATE TABLE scripts ───────────────────────
// SQLite does NOT reject `id INT AUTO_INCREMENT PRIMARY KEY`; it silently creates a column that
// never auto-increments. Rewrite the common MySQL forms to `INTEGER PRIMARY KEY AUTOINCREMENT`
// and drop table options (ENGINE=…, DEFAULT CHARSET=…) that SQLite doesn't understand.
const COL_NAME = String.raw`("[^"]+"|` + '`[^`]+`' + String.raw`|\[[^\]]+\]|[\w$]+)`;
const INT_TYPE = String.raw`(?:TINY|SMALL|MEDIUM|BIG)?INT(?:EGER)?(?:\s*\(\s*\d+\s*\))?(?:\s+UNSIGNED)?`;
const AUTO_PK_A = new RegExp(COL_NAME + String.raw`\s+` + INT_TYPE + String.raw`(?:\s+NOT\s+NULL)?\s+PRIMARY\s+KEY\s+AUTO_INCREMENT\b`, 'gi');
const AUTO_PK_B = new RegExp(COL_NAME + String.raw`\s+` + INT_TYPE + String.raw`(?:\s+NOT\s+NULL)?\s+AUTO_INCREMENT(?:\s+PRIMARY\s+KEY)?`, 'gi');
const TABLE_OPTIONS = /\)\s*(?:(?:ENGINE|DEFAULT\s+CHARSET|CHARSET|CHARACTER\s+SET|DEFAULT\s+CHARACTER\s+SET|COLLATE|AUTO_INCREMENT|ROW_FORMAT|COMMENT)\s*=?\s*(?:'[^']*'|[\w]+)\s*)+$/i;

/** Returns { sql, notes } — `sql` is unchanged (and notes empty) unless it's a MySQL-style CREATE TABLE. */
export function adaptMySQL(stmt) {
  if (!/^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\b/i.test(stmt)) return { sql: stmt, notes: [] };
  let sql = stmt;
  const notes = [];

  const autoCols = [];
  const toAuto = (_m, name) => { autoCols.push(unquote(name).toLowerCase()); return `${name} INTEGER PRIMARY KEY AUTOINCREMENT`; };
  sql = sql.replace(AUTO_PK_A, toAuto).replace(AUTO_PK_B, toAuto);
  if (autoCols.length) {
    // `PRIMARY KEY (id)` on the same column would now be a second primary key — drop it.
    sql = sql.replace(new RegExp(String.raw`,\s*PRIMARY\s+KEY\s*\(\s*` + COL_NAME + String.raw`\s*\)`, 'gi'),
      (m, name) => (autoCols.includes(unquote(name).toLowerCase()) ? '' : m));
    notes.push('AUTO_INCREMENT → INTEGER PRIMARY KEY AUTOINCREMENT');
  }

  const stripped = sql.replace(TABLE_OPTIONS, ')');
  if (stripped !== sql) { sql = stripped; notes.push('removed MySQL table options (ENGINE / CHARSET …)'); }

  return { sql, notes: sql === stmt ? [] : notes };
}
