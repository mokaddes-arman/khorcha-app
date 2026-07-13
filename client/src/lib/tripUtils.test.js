import assert from 'node:assert/strict';
import { calculateBalances, simplifyDebts } from './tripUtils.js';

const people = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Cara' }];
const expenses = [{ paid_by_person_id: 1, amount: 30 }, { paid_by_person_id: 2, amount: 60 }];
const balances = calculateBalances(people, expenses);
assert.equal(balances[0].net, 0);
assert.equal(balances[1].net, 30);
assert.equal(balances[2].net, -30);
const settlement = simplifyDebts(balances);
assert.equal(settlement.length, 1);
assert.equal(settlement[0].from, 'Bob');
assert.equal(settlement[0].to, 'Cara');
console.log('Trip settlement logic verified');
