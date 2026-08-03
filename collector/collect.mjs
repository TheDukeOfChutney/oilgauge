import { readFile,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractOffer } from "./extract.mjs";
import { mergeCollection } from "./feed.mjs";
import { discoverHomeDepot, seedFromHomeDepotUrl } from "./discover.mjs";

const root=resolve(import.meta.dirname,"..");
const config=JSON.parse(await readFile(resolve(root,"collector/products.json"),"utf8"));
const feedPath=resolve(root,"public/offers.json");
const discoveryPath=resolve(root,"public/discovery.json");
const previousFeed=JSON.parse(await readFile(feedPath,"utf8"));
const headers={accept:"text/html,application/xhtml+xml","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"};
async function fetchHtml(url){
  const response=await fetch(url,{redirect:"follow",headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
async function fetchProduct(seed){
  const html=await fetchHtml(seed.url);
  try { return extractOffer(html,seed); }
  catch (error) {
    const title=html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0,120)||"none";
    const diagnostics=`html=${html.length} nextData=${html.includes("__NEXT_DATA__")} jsonLd=${/application\/ld\+json/i.test(html)} challenge=${/captcha|robot or human|blocked request|verify your identity/i.test(html)} title=${title}`;
    throw new Error(`${error instanceof Error?error.message:String(error)} [${diagnostics}]`);
  }
}
const discoveryRuns=[];
const products=[...(config.products??[])];
for(const discovery of (config.discoveries??[]).filter((item)=>item.enabled)){
  if(discovery.adapter!=="home-depot-search") continue;
  const result=await discoverHomeDepot(discovery,async(url)=>{
    const html=await fetchHtml(url);
    await new Promise((done)=>setTimeout(done,500));
    return html;
  });
  discoveryRuns.push(result);
  products.push(...result.urls.map((url)=>seedFromHomeDepotUrl(url,discovery)));
}
const uniqueProducts=[...new Map(products.filter((item)=>item.enabled).map((item)=>[item.url,item])).values()];
const attemptedAt=new Date().toISOString();
await writeFile(discoveryPath,`${JSON.stringify({schemaVersion:1,attemptedAt,runs:discoveryRuns},null,2)}\n`);
console.log(`Discovery complete: ${uniqueProducts.length} unique products across ${discoveryRuns.reduce((sum,run)=>sum+run.pages.length,0)} pages`);
const offers=[],errors=[];
for(const run of discoveryRuns.filter((item)=>item.discoveredProducts===0)){
  for(const oldOffer of (previousFeed.offers??[]).filter((offer)=>offer.retailer===run.retailer)) errors.push({retailer:run.retailer,url:oldOffer.url,error:`Discovery failed: ${run.pages.at(-1)?.error??"no products found"}`});
}
let nextProduct=0;
async function collectWorker(){
  while(nextProduct<uniqueProducts.length){
    const index=nextProduct++;
    const seed=uniqueProducts[index];
    try{offers.push(await fetchProduct(seed));}catch(error){errors.push({retailer:seed.retailer,url:seed.url,error:error instanceof Error?error.message:String(error)});}
    if((index+1)%12===0||index+1===uniqueProducts.length) console.log(`Checked ${index+1}/${uniqueProducts.length} product pages`);
    await new Promise((done)=>setTimeout(done,300));
  }
}
await Promise.all(Array.from({length:Math.min(4,uniqueProducts.length)},()=>collectWorker()));
await writeFile(feedPath,`${JSON.stringify(mergeCollection(previousFeed,offers,errors,attemptedAt),null,2)}\n`);
console.log(`Discovered ${uniqueProducts.length} products; collected ${offers.length} offers; ${errors.length} errors`);
if(uniqueProducts.length===0||offers.length===0) process.exitCode=1;
