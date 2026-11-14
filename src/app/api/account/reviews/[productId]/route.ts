import {NextRequest} from 'next/server';
import {orderReviewProxy} from '@/lib/order-review-proxy';
export async function POST(request:NextRequest,{params}:{params:Promise<{productId:string}>}){return orderReviewProxy(request,(await params).productId);}
