/* Product information sheet dropped on the Import page (15 Nov 2026): recognised by itself (not read as PI lines),
   asks which order it is for, and lets you create a product that MY TOOL does not have yet. Demo build on :8093.
   PIS_FILE=/path/product_information….xlsx node tests/t_prodsheet.js   (live-data check: scratch harness t_pis.js) */
const{chromium}=require("playwright");const fs=require("fs");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 await p.evaluate(()=>go("import"));const b64=fs.readFileSync(process.env.PIS_FILE).toString("base64");
 const r=await p.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return await handleImport(new File([bin],"pis.xlsx"))},b64);await p.waitForTimeout(800);
 ok(r&&r.pis&&!(S=>S)(0),"sheet recognised as a product information sheet");
 ok(await p.evaluate(()=>!!document.querySelector("[data-pis-po]")),"window asks which order the sheet is for");
 ok(await p.evaluate(()=>!/error/i.test(document.querySelector(".drawer").innerText)),"no error wording in the window");
 let un=await p.evaluate(()=>S.pis.rows.findIndex(x=>!x.m));if(un<0)un=await p.evaluate(()=>{S.pis.rows[0].m=null;S.pis.rows[0].r.asin="B0TEST0001";S.pis.rows[0].r.name="Test brush pack of 2";pisShow();return 0});
 if(un>=0){await p.evaluate(i=>{const sb=document.querySelector(`[data-pis-nb="${i}"]`),sc=document.querySelector(`[data-pis-nc="${i}"]`);sb.value=sb.options[1].value;sc.value=sc.options[1].value},un);
  await p.click(`[data-pis="mk"][data-i="${un}"]`);await p.waitForTimeout(800);ok(await p.evaluate(i=>!!S.pis.rows[i].m&&!!product(S.pis.rows[i].m.p.sku),un),"＋ Create product makes the missing product from the sheet")}
 if(await p.evaluate(()=>!document.querySelector('[data-pis="apply"]').disabled))await p.click('[data-pis="apply"]');await p.waitForTimeout(1000);ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
