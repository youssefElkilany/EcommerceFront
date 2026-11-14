import {NextRequest} from 'next/server';
import {orderReviewProxy} from '@/lib/order-review-proxy';
export async function GET(request:NextRequest){return orderReviewProxy(request);}
