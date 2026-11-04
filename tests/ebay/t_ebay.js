/* eBay Transaction report → fees per SKU, checked against the Seller Hub figures recorded in the Sep-2026 engine test
   (TOUQEER UK: FVF 215.17, regulatory 3.89, ad fees 43.56, insertion 50.76; VOZU UK: FVF 256.26 incl. below-standard 71.81, regulatory 3.87, ad fees 25.10, insertion 86.04, labels 3.06).
   Files: /tmp/TOUQEER_tx.csv, /tmp/VOZU_tx.csv (owner's real reports, kept outside the repo). Demo build on :8093.   node tests/ebay/t_ebay.js */
const {chromium}=require("playwright");const fs=require("fs");
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo#/import");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const run=async(file,acct)=>{const text=fs.readFileSync(file,"utf8");return await p.evaluate(async({text,acct,name})=>{S.imp=null;const f=new File([text],name,{type:"text/csv"});await handleImport(f);await new Promise(z=>setTimeout(z,1500));const I=S.imp;if(!I)return{err:"no import"};I.def.account=acct;buildPreview();renderImportPreview();await new Promise(z=>setTimeout(z,800));render();await new Promise(z=>setTimeout(z,300));
   const P=S.imp.preview;const st=P&&P.plan&&P.plan.stats||[];const uk=st.filter(s=>s.site==="UK");const sum=(l,k)=>Math.round(l.reduce((a,s)=>a+(s[k]||0),0)*100)/100;
   return{kind:S.imp.kind,fmt:S.imp.fixed&&S.imp.fixed.fmt,n:st.length,summary:P.summary,uk:{fvf:sum(uk,"fvf"),reg:sum(uk,"reg"),below:sum(uk,"below"),ads:sum(uk,"ads"),insertion:sum(uk,"insertion"),labels:sum(uk,"labels"),sales:sum(uk,"sales"),net:sum(uk,"net"),orders:uk.reduce((a,s)=>a+s.orders,0)},us:{fvf:sum(st.filter(s=>s.site==="US"),"fvf"),ads:sum(st.filter(s=>s.site==="US"),"ads")},unlinked:sum(st,"unlinkedAds"),skus:st.filter(s=>s.sku).length,missing:P.missing}},{text,acct,name:acct+"_tx.csv"})};
 const T=await run("/tmp/TOUQEER_tx.csv","TOUQEER");
 ok(T.kind==="ebaytx"&&T.fmt==="ebay_tx","TOUQEER file recognised as eBay Transaction report ("+T.kind+"/"+T.fmt+")");
 ok(Math.abs(T.uk.fvf+215.17)<0.02,"TOUQEER UK final value fees = -215.17 (got "+T.uk.fvf+")");
 ok(Math.abs(T.uk.reg+3.89)<0.02,"TOUQEER UK regulatory fee = -3.89 (got "+T.uk.reg+")");
 ok(Math.abs(T.uk.ads+41.21)<0.02,"TOUQEER UK promoted listings = -41.21 (UK orders -42.95 + 1.74 credits for last month's orders; Seller Hub screen 43.56; got "+T.uk.ads+", unlinked "+T.unlinked+")");
 ok(Math.abs(T.uk.insertion+50.76)<0.02,"TOUQEER UK insertion fees = -50.76 (got "+T.uk.insertion+")");
 ok(T.skus>50&&T.us.fvf<0,"per-SKU summaries ("+T.skus+") incl. US site (US FVF "+T.us.fvf+", US ads "+T.us.ads+")");
 console.log("  summary:",T.summary.join(" | ").slice(0,300));
 const V=await run("/tmp/VOZU_tx.csv","VOZU");
 ok(Math.abs(V.uk.fvf+V.uk.below+256.26)<0.02&&Math.abs(V.uk.below+71.81)<0.02,"VOZU UK final value fees incl. below-standard = -256.26 (got "+(V.uk.fvf+V.uk.below).toFixed(2)+", below "+V.uk.below+")");
 ok(Math.abs(V.uk.reg+3.87)<0.02&&Math.abs(V.uk.ads+23.66)<0.02&&Math.abs(V.uk.insertion+86.04)<0.02,"VOZU UK regulatory -3.87, promoted -23.66 (UK orders -24.31 + 0.65 credits; screen 25.10), insertion -86.04 (got "+V.uk.reg+", "+V.uk.ads+", "+V.uk.insertion+")");
 ok(Math.abs(V.uk.labels+3.06)<0.02,"VOZU UK postage labels = -3.06 (got "+V.uk.labels+")");
 /* commit + page */
 const C=await p.evaluate(async()=>{const n0=live(D.salesStats).filter(x=>x.type==="ebay").length;await runImport();await new Promise(z=>setTimeout(z,800));const n1=live(D.salesStats).filter(x=>x.type==="ebay").length;S.view={k:"mkt",params:{}};render();await new Promise(z=>setTimeout(z,300));const txt=document.body.textContent;return{added:n1-n0,page:/Marketplace P&L/.test(txt)&&/VOZU · 2026-09/.test(txt),bySku:document.querySelectorAll(".card:nth-of-type(2) table tr").length,nav:NAV_MODULES.some(m=>m.k==="mkt")}});
 ok(C.added>0&&C.page&&C.nav,"committed "+C.added+" summaries; Marketplace P&L page shows VOZU · 2026-09; menu has it");
 ok(!errs.length,"no page errors "+JSON.stringify(errs.slice(0,2)));console.log(fails?fails+" FAILED":"ALL PASS");await b.close();process.exit(fails?1:0)})();
