/* Item 6 (17 Nov 2026): freight shared by the chosen basis; receipt FINAL; change after FINAL waits; alerts. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>fields("shipment").some(f=>f.k==="freightBasis")),"shipment form has 'Share freight by'");
 const sh=await p.evaluate(()=>{const s=live(D.shipments).find(s=>freightSplit(s).rows.length>1&&freightSplit(s).rows.every(r=>r.g>0&&r.q>0));if(!s)return null;const a=freightSplit(s);const o=s.freightBasis;s.freightBasis="qty";const q=freightSplit(s);s.freightBasis="value";const v=freightSplit(s);s.freightBasis=o;return{no:s.no,auto:a.basis,q:q.basis,qs:q.rows.map(r=>r.share.toFixed(3)),qq:q.rows.map(r=>r.q),v:v.basis}});console.log(sh);
 ok(sh&&sh.q==="qty"&&sh.v==="value","chosen basis is used (qty / value)");
 let rc=await p.evaluate(()=>{const r=live(D.receipts).find(r=>(r.lines||[]).some(l=>l.sku&&+l.landed>0));return r&&r.no});
 if(!rc)rc=await p.evaluate(async sno=>{const s=docOf("shipments",sno);const ls=shipLinesExpanded(s).filter(l=>l.sku).map(l=>({sku:l.sku,po:l.po,q:+l.q,loc:DEF().receiveLoc}));const no=nextNo("receipts",today());const r={no,id:no,src:sno,date:today(),loc:DEF().receiveLoc,lines:ls,dutyGbp:200,vatGbp:0,ukExtraGbp:0};const lps=receiptLanded(r);r.lines=ls.map((l,i)=>({...l,landed:lps[i].total}));await writeDoc("receipts",no,r,"test receipt");return no},sh.no);ok(!!rc,"a receipt with landed £: "+rc);
 await p.evaluate(no=>openDoc("receipts",no),rc);await p.waitForTimeout(800);
 ok(await p.evaluate(()=>/Landed cost: estimate/.test($(".lfbox")?.innerText||"")),"receipt shows Landed cost: estimate + checklist");
 await p.click('[data-lf="final"]');await p.waitForTimeout(1200);
 const f=await p.evaluate(no=>({fin:!!docOf("receipts",no).landedFinal,l:docOf("receipts",no).lines.filter(l=>l.sku).map(l=>l.landed)}),rc);ok(f.fin,"made FINAL");
 /* a cost changes: duty doubled → recompute must not move the lines */
 await p.evaluate(async no=>{const r=docOf("receipts",no);await updateDoc("receipts",no,{dutyGbp:(+r.dutyGbp||0)+500},"duty changed");await recomputeLanded(no,"test","duty changed")},rc);await p.waitForTimeout(800);
 const g=await p.evaluate(no=>({l:docOf("receipts",no).lines.filter(l=>l.sku).map(l=>l.landed),pend:docOf("receipts",no).landedPending}),rc);
 ok(JSON.stringify(g.l)===JSON.stringify(f.l)&&g.pend&&g.pend.lines.length,"after FINAL the figures stay; change waits ("+(g.pend?.lines.length)+" lines)");
 await p.evaluate(no=>{S.drawer=null;openDoc("receipts",no)},rc);await p.waitForTimeout(600);
 await p.click('[data-lf="accept"]');await p.waitForTimeout(300);ok(await p.evaluate(no=>!!docOf("receipts",no).landedPending,rc),"accept without reason refused");
 await p.fill("#lf_why","late duty bill");await p.click('[data-lf="accept"]');await p.waitForTimeout(900);
 const h=await p.evaluate(no=>{const r=docOf("receipts",no);return{pend:r.landedPending,adj:(r.landedAdj||[]).length,l:r.lines.filter(l=>l.sku).map(l=>l.landed)}},rc);ok(!h.pend&&h.adj===1&&JSON.stringify(h.l)!==JSON.stringify(f.l),"adjustment applied and kept in history");
 ok(await p.evaluate(()=>Array.isArray(attention())),"alerts still work");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
