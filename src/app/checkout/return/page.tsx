import type {Metadata} from 'next';
import {Suspense} from 'react';
import {CheckoutPage} from '@/components/checkout/checkout-page';
import '../checkout.css';
export const metadata:Metadata={title:'Order status | Dorytos'};
export default function Page(){return <Suspense fallback={<main>Checking your order...</main>}><CheckoutPage returning/></Suspense>;}
