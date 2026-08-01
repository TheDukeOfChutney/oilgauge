import { readFile,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractOffer } from "./extract.mjs";

const root=resolve(import.meta.dirname,"..");
const products=JSON.parse(await readFile(resolve(root,"collector/products.json"),"utf8"));
async function fetchProduct(seed){
  const response=await fetch(seed.url,{redirect:"follow",headers:{accept:"text/html,application/xhtml+xml","accept-language":"en-US,en;q=0.9","user-agent":"OilGauge-MVP/0.1 (+low-frequency price comparison check)"},signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return extractOffer(await response.text(),seed);
}
const offers=[],errors=[];
for(const seed of products.filter((item)=>item.enabled)){
  try{offers.push(await fetchProduct(seed));}catch(error){errors.push({retailer:seed.retailer,url:seed.url,error:error instanceof Error?error.message:String(error)});}
  await new Promise((done)=>setTimeout(done,1500));
}
await writeFile(resolve(root,"public/offers.json"),`${JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),offers,errors},null,2)}\n`);
console.log(`Collected ${offers.length} offers; ${errors.length} errors`);
if(products.some((item)=>item.enabled)&&offers.length===0) process.exitCode=1;
