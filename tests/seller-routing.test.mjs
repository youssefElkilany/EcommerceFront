import test from 'node:test';
import assert from 'node:assert/strict';
import {sellerRoute} from '../src/lib/seller-routing.ts';
const id='a'.repeat(24), variant='b'.repeat(24);
test('seller proxy maps supported resources to existing backend routes',()=>{
 const routes=[['categories','POST','/category'],['categories/'+id,'PATCH','/category/'+id],['categories/'+id+'/subcategories','POST','/category/'+id+'/subcategory'],['categories/'+id+'/subcategories/'+variant,'PATCH','/category/'+id+'/subcategory/'+variant],['products','GET','/product/mine'],['products','POST','/product'],['products/'+id,'PUT','/product/'+id],['products/'+id+'/variants','POST','/product/'+id+'/variant'],['products/'+id+'/variants/'+variant,'PATCH','/product/'+id+'/variant/'+variant],['products/'+id+'/variants/'+variant,'DELETE','/product/'+id+'/variant/'+variant],['coupons','GET','/coupon'],['coupons/'+id,'PUT','/coupon/'+id],['coupons/'+id,'DELETE','/coupon/'+id]];
 for(const [path,method,target]of routes)assert.equal(sellerRoute(path.split('/'),method),target);
});
test('seller proxy rejects unsupported deletes, malformed IDs and path traversal',()=>{
 for(const [path,method]of [['categories/'+id,'DELETE'],['products/'+id,'DELETE'],['products/nope','PUT'],['../user','GET'],['brands','POST'],['coupons/'+id+'/extra','PUT']])assert.equal(sellerRoute(path.split('/'),method),null);
});
test('order management routes map only to the dedicated list and status endpoints',()=>{
 assert.equal(sellerRoute(['orders'],'GET'),'/order/manage');assert.equal(sellerRoute(['orders',id],'PATCH'),'/order/'+id);assert.equal(sellerRoute(['orders'],'POST'),null);assert.equal(sellerRoute(['orders',id],'DELETE'),null);assert.equal(sellerRoute(['orders','bad'],'PATCH'),null);
});
