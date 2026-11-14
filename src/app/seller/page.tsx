import type { Metadata } from 'next';
import { SellerCenter } from '@/components/seller/seller-center';
import './seller.css';
export const metadata:Metadata={title:'Seller center | Dorytos'};
export default function Page(){return <SellerCenter/>;}
