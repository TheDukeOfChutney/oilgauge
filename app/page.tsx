"use client";

import { useEffect, useMemo, useState } from "react";

type Offer = { brand:string; product:string; viscosity:string; oilType:string; specification:string; volumeLiters:number; containerLabel:string; retailer:string; seller:string; price:number; shipping:number; inStock:boolean; url:string; lastChecked:string };
type OfferFeed = { generatedAt?:string|null; offers?:Offer[] };
const FEED_URL = "https://raw.githubusercontent.com/TheDukeOfChutney/oilgauge/main/public/offers.json";

function ageLabel(value:string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value || "Not recorded";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return new Date(value).toLocaleDateString();
}

export default function Home() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [source, setSource] = useState<"loading"|"live"|"empty"|"error">("loading");
  const [generatedAt, setGeneratedAt] = useState("");
  const [viscosity, setViscosity] = useState("");
  const [oilType, setOilType] = useState("");
  const [specification, setSpecification] = useState("");
  const [brand, setBrand] = useState("All brands");
  const [retailer, setRetailer] = useState("All retailers");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sort, setSort] = useState("unit");

  useEffect(() => {
    fetch(`${FEED_URL}?t=${Date.now()}`, { cache:"no-store" }).then((response) => {
      if (!response.ok) throw new Error("feed unavailable");
      return response.json() as Promise<OfferFeed|Offer[]>;
    }).then((feed) => {
      const next = Array.isArray(feed) ? feed : (feed.offers ?? []);
      setOffers(next);
      if (next.length) {
        setViscosity(next[0].viscosity);
        setOilType(next[0].oilType);
        setSpecification(next[0].specification);
      }
      setGeneratedAt(Array.isArray(feed) ? "" : (feed.generatedAt ?? ""));
      setSource(next.length ? "live" : "empty");
    }).catch(() => setSource("error"));
  }, []);

  const choices = (field:keyof Offer) => [...new Set(offers.map((offer) => String(offer[field])).filter(Boolean))].sort();
  const results = useMemo(() => offers.filter((offer) =>
    (!viscosity || offer.viscosity === viscosity) && (!oilType || offer.oilType === oilType) &&
    (!specification || offer.specification === specification) && (brand === "All brands" || offer.brand === brand) &&
    (retailer === "All retailers" || offer.retailer === retailer) && (!inStockOnly || offer.inStock)
  ).sort((a,b) => sort === "price" ? (a.price+a.shipping)-(b.price+b.shipping) : sort === "newest" ? new Date(b.lastChecked).getTime()-new Date(a.lastChecked).getTime() : ((a.price+a.shipping)/a.volumeLiters)-((b.price+b.shipping)/b.volumeLiters)), [offers,viscosity,oilType,specification,brand,retailer,inStockOnly,sort]);
  const best = results[0] ? (results[0].price+results[0].shipping)/results[0].volumeLiters : null;
  const sourceLabel = source === "live" ? "Collector data" : source === "loading" ? "Loading prices" : source === "empty" ? "Awaiting first collection" : "Feed unavailable";

  return <main>
    <header className="topbar"><a className="brandmark" href="#top" aria-label="OilGauge home"><span className="gauge">◔</span><span>OilGauge</span></a><nav aria-label="Site information"><span className={`status ${source === "error" ? "offline" : ""}`}><i /> {sourceLabel}</span><a href="#method">How it works</a></nav></header>
    <div className="shell" id="top">
      <section className="hero"><p className="eyebrow">National · Shippable · Normalized</p><h1>Find the best motor oil deal</h1><p>Compare compatible oils across retailers using one honest measure: total price per liter.</p></section>
      <section className="searchPanel" aria-label="Oil requirements">
        <label>Viscosity<select value={viscosity} disabled={!offers.length} onChange={(e)=>setViscosity(e.target.value)}>{choices("viscosity").map((x)=><option key={x}>{x}</option>)}</select></label>
        <label>Oil type<select value={oilType} disabled={!offers.length} onChange={(e)=>setOilType(e.target.value)}>{choices("oilType").map((x)=><option key={x}>{x}</option>)}</select></label>
        <label>Specification<select value={specification} disabled={!offers.length} onChange={(e)=>setSpecification(e.target.value)}>{choices("specification").map((x)=><option key={x}>{x}</option>)}</select></label>
        <button className="primary" disabled={!offers.length} onClick={()=>document.getElementById("results")?.scrollIntoView({behavior:"smooth"})}>Compare prices</button>
      </section>
      {source !== "live" && source !== "loading" && <div className="notice"><strong>{source === "empty" ? "No verified prices yet." : "The price feed could not be loaded."}</strong> {source === "empty" ? "The collector is installed but has not produced its first successful result. No sample prices are being substituted." : "Try again later; stale prices are not being presented as current."}</div>}
      {source === "live" && generatedAt && <div className="feedTime">Price file generated {ageLabel(generatedAt)} · Verify the retailer checkout page.</div>}
      <section className="resultsCard" id="results">
        <div className="resultsHead"><div><span className="listIcon">≡</span><strong>{results.length} compatible {results.length === 1 ? "offer" : "offers"}</strong></div><div className="filters">
          <label><span>Brand</span><select value={brand} onChange={(e)=>setBrand(e.target.value)}><option>All brands</option>{choices("brand").map((x)=><option key={x}>{x}</option>)}</select></label>
          <label><span>Retailer</span><select value={retailer} onChange={(e)=>setRetailer(e.target.value)}><option>All retailers</option>{choices("retailer").map((x)=><option key={x}>{x}</option>)}</select></label>
          <label><span>Sort</span><select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="unit">Lowest $/L</option><option value="price">Lowest checkout</option><option value="newest">Recently checked</option></select></label>
        </div></div>
        <div className="stockRow"><label><input type="checkbox" checked={inStockOnly} onChange={(e)=>setInStockOnly(e.target.checked)} /> In-stock offers only</label><span>Shipping included where listed</span></div>
        <div className="table" role="table" aria-label="Motor oil offers"><div className="tableHeader" role="row"><span>Oil</span><span>Retailer</span><span>Container</span><span>Checkout</span><span>Price / L</span><span>Last checked</span><span /></div>
          {results.map((offer,index)=>{ const checkout=offer.price+offer.shipping; const unit=checkout/offer.volumeLiters; return <article className={`offer ${unit===best?"best":""}`} role="row" key={`${offer.retailer}-${offer.brand}-${index}`}>
            <div className="oilCell"><span className="bottle" aria-hidden="true">{offer.brand.slice(0,1)}</span><div><strong>{offer.brand} {offer.product}</strong><small>{offer.oilType}{unit===best&&<b>Best price</b>}</small></div></div>
            <div><strong>{offer.retailer}</strong><small>Sold by {offer.seller}</small></div><div><strong>{offer.containerLabel||`${offer.volumeLiters} L`}</strong><small>{offer.volumeLiters.toFixed(2)} L</small></div><div><strong>${checkout.toFixed(2)}</strong>{offer.shipping>0&&<small>incl. ${offer.shipping.toFixed(2)} shipping</small>}</div><div className="unit"><strong>${unit.toFixed(2)}/L</strong></div><div><span>{ageLabel(offer.lastChecked)}</span></div><div><a className="deal" href={offer.url} target="_blank" rel="noreferrer">View deal <span>›</span></a></div>
          </article>})}
          {!results.length&&<div className="empty"><strong>{source === "live" ? "No exact matches" : "No collected offers"}</strong><span>{source === "live" ? "Try different requirements or filters." : "Results will appear after the first successful scheduled collection."}</span></div>}
        </div>
      </section>
      <section className="method" id="method"><div><span className="step">1</span><h2>Choose requirements</h2><p>Select the viscosity, oil type, and specification your engine requires.</p></div><div><span className="step">2</span><h2>Compare like-for-like</h2><p>Container prices are converted to liters and listed shipping is included.</p></div><div><span className="step">3</span><h2>Verify the deal</h2><p>Open the retailer listing and confirm price, seller, availability, and compatibility.</p></div></section>
      <section className="sheetGuide"><div><p className="eyebrow">Automated price feed</p><h2>Collected on a schedule</h2><p>Retailer pages are checked outside your browser. Valid offers are normalized into a versioned JSON feed, then this page reads the newest successful file.</p></div><code>Retailer page → validate product → normalize volume → calculate $/L → publish offers.json</code></section>
    </div>
    <footer><span>OilGauge</span><p>Prices can change after verification. Confirm product approvals and final checkout price with the retailer.</p></footer>
  </main>;
}
