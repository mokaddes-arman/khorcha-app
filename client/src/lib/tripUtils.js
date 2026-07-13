export function calculateBalances(people, expenses) {
  const totals = people.map((person) => ({ id: person.id, name: person.name, net: 0 }));
  const totalCost = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const share = people.length ? totalCost / people.length : 0;

  expenses.forEach((expense) => {
    const idx = totals.findIndex((item) => item.id === expense.paid_by_person_id);
    if (idx >= 0) totals[idx].net += Number(expense.amount);
  });

  totals.forEach((item) => {
    item.net -= share;
  });

  return totals;
}

export function simplifyDebts(balances) {
  const creditors = balances.filter((b) => b.net < 0).map((b) => ({ ...b, net: Math.abs(b.net) }));
  const debtors = balances.filter((b) => b.net > 0).map((b) => ({ ...b, net: b.net }));
  const transactions = [];

  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const amount = Math.min(creditor.net, debtor.net);

    if (amount > 0) {
      transactions.push({ from: debtor.name, to: creditor.name, amount });
    }

    creditor.net -= amount;
    debtor.net -= amount;

    if (creditor.net <= 0.0001) i += 1;
    if (debtor.net <= 0.0001) j += 1;
  }

  return transactions;
}
