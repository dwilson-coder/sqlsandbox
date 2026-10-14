// src/db/schema-analyzer.js

/**
 * Clean string for safe use in Mermaid identifiers (table names, types, column names).
 */
export function sanitizeIdent(str) {
  if (!str) return 'unknown';
  // Replace anything that is not alphanumeric or underscore with underscore
  const cleaned = String(str).trim().replace(/[^a-zA-Z0-9_]/g, '_');
  return cleaned || 'item';
}

/**
 * Inspect a live sql.js Database instance and extract table definitions,
 * columns, constraints (PK, FK, UNIQUE), and foreign key relationships.
 */
export function extractSchema(dbInstance) {
  if (!dbInstance) {
    return { tables: [], relationships: [] };
  }

  // 1. Get all user tables
  const masterRes = dbInstance.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  if (!masterRes.length || !masterRes[0].values) {
    return { tables: [], relationships: [] };
  }

  const tableNames = masterRes[0].values.map(r => r[0]);
  const tables = [];
  const relationships = [];

  for (const tableName of tableNames) {
    // Columns & primary keys
    const infoRes = dbInstance.exec(`PRAGMA table_info("${String(tableName).replace(/"/g, '""')}")`);
    const cols = [];
    if (infoRes.length && infoRes[0].values) {
      // columns: [cid, name, type, notnull, dflt_value, pk]
      for (const row of infoRes[0].values) {
        cols.push({
          cid: row[0],
          name: row[1],
          type: row[2] || 'TEXT',
          notnull: Boolean(row[3]),
          defaultValue: row[4],
          pk: Boolean(row[5]),
          pkSeq: row[5], // > 0
          fk: false,
          unique: false,
          references: null,
        });
      }
    }

    // Foreign keys
    const fkRes = dbInstance.exec(`PRAGMA foreign_key_list("${String(tableName).replace(/"/g, '""')}")`);
    if (fkRes.length && fkRes[0].values) {
      // columns: [id, seq, table, from, to, on_update, on_delete, match]
      for (const row of fkRes[0].values) {
        const foreignTable = row[2];
        const fromCol = row[3];
        const toCol = row[4];

        const matchingCol = cols.find(c => c.name.toLowerCase() === String(fromCol).toLowerCase());
        if (matchingCol) {
          matchingCol.fk = true;
          matchingCol.references = { table: foreignTable, column: toCol };
        }

        relationships.push({
          fromTable: tableName,
          fromColumn: fromCol,
          toTable: foreignTable,
          toColumn: toCol,
          onUpdate: row[5],
          onDelete: row[6],
        });
      }
    }

    // Unique indexes
    try {
      const idxRes = dbInstance.exec(`PRAGMA index_list("${String(tableName).replace(/"/g, '""')}")`);
      if (idxRes.length && idxRes[0].values) {
        // [seq, name, unique, origin, partial]
        for (const idxRow of idxRes[0].values) {
          const isUnique = Boolean(idxRow[2]);
          const idxName = idxRow[1];
          if (isUnique) {
            const idxInfoRes = dbInstance.exec(`PRAGMA index_info("${String(idxName).replace(/"/g, '""')}")`);
            if (idxInfoRes.length && idxInfoRes[0].values) {
              for (const colRow of idxInfoRes[0].values) {
                const colName = colRow[2];
                const targetCol = cols.find(c => c.name === colName);
                if (targetCol && !targetCol.pk) {
                  targetCol.unique = true;
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignore index inspection errors if any
    }

    // Detect if this table is likely a junction table:
    // e.g., 2+ foreign keys and total columns <= 4, or primary key formed by foreign keys
    const fkCols = cols.filter(c => c.fk);
    const pkCols = cols.filter(c => c.pk);
    const isJunction = fkCols.length >= 2 && (
      (pkCols.length >= 2 && fkCols.some(f => f.pk)) ||
      cols.length <= fkCols.length + 2
    );

    tables.push({
      name: tableName,
      columns: cols,
      isJunction,
    });
  }

  return { tables, relationships };
}

/**
 * Generate a valid Mermaid erDiagram from extracted schema info.
 * Supports connecting the database entity to its tables with connecting lines.
 */
export function generateMermaidDiagram(schema, options = {}) {
  const { tables = [], relationships = [] } = schema;
  const {
    connectDatabase = true,
    dbName = schema.dbName || 'DATABASE',
  } = options;

  if (!tables || tables.length === 0) {
    return 'erDiagram\n    EMPTY_DATABASE {\n        string notice "No tables found"\n    }';
  }

  const lines = ['erDiagram'];

  // Determine safe entity name for DATABASE
  let dbEntity = 'DATABASE';
  if (tables.some(t => sanitizeIdent(t.name).toUpperCase() === 'DATABASE')) {
    dbEntity = `DATABASE_${sanitizeIdent(dbName).toUpperCase()}`;
    if (tables.some(t => sanitizeIdent(t.name).toUpperCase() === dbEntity)) {
      dbEntity = `${dbEntity}_ROOT`;
    }
  }

  // 1. Output connecting lines from DATABASE to each table
  if (connectDatabase && tables.length > 0) {
    for (const table of tables) {
      const tableName = sanitizeIdent(table.name);
      lines.push(`    ${dbEntity} ||--o{ ${tableName} : "contains"`);
    }
    lines.push('');
  }

  // 2. Output table-to-table relationships
  // Format: PARENT ||--o{ CHILD : "references"
  const renderedRelPairs = new Set();

  for (const rel of relationships) {
    const parent = sanitizeIdent(rel.toTable);
    const child = sanitizeIdent(rel.fromTable);
    const relKey = `${parent}->${child}:${rel.fromColumn}`;

    if (!renderedRelPairs.has(relKey)) {
      renderedRelPairs.add(relKey);

      // Check if child FK column has UNIQUE constraint (making it 1-to-1)
      const childTable = tables.find(t => t.name === rel.fromTable);
      const childCol = childTable?.columns.find(c => c.name === rel.fromColumn);
      const isOneToOne = childCol?.unique || (childCol?.pk && childTable?.columns.filter(c => c.pk).length === 1);

      const symbol = isOneToOne ? '||--||' : '||--o{';
      const label = rel.fromColumn ? `"${sanitizeIdent(rel.fromColumn)}"` : '"fk"';
      lines.push(`    ${parent} ${symbol} ${child} : ${label}`);
    }
  }

  if (relationships.length > 0) {
    lines.push('');
  }

  // 3. Output DATABASE entity definition
  if (connectDatabase) {
    lines.push(`    ${dbEntity} {`);
    lines.push(`        string db_name "${sanitizeIdent(dbName || 'sandbox')}"`);
    lines.push(`        int total_tables "${tables.length}"`);
    lines.push(`    }`);
    lines.push('');
  }

  // 4. Output table entity definitions
  for (const table of tables) {
    const tableName = sanitizeIdent(table.name);
    lines.push(`    ${tableName} {`);

    if (table.columns.length === 0) {
      lines.push(`        string info "no_columns"`);
    } else {
      for (const col of table.columns) {
        const type = sanitizeIdent(col.type) || 'TEXT';
        const name = sanitizeIdent(col.name);

        let key = '';
        if (col.pk && col.fk) key = 'PK,FK';
        else if (col.pk) key = 'PK';
        else if (col.fk) key = 'FK';
        else if (col.unique) key = 'UK';

        // Optional comment
        let comment = '';
        if (col.references) {
          comment = ` "-> ${sanitizeIdent(col.references.table)}"`;
        }

        const keyPart = key ? ` ${key}` : '';
        lines.push(`        ${type} ${name}${keyPart}${comment}`);
      }
    }

    lines.push('    }');
  }

  return lines.join('\n');
}

/**
 * Retrieve SQL DDL statement(s) for a specific table or the whole database.
 * @param {object} dbInstance - sql.js Database instance
 * @param {string|null} tableName - Table name, or null/empty for all tables in the database
 * @returns {string} Raw SQL DDL
 */
export function getTableDdl(dbInstance, tableName = null) {
  if (!dbInstance) return '-- No active database connection';

  try {
    if (tableName && tableName.toUpperCase() !== 'DATABASE') {
      const escaped = String(tableName).replace(/'/g, "''");
      const res = dbInstance.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${escaped}'`);
      if (res.length && res[0].values.length && res[0].values[0][0]) {
        return res[0].values[0][0].trim() + ';';
      }
      return `-- Table "${tableName}" not found.`;
    } else {
      // Entire database
      const res = dbInstance.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
      if (res.length && res[0].values.length) {
        return res[0].values
          .map(row => (row[0] || '').trim() + ';')
          .filter(Boolean)
          .join('\n\n');
      }
      return '-- No tables found in database.';
    }
  } catch (err) {
    return `-- Error retrieving DDL: ${err.message}`;
  }
}


