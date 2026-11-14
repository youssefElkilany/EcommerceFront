export type CheckoutBody={addressId:string;phone:string[];paymentMethod:'Cash'|'Card';code?:string;note?:string;products:{productId:string;variantId:string;quantity:number}[]};
export type CheckoutAttempt={key:string;body:CheckoutBody;orderId?:string};
export interface AttemptStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export const attemptStorageKey=(userId:string)=>'dorytos:checkout2:'+userId;
export function readAttempt(storage:AttemptStorage,userId:string):CheckoutAttempt|null{
  const raw=storage.getItem(attemptStorageKey(userId));if(!raw)return null;
  const data=JSON.parse(raw);
  if(!data||typeof data.key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(data.key)||!data.body||!Array.isArray(data.body.products)||!['Cash','Card'].includes(data.body.paymentMethod)||!data.body.addressId||!Array.isArray(data.body.phone)||(data.orderId&&!/^[a-f0-9]{24}$/i.test(data.orderId)))throw new Error('Your saved checkout could not be read. Do not create a replacement order until its status has been checked.');
  return data;
}
export function saveAttempt(storage:AttemptStorage,userId:string,attempt:CheckoutAttempt){storage.setItem(attemptStorageKey(userId),JSON.stringify(attempt));}
export function clearAttempt(storage:AttemptStorage,userId:string){storage.removeItem(attemptStorageKey(userId));}
export function stripeCheckoutUrl(value:unknown):string|null{
  if(typeof value!=='string')return null;
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='checkout.stripe.com'&&!url.port&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
