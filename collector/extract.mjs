export function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => { try { const value=JSON.parse(match[1]); return Array.isArray(value)?value:[value]; } catch { return []; } })
    .flatMap((value) => value?.["@graph"] ?? value);
}

function nextDataProduct(html) {
  const match=html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!match) return null;
  try { return JSON.parse(match[1])?.props?.pageProps?.initialData?.data?.product ?? null; } catch { return null; }
}

export function extractOffer(html, seed, checkedAt=new Date().toISOString()) {
  const product=jsonLdBlocks(html).find((item)=>item?.["@type"]==="Product"||(Array.isArray(item?.["@type"])&&item["@type"].includes("Product")));
  const rawOffer=Array.isArray(product?.offers)?product.offers[0]:product?.offers;
  const structuredPrice=Number(rawOffer?.price??rawOffer?.lowPrice);
  const walmartProduct=nextDataProduct(html);
  const walmartPrice=Number(walmartProduct?.priceInfo?.currentPrice?.price);
  const price=Number.isFinite(structuredPrice)&&structuredPrice>0?structuredPrice:walmartPrice;
  if(!Number.isFinite(price)||price<=0) throw new Error("No valid Product offer found in structured data or retailer page state");

  const availability=String(rawOffer?.availability??walmartProduct?.availabilityStatus??walmartProduct?.itemPageAvailabilityStatus??"");
  const seller=walmartProduct?.sellerDisplayName||rawOffer?.seller?.name||seed.seller||seed.retailer;
  return {
    brand:seed.brand||product?.brand?.name||product?.brand||"",
    product:seed.product||product?.name||walmartProduct?.name||"",
    viscosity:seed.viscosity,
    oilType:seed.oilType,
    specification:seed.specification,
    volumeLiters:Number(seed.volumeLiters),
    containerLabel:seed.containerLabel,
    retailer:seed.retailer,
    seller,
    price,
    shipping:Number(seed.shipping||0),
    inStock:!/outofstock|out_of_stock|soldout|discontinued/i.test(availability),
    url:rawOffer?.url?new URL(rawOffer.url,seed.url).href:seed.url,
    lastChecked:checkedAt
  };
}
