import type { CatalogImage, Variant } from './catalog';
export type SellerCategory = { _id:string;name:string;createdBy:string;image?:CatalogImage;subcategory?:SellerSubcategory[] };
export type SellerSubcategory = { _id:string;name:string;categoryId:string;createdBy:string;image?:CatalogImage };
export type SellerProduct = { _id:string;description:string;categoryId:string;subCategoryId:string;brandId:string;brandName:string;variants:Variant[];specifications?:{name:string;value:unknown}[] };
export type SellerCoupon = { _id:string;code:string;discountType:'percentage'|'fixed';discountValue:number;maxDiscountAmount?:number|null;minOrderAmount:number;expireDate:string;usageLimit?:number|null;usedCount?:number;applicableProducts:string[];applicableCategories:string[];excludedProducts:string[] };
export async function sellerRequest<T>(path:string,method='GET',body?:FormData|unknown):Promise<T>{
  const form=body instanceof FormData;
  const response=await fetch('/api/seller/'+path,{method,cache:'no-store',...(body===undefined?{}:{headers:form?{}:{'Content-Type':'application/json'},body:form?body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message||'Could not complete this action.'),{status:response.status});return data as T;
}
export async function sellerList<T>(path:string,key:string):Promise<T[]>{
  const items:T[]=[];
  for(let page=1;page<=100;page++){
    const data=await sellerRequest<Record<string,unknown>&{pagination?:{hasMore:boolean}}>(path+'?size=100&page='+page);
    const batch=data[key];if(!Array.isArray(batch))throw new Error('The store returned an invalid list.');items.push(...batch);
    if(data.pagination?!data.pagination.hasMore:batch.length<100)return items;
  }
  throw new Error('This list is too large to load. Please narrow your catalog.');
}
