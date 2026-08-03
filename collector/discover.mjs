const PRODUCT_PATH = /\/p\/(?:sets\/)?[^"'<>\s]+\/\d{6,12}/gi;

export function canonicalProductUrl(value, baseUrl = "https://www.homedepot.com") {
  const decoded = String(value).replaceAll("&amp;", "&").replaceAll("\\u002F", "/");
  const match = decoded.match(PRODUCT_PATH)?.[0];
  if (!match) return null;
  const url = new URL(match, baseUrl);
  url.search = "";
  url.hash = "";
  return url.href;
}

export function parseHomeDepotSearchPage(html, pageUrl) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:href=["']|https?:\/\/www\.homedepot\.com)([^"'<>\s]*\/p\/(?:sets\/)?[^"'<>\s]+\/\d{6,12})/gi)) {
    const url = canonicalProductUrl(match[1], pageUrl);
    if (url) urls.add(url);
  }
  // Absolute URLs are not always preceded by href in Home Depot's embedded state.
  for (const match of html.matchAll(/https?:\/\/www\.homedepot\.com\/p\/(?:sets\/)?[^"'<>\s]+\/\d{6,12}/gi)) {
    const url = canonicalProductUrl(match[0], pageUrl);
    if (url) urls.add(url);
  }
  const report = html.match(/"searchReport":\{[^}]*"totalProducts":(\d+)[^}]*"pageSize":(\d+)[^}]*"startIndex":(\d+)/);
  return {
    urls: [...urls],
    totalProducts: report ? Number(report[1]) : null,
    pageSize: report ? Number(report[2]) : null,
    startIndex: report ? Number(report[3]) : null,
  };
}

export function pageUrlForOffset(searchUrl, offset) {
  const url = new URL(searchUrl);
  if (offset > 0) url.searchParams.set("Nao", String(offset));
  else url.searchParams.delete("Nao");
  return url.href;
}

export async function discoverHomeDepot(config, fetchPage) {
  const seen = new Set();
  const pages = [];
  const maxPages = Number(config.maxPages ?? 20);
  let offset = 0;
  let expected = null;
  let pageSize = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const url = pageUrlForOffset(config.searchUrl, offset);
    try {
      const html = await fetchPage(url);
      const parsed = parseHomeDepotSearchPage(html, url);
      parsed.urls.forEach((productUrl) => seen.add(productUrl));
      expected ??= parsed.totalProducts;
      pageSize ??= parsed.pageSize || parsed.urls.length;
      pages.push({ page: pageNumber, url, status: "success", found: parsed.urls.length, uniqueTotal: seen.size });
      if (!pageSize || parsed.urls.length === 0 || (expected !== null && offset + pageSize >= expected)) break;
      offset += pageSize;
    } catch (error) {
      pages.push({ page: pageNumber, url, status: "failed", error: error instanceof Error ? error.message : String(error) });
      break;
    }
  }

  return {
    retailer: config.retailer,
    searchUrl: config.searchUrl,
    expectedProducts: expected,
    discoveredProducts: seen.size,
    complete: expected !== null && seen.size >= expected,
    pages,
    urls: [...seen],
  };
}

export function seedFromHomeDepotUrl(url, config) {
  const slug = new URL(url).pathname.split("/").at(-2) ?? "";
  return {
    enabled: true,
    url,
    retailer: config.retailer,
    seller: config.seller ?? config.retailer,
    product: slug.replaceAll("-", " "),
    shipping: Number(config.shipping ?? 0),
  };
}
