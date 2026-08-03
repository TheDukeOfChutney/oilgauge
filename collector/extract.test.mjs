import test from "node:test";
import assert from "node:assert/strict";
import { extractOffer } from "./extract.mjs";
import { mergeCollection } from "./feed.mjs";

const seed={url:"https://retailer.example/item",retailer:"Example",viscosity:"5W-30",oilType:"Full synthetic",specification:"API SQ / ILSAC GF-7A",volumeLiters:4.7318,containerLabel:"5 qt jug",shipping:0};

test("extracts and normalizes Product JSON-LD",()=>{
  const html=`<script type="application/ld+json">{"@type":"Product","name":"Platinum","brand":{"name":"Pennzoil"},"offers":{"price":"24.98","availability":"https://schema.org/InStock","url":"/oil"}}</script>`;
  const offer=extractOffer(html,seed,"2026-07-31T12:00:00Z");
  assert.equal(offer.price,24.98);
  assert.equal(offer.brand,"Pennzoil");
  assert.equal(offer.url,"https://retailer.example/oil");
  assert.equal(offer.inStock,true);
});

test("extracts Home Depot's numeric Product/Offer shape",()=>{
  const html=`<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Pennzoil Full Synthetic SAE 5W 30 Motor Oil 5 qt.","brand":{"@type":"Brand","name":"Pennzoil"},"offers":{"@type":"Offer","url":"https://www.homedepot.com/p/example/318718731","priceCurrency":"USD","price":25.70,"priceValidUntil":"8/1/2026"}}</script>`;
  const offer=extractOffer(html,{...seed,url:"https://www.homedepot.com/p/example/318718731",retailer:"Home Depot",seller:"Home Depot"},"2026-07-31T12:00:00Z");
  assert.equal(offer.price,25.70);
  assert.equal(offer.retailer,"Home Depot");
  assert.equal(offer.seller,"Home Depot");
});

test("derives oil metadata for discovered products",()=>{
  const html=`<script type="application/ld+json">{"@type":"Product","name":"Castrol EDGE 5W-30 Advanced Full Synthetic Motor Oil 5-qt.","brand":{"name":"Castrol"},"offers":{"price":"27.98"}}</script>`;
  const offer=extractOffer(html,{url:"https://www.homedepot.com/p/oil/123456789",retailer:"Home Depot",seller:"Home Depot",shipping:0});
  assert.equal(offer.brand,"Castrol");
  assert.equal(offer.viscosity,"5W-30");
  assert.equal(offer.oilType,"Full synthetic");
  assert.ok(Math.abs(offer.volumeLiters-4.73176473)<0.00001);
});

test("rejects pages without a verified positive price",()=>{
  const html=`<script type="application/ld+json">{"@type":"Product","name":"Oil","offers":{"@type":"Offer"}}</script>`;
  assert.throws(()=>extractOffer(html,seed),/No valid Product offer/);
});

test("classifies Home Depot products with null store pricing as unavailable",()=>{
  const html=`<script type="application/ld+json">{"@type":"Product","name":"Mobil 1","productID":"315125432"}</script><script>window.__APOLLO_STATE__={"pricing({\\"storeId\\":\\"8119\\"})":{"value":null,"original":null}}</script>`;
  assert.throws(
    ()=>extractOffer(html,{...seed,retailer:"Home Depot"}),
    /unavailable or unpriced for the current Home Depot store context/
  );
});

test("falls back to Walmart Next.js product state when JSON-LD omits offers",()=>{
  const state={props:{pageProps:{initialData:{data:{product:{name:"Test Oil",availabilityStatus:"IN_STOCK",sellerDisplayName:"Walmart.com",priceInfo:{currentPrice:{price:31.97}}}}}}}};
  const html=`<script type="application/ld+json">{"@type":"Product","name":"Test Oil"}</script><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`;
  const offer=extractOffer(html,{...seed,retailer:"Walmart"},"2026-07-31T12:00:00Z");
  assert.equal(offer.price,31.97);
  assert.equal(offer.seller,"Walmart.com");
  assert.equal(offer.inStock,true);
});

test("retains last known good offers and exposes a failed refresh",()=>{
  const attemptedAt="2026-08-01T16:00:00Z";
  const oldOffer={...seed,product:"Previously verified oil",brand:"Pennzoil",price:25.70,lastChecked:"2026-07-31T12:00:00Z"};
  const error={retailer:"Example",url:seed.url,error:"HTTP 403"};
  const feed=mergeCollection({offers:[oldOffer]},[],[error],attemptedAt);
  assert.equal(feed.offers.length,1);
  assert.equal(feed.offers[0].price,25.70);
  assert.equal(feed.offers[0].lastChecked,"2026-07-31T12:00:00Z");
  assert.equal(feed.offers[0].refreshStatus,"failed");
  assert.equal(feed.offers[0].lastError,"HTTP 403");
  assert.deepEqual(feed.collection,{attemptedAt,succeeded:0,failed:1,retained:1,status:"failed"});
});
