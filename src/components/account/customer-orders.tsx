"use client";
import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Check,Package,Star,X} from 'lucide-react';
import {ordersRequest,type OrdersResponse,type CustomerReview,type CustomerOrder} from '@/lib/customer-orders';
const statusLabels:Record<string,string>={pendingPayment:'Awaiting payment',placed:'Order placed',onTheWay:'On the way',delivered:'Delivered',cancelled:'Cancelled'};
function ReviewForm({orderId,productId,name,onClose,onSaved}:{orderId:string;productId:string;name:string;onClose:()=>void;onSaved:()=>void}){
  const client=useQueryClient(),[rating,setRating]=useState(0),[comment,setComment]=useState(''),[error,setError]=useState('');
  const mutation=useMutation({mutationFn:()=>ordersRequest('reviews/'+productId,'POST',{orderId,rating,comment:comment.trim()}),onSuccess:async()=>{
    await client.invalidateQueries({queryKey:['customer-orders']});
    for(const key of ['product-detail','home-products','search-products','brand-products'])void client.invalidateQueries({queryKey:[key]});
    onSaved();
  },onError:failure=>{if((failure as Error&{status?:number}).status===409)void client.invalidateQueries({queryKey:['customer-orders']});}});
  const submit=(event:FormEvent)=>{event.preventDefault();setError('');if(!rating){setError('Choose a star rating before submitting.');return;}if(!comment.trim()){setError('Write a comment about the product.');return;}mutation.mutate();};
  return <form className="order-review-form" aria-label={'Review '+name} onSubmit={submit}><div className="order-review-title"><h4>How was {name}?</h4><button type="button" aria-label="Close review form" disabled={mutation.isPending} onClick={onClose}><X size={17}/></button></div><fieldset disabled={mutation.isPending}><legend>Your rating</legend><div className="order-rating-choices" role="radiogroup" aria-label="Your rating">{[1,2,3,4,5].map(value=><label key={value} title={value+' out of 5'}><input type="radio" name="rating" value={value} checked={rating===value} onChange={()=>{setRating(value);setError('');}} aria-label={value+(value===1?' star':' stars')}/><Star size={26} fill={rating>=value?'currentColor':'none'}/></label>)}</div><label className="order-review-comment">Your review<textarea aria-label="Your review" value={comment} onChange={event=>setComment(event.target.value)} maxLength={2000} rows={4} placeholder="Tell other shoppers about the product" required/></label><small>{comment.length}/2,000 characters</small><button className="account-primary" type="submit">{mutation.isPending?'Submitting...':'Submit review'}</button></fieldset>{(error||mutation.isError)&&<p className="account-error" role="alert">{error||mutation.error?.message}</p>}</form>;
}
function OrderCard({order,reviews}:{order:CustomerOrder;reviews:CustomerReview[]}){
  const [editing,setEditing]=useState(''),[notice,setNotice]=useState('');
  const reviewByProduct=new Map(reviews.map(review=>[review.productId,review]));
  // A review belongs to a product, so two variants in one order share one review action.
  const firstLines=new Map<string,number>();order.products.forEach((item,index)=>{if(!firstLines.has(item.productId))firstLines.set(item.productId,index);});
  const total=order.currency?new Intl.NumberFormat('en-EG',{style:'currency',currency:order.currency.toUpperCase()}).format(order.finalPrice):order.finalPrice.toFixed(2)+' (currency not recorded)';
  return <article className="customer-order" aria-label={'Order '+order._id}><header><div><span>ORDER {order._id.slice(-8).toUpperCase()}</span><h3>{new Date(order.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</h3><small className="customer-order-id">{order._id}</small></div><span className={'order-status order-status-'+order.status}>{statusLabels[order.status]||order.status}</span></header><div className="order-meta"><span>{order.paymentMethod==='Cash'?'Cash on delivery':'Card payment'}</span><strong>{total}</strong></div>{notice&&<p className="account-success" role="status"><Check size={15}/>{notice}</p>}<div className="customer-order-items">{order.products.map((item,index)=>{
    const existing=reviewByProduct.get(item.productId),first=firstLines.get(item.productId)===index;
    return <section className="customer-order-item" key={item._id||item.variantId+index}><div className="order-product-heading"><Package size={25}/><div><Link href={'/products/'+item.productId+'/'+item.variantId}>{item.name}</Link><small>Quantity: {item.quantity}</small></div></div>
      {first?existing?<div className="order-existing-review"><span className="order-review-stars" aria-label={'Your rating: '+existing.rating+' out of 5'}>{[1,2,3,4,5].map(value=><Star key={value} size={16} fill={existing.rating>=value?'currentColor':'none'}/>)}</span><strong>Your review</strong><p>{existing.comment}</p>{existing.orderId!==order._id&&<small>You already reviewed this product from another order.</small>}</div>:order.status==='delivered'?editing===item.productId?<ReviewForm key={item.productId} orderId={order._id} productId={item.productId} name={item.name} onClose={()=>setEditing('')} onSaved={()=>{setEditing('');setNotice('Thank you! Your review has been submitted.');}}/>:<button className="order-write-review" onClick={()=>{setEditing(item.productId);setNotice('');}}><Star size={16}/>Write a review</button>:<p className="order-review-unavailable">{order.status==='cancelled'?'Cancelled items cannot be reviewed.':'You can review this product after delivery.'}</p>:<p className="order-review-unavailable">Your review applies to all variants of this product.</p>}
    </section>;
  })}</div>{order.status==='pendingPayment'&&<Link className="order-check-payment" href={'/checkout/return?orderId='+order._id}>Check payment or continue checkout</Link>}</article>;
}
export function CustomerOrders(){
  const [page,setPage]=useState(1);const query=useQuery({queryKey:['customer-orders',page],queryFn:()=>ordersRequest<OrdersResponse>('orders?page='+page+'&size=10'),retry:false});
  return <section className="account-panel customer-orders-panel"><div className="account-panel-heading"><div><h2>My orders</h2><p>Track your purchases and review products after delivery.</p></div><button onClick={()=>query.refetch()} disabled={query.isFetching}>Refresh</button></div>
    {query.isPending?<p role="status">Loading your orders...</p>:query.isError?<div role="alert"><p>{query.error.message}</p><button onClick={()=>query.refetch()}>Try again</button></div>:!query.data?.orders.length?<div className="account-empty"><Package size={34}/><h3>No orders yet</h3><p>Your purchases will appear here.</p><Link href="/">Explore products</Link></div>:<div className="customer-orders-list">{query.data.orders.map(order=><OrderCard key={order._id} order={order} reviews={query.data.reviews}/>)}</div>}
    {(page>1||query.data?.pagination.hasMore)&&<nav className="customer-orders-pagination" aria-label="Order pages"><button disabled={page===1||query.isFetching} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page}</span><button disabled={!query.data?.pagination.hasMore||query.isFetching} onClick={()=>setPage(value=>value+1)}>Next</button></nav>}
  </section>;
}
