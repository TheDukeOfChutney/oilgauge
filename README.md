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

## Collect from a residential connection with Podman

The collector can run as a one-shot container on a home server. Requests then originate from the server's residential connection, while the public frontend can remain hosted separately.

Build the image and run the collector from the repository root:

```bash
podman compose build collector
podman compose run --rm collector
```

The bind mount writes results back to the checkout at:

- `public/discovery.json`
- `public/offers.json`

Inspect the result before publishing it:

```bash
git diff -- public/discovery.json public/offers.json
```

The container runs Node 22 and needs no npm install because the collector uses only Node's built-in APIs. `userns_mode: keep-id` makes files written through Podman's bind mount belong to the host user. The `:Z` mount option also makes the bind mount work on SELinux hosts such as Rocky Linux.

To run without Compose:

```bash
podman build -t oilgauge-collector -f Containerfile .
podman run --rm --userns=keep-id -v "$(pwd)/public:/app/public:Z" oilgauge-collector
```

The included GitHub Actions workflow runs daily and on manual request. It commits the refreshed feed after collection. The static frontend can be deployed now; later self-hosting can reuse the collector while replacing JSON with SQLite and an API.
