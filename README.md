# OilGauge

OilGauge compares national, shippable motor-oil offers by checkout price per liter. The interface reads `public/offers.json` and does not substitute invented prices when the feed is empty.

## Run locally

```bash
npm ci
npm run dev
```

## Collect prices

Retailer discovery is configured in `collector/products.json`. The Home Depot adapter walks the filtered Engine Oil search result, follows pagination, deduplicates product URLs, and then verifies each product page.

```bash
npm run test:collector
npm run collect
```

`public/discovery.json` records the expected product count, URLs found on every page, completion state, and discovery errors. `public/offers.json` records verified prices and product-page failures. The collector uses a small worker pool and extracts Schema.org Product/Offer JSON-LD when available. CAPTCHAs, denied requests, and unusable pages are reported as errors; no access controls are bypassed.

Exact product URLs can still be added under the optional `products` array, but the Home Depot catalog no longer depends on a manually maintained seed list.

The included GitHub Actions workflow runs daily and on manual request. It commits the refreshed feed after collection. The static frontend can be deployed now; later self-hosting can reuse the collector while replacing JSON with SQLite and an API.
