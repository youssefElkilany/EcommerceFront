"use client";
import {createContext,useCallback,useContext,useMemo,useState,type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {accountRequest} from '@/lib/account';
type AuthSession={revision:number;clearAccountData:()=>Promise<void>;signOut:()=>Promise<void>};
const AuthSessionContext=createContext<AuthSession|null>(null);
export function AuthSessionProvider({children}:{children:ReactNode}){
  const client=useQueryClient();const [revision,setRevision]=useState(0);
  const clearAccountData=useCallback(async()=>{
    // Cancel old account reads before removing every customer/seller query.
    await client.cancelQueries();client.removeQueries();
  },[client]);
  const signOut=useCallback(async()=>{
    // A failed logout must leave the current session intact for retry.
    await accountRequest('/api/auth/logout','POST');
    await clearAccountData();client.getMutationCache().clear();
    // Next.js can retain login components. Reset their local success state too.
    setRevision(value=>value+1);
  },[client,clearAccountData]);
  const value=useMemo(()=>({revision,clearAccountData,signOut}),[revision,clearAccountData,signOut]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
export function useAuthSession(){const session=useContext(AuthSessionContext);if(!session)throw new Error('Auth session provider is required.');return session;}
