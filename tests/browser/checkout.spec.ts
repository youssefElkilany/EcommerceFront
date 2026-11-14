import {test,expect,type Page} from '@playwright/test';
const userId='a'.repeat(24),orderId='b'.repeat(24),productId='c'.repeat(24),variantId='d'.repeat(24),addressId='e'.repeat(24);
async function mockCheckout(page:Page,options:{role?:string;lostCreate?:boolean;paymentFailure?:boolean;addresses?:boolean}={}){
 const state={createCalls:[] as {key:string;body:Record<string,unknown>}[],payments:0,reconciles:[] as Record<string,unknown>[],status:'pendingPayment',method:'Card',logout:0};
 const order=()=>({_id:orderId,status:state.status,paymentMethod:state.method,subTotal:100,finalPrice:80,products:[{name:'Polo',quantity:1,paymentPrice:100}],shippingAddress:{name:'Customer',city:'Cairo',street:'Example street',phone:'01001234567'}});
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path==='/api/account')return route.fulfill(options.role==='Guest'?{status:401,json:{message:'Sign in to continue'}}:{json:{user:{id:userId,name:'Customer',email:'customer@example.com',phone:'01001234567',role:options.role||'User',emailVerified:true}}});
  if(path==='/api/cart')return route.fulfill({json:{cart:{items:[{productId,variantId,name:'Polo',quantity:1,stock:5,options:{color:'Black'},finalPrice:100,lineTotal:100}],subtotal:100,itemCount:1}}});
  if(path==='/api/account/addresses')return route.fulfill({json:{addresses:options.addresses===false?[]:[{_id:addressId,label:'home',name:'Customer',phone:'01001234567',country:'Egypt',city:'Cairo',street:'Example street',governorate:'Cairo',isDefault:true}]}});
  if(path==='/api/checkout'){
   const body=request.postDataJSON();state.createCalls.push({key:request.headers()['idempotency-key'],body});state.method=body.paymentMethod;state.status=state.method==='Cash'?'placed':'pendingPayment';
   if(options.lostCreate&&state.createCalls.length===1)return route.fulfill({status:503,json:{message:'Response lost. Retry this same checkout.'}});
   return route.fulfill({json:{order:order(),currency:'egp'}});
  }
  if(path==='/api/checkout/'+orderId+'/payment'){
   state.payments++;expect(request.postDataJSON()).toEqual({});if(options.paymentFailure&&state.payments===1)return route.fulfill({status:503,json:{message:'Stripe outcome is uncertain. Retry the same order.'}});
   return route.fulfill({json:{order:order(),currency:'egp',session:{id:'cs_test',url:'https://checkout.stripe.com/c/pay/cs_test',status:'open'}}});
  }
  if(path==='/api/checkout/'+orderId+'/reconcile'){const body=request.postDataJSON();state.reconciles.push(body);if(body.cancel===true)state.status='cancelled';return route.fulfill({json:{order:order(),currency:'egp'}});}
  return route.fulfill({status:404,json:{message:'Unmocked endpoint '+path}});
 });
 await page.route('https://checkout.stripe.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Stripe test checkout</h1>'}));
 return state;
}
test('cash checkout creates once with an idempotency key and never requests card payment',async({page})=>{
 const state=await mockCheckout(page);await page.goto('/checkout');await page.getByRole('radio',{name:'Cash on delivery',exact:false}).check();await page.getByLabel('Coupon code',{exact:true}).fill('SAVE');await page.getByLabel('Order note',{exact:true}).fill('Ring the bell');await page.getByRole('button',{name:'Place cash order'}).click();await expect(page.getByRole('heading',{name:'Order placed — pay on delivery'})).toBeVisible();expect(state.createCalls).toHaveLength(1);expect(state.createCalls[0].key).toMatch(/^[a-zA-Z0-9_-]{8,128}$/);expect(state.createCalls[0].body).toEqual({addressId,phone:['01001234567'],paymentMethod:'Cash',code:'SAVE',note:'Ring the bell',products:[{productId,variantId,quantity:1}]});expect(state.payments).toBe(0);await expect(page.locator('.checkout-total')).toContainText('80.00');
});
test('lost creation response survives reload and retry reuses the exact key and body',async({page})=>{
 const state=await mockCheckout(page,{lostCreate:true});await page.goto('/checkout');await page.getByRole('button',{name:'Create order and review payment'}).click();await expect(page.locator('.checkout-main').getByRole('alert')).toContainText('Response lost');await page.reload();await page.getByRole('button',{name:'Retry order request'}).click();await expect(page.getByRole('heading',{name:'Awaiting payment'})).toBeVisible();expect(state.createCalls).toHaveLength(2);expect(state.createCalls[0]).toEqual(state.createCalls[1]);await page.reload();await expect(page.getByRole('heading',{name:'Awaiting payment'})).toBeVisible();expect(state.createCalls).toHaveLength(2);
});
test('payment retry uses the same order, redirects to Stripe and return waits for backend confirmation',async({page})=>{
 const state=await mockCheckout(page,{paymentFailure:true});await page.goto('/checkout');await page.getByRole('button',{name:'Create order and review payment'}).click();await page.getByRole('button',{name:'Continue to card payment'}).click();await expect(page.locator('.checkout-main').getByRole('alert')).toContainText('uncertain');await page.getByRole('button',{name:'Continue to card payment'}).click();await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/cs_test');expect(state.createCalls).toHaveLength(1);expect(state.payments).toBe(2);
 await page.goto('/checkout/return?result=success&orderId='+orderId);await expect(page.getByRole('heading',{name:'Awaiting payment'})).toBeVisible();await expect(page.getByRole('heading',{name:'Payment confirmed',exact:true})).toHaveCount(0);state.status='placed';await page.getByRole('button',{name:'Check payment status'}).click();await expect(page.getByRole('heading',{name:'Payment confirmed',exact:true})).toBeVisible();expect(state.reconciles.every(body=>!body.cancel)).toBe(true);
});
test('cancel URL alone does not cancel; explicit confirmation reconciles the pending order',async({page})=>{
 const state=await mockCheckout(page);await page.goto('/checkout/return?result=cancel&orderId='+orderId);await expect(page.getByRole('heading',{name:'Awaiting payment'})).toBeVisible();expect(state.reconciles).toEqual([{}]);await page.getByRole('button',{name:'Cancel unpaid order'}).click();expect(state.reconciles).toEqual([{}]);await page.getByRole('button',{name:'Confirm cancellation'}).click();await expect(page.getByRole('heading',{name:'Order cancelled',exact:true})).toBeVisible();expect(state.reconciles.at(-1)).toEqual({cancel:true});expect(state.createCalls).toHaveLength(0);
});
test('double clicks do not create duplicate orders',async({page})=>{
 const state=await mockCheckout(page);await page.goto('/checkout');const button=page.getByRole('button',{name:'Create order and review payment'});await button.waitFor();await button.evaluate((element:HTMLButtonElement)=>{element.click();element.click();});await expect(page.getByRole('heading',{name:'Awaiting payment'})).toBeVisible();expect(state.createCalls).toHaveLength(1);
});
test('checkout requires a saved address and a customer account',async({page})=>{
 const state=await mockCheckout(page,{addresses:false});await page.goto('/checkout');await expect(page.getByRole('heading',{name:'Add your delivery address'})).toBeVisible();await expect(page.getByRole('button',{name:'Create order and review payment'})).toHaveCount(0);expect(state.createCalls).toHaveLength(0);
});
test('seller checkout is blocked and signed-out customers are sent to login',async({page})=>{
 await mockCheckout(page,{role:'Seller'});await page.goto('/checkout');await expect(page.getByRole('heading',{name:'Switch to a customer account'})).toBeVisible();
});
test('mobile checkout fits the viewport and keeps payment choices accessible',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await mockCheckout(page);await page.goto('/checkout');await expect(page.getByRole('button',{name:'Create order and review payment'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('checkout-mobile.png'),fullPage:true});
});
test('signed-out checkout shows a login link without creating an order',async({page})=>{
 const state=await mockCheckout(page,{role:'Guest'});await page.goto('/checkout');await expect(page.getByRole('heading',{name:'Sign in to checkout'})).toBeVisible();await expect(page.getByRole('link',{name:'Log in to continue'})).toHaveAttribute('href','/login?next=%2Fcheckout');expect(state.createCalls).toHaveLength(0);
});
test('checkout proxy rejects unauthenticated, forged, and unsupported requests before forwarding',async({request})=>{
 expect((await request.post('/api/checkout',{data:{}})).status()).toBe(401);
 const headers={Cookie:'dorytos_session=not-a-real-token','Idempotency-Key':'safe-test-key-123'};
 expect((await request.post('/api/checkout',{headers:{...headers,'Idempotency-Key':'bad'},data:{}})).status()).toBe(400);
 expect((await request.post('/api/checkout',{headers,data:{addressId,phone:['01001234567'],paymentMethod:'Card',finalPrice:1,products:[{productId,variantId,quantity:1}]}})).status()).toBe(400);
 expect((await request.post('/api/checkout/'+orderId+'/payment',{headers,data:{price:1}})).status()).toBe(400);
 expect((await request.post('/api/checkout/'+orderId+'/reconcile',{headers,data:{cancel:'false'}})).status()).toBe(400);
 expect((await request.post('/api/checkout/webhook',{headers,data:{}})).status()).toBe(404);
 expect((await request.post('/api/checkout',{headers:{...headers,Origin:'https://unrelated.example'},data:{}})).status()).toBe(403);
});
test('corrupted saved checkout blocks a replacement purchase',async({page})=>{
 const state=await mockCheckout(page);await page.addInitScript(({userId})=>sessionStorage.setItem('dorytos:checkout2:'+userId,JSON.stringify({key:'broken'})),{userId});await page.goto('/checkout');await expect(page.locator('.checkout-main').getByRole('alert')).toContainText('saved checkout could not be read');await expect(page.getByRole('button',{name:'Create order and review payment'})).toHaveCount(0);expect(state.createCalls).toHaveLength(0);
});
test('cart checkout button is usable again after returning with browser Back',async({page})=>{
 const state=await mockCheckout(page);await page.goto('/cart');await page.getByRole('button',{name:'Proceed to checkout',exact:true}).click();await expect(page).toHaveURL(/\/checkout$/);await expect(page.getByRole('heading',{name:'Checkout',exact:true})).toBeVisible();await page.goBack();await expect(page).toHaveURL(/\/cart$/);await expect(page.getByRole('button',{name:'Proceed to checkout',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Opening checkout...',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Proceed to checkout',exact:true}).click();await expect(page.getByRole('heading',{name:'Checkout',exact:true})).toBeVisible();expect(state.createCalls).toHaveLength(0);
});
test('failed quantity save leaves checkout usable and shows an error instead of stuck navigation',async({page})=>{
 const state=await mockCheckout(page);await page.route('**/api/cart',route=>route.request().method()==='PATCH'?route.fulfill({status:409,json:{message:'Quantity could not be saved'}}):route.fallback());await page.goto('/cart');await page.getByRole('button',{name:'Increase quantity for Polo',exact:true}).click();await expect(page.locator('.cart-summary').getByRole('alert')).toContainText('Quantity could not be saved');await page.getByRole('button',{name:'Proceed to checkout',exact:true}).click();await expect(page.locator('.cart-summary')).toContainText('Your cart changes could not be saved');await expect(page.getByRole('button',{name:'Proceed to checkout',exact:true})).toBeEnabled();expect(state.createCalls).toHaveLength(0);await expect(page).toHaveURL(/\/cart$/);
});
