import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CircleDollarSign, FileDown, Home, Menu, ReceiptText, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateBalances, simplifyDebts } from './lib/tripUtils';

const currencySymbol = '৳';
const categories = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Other'];

function formatCurrency(value) {
  return `${currencySymbol}${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function App() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [transactions, setTransactions] = useState({ income: [], expenses: [] });
  const [trips, setTrips] = useState([]);
  const [tripDetail, setTripDetail] = useState(null);
  const [range, setRange] = useState('month');
  const [incomeForm, setIncomeForm] = useState({ source: '', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: '', category: 'Food', date: new Date().toISOString().slice(0, 10), note: '', customCategory: '' });
  const [tripForm, setTripForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10), description: '' });
  const [tripPersonForm, setTripPersonForm] = useState({ name: '' });
  const [tripExpenseForm, setTripExpenseForm] = useState({ personId: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
  const [reportState, setReportState] = useState({ startDate: '', endDate: '', output: '' });
  const [importStatus, setImportStatus] = useState('');
  const [incomeFeedback, setIncomeFeedback] = useState({ type: '', message: '' });
  const [expenseFeedback, setExpenseFeedback] = useState({ type: '', message: '' });
  const [isSavingIncome, setIsSavingIncome] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [incomeResult, expenseResult, tripsResult] = await Promise.allSettled([
      fetch('/api/income'),
      fetch('/api/expenses'),
      fetch('/api/trips')
    ]);

    const income = incomeResult.status === 'fulfilled' && incomeResult.value.ok
      ? await incomeResult.value.json().catch(() => [])
      : [];
    const expenses = expenseResult.status === 'fulfilled' && expenseResult.value.ok
      ? await expenseResult.value.json().catch(() => [])
      : [];
    const trips = tripsResult.status === 'fulfilled' && tripsResult.value.ok
      ? await tripsResult.value.json().catch(() => [])
      : [];

    setTransactions({ income, expenses });
    setTrips(trips);

    if (trips[0]) {
      const detailRes = await fetch(`/api/trips/${trips[0].id}`);
      if (detailRes.ok) {
        const detail = await detailRes.json().catch(() => null);
        setTripDetail(normalizeTripDetail(detail));
      } else {
        setTripDetail(null);
      }
    } else {
      setTripDetail(null);
    }
  }

  async function handleIncomeSubmit(e) {
    e.preventDefault();
    if (isSavingIncome) return;
    setIsSavingIncome(true);
    setIncomeFeedback({ type: '', message: '' });
    try {
      const payload = { ...incomeForm, amount: Number(incomeForm.amount) };
      const res = await fetch('/api/income', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save income.');
      setIncomeForm({ source: '', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
      setIncomeFeedback({ type: 'success', message: 'Income saved successfully.' });
      await fetchData();
    } catch (error) {
      setIncomeFeedback({ type: 'error', message: error.message || 'Unable to save income.' });
    } finally {
      setIsSavingIncome(false);
    }
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault();
    if (isSavingExpense) return;
    setIsSavingExpense(true);
    setExpenseFeedback({ type: '', message: '' });
    try {
      const category = expenseForm.customCategory ? expenseForm.customCategory : expenseForm.category;
      const payload = { ...expenseForm, category, amount: Number(expenseForm.amount) };
      const res = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save expense.');
      setExpenseForm({ name: '', amount: '', category: 'Food', date: new Date().toISOString().slice(0, 10), note: '', customCategory: '' });
      setExpenseFeedback({ type: 'success', message: 'Expense saved successfully.' });
      await fetchData();
    } catch (error) {
      setExpenseFeedback({ type: 'error', message: error.message || 'Unable to save expense.' });
    } finally {
      setIsSavingExpense(false);
    }
  }

  async function deleteTransaction(type, id) {
    await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
    fetchData();
  }

  async function createTrip(e) {
    e.preventDefault();
    const res = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tripForm) });
    const created = await res.json();
    setTripForm({ name: '', date: new Date().toISOString().slice(0, 10), description: '' });
    setTrips([created, ...trips]);
    setTripDetail(normalizeTripDetail({ ...created, people: [], expenses: [] }));
  }

  async function addPerson(tripId) {
    await fetch(`/api/trips/${tripId}/people`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: tripPersonForm.name }) });
    setTripPersonForm({ name: '' });
    fetchTripDetail(tripId);
  }

  async function addTripExpense(tripId) {
    await fetch(`/api/trips/${tripId}/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tripExpenseForm, amount: Number(tripExpenseForm.amount) }) });
    setTripExpenseForm({ personId: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
    fetchTripDetail(tripId);
  }

  async function fetchTripDetail(tripId) {
    const detail = await fetch(`/api/trips/${tripId}`).then(r => r.json());
    setTripDetail(normalizeTripDetail(detail));
  }

  async function deleteTrip(tripId) {
    await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
    const updated = trips.filter(t => t.id !== tripId);
    setTrips(updated);
    if (tripDetail?.id === tripId) setTripDetail(updated[0] || null);
  }

  async function exportCsv() {
    const start = reportState.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const end = reportState.endDate || new Date().toISOString().slice(0, 10);
    const rows = [
      ['Date', 'Type', 'Name/Source', 'Category', 'Amount', 'Note'],
      ...[...transactions.income, ...transactions.expenses].filter(item => {
        const date = item.date;
        return date >= start && date <= end;
      }).map(item => {
        if (item.source) return [item.date, 'Income', item.source, '', item.amount, item.note || ''];
        return [item.date, 'Expense', item.name, item.category, item.amount, item.note || ''];
      })
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'finance-report.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function exportXlsx() {
    const start = reportState.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const end = reportState.endDate || new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/reports/tax-export?start=${start}&end=${end}`);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tax-ready-report.xlsx';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importXlsx(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImportStatus('Importing...');
    const res = await fetch('/api/import-xlsx', { method: 'POST', body: formData });
    const data = await res.json();
    setImportStatus(data.message || 'Imported');
    await fetchData();
  }

  const summary = useMemo(() => {
    const incomeTotal = transactions.income.reduce((sum, item) => sum + Number(item.amount), 0);
    const expenseTotal = transactions.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    return { incomeTotal, expenseTotal, net: incomeTotal - expenseTotal };
  }, [transactions]);

  const recent = useMemo(() => {
    return [...transactions.income.map(i => ({ ...i, kind: 'Income' })), ...transactions.expenses.map(e => ({ ...e, kind: 'Expense' }))]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }, [transactions]);

  const chartData = useMemo(() => {
    const map = {};
    transactions.expenses.forEach(item => {
      map[item.category] = (map[item.category] || 0) + Number(item.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const monthly = useMemo(() => {
    const buckets = {};
    [...transactions.income, ...transactions.expenses].forEach(item => {
      const key = item.date.slice(0, 7);
      if (!buckets[key]) buckets[key] = { month: key, income: 0, expense: 0 };
      if (item.source) buckets[key].income += Number(item.amount);
      else buckets[key].expense += Number(item.amount);
    });
    return Object.values(buckets).slice(-6);
  }, [transactions]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="hidden w-72 border-r border-slate-200 bg-white p-6 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><CircleDollarSign size={24} /></div>
              <div>
                <p className="text-lg font-semibold">FinanceFlow</p>
                <p className="text-sm text-slate-500">Single-user tracker</p>
              </div>
            </div>
            <nav className="space-y-2">
              {navItems.map(item => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Tip</p>
            <p>Use the mobile bottom bar to navigate quickly on iPhone.</p>
          </div>
        </aside>

        <main className="flex-1 pb-24 lg:pb-8">
          <header className="border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">FinanceFlow</p>
                <p className="text-sm text-slate-500">Personal finance app</p>
              </div>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-full p-2 text-slate-600"><Menu /></button>
            </div>
            {mobileMenuOpen && <div className="mt-4 space-y-2">{navItems.map(item => (<NavLink key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-600 bg-slate-100'}`}>{item.icon}{item.label}</NavLink>))}</div>}
          </header>

          <div className="px-4 py-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Dashboard summary={summary} recent={recent} chartData={chartData} monthly={monthly} />} />
              <Route path="/transactions" element={<TransactionsPage incomeForm={incomeForm} setIncomeForm={setIncomeForm} expenseForm={expenseForm} setExpenseForm={setExpenseForm} handleIncomeSubmit={handleIncomeSubmit} handleExpenseSubmit={handleExpenseSubmit} transactions={transactions} deleteTransaction={deleteTransaction} incomeFeedback={incomeFeedback} expenseFeedback={expenseFeedback} isSavingIncome={isSavingIncome} isSavingExpense={isSavingExpense} />} />
              <Route path="/trends" element={<TrendsPage monthly={monthly} />} />
              <Route path="/reports" element={<ReportsPage reportState={reportState} setReportState={setReportState} exportCsv={exportCsv} exportXlsx={exportXlsx} importXlsx={importXlsx} importStatus={importStatus} transactions={transactions} />} />
              <Route path="/trips" element={<TripsPage trips={trips} tripForm={tripForm} setTripForm={setTripForm} createTrip={createTrip} deleteTrip={deleteTrip} setTripDetail={setTripDetail} fetchTripDetail={fetchTripDetail} />} />
              <Route path="/trips/:id" element={<TripDetailPage tripDetail={tripDetail} setTripDetail={setTripDetail} tripPersonForm={tripPersonForm} setTripPersonForm={setTripPersonForm} addPerson={addPerson} tripExpenseForm={tripExpenseForm} setTripExpenseForm={setTripExpenseForm} addTripExpense={addTripExpense} />} />
            </Routes>
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md justify-around">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex flex-1 flex-col items-center rounded-2xl px-2 py-2 text-[11px] ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}>
              {item.icon}
              <span className="mt-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: <Home size={18} /> },
  { to: '/transactions', label: 'Transactions', icon: <ReceiptText size={18} /> },
  { to: '/trends', label: 'Comparisons', icon: <TrendingUp size={18} /> },
  { to: '/reports', label: 'Reports', icon: <FileDown size={18} /> },
  { to: '/trips', label: 'Splits', icon: <Users size={18} /> }
];

function normalizeTripDetail(detail) {
  if (!detail) return null;
  if (detail.trip) {
    return {
      ...detail.trip,
      people: detail.people || [],
      expenses: detail.expenses || []
    };
  }
  return {
    ...detail,
    people: detail.people || [],
    expenses: detail.expenses || []
  };
}

function Dashboard({ summary, recent, chartData, monthly }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total Income" value={formatCurrency(summary.incomeTotal)} accent="emerald" />
        <SummaryCard label="Total Expense" value={formatCurrency(summary.expenseTotal)} accent="orange" />
        <SummaryCard label="Net Balance" value={formatCurrency(summary.net)} accent="slate" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Income vs Expense">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="income" fill="#34d399" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="#fb923c" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Expense Breakdown">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={55}>
                  {chartData.map((entry, index) => <Cell key={entry.name} fill={['#34d399', '#f59e0b', '#a78bfa', '#60a5fa', '#f472b6', '#fb923c', '#4b5563'][index % 7]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card title="Recent Transactions">
        <div className="space-y-3">
          {recent.map(item => (
            <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
              <div>
                <p className="font-medium">{item.source || item.name}</p>
                <p className="text-sm text-slate-500">{item.date} • {item.kind}</p>
              </div>
              <div className={`font-semibold ${item.kind === 'Income' ? 'text-emerald-600' : 'text-orange-600'}`}>{item.kind === 'Income' ? '+' : '-'}{formatCurrency(item.amount)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TransactionsPage({ incomeForm, setIncomeForm, expenseForm, setExpenseForm, handleIncomeSubmit, handleExpenseSubmit, transactions, deleteTransaction, incomeFeedback, expenseFeedback, isSavingIncome, isSavingExpense }) {
  return (
    <div className="space-y-4">
      <Card title="Add Income">
        <form onSubmit={handleIncomeSubmit} className="space-y-3">
          <input value={incomeForm.source} onChange={e => setIncomeForm({ ...incomeForm, source: e.target.value })} placeholder="Source" required className="w-full rounded-2xl border border-slate-200 p-3" />
          <input type="number" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} placeholder="Amount" required className="w-full rounded-2xl border border-slate-200 p-3" />
          <input type="date" value={incomeForm.date} onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })} className="w-full rounded-2xl border border-slate-200 p-3" />
          <textarea value={incomeForm.note} onChange={e => setIncomeForm({ ...incomeForm, note: e.target.value })} placeholder="Optional note" className="w-full rounded-2xl border border-slate-200 p-3" />
          <button disabled={isSavingIncome} className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70">{isSavingIncome ? 'Saving...' : 'Save Income'}</button>
          {incomeFeedback.message ? <p className={`mt-2 text-sm ${incomeFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{incomeFeedback.message}</p> : null}
        </form>
      </Card>
      <Card title="Add Expense">
        <form onSubmit={handleExpenseSubmit} className="space-y-3">
          <input value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} placeholder="Expense name" required className="w-full rounded-2xl border border-slate-200 p-3" />
          <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="Amount" required className="w-full rounded-2xl border border-slate-200 p-3" />
          <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full rounded-2xl border border-slate-200 p-3">
            {categories.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
          <input value={expenseForm.customCategory} onChange={e => setExpenseForm({ ...expenseForm, customCategory: e.target.value })} placeholder="Add custom category" className="w-full rounded-2xl border border-slate-200 p-3" />
          <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full rounded-2xl border border-slate-200 p-3" />
          <textarea value={expenseForm.note} onChange={e => setExpenseForm({ ...expenseForm, note: e.target.value })} placeholder="Optional note" className="w-full rounded-2xl border border-slate-200 p-3" />
          <button disabled={isSavingExpense} className="w-full rounded-2xl bg-orange-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70">{isSavingExpense ? 'Saving...' : 'Save Expense'}</button>
          {expenseFeedback.message ? <p className={`mt-2 text-sm ${expenseFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{expenseFeedback.message}</p> : null}
        </form>
      </Card>
      <Card title="Recent Entries">
        <div className="space-y-3">
          {[...transactions.income.map(i => ({ ...i, kind: 'Income' })), ...transactions.expenses.map(e => ({ ...e, kind: 'Expense' }))].sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => (
            <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
              <div>
                <p className="font-medium">{item.source || item.name}</p>
                <p className="text-sm text-slate-500">{item.date} • {item.category || ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${item.kind === 'Income' ? 'text-emerald-600' : 'text-orange-600'}`}>{formatCurrency(item.amount)}</span>
                <button onClick={() => deleteTransaction(item.kind === 'Income' ? 'income' : 'expenses', item.id)} className="text-sm text-rose-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TrendsPage({ monthly }) {
  return (
    <div className="space-y-4">
      <Card title="Trend Comparison">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="income" fill="#34d399" />
              <Bar dataKey="expense" fill="#fb923c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function ReportsPage({ reportState, setReportState, exportCsv, exportXlsx, importXlsx, importStatus, transactions }) {
  function quickRange(key) {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    if (key === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (key === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    } else if (key === 'last-month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (key === 'last-year') {
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
    }
    setReportState({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), output: '' });
  }

  return (
    <div className="space-y-4">
      <Card title="Export Reports">
        <div className="flex flex-wrap gap-2">
          {[['This Month', 'month'], ['This Year', 'year'], ['Last Month', 'last-month'], ['Last Year', 'last-year']].map(([label, key]) => <button key={key} onClick={() => quickRange(key)} className="rounded-full border border-slate-200 px-3 py-2 text-sm">{label}</button>)}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input type="date" value={reportState.startDate} onChange={e => setReportState({ ...reportState, startDate: e.target.value })} className="rounded-2xl border border-slate-200 p-3" />
          <input type="date" value={reportState.endDate} onChange={e => setReportState({ ...reportState, endDate: e.target.value })} className="rounded-2xl border border-slate-200 p-3" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white"><FileDown size={18} /> Download CSV</button>
          <button onClick={exportXlsx} className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 font-semibold text-white"><FileDown size={18} /> Download XLSX</button>
        </div>
        <label className="mt-3 block rounded-2xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">
          <span className="mb-2 block font-medium">Import Excel file</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={importXlsx} className="w-full" />
        </label>
        {importStatus ? <p className="text-sm text-emerald-700">{importStatus}</p> : null}
      </Card>
      <Card title="Preview">
        <div className="text-sm text-slate-600">{[...transactions.income, ...transactions.expenses].length} entries available.</div>
      </Card>
    </div>
  );
}

function TripsPage({ trips, tripForm, setTripForm, createTrip, deleteTrip, setTripDetail, fetchTripDetail }) {
  return (
    <div className="space-y-4">
      <Card title="Create Trip">
        <form onSubmit={createTrip} className="space-y-3">
          <input value={tripForm.name} onChange={e => setTripForm({ ...tripForm, name: e.target.value })} placeholder="Trip name" required className="w-full rounded-2xl border border-slate-200 p-3" />
          <input type="date" value={tripForm.date} onChange={e => setTripForm({ ...tripForm, date: e.target.value })} className="w-full rounded-2xl border border-slate-200 p-3" />
          <textarea value={tripForm.description} onChange={e => setTripForm({ ...tripForm, description: e.target.value })} placeholder="Description" className="w-full rounded-2xl border border-slate-200 p-3" />
          <button className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white">Create Trip</button>
        </form>
      </Card>
      <Card title="Trips">
        <div className="space-y-3">
          {trips.map(trip => (
            <div key={trip.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{trip.name}</p>
                  <p className="text-sm text-slate-500">{trip.date}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/trips/${trip.id}`} className="rounded-full bg-slate-100 px-3 py-2 text-sm" onClick={() => fetchTripDetail(trip.id)}>Open</Link>
                  <button onClick={() => deleteTrip(trip.id)} className="rounded-full bg-rose-100 px-3 py-2 text-sm text-rose-700">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function TripDetailPage({ tripDetail, setTripDetail, tripPersonForm, setTripPersonForm, addPerson, tripExpenseForm, setTripExpenseForm, addTripExpense }) {
  if (!tripDetail) return <div className="rounded-3xl bg-white p-6 shadow-sm">Select a trip.</div>;

  const balances = calculateBalances(tripDetail.people || [], tripDetail.expenses || []);
  const settlement = simplifyDebts(balances);

  return (
    <div className="space-y-4">
      <Card title={tripDetail.name}>
        <p className="text-sm text-slate-500">{tripDetail.description}</p>
      </Card>
      <Card title="People">
        <div className="space-y-3">
          {tripDetail.people.map(person => <div key={person.id} className="rounded-2xl border border-slate-200 p-3">{person.name}</div>)}
          <div className="flex gap-2">
            <input value={tripPersonForm.name} onChange={e => setTripPersonForm({ name: e.target.value })} placeholder="New person" className="flex-1 rounded-2xl border border-slate-200 p-3" />
            <button onClick={() => addPerson(tripDetail.id)} className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white">Add</button>
          </div>
        </div>
      </Card>
      <Card title="Expenses">
        <div className="space-y-3">
          {tripDetail.expenses.map(expense => <div key={expense.id} className="rounded-2xl border border-slate-200 p-3"><p className="font-medium">{expense.description}</p><p className="text-sm text-slate-500">Paid by {expense.person_name} • {formatCurrency(expense.amount)}</p></div>)}
          <div className="space-y-2">
            <select value={tripExpenseForm.personId} onChange={e => setTripExpenseForm({ ...tripExpenseForm, personId: e.target.value })} className="w-full rounded-2xl border border-slate-200 p-3">
              <option value="">Select payer</option>
              {tripDetail.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <input type="number" value={tripExpenseForm.amount} onChange={e => setTripExpenseForm({ ...tripExpenseForm, amount: e.target.value })} placeholder="Amount" className="w-full rounded-2xl border border-slate-200 p-3" />
            <input value={tripExpenseForm.description} onChange={e => setTripExpenseForm({ ...tripExpenseForm, description: e.target.value })} placeholder="Description" className="w-full rounded-2xl border border-slate-200 p-3" />
            <input type="date" value={tripExpenseForm.date} onChange={e => setTripExpenseForm({ ...tripExpenseForm, date: e.target.value })} className="w-full rounded-2xl border border-slate-200 p-3" />
            <button onClick={() => addTripExpense(tripDetail.id)} className="w-full rounded-2xl bg-orange-600 px-4 py-3 font-semibold text-white">Add Expense</button>
          </div>
        </div>
      </Card>
      <Card title="Balances">
        <div className="space-y-2">
          {balances.map(balance => <div key={balance.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3"><span>{balance.name}</span><span className={balance.net >= 0 ? 'text-emerald-600' : 'text-orange-600'}>{formatCurrency(balance.net)}</span></div>)}
        </div>
      </Card>
      <Card title="Settlement Plan">
        <div className="space-y-2">
          {settlement.length === 0 ? <p className="text-sm text-slate-500">Everyone is settled.</p> : settlement.map((entry, index) => <div key={`${entry.from}-${entry.to}-${index}`} className="rounded-2xl border border-slate-200 p-3">{entry.from} owes {entry.to} {formatCurrency(entry.amount)}</div>)}
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  const colorMap = { emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700', orange: 'border-orange-100 bg-orange-50 text-orange-700', slate: 'border-slate-200 bg-white text-slate-700' };
  return <div className={`rounded-3xl border p-4 shadow-sm ${colorMap[accent]}`}><p className="text-sm">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function Card({ title, children }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">{title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}{children}</section>;
}

export default App;
