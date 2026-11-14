import {test,expect,type Page} from '@playwright/test';
const id='a'.repeat(24),buyer='b'.repeat(24),productId='c'.repeat(24),variantId='d'.repeat(24),pendingId='e'.repeat(24),cancelId='f'.repeat(24);
async function mockStatus(page:Page,role='Seller'){
 const make=(orderId:string,status:string,ready:boolean)=>({_id:orderId,status,paymentMethod:'Cash',createdAt:'2026-11-01T12:00:00.000Z',subTotal:100,finalPrice:100,currency:'egp',products:[{productId,variantId,name:'Polo',quantity:1,paymentPrice:100}],shippingAddress:{name:'Customer',street:'Example street',city:'Cairo',phone:'01001234567'},checkoutReady:ready,availableStatuses:ready&&status==='placed'?['onTheWay','delivered']:ready&&status==='onTheWay'?['delivered']:[]});
 const state={role,orders:[make(id,'placed',true),make(pendingId,'pendingPayment',false),make(cancelId,'cancelled',true)],writes:[] as {path:string;body:Record<string,unknown>}[],queries:[] as string[],conflict:false};
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(path==='/api/account')return route.fulfill(state.role==='Guest'?{status:401,json:{message:'Sign in'}}:{json:{user:{id:state.role==='User'?buyer:id,name:'Youssef',email:'test@example.com',phone:'01001234567',role:state.role,emailVerified:true}}});
  if(path==='/api/seller/orders'){state.queries.push(url.search);const status=url.searchParams.get('status');return route.fulfill({json:{orders:state.orders.filter(order=>!status||order.status===status),pagination:{page:1,size:10,hasMore:false}}});}
  if(path==='/api/seller/orders/'+id&&req.method()==='PATCH'){
   const body=req.postDataJSON();state.writes.push({path,body});
   if(state.conflict){state.orders[0]=make(id,'cancelled',true);return route.fulfill({status:409,json:{message:'Order changed while you were updating it; refresh and try again'}});}
   state.orders[0]=make(id,body.status,true);return route.fulfill({json:{order:state.orders[0]}});
  }
  if(path==='/api/account/orders')return route.fulfill({json:{orders:[state.orders[0]],reviews:[],pagination:{page:1,size:10,hasMore:false}}});
  if(path==='/api/seller/categories')return route.fulfill({json:{category:[]}});
  if(path==='/api/seller/brands')return route.fulfill({json:{brands:[]}});
  if(path==='/api/seller/products')return route.fulfill({json:{products:[],pagination:{hasMore:false}}});
  if(path==='/api/seller/coupons')return route.fulfill({json:{coupons:[],pagination:{hasMore:false}}});
  return route.fulfill({status:404,json:{message:'Unmocked API'}});
 });return state;
}
test('Seller Center opens orders and requires confirmation for dispatch and delivery',async({page})=>{
 const state=await mockStatus(page);await page.goto('/seller');await page.getByRole('navigation',{name:'Seller sections'}).getByRole('link',{name:'Orders',exact:true}).click();await expect(page).toHaveURL(/\/seller\/orders$/);const card=page.getByRole('article',{name:'Order '+id,exact:true});await card.getByRole('button',{name:'Mark on the way',exact:true}).click();expect(state.writes).toHaveLength(0);await card.getByRole('button',{name:'Confirm status update',exact:true}).click();await expect(card.locator('.managed-status')).toHaveText('On the way');expect(state.writes[0].body).toEqual({status:'onTheWay'});await card.getByRole('button',{name:'Mark delivered',exact:true}).click();expect(state.writes).toHaveLength(1);await card.getByRole('button',{name:'Confirm status update',exact:true}).click();await expect(card.locator('.managed-status')).toHaveText('Delivered');expect(state.writes[1].body).toEqual({status:'delivered'});await expect(card.getByRole('button',{name:'Mark delivered',exact:true})).toHaveCount(0);
 state.role='User';await page.goto('/account');await page.getByRole('button',{name:'My orders',exact:true}).click();await expect(page.getByRole('button',{name:'Write a review',exact:true})).toBeVisible();
});
test('pending and cancelled orders have no delivery actions; filters send exact status',async({page})=>{
 const state=await mockStatus(page);await page.goto('/seller/orders');const pending=page.getByRole('article',{name:'Order '+pendingId,exact:true}),cancelled=page.getByRole('article',{name:'Order '+cancelId,exact:true});await expect(pending).toContainText('Checkout must be finalized');await expect(pending.getByRole('button')).toHaveCount(0);await expect(cancelled.getByRole('button')).toHaveCount(0);await page.getByLabel('Order status filter').selectOption('pendingPayment');await expect(page.getByRole('article')).toHaveCount(1);expect(state.queries.at(-1)).toContain('status=pendingPayment');
});
test('a concurrent status conflict refreshes the order and removes stale confirmation controls',async({page})=>{
 const state=await mockStatus(page);state.conflict=true;await page.goto('/seller/orders');const card=page.getByRole('article',{name:'Order '+id,exact:true});await card.getByRole('button',{name:'Mark delivered',exact:true}).click();await card.getByRole('button',{name:'Confirm status update',exact:true}).click();await expect(page.locator('.managed-orders').getByRole('alert')).toContainText('Order changed');await expect(card.locator('.managed-status')).toHaveText('Cancelled');await expect(card.getByRole('button')).toHaveCount(0);
});
test('admin can open the management screen; normal customers cannot load its orders',async({page})=>{
 await mockStatus(page,'Admin');await page.goto('/seller/orders');await expect(page.getByRole('article')).toHaveCount(3);await expect(page.getByText('Manage shipping and delivery across the store.',{exact:true})).toBeVisible();
});
test('normal customer and guest access is blocked',async({page})=>{
 const state=await mockStatus(page,'User');await page.goto('/seller/orders');await expect(page.getByRole('heading',{name:'A seller or admin account is required',exact:true})).toBeVisible();expect(state.queries).toEqual([]);state.role='Guest';await page.reload();await expect(page.getByRole('link',{name:'Log in as a seller or admin',exact:true})).toBeVisible();expect(state.queries).toEqual([]);
});
test('order management works on mobile',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await mockStatus(page);await page.goto('/seller/orders');const card=page.getByRole('article',{name:'Order '+id,exact:true});await card.getByRole('button',{name:'Mark delivered',exact:true}).click();await expect(card.getByRole('button',{name:'Confirm status update',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('order-status-mobile.png'),fullPage:true});
});
