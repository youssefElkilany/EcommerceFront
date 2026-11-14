import type {Metadata} from 'next';
import {ManagedOrdersPage} from '@/components/seller/managed-orders';
import '../seller.css';
import './orders.css';
export const metadata:Metadata={title:'Manage orders | Dorytos'};
export default function Page(){return <ManagedOrdersPage/>;}
