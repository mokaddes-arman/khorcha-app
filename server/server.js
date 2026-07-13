import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import XLSX from 'xlsx';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./finance.db',
  authToken: process.env.TURSO_AUTH_TOKEN || ''
});

async function initDb() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS trip_people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      name TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS trip_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      paid_by_person_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL
    )
  `);
}

await initDb();

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/income', async (_req, res) => {
  const result = await client.execute('SELECT * FROM income ORDER BY date DESC, id DESC');
  res.json(result.rows);
});

app.post('/api/income', async (req, res) => {
  const { source, amount, date, note } = req.body;
  const result = await client.execute({
    sql: 'INSERT INTO income (source, amount, date, note) VALUES (?, ?, ?, ?)',
    args: [source, amount, date, note || '']
  });
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/income/:id', async (req, res) => {
  await client.execute({ sql: 'DELETE FROM income WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

app.get('/api/expenses', async (_req, res) => {
  const result = await client.execute('SELECT * FROM expenses ORDER BY date DESC, id DESC');
  res.json(result.rows);
});

app.post('/api/expenses', async (req, res) => {
  const { name, amount, category, date, note } = req.body;
  const result = await client.execute({
    sql: 'INSERT INTO expenses (name, amount, category, date, note) VALUES (?, ?, ?, ?, ?)',
    args: [name, amount, category, date, note || '']
  });
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/expenses/:id', async (req, res) => {
  await client.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function normalizeAmount(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').replace(/[$,]/g, '').trim();
  return Number(text) || 0;
}

function normalizeType(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (text.startsWith('inc')) return 'income';
  if (text.startsWith('exp')) return 'expense';
  return text;
}

app.post('/api/import-xlsx', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  let inserted = 0;
  for (const row of rows) {
    const type = normalizeType(row.type || row.Type || row['Transaction Type'] || row['Type']);
    const amount = normalizeAmount(row.amount || row.Amount || row['Amount'] || row['Net']);
    if (!amount) continue;

    const date = normalizeDate(row.date || row.Date || row['Transaction Date'] || row['Date']);
    const name = row.name || row.Name || row.Source || row['Name/Source'] || row['Description'] || row['Source'] || 'Imported entry';
    const category = row.category || row.Category || row['Category'] || 'Other';
    const note = row.note || row.Note || row['Note'] || '';

    if (type === 'income') {
      await client.execute({ sql: 'INSERT INTO income (source, amount, date, note) VALUES (?, ?, ?, ?)', args: [String(name), amount, date || new Date().toISOString().slice(0, 10), String(note)] });
    } else if (type === 'expense') {
      await client.execute({ sql: 'INSERT INTO expenses (name, amount, category, date, note) VALUES (?, ?, ?, ?, ?)', args: [String(name), amount, String(category), date || new Date().toISOString().slice(0, 10), String(note)] });
    }
    inserted += 1;
  }

  res.json({ message: `Imported ${inserted} transactions`, count: inserted });
});

app.get('/api/reports/tax-export', async (req, res) => {
  const start = req.query.start || '';
  const end = req.query.end || '';
  const income = await client.execute({ sql: start && end ? 'SELECT * FROM income WHERE date BETWEEN ? AND ? ORDER BY date ASC' : 'SELECT * FROM income ORDER BY date ASC', args: start && end ? [start, end] : [] });
  const expenses = await client.execute({ sql: start && end ? 'SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date ASC' : 'SELECT * FROM expenses ORDER BY date ASC', args: start && end ? [start, end] : [] });

  const rows = [
    ['Date', 'Type', 'Name/Source', 'Category', 'Amount', 'Note']
  ];
  const incomeRows = income.rows.map((item) => [item.date, 'Income', item.source, '', Number(item.amount), item.note || '']);
  const expenseRows = expenses.rows.map((item) => [item.date, 'Expense', item.name, item.category, Number(item.amount), item.note || '']);
  rows.push(...incomeRows, ...expenseRows);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Transactions');

  const incomeSheetRows = [
    ['Date', 'Source', 'Amount', 'Note']
  ];
  income.rows.forEach((item) => incomeSheetRows.push([item.date, item.source, Number(item.amount), item.note || '']));
  const incomeSheet = XLSX.utils.aoa_to_sheet(incomeSheetRows);
  XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Income');

  const expenseSheetRows = [
    ['Date', 'Name', 'Category', 'Amount', 'Note']
  ];
  expenses.rows.forEach((item) => expenseSheetRows.push([item.date, item.name, item.category, Number(item.amount), item.note || '']));
  const expenseSheet = XLSX.utils.aoa_to_sheet(expenseSheetRows);
  XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Expenses');

  const categoryTotals = {};
  expenses.rows.forEach((item) => {
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + Number(item.amount);
  });
  const categoryRows = [['Category', 'Amount']];
  Object.entries(categoryTotals).forEach(([category, amount]) => categoryRows.push([category, amount]));
  const categorySheet = XLSX.utils.aoa_to_sheet(categoryRows);
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Category Totals');

  const totals = [
    ['Metric', 'Value'],
    ['Income Total', income.rows.reduce((sum, item) => sum + Number(item.amount), 0)],
    ['Expense Total', expenses.rows.reduce((sum, item) => sum + Number(item.amount), 0)],
    ['Net Balance', income.rows.reduce((sum, item) => sum + Number(item.amount), 0) - expenses.rows.reduce((sum, item) => sum + Number(item.amount), 0)]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(totals);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="tax-ready-report.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

app.get('/api/trips', async (_req, res) => {
  const result = await client.execute('SELECT * FROM trips ORDER BY date DESC, id DESC');
  res.json(result.rows);
});

app.post('/api/trips', async (req, res) => {
  const { name, date, description } = req.body;
  const result = await client.execute({
    sql: 'INSERT INTO trips (name, date, description) VALUES (?, ?, ?)',
    args: [name, date, description || '']
  });
  res.json({ id: result.lastInsertRowid, name, date, description });
});

app.get('/api/trips/:id', async (req, res) => {
  const trip = await client.execute({ sql: 'SELECT * FROM trips WHERE id = ?', args: [req.params.id] });
  const people = await client.execute({ sql: 'SELECT * FROM trip_people WHERE trip_id = ? ORDER BY id ASC', args: [req.params.id] });
  const expenses = await client.execute({ sql: 'SELECT te.*, tp.name AS person_name FROM trip_expenses te JOIN trip_people tp ON tp.id = te.paid_by_person_id WHERE te.trip_id = ? ORDER BY te.id ASC', args: [req.params.id] });
  res.json({ trip: trip.rows[0], people: people.rows, expenses: expenses.rows });
});

app.post('/api/trips/:id/people', async (req, res) => {
  const { name } = req.body;
  const result = await client.execute({ sql: 'INSERT INTO trip_people (trip_id, name) VALUES (?, ?)', args: [req.params.id, name] });
  res.json({ id: result.lastInsertRowid });
});

app.post('/api/trips/:id/expenses', async (req, res) => {
  const { personId, amount, description, date } = req.body;
  const result = await client.execute({ sql: 'INSERT INTO trip_expenses (trip_id, paid_by_person_id, amount, description, date) VALUES (?, ?, ?, ?, ?)', args: [req.params.id, personId, amount, description, date] });
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/trips/:id', async (req, res) => {
  await client.execute({ sql: 'DELETE FROM trip_people WHERE trip_id = ?', args: [req.params.id] });
  await client.execute({ sql: 'DELETE FROM trip_expenses WHERE trip_id = ?', args: [req.params.id] });
  await client.execute({ sql: 'DELETE FROM trips WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
