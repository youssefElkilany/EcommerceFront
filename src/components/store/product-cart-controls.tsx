"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { requestCart, updaterFor } from "@/lib/cart-client";
import { cartQuantityLimit, remainingToAdd, validateAddition } from "@/lib/cart-limits";
import type { CartItem, QuantityStatus } from "@/lib/cart-quantity-updates";

import {useCustomerAccess} from '@/lib/customer-access';
import {CustomerAccountNotice} from '@/components/store/customer-access';
type CartWrite = { productId: string; variantId: string; quantity?: number; remove?: boolean };
function useCartState() {
  const access = useCustomerAccess();
  const client = useQueryClient();
  const router = useRouter();
  const query = useQuery({ queryKey: ["cart"], queryFn: ({ signal }) => requestCart("GET", undefined, "/api/cart", signal), retry: false, enabled:access.canShop });
  const [updater] = useState(() => updaterFor(client));
  const [status, setStatus] = useState<QuantityStatus>(() => updater.getStatus());
  const writeLock = useRef(false);
  useEffect(() => {
    updater.setListener(setStatus);
    return () => { updater.setListener(undefined); void updater.flush(); };
  }, [updater]);
  const mutation = useMutation({
    mutationFn: async (input: CartWrite) => {
      const owner = client.getQueryCache().find({ queryKey: ["cart"], exact: true });
      const cart = input.remove
        ? await requestCart("DELETE", undefined, `/api/cart/${input.productId}/${input.variantId}`)
        : await requestCart("POST", { productId: input.productId, variantId: input.variantId, quantity: input.quantity ?? 1 });
      return { cart, owner };
    },
    onSuccess: ({ cart, owner }) => { if (client.getQueryCache().find({ queryKey: ["cart"], exact: true }) === owner) client.setQueryData(["cart"], cart); },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 401) router.push("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search));
    },
  });
  const write = async (input: CartWrite) => {
    if(!access.canShop) throw new Error("Switch to a customer account to use the cart.");
    if (writeLock.current || updater.getStatus().saving) throw new Error("Please wait for your cart to finish saving.");
    writeLock.current = true;
    try { await client.cancelQueries({ queryKey: ["cart"] }, { revert: false }); await mutation.mutateAsync(input); }
    finally { writeLock.current = false; }
  };
  const change = (item: CartItem, delta: number) => {
    if (!access.canShop || writeLock.current) return;
    void client.cancelQueries({ queryKey: ["cart"] }, { revert: false });
    updater.change(item, delta);
  };
  return { query, status, write, change, access, writing: mutation.isPending };
}
const CartContext = createContext<ReturnType<typeof useCartState> | null>(null);
export function CartControlsProvider({ children }: { children: ReactNode }) {
  const state = useCartState();
  return <CartContext.Provider value={state}>{children}</CartContext.Provider>;
}
export function useCartControls() {
  const context = useContext(CartContext);
  if (!context) throw new Error("Cart controls require CartControlsProvider.");
  return context;
}
export function CartFeedback() {
  const { status } = useCartControls();
  return status.error ? <p role="alert" className="catalog-message">{status.error}</p> : null;
}
export function ProductCardCartControl({ productId, variantId, name, stock }: { productId: string; variantId: string; name: string; stock: number }) {
  const { query, status, write, change, writing, access } = useCartControls();
  const [error, setError] = useState("");
  const item = query.data?.items.find(entry => entry.productId === productId && entry.variantId === variantId);
  const quantity = item?.quantity || 0;
  const limit = cartQuantityLimit(Math.min(stock, item?.stock ?? stock));
  const limitReached = quantity >= limit;
  const save = async (remove = false) => {
    setError("");
    try { await write({ productId, variantId, quantity: 1, remove }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update your cart."); }
  };
  if(!access.canShop)return null;
  return <div className="product-card-cart">
    {quantity && item ? <div className="product-card-quantity" role="group" aria-label={`Cart quantity for ${name}`}>
      <button type="button" aria-label={`Decrease quantity for ${name}`} disabled={writing || (quantity === 1 && status.saving)} onClick={() => { setError(""); if (quantity === 1) void save(true); else change(item, -1); }}><Minus size={16}/></button>
      <span aria-live="polite">{quantity}</span>
      <button type="button" aria-label={`Increase quantity for ${name}`} disabled={writing || limitReached} onClick={() => { setError(""); change(item, 1); }}><Plus size={16}/></button>
    </div> : <button type="button" className="product-card-add" aria-label={`Add ${name} to cart`} disabled={!limit || writing || status.saving || query.isPending} onClick={() => void save()}><Plus size={18}/><span>Add</span></button>}
    {quantity > 0 && limitReached && <small role="status">{stock <= 99 ? "Stock limit reached" : "Maximum quantity reached"}</small>}
    {!stock && <small>Out of stock</small>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
export function ProductPageCartControl({ productId, variantId, stock }: { productId: string; variantId: string; stock: number }) {
  const { query, status, write, writing, access } = useCartControls();
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const item = query.data?.items.find(entry => entry.productId === productId && entry.variantId === variantId);
  const inCart = item?.quantity || 0;
  const currentStock = Math.min(stock, item?.stock ?? stock);
  const available = remainingToAdd(currentStock, inCart);
  const submit = async () => {
    setMessage("");
    const validation = validateAddition(quantity, currentStock, inCart);
    setError(validation);
    if (validation) return;
    const amount = Number(quantity);
    try { await write({ productId, variantId, quantity: amount }); setQuantity("1"); setMessage(`Added ${amount} to your cart.`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not add this product."); }
  };
  if(access.restricted)return <CustomerAccountNotice feature="Shopping"/>;
  if(!access.canShop)return <p>Checking customer access...</p>;
  return <form className="product-add-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <label htmlFor={`quantity-${variantId}`}>Quantity to add</label>
    <input id={`quantity-${variantId}`} type="text" inputMode="numeric" pattern="[0-9]*" value={quantity} onChange={event => { setQuantity(event.target.value); setError(""); setMessage(""); }} disabled={!available || writing || status.saving} aria-describedby={`quantity-help-${variantId}`} aria-invalid={!!error}/>
    <p id={`quantity-help-${variantId}`}>{inCart} already in your cart. {available > 0 ? `You can add up to ${available} more.` : currentStock > 0 ? "Stock limit reached." : "Out of stock."}</p>
    <button type="submit" disabled={!available || writing || status.saving || query.isPending}><ShoppingBag size={17}/>{writing ? "Adding..." : !available ? (currentStock ? "Stock limit reached" : "Out of stock") : "Add to cart"}</button>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </form>;
}
