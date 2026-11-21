/* Stock page says why it is empty and offers the fix (21 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:"+(process.env.PORT||8093)+"/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(5000);
 await p.evaluate(()=>go("stock"));await p.waitForTimeout(900);const f=await p.evaluate(()=>{const f=swFacts();return{rec:f.rec,ready:f.ready.map(x=>x.s.no),bare:f.bare.length,onHand:f.onHand}});
 ok(f.onHand===0&&await p.evaluate(()=>/Why is the stock empty\?/.test(document.getElementById("swcard")?.innerText||"")&&/Goods received documents now: 0/.test(document.getElementById("swcard").innerText)),"empty stock: the page says why (stock comes from Goods received; there are none)");
 ok(f.bare>10&&await p.evaluate(()=>/carry no products/.test(document.getElementById("swcard").innerText)&&!!document.querySelector('#swcard [data-k="count"]')),"old delivered shipments without products are explained, with Stock count / Import as the way to start");
 if(f.ready.length){await p.click("#swcard [data-act=receive]");await p.waitForTimeout(1200);
  ok(await p.evaluate(no=>S.drawer?.form==="receive"&&document.querySelector("#f_src")?.value===no&&rowsOf("lines").length>0,f.ready[0]),"an arrived shipment with products: Receive into stock opens the form filled with its products");
  await p.evaluate(()=>{rowsOf("lines").forEach(r=>{if(!r.loc)r.loc=(SET().locations||[]).find(l=>!l.archived)?.id})});await p.click('[data-act="save"]');await p.waitForTimeout(2500);await p.evaluate(()=>{S.drawer=null;go("stock")});await p.waitForTimeout(900);
  const g=await p.evaluate(()=>{const f=swFacts();return{rec:f.rec,onHand:f.onHand,ready:f.ready.map(x=>x.s.no),title:document.querySelector("#swcard h2")?.innerText||""}});
  ok(g.rec===1&&g.onHand>0&&!g.ready.includes(f.ready[0]),"after receiving: the products are in stock and that shipment left the card "+JSON.stringify(g))}
 ok(errs.length===0,"no page errors"+(errs.length?": "+errs.slice(0,3).join(" | "):""));
 await b.close();console.log(fails?`\n${fails} FAILED`:"\nALL PASS");process.exit(fails?1:0)})();
