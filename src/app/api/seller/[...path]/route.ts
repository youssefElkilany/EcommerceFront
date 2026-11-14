import { NextRequest, NextResponse } from 'next/server';
import { backendAuthorization, backendAuthFailure } from '@/lib/backend-auth';
import { sellerRoute } from '@/lib/seller-routing';
const json = (body: unknown, status = 200) => NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: NextRequest, context: Context) {
  const {path} = await context.params;
  const target = sellerRoute(path,request.method);
  if (!target) return json({message:'This seller action is unavailable.'},404);
  const token = request.cookies.get('dorytos_session')?.value;
  if (!token) return json({message:'Log in with your seller account.'},401);
  const origin = request.headers.get('origin');
  if (request.method !== 'GET' && origin && origin !== request.nextUrl.origin) return json({message:'Request not allowed.'},403);
  const base=(process.env.API_BASE_URL||process.env.NEXT_PUBLIC_API_BASE_URL||(process.env.NODE_ENV==='development'?'http://localhost:3000':'')).replace(/\/+$/,'');
  if (!base) return json({message:'Seller services are unavailable.'},503);
  try {
    const authorization=backendAuthorization(token);
    const fetchApi=(url:string,options:RequestInit={})=>fetch(base+url,{...options,cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});
    const profile=await fetchApi('/user/me',{headers:{Authorization:authorization}});
    const account=await profile.json();
    const authFailure=backendAuthFailure(account?.msgError||account?.message);
    if(authFailure) return json({message:authFailure.message},authFailure.status);
    if(!profile.ok) return json({message:'Could not verify your seller account.'},profile.status);
    if(!['Seller','Admin'].includes(account.user?.role)) return json({message:'A seller account is required.'},403);
    const query=new URLSearchParams();
    for(const[key,value]of request.nextUrl.searchParams){if(!(path[0]==='orders'?['page','size','status']:['page','size','sort']).includes(key))return json({message:'Unsupported list filter.'},400);query.append(key,value);}
    let body:FormData|string|undefined;
    const headers:Record<string,string>={Authorization:authorization};
    if(['POST','PATCH','PUT'].includes(request.method)) {
      if(path[0]==='orders') {
        let input;try{input=await request.json();}catch{return json({message:'Invalid order update.'},400);}
        if(!input||typeof input!=='object'||Object.keys(input).length!==1||!['onTheWay','delivered'].includes(input.status))return json({message:'Choose On the way or Delivered.'},400);
        body=JSON.stringify({status:input.status});headers['Content-Type']='application/json';
      }
      else if(path[0]==='coupons') {body=JSON.stringify(await request.json());headers['Content-Type']='application/json';}
      else {
        body=await request.formData();
        for(const value of body.values())if(value instanceof File && (value.size>10*1024*1024 || !value.type.startsWith('image/')))return json({message:'Choose image files smaller than 10 MB each.'},400);
      }
    }
    const response=await fetchApi(target+(query.size?'?'+query:''),{method:request.method,headers,body});
    const data=await response.json();
    const failure=backendAuthFailure(data?.msgError||data?.message);
    if(failure) return json({message:failure.message},failure.status);
    if(!response.ok||data?.msgError){
      if(Array.isArray(data.validationErr))return json({message:'Check these fields: '+[...new Set(data.validationErr.map((entry:{path?:string[]})=>entry.path?.join(' ')||'form details'))].join(', ')+'.'},400);
      const message=typeof data.msgError==='string'?data.msgError:'';
      return json({message:response.status>=500?'The store could not save this change. Please try again.':message||'Could not complete this seller action.'},response.ok?400:response.status);
    }
    return json(data,response.status);
  } catch {return json({message:'Could not reach seller services. Please try again.'},503);}
}
export async function GET(request:NextRequest,context:Context){return proxy(request,context);}
export async function POST(request:NextRequest,context:Context){return proxy(request,context);}
export async function PATCH(request:NextRequest,context:Context){return proxy(request,context);}
export async function PUT(request:NextRequest,context:Context){return proxy(request,context);}
export async function DELETE(request:NextRequest,context:Context){return proxy(request,context);}
