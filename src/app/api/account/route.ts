import { NextRequest } from 'next/server';
import { accountProxy } from '@/lib/account-proxy';
export async function GET(request: NextRequest) { return accountProxy(request, '/user/me'); }
export async function PATCH(request: NextRequest) { return accountProxy(request, '/user/me'); }
