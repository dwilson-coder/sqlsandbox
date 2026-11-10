import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { parseCsv, inferColumnTypes, normalizeHeaders, nameFromFile, importCsvIntoDb } from '../src/db/import-data.js';

test('nameFromFile makes a safe identifier', () => {
  assert.equal(nameFromFile('My Data (2).csv'), 'my_data_2');
  assert.equal(nameFromFile('2024 sales.sql'), 't_2024_sales');
  assert.equal(nameFromFile('???.db'), 'imported');
});

test('parseCsv handles quotes, escaped quotes, CRLF, embedded newlines and BOM', () => {
  const text = '﻿id,name,note\r\n1,"Smith, Jo","said ""hi"""\r\n2,Ann,"line1\nline2"\r\n\r\n';
  assert.deepEqual(parseCsv(text), [
    ['id', 'name', 'note'],
    ['1', 'Smith, Jo', 'said "hi"'],
    ['2', 'Ann', 'line1\nline2'],
  ]);
  assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]); // no trailing newline
});

test('inferColumnTypes picks INTEGER / REAL / TEXT', () => {
  const rows = [['1', '1.5', 'x', ''], ['-2', '3', '4', '']];
  assert.deepEqual(inferColumnTypes(rows, 4), ['INTEGER', 'REAL', 'TEXT', 'TEXT']);
});

test('normalizeHeaders fills blanks and de-duplicates', () => {
  assert.deepEqual(normalizeHeaders(['id', '', 'ID', 'id']), ['id', 'column_2', 'ID_2', 'id_3']);
});

test('importCsvIntoDb creates a typed table with rows and NULLs', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const count = importCsvIntoDb(db, 'people', 'id,name,score\n1,Ann,9.5\n2,"Bo ""B""",\n');
  assert.equal(count, 2);

  const cols = db.exec('PRAGMA table_info(people)')[0].values.map(r => [r[1], r[2]]);
  assert.deepEqual(cols, [['id', 'INTEGER'], ['name', 'TEXT'], ['score', 'REAL']]);

  const rows = db.exec('SELECT * FROM people ORDER BY id')[0].values;
  assert.deepEqual(rows, [[1, 'Ann', 9.5], [2, 'Bo "B"', null]]);

  assert.throws(() => importCsvIntoDb(db, 'people', 'a\n1'), /already exists/);
  assert.throws(() => importCsvIntoDb(db, 'empty', ''), /empty/);
});
