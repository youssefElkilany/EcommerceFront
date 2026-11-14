import { test, expect } from "@playwright/test";
const cat = "507f1f77bcf86cd799439011";
const mobile = "507f1f77bcf86cd799439012";
const laptop = "507f1f77bcf86cd799439013";
const other = "507f1f77bcf86cd799439014";
const item = (i: number) => ({ _id: String(i), name: "Phone " + i, brandName: "Test brand", description: "Product details", variants: [{ _id: "v" + i, price: 1200, finalPrice: 1000, discount: 16, stock: 3, mainImage: { secure_url: "/dory-right-arrow.jpg" } }], ratings: { average: 4.5, count: 3 } });
test("category filtering, optional variant counts, fish scrolling, search and saved products", async ({ page }) => {
  const requests: URL[] = [];
  await page.route("**/api/catalog/brands", route => route.fulfill({ json: { brands: [] } }));
  await page.route("**/api/catalog/categories", route => route.fulfill({ json: { categories: [
    { _id: cat, name: "Electronics", image: { secure_url: "/dory-right-arrow.jpg" }, subcategory: [{ _id: mobile, name: "Mobiles" }, { _id: laptop, name: "Laptops" }, ...Array.from({ length: 6 }, (_, i) => ({ _id: "sub" + i, name: "Collection " + i }))] },
    { _id: other, name: "Home", subcategory: [] },
  ] } }));
  await page.route("**/api/catalog/products?*", route => {
    const url = new URL(route.request().url()); requests.push(url);
    const filtered = url.searchParams.has("subCategoryId");
    expect(url.searchParams.get("sort")).toBe("-discount");
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.get("size")).toBe("10");
    const empty = url.searchParams.get("search") === "unmatched" || url.searchParams.get("categoryId") === other;
    return route.fulfill({ json: { products: empty ? [] : filtered ? [item(1), item(2)] : Array.from({ length: 10 }, (_, i) => item(i + 1)),
      pagination: url.searchParams.has("count") ? { page: 1, size: 10, totalItems: empty ? 0 : filtered ? 2 : 7, totalProducts: empty ? 0 : filtered ? 2 : 5, hasMore: !empty && !filtered } : undefined,
      subcategoryCounts: empty ? [] : [{ _id: mobile, count: 2 }, { _id: laptop, count: 3 }] } });
  });
  await page.goto("/");
  const section = page.getByRole("region", { name: "Electronics", exact: true });
  await expect(section.locator(".subcategory-tile")).toHaveCount(7);
  await expect(section.getByRole("button", { name: "VIEW ALL", exact: true })).toBeDisabled();
  await expect(section.getByText("Collection 5", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Home", exact: true }).getByRole("button", { name: "VIEW ALL" })).toHaveCount(0);
  await expect(section.getByText("Laptops", { exact: true })).toBeVisible();
  expect(requests[0].searchParams.get("categoryId")).toBe(cat);
  expect(requests[0].searchParams.has("count")).toBe(false);
  await expect(section.getByRole("button", { name: "Previous Electronics products" })).toBeDisabled();
  await section.getByRole("button", { name: "Next Electronics products" }).click();
  await expect.poll(() => section.locator(".product-track").evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
  await expect(section.locator(".product-card")).toHaveCount(10);
  expect(requests).toHaveLength(2);
  const railBox = await section.locator(".product-carousel").boundingBox();
  const arrowBox = await section.getByRole("button", { name: "Next Electronics products" }).boundingBox();
  expect(Math.abs((arrowBox!.y + arrowBox!.height / 2) - (railBox!.y + railBox!.height / 2))).toBeLessThan(2);
  await expect(section.getByRole("button", { name: "Next Electronics products" })).toBeDisabled();
  await section.getByRole("button", { name: "Previous Electronics products" }).click();
  await section.getByText("Mobiles", { exact: true }).click();
  await expect(section.locator(".product-card")).toHaveCount(10);
  expect(requests.every(url => !url.searchParams.has("subCategoryId"))).toBe(true);
  expect(requests).toHaveLength(2);
  await expect(section.getByText(/Page [0-9]/)).toHaveCount(0);
  await expect(section.locator(".product-track")).toHaveJSProperty("scrollLeft", 0);
  await section.getByRole("button", { name: "Save Phone 1", exact: true }).click();
  await page.getByRole("button", { name: "Saved products", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Phone 1", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await section.getByRole("button", { name: "View Phone 1", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Phone 1" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search products" }).fill("unmatched");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(section.getByText("No available products match your search.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("navigation", { name: "Shop departments" }).getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("region", { name: "Electronics", exact: true })).toHaveCount(0);
  await expect(page.getByText("No available products in this collection yet.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("catalog errors can be retried and empty categories are explained", async ({ page }) => {
  await page.route("**/api/catalog/brands", route => route.fulfill({ json: { brands: [] } }));
  await page.route("**/api/catalog/categories", route => route.fulfill({ status: 503, json: { message: "Unavailable" } }));
  await page.goto("/");
  await expect(page.locator(".catalog-message[role=alert]")).toContainText("We couldn't load these finds.");
  await page.unroute("**/api/catalog/categories");
  await page.route("**/api/catalog/categories", route => route.fulfill({ json: { categories: [] } }));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Our shelves are getting ready. Check back for new categories soon.")).toBeVisible();
});

test("brand links show variant totals and allow browsing every page", async ({ page }) => {
  await page.route("**/api/catalog/categories", route => route.fulfill({ json: { categories: [] } }));
  await page.route("**/api/catalog/brands", route => route.fulfill({ json: { brands: [{ _id: cat, name: "Example brand" }] } }));
  await page.route("**/api/catalog/products?*", route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("brandId")).toBe(cat);
    expect(params.get("count")).toBe("true");
    const second = params.get("page") === "2";
    return route.fulfill({ json: { products: second ? [item(25)] : Array.from({ length: 24 }, (_, i) => item(i + 1)), pagination: { page: second ? 2 : 1, size: 24, totalItems: 25, hasMore: !second } } });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Example brand", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/brands/" + cat));
  await expect(page.getByText("25 matching options (including variants)")).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(24);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByRole("combobox").selectOption("finalPrice");
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
