"use client";
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,Check,Package,Truck} from 'lucide-react';
import {accountRequest,type Account} from '@/lib/account';
import {sellerRequest} from '@/lib/seller';
import type {CustomerOrder} from '@/lib/customer-orders';
type Target='onTheWay'|'delivered';
type ManagedOrder=CustomerOrder&{checkoutReady:boolean;availableStatuses:Target[];phone?:string[];shippingAddress?:CustomerOrder['shippingAddress']&{phone?:string;buildingNumber?:string;floor?:string;apartment?:string;additionalInfo?:string}};
type Response={orders:ManagedOrder[];pagination:{page:number;size:number;hasMore:boolean}};
const labels:Record<string,string>={pendingPayment:'Awaiting payment',placed:'Order placed',onTheWay:'On the way',delivered:'Delivered',cancelled:'Cancelled'};
export function ManagedOrdersPage(){
  const account=useQuery({queryKey:['account'],queryFn:()=>accountRequest<{user:Account}>('/api/account'),retry:false});
  if(account.isPending)return <main className="seller-gate">Loading your account...</main>;
  if(account.isError)return <main className="seller-gate"><h1>Manage orders</h1><p>{account.error.message}</p>{(account.error as Error&{status?:number}).status===401?<Link href="/login?next=%2Fseller%2Forders">Log in as a seller or admin</Link>:<button onClick={()=>account.refetch()}>Try again</button>}</main>;
  if(!['Seller','Admin'].includes(account.data.user.role))return <main className="seller-gate"><h1>A seller or admin account is required</h1><Link href="/account">Back to my account</Link></main>;
  return <ManagedOrders user={account.data.user}/>;
}
function ManagedOrders({user}:{user:Account}){
  const client=useQueryClient(),[page,setPage]=useState(1),[filter,setFilter]=useState(''),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState<{orderId:string;status:Target}|null>(null);
  const orders=useQuery({queryKey:['seller','orders',page,filter],queryFn:()=>sellerRequest<Response>('orders?'+new URLSearchParams({page:String(page),size:'10',...(filter?{status:filter}:{})})),retry:false});
  const mutation=useMutation({mutationFn:(input:{orderId:string;status:Target})=>sellerRequest<{order:ManagedOrder}>('orders/'+input.orderId,'PATCH',{status:input.status}),onSuccess:async()=>{
    setConfirm(null);setNotice('Order status has been updated.');await client.invalidateQueries({queryKey:['seller','orders']});void client.invalidateQueries({queryKey:['customer-orders']});
  },onError:error=>{if((error as Error&{status?:number}).status===409){setConfirm(null);void client.invalidateQueries({queryKey:['seller','orders']});}}});
  const choose=(orderId:string,status:Target)=>{mutation.reset();setNotice('');setConfirm({orderId,status});};
  return <div className="seller-shell"><header className="seller-header"><Link href="/" className="seller-logo"><img src="/dorytos-logo.svg" alt="Dorytos"/></Link><span>Order management</span><nav><Link href="/seller"><ArrowLeft size={16}/>Seller center</Link><Link href="/account">My account</Link></nav></header><main className="managed-orders"><div className="managed-orders-title"><div><span>FULFILLMENT</span><h1>Orders</h1><p>{user.role==='Admin'?'Manage shipping and delivery across the store.':'Manage shipping and delivery for orders containing only your products.'}</p></div><Truck size={32}/></div>{user.role==='Seller'&&<p className="managed-orders-note">Orders containing products from multiple sellers are managed by an admin.</p>}
    <div className="managed-orders-toolbar"><label>Order status<select aria-label="Order status filter" value={filter} disabled={mutation.isPending} onChange={event=>{setFilter(event.target.value);setPage(1);setConfirm(null);setNotice('');mutation.reset();}}><option value="">All orders</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button disabled={orders.isFetching||mutation.isPending} onClick={()=>orders.refetch()}>Refresh</button></div>
    {notice&&<p role="status" className="seller-success"><Check size={16}/>{notice}</p>}
    {mutation.isError&&<p role="alert" className="managed-orders-error">{mutation.error.message}</p>}
    {orders.isPending?<p role="status">Loading orders...</p>:orders.isError?<div role="alert"><p>{orders.error.message}</p><button onClick={()=>orders.refetch()}>Try again</button></div>:!orders.data?.orders.length?<div className="seller-empty"><Package size={32}/><h2>No orders found</h2><p>{filter?'No eligible orders match this status.':'Eligible orders will appear here.'}</p></div>:<div className="managed-orders-list">{orders.data.orders.map(order=>{
      const choices=order.availableStatuses||[];
      return <article key={order._id} aria-label={'Order '+order._id}><header><div><h2>Order {order._id.slice(-8).toUpperCase()}</h2><small>{order._id}</small><p>{new Date(order.createdAt).toLocaleDateString()} · {order.paymentMethod==='Cash'?'Cash on delivery':'Card'}</p></div><span className={'managed-status managed-status-'+order.status}>{labels[order.status]}</span></header>
        <div className="managed-order-body"><section><h3>Items</h3>{order.products.map((item,index)=><p key={item.variantId+index}>{item.name}<strong>× {item.quantity}</strong></p>)}<p className="managed-order-total">Total<strong>{order.currency?new Intl.NumberFormat('en-EG',{style:'currency',currency:order.currency.toUpperCase()}).format(order.finalPrice):order.finalPrice.toFixed(2)+' (currency not recorded)'}</strong></p></section><section><h3>Delivery details</h3><p>{order.shippingAddress?.name||'Customer'}</p><p>{[order.shippingAddress?.buildingNumber,order.shippingAddress?.street,order.shippingAddress?.city].filter(Boolean).join(', ')||'No delivery address recorded'}</p>{order.shippingAddress?.phone&&<p>{order.shippingAddress.phone}</p>}{order.shippingAddress?.additionalInfo&&<p>{order.shippingAddress.additionalInfo}</p>}</section></div>
        <footer>{confirm?.orderId===order._id?<div className="managed-order-confirm"><p>Mark this order as <strong>{labels[confirm.status]}</strong>?{confirm.status==='delivered'?' Customers will be able to review the purchased products.':''}</p><button className="seller-primary" disabled={mutation.isPending} onClick={()=>mutation.mutate(confirm)}>{mutation.isPending?'Updating...':'Confirm status update'}</button><button disabled={mutation.isPending} onClick={()=>{setConfirm(null);mutation.reset();}}>Keep current status</button></div>:choices.length?<div className="managed-order-actions">{choices.map(status=><button key={status} disabled={mutation.isPending} className={status==='delivered'?'seller-primary':''} onClick={()=>choose(order._id,status)}>{status==='delivered'?'Mark delivered':'Mark on the way'}</button>)}</div>:<p>{['delivered','cancelled'].includes(order.status)?'This order has no further fulfillment updates.':!order.checkoutReady?'Checkout must be finalized before this order can be dispatched or delivered.':'This order is not ready for fulfillment updates.'}</p>}</footer>
      </article>;
    })}</div>}
    {(page>1||orders.data?.pagination.hasMore)&&<nav aria-label="Order pages" className="managed-orders-pagination"><button disabled={page===1||orders.isFetching||mutation.isPending} onClick={()=>{setPage(value=>value-1);setConfirm(null);}}>Previous</button><span>Page {page}</span><button disabled={!orders.data?.pagination.hasMore||orders.isFetching||mutation.isPending} onClick={()=>{setPage(value=>value+1);setConfirm(null);}}>Next</button></nav>}
  </main></div>;
}
