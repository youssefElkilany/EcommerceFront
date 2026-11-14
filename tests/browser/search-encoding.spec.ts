import {test,expect} from '@playwright/test';
for(const query of ['polo','\u0642\u0645\u064a\u0635']){
 test('search punctuation and query encoding remain correct: '+query,async({page})=>{
  const searches:string[]=[];
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/account')return route.fulfill({status:401,json:{message:'Sign in'}});
   if(url.pathname==='/api/cart')return route.fulfill({status:401,json:{message:'Sign in'}});
   if(url.pathname==='/api/wishlist')return route.fulfill({status:401,json:{message:'Sign in'}});
   if(url.pathname==='/api/catalog/categories')return route.fulfill({json:{categories:[]}});
   if(url.pathname==='/api/catalog/brands')return route.fulfill({json:{brands:[]}});
   if(url.pathname==='/api/catalog/products'){searches.push(url.searchParams.get('search')||'');return route.fulfill({json:{products:[],pagination:{page:1,size:24,totalItems:0,hasMore:false}}});}
   return route.fulfill({status:404,json:{message:'Unmocked'}});
  });
  await page.goto('/search?q='+encodeURIComponent(query));
  await expect(page.getByRole('heading',{name:'Results for "'+query+'"',exact:true})).toBeVisible();
  await expect(page.getByText('Page 1 - 0 results',{exact:true})).toBeVisible();
  await expect(page.getByRole('searchbox',{name:'Search products',exact:true})).toHaveValue(query);
  await expect(page.locator('.store-footer')).toContainText('\u00a9 Dorytos \u00b7 Egypt \u00b7 EGP');
  expect(searches).toContain(query);
  expect(await page.locator('.storefront').innerText()).not.toMatch(/\u00ef\u00bf\u00bd|\u00c2[\u00a9\u00b7]|\ufffd/);
 });
}
