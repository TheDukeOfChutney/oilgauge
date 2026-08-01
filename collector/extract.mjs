export function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => { try { const value=JSON.parse(match[1]); return Array.isArray(value)?value:[value]; } catch { return []; } })
    .flatMap((value) => value?.["@graph"] ?? value);
}

export function extractOffer(html, seed, checkedAt=new Date().toISOString()) {
  const product=jsonLdBlocks(html).find((item)=>item?.["@type"]==="Product"||(Array.isArray(item?.["@type"])&&item["@type"].includes("Product")));
  const rawOffer=Array.isArray(product?.offers)?product.offers[0]:product?.offers;
  const price=Number(rawOffer?.price??rawOffer?.lowPrice);
  if(!product||!Number.isFinite(price)||price<=0) throw new Error("No valid Product offer found in structured data");
  const availability=String(rawOffer?.availability??"");
  return { brand:seed.brand||product.brand?.name||product.brand||"", product:seed.product||product.name||"", viscosity:seed.viscosity, oilType:seed.oilType, specification:seed.specification, volumeLiters:Number(seed.volumeLiters), containerLabel:seed.containerLabel, retailer:seed.retailer, seller:rawOffer?.seller?.name||seed.seller||seed.retailer, price, shipping:Number(seed.shipping||0), inStock:!/outofstock|soldout|discontinued/i.test(availability), url:rawOffer?.url?new URL(rawOffer.url,seed.url).href:seed.url, lastChecked:checkedAt };
}
