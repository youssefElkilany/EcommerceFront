import test from 'node:test';
import assert from 'node:assert/strict';
import { cartQuantityLimit, remainingToAdd, validateAddition } from '../src/lib/cart-limits.ts';

test('product-page additions subtract the quantity already in the cart from stock', () => {
  assert.equal(remainingToAdd(8, 3), 5);
  assert.equal(validateAddition('5', 8, 3), '');
  assert.match(validateAddition('6', 8, 3), /Stock limit.*5 more/);
});
test('no more quantity may be added at the stock limit or when out of stock', () => {
  assert.equal(remainingToAdd(3, 3), 0);
  assert.equal(remainingToAdd(0, 0), 0);
  assert.match(validateAddition('1', 3, 3), /Stock limit/);
});
test('the UI respects the backend limit of 99 per item', () => {
  assert.equal(cartQuantityLimit(500), 99);
  assert.equal(remainingToAdd(500, 98), 1);
  assert.match(validateAddition('2', 500, 98), /99/);
});
test('invalid manually entered quantities are rejected', () => {
  for (const input of ['', '0', '-1', '1.5', 'abc']) assert.match(validateAddition(input, 10, 0), /whole quantity/);
});
