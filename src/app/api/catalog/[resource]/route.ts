import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!["categories", "products", "brands"].includes(resource)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "")).replace(/\/+$/, "");
  if (!base) return NextResponse.json({ message: "The store is temporarily unavailable." }, { status: 503 });
  const fetchApi = async (path: string) => {
    const response = await fetch(base + path, { cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]) });
    if (!response.ok) throw new Error("Catalog unavailable");
    return response.json();
  };
  try {
    if (resource === "brands") return NextResponse.json(await fetchApi("/brand"));
    if (resource === "categories") {
      const categories = [];
      // Fetch every category, rather than silently using the API's default size of 3.
      for (let page = 1; page <= 100; page++) {
        const data = await fetchApi("/category?size=100&page=" + page + "&sort=name");
        if (!Array.isArray(data.category)) throw new Error("Invalid category response");
        categories.push(...data.category);
        if (data.category.length < 100) return NextResponse.json({ categories }, { headers: { "Cache-Control": "no-store" } });
      }
      throw new Error("Category page limit exceeded");
    }
    const query = new URLSearchParams();
    for (const [key, value] of request.nextUrl.searchParams) {
      if (!["page", "size", "search", "subCategoryId", "categoryId", "brandId", "count", "sort", "minPrice", "maxPrice", "discount", "rating"].includes(key)) return NextResponse.json({ message: "Unsupported filter." }, { status: 400 });
      if (["subCategoryId", "categoryId", "brandId"].includes(key) && !/^[a-f0-9]{24}$/i.test(value)) return NextResponse.json({ message: "Invalid subcategory." }, { status: 400 });
      query.append(key, value);
    }
    if (query.toString().length > 12000) return NextResponse.json({ message: "Too many filters." }, { status: 400 });
    const data = await fetchApi("/product?" + query);
    if (!Array.isArray(data.products)) throw new Error("Missing catalog metadata");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "We couldn't load the store. Please try again in a moment." }, { status: 503 });
  }
}
