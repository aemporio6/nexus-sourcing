// Fix it: finds the mistakes in the owner's live copy and repairs them step by step.
// Needs the LIVE-DATA copy build on :8096.  Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_fixit.js
process.env.MT_URL=process.env.MT_URL||"http://localhost:8096/index.html?demo";const h=require("./imp/h.js");
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,700)))};
 pg.on("dialog",d=>d.accept());
 let L=await pg.evaluate(()=>fxList(false).map(x=>({id:x.id,title:x.title,steps:x.steps.map(s=>s.label)})));const ids=L.map(x=>x.id);
 t("finds the 3 orders without a buying company (plunger, earwax, window handles)",["noco:PO-26-0072","noco:PO-26-0073","noco:PO-26-0074"].every(i=>ids.includes(i)),ids);
 t("finds the same document twice on SH-26-0053",ids.some(i=>/^dup:shipments:SH-26-0053/.test(i)),ids);
 t("finds Colin's invoice on the wrong shipment, with the steps",ids.includes("case:shunqi-ci-0053")&&L.find(x=>x.id==="case:shunqi-ci-0053").steps.length===2,L.find(x=>x.id==="case:shunqi-ci-0053"));
 t("finds 'invoice says paid 18,317.17 — no payment recorded' on the earwax order",ids.includes("paidsaid:PO-26-0073")&&/18,317\.17/.test(L.find(x=>x.id==="paidsaid:PO-26-0073").title),L.filter(x=>/paidsaid/.test(x.id)));
 await pg.evaluate(()=>{go("home",{},{force:true})});await pg.waitForTimeout(400);t("Home shows the card",await pg.evaluate(()=>/Fix it — \d+ thing/.test(document.querySelector("#fxcard")?.textContent||"")));
 await pg.click('[data-fxopen]');await pg.waitForSelector("#fxwin");
 // 1. no company: seller's name in "billed to" → choose
 await pg.click('#fxwin [data-fx="step"][data-id="noco:PO-26-0074"]');await pg.waitForSelector('#fxwin [data-fxp="co"]');await pg.selectOption('#fxwin [data-fxp="co"]',"c1");await pg.click('#fxwin [data-fx="pickok"]');await pg.waitForTimeout(600);
 let st=await pg.evaluate(()=>{const p=docOf("purchases","PO-26-0074");return{acc:p.account,bill:p.piBilledTo,gone:!fxList(false).some(x=>x.id==="noco:PO-26-0074"),log:D.log.find(e=>e.kind==="fix"&&/Fix it/.test(e.text))?.text}});
 t("window handles → Vartleaves; the seller's name is cleared from 'billed to'; written in history",st.acc==="c1"&&!st.bill&&st.gone&&/buying company set to Vartleaves/.test(st.log||""),st);
 // 2. VLOOK: simulate the re-read invoice (buyer VLOOK) then add the company
 await pg.evaluate(async()=>{await updateDoc("purchases","PO-26-0073",{piBilledTo:"VLOOK LTD ， Company number 14000237",account:"c1"},"test: buyer as on the invoice");fxDraw()});await pg.waitForTimeout(300);
 L=await pg.evaluate(()=>fxList(false).filter(x=>/^buyer:PO-26-0073/.test(x.id)).map(x=>({id:x.id,steps:x.steps.map(s=>s.label)})));t("buyer on the invoice is not one of the companies → offers 'Add VLOOK LTD' and 'another name of…'",L.length===1&&/Add “VLOOK LTD”/.test(L[0].steps[0])&&/another name/.test(L[0].steps[1]),L);
 await pg.evaluate(()=>fxDraw());await pg.click(`#fxwin [data-fx="step"][data-id="${L[0].id}"][data-i="0"]`);await pg.waitForTimeout(900);
 st=await pg.evaluate(()=>{const c=(SET().companies||[]).find(c=>/vlook/i.test(c.name));const p=docOf("purchases","PO-26-0073");return{c,acc:p.account,match:fxCoMatch("Vlook Limited")?.id,still:fxList(false).some(x=>/^buyer:PO-26-0073/.test(x.id))}});
 t("VLOOK added as a company (company no. kept, no VAT), the earwax order moved to it",st.c&&st.c.companyNo==="14000237"&&st.c.vatRegistered===false&&st.acc===st.c.id&&st.match===st.c.id&&!st.still,st);
 st=await pg.evaluate(async()=>{const d={no:"PO-T-1",id:"PO-T-1",party:"SUP-001",piBilledTo:"VLOOK LTD",lines:[],cur:"RMB",date:today(),status:"ordered",kind:"china"};await writeDoc("purchases","PO-T-1",d,"t");const a=docOf("purchases","PO-T-1").account;const d2={no:"PO-T-2",id:"PO-T-2",party:"SUP-001",piBilledTo:party("SUP-001").company||party("SUP-001").name,lines:[],cur:"RMB",date:today(),status:"ordered",kind:"china"};await writeDoc("purchases","PO-T-2",d2,"t");return{a,vl:(SET().companies||[]).find(c=>/vlook/i.test(c.name)).id,b2:docOf("purchases","PO-T-2").piBilledTo}});
 t("a new order billed to VLOOK gets VLOOK as buying company by itself; the seller's name is never kept as 'billed to'",st.a===st.vl&&!st.b2,st);
 // 3. duplicates
 const dupId=ids.find(i=>/^dup:shipments:SH-26-0053/.test(i));const nB=await pg.evaluate(()=>docOf("shipments","SH-26-0053").links.filter(l=>/commercial invoice/i.test(l.label)).length);
 await pg.evaluate(()=>fxDraw());await pg.click(`#fxwin [data-fx="step"][data-id="${dupId}"]`);await pg.waitForTimeout(700);
 st=await pg.evaluate(()=>docOf("shipments","SH-26-0053").links.filter(l=>/commercial invoice/i.test(l.label)).length);t("extra copy taken off — exactly one stays",nB>=2&&st===1,{nB,st});
 // 4. the Shunqi case: move to the order
 await pg.click('#fxwin [data-fx="step"][data-id="case:shunqi-ci-0053"][data-i="1"]');await pg.waitForTimeout(900);
 st=await pg.evaluate(()=>({sh:docOf("shipments","SH-26-0053").links.filter(l=>/commercial invoice/i.test(l.label)).length,po:(docOf("purchases","PO-26-0073").links||[]).filter(l=>/commercial invoice/i.test(l.label)).length,gone:!fxList(false).some(x=>x.id==="case:shunqi-ci-0053")}));
 t("Colin's invoice: off SH-26-0053, on PO-26-0073; the case is closed",st.sh===0&&st.po===1&&st.gone,st);
 // 5. not a problem / bring back
 const anyId=await pg.evaluate(()=>fxList(false)[0].id);await pg.click(`#fxwin [data-fx="hide"][data-id="${anyId}"]`);await pg.waitForTimeout(400);
 st=await pg.evaluate(id=>({hid:!fxList(false).some(x=>x.id===id),who:SET().fixSeen[id]}),anyId);t("'Not a problem' hides it and keeps who and when",st.hid&&st.who&&st.who.at,st);
 await pg.click('#fxwin [data-fx="hidden"]');await pg.waitForTimeout(200);await pg.click(`#fxwin [data-fx="unhide"][data-id="${anyId}"]`);await pg.waitForTimeout(400);t("'Bring back' shows it again",await pg.evaluate(id=>fxList(false).some(x=>x.id===id),anyId));
 // 6. paid-said → split window with the amount
 await pg.click('#fxwin [data-fx="step"][data-id="paidsaid:PO-26-0073"]');await pg.waitForSelector("#rswin");st=await pg.evaluate(()=>({party:S.rs.party,amount:S.rs.amount,rows:S.rs.rows.filter(r=>r.on).map(r=>r.ref),fx:!!S.fx}));
 t("'Record the payment' opens the split window with ¥18,317.17 and the earwax bill in it",st.party==="SUP-001"&&st.amount===18317.17&&st.rows.includes("PO-26-0073")&&!st.fx,st);
 await pg.evaluate(()=>rsClose());
 t("every dropdown known to the centre; Create has Fix it",await pg.evaluate(()=>{fxOpen();const ok=[...document.querySelectorAll("#fxwin select")].every(s=>s.dataset.src||s.dataset.fixed);fxClose();return ok&&chItems().some(i=>i.key==="x:fixit")}));
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
