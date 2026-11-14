"use client";
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {useSearchParams,useRouter} from 'next/navigation';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,CheckCircle2,CreditCard,MapPin,Package,ShieldCheck,ShoppingBag} from 'lucide-react';
import {accountRequest,type Account,type Address} from '@/lib/account';
import {useCustomerAccess} from '@/lib/customer-access';
import {CustomerAccountNotice} from '@/components/store/customer-access';
import {requestCart,updaterFor} from '@/lib/cart-client';
import {checkoutRequest,type CheckoutResponse} from '@/lib/checkout';
import {readAttempt,saveAttempt,clearAttempt,stripeCheckoutUrl,type CheckoutAttempt} from '@/lib/checkout-attempt';
const price=(value:number,currency='egp')=>new Intl.NumberFormat('en-EG',{style:'currency',currency:currency.toUpperCase()}).format(value);
const terminal=(value:string)=>['placed','onTheWay','delivered','cancelled'].includes(value);
export function CheckoutPage({returning=false}:{returning?:boolean}){
  const access=useCustomerAccess();
  if(!access.ready)return <main className="checkout-gate">Loading your account...</main>;
  if(access.restricted)return <main className="checkout-gate"><CustomerAccountNotice feature="Checkout"/></main>;
  if(!access.account.data)return <main className="checkout-gate"><h1>Sign in to checkout</h1><p>{access.account.error?.message}</p><Link href={'/login?next='+encodeURIComponent(typeof window==='undefined'?'/checkout':window.location.pathname+window.location.search)}>Log in to continue</Link></main>;
  return <CustomerCheckout key={access.account.data.user.id} user={access.account.data.user} returning={returning}/>;
}
function CustomerCheckout({user,returning}:{user:Account;returning:boolean}){
  const client=useQueryClient(),params=useSearchParams(),router=useRouter();const urlOrder=params.get('orderId')||'';
  const [localAttempt,setAttempt]=useState<CheckoutAttempt|null>(null),[result,setResult]=useState<CheckoutResponse|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[safeToEdit,setSafeToEdit]=useState(false),[cancelConfirm,setCancelConfirm]=useState(false);
  const [addressId,setAddressId]=useState(''),[phone,setPhone]=useState(user.phone||''),[method,setMethod]=useState<'Cash'|'Card'>('Card'),[code,setCode]=useState(''),[note,setNote]=useState('');
  const lock=useRef(false),active=useRef<CheckoutAttempt|null>(null),initialCheck=useRef('');
  const cart=useQuery({queryKey:['cart'],queryFn:({signal})=>requestCart('GET',undefined,'/api/cart',signal),retry:false});
  const addresses=useQuery({queryKey:['addresses'],queryFn:()=>accountRequest<{addresses:Address[]}>('/api/account/addresses'),retry:false});
  const savedAttempt=useQuery({queryKey:['checkout-attempt',user.id],queryFn:async()=>readAttempt(window.sessionStorage,user.id),staleTime:Infinity,retry:false});
  const initialized=!savedAttempt.isPending,storageError=savedAttempt.error?.message||'';
  const attempt=localAttempt||savedAttempt.data||null;
  const ownedOrder=urlOrder||attempt?.orderId||'';
  const invalidOrder=!!ownedOrder&&!/^[a-f0-9]{24}$/i.test(ownedOrder);
  const persist=(next:CheckoutAttempt)=>{saveAttempt(window.sessionStorage,user.id,next);active.current=next;setAttempt(next);};
  const accept=(data:CheckoutResponse)=>{
    setResult(data);
    if(terminal(data.order.status)){void client.invalidateQueries({queryKey:['cart']});void client.invalidateQueries({queryKey:['wishlist']});}
  };
  const execute=async(label:string,task:()=>Promise<void>)=>{
    if(lock.current)return;lock.current=true;setBusy(label);setError('');setSafeToEdit(false);
    try{await task();}catch(failure){setError(failure instanceof Error?failure.message:'Checkout could not be completed. Retry this same checkout.');}finally{lock.current=false;setBusy('');}
  };
  const refresh=(cancel=false)=>execute(cancel?'Cancelling order...':'Checking payment...',async()=>{
    if(!/^[a-f0-9]{24}$/i.test(ownedOrder))throw new Error('A valid order ID is required.');
    const data=await checkoutRequest('/'+ownedOrder+'/reconcile',cancel?{cancel:true}:{});accept(data);setCancelConfirm(false);
  });
  useEffect(()=>{
    if(!initialized||storageError||!ownedOrder||initialCheck.current===ownedOrder)return;
    initialCheck.current=ownedOrder;
    if(!/^[a-f0-9]{24}$/i.test(ownedOrder))return;
    // A return URL never proves payment. Only backend reconciliation sets status.
    let ignore=false;
    void checkoutRequest('/'+ownedOrder+'/reconcile',{}).then(data=>{if(!ignore){setResult(data);if(terminal(data.order.status))void client.invalidateQueries({queryKey:['cart']});}}).catch(failure=>{if(!ignore)setError(failure.message);});
    return()=>{ignore=true;if(initialCheck.current===ownedOrder)initialCheck.current='';};
  },[initialized,storageError,ownedOrder,client]);
  const start=async(event?:FormEvent)=>{
    event?.preventDefault();
    await execute('Saving your order...',async()=>{
      if(storageError)throw new Error(storageError);
      let saved=active.current||attempt;
      if(!saved){
        await updaterFor(client).flush();
        if(updaterFor(client).getStatus().error)throw new Error('Your cart quantities could not be saved. Return to your cart before checking out.');
        const confirmed=await client.fetchQuery({queryKey:['cart'],queryFn:()=>requestCart(),staleTime:0});
        if(!confirmed.items.length)throw new Error('Your cart is empty.');
        const selectedAddress=addresses.data?.addresses.find(item=>item._id===(addressId||addresses.data.addresses.find(item=>item.isDefault)?._id||addresses.data.addresses[0]?._id));
        if(!selectedAddress)throw new Error('Select a delivery address.');
        const body={addressId:selectedAddress._id,phone:[phone.trim()||selectedAddress.phone],paymentMethod:method,...(code.trim()?{code:code.trim().toUpperCase()}:{}),...(note.trim()?{note:note.trim()}:{}),products:confirmed.items.map(item=>({productId:item.productId,variantId:item.variantId,quantity:item.quantity}))};
        saved={key:crypto.randomUUID(),body};
        // Persist BEFORE sending: a lost response must not cause a second purchase.
        persist(saved);
      }
      if(saved.orderId){accept(await checkoutRequest('/'+saved.orderId+'/reconcile',{}));return;}
      let data:CheckoutResponse;
      try{data=await checkoutRequest('',saved.body,saved.key);}catch(failure){const status=(failure as Error&{status?:number}).status;if(status&&[400,404,409].includes(status))setSafeToEdit(true);throw failure;}
      persist({...saved,orderId:data.order._id});accept(data);
      router.replace('/checkout?orderId='+data.order._id);
    });
  };
  const pay=()=>execute('Opening secure payment...',async()=>{
    const data=await checkoutRequest('/'+ownedOrder+'/payment',{});accept(data);
    if(data.order.status!=='pendingPayment')return;
    if(data.session?.status==='open'){
      const url=stripeCheckoutUrl(data.session.url);if(!url)throw new Error('No valid payment link was returned. Retry payment for this order.');
      window.location.assign(url);
    }else throw new Error('Payment is still being confirmed. Check payment status again shortly.');
  });
  const reset=()=>{
    if((active.current||attempt)&&urlOrder&&(active.current||attempt)?.orderId!==urlOrder){router.replace('/checkout');return;}
    try{clearAttempt(window.sessionStorage,user.id);active.current=null;setAttempt(null);client.setQueryData(['checkout-attempt',user.id],null);setResult(null);setError('');setSafeToEdit(false);initialCheck.current='';router.replace('/checkout');}catch{setError('Could not clear this checkout. Please try again.');}
  };
  const selectedAddress=addressId||addresses.data?.addresses.find(item=>item.isDefault)?._id||addresses.data?.addresses[0]?._id||'';
  const frozen=!!attempt||!!urlOrder;
  const order=result?.order;
  return <div className="checkout-shell"><header className="checkout-header"><Link href="/" aria-label="Dorytos home"><img src="/dorytos-logo.svg" alt="Dorytos"/></Link><span><ShieldCheck size={18}/>Secure checkout</span><Link href="/cart"><ArrowLeft size={16}/>Back to cart</Link></header><main className="checkout-layout">
    <section className="checkout-main"><span className="checkout-eyebrow">ONE MORE STEP TO YOUR NEXT FIND</span><h1>{order&&terminal(order.status)?order.status==='cancelled'?'Order cancelled':'Order confirmed':ownedOrder?'Your order':'Checkout'}</h1>
    {(error||invalidOrder)&&<div className="checkout-error" role="alert">{error||'The order link is invalid.'}</div>}{storageError&&<div className="checkout-error" role="alert">{storageError}</div>}
    {!initialized?<p>Loading saved checkout...</p>:ownedOrder?<section className="checkout-panel checkout-status" aria-label="Order status">
      {!order?<><Package size={32}/><h2>Checking your order</h2><p>We are checking the saved order with the store.</p><button disabled={!!busy} onClick={()=>void refresh()}>Check order status</button></>:<>
        {order.status==='pendingPayment'?<CreditCard size={36}/>:<CheckCircle2 size={36}/>}<h2>{order.status==='pendingPayment'?'Awaiting payment':order.status==='cancelled'?'Your reservation has been released':order.paymentMethod==='Cash'?'Order placed — pay on delivery':'Payment confirmed'}</h2>
        <p className="checkout-order-id">Order {order._id}</p>
        {order.status==='pendingPayment'&&<><p>{returning?'Returning from the payment page does not confirm payment. Your latest status is shown here.':'Your order is saved. Continue to Stripe to pay securely.'}</p><p>Your address, items, coupon and payment method are fixed for this order.</p><div className="checkout-action-row"><button className="checkout-primary" disabled={!!busy} onClick={()=>void pay()}>Continue to card payment</button><button disabled={!!busy} onClick={()=>void refresh()}>Check payment status</button></div>{cancelConfirm?<div className="checkout-cancel"><p>Cancel this unpaid order and release its reservation? A completed payment cannot be cancelled here.</p><button disabled={!!busy} onClick={()=>void refresh(true)}>Confirm cancellation</button><button disabled={!!busy} onClick={()=>setCancelConfirm(false)}>Keep order</button></div>:<button disabled={!!busy} onClick={()=>setCancelConfirm(true)}>Cancel unpaid order</button>}</>}
        {terminal(order.status)&&<><p>{order.status==='cancelled'?'You can return to your cart and start a new checkout.':order.paymentMethod==='Cash'?'Please have the order total ready when your delivery arrives.':'Thank you. Your order has been placed.'}</p><div className="checkout-action-row"><Link href="/">Continue shopping</Link><button disabled={!!busy} onClick={reset}>{order.status==='cancelled'?'Start a new checkout':'Start another checkout'}</button></div></>}
      </>}
    </section>:attempt?<section className="checkout-panel"><h2>Recover your checkout</h2><p>The order request may already have reached the store. Retry it with its saved key to recover the same order.</p><button className="checkout-primary" disabled={!!busy||!!storageError} onClick={()=>void start()}>Retry order request</button>{safeToEdit&&<button disabled={!!busy} onClick={reset}>Edit checkout details</button>}</section>:!storageError?<>
      {addresses.isError?<div className="checkout-panel"><p role="alert">{addresses.error.message}</p><button onClick={()=>addresses.refetch()}>Retry addresses</button></div>:addresses.isPending?<p>Loading addresses...</p>:!addresses.data?.addresses.length?<div className="checkout-panel"><MapPin size={30}/><h2>Add your delivery address</h2><p>Add an Egyptian delivery address to your account, then return to checkout.</p><Link href="/account">Manage addresses</Link><button onClick={()=>addresses.refetch()}>Refresh addresses</button></div>:cart.isError?<div className="checkout-panel"><p role="alert">{cart.error.message}</p><button onClick={()=>cart.refetch()}>Retry cart</button></div>:cart.isPending?<p>Loading cart...</p>:!cart.data?.items.length?<div className="checkout-panel"><ShoppingBag size={30}/><h2>Your cart is empty</h2><Link href="/">Explore products</Link></div>:<form onSubmit={event=>void start(event)} className="checkout-form"><fieldset disabled={!!busy||frozen}>
        <section className="checkout-panel"><h2><MapPin size={20}/>Delivery address</h2><div className="checkout-addresses">{addresses.data.addresses.map(address=><label key={address._id}><input type="radio" name="addressId" value={address._id} checked={selectedAddress===address._id} onChange={()=>setAddressId(address._id)} required/><span><strong>{address.name} <small>{address.label}{address.isDefault?' · Default':''}</small></strong><span>{[address.buildingNumber,address.street,address.city,address.governorate].filter(Boolean).join(', ')}</span><span>{address.phone}</span></span></label>)}</div><Link href="/account">Manage addresses</Link><label className="checkout-field">Contact phone<input aria-label="Contact phone" type="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="Use the address phone" pattern="\+?[0-9][0-9 ()-]{5,18}[0-9]"/></label></section>
        <section className="checkout-panel"><h2><CreditCard size={20}/>Payment method</h2><label className="checkout-method"><input type="radio" name="paymentMethod" value="Card" checked={method==='Card'} onChange={()=>setMethod('Card')}/><span><strong>Pay by card</strong><small>Enter your card details securely on Stripe.</small></span></label><label className="checkout-method"><input type="radio" name="paymentMethod" value="Cash" checked={method==='Cash'} onChange={()=>setMethod('Cash')}/><span><strong>Cash on delivery</strong><small>Pay when your order arrives.</small></span></label></section>
        <section className="checkout-panel"><h2>Have a coupon?</h2><label className="checkout-field">Coupon code<input aria-label="Coupon code" value={code} onChange={event=>setCode(event.target.value)} maxLength={100} placeholder="Optional"/></label><small>The store validates your coupon and calculates the final total when you create the order.</small><label className="checkout-field">Order note<textarea aria-label="Order note" value={note} onChange={event=>setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Optional"/></label></section>
        <button className="checkout-primary" type="submit">{method==='Card'?'Create order and review payment':'Place cash order'}</button>
      </fieldset></form>}
    </>:null}{busy&&<p className="checkout-saving" role="status">{busy}</p>}
    </section><aside className="checkout-summary checkout-panel"><h2>Order summary</h2>{order?<><div className="checkout-summary-items">{order.products.map((item,index)=><div key={index}><span>{item.name} × {item.quantity}</span><strong>{price(item.paymentPrice*item.quantity,result.currency)}</strong></div>)}</div><div><span>Subtotal</span><strong>{price(order.subTotal,result.currency)}</strong></div>{order.subTotal>order.finalPrice&&<div><span>Coupon savings</span><strong>−{price(order.subTotal-order.finalPrice,result.currency)}</strong></div>}<div className="checkout-total"><span>Total</span><strong>{price(order.finalPrice,result.currency)}</strong></div>{order.shippingAddress&&<p>Deliver to {order.shippingAddress.name}, {order.shippingAddress.street}, {order.shippingAddress.city}</p>}</>:<>{cart.data?.items.map(item=><div key={item.variantId}><span>{item.name} × {item.quantity}</span><strong>{price(item.lineTotal)}</strong></div>)}<div className="checkout-total"><span>Subtotal</span><strong>{price(cart.data?.subtotal||0)}</strong></div><p>Your final coupon-adjusted total will be shown after the store creates your order.</p></>}<p className="checkout-secure"><ShieldCheck size={15}/>Prices and availability are verified by the store.</p></aside>
  </main></div>;
}
