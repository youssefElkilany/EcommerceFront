export function checkoutRoute(parts:string[]):string|null{
  if(!parts.length)return '/order/checkout2';
  if(parts.length===2&&/^[a-f0-9]{24}$/i.test(parts[0])&&['payment','reconcile'].includes(parts[1]))return '/order/checkout2/'+parts.join('/');
  return null;
}
