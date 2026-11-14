import Link from 'next/link';
export default function Loading(){
  return <main className="checkout-gate" aria-busy="true"><h1>Opening checkout</h1><p role="status">Loading your delivery and payment options...</p><Link href="/cart">Back to cart</Link></main>;
}
