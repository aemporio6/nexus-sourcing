/* Item 2 (17 Nov 2026): above the limit a non-owner's payment waits; the asker cannot approve; Reject needs a reason and gives the asker a task; Today box. Demo :8093 */
const{chromium}=require("playwright");
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on("pageerror",e=>errs.push(e.message));let fails=0;const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
 await p.goto("http://localhost:8093/index.html?demo");await p.waitForFunction(()=>{try{return S.ready}catch(e){return false}});await p.waitForTimeout(500);
 const me=await p.evaluate(()=>uid);console.log("uid",me);
 await p.evaluate(()=>{S.role="finance"});
 const po=await p.evaluate(()=>{const x=live(D.purchases).find(p=>{try{return poState(p).outstandingCur>40000&&p.cur==="RMB"}catch(_){return false}});return{no:x.no,party:x.party}});
 await p.evaluate(()=>openForm("payment",{}));await p.waitForTimeout(1000);
 await p.evaluate(po=>{setv("party",po.party);syncPayParty();const r=S.drawer.rows.allocations;if(!r.length)r.push({});r[0].ref=po.no;redrawRows("allocations");setv("amount",30000);setv("cur","RMB");setv("type","deposit");setv("bank",(SET().banks||[])[0]?.id||"");syncPay()},po);
 await p.evaluate(()=>savePay());await p.waitForTimeout(400);await p.evaluate(()=>{if(S.drawer?.form&&document.querySelector('[data-act="ack"]'))S.drawer.ack=true});await p.evaluate(()=>S.drawer?.form&&savePay());await p.waitForTimeout(1200);
 const pay=await p.evaluate(()=>{const x=live(D.payments).slice().sort((a,b)=>(a.createdAt||"")<(b.createdAt||"")?1:-1)[0];return{no:x.no,status:x.status,needs:x.needsApproval,approved:x.approved,req:x.requestedBy,gbp:x.gbp}});console.log(pay);
 ok(pay.status==="pending"&&pay.needs&&!pay.approved,"finance's £"+pay.gbp+" payment waits for approval");
 await p.evaluate(no=>{S.drawer=null;openDoc("payments",no)},pay.no);await p.waitForTimeout(800);
 ok(await p.evaluate(()=>/someone else approves/.test($(".apbox")?.innerText||"")),"record says someone else approves");
 await p.evaluate(no=>document.querySelector(`[data-act="approve"][data-id="${no}"]`)?.click(),pay.no);await p.waitForTimeout(600);
 ok(await p.evaluate(no=>!docOf("payments",no).approved,pay.no),"the asker cannot approve");
 /* another approver */
 await p.evaluate(()=>{window.__uid0=uid});await p.evaluate(no=>{const x=docOf("payments",no);x.requestedBy="someoneelse@x.com";render()},pay.no);await p.waitForTimeout(400);
 await p.evaluate(no=>document.querySelector(`[data-ap="ask"][data-id="${no}"]`).click(),pay.no);await p.waitForTimeout(300);
 await p.evaluate(no=>document.querySelector(`[data-ap="reject"][data-id="${no}"]`).click(),pay.no);await p.waitForTimeout(300);ok(await p.evaluate(no=>docOf("payments",no).status==="pending",pay.no),"reject without a reason refused");
 await p.fill("#ap_why","wrong supplier account");await p.evaluate(no=>document.querySelector(`[data-ap="reject"][data-id="${no}"]`).click(),pay.no);await p.waitForTimeout(1000);
 const rj=await p.evaluate(no=>({st:docOf("payments",no).status,r:docOf("payments",no).rejected,t:live(D.tasks||[]).find(t=>t.ref===no)}),pay.no);ok(rj.st==="cancelled"&&rj.r?.why&&rj.t?.who==="someoneelse@x.com","rejected with reason, asker got a task");
 /* Today box */
 await p.evaluate(()=>{const x=live(D.payments).find(p=>p.status==="paid");x.status="pending";x.needsApproval=true;x.approved=false;x.requestedBy="va@x.com";S.drawer=null;go("home")});await p.waitForTimeout(800);
 ok(await p.evaluate(()=>/Waiting for your approval/.test(document.body.innerText)),"Today shows Waiting for your approval");
 ok(!errs.length,"no page errors "+errs.join(" | "));await b.close();process.exit(fails?1:0)})();
