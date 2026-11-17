/* Item 1 (17 Nov 2026): more on an order than it owes is stopped (Set to what is owed / It is an advance);
   more packs on a shipment than left to ship is stopped (Set to what is left / Extra goods sent); live "owed" line. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const po=await p.evaluate(()=>{const x=live(D.purchases).find(p=>{try{const s=poState(p);return s.outstandingCur>100&&p.cur==="RMB"}catch(_){return false}});return x&&{no:x.no,party:x.party,owed:poState(x).outstandingCur}});console.log(po);
 ok(!!po,"an order that still owes money");
 await p.evaluate(po=>openForm("payment",{party:po.party,ref:po.no}),po);await p.waitForTimeout(1200);
 await p.evaluate(po=>{setv("party",po.party);syncPayParty&&syncPayParty();const rows=S.drawer.rows.allocations;if(!rows.length)rows.push({});rows[0].ref=po.no;redrawRows("allocations");setv("amount",Math.round(po.owed+500));setv("cur","RMB");setv("type",items("payType")[0]?.id||"deposit");syncPay()},po);
 await p.waitForTimeout(600);await p.evaluate(()=>ovLive());const live1=await p.evaluate(()=>$(".ovlive")?.innerText||"");console.log("live:",live1);ok(/too much/.test(live1),"live line says too much");
 await p.evaluate(()=>savePay());await p.waitForTimeout(700);
 const box=await p.evaluate(()=>!!$(".ovbox [data-ov='fix']"));ok(box,"save stopped with Set to what is owed / advance");
 await p.click(".ovbox [data-ov='adv']");await p.waitForTimeout(200);ok(await p.evaluate(()=>!!$(".ovbox")),"advance without a reason is refused");
 await p.fill(".ovbox input[id^='ov_why_']","advance for next order, agreed with Joyce");await p.click(".ovbox [data-ov='adv']");await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!!S.drawer.rows.allocations[0].adv?.why),"advance reason kept on the line");
 /* fix path */
 await p.evaluate(()=>{delete S.drawer.rows.allocations[0].adv});await p.evaluate(()=>savePay());await p.waitForTimeout(600);await p.click(".ovbox [data-ov='fix']");await p.waitForTimeout(400);
 const amt=await p.evaluate(()=>+val("amount"));ok(Math.abs(amt-po.owed)<1,"Set to what is owed → "+amt);
 /* shipment */
 const sl=await p.evaluate(()=>{const x=live(D.purchases).find(p=>(p.lines||[]).some(l=>l.sku&&+l.q>0)&&p.status!=="cancelled");const l=x.lines.find(l=>l.sku&&+l.q>0);return{po:x.no,sku:l.sku,q:+l.q,left:Math.max(0,(x.lines||[]).filter(y=>y.sku===l.sku).reduce((a,y)=>a+(+y.q||0),0)-shippedQty(x.no,l.sku))}});console.log(sl);
 await p.evaluate(()=>{S.drawer.dirty=false;S.drawer=null;openForm("shipment",{})});await p.waitForTimeout(1200);
 await p.evaluate(sl=>{const r=S.drawer.rows.lines;if(!r.length)r.push({});Object.assign(r[0],{po:sl.po,sku:sl.sku,q:sl.left+50});redrawRows("lines")},sl);await p.waitForTimeout(300);
 const v=await p.evaluate(()=>{const o=collect("shipment");return validateShip(o)});ok(/left to ship/.test(v.errors.lines||""),"shipment: too many packs stopped");
 await p.evaluate(()=>showErrors(validateShip(collect("shipment")).errors,[]));await p.waitForTimeout(200);await p.click(".ovbox [data-ov='fix']");await p.waitForTimeout(300);
 ok(await p.evaluate(sl=>+S.drawer.rows.lines[0].q===sl.left,sl),"Set to what is left → "+sl.left);
 /* health */
 ok(await p.evaluate(()=>healthRun(true).rules.some(r=>r.k==="overpay")),"Data health has the over-paid check");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
