import { notFound } from "next/navigation";
import { Storefront } from "@/components/store/storefront";
import "../../../store.css";
export const instant = false;
export default async function ProductPage({ params }: { params: Promise<{ productId: string; variantId: string }> }) {
  const { productId, variantId } = await params;
  if (![productId, variantId].every(id => /^[a-f0-9]{24}$/i.test(id))) notFound();
  return <Storefront productId={productId} variantId={variantId} />;
}
