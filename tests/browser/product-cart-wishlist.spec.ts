import { test, expect, type Page } from '@playwright/test';

const productId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const variantId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const product = { _id: productId, brandName: 'Dorytos', ratings: { average: 0, count: 0 }, variants: [{ _id: variantId, name: 'Blue polo', price: 100, finalPrice: 80, stock: 5, options: { color: 'Blue' } }] };
async function mockStore(page: Page, initialQuantity = 0) {
  let quantity = initialQuantity;
  let saved = false;
  const additions: number[] = [];
  const updates: number[] = [];
  const cart = () => ({ items: quantity ? [{ productId, variantId, name: 'Blue polo', quantity, stock: 5, options: { color: 'Blue' }, finalPrice: 80, lineTotal: quantity * 80 }] : [], itemCount: quantity, subtotal: quantity * 80 });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let data: unknown;
    if(pathname === '/api/account')return route.fulfill({json:{user:{id:'c'.repeat(24),name:'Customer',email:'customer@example.com',phone:'01001234567',role:'User',emailVerified:true}}});
    if (pathname === '/api/cart') {
      if (request.method() === 'POST') { const amount = request.postDataJSON().quantity; additions.push(amount); quantity += amount; }
      if (request.method() === 'PATCH') { const amount = request.postDataJSON().quantity; updates.push(amount); await new Promise(resolve => setTimeout(resolve, 100)); quantity = amount; }
      data = { cart: cart() };
    } else if (pathname.startsWith('/api/cart/') && request.method() === 'DELETE') { quantity = 0; data = { cart: cart() }; }
    else if (pathname === '/api/wishlist') {
      if (request.method() === 'POST') saved = true;
      if (request.method() === 'DELETE') saved = false;
      data = { products: saved ? [product] : [] };
    } else if (pathname === '/api/catalog/categories') data = { categories: [] };
    else if (pathname === '/api/catalog/brands') data = { brands: [] };
    else if (pathname === '/api/catalog/products') data = { products: [product], pagination: { page: 1, size: 24, totalItems: 1, hasMore: false } };
    else if (pathname.startsWith('/api/catalog/product/')) data = { productId, description: 'Cotton polo', brandName: 'Dorytos', variant: product.variants[0], availableVariants: [], specifications: [] };
    else return route.fulfill({ status: 404, json: { message: 'Unmocked API request' } });
    return route.fulfill({ json: data });
  });
  return { additions, updates, quantity: () => quantity };
}

test('product cards add, increment optimistically, decrement, and remove at zero', async ({ page }) => {
  const store = await mockStore(page);
  await page.goto('/search?q=polo');
  const card = page.locator('.product-card').first();
  await card.getByRole('button', { name: 'Add Blue polo to cart', exact: true }).click();
  await expect(card.locator('.product-card-quantity>span')).toHaveText('1');
  await card.getByRole('button', { name: 'Increase quantity for Blue polo', exact: true }).click();
  await expect(card.locator('.product-card-quantity>span')).toHaveText('2');
  await expect.poll(() => store.updates).toEqual([2]);
  await expect.poll(() => store.quantity()).toBe(2);
  await card.getByRole('button', { name: 'Decrease quantity for Blue polo', exact: true }).click();
  await expect(card.locator('.product-card-quantity>span')).toHaveText('1');
  await expect.poll(() => store.quantity()).toBe(1);
  await card.getByRole('button', { name: 'Decrease quantity for Blue polo', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Add Blue polo to cart', exact: true })).toBeVisible();
  expect(store.additions).toEqual([1]);
});

test('product-page quantity is added to existing quantity and enforces remaining stock', async ({ page }) => {
  const store = await mockStore(page, 2);
  await page.goto(`/products/${productId}/${variantId}`);
  const form = page.locator('.product-add-form');
  await expect(form.getByRole('button')).toHaveCount(1);
  await expect(form).toContainText('2 already in your cart');
  await form.getByLabel('Quantity to add').fill('2');
  await form.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(form).toContainText('4 already in your cart');
  expect(store.additions).toEqual([2]);
  await form.getByLabel('Quantity to add').fill('2');
  await form.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Stock limit');
  expect(store.additions).toEqual([2]);
  await form.getByLabel('Quantity to add').fill('1');
  await form.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Stock limit reached', exact: true })).toBeDisabled();
  expect(store.additions).toEqual([2, 1]);
  expect(store.quantity()).toBe(5);
});

test('wishlist heart uses account API and saved products load again after navigation', async ({ page }) => {
  await mockStore(page);
  await page.goto('/search?q=polo');
  await page.getByRole('button', { name: 'Save Blue polo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Blue polo', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/wishlist');
  await expect(page.locator('.wishlist-page .product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove Blue polo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty', exact: true })).toBeVisible();
});
