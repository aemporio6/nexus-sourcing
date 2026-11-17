/* Import › "Part of order" is never empty (18 Nov 2026): even when the invoice's party has no orders. CI_FILE=… Demo :8093 */
const{chromium}=require("playwright");const fs=require("fs");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 await p.evaluate(()=>go("import"));const b64=fs.readFileSync(process.env.CI_FILE).toString("base64");
 await p.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await handleImport(new File([bin],"ci.xlsx"))},b64);await p.waitForTimeout(1200);
 await p.evaluate(()=>{S.imp.def.party="FWD-006";S.imp.def.po="";S.imp.def.poAuto=false;S.imp.P&&(S.imp.P.poCands=[]);if(S.imp.preview)S.imp.preview.poCands=[];renderImportPreview?renderImportPreview():render()});await p.waitForTimeout(800);
 const opts=await p.evaluate(()=>{const s=[...document.querySelectorAll("select")].find(s=>[...s.options].some(o=>o.value==="__new"&&/New order from this invoice/.test(o.text)));return s?[...s.options].map(o=>o.value):null});console.log((opts||[]).length,"options");
 ok(opts&&opts.filter(v=>v&&v!=="__new").length>3,"Part of order lists orders even for a party with no orders");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
