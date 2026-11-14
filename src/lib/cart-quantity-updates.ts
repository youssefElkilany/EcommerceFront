export type CartItem = { productId: string; variantId: string; quantity: number; name: string; brandName?: string; options: Record<string, string>; image?: string; finalPrice: number; stock: number; lineTotal: number };
export type Cart = { items: CartItem[]; itemCount: number; subtotal: number };
export type QuantityStatus = { saving: boolean; error: string };
type PendingQuantity = { productId: string; variantId: string; quantity: number; revision: number; readyAt: number };
type QuantityRequest = Pick<PendingQuantity, "productId" | "variantId" | "quantity">;
const keyFor = (item: Pick<CartItem, "productId" | "variantId">) => `${item.productId}:${item.variantId}`;

/** Overlay unsaved quantities on the latest confirmed cart; totals always derive from items. */
export function createCartQuantityUpdater({ getCart, publish, save, debounceMs = 300 }: {
  getCart: () => Cart | undefined;
  publish: (cart: Cart) => void;
  save: (item: QuantityRequest) => Promise<Cart>;
  debounceMs?: number;
}) {
  const pending = new Map<string, PendingQuantity>();
  let confirmed: Cart | undefined;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let listener: ((status: QuantityStatus) => void) | undefined;
  let error = "";

  const emit = () => listener?.({ saving: pending.size > 0 || !!running, error });
  const render = () => {
    if (!confirmed || !getCart()) return;
    const items = confirmed.items.map(item => {
      const quantity = pending.get(keyFor(item))?.quantity ?? item.quantity;
      return { ...item, quantity, lineTotal: item.finalPrice * quantity };
    });
    publish({ ...confirmed, items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0) });
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = undefined;
    if (running || !pending.size) return;
    const nextTime = Math.min(...Array.from(pending.values(), item => item.readyAt));
    timer = setTimeout(() => { void drain(); }, Math.max(0, nextTime - Date.now()));
  };
  // Serialize writes because each response contains the whole cart, not just one item.
  async function drain(): Promise<void> {
    if (running) return running;
    running = (async () => {
      while (pending.size) {
        // A cleared account cache means these edits belong to an old session.
        if (!getCart()) { pending.clear(); break; }
        const entry = [...pending].find(([, item]) => item.readyAt <= Date.now());
        if (!entry) break;
        const [key, request] = entry;
        try {
          confirmed = await save({ productId: request.productId, variantId: request.variantId, quantity: request.quantity });
          if (pending.get(key)?.revision === request.revision) pending.delete(key);
        } catch (failure) {
          // Reject this item's unconfirmed edits only; preserve edits to other items.
          pending.delete(key);
          error = failure instanceof Error ? failure.message : "Unable to update quantity. Please try again.";
        }
        render();
        emit();
      }
    })().finally(() => { running = undefined; emit(); schedule(); });
    emit();
    return running;
  }

  return {
    getStatus(): QuantityStatus { return { saving: pending.size > 0 || !!running, error }; },
    setListener(next?: (status: QuantityStatus) => void) { listener = next; },
    change(item: Pick<CartItem, "productId" | "variantId">, delta: number) {
      const currentCart = getCart();
      const current = currentCart?.items.find(candidate => keyFor(candidate) === keyFor(item));
      if (!current || !currentCart) return;
      const quantity = current.quantity + delta;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(current.stock, 99)) return;
      if (!pending.size && !running) confirmed = currentCart;
      error = "";
      pending.set(keyFor(item), { productId: item.productId, variantId: item.variantId, quantity, revision: ++revision, readyAt: Date.now() + debounceMs });
      render();
      emit();
      schedule();
    },
    async flush() {
      clearTimeout(timer);
      timer = undefined;
      if (!pending.size && !running) return;
      for (const item of pending.values()) item.readyAt = 0;
      await drain();
    }
  };
}
