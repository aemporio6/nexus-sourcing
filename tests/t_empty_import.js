/* A brand-new EMPTY workspace: the importer must never get stuck (20 Nov 2026). Empty demo on :8095.
   CI → ＋ New supplier (name from the file) → Import → order + 21 products + supplier, each in its own module.
   Product info sheet → Create all (＋ New brand) → products. Freight PDF → shipment + forwarder + products. Folder order. */
const{chromium}=require("playwright");const fs=require("fs");const A="/mnt/user-data/attachments/117846c6-ab7f-5f52-9a04-3582b9919749/";
const CI=process.env.CI_FILE||A+"2ff90f76-247ctns_CI_WAP-UK-JW20261103001_VARTLEAVES_-___.xlsx",PIS=process.env.PIS_FILE||A+"7dc5502f-to_AMAZON_6142packs247ctns-SEA_SHIPPING-product_information______toilet_brush.xlsx",FR=process.env.FR_FILE||A+"1250c9b2-Freight_Invoice_SQ-2026-0001_FBA15MNXZ6RBU_1_2.pdf";
(async()=>{const b=await chromium.launch();let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};const errs=[];
 const fresh=async()=>{const p=await b.newPage({viewport:{width:1300,height:900}});p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept("Vartleaves Home"));await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());await p.goto("http://localhost:8095/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(900);return p};
 const load=async(p,f,n)=>{await p.evaluate(()=>go("import"));const b64=fs.readFileSync(f).toString("base64");await p.evaluate(async([b64,n])=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await handleImport(new File([bin],n))},[b64,n]);await p.waitForTimeout(3000)};
 /* 1. CI */
 let p=await fresh();ok(await p.evaluate(()=>live(D.products).length===0&&live(D.parties).length===0&&items("category").length>5&&items("uom").length>0),"empty workspace starts with the standard lists (categories, units …) but no products / suppliers");
 await load(p,CI,"ci.xlsx");
 ok(await p.evaluate(()=>S.imp.def.po==="__new"&&!!$(".ixa_po")),"CI with no order → 'new order from this invoice' chosen by itself");
 ok(await p.evaluate(()=>/WINAPPROACH/.test($("#ixa_name")?.value||"")),"＋ New supplier is open with the name from the file");
 ok(await p.evaluate(()=>!!$(".ixa_why")&&$('[data-act="runimport"]').disabled),"grey Import button says why");
 await p.click("[data-ixa-make]");await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>live(D.parties).some(x=>/WINAPPROACH/.test(x.name))&&!$('[data-act="runimport"]').disabled),"supplier created (in Suppliers) and Import is possible");
 ok(await p.evaluate(()=>/21 products/.test($(".ixa_auto")?.innerText||"")),"21 unknown products are set to 'create as new' by themselves");
 await p.click('[data-act="runimport"]');await p.waitForTimeout(4000);
 const r1=await p.evaluate(()=>{const po=live(D.purchases)[0];return{po:!!po,lines:(po?.lines||[]).length,party:po&&party(po.party)?.name,prods:live(D.products).length,piNo:po?.piNo}});console.log(JSON.stringify(r1));
 ok(r1.po&&r1.lines>=21&&/WINAPPROACH/.test(r1.party||"")&&r1.prods>=21,"Import → order (Purchases) with all lines + 21 products (Products) + supplier — each in its own place");
 /* 2. product info sheet on a fresh empty workspace: Create all */
 await p.close();p=await fresh();await load(p,PIS,"pis.xlsx");
 ok(await p.evaluate(()=>!!document.querySelector("[data-ixa-pisall]")),"product info sheet: 'Create all' is offered");
 ok(await p.evaluate(()=>[...document.querySelectorAll("#pisbox select[data-pis-nb] option")].some(o=>o.value==="__new")),"every Brand dropdown in the sheet has ＋ New brand");
 await p.selectOption("#ixa_pb","__new");await p.waitForTimeout(900);
 const cat=await p.evaluate(()=>$("#ixa_pc").value||items("category")[0].id);await p.selectOption("#ixa_pc",cat);
 await p.click("[data-ixa-pisall]");await p.waitForTimeout(4000);
 ok(await p.evaluate(()=>live(D.products).length>=21&&items("brand").some(b=>b.label==="Vartleaves Home")),"Create all → 21 products, the new brand is in the Brands list everywhere");
 /* 3. freight PDF */
 await p.close();p=await fresh();await load(p,FR,"freight.pdf");
 ok(await p.evaluate(()=>!$('[data-act="runimport"]').disabled),"freight invoice on empty data: importable at once (forwarder + products created as new, starter rates)");
 await p.click('[data-act="runimport"]');await p.waitForTimeout(4000);
 ok(await p.evaluate(()=>live(D.shipments).length===1&&live(D.parties).some(x=>x.type==="forwarder")),"→ shipment in Shipments + forwarder in Suppliers");
 /* 4. several files: right order */
 ok(await p.evaluate(()=>{const n=["PAYMENT SUMMARY.xlsx","Freight_Invoice.pdf","CI_WAP.xlsx","product_information.xlsx","SUPPLIER LIST.xlsx"].map(x=>[x,ixaRank(x)]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);return n[0]==="SUPPLIER LIST.xlsx"&&n[1]==="product_information.xlsx"&&n[2]==="CI_WAP.xlsx"&&n[4]==="PAYMENT SUMMARY.xlsx"}),"a folder is taken in the right order: parties → products → invoices → freight → payments");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
