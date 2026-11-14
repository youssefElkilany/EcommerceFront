import {test,expect,type Page} from '@playwright/test';
const id='a'.repeat(24),variantId='b'.repeat(24);
async function seller(page:Page){
 const customerCalls:string[]=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/account')return route.fulfill({json:{user:{id,name:'Seller',email:'seller@example.com',phone:'01001234567',role:'Seller',emailVerified:true}}});
  if(path.startsWith('/api/cart')||path==='/api/wishlist'){customerCalls.push(path);return route.fulfill({status:403,json:{message:'Switch to a customer account.'}});}
  if(path==='/api/auth/logout')return route.fulfill({json:{message:'Signed out'}});
  if(path==='/api/catalog/categories')return route.fulfill({json:{categories:[]}});
  if(path==='/api/catalog/brands')return route.fulfill({json:{brands:[]}});
  const variant={_id:variantId,name:'Polo',price:100,finalPrice:100,stock:5,options:{color:'Black'}};
  if(path==='/api/catalog/products')return route.fulfill({json:{products:[{_id:id,variants:[variant]}]}});
  if(path.startsWith('/api/catalog/product/'))return route.fulfill({json:{productId:id,variant,availableVariants:[]}});
  return route.fulfill({status:404,json:{message:'Unmocked'}});
 });return customerCalls;
}
test('seller can browse products but cannot add to cart or wishlist',async({page})=>{
 const calls=await seller(page);await page.goto('/search?q=polo');await expect(page.getByRole('link',{name:'Seller center',exact:true})).toBeVisible();await expect(page.locator('.product-card')).toHaveCount(1);await expect(page.getByRole('button',{name:'Add Polo to cart'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Save Polo'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Cart',exact:true})).toHaveCount(0);
 await page.goto('/products/'+id+'/'+variantId);await expect(page.getByRole('heading',{name:'Switch to a customer account'})).toBeVisible();await expect(page.getByRole('button',{name:'Add to cart',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add to wishlist'})).toHaveCount(0);expect(calls).toEqual([]);
});
test('direct cart and wishlist visits explain account switching without customer requests',async({page})=>{
 const calls=await seller(page);for(const path of ['/cart','/wishlist']){await page.goto(path);await expect(page.getByRole('heading',{name:'Switch to a customer account'})).toBeVisible();await expect(page.getByRole('button',{name:'Switch account',exact:true})).toBeVisible();}expect(calls).toEqual([]);
 await page.getByRole('button',{name:'Switch account',exact:true}).click();await expect(page).toHaveURL(/\/login\?next=%2Fwishlist/);
});
test('seller account page hides customer shopping, order and address entries',async({page})=>{
 const calls=await seller(page);await page.goto('/account');await expect(page.getByRole('heading',{name:'Hi, Seller!'})).toBeVisible();await expect(page.getByRole('link',{name:'Seller center',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'My orders Soon'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Addresses',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Wishlist',exact:true})).toHaveCount(0);expect(calls).toEqual([]);
});
