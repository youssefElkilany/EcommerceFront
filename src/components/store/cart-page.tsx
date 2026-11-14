"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {useRouter} from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { money } from "@/lib/catalog";
import { requestCart, updaterFor } from "@/lib/cart-client";
import { cartQuantityLimit } from "@/lib/cart-limits";
import { type CartItem, type QuantityStatus } from "@/lib/cart-quantity-updates";

import {useCustomerAccess} from '@/lib/customer-access';
import {CustomerAccountNotice} from '@/components/store/customer-access';
export function CartPage(){
  const access=useCustomerAccess();
  if(access.restricted)return <main className="cart-page"><CustomerAccountNotice feature="Cart"/></main>;
  if(!access.ready)return <main className="cart-page">Loading your account...</main>;
  if(!access.canShop)return <main className="cart-page"><p role="alert">{access.account.error?.message||'Could not verify your customer account.'}</p><button onClick={()=>access.account.refetch()}>Try again</button></main>;
  return <CustomerCartPage/>;
}
function CustomerCartPage() {
  const client = useQueryClient();
  const router = useRouter();
  const [checkingOut,startCheckout]=useTransition();
  const [checkoutError,setCheckoutError]=useState("");
  useEffect(()=>{router.prefetch('/checkout');},[router]);
  const query = useQuery({ queryKey: ["cart"], queryFn: ({ signal }) => requestCart("GET", undefined, "/api/cart", signal), retry: false });
  const [quantityUpdater] = useState(() => updaterFor(client));
  const [quantityStatus, setQuantityStatus] = useState<QuantityStatus>(() => quantityUpdater.getStatus());
  useEffect(() => {
    quantityUpdater.setListener(setQuantityStatus);
    return () => {
      quantityUpdater.setListener(undefined);
      // Finish pending edits when navigating away instead of dropping a debounced save.
      void quantityUpdater.flush();
    };
  }, [quantityUpdater]);
  const changeQuantity = (item: CartItem, delta: number) => {
    void client.cancelQueries({ queryKey: ["cart"] }, { revert: false });
    quantityUpdater.change(item, delta);
  };
  const removal = useMutation({
    mutationFn: (item: CartItem) => requestCart("DELETE", undefined, `/api/cart/${item.productId}/${item.variantId}`),
    onSuccess: cart => client.setQueryData(["cart"], cart),
  });
  const cart = query.data;
  if (query.isPending) return <main className="cart-page"><p>Loading your cart...</p></main>;
  if (query.isError && (query.error as Error & {status?:number}).status === 401) return <main className="cart-page"><div className="cart-empty"><ShoppingBag size={36}/><h1>Sign in to see your cart</h1><p>Your cart is saved to your customer account.</p><Link className="auth-submit" href="/login?next=%2Fcart">Log in to continue<ArrowRight size={17}/></Link></div></main>;
  if (query.isError) return <main className="cart-page"><p role="alert">{query.error.message}</p><button onClick={() => query.refetch()}>Try again</button></main>;
  if (!cart?.items.length) return <main className="cart-page"><div className="cart-empty"><ShoppingBag size={36}/><h1>Your cart is empty</h1><p>Find something you love and add it here.</p><Link className="auth-submit" href="/">Continue shopping<ArrowRight size={17}/></Link></div></main>;
  return <main className="cart-page">
    <div className="cart-heading"><div><span className="section-kicker">READY WHEN YOU ARE</span><h1>Your cart</h1><p>{cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}</p></div><Link href="/">Continue shopping</Link></div>
    <div className="cart-layout">
      <section className="cart-items" aria-label="Cart items">{cart.items.map(item => <article className="cart-line" key={item.productId + item.variantId}>
        <Link href={`/products/${item.productId}/${item.variantId}`} className="cart-line-image">{item.image ? <img src={item.image} alt=""/> : <ShoppingBag/>}</Link>
        <div className="cart-line-info"><span>{item.brandName || "Dorytos"}</span><Link href={`/products/${item.productId}/${item.variantId}`}>{item.name}</Link><small>{Object.entries(item.options).map(([key,value])=>`${key}: ${value}`).join(" / ")}</small><strong>EGP {money(item.finalPrice)}</strong>
          <div className="cart-quantity">
            <button aria-label={`Decrease quantity for ${item.name}`} disabled={item.quantity <= 1 || removal.isPending} onClick={() => changeQuantity(item, -1)}><Minus size={15}/></button>
            <span aria-live="polite">{item.quantity}</span>
            <button aria-label={`Increase quantity for ${item.name}`} disabled={item.quantity >= cartQuantityLimit(item.stock) || removal.isPending} onClick={() => changeQuantity(item, 1)}><Plus size={15}/></button>
            <button className="cart-remove" aria-label={`Remove ${item.name}`} disabled={removal.isPending || quantityStatus.saving} onClick={() => removal.mutate(item)}><Trash2 size={15}/> Remove</button>
          </div>
          {item.quantity >= item.stock && <small>Maximum available quantity</small>}
        </div><b>EGP {money(item.lineTotal)}</b>
      </article>)}</section>
      <aside className="cart-summary"><h2>Order summary</h2><div><span>Subtotal</span><strong>EGP {money(cart.subtotal)}</strong></div><p>Delivery and payment are arranged at checkout.</p>
        <p role="status" aria-live="polite">{quantityStatus.saving ? "Saving quantities..." : ""}</p>
        {quantityStatus.error && <p role="alert">{quantityStatus.error}</p>}
        {removal.isError && <p role="alert">{removal.error.message}</p>}
        {checkoutError&&<p role="alert">{checkoutError}</p>}<button type="button" disabled={checkingOut||quantityStatus.saving||removal.isPending} onClick={()=>{setCheckoutError('');startCheckout(async()=>{try{await quantityUpdater.flush();if(quantityUpdater.getStatus().error){setCheckoutError('Your cart changes could not be saved. Please retry before checking out.');return;}startCheckout(()=>router.push('/checkout'));}catch{setCheckoutError('Checkout could not be opened. Please try again.');}});}}>{checkingOut?'Opening checkout...':'Proceed to checkout'}</button>
      </aside>
    </div>
  </main>;
}
