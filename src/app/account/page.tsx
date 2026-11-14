import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/account-page';
import './account.css';
export const metadata: Metadata = { title: 'My account | Dorytos' };
export default function Page() { return <AccountPage/>; }
