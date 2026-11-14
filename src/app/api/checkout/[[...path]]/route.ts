import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendAuthorization, backendAuthFailure } from '@/lib/backend-auth';
import { checkoutInput } from '@/lib/checkout';
import { checkoutRoute } from '@/lib/checkout-routing';
import { stripeCheckoutUrl } from '@/lib/checkout-attempt';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const parts = (await params).path || [], target = checkoutRoute(parts); if (!target) return json({ message: 'Checkout action not found.' }, 404);
  const token = request.cookies.get('dorytos_session')?.value; if (!token) return json({ message: 'Sign in with a customer account to checkout.' }, 401);
  const origin = request.headers.get('origin'); if (origin && origin !== request.nextUrl.origin) return json({ message: 'Request not allowed.' }, 403);
  const key = request.headers.get('Idempotency-Key'); if (!parts.length && (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key))) return json({ message: 'A valid Idempotency-Key is required.' }, 400);
  let input; try { input = await request.json(); } catch { return json({ message: 'Invalid checkout request.' }, 400); }
  const schema = !parts.length ? checkoutInput : parts[1] === 'payment' ? z.object({}).strict() : z.object({ cancel: z.boolean().optional() }).strict();
  const validated = schema.safeParse(input); if (!validated.success) return json({ message: 'Check your checkout details.', fields: validated.error.issues.map(issue => issue.path.join('.')) }, 400);
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')).replace(/\/+$/, ''); if (!base) return json({ message: 'Checkout services are unavailable.' }, 503);
  try {
    const response = await fetch(base + target, { method: 'POST', headers: { Authorization: backendAuthorization(token), 'Content-Type': 'application/json', ...(!parts.length ? { 'Idempotency-Key': key! } : {}) }, body: JSON.stringify(validated.data), cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]) });
    const data = await response.json(); const auth = backendAuthFailure(data?.msgError || data?.message); if (auth) return json({ message: auth.message }, auth.status);
    if (!response.ok || data.msgError) {
      if (data.validationErr) return json({ message: 'Check your checkout details.', fields: data.validationErr.map((entry: { path?: string[] }) => entry.path?.join('.') || 'checkout') }, 400);
      const error = typeof data.msgError === 'string' ? data.msgError : '';
      const known = /^(?:Cart is empty|Duplicate variants|Address not found|Coupon not found or expired|Coupon already used or reserved by this user|Coupon usage limit reached|Coupon is not applicable to every ordered product|Order is below the coupon minimum|Variant unavailable|Insufficient stock|Checkout not found|Order not found|Checkout is closed|Reservation expired;.*|Stripe outcome is uncertain\..*|Session outcome needs reconciliation.*)$/;
      return json({ message: known.test(error) ? error : 'Checkout could not be completed. Check this order before starting another purchase.' }, response.ok ? 502 : response.status);
    }
    if (!data.order) return json({ message: 'The order response was incomplete. Retry this same checkout.' }, 502);
    if (data.session?.url && !stripeCheckoutUrl(data.session.url)) return json({ message: 'The payment link could not be verified. Retry payment for this order.' }, 502);
    return json({ order: data.order, currency: data.currency || 'egp', ...(data.session ? { session: data.session } : {}) }, response.status);
  } catch { return json({ message: 'Checkout could not be reached. Retry with the same checkout; it may already have been created.' }, 503); }
}
