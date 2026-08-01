import test from "node:test";
import assert from "node:assert/strict";
import { extractOffer } from "./extract.mjs";

test("extracts and normalizes Product JSON-LD",()=>{
  const html=`<script type="application/ld+json">{"@type":"Product","name":"Platinum","brand":{"name":"Pennzoil"},"offers":{"price":"24.98","availability":"https://schema.org/InStock","url":"/oil"}}</script>`;
  const seed={url:"https://retailer.example/item",retailer:"Example",viscosity:"5W-30",oilType:"Full synthetic",specification:"API SP",volumeLiters:4.7318,containerLabel:"5 qt jug",shipping:0};
  const offer=extractOffer(html,seed,"2026-07-31T12:00:00Z");
  assert.equal(offer.price,24.98); assert.equal(offer.brand,"Pennzoil"); assert.equal(offer.url,"https://retailer.example/oil"); assert.equal(offer.inStock,true);
});
