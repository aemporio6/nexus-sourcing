/* Reports (17 Nov 2026): goods in transit, order status, supplier scorecard; rows open records; Excel; score on supplier page + new order. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 await p.evaluate(()=>go("reports"));await p.waitForTimeout(800);
 const r=await p.evaluate(()=>["r9t","r9o","r9s"].map(id=>({id,n:document.querySelectorAll("#"+id+" tbody tr[data-open]").length,sub:$("#"+id+" .card-h .status")?.innerText})));console.log(JSON.stringify(r));
 ok(r.every(x=>x.n>0),"three reports with rows");
 const t=await p.evaluate(()=>r9Transit().map(x=>x.s.status));ok(t.every(s=>!["delivered","cancelled"].includes(s)),"in transit = not delivered / cancelled");
 const o=await p.evaluate(()=>r9Orders().find(x=>x.p.no==="PO-26-0069"));ok(!o||o.ordered>=o.rec,"order status figures");
 await p.click("#r9o tbody tr[data-open]");await p.waitForTimeout(600);ok(await p.evaluate(()=>S.drawer&&S.drawer.col==="purchases"),"a row opens its order");
 await p.evaluate(()=>{S.drawer=null;render()});await p.waitForTimeout(300);const [dl]=await Promise.all([p.waitForEvent("download"),p.click('[data-r9x="r9s"]')]);ok(/supplier_scorecard/.test(dl.suggestedFilename()),"Excel export");
 const sc=await p.evaluate(()=>{const s=r9Scores()[0];return s});console.log(JSON.stringify(sc));ok(sc&&sc.orders>0,"scorecard worked out");
 await p.evaluate(c=>openDoc("parties",c),sc.code);await p.waitForTimeout(600);ok(await p.evaluate(()=>!!document.querySelector(".drawer .r9line")),"score on the supplier's page");
 await p.evaluate(()=>{S.drawer=null;openForm("purchase",{})});await p.waitForTimeout(900);await p.evaluate(c=>{const s=document.getElementById("f_party");s.value=c;s.dispatchEvent(new Event("change",{bubbles:true}))},sc.code);await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.querySelector("#fw_party .r9hint")),"score beside the supplier in a new order");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
