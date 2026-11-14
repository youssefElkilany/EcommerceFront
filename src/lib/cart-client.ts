import type { QueryClient } from "@tanstack/react-query";
import { createCartQuantityUpdater, type Cart } from "@/lib/cart-quantity-updates";

type CartResponse = { cart: Cart; message?: string };
export async function requestCart(method = "GET", body?: unknown, path = "/api/cart", signal?: AbortSignal): Promise<Cart> {
  const response = await fetch(path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || "Unable to update cart."), { status: response.status });
  return (data as CartResponse).cart;
}
// Keep in-flight saves attached to the account cache when this page remounts.
const quantityUpdaters = new WeakMap<object, ReturnType<typeof createCartQuantityUpdater>>();
export function updaterFor(client: QueryClient) {
  const owner = client.getQueryCache().find({ queryKey: ["cart"], exact: true });
  if (!owner) throw new Error("The cart cache is not initialized.");
  const ownsCache = () => client.getQueryCache().find({ queryKey: ["cart"], exact: true }) === owner;
  let updater = quantityUpdaters.get(owner);
  if (!updater) {
    updater = createCartQuantityUpdater({
      getCart: () => ownsCache() ? client.getQueryData<Cart>(["cart"]) : undefined,
      publish: cart => { if (ownsCache()) client.setQueryData(["cart"], cart); },
      save: item => requestCart("PATCH", item),
    });
    quantityUpdaters.set(owner, updater);
  }
  return updater;
}
