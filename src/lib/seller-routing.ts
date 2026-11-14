const id = (value: string | undefined) => !!value && /^[a-f0-9]{24}$/i.test(value);
export function sellerRoute(parts: string[], method: string): string | null {
  const [resource, item, child, variant] = parts;
  if (parts.length === 1) {
    if (resource === 'categories' && ['GET','POST'].includes(method)) return '/category';
    if (resource === 'orders' && method === 'GET') return '/order/manage';
    if (resource === 'brands' && method === 'GET') return '/brand';
    if (resource === 'products' && method === 'GET') return '/product/mine';
    if (resource === 'products' && method === 'POST') return '/product';
    if (resource === 'coupons' && ['GET','POST'].includes(method)) return '/coupon';
  }
  if (!id(item)) return null;
  if (resource === 'categories') {
    if (parts.length === 2 && method === 'PATCH') return '/category/' + item;
    if (parts.length === 3 && child === 'subcategories' && ['GET','POST'].includes(method)) return `/category/${item}/subcategory`;
    if (parts.length === 4 && child === 'subcategories' && id(variant) && method === 'PATCH') return `/category/${item}/subcategory/${variant}`;
  }
  if (resource === 'products') {
    if (parts.length === 2 && method === 'PUT') return '/product/' + item;
    if (parts.length === 3 && child === 'variants' && method === 'POST') return `/product/${item}/variant`;
    if (parts.length === 4 && child === 'variants' && id(variant) && ['PATCH','DELETE'].includes(method)) return `/product/${item}/variant/${variant}`;
  }
  if(resource==='orders'&&parts.length===2&&method==='PATCH')return '/order/'+item;
  if (resource === 'coupons' && parts.length === 2 && ['PUT','DELETE'].includes(method)) return '/coupon/' + item;
  return null;
}
