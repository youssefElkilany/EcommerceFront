import { NextResponse } from "next/server";
export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; variantId: string }> }) {
  const { productId, variantId } = await params;
  if (![productId, variantId].every(id => /^[a-f0-9]{24}$/i.test(id))) return NextResponse.json({ message: "Invalid product." }, { status: 400 });
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")).replace(/\/+$/, "");
  if (!base) return NextResponse.json({ message: "The store is temporarily unavailable." }, { status: 503 });
  try {
    const response = await fetch(base + "/product/" + productId + "/variant/" + variantId, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "We couldn't load this product." }, { status: 503 }); }
}
