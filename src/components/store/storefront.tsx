"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Grid2X2, Heart, MapPin, Package, Search, ShoppingBag, SlidersHorizontal, Sparkles, Star, UserRound, X } from "lucide-react";
import { CartControlsProvider, CartFeedback, ProductCardCartControl, ProductPageCartControl, useCartControls } from "@/components/store/product-cart-controls";
import { catalogFetch, productQuery, money, type Brand, type Category, type Product, type ProductResult } from "@/lib/catalog";

import {CustomerAccountNotice} from '@/components/store/customer-access';
function ProductImage({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} /> : <span className={"image-fallback " + className}><Package aria-hidden="true" /><span>Image unavailable</span></span>;
}
function FishButton({ direction, disabled, onClick, label }: { direction: "prev" | "next"; disabled: boolean; onClick: () => void; label: string }) {
  return <button type="button" className={"fish-button fish-" + direction} disabled={disabled} onClick={onClick} aria-label={label} title={label}>
    <img src={direction === "prev" ? "/nemo-left-arrow.png" : "/dory-right-arrow.jpg"} alt="" />
  </button>;
}
function ErrorState({ retry }: { retry: () => void }) {
  return <div role="alert" className="catalog-message"><Package size={25} /><p>We couldn&apos;t load these finds.</p><button onClick={retry}>Try again</button></div>;
}
function ProductCard({ product, saved, toggle }: { product: Product; saved: boolean; toggle: () => void }) {
  const {access}=useCartControls();
  const variant = product.variants[0];
  if (!variant) return null;
  const productName = variant.name || product.name || "Product";
  return <article className="product-card">
    <div className="product-visual">
      {variant.discount && variant.discount > 0 ? <span className="discount-tag">{variant.discount}% OFF</span> : null}
      {access.canShop&&<button type="button" className={"save-product " + (saved ? "is-saved" : "")} onClick={toggle} aria-label={(saved ? "Remove " : "Save ") + productName} aria-pressed={saved}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button>}
      <Link className="product-image-button" href={"/products/" + product._id + "/" + variant._id} aria-label={"View " + productName}><ProductImage src={variant.mainImage?.secure_url} alt={productName} /></Link>
    </div>
    <div className="product-info">
      <span className="product-brand">{product.brandName || "Dorytos finds"}</span>
      <Link className="product-name" href={"/products/" + product._id + "/" + variant._id}>{productName}</Link>
      <p className="product-options">{Object.values(variant.options || {}).join(" / ") || "Discover your next favorite"}</p>
      <div className="product-price"><span>EGP</span> {money(variant.finalPrice)} {variant.price > variant.finalPrice && <del>{money(variant.price)}</del>}</div>
      <div className="product-bottom">{product.ratings && product.ratings.count > 0 ? <span className="product-rating"><Star size={12} fill="currentColor" />{product.ratings.average.toFixed(1)} <small>({product.ratings.count})</small></span> : <span className="unrated">Not rated yet</span>}<span className="stock-note"><Check size={11} /> In stock</span></div>
      <ProductCardCartControl productId={product._id} variantId={variant._id} name={productName} stock={variant.stock || 0}/>
    </div>
  </article>;
}
type ProductActions = { saved: Product[]; toggle: (p: Product) => void };
function ProductRail({ categoryId, subCategoryId, count, search, label, actions }: { categoryId: string; subCategoryId: string; count: boolean; search: string; label: string; actions: ProductActions }) {
  const [edges, setEdges] = useState({ start: true, end: true });
  const rail = useRef<HTMLDivElement>(null);
  const query = useQuery({ queryKey: ["home-products", categoryId, subCategoryId, search, count], queryFn: ({ signal }) => catalogFetch<ProductResult>(productQuery(categoryId, search, subCategoryId, count), signal) });
  const data = query.data;
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setEdges({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [data]);
  const scroll = (direction: number) => {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return <>
    <div className="rail-top"><span aria-live="polite">{query.isPending ? "Finding your favorites..." : data?.pagination ? data.pagination.totalItems + " matching options (including variants)" : "Highest discounts - Up to 10 finds"}</span>

    </div>
    {query.isError ? <ErrorState retry={() => query.refetch()} /> : query.isPending ? <div className="product-grid" aria-label="Loading products">{Array.from({ length: 6 }, (_, i) => <div className="product-skeleton" key={i} />)}</div>
      : data?.products.length ? <div className="product-carousel"><FishButton direction="prev" label={"Previous " + label + " products"} disabled={edges.start} onClick={() => scroll(-1)} /><div ref={rail} className="product-grid product-track" tabIndex={0} role="region" aria-label={label + " product carousel"}>{data.products.slice(0, 10).map(product => <ProductCard key={product._id + product.variants[0]?._id} product={product} saved={actions.saved.some(item => item._id === product._id && item.variants[0]?._id === product.variants[0]?._id)} toggle={() => actions.toggle(product)} />)}</div><FishButton direction="next" label={"Next " + label + " products"} disabled={edges.end} onClick={() => scroll(1)} /></div>
      : <div className="catalog-message"><Package size={26} /><p>No available products{search ? " match your search" : " in this collection yet"}.</p></div>}
  </>;
}
function CategorySection({ category, search, count, actions }: { category: Category; search: string; count: boolean; actions: ProductActions }) {
  return <section id={"category-" + category._id} className="category-section" aria-label={category.name}>
    <div className="section-heading"><div><span className="section-kicker">A LITTLE MORE TO EXPLORE</span><h2>{category.name}</h2></div>{category.subcategory.length > 7 && <button className="subcategory-view-all" type="button" disabled title="All subcategories page coming later">VIEW ALL</button>}</div>
    <div className="subcategory-tiles" role="group" aria-label={category.name + " subcategories"}>
      {category.subcategory.slice(0, 7).map(sub => <div className="subcategory-tile" key={sub._id}><span className="subcategory-image"><ProductImage src={sub.image?.secure_url} alt={sub.name} /></span><strong>{sub.name}</strong></div>)}
    </div>
    <ProductRail key={search} categoryId={category._id} subCategoryId="" count={count} search={search} label={category.name} actions={actions} />
  </section>;
}
function BrandProducts({ brandId, search, actions }: { brandId: string; search: string; actions: ProductActions }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("-discount");
  const params = new URLSearchParams({ brandId, size: "24", page: String(page), count: "true", sort });
  if (search) params.set("search", search);
  const query = useQuery({ queryKey: ["brand-products", brandId, search, page, sort], queryFn: ({ signal }) => catalogFetch<ProductResult>("products?" + params, signal) });
  return <section className="category-section" aria-label="Brand products">
    <div className="brand-filter"><p aria-live="polite">{query.data?.pagination ? query.data.pagination.totalItems + " matching options (including variants)" : "Finding your favorites..."}</p><label>Sort by <select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="-discount">Highest discount</option><option value="finalPrice">Price: low to high</option><option value="-finalPrice">Price: high to low</option><option value="-createdAt">Newest</option></select></label></div>
    {query.isError ? <ErrorState retry={() => query.refetch()} /> : query.isPending ? <div className="catalog-message">Loading products...</div> : !query.data?.products.length ? <div className="catalog-message">No available products match this brand or search.</div> : <div className="product-grid">{query.data.products.map(product => <ProductCard key={product._id + product.variants[0]?._id} product={product} saved={actions.saved.some(item => item._id === product._id && item.variants[0]?._id === product.variants[0]?._id)} toggle={() => actions.toggle(product)} />)}</div>}
    <nav className="brand-pagination" aria-label="Product pages"><button disabled={page === 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={!query.data?.pagination?.hasMore || query.isFetching} onClick={() => setPage(p => p + 1)}>Next</button></nav>
  </section>;
}
function SearchResults({ query, categories, brands, actions }: { query: string; categories: Category[]; brands: Brand[]; actions: ProductActions }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("-discount");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [appliedPrice, setAppliedPrice] = useState({ min: "", max: "" });
  const params = new URLSearchParams({ search: query, count: "true", page: String(page), size: "24", sort });
  if (categoryId) params.set("categoryId", categoryId);
  if (brandId) params.set("brandId", brandId);
  if (appliedPrice.min) params.set("minPrice", appliedPrice.min);
  if (appliedPrice.max) params.set("maxPrice", appliedPrice.max);
  const results = useQuery({ queryKey: ["search-products", query, page, sort, categoryId, brandId, appliedPrice], queryFn: ({ signal }) => catalogFetch<ProductResult>("products?" + params, signal), enabled: query.trim().length > 0 });
  const changeFilter = (change: () => void) => { change(); setPage(1); };
  return <section className="search-results-page" aria-label="Search results">
    <div className="search-results-heading"><div><span className="section-kicker">YOUR SEARCH RESULTS</span><h1>Results for &quot;{query}&quot;</h1><p>{results.data?.pagination ? results.data.pagination.totalItems + " matching results" : "Finding your next favorite..."}</p></div><label className="search-sort">Sort by<select value={sort} onChange={event => changeFilter(() => setSort(event.target.value))}><option value="-discount">Highest discount</option><option value="-createdAt">Newest</option><option value="finalPrice">Price: low to high</option><option value="-finalPrice">Price: high to low</option><option value="-ratings.average">Top rated</option></select></label></div>
    <div className="search-results-layout"><aside className="search-filters" aria-label="Filter search results"><h2><SlidersHorizontal size={17}/> Filters</h2>
      <label>Category<select value={categoryId} onChange={event => changeFilter(() => setCategoryId(event.target.value))}><option value="">All categories</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <label>Brand<select value={brandId} onChange={event => changeFilter(() => setBrandId(event.target.value))}><option value="">All brands</option>{brands.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <form onSubmit={event => { event.preventDefault(); changeFilter(() => setAppliedPrice({ min: minPrice, max: maxPrice })); }}><fieldset><legend>Price (EGP)</legend><div className="price-range"><input type="number" min="0" placeholder="Min" aria-label="Minimum price" value={minPrice} onChange={event => setMinPrice(event.target.value)}/><input type="number" min="0" placeholder="Max" aria-label="Maximum price" value={maxPrice} onChange={event => setMaxPrice(event.target.value)}/></div><button type="submit">Apply price</button></fieldset></form>
      <button className="clear-search-filters" onClick={() => { setCategoryId(""); setBrandId(""); setMinPrice(""); setMaxPrice(""); setAppliedPrice({ min: "", max: "" }); setSort("-discount"); setPage(1); }}>Clear filters</button>
    </aside><div className="search-results-content" aria-live="polite">
      {results.isError ? <ErrorState retry={() => results.refetch()} /> : results.isPending ? <div className="search-product-grid">{Array.from({ length: 8 }, (_, i) => <div className="product-skeleton" key={i}/>)}</div> : !results.data?.products.length ? <div className="catalog-message"><Package size={28}/><p>No products matched &quot;{query}&quot;. Try another search or clear a filter.</p></div> : <div className="search-product-grid">{results.data.products.map(product => <ProductCard key={product._id + product.variants[0]?._id} product={product} saved={actions.saved.some(item => item._id === product._id && item.variants[0]?._id === product.variants[0]?._id)} toggle={() => actions.toggle(product)} />)}</div>}
      <nav className="search-pagination" aria-label="Search result pages"><button type="button" disabled={page <= 1 || results.isFetching} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}{results.data?.pagination ? " - " + results.data.pagination.totalItems + " results" : ""}</span><button type="button" disabled={!results.data?.pagination?.hasMore || results.isFetching} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </div></div>
  </section>;
}
function WishlistPage({ products, actions, ready, signedOut, loadError, retry }: { products: Product[]; actions: ProductActions; ready: boolean; signedOut: boolean; loadError: boolean; retry: () => void }) {
  return <section className="wishlist-page" aria-label="Wishlist"><div className="section-heading"><div><span className="section-kicker">YOUR SAVED FINDS</span><h1>My wishlist</h1><p>{ready ? products.length + (products.length === 1 ? " saved product" : " saved products") : "Loading your wishlist..."}</p></div></div>
    {!ready ? <div className="catalog-message">Loading your wishlist...</div> : signedOut ? <div className="wishlist-empty"><Heart size={34}/><h2>Sign in to see your wishlist</h2><p>Your saved products belong to your customer account.</p><Link href="/login?next=%2Fwishlist">Log in to continue<ArrowRight size={17}/></Link></div> : loadError ? <div className="catalog-message" role="alert"><p>We couldn&apos;t load your wishlist.</p><button onClick={retry}>Try again</button></div> : !products.length ? <div className="wishlist-empty"><Heart size={34}/><h2>Your wishlist is empty</h2><p>Save products with the heart icon and they will be waiting here.</p><Link href="/">Continue shopping<ArrowRight size={17}/></Link></div> : <div className="search-product-grid">{products.map(product => <ProductCard key={product._id + product.variants[0]?._id} product={product} saved toggle={() => actions.toggle(product)} />)}</div>}
  </section>;
}

type ProductVariantResponse = { productId: string; description?: string; specifications?: { name: string; value: unknown }[]; brandName?: string; ratings?: Product["ratings"]; variant: Product["variants"][number]; availableVariants: { variantId: string; options: Record<string, string>; stock: number }[] };
function formatSpecification(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatSpecification).filter(Boolean).join(", ");
  try { return JSON.stringify(value); } catch { return String(value); }
}
function ProductDetails({ productId, variantId, saved, toggle }: { productId: string; variantId: string; saved: Product[]; toggle: (product: Product) => void }) {
  const {access}=useCartControls();
  const [activeImage, setActiveImage] = useState("");
  const result = useQuery({ queryKey: ["product-detail", productId, variantId], queryFn: ({ signal }) => catalogFetch<ProductVariantResponse>("product/" + productId + "/variant/" + variantId, signal) });
  if (result.isPending) return <section className="product-detail-page"><div className="product-skeleton"/></section>;
  if (result.isError || !result.data) return <div className="catalog-message" role="alert">We couldn&apos;t load this product. Please try again later.</div>;
  const { variant } = result.data;
  const options = variant.options || {};
  const availableVariants = result.data.availableVariants || [];
  const optionGroups = new Map<string, { label: string; values: Map<string, string> }>();
  for (const candidate of [{ options }, ...availableVariants]) {
    for (const [rawKey, rawValue] of Object.entries(candidate.options || {})) {
      const key = rawKey.trim().toLocaleLowerCase();
      const value = rawValue?.trim();
      if (!key || !value) continue;
      const group = optionGroups.get(key) || { label: rawKey.trim(), values: new Map<string, string>() };
      group.values.set(value.toLocaleLowerCase(), group.values.get(value.toLocaleLowerCase()) || value);
      optionGroups.set(key, group);
    }
  }
  const images = [variant.mainImage, ...(variant.subImages || [])].map(image => image?.secure_url || image?.url).filter((url): url is string => !!url);
  const selectedImage = activeImage && images.includes(activeImage) ? activeImage : images[0];
  const product: Product = { _id: result.data.productId, name: variant.name, description: result.data.description, brandName: result.data.brandName, ratings: result.data.ratings, variants: [variant] };
  const isSaved = saved.some(item => item._id === product._id && item.variants[0]?._id === variant._id);
  const average = result.data.ratings?.average || 0;
  return <section className="product-detail-page" aria-label="Product details"><Link className="back-link" href="/">? Continue shopping</Link><div className="product-detail-layout">
    <div className="product-detail-gallery">{selectedImage ? <ProductImage className="product-detail-cover" src={selectedImage} alt={variant.name || "Product"}/> : <div className="product-detail-cover"><ProductImage alt={variant.name || "Product"}/></div>}{images.length > 1 && <div className="product-image-thumbnails" aria-label="Product images">{images.map((image,index) => <button type="button" key={image + index} aria-label={"Show product image " + (index+1)} aria-pressed={selectedImage === image} onClick={() => setActiveImage(image)}><img src={image} alt=""/></button>)}</div>}</div>
    <div className="product-detail-copy"><span className="product-brand">{result.data.brandName || "Dorytos finds"}</span><h1>{variant.name || "Product"}</h1><div className="product-detail-rating" aria-label={average.toFixed(1) + " out of 5, " + (result.data.ratings?.count || 0) + " reviews"}><span className="rating-label">Rating</span><span className="rating-stars">{Array.from({length:5},(_,index)=><Star key={index} size={19} aria-hidden="true" fill={average >= index + 0.5 ? "currentColor" : "none"}/>)}</span><strong>{average.toFixed(1)}</strong><span>{result.data.ratings?.count ? result.data.ratings.count + " reviews" : "No reviews yet"}</span></div><div className="product-detail-price"><span>EGP</span> {money(variant.finalPrice)} {variant.price > variant.finalPrice && <del>{money(variant.price)}</del>}{variant.discount ? <b>{variant.discount}% OFF</b> : null}</div><p>{result.data.description || "Discover the details of this find."}</p>
    {optionGroups.size > 0 && <div className="product-option-groups">{[...optionGroups].map(([key, group]) => {
      const currentEntry = Object.entries(options).find(([name]) => name.trim().toLocaleLowerCase() === key);
      const value = currentEntry?.[1]?.trim() || "";
      const valueKey = value.toLocaleLowerCase();
      const choices = [...group.values];
      return <fieldset className="product-option" key={key}><legend>{group.label}: <strong>{value || "Choose an option"}</strong></legend><div>{choices.map(([choiceKey, choice]) => {
        const matches = availableVariants.filter(candidate => Object.entries(candidate.options || {}).some(([name, candidateValue]) => name.trim().toLocaleLowerCase() === key && candidateValue.trim().toLocaleLowerCase() === choiceKey));
        const selected = matches
          .map(candidate => ({candidate, score: Object.entries(options).filter(([other,current]) => other.trim().toLocaleLowerCase() !== key && Object.entries(candidate.options || {}).some(([candidateName,candidateValue]) => candidateName.trim().toLocaleLowerCase() === other.trim().toLocaleLowerCase() && candidateValue.trim().toLocaleLowerCase() === current.trim().toLocaleLowerCase())).length, inStock: candidate.stock > 0}))
          .sort((left,right) => right.score - left.score || Number(right.inStock) - Number(left.inStock))[0]?.candidate;
        const href = selected ? "/products/" + productId + "/" + selected.variantId : "#";
        const inStock = matches.some(candidate => candidate.stock > 0);
        return <Link key={choiceKey} href={href} aria-current={valueKey === choiceKey ? "true" : undefined} aria-disabled={!selected || String(selected.variantId) === variantId} className={"option-value" + (valueKey === choiceKey ? " is-selected" : "")} title={inStock ? undefined : "Currently out of stock"} onClick={event => { if (!selected || String(selected.variantId) === variantId) event.preventDefault(); }}>{choice}</Link>;
      })}</div></fieldset>;
    })}</div>}
    {!!result.data.specifications?.length && <section className="product-specifications" aria-label="Product specifications"><h2>Product specifications</h2><dl>{result.data.specifications.filter(item => item?.name && formatSpecification(item.value)).map((item,index) => <div key={item.name + index}><dt>{item.name}</dt><dd>{formatSpecification(item.value)}</dd></div>)}</dl></section>}
    <p className="product-availability"><Check size={16}/> {variant.stock > 0 ? "In stock" : "Out of stock"}</p>{access.canShop&&<button className="detail-save" aria-pressed={isSaved} onClick={() => toggle(product)}><Heart size={17} fill={isSaved ? "currentColor" : "none"}/>{isSaved ? "Saved to wishlist" : "Add to wishlist"}</button>}<ProductPageCartControl key={variantId} productId={productId} variantId={variantId} stock={variant.stock || 0} /></div></div></section>;
}
type StorefrontProps = { brandId?: string; initialSearch?: string; wishlist?: boolean; productId?: string; variantId?: string };
export function Storefront(props: StorefrontProps) { return <CartControlsProvider><StorefrontContent {...props}/></CartControlsProvider>; }
function StorefrontContent({ brandId, initialSearch, wishlist, productId, variantId }: StorefrontProps) {
  const { query: cartQuery, access } = useCartControls();
  const brands = useQuery({ queryKey: ["brands"], queryFn: ({ signal }) => catalogFetch<{ brands: Brand[] }>("brands", signal) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: ({ signal }) => catalogFetch<{ categories: Category[] }>("categories", signal) });
  const [active, setActive] = useState("");
  const [input, setInput] = useState(initialSearch || "");
  const [search, setSearch] = useState(initialSearch || "");
  const client = useQueryClient();
  const router = useRouter();
  const wishlistQuery = useQuery({ queryKey: ["wishlist"], queryFn: async () => {
    const response = await fetch("/api/wishlist", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || "Could not load wishlist."), { status: response.status });
    return data.products as Product[];
  }, retry: false, enabled:access.canShop });
  const saved = access.canShop?(wishlistQuery.data || []):[];
  const wishlistMutation = useMutation({ mutationFn: async ({ productId, variantId, remove }: { productId: string; variantId: string; remove: boolean }) => {
    const response = await fetch("/api/wishlist", { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, variantId }) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || "Could not update wishlist."), { status: response.status });
    return data.products as Product[];
  }, onSuccess: products => client.setQueryData(["wishlist"], products) });
  const toggle = (product: Product) => {
    if(!access.canShop)return;
    const variant = product.variants[0];
    if (!variant) return;
    const remove = saved.some(item => item._id === product._id && item.variants[0]?._id === variant._id);
    wishlistMutation.mutate({ productId: product._id, variantId: variant._id, remove }, { onError: error => {
      if ((error as Error & { status?: number }).status === 401) {
        const next = window.location.pathname + window.location.search;
        router.push("/login?next=" + encodeURIComponent(next));
      }
    } });
  };
  const list = categories.data?.categories || [];
  const chooseCategory = (id: string) => { if (initialSearch || brandId || wishlist || productId) { router.push("/#category-" + id); return; } setActive(id); document.getElementById("collections")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const actions = { saved, toggle };
  return <div className="storefront">
    <a href="#collections" className="skip-link">Skip to products</a>
    <div className="store-announcement"><Sparkles size={12} /><span>Big discoveries. Little everyday joys. Welcome to Dorytos.</span><span className="announcement-right">MADE FOR YOUR NEXT FIND</span></div>
    <header className="store-header">
      <Link href="/" className="store-logo" aria-label="Dorytos home"><img src="/dorytos-logo.svg" alt="Dorytos" /></Link>
      <div className="delivery-location"><MapPin size={21} /><span>Deliver to<strong>Cairo, Egypt</strong></span></div>
      <form role="search" action="/search" method="get" className="store-search">
        <Search size={19} /><input type="search" name="q" aria-label="Search products" required placeholder="What are you looking for today?" value={input} maxLength={100} onChange={event => setInput(event.target.value)} />
        {input && <button type="button" onClick={() => { setInput(""); setSearch(""); }} aria-label="Clear search"><X size={16} /></button>}<button type="submit" className="search-submit">Search</button>
      </form>
      <nav className="header-actions" aria-label="Your account"><Link href="/account" aria-label="Account"><UserRound size={22} /><span>Account</span></Link>{access.canShop&&<><Link href="/wishlist" aria-label="Wishlist"><Heart size={22} /><span>Wishlist{saved.length > 0 && <b>{saved.length}</b>}</span></Link><Link href="/cart" aria-label="Cart"><ShoppingBag size={22} /><span>Cart{(cartQuery.data?.itemCount || 0) > 0 && <b>{cartQuery.data?.itemCount}</b>}</span></Link></>}{access.restricted&&<Link href="/seller">Seller center</Link>}</nav>
    </header>
    <nav className="category-nav" aria-label="Shop departments"><button type="button" aria-pressed={!active} onClick={() => chooseCategory("")}><Grid2X2 size={17} />All categories</button><div className="nav-departments">{list.map(category => <button type="button" key={category._id} aria-pressed={active === category._id} onClick={() => chooseCategory(category._id)}>{category.name}</button>)}</div>{list.length > 6 && <details className="more-categories"><summary>More<ChevronDown size={14} /></summary><div>{list.map(category => <button type="button" key={category._id} onClick={event => { chooseCategory(category._id); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{category.name}</button>)}</div></details>}</nav>
    <main>
      <CartFeedback/>
      {wishlistMutation.isError && (wishlistMutation.error as Error & { status?: number }).status !== 401 && <p className="catalog-message" role="alert">{wishlistMutation.error.message}</p>}
      {!brandId && !initialSearch && !wishlist && !productId && <><section className="welcome-hero">
        <div className="hero-copy"><span className="hero-eyebrow"><span />WELCOME TO YOUR HAPPY PLACE</span><h1>Dive into your<br />next <em>favorite find.</em></h1><p>A world of possibilities, all in one place.<br />Find the little things that make your everyday better.</p><a href="#shop-categories" className="hero-cta">Explore the collection<ArrowRight size={17} /></a><span className="hero-footnote">YOUR NEXT DISCOVERY STARTS HERE</span></div>
        <div className="hero-art"><img src="/dory-right-arrow.jpg" alt="Our blue Dorytos fish welcomes you" fetchPriority="high" /><div className="hero-sticker"><Sparkles size={21} /><span>A little curiosity.<strong>A lot to discover.</strong></span></div></div>
      </section>
      <div className="discovery-strip"><span><Grid2X2 size={17} /> A category for every curiosity</span><span><Heart size={17} /> Save the things you love</span><span><Search size={17} /> Find your next favorite</span></div>
      <section id="shop-categories" className="shop-categories">
        <div className="section-heading"><div><span className="section-kicker">WHERE WILL YOU DIVE IN?</span><h2>Shop by category</h2></div><button type="button" className="text-link" onClick={() => chooseCategory("")}>Explore all<ArrowRight size={15} /></button></div>
        {categories.isPending ? <div className="category-tiles" aria-label="Loading categories">{Array.from({ length: 7 }, (_, i) => <div className="category-skeleton" key={i} />)}</div> : categories.isError ? <ErrorState retry={() => categories.refetch()} /> : !list.length ? <div className="catalog-message"><p>Our shelves are getting ready. Check back for new categories soon.</p></div> :
          <div className="category-tiles">{list.map((category, i) => <button type="button" key={category._id} className={"category-tile tile-" + i % 5} aria-pressed={active === category._id} onClick={() => chooseCategory(category._id)}><span className="category-image"><ProductImage src={category.image?.secure_url} alt={category.name} /></span><strong>{category.name}</strong></button>)}</div>}
      </section>
      <div id="collections" className="collections">
        {(search || active) && <div className="active-filters"><SlidersHorizontal size={17} /><span>{search ? 'Results for "' + search + '"' : "Browsing"}{active ? " in " + list.find(c => c._id === active)?.name : ""}</span><button type="button" onClick={() => { setActive(""); setSearch(""); setInput(""); }}>Clear filters<X size={14} /></button></div>}
        {list.filter(category => !active || category._id === active).map(category => <CategorySection key={category._id} category={category} search={search} count={!!active} actions={actions} />)}
      </div>
      <section className="shop-brands shop-categories" aria-label="Shop by brand"><div className="section-heading"><h2>Shop by brand</h2></div>{brands.isError ? <ErrorState retry={() => brands.refetch()} /> : brands.isPending ? <p>Loading brands...</p> : !brands.data?.brands.length ? <p>New brands are on their way.</p> : <div className="category-tiles">{brands.data.brands.map(brand => <Link className="category-tile" key={brand._id} aria-label={brand.name} href={"/brands/" + brand._id}><span className="category-image"><ProductImage src={brand.image?.secure_url} alt="" /></span><strong>{brand.name}</strong></Link>)}</div>}</section>
      </>}
      {wishlist&&access.restricted&&<CustomerAccountNotice feature="Wishlist"/>}
      {wishlist && !access.restricted && <WishlistPage products={saved} actions={actions} ready={wishlistQuery.isSuccess || wishlistQuery.isError} signedOut={(wishlistQuery.error as Error & { status?: number } | null)?.status === 401} loadError={wishlistQuery.isError && (wishlistQuery.error as Error & { status?: number } | null)?.status !== 401} retry={() => wishlistQuery.refetch()} />}
      {productId && variantId && <ProductDetails productId={productId} variantId={variantId} saved={saved} toggle={toggle} />}
      {initialSearch && <SearchResults query={initialSearch} categories={list} brands={brands.data?.brands || []} actions={actions} />}
      {brandId && !wishlist && !productId && <div id="collections" className="collections"><div className="section-heading"><div><Link className="text-link" href="/">Back to home</Link><h1>{brands.data?.brands.find(brand => brand._id === brandId)?.name || "Brand collection"}</h1></div></div><BrandProducts key={brandId + search} brandId={brandId} search={search} actions={actions} /></div>}
      {!productId && <section className="store-closing"><div><span className="section-kicker">THE BEST FINDS ARE STILL AHEAD</span><h2>Keep your curiosity swimming.</h2><p>Discover something new. Make it yours.</p></div><a href="#shop-categories">Back to categories<ArrowRight size={18} /></a></section>}
    </main>
    <footer className="store-footer"><strong>dorytos</strong><span>A world of finds. One happy place.</span><span>&copy; Dorytos &middot; Egypt &middot; EGP</span></footer>
  </div>;
}




