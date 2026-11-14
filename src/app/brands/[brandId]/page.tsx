import { notFound } from "next/navigation";
import { Storefront } from "@/components/store/storefront";
import "../../store.css";
export default async function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(brandId)) notFound();
  return <Storefront brandId={brandId} />;
}
