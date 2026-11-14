import { NextRequest, NextResponse } from "next/server";
import { backendAuthorization, backendAuthFailure } from "@/lib/backend-auth";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const baseUrl = () => (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")).replace(/\/+$/, "");
async function proxy(request: NextRequest, method: string, path: string, body?: unknown) {
  const token = request.cookies.get("dorytos_session")?.value;
  if (!token) return json({ message: "Sign in with a customer account to use your cart." }, 401);
  const base = baseUrl();
  if (!base) return json({ message: "The store is temporarily unavailable." }, 503);
  try {
    const response = await fetch(base + path, { method, headers: { Authorization: backendAuthorization(token), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    const data = await response.json();
    const authFailure = backendAuthFailure(data?.msgError || data?.message);
    if (authFailure) return json({ message: authFailure.message }, authFailure.status);
    if (data?.msgError) {
      const message = data.msgError === "u are not authorized" ? "Customer accounts only can use the cart." : /invalid token|invalid bearer key|expired token/i.test(data.msgError) ? "Your session expired. Log in to continue." : /^only \d+ available in stock$/i.test(data.msgError) ? data.msgError : "We could not update your cart.";
      return json({ message }, response.status);
    }
    return json(data, response.status);
  } catch { return json({ message: "We couldn't reach the store. Try again in a moment." }, 503); }
}
export async function GET(request: NextRequest) { return proxy(request, "GET", "/cart"); }
export async function POST(request: NextRequest) {
  let body: unknown; try { body = await request.json(); } catch { return json({ message: "Invalid request." }, 400); }
  return proxy(request, "POST", "/cart", body);
}
export async function PATCH(request: NextRequest) {
  let body: unknown; try { body = await request.json(); } catch { return json({ message: "Invalid request." }, 400); }
  return proxy(request, "PATCH", "/cart", body);
}



