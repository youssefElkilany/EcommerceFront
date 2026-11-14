export type CatalogImage = { public_id?: string; secure_url?: string; url?: string };
export type Subcategory = { _id: string; name: string; image?: CatalogImage };
export type Brand = { _id: string; name: string; image?: CatalogImage };
export type Category = { _id: string; name: string; image?: CatalogImage; subcategory: Subcategory[] };
export type Variant = { _id: string; name?: string; price: number; finalPrice: number; discount?: number; stock: number; options?: Record<string, string>; mainImage?: CatalogImage; subImages?: CatalogImage[] };
export type Product = { _id: string; name?: string; description?: string; brandName?: string; variants: Variant[]; ratings?: { average: number; count: number } };
export type ProductResult = { products: Product[]; pagination?: { page: number; size: number; totalItems: number; hasMore: boolean } };

export async function catalogFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/catalog/" + path, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The store couldn't load. Please try again.");
  return data;
}
export function productQuery(categoryId: string, search: string, subCategoryId = "", count = false) {
  const params = new URLSearchParams({ categoryId, size: "10", sort: "-discount" });
  if (subCategoryId) params.set("subCategoryId", subCategoryId);
  if (search) params.set("search", search);
  if (count || subCategoryId || search) params.set("count", "true");
  return "products?" + params;
}
export const money = (value: number) => new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 }).format(value);
