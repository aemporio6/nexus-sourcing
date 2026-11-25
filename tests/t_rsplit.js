// One receipt, several bills: proposal (exact fit, deposit, named bills), left-over, already-recorded warning, filled payment form.
// Needs the LIVE-DATA copy build on :8096.  Run: NODE_PATH=/opt/npm-tools/node_modules node tests/t_rsplit.js
process.env.MT_URL=process.env.MT_URL||"http://localhost:8096/index.html?demo";const h=require("./imp/h.js");
(async()=>{const {br,pg,errs}=await h.open();let ok=0,bad=0;const t=(n,c,x)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n+(c?"":" → "+String(JSON.stringify(x)).slice(0,600)))};
 const bills=await pg.evaluate(()=>{S.rs={party:"SUP-001",cur:"RMB"};const b=rsBills();S.rs=null;return b.map(x=>({ref:x.ref,owed:x.owed,dep:x.dep,cur:x.cur,same:x.same}))});
 const same=bills.filter(b=>b.same);t("open bills of the supplier are found (live copy)",same.length>=3,bills);
 const A=same[same.length-1],B=same[same.length-2];
 // exact: two bills
 let r=await pg.evaluate(({amt})=>{rsOpen({party:"SUP-001",amount:amt,cur:"RMB",name:"receipt"});return{rows:S.rs.rows.filter(x=>x.on),how:S.rs.how,sum:rsSum()}},{amt:Math.round((A.owed+B.owed)*100)/100});
 t("exact fit: two open bills add up to the receipt",r.rows.length===2&&Math.abs(r.sum-(A.owed+B.owed))<0.02&&/add up to the receipt exactly/.test(r.how)&&r.rows.some(x=>x.ref===A.ref)&&r.rows.some(x=>x.ref===B.ref),r);
 let txt=await pg.textContent("#rswin");t("window: ✔ every part has its bill; button on",/Every part of the receipt has its bill/.test(txt)&&!(await pg.evaluate(()=>document.querySelector('#rswin [data-rs="go"]').disabled)),txt.slice(-300));
 // one bill exactly
 r=await pg.evaluate(({amt})=>{rsOpen({party:"SUP-001",amount:amt,cur:"RMB"});return{rows:S.rs.rows.filter(x=>x.on),how:S.rs.how}},{amt:A.owed});
 t("exact fit: one bill",r.rows.length===1&&/exactly what is still owed/.test(r.how),r);
 // deposit
 const D1=same.find(b=>b.dep&&b.dep<b.owed-1&&!same.some(o=>Math.abs(o.owed-b.dep)<1));
 if(D1){r=await pg.evaluate(({amt})=>{rsOpen({party:"SUP-001",amount:amt,cur:"RMB"});return{rows:S.rs.rows.filter(x=>x.on),how:S.rs.how}},{amt:D1.dep});t("exact fit: the deposit of a bill",r.rows.length===1&&r.rows[0].ref===D1.ref&&/deposit/.test(r.how),r)}else t("(no bill with an unpaid deposit in the copy — deposit case skipped)",true);
 // named bill + left over
 r=await pg.evaluate(()=>{const p=docOf("purchases","PO-26-0072");const owed=poState(p).outstandingCur;rsOpen({name:"110 | 24 Nov | Rcpt ¥"+(owed+1157.17).toFixed(2)+" 300 Plunger",folder:"110 | 300 Plunger | 24 Nov ",mime:"image/jpeg"});return{party:S.rs.party,amount:S.rs.amount,cur:S.rs.cur,date:S.rs.date,rows:S.rs.rows.filter(x=>x.on),how:S.rs.how,owed}});
 t("from the receipt's name: party, amount, currency and date are read",r.party==="SUP-001"&&Math.abs(r.amount-(r.owed+1157.17))<0.01&&r.cur==="RMB"&&/-11-24$/.test(r.date),r);
 t("the bill named in the receipt (plunger) is in the split",r.rows.some(x=>x.ref==="PO-26-0072"),r);
 await pg.evaluate(()=>{S.rs.rows.forEach(x=>{x.on=x.ref==="PO-26-0072";if(!x.on)x.a=""});const i=S.rs.rows.findIndex(x=>x.on);S.rs.rows[i].a=rsBills()[i].owed;S.rs.url="https://drive.google.com/file/d/RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR/view";rsDraw()});
 txt=await pg.textContent("#rswin .rssum");t("left over is said in plain words (1,157.17 has no bill → credit)",/1,157\.17 of the receipt has no bill yet/.test(txt)&&/credit/.test(txt),txt);
 // over-allocation blocks
 await pg.evaluate(()=>{const i=S.rs.rows.findIndex(x=>x.on);S.rs.keep=S.rs.rows[i].a;S.rs.rows[i].a=+S.rs.amount+500;rsDraw()});
 t("more than the receipt → button off, said clearly",await pg.evaluate(()=>document.querySelector('#rswin [data-rs="go"]').disabled&&/more than the receipt/.test(document.querySelector("#rswin .rssum").textContent)));
 await pg.evaluate(()=>{const i=S.rs.rows.findIndex(x=>x.on);S.rs.rows[i].a=S.rs.keep;rsDraw()});
 t("every dropdown in the window is known to the centre",await pg.evaluate(()=>[...document.querySelectorAll("#rswin select")].every(s=>s.dataset.src||s.dataset.fixed)));
 const amt=await pg.evaluate(()=>+S.rs.amount);
 await pg.click('#rswin [data-rs="go"]');await pg.waitForTimeout(1200);
 r=await pg.evaluate(()=>({form:S.drawer&&S.drawer.form,party:val("party"),amount:+val("amount"),cur:val("cur"),date:val("date"),receipt:val("receipt"),notes:val("notes"),rows:rowsOf("allocations").map(x=>[x.ref,+x.amount]),rs:!!S.rs,saved:live(D.payments).length}));
 t("the payment form opens filled in: party, amount, currency, date, receipt link",r.form==="payment"&&r.party==="SUP-001"&&Math.abs(r.amount-amt)<0.01&&r.cur==="RMB"&&/-11-24$/.test(r.date)&&/RRRR/.test(r.receipt||""),r);
 t("… one line for the plunger bill, the left-over written in the notes",r.rows.length===1&&r.rows[0][0]==="PO-26-0072"&&/1,157\.17 not applied/.test(r.notes||""),r);
 const before=r.saved;t("nothing was saved by the window itself",await pg.evaluate(n=>live(D.payments).length===n,before));
 await pg.evaluate(()=>{S.drawer=null;render()});
 // already recorded
 const P=await pg.evaluate(()=>{const p=live(D.payments).filter(x=>x.party==="SUP-001"&&x.cur==="RMB"&&!x.receipt&&!(x.docs&&x.docs.receipt)).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];return p&&{no:p.no,amount:p.amount,date:p.date}});
 if(P){await pg.evaluate(p=>rsOpen({party:"SUP-001",amount:p.amount,cur:"RMB",date:p.date,url:"https://drive.google.com/file/d/SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS/view",name:"rcpt"}),P);txt=await pg.textContent("#rswin");
  t("a payment of the same amount and date exists → warning, not entered twice",/already recorded/.test(txt)&&txt.includes(P.no),txt.slice(0,300));
  await pg.click('#rswin [data-rs="attach"]');await pg.waitForTimeout(600);r=await pg.evaluate(no=>({rc:docOf("payments",no).receipt,n:live(D.payments).length,open:!!S.rs}),P.no);t("… the receipt goes on that payment instead",/SSSS/.test(r.rc||"")&&r.n===before&&!r.open,r)}
 else t("(no recent payment without receipt in the copy — skipped)",true);
 // a receipt in "Where does this go?" offers the split
 await pg.evaluate(()=>dbPlaceOpen({name:"41-24 Nov  Rcpt ¥17169 IN THIS INVOICE 78CTN PAID TWICE ",folder:"41/ 24NOV  1000 Earwex ",mime:"image/jpeg",url:"https://drive.google.com/file/d/1B4cO5ZDOI5geBZv7MFtPaXIUInF94NhL/view"}));await pg.waitForSelector('#dbpwin [data-rsx="open"]');
 await pg.click('#dbpwin [data-rsx="open"]');await pg.waitForSelector("#rswin");r=await pg.evaluate(()=>({party:S.rs.party,amount:S.rs.amount,url:S.rs.url,dbp:!!S.dbp}));
 t("“Where does this go?” offers it for a receipt and carries party, amount and link over",r.party==="SUP-001"&&r.amount===17169&&/1B4cO5/.test(r.url)&&!r.dbp,r);
 await pg.evaluate(()=>rsClose());
 // Documents shows each order's share of a split payment
 r=await pg.evaluate(()=>{const p=live(D.payments).find(x=>(x.allocations||[]).filter(a=>a.ref).length>1&&(x.receipt||x.docs?.receipt||(x.links||[]).length));if(!p)return null;const d=dbAllDocs().find(z=>z.col==="payments"&&z.id===p.no);return{no:p.no,orders:d.orders,shares:d.shares}});
 t("Documents: a receipt of a split payment counts for every bill, with its share",!r||(r.orders.length>1&&Object.keys(r.shares).length>1),r);
 t("Create has it (Money)",await pg.evaluate(()=>chItems().some(i=>i.key==="x:rsplit")));
 t("no page errors",!errs.length,errs);console.log(`\n${ok} pass, ${bad} fail`);await br.close();process.exit(bad?1:0)})();
