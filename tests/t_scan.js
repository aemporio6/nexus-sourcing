/* barcode scan logic (no camera): find by EAN/SKU, fill lines (demo on :8093)  node tests/t_scan.js */
const {chromium}=require("playwright");(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const r=await p.evaluate(async()=>{const pr=D.products.find(x=>x.ean)||D.products[0];const ean=String([].concat(pr.ean||"").join(",")).split(/[,\s;]+/)[0];openForm("receive",{});await new Promise(z=>setTimeout(z,300));const has=!!document.querySelector('[data-act="scan"]');
  scanApply(pr.sku);scanApply(pr.sku);if(ean)scanApply(ean);scanApply("0000000000000");const rows=rowsOf("lines").filter(x=>x.sku);return{has,sku:pr.sku,ean,rows,found:scanFind(pr.sku)?.sku,foundEan:ean?scanFind(ean)?.sku:"n/a",none:scanFind("0000000000000")}});
 ok(r.has,"📷 Scan button on the receive form");ok(r.found===r.sku&&(r.foundEan==="n/a"||r.foundEan===r.sku)&&r.none===null,"finds by SKU and EAN, unknown → null ("+r.ean+")");
 ok(r.rows.length===1&&r.rows[0].sku===r.sku&&+r.rows[0].q===(r.ean?3:2),"repeat scans add +1 pack to the same line: "+JSON.stringify(r.rows));
 ok(!errs.length,"no page errors "+JSON.stringify(errs));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
