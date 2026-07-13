import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const outDir = path.resolve(process.cwd(), '../local-data');
const outFile = path.join(outDir, 'finance.db');
fs.mkdirSync(outDir, { recursive: true });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./finance.db',
  authToken: process.env.TURSO_AUTH_TOKEN || ''
});

const db = createClient({ url: `file:${outFile}` });

async function syncTable(tableName) {
  const result = await client.execute(`SELECT * FROM ${tableName}`);
  const rows = result.rows;
  await db.execute(`DELETE FROM ${tableName}`);
  for (const row of rows) {
    const placeholders = row.length ? Array.from({ length: row.length }, () => '?').join(', ') : '';
    const values = row;
    await db.execute({ sql: `INSERT INTO ${tableName} VALUES (${placeholders})`, args: values });
  }
}

(async () => {
  await db.execute(`CREATE TABLE IF NOT EXISTS income (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, date TEXT NOT NULL, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS trips (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, date TEXT NOT NULL, description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS trip_people (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL, name TEXT NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS trip_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER NOT NULL, paid_by_person_id INTEGER NOT NULL, amount REAL NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL)`);
  await syncTable('income');
  await syncTable('expenses');
  await syncTable('trips');
  await syncTable('trip_people');
  await syncTable('trip_expenses');
  console.log(`Synced local database to ${outFile}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
