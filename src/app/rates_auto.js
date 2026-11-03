/* ---------- Exchange rates: fetched by themselves once a day (European Central Bank rates via frankfurter.dev; fallback open.er-api.com)
   Saved in Setup › Rates as a dated row marked "auto". A rate typed by hand for the same date is never overwritten. ---------- */
const RATE_MAP={RMB:"CNY",USD:"USD",EUR:"EUR",CAD:"CAD",HKD:"HKD",AED:"AED",PKR:"PKR",INR:"INR"};
async function fetchRates(){const want=[...new Set(items("currency",{all:true}).map(c=>c.id).filter(c=>c!=="GBP"&&RATE_MAP[c]))];if(!want.length)return null;const sy=want.map(c=>RATE_MAP[c]);
 const tryJ=async u=>{const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),12000);try{const r=await fetch(u,{signal:ctl.signal});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(t)}};
 let date=null,rates=null,src="";
 try{const j=await tryJ("https://api.frankfurter.dev/v1/latest?base=GBP&symbols="+sy.join(","));if(j&&j.rates){date=j.date;rates=j.rates;src="European Central Bank (frankfurter.dev)"}}catch(_){}
 if(!rates){try{const j=await tryJ("https://open.er-api.com/v6/latest/GBP");if(j&&j.rates){date=new Date((j.time_last_update_unix||Date.now()/1000)*1000).toISOString().slice(0,10);rates=j.rates;src="open.er-api.com"}}catch(_){}}
 if(!rates||!date)return null;const row={date,auto:true,note:`auto · ${src} · 1 £ = ${want.filter(c=>rates[RATE_MAP[c]]).map(c=>`${rates[RATE_MAP[c]]} ${c}`).join(", ")}`};
 want.forEach(c=>{const v=+rates[RATE_MAP[c]];if(v>0)row[c]=+(1/v).toFixed(6)});return row}
async function autoRates(force){try{if(!S.ready||!can("setup"))return;if(window.MYTOOL&&MYTOOL.demo&&!force)return;const key="mt_rates_day";const day=today();if(!force){try{if(localStorage.getItem(key)===day)return}catch(_){}}
 const row=await fetchRates();if(!row){if(force)toast("Could not get rates online — add them in Setup › Rates");return}
 const hist=(SET().rates&&SET().rates.history)||[];const same=hist.findIndex(r=>r&&r.date===row.date);
 if(same>=0&&!hist[same].auto){if(force)toast(`A rate for ${fmtD(row.date)} was typed by hand — kept`);try{localStorage.setItem(key,day)}catch(_){}return}
 const next=hist.slice();if(same>=0)next[same]=row;else next.push(row);next.sort((a,b)=>(a.date||"")<(b.date||"")?-1:1);
 await setupPatchMany([[["rates","history"],next]],null,{noUndo:true});logEv("setup","setup","main",`Exchange rates ${fmtD(row.date)} fetched: ${row.note}`);try{localStorage.setItem(key,day)}catch(_){}
 S._att=null;if(force){toast(`Rates for ${fmtD(row.date)} saved`);render()}}catch(e){console.warn(e);if(force)toast("Could not get rates: "+(e.message||e))}}
setTimeout(function tick(){try{if(S.ready){autoRates();setInterval(()=>autoRates(),3*3600e3);return}}catch(_){}setTimeout(tick,1500)},4000);
document.addEventListener("click",e=>{const b=e.target.closest('[data-act="ratesnow"]');if(!b)return;e.stopPropagation();autoRates(true)},true);
