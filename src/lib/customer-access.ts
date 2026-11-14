"use client";
import {useQuery} from '@tanstack/react-query';
import {accountRequest,type Account} from '@/lib/account';
export function useCustomerAccess(){
  const account=useQuery({queryKey:['account'],queryFn:()=>accountRequest<{user:Account}>('/api/account'),retry:false});
  const restricted=account.isSuccess&&account.data.user.role!=='User';
  const guest=account.isError&&(account.error as Error&{status?:number}).status===401;
  return {account,restricted,canShop:account.isSuccess?!restricted:guest,ready:!account.isPending};
}
