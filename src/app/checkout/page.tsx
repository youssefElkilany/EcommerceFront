import type {Metadata} from 'next';
import {Suspense} from 'react';
import {CheckoutPage} from '@/components/checkout/checkout-page';
import './checkout.css';
export const metadata:Metadata={title:'Checkout | Dorytos'};
export default function Page(){return <Suspense fallback={<main>Loading checkout...</main>}><CheckoutPage/></Suspense>;}
