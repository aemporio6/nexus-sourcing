/* Lists (17 Nov 2026): table view, columns, column filters, sort, saved view keeps columns, export = columns, pin to Today, views in Search, ready views. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(800);
 await p.evaluate(()=>go("purchases"));await p.waitForTimeout(500);await p.click('[data-lctog="purchases"]');await p.waitForTimeout(500);
 const th=await p.evaluate(()=>[...document.querySelectorAll(".lct thead tr:first-child th")].map(x=>x.innerText));console.log(th.join(" | "));ok(th.length>=6,"table view with columns");
 const n0=await p.evaluate(()=>document.querySelectorAll(".lct tbody tr[data-open]").length);
 await p.click('[data-lcpick="purchases"]');await p.click('[data-lccol="ctn"]');await p.waitForTimeout(400);ok(await p.evaluate(()=>[...document.querySelectorAll(".lct thead tr:first-child th")].some(x=>/Cartons/.test(x.innerText))),"Columns: add Cartons");
 await p.fill("#lc_purchases_party","joyce");await p.waitForTimeout(600);const n1=await p.evaluate(()=>[...document.querySelectorAll(".lct tbody tr[data-open]")].map(r=>r.innerText));
 ok(n1.length>0&&n1.length<n0&&n1.every(t=>/joyce/i.test(t)),"filter on the Supplier column ("+n1.length+" of "+n0+")");ok(await p.evaluate(()=>document.activeElement?.id==="lc_purchases_party"),"cursor stays in the filter box");
 await p.fill("#lc_purchases_owing",">1000");await p.waitForTimeout(600);const n2=await p.evaluate(()=>document.querySelectorAll(".lct tbody tr[data-open]").length);ok(n2<=n1.length,"number filter > 1000 ("+n2+")");
 await p.click('[data-lcsort="date"]');await p.waitForTimeout(400);ok(/date_/.test(await p.evaluate(()=>F("purchases").tsort)),"click a title sorts");
 ok(/cols=/.test(await p.evaluate(()=>location.hash))&&/tbl=1/.test(await p.evaluate(()=>location.hash)),"the address keeps table + columns (new tab / bookmark)");
 /* save the view */
 await p.evaluate(()=>{const i=document.getElementById("svname");if(i)i.value="Joyce owing table"});const hasSv=await p.$("#svname");if(hasSv){await p.evaluate(()=>document.querySelector('[data-act="saveview"]').click());await p.waitForTimeout(600)}else await p.evaluate(async()=>{const id="v_"+nid();await writeDoc("views",id,{id,page:"purchases",name:"Joyce owing table",f:{...F("purchases")},by:uid},"v")});
 const sv=await p.evaluate(()=>live(D.views).find(v=>v.name==="Joyce owing table"));ok(sv&&sv.f.tbl&&sv.f.cols&&sv.f.c_party,"saved view keeps table, columns and column filters");
 /* export */
 const [dl]=await Promise.all([p.waitForEvent("download"),p.evaluate(()=>document.querySelector('[data-act="exportviewcsv"]').click())]);const txt=require("fs").readFileSync(await dl.path(),"utf8");const lines=txt.trim().split(/\r?\n/);
 ok(/Cartons/.test(lines[0])&&lines.length-1===n2,"export = the same columns and rows ("+(lines.length-1)+")");
 /* pin + Today + Search */
 await p.evaluate(()=>{S.f.purchases={...live(D.views).find(v=>v.name==="Joyce owing table").f};render()});await p.waitForTimeout(400);await p.click("[data-lcpin]");await p.waitForTimeout(500);
 await p.evaluate(()=>go("home"));await p.waitForTimeout(600);ok(/Joyce owing table/.test(await p.evaluate(()=>$(".lcpins")?.innerText||"")),"pinned view on Today with its count");
 await p.fill("#q","joyce ow");await p.waitForTimeout(700);ok(await p.evaluate(()=>!!document.querySelector("#sugg .lcsv")),"saved view comes up in Search");
 /* ready-made views */
 await p.waitForTimeout(5500);const rv=await p.evaluate(()=>live(D.views).filter(v=>v.ready).map(v=>v.name));console.log(rv.join(", "));ok(rv.includes("Waiting for approval")&&rv.includes("On the way"),"ready-made views made once");
 await p.evaluate(()=>{go("payments");S.f.payments={tbl:1};render()});await p.waitForTimeout(400);ok(await p.evaluate(()=>document.querySelectorAll(".lct").length===1),"Payments table too");
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>render());await p.waitForTimeout(400);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=392),"phone: table scrolls inside, page does not");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
