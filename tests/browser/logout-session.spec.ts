import {test,expect,type Page} from '@playwright/test';
async function mockSession(page:Page){
 const state={signedIn:false,logoutCalls:0,failLogout:false,user:'First customer'};
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/auth/login'){state.signedIn=true;return route.fulfill({json:{message:'Signed in',role:'User'}});}
  if(path==='/api/auth/logout'){state.logoutCalls++;if(state.failLogout)return route.fulfill({status:503,json:{message:'Unavailable'}});state.signedIn=false;return route.fulfill({json:{message:'Signed out'}});}
  if(path==='/api/account')return route.fulfill(state.signedIn?{json:{user:{id:state.user==='First customer'?'a'.repeat(24):'b'.repeat(24),name:state.user,email:'test@example.com',phone:'01001234567',role:'User',emailVerified:true}}}:{status:401,json:{message:'Log in to manage your account.'}});
  if(path==='/api/cart')return route.fulfill(state.signedIn?{json:{cart:{items:[],itemCount:0,subtotal:0}}}:{status:401,json:{message:'Sign in'}});
  if(path==='/api/wishlist')return route.fulfill(state.signedIn?{json:{products:[]}}:{status:401,json:{message:'Sign in'}});
  if(path==='/api/catalog/categories')return route.fulfill({json:{categories:[]}});
  if(path==='/api/catalog/brands')return route.fulfill({json:{brands:[]}});
  return route.fulfill({status:404,json:{message:'Unmocked'}});
 });return state;
}
async function login(page:Page){await page.getByLabel('Email address',{exact:true}).fill('test@example.com');await page.getByLabel('Password',{exact:true}).fill('existing-password');await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome to Dorytos.',exact:true})).toBeVisible();}
async function openAccount(page:Page){await page.locator('.auth-success').getByRole('link',{name:'Back to store',exact:true}).click();await page.getByRole('link',{name:'Account',exact:true}).click();await expect(page.getByRole('heading',{name:'Hi, First customer!',exact:true})).toBeVisible();}
test('one sign-out from settings resets a cached login-success screen',async({page})=>{
 const state=await mockSession(page);await page.goto('/login');await login(page);await openAccount(page);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login$/);await expect(page.getByRole('heading',{name:'Welcome back.',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Log in',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Customer signup',exact:true})).toBeVisible();await expect(page.locator('.auth-success')).toHaveCount(0);expect(state.logoutCalls).toBe(1);expect(state.signedIn).toBe(false);
 await page.goBack();await expect(page).toHaveURL(/\/$/);await page.getByRole('link',{name:'Account',exact:true}).click();await expect(page.getByRole('heading',{name:'Sign in to manage your account',exact:true})).toBeVisible();await page.getByRole('link',{name:'Log in to continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back.',exact:true})).toBeVisible();expect(state.logoutCalls).toBe(1);
});
test('auth-page sign out resets the login form without a second logout',async({page})=>{
 const state=await mockSession(page);await page.goto('/login');await login(page);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back.',exact:true})).toBeVisible();await expect(page.getByLabel('Password',{exact:true})).toHaveValue('');expect(state.logoutCalls).toBe(1);
});
test('failed logout keeps the account visible and permits retry',async({page})=>{
 const state=await mockSession(page);await page.goto('/login');await login(page);await openAccount(page);state.failLogout=true;await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByText('Unable to sign out. Please try again.',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Hi, First customer!',exact:true})).toBeVisible();expect(state.signedIn).toBe(true);state.failLogout=false;await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back.',exact:true})).toBeVisible();
});
test('logging in after logout fetches the new account rather than restoring old personal data',async({page})=>{
 const state=await mockSession(page);await page.goto('/login');await login(page);await openAccount(page);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back.',exact:true})).toBeVisible();state.user='Second customer';await login(page);await page.locator('.auth-success').getByRole('link',{name:'Back to store',exact:true}).click();await page.getByRole('link',{name:'Account',exact:true}).click();await expect(page.getByRole('heading',{name:'Hi, Second customer!',exact:true})).toBeVisible();await expect(page.getByText('Hi, First customer!',{exact:true})).toHaveCount(0);
});
