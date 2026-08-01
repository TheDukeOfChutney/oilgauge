# OilGauge

OilGauge compares national, shippable motor-oil offers by checkout price per liter. The interface reads `public/offers.json` and does not substitute invented prices when the feed is empty.

## Run locally

```bash
npm ci
npm run dev
```

## Collect prices

Add exact retailer product-page URLs to `collector/products.json`, fill in the oil attributes, and set each validated entry to `"enabled": true`.

```bash
npm run test:collector
npm run collect
```

The collector makes one low-frequency request per configured page and extracts Schema.org Product/Offer JSON-LD when available. CAPTCHAs, denied requests, and unusable pages are reported as errors; no access controls are bypassed.

The included GitHub Actions workflow runs daily and on manual request. It commits the refreshed feed after collection. The static frontend can be deployed now; later self-hosting can reuse the collector while replacing JSON with SQLite and an API.
