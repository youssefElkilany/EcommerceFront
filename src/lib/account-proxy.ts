import { NextRequest, NextResponse } from 'next/server';
import { backendAuthorization, backendAuthFailure } from '@/lib/backend-auth';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function accountProxy(request: NextRequest, path: string) {
  const token = request.cookies.get('dorytos_session')?.value;
  if (!token) return json({ message: 'Log in to manage your account.' }, 401);
  const origin = request.headers.get('origin');
  if (request.method !== 'GET' && origin && origin !== request.nextUrl.origin) return json({ message: 'Request not allowed.' }, 403);
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')).replace(/\/+$/, '');
  if (!base) return json({ message: 'Account services are temporarily unavailable.' }, 503);
  let body;
  if (['POST', 'PATCH'].includes(request.method)) {
    try { body = await request.json(); } catch { return json({ message: 'Invalid request.' }, 400); }
  }
  try {
    const response = await fetch(base + path, { method: request.method, headers: { Authorization: backendAuthorization(token), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]) });
    const data = await response.json();
    const failure = backendAuthFailure(data?.msgError || data?.message);
    if (failure) return json({ message: failure.message }, failure.status);
    if (!response.ok || data?.msgError) {
      if (Array.isArray(data.validationErr)) {
        const labels: Record<string, string> = { name: 'Enter a name of at least 2 characters.', phone: 'Enter a valid Egyptian mobile number.', country: 'Addresses must be in Egypt.', governorate: 'Select an Egyptian governorate.', city: 'Enter the city or area.', street: 'Enter the street address.', deliveryInstructions: 'Delivery instructions must be 300 characters or fewer.' };
        const messages: string[] = data.validationErr.map((entry: { path?: string[] }) => labels[entry.path?.[0] || ''] || 'Check your details.');
        return json({ message: [...new Set(messages)].join(' ') }, 400);
      }
      const message = data.msgError === 'address not found' ? 'Address not found.' : data.msgError === 'the only address must remain the default' ? 'Your only address must remain the default.' : 'Unable to save your changes. Please try again.';
      return json({ message }, response.status >= 500 ? 503 : response.ok ? 502 : response.status);
    }
    return json(data, response.status);
  } catch { return json({ message: 'We could not reach the store. Please try again.' }, 503); }
}
