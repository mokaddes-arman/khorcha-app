function formatDateLabel(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getComparisonBucketKey(date, range) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(date || 'Unknown');

  if (range === 'daily') return formatDateLabel(parsed);

  if (range === 'weekly') {
    const day = parsed.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(parsed);
    start.setDate(parsed.getDate() + diff);
    return `Week of ${formatDateLabel(start)}`;
  }

  if (range === 'monthly') {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  return String(parsed.getFullYear());
}

export function buildComparisonSeries(transactions, range) {
  const buckets = {};

  [...(transactions.income || []), ...(transactions.expenses || [])].forEach((item) => {
    const key = getComparisonBucketKey(item.date, range);
    if (!buckets[key]) {
      buckets[key] = { label: key, income: 0, expense: 0 };
    }

    if (item.source) {
      buckets[key].income += Number(item.amount || 0);
    } else {
      buckets[key].expense += Number(item.amount || 0);
    }
  });

  return Object.values(buckets).sort((a, b) => a.label.localeCompare(b.label));
}
