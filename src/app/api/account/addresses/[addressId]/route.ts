import { NextRequest, NextResponse } from 'next/server';
import { accountProxy } from '@/lib/account-proxy';
type Context = { params: Promise<{ addressId: string }> };
async function proxy(request: NextRequest, context: Context) {
  const { addressId } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(addressId)) return NextResponse.json({ message: 'Invalid address.' }, { status: 400 });
  return accountProxy(request, '/address/' + addressId);
}
export async function GET(request: NextRequest, context: Context) { return proxy(request, context); }
export async function PATCH(request: NextRequest, context: Context) { return proxy(request, context); }
export async function DELETE(request: NextRequest, context: Context) { return proxy(request, context); }
