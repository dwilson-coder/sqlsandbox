import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { extractSchema, generateMermaidDiagram, sanitizeIdent } from '../src/db/schema-analyzer.js';

test('sanitizeIdent cleans identifier for Mermaid', () => {
  assert.equal(sanitizeIdent('users'), 'users');
  assert.equal(sanitizeIdent('users-table 123'), 'users_table_123');
  assert.equal(sanitizeIdent('VARCHAR(255)'), 'VARCHAR_255_');
  assert.equal(sanitizeIdent(''), 'unknown');
});

test('extractSchema and generateMermaidDiagram with SQLite tables', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE departments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      location TEXT
    );
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      salary REAL
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id)
    );
    CREATE TABLE employee_projects (
      employee_id INTEGER REFERENCES employees(id),
      project_id INTEGER REFERENCES projects(id),
      role TEXT,
      PRIMARY KEY (employee_id, project_id)
    );
  `);

  const schema = extractSchema(db);
  assert.equal(schema.tables.length, 4);

  const deptTable = schema.tables.find(t => t.name === 'departments');
  assert.ok(deptTable);
  const deptId = deptTable.columns.find(c => c.name === 'id');
  assert.ok(deptId.pk);
  const deptName = deptTable.columns.find(c => c.name === 'name');
  assert.ok(deptName.unique);

  const empTable = schema.tables.find(t => t.name === 'employees');
  const deptIdFk = empTable.columns.find(c => c.name === 'department_id');
  assert.ok(deptIdFk.fk);
  assert.equal(deptIdFk.references.table, 'departments');

  const junctionTable = schema.tables.find(t => t.name === 'employee_projects');
  assert.ok(junctionTable.isJunction);

  const mermaid = generateMermaidDiagram(schema, { dbName: 'test_db', connectDatabase: true });
  assert.ok(mermaid.startsWith('erDiagram'));
  // Connecting lines from database to tables
  assert.ok(mermaid.includes('DATABASE ||--o{ departments : "contains"'));
  assert.ok(mermaid.includes('DATABASE ||--o{ employees : "contains"'));
  assert.ok(mermaid.includes('DATABASE ||--o{ projects : "contains"'));
  assert.ok(mermaid.includes('DATABASE ||--o{ employee_projects : "contains"'));
  assert.ok(mermaid.includes('DATABASE {'));
  assert.ok(mermaid.includes('string db_name "test_db"'));

  // Table to table relationships
  assert.ok(mermaid.includes('departments ||--o{ employees : "department_id"'));
  assert.ok(mermaid.includes('departments {'));
  assert.ok(mermaid.includes('INTEGER id PK'));
  assert.ok(mermaid.includes('TEXT name UK'));
  assert.ok(mermaid.includes('INTEGER department_id FK "-> departments"'));

  // When connectDatabase is false
  const mermaidNoDb = generateMermaidDiagram(schema, { connectDatabase: false });
  assert.ok(!mermaidNoDb.includes('DATABASE ||--o{'));
  assert.ok(mermaidNoDb.includes('departments ||--o{ employees : "department_id"'));
});

test('getTableDdl extracts individual table and full database DDL', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
    CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  `);

  const singleDdl = getTableDdl(db, 'books');
  assert.ok(singleDdl.includes('CREATE TABLE books'));
  assert.ok(singleDdl.endsWith(';'));

  const fullDdl = getTableDdl(db, null);
  assert.ok(fullDdl.includes('CREATE TABLE books'));
  assert.ok(fullDdl.includes('CREATE TABLE authors'));

  const notFound = getTableDdl(db, 'missing_table');
  assert.ok(notFound.includes('not found'));
});


