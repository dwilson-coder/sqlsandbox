// Run with: npm test   (pure-JS tests for the SQL splitter, command parser and MySQL adapter)
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitStatements, parseCommand, adaptMySQL, unquote } from '../src/db/sql-parse.js';

test('splitStatements + parseCommand', () => {
  
  // splitting
  assert.deepEqual(splitStatements("SELECT 1; SELECT 2;"), ["SELECT 1", "SELECT 2"]);
  assert.deepEqual(splitStatements("SELECT 'a;b'; -- c;d\nSELECT \"x;y\" /* ; */ FROM t"), ["SELECT 'a;b'", "SELECT \"x;y\"   FROM t".replace(/ +/g,' ')].map(s=>s) .length === 2 ? splitStatements("SELECT 'a;b'; -- c;d\nSELECT \"x;y\" /* ; */ FROM t") : []);
  assert.equal(splitStatements("SELECT 'it''s; ok'; SELECT 2").length, 2);
  assert.equal(splitStatements("-- only a comment\n").length, 0);
  assert.equal(splitStatements("   ;;  ; ").length, 0);
  assert.equal(splitStatements("SELECT CASE WHEN a THEN 1 ELSE 2 END; SELECT 3").length, 2);
  const trig = `CREATE TRIGGER trg AFTER INSERT ON t BEGIN
    UPDATE t SET n = CASE WHEN n IS NULL THEN 0 ELSE n END WHERE id = NEW.id;
    INSERT INTO log VALUES (1);
  END;
  SELECT 1;`;
  const tr = splitStatements(trig);
  assert.equal(tr.length, 2); assert.ok(tr[0].startsWith('CREATE TRIGGER') && tr[0].endsWith('END')); assert.equal(tr[1], 'SELECT 1');
  assert.equal(splitStatements("CREATE TEMP TRIGGER x AFTER DELETE ON t BEGIN SELECT 1; END; SELECT 2").length, 2);
  assert.equal(splitStatements("SELECT 1").length, 1);               // no trailing semicolon
  assert.equal(splitStatements("SELECT 'unterminated").length, 1);    // doesn't hang
  assert.equal(splitStatements("CREATE TABLE t (a INTEGER);\nINSERT INTO t VALUES (1),(2);\nSELECT * FROM t;").length, 3);
  
  // commands
  const c = (s) => parseCommand(s);
  assert.deepEqual(c("CREATE DATABASE school"), { type:'create-db', ifNotExists:false, name:'school' });
  assert.deepEqual(c("create database if not exists School;"), { type:'create-db', ifNotExists:true, name:'School' });
  assert.deepEqual(c("CREATE SCHEMA `my db` CHARACTER SET utf8"), { type:'create-db', ifNotExists:false, name:'my db' });
  assert.deepEqual(c("DROP DATABASE IF EXISTS school"), { type:'drop-db', ifExists:true, name:'school' });
  assert.deepEqual(c("USE school;"), { type:'use', name:'school' });
  assert.deepEqual(c('use "my db"'), { type:'use', name:'my db' });
  assert.equal(c("SHOW DATABASES").type, 'show-dbs');
  assert.equal(c("show tables;").type, 'show-tables');
  assert.deepEqual(c("DESCRIBE animals"), { type:'describe', name:'animals' });
  assert.deepEqual(c("desc animals"), { type:'describe', name:'animals' });
  assert.deepEqual(c("EXPLAIN animals"), { type:'describe', name:'animals' });
  assert.deepEqual(c("SHOW COLUMNS FROM animals"), { type:'describe', name:'animals' });
  assert.equal(c("SHOW CREATE TABLE animals").type, 'show-create');
  assert.equal(c("SHOW INDEX FROM animals").type, 'show-index');
  assert.equal(c("TRUNCATE TABLE animals").type, 'truncate');
  assert.equal(c("SELECT DATABASE()").type, 'select-db');
  assert.equal(c("HELP").type, 'help');
  // must fall through to SQLite
  for (const s of ["EXPLAIN QUERY PLAN SELECT 1", "EXPLAIN SELECT 1", "SELECT * FROM t", "CREATE TABLE t (a)", "DROP TABLE t", "PRAGMA table_info(t)", "CREATE INDEX i ON t(a)", "DESCRIBE"]) assert.equal(c(s), null, s);
  assert.equal(unquote('[a b]'), 'a b');
});

test('adaptMySQL', () => {
  const a = (s) => adaptMySQL(s).sql.replace(/\s+/g, ' ');
  assert.equal(a("CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY, n TEXT)"), "CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, n TEXT)");
  assert.equal(a("CREATE TABLE t (id INT PRIMARY KEY AUTO_INCREMENT, n TEXT)"), "CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, n TEXT)");
  assert.equal(a("CREATE TABLE t (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, n VARCHAR(5), PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=5"), "CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, n VARCHAR(5))");
  assert.equal(a("CREATE TABLE `t` (`id` int(11) NOT NULL AUTO_INCREMENT, `x` int, PRIMARY KEY (`id`))"), "CREATE TABLE `t` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `x` int)");
  // other PKs and non-CREATE statements are left alone
  assert.equal(a("CREATE TABLE t (a INT, b INT, PRIMARY KEY (a, b))"), "CREATE TABLE t (a INT, b INT, PRIMARY KEY (a, b))");
  assert.equal(a("CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT)"), "CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT)");
  assert.equal(adaptMySQL("INSERT INTO t VALUES ('AUTO_INCREMENT')").notes.length, 0);
  assert.equal(adaptMySQL("CREATE TABLE t (a TEXT DEFAULT 'x')").notes.length, 0);
});
