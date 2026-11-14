import { notFound } from "next/navigation";
import { Storefront } from "@/components/store/storefront";
import "../store.css";
export const instant = false;
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  if (!query?.trim() || query.length > 100) notFound();
  return <Storefront initialSearch={query.trim()} />;
}
