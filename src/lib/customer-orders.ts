export type CustomerReview={_id:string;productId:string;orderId:string;rating:number;comment:string;createdAt?:string};
export type CustomerOrder={_id:string;status:'pendingPayment'|'placed'|'onTheWay'|'cancelled'|'delivered';createdAt:string;paymentMethod:'Cash'|'Card';subTotal:number;finalPrice:number;currency?:string|null;products:{_id?:string;productId:string;variantId:string;name:string;quantity:number;paymentPrice:number}[];shippingAddress?:{name:string;city:string;street:string}};
export type OrdersResponse={orders:CustomerOrder[];reviews:CustomerReview[];pagination:{page:number;size:number;hasMore:boolean}};
export async function ordersRequest<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch('/api/account/'+path,{method,cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message||'Your order request could not be completed.'),{status:response.status});return data as T;
}
