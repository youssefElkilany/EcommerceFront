"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useAuthSession} from '@/components/auth/auth-session';
export function CustomerAccountNotice({feature}:{feature:string}){
  const router=useRouter();const {signOut}=useAuthSession();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const switchAccount=async()=>{
    setBusy(true);setError('');
    try{await signOut();router.replace('/login?next='+encodeURIComponent(window.location.pathname+window.location.search));router.refresh();}
    catch{setError('Could not sign out. Please try again.');setBusy(false);}
  };
  return <section className="catalog-message customer-account-notice" aria-label="Customer account required"><h2>Switch to a customer account</h2><p>{feature} is available for customer accounts. Your seller account is for managing your store.</p><button type="button" disabled={busy} onClick={()=>void switchAccount()}>{busy?'Signing out...':'Switch account'}</button><Link href="/seller">Go to seller center</Link>{error&&<p role="alert">{error}</p>}</section>;
}
