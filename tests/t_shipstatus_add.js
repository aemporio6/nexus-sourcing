/* Shipment status vs receipts + visible "＋ Add" on fields (18 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 /* ---- 1) a receipt on a shipment still on its way ---- */
 const r=await p.evaluate(async()=>{const s=live(D.shipments).find(x=>["in_transit","booked"].includes(x.status)&&shipLinesExpanded(x).some(l=>l.sku));if(!s)return null;
  const lines=shipLinesExpanded(s).filter(l=>l.sku).map(l=>({sku:l.sku,po:l.po,q:+l.q||0,damaged:0,loc:s.deliverTo||leafLocs()[0]?.[0]}));const no=nextNo("receipts",today());await writeDoc("receipts",no,{no,id:no,src:s.no,date:today(),lines},"test receipt");await recomputeShipment(s.no,"t");return{sh:s.no,rc:no}});
 ok(!!r,"found an in-transit shipment and received goods on it");
 ok(await p.evaluate(r=>["delivered","part_delivered"].includes(docOf("shipments",r.sh).status),r),"automatic rule marks it delivered (the owner's case)");
 await p.evaluate(r=>openDoc("shipments",r.sh),r);await p.waitForTimeout(600);
 ok(await p.evaluate(r=>(document.querySelector(".drawer")?.innerText||"").includes(r.rc)&&!!document.querySelector("[data-ss-undo]"),r),"shipment record says WHY delivered + Undo button");
 await p.evaluate(r=>openForm("shipment",{edit:docOf("shipments",r.sh),force:true}),r);await p.waitForTimeout(800);
 await p.evaluate(()=>{setv("status","in_transit")});await p.evaluate(()=>saveShip());await p.waitForTimeout(500);
 ok(await p.evaluate(()=>/cannot be/.test($("#err_status")?.innerText||"")&&!!$("#fw_status .ssbox [data-ss-undo]")),"saving In transit is stopped with the reason + Undo");
 await p.click("#fw_status .ssbox [data-ss-undo]");await p.waitForTimeout(900);
 ok(await p.evaluate(r=>!live(D.receipts).some(x=>x.no===r.rc),r),"Undo moved the receipt to Trash");
 await p.evaluate(()=>{setv("status","in_transit");S.drawer.ack=true});await p.evaluate(()=>saveShip());await p.waitForTimeout(900);
 ok(await p.evaluate(r=>docOf("shipments",r.sh).status==="in_transit",r),"now In transit saves and stays");
 /* receive form warns when goods are still on the way */
 const w=await p.evaluate(r=>{S.drawer=null;openForm("receive",{force:true,sh:r.sh});return new Promise(res=>setTimeout(()=>{setv("src",r.sh);try{syncReceive(true)}catch(_){}const o=collect("receive");res(validateReceive(o).warnings.join(" "))},700))},r);
 ok(/really here/.test(w),"Receive form asks 'are these goods really here?'");
 /* ---- 2) visible ＋ Add on fields ---- */
 await p.evaluate(()=>{S.drawer=null;openForm("product",{force:true})});await p.waitForTimeout(700);
 ok(await p.evaluate(()=>!!$('#fw_brand .fadd')&&!!$('#fw_category .fadd')),"product: Brand and Category show ＋ Add");
 ok(await p.evaluate(()=>!!$('#fw_material .fadd[data-how="__pick"]')&&[...document.querySelectorAll("#dl_material option")].some(o=>o.value==="Cotton")),"product: Material has ▾ suggestions from day one");
 await p.click('#fw_brand .fadd');await p.waitForTimeout(300);ok(await p.evaluate(()=>!$("#inl_brand").hidden&&!!$("#inl_in_brand")),"＋ Add on Brand opens the add box");
 await p.fill("#inl_in_brand","Testbrand Zeta");await p.click('#inl_brand [data-act="inladd"]');await p.waitForTimeout(700);
 ok(await p.evaluate(()=>L("brand",val("brand"))==="Testbrand Zeta"),"new brand added and picked");
 ok(await p.evaluate(()=>!!$('#fw_tags .fadd')),"Tags show ＋ Add tag");
 await p.click('#fw_tags .fadd');await p.fill("#amtag_in","Hot item");await p.keyboard.press("Enter");await p.waitForTimeout(700);
 ok(await p.evaluate(()=>[...$("#f_tags").selectedOptions].some(o=>o.textContent==="Hot item")),"new tag added and ticked");
 /* inspection: Purchase picker → ＋ New order → back with it picked */
 await p.evaluate(()=>{S.drawer=null;openForm("inspection",{force:true})});await p.waitForTimeout(700);
 ok(await p.evaluate(()=>!!$('#f_po option[value="__newdoc"]')&&!!$('#fw_po .fadd')),"inspection: order picker has ＋ New order");
 await p.evaluate(()=>{const s=$("#f_po");s.value="__newdoc";s.dispatchEvent(new Event("change",{bubbles:true}))});await p.waitForTimeout(800);
 ok(await p.evaluate(()=>S.drawer?.form==="purchase"&&!!S.drawer.ctx.returnTo),"＋ New order opens the order form (and will come back)");
 const po=await p.evaluate(()=>new Promise(res=>{const st=S.drawer.ctx.returnTo;const src=live(D.purchases).find(x=>(x.lines||[]).length);const no=nextNo("purchases",today());writeDoc("purchases",no,{...src,no,id:no,date:today(),status:"ordered"},"t").then(()=>{S.drawer=null;restoreStash(st.stash,()=>applyReturn(st,no));setTimeout(()=>res(no),600)})}));
 ok(await p.evaluate(po=>S.drawer?.form==="inspection"&&val("po")===po,po),"back on the inspection with the new order picked");
 /* shipment lines + UK costs */
 await p.evaluate(()=>{S.drawer=null;openForm("shipment",{force:true})});await p.waitForTimeout(800);
 ok(await p.evaluate(()=>{addRow("lines");return!!document.querySelector('[data-row="lines"][data-k="po"] option[value="__newdoc"]')}).catch(()=>false),"shipment line: order picker has ＋ New order");
 /* receive: from */
 await p.evaluate(()=>{S.drawer=null;openForm("receive",{force:true})});await p.waitForTimeout(700);ok(await p.evaluate(()=>!!$('#f_src option[value="__newdoc"]')),"receive: ＋ New shipment in the From list");
 /* no stored value is ever __newdoc */
 ok(await p.evaluate(()=>!JSON.stringify(D).includes("__newdoc")),"nothing saved as __newdoc");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
