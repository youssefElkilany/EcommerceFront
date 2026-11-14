import { test, expect, type Page } from '@playwright/test';
const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
async function mockAccount(page: Page, signedIn = true) {
  let user = { id: userId, name: 'Youssef', email: 'youssef@example.com', phone: '01001234567', role: 'User', emailVerified: true };
  let addresses: Record<string, unknown>[] = [];
  const creates: Record<string, unknown>[] = [];
  let nextId = 1;
  const calls: string[] = [];
  await page.route('**/api/**', async route => {
    const req = route.request();const url = new URL(req.url());calls.push(req.method() + ' ' + url.pathname);
    if(url.pathname === '/api/account/orders')return route.fulfill({json:{orders:[],reviews:[],pagination:{page:1,size:10,hasMore:false}}});
    if (url.pathname === '/api/account') {
      if (!signedIn) return route.fulfill({ status: 401, json: { message: 'Log in to manage your account.' } });
      if (req.method() === 'PATCH') user = { ...user, ...req.postDataJSON() };
      return route.fulfill({ json: { user } });
    }
    if (url.pathname === '/api/account/addresses') {
      if (req.method() === 'POST') {
        const body = req.postDataJSON(); creates.push(body);
        const isDefault = !addresses.length || body.isDefault;
        if (isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false }));
        addresses.push({ ...body, _id: String(nextId++).padStart(24, '0'), isDefault });
        return route.fulfill({ status: 201, json: { address: addresses.at(-1) } });
      }
      return route.fulfill({ json: { addresses } });
    }
    if (url.pathname.startsWith('/api/account/addresses/')) {
      const id = url.pathname.split('/').at(-1);
      if (req.method() === 'PATCH') {
        const body = req.postDataJSON();
        if (body.isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false }));
        addresses = addresses.map(item => item._id === id ? { ...item, ...body } : item);
      }
      if (req.method() === 'DELETE') { addresses = addresses.filter(item => item._id !== id); if (addresses.length && !addresses.some(item => item.isDefault)) addresses[0].isDefault = true; }
      return route.fulfill({ json: { message: 'Saved' } });
    }
    if (url.pathname === '/api/auth/logout') { signedIn = false; return route.fulfill({ json: { message: 'Signed out' } }); }
    return route.fulfill({ status: 404, json: { message: 'Unmocked request' } });
  });
  return { creates, calls };
}

test('signed-out users must log in before seeing personal account data', async ({ page }) => {
  const state = await mockAccount(page, false);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Sign in to manage your account', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in to continue', exact: true })).toHaveAttribute('href', '/login?next=%2Faccount');
  expect(state.calls.some(call => call.includes('/addresses'))).toBe(false);
});

test('account details greet the user, save name/phone and load order history', async ({ page }) => {
  const state = await mockAccount(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Hi, Youssef!', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('youssef@example.com');
  await expect(page.getByLabel('Email address', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByLabel('Full name', { exact: true }).fill('Youssef Ahmed');
  await page.getByLabel('Phone number', { exact: true }).fill('01101234567');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Youssef Ahmed!', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My orders', exact: true }).click();
  await expect(page.getByRole('heading',{name:'No orders yet',exact:true})).toBeVisible();
  expect(state.calls.some(call => call.includes('/account/orders'))).toBe(true);
});

test('customers add, edit, set default and delete Egyptian delivery addresses', async ({ page }) => {
  const state = await mockAccount(page);
  await page.goto('/account');
  await page.getByRole('button', { name: 'Addresses', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No addresses yet', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  await expect(page.getByLabel('Country', { exact: true })).toHaveValue('Egypt');
  await expect(page.getByLabel('Country', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByLabel('Governorate', { exact: true }).selectOption('Cairo');
  await page.getByLabel('City / area', { exact: true }).fill('Nasr City');
  await page.getByLabel('Street address', { exact: true }).fill('10 Example Street');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.locator('.address-card')).toHaveCount(1);
  expect(state.creates[0].country).toBe('Egypt');expect(state.creates[0].governorate).toBe('Cairo');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('City / area', { exact: true }).fill('Maadi');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.locator('.address-card')).toContainText('Maadi');
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  await page.getByLabel('Address label', { exact: true }).selectOption('work');
  await page.getByLabel('Governorate', { exact: true }).selectOption('Giza');
  await page.getByLabel('City / area', { exact: true }).fill('Dokki');
  await page.getByLabel('Street address', { exact: true }).fill('20 Work Street');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.locator('.address-card')).toHaveCount(2);
  const work = page.locator('.address-card').filter({ has: page.getByRole('heading', { name: 'work', exact: true }) });
  await work.getByRole('button', { name: 'Make default', exact: true }).click();
  await expect(work.locator('.address-card-heading')).toContainText('Default');
  await work.getByRole('button', { name: 'Delete', exact: true }).click();
  await work.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(page.locator('.address-card')).toHaveCount(1);
  await expect(page.locator('.address-card-heading')).toContainText('Default');
});
