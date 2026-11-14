export const cartQuantityLimit = (stock: number) => Math.min(99, Math.max(0, Math.floor(stock)));
export const remainingToAdd = (stock: number, inCart: number) => Math.max(0, cartQuantityLimit(stock) - inCart);
export function validateAddition(raw: string, stock: number, inCart: number): string {
  const amount = Number(raw);
  if (!raw.trim() || !Number.isSafeInteger(amount) || amount < 1) return "Enter a whole quantity of at least 1.";
  if (inCart + amount > stock) return `Stock limit: only ${Math.max(0, stock - inCart)} more available (${inCart} already in your cart).`;
  if (inCart + amount > 99) return "Maximum cart quantity is 99 for this item.";
  return "";
}
