// src/db/sample-datasets.js
import { createDatabase, loadDatabase, persistDatabase, getTables } from './engine.js';
import { store } from '../state/store.js';

export async function loadSampleData() {
  const db = await createDatabase('sample_company');
  const dbInstance = await loadDatabase(db);

  dbInstance.run(`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT,
      salary REAL,
      hire_date TEXT
    );
    CREATE TABLE departments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT
    );
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      status TEXT DEFAULT 'active'
    );
    INSERT INTO departments VALUES (1, 'Engineering', 'Building A');
    INSERT INTO departments VALUES (2, 'Marketing', 'Building B');
    INSERT INTO departments VALUES (3, 'Sales', 'Building C');
    INSERT INTO employees VALUES (1, 'Alice Johnson', 'Engineering', 95000, '2022-03-15');
    INSERT INTO employees VALUES (2, 'Bob Smith', 'Engineering', 88000, '2021-07-01');
    INSERT INTO employees VALUES (3, 'Carol White', 'Marketing', 72000, '2023-01-10');
    INSERT INTO employees VALUES (4, 'Dave Brown', 'Sales', 68000, '2022-11-20');
    INSERT INTO employees VALUES (5, 'Eve Davis', 'Engineering', 102000, '2020-05-01');
    INSERT INTO projects VALUES (1, 'Website Redesign', 2, 'active');
    INSERT INTO projects VALUES (2, 'API Platform', 1, 'active');
    INSERT INTO projects VALUES (3, 'Q4 Campaign', 2, 'completed');
  `);

  await persistDatabase(db, dbInstance);

  store.state.currentDbId = db.id;
  store.state.tables = getTables(dbInstance);
  store.save();
}

export async function loadPetsDatabase() {
  const db = await createDatabase('pets');
  const dbInstance = await loadDatabase(db);

  dbInstance.run(`
    CREATE TABLE animals (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      age_years INTEGER,
      weight_lbs REAL,
      adopted_date TEXT
    );
    CREATE TABLE owners (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT
    );
    INSERT INTO owners VALUES (1, 'John Smith', 'john@example.com', '555-0101', '123 Oak St');
    INSERT INTO owners VALUES (2, 'Mary Johnson', 'mary@example.com', '555-0102', '456 Pine Ave');
    INSERT INTO owners VALUES (3, 'Alex Rivera', 'alex@example.com', '555-0103', '789 Maple Dr');
    INSERT INTO animals VALUES (1, 'Buddy', 'Dog', 'Golden Retriever', 4, 72.5, '2022-06-15');
    INSERT INTO animals VALUES (2, 'Whiskers', 'Cat', 'Siamese', 3, 9.2, '2023-01-20');
    INSERT INTO animals VALUES (3, 'Rex', 'Dog', 'German Shepherd', 5, 85.0, '2021-09-10');
    INSERT INTO animals VALUES (4, 'Luna', 'Cat', 'Maine Coon', 2, 13.8, '2024-03-05');
    INSERT INTO animals VALUES (5, 'Coco', 'Parrot', 'African Grey', 7, 0.9, '2019-11-22');
    INSERT INTO animals VALUES (6, 'Max', 'Dog', 'Beagle', 3, 28.4, '2023-07-18');
    INSERT INTO animals VALUES (7, 'Shadow', 'Cat', 'Domestic Shorthair', 6, 11.0, '2020-04-12');
    INSERT INTO animals VALUES (8, 'Daisy', 'Rabbit', 'Holland Lop', 2, 2.3, '2024-08-01');
  `);

  await persistDatabase(db, dbInstance);

  store.state.currentDbId = db.id;
  store.state.tables = getTables(dbInstance);
  store.save();
}   