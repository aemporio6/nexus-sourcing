/* importer row report (demo build on :8093)  node tests/t_impreport.js */
const {chromium}=require("playwright");(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo#/import");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(600);
 const csv="SKU,Qty,Date,Order ID\n"+D0()+"\n";function D0(){return "NOPE-XX,5,2026-10-01,A1\n,3,2026-10-02,A2"}
 const r=await p.evaluate(async csv=>{const sku=D.products[0].sku;const text="SKU,Quantity,Date,Order ID,Channel\n"+sku+",2,2026-10-01,A1,amazon\nNOPE-XX,5,2026-10-02,A2,amazon\n,3,2026-10-03,A3,amazon\n";
  const f=new File([text],"sales.csv",{type:"text/csv"});await handleImport(f);await new Promise(z=>setTimeout(z,1500));render();await new Promise(z=>setTimeout(z,300));
  let got=null;const o=saveBlob;window.saveBlob=async(blob,name)=>{got={name,text:await blob.text()}};const btn=document.querySelector('[data-act="improwreport"]');if(btn)btn.click();await new Promise(z=>setTimeout(z,300));window.saveBlob=o;
  return{btn:!!btn,got,note:document.querySelector(".ixbar .status")?.textContent||"",kind:S.imp&&S.imp.kind,rows:S.imp&&S.imp.preview&&S.imp.preview.rows.map(r=>r.st)}},csv);
 ok(r.btn,"Row report button present (kind "+r.kind+")");ok(r.got&&/MYTOOL_import_report_sales_/.test(r.got.name),"report file named after the import: "+(r.got&&r.got.name));
 ok(r.got&&/Status,Reasons/.test(r.got.text)&&r.got.text.split("\n").length>=4,"report has status + reasons columns and one line per row");
 ok(r.got&&/(ERROR|SKIPPED|CHECK):/.test(r.got.text),"reasons are spelled out: "+(r.got&&(r.got.text.match(/(ERROR|SKIPPED|CHECK):[^|",\n]*/)||[])[0]));
 ok(/Not imported:/.test(r.note)||r.rows.every(s=>s==="ok"),"import bar says what is left out: "+r.note);
 ok(!errs.length,"no page errors "+JSON.stringify(errs));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
