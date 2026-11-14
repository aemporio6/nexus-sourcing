/* Import page extras (15 Nov 2026): search finds "importer", Drive link box on the Import page, a supplier CI as a NEW order,
   "+ Add new category" inside a new-product card, and part cartons / loose units accepted.  Demo build on :8093.
   Needs the owner's CI file: CI_FILE=/path/98ctns_CI_….xlsx   node tests/t_import_more.js */
const{chromium}=require("playwright");const fs=require("fs");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 /* 1. search */
 await p.fill("#q","importer");await p.waitForTimeout(400);const s=await p.evaluate(()=>[...document.querySelectorAll('#sugg [data-act="snew"],#sugg [data-act="sgo"]')].map(b=>b.textContent.trim()));
 ok(s.some(t=>/import/i.test(t)),"search 'importer' finds the importer: "+s.slice(0,4).join(" | "));
 await p.evaluate(()=>{hideSugg();$("#q").value=""});
 /* 2. Drive link box */
 await p.evaluate(()=>go("import"));await p.waitForTimeout(300);ok(await p.evaluate(()=>!!document.getElementById("ix_link_top")&&!!document.querySelector('[data-act="ixlinkgo"]')),"Import page shows a 'paste any Google Drive link' box");
 /* 3. part cartons */
 const cf=await p.evaluate(()=>[ctnFit(11,27,300),ctnFit(12,27,300),ctnFit(10,27,300),ctnFit(4,25,100)].map(x=>[x.ok,x.kind||"",x.text]));
 ok(cf[0][0]&&cf[0][1]==="loose"&&cf[1][0]&&cf[1][1]==="tail"&&!cf[2][0]&&cf[3][1]==="exact","300 at 27: 11 ctn = loose 3 ✓, 12 ctn = part carton of 3 ✓, 10 ctn ✗ · "+cf[0][2]+" · "+cf[1][2]);
 /* 4. CI as a new order */
 const buf=fs.readFileSync(process.env.CI_FILE).toString("base64");
 await p.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await handleImport(new File([bin],"CI_98.xlsx",{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}))},buf);await p.waitForTimeout(2500);
 const hasNew=await p.evaluate(()=>[...document.querySelectorAll('select[data-k="po"] option')].some(o=>o.value==="__new"));ok(hasNew,"'Part of order' list offers '＋ New order from this invoice'");
 await p.selectOption('select[data-k="po"]',"__new");await p.waitForTimeout(1200);
 const party=await p.evaluate(()=>live(D.parties).find(x=>x.type==="supplier").code);
 if(await p.$('select[data-k="party"]')){await p.selectOption('select[data-k="party"]',party);await p.waitForTimeout(1200)}
 const plan=await p.evaluate(()=>S.imp.preview.plan.newPo&&{n:S.imp.preview.plan.newPo.lines.length,t:S.imp.preview.plan.newPo.total,ctn:S.imp.preview.plan.newPo.ctn,miss:S.imp.preview.missing});
 ok(plan&&plan.n===9&&Math.abs(plan.t-48222.72)<0.01&&plan.ctn===98,"plan: new order with 9 lines, 98 ctn, ¥48,222.72 "+JSON.stringify(plan));
 const n0=await p.evaluate(()=>live(D.purchases).length);await p.evaluate(async()=>{await runImport()});await p.waitForTimeout(1500);
 const nw=await p.evaluate(n0=>{const l=live(D.purchases);const x=l[l.length-1];return{n:l.length-n0,no:x.no,total:x.total,lines:x.lines.length,piNo:x.piNo,fee:(x.extras||[])[0]?.a}},n0);
 ok(nw.n===1&&nw.lines===9&&Math.abs(nw.total-48222.72)<0.01&&Math.abs(nw.fee-1854.72)<0.01,"Import made order "+nw.no+": 9 lines, ¥"+nw.total+", fee ¥"+nw.fee+", PI "+nw.piNo);
 /* 5. + Add new category inside a new-product card */
 await p.evaluate(()=>go("import"));await p.waitForTimeout(300);
 const csv="SKU,Description,Qty,Unit price\nZZ-BRAND-NEW-1,Bamboo soap dish brand new,50,3.2\n";
 await p.evaluate(async t=>{S.imp=null;await handleImport(new File([t],"pi_lines.csv",{type:"text/csv"}))},csv);await p.waitForTimeout(1500);
 await p.evaluate(()=>{const I=S.imp;if(I.kind!=="pilines"&&I.kind!=="purchases"){I.kind="pilines"}buildPreview();renderImportPreview()});await p.waitForTimeout(600);
 const card=await p.$('[data-act="impdec"][data-do="new"]');if(card){await card.click();await p.waitForTimeout(500)}
 const hasAdd=await p.evaluate(()=>[...document.querySelectorAll('select[data-ixc="draft"][data-f="category"] option')].some(o=>o.value==="__addlist"));ok(hasAdd,"new-product card: Category list offers '＋ Add new category…'");
 if(hasAdd){await p.selectOption('select[data-ixc="draft"][data-f="category"]',"__addlist");await p.waitForTimeout(500);
  console.log("DBG",await p.evaluate(()=>JSON.stringify({adding:S.imp.ixAdding,n:document.querySelectorAll(".ixaddl").length,val:document.querySelector('select[data-ixc="draft"][data-f="category"]')?.value})));
  const key=await p.evaluate(()=>document.querySelector('[data-act="ixaddlist"][data-f="category"]')?.dataset.key);
  await p.fill(`[id="ixadd_${key}_category"]`,"Soap dishes");await p.click('[data-act="ixaddlist"][data-f="category"]');await p.waitForTimeout(800);
  const r=await p.evaluate(k=>({inList:items("category").some(c=>c.label==="Soap dishes"),chosen:S.imp.dec[k].draft.category,label:L("category",S.imp.dec[k].draft.category)}),key);ok(r.inList&&r.label==="Soap dishes","new category added to the list and chosen on the card: "+JSON.stringify(r))}
 ok(!errs.length,"no page errors "+JSON.stringify(errs.slice(0,2)));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
