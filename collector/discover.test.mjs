import test from "node:test";
import assert from "node:assert/strict";
import { discoverHomeDepot, parseHomeDepotSearchPage, seedFromHomeDepotUrl } from "./discover.mjs";

const page = (start, total, urls) => `<script>window.state={"searchReport":{"totalProducts":${total},"pageSize":2,"startIndex":${start}}}</script>${urls.map((url) => `<a href="${url}">Oil</a>`).join("")}`;

test("extracts and deduplicates Home Depot product URLs", () => {
  const html = page(0, 2, [
    "/p/Pennzoil-Full-Synthetic-5-qt/318718731?source=shoppingads",
    "https://www.homedepot.com/p/Pennzoil-Full-Synthetic-5-qt/318718731",
    "/p/Castrol-EDGE-5-qt/318624581",
  ]);
  const result = parseHomeDepotSearchPage(html, "https://www.homedepot.com/s/motor-oil");
  assert.equal(result.totalProducts, 2);
  assert.equal(result.pageSize, 2);
  assert.deepEqual(result.urls, [
    "https://www.homedepot.com/p/Pennzoil-Full-Synthetic-5-qt/318718731",
    "https://www.homedepot.com/p/Castrol-EDGE-5-qt/318624581",
  ]);
});

test("paginates until every reported product is discovered", async () => {
  const pages = new Map([
    ["0", page(0, 4, ["/p/Oil-A/111111111", "/p/Oil-B/222222222"])],
    ["2", page(2, 4, ["/p/Oil-B/222222222", "/p/Oil-C/333333333", "/p/Oil-D/444444444"])],
  ]);
  const result = await discoverHomeDepot(
    { retailer: "Home Depot", searchUrl: "https://www.homedepot.com/s/motor-oil", maxPages: 5 },
    async (url) => pages.get(new URL(url).searchParams.get("Nao") ?? "0"),
  );
  assert.equal(result.discoveredProducts, 4);
  assert.equal(result.complete, true);
  assert.equal(result.pages.length, 2);
});

test("turns discovered URLs into collector seeds", () => {
  const seed = seedFromHomeDepotUrl("https://www.homedepot.com/p/Pennzoil-Platinum-5W-30-Motor-Oil-5-Qt/300646438", { retailer: "Home Depot", seller: "Home Depot" });
  assert.equal(seed.product, "Pennzoil Platinum 5W 30 Motor Oil 5 Qt");
  assert.equal(seed.url.endsWith("300646438"), true);
});
