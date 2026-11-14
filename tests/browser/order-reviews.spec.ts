import {test,expect,type Page} from '@playwright/test';
const userId='a'.repeat(24),orderId='b'.repeat(24),productId='c'.repeat(24),variantId='d'.repeat(24),reviewId='e'.repeat(24),otherProduct='f'.repeat(24);
async function mockOrders(page:Page,options:{empty?:boolean;existing?:boolean;failReview?:boolean;role?:string}={}){
 const state={reviews:options.existing?[{_id:reviewId,productId,orderId:variantId,rating:4,comment:'Already reviewed from an earlier order'}]:[] as Record<string,unknown>[],writes:[] as Record<string,unknown>[],pages:[] as string[],fail:options.failReview||false};
 const order=(id:string,status:string,product=productId)=>({_id:id,status,createdAt:'2026-11-01T12:00:00.000Z',paymentMethod:'Cash',subTotal:100,finalPrice:80,currency:'egp',products:[{productId:product,variantId,name:product===productId?'Polo black':'Other product',quantity:1,paymentPrice:80},...(status==='delivered'?[{productId:product,variantId:reviewId,name:'Polo white',quantity:1,paymentPrice:80}]:[])]});
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api/account')return route.fulfill({json:{user:{id:userId,name:'Youssef',email:'customer@example.com',phone:'01001234567',role:options.role||'User',emailVerified:true}}});
  if(url.pathname==='/api/account/orders'){
   const current=url.searchParams.get('page')||'1';state.pages.push(current);return route.fulfill({json:{orders:options.empty?[]:current==='2'?[order(reviewId,'cancelled',otherProduct)]:[order(orderId,'delivered'),order(variantId,'onTheWay',otherProduct)],reviews:state.reviews,pagination:{page:Number(current),size:10,hasMore:!options.empty&&current==='1'}}});
  }
  if(url.pathname==='/api/account/reviews/'+productId){
   const body=req.postDataJSON();state.writes.push(body);if(state.fail)return route.fulfill({status:503,json:{message:'Review could not be saved. Refresh and retry.'}});
   state.reviews.push({_id:reviewId,productId,...body});return route.fulfill({json:{review:state.reviews.at(-1)}});
  }
  return route.fulfill({status:404,json:{message:'Unmocked endpoint'}});
 });return state;
}
async function openOrders(page:Page){await page.goto('/account');await page.getByRole('button',{name:'My orders',exact:true}).click();await expect(page.getByRole('heading',{name:'My orders',exact:true})).toBeVisible();}
test('owned order history paginates and only delivered products offer one review per product',async({page})=>{
 const state=await mockOrders(page);await openOrders(page);await expect(page.getByRole('article')).toHaveCount(2);await expect(page.getByRole('button',{name:'Write a review',exact:true})).toHaveCount(1);await expect(page.getByText('You can review this product after delivery.',{exact:true})).toBeVisible();await expect(page.getByText('Your review applies to all variants of this product.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Cancelled items cannot be reviewed.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Write a review',exact:true})).toHaveCount(0);expect(state.pages).toContain('2');await page.getByRole('button',{name:'Previous',exact:true}).click();await expect(page.getByRole('button',{name:'Write a review',exact:true})).toBeVisible();
});
test('customer submits stars and a comment tied to the exact purchased product and order',async({page})=>{
 const state=await mockOrders(page);await openOrders(page);await page.getByRole('button',{name:'Write a review',exact:true}).click();const form=page.getByRole('form',{name:'Review Polo black',exact:true});await form.getByLabel('Your review',{exact:true}).fill('Good quality and fits well');await form.getByRole('button',{name:'Submit review',exact:true}).click();await expect(form.getByRole('alert')).toContainText('Choose a star rating');expect(state.writes).toHaveLength(0);await form.getByRole('radio',{name:'5 stars',exact:true}).check();await form.getByRole('button',{name:'Submit review',exact:true}).click();await expect(page.getByText('Your review',{exact:true})).toBeVisible();await expect(page.getByText('Good quality and fits well',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Write a review',exact:true})).toHaveCount(0);expect(state.writes).toEqual([{orderId,rating:5,comment:'Good quality and fits well'}]);await page.reload();await page.getByRole('button',{name:'My orders',exact:true}).click();await expect(page.getByText('Good quality and fits well',{exact:true})).toBeVisible();
});
test('earlier product reviews prevent a second review from a different order',async({page})=>{
 await mockOrders(page,{existing:true});await openOrders(page);await expect(page.getByText('Already reviewed from an earlier order',{exact:true})).toBeVisible();await expect(page.getByText('You already reviewed this product from another order.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Write a review',exact:true})).toHaveCount(0);
});
test('review failures retain the form values for retry',async({page})=>{
 const state=await mockOrders(page,{failReview:true});await openOrders(page);await page.getByRole('button',{name:'Write a review',exact:true}).click();const form=page.getByRole('form',{name:'Review Polo black',exact:true});await form.getByRole('radio',{name:'4 stars',exact:true}).check();await form.getByLabel('Your review',{exact:true}).fill('Comfortable material');await form.getByRole('button',{name:'Submit review',exact:true}).click();await expect(form.getByRole('alert')).toContainText('Review could not be saved');await expect(form.getByLabel('Your review',{exact:true})).toHaveValue('Comfortable material');await expect(form.getByRole('radio',{name:'4 stars',exact:true})).toBeChecked();state.fail=false;await form.getByRole('button',{name:'Submit review',exact:true}).click();await expect(page.getByText('Comfortable material',{exact:true})).toBeVisible();
});
test('empty order history has a clear empty state and sellers have no orders entry',async({page})=>{
 await mockOrders(page,{empty:true});await openOrders(page);await expect(page.getByRole('heading',{name:'No orders yet',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Write a review',exact:true})).toHaveCount(0);
});
test('seller accounts cannot open customer order history',async({page})=>{
 const state=await mockOrders(page,{role:'Seller'});await page.goto('/account');await expect(page.getByRole('heading',{name:'Hi, Youssef!',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'My orders',exact:true})).toHaveCount(0);expect(state.pages).toEqual([]);
});
test('review form fits a mobile viewport with accessible star choices',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await mockOrders(page);await openOrders(page);await page.getByRole('button',{name:'Write a review',exact:true}).click();const form=page.getByRole('form',{name:'Review Polo black',exact:true});await form.getByRole('radio',{name:'5 stars',exact:true}).check();await form.getByLabel('Your review',{exact:true}).fill('Great product');await form.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('order-review-mobile.png'),fullPage:true});
});
test('order/review proxies reject missing auth, forged owner filters, invalid IDs, ratings and cross-origin writes',async({request})=>{
 expect((await request.get('/api/account/orders')).status()).toBe(401);const headers={Cookie:'dorytos_session=not-a-real-token'};
 expect((await request.get('/api/account/orders?createdBy='+userId,{headers})).status()).toBe(400);
 expect((await request.post('/api/account/reviews/invalid',{headers,data:{orderId,rating:5,comment:'Great'}})).status()).toBe(400);
 expect((await request.post('/api/account/reviews/'+productId,{headers,data:{orderId,rating:6,comment:'Great'}})).status()).toBe(400);
 expect((await request.post('/api/account/reviews/'+productId,{headers,data:{orderId,rating:5,comment:'Great',createdBy:userId}})).status()).toBe(400);
 expect((await request.post('/api/account/reviews/'+productId,{headers:{...headers,Origin:'https://unrelated.example'},data:{orderId,rating:5,comment:'Great'}})).status()).toBe(403);
});
