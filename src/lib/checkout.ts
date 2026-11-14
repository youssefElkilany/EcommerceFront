import {z} from 'zod';
import type {CheckoutBody} from './checkout-attempt';
const id=z.string().regex(/^[a-f0-9]{24}$/i);
export const checkoutInput=z.object({
  addressId:id,phone:z.array(z.string().trim().regex(/^\+?[0-9][0-9 ()-]{5,18}[0-9]$/)).min(1).max(3),paymentMethod:z.enum(['Cash','Card']),code:z.string().trim().min(1).max(100).optional(),note:z.string().trim().max(1000).optional(),
  products:z.array(z.object({productId:id,variantId:id,quantity:z.number().int().min(1).max(99)}).strict()).min(1).max(100)
}).strict();
export type CheckoutOrder={_id:string;status:'pendingPayment'|'placed'|'cancelled'|'onTheWay'|'delivered';paymentMethod:'Cash'|'Card';subTotal:number;finalPrice:number;products:{name:string;quantity:number;paymentPrice:number}[];shippingAddress?:{name:string;city:string;street:string;phone:string};createdAt?:string};
export type CheckoutResponse={order:CheckoutOrder;currency:string;session?:{id:string;url:string|null;status:string}};
export async function checkoutRequest(path:string,body:CheckoutBody|{cancel?:boolean},key?:string):Promise<CheckoutResponse>{
  const response=await fetch('/api/checkout'+path,{method:'POST',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body),cache:'no-store'});
  let data;try{data=await response.json();}catch{throw new Error('The checkout response was interrupted. Retry this same checkout to check its status.');}
  if(!response.ok)throw Object.assign(new Error(data.message||'Checkout could not be completed. Retry this same checkout.'),{status:response.status});
  if(!data.order||!/^[a-f0-9]{24}$/i.test(data.order._id)||!['pendingPayment','placed','cancelled','onTheWay','delivered'].includes(data.order.status))throw new Error('The order response was incomplete. Retry this same checkout.');
  return data;
}
