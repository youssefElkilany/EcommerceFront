import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {backendAuthorization,backendAuthFailure} from '@/lib/backend-auth';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function orderReviewProxy(request:NextRequest,productId?:string){
  const token=request.cookies.get('dorytos_session')?.value;if(!token)return json({message:'Sign in with a customer account to see orders and write reviews.'},401);
  const origin=request.headers.get('origin');if(request.method!=='GET'&&origin&&origin!==request.nextUrl.origin)return json({message:'Request not allowed.'},403);
  let body;let path='/order/mine';
  if(productId!==undefined){
    if(!/^[a-f0-9]{24}$/i.test(productId))return json({message:'Invalid product.'},400);
    try{body=await request.json();}catch{return json({message:'Invalid review request.'},400);}
    const validated=z.object({orderId:z.string().regex(/^[a-f0-9]{24}$/i),rating:z.number().int().min(1).max(5),comment:z.string().trim().min(1).max(2000)}).strict().safeParse(body);
    if(!validated.success)return json({message:'Choose a rating from 1 to 5 and enter a comment of up to 2,000 characters.'},400);
    body=validated.data;path='/product/'+productId+'/review';
  }else{
    for(const key of request.nextUrl.searchParams.keys())if(!['page','size'].includes(key))return json({message:'Invalid order filter.'},400);
    const page=request.nextUrl.searchParams.get('page')||'1',size=request.nextUrl.searchParams.get('size')||'10';
    if(!/^\d+$/.test(page)||!/^\d+$/.test(size)||Number(page)<1||Number(page)>1000000||Number(size)<1||Number(size)>50)return json({message:'Invalid order page.'},400);
    path+='?'+new URLSearchParams({page,size});
  }
  const base=(process.env.API_BASE_URL||process.env.NEXT_PUBLIC_API_BASE_URL||(process.env.NODE_ENV==='development'?'http://localhost:3000':'')).replace(/\/+$/,'');if(!base)return json({message:'Order services are unavailable.'},503);
  try{
    const response=await fetch(base+path,{method:request.method,headers:{Authorization:backendAuthorization(token),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)])});
    const data=await response.json(),auth=backendAuthFailure(data.msgError||data.message);if(auth)return json({message:auth.message},auth.status);
    if(!response.ok||data.msgError){
      if(data.validationErr)return json({message:'Check your review rating and comment.'},400);
      const messages:Record<string,string>={'product not found':'This product is no longer available for review.','Reviews require your own delivered order containing this product':'You can review products only from your own delivered orders.','you already reviewed before':'You have already reviewed this product.'};
      return json({message:messages[data.msgError]||'The request could not be completed. Refresh your orders before trying again.'},response.ok?502:response.status);
    }
    if(productId)return json({review:data.review},response.status);
    if(!Array.isArray(data.orders)||!Array.isArray(data.reviews))return json({message:'The store returned an incomplete order list.'},502);
    return json({orders:data.orders,reviews:data.reviews,pagination:data.pagination},response.status);
  }catch{return json({message:'The store could not be reached. Refresh your orders before trying again.'},503);}
}
