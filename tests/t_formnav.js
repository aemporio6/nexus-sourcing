/* Form + record navigation bar (Back / Forward / Undo / Redo / Reset / Refresh / Recent), Close returns to the record,
   text-field suggestions, and the shipment "Rate is per" CBM / kg choice.  Demo build on :8093.   node tests/t_formnav.js */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo#/shipments");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 const sh=await p.evaluate(()=>{const s=live(D.shipments)[0];return s&&s.no});ok(!!sh,"demo shipment: "+sh);
 await p.evaluate(no=>openDoc("shipments",no),sh);await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.querySelector('.drawer .fn-bar [data-act="fnback"]')&&!!document.querySelector('.drawer [data-act="fnrefresh"]')&&!!document.querySelector('.drawer .fn-rec')),"record drawer has Back / Undo / Redo / Refresh / Recent");
 await p.evaluate(no=>editDoc("shipments",no),sh);await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>S.drawer?.form==="shipment"&&!!document.querySelector('.drawer [data-act="fnundo"]')&&!!document.querySelector('.drawer [data-act="fnreset"]')),"edit form has the same bar (+ Reset)");
 /* typing → undo → redo */
 const before=await p.evaluate(()=>val("goods")||"");
 await p.fill("#f_goods","Test goods A");await p.waitForTimeout(700);await p.fill("#f_goods","Test goods B");await p.waitForTimeout(700);
 await p.click('.drawer [data-act="fnundo"]');await p.waitForTimeout(300);const u1=await p.evaluate(()=>val("goods"));
 await p.click('.drawer [data-act="fnundo"]');await p.waitForTimeout(300);const u2=await p.evaluate(()=>val("goods"));
 await p.click('.drawer [data-act="fnredo"]');await p.waitForTimeout(300);const r1=await p.evaluate(()=>val("goods"));
 ok(u1==="Test goods A"&&u2===before&&r1==="Test goods A","undo / undo / redo in the form: "+JSON.stringify([u1,u2,r1]));
 /* rate per kg vs per CBM */
 await p.fill("#f_kg","120");await p.dispatchEvent("#f_kg","input");await p.fill("#f_cbm","1.5");await p.dispatchEvent("#f_cbm","input");await p.waitForTimeout(500);const kgcbm=[120,1.5];
 await p.selectOption("#f_rateBasis","kg");await p.fill("#f_rate","2");await p.dispatchEvent("#f_rate","input");await p.waitForTimeout(600);const cKg=await p.evaluate(()=>+val("cost"));const chKg=await p.evaluate(()=>chargeable({mode:val("mode"),kg:val("kg"),cbm:val("cbm"),rateBasis:"kg"}).value);
 await p.selectOption("#f_rateBasis","cbm");await p.dispatchEvent("#f_rateBasis","change");await p.fill("#f_rate","100");await p.dispatchEvent("#f_rate","input");await p.waitForTimeout(600);const cCbm=await p.evaluate(()=>+val("cost"));
 const hint=await p.evaluate(()=>$("#formhint").textContent);
 ok(Math.abs(cKg-2*chKg)<0.02&&chKg>=kgcbm[0],"per kg: cost = 2 × "+chKg+" kg chargeable (actual 120, or volumetric for air) = "+cKg);
 ok(Math.abs(cCbm-100*kgcbm[1])<0.02,"per CBM: cost = 100 × "+kgcbm[1]+" cbm = "+cCbm+" · hint: "+hint.slice(0,60));
 /* reset needs two presses when dirty */
 await p.click('.drawer [data-act="fnreset"]');await p.waitForTimeout(200);await p.click('.drawer [data-act="fnreset"]');await p.waitForTimeout(1200);
 ok(await p.evaluate(b=>S.drawer?.form==="shipment"&&(val("goods")||"")===b&&!S.drawer.dirty,before),"Reset (pressed twice) starts the form fresh");
 /* Back from the form returns to the record, not the list */
 await p.click('.drawer [data-act="fnback"]');await p.waitForTimeout(500);
 ok(await p.evaluate(no=>!S.drawer?.form&&S.drawer?.col==="shipments"&&S.drawer?.id===no,sh),"Back from the edit form → back on the shipment record");
 /* Cancel also returns to the record */
 await p.evaluate(no=>editDoc("shipments",no),sh);await p.waitForTimeout(900);await p.click('.drawer .df [data-act="close"]');await p.waitForTimeout(500);
 ok(await p.evaluate(no=>S.drawer?.col==="shipments"&&S.drawer?.id===no,sh),"Cancel from the edit form → back on the record");
 /* record Back steps through history; Recent lists records */
 const other=await p.evaluate(()=>live(D.purchases)[0].no);await p.evaluate(no=>openDoc("purchases",no),other);await p.waitForTimeout(400);
 const rec=await p.evaluate(()=>[...document.querySelectorAll('.drawer [data-act="fnrecent"]')].map(b=>b.dataset.id));ok(rec.includes(sh),"Recent shows the shipment opened before: "+rec.slice(0,4).join(", "));
 await p.click('.drawer [data-act="fnback"]');await p.waitForTimeout(500);ok(await p.evaluate(no=>S.drawer?.id===no,sh),"Back on a record → the previous record");
 /* saved rate basis is used by the record */
 await p.evaluate(async no=>{await updateDoc("shipments",no,{rateBasis:"kg",rate:3},"t")},sh);await p.waitForTimeout(300);
 await p.evaluate(async no=>{await updateDoc("shipments",no,{kg:120,cbm:1.5},"t")},sh);const ch=await p.evaluate(no=>{const s=docOf("shipments",no);return[chargeable(s).basis,chargeable(s).value,+s.kg]},sh);ok(ch[0]==="kg"&&ch[1]>=ch[2],"saved Rate is per kg → chargeable "+ch[1]+" kg");
 /* suggestions on a purchase text field */
 await p.evaluate(()=>{S.drawer=null;openForm("purchase",{})});await p.waitForTimeout(900);const dl=await p.evaluate(()=>document.querySelectorAll(".drawer datalist").length);ok(dl>0,"new purchase form offers earlier values ("+dl+" fields with suggestions)");
 ok(!errs.length,"no page errors "+JSON.stringify(errs.slice(0,2)));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
