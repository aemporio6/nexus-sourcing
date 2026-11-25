// Document brain: facts from names, ranked recommendation, place / replace / move, history, Documents window.
// Needs the LIVE-DATA copy build (it checks the owner's real orders):  MT_URL=http://localhost:8096/index.html?demo
// Run: NODE_PATH=/opt/npm-tools/node_modules MT_URL=... node tests/t_docbrain.js
process.env.MT_URL=process.env.MT_URL||"http://localhost:8096/index.html?demo";const h=require("./imp/h.js");
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,500)))};
 pg.on("dialog",d=>d.accept());
 const R=await pg.evaluate(()=>{const t=f=>{const r=dbRank(f);const s=dbSure(r.list);return{sure:s?[s.col,s.id,s.pct,s.why.join("; ")]:null,first:r.list[0]?[r.list[0].col,r.list[0].id,r.list[0].pct]:null,F:r.F}};return{
  a:t({name:"002-Nov21-CI-Earwex-£462.62  with alibaba 3%",folder:"002-Nov 21-Earwex DDP Air",mime:"application/pdf"}),
  b:t({name:"110 | 24 Nov | Invoice |300 Plunger ",folder:"110 | 300 Plunger | 24 Nov "}),
  c:t({name:"42- Nov24-W-H-7500  ",folder:"42/ 24 Nov/ W-H -7500 /30% and full for 20ctn "}),
  d:t({name:"commercial invoice.pdf",party:"FWD-005",kind:"Freight / shipping"}),
  e:t({name:"41-24 Nov  Rcpt ¥17169 IN THIS INVOICE 78CTN PAID TWICE ",folder:"41/ 24NOV  1000 Earwex ",mime:"image/jpeg"}),
  f:t({name:"108-109-Inspection Report ",mime:"application/pdf",size:135592403}),
  g:t({name:"2952PCS=99CTNS CI_WAP-UK-JW20261103003_VARTLEAVES .xlsx",party:"SUP-001",kind:"Invoice (PI / CI)"}),
  x:t({name:"scan0001.pdf"}),
  tx:t({name:"commercial invoice.pdf",party:"FWD-005",kind:"Freight / shipping",text:"COMMERCIAL INVOICE | Buyer VLOOK LTD | Earwax Remover | 5 boxes | 73 kg | Total 581.81 | Air DDP"})}});
 t("Earwex freight invoice → earwax order PO-26-0073",R.a.sure&&R.a.sure[1]==="PO-26-0073",R.a);
 t("… the forwarder's folder no. 002 is NOT taken as an order number",!/folder number/.test(R.a.sure?R.a.sure[3]:""),R.a);
 t("110 plunger invoice → PO-26-0072, folder no. 110 read",R.b.sure&&R.b.sure[1]==="PO-26-0072"&&R.b.F.nums[0]==="110",R.b);
 t("42 W-H → window handles PO-26-0074 (product code WH)",R.c.sure&&R.c.sure[1]==="PO-26-0074"&&/WH/.test(R.c.sure[3]),R.c);
 t("bare 'commercial invoice.pdf' from a forwarder → NO recommendation (this went onto SH-26-0053 by mistake before)",R.d.sure===null,R.d);
 t("… but with what the PDF says (earwax, 5 boxes) → PO-26-0073",R.tx.sure&&(R.tx.sure[1]==="PO-26-0073"),R.tx);
 t("receipt 41 ¥17169 → PO-26-0073; '24' of '24 Nov' is not a folder number",R.e.sure&&R.e.sure[1]==="PO-26-0073"&&R.e.F.nums.join()==="41"&&R.e.F.kind==="receipt",R.e);
 t("108-109 inspection → PO-26-0070 / 0071 by folder number",R.f.sure&&/PO-26-007[01]/.test(R.f.sure[1])&&R.f.F.kind==="inspection",R.f);
 t("invoice number inside a file name (CI_WAP-…_VARTLEAVES) is read",R.g.F.pi[0]==="WAP-UK-JW20261103003"&&R.g.sure&&/invoice no/.test(R.g.sure[3]),R.g);
 t("a name that says nothing → no recommendation",R.x.sure===null&&R.x.first===null,R.x);
 // place a big file's link
 await pg.evaluate(()=>dbPlaceOpen({name:"110 | 24 Nov | Invoice |300 Plunger ",folder:"110 | 300 Plunger | 24 Nov ",url:"https://drive.google.com/file/d/16S1iS62_lhTb2I0vrSv9u6YJXxz1rawX/view",size:508297,src:"drive import"}));
 await pg.waitForSelector("#dbpwin");let txt=await pg.textContent("#dbpwin");
 t("window: top recommendation, why, remember #110",/My top recommendation/.test(txt)&&/PO-26-0072/.test(txt)&&/Why:/.test(txt)&&/Remember\s+#110/.test(txt),txt.slice(0,400));
 t("window: every other order is in the list",await pg.evaluate(()=>document.querySelectorAll('#dbpwin [data-dbp-f="rec"] option').length>=20));
 await pg.fill('#dbpwin [data-dbp-f="q"]',"17,160");await pg.waitForTimeout(150);
 t("Find: typing the amount finds the earwax order, focus stays",await pg.evaluate(()=>[...document.querySelectorAll('#dbpwin [data-dbp-f="rec"] option')].some(o=>/PO-26-0073/.test(o.textContent))&&document.activeElement?.dataset?.dbpF==="q"));
 await pg.fill('#dbpwin [data-dbp-f="q"]',"");await pg.waitForTimeout(100);await pg.click('#dbpwin [data-dbp="usetop"]').catch(()=>{});
 await pg.click('#dbpwin [data-dbp="ok"]');await pg.waitForTimeout(700);
 let st=await pg.evaluate(()=>{const p=docOf("purchases","PO-26-0072");return{links:(p.links||[]).map(l=>[l.label,l.from,l.by?1:0]),folderNo:p.folderNo,log:D.log.find(e=>e.kind==="docs")?.text,open:!!S.dbp}});
 t("approved: link on PO-26-0072, folder no. 110 remembered, written in history",st.links.some(l=>/Plunger/.test(l[0])&&l[1]==="drive import")&&st.folderNo==="110"&&/added as evidence/.test(st.log||"")&&!st.open,st);
 const again=await pg.evaluate(()=>{const r=dbRank({name:"110 receipt",mime:"image/jpeg"});const s=dbSure(r.list);return{s:s&&[s.col,s.id,s.pct,s.why[0]],same:dbFindSame("https://drive.google.com/file/d/16S1iS62_lhTb2I0vrSv9u6YJXxz1rawX/view?usp=x","").length,search:searchAll("#110").slice(0,3).map(x=>x.x.no)}});
 t("next file named '110 …' → found at once by folder number",again.s&&again.s[1]==="PO-26-0072"&&/folder number 110/.test(again.s[3]),again);
 t("the same link again → 'already in MY TOOL'",again.same===1,again);
 t("search '#110' finds the order",again.search.includes("PO-26-0072"),again);
 // replace
 await pg.evaluate(()=>dbPlaceOpen({name:"110 invoice FINAL signed",url:"https://drive.google.com/file/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/view",src:"document check"}));
 await pg.waitForSelector('#dbpwin [data-dbp-f="repl"]');const nBefore=await pg.evaluate(()=>docOf("purchases","PO-26-0072").links.length);
 const idx=await pg.evaluate(()=>String(docOf("purchases","PO-26-0072").links.findIndex(l=>/Plunger/.test(l.label))));await pg.selectOption('#dbpwin [data-dbp-f="repl"]',idx);await pg.waitForTimeout(100);
 t("replace: the button says Replace",/Replace it on PO-26-0072/.test(await pg.textContent('#dbpwin [data-dbp="ok"]')));
 await pg.click('#dbpwin [data-dbp="ok"]');await pg.waitForTimeout(600);
 st=await pg.evaluate(()=>{const p=docOf("purchases","PO-26-0072");return{n:p.links.length,labels:p.links.map(l=>l.label)}});
 t("replace: same number of documents, the old one is gone",st.n===nBefore&&st.labels.some(l=>/FINAL/.test(l))&&!st.labels.some(l=>/300 Plunger/.test(l)),st);
 // move from a wrong record
 await pg.evaluate(()=>go("home",{},{force:true}));
 const wrong=await pg.evaluate(()=>{const s=docOf("shipments","SH-26-0053");return(s.links||[]).map((l,i)=>[i,l.label,l.from])});
 t("live copy: Shunqi's commercial invoice sits on SH-26-0053 (the mistake to repair)",wrong.some(l=>/commercial invoice/i.test(l[1])),wrong);
 await pg.evaluate(()=>sbOpen());await pg.waitForSelector("#sbwin");await pg.click('#sbwin [data-dbh="tab"][data-t="hist"]');await pg.waitForTimeout(200);
 txt=await pg.textContent("#sbwin");t("inbox History tab: shows what was approved and where",/History \(\d+\)/.test(txt)&&/SH-26-0053/.test(txt)&&/Move to another record/.test(txt),txt.slice(0,300));
 await pg.click('#sbwin [data-dbh="move"][data-id="SH-26-0053"]');await pg.waitForSelector("#dbpwin");
 await pg.selectOption('#dbpwin [data-dbp-f="col"]',"purchases");await pg.fill('#dbpwin [data-dbp-f="q"]',"PO-26-0073");await pg.waitForTimeout(150);await pg.selectOption('#dbpwin [data-dbp-f="rec"]',"PO-26-0073");await pg.waitForTimeout(100);
 const before=wrong.filter(l=>/commercial invoice/i.test(l[1])).length;await pg.click('#dbpwin [data-dbp="ok"]');await pg.waitForTimeout(800);
 st=await pg.evaluate(()=>({sh:(docOf("shipments","SH-26-0053").links||[]).filter(l=>/commercial invoice/i.test(l.label)).length,po:(docOf("purchases","PO-26-0073").links||[]).filter(l=>/commercial invoice/i.test(l.label)).length,log:D.log.filter(e=>e.kind==="docs").map(e=>e.text)}));
 t("move: off SH-26-0053, on PO-26-0073, both written in history",st.sh===before-1&&st.po===1&&st.log.some(x=>/moved to PO-26-0073/.test(x)),st);
 // supplier inbox: no blind pre-selection
 await pg.evaluate(()=>{S.sb.tab="check";S.slIn=S.slIn||{};S.slIn.list=[{id:"f1",name:"commercial invoice.pdf",party:"FWD-005",kind:"Freight / shipping",size:262165,at:nowIso(),text:""},{id:"f2",name:"commercial invoice.pdf",party:"FWD-005",kind:"Freight / shipping",size:262165,at:nowIso(),text:""},{id:"f3",name:"110 plunger packing list.xlsx",party:"SUP-001",kind:"Packing list",size:5000,at:nowIso()}];S.isOwner=true;S.sb.open="f1";S.sb.d=null;sbDraw()});await pg.waitForTimeout(200);
 st=await pg.evaluate(()=>({dis:document.querySelector('#sbwin [data-sb="approve"]')?.disabled,rec:S.sb.d.rec,txt:document.querySelector("#sbwin .sbdecide")?.textContent.slice(0,400)}));
 t("inbox: bare forwarder file → nothing pre-chosen, Approve is off",st.dis===true&&st.rec===""&&/No sure match/.test(st.txt),st);
 t("inbox: the same file waiting twice → duplicate warning",/Looks like a duplicate/.test(st.txt)&&/1 more time/.test(st.txt),st);
 await pg.evaluate(()=>{S.sb.open="f3";S.sb.d=null;sbDraw()});await pg.waitForTimeout(200);
 st=await pg.evaluate(()=>({rec:S.sb.d.rec,col:S.sb.d.col,txt:document.querySelector("#sbwin .sbdecide")?.textContent.slice(0,300),hasRepl:!!document.querySelector('#sbwin [data-sbx-f="repl"]')}));
 t("inbox: '110 plunger packing list' → PO-26-0072 recommended and pre-chosen, Add/Replace offered",st.rec==="PO-26-0072"&&/My top recommendation/.test(st.txt)&&st.hasRepl,st);
 await pg.evaluate(()=>sbClose());
 // Documents
 await pg.evaluate(()=>dcOpen());await pg.waitForSelector("#dcwin");
 st=await pg.evaluate(()=>({n:dbAllDocs().length,rows:document.querySelectorAll("#dcwin #dc_body tr").length,sel:[...document.querySelectorAll("#dcwin select")].every(s=>s.dataset.src||s.dataset.fixed),pk:document.querySelectorAll("#dcwin .pkm").length}));
 t("Documents: lists the documents on records, 4 multi filters",st.n>100&&st.rows>50&&st.pk===4,st);
 await pg.fill("#dc_q","#110");await pg.waitForTimeout(150);t("Documents: search by folder number",await pg.evaluate(()=>{const r=document.querySelectorAll("#dcwin #dc_body tr");return r.length>=2&&r.length<10&&/PO-26-0072/.test(document.querySelector("#dc_body").textContent)}));
 await pg.click('#dcwin [data-dc="pv"]');await pg.waitForTimeout(200);st=await pg.evaluate(()=>({src:document.querySelector("#dcwin iframe")?.getAttribute("src")||"",pv:S.dc.pv}));t("Documents: Preview opens inside the window (Drive preview, no download)",/google\.com\/.+\/preview$/.test(st.src),st);
 await pg.fill("#dc_q","");await pg.click('#dcwin [data-dc="tab"][data-t="miss"]');await pg.waitForTimeout(200);txt=await pg.textContent("#dcwin #dc_body");
 t("Documents: What is missing — per order ✔ / ✗",/orders miss at least one/.test(txt)&&/PO-26-0074/.test(txt)&&/✗/.test(txt),txt.slice(0,200));
 await pg.click('#dcwin [data-dc="tab"][data-t="by"]');await pg.waitForTimeout(200);txt=await pg.textContent("#dcwin #dc_body");t("Documents: By supplier / forwarder",/documents ·/.test(txt)&&/records/.test(txt),txt.slice(0,200));
 await pg.evaluate(()=>dcClose());
 st=await pg.evaluate(()=>({cr:chItems().filter(i=>/docplace|documents/.test(i.key)).map(i=>[i.key,i.dept]),form:fields("purchase").some(f=>f.k==="folderNo")&&fields("shipment").some(f=>f.k==="folderNo")}));
 t("Create has Documents + Put a document link (Import & files); Folder no. is on the order and shipment forms",st.cr.length===2&&st.cr.every(c=>c[1]==="Import & files")&&st.form,st);
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
