import test from 'node:test';
import assert from 'node:assert/strict';
import {readAttempt,saveAttempt,clearAttempt,stripeCheckoutUrl,attemptStorageKey} from '../src/lib/checkout-attempt.ts';
import {checkoutRoute} from '../src/lib/checkout-routing.ts';
import {checkoutInput} from '../src/lib/checkout.ts';
const id='a'.repeat(24),body={addressId:id,phone:['01001234567'],paymentMethod:'Card',products:[{productId:id,variantId:id,quantity:1}]};
function memory(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
test('attempt persistence keeps the exact body and key across reloads and isolates customers',()=>{
 const storage=memory(),attempt={key:'creation-key-123',body};saveAttempt(storage,'one',attempt);assert.deepEqual(readAttempt(storage,'one'),attempt);assert.equal(readAttempt(storage,'two'),null);saveAttempt(storage,'one',{...attempt,orderId:id});assert.equal(readAttempt(storage,'one').orderId,id);clearAttempt(storage,'one');assert.equal(readAttempt(storage,'one'),null);
});
test('corrupted persisted attempts fail closed instead of generating a replacement key',()=>{
 const storage=memory();storage.setItem(attemptStorageKey('one'),'{bad');assert.throws(()=>readAttempt(storage,'one'));storage.setItem(attemptStorageKey('one'),JSON.stringify({key:'bad'}));assert.throws(()=>readAttempt(storage,'one'));
});
test('payment navigation accepts only secure Stripe Checkout URLs',()=>{
 assert.equal(stripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test'),'https://checkout.stripe.com/c/pay/cs_test');for(const url of ['javascript:alert(1)','http://checkout.stripe.com','https://checkout.stripe.com.evil.test','https://user:pass@checkout.stripe.com','https://evil.test',null])assert.equal(stripeCheckoutUrl(url),null);
});
test('frontend routing exposes only checkout2 creation, payment and reconciliation',()=>{
 assert.equal(checkoutRoute([]),'/order/checkout2');for(const action of ['payment','reconcile'])assert.equal(checkoutRoute([id,action]),'/order/checkout2/'+id+'/'+action);for(const path of [['webhook'],['checkout'],[id,'refund'],['invalid','payment'],[id,'payment','extra']])assert.equal(checkoutRoute(path),null);
});
test('frontend body validation rejects manipulated totals and invalid quantities',()=>{
 assert.equal(checkoutInput.safeParse(body).success,true);for(const input of [{...body,total:1},{...body,paymentMethod:'free'},{...body,products:[{productId:id,variantId:id,quantity:0}]}])assert.equal(checkoutInput.safeParse(input).success,false);
});
