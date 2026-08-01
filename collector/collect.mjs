import { readFile,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractOffer } from "./extract.mjs";

const root=resolve(import.meta.dirname,"..");
const products=JSON.parse(await readFile(resolve(root,"collector/products.json"),"utf8"));
async function fetchProduct(seed){
  const response=await fetch(seed.url,{redirect:"follow",headers:{accept:"text/html,application/xhtml+xml","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"},signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const html=await response.text();
  try { return extractOffer(html,seed); }
  catch (error) {
    const title=html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0,120)||"none";
    const diagnostics=`html=${html.length} nextData=${html.includes("__NEXT_DATA__")} jsonLd=${/application\/ld\+json/i.test(html)} challenge=${/captcha|robot or human|blocked request|verify your identity/i.test(html)} title=${title}`;
    throw new Error(`${error instanceof Error?error.message:String(error)} [${diagnostics}]`);
  }
}
const offers=[],errors=[];
for(const seed of products.filter((item)=>item.enabled)){
  try{offers.push(await fetchProduct(seed));}catch(error){errors.push({retailer:seed.retailer,url:seed.url,error:error instanceof Error?error.message:String(error)});}
  await new Promise((done)=>setTimeout(done,1500));
}
await writeFile(resolve(root,"public/offers.json"),`${JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),offers,errors},null,2)}\n`);
console.log(`Collected ${offers.length} offers; ${errors.length} errors`);
if(products.some((item)=>item.enabled)&&offers.length===0) process.exitCode=1;
