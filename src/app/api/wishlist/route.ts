import { NextRequest, NextResponse } from "next/server";
import { backendAuthorization, backendAuthFailure } from "@/lib/backend-auth";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function proxy(request: NextRequest, method: "GET" | "POST" | "DELETE") {
  const token = request.cookies.get("dorytos_session")?.value;
  if (!token) return json({ message: "Sign in with a customer account to use your wishlist." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return json({ message: "Request not allowed." }, 403);
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")).replace(/\/+$/, "");
  if (!base) return json({ message: "The store is temporarily unavailable." }, 503);
  let body;
  if (method !== "GET") {
    try {
      const input = await request.json();
      if (![input?.productId, input?.variantId].every(value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value))) return json({ message: "Invalid product." }, 400);
      body = { productId: input.productId, variantId: input.variantId };
    } catch { return json({ message: "Invalid request." }, 400); }
  }
  try {
    const response = await fetch(base + "/user/wishlist", { method, headers: { Authorization: backendAuthorization(token), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    const data = await response.json();
    const authFailure = backendAuthFailure(data?.msgError || data?.message);
    if (authFailure) return json({ message: authFailure.message }, authFailure.status);
    if (!response.ok || data?.msgError) return json({ message: "We could not update your wishlist." }, response.ok ? 502 : response.status);
    if (!Array.isArray(data.products)) return json({ message: "We could not load your wishlist." }, 502);
    return json({ products: data.products });
  } catch { return json({ message: "We couldn't reach the store. Try again in a moment." }, 503); }
}
export async function GET(request: NextRequest) { return proxy(request, "GET"); }
export async function POST(request: NextRequest) { return proxy(request, "POST"); }
export async function DELETE(request: NextRequest) { return proxy(request, "DELETE"); }
