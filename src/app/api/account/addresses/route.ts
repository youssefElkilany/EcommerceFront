import { NextRequest } from 'next/server';
import { accountProxy } from '@/lib/account-proxy';
export async function GET(request: NextRequest) { return accountProxy(request, '/address'); }
export async function POST(request: NextRequest) { return accountProxy(request, '/address'); }
