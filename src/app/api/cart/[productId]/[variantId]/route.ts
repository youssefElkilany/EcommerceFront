import { NextRequest, NextResponse } from "next/server";
import { backendAuthorization, backendAuthFailure } from "@/lib/backend-auth";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string; variantId: string }> }) {
  const token = request.cookies.get("dorytos_session")?.value;
  if (!token) return json({ message: "Sign in with a customer account to use your cart." }, 401);
  const { productId, variantId } = await params;
  if (![productId, variantId].every(id => /^[a-f0-9]{24}$/i.test(id))) return json({ message: "Invalid cart item." }, 400);
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")).replace(/\/+$/, "");
  if (!base) return json({ message: "The store is temporarily unavailable." }, 503);
  try {
    const response = await fetch(`${base}/cart/${productId}/${variantId}`, { method: "DELETE", headers: { Authorization: backendAuthorization(token) }, cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    const data = await response.json();
    const authFailure = backendAuthFailure(data?.msgError || data?.message);
    if (authFailure) return json({ message: authFailure.message }, authFailure.status);
    if (data?.msgError) {
      const message = data.msgError === "u are not authorized" ? "Customer accounts only can use the cart." : /invalid token|invalid bearer key|expired token/i.test(data.msgError) ? "Your session expired. Log in to continue." : "We could not update your cart.";
      return json({ message }, response.status);
    }
    return json(data, response.status);
  } catch { return json({ message: "We couldn't reach the store. Try again in a moment." }, 503); }
}



