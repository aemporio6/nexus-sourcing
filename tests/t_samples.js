/* Samples (17 Nov 2026). Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 ok(await p.evaluate(()=>NAV_MODULES.find(m=>m.k==="purchases").items.some(i=>i[3]==="sample")&&CREATE_REG.some(c=>c.k==="sample")),"+ New sample in Buying menu and Create");
 await p.evaluate(()=>openNew("sample"));await p.waitForTimeout(900);ok(await p.evaluate(()=>S.drawer?.form==="purchase"&&val("kind")==="sample"),"form opens set to Sample");
 /* make a sample record directly (form saving is covered by the purchase tests) */
 const no=await p.evaluate(async()=>{S.drawer=null;const src=live(D.purchases).find(p=>(p.lines||[]).length&&p.kind!=="sample");const no=nextNo("purchases",today());await writeDoc("purchases",no,{no,id:no,kind:"sample",party:src.party,date:today(),cur:src.cur,lines:[{...src.lines[0],q:2}],status:"ordered",account:src.account},"sample");return no});
 await p.evaluate(no=>openDoc("purchases",no),no);await p.waitForTimeout(600);ok(await p.evaluate(()=>/waiting for your decision/.test($(".smbox")?.innerText||"")),"sample shows: waiting for decision");
 await p.click('[data-sm="no"]');await p.waitForTimeout(300);ok(await p.evaluate(no=>!docOf("purchases",no).sample?.res,no),"reject without reason refused");
 await p.click('[data-sm="ok"]');await p.waitForTimeout(600);ok(await p.evaluate(no=>docOf("purchases",no).sample?.res==="approved",no),"approved");
 await p.click('[data-sm="order"]');await p.waitForTimeout(1000);ok(await p.evaluate(()=>S.drawer?.form==="purchase"&&val("kind")==="china"&&(S.drawer.rows.lines||[]).length>0),"order form from the sample (kind China, lines copied)");
 const made=await p.evaluate(async()=>{const o=collect("purchase");const no=nextNo("purchases",today());await writeDoc("purchases",no,{...o,no,id:no},"order");return no});await p.waitForTimeout(600);
 ok(await p.evaluate(([s,m])=>docOf("purchases",m).fromSample===s&&docOf("purchases",s).orderMade===m,[no,made]),"sample and order linked both ways");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
