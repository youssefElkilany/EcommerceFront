import test from 'node:test';
import assert from 'node:assert/strict';
import { createCartQuantityUpdater } from '../src/lib/cart-quantity-updates.ts';

const item = (variantId, quantity = 1, finalPrice = 10) => ({ productId: 'product', variantId, name: variantId, quantity, finalPrice, stock: 10, options: {}, lineTotal: finalPrice * quantity });
const cart = (...items) => ({ items, itemCount: items.reduce((sum, entry) => sum + entry.quantity, 0), subtotal: items.reduce((sum, entry) => sum + entry.lineTotal, 0) });
function harness(save, initial = cart(item('a'))) {
  let displayed = initial;
  const updater = createCartQuantityUpdater({ getCart: () => displayed, publish: value => { displayed = value; }, save });
  return { updater, view: () => displayed };
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('rapid clicks update quantity, item count and totals immediately and coalesce into one save', async () => {
  const calls = [];
  const h = harness(async request => { calls.push(request); return cart(item('a', request.quantity)); });
  h.updater.change(item('a'), 1);
  h.updater.change(item('a'), 1);
  h.updater.change(item('a'), 1);
  assert.equal(h.view().items[0].quantity, 4);
  assert.equal(h.view().items[0].lineTotal, 40);
  assert.equal(h.view().subtotal, 40);
  assert.equal(h.view().itemCount, 4);
  assert.equal(calls.length, 0);
  await h.updater.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].quantity, 4);
  assert.equal(h.view().items[0].quantity, 4);
  assert.equal(h.updater.getStatus().saving, false);
});

test('a rejected edit restores the last successfully confirmed quantity and totals', async () => {
  let reject = false;
  const h = harness(async request => { if (reject) throw new Error('Only 2 available in stock'); return cart(item('a', request.quantity)); });
  h.updater.change(item('a'), 1);
  await h.updater.flush();
  reject = true;
  h.updater.change(item('a'), 1);
  assert.equal(h.view().subtotal, 30);
  await h.updater.flush();
  assert.equal(h.view().items[0].quantity, 2);
  assert.equal(h.view().subtotal, 20);
  assert.equal(h.view().itemCount, 2);
  assert.equal(h.updater.getStatus().error, 'Only 2 available in stock');
});

test('newer clicks during an in-flight request survive the older response and save in order', async () => {
  const first = deferred();
  const calls = [];
  const h = harness(async request => { calls.push(request); if (calls.length === 1) return first.promise; return cart(item('a', request.quantity)); });
  h.updater.change(item('a'), 1);
  const saving = h.updater.flush();
  h.updater.change(item('a'), 1);
  const latest = h.updater.flush();
  assert.equal(h.view().items[0].quantity, 3);
  assert.equal(calls.length, 1);
  first.resolve(cart(item('a', 2)));
  await Promise.all([saving, latest]);
  assert.deepEqual(calls.map(call => call.quantity), [2, 3]);
  assert.equal(h.view().items[0].quantity, 3);
  assert.equal(h.view().subtotal, 30);
});

test('failure rolls back only the rejected item while preserving other pending edits', async () => {
  const first = deferred();
  const calls = [];
  const h = harness(async request => { calls.push(request); if (request.variantId === 'a') return first.promise; return cart(item('a'), item('b', request.quantity, 20)); }, cart(item('a'), item('b', 1, 20)));
  h.updater.change(item('a'), 1);
  const saving = h.updater.flush();
  h.updater.change(item('b'), 1);
  const all = h.updater.flush();
  first.reject(new Error('Stock changed'));
  await Promise.all([saving, all]);
  assert.deepEqual(h.view().items.map(entry => entry.quantity), [1, 2]);
  assert.equal(h.view().subtotal, 50);
  assert.equal(h.updater.getStatus().error, 'Stock changed');
  assert.equal(calls.length, 2);
});

test('minimum and available stock limits prevent invalid local changes or requests', async () => {
  const calls = [];
  const h = harness(async request => { calls.push(request); return cart(item('a', request.quantity)); });
  h.updater.change(item('a'), -1);
  h.updater.change(item('a'), 10);
  await h.updater.flush();
  assert.equal(h.view().items[0].quantity, 1);
  assert.equal(calls.length, 0);
});

test('leaving the page flushes a pending debounced save even without a UI subscriber', async () => {
  const calls = [];
  const h = harness(async request => { calls.push(request); return cart(item('a', request.quantity)); });
  h.updater.setListener(() => {});
  h.updater.change(item('a'), 1);
  h.updater.setListener(undefined);
  await h.updater.flush();
  assert.equal(calls.length, 1);
  assert.equal(h.view().items[0].quantity, 2);
});

test('an account cache reset discards queued edits and ignores an old in-flight response', async () => {
  let displayed = cart(item('a'));
  const first = deferred();
  const calls = [];
  const updater = createCartQuantityUpdater({ getCart: () => displayed, publish: value => { displayed = value; }, save: async request => { calls.push(request); return first.promise; } });
  updater.change(item('a'), 1);
  const saving = updater.flush();
  updater.change(item('a'), 1);
  displayed = undefined; // Login/logout clears the account's cart query.
  first.resolve(cart(item('a', 2)));
  await saving;
  assert.equal(displayed, undefined);
  assert.equal(calls.length, 1);
  assert.equal(updater.getStatus().saving, false);
});
