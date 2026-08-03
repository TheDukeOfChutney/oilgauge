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
  if(!Number.isFinite(price)||price<=0) {
    const hasNullHomeDepotPrice=/"pricing\([^)]*\)":\{[^}]*"value":null/.test(html);
    if(product&&hasNullHomeDepotPrice) {
      throw new Error("Product is unavailable or unpriced for the current Home Depot store context");
    }
    throw new Error("No valid Product offer found in structured data or retailer page state");
  }

  const availability=String(rawOffer?.availability??walmartProduct?.availabilityStatus??walmartProduct?.itemPageAvailabilityStatus??"");
  const seller=walmartProduct?.sellerDisplayName||rawOffer?.seller?.name||seed.seller||seed.retailer;
  const name=product?.name||walmartProduct?.name||seed.product||"";
  const viscosityMatch=name.match(/\b(0W|5W|10W|15W|20W)[ -]?(16|20|30|40|50|60)\b/i)||name.match(/\bSAE[ -]?(20|30|40|50|60)\b/i);
  const viscosity=seed.viscosity||(viscosityMatch?.[2]?`${viscosityMatch[1].toUpperCase()}-${viscosityMatch[2]}`:viscosityMatch?.[1]?`SAE ${viscosityMatch[1]}`:"");
  const volumeMatch=name.match(/\b([\d.]+)[\s-]*(qt|quart|gal|gallon|fl\.?\s*oz|oz)\b/i);
  const units=volumeMatch?.[2]?.toLowerCase().replaceAll(".", "").replaceAll(" ", "");
  const multiplier=units?.startsWith("qt")||units==="quart"?0.946352946:units?.startsWith("gal")?3.785411784:units==="floz"||units==="oz"?0.0295735296:null;
  const volumeLiters=Number.isFinite(Number(seed.volumeLiters))?Number(seed.volumeLiters):volumeMatch&&multiplier?Number(volumeMatch[1])*multiplier:null;
  const brand=seed.brand||product?.brand?.name||product?.brand||name.split(/\s+/)[0]||"";
  const oilType=seed.oilType||(/full synthetic/i.test(name)?"Full synthetic":/synthetic blend/i.test(name)?"Synthetic blend":/high mileage/i.test(name)?"High mileage":/motor oil|engine oil/i.test(name)?"Conventional":"");
  return {
    brand,
    product:name,
    viscosity,
    oilType,
    specification:seed.specification||"",
    volumeLiters,
    containerLabel:seed.containerLabel||(volumeMatch?`${volumeMatch[1]} ${volumeMatch[2]}`:""),
    retailer:seed.retailer,
    seller,
    price,
    shipping:Number(seed.shipping||0),
    inStock:!/outofstock|out_of_stock|soldout|discontinued/i.test(availability),
    url:rawOffer?.url?new URL(rawOffer.url,seed.url).href:seed.url,
    lastChecked:checkedAt
  };
}
